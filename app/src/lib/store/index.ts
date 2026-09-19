import 'server-only';

import { serverEnv } from '@/lib/config/env';
import type { IDistributionStore } from './distribution.store.port';
import type { IKeeperStore } from './keeper.store.port';
import { createMemoryDistributionStore } from './memory.distribution.store';
import { createMemoryKeeperStore } from './memory.keeper.store';
import { createMemoryOrderStore } from './memory.order.store';
import { createMemorySettlementStore } from './memory.settlement.store';
import { createMemoryStore } from './memory.store';
import type { IOrderStore } from './order.store.port';
import { createPostgresDistributionStore } from './postgres.distribution.store';
import { createPostgresKeeperStore } from './postgres.keeper.store';
import { createPostgresOrderStore } from './postgres.order.store';
import { createPostgresSettlementStore } from './postgres.settlement.store';
import { createPostgresStore } from './postgres.store';
import type { ISettlementStore } from './settlement.store.port';
import type { ITxnStore } from './store.port';

export {
  type AuditRecord,
  type ITxnStore,
  type NewAudit,
  type NewTxn,
  type TxnRecord,
} from './store.port';

export {
  assertAmount,
  assertStatus,
  ForeignKeyError,
  InvalidStatusError,
  type StoreKind,
  StoreUsageError,
  UniqueConstraintError,
} from './store.errors';

export {
  assertOrderStatus,
  type IOrderStore,
  type NewOrder,
  ORDER_STATUSES,
  type OrderRecord,
  type OrderStatus,
  type OrderTransition,
} from './order.store.port';

export {
  assertDistributionPayoutStatus,
  assertDistributionPeriodStatus,
  DISTRIBUTION_PAYOUT_STATUSES,
  DISTRIBUTION_PERIOD_STATUSES,
  type DistributionPayoutRecord,
  type DistributionPayoutStatus,
  type DistributionPeriodRecord,
  type DistributionPeriodStatus,
  type IDistributionStore,
  type NewDistributionPayout,
  type NewDistributionPeriod,
} from './distribution.store.port';

export {
  assertSettlementCaseStatus,
  assertSettlementRoundStatus,
  type ISettlementStore,
  type NewSettlementCase,
  type NewSettlementRound,
  SETTLEMENT_CASE_COLUMNS,
  SETTLEMENT_CASE_STATUSES,
  SETTLEMENT_ROUND_STATUSES,
  type SettlementCaseRecord,
  type SettlementCaseStatus,
  type SettlementRoundRecord,
  type SettlementRoundStatus,
} from './settlement.store.port';

export {
  assertKeeperRunStatus,
  type IKeeperStore,
  KEEPER_RUN_STATUSES,
  type KeeperRunRecord,
  type KeeperRunStatus,
  type KeeperRunTerminalStatus,
} from './keeper.store.port';

export { resetMemoryStore } from './memory.store';

/**
 * Factory cho từng cổng lưu trữ, chọn theo cờ `USE_MOCK_DB`:
 *   true  (mặc định) -> bộ nhớ, chạy được ở free-tier.
 *   false            -> Postgres qua DATABASE_URL (docker compose).
 *
 * Vì sao MỖI cổng một factory chứ không một `getStore()` trả về tất cả (BE-09 QĐ-1):
 * nghiệp vụ chỉ nhận đúng cổng nó cần, nên một service chia lợi nhuận không cầm trong tay
 * hàm ghi lệnh mua. Thêm cổng thứ năm cũng không phải sửa chữ ký nào đang dùng.
 *
 * Cache theo tiến trình: hai bản Postgres dùng chung một pool ở `postgres.pool.ts`, còn
 * hai bản bộ nhớ dùng chung `globalThis` ở `memory.state.ts`, nên cache ở đây chỉ để không
 * dựng lại đối tượng, không ảnh hưởng dữ liệu.
 */
const cache: {
  txn?: ITxnStore;
  order?: IOrderStore;
  distribution?: IDistributionStore;
  settlement?: ISettlementStore;
  keeper?: IKeeperStore;
} = {};

const wantsMemoryStore = (): boolean => serverEnv().useMockDb;

export function getStore(): ITxnStore {
  cache.txn ??= wantsMemoryStore() ? createMemoryStore() : createPostgresStore();
  return cache.txn;
}

export function getOrderStore(): IOrderStore {
  cache.order ??= wantsMemoryStore() ? createMemoryOrderStore() : createPostgresOrderStore();
  return cache.order;
}

/**
 * @pending BE-06 | cổng kỳ chia lợi nhuận đã sẵn ở cả hai bản (bộ nhớ + Postgres): `periodKey` duy nhất chặn mở kỳ hai lần, `(periodId, investorWallet)` duy nhất chặn chia trùng — hai ràng buộc đó là nơi giữ đúng đắn, đừng thay bằng phép kiểm trước khi ghi
 */
export function getDistributionStore(): IDistributionStore {
  cache.distribution ??= wantsMemoryStore()
    ? createMemoryDistributionStore()
    : createPostgresDistributionStore();
  return cache.distribution;
}

/**
 * @pending BE-05 | cổng đợt tất toán đã sẵn ở cả hai bản (bộ nhớ + Postgres): hồ sơ có bốn trạng thái, `(roundId, holderWallet)` duy nhất chặn một ví vào hai hồ sơ trong cùng đợt. Thứ tự bốn bước CỐ Ý để cho nghiệp vụ quyết, cổng chỉ giữ tập giá trị hợp lệ
 */
export function getSettlementStore(): ISettlementStore {
  cache.settlement ??= wantsMemoryStore()
    ? createMemorySettlementStore()
    : createPostgresSettlementStore();
  return cache.settlement;
}

/**
 * @pending BE-07 | cổng lần chạy định kỳ đã sẵn ở cả hai bản (bộ nhớ + Postgres): mở lần chạy ở `RUNNING` rồi đóng sang `SUCCESS` hoặc `FAILED`, nên tiến trình hẹn giờ có chỗ ghi vết mà không phải dựng bảng mới
 */
export function getKeeperStore(): IKeeperStore {
  cache.keeper ??= wantsMemoryStore() ? createMemoryKeeperStore() : createPostgresKeeperStore();
  return cache.keeper;
}

/**
 * Xoá cache của MỌI cổng.
 *
 * Một hàm cho tất cả, không phải một hàm mỗi cổng: test đổi `USE_MOCK_DB` rồi chỉ xoá cache
 * của một cổng sẽ để các cổng còn lại trỏ vào bản cũ, và triệu chứng là một test đỏ tuỳ
 * theo thứ tự chạy.
 */
export function resetStoreCache(): void {
  cache.txn = undefined;
  cache.order = undefined;
  cache.distribution = undefined;
  cache.settlement = undefined;
  cache.keeper = undefined;
}
