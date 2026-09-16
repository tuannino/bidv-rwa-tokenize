import { AppLayout } from '@/components/layout/app-layout';
import { INVESTOR_NAV } from '@/components/layout/nav-config';

/**
 * Trang chỗ trống — **FE-09** (lợi nhuận) sẽ thay toàn bộ nội dung.
 * Mục menu tương ứng đang `disabled` nên bình thường không vào được từ giao diện.
 */
export default function EarningsPage() {
  return (
    <AppLayout
      nav={INVESTOR_NAV}
      breadcrumbs={[{ label: 'Nhà đầu tư' }, { label: 'Lợi nhuận' }]}
    >
      <h1 className="text-xl font-semibold text-foreground">Lợi nhuận</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sắp có — FE-09 sẽ bổ sung lịch sử lợi tức chi trả bằng VNDB.
      </p>
    </AppLayout>
  );
}
