'use server';

import { getVaultOverview } from '@/lib/bank/vault.service';

/** Vỏ transport mỏng; quyền `vault:read` được kiểm lại trong service. */
export async function getVaultOverviewAction(input: unknown) {
  return getVaultOverview(input);
}
