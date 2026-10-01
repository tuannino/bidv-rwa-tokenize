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
          'Mô hình lập–duyệt đã có ở BE-12 nhưng CHỈ cho yêu cầu Mint/Burn. Nghiệp vụ rút CHƯA có ở tầng backend và chưa có mã task — xem docs/CHECKPOINT_BE12.md.',
        ]}
      />
    </AppLayout>
  );
}
