import { AppLayout } from '@/components/layout/app-layout';
import { BlockedNotice } from '@/components/ui/blocked-notice';
import { DemoPaymentPage } from '@/components/pages/demo-payment';
import { canMintDemoPayment } from '@/lib/rbac/demo-payment';
import { currentRole } from '@/lib/rbac/session';

/**
 * Nạp VNDB mô phỏng (BE-16). Khu vực `(ops)` đã chặn hai vai ngoài ngân hàng; trang này chặn thêm
 * bằng ĐÚNG hàm hai lớp của nghiệp vụ (`canMintDemoPayment`): cờ tắt, hoặc vai không phải Giao dịch
 * viên, thì vào bằng đường dẫn cũng chỉ thấy thông báo chặn. Chốt chặn thật vẫn ở service.
 */
export default async function DemoPayment() {
  const role = await currentRole();

  return (
    <AppLayout breadcrumbs={[{ label: 'Vận hành' }, { label: 'Nạp VNDB' }]}>
      {canMintDemoPayment(role) ? (
        <DemoPaymentPage />
      ) : (
        <BlockedNotice title="Chức năng nạp VNDB mô phỏng không khả dụng">
          <p className="text-sm text-muted-foreground">
            Chỉ mở khi máy chủ bật cờ ENABLE_DEMO_PAYMENT_MINT và vai hiện tại là Giao dịch viên. Vai
            hiện tại: <span className="font-code text-foreground">{role}</span>.
          </p>
        </BlockedNotice>
      )}
    </AppLayout>
  );
}
