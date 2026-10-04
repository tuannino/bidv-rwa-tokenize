import { AppLayout } from '@/components/layout/app-layout';
import { OpsOrderDetailPage } from '@/components/pages/ops-order-detail';

/** Chi tiết một lệnh trong cùng khu vực `ops:read` với danh sách FE-06. */
export default async function OpsOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppLayout
      breadcrumbs={[
        { label: 'Vận hành' },
        { label: 'Giao dịch', href: '/transactions' },
        { label: id.slice(0, 8) },
      ]}
    >
      <OpsOrderDetailPage orderId={id} />
    </AppLayout>
  );
}
