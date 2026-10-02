import { ChannelGuard } from '@/components/layout/channel-guard';
import { AREA_GATES, AREA_LABELS } from '@/lib/rbac/area-gates';

/**
 * Khu vực Người bán — vai MỚI của FE-20.
 *
 * Cổng là `seller:read`, quyền chỉ `SELLER` có, nên nó vừa cho Người bán vào vừa chặn ba vai
 * kia. Ba màn do FE-21 dựng; service phía dưới kiểm lại `seller:read` lần nữa.
 */
export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChannelGuard channel={AREA_LABELS.seller} requireAny={AREA_GATES.seller}>
      {children}
    </ChannelGuard>
  );
}
