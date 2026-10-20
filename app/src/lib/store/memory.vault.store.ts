import 'server-only';

import type { ChainKey } from '@bidv/shared';
import { memoryState } from './memory.state';
import {
  assertVaultOperationKind,
  type IVaultStore,
  type VaultOperationLockRecord,
} from './vault.store.port';

/**
 * Vận hành vault trong bộ nhớ.
 *
 * ⚠️ Phải NGHIÊM NGẶT NGANG bản Postgres (BE-09 QĐ-3): một khoá mỗi chain, chỉ tiếp quản khoá
 * `CONFIG` treo quá hạn. Dễ tính hơn ở đây thì mọi ca "hai thao tác song song" chạy trên bản bộ nhớ
 * đều xanh vô nghĩa. Thân mỗi hàm chạy đồng bộ giữa hai lần `await`, nên kiểm và ghi là nguyên tử.
 */

interface VaultState {
  locks: Map<ChainKey, VaultOperationLockRecord>;
}

const state = (): VaultState => memoryState('vault', () => ({ locks: new Map() }));

export function createMemoryVaultStore(): IVaultStore {
  return {
    kind: 'memory',

    async acquireOperationLock({ chain, kind, refId, actor, takeOverConfigBefore }) {
      const locks = state().locks;
      const held = locks.get(chain);
      const stale =
        held !== undefined &&
        kind === 'CONFIG' &&
        held.kind === 'CONFIG' &&
        takeOverConfigBefore !== undefined &&
        held.acquiredAt < takeOverConfigBefore.toISOString();
      if (held && !stale) return null;
      const record: VaultOperationLockRecord = {
        chain,
        kind: assertVaultOperationKind(kind),
        refId,
        actor,
        acquiredAt: new Date().toISOString(),
      };
      locks.set(chain, record);
      return { ...record };
    },

    async releaseOperationLock({ chain, refId }) {
      const locks = state().locks;
      if (locks.get(chain)?.refId !== refId) return false;
      locks.delete(chain);
      return true;
    },

    async findOperationLock(chain) {
      const held = state().locks.get(chain);
      return held ? { ...held } : null;
    },
  };
}
