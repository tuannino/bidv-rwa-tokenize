import { ChannelGuard } from '@/components/layout/channel-guard';
import { AREA_GATES, AREA_LABELS } from '@/lib/rbac/area-gates';

/**
 * Khu vực Nhà đầu tư — xem vị thế, giao dịch token, quản lý lệnh, rút VNDB.
 *
 * Guard đặt ở layout group nên mọi trang thêm sau này (FE-05/06/23) tự động được bảo vệ,
 * không phải nhớ gắn guard từng trang.
 *
 * Quyền vào khu vực là `portfolio:read` — quyền CHỈ `INVESTOR` có. Không dùng `balance:read`
 * như FE-01 v1: quyền đó nằm trong nhóm `READ_ONLY` được spread vào mọi vai phía ngân hàng,
 * nên cả bốn vai đều có và guard không chặn được ai (v1 đã đo và phải để một test ở dạng
 * `fixme`).
 *
 * Khu vực này KHÔNG gọi hàm đặc quyền nào (phát hành / đóng băng / thu hồi).
 */
export default function InvestorLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChannelGuard channel={AREA_LABELS.investor} requireAny={AREA_GATES.investor}>
      {children}
    </ChannelGuard>
  );
}
