import { AppLayout } from '@/components/layout/app-layout';
import { PlaceholderPage } from '@/components/pages/placeholder';

// @pending FE-22 | đường dẫn /draft, cổng ops:draft:read (chặn Kiểm soát viên) và mục menu "Lập lệnh" kèm số việc chờ đã chạy — FE-22 chỉ thay phần thân
export default function DraftPage() {
  return (
    <AppLayout breadcrumbs={[{ label: 'Vận hành' }, { label: 'Lập lệnh' }]}>
      <PlaceholderPage
        title="Lập lệnh"
        purpose="Giao dịch viên lập lệnh nghiệp vụ rồi gửi cho Kiểm soát viên phê duyệt."
        task="FE-22"
        ready={[
          'Khu vực riêng với cổng ops:draft:read — Kiểm soát viên có ops:read nhưng bị chặn ở đây (ca 5).',
          'Mục menu "Lập lệnh" đã mang số việc đang chờ, đọc từ pendingWorkCounts().',
        ]}
        notes={[
          'Nghiệp vụ lập–duyệt thuộc BE-12: chưa có quyền order:draft, chưa có service, nên số việc chờ hiện là 0.',
          'Bốn màn rời có từ trước tài liệu yêu cầu — /mint, /kyc, /assets, /reconciliation — vẫn chạy và vào được bằng đường dẫn, nhưng KHÔNG còn trong menu vì tài liệu không có chúng. FE-22 quyết định màn nào gộp vào Lập lệnh, màn nào bỏ.',
          'Sổ kiểm toán /audit cũng còn chạy và cũng không có trong menu — vai trò Kiểm toán cũ đã gỡ.',
          'Mã task FE-22 do FE-20 đặt trước vì lộ trình chưa có mã cho cặp màn lập–duyệt — xem docs/CHECKPOINT_FE20.md.',
        ]}
      />
    </AppLayout>
  );
}
