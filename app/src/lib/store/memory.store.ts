import 'server-only';

import { randomUUID } from 'node:crypto';
import type { ChainKey } from '@bidv/shared';
import type {
  AuditRecord,
  ITxnStore,
  NewAudit,
  NewTxn,
  TxnRecord,
} from './store.port';

/**
 * Lưu trữ trong bộ nhớ — mặc định, chạy được ở free-tier (không cần Postgres).
 * State đặt trên globalThis để không bị reset khi Next.js reload module giữa các request.
 */

interface MemoryState {
  txns: TxnRecord[];
  audit: AuditRecord[];
}

const GLOBAL_KEY = '__bidvMemoryStore__';
const MAX_ROWS = 500; // chặn rò bộ nhớ nếu process sống lâu

function state(): MemoryState {
  const holder = globalThis as typeof globalThis & { [GLOBAL_KEY]?: MemoryState };
  holder[GLOBAL_KEY] ??= { txns: [], audit: [] };
  return holder[GLOBAL_KEY];
}

export function resetMemoryStore(): void {
  const holder = globalThis as typeof globalThis & { [GLOBAL_KEY]?: MemoryState };
  delete holder[GLOBAL_KEY];
}

const sameWallet = (a: string | null, b: string) => a?.toLowerCase() === b.toLowerCase();

export function createMemoryStore(): ITxnStore {
  return {
    kind: 'memory',

    async saveTxn(txn: NewTxn): Promise<TxnRecord> {
      const record: TxnRecord = { ...txn, id: randomUUID(), createdAt: new Date().toISOString() };
      state().txns.unshift(record);
      state().txns.length = Math.min(state().txns.length, MAX_ROWS);
      return record;
    },

    async updateTxnStatus(id, status, reason) {
      const found = state().txns.find((txn) => txn.id === id);
      if (!found) return;
      found.status = status;
      if (reason !== undefined) found.reason = reason;
    },

    async listTxns(options = {}) {
      const { chain, wallet, limit = 50 } = options;
      return state()
        .txns.filter((txn) => (chain ? txn.chain === (chain as ChainKey) : true))
        .filter((txn) =>
          wallet ? sameWallet(txn.toWallet, wallet) || sameWallet(txn.fromWallet, wallet) : true,
        )
        .slice(0, limit);
    },

    async appendAudit(entry: NewAudit): Promise<AuditRecord> {
      const record: AuditRecord = { ...entry, id: randomUUID(), createdAt: new Date().toISOString() };
      state().audit.unshift(record);
      state().audit.length = Math.min(state().audit.length, MAX_ROWS);
      return record;
    },

    async listAudit(options = {}) {
      return state().audit.slice(0, options.limit ?? 50);
    },
  };
}
