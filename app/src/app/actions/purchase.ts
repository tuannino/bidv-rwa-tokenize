'use server';

import { executeOrder, listOrders, placeOrder } from '@/lib/bank/purchase.service';

/**
 * Server actions cho luồng mua WPT — vỏ mỏng quanh `purchase.service`.
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
 * ⚠️ Service có BỐN hàm, tệp này chỉ có BA action — thiếu `expireStaleOrders`, và đó là chủ
 * đích chứ không phải bỏ sót. Dọn lệnh treo chỉ có MỘT đường vào: tiến trình theo lịch của
 * BE-07 gọi thẳng service. Server action cũng là một điểm vào HTTP, nên mở nó ở đây sẽ phá
 * đúng chủ đích đã ghi ở `app/src/app/api/purchase/route.ts` — mời gọi việc gọi tay giữa
 * lúc có lệnh đang xử lý.
 */

/**
 * @pending FE-05 | đã sẵn đầu cuối ở `placeOrder`: validate Zod, kiểm quyền `order:place` (vai INVESTOR), CHỐT số VNDB tại thời điểm đặt, lưu lệnh `PLACED`, ghi sổ kiểm toán. Màn mua WPT chỉ cần gọi và hiển thị `Result`
 */
export async function placeOrderAction(input: unknown) {
  return placeOrder(input);
}

/**
 * @pending FE-06 | đã sẵn đầu cuối ở `executeOrder`: kiểm quyền `order:execute` (vai BANK_ADMIN), bốn phép đọc trước khi gửi, khoá lạc quan chống gửi hai lần, đọc lại số dư từ chuỗi sau biên nhận
 */
export async function executeOrderAction(input: unknown) {
  return executeOrder(input);
}

/**
 * @pending FE-06 | đã sẵn đầu cuối ở `listOrders`: phân biệt `order:read` với `order:read:all`, nên "vai nào xem được sổ lệnh nào" là việc của RBAC chứ không phải của màn hình
 */
export async function listOrdersAction(input: unknown) {
  return listOrders(input);
}
