import type { ChainKey, TxStatus } from '@bidv/shared';
import type { OrderStatus } from '@/lib/bank/purchase.state';
import type { Action, Role } from '@/lib/rbac';

/**
 * Cổng lưu trữ giao dịch + audit log.
 *
 * Có hai hiện thực chọn bằng flag `USE_MOCK_DB`:
 *   - `memory` (mặc định): chạy được ở free-tier, nơi không có Postgres.
 *   - `prisma`  : Postgres thật, dùng khi `docker compose up`.
 * Nghiệp vụ chỉ thấy interface này.
 */

export interface TxnRecord {
  id: string;
  chain: ChainKey;
  /** Tên nghiệp vụ: 'mint' | 'whitelist' | 'burn' | ... */
  operation: string;
  txHash: string;
  status: TxStatus;
  /** Ví nguồn (null khi phát hành). */
  fromWallet: string | null;
  toWallet: string | null;
  /** Lưu chuỗi: bigint không JSON-hoá được và Postgres numeric an toàn hơn int8. */
  amount: string | null;
  reason: string | null;
  /** Vai trò đã thực hiện — phục vụ đối soát trách nhiệm. */
  actorRole: Role;
  actorAddress: string | null;
  createdAt: string;
}

export type NewTxn = Omit<TxnRecord, 'id' | 'createdAt'>;

export interface AuditRecord {
  id: string;
  actorRole: Role;
  action: Action | string;
  /** Đối tượng bị tác động (ví, mã hồ sơ KYC, ...). */
  target: string | null;
  outcome: 'ALLOWED' | 'DENIED' | 'SUCCESS' | 'FAILURE';
  detail: string | null;
  chain: ChainKey | null;
  createdAt: string;
}

export type NewAudit = Omit<AuditRecord, 'id' | 'createdAt'>;

export interface ITxnStore {
  readonly kind: 'memory' | 'prisma';
  saveTxn(txn: NewTxn): Promise<TxnRecord>;
  updateTxnStatus(id: string, status: TxStatus, reason?: string): Promise<void>;
  listTxns(options?: { chain?: ChainKey; wallet?: string; limit?: number }): Promise<TxnRecord[]>;
  appendAudit(entry: NewAudit): Promise<AuditRecord>;
  listAudit(options?: { limit?: number }): Promise<AuditRecord[]>;
}

// =============================================================================
//  LỆNH MUA WPT
//
//  ⚠️ PHẠM VI: bảng lệnh mua thuộc BE-09. BE-02 khai trước vì không có nó thì
//  không hiện thực được nghiệp vụ nào. Hình dạng dưới đây theo đúng
//  `docs/be-02-purchase-orders/design.md`; BE-09 tiếp nhận hoặc thay thế.
//  Xem DEVIATION trong docs/CHECKPOINT_BE02.md.
// =============================================================================

export interface OrderRecord {
  id: string;
  chain: ChainKey;
  investorWallet: string;
  /**
   * Số WPT muốn mua và số VNDB phải trả, lưu dạng CHUỖI.
   *
   * `vndAmount` được CHỐT tại thời điểm đặt lệnh (QĐ-3) và KHÔNG tính lại khi khớp:
   * nhà đầu tư phải trả đúng giá đã thấy lúc bấm. Giá đổi giữa hai thời điểm thì
   * nghiệp vụ từ chối lệnh để đặt lại, chứ không âm thầm thu số khác.
   */
  wptAmount: string;
  vndAmount: string;
  status: OrderStatus;
  /** Có ngay khi giao dịch được gửi, TRƯỚC khi chờ biên nhận (R3.2). */
  txHash: string | null;
  /** Lý do từ chối/thất bại/hết hạn, hiển thị được cho người dùng. */
  reason: string | null;
  /** Vai đã đặt lệnh — phục vụ đối soát trách nhiệm. */
  actorRole: Role;
  createdAt: string;
  updatedAt: string;
}

export type NewOrder = Omit<OrderRecord, 'id' | 'status' | 'txHash' | 'reason' | 'createdAt' | 'updatedAt'>;

/**
 * Một lần chuyển trạng thái CÓ ĐIỀU KIỆN.
 *
 * `from` là danh sách trạng thái nguồn được phép. Hiện thực PHẢI đưa điều kiện này
 * vào chính câu lệnh cập nhật, không đọc rồi ghi thành hai bước.
 */
export interface OrderTransition {
  id: string;
  from: readonly OrderStatus[];
  to: OrderStatus;
  /** Chỉ ghi khi khác `undefined` — `null` là "xoá giá trị cũ", có ý nghĩa riêng. */
  txHash?: string | null;
  reason?: string | null;
}

export interface IOrderStore {
  createOrder(order: NewOrder): Promise<OrderRecord>;
  findOrder(id: string): Promise<OrderRecord | null>;

  /**
   * KHOÁ LẠC QUAN — cơ chế chống gửi giao dịch hai lần (QĐ-1).
   *
   * Trả `null` khi KHÔNG dòng nào bị ảnh hưởng, nghĩa là trạng thái hiện tại không nằm
   * trong `from`: hoặc một tiến trình khác đã chiếm, hoặc lệnh đã đóng. Người gọi PHẢI
   * dừng lại khi nhận `null`.
   *
   * Vì sao không "đọc trạng thái rồi mới ghi": hai lời gọi đồng thời sẽ cùng đọc thấy
   * `CHECKING`, cùng kết luận được phép, rồi cùng gửi giao dịch — nhà đầu tư bị trừ tiền
   * hai lần. Đưa điều kiện vào câu lệnh cập nhật để chính cơ sở dữ liệu làm trọng tài là
   * cách duy nhất đúng, vì nó nguyên tử.
   */
  transitionOrder(transition: OrderTransition): Promise<OrderRecord | null>;

  /**
   * Gắn mã giao dịch vào lệnh ĐANG ở `EXECUTING`, KHÔNG đổi trạng thái (R3.2 bước 7).
   *
   * Vì sao không dùng `transitionOrder` với `from: ['EXECUTING'], to: 'EXECUTING'`: đó là
   * một chuyển tiếp `EXECUTING -> EXECUTING`, thứ KHÔNG có trong bảng chuyển tiếp và bị
   * `canTransitionOrder` từ chối. Nhờ method riêng, `transitionOrder` giữ đúng một nghĩa
   * là "đổi trạng thái", và bảng chuyển tiếp vẫn là mô tả đầy đủ của mô hình.
   *
   * Chỉ nhắm `EXECUTING`: lệnh chưa chiếm quyền gửi thì không thể có mã giao dịch, lệnh đã
   * đóng thì không được sửa nữa.
   */
  attachOrderTxHash(input: { id: string; txHash: string }): Promise<OrderRecord | null>;

  listOrders(options?: {
    chain?: ChainKey;
    investorWallet?: string;
    status?: OrderStatus;
    limit?: number;
  }): Promise<OrderRecord[]>;

  /**
   * Lệnh còn ở `PLACED` mà tạo trước `createdBefore` thì chuyển sang `EXPIRED` (R4.4).
   * Trả về SỐ LỆNH đã đổi.
   *
   * Chỉ nhắm `PLACED`: từ `CHECKING` trở đi đã có tiến trình đang xử lý, cho hết hạn
   * chen ngang sẽ tạo đúng loại tranh chấp mà `transitionOrder` được dựng để chặn.
   */
  expireOrders(input: { createdBefore: string }): Promise<number>;
}

/**
 * Cổng lưu trữ mà tầng nghiệp vụ nhìn thấy. Giữ `ITxnStore` nguyên tên và nguyên chữ ký
 * để không lời gọi hiện tại nào phải sửa.
 */
export type IBankStore = ITxnStore & IOrderStore;
