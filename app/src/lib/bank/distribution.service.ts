import 'server-only';

import type { ChainKey } from '@bidv/shared';
import { getLedger, type ILedgerPort } from '@/lib/ledger';
import { assertCan } from '@/lib/rbac';
import { currentRole } from '@/lib/rbac/session';
import { getDistributionStore, getOrderStore, getStore, UniqueConstraintError } from '@/lib/store';
import type { DistributionPeriodRecord, IDistributionStore } from '@/lib/store';
import { readDistributionDustWallet } from '@/lib/store/config-values';
import { authorize, toResult } from './authorize';
import { err, ok, type Result } from './result';
import {
  distributionPeriodQuerySchema,
  distributionPeriodSchema,
  openPeriodSchema,
} from './schemas';

/**
 * Nghiệp vụ CHIA LỢI NHUẬN theo sản lượng.
 *
 * Luồng đã chốt (P7): SPV nạp VNDB vào ví chia lợi nhuận -> ngân hàng CHỐT QUYỀN tại một thời
 * điểm -> toàn bộ số dư ví đó chia cho người nắm giữ WPT **theo tỷ lệ tại thời điểm chốt**.
 *
 * ## Hai điều quyết định toàn bộ thiết kế của tệp này
 *
 * **1. Chuỗi KHÔNG liệt kê được người nắm giữ.** ERC-20 chỉ lưu bảng số dư theo địa chỉ, không
 * lưu danh sách địa chỉ, nên không lời gọi nào đọc ra danh sách từ chuỗi — `ILedgerPort` cố ý
 * không có `holdersAt` (xem `ledger.port.ts` mục 4). Danh sách người nhận vì vậy dựng từ CƠ SỞ
 * DỮ LIỆU: ví có lệnh mua đã hoàn tất, cộng ví đã nhận chia ở kỳ trước. Về sau nguồn này chuyển
 * sang Indexer, và khi đó chỉ `collectRecipients` phải sửa.
 *
 * **2. Số tiền từng ví do CHUỖI tính, không phải do tệp này tính.** `distributeBatch` tự tính
 * `distributable × balanceOfAt / totalSupplyAt` và tự chống chia hai lần bằng cờ đã-nhận của
 * từng ảnh chụp. Tệp này tính LẠI cùng công thức để *ghi sổ*, nên hai bên phải khớp tuyệt đối:
 * cùng thứ tự nhân trước chia sau, cùng phép chia lấy phần nguyên, cùng `totalAmount`. Lệch một
 * đồng là sổ nói một số còn ví nhà đầu tư nhận một số khác, và không phép kiểm nào bắt được vì
 * cả hai đều đúng so với nguồn của chúng.
 *
 * LUẬT #1 chain qua `getLedger()` · LUẬT #2 ký nằm trong adapter · LUẬT #3 quyền qua RBAC.
 *
 * Guard và ghi sổ kiểm toán nằm ở TẦNG NÀY, không ở server action — giữ đúng mẫu của
 * `purchase.service` và `config.service`, vì server action không phải transport duy nhất.
 */

// =============================================================================
//  GIỚI HẠN
// =============================================================================

/**
 * Số ví tối đa quét được khi dựng danh sách người nhận.
 *
 * Phải có một con số tường minh vì `listOrders`/`listPayouts` mặc định `limit = 50`: gọi mà không
 * truyền giới hạn thì danh sách bị CẮT ÂM THẦM ở ví thứ 51, và hệ quả không phải một trang thiếu
 * dữ liệu mà là **những nhà đầu tư không bao giờ được chia**, không có thông báo nào.
 *
 * Và phải TỪ CHỐI khi chạm ngưỡng thay vì lặng lẽ lấy 5.000 ví đầu: chia cho một phần người nắm
 * giữ rồi đánh dấu kỳ hoàn tất là sai tệ hơn không chia. Chạm ngưỡng nghĩa là đã tới lúc cần
 * phân trang thật (Indexer), và đó là việc phải làm chứ không phải việc làm tròn.
 */
export const MAX_RECIPIENT_SCAN = 5_000;

// =============================================================================
//  KHUNG NHÌN
// =============================================================================

export interface DistributionPeriodView {
  id: string;
  /** Mã kỳ do nghiệp vụ đặt, ví dụ `2026-Q1`. */
  periodKey: string;
  chain: ChainKey;
  snapshotId: number;
  /**
   * Chuỗi thập phân, KHÔNG phải `bigint` và KHÔNG phải `number`: `bigint` không qua được biên
   * server -> client, `number` mất chính xác từ 2^53.
   */
  totalAmount: string;
  totalSupplyAt: string;
  status: DistributionPeriodRecord['status'];
  openedAt: string;
  completedAt: string | null;
}

/** Phần chia của MỘT ví, chốt theo ảnh chụp của kỳ. */
export interface PayoutAllocation {
  investorWallet: string;
  /** Số dư WPT của ví TẠI ảnh chụp. 0 nghĩa là ví mua sau thời điểm chốt. */
  balanceAt: string;
  /** Số VNDB được chia. `"0"` khi `balanceAt` bằng 0 hoặc khi tỷ lệ nhỏ hơn một đồng. */
  amount: string;
}

export interface DistributionPreviewView {
  period: DistributionPeriodView;
  /** Mọi ví trong danh sách người nhận, KỂ CẢ ví được chia 0 — xem `allocations` ở mục dưới. */
  allocations: PayoutAllocation[];
  /** Tổng phần chia của mọi ví. Luôn `<=` `period.totalAmount`. */
  allocated: string;
  /** `totalAmount - allocated`: phần dư do phép chia lấy phần nguyên. */
  dust: string;
  /** Ví nhận phần dư; `null` = chưa cấu hình, phần dư nằm lại trong ví chia lợi nhuận. */
  dustWallet: string | null;
}

export interface DistributionStatusView {
  period: DistributionPeriodView;
  /** Số hồ sơ theo từng trạng thái. Khoá thiếu nghĩa là 0 hồ sơ ở trạng thái đó. */
  payoutCounts: Record<string, number>;
  /** Tổng số VNDB của các hồ sơ đã ở `PAID`. */
  paidAmount: string;
  /** Số hồ sơ chưa tới đích: `PENDING` + `SENT` + `FAILED`. */
  outstanding: number;
}

// =============================================================================
//  ÁNH XẠ VÀ TÍNH TOÁN — MỘT chỗ duy nhất
// =============================================================================

function toPeriodView(period: DistributionPeriodRecord): DistributionPeriodView {
  return {
    id: period.id,
    periodKey: period.periodKey,
    chain: period.chain,
    snapshotId: period.snapshotId,
    totalAmount: period.totalAmount,
    totalSupplyAt: period.totalSupplyAt,
    status: period.status,
    openedAt: period.openedAt,
    completedAt: period.completedAt,
  };
}

/**
 * Phần chia của một ví: `tổng tiền × số dư tại ảnh chụp / tổng cung tại ảnh chụp`.
 *
 * **NHÂN TRƯỚC, CHIA SAU.** Đây không phải sở thích trình bày. `bigint` chia lấy phần nguyên, nên
 * `balanceAt / totalSupplyAt` cho ra `0` với mọi ví nắm dưới 100% tổng cung, và nhân `totalAmount`
 * với 0 thì **mọi người được chia 0** — một lỗi im lặng: hàm chạy xong, không lỗi nào, kỳ đánh dấu
 * hoàn tất, không ai nhận được gì.
 *
 * Phần lẻ bị cắt là CÓ CHỦ Ý và khớp contract: tổng các phần nguyên nhỏ hơn hoặc bằng tổng tiền,
 * nên không bao giờ chia vượt quỹ. Phần cắt ra là `dust`, xử lý ở `allocate`.
 */
function shareOf(totalAmount: bigint, balanceAt: bigint, totalSupplyAt: bigint): bigint {
  return (totalAmount * balanceAt) / totalSupplyAt;
}

/**
 * Phân bổ cho một danh sách ví, đọc số dư TẠI ảnh chụp từ chuỗi.
 *
 * Dùng chung cho xem trước VÀ cho lúc lập hồ sơ chia, và đó là điểm chính: hai đường tính rời
 * nhau sẽ lệch ở lần sửa đầu tiên, rồi màn hình xem trước hiện một số còn hồ sơ ghi số khác —
 * đúng thứ mà màn hình xem trước tồn tại để tránh.
 */
async function allocate(
  ledger: ILedgerPort,
  period: DistributionPeriodRecord,
  wallets: readonly string[],
): Promise<PayoutAllocation[]> {
  const totalAmount = BigInt(period.totalAmount);
  const totalSupplyAt = BigInt(period.totalSupplyAt);

  const rows: PayoutAllocation[] = [];
  for (const wallet of wallets) {
    const balanceAt = await ledger.balanceOfAt(wallet, period.snapshotId);
    rows.push({
      investorWallet: wallet,
      balanceAt: balanceAt.toString(),
      amount: shareOf(totalAmount, balanceAt, totalSupplyAt).toString(),
    });
  }
  return rows;
}

/** Tổng phần chia của một danh sách phân bổ. */
function sumAmount(rows: readonly { amount: string }[]): bigint {
  return rows.reduce((total, row) => total + BigInt(row.amount), 0n);
}

/**
 * Câu mô tả phần dư, dùng cho cả khung nhìn xem trước và bản ghi kiểm toán.
 *
 * ⚠️ GIỚI HẠN ĐÃ BIẾT, đọc trước khi sửa: phần dư **chưa thật sự chuyển** cho ví chỉ định.
 * `distributeBatch` tự tính phần từng ví nên tầng nghiệp vụ không có đường nào bảo nó trả thêm
 * cho một ví; phần dư nằm lại trong ví chia lợi nhuận, và hàm lấy nó ra (`sweepDust` của
 * contract) chưa có trong `ILedgerPort`.
 *
 * Vì vậy ở đây chỉ GHI NHẬN phần dư và đích của nó, không cộng vào `amount` của ví nào. Cộng vào
 * sẽ làm sổ ghi một số lớn hơn số chuỗi chuyển — loại lệch tệ nhất, vì cả hai con số đều tự nhận
 * là đúng. Đã ghi thành câu hỏi mở trong checkpoint BE-06.
 */
function dustNote(dust: bigint, dustWallet: string | null): string {
  if (dust === 0n) return 'không có phần dư';
  return dustWallet
    ? `phần dư ${dust} VNDB ghi nhận cho ví ${dustWallet}, hiện còn trong ví chia lợi nhuận ` +
        `(chưa có hàm quét phần dư ở ILedgerPort)`
    : `phần dư ${dust} VNDB giữ lại trong ví chia lợi nhuận (chưa cấu hình ví nhận phần dư)`;
}

// =============================================================================
//  DANH SÁCH NGƯỜI NHẬN — từ cơ sở dữ liệu, KHÔNG từ chuỗi
// =============================================================================

interface Recipients {
  /** Ví theo thứ tự gặp lần đầu. Giữ nguyên văn cách viết, không hạ hoa thường. */
  wallets: string[];
  /** Đã chạm `MAX_RECIPIENT_SCAN` ở một nguồn nào đó -> danh sách KHÔNG đầy đủ. */
  truncated: boolean;
}

/**
 * Hai nguồn, hợp lại và bỏ trùng: ví có lệnh mua ĐÃ HOÀN TẤT, cộng ví đã nhận chia ở kỳ trước.
 *
 * Vì sao cần nguồn thứ hai chứ không chỉ lấy lệnh mua: WPT tới tay một ví còn bằng đường
 * `transfer` giữa hai nhà đầu tư, và ví đó không có lệnh mua nào. Ví đã từng nằm trong một kỳ
 * chia là bằng chứng nó đã từng nắm WPT, nên nó phải được xét lại ở kỳ sau. Ví không còn giữ WPT
 * thì `balanceOfAt` trả 0 và phần chia là 0 — có mặt trong danh sách không làm ai nhận sai.
 *
 * Bỏ trùng KHÔNG PHÂN BIỆT HOA THƯỜNG, nhưng GIỮ nguyên văn cách viết gặp lần đầu. Hai điều đó
 * phải đi cùng nhau: ràng buộc duy nhất `(periodId, investorWallet)` của cơ sở dữ liệu so chuỗi
 * CHÍNH XÁC, nên `0xAb…` và `0xab…` lọt được thành hai hồ sơ cho cùng một ví; còn hạ hết về chữ
 * thường thì sai địa chỉ Stellar (base32 CHỮ HOA).
 */
async function collectRecipients(chain: ChainKey): Promise<Recipients> {
  const seen = new Map<string, string>();
  let truncated = false;

  const add = (wallet: string) => {
    const key = wallet.toLowerCase();
    if (!seen.has(key)) seen.set(key, wallet);
  };

  // --- Nguồn 1: lệnh mua đã hoàn tất trên CHUỖI ĐANG XÉT ---------------------
  const orders = await getOrderStore().listOrders({
    chain,
    status: 'COMPLETED',
    limit: MAX_RECIPIENT_SCAN,
  });
  if (orders.length >= MAX_RECIPIENT_SCAN) truncated = true;
  for (const order of orders) add(order.investorWallet);

  // --- Nguồn 2: ví đã có hồ sơ chia ở các kỳ trước của CHUỖI ĐANG XÉT --------
  // Đi qua bảng kỳ trước rồi mới tới hồ sơ, chứ không gọi `listPayouts()` trống: hồ sơ chia không
  // mang cột `chain` (nó thuộc về kỳ), nên lấy trống sẽ trộn ví của chuỗi khác vào.
  const distributionStore = getDistributionStore();
  const periods = await distributionStore.listPeriods({ chain, limit: MAX_RECIPIENT_SCAN });
  if (periods.length >= MAX_RECIPIENT_SCAN) truncated = true;
  for (const period of periods) {
    const payouts = await distributionStore.listPayouts({
      periodId: period.id,
      limit: MAX_RECIPIENT_SCAN,
    });
    if (payouts.length >= MAX_RECIPIENT_SCAN) truncated = true;
    for (const payout of payouts) add(payout.investorWallet);
  }

  return { wallets: [...seen.values()], truncated };
}

/** Thông báo khi danh sách người nhận bị cắt — nói rõ việc phải làm, không chỉ nói đã lỗi. */
function truncatedError<T>(): Result<T> {
  return err(
    'UNKNOWN',
    `Danh sách người nhận chạm giới hạn quét ${MAX_RECIPIENT_SCAN} ví, nên nó KHÔNG đầy đủ và ` +
      `không được dùng để chia. Chia cho một phần người nắm giữ rồi đánh dấu kỳ hoàn tất là sai ` +
      `tệ hơn chưa chia. Cần phân trang thật (Indexer) trước khi chia ở quy mô này.`,
  );
}

/** Tra kỳ và kiểm nó thuộc đúng chuỗi đang xét. */
async function findPeriodOnChain(
  store: IDistributionStore,
  chain: ChainKey,
  ref: { periodId?: string; periodKey?: string },
): Promise<DistributionPeriodRecord | Result<never>> {
  const period = ref.periodId
    ? await store.findPeriod(ref.periodId)
    : await store.findPeriodByKey(ref.periodKey as string);

  if (!period) {
    return err(
      'PERIOD_STATE',
      `Không có kỳ chia nào với ${ref.periodId ? `mã ${ref.periodId}` : `mã kỳ "${ref.periodKey}"`}.`,
    );
  }
  if (period.chain !== chain) {
    // Ảnh chụp số dư thuộc về MỘT chuỗi. Đọc `balanceOfAt` của chuỗi khác là tra một sổ khác
    // hoàn toàn, và con số trả về trông hợp lệ nên không gì báo lỗi.
    return err(
      'PERIOD_STATE',
      `Kỳ "${period.periodKey}" thuộc chain "${period.chain}", không xử lý được trên chain "${chain}".`,
    );
  }
  return period;
}

/** Phân biệt kỳ tìm được với `Result` lỗi mà `findPeriodOnChain` trả về. */
function isPeriod(
  value: DistributionPeriodRecord | Result<never>,
): value is DistributionPeriodRecord {
  return 'periodKey' in value;
}

// =============================================================================
//  B1 — MỞ KỲ: chốt quyền
// =============================================================================

/**
 * Mở một kỳ chia: chốt số dư ví lợi nhuận, chụp ảnh số dư WPT, lưu kỳ ở `OPEN`.
 *
 * ## Thứ tự các bước là phần quan trọng nhất của hàm này
 *
 * `takeSnapshot` là một lần GHI lên chuỗi, còn ba phép kiểm trước nó đều là đọc. Vì vậy mọi phép
 * kiểm chạy TRƯỚC — một mã kỳ trùng không được làm tốn một ảnh chụp trên chuỗi.
 *
 * Phép kiểm "mã kỳ đã tồn tại" có ở CẢ HAI chỗ: một lần đọc ở đây, và ràng buộc duy nhất
 * `periodKey` ở cơ sở dữ liệu. Không phải làm hai lần cho chắc — hai chỗ trả lời hai câu hỏi
 * khác nhau. Lần đọc ở đây tránh tốn ảnh chụp cho một lời gọi chắc chắn trượt; ràng buộc mới là
 * thứ BẢO ĐẢM không có hai kỳ cùng mã, vì hai tiến trình song song đều đọc thấy "chưa có" rồi
 * cùng ghi. Bỏ ràng buộc và chỉ giữ lần đọc là đúng cái sai mà doc của cổng cảnh báo.
 */
export async function openPeriod(input: unknown): Promise<Result<DistributionPeriodView>> {
  const parsed = openPeriodSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, periodKey } = parsed.data;

  const txnStore = getStore();
  const distributionStore = getDistributionStore();

  try {
    // `authorize` ghi sổ kiểm toán cho CẢ hai kết cục rồi mới ném.
    const role = await authorize('distribution:snapshot', periodKey, chain);
    const ledger = getLedger(chain);

    const auditFailure = async (detail: string) => {
      await txnStore.appendAudit({
        actorRole: role,
        action: 'distribution:snapshot',
        target: periodKey,
        outcome: 'FAILURE',
        detail,
        chain,
      });
    };

    // --- 1. Mã kỳ đã dùng chưa (đọc; chưa chạm chuỗi) ------------------------
    if (await distributionStore.findPeriodByKey(periodKey)) {
      const reason = `Kỳ "${periodKey}" đã được mở. Mỗi mã kỳ chỉ mở được một lần.`;
      await auditFailure(reason);
      return err('PERIOD_STATE', reason);
    }

    // --- 2. Ví chia lợi nhuận có tiền chưa (đọc) -----------------------------
    const poolBefore = await ledger.profitPoolBalance();
    if (poolBefore === 0n) {
      const reason =
        `Ví chia lợi nhuận không có VNDB nào nên không mở được kỳ "${periodKey}". ` +
        `SPV phải nạp tiền vào ví chia lợi nhuận trước khi chốt quyền.`;
      await auditFailure(reason);
      return err('INSUFFICIENT_PROFIT_POOL', reason);
    }

    // --- 3. CHỐT QUYỀN: từ đây đã ghi lên chuỗi ------------------------------
    // Mã ảnh chụp lấy từ sự kiện trong biên nhận, do adapter bóc ra. KHÔNG tự tăng số đếm và
    // KHÔNG gọi lại hàm đọc mã hiện tại: một ảnh chụp của tiến trình khác chen vào giữa hai lời
    // gọi là lấy về mã của họ, rồi chia lợi nhuận theo ảnh chụp sai.
    const snapshot = await ledger.takeSnapshot();

    await txnStore.saveTxn({
      chain,
      operation: 'snapshot',
      txHash: snapshot.tx.txHash,
      status: snapshot.tx.status,
      fromWallet: null,
      toWallet: null,
      amount: null,
      reason: `chốt quyền kỳ ${periodKey}, snapshot ${snapshot.snapshotId}`,
      actorRole: role,
      actorAddress: null,
    });

    // --- 4. Quỹ có đổi trong lúc chốt không ----------------------------------
    /**
     * Contract CHỐT số tiền chia được ngay tại lời gọi chụp ảnh, và `ILedgerPort` không có hàm
     * đọc lại con số đã chốt đó. Nên `totalAmount` ở đây là số ta đọc được TRƯỚC khi chụp, và nó
     * chỉ đúng khi quỹ không đổi giữa hai thời điểm.
     *
     * Đọc lại và so là cách duy nhất phát hiện được việc đó. Lệch thì TỪ CHỐI mở kỳ: ghi một
     * `totalAmount` khác con số contract đã chốt sẽ làm MỌI phần chia trong sổ sai lệch, và không
     * phép kiểm nào về sau bắt được. Đổi lại là một ảnh chụp bỏ không — giá rẻ hơn hẳn.
     */
    const poolAfter = await ledger.profitPoolBalance();
    if (poolAfter !== poolBefore) {
      const reason =
        `Số dư ví chia lợi nhuận đổi từ ${poolBefore} sang ${poolAfter} VNDB ngay trong lúc chốt ` +
        `quyền, nên không xác định được contract đã chốt con số nào. Ảnh chụp ${snapshot.snapshotId} ` +
        `bỏ không; dừng nạp/rút ví lợi nhuận rồi mở kỳ lại.`;
      await auditFailure(reason);
      return err('PERIOD_STATE', reason);
    }

    // --- 5. Có ai đang nắm WPT không ----------------------------------------
    const totalSupplyAt = await ledger.totalSupplyAt(snapshot.snapshotId);
    if (totalSupplyAt === 0n) {
      const reason =
        `Tổng cung WPT tại ảnh chụp ${snapshot.snapshotId} bằng 0 — không có quyền nào để chia, ` +
        `nên kỳ "${periodKey}" không được mở. Phát hành nguồn cung và bán cho nhà đầu tư trước.`;
      await auditFailure(reason);
      return err('NO_CIRCULATING_SUPPLY', reason);
    }

    // --- 6. Lưu kỳ ----------------------------------------------------------
    let period: DistributionPeriodRecord;
    try {
      period = await distributionStore.openPeriod({
        periodKey,
        snapshotId: snapshot.snapshotId,
        totalAmount: poolBefore.toString(),
        totalSupplyAt: totalSupplyAt.toString(),
        chain,
      });
    } catch (error) {
      // Ràng buộc duy nhất là thứ BẢO ĐẢM; tới được đây nghĩa là một tiến trình khác vừa mở
      // đúng kỳ này sau lần đọc ở bước 1.
      if (error instanceof UniqueConstraintError) {
        const reason =
          `Kỳ "${periodKey}" vừa được một tiến trình khác mở. Không mở kỳ thứ hai cùng mã.`;
        await auditFailure(reason);
        return err('PERIOD_STATE', reason);
      }
      throw error;
    }

    await txnStore.appendAudit({
      actorRole: role,
      action: 'distribution:snapshot',
      target: periodKey,
      outcome: 'SUCCESS',
      detail:
        `mở kỳ ${period.id}: snapshot ${snapshot.snapshotId}, tổng tiền ${poolBefore} VNDB, ` +
        `tổng cung ${totalSupplyAt} WPT; tx ${snapshot.tx.txHash}`,
      chain,
    });

    return ok(toPeriodView(period));
  } catch (error) {
    return toResult(error);
  }
}

// =============================================================================
//  B2 — XEM TRƯỚC PHÂN BỔ
// =============================================================================

/**
 * Phân bổ sẽ chia nếu chạy `distributePeriod` bây giờ. Hàm ĐỌC: không ghi một dòng nào.
 *
 * ⚠️ KIỂM QUYỀN BẰNG `assertCan`, KHÔNG dùng `authorize()`, và đây là chủ đích — cùng lý do đã
 * ghi ở `previewPurchase`. `authorize` ghi một bản ghi kiểm toán, tức là hàm này sẽ ghi vào cơ sở
 * dữ liệu, mà điều kiện hoàn thành của BE-06 đòi xem trước KHÔNG ghi gì. LUẬT #3 vẫn giữ: quyền
 * đi qua bảng RBAC, không so tên vai.
 *
 * Hệ quả cần biết: một lần xem trước BỊ CHẶN không để lại dấu vết. Chấp nhận được vì hàm chỉ đọc;
 * đã ghi thành câu hỏi mở trong checkpoint BE-03 cho cùng tình huống.
 *
 * Kiểm `distribution:execute` chứ không phải một quyền đọc: đây là bản xem trước của đúng hành
 * động đó, nên ai xem trước được thì cũng phải là người được phép chia.
 */
export async function previewDistribution(
  input: unknown,
): Promise<Result<DistributionPreviewView>> {
  const parsed = distributionPeriodSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, periodId } = parsed.data;

  try {
    assertCan(await currentRole(), 'distribution:execute');

    const found = await findPeriodOnChain(getDistributionStore(), chain, { periodId });
    if (!isPeriod(found)) return found;

    const recipients = await collectRecipients(chain);
    if (recipients.truncated) return truncatedError();

    const allocations = await allocate(getLedger(chain), found, recipients.wallets);
    const allocated = sumAmount(allocations);
    const dust = BigInt(found.totalAmount) - allocated;

    return ok({
      period: toPeriodView(found),
      allocations,
      allocated: allocated.toString(),
      dust: dust.toString(),
      dustWallet: await readDistributionDustWallet(),
    });
  } catch (error) {
    return toResult(error);
  }
}

// =============================================================================
//  B4 — ĐỌC TRẠNG THÁI KỲ
// =============================================================================

/**
 * Trạng thái một kỳ và tiến độ chi trả. Hàm ĐỌC.
 *
 * Dùng `assertCan` thay vì `authorize` vì màn hình theo dõi một kỳ đang chia sẽ gọi lại hàm này
 * liên tục: mỗi lời gọi một bản ghi kiểm toán sẽ nhấn chìm sổ bằng hàng trăm dòng "đã cho phép
 * xem" cho một kỳ, và sổ mất khả năng dùng để đối chiếu trách nhiệm.
 *
 * Quyền là `reconcile:read` — dữ liệu toàn hệ, nên ba vai phía ngân hàng (kể cả AUDITOR và
 * COMPLIANCE) đọc được, còn nhà đầu tư thì không. Nhà đầu tư xem phần của chính mình qua
 * `portfolio.service`, không qua hàm này.
 */
export async function getDistributionPeriod(
  input: unknown,
): Promise<Result<DistributionStatusView>> {
  const parsed = distributionPeriodQuerySchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, periodId, periodKey } = parsed.data;

  try {
    assertCan(await currentRole(), 'reconcile:read');

    const store = getDistributionStore();
    const found = await findPeriodOnChain(store, chain, { periodId, periodKey });
    if (!isPeriod(found)) return found;

    const payouts = await store.listPayouts({
      periodId: found.id,
      limit: MAX_RECIPIENT_SCAN,
    });

    const payoutCounts: Record<string, number> = {};
    for (const payout of payouts) {
      payoutCounts[payout.status] = (payoutCounts[payout.status] ?? 0) + 1;
    }

    return ok({
      period: toPeriodView(found),
      payoutCounts,
      paidAmount: sumAmount(payouts.filter((p) => p.status === 'PAID')).toString(),
      outstanding: payouts.filter((p) => p.status !== 'PAID').length,
    });
  } catch (error) {
    return toResult(error);
  }
}
