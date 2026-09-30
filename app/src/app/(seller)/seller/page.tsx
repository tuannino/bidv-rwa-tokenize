import { AppLayout } from '@/components/layout/app-layout';
import { PlaceholderPage } from '@/components/pages/placeholder';

// @pending FE-21 | đường dẫn /seller, cổng seller:read và toàn bộ menu Người bán đã chạy; đây là trang mặc định của vai khi đổi sang Người bán — FE-21 chỉ thay phần thân
export default function SellerOverviewPage() {
  return (
    <AppLayout breadcrumbs={[{ label: 'Người bán' }, { label: 'Tổng quan' }]}>
      <PlaceholderPage
        title="Tổng quan"
        purpose="Người bán xem tình hình bán hàng: doanh thu đã nhận, số dư VNDB, lệnh rút đang chờ."
        task="FE-21"
        ready={[
          'Khu vực Người bán với cổng seller:read — quyền chỉ vai SELLER có, nên ba vai kia bị chặn.',
          'Menu năm mục theo tài liệu yêu cầu, và /seller là trang mặc định khi đổi sang vai này.',
        ]}
        notes={[
          'Cả ba màn của Người bán chưa có nghiệp vụ ở tầng backend: vai SELLER hiện chỉ có quyền đọc phần của mình, chưa có quyền ghi nào.',
          'Mã task FE-21 do FE-20 đặt trước vì lộ trình chưa có mã cho kênh này — xem docs/CHECKPOINT_FE20.md.',
        ]}
      />
    </AppLayout>
  );
}
