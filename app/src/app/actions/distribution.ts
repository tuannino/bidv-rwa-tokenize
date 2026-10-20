'use server';

import {
  approveDistribution,
  continueDistribution,
  getDistributionOverview,
  listDistributionPayouts,
  listDistributionPeriods,
  reapproveDistribution,
} from '@/lib/bank/distribution-approval.service';
import { listDistributionRuns } from '@/lib/bank/distribution-trigger.service';
import { getDistributionPeriod } from '@/lib/bank/distribution.service';

/**
 * Server actions cho luồng CHIA LỢI NHUẬN: vỏ mỏng quanh service.
 *
 * ⚠️ KHÔNG có guard quyền ở tệp này, và đó là chủ đích chứ không phải bỏ sót. Server action gọi
 * được bằng POST trực tiếp, không chỉ qua giao diện, nên guard đặt ở đây sẽ không áp cho transport
 * thứ hai. Toàn bộ kiểm quyền và ghi sổ kiểm toán nằm TRONG service.
 *
 * `input: unknown` là cố ý: validate bằng Zod trong service.
 *
 * FE-08 QĐ-A: người chỉ có ba hành động ghi, cả ba là `distribution:approve` (Kiểm soát viên):
 * duyệt, duyệt lại số thực tế, tiếp tục kỳ đã duyệt. Bốn action cũ (mở kỳ, xem trước, chia, chạy
 * một vòng tự động) ĐÃ GỠ: chúng cho Giao dịch viên mở kỳ và chia mà không có ai duyệt số. Service
 * của chúng giữ cho tiến trình định kỳ và kiểm thử, và lõi chia từ chối mọi kỳ chưa duyệt.
 */

/** @flow distribute:1 | nhận yêu cầu xem tổng quan màn chia: quỹ, dự kiến, kỳ hoạt động */
export async function getDistributionOverviewAction(input: unknown) {
  return getDistributionOverview(input);
}

/** @flow distribute:3 | nhận lần duyệt chia của Kiểm soát viên kèm số VNDB đã xem trên màn */
export async function approveDistributionAction(input: unknown) {
  return approveDistribution(input);
}

/** @flow distribute:8 | nhận lần duyệt lại số thực tế trên chuỗi của kỳ AMOUNT_CHANGED hoặc kỳ cũ chưa duyệt */
export async function reapproveDistributionAction(input: unknown) {
  return reapproveDistribution(input);
}

/** @flow distribute:10 | nhận yêu cầu tiếp tục kỳ đã duyệt: phục hồi, đối soát vault, chia lô còn lại */
export async function continueDistributionAction(input: unknown) {
  return continueDistribution(input);
}

/** @flow distribute:19 | nhận yêu cầu xem trang lịch sử kỳ chia */
export async function listDistributionPeriodsAction(input: unknown) {
  return listDistributionPeriods(input);
}

/** @flow distribute:21 | nhận yêu cầu xem trang hồ sơ trả từng ví của một kỳ */
export async function listDistributionPayoutsAction(input: unknown) {
  return listDistributionPayouts(input);
}

/** @flow distribute:23 | nhận yêu cầu xem lịch chạy, mới nhất trước */
export async function listDistributionRunsAction(input: unknown) {
  return listDistributionRuns(input);
}

/**
 * @pending FE-09 | đã sẵn đầu cuối ở `getDistributionPeriod`: tra kỳ theo `periodKey` hoặc `periodId`, trả trạng thái kỳ kèm số hồ sơ theo từng trạng thái, tổng đã chi và số hồ sơ còn phải chi. Kiểm quyền `reconcile:read` nên hai vai vận hành đọc được và nhà đầu tư thì không. Hàm chỉ đọc và KHÔNG ghi sổ kiểm toán, nên màn theo dõi gọi lại theo chu kỳ được mà không nhấn chìm sổ
 */
export async function getDistributionPeriodAction(input: unknown) {
  return getDistributionPeriod(input);
}
