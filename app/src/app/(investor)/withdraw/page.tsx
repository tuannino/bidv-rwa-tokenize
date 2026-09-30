import { AppLayout } from '@/components/layout/app-layout';
import { PlaceholderPage } from '@/components/pages/placeholder';

// @pending FE-23 | đường dẫn /withdraw, cổng portfolio:read và mục menu "Rút VNDB" đã chạy — FE-23 dựng phần thân; nghiệp vụ rút chưa có ở tầng backend
export default function InvestorWithdrawPage() {
  return (
    <AppLayout breadcrumbs={[{ label: 'Nhà đầu tư' }, { label: 'Rút VNDB' }]}>
      <PlaceholderPage
        title="Rút VNDB"
        purpose="Nhà đầu tư chuyển VNDB trong ví về tài khoản ngân hàng của mình."
        task="FE-23"
        ready={[
          'Đường dẫn /withdraw nằm trong khu vực Nhà đầu tư, cổng portfolio:read.',
          'useWalletStatus() trả canSign — một chỗ duy nhất trả lời "ví sẵn sàng ký chưa".',
        ]}
        notes={[
          'Khác với ba màn kia, nghiệp vụ rút VNDB CHƯA có ở tầng backend: chưa có service, chưa có quyền RBAC. FE-23 phụ thuộc task backend tương ứng, không chỉ dựng giao diện.',
          'Mã task FE-23 do FE-20 đặt trước vì lộ trình chưa có mã cho màn này — xem docs/CHECKPOINT_FE20.md.',
        ]}
      />
    </AppLayout>
  );
}
