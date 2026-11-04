import type { KeeperRunStatus } from '@/lib/store/keeper.store.port';
import type {
  DistributionApprovalStatus,
  DistributionPayoutStatus,
  DistributionPeriodStatus,
  VaultCloseStatus,
} from '@/lib/store/distribution.store.port';

/** Sắc nhãn trạng thái (biến thể `Badge` FE-UX-02a). */
export type StatusTone = 'ok' | 'warn' | 'bad' | 'info';

/**
 * Sắc các nhãn trạng thái của màn Chia lợi nhuận (FE-UX-03b QĐ-4). `Record` đủ khoá: thêm trạng thái mới mà
 * quên gán sắc thì typecheck báo lỗi. Hàm nhận `string` và tra bảng sau khi kiểm khoá; giá trị lạ là `info`.
 */
const PERIOD_TONES: Record<DistributionPeriodStatus, StatusTone> = {
  OPENING: 'warn',
  OPEN: 'info',
  DISTRIBUTING: 'warn',
  COMPLETED: 'ok',
  EXPIRED: 'bad',
  CLOSED: 'info',
};

const APPROVAL_TONES: Record<DistributionApprovalStatus, StatusTone> = {
  APPROVED: 'ok',
  AMOUNT_CHANGED: 'warn',
};

const PAYOUT_TONES: Record<DistributionPayoutStatus, StatusTone> = {
  PENDING: 'warn',
  SENT: 'info',
  PAID: 'ok',
  FAILED: 'bad',
  EXPIRED: 'bad',
};

const RUN_TONES: Record<KeeperRunStatus, StatusTone> = {
  RUNNING: 'warn',
  SUCCESS: 'ok',
  FAILED: 'bad',
};

const VAULT_CLOSE_TONES: Record<VaultCloseStatus, StatusTone> = {
  PENDING: 'warn',
  SENT: 'info',
  DONE: 'ok',
  CONFLICT: 'bad',
};

function toneOf<K extends string>(tones: Record<K, StatusTone>, value: string): StatusTone {
  return Object.prototype.hasOwnProperty.call(tones, value) ? tones[value as K] : 'info';
}

export const periodStatusTone = (status: string) => toneOf(PERIOD_TONES, status);
export const approvalStatusTone = (status: string) => toneOf(APPROVAL_TONES, status);
export const payoutStatusTone = (status: string) => toneOf(PAYOUT_TONES, status);
export const runStatusTone = (status: string) => toneOf(RUN_TONES, status);
export const vaultCloseStatusTone = (status: string) => toneOf(VAULT_CLOSE_TONES, status);
