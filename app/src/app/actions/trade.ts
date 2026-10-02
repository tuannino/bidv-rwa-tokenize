'use server';

import { getOrderDetail, getTradeContext, previewTrade } from '@/lib/bank/trade.service';

/**
 * Server actions cho hai màn của Nhà đầu tư (FE-25): vỏ mỏng quanh `trade.service`.
 *
 * Không kiểm quyền ở đây: server action gọi được bằng POST trực tiếp, nên quyền và lọc theo ví nằm
 * TRONG service, cùng lý do ghi ở `app/actions/purchase.ts`. Đặt lệnh và danh sách lệnh dùng lại
 * `placeOrderAction`, `listOrdersAction` của tệp đó, không có bản thứ hai.
 */

export async function getTradeContextAction(input: unknown) {
  return getTradeContext(input);
}

export async function previewTradeAction(input: unknown) {
  return previewTrade(input);
}

export async function getOrderDetailAction(input: unknown) {
  return getOrderDetail(input);
}
