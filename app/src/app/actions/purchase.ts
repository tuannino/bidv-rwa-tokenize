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

export async function placeOrderAction(input: unknown) {
  return placeOrder(input);
}

export async function executeOrderAction(input: unknown) {
  return executeOrder(input);
}

export async function listOrdersAction(input: unknown) {
  return listOrders(input);
}

export async function expireStaleOrdersAction(input: unknown) {
  return expireStaleOrders(input);
}
