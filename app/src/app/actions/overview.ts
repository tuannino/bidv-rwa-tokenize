'use server';

import { getOpsOverview } from '@/lib/bank/overview.service';

/** FIX-05: vỏ mỏng; kiểm quyền `ops:read` nằm TRONG service (action gọi được bằng POST trực tiếp). */
export async function getOpsOverviewAction(chain: unknown) {
  return getOpsOverview(chain);
}
