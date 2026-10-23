import { AppLayout } from '@/components/layout/app-layout';
import { PriceConfigPage } from '@/components/pages/price-config';
import { assertCan } from '@/lib/rbac';
import { currentRole } from '@/lib/rbac/session';

/** FE-07: hai vai vận hành xem màn; chỉ vai có quyền cấu hình (Giao dịch viên) thấy khối "Đổi giá". */
export default async function PriceConfigRoute() {
  assertCan(await currentRole(), 'ops:read');
  return (
    <AppLayout breadcrumbs={[{ label: 'Vận hành' }, { label: 'Giá và phát hành' }]}>
      <PriceConfigPage />
    </AppLayout>
  );
}
