import 'server-only';

import { randomUUID } from 'node:crypto';
import type { ChainKey } from '@bidv/shared';
import type {
  AuditRecord,
  IBankStore,
  NewAudit,
  NewOrder,
  NewTxn,
  OrderRecord,
  OrderTransition,
  TxnRecord,
} from './store.port';

/**
 * Lưu trữ trong bộ nhớ — mặc định, chạy được ở free-tier (không cần Postgres).
 * State đặt trên globalThis để không bị reset khi Next.js reload module giữa các request.
 */

interface MemoryState {
  txns: TxnRecord[];
  audit: AuditRecord[];
  orders: OrderRecord[];
}

const GLOBAL_KEY = '__bidvMemoryStore__';
const MAX_ROWS = 500; // chặn rò bộ nhớ nếu process sống lâu

function state(): MemoryState {
  const holder = globalThis as typeof globalThis & { [GLOBAL_KEY]?: MemoryState };
  holder[GLOBAL_KEY] ??= { txns: [], audit: [], orders: [] };
  return holder[GLOBAL_KEY];
}

export function resetMemoryStore(): void {
  const holder = globalThis as typeof globalThis & { [GLOBAL_KEY]?: MemoryState };
  delete holder[GLOBAL_KEY];
}

const sameWallet = (a: string | null, b: string) => a?.toLowerCase() === b.toLowerCase();

export function createMemoryStore(): IBankStore {
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

    // =========================================================================
    //  LỆNH MUA WPT
    // =========================================================================

    async createOrder(order: NewOrder): Promise<OrderRecord> {
      const now = new Date().toISOString();
      const record: OrderRecord = {
        ...order,
        id: randomUUID(),
        status: 'PLACED',
        txHash: null,
        reason: null,
        createdAt: now,
        updatedAt: now,
      };
      state().orders.unshift(record);
      state().orders.length = Math.min(state().orders.length, MAX_ROWS);
      // Trả BẢN COPY: người gọi giữ tham chiếu vào mảng nội bộ thì có thể sửa trạng thái
      // lệnh mà không đi qua `transitionOrder`, tức là đi vòng qua khoá lạc quan.
      return { ...record };
    },

    async findOrder(id) {
      const found = state().orders.find((order) => order.id === id);
      return found ? { ...found } : null;
    },

    /**
     * Mô phỏng ĐÚNG hành vi `UPDATE ... WHERE id = $1 AND status = ANY($2)` của bản
     * Postgres, kể cả việc trả `null` khi không dòng nào khớp (QĐ-1).
     *
     * Node chạy một luồng nên đoạn này không bị chen ngang giữa `find` và phép gán —
     * nhưng điều đó là hệ quả của môi trường, KHÔNG phải của thiết kế. Viết y như bản
     * Postgres để hai hiện thực không lệch hành vi: mock dễ tính hơn bản thật là loại
     * lỗi "xanh ở mock, đỏ ở chain thật" mà lớp store này phải ngăn.
     */
    async transitionOrder(transition: OrderTransition): Promise<OrderRecord | null> {
      const { id, from, to, txHash, reason } = transition;
      const found = state().orders.find((order) => order.id === id);
      if (!found) return null;
      if (!from.includes(found.status)) return null;

      found.status = to;
      if (txHash !== undefined) found.txHash = txHash;
      if (reason !== undefined) found.reason = reason;
      found.updatedAt = new Date().toISOString();
      return { ...found };
    },

    async attachOrderTxHash({ id, txHash }) {
      const found = state().orders.find((order) => order.id === id);
      if (!found || found.status !== 'EXECUTING') return null;
      found.txHash = txHash;
      found.updatedAt = new Date().toISOString();
      return { ...found };
    },

    async listOrders(options = {}) {
      const { chain, investorWallet, status, limit = 50 } = options;
      return state()
        .orders.filter((order) => (chain ? order.chain === chain : true))
        .filter((order) => (status ? order.status === status : true))
        .filter((order) => (investorWallet ? sameWallet(order.investorWallet, investorWallet) : true))
        .slice(0, limit)
        .map((order) => ({ ...order }));
    },

    async expireOrders({ createdBefore }) {
      const now = new Date().toISOString();
      let changed = 0;
      for (const order of state().orders) {
        // Chỉ PLACED: từ CHECKING trở đi đã có tiến trình đang xử lý.
        if (order.status !== 'PLACED') continue;
        if (order.createdAt >= createdBefore) continue;
        order.status = 'EXPIRED';
        order.reason = 'Quá hạn chưa khớp lệnh.';
        order.updatedAt = now;
        changed += 1;
      }
      return changed;
    },
  };
}
