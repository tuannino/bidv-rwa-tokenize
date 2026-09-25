'use server';

import {
  distributePeriod,
  getDistributionPeriod,
  openPeriod,
  previewDistribution,
} from '@/lib/bank/distribution.service';

/**
 * Server actions cho luồng CHIA LỢI NHUẬN — vỏ mỏng quanh `distribution.service`.
 *
 * ⚠️ KHÔNG có guard quyền ở tệp này, và đó là chủ đích chứ không phải bỏ sót. Server action gọi
 * được bằng POST trực tiếp, không chỉ qua giao diện, nên guard đặt ở đây sẽ không áp cho transport
 * thứ hai — và người thêm transport đó không có lý do nào để đoán ra là mình phải tự thêm. Toàn bộ
 * kiểm quyền và ghi sổ kiểm toán nằm TRONG service.
 *
 * `input: unknown` là cố ý: validate bằng Zod trong service, một schema dùng chung cho form và
 * server. Khai kiểu hẹp ở đây sẽ tạo cảm giác đã kiểm dữ liệu trong khi chưa.
 *
 * Bốn action ứng đúng bốn hàm của service, KHÔNG có action nào gộp "mở kỳ rồi chia luôn". Chốt
 * quyền và chi trả là HAI lần quyết định của con người: giữa hai bước đó, cán bộ ngân hàng phải
 * xem `previewDistribution` và đối chiếu số tiền. Một action gộp sẽ bỏ mất chính bước kiểm đó, và
 * lúc ấy `previewDistribution` chỉ còn là một màn hình không ai bắt buộc phải mở.
 */

/**
 * @flow distribute:1 | nhận yêu cầu mở kỳ chia, trước khi chốt quyền
 * @pending FE-08 | đã sẵn đầu cuối ở `openPeriod`: validate Zod, kiểm quyền `distribution:snapshot`, kiểm mã kỳ trùng và kiểm quỹ TRƯỚC khi chạm chuỗi nên lời gọi trượt không tốn ảnh chụp, chốt quyền qua `ILedgerPort.takeSnapshot`, đọc lại số dư quỹ để chắc contract chốt đúng con số đã ghi, lưu kỳ và ghi sổ kiểm toán cả bốn kết cục. Màn chia lợi nhuận chỉ cần gọi rồi hiển thị `Result`. FE-08 PHẢI hiện `snapshotId` và `totalAmount` trả về: đó là hai con số cán bộ ngân hàng dùng để đối chiếu trước khi bấm chia
 */
export async function openPeriodAction(input: unknown) {
  return openPeriod(input);
}

/**
 * @flow distribute:3 | nhận yêu cầu xem trước phân bổ của một kỳ đã mở
 * @pending FE-08 | đã sẵn đầu cuối ở `previewDistribution`: dựng danh sách người nhận từ cơ sở dữ liệu, đọc số dư tại ảnh chụp, tính phần từng ví bằng ĐÚNG hàm mà lúc chia sẽ dùng, trả kèm `dust` và `dustWallet`. Hàm KHÔNG ghi một dòng nào, kể cả sổ kiểm toán, nên gọi bao nhiêu lần cũng được. FE-08 nên hiện cả ví được chia 0 thay vì lọc bỏ: vắng mặt và được chia 0 là hai thông tin khác nhau với người đối soát
 */
export async function previewDistributionAction(input: unknown) {
  return previewDistribution(input);
}

/**
 * @flow distribute:7 | nhận yêu cầu chia theo lô; gọi lại được để chia phần còn thiếu
 * @pending FE-08 | đã sẵn đầu cuối ở `distributePeriod`: kiểm quyền `distribution:execute`, lập đủ hồ sơ chờ TRƯỚC khi gửi giao dịch nào, chia lô theo tham số `distribution.batch_size`, ba trạng thái hồ sơ `PENDING`/`SENT`/`PAID` nên tiến trình chết giữa đường không để lại hồ sơ trông như đã chi, một lô lỗi không dừng các lô còn lại. Gọi lại CHỈ chia cho ví chưa nhận nên bấm hai lần không ai bị trả hai lần. FE-08 nên hiện `outstanding` và `failed`: khác 0 nghĩa là còn phải bấm chia lại
 */
export async function distributePeriodAction(input: unknown) {
  return distributePeriod(input);
}

/**
 * @flow distribute:9 | nhận yêu cầu đọc trạng thái và tiến độ chi trả của một kỳ
 * @pending FE-09 | đã sẵn đầu cuối ở `getDistributionPeriod`: tra kỳ theo `periodKey` hoặc `periodId`, trả trạng thái kỳ kèm số hồ sơ theo từng trạng thái, tổng đã chi và số hồ sơ còn phải chi. Kiểm quyền `reconcile:read` nên ba vai phía ngân hàng đọc được và nhà đầu tư thì không. Hàm chỉ đọc và KHÔNG ghi sổ kiểm toán, nên màn theo dõi gọi lại theo chu kỳ được mà không nhấn chìm sổ
 */
export async function getDistributionPeriodAction(input: unknown) {
  return getDistributionPeriod(input);
}
