import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import type { ChainKey, TxStatus } from '@bidv/shared';
import type { Role } from '@/lib/rbac';
import { serverEnv } from '@/lib/config/env';
import type { OrderStatus } from '@/lib/bank/purchase.state';
import type {
  AuditRecord,
  IBankStore,
  NewAudit,
  NewOrder,
  NewTxn,
  OrderRecord,
  OrderTransition,
  TxnRecord,
} from './store.port';

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
 * Tạo bảng lệnh mua trên DB ĐÃ TỒN TẠI TỪ TRƯỚC (BE-02).
 *
 * Vì sao cần một hàm riêng thay vì để `init.sql` lo: `init.sql` chỉ chạy khi bảng `Txn`
 * chưa có, nên mọi volume Postgres dựng trước BE-02 sẽ KHÔNG bao giờ nhận bảng mới —
 * và lỗi lộ ra là `relation "PurchaseOrder" does not exist` giữa lúc đặt lệnh, tức là
 * đúng lúc tệ nhất. Xoá volume để "sửa" là mất sổ giao dịch cũ.
 *
 * DDL dưới đây LẶP LẠI `init.sql`, và đó là món nợ có ý thức — đúng cùng lý do
 * `migrateTimestampColumns` lặp lại kiểu cột. Cả hai hàm phải BIẾN MẤT khi BE-09 dựng
 * migration thật (Prisma Migrate); tới lúc đó `init.sql` là nguồn duy nhất.
 *
 * Mọi câu lệnh đều idempotent nên chạy lại là no-op, không phải kiểm trước rồi mới chạy.
 */
async function ensurePurchaseOrderTable(client: import('pg').PoolClient): Promise<void> {
  // Enum không có `CREATE TYPE IF NOT EXISTS`, phải bọc DO block.
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderStatus') THEN
        CREATE TYPE "OrderStatus" AS ENUM
          ('PLACED','CHECKING','EXECUTING','COMPLETED','REJECTED','FAILED','EXPIRED');
      END IF;
    END $$;
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
      "id" TEXT NOT NULL,
      "chain" TEXT NOT NULL,
      "investorWallet" TEXT NOT NULL,
      "wptAmount" DECIMAL(78,0) NOT NULL,
      "vndAmount" DECIMAL(78,0) NOT NULL,
      "status" "OrderStatus" NOT NULL DEFAULT 'PLACED',
      "txHash" TEXT,
      "reason" TEXT,
      "actorRole" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
    )
  `);
  await client.query(
    `CREATE INDEX IF NOT EXISTS "PurchaseOrder_investorWallet_createdAt_idx"
       ON "PurchaseOrder"("investorWallet", "createdAt")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "PurchaseOrder_status_createdAt_idx"
       ON "PurchaseOrder"("status", "createdAt")`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "PurchaseOrder_txHash_idx" ON "PurchaseOrder"("txHash")`,
  );
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
      // ... và có thể được tạo trước BE-02, thiếu hẳn bảng lệnh mua.
      await ensurePurchaseOrderTable(client);
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

interface OrderRow {
  id: string;
  chain: string;
  investorWallet: string;
  /** `pg` trả DECIMAL về dạng CHUỖI — đúng thứ ta cần, uint256 vượt tầm `number`. */
  wptAmount: string;
  vndAmount: string;
  status: OrderStatus;
  txHash: string | null;
  reason: string | null;
  actorRole: string;
  createdAt: Date;
  updatedAt: Date;
}

const toOrder = (row: OrderRow): OrderRecord => ({
  id: row.id,
  chain: row.chain as ChainKey,
  investorWallet: row.investorWallet,
  wptAmount: row.wptAmount,
  vndAmount: row.vndAmount,
  status: row.status,
  txHash: row.txHash,
  reason: row.reason,
  actorRole: row.actorRole as Role,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export function createPostgresStore(): IBankStore {
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

    // =========================================================================
    //  LỆNH MUA WPT
    // =========================================================================

    /**
     * `updatedAt` phải đặt tường minh trong MỌI câu lệnh ghi.
     *
     * `@updatedAt` của Prisma là hành vi của Prisma **Client**, không phải ràng buộc
     * trong lược đồ — file này dùng `pg` thẳng nên không có ai tự điền. Cột lại
     * `NOT NULL`, nên bỏ qua là lỗi ngay lúc INSERT (bản `init.sql` sinh ra cũng không
     * có DEFAULT cho cột này).
     */
    async createOrder(order: NewOrder): Promise<OrderRecord> {
      const rows = await query<OrderRow>(
        `INSERT INTO "PurchaseOrder"
           ("id","chain","investorWallet","wptAmount","vndAmount","status","actorRole","updatedAt")
         VALUES (gen_random_uuid()::text,$1,$2,$3,$4,'PLACED'::"OrderStatus",$5,CURRENT_TIMESTAMP)
         RETURNING *`,
        [order.chain, order.investorWallet, order.wptAmount, order.vndAmount, order.actorRole],
      );
      return toOrder(rows[0]);
    },

    async findOrder(id) {
      const rows = await query<OrderRow>(`SELECT * FROM "PurchaseOrder" WHERE "id" = $1`, [id]);
      return rows[0] ? toOrder(rows[0]) : null;
    },

    /**
     * KHOÁ LẠC QUAN (QĐ-1) — điều kiện trạng thái nằm TRONG câu lệnh cập nhật.
     *
     * Không dòng nào khớp `WHERE` thì `RETURNING` không trả gì và ta trả `null`. Đó là
     * toàn bộ cơ chế chống gửi giao dịch hai lần: hai tiến trình cùng chạy câu lệnh này
     * thì Postgres tuần tự hoá chúng, tiến trình thứ hai thấy trạng thái đã đổi và
     * không khớp `WHERE` nữa.
     *
     * `CASE WHEN $n::boolean` để phân biệt "không truyền" (giữ giá trị cũ) với "truyền
     * null" (xoá giá trị cũ). Dùng `COALESCE($n, "txHash")` như chỗ khác trong file này
     * sẽ gộp hai ý đó làm một, và khi ấy không cách nào xoá được một mã giao dịch cũ.
     */
    async transitionOrder(transition: OrderTransition): Promise<OrderRecord | null> {
      const { id, from, to, txHash, reason } = transition;
      const rows = await query<OrderRow>(
        `UPDATE "PurchaseOrder"
            SET "status"    = $3::"OrderStatus",
                "txHash"    = CASE WHEN $4::boolean THEN $5 ELSE "txHash" END,
                "reason"    = CASE WHEN $6::boolean THEN $7 ELSE "reason" END,
                "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = $1
            AND "status" = ANY($2::"OrderStatus"[])
        RETURNING *`,
        [
          id,
          from,
          to,
          txHash !== undefined,
          txHash ?? null,
          reason !== undefined,
          reason ?? null,
        ],
      );
      return rows[0] ? toOrder(rows[0]) : null;
    },

    async attachOrderTxHash({ id, txHash }) {
      const rows = await query<OrderRow>(
        `UPDATE "PurchaseOrder"
            SET "txHash" = $2, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = $1 AND "status" = 'EXECUTING'::"OrderStatus"
        RETURNING *`,
        [id, txHash],
      );
      return rows[0] ? toOrder(rows[0]) : null;
    },

    async listOrders(options = {}) {
      const { chain, investorWallet, status, limit = 50 } = options;
      const rows = await query<OrderRow>(
        `SELECT * FROM "PurchaseOrder"
          WHERE ($1::text IS NULL OR "chain" = $1)
            AND ($2::text IS NULL OR lower("investorWallet") = lower($2))
            AND ($3::text IS NULL OR "status" = $3::"OrderStatus")
          ORDER BY "createdAt" DESC
          LIMIT $4`,
        [chain ?? null, investorWallet ?? null, status ?? null, limit],
      );
      return rows.map(toOrder);
    },

    /**
     * Chỉ nhắm `PLACED`. Từ `CHECKING` trở đi đã có tiến trình đang xử lý, cho hết hạn
     * chen ngang sẽ tạo đúng loại tranh chấp mà `transitionOrder` được dựng để chặn.
     */
    async expireOrders({ createdBefore }) {
      const rows = await query<{ id: string }>(
        `UPDATE "PurchaseOrder"
            SET "status"    = 'EXPIRED'::"OrderStatus",
                "reason"    = 'Quá hạn chưa khớp lệnh.',
                "updatedAt" = CURRENT_TIMESTAMP
          WHERE "status" = 'PLACED'::"OrderStatus"
            AND "createdAt" < $1::timestamptz
        RETURNING "id"`,
        [createdBefore],
      );
      return rows.length;
    },
  };
}
