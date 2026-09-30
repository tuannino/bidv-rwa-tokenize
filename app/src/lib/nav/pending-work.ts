import type { PendingWorkCounts } from '@/components/layout/nav-config';

/**
 * Số việc đang chờ hiển thị cạnh mục menu (FE-20 yêu cầu 10).
 *
 * Hai khoá theo tài liệu yêu cầu:
 * - `draft` — lệnh Giao dịch viên đã lập nhưng chưa gửi đi phê duyệt.
 * - `approval` — lệnh đang chờ Kiểm soát viên phê duyệt.
 *
 * ## Vì sao là một tệp riêng chứ không nằm trong `nav-config.ts`
 *
 * `nav-config.ts` bị `sidebar.tsx` (`'use client'`) nhập vào, nên mọi thứ trong đó phải
 * client-safe mãi mãi. Con số thật thì phải đọc cơ sở dữ liệu, tức BE-12 sẽ biến tệp này
 * thành `server-only`. Đặt chung thì lần đó làm vỡ build của mọi component nhập `nav-config`,
 * và triệu chứng sẽ hiện ra rất xa nguyên nhân.
 *
 * Chỉ `AppLayout` (Server Component) gọi hàm dưới đây, nên biên vẫn sạch.
 */

/** Chưa có nguồn số thật thì cả hai là 0 — xem ghi chú ở `pendingWorkCounts`. */
export const NO_PENDING_WORK: PendingWorkCounts = { draft: 0, approval: 0 };

/**
 * Số việc đang chờ của phiên hiện tại.
 *
 * Giai đoạn FE-20 trả 0 cho cả hai khoá. Số 0 ở đây là một khẳng định ĐÚNG, không phải chỗ
 * trống: chưa có nghiệp vụ lập lệnh nào nên thật sự không có việc nào chờ. Đây là điểm khác
 * với trang tổng quan nhà đầu tư, nơi số 0 lúc chưa kết nối ví là một khẳng định SAI và phải
 * thay bằng lời mời kết nối (FE-01 R5.3).
 *
 * `async` từ đầu dù thân hàm chưa cần: BE-12 sẽ đọc cơ sở dữ liệu ở đây, và đổi chữ ký từ
 * đồng bộ sang `async` về sau là sửa cả `AppLayout` cùng mọi trang đang kết xuất nó.
 */
// @pending BE-12 | pendingWorkCounts đã sẵn: AppLayout gọi rồi truyền xuống Sidebar, Sidebar đã render số cạnh đúng hai mục Lập lệnh và Phê duyệt lệnh theo khoá pendingWork — BE-12 chỉ cần thay thân hàm bằng phép đếm trên cơ sở dữ liệu
export async function pendingWorkCounts(): Promise<PendingWorkCounts> {
  return NO_PENDING_WORK;
}
