import { AppLayout } from '@/components/layout/app-layout';
import { RecallPage } from '@/components/pages/recall';
import { assertCan } from '@/lib/rbac';
import { currentRole } from '@/lib/rbac/session';

export default async function RecallRoute() {
  assertCan(await currentRole(), 'ops:read');
  return (
    <AppLayout breadcrumbs={[{ label: 'Vận hành' }, { label: 'Thu hồi token' }]}>
      <RecallPage />
    </AppLayout>
  );
}
