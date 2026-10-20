import 'server-only';

import type { ChainKey } from '@bidv/shared';
import { pgQuery, type PgQuery } from './postgres.pool';
import { assertAmount, mapPgConstraintError } from './store.errors';
import {
  assertVaultOperationKind,
  assertWithdrawTransition,
  WITHDRAW_TERMINAL_STATUSES,
  type IVaultStore,
  type VaultOperationKind,
  type VaultOperationLockRecord,
  type WithdrawRequestRecord,
  type WithdrawStatus,
} from './vault.store.port';

/** Vận hành vault trong Postgres (`USE_MOCK_DB=false`). */

interface LockRow {
  chain: string;
  kind: string;
  refId: string;
  actor: string;
  acquiredAt: Date;
}

const toLock = (row: LockRow): VaultOperationLockRecord => ({
  chain: row.chain as ChainKey,
  kind: row.kind as VaultOperationKind,
  refId: row.refId,
  actor: row.actor,
  acquiredAt: row.acquiredAt.toISOString(),
});

interface WithdrawRow {
  id: string;
  chain: string;
  clientRequestId: string;
  amount: string;
  purpose: string;
  note: string | null;
  payoutWallet: string;
  status: string;
  activeChain: string | null;
  claimedBlock: string | null;
  txHash: string | null;
  reason: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

const toWithdraw = (row: WithdrawRow): WithdrawRequestRecord => ({
  id: row.id,
  chain: row.chain as ChainKey,
  clientRequestId: row.clientRequestId,
  amount: row.amount,
  purpose: row.purpose,
  note: row.note,
  payoutWallet: row.payoutWallet,
  status: row.status as WithdrawStatus,
  activeChain: row.activeChain as ChainKey | null,
  claimedBlock: row.claimedBlock,
  txHash: row.txHash,
  reason: row.reason,
  createdBy: row.createdBy,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  completedAt: row.completedAt?.toISOString() ?? null,
});

export function createPostgresVaultStore(query: PgQuery = pgQuery): IVaultStore {
  return {
    kind: 'prisma',

    async acquireOperationLock({ chain, kind, refId, actor, takeOverConfigBefore }) {
      // MỘT câu: chèn khi chưa ai giữ; trùng khoá chính thì chỉ ghi đè khi cả hai là `CONFIG` và
      // khoá cũ đã treo quá mốc tiếp quản. Không có dòng trả về nghĩa là thua.
      const rows = await mapPgConstraintError(() =>
        query<LockRow>(
          `INSERT INTO "VaultOperationLock" ("chain","kind","refId","actor","acquiredAt")
           VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP)
           ON CONFLICT ("chain") DO UPDATE
              SET "kind" = EXCLUDED."kind", "refId" = EXCLUDED."refId",
                  "actor" = EXCLUDED."actor", "acquiredAt" = EXCLUDED."acquiredAt"
            WHERE EXCLUDED."kind" = 'CONFIG'
              AND "VaultOperationLock"."kind" = 'CONFIG'
              AND $5::timestamptz IS NOT NULL
              AND "VaultOperationLock"."acquiredAt" < $5::timestamptz
           RETURNING *`,
          [chain, assertVaultOperationKind(kind), refId, actor, takeOverConfigBefore ?? null],
        ),
      );
      return rows[0] ? toLock(rows[0]) : null;
    },

    async releaseOperationLock({ chain, refId }) {
      const rows = await query<{ chain: string }>(
        `DELETE FROM "VaultOperationLock" WHERE "chain" = $1 AND "refId" = $2 RETURNING "chain"`,
        [chain, refId],
      );
      return rows.length > 0;
    },

    async findOperationLock(chain) {
      const rows = await query<LockRow>(`SELECT * FROM "VaultOperationLock" WHERE "chain" = $1`, [chain]);
      return rows[0] ? toLock(rows[0]) : null;
    },

    async createWithdrawRequest(input) {
      const rows = await mapPgConstraintError(() =>
        query<WithdrawRow>(
          `INSERT INTO "WithdrawRequest"
             ("id","chain","clientRequestId","amount","purpose","note","payoutWallet","status",
              "activeChain","claimedBlock","createdBy","updatedAt")
           VALUES ($1,$2,$3,$4::numeric,$5,$6,$7,'SENDING',$2,$8::numeric,$9,CURRENT_TIMESTAMP)
           RETURNING *`,
          [
            input.id,
            input.chain,
            input.clientRequestId,
            assertAmount('amount', input.amount),
            input.purpose,
            input.note,
            input.payoutWallet,
            input.claimedBlock === null ? null : assertAmount('claimedBlock', input.claimedBlock),
            input.createdBy,
          ],
        ),
      );
      return toWithdraw(rows[0]);
    },

    async findWithdrawRequest(id) {
      const rows = await query<WithdrawRow>(`SELECT * FROM "WithdrawRequest" WHERE "id" = $1`, [id]);
      return rows[0] ? toWithdraw(rows[0]) : null;
    },

    async findWithdrawByClientRequest({ chain, clientRequestId }) {
      const rows = await query<WithdrawRow>(
        `SELECT * FROM "WithdrawRequest" WHERE "chain" = $1 AND "clientRequestId" = $2`,
        [chain, clientRequestId],
      );
      return rows[0] ? toWithdraw(rows[0]) : null;
    },

    async findWithdrawByTxHash(txHash) {
      const rows = await query<WithdrawRow>(`SELECT * FROM "WithdrawRequest" WHERE "txHash" = $1`, [txHash]);
      return rows[0] ? toWithdraw(rows[0]) : null;
    },

    async transitionWithdrawRequest({ id, from, to, txHash, reason }) {
      assertWithdrawTransition(from, to);
      const terminal = WITHDRAW_TERMINAL_STATUSES.includes(to);
      // MỘT câu có điều kiện trạng thái: về trạng thái cuối thì `activeChain` về NULL cùng lúc.
      const rows = await mapPgConstraintError(() =>
        query<WithdrawRow>(
          `UPDATE "WithdrawRequest"
              SET "status" = $3,
                  "txHash" = CASE WHEN $4::boolean THEN $5 ELSE "txHash" END,
                  "reason" = CASE WHEN $6::boolean THEN $7 ELSE "reason" END,
                  "activeChain" = CASE WHEN $8::boolean THEN NULL ELSE "activeChain" END,
                  "completedAt" = CASE WHEN $8::boolean THEN CURRENT_TIMESTAMP ELSE "completedAt" END,
                  "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = $1 AND "status" = $2
            RETURNING *`,
          [id, from, to, txHash !== undefined, txHash ?? null, reason !== undefined, reason ?? null, terminal],
        ),
      );
      return rows[0] ? toWithdraw(rows[0]) : null;
    },

    async listWithdrawRequests({ chain, createdBy, statuses, limit = 50 }) {
      const rows = await query<WithdrawRow>(
        `SELECT * FROM "WithdrawRequest"
          WHERE "chain" = $1
            AND ($2::text IS NULL OR "createdBy" = $2)
            AND ($3::text[] IS NULL OR "status" = ANY($3::text[]))
          ORDER BY "createdAt" DESC, "id" DESC
          LIMIT $4`,
        [chain, createdBy ?? null, statuses ? [...statuses] : null, limit],
      );
      return rows.map(toWithdraw);
    },
  };
}
