import { AppLayout } from '@/components/layout/app-layout';
import { InvestorOrdersPage } from '@/components/pages/investor-orders';

/** Màn Quản lý lệnh (FE-25). Cùng cổng khu vực Nhà đầu tư; lọc theo ví nằm ở tầng nghiệp vụ. */
export default function InvestorOrders() {
  return (
    <AppLayout breadcrumbs={[{ label: 'Nhà đầu tư' }, { label: 'Quản lý lệnh' }]}>
      <InvestorOrdersPage />
    </AppLayout>
  );
}
