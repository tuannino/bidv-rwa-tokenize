import { Badge } from '@/components/ui/badge';
import type { TokenRequestStatus } from '@/lib/store/token-request.store.port';
import { STATUS_LABELS } from './gates';

/**
 * Nhãn trạng thái cho ĐỦ năm trạng thái của BE-12 (FE-22 yêu cầu 13).
 *
 * `EXECUTING` và `FAILED` hiện rõ chứ không gộp vào "chờ" hay "từ chối": `EXECUTING` kéo dài có
 * thể là giao dịch đã gửi mà chưa biết kết cục — cần người đối soát; `FAILED` là chuỗi không thực
 * hiện được, khác hẳn Kiểm soát viên không đồng ý. Giấu đi là giấu đúng thứ người vận hành cần thấy.
 */
const VARIANTS: Record<TokenRequestStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  EXECUTING: 'outline',
  COMPLETED: 'default',
  REJECTED: 'destructive',
  FAILED: 'destructive',
};

export function StatusBadge({ status }: { status: TokenRequestStatus }) {
  return (
    <Badge variant={VARIANTS[status]} data-status={status}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
