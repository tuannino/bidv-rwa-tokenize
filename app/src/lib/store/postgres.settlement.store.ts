import 'server-only';

import type { ChainKey } from '@bidv/shared';
import { pgQuery, type PgQuery } from './postgres.pool';
import {
  assertSettlementCaseStatus,
  assertSettlementRoundStatus,
  SETTLEMENT_CASE_COLUMNS,
  type ISettlementStore,
  type NewSettlementRound,
  type SettlementCaseRecord,
  type SettlementCaseStatus,
  type SettlementRoundRecord,
  type SettlementRoundStatus,
} from './settlement.store.port';
import {
  assertAmount,
  assertBulkSize,
  assertNoDuplicateWallet,
  assertSnapshotId,
  mapPgConstraintError,
  StoreUsageError,
} from './store.errors';

/**
 * Đợt tất toán + hồ sơ người nắm giữ trong Postgres (`USE_MOCK_DB=false`).
 *
 * Mọi GIÁ TRỊ là tham số `$n`. Tên cột thời điểm và cột mã giao dịch lấy từ bảng dữ liệu
 * `SETTLEMENT_CASE_COLUMNS` ở `settlement.store.port.ts` — hằng số trong mã nguồn, không
 * phải input.
 */

interface RoundRow {
  id: string;
  snapshotId: number;
  navRate: string;
  status: string;
  chain: string;
  initiatedAt: Date;
  completedAt: Date | null;
}

const toRound = (row: RoundRow): SettlementRoundRecord => ({
  id: row.id,
  snapshotId: row.snapshotId,
  navRate: row.navRate,
  status: row.status as SettlementRoundStatus,
  chain: row.chain as ChainKey,
  initiatedAt: row.initiatedAt.toISOString(),
  completedAt: row.completedAt?.toISOString() ?? null,
});

interface CaseRow {
  id: string;
  roundId: string;
  holderWallet: string;
  wptAmount: string;
  payoutAmount: string;
  status: string;
  notifiedAt: Date | null;
  confirmedAt: Date | null;
  paidAt: Date | null;
  paidTxHash: string | null;
  burnedAt: Date | null;
  burnTxHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const toCase = (row: CaseRow): SettlementCaseRecord => ({
  id: row.id,
  roundId: row.roundId,
  holderWallet: row.holderWallet,
  wptAmount: row.wptAmount,
  payoutAmount: row.payoutAmount,
  status: row.status as SettlementCaseStatus,
  notifiedAt: row.notifiedAt?.toISOString() ?? null,
  confirmedAt: row.confirmedAt?.toISOString() ?? null,
  paidAt: row.paidAt?.toISOString() ?? null,
  paidTxHash: row.paidTxHash,
  burnedAt: row.burnedAt?.toISOString() ?? null,
  burnTxHash: row.burnTxHash,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** Bốn cột thời điểm, đúng thứ tự dùng trong câu INSERT của `createCases`. */
const CASE_AT_COLUMNS = ['notifiedAt', 'confirmedAt', 'paidAt', 'burnedAt'] as const;

export function createPostgresSettlementStore(query: PgQuery = pgQuery): ISettlementStore {
  return {
    kind: 'prisma',

    async openRound(round: NewSettlementRound): Promise<SettlementRoundRecord> {
      const rows = await mapPgConstraintError(() =>
        query<RoundRow>(
          `INSERT INTO "SettlementRound" ("id","snapshotId","navRate","status","chain")
           VALUES (gen_random_uuid()::text,$1,$2,$3,$4)
           RETURNING *`,
          [
            assertSnapshotId(round.snapshotId),
            assertAmount('navRate', round.navRate),
            assertSettlementRoundStatus(round.status ?? 'INITIATED'),
            round.chain,
          ],
        ),
      );
      return toRound(rows[0]);
    },

    async findRound(id) {
      const rows = await query<RoundRow>(`SELECT * FROM "SettlementRound" WHERE "id" = $1`, [id]);
      return rows[0] ? toRound(rows[0]) : null;
    },

    async listRounds(options = {}) {
      const { chain, status, limit = 50 } = options;
      const rows = await query<RoundRow>(
        `SELECT * FROM "SettlementRound"
          WHERE ($1::text IS NULL OR "chain" = $1)
            AND ($2::text IS NULL OR "status" = $2)
          ORDER BY "initiatedAt" DESC, "id" DESC
          LIMIT $3`,
        [chain ?? null, status ?? null, limit],
      );
      return rows.map(toRound);
    },

    async setRoundStatus({ id, status, completedAt }) {
      const params: unknown[] = [id, assertSettlementRoundStatus(status)];
      const sets = ['"status" = $2'];
      if (completedAt !== undefined) {
        params.push(completedAt);
        sets.push(`"completedAt" = $${params.length}::timestamptz`);
      }

      const rows = await query<RoundRow>(
        `UPDATE "SettlementRound" SET ${sets.join(', ')} WHERE "id" = $1 RETURNING *`,
        params,
      );
      return rows[0] ? toRound(rows[0]) : null;
    },

    async createCases({ roundId, rows }) {
      assertBulkSize('rows', rows.length);
      assertNoDuplicateWallet(
        'SettlementCase',
        'holderWallet',
        rows.map((row) => row.holderWallet),
      );

      const params: unknown[] = [];
      const tuples = rows.map((row) => {
        const status = assertSettlementCaseStatus(row.status ?? 'NOTIFIED');
        const at = params.length;
        params.push(
          roundId,
          row.holderWallet,
          assertAmount('wptAmount', row.wptAmount),
          assertAmount('payoutAmount', row.payoutAmount),
          status,
        );
        // Cột thời điểm của ĐÚNG trạng thái ban đầu được đặt, ba cột còn lại để NULL: hồ
        // sơ không bao giờ có trạng thái mà thiếu mốc thời gian của trạng thái đó.
        const stamps = CASE_AT_COLUMNS.map((column) =>
          column === SETTLEMENT_CASE_COLUMNS[status].at ? 'CURRENT_TIMESTAMP' : 'NULL',
        );
        return (
          `(gen_random_uuid()::text,$${at + 1},$${at + 2},$${at + 3},$${at + 4},$${at + 5},` +
          `${stamps.join(',')},CURRENT_TIMESTAMP)`
        );
      });

      const inserted = await mapPgConstraintError(() =>
        query<CaseRow>(
          `INSERT INTO "SettlementCase"
             ("id","roundId","holderWallet","wptAmount","payoutAmount","status",
              ${CASE_AT_COLUMNS.map((column) => `"${column}"`).join(',')},"updatedAt")
           VALUES ${tuples.join(',')}
           RETURNING *`,
          params,
        ),
      );

      // Giữ đúng thứ tự đầu vào như bản bộ nhớ — xem ghi chú ở createPayouts.
      const byWallet = new Map(inserted.map((row) => [row.holderWallet, toCase(row)]));
      return rows.map((row) => {
        const record = byWallet.get(row.holderWallet);
        if (!record) {
          throw new Error(
            `INSERT không trả về dòng cho ví "${row.holderWallet}" — lược đồ và mã đã lệch nhau.`,
          );
        }
        return record;
      });
    },

    async markCase({ roundId, holderWallet, status, txHash }) {
      const next = assertSettlementCaseStatus(status);
      const columns = SETTLEMENT_CASE_COLUMNS[next];
      if (txHash !== undefined && columns.txHash === null) {
        throw new StoreUsageError(
          `Bước "${next}" của SettlementCase không có cột mã giao dịch — nó không sinh giao dịch nào. ` +
            'Truyền txHash ở đây là dữ liệu bị bỏ đi mà người gọi tưởng đã lưu.',
        );
      }

      const params: unknown[] = [roundId, holderWallet, next];
      const sets = ['"status" = $3', `"${columns.at}" = CURRENT_TIMESTAMP`, '"updatedAt" = CURRENT_TIMESTAMP'];
      if (txHash !== undefined && columns.txHash !== null) {
        params.push(txHash);
        sets.push(`"${columns.txHash}" = $${params.length}`);
      }

      // So khớp CHÍNH XÁC, không `lower()` — cặp cột này mang ràng buộc duy nhất.
      const updated = await query<CaseRow>(
        `UPDATE "SettlementCase" SET ${sets.join(', ')}
          WHERE "roundId" = $1 AND "holderWallet" = $2
          RETURNING *`,
        params,
      );
      return updated[0] ? toCase(updated[0]) : null;
    },

    async listCases(options = {}) {
      const { roundId, holderWallet, status, limit = 50 } = options;
      const found = await query<CaseRow>(
        `SELECT * FROM "SettlementCase"
          WHERE ($1::text IS NULL OR "roundId" = $1)
            AND ($2::text IS NULL OR lower("holderWallet") = lower($2))
            AND ($3::text IS NULL OR "status" = $3)
          ORDER BY "createdAt" DESC, "id" DESC
          LIMIT $4`,
        [roundId ?? null, holderWallet ?? null, status ?? null, limit],
      );
      return found.map(toCase);
    },
  };
}
