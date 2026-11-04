import { AppLayout } from '@/components/layout/app-layout';
import { BlockedNotice } from '@/components/ui/blocked-notice';
import { WalletBindingPage } from '@/components/pages/wallet-binding';
import { can } from '@/lib/rbac';
import { currentRole } from '@/lib/rbac/session';

/**
 * Định danh ví (FIX-01 B1). Khu vực `(ops)` đã chặn hai vai ngoài ngân hàng; trang này chặn thêm theo
 * quyền `investor:whitelist` (chỉ Giao dịch viên): vai khác vào bằng đường dẫn chỉ thấy thông báo
 * chặn. Chốt chặn thật vẫn ở service.
 */
export default async function WalletBinding() {
  const role = await currentRole();

  return (
    <AppLayout breadcrumbs={[{ label: 'Vận hành' }, { label: 'Nghiệp vụ ẩn' }, { label: 'Định danh ví' }]}>
      {can(role, 'investor:whitelist') ? (
        <WalletBindingPage />
      ) : (
        <BlockedNotice title="Chức năng định danh ví không khả dụng">
          <p className="text-sm text-muted-foreground">
            Chỉ Giao dịch viên định danh và gắn ví cho hồ sơ khách hàng. Vai hiện tại:{' '}
            <span className="font-code text-foreground">{role}</span>.
          </p>
        </BlockedNotice>
      )}
    </AppLayout>
  );
}
