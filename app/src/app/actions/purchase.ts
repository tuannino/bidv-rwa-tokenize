'use server';

import {
  executeOrder,
  listOrders,
  orderDailyStats,
  placeOrder,
  previewPurchase,
} from '@/lib/bank/purchase.service';

/**
 * Server actions cho lệnh mua và bán WPT — vỏ mỏng quanh `purchase.service`. Chiều bán (BE-14)
 * đi qua CÙNG các action dưới đây bằng trường `side`, không có action riêng.
 *
 * ⚠️ KHÔNG có guard quyền ở tệp này, và đó là chủ đích chứ không phải bỏ sót.
 *
 * Server action gọi được bằng POST trực tiếp, không chỉ qua giao diện
 * (node_modules/next/dist/docs/.../07-mutating-data.md). Guard đặt ở đây thì transport
 * thứ hai — `app/api/purchase/route.ts` — sẽ không có guard, và người thêm transport thứ
 * ba cũng không có lý do nào để đoán ra là mình phải tự thêm. Vì vậy toàn bộ kiểm quyền
 * và ghi sổ kiểm toán nằm TRONG service.
 *
 * `input: unknown` là cố ý: validate bằng Zod ở trong service, một schema dùng chung cho
 * form và server. Khai kiểu hẹp ở đây sẽ tạo cảm giác đã kiểm dữ liệu trong khi chưa.
 *
 * ⚠️ Service có SÁU hàm, tệp này chỉ có NĂM action — thiếu `expireStaleOrders`, và đó là chủ
 * đích chứ không phải bỏ sót. Dọn lệnh treo chỉ có MỘT đường vào: tiến trình theo lịch của
 * BE-07 gọi thẳng service. Server action cũng là một điểm vào HTTP, nên mở nó ở đây sẽ phá
 * đúng chủ đích đã ghi ở `app/src/app/api/purchase/route.ts` — mời gọi việc gọi tay giữa
 * lúc có lệnh đang xử lý.
 */

/**
 * @flow purchase:1 | nhận yêu cầu xem trước điều kiện mua, trước khi có lệnh nào
 * @pending FE-05 | đã sẵn đầu cuối ở `previewPurchase`, cho CẢ hai chiều qua `side` (BE-14): kiểm quyền `order:place`, báo giá, chạy ĐÚNG bộ kiểm mà khớp lệnh sẽ chạy, trả `canPlaceOrder` + `blockers` + `howToFix` cho từng phép kiểm. Màn mua WPT chỉ cần gọi và hiển thị. FE-05 PHẢI chống gọi dồn: hàm này gọi được sau mỗi ký tự người dùng gõ vào ô số lượng, nên màn hình phải hoãn lời gọi và bỏ phản hồi đã cũ — service KHÔNG có bộ nhớ đệm, và cũng không nên có
 */
export async function previewPurchaseAction(input: unknown) {
  return previewPurchase(input);
}

/**
 * @flow purchase:3 | một trong hai đường vận chuyển: nhận yêu cầu đặt lệnh; đường kia là POST /api/purchase
 * @pending FE-05 | đã sẵn đầu cuối ở `placeOrder`, cho CẢ hai chiều qua `side` (BE-14): validate Zod, kiểm quyền `order:place` (vai INVESTOR), kiểm điều kiện trước khi tạo bản ghi, CHỐT số VNDB tại thời điểm đặt, lưu lệnh `PLACED`, ghi sổ kiểm toán. Màn mua WPT chỉ cần gọi và hiển thị `Result`
 */
export async function placeOrderAction(input: unknown) {
  return placeOrder(input);
}

/**
 * @flow purchase:6 | một trong hai đường vận chuyển: nhận yêu cầu khớp lệnh; đường kia là POST /api/purchase có orderId
 * @pending FE-06 | đã sẵn đầu cuối ở `executeOrder`: kiểm quyền `order:execute` (vai TELLER), bốn phép đọc trước khi gửi, khoá lạc quan chống gửi hai lần, đọc lại số dư từ chuỗi sau biên nhận
 */
export async function executeOrderAction(input: unknown) {
  return executeOrder(input);
}

/**
 * @flow purchase:11 | một trong hai đường vận chuyển: nhận yêu cầu xem sổ lệnh; đường kia là GET /api/purchase
 * @pending FE-06 | đã sẵn đầu cuối ở `listOrders`: phân biệt `order:read` với `order:read:all`, nên "vai nào xem được sổ lệnh nào" là việc của RBAC chứ không phải của màn hình; BE-14 thêm lọc theo chiều, mã lệnh, khoảng ngày, và mỗi lệnh mang sẵn năm bước quyết toán kèm mốc thời gian
 */
export async function listOrdersAction(input: unknown) {
  return listOrders(input);
}

/**
 * @pending FE-21 | đã sẵn đầu cuối ở `orderDailyStats`: kiểm quyền `order:read:all` (Người bán và hai vai vận hành), đếm lệnh COMPLETED trong ngày theo giờ Việt Nam cho cả hai chiều, trả đúng bốn ô `tiles` (số lệnh mua, giá trị mua, số lệnh bán, giá trị bán) — màn Tổng quan Người bán và bảng điều khiển vận hành chỉ vẽ, không tự cộng
 */
export async function orderDailyStatsAction(input: unknown) {
  return orderDailyStats(input);
}
