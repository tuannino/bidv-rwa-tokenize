/**
 * MÔ HÌNH TRẠNG THÁI LỆNH MUA WPT.
 *
 * Tách khỏi `purchase.service.ts` vì hai lý do:
 *   - Phần này KHÔNG cần cơ sở dữ liệu lẫn chain, nên test được độc lập và chốt được
 *     trước khi bảng dữ liệu tồn tại (BE-09 lấy đúng bảng dưới đây làm enum).
 *   - Bảng chuyển tiếp là DỮ LIỆU, không phải chuỗi `if`. Thêm trạng thái = sửa bảng.
 *
 * ============================================================================
 *  PLACED ──► CHECKING ──► EXECUTING ──► COMPLETED
 *     │          │             │
 *     │          │             └──► FAILED
 *     │          └──► REJECTED
 *     └──► EXPIRED
 * ============================================================================
 *
 * ⚠️ R4.2 — KHÔNG có trạng thái nào mô tả "đã trả tiền nhưng chưa nhận token".
 *
 * Đây không phải chuyện đặt tên. Việc chuyển VNDB và chuyển WPT nằm trong CÙNG MỘT
 * giao dịch on-chain (`ILedgerPort.executePurchase`), nên chỉ có hai kết cục: cả hai
 * xảy ra, hoặc không gì xảy ra. Một trạng thái trung gian kiểu `PAID_PENDING_TOKEN`
 * sẽ mô tả một tình huống KHÔNG TỒN TẠI, và mọi mã đối soát viết ra để xử lý nó đều
 * là mã xử lý tình huống tưởng tượng — tệ hơn nữa, nó gợi ý cho người đọc sau rằng
 * luồng này KHÔNG nguyên khối. `assertNoPaidPendingDeliveryStatus()` ở cuối file là
 * chốt máy kiểm để lần sau ai thêm trạng thái như vậy thì test đỏ ngay.
 */

export const ORDER_STATUSES = [
  'PLACED',
  'CHECKING',
  'EXECUTING',
  'COMPLETED',
  'REJECTED',
  'FAILED',
  'EXPIRED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Bảng chuyển tiếp hợp lệ. Trạng thái kết thúc có danh sách RỖNG, không phải thiếu
 * entry — nhờ vậy `Record<OrderStatus, ...>` bắt được trạng thái mới bị bỏ sót ngay
 * lúc biên dịch.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  /** Nhà đầu tư đã đặt lệnh, chưa kiểm tra gì. */
  PLACED: ['CHECKING', 'EXPIRED'],
  /** Đang kiểm số dư VNDB, ủy quyền, tồn WPT của ví SPV. CHƯA gửi giao dịch. */
  CHECKING: ['EXECUTING', 'REJECTED'],
  /** Đã chiếm quyền gửi giao dịch. Từ đây trở đi có thể đã tốn phí. */
  EXECUTING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  REJECTED: [],
  FAILED: [],
  EXPIRED: [],
};

/**
 * Trạng thái kết thúc — suy ra TỪ bảng chuyển tiếp, không khai lại bằng tay.
 *
 * Khai lại là hai nguồn sự thật: sửa bảng mà quên sửa danh sách thì một trạng thái
 * kết thúc vẫn bị coi là đang chạy, và lệnh đó treo mãi trong hàng đợi của BE-07.
 */
export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ORDER_STATUSES.filter(
  (status) => ORDER_TRANSITIONS[status].length === 0,
);

/**
 * Thứ hạng để chứng minh mô hình một chiều (R4.1).
 *
 * Mọi chuyển tiếp hợp lệ đều phải đi tới thứ hạng LỚN HƠN. Không có `revert`, không có
 * "về lại PLACED để thử lại": lệnh đã đóng thì nhà đầu tư đặt lệnh MỚI. Cho quay lui
 * sẽ phá luôn cơ chế chống gửi hai lần ở QĐ-1, vì khoá lạc quan dựa trên việc trạng
 * thái không bao giờ trở về giá trị đã đi qua.
 */
const ORDER_RANK: Record<OrderStatus, number> = {
  PLACED: 0,
  CHECKING: 1,
  EXECUTING: 2,
  COMPLETED: 3,
  REJECTED: 3,
  FAILED: 3,
  EXPIRED: 3,
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value);
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return ORDER_TRANSITIONS[status].length === 0;
}

/** Thứ hạng của một trạng thái — dùng để kiểm mô hình một chiều. */
export function orderRank(status: OrderStatus): number {
  return ORDER_RANK[status];
}

/** Một lần chuyển trạng thái có nằm trong bảng hay không. R4.3. */
export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/**
 * Lỗi chuyển trạng thái sai. Mang theo `from`/`to` để `purchase.service` quy sang mã
 * `ORDER_STATE` mà không phải bóc chuỗi message.
 */
export class OrderStateError extends Error {
  readonly from: OrderStatus;
  readonly to: OrderStatus;

  constructor(from: OrderStatus, to: OrderStatus) {
    const allowed = ORDER_TRANSITIONS[from];
    super(
      `Lệnh đang ở trạng thái ${from}, không chuyển được sang ${to}. ` +
        (allowed.length === 0
          ? `${from} là trạng thái kết thúc — muốn mua tiếp thì đặt lệnh mới.`
          : `Từ ${from} chỉ đi được tới: ${allowed.join(', ')}.`),
    );
    this.name = 'OrderStateError';
    this.from = from;
    this.to = to;
  }
}

/** Như `canTransitionOrder` nhưng ném lỗi — dùng khi trạng thái sai là lỗi lập trình. */
export function assertTransitionOrder(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrder(from, to)) throw new OrderStateError(from, to);
}

/**
 * Trạng thái mà `executeOrder` chấp nhận làm điểm bắt đầu (design mục 6 bước 1).
 *
 * `CHECKING` có trong danh sách là CÓ CHỦ Ý: một tiến trình chết sau khi chuyển sang
 * `CHECKING` nhưng trước khi chiếm `EXECUTING` sẽ để lại lệnh treo ở `CHECKING`, mà
 * lúc đó CHƯA có giao dịch nào được gửi nên chạy lại là an toàn.
 */
export const EXECUTABLE_ORDER_STATUSES: readonly OrderStatus[] = ['PLACED', 'CHECKING'];

/**
 * Mẫu tên bị cấm cho trạng thái mới (R4.2).
 *
 * Chốt bằng máy thay vì bằng lời nhắc trong tài liệu: lời nhắc thì người thêm trạng
 * thái mới sẽ không đọc, còn test đỏ thì buộc phải đọc.
 */
const PAID_PENDING_DELIVERY_PATTERNS: readonly RegExp[] = [
  /PAID/i,
  /PAYMENT/i,
  /AWAITING_TOKEN/i,
  /PENDING_DELIVERY/i,
  /PARTIAL/i,
];

/**
 * Không trạng thái nào mô tả "đã trả tiền mà chưa nhận token".
 * Trả về danh sách tên vi phạm; rỗng nghĩa là đạt.
 */
export function findPaidPendingDeliveryStatuses(): readonly string[] {
  return ORDER_STATUSES.filter((status) =>
    PAID_PENDING_DELIVERY_PATTERNS.some((pattern) => pattern.test(status)),
  );
}
