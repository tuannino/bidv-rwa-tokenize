import 'server-only';

import type { ChainKey } from '@bidv/shared';
import { createFireblocksSigner } from './fireblocks.signer.stub';
import { createServerSigner } from './server.signer';
import type { ISigner, SignerKind } from './signer.port';

export { SignerUnavailableError, type ISigner, type SignerKind } from './signer.port';
export { createWalletSigner } from './wallet.signer';

/**
 * Cache theo (kind, chain), KHÔNG chỉ theo kind.
 *
 * Role on-chain gắn với từng chain, nên mỗi chain có thể dùng ví khác. Cache chỉ theo kind
 * sẽ trả về ví của chain gọi trước đó -> contract revert AccessControlUnauthorizedAccount,
 * và lỗi này chỉ xuất hiện sau khi đổi chain nên rất khó truy.
 */
const cache = new Map<string, ISigner>();

/**
 * Factory cho signer dùng ở SERVER. Đổi custody = đổi nhánh ở đây.
 * `wallet` không có trong danh sách vì ví chỉ tồn tại ở client
 * (import `createWalletSigner` trực tiếp từ Client Component).
 */
export function getSigner(
  kind: Exclude<SignerKind, 'wallet'> = 'server',
  chain: ChainKey = 'hardhat-local',
): ISigner {
  const cacheKey = `${kind}:${chain}`;
  const existing = cache.get(cacheKey);
  if (existing) return existing;

  const signer = kind === 'fireblocks' ? createFireblocksSigner() : createServerSigner(chain);
  cache.set(cacheKey, signer);
  return signer;
}

/** Signer đặc quyền ngân hàng (mint/whitelist/freeze/clawback) cho một chain cụ thể. */
export function getBankSigner(chain: ChainKey = 'hardhat-local'): ISigner {
  const kind = process.env.SIGNER_KIND === 'fireblocks' ? 'fireblocks' : 'server';
  return getSigner(kind, chain);
}

/** Chỉ dùng trong test sau khi đổi env. */
export function resetSignerCache(): void {
  cache.clear();
}
