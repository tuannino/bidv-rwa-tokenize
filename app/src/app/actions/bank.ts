'use server';

import type { ChainKey } from '@bidv/shared';
import {
  listTransactions,
  mintTokens,
  onboardInvestor,
  readBalance,
  tokenOverview,
} from '@/lib/bank/mint.service';

/**
 * Server actions cho UI — vỏ mỏng quanh `mint.service`.
 *
 * ⚠️ Server action gọi được bằng POST trực tiếp, không chỉ qua UI
 * (node_modules/next/dist/docs/.../07-mutating-data.md). Vì vậy kiểm quyền nằm
 * TRONG service, không nằm ở component gọi nó.
 */

export async function onboardInvestorAction(input: unknown) {
  return onboardInvestor(input);
}

export async function mintAction(input: unknown) {
  return mintTokens(input);
}

export async function readBalanceAction(input: unknown) {
  return readBalance(input);
}

export async function listTransactionsAction(input: unknown) {
  return listTransactions(input);
}

export async function tokenOverviewAction(chain: ChainKey) {
  return tokenOverview(chain);
}
