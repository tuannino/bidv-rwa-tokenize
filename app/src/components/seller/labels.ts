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
