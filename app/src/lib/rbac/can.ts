import { FALLBACK_ROLE, ROLE_PERMISSIONS, isRole, type Action, type Role } from './permissions';

/** Lỗi thiếu quyền — server action bắt lỗi này và trả về message cho UI. */
export class ForbiddenError extends Error {
  readonly role: Role;
  readonly action: Action;

  constructor(role: Role, action: Action) {
    super(`Vai trò ${role} không có quyền "${action}".`);
    this.name = 'ForbiddenError';
    this.role = role;
    this.action = action;
  }
}

/**
 * Điểm kiểm quyền DUY NHẤT của hệ thống.
 * `role` nhận `unknown` để dữ liệu ngoài (cookie/header/DB) đi vào an toàn:
 * role lạ -> quy về AUDITOR (chỉ đọc) chứ không mặc định cho qua.
 */
export function can(role: unknown, action: Action): boolean {
  const resolved: Role = isRole(role) ? role : FALLBACK_ROLE;
  return ROLE_PERMISSIONS[resolved].includes(action);
}

/** Như `can` nhưng ném `ForbiddenError` — dùng làm guard đầu mỗi server action. */
export function assertCan(role: unknown, action: Action): asserts role is Role {
  const resolved: Role = isRole(role) ? role : FALLBACK_ROLE;
  if (!can(resolved, action)) throw new ForbiddenError(resolved, action);
}

export function permissionsOf(role: unknown): readonly Action[] {
  return ROLE_PERMISSIONS[isRole(role) ? role : FALLBACK_ROLE];
}
