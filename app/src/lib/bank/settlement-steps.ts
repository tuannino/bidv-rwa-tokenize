import type { OrderRecord, OrderSide, OrderStatus } from '@/lib/store/order.store.port';

/**
 * NĂM BƯỚC QUYẾT TOÁN hiển thị cho nhà đầu tư (BE-14), ánh xạ TỪ bảy trạng thái lưu trữ.
 *
 * Ánh xạ nằm ở TẦNG NGHIỆP VỤ, không ở giao diện: màn chi tiết lệnh (FE-25) chỉ vẽ mảng trả về.
 * Để giao diện tự suy từ `status` thì mỗi màn suy một kiểu, và lần thêm trạng thái đầu tiên sẽ
 * làm các màn lệch nhau mà không test nào bắt được.
 *
 * Cơ sở dữ liệu KHÔNG đổi tên trạng thái (ràng buộc spec). Bảng dưới đây là chỗ duy nhất nói
 * trạng thái nào đang ở bước nào:
 *
 * | Trạng thái | Tạo lệnh | Kiểm tra | Đối chiếu số dư | Quyết toán | Hoàn tất |
 * |---|---|---|---|---|---|
 * | `PLACED`    | xong | chờ      | chờ  | chờ      | chờ  |
 * | `CHECKING`  | xong | đang làm | chờ  | chờ      | chờ  |
 * | `EXECUTING` | xong | xong     | xong | đang làm | chờ  |
 * | `COMPLETED` | xong | xong     | xong | xong     | xong |
 * | `REJECTED`  | xong | trượt    | chờ  | chờ      | chờ  |
 * | `EXPIRED`   | xong | trượt    | chờ  | chờ      | chờ  |
 * | `FAILED`    | xong | xong     | xong | trượt    | chờ  |
 *
 * Nghĩa từng bước, khớp với nơi ghi mốc ở `ORDER_STATUS_STAMPS`:
 *   1. Tạo lệnh        — lệnh được lưu, số VNDB đã chốt (`createdAt`).
 *   2. Kiểm tra        — ngân hàng nhận xử lý, chạy lại bộ điều kiện tại thời điểm khớp (`checkingAt`).
 *   3. Đối chiếu số dư — số dư hai bên đã đối chiếu đủ cho bốn bút toán, lệnh được chiếm quyền
 *                        gửi để không gửi hai lần (`reconciledAt`).
 *   4. Quyết toán      — gửi MỘT giao dịch mang cả bốn bút toán (`settlingAt`).
 *   5. Hoàn tất        — chuỗi xác nhận, lệnh `COMPLETED` (`completedAt`).
 *
 * Bước trượt lấy mốc `updatedAt`: sau trạng thái kết thúc dòng không đổi nữa, nên đó chính là
 * thời điểm trượt.
 *
 * Tệp này KHÔNG `import 'server-only'` và không chạm chuỗi hay cơ sở dữ liệu: chỉ là hàm thuần
 * trên một bản ghi, test được trực tiếp.
 */

export const SETTLEMENT_STEP_IDS = [
  'created',
  'checking',
  'reconciling',
  'settling',
  'completed',
] as const;
export type SettlementStepId = (typeof SETTLEMENT_STEP_IDS)[number];

export const SETTLEMENT_STEP_LABELS: Record<SettlementStepId, string> = {
  created: 'Tạo lệnh',
  checking: 'Kiểm tra',
  reconciling: 'Đối chiếu số dư',
  settling: 'Quyết toán',
  completed: 'Hoàn tất',
};

/** `done` xong · `current` đang làm · `pending` chưa tới · `failed` dừng ở bước này. */
export type SettlementStepState = 'done' | 'current' | 'pending' | 'failed';

export interface SettlementStepView {
  id: SettlementStepId;
  label: string;
  state: SettlementStepState;
  /** Mốc thời gian của bước (ISO-8601), `null` khi chưa tới hoặc chưa có mốc. */
  at: string | null;
}

/**
 * Tiến độ theo trạng thái: số bước ĐÃ XONG tính từ đầu, và bước kế tiếp đang làm hay đã trượt.
 *
 * `Record<OrderStatus, ...>` để thêm trạng thái mới mà quên ánh xạ là lỗi biên dịch.
 */
const PROGRESS: Record<OrderStatus, { done: number; next: 'current' | 'failed' | 'pending' }> = {
  PLACED: { done: 1, next: 'pending' },
  CHECKING: { done: 1, next: 'current' },
  EXECUTING: { done: 3, next: 'current' },
  COMPLETED: { done: 5, next: 'pending' },
  REJECTED: { done: 1, next: 'failed' },
  EXPIRED: { done: 1, next: 'failed' },
  FAILED: { done: 3, next: 'failed' },
};

/** Mốc lưu trữ của từng bước. */
const stampOf = (order: OrderRecord, id: SettlementStepId): string | null => {
  switch (id) {
    case 'created':
      return order.createdAt;
    case 'checking':
      return order.checkingAt;
    case 'reconciling':
      return order.reconciledAt;
    case 'settling':
      return order.settlingAt;
    case 'completed':
      return order.completedAt;
  }
};

export function toSettlementSteps(order: OrderRecord): SettlementStepView[] {
  const { done, next } = PROGRESS[order.status];
  return SETTLEMENT_STEP_IDS.map((id, index) => {
    let state: SettlementStepState = 'pending';
    if (index < done) state = 'done';
    else if (index === done) state = next;
    let at: string | null = null;
    if (state === 'failed') at = order.updatedAt;
    else if (state !== 'pending') at = stampOf(order, id);
    return { id, label: SETTLEMENT_STEP_LABELS[id], state, at };
  });
}

/**
 * BƯỚC QUYẾT TOÁN LÀ MỘT BƯỚC DUY NHẤT: bốn bút toán cùng thành công hoặc cùng huỷ.
 *
 * Trả ra trong kết quả (không chỉ ghi chú trong mã) vì tài liệu yêu cầu nhấn mạnh nguyên tắc tất
 * cả hoặc không gì, và màn chi tiết phải nói được điều đó bằng dữ liệu: lệnh `FAILED` có
 * `outcome: 'NONE_APPLIED'` — không bút toán nào đã ghi, chứ không phải "ghi được một nửa".
 */
export interface SettlementEntry {
  /** Ví của bên nào: nhà đầu tư, hay ví thanh toán của người bán (SPV). */
  account: 'INVESTOR' | 'SELLER';
  asset: 'WPT' | 'VNDB';
  /** `DEBIT` ghi giảm, `CREDIT` ghi tăng. */
  direction: 'DEBIT' | 'CREDIT';
  amount: string;
}

export interface SettlementView {
  atomic: true;
  /** Đúng bốn: hai bên, hai tài sản. */
  entries: SettlementEntry[];
  /**
   * `APPLIED` cả bốn đã ghi · `NONE_APPLIED` không bút toán nào ghi (lệnh đã đóng mà không hoàn
   * tất) · `PENDING` chưa có kết cục. Không có giá trị nào cho "ghi một phần" vì tình huống đó
   * không tồn tại.
   */
  outcome: 'APPLIED' | 'NONE_APPLIED' | 'PENDING';
  rule: string;
}

export const SETTLEMENT_RULE =
  'Quyết toán là một bước duy nhất: bốn bút toán nằm trong cùng một giao dịch, cùng thành công hoặc cùng huỷ.';

const OUTCOME: Record<OrderStatus, SettlementView['outcome']> = {
  PLACED: 'PENDING',
  CHECKING: 'PENDING',
  EXECUTING: 'PENDING',
  COMPLETED: 'APPLIED',
  REJECTED: 'NONE_APPLIED',
  EXPIRED: 'NONE_APPLIED',
  FAILED: 'NONE_APPLIED',
};

/** Bốn bút toán theo chiều lệnh. Mua: tiền đi, token về. Bán: token đi, tiền về. */
function entriesOf(side: OrderSide, wptAmount: string, vndAmount: string): SettlementEntry[] {
  const investorPays = side === 'BUY' ? 'VNDB' : 'WPT';
  const investorGets = side === 'BUY' ? 'WPT' : 'VNDB';
  const amountOf = (asset: 'WPT' | 'VNDB') => (asset === 'WPT' ? wptAmount : vndAmount);
  return [
    { account: 'INVESTOR', asset: investorPays, direction: 'DEBIT', amount: amountOf(investorPays) },
    { account: 'SELLER', asset: investorPays, direction: 'CREDIT', amount: amountOf(investorPays) },
    { account: 'SELLER', asset: investorGets, direction: 'DEBIT', amount: amountOf(investorGets) },
    { account: 'INVESTOR', asset: investorGets, direction: 'CREDIT', amount: amountOf(investorGets) },
  ];
}

export function toSettlementView(order: OrderRecord): SettlementView {
  return {
    atomic: true,
    entries: entriesOf(order.side, order.wptAmount, order.vndAmount),
    outcome: OUTCOME[order.status],
    rule: SETTLEMENT_RULE,
  };
}
