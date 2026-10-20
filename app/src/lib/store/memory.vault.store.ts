import 'server-only';

import type { ChainKey } from '@bidv/shared';
import { memoryState } from './memory.state';
import { assertAmount, UniqueConstraintError } from './store.errors';
import {
  assertVaultOperationKind,
  assertWithdrawTransition,
  WITHDRAW_TERMINAL_STATUSES,
  type IVaultStore,
  type VaultOperationLockRecord,
  type WithdrawRequestRecord,
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
  withdrawals: WithdrawRequestRecord[];
}

const state = (): VaultState => memoryState('vault', () => ({ locks: new Map(), withdrawals: [] }));

const newestFirst = (a: WithdrawRequestRecord, b: WithdrawRequestRecord) =>
  b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);

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

    // Ba ràng buộc duy nhất như Postgres: `(chain, clientRequestId)`, `activeChain`, `txHash`.
    async createWithdrawRequest(input) {
      const rows = state().withdrawals;
      if (rows.some((row) => row.chain === input.chain && row.clientRequestId === input.clientRequestId)) {
        throw new UniqueConstraintError('WithdrawRequest', ['chain', 'clientRequestId']);
      }
      if (rows.some((row) => row.activeChain === input.chain)) {
        throw new UniqueConstraintError('WithdrawRequest', ['activeChain']);
      }
      const now = new Date().toISOString();
      const record: WithdrawRequestRecord = {
        id: input.id,
        chain: input.chain,
        clientRequestId: input.clientRequestId,
        amount: assertAmount('amount', input.amount),
        purpose: input.purpose,
        note: input.note,
        payoutWallet: input.payoutWallet,
        status: 'SENDING',
        activeChain: input.chain,
        claimedBlock: input.claimedBlock === null ? null : assertAmount('claimedBlock', input.claimedBlock),
        txHash: null,
        reason: null,
        createdBy: input.createdBy,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      };
      rows.push(record);
      return { ...record };
    },

    async findWithdrawRequest(id) {
      const found = state().withdrawals.find((row) => row.id === id);
      return found ? { ...found } : null;
    },

    async findWithdrawByClientRequest({ chain, clientRequestId }) {
      const found = state().withdrawals.find((row) => row.chain === chain && row.clientRequestId === clientRequestId);
      return found ? { ...found } : null;
    },

    async findWithdrawByTxHash(txHash) {
      const found = state().withdrawals.find((row) => row.txHash === txHash);
      return found ? { ...found } : null;
    },

    async transitionWithdrawRequest({ id, from, to, txHash, reason }) {
      assertWithdrawTransition(from, to);
      const found = state().withdrawals.find((row) => row.id === id);
      if (!found || found.status !== from) return null;
      if (txHash !== undefined && state().withdrawals.some((row) => row.id !== id && row.txHash === txHash)) {
        throw new UniqueConstraintError('WithdrawRequest', ['txHash']);
      }
      const now = new Date().toISOString();
      found.status = to;
      if (txHash !== undefined) found.txHash = txHash;
      if (reason !== undefined) found.reason = reason;
      if (WITHDRAW_TERMINAL_STATUSES.includes(to)) {
        found.activeChain = null;
        found.completedAt = now;
      }
      found.updatedAt = now;
      return { ...found };
    },

    async listWithdrawRequests({ chain, createdBy, statuses, limit = 50 }) {
      return state()
        .withdrawals.filter((row) => row.chain === chain)
        .filter((row) => (createdBy === undefined ? true : row.createdBy === createdBy))
        .filter((row) => (statuses === undefined ? true : statuses.includes(row.status)))
        .sort(newestFirst)
        .slice(0, limit)
        .map((row) => ({ ...row }));
    },
  };
}
