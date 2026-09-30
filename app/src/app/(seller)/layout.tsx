import { ChannelGuard } from '@/components/layout/channel-guard';
import { AREA_GATES, AREA_LABELS } from '@/lib/rbac/area-gates';

/**
 * Khu vực Người bán — vai MỚI của FE-20.
 *
 * Cổng là `seller:read`, quyền chỉ `SELLER` có, nên nó vừa cho Người bán vào vừa chặn ba vai
 * kia. Khu vực này chưa có nghiệp vụ nào: cả ba trang là chỗ trống chờ FE-21.
 */
export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChannelGuard channel={AREA_LABELS.seller} requireAny={AREA_GATES.seller}>
      {children}
    </ChannelGuard>
  );
}
