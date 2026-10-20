'use server';

import { getVaultOverview, saveVaultConfig } from '@/lib/bank/vault.service';

/** Vỏ transport mỏng; quyền `vault:read` được kiểm lại trong service. */
export async function getVaultOverviewAction(input: unknown) {
  return getVaultOverview(input);
}

/** Vỏ transport mỏng; quyền `vault:configure` và khoá vận hành nằm trong service (BE-13 QĐ-C). */
export async function saveVaultConfigAction(input: unknown) {
  return saveVaultConfig(input);
}
