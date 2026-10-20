'use server';

import {
  createWithdrawRequest,
  listMyWithdrawRequests,
  listWithdrawReviews,
  reconcileWithdrawRequests,
  resolveWithdrawRequest,
} from '@/lib/bank/withdraw.service';

/**
 * Server actions lệnh rút vault (BE-13) — vỏ mỏng quanh `withdraw.service`. Quyền (`vault:withdraw`,
 * `vault:read`, `vault:reconcile`) kiểm TRONG service: server action gọi được bằng POST trực tiếp.
 */

export async function createWithdrawRequestAction(input: unknown) {
  return createWithdrawRequest(input);
}

export async function listMyWithdrawRequestsAction(input: unknown) {
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
