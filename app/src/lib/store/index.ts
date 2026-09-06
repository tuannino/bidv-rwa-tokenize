import 'server-only';

import { serverEnv } from '@/lib/config/env';
import { createMemoryStore } from './memory.store';
import { createPostgresStore } from './postgres.store';
import type { ITxnStore } from './store.port';

export {
  type AuditRecord,
  type ITxnStore,
  type NewAudit,
  type NewTxn,
  type TxnRecord,
} from './store.port';
export { resetMemoryStore } from './memory.store';

let cached: ITxnStore | undefined;

/**
 * Factory theo flag `USE_MOCK_DB`:
 *   true  (mặc định) -> bộ nhớ, chạy được ở free-tier.
 *   false            -> Postgres qua DATABASE_URL (docker compose).
 */
export function getStore(): ITxnStore {
  cached ??= serverEnv().useMockDb ? createMemoryStore() : createPostgresStore();
  return cached;
}

export function resetStoreCache(): void {
  cached = undefined;
}
