import { AppLayout } from '@/components/layout/app-layout';
import { DistributionApprovalPage } from '@/components/pages/distribution-approval';
import { assertCan } from '@/lib/rbac';
import { currentRole } from '@/lib/rbac/session';

/** FE-08: hai vai vận hành xem màn chia; chỉ Kiểm soát viên thấy nút duyệt (`distribution:approve`). */
export default async function DistributionPage() {
  assertCan(await currentRole(), 'reconcile:read');
  return (
    <AppLayout breadcrumbs={[{ label: 'Vận hành' }, { label: 'Chia lợi nhuận' }]}>
      <DistributionApprovalPage />
    </AppLayout>
  );
}
