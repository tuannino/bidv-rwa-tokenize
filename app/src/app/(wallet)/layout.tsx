import { ChannelGuard } from '@/components/layout/channel-guard';
import { AREA_GATES, AREA_LABELS } from '@/lib/rbac/area-gates';

/**
 * Khu vực **Kết nối ví** — Nhà đầu tư và Người bán.
 *
 * Group riêng vì tài liệu yêu cầu cho mục này ở CẢ HAI vai khách hàng: để `/wallet` trong
 * `(investor)` thì Người bán bị chặn khỏi ví của chính mình.
 *
 * Cổng là `wallet:connect`, KHÔNG phải `balance:read`. Hai lý do, cả hai đều thật:
 * - `balance:read` nằm trong `READ_ONLY` nên cả bốn vai đều có — dùng nó thì không chặn được ai.
 * - Thao tác đặc quyền của ngân hàng ký bằng khóa phía máy chủ qua `ISigner` (FE-02 R7.2), nên
 *   bày trang kết nối ví cho hai vai vận hành là mời họ ký việc ngân hàng bằng ví cá nhân.
 */
export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChannelGuard channel={AREA_LABELS.wallet} requireAny={AREA_GATES.wallet}>
      {children}
    </ChannelGuard>
  );
}
