import 'server-only';

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { Client, type ClientBase } from 'pg';
import { readStep } from '@/lib/diagnostics/read-trace';
import { serverEnv } from '@/lib/config/env';
import { configuredProjectSeeds } from './configured-seed-data';
import { INIT_SQL } from './init-sql.generated';
import { SEED_ACTOR_ROLE, SEED_CONFIG_ROWS, SEED_ROLE_ROWS } from './seed-data';

/**
 * Kết nối Postgres dùng chung cho MỌI cổng lưu trữ; chỉ cache khởi tạo đã hoàn tất theo URL.
 *
 * Vì sao tách khỏi `postgres.store.ts`: BE-09 thêm bốn cổng nữa, mỗi cổng một file hiện
 * thực Postgres. Chép phần kết nối vào từng cổng sẽ tạo nhiều đường hành xử và nhiều lần áp lược
 * đồ chồng nhau — chưa kể `ensureSchema` sẽ có nhiều phiên bản trôi dạt.
 *
 * Vì sao `pg` chứ không phải Prisma Client, dù lược đồ là Prisma:
 *   `prisma/schema.prisma` VẪN là nguồn sự thật của lược đồ — `prisma/init.sql` được
 *   Prisma sinh ra từ nó (`npm run db:sql`), nên không có hai nguồn DDL.
 *   Nhưng Prisma Client sinh ra ~22MB (có cả query engine nhị phân); nhét vào bundle
 *   Cloudflare Worker là trái steering "build gọn / đồ nặng để lúc build".
 *   `pg` khoảng 0.5MB và chạy được với chuỗi kết nối Hyperdrive.
 *
 * Cloudflare cấm giữ client/pool I/O qua request. Vì vậy `pgQuery` mở một Client cho đúng một
 * truy vấn; `pgTransaction` mở một Client cho trọn transaction; cả hai luôn đóng trong finally.
 * Hyperdrive giữ pool ở phía sau nên việc mở Client tại Worker không mở connection gốc mới mỗi lần.
 *
 * Mọi câu lệnh nghiệp vụ đều tham số hoá ($1, $2, ...) — không nội suy chuỗi vào SQL.
 */

type HyperdriveBinding = { connectionString?: unknown };

// Chỉ cache dữ liệu đã hoàn tất. Không để request khác chờ I/O của request khởi tạo.
const initializedConnections = new Set<string>();

/**
 * Không để một origin sai cấu hình giữ Server Action ở trạng thái pending vô hạn.
 *
 * Hyperdrive tự giới hạn lần bắt tay origin ở 15 giây; đặt client thấp hơn một chút để ứng dụng
 * còn kịp trả lỗi đọc được cho giao diện. `query_timeout` áp cho từng câu, đủ rộng cho DDL lần đầu
 * nhưng chặn một advisory lock hoặc socket hỏng treo mãi.
 */
const CONNECT_TIMEOUT_MS = 12_000;
const QUERY_TIMEOUT_MS = 30_000;

/**
 * Trên Worker, Hyperdrive là nguồn ưu tiên. Ngoài Worker, `getCloudflareContext()` ném lỗi nên
 * đường Node/Docker rơi về `DATABASE_URL`. Không giữ binding hay Client ở phạm vi module: cả hai
 * đều gắn với request hiện tại trong Cloudflare Workers.
 */
function connectionString(): string {
  try {
    const binding = (
      getCloudflareContext().env as CloudflareEnv & { HYPERDRIVE?: HyperdriveBinding }
    ).HYPERDRIVE;
    if (typeof binding?.connectionString === 'string' && binding.connectionString.length > 0) {
      return binding.connectionString;
    }
  } catch {
    // Bình thường khi chạy Next.js, Vitest hoặc Docker ngoài Cloudflare Workers.
  }

  const fallback = serverEnv().databaseUrl;
  if (fallback) return fallback;
  throw new Error(
    'USE_MOCK_DB=false nhưng không có binding HYPERDRIVE và thiếu DATABASE_URL. ' +
      'Cách sửa: cấu hình Hyperdrive cho Worker, đặt DATABASE_URL khi chạy Node/Docker, ' +
      'hoặc để USE_MOCK_DB=true để lưu trong bộ nhớ.',
  );
}

async function withClient<T>(
  databaseUrl: string,
  body: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    query_timeout: QUERY_TIMEOUT_MS,
  });
  let connected = false;
  try {
    await readStep('db.connect', () => client.connect());
    connected = true;
    return await body(client);
  } finally {
    if (connected) await readStep('db.close', () => client.end());
  }
}

async function ensureSchemaReady(databaseUrl: string): Promise<void> {
  if (initializedConnections.has(databaseUrl)) return;
  await readStep('db.schema.verify', () => withClient(databaseUrl, ensureSchema));
  // Chỉ ghi sau COMMIT và đóng Client thành công; lỗi không xoá kết quả của lượt khác.
  initializedConnections.add(databaseUrl);
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
 * Danh sách đối tượng được rút trực tiếp từ `INIT_SQL`, không chép tay một "bảng mốc".
 *
 * Mỗi isolate Worker mới trước đây chạy lại hơn một trăm câu DDL + SAVEPOINT tuần tự dù lược đồ đã
 * đủ; qua Hyperdrive → Neon việc đó đo được 66,48 giây. Một phép đọc catalog cho toàn bộ bảng, enum,
 * index và constraint đưa cold-start về đường nhanh. Khi `init.sql` thêm đối tượng, danh sách này tự
 * đổi theo nên lần deploy kế tiếp sẽ chạy lại đường nâng lược đồ thay vì bỏ sót bảng mới.
 */
function namesFromInitSql(pattern: RegExp): string[] {
  return [...INIT_SQL.matchAll(pattern)].map((match) => match[1]!);
}

const EXPECTED_TABLES = namesFromInitSql(/CREATE TABLE "([^"]+)"/g);
const EXPECTED_TYPES = namesFromInitSql(/CREATE TYPE "([^"]+)"/g);
const EXPECTED_INDEXES = namesFromInitSql(/CREATE (?:UNIQUE )?INDEX "([^"]+)"/g);
const EXPECTED_CONSTRAINTS = namesFromInitSql(/CONSTRAINT "([^"]+)"/g);

/** Một lượt catalog xác nhận lược đồ hiện tại đã chứa mọi đối tượng mà mã đang cần. */
async function schemaObjectsReady(client: ClientBase): Promise<boolean> {
  const timestampColumns = TIMESTAMP_COLUMNS.map(([table, column]) => `${table}.${column}`);
  const { rows } = await client.query<{ ready: boolean }>(
    `SELECT
       (SELECT count(*) FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
           AND c.relname = ANY($1::text[])) = $2
       AND
       (SELECT count(*) FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
         WHERE n.nspname = 'public' AND t.typname = ANY($3::text[])) = $4
       AND
       (SELECT count(*) FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'i'
           AND c.relname = ANY($5::text[])) = $6
       AND
       (SELECT count(*) FROM pg_constraint c
          JOIN pg_namespace n ON n.oid = c.connamespace
         WHERE n.nspname = 'public' AND c.conname = ANY($7::text[])) = $8
       AND NOT EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name || '.' || column_name = ANY($9::text[])
            AND data_type = 'timestamp without time zone'
       ) AS ready`,
    [
      EXPECTED_TABLES,
      EXPECTED_TABLES.length,
      EXPECTED_TYPES,
      EXPECTED_TYPES.length,
      EXPECTED_INDEXES,
      EXPECTED_INDEXES.length,
      EXPECTED_CONSTRAINTS,
      EXPECTED_CONSTRAINTS.length,
      timestampColumns,
    ],
  );
  return rows[0]?.ready === true;
}

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
async function migrateTimestampColumns(client: ClientBase): Promise<void> {
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

async function addMissingColumns(client: ClientBase): Promise<void> {
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
async function applyInitSql(client: ClientBase, sql: string): Promise<void> {
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
 * SystemConfig/Role vẫn là "nạp nếu còn trống". Riêng địa chỉ hợp đồng của Project được phép
 * đồng bộ lại từ cấu hình deploy KHI dự án chưa phát hành; sau `issuedAt`, địa chỉ là chứng từ
 * bất biến và seed tuyệt đối không được sửa.
 */
export async function seedInitialData(client: ClientBase): Promise<void> {
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
       ON CONFLICT ("tokenSymbol","chain") DO UPDATE
       SET "contractAddress" = EXCLUDED."contractAddress",
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "Project"."issuedAt" IS NULL
         AND "Project"."contractAddress" IS DISTINCT FROM EXCLUDED."contractAddress"`,
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
async function ensureSchema(client: ClientBase): Promise<void> {
  try {
    await client.query('BEGIN');
    if (!(await readStep('db.schema.catalog', () => schemaObjectsReady(client)))) {
      await readStep('db.schema.lock', () => client.query('SELECT pg_advisory_xact_lock(918273645)'));
      // Isolate khác có thể đã hoàn tất trong lúc ta chờ khoá; đọc lại trước khi chạy DDL.
      if (!(await readStep('db.schema.catalog', () => schemaObjectsReady(client)))) {
        await readStep('db.schema.columns', () => addMissingColumns(client));
        await readStep('db.schema.ddl', () => applyInitSql(client, INIT_SQL));
        await readStep('db.schema.timestamps', () => migrateTimestampColumns(client));
      }
    }
    await readStep('db.schema.seed', () => seedInitialData(client));
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/**
 * Chạy một truy vấn sau khi lược đồ đã sẵn sàng.
 *
 * Mọi hiện thực Postgres đi qua đây, nên không nơi nào truy vấn trước khi bảng tồn tại.
 */
export type PgQuery = <T extends object>(sql: string, params?: unknown[]) => Promise<T[]>;

export const pgQuery: PgQuery = async <T extends object>(sql: string, params: unknown[] = []) => {
  const databaseUrl = connectionString();
  await readStep('db.schema.wait', () => ensureSchemaReady(databaseUrl));
  return withClient(databaseUrl, async (client) => {
    const result = await readStep('db.query', () => client.query<T>(sql, params));
    return result.rows;
  });
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
  const databaseUrl = connectionString();
  await readStep('db.schema.wait', () => ensureSchemaReady(databaseUrl));
  return withClient(databaseUrl, async (client) => {
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
    }
  });
};
