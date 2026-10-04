import { ShieldX } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
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
        <div className="mx-auto max-w-md space-y-3 rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-center">
          <ShieldX className="mx-auto h-8 w-8 text-destructive" aria-hidden="true" />
          <h1 className="text-lg font-semibold">Chức năng nạp VNDB mô phỏng không khả dụng</h1>
          <p className="text-sm text-muted-foreground">
            Chỉ mở khi máy chủ bật cờ ENABLE_DEMO_PAYMENT_MINT và vai hiện tại là Giao dịch viên. Vai
            hiện tại: <span className="font-mono text-foreground">{role}</span>.
          </p>
        </div>
      )}
    </AppLayout>
  );
}
