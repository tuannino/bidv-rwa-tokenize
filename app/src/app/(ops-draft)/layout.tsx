import { ChannelGuard } from '@/components/layout/channel-guard';
import { AREA_GATES, AREA_LABELS } from '@/lib/rbac/area-gates';

/**
 * Mục **Lập lệnh** — CHỈ Giao dịch viên (FE-20 ca 5).
 *
 * Group riêng chứ không nằm trong `(ops)` là vì cổng khác: `(ops)` mở cho cả hai vai vận
 * hành, còn mục này phải chặn Kiểm soát viên. Người lập lệnh không phải người duyệt — đó là
 * toàn bộ lý do mô hình lập–duyệt tồn tại, và nếu một vai làm được cả hai thì lớp kiểm soát
 * thứ hai chỉ còn là hình thức.
 *
 * Cổng `ops:draft:read` chỉ Giao dịch viên có, và vai đó cũng có `ops:read`, nên vào được
 * đây kéo theo vào được khu vực Vận hành — không cần lồng hai guard.
 */
export default function OpsDraftLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChannelGuard channel={AREA_LABELS.draft} requireAny={AREA_GATES.draft}>
      {children}
    </ChannelGuard>
  );
}
