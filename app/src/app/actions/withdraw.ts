'use server';

import { checkPayoutWallet } from '@/lib/bank/payout-wallet';
import {
  cancelWithdrawRequest,
  continueWithdrawRequest,
  createWithdrawRequest,
  listMyWithdrawRequests,
  listWithdrawReviews,
  reconcileWithdrawRequests,
  resolveWithdrawRequest,
} from '@/lib/bank/withdraw.service';

/**
 * Server actions lệnh rút vault (BE-13): vỏ mỏng quanh `withdraw.service`. Quyền (`vault:withdraw`,
 * `vault:read`, `vault:reconcile`) kiểm TRONG service: server action gọi được bằng POST trực tiếp.
 */

export async function createWithdrawRequestAction(input: unknown) {
  return createWithdrawRequest(input);
}

/** FIX-01 G2: kiểm ví nhận trước khi mở hộp mã một lần; không chạy khi mở màn. */
export async function checkPayoutWalletAction(input: unknown) {
  return checkPayoutWallet(input);
}

/** FIX-01 G6: gửi rút cho lệnh đã đặt ví nhận (`PAYOUT_SET`). */
export async function continueWithdrawRequestAction(input: unknown) {
  return continueWithdrawRequest(input);
}

/** FIX-01 G6d: huỷ lệnh đã đặt ví nhận mà chưa gửi rút (`PAYOUT_SET`). */
export async function cancelWithdrawRequestAction(input: unknown) {
  return cancelWithdrawRequest(input);
}

export async function listMyWithdrawRequestsAction(input: unknown) {
  return listMyWithdrawRequests(input);
}

/**
 * Mở màn rút (QĐ-E): đối soát lệnh dở rồi đọc danh sách trong CÙNG một lượt gọi (HF-01).
 * Next xếp hàng server action nối tiếp, nên hai action riêng là hai lượt Worker chờ nhau.
 * Kết quả đối soát không dùng ở màn này, như trước; lỗi đối soát không chặn việc đọc danh sách.
 */
export async function reconcileAndListMyWithdrawRequestsAction(input: unknown) {
  await reconcileWithdrawRequests(input);
  return listMyWithdrawRequests(input);
}

export async function reconcileWithdrawRequestsAction(input: unknown) {
  return reconcileWithdrawRequests(input);
}

export async function listWithdrawReviewsAction(input: unknown) {
  return listWithdrawReviews(input);
}

export async function resolveWithdrawRequestAction(input: unknown) {
  return resolveWithdrawRequest(input);
}
