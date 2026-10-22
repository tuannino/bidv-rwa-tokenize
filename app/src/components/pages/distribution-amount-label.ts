import type { DistributionPeriodView } from '@/lib/bank/distribution.service';

/**
 * Chữ hiện ở ô "Số đã duyệt" (thẻ Kỳ hoạt động) và cột "Số duyệt" (bảng Lịch sử kỳ chia) của màn
 * `/distribution` (HF-05, L-20).
 *
 * Số đã duyệt là `approvedAmount`, KHÔNG phải `expectedAmount`: `expectedAmount` là số Kiểm soát
 * viên gõ ở lần duyệt ĐẦU, duyệt lại không đổi nó. Hiện `expectedAmount` thì sau duyệt lại màn vẫn
 * nói số cũ, kỳ cũ được duyệt lại hiện "chưa có", và kỳ AMOUNT_CHANGED hiện số chuỗi đã bác như
 * thể là số đã duyệt.
 *
 * Hàm thuần, tách khỏi tệp màn để kiểm được bằng test không cần kết xuất.
 */
export function approvedAmountLabel(
  period: Pick<DistributionPeriodView, 'approvalStatus' | 'expectedAmount' | 'approvedAmount'>,
  variant: 'cell' | 'table',
): string {
  const unit = variant === 'cell' ? ' VNDB' : '';
  if (period.approvedAmount) return `${vnd(period.approvedAmount)}${unit}`;
  if (period.approvalStatus === null && period.expectedAmount) {
    return `Đang so số: ${vnd(period.expectedAmount)} VNDB`;
  }
  if (period.approvalStatus === 'AMOUNT_CHANGED') {
    const typed = period.expectedAmount ? `${vnd(period.expectedAmount)} VNDB ` : '';
    return `Chưa có (lần duyệt ${typed}lệch số trên chuỗi)`;
  }
  return variant === 'cell' ? 'chưa có' : 'không có';
}

const vnd = (value: string) => BigInt(value).toLocaleString('vi-VN');
