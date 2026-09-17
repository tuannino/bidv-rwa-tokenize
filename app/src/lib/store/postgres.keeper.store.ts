import 'server-only';

import {
  assertKeeperRunStatus,
  type IKeeperStore,
  type KeeperRunRecord,
  type KeeperRunStatus,
} from './keeper.store.port';
import { pgQuery, type PgQuery } from './postgres.pool';
import { mapPgConstraintError } from './store.errors';

/** Mốc chạy tiến trình hẹn giờ trong Postgres (`USE_MOCK_DB=false`). */

interface RunRow {
  id: string;
  jobName: string;
  periodKey: string;
  startedAt: Date;
  finishedAt: Date | null;
  status: string;
  error: string | null;
}

const toRun = (row: RunRow): KeeperRunRecord => ({
  id: row.id,
  jobName: row.jobName,
  periodKey: row.periodKey,
  startedAt: row.startedAt.toISOString(),
  finishedAt: row.finishedAt?.toISOString() ?? null,
  status: row.status as KeeperRunStatus,
  error: row.error,
});

export function createPostgresKeeperStore(query: PgQuery = pgQuery): IKeeperStore {
  return {
    kind: 'prisma',

    async startRun({ jobName, periodKey }) {
      // Chèn thẳng, KHÔNG đọc trước: ràng buộc `KeeperRun_jobName_periodKey_key` chính là
      // cơ chế chiếm quyền chạy. `SELECT` rồi `INSERT` là hai bước, và hai instance cùng
      // nhận một lịch sẽ cùng vượt qua bước đầu.
      const rows = await mapPgConstraintError(() =>
        query<RunRow>(
          `INSERT INTO "KeeperRun" ("id","jobName","periodKey","status")
           VALUES (gen_random_uuid()::text,$1,$2,$3)
           RETURNING *`,
          [jobName, periodKey, 'RUNNING' satisfies KeeperRunStatus],
        ),
      );
      return toRun(rows[0]);
    },

    async finishRun({ id, status, error }) {
      const params: unknown[] = [id, assertKeeperRunStatus(status)];
      const sets = ['"status" = $2', '"finishedAt" = CURRENT_TIMESTAMP'];
      if (error !== undefined) {
        params.push(error);
        sets.push(`"error" = $${params.length}`);
      }

      const rows = await query<RunRow>(
        `UPDATE "KeeperRun" SET ${sets.join(', ')} WHERE "id" = $1 RETURNING *`,
        params,
      );
      return rows[0] ? toRun(rows[0]) : null;
    },

    async findRun({ jobName, periodKey }) {
      const rows = await query<RunRow>(
        `SELECT * FROM "KeeperRun" WHERE "jobName" = $1 AND "periodKey" = $2`,
        [jobName, periodKey],
      );
      return rows[0] ? toRun(rows[0]) : null;
    },

    async listRuns(options = {}) {
      const { jobName, status, limit = 50 } = options;
      const rows = await query<RunRow>(
        `SELECT * FROM "KeeperRun"
          WHERE ($1::text IS NULL OR "jobName" = $1)
            AND ($2::text IS NULL OR "status" = $2)
          ORDER BY "startedAt" DESC, "id" DESC
          LIMIT $3`,
        [jobName ?? null, status ?? null, limit],
      );
      return rows.map(toRun);
    },
  };
}
