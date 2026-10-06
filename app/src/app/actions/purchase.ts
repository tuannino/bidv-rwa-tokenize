'use server';

import {
  executeOrder,
  listOrders,
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
 * BE-14: `orderDailyStats` cũng không có action riêng — `seller.service` gọi nó ngay trong tầng
 * nghiệp vụ cho Tổng quan Người bán; thêm action khi có màn thứ hai cần gọi thẳng (bảng điều khiển
 * vận hành, chưa có mã task).
 *
 * ⚠️ Service có SÁU hàm, tệp này chỉ có BỐN action — thiếu `expireStaleOrders` (và `orderDailyStats`,
 * lý do ở trên), và đó là chủ
 * đích chứ không phải bỏ sót. Dọn lệnh treo chỉ có MỘT đường vào: tiến trình theo lịch của
 * BE-07 gọi thẳng service. Server action cũng là một điểm vào HTTP, nên mở nó ở đây sẽ phá
 * đúng chủ đích đã ghi ở `app/src/app/api/purchase/route.ts` — mời gọi việc gọi tay giữa
 * lúc có lệnh đang xử lý.
 */

/**
 * @flow purchase:1 | nhận yêu cầu xem trước điều kiện mua, trước khi có lệnh nào
 */
export async function previewPurchaseAction(input: unknown) {
  return previewPurchase(input);
}

/**
 * @flow purchase:3 | một trong hai đường vận chuyển: nhận yêu cầu đặt lệnh; đường kia là POST /api/purchase
 */
export async function placeOrderAction(input: unknown) {
  return placeOrder(input);
}

/**
 * @flow purchase:6 | một trong hai đường vận chuyển: nhận yêu cầu khớp lệnh; đường kia là POST /api/purchase có orderId
 */
export async function executeOrderAction(input: unknown) {
  return executeOrder(input);
}

/**
 * @flow purchase:11 | một trong hai đường vận chuyển: nhận yêu cầu xem sổ lệnh; đường kia là GET /api/purchase
 */
export async function listOrdersAction(input: unknown) {
  return listOrders(input);
}
