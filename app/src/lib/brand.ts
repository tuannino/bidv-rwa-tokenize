/**
 * Màu NHẬN DIỆN THƯƠNG HIỆU BIDV.
 *
 * Đây là ngoại lệ DUY NHẤT được phép ghi hex trong UI, vì hai chỗ dưới đây phải giữ
 * đúng màu thương hiệu ở cả light và dark, không được đổi theo theme:
 *   - logo (`components/bidv-logo.tsx`)
 *   - accent của modal ví RainbowKit (`components/providers.tsx`) — RainbowKit nhận
 *     chuỗi màu cụ thể, không nhận `var(--...)`.
 *
 * Mọi màu khác trong UI BẮT BUỘC đi qua theme token (`var(--primary)`, `var(--chart-*)`,
 * `border-border`, ...) — xem `.kiro/steering/frontend.md`.
 * Giữ ở một file để đổi màu thương hiệu là sửa một chỗ, và để `grep` ra ngoại lệ dễ dàng.
 */
export const BRAND = {
  green: '#1a6b3c',
  greenLight: '#2d9058',
  gold: '#b8860b',
  goldLight: '#d4a017',
} as const;
