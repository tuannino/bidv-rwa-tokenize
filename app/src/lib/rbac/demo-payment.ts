import 'server-only';

import { serverEnv } from '@/lib/config/env';
import { ForbiddenError, assertCan, can } from './can';
import { FALLBACK_ROLE, isRole, type Role } from './permissions';

/**
 * Chốt chặn HAI LỚP cho hai chức năng CHỈ DÀNH CHO MÔI TRƯỜNG THỬ:
 *
 * | Quyền | Cờ | Chức năng |
 * |---|---|---|
 * | `demo:mint-payment` | `ENABLE_DEMO_PAYMENT_MINT` | phát hành VNDB vào ví chỉ định (BE-08) |
 * | `demo:mint-token` | `ENABLE_DEMO_TOKEN_MINT` | phát hành WPT trực tiếp, không qua lập–duyệt (FE-22) |
 *
 * Tên tệp giữ từ BE-08 để không đổi chỗ nhập ở `flags.ts` và các test; hai chức năng dùng chung
 * đúng một khuôn kiểm bên dưới, nên tách hai tệp là chép logic.
 *
 * Phần còn lại của chú thích này viết cho `demo:mint-payment` và áp y nguyên cho `demo:mint-token`.
 *
 * Vì sao không dùng `can(role, 'demo:mint-payment')` trực tiếp: quyền RBAC một mình
 * KHÔNG đủ. Bảng quyền là mã nguồn, nên chỉ cần ai gán nhầm vai `TELLER` trên môi
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

/**
 * Cờ `ENABLE_DEMO_TOKEN_MINT` đang tắt — cùng khuôn `DemoPaymentMintDisabledError`.
 *
 * Message nói rõ đường đúng để tạo token, vì người gặp lỗi này nhiều khả năng đang tìm cách phát
 * hành thật: chỗ đó là màn Lập lệnh, không phải đi bật cờ.
 */
export class DemoTokenMintDisabledError extends ForbiddenError {
  constructor(role: Role) {
    super(role, 'demo:mint-token');
    this.name = 'DemoTokenMintDisabledError';
    this.message =
      'Phát hành token trực tiếp đang tắt (ENABLE_DEMO_TOKEN_MINT=false) — chức năng chỉ dành cho ' +
      'dữ liệu thử. Tạo và huỷ token chính thức đi qua màn Lập lệnh và Kiểm soát viên duyệt.';
  }
}

/** Vai trò lạ quy về `FALLBACK_ROLE` — cùng nguyên tắc đóng với `can()`. */
const resolveRole = (role: unknown): Role => (isRole(role) ? role : FALLBACK_ROLE);

/** Một chức năng môi trường thử: cờ nào, quyền nào, lỗi gì khi cờ tắt. */
interface DemoGate {
  flagOn: () => boolean;
  action: 'demo:mint-payment' | 'demo:mint-token';
  disabledError: (role: Role) => ForbiddenError;
}

const PAYMENT_GATE: DemoGate = {
  flagOn: () => serverEnv().enableDemoPaymentMint,
  action: 'demo:mint-payment',
  disabledError: (role) => new DemoPaymentMintDisabledError(role),
};

const TOKEN_GATE: DemoGate = {
  flagOn: () => serverEnv().enableDemoTokenMint,
  action: 'demo:mint-token',
  disabledError: (role) => new DemoTokenMintDisabledError(role),
};

/** Cờ TRƯỚC, quyền SAU — cờ tắt thì không có đường nào để vai trò "bù" cho cờ. */
const allows = (gate: DemoGate, role: unknown): boolean => gate.flagOn() && can(role, gate.action);

function assertGate(gate: DemoGate, role: unknown): asserts role is Role {
  const resolved = resolveRole(role);
  if (!gate.flagOn()) throw gate.disabledError(resolved);
  assertCan(resolved, gate.action);
}

/**
 * Có được phát hành VNDB demo không: cờ bật VÀ vai có quyền `demo:mint-payment`.
 *
 * Dùng cho câu hỏi hiển thị (bày nút hay không). Chốt chặn thật dùng
 * `assertCanMintDemoPayment()`.
 */
export function canMintDemoPayment(role: unknown): boolean {
  return allows(PAYMENT_GATE, role);
}

/**
 * Như trên nhưng ném lỗi — dùng làm guard đầu server action / service.
 *
 * Ném `DemoPaymentMintDisabledError` khi cờ tắt, `ForbiddenError` khi thiếu quyền.
 * Cả hai đều là `ForbiddenError` nên `toResult()` quy về 403 mà không cần sửa gì.
 */
export function assertCanMintDemoPayment(role: unknown): asserts role is Role {
  assertGate(PAYMENT_GATE, role);
}

/**
 * Có được phát hành WPT trực tiếp (dữ liệu thử) không: cờ `ENABLE_DEMO_TOKEN_MINT` bật VÀ vai có
 * `demo:mint-token`. Dùng cho câu hỏi hiển thị; chốt chặn thật dùng `assertCanMintDemoToken()`.
 */
export function canMintDemoToken(role: unknown): boolean {
  return allows(TOKEN_GATE, role);
}

/**
 * Guard của MỌI đường tạo token trực tiếp (`mintToInvestorDirect`, `issueInitialSupply`).
 *
 * Ném `DemoTokenMintDisabledError` khi cờ tắt, `ForbiddenError` khi thiếu quyền — cả hai quy về 403.
 */
export function assertCanMintDemoToken(role: unknown): asserts role is Role {
  assertGate(TOKEN_GATE, role);
}
