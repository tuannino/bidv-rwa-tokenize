import 'server-only';

import { z } from 'zod';
import type { ChainKey } from '@bidv/shared';
import { getLedger, InvalidAddressError, normalizeEvmAddress } from '@/lib/ledger';
import { assertCan } from '@/lib/rbac';
import { currentRole } from '@/lib/rbac/session';
import { toResult } from './authorize';
import { err, ok, type Result } from './result';
import { chainSchema } from './schemas';
import { isPublicSampleWallet, usesSampleWallets } from './wallet-owner';

/**
 * VÍ NHẬN TIỀN RÚT do Người bán chọn ở lệnh rút (FIX-01 QĐ-6, G2, G5). Ví nhận KHÔNG bắt buộc đã gắn
 * cho hồ sơ Người bán: chỉ cần đúng dạng, khác địa chỉ 0, khác địa chỉ vault, không phải ví mẫu công
 * khai trên chain thật, và đã whitelist. Hai hàm thuần dưới đây dùng chung cho kiểm trước hộp mã một
 * lần (`checkPayoutWallet`) và cho `createWithdrawRequest`, nên hai nơi không lệch luật.
 */

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const PAYOUT_NOT_WHITELISTED = 'Ví nhận chưa whitelist trên chuỗi.';

/** G5 bước 2: lỗi DẠNG ví nhận, `null` khi đạt. Không đọc chuỗi. */
export function payoutWalletFormatError(input: { chain: ChainKey; wallet: string }): string | null {
  let wallet: string;
  try {
    wallet = normalizeEvmAddress(input.wallet);
  } catch (error) {
    if (error instanceof InvalidAddressError) return 'Ví nhận không phải địa chỉ hợp lệ (0x + 40 ký tự hex).';
    throw error;
  }
  if (wallet.toLowerCase() === ZERO_ADDRESS) return 'Ví nhận không được là địa chỉ 0.';
  if (!usesSampleWallets(input.chain) && isPublicSampleWallet(wallet)) {
    return 'Ví nhận là ví mẫu công khai của Hardhat, không dùng được trên chain thật.';
  }
  return null;
}

/** Phần ví của G5 bước 5: chain phải có vault và ví nhận khác địa chỉ vault. `null` khi đạt. */
export function payoutWalletVaultError(input: { wallet: string; vault: string | null }): string | null {
  if (!input.vault) return 'Chain này không có vault thanh toán SPV để rút.';
  if (input.wallet.toLowerCase() === input.vault.toLowerCase()) return 'Ví nhận phải khác địa chỉ vault.';
  return null;
}

const checkPayoutWalletSchema = z.object({ chain: chainSchema, wallet: z.string().trim().max(80) });

/**
 * Kiểm ví nhận TRƯỚC khi mở hộp mã một lần (G2). Quyền `vault:withdraw` kiểm bằng `assertCan`, không
 * ghi sổ kiểm toán (lần ghi sổ có ý nghĩa là lần tạo lệnh ngay sau đó). Không kiểm tạm dừng hay số
 * tiền: `createWithdrawRequest` kiểm lại toàn bộ trong khoá.
 */
export async function checkPayoutWallet(input: unknown): Promise<Result<{ wallet: string }>> {
  const parsed = checkPayoutWalletSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  const { chain } = parsed.data;
  const reject = (message: string) => err<{ wallet: string }>('VALIDATION', message, { payoutWallet: [message] });
  try {
    assertCan(await currentRole(), 'vault:withdraw');
    const formatError = payoutWalletFormatError({ chain, wallet: parsed.data.wallet });
    if (formatError) return reject(formatError);
    const wallet = normalizeEvmAddress(parsed.data.wallet);
    const ledger = getLedger(chain);
    const status = await ledger.vaultStatus();
    const vaultError = payoutWalletVaultError({ wallet, vault: status?.address ?? null });
    if (vaultError) return reject(vaultError);
    if (!(await ledger.isWhitelisted(wallet))) return reject(PAYOUT_NOT_WHITELISTED);
    return ok({ wallet });
  } catch (error) {
    return toResult(error);
  }
}
