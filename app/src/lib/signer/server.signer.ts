import 'server-only';

import { privateKeyToAccount } from 'viem/accounts';
import type { Account, Hex } from 'viem';
import { serverEnv } from '@/lib/config/env';
import { SignerUnavailableError, type ISigner } from './signer.port';

/**
 * Signer của ngân hàng cho các thao tác đặc quyền (mint/whitelist/freeze/clawback).
 * Khóa nằm trong `SERVER_SIGNER_PRIVATE_KEY` và CHỈ được đọc ở file này.
 *
 * PoC dùng khóa dev trong `.env`. Phase 5 thay bằng Fireblocks — chỉ đổi factory.
 */
export function createServerSigner(): ISigner {
  let account: Account | undefined;

  const resolve = (): Account => {
    if (account) return account;
    const key = serverEnv().serverSignerPrivateKey;
    if (!key) {
      throw new SignerUnavailableError(
        'server',
        'Thiếu SERVER_SIGNER_PRIVATE_KEY. Cách sửa: copy .env.example -> .env ' +
          '(khóa test Hardhat account #0 đã có sẵn trong đó).',
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
