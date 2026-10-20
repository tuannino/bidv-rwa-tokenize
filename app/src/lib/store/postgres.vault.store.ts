import 'server-only';

import type { ChainKey } from '@bidv/shared';
import { pgQuery, type PgQuery } from './postgres.pool';
import { mapPgConstraintError } from './store.errors';
import {
  assertVaultOperationKind,
  type IVaultStore,
  type VaultOperationKind,
  type VaultOperationLockRecord,
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
  };
}
