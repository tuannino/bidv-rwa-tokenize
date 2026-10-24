import 'server-only';

import type { ChainKey } from '@bidv/shared';
import { pgQuery, pgTransaction, type PgQuery, type PgTransaction } from './postgres.pool';
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
  projectId: string | null; maturityDate: string | null; recallFrom: string | null;
  noticeDays: number | null; openedBy: string | null; reason: string | null;
  freezeRequestedAt: Date | null; freezeTxHash: string | null; frozenAt: Date | null;
  cancelledAt: Date | null; unfreezeRequestedAt: Date | null; unfreezeTxHash: string | null;
  activeChain: string | null;
}

const toRound = (row: RoundRow): SettlementRoundRecord => ({
  id: row.id,
  snapshotId: row.snapshotId,
  navRate: row.navRate,
  status: row.status as SettlementRoundStatus,
  chain: row.chain as ChainKey,
  initiatedAt: row.initiatedAt.toISOString(),
  completedAt: row.completedAt?.toISOString() ?? null,
  projectId: row.projectId, maturityDate: row.maturityDate, recallFrom: row.recallFrom,
  noticeDays: row.noticeDays, openedBy: row.openedBy, reason: row.reason,
  freezeRequestedAt: row.freezeRequestedAt?.toISOString() ?? null,
  freezeTxHash: row.freezeTxHash, frozenAt: row.frozenAt?.toISOString() ?? null,
  cancelledAt: row.cancelledAt?.toISOString() ?? null,
  unfreezeRequestedAt: row.unfreezeRequestedAt?.toISOString() ?? null,
  unfreezeTxHash: row.unfreezeTxHash, activeChain: row.activeChain as ChainKey | null,
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
  burnSentAt: Date | null;
  failedAt: Date | null;
  reason: string | null;
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
  burnSentAt: row.burnSentAt?.toISOString() ?? null,
  failedAt: row.failedAt?.toISOString() ?? null,
  reason: row.reason,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** Bốn cột thời điểm, đúng thứ tự dùng trong câu INSERT của `createCases`. */
const CASE_AT_COLUMNS = ['notifiedAt', 'confirmedAt', 'paidAt', 'burnSentAt', 'burnedAt', 'failedAt'] as const;

async function insertAudit(
  run: PgQuery,
  entry: Parameters<ISettlementStore['completeRound']>[0]['audit'],
): Promise<void> {
  await run(
    `INSERT INTO "AuditLog" ("id","actorRole","action","target","outcome","detail","chain")
     VALUES (gen_random_uuid()::text,$1,$2,$3,$4::"AuditOutcome",$5,$6)`,
    [entry.actorRole, entry.action, entry.target, entry.outcome, entry.detail, entry.chain],
  );
}

async function insertCases(
  run: PgQuery,
  roundId: string,
  rows: readonly import('./settlement.store.port').NewSettlementCase[],
  ignoreConflicts: boolean,
): Promise<number> {
  let total = 0;
  for (let start = 0; start < rows.length; start += 1000) {
    const chunk = rows.slice(start, start + 1000);
    if (chunk.length === 0) continue;
    const params: unknown[] = [];
    const tuples = chunk.map((row) => {
      const status = assertSettlementCaseStatus(row.status ?? 'NOTIFIED');
      const at = params.length;
      params.push(roundId, row.holderWallet.toLowerCase(), assertAmount('wptAmount', row.wptAmount), assertAmount('payoutAmount', row.payoutAmount), status);
      const stamps = CASE_AT_COLUMNS.map((column) => column === SETTLEMENT_CASE_COLUMNS[status].at ? 'CURRENT_TIMESTAMP' : 'NULL');
      return `(gen_random_uuid()::text,$${at + 1},$${at + 2},$${at + 3},$${at + 4},$${at + 5},${stamps.join(',')},CURRENT_TIMESTAMP)`;
    });
    const inserted = await run<{ id: string }>(
      `INSERT INTO "SettlementCase"
         ("id","roundId","holderWallet","wptAmount","payoutAmount","status",${CASE_AT_COLUMNS.map((column) => `"${column}"`).join(',')},"updatedAt")
       VALUES ${tuples.join(',')} ${ignoreConflicts ? 'ON CONFLICT ("roundId","holderWallet") DO NOTHING' : ''}
       RETURNING "id"`,
      params,
    );
    total += inserted.length;
  }
  return total;
}

export function createPostgresSettlementStore(
  query: PgQuery = pgQuery,
  transaction: PgTransaction = pgTransaction,
): ISettlementStore {
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

    async openRecallRound(input) {
      return mapPgConstraintError(() => transaction(async (run) => {
        const rows = await run<RoundRow>(
          `INSERT INTO "SettlementRound"
             ("id","snapshotId","navRate","status","chain","projectId","maturityDate","recallFrom","noticeDays","openedBy","reason","activeChain")
           VALUES (gen_random_uuid()::text,0,0,'INITIATED',$1,$2,$3,$4,$5,$6,$7,$1)
           RETURNING *`,
          [input.chain, input.projectId, input.maturityDate, input.recallFrom, input.noticeDays, input.openedBy, input.reason],
        );
        await insertAudit(run, { ...input.audit, target: rows[0].id });
        return toRound(rows[0]);
      }));
    },

    async findActiveRound(chain) {
      const rows = await query<RoundRow>(`SELECT * FROM "SettlementRound" WHERE "activeChain" = $1`, [chain]);
      return rows[0] ? toRound(rows[0]) : null;
    },

    async latestRecallRound(chain) {
      const rows = await query<RoundRow>(
        `SELECT * FROM "SettlementRound" WHERE "chain" = $1 AND "projectId" IS NOT NULL ORDER BY "initiatedAt" DESC,"id" DESC LIMIT 1`, [chain],
      );
      return rows[0] ? toRound(rows[0]) : null;
    },

    async requestFreeze({ id, at }) {
      const rows = await query<{ id: string }>(
        `UPDATE "SettlementRound" SET "freezeRequestedAt"=$2::timestamptz WHERE "id"=$1 AND "status"='INITIATED' AND "freezeRequestedAt" IS NULL RETURNING "id"`, [id, at],
      );
      return rows.length > 0;
    },

    async setFreezeTx({ id, txHash, clearRequest = false }) {
      await query(`UPDATE "SettlementRound" SET "freezeTxHash"=$2,"freezeRequestedAt"=CASE WHEN $3 THEN NULL ELSE "freezeRequestedAt" END WHERE "id"=$1`, [id, txHash, clearRequest]);
    },

    async completeFreeze({ id, frozenAt, cases, audit }) {
      assertNoDuplicateWallet('SettlementCase', 'holderWallet', cases.map((row) => row.holderWallet));
      return mapPgConstraintError(() => transaction(async (run) => {
        const rows = await run<RoundRow>(
          `UPDATE "SettlementRound" SET "status"='IN_PROGRESS',"frozenAt"=$2::timestamptz WHERE "id"=$1 AND "status"='INITIATED' RETURNING *`, [id, frozenAt],
        );
        if (!rows[0]) return null;
        await insertCases(run, id, cases, false);
        await insertAudit(run, audit);
        return toRound(rows[0]);
      }));
    },

    async cancelRound({ id, cancelledAt, audit }) {
      return transaction(async (run) => {
        const rows = await run<RoundRow>(
          `UPDATE "SettlementRound" SET "status"='CANCELLED',"cancelledAt"=$2::timestamptz,"activeChain"=NULL WHERE "id"=$1 AND "status"='INITIATED' AND "freezeRequestedAt" IS NULL RETURNING *`, [id, cancelledAt],
        );
        if (!rows[0]) return null;
        await insertAudit(run, audit); return toRound(rows[0]);
      });
    },

    async rescheduleRound({ id, maturityDate, recallFrom, noticeDays, audit }) {
      return transaction(async (run) => {
        const rows = await run<RoundRow>(
          `UPDATE "SettlementRound" SET "maturityDate"=$2,"recallFrom"=$3,"noticeDays"=$4 WHERE "id"=$1 AND "status"='INITIATED' AND "freezeRequestedAt" IS NULL RETURNING *`, [id, maturityDate, recallFrom, noticeDays],
        );
        if (!rows[0]) return null;
        await insertAudit(run, audit); return toRound(rows[0]);
      });
    },

    async requestUnfreeze({ id, at }) {
      const rows = await query<{ id: string }>(
        `UPDATE "SettlementRound" r SET "unfreezeRequestedAt"=$2::timestamptz
          WHERE r."id"=$1 AND r."status"='IN_PROGRESS' AND r."unfreezeRequestedAt" IS NULL
            AND NOT EXISTS (SELECT 1 FROM "SettlementCase" c WHERE c."roundId"=r."id" AND (c."status"='BURNING' OR (c."status"='BURNED' AND c."burnTxHash" IS NOT NULL)))
          RETURNING r."id"`, [id, at],
      );
      return rows.length > 0;
    },

    async setUnfreezeTx({ id, txHash, clearRequest = false }) {
      await query(`UPDATE "SettlementRound" SET "unfreezeTxHash"=$2,"unfreezeRequestedAt"=CASE WHEN $3 THEN NULL ELSE "unfreezeRequestedAt" END WHERE "id"=$1`, [id, txHash, clearRequest]);
    },

    async completeUnfreeze({ id, audit }) {
      return transaction(async (run) => {
        const rows = await run<RoundRow>(
          `UPDATE "SettlementRound" r SET "status"='INITIATED',"freezeRequestedAt"=NULL,"freezeTxHash"=NULL,"frozenAt"=NULL,"unfreezeRequestedAt"=NULL,"unfreezeTxHash"=NULL
            WHERE r."id"=$1 AND r."status"='IN_PROGRESS'
              AND NOT EXISTS (SELECT 1 FROM "SettlementCase" c WHERE c."roundId"=r."id" AND (c."status"='BURNING' OR (c."status"='BURNED' AND c."burnTxHash" IS NOT NULL)))
            RETURNING *`, [id],
        );
        if (!rows[0]) return null;
        await run(`DELETE FROM "SettlementCase" WHERE "roundId"=$1 AND ("status" IN ('NOTIFIED','FAILED') OR ("status"='BURNED' AND "burnTxHash" IS NULL))`, [id]);
        await insertAudit(run, audit); return toRound(rows[0]);
      });
    },

    async addMissingCases({ roundId, rows }) {
      return mapPgConstraintError(() => transaction((run) => insertCases(run, roundId, rows, true)));
    },

    async claimCase({ roundId, holderWallet, at }) {
      const rows = await query<CaseRow>(
        `UPDATE "SettlementCase" SET "status"='BURNING',"burnTxHash"=NULL,"burnSentAt"=$3::timestamptz,"failedAt"=NULL,"reason"=NULL,"updatedAt"=$3::timestamptz
          WHERE "roundId"=$1 AND "holderWallet"=$2 AND "status" IN ('NOTIFIED','FAILED') RETURNING *`, [roundId, holderWallet.toLowerCase(), at],
      );
      return rows[0] ? toCase(rows[0]) : null;
    },

    async attachBurnTx({ roundId, holderWallet, txHash }) {
      const rows = await query<{ id: string }>(
        `UPDATE "SettlementCase" SET "burnTxHash"=$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "roundId"=$1 AND "holderWallet"=$2 AND "status"='BURNING' AND "burnTxHash" IS NULL RETURNING "id"`, [roundId, holderWallet.toLowerCase(), txHash],
      );
      return rows.length > 0;
    },

    async settleCase({ roundId, holderWallet, to, at, reason }) {
      const timestampColumn = to === 'BURNED' ? 'burnedAt' : 'failedAt';
      const rows = await query<CaseRow>(
        `UPDATE "SettlementCase" SET "status"=$3,"${timestampColumn}"=$4::timestamptz,"reason"=$5,"updatedAt"=$4::timestamptz WHERE "roundId"=$1 AND "holderWallet"=$2 AND "status"='BURNING' RETURNING *`,
        [roundId, holderWallet.toLowerCase(), to, at, reason ?? null],
      );
      return rows[0] ? toCase(rows[0]) : null;
    },

    async listRoundCases({ roundId, statuses }) {
      const rows = await query<CaseRow>(
        `SELECT * FROM "SettlementCase" WHERE "roundId"=$1 AND ($2::text[] IS NULL OR "status"=ANY($2::text[])) ORDER BY "holderWallet"`, [roundId, statuses ? [...statuses] : null],
      );
      return rows.map(toCase);
    },

    async completeRound({ id, projectId, completedAt, audit }) {
      return transaction(async (run) => {
        const rows = await run<RoundRow>(
          `UPDATE "SettlementRound" r SET "status"='COMPLETED',"completedAt"=$3::timestamptz,"activeChain"=NULL
            WHERE r."id"=$1 AND r."projectId"=$2 AND r."status"='IN_PROGRESS' AND EXISTS (SELECT 1 FROM "Project" p WHERE p."id"=$2) RETURNING *`, [id, projectId, completedAt],
        );
        if (!rows[0]) return null;
        await run(`UPDATE "Project" SET "status"='CLOSED',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`, [projectId]);
        await insertAudit(run, audit); return toRound(rows[0]);
      });
    },
  };
}
