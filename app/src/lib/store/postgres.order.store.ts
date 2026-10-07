import 'server-only';

import { randomUUID } from 'node:crypto';
import type { ChainKey } from '@bidv/shared';
import type { Role } from '@/lib/rbac';
import {
  assertOrderSide,
  assertOrderStatus,
  ORDER_SIDES,
  ORDER_STATUS_STAMPS,
  type CompletedSummary,
  type IOrderStore,
  type NewOrder,
  type OrderRecord,
  type OrderSide,
  type OrderStatus,
  type OrderTransition,
} from './order.store.port';
import { pgQuery, type PgQuery } from './postgres.pool';
import { assertAmount, mapPgConstraintError } from './store.errors';

/**
 * Lệnh mua và bán WPT trong Postgres (`USE_MOCK_DB=false`).
 *
 * Mọi GIÁ TRỊ đi vào câu lệnh dưới dạng tham số `$n`. Chỗ duy nhất được nội suy vào chuỗi
 * SQL là TÊN CỘT lấy từ hằng số trong mã nguồn này — không có tên cột nào đến từ input.
 */

interface OrderRow {
  id: string;
  chain: string;
  investorWallet: string;
  clientRequestId: string;
  side: string;
  /** `pg` trả `numeric` về dạng chuỗi — đúng thứ ta cần, không phải chuyển đổi gì. */
  wptAmount: string;
  vndAmount: string;
  status: string;
  txHash: string | null;
  reason: string | null;
  actorRole: string;
  checkingAt: Date | null;
  reconciledAt: Date | null;
  settlingAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const isoOrNull = (value: Date | null): string | null => (value ? value.toISOString() : null);

const toOrder = (row: OrderRow): OrderRecord => ({
  id: row.id,
  chain: row.chain as ChainKey,
  investorWallet: row.investorWallet,
  clientRequestId: row.clientRequestId,
  side: row.side as OrderSide,
  wptAmount: row.wptAmount,
  vndAmount: row.vndAmount,
  status: row.status as OrderStatus,
  txHash: row.txHash,
  reason: row.reason,
  actorRole: row.actorRole as Role,
  checkingAt: isoOrNull(row.checkingAt),
  reconciledAt: isoOrNull(row.reconciledAt),
  settlingAt: isoOrNull(row.settlingAt),
  completedAt: isoOrNull(row.completedAt),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/**
 * `query` nhận được từ ngoài để test bơm vào một hàm giả — nhờ vậy kiểm được việc quy lỗi
 * `23505` của driver về `UniqueConstraintError` mà không cần dựng Postgres thật.
 */
export function createPostgresOrderStore(query: PgQuery = pgQuery): IOrderStore {
  return {
    kind: 'prisma',

    async createOrder(order: NewOrder): Promise<OrderRecord> {
      const status = assertOrderStatus(order.status ?? 'PLACED');
      const clientRequestId = order.clientRequestId ?? randomUUID();
      // Tạo thẳng ở một trạng thái có mốc (đường dựng dữ liệu thử) thì ghi mốc của trạng thái đó
      // trong chính câu INSERT. Tên cột lấy từ hằng số `ORDER_STATUS_STAMPS`, không từ input.
      const stamp = ORDER_STATUS_STAMPS[status];
      const rows = await mapPgConstraintError(() =>
        query<OrderRow>(
          `INSERT INTO "PurchaseOrder"
             ("id","chain","investorWallet","clientRequestId","wptAmount","vndAmount","status","actorRole","side","updatedAt"${stamp ? `,"${stamp}"` : ''})
           VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,CURRENT_TIMESTAMP${stamp ? ',CURRENT_TIMESTAMP' : ''})
           RETURNING *`,
          [
            order.chain,
            order.investorWallet,
            clientRequestId,
            assertAmount('wptAmount', order.wptAmount),
            assertAmount('vndAmount', order.vndAmount),
            status,
            order.actorRole,
            assertOrderSide(order.side ?? 'BUY'),
          ],
        ),
      );
      return toOrder(rows[0]);
    },

    async findOrder(id) {
      const rows = await query<OrderRow>(`SELECT * FROM "PurchaseOrder" WHERE "id" = $1`, [id]);
      return rows[0] ? toOrder(rows[0]) : null;
    },

    async findOrderByClientRequest({ investorWallet, clientRequestId }) {
      const rows = await query<OrderRow>(
        `SELECT * FROM "PurchaseOrder"
          WHERE "investorWallet" = $1 AND "clientRequestId" = $2`,
        [investorWallet, clientRequestId],
      );
      return rows[0] ? toOrder(rows[0]) : null;
    },

    async transitionOrder(transition: OrderTransition) {
      const to = assertOrderStatus(transition.to);
      const from = transition.from.map((status) => assertOrderStatus(status));

      const params: unknown[] = [transition.id, to];
      const sets = ['"status" = $2', '"updatedAt" = CURRENT_TIMESTAMP'];
      // Mốc bước quyết toán ghi TRONG cùng câu UPDATE với trạng thái — không lệch được nhau.
      // Tên cột lấy từ hằng số `ORDER_STATUS_STAMPS`, không từ input.
      const stamp = ORDER_STATUS_STAMPS[to];
      if (stamp) sets.push(`"${stamp}" = CURRENT_TIMESTAMP`);
      // `undefined` = không chạm cột; `null` = xoá giá trị cũ. Phân biệt được nhờ dựng
      // danh sách SET động, chứ `COALESCE($n, "col")` thì không xoá được.
      if (transition.txHash !== undefined) {
        params.push(transition.txHash);
        sets.push(`"txHash" = $${params.length}`);
      }
      if (transition.reason !== undefined) {
        params.push(transition.reason);
        sets.push(`"reason" = $${params.length}`);
      }
      params.push(from);

      // Điều kiện trạng thái nằm TRONG câu UPDATE: cơ sở dữ liệu làm trọng tài, nên hai
      // tiến trình cùng chạy chỉ một bên đổi được. Đọc rồi ghi thành hai bước thì cả hai
      // đều thấy "được phép" và cùng gửi giao dịch.
      const rows = await mapPgConstraintError(() =>
        query<OrderRow>(
          `UPDATE "PurchaseOrder" SET ${sets.join(', ')}
            WHERE "id" = $1 AND "status" = ANY($${params.length}::text[])
            RETURNING *`,
          params,
        ),
      );
      return rows[0] ? toOrder(rows[0]) : null;
    },

    async attachOrderTxHash({ id, txHash }) {
      const rows = await mapPgConstraintError(() =>
        query<OrderRow>(
          `UPDATE "PurchaseOrder"
              SET "txHash" = $2, "settlingAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = $1 AND "status" = $3
            RETURNING *`,
          [id, txHash, 'EXECUTING' satisfies OrderStatus],
        ),
      );
      return rows[0] ? toOrder(rows[0]) : null;
    },

    async listOrders(options = {}) {
      const { chain, investorWallet, status, side, id, search, createdFrom, createdTo, limit = 50, offset = 0 } =
        options;
      const rows = await query<OrderRow>(
        `SELECT * FROM "PurchaseOrder"
          WHERE ($1::text IS NULL OR "chain" = $1)
            AND ($2::text IS NULL OR lower("investorWallet") = lower($2))
            AND ($3::text IS NULL OR "status" = $3)
            AND ($5::text IS NULL OR "side" = $5)
            AND ($6::text IS NULL OR "id" = $6)
            AND ($7::timestamptz IS NULL OR "createdAt" >= $7::timestamptz)
            AND ($8::timestamptz IS NULL OR "createdAt" < $8::timestamptz)
            AND ($9::text IS NULL
              OR position(lower($9) in lower("id")) > 0
              OR position(lower($9) in lower("investorWallet")) > 0)
          ORDER BY "createdAt" DESC, "id" DESC
          LIMIT $4 OFFSET $10`,
        [
          chain ?? null,
          investorWallet ?? null,
          status ?? null,
          limit,
          side === undefined ? null : assertOrderSide(side),
          id ?? null,
          createdFrom ?? null,
          createdTo ?? null,
          search?.trim() || null,
          offset,
        ],
      );
      return rows.map(toOrder);
    },

    async countOrders(options = {}) {
      const { chain, investorWallet, status, side, id, search, createdFrom, createdTo } = options;
      const rows = await query<{ count: string }>(
        `SELECT COUNT(*)::text AS "count" FROM "PurchaseOrder"
          WHERE ($1::text IS NULL OR "chain" = $1)
            AND ($2::text IS NULL OR lower("investorWallet") = lower($2))
            AND ($3::text IS NULL OR "status" = $3)
            AND ($4::text IS NULL OR "side" = $4)
            AND ($5::text IS NULL OR "id" = $5)
            AND ($6::timestamptz IS NULL OR "createdAt" >= $6::timestamptz)
            AND ($7::timestamptz IS NULL OR "createdAt" < $7::timestamptz)
            AND ($8::text IS NULL
              OR position(lower($8) in lower("id")) > 0
              OR position(lower($8) in lower("investorWallet")) > 0)`,
        [
          chain ?? null,
          investorWallet ?? null,
          status ?? null,
          side === undefined ? null : assertOrderSide(side),
          id ?? null,
          createdFrom ?? null,
          createdTo ?? null,
          search?.trim() || null,
        ],
      );
      return Number(rows[0]?.count ?? 0);
    },

    async listOrderInvestors({ chain } = {}) {
      const rows = await query<{ investorWallet: string }>(
        `SELECT DISTINCT ON (lower("investorWallet")) "investorWallet" FROM "PurchaseOrder"
          WHERE ($1::text IS NULL OR "chain" = $1)
          ORDER BY lower("investorWallet"), "investorWallet"`,
        [chain ?? null],
      );
      return rows.map((row) => row.investorWallet);
    },

    async summarizeCompleted({ chain, from, to }) {
      const rows = await query<{ side: string; count: string; wpt: string; vnd: string }>(
        `SELECT "side", COUNT(*)::text AS "count",
                COALESCE(SUM("wptAmount"), 0)::text AS "wpt",
                COALESCE(SUM("vndAmount"), 0)::text AS "vnd"
           FROM "PurchaseOrder"
          WHERE "status" = $1
            AND ($2::text IS NULL OR "chain" = $2)
            AND "completedAt" >= $3::timestamptz AND "completedAt" < $4::timestamptz
          GROUP BY "side"`,
        ['COMPLETED' satisfies OrderStatus, chain ?? null, from, to],
      );
      // Đủ hai chiều kể cả khi `GROUP BY` không trả dòng nào cho một chiều.
      return Object.fromEntries(
        ORDER_SIDES.map((side) => {
          const row = rows.find((r) => r.side === side);
          return [
            side,
            {
              count: row ? Number(row.count) : 0,
              wptAmount: row?.wpt ?? '0',
              vndAmount: row?.vnd ?? '0',
            } satisfies CompletedSummary,
          ];
        }),
      ) as Record<OrderSide, CompletedSummary>;
    },

    async expireOrders({ createdBefore, reason }) {
      const rows = await query<{ id: string }>(
        `UPDATE "PurchaseOrder"
            SET "status" = $3,
                "reason" = COALESCE("reason", $4),
                "updatedAt" = CURRENT_TIMESTAMP
          WHERE "status" = $2 AND "createdAt" < $1::timestamptz
          RETURNING "id"`,
        [
          createdBefore,
          'PLACED' satisfies OrderStatus,
          'EXPIRED' satisfies OrderStatus,
          reason ?? null,
        ],
      );
      return rows.length;
    },
  };
}
