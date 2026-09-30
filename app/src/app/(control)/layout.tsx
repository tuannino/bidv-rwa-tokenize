import { ChannelGuard } from '@/components/layout/channel-guard';
import { AREA_GATES, AREA_LABELS } from '@/lib/rbac/area-gates';

/**
 * Khu vực Kiểm soát — mục **Phê duyệt lệnh**, CHỈ Kiểm soát viên (FE-20 ca 4).
 *
 * Đối xứng với `(ops-draft)`: Giao dịch viên bị chặn ở đây, Kiểm soát viên bị chặn ở đó.
 * Hai cổng là hai quyền khác nhau nên không có cách nào một vai giữ cả hai mà không ai thấy —
 * bảng `ROLE_PERMISSIONS` phải ghi ra, và `rbac.test.ts` đối chiếu cả hai chiều.
 *
 * ⚠️ Quyền DUYỆT thật (`order:approve`) thuộc BE-12. Cổng ở đây chỉ mở màn hình.
 */
export default function ControlLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChannelGuard channel={AREA_LABELS.approval} requireAny={AREA_GATES.approval}>
      {children}
    </ChannelGuard>
  );
}
