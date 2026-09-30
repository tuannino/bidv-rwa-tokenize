import { ChannelGuard } from '@/components/layout/channel-guard';
import { AREA_GATES, AREA_LABELS } from '@/lib/rbac/area-gates';

/**
 * Khu vực Vận hành — dùng chung cho **Giao dịch viên và Kiểm soát viên**.
 *
 * Cổng là `ops:read`, tức cả hai vai vận hành vào được. Khác biệt giữa hai vai KHÔNG nằm ở
 * đây mà ở hai chỗ:
 * - Hai mục riêng có group riêng với cổng riêng: `(ops-draft)` cho Lập lệnh (chỉ Giao dịch
 *   viên), `(control)` cho Phê duyệt lệnh (chỉ Kiểm soát viên).
 * - Trong các trang dùng chung, vai nào bấm được nút nào do `can(role, action)` quyết định.
 *
 * Vì sao không tách thành hai group riêng cho hai vai: ba trong bốn mục Vận hành là **cùng
 * một trang** theo tài liệu yêu cầu (Bảng điều khiển, Giao dịch, Chia lợi nhuận). Tách group
 * sẽ phải nhân đôi các trang đó, và hai bản sẽ lệch nhau ở lần sửa đầu tiên.
 *
 * ⚠️ Nhóm này còn giữ bốn trang rời có từ trước tài liệu yêu cầu (`/mint`, `/kyc`, `/assets`,
 * `/reconciliation`) và sổ kiểm toán (`/audit`). Chúng KHÔNG có trong menu vì menu phải khớp
 * tài liệu, nhưng mã vẫn chạy và vào được bằng đường dẫn — xem trang `/draft`.
 */
export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChannelGuard channel={AREA_LABELS.ops} requireAny={AREA_GATES.ops}>
      {children}
    </ChannelGuard>
  );
}
