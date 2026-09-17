'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { refresh } from 'next/cache';
import { ROLE_COOKIE } from '@/lib/rbac/session';
import { isRole, type Role } from '@/lib/rbac';
import { CHANNEL_COOKIE, CHANNEL_HOME, isChannel } from '@/lib/session/channel';

/**
 * Cookie phiên (PoC): vai trò đang giả lập + kênh đang xem.
 *
 * ⚠️ ĐÂY KHÔNG PHẢI XÁC THỰC. Người dùng tự đổi được cả hai.
 * Phase 4 thay bằng SIWE + session có chữ ký; khi đó XOÁ cả hai hàm dưới đây.
 * Ghi rõ để không ai nhầm là cơ chế phân quyền thật — chốt chặn thật nằm ở
 * `assertCan()` trong `lib/bank/`.
 */

/** PoC: cho UI đọc lại được; Phase 4 sẽ là session httpOnly có chữ ký. */
const COOKIE_OPTIONS = {
  httpOnly: false,
  sameSite: 'lax',
  path: '/',
} as const;

/** Đổi vai trò đang giả lập (chỉ dùng trong kênh Admin console). */
export async function setDemoRole(role: string): Promise<void> {
  if (!isRole(role)) return;

  const store = await cookies();
  store.set(ROLE_COOKIE, role, COOKIE_OPTIONS);

  refresh();
}

/**
 * Đổi KÊNH — đặt **cả hai** cookie trong một lần gọi.
 *
 * Hai cookie phải luôn nhất quán: không được để người dùng ở kênh nhà đầu tư mà vai là
 * cán bộ ngân hàng (guard sẽ chặn ngay, người dùng thấy màn từ chối mà không hiểu vì sao),
 * cũng không để ở kênh admin mà vai là INVESTOR (mọi trang admin đều bị chặn).
 *
 * Giá trị lạ thì bỏ qua im lặng, giống `setDemoRole`.
 *
 * Điều hướng làm Ở ĐÂY bằng `redirect()`, KHÔNG để client `router.push` sau khi await.
 *
 * Lý do cụ thể: đổi từ kênh nhà đầu tư sang admin làm vai mất `portfolio:read`, nên trang
 * `/portfolio` đang mở bị `ChannelGuard` từ chối. Màn từ chối KHÔNG bọc `AppLayout`, tức
 * `Header` (và bộ chọn kênh đang giữ transition) bị unmount — `router.push` trong transition
 * đó không bao giờ chạy, người dùng đứng lại ở màn từ chối. Đã gặp thật khi chạy e2e.
 * `redirect()` ở server thì cookie và điều hướng cùng một lượt, không phụ thuộc component
 * còn sống hay không.
 */
export async function setChannel(channel: string): Promise<void> {
  if (!isChannel(channel)) return;

  const store = await cookies();
  store.set(CHANNEL_COOKIE, channel, COOKIE_OPTIONS);

  if (channel === 'investor') {
    store.set(ROLE_COOKIE, 'INVESTOR' satisfies Role, COOKIE_OPTIONS);
  } else {
    // Vào Admin console mà đang mang vai INVESTOR thì không có quyền nào của kênh này,
    // nên đưa về vai ngân hàng mặc định. Vai ngân hàng khác thì tôn trọng lựa chọn cũ.
    const current = store.get(ROLE_COOKIE)?.value;
    if (!isRole(current) || current === 'INVESTOR') {
      store.set(ROLE_COOKIE, 'BANK_ADMIN' satisfies Role, COOKIE_OPTIONS);
    }
  }

  // `redirect` ném một control-flow exception do framework xử lý; code sau nó không chạy,
  // nên không cần `refresh()` — trang đích vốn đã kết xuất mới.
  redirect(CHANNEL_HOME[channel]);
}
