import { AppLayout } from '@/components/layout/app-layout';
import { InvestorOrdersPage } from '@/components/pages/investor-orders';
import { ownMockWallet } from '@/lib/bank/account-profile.service';

/** Màn Quản lý lệnh (FE-25). Cùng cổng khu vực Nhà đầu tư; lọc theo ví nằm ở tầng nghiệp vụ. */
export default async function InvestorOrders() {
  const mockWallet = await ownMockWallet();

  return (
    <AppLayout breadcrumbs={[{ label: 'Nhà đầu tư' }, { label: 'Quản lý lệnh' }]}>
      <InvestorOrdersPage mockWallet={mockWallet} />
    </AppLayout>
  );
}
