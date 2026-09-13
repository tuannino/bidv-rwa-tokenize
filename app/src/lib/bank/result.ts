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
  UNKNOWN: 500,
};
