import type { ChainKey } from '@bidv/shared';
import type { Role } from '@/lib/rbac';
import { assertStatus, type StoreKind } from './store.errors';

/**
 * Cổng lưu trữ LỆNH MUA VÀ BÁN WPT (bảng `PurchaseOrder`, cột `side` phân biệt chiều — BE-14).
 *
 * Tách khỏi `ITxnStore` chứ không nhồi thêm vào (BE-09 QĐ-1): `ITxnStore` đang có 5 hàm,
 * dồn cả bốn nhóm bảng mới vào sẽ thành interface ~20 hàm, và mỗi lần thêm nghiệp vụ lại
 * phải sửa cả hai bản hiện thực dù việc mới chẳng liên quan gì tới giao dịch hay audit.
 *
 * Cổng này chỉ LƯU TRỮ. Bảng chuyển tiếp hợp lệ, hạn treo lệnh, quyết định khi nào gửi
 * giao dịch là việc của tầng nghiệp vụ (BE-02).
 */

/**
 * Bảy trạng thái, lấy ĐÚNG theo mô hình đã chốt ở BE-02 (R1.2) — không tự định nghĩa lại:
 *
 *     PLACED ──► CHECKING ──► EXECUTING ──► COMPLETED
 *        │          │             └──► FAILED
 *        │          └──► REJECTED
 *        └──► EXPIRED
 *
 * ⚠️ KHÔNG thêm trạng thái mô tả "đã trả tiền nhưng chưa nhận token". Chuyển VNDB và
 * chuyển WPT nằm trong CÙNG MỘT giao dịch on-chain (`ILedgerPort.executePurchase`), nên
 * chỉ có hai kết cục: cả hai xảy ra, hoặc không gì xảy ra. Một trạng thái trung gian kiểu
 * `PAID_PENDING_TOKEN` mô tả tình huống KHÔNG TỒN TẠI, và mọi mã đối soát viết ra để xử
 * lý nó là mã xử lý tình huống tưởng tượng.
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
 * Chốt chặn cho cột `status` kiểu `String`.
 *
 * Cột là `String` chứ không phải enum của Postgres (QĐ-4), nên cơ sở dữ liệu KHÔNG tự
 * chặn giá trị lạ. Cả hai bản hiện thực gọi hàm này trước khi ghi, nhờ vậy hành vi giống
 * nhau ở cả hai bản.
 */
export const assertOrderStatus = (value: string): OrderStatus =>
  assertStatus('PurchaseOrder', ORDER_STATUSES, value);

/**
 * Chiều lệnh (BE-14). Lệnh mua và lệnh bán dùng CHUNG một bảng và CHUNG bảy trạng thái ở
 * trên: tách hai bảng thì mọi truy vấn, mọi phép đối soát phải viết hai lần.
 *
 *   `BUY`  nhà đầu tư trả VNDB, nhận WPT từ ví thanh toán người bán (SPV).
 *   `SELL` nhà đầu tư trả WPT về ví thanh toán người bán, nhận VNDB.
 *
 * Mặc định `BUY` ở cả hai bản lưu trữ và ở cột Postgres: mọi lệnh có trước BE-14 là lệnh mua.
 */
export const ORDER_SIDES = ['BUY', 'SELL'] as const;
export type OrderSide = (typeof ORDER_SIDES)[number];

/** Cột `side` cũng là `String`, nên cùng một chốt chặn như cột `status`. */
export const assertOrderSide = (value: string): OrderSide =>
  assertStatus('PurchaseOrder', ORDER_SIDES, value);

/**
 * Cột mốc thời gian của năm bước quyết toán (BE-14), GHI CÙNG câu lệnh chuyển trạng thái.
 *
 * Đây là hợp đồng LƯU TRỮ, không phải ánh xạ hiển thị: nó chỉ nói "chuyển sang trạng thái X thì
 * ghi giờ vào cột Y", để mốc và trạng thái không bao giờ lệch nhau (ghi hai lần thì tiến trình
 * chết ở giữa sẽ để lại trạng thái mới mà không có mốc). Trạng thái nào thuộc bước hiển thị nào
 * là việc của `lib/bank/settlement-steps.ts`.
 *
 * `settlingAt` KHÔNG có ở đây: nó ghi khi gắn mã giao dịch (`attachOrderTxHash`), không phải
 * khi đổi trạng thái. Trạng thái kết thúc khác (`REJECTED`, `FAILED`, `EXPIRED`) cũng không
 * có cột riêng: thời điểm của chúng là `updatedAt`, vì sau đó dòng không đổi nữa.
 */
export const ORDER_STATUS_STAMPS: Partial<
  Record<OrderStatus, 'checkingAt' | 'reconciledAt' | 'completedAt'>
> = {
  CHECKING: 'checkingAt',
  EXECUTING: 'reconciledAt',
  COMPLETED: 'completedAt',
};

export interface OrderRecord {
  id: string;
  chain: ChainKey;
  investorWallet: string;
  /** Khóa chống gửi lặp do client sinh; duy nhất trong phạm vi một ví. */
  clientRequestId: string;
  side: OrderSide;
  /**
   * Số WPT muốn mua và số VNDB phải trả, lưu dạng CHUỖI.
   *
   * Chuỗi vì `bigint` không JSON-hoá được nên không qua được biên máy chủ sang trình
   * duyệt, và `number` thì mất chính xác từ 2^53.
   *
   * `vndAmount` CHỐT tại thời điểm đặt lệnh và KHÔNG tính lại khi khớp: nhà đầu tư phải
   * trả đúng giá đã thấy lúc bấm.
   */
  wptAmount: string;
  vndAmount: string;
  status: OrderStatus;
  /** Có ngay khi giao dịch được gửi, TRƯỚC khi chờ biên nhận. */
  txHash: string | null;
  /** Lý do từ chối / thất bại / hết hạn, hiển thị được cho người dùng. */
  reason: string | null;
  /** Vai đã đặt lệnh — phục vụ đối soát trách nhiệm. */
  actorRole: Role;
  /** Mốc bốn bước sau bước "tạo lệnh" (BE-14); `null` = chưa tới. Xem `ORDER_STATUS_STAMPS`. */
  checkingAt: string | null;
  reconciledAt: string | null;
  settlingAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewOrder {
  chain: ChainKey;
  investorWallet: string;
  /** Test/seed cũ có thể bỏ trống; store tự sinh UUID. Luồng đặt lệnh thật luôn truyền. */
  clientRequestId?: string;
  /** Mặc định `BUY` — giữ nguyên mọi chỗ gọi có trước BE-14. */
  side?: OrderSide;
  wptAmount: string;
  vndAmount: string;
  actorRole: Role;
  /** Mặc định `PLACED`. Nhận tham số để test dựng sẵn lệnh ở trạng thái giữa luồng. */
  status?: OrderStatus;
}

/**
 * Một lần chuyển trạng thái CÓ ĐIỀU KIỆN.
 *
 * `from` là danh sách trạng thái nguồn được phép. Hiện thực PHẢI đưa điều kiện này vào
 * chính câu lệnh cập nhật, không đọc rồi ghi thành hai bước.
 */
export interface OrderTransition {
  id: string;
  from: readonly OrderStatus[];
  to: OrderStatus;
  /** Chỉ ghi khi khác `undefined` — `null` nghĩa là XOÁ giá trị cũ, có ý nghĩa riêng. */
  txHash?: string | null;
  reason?: string | null;
}

/** Bộ lọc danh sách lệnh. Mọi trường tuỳ chọn; vắng mặt = không lọc theo trường đó. */
export interface OrderListOptions {
  chain?: ChainKey;
  investorWallet?: string;
  status?: OrderStatus;
  /** BE-14. */
  side?: OrderSide;
  /** BE-14 — đúng một mã lệnh. */
  id?: string;
  /** FE-06 — tìm một phần mã lệnh hoặc ví nhà đầu tư, không phân biệt hoa thường. */
  search?: string;
  /** BE-14 — `createdAt >= createdFrom` (bao gồm). Mốc ISO-8601. */
  createdFrom?: string;
  /** BE-14 — `createdAt < createdTo` (KHÔNG bao gồm), để hai khoảng liền nhau không đếm trùng. */
  createdTo?: string;
  limit?: number;
  /** FE-06 — số dòng bỏ qua sau khi lọc và sắp xếp, dùng cho phân trang thật. */
  offset?: number;
}

/** Số lệnh và tổng số lượng của một chiều. Số lượng là CHUỖI thập phân như mọi nơi khác. */
export interface CompletedSummary {
  count: number;
  wptAmount: string;
  vndAmount: string;
}

export interface IOrderStore {
  readonly kind: StoreKind;

  createOrder(order: NewOrder): Promise<OrderRecord>;
  findOrder(id: string): Promise<OrderRecord | null>;
  findOrderByClientRequest(input: {
    investorWallet: string;
    clientRequestId: string;
  }): Promise<OrderRecord | null>;

  /**
   * KHOÁ LẠC QUAN — chốt chặn chống gửi giao dịch hai lần cho cùng một lệnh (R1.4).
   *
   * Trả `null` khi KHÔNG dòng nào bị ảnh hưởng, nghĩa là trạng thái hiện tại không nằm
   * trong `from`: hoặc một tiến trình khác đã chiếm, hoặc lệnh đã đóng. Người gọi PHẢI
   * dừng lại khi nhận `null`.
   *
   * Vì sao không "đọc trạng thái rồi mới ghi": hai lời gọi đồng thời sẽ cùng đọc thấy
   * `CHECKING`, cùng kết luận được phép, rồi cùng gửi giao dịch — nhà đầu tư bị trừ tiền
   * hai lần. Đưa điều kiện vào chính câu `UPDATE` để cơ sở dữ liệu làm trọng tài là cách
   * duy nhất đúng, vì nó nguyên tử.
   */
  transitionOrder(transition: OrderTransition): Promise<OrderRecord | null>;

  /**
   * Gắn mã giao dịch vào lệnh ĐANG ở `EXECUTING`, KHÔNG đổi trạng thái.
   *
   * Vì sao không dùng `transitionOrder` với `from: ['EXECUTING'], to: 'EXECUTING'`: đó là
   * một chuyển tiếp `EXECUTING → EXECUTING`, thứ không có trong mô hình một chiều của
   * BE-02. Có method riêng thì `transitionOrder` giữ đúng một nghĩa là "đổi trạng thái".
   *
   * Chỉ nhắm `EXECUTING`: lệnh chưa chiếm quyền gửi thì không thể có mã giao dịch, lệnh
   * đã đóng thì không được sửa nữa.
   *
   * BE-14: ghi luôn `settlingAt` (bước "quyết toán") trong cùng câu lệnh — có mã giao dịch
   * nghĩa là giao dịch quyết toán đã được gửi.
   */
  attachOrderTxHash(input: { id: string; txHash: string }): Promise<OrderRecord | null>;

  listOrders(options?: OrderListOptions): Promise<OrderRecord[]>;

  /** Tổng số lệnh khớp cùng bộ lọc của `listOrders`, không chịu `limit` / `offset`. */
  countOrders(options?: Omit<OrderListOptions, 'limit' | 'offset'>): Promise<number>;

  /** Danh sách ví từng đặt lệnh, dùng cho bộ chọn nhà đầu tư của FE-06. */
  listOrderInvestors(options?: { chain?: ChainKey }): Promise<string[]>;

  /**
   * Tổng hợp lệnh `COMPLETED` có `completedAt` trong `[from, to)`, theo TỪNG CHIỀU (BE-14).
   *
   * Luôn trả đủ hai chiều, chiều không có lệnh nào mang số 0 — người gọi không phải đoán
   * "vắng mặt" nghĩa là 0 hay là lỗi. Cộng ở tầng lưu trữ (`SUM` của Postgres) để không phải
   * kéo cả sổ lệnh trong ngày về bộ nhớ chỉ để cộng.
   */
  summarizeCompleted(input: {
    chain?: ChainKey;
    from: string;
    to: string;
  }): Promise<Record<OrderSide, CompletedSummary>>;

  /**
   * Lệnh còn ở `PLACED` mà tạo trước `createdBefore` thì chuyển sang `EXPIRED`.
   * Trả về SỐ LỆNH đã đổi.
   *
   * Chỉ nhắm `PLACED`: từ `CHECKING` trở đi đã có tiến trình đang xử lý, cho hết hạn chen
   * ngang sẽ tạo đúng loại tranh chấp mà `transitionOrder` được dựng để chặn.
   */
  expireOrders(input: { createdBefore: string; reason?: string }): Promise<number>;
}
