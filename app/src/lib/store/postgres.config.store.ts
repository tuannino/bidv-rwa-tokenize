import 'server-only';

import type { Role } from '@/lib/rbac';
import {
  assertConfigValueType,
  type ConfigChange,
  type ConfigHistoryRecord,
  type ConfigRecord,
  type ConfigValueType,
  type IConfigStore,
} from './config.store.port';
import { pgQuery, pgTransaction, type PgQuery, type PgTransaction } from './postgres.pool';

/**
 * Tham số hệ thống trong Postgres (`USE_MOCK_DB=false`).
 *
 * Mọi GIÁ TRỊ đi vào câu lệnh dưới dạng tham số `$n`. Không có tên cột nào đến từ input.
 *
 * Dữ liệu khởi tạo KHÔNG nạp ở đây mà ở `postgres.pool.ts` (cùng chỗ áp lược đồ), vì nó phải
 * chạy đúng một lần lúc khởi động chứ không mỗi lần dựng đối tượng cổng.
 */

interface ConfigRow {
  key: string;
  value: string;
  type: string;
  updatedBy: string;
  updatedAt: Date;
}

interface ConfigHistoryRow {
  id: string;
  key: string;
  oldValue: string | null;
  newValue: string;
  changedBy: string;
  reason: string | null;
  changedAt: Date;
}

const toConfig = (row: ConfigRow): ConfigRecord => ({
  key: row.key,
  value: row.value,
  type: row.type as ConfigValueType,
  updatedBy: row.updatedBy as Role,
  updatedAt: row.updatedAt.toISOString(),
});

const toHistory = (row: ConfigHistoryRow): ConfigHistoryRecord => ({
  id: row.id,
  key: row.key,
  oldValue: row.oldValue,
  newValue: row.newValue,
  changedBy: row.changedBy as Role,
  reason: row.reason,
  changedAt: row.changedAt.toISOString(),
});

/**
 * `query` và `transaction` nhận được từ ngoài để test bơm hàm giả — kiểm được việc quy lỗi của
 * driver mà không cần Postgres thật.
 */
export function createPostgresConfigStore(
  query: PgQuery = pgQuery,
  transaction: PgTransaction = pgTransaction,
): IConfigStore {
  return {
    kind: 'prisma',

    async getConfig(key) {
      const rows = await query<ConfigRow>(`SELECT * FROM "SystemConfig" WHERE "key" = $1`, [key]);
      return rows[0] ? toConfig(rows[0]) : null;
    },

    async setConfig(change: ConfigChange): Promise<ConfigRecord> {
      const type = assertConfigValueType(change.type);

      /**
       * MỘT transaction cho cả hai bảng.
       *
       * Ghi được giá mới mà mất dòng lịch sử thì sổ kiểm toán thiếu đúng lần đổi giá vừa xảy
       * ra; ghi được lịch sử mà không đổi được giá thì sổ nói một đằng, hệ thống chạy một nẻo.
       * Hai câu lệnh rời nhau không có cách nào bảo đảm điều đó.
       *
       * `RETURNING "value"` của `INSERT ... ON CONFLICT` cho giá trị MỚI, nên giá trị CŨ phải
       * đọc bằng một câu riêng TRƯỚC đó, trong cùng transaction — `FOR UPDATE` khoá dòng lại để
       * một lần đổi đồng thời không chen vào giữa hai câu.
       */
      return transaction(async (run) => {
        const previous = await run<{ value: string }>(
          `SELECT "value" FROM "SystemConfig" WHERE "key" = $1 FOR UPDATE`,
          [change.key],
        );

        const rows = await run<ConfigRow>(
          `INSERT INTO "SystemConfig" ("key","value","type","updatedBy","updatedAt")
           VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP)
           ON CONFLICT ("key") DO UPDATE
             SET "value" = $2, "type" = $3, "updatedBy" = $4, "updatedAt" = CURRENT_TIMESTAMP
           RETURNING *`,
          [change.key, change.value, type, change.changedBy],
        );

        await run(
          `INSERT INTO "SystemConfigHistory"
             ("id","key","oldValue","newValue","changedBy","reason")
           VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5)`,
          [
            change.key,
            previous[0]?.value ?? null,
            change.value,
            change.changedBy,
            change.reason ?? null,
          ],
        );

        return toConfig(rows[0]);
      });
    },

    async listConfigHistory(options = {}) {
      const { key, limit = 50 } = options;
      const rows = await query<ConfigHistoryRow>(
        `SELECT * FROM "SystemConfigHistory"
          WHERE ($1::text IS NULL OR "key" = $1)
          ORDER BY "changedAt" DESC, "id" DESC
          LIMIT $2`,
        [key ?? null, limit],
      );
      return rows.map(toHistory);
    },
  };
}
