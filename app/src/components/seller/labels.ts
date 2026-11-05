import type { StatusTone } from '@/components/trading/order-status-tone';
import type { WithdrawStatus } from '@/lib/store/vault.store.port';

/** Trạng thái lệnh rút (BE-13 QĐ-E, FIX-01 G4). */
export const WITHDRAW_STATUS_LABELS: Record<WithdrawStatus, string> = {
  PAYOUT_SENDING: 'Đang đặt ví nhận',
  PAYOUT_SENT: 'Đang đặt ví nhận',
  PAYOUT_SET: 'Đã đặt ví nhận, chờ gửi rút',
  PAYOUT_REVIEW: 'Cần xem xét (đặt ví nhận)',
  SENDING: 'Đang gửi',
  SENT: 'Đã gửi, chờ biên nhận',
  COMPLETED: 'Hoàn tất',
  FAILED: 'Thất bại',
  NEEDS_REVIEW: 'Cần Kiểm soát viên xem',
};

/** Sắc nhãn trạng thái lệnh rút (FE-UX-05a QĐ-6): xong `ok`, hỏng `bad`, còn lại đang xử lý `warn`. */
export const WITHDRAW_STATUS_TONES: Record<WithdrawStatus, StatusTone> = {
  PAYOUT_SENDING: 'warn',
  PAYOUT_SENT: 'warn',
  PAYOUT_SET: 'warn',
  PAYOUT_REVIEW: 'warn',
  SENDING: 'warn',
  SENT: 'warn',
  COMPLETED: 'ok',
  FAILED: 'bad',
  NEEDS_REVIEW: 'warn',
};
