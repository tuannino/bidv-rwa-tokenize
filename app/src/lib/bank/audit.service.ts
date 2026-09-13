import 'server-only';

import { assertCan } from '@/lib/rbac';
import { currentRole } from '@/lib/rbac/session';
import { getStore } from '@/lib/store';
import type { AuditRecord } from '@/lib/store';
import { err, ok, type Result } from './result';

/** Đọc audit log cho kênh `(audit)` — chỉ đọc, không có thao tác đặc quyền nào ở đây. */
export async function listAuditLog(limit = 50): Promise<Result<AuditRecord[]>> {
  try {
    const role = await currentRole();
    assertCan(role, 'audit:read');
    return ok(await getStore().listAudit({ limit }));
  } catch (error) {
    return err('FORBIDDEN', error instanceof Error ? error.message : 'Không có quyền đọc audit.');
  }
}
