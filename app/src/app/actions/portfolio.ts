'use server';

import {
  getPortfolio,
  getTokenSummary,
  getWalletTransactions,
} from '@/lib/bank/portfolio.service';

/**
 * Server actions cho kênh nhà đầu tư — vỏ mỏng quanh `portfolio.service`.
 *
 * ⚠️ Server action gọi được bằng POST trực tiếp, không chỉ qua UI. Vì vậy kiểm quyền
 * (`portfolio:read`) và lọc theo ví nằm TRONG service, không nằm ở component gọi nó.
 *
 * Đây cũng là cầu duy nhất để lấy số dư on-chain vào giao diện: `balanceOf` là server-only,
 * còn địa chỉ ví chỉ có ở client (wagmi). Component KHÔNG nhập `viem`/`ethers`.
 */

export async function getPortfolioAction(input: unknown) {
  return getPortfolio(input);
}

export async function getWalletTransactionsAction(input: unknown) {
  return getWalletTransactions(input);
}

export async function getTokenSummaryAction(chain: unknown) {
  return getTokenSummary(chain);
}
