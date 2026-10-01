import { AppLayout } from '@/components/layout/app-layout';
import { ApprovalsPage } from '@/components/pages/approvals';

/**
 * Mục **Phê duyệt lệnh** — Kiểm soát viên (FE-22).
 *
 * Cổng `ops:approve:read` ở `(control)/layout.tsx` chặn Giao dịch viên; quyền DUYỆT thật là
 * `order:approve`, kiểm trong `token-request.service`.
 */
export default function Approvals() {
  return (
    <AppLayout breadcrumbs={[{ label: 'Kiểm soát' }, { label: 'Phê duyệt lệnh' }]}>
      <ApprovalsPage />
    </AppLayout>
  );
}
