import type { PaymentWithdrawStatus } from '@/lib/store/payment-withdraw.store.port';

/** Nhãn trạng thái lệnh rút VNDB của Nhà đầu tư (FE-23 requirements mục 4). */
export const PAYMENT_WITHDRAW_STATUS_LABELS: Record<PaymentWithdrawStatus, string> = {
  CREATED: 'Chờ gửi',
  SENDING: 'Chờ ký trong ví',
  SUBMITTED: 'Đã gửi, chờ xác nhận',
  COMPLETED: 'Hoàn tất',
  FAILED: 'Thất bại',
  CANCELLED: 'Đã huỷ',
  EXPIRED: 'Hết hạn',
};

/** Sắc nhãn trạng thái lệnh rút (FE-UX-04d QĐ-6): đang dở `warn`, xong `ok`, hỏng `bad`, huỷ hoặc hết hạn `info`. */
export const PAYMENT_WITHDRAW_STATUS_TONES: Record<PaymentWithdrawStatus, 'ok' | 'warn' | 'bad' | 'info'> = {
  CREATED: 'warn',
  SENDING: 'warn',
  SUBMITTED: 'warn',
  COMPLETED: 'ok',
  FAILED: 'bad',
  CANCELLED: 'info',
  EXPIRED: 'info',
};
