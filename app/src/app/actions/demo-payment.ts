'use server';

import { demoPaymentContext, mintDemoPayment } from '@/lib/bank/demo-payment.service';

/**
 * Server actions cho màn Nạp VNDB mô phỏng (BE-16): vỏ mỏng quanh `demo-payment.service`.
 *
 * Không kiểm quyền hay cờ ở đây: server action gọi được bằng POST trực tiếp, nên hai lớp chặn nằm
 * TRONG service.
 */

export async function mintDemoPaymentAction(input: unknown) {
  return mintDemoPayment(input);
}

export async function demoPaymentContextAction(input: unknown) {
  return demoPaymentContext(input);
}
