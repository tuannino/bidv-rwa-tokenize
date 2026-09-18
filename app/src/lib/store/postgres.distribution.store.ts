import 'server-only';

import type { ChainKey } from '@bidv/shared';
import {
  assertDistributionPayoutStatus,
  assertDistributionPeriodStatus,
  type DistributionPayoutRecord,
  type DistributionPayoutStatus,
  type DistributionPeriodRecord,
  type DistributionPeriodStatus,
  type IDistributionStore,
  type NewDistributionPeriod,
} from './distribution.store.port';
import { pgQuery, type PgQuery } from './postgres.pool';
import {
  assertAmount,
  assertBulkSize,
  assertNoDuplicateWallet,
  assertSnapshotId,
  mapPgConstraintError,
} from './store.errors';

/**
 * Kỳ chia + hồ sơ chia trong Postgres (`USE_MOCK_DB=false`).
 *
 * Mọi GIÁ TRỊ là tham số `$n`; chỉ tên cột được nội suy, và tên cột đến từ hằng số trong
 * mã nguồn này.
 */

interface PeriodRow {
  id: string;
  periodKey: string;
  snapshotId: number;
  totalAmount: string;
  totalSupplyAt: string;
  status: string;
  chain: string;
  openedAt: Date;
  completedAt: Date | null;
}

const toPeriod = (row: PeriodRow): DistributionPeriodRecord => ({
  id: row.id,
  periodKey: row.periodKey,
  snapshotId: row.snapshotId,
  totalAmount: row.totalAmount,
  totalSupplyAt: row.totalSupplyAt,
  status: row.status as DistributionPeriodStatus,
  chain: row.chain as ChainKey,
  openedAt: row.openedAt.toISOString(),
  completedAt: row.completedAt?.toISOString() ?? null,
});

interface PayoutRow {
  id: string;
  periodId: string;
  investorWallet: string;
  balanceAt: string;
  amount: string;
  status: string;
  txHash: string | null;
  batchNo: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const toPayout = (row: PayoutRow): DistributionPayoutRecord => ({
  id: row.id,
  periodId: row.periodId,
  investorWallet: row.investorWallet,
  balanceAt: row.balanceAt,
  amount: row.amount,
  status: row.status as DistributionPayoutStatus,
  txHash: row.txHash,
  batchNo: row.batchNo,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export function createPostgresDistributionStore(query: PgQuery = pgQuery): IDistributionStore {
  return {
    kind: 'prisma',

    async openPeriod(period: NewDistributionPeriod): Promise<DistributionPeriodRecord> {
      const rows = await mapPgConstraintError(() =>
        query<PeriodRow>(
          `INSERT INTO "DistributionPeriod"
             ("id","periodKey","snapshotId","totalAmount","totalSupplyAt","status","chain")
           VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6)
           RETURNING *`,
          [
            period.periodKey,
            assertSnapshotId(period.snapshotId),
            assertAmount('totalAmount', period.totalAmount),
            assertAmount('totalSupplyAt', period.totalSupplyAt),
            assertDistributionPeriodStatus(period.status ?? 'OPEN'),
            period.chain,
          ],
        ),
      );
      return toPeriod(rows[0]);
    },

    async findPeriod(id) {
      const rows = await query<PeriodRow>(`SELECT * FROM "DistributionPeriod" WHERE "id" = $1`, [
        id,
      ]);
      return rows[0] ? toPeriod(rows[0]) : null;
    },

    async findPeriodByKey(periodKey) {
      const rows = await query<PeriodRow>(
        `SELECT * FROM "DistributionPeriod" WHERE "periodKey" = $1`,
        [periodKey],
      );
      return rows[0] ? toPeriod(rows[0]) : null;
    },

    async listPeriods(options = {}) {
      const { chain, status, limit = 50 } = options;
      const rows = await query<PeriodRow>(
        `SELECT * FROM "DistributionPeriod"
          WHERE ($1::text IS NULL OR "chain" = $1)
            AND ($2::text IS NULL OR "status" = $2)
          ORDER BY "openedAt" DESC, "id" DESC
          LIMIT $3`,
        [chain ?? null, status ?? null, limit],
      );
      return rows.map(toPeriod);
    },

    async setPeriodStatus({ id, status, completedAt }) {
      const params: unknown[] = [id, assertDistributionPeriodStatus(status)];
      const sets = ['"status" = $2'];
      if (completedAt !== undefined) {
        params.push(completedAt);
        sets.push(`"completedAt" = $${params.length}::timestamptz`);
      }

      const rows = await query<PeriodRow>(
        `UPDATE "DistributionPeriod" SET ${sets.join(', ')} WHERE "id" = $1 RETURNING *`,
        params,
      );
      return rows[0] ? toPeriod(rows[0]) : null;
    },

    async createPayouts({ periodId, rows }) {
      assertBulkSize('rows', rows.length);
      assertNoDuplicateWallet(
        'DistributionPayout',
        'investorWallet',
        rows.map((row) => row.investorWallet),
      );

      // MỘT câu INSERT cho cả lô. Một câu lệnh là một đơn vị nguyên tử của Postgres, nên
      // một dòng vi phạm ràng buộc là CẢ LÔ không vào — đúng hợp đồng "tất cả hoặc không".
      const params: unknown[] = [];
      const tuples = rows.map((row) => {
        const at = params.length;
        params.push(
          periodId,
          row.investorWallet,
          assertAmount('balanceAt', row.balanceAt),
          assertAmount('amount', row.amount),
          assertDistributionPayoutStatus(row.status ?? 'PENDING'),
          row.batchNo ?? null,
        );
        return (
          `(gen_random_uuid()::text,$${at + 1},$${at + 2},$${at + 3},$${at + 4},$${at + 5},` +
          `$${at + 6}::integer,CURRENT_TIMESTAMP)`
        );
      });

      const inserted = await mapPgConstraintError(() =>
        query<PayoutRow>(
          `INSERT INTO "DistributionPayout"
             ("id","periodId","investorWallet","balanceAt","amount","status","batchNo","updatedAt")
           VALUES ${tuples.join(',')}
           RETURNING *`,
          params,
        ),
      );

      // Trả về theo ĐÚNG thứ tự đầu vào: `INSERT ... RETURNING` nhiều dòng không cam kết
      // thứ tự, và bản bộ nhớ thì trả theo thứ tự đầu vào. Hai bản phải giống nhau.
      const byWallet = new Map(inserted.map((row) => [row.investorWallet, toPayout(row)]));
      return rows.map((row) => {
        const record = byWallet.get(row.investorWallet);
        if (!record) {
          throw new Error(
            `INSERT không trả về dòng cho ví "${row.investorWallet}" — lược đồ và mã đã lệch nhau.`,
          );
        }
        return record;
      });
    },

    async markPayout({ periodId, investorWallet, status, txHash, batchNo }) {
      const params: unknown[] = [periodId, investorWallet, assertDistributionPayoutStatus(status)];
      const sets = ['"status" = $3', '"updatedAt" = CURRENT_TIMESTAMP'];
      if (txHash !== undefined) {
        params.push(txHash);
        sets.push(`"txHash" = $${params.length}`);
      }
      if (batchNo !== undefined) {
        params.push(batchNo);
        sets.push(`"batchNo" = $${params.length}::integer`);
      }

      // So khớp CHÍNH XÁC, không `lower()`: cặp cột này mang ràng buộc duy nhất, và ràng
      // buộc đó so chuỗi chính xác. Tra lỏng hơn ở đây là cập nhật một dòng mà ràng buộc
      // coi là dòng khác.
      const updated = await query<PayoutRow>(
        `UPDATE "DistributionPayout" SET ${sets.join(', ')}
          WHERE "periodId" = $1 AND "investorWallet" = $2
          RETURNING *`,
        params,
      );
      return updated[0] ? toPayout(updated[0]) : null;
    },

    async listPayouts(options = {}) {
      const { periodId, investorWallet, status, limit = 50 } = options;
      const found = await query<PayoutRow>(
        `SELECT * FROM "DistributionPayout"
          WHERE ($1::text IS NULL OR "periodId" = $1)
            AND ($2::text IS NULL OR lower("investorWallet") = lower($2))
            AND ($3::text IS NULL OR "status" = $3)
          ORDER BY "createdAt" DESC, "id" DESC
          LIMIT $4`,
        [periodId ?? null, investorWallet ?? null, status ?? null, limit],
      );
      return found.map(toPayout);
    },
  };
}
