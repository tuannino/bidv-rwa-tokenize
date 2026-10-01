import type { RequestCheck, TokenRequestDetailView } from '@/lib/bank/token-request.service';
import type { TokenRequestStatus } from '@/lib/store/token-request.store.port';
import { formatAmount } from '@/lib/format';

/**
 * Trạng thái nút của hai màn Lập lệnh và Phê duyệt lệnh — LOGIC THUẦN, không React.
 *
 * Tách khỏi component để kiểm được bằng Vitest (môi trường `node`, không dựng DOM), và để một hàm
 * trả lời đúng một câu "nút này có bấm được không, nếu không thì vì sao".
 *
 * ⚠️ Không hàm nào ở đây TỰ TÍNH điều kiện nghiệp vụ (trần, ví, nguồn Burn). Chúng chỉ đọc kết quả
 * máy chủ đã trả — khối kiểm tra của `previewTokenRequestAction`, cờ `selfApprovalReason` của màn
 * chi tiết. Tính lại ở đây là có hai nơi trả lời cùng một câu hỏi, và chúng sẽ lệch nhau.
 */

/** Nhãn cho ĐỦ năm trạng thái của BE-12 — `Record` đủ khoá nên thêm trạng thái mà quên nhãn là lỗi biên dịch. */
export const STATUS_LABELS: Record<TokenRequestStatus, string> = {
  PENDING: 'Chờ duyệt',
  EXECUTING: 'Đang xử lý',
  COMPLETED: 'Hoàn tất',
  REJECTED: 'Từ chối',
  FAILED: 'Thất bại',
};

/** Kết quả gần nhất của khối kiểm tra, đúng như máy chủ trả. */
export type PreviewState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'checked'; checks: RequestCheck[]; allPassed: boolean }
  | { kind: 'invalid'; message: string; fieldErrors?: Record<string, string[]> };

/** Mô tả lỗi dữ liệu vào của máy chủ thành một câu đọc được. */
export function describeInvalid(
  message: string,
  fieldErrors: Record<string, string[] | undefined> | undefined,
): string {
  const details = Object.entries(fieldErrors ?? {})
    .flatMap(([field, errors]) => (errors ?? []).map((error) => `${field}: ${error}`))
    .join('; ');
  return details ? `${message} ${details}` : message;
}

/**
 * Lý do KHOÁ nút gửi yêu cầu, hoặc `null` khi gửi được.
 *
 * `needsConfirmation`: đã chọn nguồn Burn là toàn bộ nguồn cung mà chưa xác nhận lại.
 */
export function submitBlockReason(preview: PreviewState, needsConfirmation = false): string | null {
  switch (preview.kind) {
    case 'idle':
      return 'Nhập ký hiệu token và nội dung yêu cầu để hệ thống kiểm tra điều kiện.';
    case 'loading':
      return 'Đang kiểm tra điều kiện…';
    case 'invalid':
      return preview.message;
    case 'checked': {
      const failed = preview.checks.filter((check) => !check.passed);
      if (failed.length > 0 || !preview.allPassed) {
        return `Điều kiện chưa đạt: ${failed.map((check) => `${check.label} (${check.detail})`).join('; ')}`;
      }
      if (needsConfirmation) {
        return 'Huỷ theo toàn bộ nguồn cung phải xác nhận lại trước khi gửi.';
      }
      return null;
    }
  }
}

/** Nguồn của yêu cầu huỷ token. */
export type BurnSource = 'UNDISTRIBUTED' | 'TOTAL_SUPPLY';

export const BURN_SOURCE_LABELS: Record<BurnSource, string> = {
  UNDISTRIBUTED: 'Phần chưa phân phối',
  TOTAL_SUPPLY: 'Toàn bộ nguồn cung',
};

/**
 * Chọn nguồn Burn thì màn hình phải làm gì.
 *
 * Toàn bộ nguồn cung: tự điền số lượng bằng TỔNG CUNG máy chủ đã trả trong khối thông tin token, và
 * đòi xác nhận lại — đây là thao tác xoá sạch token của dự án, bấm nhầm thì không có đường lùi.
 */
export function burnSourceEffect(
  source: BurnSource,
  totalSupply: string | null,
): { amount: string | null; needsConfirmation: boolean; warning: string | null } {
  if (source === 'TOTAL_SUPPLY') {
    return {
      amount: totalSupply,
      needsConfirmation: true,
      warning:
        `Bạn đang yêu cầu huỷ TOÀN BỘ nguồn cung (${formatAmount(totalSupply)} token). ` +
        'Chỉ thực hiện được khi không còn token nào đang lưu hành. Đánh dấu ô xác nhận để tiếp tục.',
    };
  }
  return { amount: null, needsConfirmation: false, warning: null };
}

/** Lý do KHOÁ nút từ chối: chưa nhập lý do. */
export function rejectBlockReason(reason: string): string | null {
  return reason.trim() === '' ? 'Phải nhập lý do từ chối.' : null;
}

/**
 * Lý do KHOÁ nút chấp nhận (và cả nút từ chối) ở màn chi tiết, hoặc `null` khi bấm được.
 *
 * Thứ tự: yêu cầu không còn chờ thì nói trạng thái trước — người lập xem lại yêu cầu đã hoàn tất của
 * mình thì câu "bạn đã lập yêu cầu này" là thừa.
 */
export function decisionBlockReason(
  detail: Pick<TokenRequestDetailView, 'request' | 'selfApprovalReason'>,
): string | null {
  if (detail.request.status !== 'PENDING') {
    return `Yêu cầu đang ở trạng thái "${STATUS_LABELS[detail.request.status]}", không còn chờ duyệt.`;
  }
  return detail.selfApprovalReason;
}
