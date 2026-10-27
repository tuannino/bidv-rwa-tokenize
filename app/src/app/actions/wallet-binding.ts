'use server';

import { bindProfileWallet, listWalletBindings } from '@/lib/bank/wallet-binding.service';

/**
 * Định danh ví (FIX-01 A1, A2): vỏ mỏng quanh service. Kiểm quyền và ghi sổ kiểm toán nằm TRONG
 * service, vì server action gọi được bằng POST trực tiếp.
 */

export async function bindProfileWalletAction(input: unknown) {
  return bindProfileWallet(input);
}

export async function listWalletBindingsAction(input: unknown) {
  return listWalletBindings(input);
}
