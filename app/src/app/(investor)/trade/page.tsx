import { AppLayout } from '@/components/layout/app-layout';
import { InvestorTradePage } from '@/components/pages/investor-trade';
import { ownMockWallet } from '@/lib/bank/account-profile.service';

/**
 * Màn Giao dịch token (FE-25). Cổng `portfolio:read` ở layout của khu vực Nhà đầu tư, nên vai khác
 * gõ thẳng đường dẫn cũng bị chặn; đặt lệnh còn qua `order:place` ở tầng nghiệp vụ.
 */
export default async function TradePage() {
  const mockWallet = await ownMockWallet();

  return (
    <AppLayout breadcrumbs={[{ label: 'Nhà đầu tư' }, { label: 'Giao dịch token' }]}>
      <InvestorTradePage mockWallet={mockWallet} />
    </AppLayout>
  );
}
