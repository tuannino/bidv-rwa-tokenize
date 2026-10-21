import 'server-only';

import type { ChainKey } from '@bidv/shared';
import { memoryState } from './memory.state';
import type { IProfileWalletStore, ProfileWalletRecord } from './profile-wallet.store.port';
import { UniqueConstraintError } from './store.errors';

/**
 * Ví liên kết trong bộ nhớ. Nghiêm ngặt ngang bản Postgres: khoá `(actorId, chain)` và duy nhất
 * `(chain, ví viết thường)`. Thân hàm chạy đồng bộ giữa hai lần `await`, nên kiểm và ghi là nguyên tử.
 */

const rowKey = (actorId: string, chain: ChainKey) => `${chain}:${actorId}`;

const state = (): Map<string, ProfileWalletRecord> =>
  memoryState('profileWallet', () => new Map<string, ProfileWalletRecord>());

export function createMemoryProfileWalletStore(): IProfileWalletStore {
  return {
    kind: 'memory',

    async findByActor(actorId, chain) {
      const row = state().get(rowKey(actorId, chain));
      return row ? { ...row } : null;
    },

    async findByWallet(chain, wallet) {
      const key = wallet.toLowerCase();
      const row = [...state().values()].find((r) => r.chain === chain && r.wallet.toLowerCase() === key);
      return row ? { ...row } : null;
    },

    async link({ actorId, chain, wallet, updatedBy }) {
      const rows = state();
      const key = wallet.toLowerCase();
      const taken = [...rows.values()].some(
        (r) => r.chain === chain && r.actorId !== actorId && r.wallet.toLowerCase() === key,
      );
      if (taken) throw new UniqueConstraintError('ProfileWallet', ['chain', 'walletKey']);
      const previous = rows.get(rowKey(actorId, chain))?.wallet ?? null;
      const record: ProfileWalletRecord = { actorId, chain, wallet, updatedBy, updatedAt: new Date().toISOString() };
      rows.set(rowKey(actorId, chain), record);
      return { previous, record: { ...record } };
    },
  };
}
