import type { RecallPhaseKind } from '@/lib/bank/recall-phase';
import { SETTLEMENT_CASE_STATUSES, type SettlementCaseStatus } from '@/lib/store/settlement.store.port';

/** Sắc nhãn trạng thái (biến thể `Badge` FE-UX-02a). */
export type CaseTone = 'ok' | 'warn' | 'bad' | 'info';

/** Trạng thái một dòng bảng hồ sơ: trạng thái hồ sơ thật, hoặc `PREVIEW` cho dòng "Dự kiến". */
export type CaseRowStatus = SettlementCaseStatus | 'PREVIEW';

/**
 * Sắc hồ sơ thu hồi (FE-UX-02b QĐ-4). `Record` đủ khoá: thêm trạng thái mới mà quên gán sắc thì
 * typecheck báo lỗi.
 */
const CASE_TONES: Record<CaseRowStatus, CaseTone> = {
  NOTIFIED: 'warn',
  CONFIRMED: 'info',
  PAID: 'info',
  BURNING: 'info',
  BURNED: 'ok',
  FAILED: 'bad',
  PREVIEW: 'info',
};

const isCaseRowStatus = (value: string): value is CaseRowStatus =>
  value === 'PREVIEW' || (SETTLEMENT_CASE_STATUSES as readonly string[]).includes(value);

/** Máy chủ trả `string`: thu hẹp kiểu trước khi tra bảng; giá trị lạ là `info`. */
export function caseTone(status: string): CaseTone {
  return isCaseRowStatus(status) ? CASE_TONES[status] : 'info';
}

/** Giai đoạn đợt: mọi giá trị là `info` (chỉ là nhãn thông tin, không phải kết cục). */
const PHASE_TONES: Record<RecallPhaseKind, CaseTone> = {
  NONE: 'info',
  SCHEDULED: 'info',
  NOTICE: 'info',
  FROZEN: 'info',
  CLOSED: 'info',
};

export function phaseTone(phase: RecallPhaseKind): CaseTone {
  return PHASE_TONES[phase] ?? 'info';
}
