'use server';

import { getIssuePrice, setIssuePrice } from '@/lib/bank/config.service';

/**
 * Server actions cho THAM SỐ HỆ THỐNG — vỏ mỏng quanh `config.service`.
 *
 * ⚠️ KHÔNG có guard quyền ở tệp này, và đó là chủ đích chứ không phải bỏ sót. Server action gọi
 * được bằng POST trực tiếp, không chỉ qua giao diện, nên guard đặt ở đây sẽ không áp cho
 * transport thứ hai — và người thêm transport đó không có lý do nào để đoán ra là mình phải tự
 * thêm. Toàn bộ kiểm quyền và ghi sổ kiểm toán nằm TRONG service.
 *
 * `input: unknown` là cố ý: validate bằng Zod ở trong service, một schema dùng chung cho form và
 * server. Khai kiểu hẹp ở đây sẽ tạo cảm giác đã kiểm dữ liệu trong khi chưa.
 */

/**
 * @pending FE-07 | đã sẵn đầu cuối ở `setIssuePrice`: validate Zod, guard HAI LỚP (`treasury:manage` rồi cờ `isConfig` của vai), kiểm ngưỡng đổi giá, ĐẨY GIÁ XUỐNG LEDGER TRƯỚC rồi mới ghi cơ sở dữ liệu + lịch sử, ghi bảng thất bại thì tự hoàn nguyên giá cũ trên ledger, ghi sổ kiểm toán cả bốn kết cục. Màn cấu hình chỉ cần gọi và hiển thị `Result`. FE-07 PHẢI hiện hộp xác nhận khi `Result` trả mã `VALIDATION` kèm thông báo lệch ngưỡng, rồi gọi lại với `confirmLargeChange: true` — service CỐ Ý không coi lần gọi thứ hai là xác nhận, vì lần gọi lại không chứng tỏ người dùng đã đọc cảnh báo
 */
export async function setIssuePriceAction(input: unknown) {
  return setIssuePrice(input);
}

/**
 * @pending FE-07 | đã sẵn đầu cuối ở `getIssuePrice`: trả giá đang có hiệu lực kèm vai đã đặt, thời điểm đặt, và cờ `configured` phân biệt "ngân hàng đã cấu hình" với "đang dùng mặc định trong mã". Màn cấu hình dùng đúng ba trường đó để hiện trạng thái hiện tại trước khi cho sửa; KHÔNG kiểm quyền vì giá phát hành là con số hiển thị công khai cho nhà đầu tư
 */
export async function getIssuePriceAction() {
  return getIssuePrice();
}
