/**
 * KÊNH đang xem — DỮ LIỆU THUẦN, dùng được ở cả server và client.
 *
 * Kênh là lựa chọn TƯỜNG MINH của người dùng, không suy ra từ quyền. Đây là chỗ FE-01 v1 bị
 * mâu thuẫn: một quyền đọc thuộc nhiều vai nên không nói được người dùng đang ở kênh nào.
 *
 * ⚠️ Cookie kênh CHỈ để quyết định hiển thị (menu nào, có hiện bộ chọn vai không).
 * TUYỆT ĐỐI không dùng làm cơ sở phân quyền: người dùng tự đặt được. Phân quyền vẫn đi qua
 * vai + `can(role, action)`. Vì vậy `lib/bank/` không đọc kênh.
 *
 * File này KHÔNG có `server-only` — bộ chọn kênh là Client Component và cần `CHANNELS`,
 * `CHANNEL_HOME`. Phần đọc cookie nằm ở `current-channel.ts` (server-only), giống cách
 * `lib/rbac` tách `permissions.ts` (dữ liệu) khỏi `session.ts` (đọc cookie).
 */

export const CHANNEL_COOKIE = 'bidv_channel';

export const CHANNELS = ['investor', 'admin'] as const;
export type Channel = (typeof CHANNELS)[number];

/** Mặc định `admin`: giữ nguyên hành vi cũ cho người đang dùng kênh ngân hàng. */
export const DEFAULT_CHANNEL: Channel = 'admin';

export function isChannel(value: unknown): value is Channel {
  return typeof value === 'string' && (CHANNELS as readonly string[]).includes(value);
}

/** Trang mặc định của mỗi kênh — dùng khi đổi kênh (R1.3, R1.4). */
export const CHANNEL_HOME: Record<Channel, string> = {
  investor: '/portfolio',
  admin: '/',
};
