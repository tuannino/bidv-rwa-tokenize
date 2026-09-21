import 'server-only';

import type { ChainKey, TxStatus } from '@bidv/shared';
import { getLedger, receiptTimeoutFor, type ILedgerPort, type TxResult } from '@/lib/ledger';
import { getBankSigner } from '@/lib/signer';
import { assertCan, can, type Role } from '@/lib/rbac';
import { currentRole } from '@/lib/rbac/session';
import { getOrderStore, getStore } from '@/lib/store';
import type { IOrderStore, ITxnStore, OrderRecord } from '@/lib/store';
import { authorize, toResult } from './authorize';
import { err, ok, type ErrorCode, type Result } from './result';
import {
  executeOrderSchema,
  expireOrdersSchema,
  orderQuerySchema,
  placeOrderSchema,
  previewPurchaseSchema,
} from './schemas';
import { EXECUTABLE_ORDER_STATUSES, type OrderStatus } from './purchase.state';

/**
 * Nghiệp vụ LỆNH MUA WPT.
 *
 * Luồng đã chốt: nhà đầu tư đặt lệnh -> hệ thống kiểm số dư VNDB, ủy quyền, tồn WPT ->
 * chuyển VNDB vào ví thanh toán SPV và chuyển WPT từ ví SPV sang nhà đầu tư trong CÙNG
 * MỘT giao dịch.
 *
 * Hệ quả phải giữ: KHÔNG tồn tại trạng thái "đã trả tiền nhưng chưa nhận token". Mô hình
 * trạng thái ở `purchase.state.ts` phản ánh đúng điều đó và có test chốt lại.
 *
 * Giữ đúng mẫu của `mint.service`: server action (UI) và route handler (demo + e2e) gọi
 * cùng hàm ở đây, nên guard RBAC và ghi sổ kiểm toán nằm ở TẦNG NÀY. Thêm một transport
 * mới cũng không thể lỡ mất guard.
 *
 * LUẬT #1 chain qua `getLedger()` · LUẬT #3 quyền qua `authorize()` -> `assertCan()`.
 *
 * HAI CỔNG LƯU TRỮ, không phải một (BE-09 QĐ-1): `getStore()` cho sổ giao dịch và sổ kiểm
 * toán (`ITxnStore`), `getOrderStore()` cho bảng lệnh mua (`IOrderStore`). Trước đây hai
 * nhóm này nằm chung một interface hợp nhất; tách ra để mỗi nghiệp vụ chỉ cầm đúng cổng nó
 * cần, và thêm nghiệp vụ mới không phải sửa chữ ký của cổng đang dùng. Nghiệp vụ ở file
 * này KHÔNG đổi — chỉ đổi đường lấy cổng.
 */

export interface OrderView {
  id: string;
  chain: ChainKey;
  investorWallet: string;
  /**
   * Chuỗi thập phân, KHÔNG phải `bigint` và KHÔNG phải `number`:
   * `bigint` không qua được biên server -> client, `number` mất chính xác từ 2^53.
   */
  wptAmount: string;
  /** Số VNDB phải trả, CHỐT tại thời điểm đặt lệnh (QĐ-3). */
  vndAmount: string;
  status: OrderStatus;
  txHash: string | null;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderExecutionView extends OrderView {
  txHash: string;
  status: OrderStatus;
  txStatus: TxStatus;
  /** Số dư WPT của nhà đầu tư, ĐỌC LẠI TỪ CHUỖI sau khi khớp — không tin biên nhận (R3.4). */
  balanceAfter: string;
}

/** Ánh xạ bản ghi lưu trữ sang khung nhìn — một chỗ duy nhất, dùng cho mọi hàm trả lệnh. */
function toView(order: OrderRecord): OrderView {
  return {
    id: order.id,
    chain: order.chain,
    investorWallet: order.investorWallet,
    wptAmount: order.wptAmount,
    vndAmount: order.vndAmount,
    status: order.status,
    txHash: order.txHash,
    reason: order.reason,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

/**
 * Kết quả XEM TRƯỚC điều kiện mua.
 *
 * Ba trường vào (`chain`, `investorWallet`, `wptAmount`) được trả lại nguyên văn vì FE-05
 * gọi hàm này trong lúc người dùng đang gõ số lượng: phản hồi về KHÔNG theo thứ tự gửi, nên
 * màn hình cần đối chiếu để bỏ phản hồi đã cũ. Không trả lại thì màn hình chỉ còn cách tin
 * rằng phản hồi cuối cùng thuộc về lần gõ cuối cùng — điều không đúng.
 */
export interface PurchasePreviewView {
  chain: ChainKey;
  investorWallet: string;
  wptAmount: string;
  /** Số VNDB phải trả theo báo giá HIỆN TẠI. Chưa chốt: chốt là việc của `placeOrder`. */
  vndAmount: string;
  /** Đủ điều kiện đặt lệnh hay chưa — suy ra từ `blockers`, không phải một cờ riêng. */
  canPlaceOrder: boolean;
  /** Mã các phép kiểm đang chặn, theo thứ tự nên sửa. Rỗng nghĩa là không có gì chặn. */
  blockers: PurchaseCheckId[];
  /** Từng phép kiểm đã chạy. Xem `PurchaseChecks.results` về việc vắng mặt nghĩa là gì. */
  checks: PurchaseCheckResult[];
}

/**
 * XEM TRƯỚC ĐIỀU KIỆN MUA — không tạo lệnh, KHÔNG ghi một dòng nào vào cơ sở dữ liệu.
 *
 * Chạy đúng bộ kiểm mà `executeOrder` sẽ chạy, nên "xem trước nói đạt mà khớp lệnh từ chối"
 * không xảy ra được vì lý do lệch logic. Nó vẫn xảy ra được vì lý do khác: điều kiện đổi
 * giữa hai thời điểm. Đó là giới hạn thật của mọi màn hình xem trước, không phải lỗi.
 *
 * ⚠️ KIỂM QUYỀN BẰNG `assertCan`, KHÔNG dùng `authorize()`, và đây là chủ đích.
 * `authorize` ghi một bản ghi kiểm toán cho MỖI lời gọi. Hàm này được gọi trong lúc người
 * dùng gõ số lượng, nên dùng `authorize` sẽ đổ hàng chục bản ghi "đã cho phép xem" cho một
 * lần mua — nhấn chìm sổ kiểm toán bằng bản ghi vô nghĩa và làm nó không dùng được để đối
 * chiếu trách nhiệm nữa. LUẬT #3 vẫn giữ: quyền đi qua RBAC, không so tên vai.
 *
 * Hệ quả cần biết: một lần xem trước BỊ CHẶN cũng không để lại dấu vết. Hàm này chỉ đọc và
 * không đổi gì, nên hiện tại chấp nhận được; đã ghi câu hỏi mở trong checkpoint BE-03.
 *
 * @flow purchase:2 | kiểm quyền order:place, báo giá, chạy bộ kiểm, KHÔNG ghi gì vào cơ sở dữ liệu
 * @pending FE-05 | đã sẵn đầu cuối: validate Zod dùng chung schema với đặt lệnh, kiểm quyền qua RBAC, báo giá qua ILedgerPort, và ĐÚNG bộ kiểm mà khớp lệnh sẽ chạy. FE-05 chỉ cần gọi rồi hiển thị `blockers` và `howToFix`, KHÔNG viết lại phép kiểm nào ở client, và PHẢI chống gọi dồn khi người dùng gõ số lượng vì mỗi ký tự là một lời gọi
 */
export async function previewPurchase(input: unknown): Promise<Result<PurchasePreviewView>> {
  const parsed = previewPurchaseSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, investorWallet, wptAmount } = parsed.data;

  try {
    assertCan(await currentRole(), 'order:place');

    // KHÔNG truyền `quotedVndAmount`: chưa có lệnh nào nên không có giá cũ để so.
    const checks = await runPurchaseChecks(getLedger(chain), { investorWallet, wptAmount });
    const blockers = checks.results.filter((r) => !r.ok).map((r) => r.id);

    return ok({
      chain,
      investorWallet,
      wptAmount: wptAmount.toString(),
      vndAmount: checks.vndAmount.toString(),
      canPlaceOrder: blockers.length === 0,
      blockers,
      checks: checks.results,
    });
  } catch (error) {
    return toResult(error);
  }
}

/**
 * B1 — ĐẶT LỆNH.
 *
 * Số VNDB phải trả được TÍNH và LƯU ngay tại đây (QĐ-3). Không tính lại khi khớp: nếu giá
 * bán đổi giữa lúc đặt và lúc khớp, nhà đầu tư vẫn trả đúng giá đã thấy trên màn hình lúc
 * bấm. Tính lại lúc khớp là âm thầm thu một số khác với số đã báo — sai về nghiệp vụ,
 * không phải chuyện làm tròn.
 *
 * Lệnh sinh ra ở `PLACED` và KHÔNG gửi giao dịch nào. Gửi giao dịch là việc của
 * `executeOrder`.
 *
 * ĐIỀU KIỆN ĐƯỢC KIỂM NGAY TẠI ĐÂY, trước khi tạo bản ghi. Trước BE-03 thì không: lệnh
 * chắc chắn sẽ bị từ chối lúc khớp vẫn được lưu, rồi chuyển sang `REJECTED` ở một lần gọi
 * khác. Hệ quả là sổ lệnh đầy bản ghi không bao giờ khớp được, và nhà đầu tư chỉ biết mình
 * thiếu gì sau khi đã đặt lệnh. `executeOrder` VẪN kiểm lại — điều kiện đổi được giữa hai
 * thời điểm, nên kiểm ở đây không thay thế được kiểm ở đó.
 *
 * @flow purchase:4 | validate Zod, kiểm quyền order:place, kiểm điều kiện, lưu lệnh PLACED
 */
export async function placeOrder(input: unknown): Promise<Result<OrderView>> {
  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, investorWallet, wptAmount } = parsed.data;

  try {
    // `authorize` ghi audit cho CẢ hai kết cục (ALLOWED và DENIED) rồi mới ném — R1.4.
    const role = await authorize('order:place', investorWallet, chain);

    const ledger = getLedger(chain);

    // Báo giá và điều kiện đi qua CÙNG bộ kiểm với `executeOrder`, không có bản thứ hai:
    // hai bộ kiểm song song sẽ lệch nhau, và lúc đó đặt lệnh nhận "đủ điều kiện" cho một
    // dữ liệu mà khớp lệnh từ chối. `vndAmount` lấy từ chính lời gọi đó nên chỉ báo giá
    // MỘT lần — gọi `quotePurchase` thêm lần nữa là mở cửa cho hai giá khác nhau.
    //
    // KHÔNG truyền `quotedVndAmount`: lệnh chưa tồn tại nên không có giá cũ để so.
    const checks = await runPurchaseChecks(ledger, { investorWallet, wptAmount });
    const blocker = firstFailure(checks.results);
    if (blocker) {
      // KHÔNG tạo bản ghi. Nhưng VẪN ghi sổ kiểm toán: một lần đặt lệnh bị từ chối là
      // việc đã xảy ra, và không còn bản ghi lệnh nào để lần lại nó nữa.
      await getStore().appendAudit({
        actorRole: role,
        action: 'order:place',
        target: investorWallet,
        outcome: 'FAILURE',
        detail: `từ chối đặt lệnh ${wptAmount} WPT trước khi tạo bản ghi — ${blocker.reason}`,
        chain,
      });
      return err(blocker.code, blocker.reason);
    }

    const vndAmount = checks.vndAmount;
    const order = await getOrderStore().createOrder({
      chain,
      investorWallet,
      wptAmount: wptAmount.toString(),
      vndAmount: vndAmount.toString(),
      actorRole: role,
    });

    await getStore().appendAudit({
      actorRole: role,
      action: 'order:place',
      target: investorWallet,
      outcome: 'SUCCESS',
      detail: `đặt lệnh ${order.id}: ${wptAmount} WPT, phải trả ${vndAmount} VNDB`,
      chain,
    });

    return ok(toView(order));
  } catch (error) {
    return toResult(error);
  }
}

/**
 * Mã của từng phép kiểm. Giao diện khoá theo MÃ, không theo câu chữ: đổi câu chữ là việc
 * thường xuyên, còn mã thì chỉ đổi khi phép kiểm đó thật sự khác đi.
 */
export const PURCHASE_CHECK_IDS = [
  'price',
  'paymentBalance',
  'allowance',
  'supply',
  'transferable',
] as const;
export type PurchaseCheckId = (typeof PURCHASE_CHECK_IDS)[number];

/**
 * Kết quả MỘT phép kiểm. Union tường minh, không phải `{ ok: boolean; reason: string | null }`:
 * kiểu union làm "đạt thì không có lý do" thành sự thật ở mức kiểu, nên không chỗ nào phải
 * kiểm null và không chỗ nào hiện được một lý do rỗng.
 *
 * Phép trượt mang theo MÃ LỖI để `executeOrder` không phải suy mã từ chuỗi lý do — bóc
 * chuỗi là cách chắc chắn để lần đổi câu chữ đầu tiên làm sai mã.
 *
 * `actual`/`required` là CHUỖI thập phân, chỉ có ở phép kiểm số dư và ủy quyền: hai phép đó
 * so hai con số nên giao diện hiện được "đang có / cần có", còn ba phép còn lại không so số.
 */
export type PurchaseCheckResult =
  | { id: PurchaseCheckId; ok: true }
  | {
      id: PurchaseCheckId;
      ok: false;
      code: ErrorCode;
      reason: string;
      /** Việc cần làm để đạt. Viết cho cán bộ ngân hàng đọc, không dùng từ kỹ thuật ví. */
      howToFix: string;
      actual?: string;
      required?: string;
    };

/** Kết quả cả bộ kiểm. */
interface PurchaseChecks {
  /**
   * Số VNDB phải trả theo BÁO GIÁ HIỆN TẠI. Trả ra đây để người gọi dùng lại thay vì gọi
   * `quotePurchase` lần thứ hai — hai lời gọi cách nhau có thể nhận hai giá khác nhau, và
   * lúc đó lệnh được lưu theo một giá còn phép kiểm chạy theo giá kia.
   */
  vndAmount: bigint;
  /**
   * Các phép kiểm ĐÃ CHẠY, theo thứ tự chạy.
   *
   * Bộ kiểm dừng ở phép trượt đầu tiên, nên phép nằm sau nó KHÔNG có mặt trong danh sách.
   * Vắng mặt nghĩa là "chưa kiểm" — khác hẳn `ok: true`. Đó là lý do đây là DANH SÁCH chứ
   * không phải một đối tượng có đủ năm khoá: đối tượng đủ khoá buộc phải điền một giá trị
   * cho phép kiểm chưa chạy, và mọi giá trị điền vào đó đều là nói sai.
   */
  results: PurchaseCheckResult[];
}

const passed = (id: PurchaseCheckId): PurchaseCheckResult => ({ id, ok: true });

const failed = (
  id: PurchaseCheckId,
  code: ErrorCode,
  reason: string,
  howToFix: string,
  amounts?: { actual: bigint; required: bigint },
): PurchaseCheckResult => ({
  id,
  ok: false,
  code,
  reason,
  howToFix,
  ...(amounts
    ? { actual: amounts.actual.toString(), required: amounts.required.toString() }
    : {}),
});

/** Phép kiểm trượt ĐẦU TIÊN, `null` khi đạt hết. */
function firstFailure(
  results: readonly PurchaseCheckResult[],
): Extract<PurchaseCheckResult, { ok: false }> | null {
  for (const r of results) if (!r.ok) return r;
  return null;
}

/**
 * Dữ liệu vào của bộ phép kiểm — THAM SỐ THUẦN, không phải `OrderRecord`.
 *
 * Nhận `OrderRecord` thì phải có lệnh trong cơ sở dữ liệu mới kiểm được, nên nhà đầu tư
 * chỉ biết mình thiếu điều kiện SAU khi lệnh đã bị từ chối. Tham số thuần cho ba đường
 * gọi cùng dùng một bộ kiểm: xem trước (chưa có lệnh), đặt lệnh (đang tạo lệnh), khớp
 * lệnh (đã có lệnh).
 */
export interface PurchaseCheckInput {
  /** Ví nhà đầu tư sẽ trả VNDB và nhận WPT. */
  investorWallet: string;
  /** Số WPT muốn mua. */
  wptAmount: bigint;
  /**
   * Số VNDB ĐÃ CHỐT của một lệnh có sẵn (QĐ-3). Có thì kiểm thêm "giá đã đổi chưa".
   *
   * KHÔNG có nghĩa là chưa có lệnh nào — xem trước hoặc đang đặt lệnh mới — nên không có
   * giá cũ để so, và báo giá hiện tại chính là mốc đúng. Bỏ hẳn phép kiểm giá trong hai
   * đường đó là đúng chứ không phải nới tay: so báo giá vừa lấy với chính nó thì phép
   * kiểm luôn đạt, tức là một phép kiểm không nói gì.
   */
  quotedVndAmount?: bigint;
}

/**
 * BỐN PHÉP KIỂM TRƯỚC KHI GỬI GIAO DỊCH (QĐ-2), dừng ở lần trượt đầu tiên.
 *
 * Cả bốn đều là hàm ĐỌC, không tốn phí. Hợp đồng cũng kiểm lại, nhưng kiểm ở đây có hai
 * giá trị mà hợp đồng không cho được: thông báo nêu đúng điều kiện nào thiếu và thiếu bao
 * nhiêu, và không đốt phí vào một giao dịch chắc chắn bị revert.
 *
 * Thứ tự là thứ tự người dùng sửa được: có tiền chưa -> đã cho phép trừ chưa -> còn hàng
 * không -> chuyển được không. Trả lời "chưa cấp ủy quyền" cho người chưa có tiền là chỉ
 * sai việc phải làm.
 *
 * Phép kiểm giá (QĐ-3) chạy TRƯỚC bốn phép này vì cả bốn đều so với `vndAmount` đã chốt;
 * so bằng một con số đã lạc hậu thì kết quả kiểm cũng lạc hậu. Nó CHỈ chạy khi người gọi
 * đưa `quotedVndAmount` — lý do ở `PurchaseCheckInput`.
 *
 * @flow purchase:8 | kiểm giá đã chốt rồi bốn phép đọc, dừng ở lần trượt đầu tiên
 */
async function runPurchaseChecks(
  ledger: ILedgerPort,
  input: PurchaseCheckInput,
): Promise<PurchaseChecks> {
  const { investorWallet, wptAmount, quotedVndAmount } = input;
  const results: PurchaseCheckResult[] = [];

  // --- QĐ-3: giá đổi giữa lúc đặt và lúc khớp -------------------------------------
  // So khớp CHÍNH XÁC, không có biên dung sai. Giá bán WPT là tham số do ngân hàng ấn
  // định (xem `issuance.ts`), không phải giá thị trường dao động, nên mọi thay đổi đều
  // là quyết định có chủ ý — dung sai chỉ để lọc nhiễu, mà ở đây không có nhiễu.
  const quotedNow = await ledger.quotePurchase(wptAmount);
  if (quotedVndAmount !== undefined) {
    if (quotedNow !== quotedVndAmount) {
      results.push(
        failed(
          'price',
          'PRICE_CHANGED',
          `Giá bán đã đổi từ lúc đặt lệnh: lệnh chốt ${quotedVndAmount} VNDB, giá hiện tại là ` +
            `${quotedNow} VNDB cho ${wptAmount} WPT. Đặt lại lệnh để xác nhận giá mới.`,
          'Lấy lại báo giá mới rồi đặt lệnh lại. Lệnh cũ không tự thu theo giá mới, ' +
            'nên nhà đầu tư không bị trừ số khác với số đã thấy lúc bấm.',
        ),
      );
      // Trả về NGAY, và số trả ra là số ĐÃ CHỐT ở lệnh. Bốn phép còn lại đều so với số
      // đó, mà nó vừa được chứng minh là lạc hậu — chạy tiếp chỉ sinh ra bốn câu trả lời
      // đúng về một cái giá không còn hiệu lực.
      return { vndAmount: quotedVndAmount, results };
    }
    results.push(passed('price'));
  }

  // Qua được phép kiểm trên thì `quotedVndAmount` (nếu có) BẰNG `quotedNow`, nên dùng
  // `quotedNow` làm mốc cho cả ba đường gọi — không cần nhánh riêng cho từng đường.
  const vndAmount = quotedNow;

  // --- 1. Số dư VNDB của nhà đầu tư ------------------------------------------------
  const paymentBalance = await ledger.paymentBalanceOf(investorWallet);
  if (paymentBalance < vndAmount) {
    results.push(
      failed(
        'paymentBalance',
        'INSUFFICIENT_PAYMENT_BALANCE',
        `Số dư VNDB không đủ: cần ${vndAmount}, ví ${investorWallet} chỉ có ${paymentBalance}.`,
        `Nạp thêm ${vndAmount - paymentBalance} VNDB vào ví ${investorWallet}, ` +
          'hoặc giảm số lượng WPT muốn mua.',
        { actual: paymentBalance, required: vndAmount },
      ),
    );
    return { vndAmount, results };
  }
  results.push(passed('paymentBalance'));

  // --- 2. Mức ủy quyền VNDB --------------------------------------------------------
  const allowance = await ledger.paymentAllowanceOf(investorWallet);
  if (allowance < vndAmount) {
    results.push(
      failed(
        'allowance',
        'INSUFFICIENT_ALLOWANCE',
        `Ủy quyền VNDB không đủ: cần ${vndAmount}, đã cấp ${allowance}. ` +
          `Nhà đầu tư phải approve cho hợp đồng khớp lệnh trước.`,
        `Nhà đầu tư xác nhận trong ví của mình cho phép hệ thống trừ tối đa ${vndAmount} VNDB. ` +
          'Đây là bước xác nhận thanh toán, làm một lần trước khi khớp lệnh.',
        { actual: allowance, required: vndAmount },
      ),
    );
    return { vndAmount, results };
  }
  results.push(passed('allowance'));

  // --- 3. Tồn WPT trong ví thanh toán SPV ------------------------------------------
  const spv = await ledger.spvWallet();
  if (!spv) {
    results.push(
      failed(
        'supply',
        'INSUFFICIENT_SUPPLY',
        'Chưa phát hành nguồn cung ban đầu — không có WPT nào để bán.',
        'Bộ phận phát hành phải phát hành nguồn cung ban đầu vào ví thanh toán SPV trước ' +
          'khi mở bán. Đây là việc của ngân hàng, nhà đầu tư không tự xử lý được.',
      ),
    );
    // Không có ví SPV thì phép kiểm chuyển nhượng KHÔNG CÓ CHỦ THỂ: không có bên gửi để
    // hỏi "chuyển được không". Nó vắng khỏi danh sách, và vắng là nói thật.
    return { vndAmount, results };
  }
  const spvBalance = await ledger.balanceOf(spv);
  if (spvBalance < wptAmount) {
    results.push(
      failed(
        'supply',
        'INSUFFICIENT_SUPPLY',
        `Ví thanh toán SPV không đủ WPT: cần ${wptAmount}, chỉ còn ${spvBalance}.`,
        `Giảm số lượng xuống tối đa ${spvBalance} WPT, hoặc chờ ngân hàng bổ sung nguồn cung.`,
      ),
    );
    return { vndAmount, results };
  }
  results.push(passed('supply'));

  // --- 4. Khả năng chuyển nhượng ---------------------------------------------------
  // Chiều SPV -> nhà đầu tư, đúng chiều mà `executePurchase` sẽ chuyển. Kiểm chiều
  // ngược lại sẽ cho ra một câu trả lời đúng về một giao dịch không tồn tại.
  const transferable = await ledger.canTransfer(spv, investorWallet, wptAmount);
  if (!transferable.allowed) {
    results.push(
      failed(
        'transferable',
        'LEDGER',
        transferable.reason,
        'Xử lý đúng nguyên nhân nêu ở lý do trên cùng bộ phận tuân thủ: hồ sơ KYC của ví, ' +
          'trạng thái đóng băng, hoặc dự án đang trong giai đoạn tất toán.',
      ),
    );
    return { vndAmount, results };
  }
  results.push(passed('transferable'));

  return { vndAmount, results };
}

/**
 * Ghi bản ghi kiểm toán cho một lần khớp lệnh — gom lại để không lặp sáu lần.
 *
 * `actorRole` là vai ĐANG KHỚP LỆNH, không phải vai đã đặt lệnh. Hai vai khác nhau
 * (nhà đầu tư đặt, ngân hàng khớp), nên lấy `order.actorRole` sẽ ghi sổ rằng nhà đầu tư
 * tự khớp lệnh của mình — đúng cái điều mà việc tách `order:place`/`order:execute` được
 * dựng để ngăn. Sổ kiểm toán ghi sai người chịu trách nhiệm thì không dùng để đối chiếu
 * được nữa.
 */
async function auditExecution(
  store: ITxnStore,
  order: OrderRecord,
  actorRole: Role,
  outcome: 'SUCCESS' | 'FAILURE',
  detail: string,
): Promise<void> {
  await store.appendAudit({
    actorRole,
    action: 'order:execute',
    target: order.investorWallet,
    outcome,
    detail: `lệnh ${order.id}: ${detail}`,
    chain: order.chain,
  });
}

/**
 * B2 — KHỚP LỆNH. Theo đúng 11 bước ở `design.md` mục 6.
 *
 * Điểm cần hiểu trước khi sửa hàm này: bước 5 (chiếm `EXECUTING`) đặt SAU bốn phép kiểm
 * và TRƯỚC lời gọi gửi giao dịch, và cả hai vị trí đều có lý do.
 *
 *   - Sau bốn phép kiểm: chỉ chiếm quyền thực thi khi đã biết điều kiện đạt. Chiếm sớm
 *     thì mọi lệnh trượt điều kiện đều mắc ở `EXECUTING`, mà từ `EXECUTING` không còn
 *     đường về `REJECTED` — lệnh sẽ bị đánh dấu là đã tốn phí trong khi chưa gửi gì.
 *   - Trước khi gửi: đây là toàn bộ cơ chế chống gửi hai lần. `transitionOrder` đưa điều
 *     kiện trạng thái vào chính câu lệnh cập nhật, nên hai lời gọi đồng thời thì chỉ một
 *     lời gọi đổi được `CHECKING` -> `EXECUTING`, lời gọi kia nhận `null` và dừng.
 *
 * Và một ranh giới nữa: từ lúc chiếm `EXECUTING` trở đi, MỌI thất bại đều là `FAILED`,
 * không phải `REJECTED`. Kể cả khi lỗi xảy ra ở `executePurchase` trước khi có mã giao
 * dịch — vì lúc đó không còn chứng minh được là chưa có giao dịch nào lên chuỗi (lệnh gửi
 * có thể đã thành công mà phản hồi bị mất). `REJECTED` nghĩa là CHẮC CHẮN chưa tốn phí;
 * dùng nó ở đây sẽ nói với nhà đầu tư một điều ta không biết.
 *
 * @flow purchase:7 | kiểm quyền order:execute, PLACED sang CHECKING, chiếm EXECUTING chống gửi hai lần
 */
export async function executeOrder(input: unknown): Promise<Result<OrderExecutionView>> {
  const parsed = executeOrderSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, orderId } = parsed.data;

  const txnStore = getStore();
  const orderStore = getOrderStore();

  try {
    // --- 1. Đọc lệnh, phải ở PLACED hoặc CHECKING --------------------------------
    const order = await orderStore.findOrder(orderId);
    if (!order) {
      return err('ORDER_STATE', `Không có lệnh nào với mã ${orderId}.`);
    }
    if (order.chain !== chain) {
      // Khớp lệnh trên chain khác chain đã đặt là đọc số dư của một sổ khác hoàn toàn.
      return err(
        'ORDER_STATE',
        `Lệnh ${orderId} thuộc chain "${order.chain}", không khớp được trên chain "${chain}".`,
      );
    }
    if (!EXECUTABLE_ORDER_STATUSES.includes(order.status)) {
      return err(
        'ORDER_STATE',
        `Lệnh ${orderId} đang ở trạng thái ${order.status}, không khớp được. ` +
          `Chỉ lệnh ở ${EXECUTABLE_ORDER_STATUSES.join(' hoặc ')} mới khớp được.`,
      );
    }

    // --- 2. Kiểm quyền + ghi sổ kiểm toán ----------------------------------------
    // `authorize` ghi audit cho cả lần bị chặn rồi mới ném (R1.4 / ca kiểm thử 7.9).
    const executorRole = await authorize('order:execute', order.investorWallet, chain);

    const ledger = getLedger(chain);

    // --- 3. Chuyển sang CHECKING -------------------------------------------------
    // Đã ở `CHECKING` thì giữ nguyên: `CHECKING` -> `CHECKING` không có trong bảng
    // chuyển tiếp, và một lệnh treo ở `CHECKING` (tiến trình trước chết trước khi chiếm
    // `EXECUTING`) thì CHƯA gửi giao dịch nào nên chạy lại là an toàn.
    const checking =
      order.status === 'CHECKING'
        ? order
        : await orderStore.transitionOrder({ id: orderId, from: ['PLACED'], to: 'CHECKING' });
    if (!checking) {
      return err(
        'ORDER_STATE',
        `Lệnh ${orderId} vừa được một tiến trình khác nhận xử lý. Không khớp lần hai.`,
      );
    }

    // --- 4. Bốn phép kiểm đọc ----------------------------------------------------
    // Truyền `vndAmount` ĐÃ CHỐT ở lệnh, nên đường này — và chỉ đường này — kiểm thêm
    // "giá đã đổi chưa". Xem trước và đặt lệnh không có giá cũ để so.
    const checks = await runPurchaseChecks(ledger, {
      investorWallet: checking.investorWallet,
      wptAmount: BigInt(checking.wptAmount),
      quotedVndAmount: BigInt(checking.vndAmount),
    });
    const check = firstFailure(checks.results);
    if (check) {
      // REJECTED: CHƯA gửi giao dịch nào, chưa tốn phí, nhà đầu tư đặt lại được ngay.
      await orderStore.transitionOrder({
        id: orderId,
        from: ['CHECKING'],
        to: 'REJECTED',
        reason: check.reason,
      });
      await auditExecution(
        txnStore,
        checking,
        executorRole,
        'FAILURE',
        `bị từ chối trước khi gửi tx — ${check.reason}`,
      );
      return err(check.code, check.reason);
    }

    // --- 5. Cập nhật CÓ ĐIỀU KIỆN sang EXECUTING ---------------------------------
    const executing = await orderStore.transitionOrder({
      id: orderId,
      from: ['CHECKING'],
      to: 'EXECUTING',
    });
    if (!executing) {
      // Không dòng nào bị ảnh hưởng = tiến trình khác đã chiếm. Đây là điểm chặn gửi
      // giao dịch hai lần; dừng lại, KHÔNG gửi gì.
      return err(
        'ORDER_STATE',
        `Lệnh ${orderId} đã được một tiến trình khác gửi đi. Không gửi giao dịch lần hai.`,
      );
    }

    // --- 6..9. Gửi giao dịch, lưu mã, chờ biên nhận -------------------------------
    return await sendAndSettle(txnStore, orderStore, ledger, executing, executorRole);
  } catch (error) {
    return toResult(error);
  }
}

/**
 * Bước 6..11: gửi giao dịch và chốt kết quả. Tách ra vì từ đây trở đi ranh giới xử lý lỗi
 * khác hẳn phần trên — mọi thất bại là `FAILED`, và điều đó phải nhìn thấy được trong cấu
 * trúc mã, không chỉ trong bình luận.
 *
 * Nhận CẢ HAI cổng vì bước này chạm cả hai bảng: `orderStore` đổi trạng thái lệnh và gắn mã
 * giao dịch, `txnStore` ghi sổ giao dịch và sổ kiểm toán. Truyền vào thay vì gọi factory
 * bên trong để hàm vẫn test được trực tiếp mà không phải đổi cờ môi trường.
 *
 * @flow purchase:9 | gửi giao dịch, lưu mã tx trước khi chờ, chốt COMPLETED hoặc FAILED
 */
async function sendAndSettle(
  txnStore: ITxnStore,
  orderStore: IOrderStore,
  ledger: ILedgerPort,
  order: OrderRecord,
  executorRole: Role,
): Promise<Result<OrderExecutionView>> {
  const { id, chain, investorWallet } = order;
  const wptAmount = BigInt(order.wptAmount);

  let pending: TxResult;
  try {
    // --- 6. Khớp lệnh: VNDB và WPT trong CÙNG một giao dịch ----------------------
    pending = await ledger.executePurchase(investorWallet, wptAmount);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Lỗi không xác định khi gửi giao dịch.';
    await orderStore.transitionOrder({ id, from: ['EXECUTING'], to: 'FAILED', reason });
    await auditExecution(
      txnStore,
      order,
      executorRole,
      'FAILURE',
      `gửi giao dịch thất bại — ${reason}`,
    );
    return toResult(error);
  }

  // --- 7. Lưu mã giao dịch NGAY KHI CÓ, trước khi chờ biên nhận -----------------
  // Tiến trình chết ở bước chờ thì lệnh vẫn còn mã giao dịch để đối soát (R3.2). Ghi sau
  // khi có biên nhận thì một giao dịch đã lên chuỗi có thể không còn dấu vết nào ở đây.
  await orderStore.attachOrderTxHash({ id, txHash: pending.txHash });
  const savedTxn = await txnStore.saveTxn({
    chain,
    operation: 'purchase',
    txHash: pending.txHash,
    status: pending.status,
    // Chiều chuyển WPT: từ ví thanh toán SPV sang nhà đầu tư. `null` vì địa chỉ ví SPV
    // là chuyện của tầng chain; sổ giao dịch ở đây ghi bên nhận, giống luồng mint.
    fromWallet: null,
    toWallet: investorWallet,
    amount: order.wptAmount,
    reason: null,
    // Vai GỬI giao dịch, không phải vai đã đặt lệnh — cùng lý do như `auditExecution`.
    actorRole: executorRole,
    actorAddress: await bankAddressOrNull(chain),
  });

  // --- 8. Chờ biên nhận, timeout THEO CHAIN ------------------------------------
  const receipt = await ledger.waitReceipt(pending.txHash, receiptTimeoutFor(chain));
  await txnStore.updateTxnStatus(savedTxn.id, receipt.status, receipt.reason);

  // --- 9. COMPLETED hoặc FAILED + ghi sổ kiểm toán -----------------------------
  if (receipt.status !== 'CONFIRMED') {
    const reason = receipt.reason ?? `Giao dịch khớp lệnh kết thúc ở trạng thái ${receipt.status}.`;
    await orderStore.transitionOrder({ id, from: ['EXECUTING'], to: 'FAILED', reason });
    await auditExecution(
      txnStore,
      order,
      executorRole,
      'FAILURE',
      `tx ${receipt.txHash} ${receipt.status} — ${reason}`,
    );
    return err('LEDGER', reason);
  }

  const completed = await orderStore.transitionOrder({
    id,
    from: ['EXECUTING'],
    to: 'COMPLETED',
    txHash: receipt.txHash,
  });
  await auditExecution(
    txnStore,
    order,
    executorRole,
    'SUCCESS',
    `khớp ${order.wptAmount} WPT / ${order.vndAmount} VNDB; tx ${receipt.txHash} ${receipt.status}`,
  );

  // --- 10. Đọc lại số dư WPT TỪ CHUỖI -----------------------------------------
  const balanceAfter = await ledger.balanceOf(investorWallet);

  // --- 11. Trả Result ---------------------------------------------------------
  // `completed` có thể là `null` nếu một tiến trình khác vừa đổi trạng thái; lấy bản ghi
  // hiện tại làm nguồn thay vì dựng số liệu từ biến cũ.
  const finalOrder = completed ?? (await orderStore.findOrder(id)) ?? order;
  return ok({
    ...toView(finalOrder),
    txHash: receipt.txHash,
    status: finalOrder.status,
    txStatus: receipt.status,
    balanceAfter: balanceAfter.toString(),
  });
}

/**
 * Địa chỉ ví ngân hàng đang ký, hoặc `null` khi chưa cấu hình custody.
 *
 * Thiếu signer KHÔNG được làm sập một lần khớp lệnh đã thành công: giao dịch đã lên chuỗi
 * rồi, ném lỗi ở đây chỉ làm mất kết quả mà không cứu được gì. Cột này chỉ phục vụ đối soát.
 */
async function bankAddressOrNull(chain: ChainKey): Promise<string | null> {
  try {
    return await getBankSigner(chain).getAddress();
  } catch {
    return null;
  }
}

/**
 * TRUY VẤN LỆNH.
 *
 * Lọc theo ví nằm ở TẦNG NÀY, không ở giao diện. Server action gọi được bằng một yêu cầu
 * HTTP trực tiếp mà không đi qua màn hình nào, nên bộ lọc đặt ở component là bộ lọc không
 * tồn tại.
 *
 * Cách phân biệt R5.1 với R5.2 mà KHÔNG so sánh tên vai trực tiếp (LUẬT #3):
 *   - Vai có `order:read:all` (ba vai ngân hàng): được bỏ trống bộ lọc ví -> xem toàn hệ.
 *   - Vai không có (nhà đầu tư): `investorWallet` là BẮT BUỘC, và kết quả chỉ chứa lệnh
 *     của đúng ví đó.
 *
 * ⚠️ GIỚI HẠN ĐÃ BIẾT — giống `portfolio.service.ts`: chưa có SIWE (AU-01) nên server KHÔNG
 * biết ví nào thuộc phiên đăng nhập; ví chỉ tồn tại ở client qua wagmi. Vì vậy hàm này bảo
 * đảm được "danh sách trả về không lẫn lệnh của ví khác", nhưng KHÔNG chặn được một nhà
 * đầu tư chủ động truyền ví của người khác vào. Ràng buộc ví ↔ phiên là việc của AU-01;
 * đã ghi thành câu hỏi mở trong checkpoint.
 *
 * @flow purchase:12 | kiểm order:read và order:read:all, lọc theo ví ở tầng service
 */
export async function listOrders(input: unknown): Promise<Result<OrderView[]>> {
  const parsed = orderQuerySchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, investorWallet, status, limit } = parsed.data;

  try {
    const role = await authorize('order:read', investorWallet ?? null, chain ?? null);

    // Bảng RBAC quyết định, không phải tên vai. Thêm vai mới chỉ cần sửa bảng quyền.
    const seesEveryOrder = can(role, 'order:read:all');
    if (!seesEveryOrder && !investorWallet) {
      // KHÔNG lặng lẽ trả danh sách rỗng, và tuyệt đối không trả danh sách của mọi ví:
      // thiếu tham số phải thành lỗi validate, chứ không thành lỗi rò dữ liệu.
      return err(
        'VALIDATION',
        'Thiếu địa chỉ ví. Vai này chỉ xem được lệnh của một ví cụ thể.',
        { investorWallet: ['Bắt buộc với vai không có quyền xem toàn bộ lệnh.'] },
      );
    }

    const rows = await getOrderStore().listOrders({ chain, investorWallet, status, limit });
    return ok(rows.map(toView));
  } catch (error) {
    return toResult(error);
  }
}

/**
 * LỆNH QUÁ HẠN -> `EXPIRED` (R4.4).
 *
 * Chỉ CUNG CẤP hàm, KHÔNG dựng lịch: dựng lịch ở đây thì
 * mỗi instance serverless sẽ chạy một bản sao, và trên free-tier thì không có tiến trình
 * nào sống đủ lâu để lịch chạy — hai lỗi ngược nhau, cùng sinh ra từ một chỗ sai.
 *
 * Chỉ nhắm `PLACED`. Từ `CHECKING` trở đi đã có tiến trình đang xử lý; cho hết hạn chen
 * ngang sẽ tạo đúng loại tranh chấp mà khoá lạc quan được dựng để chặn.
 *
 * @pending BE-07 | đã sẵn đầu cuối: validate Zod, kiểm quyền `order:expire`, chuyển PLACED -> EXPIRED theo mốc thời gian, ghi sổ kiểm toán khi có lệnh đổi. BE-07 chỉ cần gọi theo lịch
 */
export async function expireStaleOrders(input: unknown): Promise<Result<{ expired: number }>> {
  const parsed = expireOrdersSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { olderThanMinutes } = parsed.data;

  try {
    const role = await authorize('order:expire', null, null);

    const createdBefore = new Date(Date.now() - olderThanMinutes * 60_000).toISOString();
    const expired = await getOrderStore().expireOrders({ createdBefore });

    // Chỉ ghi sổ khi CÓ lệnh bị đổi. BE-07 gọi hàm này theo lịch, ghi cả những lần không
    // đổi gì sẽ nhấn chìm sổ kiểm toán bằng bản ghi rỗng và làm nó vô dụng để đối chiếu.
    if (expired > 0) {
      await getStore().appendAudit({
        actorRole: role,
        action: 'order:expire',
        target: null,
        outcome: 'SUCCESS',
        detail: `${expired} lệnh treo quá ${olderThanMinutes} phút đã chuyển sang EXPIRED`,
        chain: null,
      });
    }

    return ok({ expired });
  } catch (error) {
    return toResult(error);
  }
}
