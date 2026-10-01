import 'server-only';

import { cookies } from 'next/headers';
import { serverEnv } from '@/lib/config/env';
import { ROLE_CHANNEL, SAMPLE_ACCOUNTS } from '@/lib/session/channel';
import { FALLBACK_ROLE, isRole, type Role } from './permissions';

export const ROLE_COOKIE = 'bidv_role';

/**
 * Vai trò của phiên hiện tại.
 *
 * PoC: đọc cookie `bidv_role` (bộ chuyển vai trò trên UI để demo 3 kênh), thiếu thì lấy `DEMO_ROLE`.
 * Phase 4 sẽ thay thân hàm này bằng SIWE + session; chữ ký giữ nguyên nên server action không phải sửa.
 *
 * ⚠️ PoC KHÔNG xác thực: cookie do client đặt. Đây là lỗ hổng CÓ CHỦ Ý,
 * đã ghi vào non-goals (docs/SPEC.md §6) và PHẢI đóng ở Phase 4 trước khi ra khỏi PoC.
 */
export async function currentRole(): Promise<Role> {
  let fromCookie: string | undefined;
  try {
    const store = await cookies();
    fromCookie = store.get(ROLE_COOKIE)?.value;
  } catch {
    // Ngoài request scope (script demo, test) — bỏ qua, dùng env.
  }

  if (isRole(fromCookie)) return fromCookie;

  const fromEnv = serverEnv().demoRole;
  return isRole(fromEnv) ? fromEnv : FALLBACK_ROLE;
}

/**
 * Mã tài khoản của người đang thao tác — ghi vào cột người lập / người duyệt (BE-12).
 *
 * Cần thứ này vì vai một mình không chặn được tự duyệt: "người lập không được duyệt yêu cầu của
 * chính mình, kể cả khi có đủ quyền" là phép so NGƯỜI, không phải so vai.
 *
 * PoC: `DEMO_ACTOR` nếu có, không thì mã tài khoản mẫu của vai (`SAMPLE_ACCOUNTS`, cùng nguồn với
 * bộ chọn vai). AU-01 thay thân hàm bằng tài khoản của phiên đăng nhập; chữ ký giữ nguyên.
 *
 * ⚠️ Cùng lỗ hổng có chủ ý với `currentRole()`: PoC không xác thực.
 */
export async function currentActorId(role: Role): Promise<string> {
  return serverEnv().demoActor ?? SAMPLE_ACCOUNTS[ROLE_CHANNEL[role]];
}
