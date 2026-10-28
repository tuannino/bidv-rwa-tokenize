import { AppLayout } from '@/components/layout/app-layout';
import { InvestorWithdrawPage } from '@/components/pages/investor-withdraw';
import { ownMockWallet } from '@/lib/bank/account-profile.service';

/**
 * Màn Rút VNDB (FE-23). Cổng `portfolio:read` ở layout của khu vực Nhà đầu tư; tạo lệnh còn qua
 * `payment:withdraw` và chốt chặn ví của phiên ở tầng nghiệp vụ.
 */
export default async function InvestorWithdraw() {
  const mockWallet = await ownMockWallet();

  return (
    <AppLayout breadcrumbs={[{ label: 'Nhà đầu tư' }, { label: 'Rút VNDB' }]}>
      <InvestorWithdrawPage mockWallet={mockWallet} />
    </AppLayout>
  );
}
