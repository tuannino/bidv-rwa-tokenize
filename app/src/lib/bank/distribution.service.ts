import 'server-only';

import type { ChainKey } from '@bidv/shared';
import {
  getLedger,
  LedgerError,
  receiptTimeoutFor,
  type ChainDistribution,
  type ILedgerPort,
  type TxResult,
} from '@/lib/ledger';
import { assertCan, type Role } from '@/lib/rbac';
import { currentRole } from '@/lib/rbac/session';
import {
  getDistributionStore,
  getOrderStore,
  getStore,
  MAX_BULK_ROWS,
  UniqueConstraintError,
} from '@/lib/store';
import type {
  DistributionPayoutRecord,
  DistributionPayoutStatus,
  DistributionPeriodRecord,
  IDistributionStore,
  ITxnStore,
} from '@/lib/store';
import {
  readDistributionBatchSize,
  readDistributionDustWallet,
  readDistributionMaxBatchesPerRun,
} from '@/lib/store/config-values';
import { authorize, toResult } from './authorize';
import { err, ok, type Result } from './result';
import {
  distributionPeriodQuerySchema,
  distributionPeriodSchema,
  openPeriodSchema,
} from './schemas';
import type { ErrorCode } from './result';

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

/**
 * Chờ biên nhận NGẮN khi đối soát lại một giao dịch đã gửi ở lượt trước: chỉ cần biết nó đã
 * xong hay còn treo, không chờ nó vào khối. Treo thì để lượt sau, không gửi chồng.
 */
const RECHECK_RECEIPT_TIMEOUT_MS = 1_000;

/** Kỳ còn hồ sơ phải chi: hồ sơ `EXPIRED` không còn gì để chi (phần đó đã về quỹ). */
const isPayable = (row: { status: DistributionPayoutStatus }) =>
  row.status !== 'PAID' && row.status !== 'EXPIRED';

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
  /** SC-06: mã kỳ trên chuỗi; `null` với kỳ trước SC-06 hoặc đang `OPENING`. */
  distributionId: number | null;
  /** SC-06 QĐ-G: trạng thái đẩy số đã chia vào vault; `null` = chưa đẩy hoặc chain không có vault. */
  vaultCloseStatus: DistributionPeriodRecord['vaultCloseStatus'];
  vaultPeriodRef: number | null;
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

export interface DistributionRunView {
  period: DistributionPeriodView;
  /** Kích thước lô đã dùng, đọc từ tham số hệ thống `distribution.batch_size`. */
  batchSize: number;
  /**
   * Số lô tối đa lần chạy này được gửi, đọc từ `distribution.max_batches_per_run`.
   *
   * `batches === maxBatches` và `outstanding > 0` nghĩa là lượt chia bị CHẶN vì chạm hạn mức,
   * không phải vì lỗi — gọi lại sẽ chia tiếp. Đây là thứ phân biệt "còn việc" với "có lỗi",
   * nên khung nhìn phải mang cả hai con số chứ không chỉ mang `outstanding`.
   */
  maxBatches: number;
  /** Số lô đã GỬI trong lần chạy này. `0` khi không còn hồ sơ nào phải chi. */
  batches: number;
  /** Số hồ sơ chuyển sang `PAID` trong lần chạy này. */
  paid: number;
  /** Số hồ sơ thất bại trong lần chạy này — chạy lại sẽ nhắm đúng chúng. */
  failed: number;
  /** Số hồ sơ được chia 0 nên không cần giao dịch nào. */
  zero: number;
  /** SC-06: số hồ sơ chốt `PAID` nhờ đối soát từ chuỗi (tự nhận, lô đã lên chuỗi mà chưa ghi). */
  reconciled: number;
  /** SC-06: số hồ sơ chuyển `EXPIRED` trong lần chạy này vì kỳ hết hạn hoặc đã đóng. */
  expired: number;
  /** Hồ sơ còn phải chi SAU lần chạy này (không tính `PAID`, `EXPIRED`). `0` = kỳ đã kết thúc. */
  outstanding: number;
  /** Tổng VNDB đã chi của CẢ KỲ, không chỉ của lần chạy này. */
  paidAmount: string;
  dust: string;
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
    distributionId: period.distributionId,
    vaultCloseStatus: period.vaultCloseStatus,
    vaultPeriodRef: period.vaultPeriodRef,
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
 *
 * @flow distribute:6 | đọc số dư từng ví tại ảnh chụp, tính phần chia nhân trước chia sau
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
 * Phần dư do phép chia lấy phần nguyên ở lại DỰ TRỮ của kỳ trên chuỗi; khi kỳ đóng sau hạn nhận
 * (`closeDistribution`), nó trở về quỹ chưa phân bổ và được chia ở kỳ sau (SC-06 QĐ-28). Không có
 * đường chuyển phần dư cho ví nào, nên ở đây chỉ GHI NHẬN, không cộng vào `amount` của ví nào.
 * `dustWallet` giữ để hiển thị cấu hình cũ, không còn là đích chuyển tiền.
 */
function dustNote(dust: bigint, dustWallet: string | null): string {
  if (dust === 0n) return 'không có phần dư';
  return (
    `phần dư ${dust} VNDB ở lại dự trữ của kỳ, về quỹ chưa phân bổ khi đóng kỳ` +
    (dustWallet ? ` (ví nhận phần dư cấu hình ${dustWallet} không còn được chuyển tới)` : '')
  );
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
 *
 * SC-06 (CH-3, QĐ-12): cộng thêm ví SPV (`spvWallet()`, trên EVM chính là vault thanh toán) ở mọi
 * chain, để phần của WPT chưa bán được chia vào vault.
 *
 * GIỚI HẠN ĐÃ BIẾT: ví nhận WPT bằng chuyển trực tiếp mà chưa từng mua hay nhận chia có thể bị bỏ
 * sót. Phần của ví đó nằm trong dự trữ của kỳ tới khi kỳ đóng rồi về quỹ chưa phân bổ. Indexer
 * (IN-01) sẽ đóng giới hạn này.
 *
 * @flow distribute:5 | dựng danh sách người nhận từ cơ sở dữ liệu cộng ví SPV vì chuỗi không liệt kê được người nắm giữ
 */
async function collectRecipients(chain: ChainKey, ledger: ILedgerPort): Promise<Recipients> {
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

  // --- Nguồn 3: ví SPV (vault) giữ WPT chưa bán ------------------------------
  const spv = await ledger.spvWallet();
  if (spv) add(spv);

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
//  B1 — MỞ KỲ: giữ chỗ, mở trên chuỗi, phục hồi (SC-06 QĐ-F)
// =============================================================================

/** Những thứ mọi bước mở kỳ và đẩy vault cùng dùng, gom lại để không truyền năm tham số. */
interface ChainContext {
  chain: ChainKey;
  ledger: ILedgerPort;
  store: IDistributionStore;
  txnStore: ITxnStore;
  role: Role;
}

async function auditOpening(
  ctx: ChainContext,
  periodKey: string,
  outcome: 'SUCCESS' | 'FAILURE',
  detail: string,
): Promise<void> {
  await ctx.txnStore.appendAudit({
    actorRole: ctx.role,
    action: 'distribution:snapshot',
    target: periodKey,
    outcome,
    detail,
    chain: ctx.chain,
  });
}

/** Mã lỗi cho một lần chuỗi từ chối mở kỳ: tiền và tổng cung có mã riêng như trước SC-06. */
function openRejectedCode(error: LedgerError): ErrorCode {
  if (/phần chưa phân bổ/.test(error.message)) return 'INSUFFICIENT_PROFIT_POOL';
  if (/Tổng cung WPT/.test(error.message)) return 'NO_CIRCULATING_SUPPLY';
  return 'PERIOD_STATE';
}

/**
 * Ghi kỳ `OPEN` bằng số liệu ĐỌC TỪ CHUỖI rồi đẩy số đã chia vào vault (QĐ-G).
 *
 * `completeOpening` là cập nhật có điều kiện: tiến trình khác đã hoàn tất trước thì không ghi
 * đè, đọc lại bản đã ghi. Lỗi ở bước vault KHÔNG huỷ kỳ: kỳ vẫn chia được, BE-07 thử lại.
 */
async function finishOpening(
  ctx: ChainContext,
  period: DistributionPeriodRecord,
  found: ChainDistribution,
  how: string,
): Promise<DistributionPeriodRecord> {
  const completed =
    (await ctx.store.completeOpening({
      id: period.id,
      distributionId: found.distributionId,
      distributorAddress: found.distributor,
      snapshotId: found.snapshotId,
      totalAmount: found.amount.toString(),
      totalSupplyAt: found.totalSupplyAt.toString(),
    })) ??
    (await ctx.store.findPeriod(period.id)) ??
    period;

  await auditOpening(
    ctx,
    period.periodKey,
    'SUCCESS',
    `mở kỳ ${period.id} (${how}): kỳ trên chuỗi ${found.distributionId} của ${found.distributor}, ` +
      `snapshot ${found.snapshotId}, tổng tiền ${found.amount} VNDB, tổng cung ${found.totalSupplyAt} WPT`,
  );

  try {
    await syncVaultClose(ctx, completed);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Lỗi không xác định.';
    await auditOpening(ctx, period.periodKey, 'FAILURE', `đẩy số đã chia vào vault chưa xong — ${reason}`);
  }
  return (await ctx.store.findPeriod(completed.id)) ?? completed;
}

/**
 * Đưa một kỳ `OPENING` tới `OPEN`, hoặc bỏ bản giữ chỗ khi chuỗi CHẮC CHẮN từ chối.
 *
 * Mọi nhánh đều tra `findDistribution(periodKey)` trước khi kết luận: nhãn kỳ dùng một lần trên
 * chuỗi, nên kỳ đã lên chuỗi (kể cả bởi một lần gửi trước mà ta mất biên nhận) luôn tra được, và
 * gửi lại cùng nhãn không thể tạo kỳ thứ hai.
 *
 * - `recover`: đã có trên chuỗi thì chỉ hoàn tất, không gửi gì; chưa có thì gửi lại.
 * - Không có và giao dịch chắc chắn revert: XOÁ bản giữ chỗ (chọn xoá, không thêm trạng thái lỗi:
 *   mã kỳ được dùng lại khi đủ điều kiện, và sổ kiểm toán đã ghi lần thất bại).
 * - Không có và chưa xác định (hết thời gian chờ, lỗi RPC): GIỮ `OPENING`, trả lỗi.
 *
 * @flow distribute:15 | mở kỳ trên chuỗi bằng nhãn dùng một lần, lưu mã giao dịch trước khi chờ, tra kỳ trên chuỗi để hoàn tất hoặc phục hồi
 */
async function driveOpening(
  ctx: ChainContext,
  period: DistributionPeriodRecord,
  mode: 'send' | 'recover',
): Promise<Result<DistributionPeriodRecord>> {
  const { chain, ledger, store, txnStore } = ctx;
  const key = period.periodKey;

  if (mode === 'recover') {
    const existing = await ledger.findDistribution(key);
    if (existing) return ok(await finishOpening(ctx, period, existing, 'phục hồi từ chuỗi'));
  }

  let tx: TxResult;
  try {
    tx = await ledger.openDistribution(key);
  } catch (error) {
    const found = await ledger.findDistribution(key);
    if (found) return ok(await finishOpening(ctx, period, found, 'kỳ đã có trên chuỗi'));
    if (error instanceof LedgerError && error.reverted) {
      await store.deleteOpeningPeriod(period.id);
      const reason =
        `Chuỗi từ chối mở kỳ "${key}": ${error.message} Đã bỏ bản giữ chỗ; mã kỳ dùng lại được ` +
        `khi đủ điều kiện.`;
      await auditOpening(ctx, key, 'FAILURE', reason);
      return err(openRejectedCode(error), reason);
    }
    const reason =
      `Chưa xác định được kỳ "${key}" đã lên chuỗi hay chưa (${
        error instanceof Error ? error.message : 'lỗi không xác định'
      }). Giữ kỳ ở OPENING; phục hồi bằng recoverOpeningPeriod hoặc vòng sau của tiến trình tự động.`;
    await auditOpening(ctx, key, 'FAILURE', reason);
    return err('PERIOD_STATE', reason);
  }

  // Mã giao dịch vào sổ NGAY KHI CÓ, trước khi chờ biên nhận.
  await store.setOpenTxHash({ id: period.id, openTxHash: tx.txHash });
  const savedTxn = await txnStore.saveTxn({
    chain,
    operation: 'distribution-open',
    txHash: tx.txHash,
    status: tx.status,
    fromWallet: null,
    toWallet: null,
    amount: null,
    reason: `mở kỳ chia ${key} từ phần chưa phân bổ`,
    actorRole: ctx.role,
    actorAddress: null,
  });
  const receipt = await ledger.waitReceipt(tx.txHash, receiptTimeoutFor(chain));
  await txnStore.updateTxnStatus(savedTxn.id, receipt.status, receipt.reason);

  const found = await ledger.findDistribution(key);
  if (found) return ok(await finishOpening(ctx, period, found, `tx ${tx.txHash}`));

  if (receipt.status === 'FAILED') {
    await store.deleteOpeningPeriod(period.id);
    const reason =
      `Giao dịch mở kỳ "${key}" bị revert (${tx.txHash}) và chuỗi không có kỳ mang nhãn này. ` +
      `Đã bỏ bản giữ chỗ.`;
    await auditOpening(ctx, key, 'FAILURE', reason);
    return err('PERIOD_STATE', reason);
  }
  const reason =
    `Kỳ "${key}" đang mở trên chuỗi (tx ${tx.txHash}, ${receipt.status}) nhưng chưa đọc được kỳ. ` +
    `Giữ OPENING; phục hồi bằng recoverOpeningPeriod hoặc vòng sau của tiến trình tự động.`;
  await auditOpening(ctx, key, 'FAILURE', reason);
  return err('PERIOD_STATE', reason);
}

/**
 * Mở một kỳ chia: giữ chỗ mã kỳ, gửi `openDistribution`, ghi kỳ `OPEN` bằng số trên chuỗi.
 *
 * ## Thứ tự các bước
 *
 * Mọi phép kiểm ĐỌC chạy trước lần ghi đầu tiên: mã kỳ trùng, quỹ chưa phân bổ bằng 0, tổng cung
 * bằng 0 không tốn giao dịch nào. Rồi GIỮ CHỖ ở cơ sở dữ liệu (`OPENING`): ràng buộc duy nhất
 * `periodKey` là trọng tài giữa hai tiến trình cùng mở một mã, nên chỉ một bên gửi giao dịch.
 *
 * Số tiền của kỳ KHÔNG do tệp này đọc rồi ghi: hợp đồng chốt nó bằng phần chưa phân bổ ngay
 * trong giao dịch, và tệp này đọc lại từ chuỗi (`findDistribution`). Phép kiểm "quỹ đổi lúc
 * chốt" của BE-06 vì vậy không còn cần.
 *
 * @flow distribute:2 | kiểm quyền distribution:snapshot, kiểm mã kỳ và quỹ chưa phân bổ, giữ chỗ OPENING rồi mở trên chuỗi
 */
export async function openPeriod(input: unknown): Promise<Result<DistributionPeriodView>> {
  const parsed = openPeriodSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, periodKey } = parsed.data;

  const txnStore = getStore();
  const store = getDistributionStore();

  try {
    // `authorize` ghi sổ kiểm toán cho CẢ hai kết cục rồi mới ném.
    const role = await authorize('distribution:snapshot', periodKey, chain);
    const ledger = getLedger(chain);
    const ctx: ChainContext = { chain, ledger, store, txnStore, role };

    // --- 1. Mã kỳ đã dùng chưa (đọc; chưa chạm chuỗi) ------------------------
    const existing = await store.findPeriodByKey(periodKey);
    if (existing) {
      const reason =
        existing.status === 'OPENING'
          ? `Kỳ "${periodKey}" đang mở trên chuỗi; dùng recoverOpeningPeriod để hoàn tất.`
          : `Kỳ "${periodKey}" đã được mở. Mỗi mã kỳ chỉ mở được một lần.`;
      await auditOpening(ctx, periodKey, 'FAILURE', reason);
      return err('PERIOD_STATE', reason);
    }

    // --- 2. Quỹ có phần chưa phân bổ không (đọc) -----------------------------
    // Phần kỳ trước còn nợ KHÔNG tính: nó đã thuộc kỳ trước (QĐ-A).
    if ((await ledger.unallocatedProfit()) === 0n) {
      const reason =
        `Quỹ chia lợi nhuận không có VNDB chưa phân bổ nên không mở được kỳ "${periodKey}" ` +
        `(phần các kỳ trước còn nợ không tính). SPV phải nạp VNDB vào quỹ trước khi mở kỳ.`;
      await auditOpening(ctx, periodKey, 'FAILURE', reason);
      return err('INSUFFICIENT_PROFIT_POOL', reason);
    }

    // --- 3. Có ai đang nắm WPT không (đọc) -----------------------------------
    if ((await ledger.tokenInfo()).totalSupply === 0n) {
      const reason =
        `Tổng cung WPT bằng 0 — không có quyền nào để chia, nên kỳ "${periodKey}" không được mở. ` +
        `Phát hành nguồn cung và bán cho nhà đầu tư trước.`;
      await auditOpening(ctx, periodKey, 'FAILURE', reason);
      return err('NO_CIRCULATING_SUPPLY', reason);
    }

    // --- 4. GIỮ CHỖ: từ đây mới ghi ------------------------------------------
    let reserved: DistributionPeriodRecord;
    try {
      reserved = await store.reservePeriod({ periodKey, chain });
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        const reason =
          `Kỳ "${periodKey}" vừa được một tiến trình khác mở. Không mở kỳ thứ hai cùng mã.`;
        await auditOpening(ctx, periodKey, 'FAILURE', reason);
        return err('PERIOD_STATE', reason);
      }
      throw error;
    }

    // --- 5. Mở trên chuỗi và hoàn tất ----------------------------------------
    const opened = await driveOpening(ctx, reserved, 'send');
    return opened.ok ? ok(toPeriodView(opened.data)) : opened;
  } catch (error) {
    return toResult(error);
  }
}

/**
 * Hoàn tất một kỳ đang `OPENING` (QĐ-F bước 5): tra kỳ trên chuỗi theo nhãn; có thì ghi `OPEN`,
 * chưa có thì gửi lại `openDistribution` — hợp đồng chặn trùng nhãn nên không thể ra kỳ thứ hai.
 */
export async function recoverOpeningPeriod(input: unknown): Promise<Result<DistributionPeriodView>> {
  const parsed = openPeriodSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, periodKey } = parsed.data;
  try {
    const role = await authorize('distribution:snapshot', periodKey, chain);
    const store = getDistributionStore();
    const found = await findPeriodOnChain(store, chain, { periodKey });
    if (!isPeriod(found)) return found;
    if (found.status !== 'OPENING') return ok(toPeriodView(found));
    const ctx: ChainContext = { chain, ledger: getLedger(chain), store, txnStore: getStore(), role };
    const result = await driveOpening(ctx, found, 'recover');
    return result.ok ? ok(toPeriodView(result.data)) : result;
  } catch (error) {
    return toResult(error);
  }
}

// =============================================================================
//  B1b — ĐẨY SỐ ĐÃ CHIA VÀO VAULT, ĐÚNG MỘT LẦN (SC-06 QĐ-G)
// =============================================================================

export type VaultSyncOutcome = 'NOT_APPLICABLE' | 'WAITING' | 'SENT_PENDING' | 'DONE' | 'CONFLICT';

async function auditVault(
  ctx: ChainContext,
  period: DistributionPeriodRecord,
  outcome: 'SUCCESS' | 'FAILURE',
  detail: string,
): Promise<void> {
  await auditOpening(ctx, period.periodKey, outcome, `vault kỳ ${period.vaultPeriodRef}: ${detail}`);
}

/**
 * Đối soát mã kỳ vault đã giữ chỗ với sự kiện `PeriodClosed` trên chuỗi. `null` = chưa có sự kiện.
 * Có và khớp số của kỳ thì `DONE`; có mà khác số (ví dụ chạy script chen vào) thì `CONFLICT`.
 */
async function reconcileVaultClose(
  ctx: ChainContext,
  periodId: string,
): Promise<VaultSyncOutcome | null> {
  const current = await ctx.store.findPeriod(periodId);
  if (!current?.vaultCloseStatus || current.vaultPeriodRef === null) return null;
  if (current.vaultCloseStatus === 'DONE' || current.vaultCloseStatus === 'CONFLICT') {
    return current.vaultCloseStatus;
  }
  const close = await ctx.ledger.findVaultPeriodClose(BigInt(current.vaultPeriodRef));
  if (!close) return null;

  const matches = close.distributedPrev === BigInt(current.totalAmount);
  const to = matches ? 'DONE' : 'CONFLICT';
  const moved = await ctx.store.transitionVaultClose({
    id: current.id,
    from: current.vaultCloseStatus,
    to,
    txHash: close.txHash,
  });
  if (!moved) {
    // Tiến trình khác vừa chuyển trạng thái: đọc kết luận của nó.
    const latest = (await ctx.store.findPeriod(periodId))?.vaultCloseStatus;
    return latest === 'DONE' || latest === 'CONFLICT' ? latest : null;
  }
  await auditVault(
    ctx,
    moved,
    matches ? 'SUCCESS' : 'FAILURE',
    matches
      ? `đã chốt ${close.distributedPrev} VNDB, tx ${close.txHash}`
      : `CONFLICT: mã kỳ đã bị chốt với ${close.distributedPrev} VNDB (tx ${close.txHash}), kỳ chia ` +
          `có ${current.totalAmount} VNDB. Dừng, không gửi thêm; cần xử lý tay.`,
  );
  return to;
}

/**
 * Đẩy tiền ĐÃ DÀNH CHO KỲ (gồm phần SPV) vào `closePeriod` của vault, đúng một lần mỗi kỳ.
 *
 * 1. Giữ chỗ mã kỳ vault `lastPeriodRef + 1` bằng cập nhật có điều kiện, chỉ khi mọi kỳ trước
 *    của chain đã `DONE` (giữ thứ tự).
 * 2. Trước MỌI lần gửi, đối soát sự kiện của đúng mã đã lưu; retry dùng lại mã đó, không đọc
 *    `lastPeriodRef + 1` lần nữa.
 * 3. Giành quyền gửi bằng chuyển trạng thái có điều kiện (trạng thái + mã giao dịch hiện tại):
 *    hai tiến trình cùng thử thì chỉ một bên gửi.
 *
 * Giới hạn còn lại: kỳ `SENT` chưa có mã giao dịch (tiến trình chết giữa lúc giành quyền và lúc
 * lưu mã) có thể được hai tiến trình cùng gửi lại; khi đó hợp đồng chặn lần thứ hai bằng
 * `InvalidPeriodRef`, không có lần chốt thứ hai.
 *
 * @flow distribute:16 | đẩy số đã dành cho kỳ vào closePeriod của vault đúng một lần: giữ chỗ mã kỳ vault, đối soát PeriodClosed trước khi gửi lại
 */
async function syncVaultClose(
  ctx: ChainContext,
  period: DistributionPeriodRecord,
): Promise<VaultSyncOutcome> {
  const { ledger, store } = ctx;
  if (period.distributionId === null) return 'NOT_APPLICABLE';
  if (period.vaultCloseStatus === 'DONE' || period.vaultCloseStatus === 'CONFLICT') {
    return period.vaultCloseStatus;
  }
  const vault = await ledger.vaultStatus();
  if (!vault) return 'NOT_APPLICABLE';

  let current = period;
  if (current.vaultCloseStatus === null) {
    const reserved = await store.reserveVaultClose({
      id: current.id,
      vaultPeriodRef: Number(vault.lastPeriodRef + 1n),
    });
    current = reserved ?? (await store.findPeriod(current.id)) ?? current;
    if (current.vaultCloseStatus === null) return 'WAITING';
  }

  const reconciled = await reconcileVaultClose(ctx, current.id);
  if (reconciled) return reconciled;

  const ref = BigInt(current.vaultPeriodRef!);
  const last = (await ledger.vaultStatus())?.lastPeriodRef ?? 0n;
  if (last !== ref - 1n) {
    // Tiến trình khác có thể vừa chốt đúng mã này giữa lần đối soát trên và lần đọc vault:
    // đối soát lại trước khi kết luận CONFLICT.
    const settled = await reconcileVaultClose(ctx, current.id);
    if (settled) return settled;
    const moved = await store.transitionVaultClose({
      id: current.id,
      from: current.vaultCloseStatus!,
      to: 'CONFLICT',
    });
    if (moved) {
      await auditVault(
        ctx,
        moved,
        'FAILURE',
        `CONFLICT: vault đang ở kỳ ${last}, không chốt được kỳ ${ref} đã giữ chỗ. Cần xử lý tay.`,
      );
    }
    return 'CONFLICT';
  }

  // Lượt trước đã gửi: giao dịch còn treo thì chờ lượt sau, không gửi chồng.
  if (current.vaultCloseStatus === 'SENT' && current.vaultCloseTxHash) {
    const prior = await ledger.waitReceipt(current.vaultCloseTxHash, RECHECK_RECEIPT_TIMEOUT_MS);
    if (prior.status !== 'FAILED') {
      return (await reconcileVaultClose(ctx, current.id)) ?? 'SENT_PENDING';
    }
  }

  const claimed = await store.transitionVaultClose({
    id: current.id,
    from: current.vaultCloseStatus!,
    expectedTxHash: current.vaultCloseTxHash,
    to: 'SENT',
    txHash: null,
  });
  if (!claimed) return 'WAITING';

  let tx: TxResult;
  try {
    tx = await ledger.closeVaultPeriod(ref, BigInt(current.totalAmount));
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Lỗi không xác định.';
    await auditVault(ctx, claimed, 'FAILURE', `gửi closePeriod lỗi — ${reason}`);
    return (await reconcileVaultClose(ctx, current.id)) ?? 'WAITING';
  }
  await store.transitionVaultClose({
    id: current.id,
    from: 'SENT',
    expectedTxHash: null,
    to: 'SENT',
    txHash: tx.txHash,
  });
  const savedTxn = await ctx.txnStore.saveTxn({
    chain: ctx.chain,
    operation: 'vault-close-period',
    txHash: tx.txHash,
    status: tx.status,
    fromWallet: null,
    toWallet: null,
    amount: current.totalAmount,
    reason: `chốt kỳ vault ${ref} theo kỳ chia ${current.periodKey}`,
    actorRole: ctx.role,
    actorAddress: null,
  });
  const receipt = await ledger.waitReceipt(tx.txHash, receiptTimeoutFor(ctx.chain));
  await ctx.txnStore.updateTxnStatus(savedTxn.id, receipt.status, receipt.reason);
  return (await reconcileVaultClose(ctx, current.id)) ?? 'SENT_PENDING';
}

/**
 * Việc dọn của mỗi vòng chạy tự động (BE-07, QĐ-F bước 5 và QĐ-G): phục hồi mọi kỳ `OPENING`
 * của chain, rồi thử lại phần vault cho các kỳ đã mở mà chưa chốt vault, theo thứ tự mở kỳ.
 *
 * KHÔNG kiểm quyền: người gọi (tiến trình tự động) đã kiểm và truyền vai vào.
 */
export async function reconcileChainPeriods(
  chain: ChainKey,
  role: Role,
): Promise<{ recovered: number; stillOpening: number; vault: VaultSyncOutcome[]; errors: string[] }> {
  const store = getDistributionStore();
  const ctx: ChainContext = { chain, ledger: getLedger(chain), store, txnStore: getStore(), role };
  const errors: string[] = [];
  let recovered = 0;
  let stillOpening = 0;

  const opening = await store.listPeriods({ chain, status: 'OPENING', limit: MAX_RECIPIENT_SCAN });
  for (const period of opening) {
    const result = await driveOpening(ctx, period, 'recover');
    if (result.ok) recovered += 1;
    else {
      errors.push(result.error);
      if ((await store.findPeriod(period.id))?.status === 'OPENING') stillOpening += 1;
    }
  }

  const vault: VaultSyncOutcome[] = [];
  const periods = await store.listPeriods({ chain, limit: MAX_RECIPIENT_SCAN });
  const pending = periods
    .filter((period) => period.distributionId !== null)
    .filter((period) => period.vaultCloseStatus !== 'DONE' && period.vaultCloseStatus !== 'CONFLICT')
    .sort((a, b) => a.openedAt.localeCompare(b.openedAt) || a.id.localeCompare(b.id));
  for (const period of pending) {
    try {
      const outcome = await syncVaultClose(ctx, period);
      vault.push(outcome);
      if (outcome !== 'DONE' && outcome !== 'NOT_APPLICABLE') break; // giữ thứ tự: kỳ sau chờ
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Lỗi không xác định khi đẩy vault.');
      break;
    }
  }
  return { recovered, stillOpening, vault, errors };
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
 *
 * @flow distribute:4 | kiểm quyền, tính phân bổ theo ảnh chụp, KHÔNG ghi gì vào cơ sở dữ liệu
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

    const ledger = getLedger(chain);
    const recipients = await collectRecipients(chain, ledger);
    if (recipients.truncated) return truncatedError();

    const allocations = await allocate(ledger, found, recipients.wallets);
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
//  B3 — CHIA THEO LÔ
// =============================================================================

/** Cắt một danh sách thành các lô kích thước `size`. Lô cuối có thể ngắn hơn. */
function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Đổi trạng thái cho mọi hồ sơ trong một lô.
 *
 * Tra theo `(periodId, investorWallet)` lấy NGUYÊN VĂN từ bản ghi đã đọc, không tự chuẩn hoá lại:
 * ràng buộc duy nhất của cơ sở dữ liệu so chuỗi CHÍNH XÁC, nên một lần hạ hoa thường ở đây sẽ
 * không khớp dòng nào và `markPayout` trả `null` trong im lặng.
 */
async function markBatch(
  store: IDistributionStore,
  periodId: string,
  rows: readonly DistributionPayoutRecord[],
  patch: { status: DistributionPayoutStatus; txHash?: string | null; batchNo?: number | null },
): Promise<void> {
  for (const row of rows) {
    await store.markPayout({ periodId, investorWallet: row.investorWallet, ...patch });
  }
}

/** Ghi sổ kiểm toán cho một lần chia — gom lại để không lặp năm chỗ. */
async function auditDistribution(
  txnStore: ITxnStore,
  period: DistributionPeriodRecord,
  actorRole: Role,
  outcome: 'SUCCESS' | 'FAILURE',
  detail: string,
): Promise<void> {
  await txnStore.appendAudit({
    actorRole,
    action: 'distribution:execute',
    target: period.periodKey,
    outcome,
    detail: `kỳ ${period.id}: ${detail}`,
    chain: period.chain,
  });
}

/**
 * Kỳ trên chuỗi ứng với một kỳ trong sổ, và kiểm nó đúng là kỳ đó.
 *
 * Kỳ mở trước SC-06 trên mock không có `distributionId`: chuyển đổi trạng thái mock cũ đặt
 * `distributionId = snapshotId` (QĐ-D), nên dùng `snapshotId`. Phép so `snapshotId` bên dưới chặn
 * dùng nhầm khi điều đó không đúng (ví dụ kỳ EVM cũ chưa từng có kỳ trên chuỗi).
 */
async function readChainPeriod(
  ledger: ILedgerPort,
  period: DistributionPeriodRecord,
): Promise<ChainDistribution | Result<never>> {
  const state = await ledger.distributionState(period.distributionId ?? period.snapshotId);
  if (
    period.distributorAddress &&
    period.distributorAddress.toLowerCase() !== state.distributor.toLowerCase()
  ) {
    return err(
      'PERIOD_STATE',
      `Kỳ "${period.periodKey}" thuộc hợp đồng cũ ${period.distributorAddress}, hợp đồng chia hiện ` +
        `hành là ${state.distributor}. Không đọc kỳ cùng số của hợp đồng mới.`,
    );
  }
  if (state.snapshotId !== period.snapshotId) {
    return err(
      'PERIOD_STATE',
      `Kỳ "${period.periodKey}" ghi ảnh chụp ${period.snapshotId} nhưng kỳ trên chuỗi ` +
        `${state.distributionId} dùng ảnh chụp ${state.snapshotId}: sổ và chuỗi không khớp.`,
    );
  }
  return state;
}

const isChainPeriod = (value: ChainDistribution | Result<never>): value is ChainDistribution =>
  'distributor' in value;

/**
 * "Đã trả" xác định bằng trạng thái trên chuỗi (QĐ-14): hồ sơ có tiền mà chưa `PAID` (kể cả
 * `FAILED`) được tra `isDistributionPaid`; đã nhận thì chốt `PAID` "đối soát từ chuỗi" và KHÔNG
 * đưa vào lô. Hồ sơ phần 0 không bao giờ tới đây (đã `PAID` không gọi chuỗi). Trả số hồ sơ chốt.
 */
async function reconcilePaid(
  ledger: ILedgerPort,
  store: IDistributionStore,
  periodId: string,
  distributionId: number,
  rows: readonly DistributionPayoutRecord[],
): Promise<number> {
  let count = 0;
  for (const row of rows) {
    if (!isPayable(row) || BigInt(row.amount) === 0n) continue;
    if (await ledger.isDistributionPaid(distributionId, row.investorWallet)) {
      await store.markPayout({ periodId, investorWallet: row.investorWallet, status: 'PAID' });
      count += 1;
    }
  }
  return count;
}

/**
 * CHIA LỢI NHUẬN theo lô. Gọi lại được: lần sau chỉ chia cho ví chưa nhận.
 *
 * ## Những điều quyết định thiết kế hàm này
 *
 * **1. Lập ĐỦ hồ sơ ở `PENDING` trước khi gửi giao dịch đầu tiên.** Hồ sơ là thứ duy nhất ghi
 * lại "ai được chia bao nhiêu" — chuỗi không liệt kê được. Gửi trước rồi ghi sau, mà tiến trình
 * chết giữa hai việc, thì tiền đã ra khỏi ví lợi nhuận mà không dòng nào nói nó đi đâu.
 *
 * **2. `PENDING -> SENT -> PAID` là ba trạng thái, không phải hai.** `SENT` nghĩa là đã có mã
 * giao dịch mà chưa biết kết quả.
 *
 * **3. Một lô lỗi KHÔNG dừng các lô còn lại.** Lô lỗi thành `FAILED` và kỳ ở lại `DISTRIBUTING`,
 * nên lần chạy sau nhắm đúng những hồ sơ đó. Trước khi ghi `FAILED`, tra chuỗi từng ví: lô đã lên
 * chuỗi (lỗi chỉ ở phía đọc biên nhận) thì chốt `PAID`, không ghi nhầm thất bại (SC-06 QĐ-H).
 *
 * **4. Một lượt gửi TỐI ĐA `distribution.max_batches_per_run` lô** (BE-07).
 *
 * **5. Vòng đời theo chuỗi (SC-06 QĐ-H).** Kỳ đã đóng trên chuỗi thành `CLOSED`, quá hạn nhận
 * thành `EXPIRED`; hồ sơ chưa trả thành `EXPIRED` và KHÔNG gửi lô nào. Không hồ sơ chưa trả nào
 * được ghi `PAID`.
 *
 * Chống chia hai lần có HAI lớp, và lớp quyết định nằm ở chuỗi: hợp đồng giữ cờ đã-nhận cho từng
 * kỳ, nên một ví đã nhận thì lời gọi sau bỏ qua nó.
 *
 * @flow distribute:8 | kiểm quyền distribution:execute, đọc kỳ trên chuỗi, lập hồ sơ chờ, đối soát đã trả rồi gửi từng lô theo mã kỳ trên chuỗi
 */
export async function distributePeriod(input: unknown): Promise<Result<DistributionRunView>> {
  const parsed = distributionPeriodSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, periodId } = parsed.data;

  const txnStore = getStore();
  const store = getDistributionStore();

  try {
    const role = await authorize('distribution:execute', periodId, chain);

    // --- 1. Kỳ phải tồn tại, đúng chuỗi, và còn chia được -------------------
    const found = await findPeriodOnChain(store, chain, { periodId });
    if (!isPeriod(found)) return found;
    let period = found;

    const ended: Partial<Record<DistributionPeriodRecord['status'], string>> = {
      OPENING:
        `Kỳ "${period.periodKey}" đang mở trên chuỗi, chưa có số liệu để chia. ` +
        `Chạy recoverOpeningPeriod (hoặc chờ vòng sau của tiến trình tự động) trước.`,
      COMPLETED:
        `Kỳ "${period.periodKey}" đã hoàn tất lúc ${period.completedAt} — không còn hồ sơ nào ` +
        `phải chi. Không chia lần thứ hai.`,
      CLOSED:
        `Kỳ "${period.periodKey}" đã đóng trên chuỗi; phần chưa trả đã về quỹ chưa phân bổ.`,
    };
    const stop = ended[period.status];
    if (stop) {
      await auditDistribution(txnStore, period, role, 'FAILURE', stop);
      return err('PERIOD_STATE', stop);
    }

    const ledger = getLedger(chain);
    const chainPeriod = await readChainPeriod(ledger, period);
    if (!isChainPeriod(chainPeriod)) {
      await auditDistribution(txnStore, period, role, 'FAILURE', chainPeriod.ok ? '' : chainPeriod.error);
      return chainPeriod;
    }
    const distributionId = chainPeriod.distributionId;
    const batchSize = await readDistributionBatchSize();
    const maxBatches = await readDistributionMaxBatchesPerRun();
    const dustWallet = await readDistributionDustWallet();

    // --- 2. Lập hồ sơ cho ví chưa có, TRƯỚC khi gửi bất kỳ giao dịch nào -----
    const recipients = await collectRecipients(chain, ledger);
    if (recipients.truncated) return truncatedError();

    const before = await store.listPayouts({ periodId: period.id, limit: MAX_RECIPIENT_SCAN });
    const known = new Set(before.map((row) => row.investorWallet.toLowerCase()));
    const missing = recipients.wallets.filter((wallet) => !known.has(wallet.toLowerCase()));

    if (missing.length > 0) {
      const allocations = await allocate(ledger, period, missing);
      /**
       * Chia theo `MAX_BULK_ROWS` vì cổng lưu trữ dồn cả lô vào MỘT câu `INSERT` và giao thức
       * Postgres chỉ mang được số tham số hữu hạn. Đây là giới hạn của cơ sở dữ liệu, KHÁC hẳn
       * `batchSize` — giới hạn của một giao dịch on-chain.
       */
      for (const rows of chunk(allocations, MAX_BULK_ROWS)) {
        await store.createPayouts({ periodId: period.id, rows });
      }
    }

    // --- 3. Phân loại hồ sơ, đối soát "đã trả" từ chuỗi ----------------------
    /**
     * Hồ sơ được chia 0 KHÔNG đi vào lô nào và chuyển thẳng sang `PAID` ("phần 0, không gọi
     * chuỗi"): nó được chia 0 và đã nhận 0, nên KHÔNG còn gì phải chi. `txHash` là `null`.
     */
    const listed = await store.listPayouts({ periodId: period.id, limit: MAX_RECIPIENT_SCAN });
    const zeroRows = listed.filter((row) => isPayable(row) && BigInt(row.amount) === 0n);
    if (zeroRows.length > 0) {
      await markBatch(store, period.id, zeroRows, { status: 'PAID' });
    }
    const reconciled = await reconcilePaid(ledger, store, period.id, distributionId, listed);

    // --- 4. Kỳ đã kết thúc trên chuỗi: không gửi lô, hồ sơ chưa trả EXPIRED ---
    if (chainPeriod.closed || chainPeriod.expired) {
      const rows = await store.listPayouts({ periodId: period.id, limit: MAX_RECIPIENT_SCAN });
      const unpaid = rows.filter(isPayable);
      await markBatch(store, period.id, unpaid, { status: 'EXPIRED' });
      const anyExpired = rows.some((row) => row.status === 'EXPIRED') || unpaid.length > 0;
      const nextStatus = anyExpired ? (chainPeriod.closed ? 'CLOSED' : 'EXPIRED') : 'COMPLETED';
      period =
        (await store.setPeriodStatus({
          id: period.id,
          status: nextStatus,
          completedAt: new Date().toISOString(),
        })) ?? period;
      const after = await store.listPayouts({ periodId: period.id, limit: MAX_RECIPIENT_SCAN });
      const allocated = sumAmount(after);
      await auditDistribution(
        txnStore,
        period,
        role,
        'SUCCESS',
        `kỳ trên chuỗi ${distributionId} ${chainPeriod.closed ? 'đã đóng' : 'đã hết hạn nhận'}: ` +
          `${reconciled} hồ sơ đối soát từ chuỗi, ${unpaid.length} hồ sơ chưa nhận chuyển EXPIRED ` +
          `(không ghi PAID), không gửi lô; trạng thái kỳ ${period.status}`,
      );
      return ok({
        period: toPeriodView(period),
        batchSize,
        maxBatches,
        batches: 0,
        paid: 0,
        failed: 0,
        zero: zeroRows.length,
        reconciled,
        expired: unpaid.length,
        outstanding: 0,
        paidAmount: sumAmount(after.filter((row) => row.status === 'PAID')).toString(),
        dust: (BigInt(period.totalAmount) - allocated).toString(),
        dustWallet,
      });
    }

    const rows = await store.listPayouts({ periodId: period.id, limit: MAX_RECIPIENT_SCAN });
    const toPay = rows.filter((row) => isPayable(row) && BigInt(row.amount) > 0n);

    // --- 5. Đánh dấu kỳ đang chia TRƯỚC khi gửi lô đầu tiên -----------------
    if (toPay.length > 0 && period.status === 'OPEN') {
      period = (await store.setPeriodStatus({ id: period.id, status: 'DISTRIBUTING' })) ?? period;
    }

    // --- 6. Gửi từng lô ----------------------------------------------------
    // Số lô tiếp tục từ lô lớn nhất đã gửi, không đếm lại từ 1.
    const lastBatchNo = rows.reduce((max, row) => Math.max(max, row.batchNo ?? 0), 0);
    let paid = 0;
    let failed = 0;
    let batches = 0;

    /** Lô lỗi: ví nào chuỗi nói đã nhận thì `PAID`, còn lại `FAILED`. */
    const settleFailedGroup = async (group: readonly DistributionPayoutRecord[], batchNo: number) => {
      const confirmedPaid: DistributionPayoutRecord[] = [];
      const notPaid: DistributionPayoutRecord[] = [];
      for (const row of group) {
        if (await ledger.isDistributionPaid(distributionId, row.investorWallet)) confirmedPaid.push(row);
        else notPaid.push(row);
      }
      if (confirmedPaid.length > 0) await markBatch(store, period.id, confirmedPaid, { status: 'PAID', batchNo });
      if (notPaid.length > 0) await markBatch(store, period.id, notPaid, { status: 'FAILED', batchNo });
      paid += confirmedPaid.length;
      failed += notPaid.length;
      return { confirmedPaid: confirmedPaid.length, notPaid: notPaid.length };
    };

    for (const [index, group] of chunk(toPay, batchSize).entries()) {
      /**
       * HẠN MỨC SỐ LÔ MỖI LƯỢT (BE-07) — dừng ở đây, không chia nốt. Kỳ ở lại `DISTRIBUTING`,
       * `outstanding` khác 0, và lần gọi sau nhắm đúng những hồ sơ chưa `PAID`.
       */
      if (batches >= maxBatches) break;

      const batchNo = lastBatchNo + index + 1;
      const groupAmount = sumAmount(group);
      batches += 1;

      let pending;
      try {
        pending = await ledger.distributeBatch(
          distributionId,
          group.map((row) => row.investorWallet),
        );
      } catch (error) {
        /**
         * KHÔNG đánh dấu `PAID` mù, và KHÔNG ghi `FAILED` mù: tra chuỗi từng ví trước (QĐ-H).
         * `txHash` không truyền, nên mã giao dịch của lần thử trước (nếu có) được giữ lại.
         */
        const reason = error instanceof Error ? error.message : 'Lỗi không xác định khi gửi lô.';
        const result = await settleFailedGroup(group, batchNo);
        await auditDistribution(
          txnStore,
          period,
          role,
          'FAILURE',
          `lô ${batchNo} (${group.length} ví, ${groupAmount} VNDB) gửi thất bại — ${reason}; ` +
            `đối soát từ chuỗi: ${result.confirmedPaid} đã nhận, ${result.notPaid} FAILED`,
        );
        continue;
      }

      // Mã giao dịch vào hồ sơ NGAY KHI CÓ, trước khi chờ biên nhận.
      await markBatch(store, period.id, group, {
        status: 'SENT',
        txHash: pending.txHash,
        batchNo,
      });
      const savedTxn = await txnStore.saveTxn({
        chain,
        operation: 'distribute',
        txHash: pending.txHash,
        status: pending.status,
        fromWallet: null,
        // Một lô có nhiều bên nhận nên không có một ví đích duy nhất; danh sách ví nằm ở
        // `DistributionPayout`, đúng chỗ của nó.
        toWallet: null,
        amount: groupAmount.toString(),
        reason: `lô ${batchNo} kỳ ${period.periodKey}, ${group.length} ví`,
        actorRole: role,
        actorAddress: null,
      });

      const receipt = await ledger.waitReceipt(pending.txHash, receiptTimeoutFor(chain));
      await txnStore.updateTxnStatus(savedTxn.id, receipt.status, receipt.reason);

      if (receipt.status !== 'CONFIRMED') {
        const reason = receipt.reason ?? `Giao dịch lô kết thúc ở trạng thái ${receipt.status}.`;
        const result = await settleFailedGroup(group, batchNo);
        await auditDistribution(
          txnStore,
          period,
          role,
          'FAILURE',
          `lô ${batchNo} tx ${receipt.txHash} ${receipt.status} — ${reason}; ` +
            `đối soát từ chuỗi: ${result.confirmedPaid} đã nhận, ${result.notPaid} FAILED`,
        );
        continue;
      }

      await markBatch(store, period.id, group, {
        status: 'PAID',
        txHash: receipt.txHash,
        batchNo,
      });
      await auditDistribution(
        txnStore,
        period,
        role,
        'SUCCESS',
        `lô ${batchNo}: chia ${groupAmount} VNDB cho ${group.length} ví; tx ${receipt.txHash}`,
      );
      paid += group.length;
    }

    // --- 7. Hết hồ sơ phải chi thì kỳ hoàn tất -----------------------------
    const after = await store.listPayouts({ periodId: period.id, limit: MAX_RECIPIENT_SCAN });
    const remaining = after.filter(isPayable);

    if (remaining.length === 0) {
      /**
       * `completedAt` do NGƯỜI GỌI truyền: "hoàn tất" là kết luận của nghiệp vụ. Đường
       * `OPEN -> COMPLETED` (không qua `DISTRIBUTING`) hợp lệ khi mọi ví được chia 0 hoặc đã tự
       * nhận trên chuỗi.
       */
      period =
        (await store.setPeriodStatus({
          id: period.id,
          status: 'COMPLETED',
          completedAt: new Date().toISOString(),
        })) ?? period;
    }

    const allocated = sumAmount(after);
    const dust = BigInt(period.totalAmount) - allocated;

    await auditDistribution(
      txnStore,
      period,
      role,
      'SUCCESS',
      `lượt chia xong: ${batches}/${maxBatches} lô (kích thước ${batchSize}), ${paid} hồ sơ ` +
        `đã chi, ${failed} thất bại, ${zeroRows.length} được chia 0, ${reconciled} đối soát từ ` +
        `chuỗi, còn ${remaining.length} phải chi; trạng thái kỳ ${period.status}; ` +
        `${dustNote(dust, dustWallet)}`,
    );

    return ok({
      period: toPeriodView(period),
      batchSize,
      maxBatches,
      batches,
      paid,
      failed,
      zero: zeroRows.length,
      reconciled,
      expired: 0,
      outstanding: remaining.length,
      paidAmount: sumAmount(after.filter((row) => row.status === 'PAID')).toString(),
      dust: dust.toString(),
      dustWallet,
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
 * Quyền là `reconcile:read` — dữ liệu toàn hệ, nên hai vai vận hành (Giao dịch viên và Kiểm
 * soát viên) đọc được, còn nhà đầu tư thì không. Nhà đầu tư xem phần của chính mình qua
 * `portfolio.service`, không qua hàm này.
 *
 * @flow distribute:10 | kiểm quyền reconcile:read, trả trạng thái kỳ và tiến độ chi trả
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
      outstanding: payouts.filter(isPayable).length,
    });
  } catch (error) {
    return toResult(error);
  }
}
