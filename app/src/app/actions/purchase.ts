'use server';

import {
  executeOrder,
  expireStaleOrders,
  listOrders,
  placeOrder,
} from '@/lib/bank/purchase.service';

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

/**
 * KHÔNG có marker điểm cắm ở đây, và đó là câu hỏi mở chứ không phải bỏ sót.
 *
 * `expireStaleOrders` trong service đã mang `@pending BE-07` (tiến trình gọi theo lịch).
 * Nhưng BE-07 chạy ở phía máy chủ nên nó gọi THẲNG service, không cần đi qua server action
 * này. Còn `app/api/purchase/route.ts` thì nói rõ là CỐ Ý không mở điểm vào HTTP cho việc
 * dọn lệnh treo — mà server action cũng là một điểm vào HTTP. Hai điều đó không khớp nhau,
 * nên chưa rõ ai sẽ gọi hàm này: BE-07, một nút ở màn quản trị, hay không ai cả.
 * Xem mục "Câu hỏi mở" trong `docs/CHECKPOINT_MC01.md`.
 */
export async function expireStaleOrdersAction(input: unknown) {
  return expireStaleOrders(input);
}
