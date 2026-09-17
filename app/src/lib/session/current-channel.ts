import 'server-only';

import { cookies } from 'next/headers';
import { CHANNEL_COOKIE, DEFAULT_CHANNEL, isChannel, type Channel } from './channel';

/**
 * Kênh của phiên hiện tại. Giá trị lạ hoặc thiếu -> `admin`.
 *
 * Tách khỏi `channel.ts` vì file này đọc cookie nên phải `server-only`, còn `channel.ts` là
 * dữ liệu thuần mà Client Component cần dùng. Cùng cách tách như `lib/rbac`.
 *
 * Bọc try/catch giống `currentRole()`: hàm này có thể bị gọi ngoài request scope (script
 * demo, test) và ở đó `cookies()` ném lỗi.
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
