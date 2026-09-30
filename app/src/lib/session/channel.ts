import type { Role } from '@/lib/rbac';

/**
 * KHU VỰC đang xem — DỮ LIỆU THUẦN, dùng được ở cả server và client.
 *
 * Khu vực là lựa chọn TƯỜNG MINH của người dùng, không suy ra từ quyền. Đây là chỗ FE-01 v1 bị
 * mâu thuẫn: một quyền đọc thuộc nhiều vai nên không nói được người dùng đang ở khu vực nào.
 *
 * ⚠️ Cookie khu vực CHỈ để quyết định hiển thị (menu nào, điều hướng về đâu).
 * TUYỆT ĐỐI không dùng làm cơ sở phân quyền: người dùng tự đặt được. Phân quyền vẫn đi qua
 * vai + `can(role, action)`. Vì vậy `lib/bank/` không đọc khu vực.
 *
 * File này KHÔNG có `server-only` — bộ chọn khu vực là Client Component và cần `CHANNELS`,
 * `CHANNEL_HOME`. Phần đọc cookie nằm ở `current-channel.ts` (server-only), giống cách
 * `lib/rbac` tách `permissions.ts` (dữ liệu) khỏi `session.ts` (đọc cookie).
 *
 * ## FE-20: khu vực ↔ vai trò là MỘT-MỘT
 *
 * Trước FE-20 có hai khu vực cho bốn vai, nên bộ chọn khu vực và bộ chọn vai là hai ô riêng.
 * Tài liệu yêu cầu chia đúng bốn vai, mỗi vai một khu vực, nên hai ô nhập thành một và
 * `CHANNEL_ROLE` dưới đây là chỗ DUY NHẤT nói cặp nào đi với nhau.
 *
 * Giữ hai khái niệm dù đã một-một là có lý do: `Channel` là thứ xuất hiện trên URL và trong
 * cookie hiển thị, còn `Role` là thứ `can()` nhận. Gộp chúng lại thành một giá trị là để tên
 * vai lọt vào tầng hiển thị, và lần sau muốn một vai xem được hai khu vực (hoặc hai vai chung
 * một khu vực) thì phải sửa cả hai tầng.
 */

export const CHANNEL_COOKIE = 'bidv_channel';

export const CHANNELS = ['investor', 'seller', 'teller', 'controller'] as const;
export type Channel = (typeof CHANNELS)[number];

/**
 * Mặc định `teller`: giữ nguyên hành vi cũ — phiên chưa có cookie vẫn vào bảng điều khiển
 * vận hành, đúng như khi khu vực mặc định còn là `admin`.
 */
export const DEFAULT_CHANNEL: Channel = 'teller';

export function isChannel(value: unknown): value is Channel {
  return typeof value === 'string' && (CHANNELS as readonly string[]).includes(value);
}

/**
 * Trang mặc định của mỗi khu vực — dùng khi đổi khu vực (R1.3, R1.4).
 *
 * `teller` và `controller` cùng về `/` vì tài liệu yêu cầu cho cả hai vai mục **Bảng điều
 * khiển**; đó là một trang dùng chung, khác nhau ở việc vai nào bấm được nút nào.
 */
export const CHANNEL_HOME: Record<Channel, string> = {
  investor: '/portfolio',
  seller: '/seller',
  teller: '/',
  controller: '/',
};

/**
 * Vai trò tương ứng mỗi khu vực. `Record` đủ bốn khoá nên thêm khu vực mà quên vai là lỗi
 * biên dịch — không có đường nào để một khu vực tồn tại mà không ai nói nó thuộc vai nào.
 */
export const CHANNEL_ROLE: Record<Channel, Role> = {
  investor: 'INVESTOR',
  seller: 'SELLER',
  teller: 'TELLER',
  controller: 'CONTROLLER',
};

/**
 * Chiều ngược lại, SUY RA từ `CHANNEL_ROLE` chứ không liệt kê lại.
 *
 * Liệt kê lại là có hai nguồn, và chúng lệch nhau ở lần đổi đầu tiên — lúc đó đổi vai đưa
 * người dùng tới menu của vai khác, một lỗi rất khó lần vì cả hai bảng đều "trông đúng".
 */
export const ROLE_CHANNEL: Record<Role, Channel> = Object.fromEntries(
  CHANNELS.map((channel) => [CHANNEL_ROLE[channel], channel]),
) as Record<Role, Channel>;

/** Trang mặc định của một VAI — dùng khi chỉ biết vai (guard, trang chủ). */
export function homeForRole(role: Role): string {
  return CHANNEL_HOME[ROLE_CHANNEL[role]];
}
