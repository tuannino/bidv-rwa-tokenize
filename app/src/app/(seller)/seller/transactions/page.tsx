import { AppLayout } from '@/components/layout/app-layout';
import { PlaceholderPage } from '@/components/pages/placeholder';

// @pending FE-21 | đường dẫn /seller/transactions, cổng seller:read và mục menu "Danh sách giao dịch" đã chạy — FE-21 chỉ thay phần thân
export default function SellerTransactionsPage() {
  return (
    <AppLayout breadcrumbs={[{ label: 'Người bán' }, { label: 'Danh sách giao dịch' }]}>
      <PlaceholderPage
        title="Danh sách giao dịch"
        purpose="Người bán xem các giao dịch liên quan tới ví của mình: tiền vào, tiền ra, lệnh rút."
        task="FE-21"
        ready={[
          'Đường dẫn /seller/transactions nằm trong khu vực Người bán, cổng seller:read.',
          'Vai SELLER có txn:read và order:read, nhưng KHÔNG có order:read:all — nên phạm vi tự động bó về ví của chính mình.',
        ]}
        notes={[
          'Không cần lọc theo ví ở màn hình: thiếu order:read:all là thứ đã bó phạm vi ở tầng service.',
        ]}
      />
    </AppLayout>
  );
}
