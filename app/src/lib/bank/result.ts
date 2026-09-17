/**
 * Kết quả của mọi nghiệp vụ ngân hàng.
 *
 * Union tường minh thay vì throw, vì hai lý do:
 *  - Server action ném lỗi thì Next che message ở production ("An error occurred...")
 *    -> người dùng không biết vì sao mint bị từ chối.
 *  - Chỉ chứa dữ liệu tuần tự hoá được (không bigint, không Error) nên qua được
 *    biên server -> client an toàn.
 */

export type ErrorCode =
  | 'FORBIDDEN' // thiếu quyền (RBAC)
  | 'VALIDATION' // input sai
  | 'NOT_WHITELISTED' // nhà đầu tư chưa KYC/whitelist
  | 'LEDGER' // chain/contract từ chối
  | 'SIGNER' // custody chưa sẵn sàng
  | 'PROVIDER' // KYC/oracle/corebank lỗi
  // --- Lệnh mua WPT (BE-02) ---
  // Bốn mã đầu CỐ Ý tách riêng thay vì gộp vào 'LEDGER': cả bốn đều là từ chối
  // TRƯỚC KHI gửi giao dịch, nên người dùng sửa được và giao diện chỉ được đúng
  // chỗ cần sửa. Gộp hết vào 'LEDGER' thì màn hình chỉ nói "chain từ chối".
  | 'INSUFFICIENT_PAYMENT_BALANCE' // nhà đầu tư không đủ VNDB
  | 'INSUFFICIENT_ALLOWANCE' // chưa cấp đủ ủy quyền VNDB
  | 'INSUFFICIENT_SUPPLY' // ví thanh toán SPV không còn đủ WPT
  | 'ORDER_STATE' // chuyển trạng thái không hợp lệ, hoặc lệnh đã được xử lý
  | 'PRICE_CHANGED' // giá đổi so với lúc đặt lệnh
  | 'UNKNOWN';

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; error: string; fieldErrors?: Record<string, string[]> };

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });

export const err = <T = never>(
  code: ErrorCode,
  error: string,
  fieldErrors?: Record<string, string[]>,
): Result<T> => ({ ok: false, code, error, fieldErrors });

/** Mã HTTP tương ứng, dùng ở route handler. */
export const httpStatusFor: Record<ErrorCode, number> = {
  FORBIDDEN: 403,
  VALIDATION: 400,
  NOT_WHITELISTED: 409,
  LEDGER: 502,
  SIGNER: 503,
  PROVIDER: 502,

  /**
   * Lệnh mua: 409 Conflict cho cả năm, KHÔNG phải 400 và KHÔNG phải 502.
   *
   * 400 sai vì dữ liệu vào hợp lệ — vấn đề nằm ở TRẠNG THÁI hệ thống (số dư, ủy quyền,
   * tồn kho, trạng thái lệnh, giá). 502 cũng sai vì chain không hỏng và không hề được
   * gọi để ghi. 409 nói đúng điều người gọi cần biết: gửi lại y nguyên sẽ vẫn trượt,
   * phải thay đổi điều kiện rồi thử lại.
   */
  INSUFFICIENT_PAYMENT_BALANCE: 409,
  INSUFFICIENT_ALLOWANCE: 409,
  INSUFFICIENT_SUPPLY: 409,
  ORDER_STATE: 409,
  PRICE_CHANGED: 409,

  UNKNOWN: 500,
};
