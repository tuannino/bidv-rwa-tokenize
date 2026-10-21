'use server';

import { getProfileWallet, linkProfileWallet } from '@/lib/bank/account-profile.service';

/**
 * Ví liên kết vào hồ sơ (OP-05 QĐ-I): vỏ mỏng quanh service. Kiểm quyền, lấy hồ sơ từ phiên và ghi
 * sổ kiểm toán nằm TRONG service, vì server action gọi được bằng POST trực tiếp.
 */

export async function getProfileWalletAction(input: unknown) {
  return getProfileWallet(input);
}

export async function linkProfileWalletAction(input: unknown) {
  return linkProfileWallet(input);
}
