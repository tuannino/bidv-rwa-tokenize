import { AppLayout } from '@/components/layout/app-layout';
import { PlaceholderPage } from '@/components/pages/placeholder';

// @pending FE-05 | đường dẫn /trade, cổng portfolio:read và mục menu "Giao dịch token" đã chạy; previewPurchaseAction và placeOrderAction cũng đã xong đầu cuối — FE-05 chỉ thay phần thân trang này
export default function TradePage() {
  return (
    <AppLayout breadcrumbs={[{ label: 'Nhà đầu tư' }, { label: 'Giao dịch token' }]}>
      <PlaceholderPage
        title="Giao dịch token"
        purpose="Nhà đầu tư xem điều kiện mua rồi đặt lệnh mua WPT bằng VNDB."
        task="FE-05"
        ready={[
          'Đường dẫn /trade nằm trong khu vực Nhà đầu tư, cổng portfolio:read.',
          'previewPurchaseAction: báo giá và chạy ĐÚNG bộ kiểm mà khớp lệnh sẽ chạy, trả canPlaceOrder + blockers + howToFix.',
          'placeOrderAction: validate Zod, kiểm quyền order:place, chốt số VNDB tại thời điểm đặt, ghi sổ kiểm toán.',
        ]}
        notes={[
          'previewPurchaseAction gọi được sau mỗi ký tự người dùng gõ vào ô số lượng: màn hình phải hoãn lời gọi và bỏ phản hồi đã cũ. Service KHÔNG có bộ nhớ đệm.',
          'Không viết lại phép kiểm nào ở client — dùng blockers và howToFix mà service trả về.',
        ]}
      />
    </AppLayout>
  );
}
