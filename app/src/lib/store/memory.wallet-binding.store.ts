import 'server-only';

import type { ChainKey } from '@bidv/shared';
import { memoryState } from './memory.state';
import { UniqueConstraintError } from './store.errors';
import type { IWalletBindingStore, WalletBindingRecord } from './wallet-binding.store.port';

/**
 * Ví đã gắn trong bộ nhớ. Nghiêm ngặt ngang bản Postgres: khoá `(chain, ví viết thường)`. Thân hàm
 * chạy đồng bộ giữa hai lần `await`, nên kiểm và ghi là nguyên tử.
 */

const rowKey = (chain: ChainKey, wallet: string) => `${chain}:${wallet.toLowerCase()}`;

const state = (): Map<string, WalletBindingRecord> =>
  memoryState('walletBinding', () => new Map<string, WalletBindingRecord>());

export function createMemoryWalletBindingStore(): IWalletBindingStore {
  return {
    kind: 'memory',

    async findByWallet(chain, wallet) {
      const row = state().get(rowKey(chain, wallet));
      return row ? { ...row } : null;
    },

    async list(chain, limit) {
      return [...state().values()]
        .filter((row) => row.chain === chain)
        .sort((a, b) => b.boundAt.localeCompare(a.boundAt) || a.wallet.localeCompare(b.wallet))
        .slice(0, limit)
        .map((row) => ({ ...row }));
    },

    async bind({ chain, wallet, actorId, boundBy }) {
      const rows = state();
      const key = rowKey(chain, wallet);
      const existing = rows.get(key);
      if (existing) {
        if (existing.actorId !== actorId) throw new UniqueConstraintError('WalletBinding', ['chain', 'walletKey']);
        return { record: { ...existing }, created: false };
      }
      const record: WalletBindingRecord = { chain, wallet, actorId, boundBy, boundAt: new Date().toISOString() };
      rows.set(key, record);
      return { record: { ...record }, created: true };
    },
  };
}
