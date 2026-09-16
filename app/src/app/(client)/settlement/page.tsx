import { AppLayout } from '@/components/layout/app-layout';
import { INVESTOR_NAV } from '@/components/layout/nav-config';

/**
 * Trang chỗ trống — **FE-11** (tất toán) sẽ thay toàn bộ nội dung.
 * Mục menu tương ứng đang `disabled` nên bình thường không vào được từ giao diện.
 */
export default function SettlementPage() {
  return (
    <AppLayout
      nav={INVESTOR_NAV}
      breadcrumbs={[{ label: 'Nhà đầu tư' }, { label: 'Tất toán' }]}
    >
      <h1 className="text-xl font-semibold text-foreground">Tất toán</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sắp có — FE-11 sẽ bổ sung luồng đổi WPT lấy VNDB.
      </p>
    </AppLayout>
  );
}
