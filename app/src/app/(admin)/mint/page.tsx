import { AppLayout } from '@/components/layout/app-layout';
import { MintPage } from '@/components/pages/mint';

export default function Mint() {
  return (
    <AppLayout breadcrumbs={[{ label: 'Ngân hàng' }, { label: 'Phát hành token' }]}>
      <MintPage />
    </AppLayout>
  );
}
