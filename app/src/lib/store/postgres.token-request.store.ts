import 'server-only';

import type { ChainKey } from '@bidv/shared';
import type { Role } from '@/lib/rbac';
import { pgQuery, type PgQuery } from './postgres.pool';
import { assertAmount, mapPgConstraintError } from './store.errors';
import {
  assertTokenRequestBurnSource,
  assertTokenRequestStatus,
  assertTokenRequestTransition,
  assertTokenRequestType,
  DECISION_STATUSES,
  type ITokenRequestStore,
  type NewTokenRequest,
  OUTCOME_STATUSES,
  type TokenRequestBurnSource,
  type TokenRequestRecord,
  type TokenRequestStatus,
  type TokenRequestTransition,
  type TokenRequestType,
} from './token-request.store.port';

/**
 * Yêu cầu Mint / Burn trong Postgres (`USE_MOCK_DB=false`).
 *
 * Mọi GIÁ TRỊ đi vào câu lệnh dưới dạng tham số `$n`. Chỗ duy nhất nội suy vào SQL là TÊN CỘT
 * lấy từ hằng số trong tệp này.
 */

interface TokenRequestRow {
  id: string;
  chain: string;
  tokenSymbol: string;
  type: string;
  amount: string;
  burnSource: string | null;
  wallet: string;
  reason: string;
  documentRef: string | null;
  effectiveDate: Date | null;
  note: string | null;
  makerId: string;
  makerRole: string;
  checkerId: string | null;
  checkerRole: string | null;
  status: string;
  rejectReason: string | null;
  failureReason: string | null;
  txHash: string | null;
  createdAt: Date;
  decidedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
}

const iso = (value: Date | null): string | null => (value ? value.toISOString() : null);

const toRequest = (row: TokenRequestRow): TokenRequestRecord => ({
  id: row.id,
  chain: row.chain as ChainKey,
  tokenSymbol: row.tokenSymbol,
  type: row.type as TokenRequestType,
  amount: row.amount,
  burnSource: row.burnSource as TokenRequestBurnSource | null,
  wallet: row.wallet,
  reason: row.reason,
  documentRef: row.documentRef,
  effectiveDate: iso(row.effectiveDate),
  note: row.note,
  makerId: row.makerId,
  makerRole: row.makerRole as Role,
  checkerId: row.checkerId,
  checkerRole: row.checkerRole as Role | null,
  status: row.status as TokenRequestStatus,
  rejectReason: row.rejectReason,
  failureReason: row.failureReason,
  txHash: row.txHash,
  createdAt: row.createdAt.toISOString(),
  decidedAt: iso(row.decidedAt),
  completedAt: iso(row.completedAt),
  updatedAt: row.updatedAt.toISOString(),
});

/** Cột ghi được qua `transitionRequest` — tên cột là hằng số, không đến từ input. */
const TRANSITION_COLUMNS = [
  'checkerId',
  'checkerRole',
  'rejectReason',
  'failureReason',
  'txHash',
] as const;

export function createPostgresTokenRequestStore(query: PgQuery = pgQuery): ITokenRequestStore {
  return {
    kind: 'prisma',

    async createRequest(request: NewTokenRequest) {
      const rows = await mapPgConstraintError(() =>
        query<TokenRequestRow>(
          `INSERT INTO "TokenRequest"
             ("id","chain","tokenSymbol","type","amount","burnSource","wallet","reason",
              "documentRef","effectiveDate","note","makerId","makerRole","status","updatedAt")
           VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10,$11,$12,$13,
                   CURRENT_TIMESTAMP)
           RETURNING *`,
          [
            request.chain,
            request.tokenSymbol,
            assertTokenRequestType(request.type),
            assertAmount('amount', request.amount),
            request.burnSource == null ? null : assertTokenRequestBurnSource(request.burnSource),
            request.wallet,
            request.reason,
            request.documentRef ?? null,
            request.effectiveDate ?? null,
            request.note ?? null,
            request.makerId,
            request.makerRole,
            'PENDING' satisfies TokenRequestStatus,
          ],
        ),
      );
      return toRequest(rows[0]);
    },

    async findRequest(id) {
      const rows = await query<TokenRequestRow>(`SELECT * FROM "TokenRequest" WHERE "id" = $1`, [
        id,
      ]);
      return rows[0] ? toRequest(rows[0]) : null;
    },

    async transitionRequest(transition: TokenRequestTransition) {
      const to = assertTokenRequestStatus(transition.to);
      const from = transition.from.map((status) => assertTokenRequestStatus(status));
      assertTokenRequestTransition(from, to);

      const params: unknown[] = [transition.id, to];
      const sets = ['"status" = $2', '"updatedAt" = CURRENT_TIMESTAMP'];
      for (const column of TRANSITION_COLUMNS) {
        const value = transition[column];
        if (value === undefined) continue;
        params.push(value);
        sets.push(`"${column}" = $${params.length}`);
      }
      if (DECISION_STATUSES.includes(to)) sets.push('"decidedAt" = CURRENT_TIMESTAMP');
      if (OUTCOME_STATUSES.includes(to)) sets.push('"completedAt" = CURRENT_TIMESTAMP');
      params.push(from);

      // Điều kiện trạng thái nằm TRONG câu UPDATE: hai người duyệt cùng lúc thì cơ sở dữ liệu
      // chỉ cho một câu đổi được dòng, câu kia nhận 0 dòng và người gọi dừng.
      const rows = await mapPgConstraintError(() =>
        query<TokenRequestRow>(
          `UPDATE "TokenRequest" SET ${sets.join(', ')}
            WHERE "id" = $1 AND "status" = ANY($${params.length}::text[])
            RETURNING *`,
          params,
        ),
      );
      return rows[0] ? toRequest(rows[0]) : null;
    },

    async attachRequestTxHash({ id, txHash }) {
      const rows = await mapPgConstraintError(() =>
        query<TokenRequestRow>(
          `UPDATE "TokenRequest"
              SET "txHash" = $2, "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = $1 AND "status" = $3
            RETURNING *`,
          [id, txHash, 'EXECUTING' satisfies TokenRequestStatus],
        ),
      );
      return rows[0] ? toRequest(rows[0]) : null;
    },

    async listRequests(options = {}) {
      const { chain, tokenSymbol, type, status, makerId, limit = 50 } = options;
      const rows = await query<TokenRequestRow>(
        `SELECT * FROM "TokenRequest"
          WHERE ($1::text IS NULL OR "chain" = $1)
            AND ($2::text IS NULL OR "tokenSymbol" = $2)
            AND ($3::text IS NULL OR "type" = $3)
            AND ($4::text IS NULL OR "status" = $4)
            AND ($5::text IS NULL OR "makerId" = $5)
          ORDER BY "createdAt" DESC, "id" DESC
          LIMIT $6`,
        [chain ?? null, tokenSymbol ?? null, type ?? null, status ?? null, makerId ?? null, limit],
      );
      return rows.map(toRequest);
    },

    async countRequests({ status, makerId, excludeMakerId, type, decidedFrom }) {
      const rows = await query<{ count: string }>(
        `SELECT COUNT(*)::text AS "count" FROM "TokenRequest"
          WHERE "status" = $1
            AND ($2::text IS NULL OR "makerId" = $2)
            AND ($3::text IS NULL OR "makerId" <> $3)
            AND ($4::text IS NULL OR "type" = $4)
            AND ($5::timestamptz IS NULL OR "decidedAt" >= $5::timestamptz)`,
        [
          assertTokenRequestStatus(status),
          makerId ?? null,
          excludeMakerId ?? null,
          type ?? null,
          decidedFrom ?? null,
        ],
      );
      return Number(rows[0]?.count ?? 0);
    },
  };
}
