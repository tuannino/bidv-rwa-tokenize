import { AppLayout } from '@/components/layout/app-layout';
import { SellerTransactionsPage } from '@/components/pages/seller-transactions';

export default function SellerTransactionsRoute() {
  return (
    <AppLayout breadcrumbs={[{ label: 'Người bán' }, { label: 'Danh sách giao dịch' }]}>
      <SellerTransactionsPage />
    </AppLayout>
  );
}
