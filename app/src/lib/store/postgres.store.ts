import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import type { ChainKey, TxStatus } from '@bidv/shared';
import type { Role } from '@/lib/rbac';
import { serverEnv } from '@/lib/config/env';
import type { AuditRecord, ITxnStore, NewAudit, NewTxn, TxnRecord } from './store.port';

/**
 * Lưu Txn + audit vào Postgres (chế độ `docker compose up`, `USE_MOCK_DB=false`).
 *
 * Vì sao `pg` chứ không phải Prisma Client, dù lược đồ là Prisma:
 *   `prisma/schema.prisma` VẪN là nguồn sự thật của lược đồ — `prisma/init.sql` được
 *   Prisma sinh ra từ nó (`npm run db:sql`), nên không có hai nguồn DDL.
 *   Nhưng Prisma Client sinh ra ~22MB (có cả query engine nhị phân); nhét vào bundle
 *   Cloudflare Worker là trái steering "build gọn / đồ nặng để lúc build".
 *   `pg` khoảng 0.5MB và nằm trong `serverExternalPackages` mặc định của Next.
 *   Phase 4 muốn đổi sang Prisma Client thì thêm một hiện thực `ITxnStore` nữa là xong.
 *
 * Mọi câu lệnh đều tham số hoá ($1, $2, ...) — không nội suy chuỗi vào SQL.
 */

const GLOBAL_KEY = '__bidvPgPool__';

interface PoolHolder {
  pool: Pool;
  schemaReady: Promise<void>;
}

function holder(): PoolHolder {
  const g = globalThis as typeof globalThis & { [GLOBAL_KEY]?: PoolHolder };
  if (!g[GLOBAL_KEY]) {
    const connectionString = serverEnv().databaseUrl;
    if (!connectionString) {
      throw new Error(
        'USE_MOCK_DB=false nhưng thiếu DATABASE_URL. ' +
          'Cách sửa: đặt DATABASE_URL, hoặc để USE_MOCK_DB=true để lưu trong bộ nhớ.',
      );
    }
    const pool = new Pool({ connectionString, max: 5 });
    g[GLOBAL_KEY] = { pool, schemaReady: ensureSchema(pool) };
  }
  return g[GLOBAL_KEY];
}

/** Các cột thời gian phải là `timestamptz` — xem ghi chú trong prisma/schema.prisma. */
const TIMESTAMP_COLUMNS: ReadonlyArray<[table: string, column: string]> = [
  ['Txn', 'createdAt'],
  ['AuditLog', 'createdAt'],
  ['Investor', 'createdAt'],
  ['Investor', 'updatedAt'],
  ['Investor', 'kycDecidedAt'],
];

/**
 * Sửa các DB đã tạo bằng lược đồ cũ (`timestamp` không timezone) sang `timestamptz`.
 *
 * Vì sao cần: `init.sql` chỉ chạy khi bảng CHƯA có, nên DB dựng trước lúc sửa lược đồ sẽ
 * giữ nguyên kiểu cũ và tiếp tục hiển thị sai giờ (lệch bằng offset UTC).
 *
 * Giá trị cũ được ghi bằng `CURRENT_TIMESTAMP` của Postgres đang ở UTC, nên
 * `AT TIME ZONE 'UTC'` diễn giải đúng chúng thành mốc thời gian thật — không làm lệch dữ liệu.
 *
 * Cố ý giới hạn ở đúng một việc này, KHÔNG dựng framework migration: chạy xong là no-op,
 * và Phase 4 (khi dùng Prisma Migrate thật) thì xoá hàm này.
 */
async function migrateTimestampColumns(client: import('pg').PoolClient): Promise<void> {
  for (const [table, column] of TIMESTAMP_COLUMNS) {
    const { rows } = await client.query<{ data_type: string }>(
      `SELECT data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
      [table, column],
    );
    if (rows[0]?.data_type !== 'timestamp without time zone') continue;

    // Tên bảng/cột lấy từ hằng số trong file này, không phải input người dùng.
    await client.query(
      `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE timestamptz(3)
         USING "${column}" AT TIME ZONE 'UTC'`,
    );
  }
}

/**
 * Áp `prisma/init.sql` nếu bảng chưa có, rồi bảo đảm kiểu cột thời gian đúng.
 * Bọc trong transaction + chốt tư vấn để hai instance khởi động cùng lúc không
 * tạo bảng nửa vời hay ALTER chồng nhau.
 */
async function ensureSchema(pool: Pool): Promise<void> {
  const sqlPath = path.join(process.cwd(), 'prisma', 'init.sql');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(918273645)');

    const { rows } = await client.query<{ table: string | null }>(
      `SELECT to_regclass('public."Txn"')::text AS table`,
    );
    if (!rows[0]?.table) {
      await client.query(await readFile(sqlPath, 'utf8'));
    } else {
      // Bảng có sẵn -> có thể được tạo bằng lược đồ cũ, cần nâng kiểu cột thời gian.
      await migrateTimestampColumns(client);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

interface TxnRow {
  id: string;
  chain: string;
  operation: string;
  txHash: string;
  status: TxStatus;
  fromWallet: string | null;
  toWallet: string | null;
  amount: string | null;
  reason: string | null;
  actorRole: string;
  actorAddress: string | null;
  createdAt: Date;
}

const toTxn = (row: TxnRow): TxnRecord => ({
  id: row.id,
  chain: row.chain as ChainKey,
  operation: row.operation,
  txHash: row.txHash,
  status: row.status,
  fromWallet: row.fromWallet,
  toWallet: row.toWallet,
  amount: row.amount,
  reason: row.reason,
  actorRole: row.actorRole as Role,
  actorAddress: row.actorAddress,
  createdAt: row.createdAt.toISOString(),
});

interface AuditRow {
  id: string;
  actorRole: string;
  action: string;
  target: string | null;
  outcome: AuditRecord['outcome'];
  detail: string | null;
  chain: string | null;
  createdAt: Date;
}

const toAudit = (row: AuditRow): AuditRecord => ({
  id: row.id,
  actorRole: row.actorRole as Role,
  action: row.action,
  target: row.target,
  outcome: row.outcome,
  detail: row.detail,
  chain: row.chain as ChainKey | null,
  createdAt: row.createdAt.toISOString(),
});

export function createPostgresStore(): ITxnStore {
  const query = async <T extends object>(sql: string, params: unknown[]): Promise<T[]> => {
    const { pool, schemaReady } = holder();
    await schemaReady;
    const result = await pool.query<T>(sql, params);
    return result.rows;
  };

  return {
    kind: 'prisma',

    async saveTxn(txn: NewTxn): Promise<TxnRecord> {
      const rows = await query<TxnRow>(
        `INSERT INTO "Txn"
           ("id","chain","operation","txHash","status","fromWallet","toWallet","amount","reason","actorRole","actorAddress")
         VALUES (gen_random_uuid()::text,$1,$2,$3,$4::"TxStatus",$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          txn.chain,
          txn.operation,
          txn.txHash,
          txn.status,
          txn.fromWallet,
          txn.toWallet,
          txn.amount,
          txn.reason,
          txn.actorRole,
          txn.actorAddress,
        ],
      );
      return toTxn(rows[0]);
    },

    async updateTxnStatus(id, status, reason) {
      await query(
        `UPDATE "Txn" SET "status" = $2::"TxStatus", "reason" = COALESCE($3, "reason") WHERE "id" = $1`,
        [id, status, reason ?? null],
      );
    },

    async listTxns(options = {}) {
      const { chain, wallet, limit = 50 } = options;
      const rows = await query<TxnRow>(
        `SELECT * FROM "Txn"
          WHERE ($1::text IS NULL OR "chain" = $1)
            AND ($2::text IS NULL OR lower("toWallet") = lower($2) OR lower("fromWallet") = lower($2))
          ORDER BY "createdAt" DESC
          LIMIT $3`,
        [chain ?? null, wallet ?? null, limit],
      );
      return rows.map(toTxn);
    },

    async appendAudit(entry: NewAudit): Promise<AuditRecord> {
      const rows = await query<AuditRow>(
        `INSERT INTO "AuditLog" ("id","actorRole","action","target","outcome","detail","chain")
         VALUES (gen_random_uuid()::text,$1,$2,$3,$4::"AuditOutcome",$5,$6)
         RETURNING *`,
        [entry.actorRole, entry.action, entry.target, entry.outcome, entry.detail, entry.chain],
      );
      return toAudit(rows[0]);
    },

    async listAudit(options = {}) {
      const rows = await query<AuditRow>(
        `SELECT * FROM "AuditLog" ORDER BY "createdAt" DESC LIMIT $1`,
        [options.limit ?? 50],
      );
      return rows.map(toAudit);
    },
  };
}
