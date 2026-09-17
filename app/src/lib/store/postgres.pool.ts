import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { serverEnv } from '@/lib/config/env';

/**
 * Kết nối Postgres dùng chung cho MỌI cổng lưu trữ, và việc áp lược đồ một lần lúc khởi động.
 *
 * Vì sao tách khỏi `postgres.store.ts`: BE-09 thêm bốn cổng nữa, mỗi cổng một file hiện
 * thực Postgres. Năm bản sao của `new Pool(...)` là năm pool thật (mỗi cái `max: 5`) và
 * năm lần áp lược đồ chồng nhau — chưa kể `ensureSchema` sẽ có năm phiên bản trôi dạt.
 *
 * Vì sao `pg` chứ không phải Prisma Client, dù lược đồ là Prisma:
 *   `prisma/schema.prisma` VẪN là nguồn sự thật của lược đồ — `prisma/init.sql` được
 *   Prisma sinh ra từ nó (`npm run db:sql`), nên không có hai nguồn DDL.
 *   Nhưng Prisma Client sinh ra ~22MB (có cả query engine nhị phân); nhét vào bundle
 *   Cloudflare Worker là trái steering "build gọn / đồ nặng để lúc build".
 *   `pg` khoảng 0.5MB và nằm trong `serverExternalPackages` mặc định của Next.
 *
 * Mọi câu lệnh nghiệp vụ đều tham số hoá ($1, $2, ...) — không nội suy chuỗi vào SQL.
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
 * Vì sao cần: `init.sql` chỉ tạo bảng CHƯA có, nên DB dựng trước lúc sửa lược đồ sẽ giữ
 * nguyên kiểu cũ và tiếp tục hiển thị sai giờ (lệch bằng offset UTC).
 *
 * Giá trị cũ được ghi bằng `CURRENT_TIMESTAMP` của Postgres đang ở UTC, nên
 * `AT TIME ZONE 'UTC'` diễn giải đúng chúng thành mốc thời gian thật — không làm lệch dữ liệu.
 *
 * Chỉ liệt kê bảng CŨ: sáu bảng BE-09 sinh ra đã là `timestamptz` ngay từ init.sql nên
 * không bao giờ cần nâng kiểu.
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
 * Mã lỗi Postgres nghĩa là "thứ này đã có rồi" — bỏ qua được khi áp lại `init.sql`.
 *
 * KHÔNG bỏ qua mã nào khác: một `ALTER` thất bại vì lý do thật thì phải nổ ra ngay, chứ
 * không im lặng để lại lược đồ nửa vời.
 */
const ALREADY_EXISTS_CODES: ReadonlySet<string> = new Set([
  '42P07', // duplicate_table — bảng hoặc chỉ mục đã có
  '42P06', // duplicate_schema
  '42710', // duplicate_object — kiểu enum, ràng buộc
  '42701', // duplicate_column
]);

/**
 * Cắt `init.sql` thành từng câu lệnh.
 *
 * Cắt theo dấu `;` được vì `prisma migrate diff` chỉ sinh DDL phẳng: `CREATE SCHEMA`,
 * `CREATE TYPE`, `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE`. Không có thân hàm, không
 * có chuỗi chứa dấu `;`. Nếu ngày nào Prisma sinh ra khối `$$ ... $$` thì phép cắt này
 * SAI, nên chặn ngay bằng lỗi nói rõ phải xem lại — im lặng cắt sai sẽ ra lược đồ thiếu.
 */
function splitStatements(sql: string): string[] {
  if (sql.includes('$$')) {
    throw new Error(
      'prisma/init.sql có khối $$…$$ nên không cắt theo dấu ; được nữa. ' +
        'Xem lại splitStatements() trong store/postgres.pool.ts.',
    );
  }
  return sql
    .split(';')
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0 && !/^(--[^\n]*\n?)*$/.test(chunk));
}

/**
 * Áp `prisma/init.sql`, chạy được cả trên DB rỗng và DB đã có một phần bảng.
 *
 * Vì sao không dùng lối "chưa có bảng Txn thì áp cả file, có rồi thì thôi": khi đó một
 * volume Postgres dựng TRƯỚC BE-09 sẽ mãi thiếu sáu bảng mới, và lỗi chỉ hiện ra lúc
 * nghiệp vụ đầu tiên chạm vào bảng thiếu — trên máy Owner, không phải trên máy vừa sửa
 * mã. Cũng không dùng "sentinel là bảng mới nhất" vì đó là một hằng số phải bảo trì tay,
 * và người thêm bảng thứ bảy sẽ không biết là phải sửa nó.
 *
 * Mỗi câu lệnh chạy trong một SAVEPOINT riêng: một lệnh lỗi vì "đã có rồi" thì lùi đúng
 * lệnh đó, các lệnh sau vẫn chạy được. Không có SAVEPOINT thì lỗi đầu tiên làm cả
 * transaction thành abort và mọi lệnh sau đều thất bại.
 */
async function applyInitSql(client: import('pg').PoolClient, sql: string): Promise<void> {
  for (const statement of splitStatements(sql)) {
    await client.query('SAVEPOINT bidv_ddl');
    try {
      await client.query(statement);
      await client.query('RELEASE SAVEPOINT bidv_ddl');
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (!code || !ALREADY_EXISTS_CODES.has(code)) throw error;
      await client.query('ROLLBACK TO SAVEPOINT bidv_ddl');
      await client.query('RELEASE SAVEPOINT bidv_ddl');
    }
  }
}

/**
 * Bảo đảm lược đồ đã đúng: áp `init.sql` rồi nâng kiểu cột thời gian của bảng cũ.
 *
 * Bọc trong transaction + chốt tư vấn để hai instance khởi động cùng lúc không tạo bảng
 * nửa vời hay ALTER chồng nhau.
 */
async function ensureSchema(pool: Pool): Promise<void> {
  const sqlPath = path.join(process.cwd(), 'prisma', 'init.sql');
  const sql = await readFile(sqlPath, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(918273645)');
    await applyInitSql(client, sql);
    await migrateTimestampColumns(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Chạy một truy vấn sau khi lược đồ đã sẵn sàng.
 *
 * Mọi hiện thực Postgres đi qua đây, nên không nơi nào truy vấn trước khi bảng tồn tại.
 */
export type PgQuery = <T extends object>(sql: string, params?: unknown[]) => Promise<T[]>;

export const pgQuery: PgQuery = async <T extends object>(sql: string, params: unknown[] = []) => {
  const { pool, schemaReady } = holder();
  await schemaReady;
  const result = await pool.query<T>(sql, params);
  return result.rows;
};
