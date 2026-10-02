import { AppLayout } from '@/components/layout/app-layout';
import { ApprovalDetailPage } from '@/components/pages/approval-detail';

/**
 * Màn chi tiết một yêu cầu — cùng khu vực Kiểm soát nên cùng cổng `ops:approve:read` với danh
 * sách: Giao dịch viên không mở được, kể cả khi gõ thẳng đường dẫn.
 */
export default async function ApprovalDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppLayout
      breadcrumbs={[
        { label: 'Kiểm soát' },
        { label: 'Phê duyệt lệnh', href: '/approvals' },
        { label: id.slice(0, 8) },
      ]}
    >
      <ApprovalDetailPage requestId={id} />
    </AppLayout>
  );
}
