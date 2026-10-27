import 'server-only';

import { PUBLIC_SAMPLE_WALLETS, type ChainKey } from '@bidv/shared';
import { can, type Action, type Role } from '@/lib/rbac';
import { currentActorId } from '@/lib/rbac/session';
import { getStore, getWalletBindingStore } from '@/lib/store';
import { findCustomerProfile, listCustomerProfiles, type CustomerAccountProfile } from './account-profile.service';

/**
 * CHỦ SỞ HỮU VÍ (FIX-01 QĐ-2, QĐ-3): một hàm duy nhất trả lời "ví này thuộc hồ sơ nào trên chain
 * này", và chốt chặn "ví đang dùng phải thuộc hồ sơ của phiên" cho mọi phép đọc, ghi dữ liệu tài
 * khoản của Nhà đầu tư, Người bán.
 *
 * Nguồn: ví Giao dịch viên đã gắn (`WalletBinding`); không có thì ví mẫu của hồ sơ, CHỈ trên hai chain
 * thử nghiệm. Bảng ví người dùng tự khai trước đây (OP-05) không còn được đọc.
 */

/** Chain thử nghiệm: ví mẫu của hồ sơ được coi là đã định danh dù không có trong bảng gắn ví. */
export const SAMPLE_WALLET_CHAINS: readonly ChainKey[] = ['mock', 'hardhat-local'];

export const usesSampleWallets = (chain: ChainKey): boolean => SAMPLE_WALLET_CHAINS.includes(chain);

/** Ví mẫu công khai của Hardhat (khoá riêng ai cũng biết). So với danh sách có sẵn, không lập danh sách mới. */
export function isPublicSampleWallet(wallet: string): boolean {
  const key = wallet.toLowerCase();
  return PUBLIC_SAMPLE_WALLETS.some((sample) => sample.toLowerCase() === key);
}

/**
 * Vai khách hàng (Nhà đầu tư, Người bán) giữ ví của chính mình. Quyết định bằng bảng quyền
 * (`wallet:connect`), không so tên vai.
 */
export const holdsOwnWallet = (role: Role): boolean => can(role, 'wallet:connect');

export const WALLET_NOT_BOUND_MESSAGE = 'Ví chưa được định danh';

/** Ví đang dùng không thuộc hồ sơ của phiên. `toResult` chuyển sang mã `WALLET_NOT_BOUND`. */
export class WalletNotBoundError extends Error {
  constructor() {
    super(WALLET_NOT_BOUND_MESSAGE);
    this.name = 'WalletNotBoundError';
  }
}

/** Hồ sơ khách hàng sở hữu ví trên chain, `null` khi không ai (QĐ-2). */
export async function resolveWalletOwner(chain: ChainKey, wallet: string): Promise<CustomerAccountProfile | null> {
  const binding = await getWalletBindingStore().findByWallet(chain, wallet);
  if (binding) return findCustomerProfile(binding.actorId);
  if (!usesSampleWallets(chain)) return null;
  const key = wallet.toLowerCase();
  return listCustomerProfiles().find((profile) => profile.wallet.toLowerCase() === key) ?? null;
}

/**
 * Chốt chặn ví của phiên (QĐ-3). Vai nhân viên không bị chặn ở đây (họ đọc theo quyền `*:read:all`).
 * Ví chưa gắn và ví của hồ sơ khác cùng một câu, không lộ ví thuộc ai. Có `audit` thì ghi `DENIED`
 * trước khi ném; hàm cố ý không ghi sổ (dùng `assertCan`) thì không truyền.
 *
 * Người gọi `await` hàm này XONG rồi mới đọc chuỗi hay database khác (không đưa vào `Promise.all`).
 */
export async function assertOwnWallet(input: {
  role: Role;
  actorId: string;
  chain: ChainKey;
  wallet: string;
  audit?: { action: Action };
}): Promise<void> {
  if (!holdsOwnWallet(input.role)) return;
  const owner = await resolveWalletOwner(input.chain, input.wallet);
  if (owner?.actorId === input.actorId) return;
  if (input.audit) {
    await getStore().appendAudit({
      actorRole: input.role,
      action: input.audit.action,
      target: input.wallet,
      outcome: 'DENIED',
      detail: WALLET_NOT_BOUND_MESSAGE,
      chain: input.chain,
    });
  }
  throw new WalletNotBoundError();
}

/**
 * `assertOwnWallet` cho hồ sơ của CHÍNH phiên: mã hồ sơ lấy từ phiên, không nhận từ trình duyệt.
 * Vai nhân viên trả ngay, không đọc phiên.
 */
export async function assertSessionWallet(input: {
  role: Role;
  chain: ChainKey;
  wallet: string;
  audit?: { action: Action };
}): Promise<void> {
  if (!holdsOwnWallet(input.role)) return;
  await assertOwnWallet({ ...input, actorId: await currentActorId(input.role) });
}
