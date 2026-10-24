import type { ProjectRecord, SettlementRoundRecord } from '@/lib/store';

export type RecallPhaseKind = 'NONE' | 'SCHEDULED' | 'NOTICE' | 'FROZEN' | 'CLOSED';

export interface RecallPhase {
  kind: RecallPhaseKind;
  maturityDate: string | null;
  recallFrom: string | null;
}

/** Ngày lịch tại Việt Nam, không phụ thuộc timezone của máy chạy Worker. */
export function todayVn(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function addDays(value: string, days: number): string {
  if (!isCalendarDate(value) || !Number.isInteger(days)) throw new Error('Ngày hoặc số ngày không hợp lệ.');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function recallPhaseOf(
  round: SettlementRoundRecord | null,
  project: ProjectRecord | null,
  today: string,
): RecallPhase {
  if (project?.status === 'CLOSED' || round?.status === 'COMPLETED') {
    return { kind: 'CLOSED', maturityDate: round?.maturityDate ?? null, recallFrom: round?.recallFrom ?? null };
  }
  if (!round || round.status === 'CANCELLED' || !round.maturityDate || !round.recallFrom) {
    return { kind: 'NONE', maturityDate: null, recallFrom: null };
  }
  if (round.status === 'IN_PROGRESS') {
    return { kind: 'FROZEN', maturityDate: round.maturityDate, recallFrom: round.recallFrom };
  }
  return {
    kind: today < round.maturityDate ? 'SCHEDULED' : 'NOTICE',
    maturityDate: round.maturityDate,
    recallFrom: round.recallFrom,
  };
}

export function tradingBlocked(
  phase: RecallPhase,
  settlementMode: boolean | null,
): { blocked: boolean; message: string | null } {
  const blocked = settlementMode === true || ['NOTICE', 'FROZEN', 'CLOSED'].includes(phase.kind);
  if (!blocked) return { blocked: false, message: null };
  const dates = phase.maturityDate
    ? ` Dự án hết hạn ngày ${phase.maturityDate}${phase.recallFrom ? `, bắt đầu thu hồi ngày ${phase.recallFrom}` : ''}.`
    : '';
  const label = phase.kind === 'CLOSED' ? 'Dự án đã đóng.'
    : phase.kind === 'FROZEN' || settlementMode === true ? 'Token đang bị đóng băng để thu hồi.'
      : 'Dự án đã tới hạn; giao dịch đang tạm dừng.';
  return { blocked: true, message: `${label}${dates}` };
}

export function daysBetween(from: string, to: string): number {
  const at = (value: string) => Date.parse(`${value}T00:00:00.000Z`);
  return Math.ceil((at(to) - at(from)) / 86_400_000);
}
