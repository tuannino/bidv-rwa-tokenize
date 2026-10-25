import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = ['Đã mở đợt', 'Đến hạn', 'Đã đóng băng', 'Hoàn tất'] as const;

export function RecallSteps({ current }: { current: 1 | 2 | 3 | 4 | null }) {
  if (current === null) return null;
  return (
    <ol className="grid gap-2 sm:grid-cols-4" aria-label="Tiến độ thu hồi">
      {STEPS.map((label, index) => {
        const step = (index + 1) as 1 | 2 | 3 | 4;
        const done = current !== null && step < current;
        const active = step === current;
        return (
          <li
            key={label}
            aria-current={active ? 'step' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
              active && 'border-primary bg-primary/5 font-semibold',
              done && 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30',
            )}
          >
            <span className="flex size-6 items-center justify-center rounded-full border text-xs tabular-nums">
              {done ? <Check className="size-3.5" aria-hidden="true" /> : step}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}
