'use server';

import { getIssuePrice, getPriceConfigOverview, setIssuePrice } from '@/lib/bank/config.service';
import { chainSchema } from '@/lib/bank/schemas';

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
 * Đổi giá phát hành, gọi từ màn `/config` "Giá và phát hành" (FE-07). Toàn bộ kiểm dữ liệu, quyền
 * (`treasury:manage` rồi cờ cấu hình của vai), chặn lệnh đang xử lý, kiểm ngưỡng, gửi giao dịch và
 * CHỜ BIÊN NHẬN rồi mới ghi cơ sở dữ liệu nằm trong `setIssuePrice`. Màn hiện hộp xác nhận thứ hai
 * khi nhận `VALIDATION` lệch ngưỡng rồi gọi lại với `confirmLargeChange: true`: service CỐ Ý không
 * coi lần gọi thứ hai là xác nhận, vì lần gọi lại không chứng tỏ người dùng đã đọc cảnh báo.
 */
export async function setIssuePriceAction(input: unknown) {
  return setIssuePrice(input);
}

/**
 * Giá phát hành kèm vai và thời điểm đặt. Màn `/config` không gọi action này khi mở: nó đọc cùng
 * dữ liệu trong `getPriceConfigOverviewAction`. KHÔNG kiểm quyền vì giá phát hành là con số công
 * khai cho nhà đầu tư.
 */
export async function getIssuePriceAction(chain: unknown) {
  const parsed = chainSchema.safeParse(chain);
  if (!parsed.success) throw new Error('Chain không hợp lệ.');
  return getIssuePrice(parsed.data);
}

/**
 * MỘT action khi mở màn `/config` (FE-07): giá phát hành, ngưỡng, `canEdit`, tình trạng phát hành,
 * lịch sử đổi giá, lệnh đang xử lý. Đọc bằng `assertCan('ops:read')`, không ghi sổ kiểm toán.
 */
export async function getPriceConfigOverviewAction(input: unknown) {
  return getPriceConfigOverview(input);
}
