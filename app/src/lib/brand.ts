/**
 * Màu NHẬN DIỆN THƯƠNG HIỆU BIDV.
 *
 * Đây là ngoại lệ DUY NHẤT được phép ghi hex trong UI, vì hai chỗ dưới đây phải giữ
 * đúng màu thương hiệu ở cả light và dark, không được đổi theo theme:
 *   - logo (`components/bidv-logo.tsx`)
 *   - accent của nút và modal ví RainbowKit (`components/providers.tsx`): RainbowKit nhận
 *     chuỗi màu cụ thể, không nhận `var(--...)`.
 *
 * Mọi màu khác trong UI BẮT BUỘC đi qua theme token (`var(--primary)`, `var(--chart-*)`,
 * `border-border`, ...) — xem `.kiro/steering/frontend.md`.
 * Giữ ở một file để đổi màu thương hiệu là sửa một chỗ, và để `grep` ra ngoại lệ dễ dàng.
 */
export const BRAND = {
  /** Xanh ngọc của chữ BIDV trong logo. */
  green: '#016B69',
  /** Vàng bông mai trong logo. */
  gold: '#FEC629',
  /** Nút "Kết nối ví" (RainbowKit) giao diện Sáng: nền vàng, chữ đậm. */
  walletAccent: '#c9971c',
  walletAccentForeground: '#0e1e1d',
  /** Nút "Kết nối ví" giao diện Tối. */
  walletAccentDark: '#e0b44a',
  walletAccentForegroundDark: '#1d1300',
} as const;
