/** Định dạng và nhãn dùng chung của màn Chia lợi nhuận (FE-UX-03b QĐ-10: dời nguyên văn từ `distribution-approval.tsx`). */

export const amount = (value: string) => BigInt(value).toLocaleString('vi-VN');
export const short = (value: string) => `${value.slice(0, 10)}…${value.slice(-6)}`;

export const PERIOD_STATUS: Record<string, string> = {
  OPENING: 'Đang mở trên chuỗi',
  OPEN: 'Đã mở',
  DISTRIBUTING: 'Đang chia',
  COMPLETED: 'Hoàn tất',
  EXPIRED: 'Hết hạn nhận',
  CLOSED: 'Đã đóng',
};
export const APPROVAL_STATUS: Record<string, string> = {
  APPROVED: 'Đã duyệt',
  AMOUNT_CHANGED: 'Số đổi, chờ duyệt lại',
};
export const VAULT_STATUS: Record<string, string> = {
  PENDING: 'Đã giữ chỗ',
  SENT: 'Đã gửi, đang đối soát',
  DONE: 'Đã chốt',
  CONFLICT: 'CONFLICT, cần xử lý tay',
};
