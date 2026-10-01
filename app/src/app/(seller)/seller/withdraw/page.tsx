import { AppLayout } from '@/components/layout/app-layout';
import { SellerWithdrawPage } from '@/components/pages/seller-withdraw';

export default function SellerWithdrawRoute() {
  return (
    <AppLayout breadcrumbs={[{ label: 'Người bán' }, { label: 'Tạo lệnh rút' }]}>
      <SellerWithdrawPage />
    </AppLayout>
  );
}
