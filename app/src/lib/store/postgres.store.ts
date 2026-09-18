import 'server-only';

import type { ChainKey, TxStatus } from '@bidv/shared';
import type { Role } from '@/lib/rbac';
import { pgQuery } from './postgres.pool';
import type { AuditRecord, ITxnStore, NewAudit, NewTxn, TxnRecord } from './store.port';

/**
 * Lưu Txn + audit vào Postgres (chế độ `docker compose up`, `USE_MOCK_DB=false`).
 *
 * Kết nối, việc áp lược đồ và lý do dùng `pg` thay vì Prisma Client: xem
 * `postgres.pool.ts` — một chỗ duy nhất cho cả năm cổng lưu trữ.
 *
 * Mọi câu lệnh đều tham số hoá ($1, $2, ...) — không nội suy chuỗi vào SQL.
 */

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
  const query = pgQuery;

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
