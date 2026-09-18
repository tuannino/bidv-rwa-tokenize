import 'server-only';

import { randomUUID } from 'node:crypto';
import {
  assertDistributionPayoutStatus,
  assertDistributionPeriodStatus,
  type DistributionPayoutRecord,
  type DistributionPeriodRecord,
  type IDistributionStore,
  type NewDistributionPeriod,
} from './distribution.store.port';
import { memoryState } from './memory.state';
import {
  assertAmount,
  assertBulkSize,
  assertNoDuplicateWallet,
  assertSnapshotId,
  ForeignKeyError,
  UniqueConstraintError,
} from './store.errors';

/**
 * Kỳ chia + hồ sơ chia trong bộ nhớ.
 *
 * ⚠️ Bản này phải NGHIÊM NGẶT NGANG bản Postgres (BE-09 QĐ-3). Hai ràng buộc duy nhất phải
 * được kiểm ở đây bằng tay, vì bộ nhớ không có ràng buộc nào tự chạy:
 *   - `DistributionPeriod.periodKey`               → mở cùng một kỳ hai lần
 *   - `(DistributionPayout.periodId, investorWallet)` → chia trùng cho một nhà đầu tư
 */

interface DistributionState {
  periods: DistributionPeriodRecord[];
  payouts: DistributionPayoutRecord[];
}

const state = (): DistributionState =>
  memoryState('distribution', () => ({ periods: [], payouts: [] }));

const sameWallet = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

const newestPeriodFirst = (a: DistributionPeriodRecord, b: DistributionPeriodRecord) =>
  b.openedAt.localeCompare(a.openedAt) || b.id.localeCompare(a.id);

const newestPayoutFirst = (a: DistributionPayoutRecord, b: DistributionPayoutRecord) =>
  b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);

export function createMemoryDistributionStore(): IDistributionStore {
  return {
    kind: 'memory',

    async openPeriod(period: NewDistributionPeriod): Promise<DistributionPeriodRecord> {
      // Kiểm hết rồi mới ghi: một phép kiểm nằm sau `push` sẽ để lại kỳ nửa vời.
      const record: DistributionPeriodRecord = {
        id: randomUUID(),
        periodKey: period.periodKey,
        snapshotId: assertSnapshotId(period.snapshotId),
        totalAmount: assertAmount('totalAmount', period.totalAmount),
        totalSupplyAt: assertAmount('totalSupplyAt', period.totalSupplyAt),
        status: assertDistributionPeriodStatus(period.status ?? 'OPEN'),
        chain: period.chain,
        openedAt: new Date().toISOString(),
        completedAt: null,
      };

      if (state().periods.some((existing) => existing.periodKey === record.periodKey)) {
        throw new UniqueConstraintError(
          'DistributionPeriod',
          ['periodKey'],
          `Kỳ "${record.periodKey}" đã được mở.`,
        );
      }

      state().periods.push(record);
      return { ...record };
    },

    async findPeriod(id) {
      const found = state().periods.find((period) => period.id === id);
      return found ? { ...found } : null;
    },

    async findPeriodByKey(periodKey) {
      const found = state().periods.find((period) => period.periodKey === periodKey);
      return found ? { ...found } : null;
    },

    async listPeriods(options = {}) {
      const { chain, status, limit = 50 } = options;
      return state()
        .periods.filter((period) => (chain ? period.chain === chain : true))
        .filter((period) => (status ? period.status === status : true))
        .sort(newestPeriodFirst)
        .slice(0, limit)
        .map((period) => ({ ...period }));
    },

    async setPeriodStatus({ id, status, completedAt }) {
      const next = assertDistributionPeriodStatus(status);
      const found = state().periods.find((period) => period.id === id);
      if (!found) return null;

      found.status = next;
      if (completedAt !== undefined) found.completedAt = completedAt;
      return { ...found };
    },

    async createPayouts({ periodId, rows }) {
      assertBulkSize('rows', rows.length);
      assertNoDuplicateWallet(
        'DistributionPayout',
        'investorWallet',
        rows.map((row) => row.investorWallet),
      );

      const now = new Date().toISOString();
      const records: DistributionPayoutRecord[] = rows.map((row) => ({
        id: randomUUID(),
        periodId,
        investorWallet: row.investorWallet,
        balanceAt: assertAmount('balanceAt', row.balanceAt),
        amount: assertAmount('amount', row.amount),
        status: assertDistributionPayoutStatus(row.status ?? 'PENDING'),
        txHash: null,
        batchNo: row.batchNo ?? null,
        createdAt: now,
        updatedAt: now,
      }));

      // Kỳ phải tồn tại: bản Postgres có khoá ngoài `DistributionPayout_periodId_fkey`,
      // nên nhận hồ sơ trỏ vào kỳ không tồn tại ở đây là để bản bộ nhớ dễ tính hơn.
      if (!state().periods.some((period) => period.id === periodId)) {
        throw new ForeignKeyError(
          'DistributionPayout',
          'periodId',
          `Không có kỳ chia nào mang mã "${periodId}".`,
        );
      }

      // TẤT CẢ HOẶC KHÔNG: kiểm hết ràng buộc duy nhất trước, rồi mới ghi dòng đầu tiên.
      for (const record of records) {
        const clash = state().payouts.find(
          (payout) =>
            payout.periodId === record.periodId &&
            payout.investorWallet === record.investorWallet,
        );
        if (clash) {
          throw new UniqueConstraintError(
            'DistributionPayout',
            ['periodId', 'investorWallet'],
            `Ví "${record.investorWallet}" đã có hồ sơ chia trong kỳ này.`,
          );
        }
      }

      state().payouts.push(...records);
      return records.map((record) => ({ ...record }));
    },

    async markPayout({ periodId, investorWallet, status, txHash, batchNo }) {
      const next = assertDistributionPayoutStatus(status);
      // Khớp CHÍNH XÁC như ràng buộc duy nhất của Postgres, không hạ hoa thường: hai cách
      // viết của một địa chỉ là hai dòng khác nhau với cơ sở dữ liệu, nên tra lỏng hơn ở
      // đây sẽ cập nhật một dòng mà bản Postgres không cập nhật.
      const found = state().payouts.find(
        (payout) => payout.periodId === periodId && payout.investorWallet === investorWallet,
      );
      if (!found) return null;

      found.status = next;
      if (txHash !== undefined) found.txHash = txHash;
      if (batchNo !== undefined) found.batchNo = batchNo;
      found.updatedAt = new Date().toISOString();
      return { ...found };
    },

    async listPayouts(options = {}) {
      const { periodId, investorWallet, status, limit = 50 } = options;
      return state()
        .payouts.filter((payout) => (periodId ? payout.periodId === periodId : true))
        .filter((payout) =>
          investorWallet ? sameWallet(payout.investorWallet, investorWallet) : true,
        )
        .filter((payout) => (status ? payout.status === status : true))
        .sort(newestPayoutFirst)
        .slice(0, limit)
        .map((payout) => ({ ...payout }));
    },
  };
}
