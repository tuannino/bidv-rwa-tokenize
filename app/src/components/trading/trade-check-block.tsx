import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import type { TradePreviewState } from './gates';

/**
 * Khối kiểm tra trước lệnh: năm điều kiện theo tài liệu (FE-25 việc 5).
 *
 * Hiện ĐÚNG `conditions` của `previewTradeAction`, không tự đánh giá điều kiện nào: khối này và lần
 * đặt lệnh thật đi qua cùng bộ kiểm ở máy chủ.
 */
export function TradeCheckBlock({ preview }: { preview: TradePreviewState }) {
  return (
    <section aria-label="Khối kiểm tra trước lệnh" className="space-y-2 rounded-lg border border-border p-3">
      <h3 className="text-sm font-medium">Kiểm tra trước lệnh</h3>
      {preview.kind === 'idle' && (
        <p className="text-sm text-muted-foreground">Nhập số lượng hợp lệ, hệ thống kiểm tra năm điều kiện.</p>
      )}
      {preview.kind === 'loading' && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Đang kiểm tra điều kiện…
        </p>
      )}
      {preview.kind === 'error' && <p className="text-sm text-destructive">{preview.message}</p>}
      {preview.kind === 'checked' && (
        <ul className="space-y-1.5">
          {preview.conditions.map((check) => (
            <li key={check.key} data-check={check.key} data-passed={check.passed} className="flex items-start gap-2 text-sm">
              {check.passed ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-label="đạt" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-label="không đạt" />
              )}
              <span>
                <span className="font-medium">{check.label}</span>
                <span className={check.passed ? 'text-muted-foreground' : 'text-destructive'}>
                  {' '}
                  {check.passed ? 'Đạt' : 'Không đạt'}: {check.detail}
                </span>
                {check.howToFix && <span className="block text-xs text-muted-foreground">{check.howToFix}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
