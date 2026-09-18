import 'server-only';

import { serverEnv } from '@/lib/config/env';
import { ForbiddenError, assertCan, can } from './can';
import { FALLBACK_ROLE, isRole, type Role } from './permissions';

/**
 * Chốt chặn HAI LỚP cho `demo:mint-payment` — chức năng phát hành VNDB của môi trường thử.
 *
 * Vì sao không dùng `can(role, 'demo:mint-payment')` trực tiếp: quyền RBAC một mình
 * KHÔNG đủ. Bảng quyền là mã nguồn, nên chỉ cần ai gán nhầm vai `BANK_ADMIN` trên môi
 * trường thật là chức năng tự phát hành tiền mở ra. Cờ `ENABLE_DEMO_PAYMENT_MINT` là lớp
 * thứ hai, nằm ở cấu hình triển khai chứ không ở mã nguồn, nên hai lớp không cùng hỏng
 * vì một sai sót.
 *
 * Thứ tự kiểm là CỜ TRƯỚC, QUYỀN SAU. Cờ tắt thì từ chối luôn, không cần đọc vai — nhờ vậy
 * thông báo nói đúng nguyên nhân, và không có đường nào để vai trò "bù" cho cờ.
 *
 * ⚠️ File này KHÔNG được export từ `rbac/index.ts`. Barrel đó là client-safe (component
 * dùng `can()` để ẩn/hiện nút), còn file này `server-only` vì phải đọc env. Export ra barrel
 * là làm mọi component import `@/lib/rbac` fail build.
 */

/**
 * Cờ `ENABLE_DEMO_PAYMENT_MINT` đang tắt.
 *
 * Kế thừa `ForbiddenError` để `toResult()` trong `lib/bank/authorize.ts` tự quy về mã
 * `FORBIDDEN` (403) — không phải sửa bảng quy lỗi. Nhưng message nói rõ nguyên nhân là CỜ,
 * không phải vai: người vận hành đọc log cần biết đi bật cờ, chứ không đi đổi vai người dùng.
 */
export class DemoPaymentMintDisabledError extends ForbiddenError {
  constructor(role: Role) {
    super(role, 'demo:mint-payment');
    this.name = 'DemoPaymentMintDisabledError';
    this.message =
      'Chức năng phát hành VNDB demo đang tắt (ENABLE_DEMO_PAYMENT_MINT=false). ' +
      'Đây là chức năng chỉ dành cho môi trường thử.';
  }
}

/** Vai trò lạ quy về `AUDITOR` — cùng nguyên tắc đóng với `can()`. */
const resolveRole = (role: unknown): Role => (isRole(role) ? role : FALLBACK_ROLE);

/**
 * Có được phát hành VNDB demo không: cờ bật VÀ vai có quyền `demo:mint-payment`.
 *
 * Dùng cho câu hỏi hiển thị (bày nút hay không). Chốt chặn thật dùng
 * `assertCanMintDemoPayment()`.
 */
export function canMintDemoPayment(role: unknown): boolean {
  if (!serverEnv().enableDemoPaymentMint) return false;
  return can(role, 'demo:mint-payment');
}

/**
 * Như trên nhưng ném lỗi — dùng làm guard đầu server action / service.
 *
 * Ném `DemoPaymentMintDisabledError` khi cờ tắt, `ForbiddenError` khi thiếu quyền.
 * Cả hai đều là `ForbiddenError` nên `toResult()` quy về 403 mà không cần sửa gì.
 */
export function assertCanMintDemoPayment(role: unknown): asserts role is Role {
  const resolved = resolveRole(role);
  if (!serverEnv().enableDemoPaymentMint) throw new DemoPaymentMintDisabledError(resolved);
  assertCan(resolved, 'demo:mint-payment');
}
