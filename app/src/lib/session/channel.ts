import 'server-only';

import { cookies } from 'next/headers';

/**
 * KÊNH đang xem — lựa chọn TƯỜNG MINH của người dùng, không suy ra từ quyền.
 *
 * Vì sao tách khỏi vai: FE-01 v1 xác định kênh bằng quyền và bị mâu thuẫn, vì một quyền
 * đọc có thể thuộc nhiều vai nên không nói được "người này đang ở kênh nào". Kênh là câu
 * hỏi *người dùng muốn thấy gì*, còn vai là câu hỏi *được phép làm gì* — hai trục khác nhau.
 *
 * ⚠️ Cookie này CHỈ để quyết định hiển thị (menu nào, có hiện bộ chọn vai không).
 * TUYỆT ĐỐI không dùng làm cơ sở phân quyền: người dùng tự đặt được. Phân quyền vẫn đi qua
 * vai + `can(role, action)`. Vì vậy `lib/bank/` không đọc file này.
 */

export const CHANNEL_COOKIE = 'bidv_channel';

export const CHANNELS = ['investor', 'admin'] as const;
export type Channel = (typeof CHANNELS)[number];

/** Mặc định `admin`: giữ nguyên hành vi cũ cho người đang dùng kênh ngân hàng. */
export const DEFAULT_CHANNEL: Channel = 'admin';

export function isChannel(value: unknown): value is Channel {
  return typeof value === 'string' && (CHANNELS as readonly string[]).includes(value);
}

/**
 * Kênh của phiên hiện tại. Giá trị lạ hoặc thiếu -> `admin`.
 *
 * Bọc try/catch giống `currentRole()`: hàm này có thể bị gọi ngoài request scope
 * (script demo, test) và ở đó `cookies()` ném lỗi.
 */
export async function currentChannel(): Promise<Channel> {
  let fromCookie: string | undefined;
  try {
    const store = await cookies();
    fromCookie = store.get(CHANNEL_COOKIE)?.value;
  } catch {
    // Ngoài request scope — dùng mặc định.
  }

  return isChannel(fromCookie) ? fromCookie : DEFAULT_CHANNEL;
}

/** Trang mặc định của mỗi kênh — dùng khi đổi kênh (R1.3, R1.4). */
export const CHANNEL_HOME: Record<Channel, string> = {
  investor: '/portfolio',
  admin: '/',
};
