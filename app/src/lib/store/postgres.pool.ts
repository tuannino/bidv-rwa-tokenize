import 'server-only';

import { Pool } from 'pg';
import { serverEnv } from '@/lib/config/env';
import { configuredProjectSeeds } from './configured-seed-data';
import { INIT_SQL } from './init-sql.generated';
import { SEED_ACTOR_ROLE, SEED_CONFIG_ROWS, SEED_ROLE_ROWS } from './seed-data';

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
 * Cột THÊM VÀO bảng đã có từ trước (BE-14/BE-17): chiều lệnh, bốn mốc bước quyết toán
 * và mã chống trùng do client cấp.
 *
 * Vì sao cần: `init.sql` do `prisma migrate diff --from-empty` sinh ra chỉ có `CREATE TABLE`, nên
 * một volume dựng trước BE-14 giữ nguyên bảng `PurchaseOrder` cũ, thiếu cột — và câu
 * `CREATE INDEX ... ("side", ...)` trong chính `init.sql` sẽ nổ `undefined_column`.
 *
 * Chạy TRƯỚC `applyInitSql` vì lý do đó. `ALTER TABLE IF EXISTS` để DB rỗng (chưa có bảng) đi
 * qua không lỗi, rồi `init.sql` tạo bảng đủ cột. `DEFAULT 'BUY'` làm mọi dòng cũ thành lệnh mua
 * — đúng sự thật, vì trước BE-14 chỉ có chiều mua.
 *
 * Cùng tinh thần `migrateTimestampColumns`: đúng một việc, chạy xong là no-op, không dựng
 * framework migration. Câu lệnh là hằng số trong tệp này, không có phần nào từ input.
 */
const ADDED_COLUMNS: readonly string[] = [
  `ALTER TABLE IF EXISTS "PurchaseOrder" ADD COLUMN IF NOT EXISTS "clientRequestId" TEXT NOT NULL DEFAULT gen_random_uuid()::text`,
  `ALTER TABLE IF EXISTS "PurchaseOrder" ADD COLUMN IF NOT EXISTS "side" TEXT NOT NULL DEFAULT 'BUY'`,
  `ALTER TABLE IF EXISTS "PurchaseOrder" ADD COLUMN IF NOT EXISTS "checkingAt" TIMESTAMPTZ(3)`,
  `ALTER TABLE IF EXISTS "PurchaseOrder" ADD COLUMN IF NOT EXISTS "reconciledAt" TIMESTAMPTZ(3)`,
  `ALTER TABLE IF EXISTS "PurchaseOrder" ADD COLUMN IF NOT EXISTS "settlingAt" TIMESTAMPTZ(3)`,
  `ALTER TABLE IF EXISTS "PurchaseOrder" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMPTZ(3)`,
];

async function addMissingColumns(client: import('pg').PoolClient): Promise<void> {
  for (const statement of ADDED_COLUMNS) await client.query(statement);
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
 * Nạp DỮ LIỆU KHỞI TẠO, lấy từ CÙNG nguồn với bản bộ nhớ (`seed-data.ts`).
 *
 * Vì sao ở đây chứ không phải một tệp `seed.sql`: `prisma/init.sql` do `prisma migrate diff`
 * sinh ra nên chỉ có DDL, không mang được dòng dữ liệu. Viết seed thành SQL tay là tạo nguồn
 * thứ hai cho giá phát hành và tổng cung — đúng loại lệch mà `seed-data.ts` được lập ra để
 * chặn, và nó sẽ lệch âm thầm vì demo free-tier không chạy đường SQL này.
 *
 * `ON CONFLICT DO NOTHING` ở mọi câu: hàm chạy MỖI lần khởi động, và lần thứ hai không được
 * ghi đè giá mà cán bộ ngân hàng vừa đặt. Đây là "nạp nếu còn trống", không phải "đặt lại".
 */
async function seedInitialData(client: import('pg').PoolClient): Promise<void> {
  for (const row of SEED_CONFIG_ROWS) {
    await client.query(
      `INSERT INTO "SystemConfig" ("key","value","type","updatedBy","updatedAt")
       VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP)
       ON CONFLICT ("key") DO NOTHING`,
      [row.key, row.value, row.type, SEED_ACTOR_ROLE],
    );
  }

  for (const project of configuredProjectSeeds()) {
    await client.query(
      `INSERT INTO "Project"
         ("id","tokenSymbol","name","totalSupply","status","chain","contractAddress","updatedAt")
       VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP)
       ON CONFLICT ("tokenSymbol","chain") DO NOTHING`,
      [
        project.tokenSymbol,
        project.name,
        project.totalSupply,
        project.status,
        project.chain,
        project.contractAddress ?? null,
      ],
    );
  }

  for (const role of SEED_ROLE_ROWS) {
    await client.query(
      `INSERT INTO "Role" ("id","name","isConfig")
       VALUES (gen_random_uuid()::text,$1,$2)
       ON CONFLICT ("name") DO NOTHING`,
      [role.name, role.isConfig],
    );
  }
}

/**
 * Bảo đảm lược đồ đã đúng: áp `init.sql`, nâng kiểu cột thời gian của bảng cũ, rồi nạp dữ liệu
 * khởi tạo.
 *
 * Bọc trong transaction + chốt tư vấn để hai instance khởi động cùng lúc không tạo bảng
 * nửa vời hay ALTER chồng nhau.
 */
async function ensureSchema(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(918273645)');
    await addMissingColumns(client);
    await applyInitSql(client, INIT_SQL);
    await migrateTimestampColumns(client);
    await seedInitialData(client);
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

/**
 * Chạy nhiều câu lệnh trong MỘT transaction, trên CÙNG một connection.
 *
 * Cần hàm riêng vì `pgQuery` lấy connection từ pool cho từng lời gọi, nên `BEGIN` và `COMMIT`
 * gửi qua nó có thể rơi vào hai connection khác nhau — khi đó `BEGIN` mở một transaction rồi bị
 * bỏ lửng, và các câu ở giữa chạy tự động commit từng câu. Triệu chứng là "transaction có mà
 * không có tác dụng": lỗi ở câu thứ hai không lùi được câu thứ nhất.
 *
 * `run` truyền vào callback là hàm truy vấn ĐÃ gắn với connection đang mở transaction. Người
 * gọi phải dùng nó, không dùng `pgQuery`.
 */
export type PgTransaction = <T>(
  body: (run: <R extends object>(sql: string, params?: unknown[]) => Promise<R[]>) => Promise<T>,
) => Promise<T>;

export const pgTransaction: PgTransaction = async <T>(
  body: (run: <R extends object>(sql: string, params?: unknown[]) => Promise<R[]>) => Promise<T>,
): Promise<T> => {
  const { pool, schemaReady } = holder();
  await schemaReady;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await body(async <R extends object>(sql: string, params: unknown[] = []) => {
      const rows = await client.query<R>(sql, params);
      return rows.rows;
    });
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
