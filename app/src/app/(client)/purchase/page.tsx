import { AppLayout } from '@/components/layout/app-layout';
import { INVESTOR_NAV } from '@/components/layout/nav-config';

/**
 * Trang chỗ trống — **FE-05** (đặt lệnh mua WPT) sẽ thay toàn bộ nội dung.
 * Mục menu tương ứng đang `disabled` nên bình thường không vào được từ giao diện.
 */
export default function PurchasePage() {
  return (
    <AppLayout
      nav={INVESTOR_NAV}
      breadcrumbs={[{ label: 'Nhà đầu tư' }, { label: 'Mua WPT' }]}
    >
      <h1 className="text-xl font-semibold text-foreground">Mua WPT</h1>
      <p className="mt-2 text-sm text-muted-foreground">Sắp có — FE-05 sẽ bổ sung luồng đặt lệnh mua.</p>
    </AppLayout>
  );
}
