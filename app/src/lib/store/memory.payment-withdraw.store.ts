import 'server-only';

import { memoryState } from './memory.state';
import { assertAmount, UniqueConstraintError } from './store.errors';
import {
  activeWalletKey,
  assertPaymentWithdrawTransition,
  PAYMENT_WITHDRAW_PENDING_STATUSES,
  type IPaymentWithdrawStore,
  type PaymentWithdrawRecord,
} from './payment-withdraw.store.port';

/**
 * Lệnh rút VNDB của Nhà đầu tư trong bộ nhớ (FE-23).
 *
 * ⚠️ Phải NGHIÊM NGẶT NGANG bản Postgres: ba ràng buộc duy nhất `(chain, fromWalletKey,
 * clientRequestId)`, `activeWallet`, `(chain, completedTxHash)` và chuyển có điều kiện trạng thái.
 * Thân mỗi hàm chạy đồng bộ giữa hai lần `await`, nên kiểm và ghi là nguyên tử.
 */

const rows = (): PaymentWithdrawRecord[] => memoryState('paymentWithdraw', () => [] as PaymentWithdrawRecord[]);

const newestFirst = (a: PaymentWithdrawRecord, b: PaymentWithdrawRecord) =>
  b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);

export function createMemoryPaymentWithdrawStore(): IPaymentWithdrawStore {
  return {
    kind: 'memory',

    async create(input) {
      const all = rows();
      const fromWalletKey = input.fromWallet.toLowerCase();
      if (
        all.some(
          (row) =>
            row.chain === input.chain && row.fromWalletKey === fromWalletKey && row.clientRequestId === input.clientRequestId,
        )
      ) {
        throw new UniqueConstraintError('PaymentWithdrawRequest', ['chain', 'fromWalletKey', 'clientRequestId']);
      }
      const active = activeWalletKey(input.chain, input.fromWallet);
      if (all.some((row) => row.activeWallet === active)) {
        throw new UniqueConstraintError('PaymentWithdrawRequest', ['activeWallet']);
      }
      const now = new Date().toISOString();
      const record: PaymentWithdrawRecord = {
        id: input.id,
        chain: input.chain,
        clientRequestId: input.clientRequestId,
        actorId: input.actorId,
        fromWallet: input.fromWallet,
        fromWalletKey,
        toWallet: input.toWallet,
        amount: assertAmount('amount', input.amount),
        purpose: input.purpose,
        note: input.note,
        status: 'CREATED',
        activeWallet: active,
        createdBlock: input.createdBlock === null ? null : assertAmount('createdBlock', input.createdBlock),
        submittedTxHash: null,
        submittedAt: null,
        sendingAt: null,
        completedTxHash: null,
        reason: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      };
      all.push(record);
      return { ...record };
    },

    async findById(id) {
      const found = rows().find((row) => row.id === id);
      return found ? { ...found } : null;
    },

    async findByClientRequest({ chain, wallet, clientRequestId }) {
      const key = wallet.toLowerCase();
      const found = rows().find(
        (row) => row.chain === chain && row.fromWalletKey === key && row.clientRequestId === clientRequestId,
      );
      return found ? { ...found } : null;
    },

    async findActive(chain, wallet) {
      const found = rows().find((row) => row.activeWallet === activeWalletKey(chain, wallet));
      return found ? { ...found } : null;
    },

    async listByWallet(chain, wallet, { statuses, since, sentOnly, limit }) {
      const key = wallet.toLowerCase();
      const from = since?.toISOString();
      return rows()
        .filter((row) => row.chain === chain && row.fromWalletKey === key)
        .filter((row) => (statuses === undefined ? true : statuses.includes(row.status)))
        .filter((row) => (sentOnly || from !== undefined ? row.sendingAt !== null : true))
        .filter((row) => (from === undefined ? true : (row.sendingAt ?? '') >= from))
        .sort(newestFirst)
        .slice(0, limit)
        .map((row) => ({ ...row }));
    },

    async findByCompletedTx(chain, txHash) {
      const key = txHash.toLowerCase();
      const found = rows().find((row) => row.chain === chain && row.completedTxHash?.toLowerCase() === key);
      return found ? { ...found } : null;
    },

    async transition({ id, from, to, submittedTxHash, completedTxHash, reason }) {
      assertPaymentWithdrawTransition(from, to);
      const found = rows().find((row) => row.id === id);
      if (!found || found.status !== from) return null;
      if (
        completedTxHash !== undefined &&
        rows().some(
          (row) => row.id !== id && row.chain === found.chain && row.completedTxHash?.toLowerCase() === completedTxHash.toLowerCase(),
        )
      ) {
        throw new UniqueConstraintError('PaymentWithdrawRequest', ['chain', 'completedTxHash']);
      }
      const now = new Date().toISOString();
      found.status = to;
      if (submittedTxHash !== undefined) found.submittedTxHash = submittedTxHash;
      if (completedTxHash !== undefined) found.completedTxHash = completedTxHash;
      if (reason !== undefined) found.reason = reason;
      if (to === 'SENDING') found.sendingAt = now;
      if (to === 'SUBMITTED') found.submittedAt = now;
      if (!PAYMENT_WITHDRAW_PENDING_STATUSES.includes(to)) {
        found.activeWallet = null;
        found.completedAt = now;
      }
      found.updatedAt = now;
      return { ...found };
    },

    async noteReason({ id, reason }) {
      const found = rows().find((row) => row.id === id);
      if (!found) return;
      found.reason = reason;
      found.updatedAt = new Date().toISOString();
    },
  };
}
