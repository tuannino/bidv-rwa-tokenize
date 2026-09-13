import { ChannelGuard } from '@/components/layout/channel-guard';

/**
 * Kênh (audit) — kiểm toán / cơ quan quản lý. **CHỈ ĐỌC**.
 *
 * Chỉ yêu cầu quyền `audit:read`, và không có trang nào trong kênh này gọi
 * hàm đặc quyền (mint/freeze/clawback) — đúng ràng buộc ở structure.md.
 */
export default function AuditLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChannelGuard channel="Kiểm toán" requireAny={['audit:read']}>
      {children}
    </ChannelGuard>
  );
}
