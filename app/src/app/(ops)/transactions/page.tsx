import { AppLayout } from '@/components/layout/app-layout';
import { OpsTransactionsPage } from '@/components/pages/ops-transactions';

export default function OpsTransactionsRoute() {
  return (
    <AppLayout breadcrumbs={[{ label: 'Vận hành' }, { label: 'Giao dịch' }]}>
      <OpsTransactionsPage />
    </AppLayout>
  );
}
