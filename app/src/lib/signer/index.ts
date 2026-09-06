import 'server-only';

import { createFireblocksSigner } from './fireblocks.signer.stub';
import { createServerSigner } from './server.signer';
import type { ISigner, SignerKind } from './signer.port';

export { SignerUnavailableError, type ISigner, type SignerKind } from './signer.port';
export { createWalletSigner } from './wallet.signer';

const cache = new Map<SignerKind, ISigner>();

/**
 * Factory cho signer dùng ở SERVER. Đổi custody = đổi nhánh ở đây.
 * `wallet` không có trong danh sách vì ví chỉ tồn tại ở client
 * (import `createWalletSigner` trực tiếp từ Client Component).
 */
export function getSigner(kind: Exclude<SignerKind, 'wallet'> = 'server'): ISigner {
  const existing = cache.get(kind);
  if (existing) return existing;

  const signer = kind === 'fireblocks' ? createFireblocksSigner() : createServerSigner();
  cache.set(kind, signer);
  return signer;
}

/** Signer đặc quyền ngân hàng (mint/whitelist/freeze/clawback). */
export function getBankSigner(): ISigner {
  const kind = process.env.SIGNER_KIND === 'fireblocks' ? 'fireblocks' : 'server';
  return getSigner(kind);
}
