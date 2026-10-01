import { AppLayout } from '@/components/layout/app-layout';
import { SellerOverviewPage } from '@/components/pages/seller-overview';

export default function SellerOverviewRoute() {
  return (
    <AppLayout breadcrumbs={[{ label: 'Người bán' }, { label: 'Tổng quan' }]}>
      <SellerOverviewPage />
    </AppLayout>
  );
}
