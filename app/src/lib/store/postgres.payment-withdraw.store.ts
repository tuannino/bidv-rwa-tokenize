import 'server-only';

import type { ChainKey } from '@bidv/shared';
import { pgQuery, type PgQuery } from './postgres.pool';
import { assertAmount, mapPgConstraintError } from './store.errors';
import {
  activeWalletKey,
  assertPaymentWithdrawTransition,
  PAYMENT_WITHDRAW_PENDING_STATUSES,
  type IPaymentWithdrawStore,
  type PaymentWithdrawRecord,
  type PaymentWithdrawStatus,
} from './payment-withdraw.store.port';

/** Lệnh rút VNDB của Nhà đầu tư trong Postgres (`USE_MOCK_DB=false`, FE-23). */

interface PaymentWithdrawRow {
  id: string;
  chain: string;
  clientRequestId: string;
  actorId: string;
  fromWallet: string;
  fromWalletKey: string;
  toWallet: string;
  amount: string;
  purpose: string;
  note: string | null;
  status: string;
  activeWallet: string | null;
  createdBlock: string | null;
  submittedTxHash: string | null;
  submittedAt: Date | null;
  sendingAt: Date | null;
  completedTxHash: string | null;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

const toRecord = (row: PaymentWithdrawRow): PaymentWithdrawRecord => ({
  id: row.id,
  chain: row.chain as ChainKey,
  clientRequestId: row.clientRequestId,
  actorId: row.actorId,
  fromWallet: row.fromWallet,
  fromWalletKey: row.fromWalletKey,
  toWallet: row.toWallet,
  amount: row.amount,
  purpose: row.purpose,
  note: row.note,
  status: row.status as PaymentWithdrawStatus,
  activeWallet: row.activeWallet,
  createdBlock: row.createdBlock,
  submittedTxHash: row.submittedTxHash,
  submittedAt: row.submittedAt?.toISOString() ?? null,
  sendingAt: row.sendingAt?.toISOString() ?? null,
  completedTxHash: row.completedTxHash,
  reason: row.reason,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  completedAt: row.completedAt?.toISOString() ?? null,
});

export function createPostgresPaymentWithdrawStore(query: PgQuery = pgQuery): IPaymentWithdrawStore {
  return {
    kind: 'prisma',

    async create(input) {
      const rows = await mapPgConstraintError(() =>
        query<PaymentWithdrawRow>(
          `INSERT INTO "PaymentWithdrawRequest"
             ("id","chain","clientRequestId","actorId","fromWallet","fromWalletKey","toWallet","amount",
              "purpose","note","status","activeWallet","createdBlock","updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8::numeric,$9,$10,'CREATED',$11,$12::numeric,CURRENT_TIMESTAMP)
           RETURNING *`,
          [
            input.id,
            input.chain,
            input.clientRequestId,
            input.actorId,
            input.fromWallet,
            input.fromWallet.toLowerCase(),
            input.toWallet,
            assertAmount('amount', input.amount),
            input.purpose,
            input.note,
            activeWalletKey(input.chain, input.fromWallet),
            input.createdBlock === null ? null : assertAmount('createdBlock', input.createdBlock),
          ],
        ),
      );
      return toRecord(rows[0]);
    },

    async findById(id) {
      const rows = await query<PaymentWithdrawRow>(`SELECT * FROM "PaymentWithdrawRequest" WHERE "id" = $1`, [id]);
      return rows[0] ? toRecord(rows[0]) : null;
    },

    async findByClientRequest({ chain, wallet, clientRequestId }) {
      const rows = await query<PaymentWithdrawRow>(
        `SELECT * FROM "PaymentWithdrawRequest"
          WHERE "chain" = $1 AND "fromWalletKey" = $2 AND "clientRequestId" = $3`,
        [chain, wallet.toLowerCase(), clientRequestId],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    },

    async findActive(chain, wallet) {
      const rows = await query<PaymentWithdrawRow>(
        `SELECT * FROM "PaymentWithdrawRequest" WHERE "activeWallet" = $1`,
        [activeWalletKey(chain, wallet)],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    },

    async listByWallet(chain, wallet, { statuses, since, sentOnly, limit }) {
      const rows = await query<PaymentWithdrawRow>(
        `SELECT * FROM "PaymentWithdrawRequest"
          WHERE "chain" = $1 AND "fromWalletKey" = $2
            AND ($3::text[] IS NULL OR "status" = ANY($3::text[]))
            AND ($4::timestamptz IS NULL OR "sendingAt" >= $4::timestamptz)
            AND (NOT $5::boolean OR "sendingAt" IS NOT NULL)
          ORDER BY "createdAt" DESC, "id" DESC
          LIMIT $6`,
        [chain, wallet.toLowerCase(), statuses ? [...statuses] : null, since ?? null, sentOnly === true, limit],
      );
      return rows.map(toRecord);
    },

    async findByCompletedTx(chain, txHash) {
      const rows = await query<PaymentWithdrawRow>(
        `SELECT * FROM "PaymentWithdrawRequest" WHERE "chain" = $1 AND lower("completedTxHash") = lower($2)`,
        [chain, txHash],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    },

    async transition({ id, from, to, submittedTxHash, completedTxHash, reason }) {
      assertPaymentWithdrawTransition(from, to);
      const terminal = !PAYMENT_WITHDRAW_PENDING_STATUSES.includes(to);
      // MỘT câu có điều kiện trạng thái: về trạng thái cuối thì `activeWallet` về NULL cùng lúc.
      const rows = await mapPgConstraintError(() =>
        query<PaymentWithdrawRow>(
          `UPDATE "PaymentWithdrawRequest"
              SET "status" = $3,
                  "submittedTxHash" = CASE WHEN $4::boolean THEN $5 ELSE "submittedTxHash" END,
                  "completedTxHash" = CASE WHEN $6::boolean THEN $7 ELSE "completedTxHash" END,
                  "reason" = CASE WHEN $8::boolean THEN $9 ELSE "reason" END,
                  "sendingAt" = CASE WHEN $3 = 'SENDING' THEN CURRENT_TIMESTAMP ELSE "sendingAt" END,
                  "submittedAt" = CASE WHEN $3 = 'SUBMITTED' THEN CURRENT_TIMESTAMP ELSE "submittedAt" END,
                  "activeWallet" = CASE WHEN $10::boolean THEN NULL ELSE "activeWallet" END,
                  "completedAt" = CASE WHEN $10::boolean THEN CURRENT_TIMESTAMP ELSE "completedAt" END,
                  "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = $1 AND "status" = $2
            RETURNING *`,
          [
            id,
            from,
            to,
            submittedTxHash !== undefined,
            submittedTxHash ?? null,
            completedTxHash !== undefined,
            completedTxHash ?? null,
            reason !== undefined,
            reason ?? null,
            terminal,
          ],
        ),
      );
      return rows[0] ? toRecord(rows[0]) : null;
    },

    async noteReason({ id, reason }) {
      await query(
        `UPDATE "PaymentWithdrawRequest" SET "reason" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1`,
        [id, reason],
      );
    },
  };
}
