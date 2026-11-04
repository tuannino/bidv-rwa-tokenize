import type { SettlementStepState } from '@/lib/bank/settlement-steps';
import type { OrderStatus } from '@/lib/store/order.store.port';

/** Sắc nhãn trạng thái (biến thể `Badge` FE-UX-02a). */
export type StatusTone = 'ok' | 'warn' | 'bad' | 'info';

/**
 * Sắc của trạng thái lệnh (FE-UX-02a QĐ-3). `Record` đủ khoá: thêm trạng thái mới mà quên gán sắc thì
 * typecheck báo lỗi.
 */
const ORDER_STATUS_TONES: Record<OrderStatus, StatusTone> = {
  PLACED: 'warn',
  CHECKING: 'warn',
  EXECUTING: 'warn',
  COMPLETED: 'ok',
  REJECTED: 'bad',
  FAILED: 'bad',
  EXPIRED: 'info',
};

export function orderStatusTone(status: OrderStatus): StatusTone {
  return ORDER_STATUS_TONES[status];
}

/** Sắc của một bước quyết toán: xong `ok`, đang chạy `warn`, dừng `bad`, chưa tới `muted`. */
export type StepTone = 'ok' | 'warn' | 'bad' | 'muted';

const STEP_TONES: Record<SettlementStepState, StepTone> = {
  done: 'ok',
  current: 'warn',
  failed: 'bad',
  pending: 'muted',
};

export function settlementStepTone(state: SettlementStepState): StepTone {
  return STEP_TONES[state];
}
