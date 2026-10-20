import {
  ROLE_PERMISSIONS,
  UNKNOWN_ROLE,
  isRole,
  type Action,
  type Role,
  type RoleOrUnknown,
} from './permissions';

/** Lỗi thiếu quyền — server action bắt lỗi này và trả về message cho UI. */
export class ForbiddenError extends Error {
  /** Vai đã bị từ chối; `UNKNOWN` khi giá trị vai không phải vai hợp lệ (BE-13 QĐ-A). */
  readonly role: RoleOrUnknown;
  readonly action: Action;

  constructor(role: RoleOrUnknown, action: Action) {
    super(`Vai trò ${role} không có quyền "${action}".`);
    this.name = 'ForbiddenError';
    this.role = role;
    this.action = action;
  }
}

/**
 * Điểm kiểm quyền DUY NHẤT của hệ thống.
 * `role` nhận `unknown` để dữ liệu ngoài (cookie/header/DB) đi vào an toàn: vai lạ KHÔNG có quyền
 * nào (BE-13 QĐ-A), không mượn quyền của vai thật nào và không mặc định cho qua.
 */
export function can(role: unknown, action: Action): boolean {
  return isRole(role) && ROLE_PERMISSIONS[role].includes(action);
}

/** Như `can` nhưng ném `ForbiddenError`, dùng làm guard đầu server action. Vai lạ ghi là `UNKNOWN`. */
export function assertCan(role: unknown, action: Action): asserts role is Role {
  if (!isRole(role)) throw new ForbiddenError(UNKNOWN_ROLE, action);
  if (!can(role, action)) throw new ForbiddenError(role, action);
}

/** Bộ quyền của một vai; vai lạ có danh sách rỗng. */
export function permissionsOf(role: unknown): readonly Action[] {
  return isRole(role) ? ROLE_PERMISSIONS[role] : [];
}
