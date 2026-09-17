import { AppLayout } from '@/components/layout/app-layout';
import { INVESTOR_NAV } from '@/components/layout/nav-config';
import { InvestorPortfolioPage } from '@/components/pages/investor-portfolio';

/**
 * `/portfolio` — trang mặc định của kênh nhà đầu tư.
 *
 * `AppLayout` đặt ở page (không ở `layout.tsx` của group) theo đúng hiện trạng repo: `(admin)`
 * và `(audit)` đều làm vậy, và `layout.tsx` chỉ giữ `ChannelGuard`. Đặt cả hai chỗ sẽ lồng
 * layout hai lần.
 */
export default function PortfolioPage() {
  return (
    <AppLayout nav={INVESTOR_NAV} breadcrumbs={[{ label: 'Nhà đầu tư' }, { label: 'Tổng quan' }]}>
      <InvestorPortfolioPage />
    </AppLayout>
  );
}
