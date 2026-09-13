import { ChannelGuard } from '@/components/layout/channel-guard';

/**
 * Kênh (admin) — cán bộ ngân hàng. Có đặc quyền: mint/whitelist/freeze/clawback.
 *
 * Guard đặt ở layout group để mọi trang thêm sau này tự động được bảo vệ.
 * Ranh giới này cũng là chỗ để sau tách (admin) thành app deploy riêng (subdomain)
 * mà backend/`ILedgerPort` không phải đổi.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChannelGuard channel="Ngân hàng" requireAny={['token:mint', 'investor:whitelist']}>
      {children}
    </ChannelGuard>
  );
}
