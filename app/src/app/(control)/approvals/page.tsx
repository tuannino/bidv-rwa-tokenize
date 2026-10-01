import { AppLayout } from '@/components/layout/app-layout';
import { PlaceholderPage } from '@/components/pages/placeholder';

// @pending FE-22 | đường dẫn /approvals, cổng ops:approve:read (chặn Giao dịch viên) và mục menu "Phê duyệt lệnh" kèm số việc chờ đã chạy — FE-22 chỉ thay phần thân
export default function ApprovalsPage() {
  return (
    <AppLayout breadcrumbs={[{ label: 'Kiểm soát' }, { label: 'Phê duyệt lệnh' }]}>
      <PlaceholderPage
        title="Phê duyệt lệnh"
        purpose="Kiểm soát viên xem lệnh Giao dịch viên đã lập rồi phê duyệt hoặc trả lại."
        task="FE-22"
        ready={[
          'Khu vực riêng với cổng ops:approve:read — Giao dịch viên bị chặn ở đây (ca 4).',
          'Mục menu "Phê duyệt lệnh" đã mang số việc đang chờ: số yêu cầu người khác lập đang chờ duyệt (pendingWorkCounts).',
          'Backend duyệt / từ chối đã sẵn ở BE-12: approveTokenRequestAction, rejectTokenRequestAction (quyền order:approve, chặn người lập tự duyệt).',
        ]}
        notes={[
          'Cổng ops:approve:read chỉ mở màn hình; quyền DUYỆT là order:approve (BE-12), quyền ghi duy nhất của Kiểm soát viên.',
          'Đối xứng với /draft: một vai lập, vai kia duyệt. Đừng cấp cả hai cổng cho một vai.',
        ]}
      />
    </AppLayout>
  );
}
