'use server';

import {
  beginPaymentSend,
  cancelPaymentWithdraw,
  checkPaymentWithdrawTarget,
  createPaymentWithdraw,
  getPaymentWithdrawPage,
  submitPaymentWithdrawTx,
} from '@/lib/bank/payment-withdraw.service';

/**
 * Server actions rút VNDB của Nhà đầu tư (FE-23): vỏ mỏng quanh `payment-withdraw.service`. Quyền
 * `payment:withdraw` và chốt chặn ví của phiên kiểm TRONG service: server action gọi được bằng POST
 * trực tiếp.
 */

/** A5, A6: action DUY NHẤT khi mở màn: đối soát, số dư, danh sách lệnh của ví. */
export async function getPaymentWithdrawPageAction(input: unknown) {
  return getPaymentWithdrawPage(input);
}

/** A7: kiểm ví nhận trước khi mở hộp mã một lần. */
export async function checkPaymentWithdrawTargetAction(input: unknown) {
  return checkPaymentWithdrawTarget(input);
}

/** A1: tạo lệnh; không trả giao dịch, không chuyển tiền. */
export async function createPaymentWithdrawAction(input: unknown) {
  return createPaymentWithdraw(input);
}

/** A8: bắt đầu gửi; trả giao dịch cần gửi đúng một lần (mock: máy chủ chuyển thay). */
export async function beginPaymentSendAction(input: unknown) {
  return beginPaymentSend(input);
}

/** A2: trình duyệt báo mã giao dịch ví đã gửi. */
export async function submitPaymentWithdrawTxAction(input: unknown) {
  return submitPaymentWithdrawTx(input);
}

/** A3: huỷ lệnh chưa gửi, hoặc lệnh đã gửi tới ví mà quét không thấy giao dịch. */
export async function cancelPaymentWithdrawAction(input: unknown) {
  return cancelPaymentWithdraw(input);
}
