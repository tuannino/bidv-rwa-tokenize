import 'server-only';

import type { ChainKey } from '@bidv/shared';
import { getLedger } from '@/lib/ledger';
import { getStore } from '@/lib/store';
import type { OrderRecord } from '@/lib/store';
import { authorize, toResult } from './authorize';
import { err, ok, type Result } from './result';
import { placeOrderSchema } from './schemas';
import type { OrderStatus } from './purchase.state';

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
 * B1 — ĐẶT LỆNH.
 *
 * Số VNDB phải trả được TÍNH và LƯU ngay tại đây (QĐ-3). Không tính lại khi khớp: nếu giá
 * bán đổi giữa lúc đặt và lúc khớp, nhà đầu tư vẫn trả đúng giá đã thấy trên màn hình lúc
 * bấm. Tính lại lúc khớp là âm thầm thu một số khác với số đã báo — sai về nghiệp vụ,
 * không phải chuyện làm tròn.
 *
 * Lệnh sinh ra ở `PLACED` và KHÔNG gửi giao dịch nào. Kiểm điều kiện và gửi giao dịch là
 * việc của `executeOrder`.
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
    const store = getStore();

    // Báo giá đi qua ILedgerPort, không tự nhân giá ở tầng này: giá bán một WPT là tham
    // số của hợp đồng khớp lệnh, tính lại ở đây là tạo nguồn sự thật thứ hai và nó sẽ
    // lệch ngay lần đầu ai đó đổi giá trên chuỗi.
    const vndAmount = await ledger.quotePurchase(wptAmount);

    const order = await store.createOrder({
      chain,
      investorWallet,
      wptAmount: wptAmount.toString(),
      vndAmount: vndAmount.toString(),
      actorRole: role,
    });

    await store.appendAudit({
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
