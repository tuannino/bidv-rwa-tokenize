import { ChannelGuard } from '@/components/layout/channel-guard';

/**
 * Kênh (client) — nhà đầu tư. Xem vị thế, và sau này mua / nhận lợi tức / tất toán.
 *
 * Guard đặt ở layout group nên mọi trang thêm sau này (FE-05/09/11) tự động được bảo vệ,
 * không phải nhớ gắn guard từng trang.
 *
 * Quyền vào kênh là `portfolio:read` — quyền CHỈ `INVESTOR` có. Không dùng `balance:read`
 * như FE-01 v1: quyền đó nằm trong nhóm `READ_ONLY` được spread vào BANK_ADMIN, COMPLIANCE
 * và AUDITOR, nên cả bốn vai đều có và guard không chặn được ai (v1 đã đo và phải để một
 * test ở dạng `fixme`).
 *
 * Kênh này KHÔNG gọi hàm đặc quyền nào (phát hành / đóng băng / thu hồi).
 */
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChannelGuard channel="Nhà đầu tư" requireAny={['portfolio:read']}>
      {children}
    </ChannelGuard>
  );
}
