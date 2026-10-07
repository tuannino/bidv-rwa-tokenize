import { AppLayout } from '@/components/layout/app-layout';
import { InvestorOrderDetailPage } from '@/components/pages/investor-order-detail';
import { getOwnAccountProfile } from '@/lib/bank/account-profile.service';

/**
 * Màn chi tiết một lệnh (FE-25). Nằm trong khu vực Nhà đầu tư nên cùng cổng `portfolio:read` với
 * danh sách: vai khác không mở được, kể cả khi gõ thẳng đường dẫn.
 */
export default async function InvestorOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getOwnAccountProfile();
  const mockWallet = profile.ok && profile.data.kind === 'CUSTOMER' ? profile.data.wallet : null;
  return (
    <AppLayout
      breadcrumbs={[
        { label: 'Nhà đầu tư' },
        { label: 'Quản lý lệnh', href: '/orders' },
        { label: id.slice(0, 8) },
      ]}
    >
      <InvestorOrderDetailPage orderId={id} mockWallet={mockWallet} />
    </AppLayout>
  );
}
