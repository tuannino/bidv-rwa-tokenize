import { AppLayout } from '@/components/layout/app-layout';
import { PlaceholderPage } from '@/components/pages/placeholder';

// @pending FE-08 | đường dẫn /distribution, cổng ops:read (cả hai vai vận hành) và mục menu "Chia lợi nhuận" đã chạy; openPeriod, previewDistribution, distributePeriod và runDistributionCycle đều đã xong đầu cuối — FE-08 chỉ thay phần thân
export default function DistributionPage() {
  return (
    <AppLayout breadcrumbs={[{ label: 'Vận hành' }, { label: 'Chia lợi nhuận' }]}>
      <PlaceholderPage
        title="Chia lợi nhuận"
        purpose="Mở kỳ chia theo sản lượng, xem trước phần từng ví, rồi chi trả VNDB cho người nắm giữ WPT."
        task="FE-08"
        ready={[
          'Đường dẫn /distribution nằm trong khu vực Vận hành, cổng ops:read.',
          'openPeriod: kiểm quỹ TRƯỚC khi chạm chuỗi, chốt quyền qua ILedgerPort.takeSnapshot, trả snapshotId và totalAmount.',
          'previewDistribution: dựng danh sách người nhận từ cơ sở dữ liệu, tính phần từng ví bằng ĐÚNG hàm lúc chia sẽ dùng, KHÔNG ghi gì nên gọi bao nhiêu lần cũng được.',
          'distributePeriod: ba trạng thái hồ sơ PENDING/SENT/PAID, gọi lại chỉ chia cho ví chưa nhận.',
        ]}
        notes={[
          'Kiểm soát viên vào cùng đường dẫn này nhưng KHÔNG có distribution:snapshot / distribution:execute, nên chỉ xem — menu của vai đó ghi rõ "(chỉ xem)".',
          'Phải hiện outstanding và failed: khác 0 nghĩa là còn phải bấm chia lại. Đó là kết cục BÌNH THƯỜNG vì mỗi lượt chỉ chạy tối đa distribution.max_batches_per_run lô.',
          'Nên hiện cả ví được chia 0 thay vì lọc bỏ: vắng mặt và được chia 0 là hai thông tin khác nhau với người đối soát.',
        ]}
      />
    </AppLayout>
  );
}
