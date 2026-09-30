import { AppLayout } from '@/components/layout/app-layout';
import { PlaceholderPage } from '@/components/pages/placeholder';

// @pending FE-06 | đường dẫn /orders, cổng portfolio:read và mục menu "Quản lý lệnh" đã chạy; listOrdersAction cũng đã xong đầu cuối — FE-06 chỉ thay phần thân trang này
export default function InvestorOrdersPage() {
  return (
    <AppLayout breadcrumbs={[{ label: 'Nhà đầu tư' }, { label: 'Quản lý lệnh' }]}>
      <PlaceholderPage
        title="Quản lý lệnh"
        purpose="Nhà đầu tư theo dõi lệnh mua của chính mình: trạng thái, số tiền đã chốt, lý do bị từ chối."
        task="FE-06"
        ready={[
          'Đường dẫn /orders nằm trong khu vực Nhà đầu tư, cổng portfolio:read.',
          'listOrdersAction: phân biệt order:read với order:read:all, nên "vai nào xem được lệnh nào" là việc của RBAC chứ không phải của màn hình.',
          'Mô hình trạng thái lệnh ở purchase.state.ts: PLACED → CHECKING → EXECUTING → COMPLETED, cùng REJECTED / FAILED / EXPIRED.',
        ]}
        notes={[
          'REJECTED và FAILED phải hiển thị khác nhau: REJECTED là chắc chắn chưa tốn phí và đặt lại được ngay, FAILED là có thể đã tốn phí và phải xem lý do trên chuỗi.',
          'KHÔNG có trạng thái "đã trả tiền nhưng chưa nhận token" — hai lần chuyển nằm trong cùng một giao dịch on-chain.',
        ]}
      />
    </AppLayout>
  );
}
