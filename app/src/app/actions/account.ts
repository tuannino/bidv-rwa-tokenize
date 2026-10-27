'use server';

import { getAccountWallet } from '@/lib/bank/account-profile.service';

/**
 * Ví thanh toán trên màn tài khoản (FIX-01 F3): vỏ mỏng quanh service. Kiểm quyền và lấy hồ sơ từ
 * phiên nằm TRONG service, vì server action gọi được bằng POST trực tiếp. Không còn action ghi ví:
 * chỉ Giao dịch viên gắn ví cho hồ sơ (`actions/wallet-binding.ts`).
 */

export async function getAccountWalletAction(input: unknown) {
  return getAccountWallet(input);
}
