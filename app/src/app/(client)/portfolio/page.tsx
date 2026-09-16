import { AppLayout } from '@/components/layout/app-layout';
import { INVESTOR_NAV } from '@/components/layout/nav-config';

/** Trang chỗ trống — **FE-04** (tổng quan nhà đầu tư) sẽ thay toàn bộ nội dung. */
export default function PortfolioPage() {
  return (
    <AppLayout
      nav={INVESTOR_NAV}
      breadcrumbs={[{ label: 'Nhà đầu tư' }, { label: 'Tổng quan' }]}
    >
      <h1 className="text-xl font-semibold text-foreground">Tổng quan nhà đầu tư</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Khung kênh nhà đầu tư đã dựng. Nội dung vị thế và số dư WPT sẽ do FE-04 bổ sung.
      </p>
    </AppLayout>
  );
}
