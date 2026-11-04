import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = ['Đã mở đợt', 'Đến hạn', 'Đã đóng băng', 'Hoàn tất'] as const;

/** Trạng thái một bước so với bước hiện tại (`current` do `recall/gates.ts` `currentStep` tính). */
export type RecallStepState = 'done' | 'current' | 'pending';
export type RecallStepTone = 'ok' | 'warn' | 'muted';

const STEP_TONES: Record<RecallStepState, RecallStepTone> = {
  done: 'ok',
  current: 'warn',
  pending: 'muted',
};

/** Chấm tròn của bước theo sắc (FE-UX-02b QĐ-4): xong xanh có dấu tích, đang ở viền vàng, chưa tới mờ. */
const DOT: Record<RecallStepTone, string> = {
  ok: 'bg-primary text-primary-foreground',
  warn: 'bg-card text-foreground ring-2 ring-accent ring-offset-2 ring-offset-card',
  muted: 'bg-muted text-muted-foreground',
};

/**
 * Bốn bước thu hồi dạng chấm tròn nối đường (bản chốt `.steps`). Mỗi `li` giữ `aria-current` ở bước
 * đang ở, thêm `data-state` và `data-tone`. Ở giai đoạn `CLOSED`, bước 4 "Hoàn tất" là bước đang ở
 * nên hiện viền vàng: đúng theo `currentStep`, không đổi logic.
 */
export function RecallSteps({ current }: { current: 1 | 2 | 3 | 4 | null }) {
  if (current === null) return null;
  return (
    <ol className="grid gap-4 sm:grid-cols-4 sm:gap-2" aria-label="Tiến độ thu hồi">
      {STEPS.map((label, index) => {
        const step = (index + 1) as 1 | 2 | 3 | 4;
        const state: RecallStepState = step < current ? 'done' : step === current ? 'current' : 'pending';
        const tone = STEP_TONES[state];
        return (
          <li
            key={label}
            aria-current={state === 'current' ? 'step' : undefined}
            data-state={state}
            data-tone={tone}
            className={cn(
              'relative flex items-center gap-3 text-sm sm:flex-col sm:items-start sm:gap-2',
              state === 'current' && 'font-semibold',
              state === 'done' && 'font-medium',
              state === 'pending' && 'text-muted-foreground',
            )}
          >
            <span className={cn('relative z-10 grid size-[26px] shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums', DOT[tone])}>
              {state === 'done' ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : step}
            </span>
            {index < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-3 right-1 left-9 hidden h-0.5 rounded-full sm:block',
                  state === 'done' ? 'bg-primary/50' : 'bg-border',
                )}
              />
            )}
            {label}
          </li>
        );
      })}
    </ol>
  );
}
