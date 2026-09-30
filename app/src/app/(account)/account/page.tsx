import { AppLayout } from '@/components/layout/app-layout';
import { PlaceholderPage } from '@/components/pages/placeholder';

// @pending FE-24 | đường dẫn /account, cổng balance:read (cả bốn vai) và mục menu "Thông tin tài khoản" của cả bốn vai đã chạy — FE-24 chỉ thay phần thân trang này
export default function AccountPage() {
  return (
    <AppLayout breadcrumbs={[{ label: 'Thông tin tài khoản' }]}>
      <PlaceholderPage
        title="Thông tin tài khoản"
        purpose="Người đang đăng nhập xem thông tin định danh, vai trò và ví đã liên kết của mình."
        task="FE-24"
        ready={[
          'Đường dẫn /account nằm trong khu vực Thông tin tài khoản, cổng balance:read — cả bốn vai vào được.',
          'Mục menu "Thông tin tài khoản" đã có ở cả bốn nhóm menu.',
          'currentRole() trả vai đang có hiệu lực, cùng nguồn với ChannelGuard và lib/bank.',
        ]}
        notes={[
          'Trang này dùng chung cho bốn vai nên nội dung phải suy từ vai, KHÔNG viết bốn bản.',
          'Hồ sơ người dùng thật đến từ phiên đăng nhập của AU-01; trước đó chỉ có vai và ví.',
          'Mã task FE-24 do FE-20 đặt trước vì lộ trình chưa có mã cho màn này — xem docs/CHECKPOINT_FE20.md.',
        ]}
      />
    </AppLayout>
  );
}
