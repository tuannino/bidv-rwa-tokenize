import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import type { SettlementStepView, SettlementView } from '@/lib/bank/settlement-steps';
import { formatAmount, formatDateTime } from '@/lib/format';
import { STEP_STATE_LABELS } from './gates';

/**
 * Tiến trình quyết toán năm bước kèm mốc thời gian (FE-25 việc 11, 12).
 *
 * Chỉ VẼ `steps` và `settlement` máy chủ trả (`lib/bank/settlement-steps.ts`); không tự suy bước nào
 * từ trạng thái lệnh. Dùng chung cho màn chi tiết lệnh và kết quả ngay sau khi gửi lệnh.
 */
export function SettlementProgress({
  steps,
  settlement,
}: {
  steps: SettlementStepView[];
  settlement: SettlementView;
}) {
  return (
    <section aria-label="Tiến trình quyết toán" className="space-y-4">
      <ol className="grid gap-3 sm:grid-cols-5">
        {steps.map((step, index) => (
          <li
            key={step.id}
            data-step={step.id}
            data-state={step.state}
            className="rounded-lg border border-border p-3"
          >
            <div className="flex items-center gap-2">
              <StepIcon state={step.state} />
              <span className="text-xs text-muted-foreground">Bước {index + 1}</span>
            </div>
            <div className="mt-1 text-sm font-medium">{step.label}</div>
            <div className="text-xs text-muted-foreground">{STEP_STATE_LABELS[step.state]}</div>
            <div className="mt-1 font-mono text-xs">{formatDateTime(step.at)}</div>
          </li>
        ))}
      </ol>

      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
        <p className="font-medium">{settlement.rule}</p>
        <p className="mt-1 text-muted-foreground">
          Kết cục:{' '}
          {settlement.outcome === 'APPLIED'
            ? 'cả bốn bút toán đã ghi.'
            : settlement.outcome === 'NONE_APPLIED'
              ? 'không bút toán nào được ghi, số dư hai bên giữ nguyên.'
              : 'chưa có kết cục.'}
        </p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {settlement.entries.map((entry, index) => (
            <li key={index} className="flex justify-between gap-3 font-mono text-xs">
              <span>
                {entry.account === 'INVESTOR' ? 'Nhà đầu tư' : 'Người bán'}, {entry.asset}
              </span>
              <span className={entry.direction === 'DEBIT' ? 'text-destructive' : 'text-primary'}>
                {entry.direction === 'DEBIT' ? '-' : '+'}
                {formatAmount(entry.amount)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function StepIcon({ state }: { state: SettlementStepView['state'] }) {
  if (state === 'done') return <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />;
  if (state === 'failed') return <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />;
  if (state === 'current') return <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />;
  return <Circle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
}
