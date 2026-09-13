import 'server-only';

import { privateKeyToAccount } from 'viem/accounts';
import type { Account, Hex } from 'viem';
import type { ChainKey } from '@bidv/shared';
import { signerPrivateKeyFor } from '@/lib/config/env';
import { SignerUnavailableError, type ISigner } from './signer.port';

/**
 * Signer của ngân hàng cho các thao tác đặc quyền (mint/whitelist/freeze/clawback).
 * Khóa nằm trong `SERVER_SIGNER_PRIVATE_KEY` và CHỈ được đọc ở file này.
 *
 * PoC dùng khóa dev trong `.env`. Phase 5 thay bằng Fireblocks — chỉ đổi factory.
 */
export function createServerSigner(chain: ChainKey = 'hardhat-local'): ISigner {
  let account: Account | undefined;

  const resolve = (): Account => {
    if (account) return account;
    // Khóa theo chain: role on-chain gắn với từng chain nên ví ký phải đúng chain.
    const key = signerPrivateKeyFor(chain);
    if (!key) {
      throw new SignerUnavailableError(
        'server',
        `Thiếu khóa ký cho chain "${chain}". Cách sửa: đặt SERVER_SIGNER_PRIVATE_KEY ` +
          `(dùng chung) hoặc SERVER_SIGNER_PRIVATE_KEY_${chain.replace(/-/g, '_').toUpperCase()} ` +
          `(riêng cho chain này) trong app/.env.local.`,
      );
    }
    account = privateKeyToAccount(key as Hex);
    return account;
  };

  return {
    kind: 'server',
    async getAddress() {
      return resolve().address;
    },
    async getAccount() {
      return resolve();
    },
  };
}
