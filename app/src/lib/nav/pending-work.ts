import 'server-only';

import type { PendingWorkCounts } from '@/components/layout/nav-config';
import { countPendingWork } from '@/lib/bank/token-request.service';
import { currentActorId, currentRole } from '@/lib/rbac/session';

/**
 * Số việc đang chờ hiển thị cạnh mục menu (FE-20 yêu cầu 10).
 *
 * Hai khoá, gắn với hai mục menu Lập lệnh và Phê duyệt lệnh.
 *
 * ## Vì sao là một tệp riêng chứ không nằm trong `nav-config.ts`
 *
 * `nav-config.ts` bị `sidebar.tsx` (`'use client'`) nhập vào, nên mọi thứ trong đó phải
 * client-safe mãi mãi. Con số thật đọc cơ sở dữ liệu nên tệp này là `server-only` (từ BE-12).
 * Đặt chung thì làm vỡ build của mọi component nhập `nav-config`.
 *
 * Chỉ `AppLayout` (Server Component) gọi hàm dưới đây, nên biên vẫn sạch.
 */

/** Số dùng khi không đọc được nguồn — xem ghi chú ở `pendingWorkCounts`. */
export const NO_PENDING_WORK: PendingWorkCounts = { draft: 0, approval: 0 };

/**
 * Số việc đang chờ của phiên hiện tại (BE-12).
 *
 * Nghĩa hai khoá theo quyền của vai, xem `countPendingWork`:
 * - `draft`: yêu cầu Mint/Burn người này đã lập, đang chờ người khác duyệt.
 * - `approval`: yêu cầu người khác lập, đang chờ người này duyệt.
 *
 * Lỗi đọc cơ sở dữ liệu thì trả 0 và ghi log, KHÔNG ném: `AppLayout` gọi hàm này trên MỌI trang,
 * nên một lần mất kết nối sẽ làm sập cả những trang không liên quan gì tới lập–duyệt.
 */
export async function pendingWorkCounts(): Promise<PendingWorkCounts> {
  try {
    const role = await currentRole();
    return await countPendingWork(role, await currentActorId(role));
  } catch (error) {
    console.error('[pending-work] không đọc được số việc đang chờ:', error);
    return NO_PENDING_WORK;
  }
}
