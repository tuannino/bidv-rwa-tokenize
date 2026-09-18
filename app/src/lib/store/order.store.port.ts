import type { ChainKey } from '@bidv/shared';
import type { Role } from '@/lib/rbac';
import { assertStatus, type StoreKind } from './store.errors';

/**
 * Cổng lưu trữ LỆNH MUA WPT (bảng `PurchaseOrder`).
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

export interface OrderRecord {
  id: string;
  chain: ChainKey;
  investorWallet: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface NewOrder {
  chain: ChainKey;
  investorWallet: string;
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

export interface IOrderStore {
  readonly kind: StoreKind;

  createOrder(order: NewOrder): Promise<OrderRecord>;
  findOrder(id: string): Promise<OrderRecord | null>;

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
   */
  attachOrderTxHash(input: { id: string; txHash: string }): Promise<OrderRecord | null>;

  listOrders(options?: {
    chain?: ChainKey;
    investorWallet?: string;
    status?: OrderStatus;
    limit?: number;
  }): Promise<OrderRecord[]>;

  /**
   * Lệnh còn ở `PLACED` mà tạo trước `createdBefore` thì chuyển sang `EXPIRED`.
   * Trả về SỐ LỆNH đã đổi.
   *
   * Chỉ nhắm `PLACED`: từ `CHECKING` trở đi đã có tiến trình đang xử lý, cho hết hạn chen
   * ngang sẽ tạo đúng loại tranh chấp mà `transitionOrder` được dựng để chặn.
   */
  expireOrders(input: { createdBefore: string; reason?: string }): Promise<number>;
}
