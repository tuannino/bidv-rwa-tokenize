import 'server-only';

import type { ChainKey } from '@bidv/shared';
import type { Role } from '@/lib/rbac';
import {
  assertOrderStatus,
  type IOrderStore,
  type NewOrder,
  type OrderRecord,
  type OrderStatus,
  type OrderTransition,
} from './order.store.port';
import { pgQuery, type PgQuery } from './postgres.pool';
import { assertAmount, mapPgConstraintError } from './store.errors';

/**
 * Lệnh mua WPT trong Postgres (`USE_MOCK_DB=false`).
 *
 * Mọi GIÁ TRỊ đi vào câu lệnh dưới dạng tham số `$n`. Chỗ duy nhất được nội suy vào chuỗi
 * SQL là TÊN CỘT lấy từ hằng số trong mã nguồn này — không có tên cột nào đến từ input.
 */

interface OrderRow {
  id: string;
  chain: string;
  investorWallet: string;
  /** `pg` trả `numeric` về dạng chuỗi — đúng thứ ta cần, không phải chuyển đổi gì. */
  wptAmount: string;
  vndAmount: string;
  status: string;
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
  status: row.status as OrderStatus,
  txHash: row.txHash,
  reason: row.reason,
  actorRole: row.actorRole as Role,
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
      const rows = await mapPgConstraintError(() =>
        query<OrderRow>(
          `INSERT INTO "PurchaseOrder"
             ("id","chain","investorWallet","wptAmount","vndAmount","status","actorRole","updatedAt")
           VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP)
           RETURNING *`,
          [
            order.chain,
            order.investorWallet,
            assertAmount('wptAmount', order.wptAmount),
            assertAmount('vndAmount', order.vndAmount),
            assertOrderStatus(order.status ?? 'PLACED'),
            order.actorRole,
          ],
        ),
      );
      return toOrder(rows[0]);
    },

    async findOrder(id) {
      const rows = await query<OrderRow>(`SELECT * FROM "PurchaseOrder" WHERE "id" = $1`, [id]);
      return rows[0] ? toOrder(rows[0]) : null;
    },

    async transitionOrder(transition: OrderTransition) {
      const to = assertOrderStatus(transition.to);
      const from = transition.from.map((status) => assertOrderStatus(status));

      const params: unknown[] = [transition.id, to];
      const sets = ['"status" = $2', '"updatedAt" = CURRENT_TIMESTAMP'];
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
              SET "txHash" = $2, "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = $1 AND "status" = $3
            RETURNING *`,
          [id, txHash, 'EXECUTING' satisfies OrderStatus],
        ),
      );
      return rows[0] ? toOrder(rows[0]) : null;
    },

    async listOrders(options = {}) {
      const { chain, investorWallet, status, limit = 50 } = options;
      const rows = await query<OrderRow>(
        `SELECT * FROM "PurchaseOrder"
          WHERE ($1::text IS NULL OR "chain" = $1)
            AND ($2::text IS NULL OR lower("investorWallet") = lower($2))
            AND ($3::text IS NULL OR "status" = $3)
          ORDER BY "createdAt" DESC, "id" DESC
          LIMIT $4`,
        [chain ?? null, investorWallet ?? null, status ?? null, limit],
      );
      return rows.map(toOrder);
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
