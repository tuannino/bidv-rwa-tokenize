/**
 * RBAC — bảng dữ liệu role -> permission.
 *
 * LUẬT #3: cấm `if (role === 'BANK_ADMIN')`. Mọi kiểm quyền đi qua `can(role, action)`.
 * Thêm role/quyền = SỬA BẢNG DƯỚI ĐÂY, không sửa logic nghiệp vụ.
 *
 * Phase 4 sẽ chuyển bảng này sang Prisma (xem prisma/schema.prisma: Role/Permission).
 * Chữ ký `can()` giữ nguyên để nghiệp vụ không phải sửa.
 */

export const ROLES = ['BANK_ADMIN', 'COMPLIANCE', 'INVESTOR', 'AUDITOR'] as const;
export type Role = (typeof ROLES)[number];

export const ACTIONS = [
  // đặc quyền ngân hàng
  'token:mint',
  'token:burn',
  'token:freeze',
  'token:clawback',
  'investor:whitelist',
  'kyc:approve',
  // nhà đầu tư
  'token:transfer',
  // đọc
  'balance:read',
  'txn:read',
  'audit:read',
  /**
   * Quyền VÀO kênh nhà đầu tư `(client)` — xem vị thế của chính mình.
   *
   * Tách riêng khỏi `balance:read` là có lý do: `balance:read` nằm trong `READ_ONLY`
   * mà cả BANK_ADMIN/COMPLIANCE/AUDITOR đều spread vào, nên dùng nó làm cổng kênh thì
   * KHÔNG chặn được ai (đã đo thực tế ở FE-01 v1). Quyền này chỉ cấp cho INVESTOR.
   */
  'portfolio:read',
] as const;
export type Action = (typeof ACTIONS)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** Vai trò dùng khi không xác định được (nguyên tắc đóng: quyền thấp nhất). */
export const FALLBACK_ROLE: Role = 'AUDITOR';

/**
 * Nhóm quyền chỉ-đọc dùng chung cho ba vai phía ngân hàng.
 *
 * ⚠️ KHÔNG thêm `portfolio:read` vào đây. Mọi quyền trong nhóm này tự động có ở
 * BANK_ADMIN, COMPLIANCE và AUDITOR, nên quyền nào dùng làm cổng vào kênh nhà đầu tư
 * mà nằm ở đây thì mất tác dụng chặn.
 */
const READ_ONLY: Action[] = ['balance:read', 'txn:read', 'audit:read'];

export const ROLE_PERMISSIONS: Record<Role, readonly Action[]> = {
  BANK_ADMIN: [
    'token:mint',
    'token:burn',
    'token:freeze',
    'token:clawback',
    'investor:whitelist',
    'kyc:approve',
    ...READ_ONLY,
  ],
  // Tuân thủ: xét KYC/whitelist/freeze nhưng KHÔNG phát hành token.
  COMPLIANCE: ['investor:whitelist', 'kyc:approve', 'token:freeze', ...READ_ONLY],
  // `portfolio:read` CHỈ ở đây — đó là thứ chặn ba vai ngân hàng khỏi kênh `(client)`.
  INVESTOR: ['token:transfer', 'portfolio:read', 'balance:read', 'txn:read'],
  // Kiểm toán/Regulator: CHỈ ĐỌC (route-group `(audit)`).
  AUDITOR: [...READ_ONLY],
};
