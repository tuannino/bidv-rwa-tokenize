import { ChannelGuard } from '@/components/layout/channel-guard';
import { AREA_GATES, AREA_LABELS } from '@/lib/rbac/area-gates';

/**
 * Khu vực **Thông tin tài khoản** — cả bốn vai, theo tài liệu yêu cầu.
 *
 * Tách khỏi `(wallet)` dù cả hai là trang "của chính tôi": tập vai khác nhau. Kết nối ví chỉ
 * của hai vai khách hàng, còn thông tin tài khoản thì mọi vai đều cần.
 *
 * Cổng `balance:read` cả bốn vai đều có, nên guard ở đây gần như không chặn ai — và đó là ĐÚNG.
 * Vẫn bọc để giữ bất biến "mọi trang nằm trong một khu vực có cổng", nhờ đó FE-24 siết lại
 * phạm vi thì sửa đúng một dòng trong `AREA_GATES`.
 */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChannelGuard channel={AREA_LABELS.account} requireAny={AREA_GATES.account}>
      {children}
    </ChannelGuard>
  );
}
