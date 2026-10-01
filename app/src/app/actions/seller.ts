'use server';

import { getSellerOverview, listSellerTransactions } from '@/lib/bank/seller.service';

/**
 * Server actions cho kênh Người bán (FE-21) — vỏ mỏng quanh `seller.service`.
 *
 * Kiểm quyền `seller:read` nằm TRONG service: server action gọi được bằng POST trực tiếp.
 */

export async function getSellerOverviewAction(input: unknown) {
  return getSellerOverview(input);
}

export async function listSellerTransactionsAction(input: unknown) {
  return listSellerTransactions(input);
}
