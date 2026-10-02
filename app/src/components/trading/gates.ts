import type { OrderView } from '@/lib/bank/purchase.service';
import type { SettlementStepState } from '@/lib/bank/settlement-steps';
import type { QuantityCap, TradeCondition } from '@/lib/bank/trade.service';
import type { OrderSide, OrderStatus } from '@/lib/store/order.store.port';

/**
 * Hai màn của Nhà đầu tư (FE-25) — LOGIC THUẦN, không React.
 *
 * Tách khỏi component để kiểm được bằng Vitest (môi trường `node`, không dựng DOM), cùng cách FE-22
 * làm ở `components/maker-checker/gates.ts`.
 *
 * ⚠️ Không hàm nào ở đây TỰ TÍNH điều kiện nghiệp vụ, trần hay tiến trình. Trần số lượng là
 * `caps` máy chủ trả (`getTradeContext`), điều kiện là `conditions` của `previewTrade`, năm bước là
 * `steps` của `listOrders`. Ở đây chỉ so số người dùng gõ với trần đã có và quyết định nút nào khoá.
 */

/** Nhãn hai chiều — `Record` đủ khoá nên thêm chiều mà quên nhãn là lỗi biên dịch. */
export const SIDE_LABELS: Record<OrderSide, string> = { BUY: 'Mua', SELL: 'Bán' };

/** Nhãn đủ bảy trạng thái lưu trữ, dùng cho cột trạng thái và bộ lọc. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PLACED: 'Đã đặt',
  CHECKING: 'Đang kiểm tra',
  EXECUTING: 'Đang quyết toán',
  COMPLETED: 'Hoàn tất',
  REJECTED: 'Bị từ chối',
  FAILED: 'Thất bại',
  EXPIRED: 'Hết hạn',
};

export const STEP_STATE_LABELS: Record<SettlementStepState, string> = {
  done: 'Xong',
  current: 'Đang xử lý',
  pending: 'Chưa tới',
  failed: 'Dừng ở bước này',
};

/** Chuỗi người dùng gõ thành số nguyên dương, `null` khi không phải. */
export function parseQuantity(input: string): bigint | null {
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = BigInt(trimmed);
  return value > 0n ? value : null;
}

/**
 * Lý do CHẶN ô số lượng, hoặc `null` khi số hợp lệ và trong trần.
 *
 * Trần là `caps[side]` máy chủ đã tính theo công thức tài liệu (mua: số dư / giá và số chưa phân
 * phối; bán: số đang giữ); lý do vượt trần dùng nguyên câu máy chủ trả.
 */
export function quantityBlockReason(
  input: string,
  side: OrderSide,
  caps: Record<OrderSide, QuantityCap> | null,
): string | null {
  if (input.trim() === '') return 'Nhập số lượng token.';
  const amount = parseQuantity(input);
  if (amount === null) return 'Số lượng phải là số nguyên lớn hơn 0.';
  if (!caps) return 'Chưa đọc được trần số lượng, chờ hệ thống tải xong.';
  const cap = caps[side];
  if (amount > BigInt(cap.max)) return `Vượt trần được phép. ${cap.reason}`;
  return null;
}

/** Kết quả gần nhất của khối kiểm tra, đúng như máy chủ trả. */
export type TradePreviewState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | {
      kind: 'checked';
      side: OrderSide;
      wptAmount: string;
      vndAmount: string;
      conditions: TradeCondition[];
      canConfirm: boolean;
    }
  | { kind: 'error'; message: string };

/**
 * Lý do KHOÁ nút xác nhận, hoặc `null` khi mở được (FE-25 việc 7: chỉ mở khi mọi điều kiện đạt).
 *
 * Kết quả kiểm tra phải KHỚP đúng chiều và số lượng đang hiển thị: phản hồi của lần gõ trước về
 * muộn thì không được dùng để mở nút cho số lượng mới.
 */
export function confirmBlockReason(
  input: string,
  side: OrderSide,
  caps: Record<OrderSide, QuantityCap> | null,
  preview: TradePreviewState,
): string | null {
  const quantity = quantityBlockReason(input, side, caps);
  if (quantity) return quantity;
  if (preview.kind === 'idle' || preview.kind === 'loading') return 'Đang kiểm tra điều kiện trước lệnh.';
  if (preview.kind === 'error') return preview.message;
  const amount = parseQuantity(input)!.toString();
  if (preview.side !== side || preview.wptAmount !== amount) return 'Đang kiểm tra điều kiện trước lệnh.';
  const failed = preview.conditions.filter((c) => !c.passed).map((c) => c.label);
  if (failed.length > 0) return `Chưa đạt điều kiện: ${failed.join(', ')}.`;
  return preview.canConfirm ? null : 'Chưa đạt đủ điều kiện trước lệnh.';
}

// =============================================================================
//  MÀN QUẢN LÝ LỆNH: bộ lọc và sắp xếp
// =============================================================================

export interface OrderFilters {
  orderId: string;
  side: '' | OrderSide;
  status: '' | OrderStatus;
  fromDate: string;
  toDate: string;
}

export const EMPTY_FILTERS: OrderFilters = { orderId: '', side: '', status: '', fromDate: '', toDate: '' };

/**
 * Bộ lọc giao diện thành tham số `listOrdersAction`. Lọc làm ở MÁY CHỦ, không lọc mảng ở trình
 * duyệt: ví luôn đi kèm nên nhà đầu tư chỉ nhận lệnh của mình (BE-14 việc 12).
 */
export function orderQueryOf(chain: string, investorWallet: string, filters: OrderFilters) {
  return {
    chain,
    investorWallet,
    ...(filters.orderId.trim() ? { orderId: filters.orderId.trim() } : {}),
    ...(filters.side ? { side: filters.side } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.fromDate ? { fromDate: filters.fromDate } : {}),
    ...(filters.toDate ? { toDate: filters.toDate } : {}),
    limit: 200,
  };
}

/** Giá một token của lệnh: số VNDB đã chốt chia số lượng. Đọc từ hai số đã chốt, không báo giá lại. */
export function unitPriceOf(order: Pick<OrderView, 'wptAmount' | 'vndAmount'>): string {
  const amount = BigInt(order.wptAmount);
  return amount > 0n ? (BigInt(order.vndAmount) / amount).toString() : '0';
}

export const ORDER_COLUMNS = [
  'id',
  'createdAt',
  'side',
  'wptAmount',
  'price',
  'vndAmount',
  'status',
  'updatedAt',
] as const;
export type OrderColumn = (typeof ORDER_COLUMNS)[number];
export type SortDirection = 'asc' | 'desc';

const compareBigint = (a: string, b: string) => {
  const x = BigInt(a);
  const y = BigInt(b);
  return x < y ? -1 : x > y ? 1 : 0;
};

/** So hai lệnh theo một cột; số so theo GIÁ TRỊ (`bigint`), không so chuỗi. */
function compareBy(column: OrderColumn, a: OrderView, b: OrderView): number {
  switch (column) {
    case 'id':
      return a.id.localeCompare(b.id);
    case 'createdAt':
      return a.createdAt.localeCompare(b.createdAt);
    case 'updatedAt':
      return a.updatedAt.localeCompare(b.updatedAt);
    case 'side':
      return a.side.localeCompare(b.side);
    case 'status':
      return ORDER_STATUS_LABELS[a.status].localeCompare(ORDER_STATUS_LABELS[b.status], 'vi');
    case 'wptAmount':
      return compareBigint(a.wptAmount, b.wptAmount);
    case 'vndAmount':
      return compareBigint(a.vndAmount, b.vndAmount);
    case 'price':
      return compareBigint(unitPriceOf(a), unitPriceOf(b));
  }
}

/** Sắp xếp theo mọi cột của bảng (FE-25 việc 9). Trả mảng MỚI, không đổi mảng vào. */
export function sortOrders(rows: readonly OrderView[], column: OrderColumn, direction: SortDirection): OrderView[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => sign * compareBy(column, a, b) || a.id.localeCompare(b.id));
}

/** Lệnh đã có kết cục chưa — đọc `settlement.outcome` của máy chủ, không tự suy từ trạng thái. */
export const isSettled = (order: Pick<OrderView, 'settlement'>) => order.settlement.outcome !== 'PENDING';
