import { AppLayout } from '@/components/layout/app-layout';
import { DraftPage } from '@/components/pages/draft';

/**
 * Mục **Lập lệnh** — Giao dịch viên lập yêu cầu tạo / huỷ token (FE-22).
 *
 * Cổng `ops:draft:read` ở `(ops-draft)/layout.tsx` chặn Kiểm soát viên; quyền LẬP thật là
 * `order:draft`, kiểm trong `token-request.service`.
 */
export default function Draft() {
  return (
    <AppLayout breadcrumbs={[{ label: 'Vận hành' }, { label: 'Lập lệnh' }]}>
      <DraftPage />
    </AppLayout>
  );
}
