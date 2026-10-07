import { AppLayout } from '@/components/layout/app-layout';
import { InvestorOrdersPage } from '@/components/pages/investor-orders';
import { getOwnAccountProfile } from '@/lib/bank/account-profile.service';

/** Màn Quản lý lệnh (FE-25). Cùng cổng khu vực Nhà đầu tư; lọc theo ví nằm ở tầng nghiệp vụ. */
export default async function InvestorOrders() {
  const profile = await getOwnAccountProfile();
  const mockWallet = profile.ok && profile.data.kind === 'CUSTOMER' ? profile.data.wallet : null;

  return (
    <AppLayout breadcrumbs={[{ label: 'Nhà đầu tư' }, { label: 'Quản lý lệnh' }]}>
      <InvestorOrdersPage mockWallet={mockWallet} />
    </AppLayout>
  );
}
