import { AppLayout } from '@/components/layout/app-layout';
import { VaultStatusPage } from '@/components/pages/vault-status';
import { assertCan } from '@/lib/rbac';
import { currentRole } from '@/lib/rbac/session';

export default async function VaultPage() {
  assertCan(await currentRole(), 'vault:read');
  return (
    <AppLayout breadcrumbs={[{ label: 'Vận hành' }, { label: 'Vault thanh toán SPV' }]}>
      <VaultStatusPage />
    </AppLayout>
  );
}
