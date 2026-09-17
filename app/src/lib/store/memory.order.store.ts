import 'server-only';

import { randomUUID } from 'node:crypto';
import { memoryState } from './memory.state';
import {
  assertOrderStatus,
  type IOrderStore,
  type NewOrder,
  type OrderRecord,
  type OrderTransition,
} from './order.store.port';
import { assertAmount, StoreUsageError, UniqueConstraintError } from './store.errors';

/**
 * Lệnh mua WPT trong bộ nhớ — mặc định, chạy được ở free-tier (không cần Postgres).
 *
 * ⚠️ Bản này phải NGHIÊM NGẶT NGANG bản Postgres (BE-09 QĐ-3): kiểm đủ ràng buộc duy nhất,
 * ném cùng lớp lỗi, từ chối cùng những giá trị. Bản bộ nhớ dễ tính hơn sẽ sinh loại lỗi
 * chỉ xuất hiện khi chạy `docker compose up` — xanh ở đây, đỏ ở đó.
 *
 * KHÔNG có giới hạn số dòng như `memory.store.ts` (MAX_ROWS = 500). Postgres không bao giờ
 * bỏ dòng, nên bỏ dòng ở đây là tạo ra một khác biệt hành vi nữa: một lệnh mua "biến mất"
 * và lần cập nhật sau trả `null` mà không lý do nào giải thích được.
 */

interface OrderState {
  orders: OrderRecord[];
}

const state = (): OrderState => memoryState('order', () => ({ orders: [] }));

/** Mới nhất trước; `id` chỉ để phá thế bằng khi hai dòng cùng mốc thời gian. */
const newestFirst = (a: OrderRecord, b: OrderRecord) =>
  b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);

const sameWallet = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * So sánh mốc thời gian theo GIÁ TRỊ, không so chuỗi.
 *
 * So chuỗi chỉ đúng khi mọi mốc cùng một dạng viết. Bản Postgres ép `$1::timestamptz` nên
 * `"2026-09-18T00:00:00+07:00"` và `"2026-09-17T17:00:00Z"` là CÙNG một thời điểm với nó,
 * còn so chuỗi thì ra kết quả ngược. Đây đúng là loại khác biệt mà QĐ-3 muốn chặn.
 */
const parseInstant = (field: string, value: string): number => {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new StoreUsageError(`"${field}" không phải mốc thời gian đọc được: "${value}".`);
  }
  return ms;
};

/**
 * Ràng buộc `PurchaseOrder_txHash_key`: một mã giao dịch không gắn cho hai lệnh.
 *
 * Postgres coi mỗi NULL là khác nhau nên lệnh chưa gửi giao dịch không đụng ràng buộc —
 * bản này phải cư xử giống, nên chỉ kiểm khi `txHash` không rỗng.
 */
function assertTxHashFree(txHash: string | null | undefined, ownerId: string): void {
  if (txHash === null || txHash === undefined) return;
  const clash = state().orders.find((order) => order.txHash === txHash && order.id !== ownerId);
  if (!clash) return;
  throw new UniqueConstraintError(
    'PurchaseOrder',
    ['txHash'],
    `Mã giao dịch này đã gắn cho lệnh "${clash.id}".`,
  );
}

export function createMemoryOrderStore(): IOrderStore {
  return {
    kind: 'memory',

    async createOrder(order: NewOrder): Promise<OrderRecord> {
      // Mọi phép kiểm chạy TRƯỚC mọi thay đổi trạng thái: thất bại giữa chừng sẽ để lại
      // dữ liệu nửa vời mà không lời gọi nào sau đó biết là nửa vời.
      const record: OrderRecord = {
        id: randomUUID(),
        chain: order.chain,
        investorWallet: order.investorWallet,
        wptAmount: assertAmount('wptAmount', order.wptAmount),
        vndAmount: assertAmount('vndAmount', order.vndAmount),
        status: assertOrderStatus(order.status ?? 'PLACED'),
        txHash: null,
        reason: null,
        actorRole: order.actorRole,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      state().orders.push(record);
      return { ...record };
    },

    async findOrder(id) {
      const found = state().orders.find((order) => order.id === id);
      return found ? { ...found } : null;
    },

    async transitionOrder(transition: OrderTransition) {
      const to = assertOrderStatus(transition.to);
      const from = transition.from.map((status) => assertOrderStatus(status));

      const found = state().orders.find((order) => order.id === transition.id);
      // Trạng thái hiện tại không nằm trong `from` -> KHÔNG dòng nào bị ảnh hưởng, đúng
      // như câu UPDATE có điều kiện của bản Postgres.
      if (!found || !from.includes(found.status)) return null;

      assertTxHashFree(transition.txHash, found.id);

      found.status = to;
      if (transition.txHash !== undefined) found.txHash = transition.txHash;
      if (transition.reason !== undefined) found.reason = transition.reason;
      found.updatedAt = new Date().toISOString();
      return { ...found };
    },

    async attachOrderTxHash({ id, txHash }) {
      const found = state().orders.find((order) => order.id === id);
      if (!found || found.status !== 'EXECUTING') return null;

      assertTxHashFree(txHash, found.id);

      found.txHash = txHash;
      found.updatedAt = new Date().toISOString();
      return { ...found };
    },

    async listOrders(options = {}) {
      const { chain, investorWallet, status, limit = 50 } = options;
      return state()
        .orders.filter((order) => (chain ? order.chain === chain : true))
        .filter((order) =>
          investorWallet ? sameWallet(order.investorWallet, investorWallet) : true,
        )
        .filter((order) => (status ? order.status === status : true))
        .sort(newestFirst)
        .slice(0, limit)
        .map((order) => ({ ...order }));
    },

    async expireOrders({ createdBefore, reason }) {
      const cutoff = parseInstant('createdBefore', createdBefore);
      const stale = state().orders.filter(
        (order) => order.status === 'PLACED' && Date.parse(order.createdAt) < cutoff,
      );
      const now = new Date().toISOString();
      for (const order of stale) {
        order.status = 'EXPIRED';
        // Chỉ ghi khi hồ sơ chưa có lý do — giữ đúng `COALESCE("reason", $2)` của bản Postgres.
        if (reason !== undefined && order.reason === null) order.reason = reason;
        order.updatedAt = now;
      }
      return stale.length;
    },
  };
}
