'use server';

import { getOpsOrderDetail, listOpsOrders } from '@/lib/bank/ops-transactions.service';

/**
 * Server action cho màn Giao dịch của hai vai vận hành (FE-06): vỏ mỏng quanh
 * `ops-transactions.service`. Khớp lệnh dùng lại `executeOrderAction` (`app/actions/purchase.ts`),
 * chi tiết lệnh dùng lại view-model FE-25 sau lớp guard vận hành, không có bản trình bày thứ hai.
 */
export async function listOpsOrdersAction(input: unknown) {
  return listOpsOrders(input);
}

export async function getOpsOrderDetailAction(input: unknown) {
  return getOpsOrderDetail(input);
}
