import 'server-only';

import { serverEnv } from '@/lib/config/env';
import { createMemoryStore } from './memory.store';
import { createPostgresStore } from './postgres.store';
import type { IBankStore } from './store.port';

export {
  type AuditRecord,
  type IBankStore,
  type IOrderStore,
  type ITxnStore,
  type NewAudit,
  type NewOrder,
  type NewTxn,
  type OrderRecord,
  type OrderTransition,
  type TxnRecord,
} from './store.port';
export { resetMemoryStore } from './memory.store';

let cached: IBankStore | undefined;

/**
 * Factory theo flag `USE_MOCK_DB`:
 *   true  (mặc định) -> bộ nhớ, chạy được ở free-tier.
 *   false            -> Postgres qua DATABASE_URL (docker compose).
 */
export function getStore(): IBankStore {
  cached ??= serverEnv().useMockDb ? createMemoryStore() : createPostgresStore();
  return cached;
}

export function resetStoreCache(): void {
  cached = undefined;
}
