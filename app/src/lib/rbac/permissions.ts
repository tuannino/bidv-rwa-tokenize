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
] as const;
export type Action = (typeof ACTIONS)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** Vai trò dùng khi không xác định được (nguyên tắc đóng: quyền thấp nhất). */
export const FALLBACK_ROLE: Role = 'AUDITOR';

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
  INVESTOR: ['token:transfer', 'balance:read', 'txn:read'],
  // Kiểm toán/Regulator: CHỈ ĐỌC (route-group `(audit)`).
  AUDITOR: [...READ_ONLY],
};
