import { AppLayout } from '@/components/layout/app-layout';
import { PlaceholderPage } from '@/components/pages/placeholder';

// @pending FE-06 | đường dẫn /transactions, cổng ops:read (cả hai vai vận hành) và mục menu "Giao dịch" đã chạy; executeOrderAction và listOrdersAction cũng đã xong đầu cuối — FE-06 chỉ thay phần thân
export default function OpsTransactionsPage() {
  return (
    <AppLayout breadcrumbs={[{ label: 'Vận hành' }, { label: 'Giao dịch' }]}>
      <PlaceholderPage
        title="Giao dịch"
        purpose="Hai vai vận hành xem sổ lệnh toàn hệ; Giao dịch viên khớp lệnh, Kiểm soát viên chỉ xem."
        task="FE-06"
        ready={[
          'Đường dẫn /transactions nằm trong khu vực Vận hành, cổng ops:read — cả Giao dịch viên và Kiểm soát viên vào được.',
          'listOrdersAction: hai vai này có order:read:all nên bỏ trống bộ lọc ví được.',
          'executeOrderAction: kiểm quyền order:execute, bốn phép đọc trước khi gửi, khoá lạc quan chống gửi hai lần, đọc lại số dư từ chuỗi sau biên nhận.',
        ]}
        notes={[
          'MỘT trang cho hai vai, không phải hai bản. Nút khớp lệnh ẩn/hiện theo can(role, "order:execute") — Kiểm soát viên không có quyền đó nên tự động chỉ xem.',
          'Chốt chặn thật vẫn ở service: ẩn nút chỉ là hiển thị, server action gọi được bằng POST trực tiếp.',
        ]}
      />
    </AppLayout>
  );
}
