import { AppLayout } from '@/components/layout/app-layout';
import { PlaceholderPage } from '@/components/pages/placeholder';

// @pending FE-21 | đường dẫn /seller/withdraw, cổng seller:read và mục menu "Tạo lệnh rút" đã chạy — FE-21 chỉ thay phần thân; nghiệp vụ rút chưa có ở tầng backend
export default function SellerWithdrawPage() {
  return (
    <AppLayout breadcrumbs={[{ label: 'Người bán' }, { label: 'Tạo lệnh rút' }]}>
      <PlaceholderPage
        title="Tạo lệnh rút"
        purpose="Người bán tạo lệnh rút VNDB về tài khoản ngân hàng; lệnh đi qua Giao dịch viên rồi Kiểm soát viên."
        task="FE-21"
        ready={[
          'Đường dẫn /seller/withdraw nằm trong khu vực Người bán, cổng seller:read.',
          'Mục Lập lệnh của Giao dịch viên và mục Phê duyệt lệnh của Kiểm soát viên đã có khung — đây là đầu vào của luồng đó.',
        ]}
        notes={[
          'Nghiệp vụ rút và mô hình lập–duyệt CHƯA có ở tầng backend (thuộc BE-12): chưa có service, chưa có quyền order:draft / order:approve.',
          'Lệnh tạo ở đây là thứ làm số việc đang chờ cạnh hai mục kia khác 0.',
        ]}
      />
    </AppLayout>
  );
}
