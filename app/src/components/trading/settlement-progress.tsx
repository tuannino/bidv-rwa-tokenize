import { Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { SettlementStepView, SettlementView } from '@/lib/bank/settlement-steps';
import { formatAmount, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { STEP_STATE_LABELS } from './gates';
import { settlementStepTone, type StepTone } from './order-status-tone';

/**
 * Tiến trình quyết toán năm bước kèm mốc thời gian (FE-25 việc 11, 12).
 *
 * Chỉ VẼ `steps` và `settlement` máy chủ trả (`lib/bank/settlement-steps.ts`); không tự suy bước nào
 * từ trạng thái lệnh. Dùng chung cho màn chi tiết lệnh và kết quả ngay sau khi gửi lệnh.
 *
 * FE-UX-02a: các bước vẽ dạng chấm tròn nối đường (bản chốt `.steps`); màu theo `data-tone`
 * (`settlementStepTone`): xong `ok`, đang chạy `warn`, dừng `bad`, chưa tới `muted`.
 */
const DOT: Record<StepTone, string> = {
  ok: 'bg-primary text-primary-foreground',
  warn: 'bg-accent text-accent-foreground ring-4 ring-warn-bg',
  bad: 'bg-bad-ink text-bad-bg ring-4 ring-bad-bg',
  muted: 'bg-muted text-muted-foreground',
};

export function SettlementProgress({
  steps,
  settlement,
}: {
  steps: SettlementStepView[];
  settlement: SettlementView;
}) {
  return (
    <section aria-label="Tiến trình quyết toán" className="space-y-4">
      <ol className="grid gap-4 sm:grid-cols-5 sm:gap-2">
        {steps.map((step, index) => {
          const tone = settlementStepTone(step.state);
          return (
            <li
              key={step.id}
              data-step={step.id}
              data-state={step.state}
              data-tone={tone}
              className="relative flex gap-3 sm:block sm:pt-9"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-[26px] shrink-0 place-items-center rounded-full text-xs font-bold sm:absolute sm:top-0 sm:left-0',
                  DOT[tone],
                )}
              >
                {tone === 'ok' ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
              </span>
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-3 right-1 left-9 hidden h-0.5 rounded-full sm:block',
                    tone === 'ok' ? 'bg-primary/50' : 'bg-border',
                  )}
                />
              )}
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground">Bước {index + 1}</span>
                <div className="text-sm font-medium">{step.label}</div>
                <div className="text-xs text-muted-foreground">{STEP_STATE_LABELS[step.state]}</div>
                <div className="mt-1 tabular-nums text-xs">{formatDateTime(step.at)}</div>
              </div>
            </li>
          );
        })}
      </ol>

      <Card tone="tint" size="sm">
        <CardContent className="text-sm">
          <p className="font-medium">{settlement.rule}</p>
          <p className="mt-1 text-muted-foreground">
            Kết cục:{' '}
            {settlement.outcome === 'APPLIED'
              ? 'cả bốn bút toán đã ghi.'
              : settlement.outcome === 'NONE_APPLIED'
                ? 'không bút toán nào được ghi, số dư hai bên giữ nguyên.'
                : 'chưa có kết cục.'}
          </p>
          <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {settlement.entries.map((entry, index) => (
              <li key={index} className="flex justify-between gap-3 tabular-nums text-xs">
                <span>
                  {entry.account === 'INVESTOR' ? 'Nhà đầu tư' : 'Người bán'}, {entry.asset}
                </span>
                <span className={entry.direction === 'DEBIT' ? 'font-medium text-destructive' : 'font-medium text-primary'}>
                  {entry.direction === 'DEBIT' ? '-' : '+'}
                  {formatAmount(entry.amount)}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
