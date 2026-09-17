import { notFound } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { INVESTOR_NAV } from '@/components/layout/nav-config';
import { InvestorTokenDetailPage } from '@/components/pages/investor-token-detail';
import { findProjectBySymbol } from '@/lib/mock-data';

/**
 * `/tokens/[symbol]` — chi tiết một dự án đã token hoá.
 *
 * Dùng ký hiệu token làm tham số vì nó ngắn và người dùng đọc được.
 *
 * `params` là Promise ở Next 16 nên phải `await` (xem
 * node_modules/next/dist/docs/01-app/02-guides/streaming.md).
 */
export default async function TokenDetailRoute({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const project = findProjectBySymbol(symbol);

  // Mã không tồn tại -> trang không tìm thấy của Next, không để lỗi kỹ thuật lộ ra.
  if (!project) notFound();

  return (
    <AppLayout
      nav={INVESTOR_NAV}
      breadcrumbs={[
        { label: 'Nhà đầu tư' },
        { label: 'Tổng quan', href: '/portfolio' },
        { label: project.tokenSymbol },
      ]}
    >
      <InvestorTokenDetailPage project={project} />
    </AppLayout>
  );
}
