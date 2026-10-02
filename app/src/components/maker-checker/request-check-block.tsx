import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import type { PreviewState } from './gates';

/**
 * Khối kiểm tra trước khi lập — dùng chung cho thẻ tạo token và thẻ huỷ token (FE-22 yêu cầu 4).
 *
 * Hiện TỪNG điều kiện đúng như `previewTokenRequestAction` trả, kèm trạng thái và chi tiết. Không
 * tự đánh giá điều kiện nào: khối này và lần lập thật dùng chung một phép kiểm ở máy chủ, nên điều
 * màn hình nói "đạt" cũng là điều máy chủ sẽ chấp nhận.
 */
export function RequestCheckBlock({ preview }: { preview: PreviewState }) {
  return (
    <section
      aria-label="Khối kiểm tra trước khi lập"
      className="space-y-2 rounded-lg border border-border p-3"
    >
      <h3 className="text-sm font-medium">Kiểm tra trước khi lập</h3>
      {preview.kind === 'idle' && (
        <p className="text-sm text-muted-foreground">
          Hệ thống kiểm tra điều kiện ngay khi đủ dữ liệu.
        </p>
      )}
      {preview.kind === 'loading' && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Đang kiểm tra điều kiện…
        </p>
      )}
      {preview.kind === 'invalid' && <p className="text-sm text-destructive">{preview.message}</p>}
      {preview.kind === 'checked' && (
        <ul className="space-y-1.5">
          {preview.checks.map((check) => (
            <li
              key={check.key}
              data-check={check.key}
              data-passed={check.passed}
              className="flex items-start gap-2 text-sm"
            >
              {check.passed ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-label="đạt" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-label="trượt" />
              )}
              <span>
                <span className="font-medium">{check.label}</span>
                <span className={check.passed ? 'text-muted-foreground' : 'text-destructive'}>
                  {' '}
                  {check.passed ? 'Đạt' : 'Không đạt'}: {check.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
