import { ChannelGuard } from '@/components/layout/channel-guard';

/**
 * Kênh (client) — nhà đầu tư. Xem vị thế, mua, nhận lợi tức, tất toán.
 *
 * Guard đặt ở layout group để mọi trang thêm sau này (FE-04/05/09/11) tự động được
 * bảo vệ, không phải nhớ gắn guard từng trang.
 *
 * Quyền vào kênh là `balance:read` — quyền *xem* vị thế, sát nghĩa nhất với kênh này.
 * Không dùng `token:transfer` vì đó là quyền *hành động*.
 *
 * ⚠️ `balance:read` hiện thuộc nhóm chỉ đọc nên CẢ BỐN vai trò đều có, tức guard này
 * chưa chặn được vai ngân hàng lẫn kiểm toán. Xem `docs/CHECKPOINT_FE01.md` mục câu
 * hỏi mở; sửa đúng cách cần thêm quyền vào `permissions.ts`, việc đó vượt phạm vi FE-01.
 *
 * Kênh này KHÔNG gọi hàm đặc quyền nào (phát hành/đóng băng/thu hồi/đặt NAV).
 */
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChannelGuard channel="Nhà đầu tư" requireAny={['balance:read']}>
      {children}
    </ChannelGuard>
  );
}
