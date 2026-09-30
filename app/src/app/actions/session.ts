'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { refresh } from 'next/cache';
import { ROLE_COOKIE } from '@/lib/rbac/session';
import { isRole, type Role } from '@/lib/rbac';
import { CHANNEL_COOKIE, CHANNEL_HOME, CHANNEL_ROLE, isChannel } from '@/lib/session/channel';

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

/**
 * Đổi vai trò đang giả lập, KHÔNG đổi khu vực đang xem.
 *
 * FE-20 gỡ bộ chọn vai khỏi giao diện (chọn vai giờ là việc của `setChannel`), nên hàm này
 * hiện không có người gọi. Giữ lại vì nó là cách duy nhất đặt vai mà không điều hướng, thứ
 * mà phần đăng nhập thật của AU-01 cần khi dựng phiên xong rồi trả người dùng về đúng trang
 * họ đang mở.
 */
// @pending AU-01 | setDemoRole đã sẵn: đặt cookie vai rồi refresh, KHÔNG điều hướng — dùng được để nối phiên SIWE mà giữ người dùng ở lại trang đang mở
export async function setDemoRole(role: string): Promise<void> {
  if (!isRole(role)) return;

  const store = await cookies();
  store.set(ROLE_COOKIE, role, COOKIE_OPTIONS);

  refresh();
}

/**
 * Đổi KHU VỰC — đặt **cả hai** cookie trong một lần gọi.
 *
 * Hai cookie phải luôn nhất quán: không được để người dùng ở khu vực nhà đầu tư mà vai là
 * Giao dịch viên (guard sẽ chặn ngay, người dùng thấy màn từ chối mà không hiểu vì sao).
 *
 * FE-20: khu vực ↔ vai là MỘT-MỘT nên vai suy thẳng từ `CHANNEL_ROLE`, không còn nhánh
 * "tôn trọng lựa chọn vai cũ" như bản hai khu vực. Bỏ nhánh đó là cố ý: giờ không có cặp
 * (khu vực, vai) nào hợp lệ ngoài cặp trong bảng, nên giữ một đường đặt vai khác là giữ
 * đúng cái đường sinh ra hai cookie lệch nhau.
 *
 * Giá trị lạ thì bỏ qua im lặng, giống `setDemoRole`.
 *
 * Điều hướng làm Ở ĐÂY bằng `redirect()`, KHÔNG để client `router.push` sau khi await.
 *
 * Lý do cụ thể: đổi từ khu vực nhà đầu tư sang vận hành làm vai mất `portfolio:read`, nên
 * trang `/portfolio` đang mở bị `ChannelGuard` từ chối. Màn từ chối KHÔNG bọc `AppLayout`, tức
 * `Header` (và bộ chọn đang giữ transition) bị unmount — `router.push` trong transition
 * đó không bao giờ chạy, người dùng đứng lại ở màn từ chối. Đã gặp thật khi chạy e2e.
 * `redirect()` ở server thì cookie và điều hướng cùng một lượt, không phụ thuộc component
 * còn sống hay không.
 */
export async function setChannel(channel: string): Promise<void> {
  if (!isChannel(channel)) return;

  const store = await cookies();
  store.set(CHANNEL_COOKIE, channel, COOKIE_OPTIONS);
  store.set(ROLE_COOKIE, CHANNEL_ROLE[channel] satisfies Role, COOKIE_OPTIONS);

  // `redirect` ném một control-flow exception do framework xử lý; code sau nó không chạy,
  // nên không cần `refresh()` — trang đích vốn đã kết xuất mới.
  redirect(CHANNEL_HOME[channel]);
}
