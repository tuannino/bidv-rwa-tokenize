import { AppLayout } from '@/components/layout/app-layout';
import { WalletConnectPage } from '@/components/pages/wallet-connect';

/**
 * `/wallet` — trang kết nối ví của kênh nhà đầu tư.
 *
 * Bổ sung cho `ConnectButton` trên thanh phía trên chứ không thay thế: thanh trên để kết nối
 * nhanh ở mọi trang, trang này để xem chi tiết và xử lý các tình huống lỗi (chưa cài ví, sai
 * mạng, lệch mạng).
 *
 * `AppLayout` đặt ở page theo đúng hiện trạng repo — `layout.tsx` của group chỉ giữ
 * `ChannelGuard`. Đặt cả hai chỗ sẽ lồng layout hai lần.
 */
export default function WalletPage() {
  return (
    <AppLayout breadcrumbs={[{ label: 'Nhà đầu tư' }, { label: 'Ví của tôi' }]}>
      <WalletConnectPage />
    </AppLayout>
  );
}
