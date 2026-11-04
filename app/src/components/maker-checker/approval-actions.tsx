import { CheckCircle2, Loader2, RefreshCw, ShieldCheck, ShieldX, TriangleAlert, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TokenRequestDetailView } from '@/lib/bank/token-request.service';
import type { TokenRequestStatus } from '@/lib/store/token-request.store.port';
import { approveBlockReason, approveWarningFigures, decisionBlockReason, rejectBlockReason } from './gates';
import { INPUT_CLASS } from './stat-card';
import { StatusBadge } from './status-badge';

/**
 * Khối hành động của màn chi tiết yêu cầu (FE-UX-03a QĐ-10), tách khỏi `approval-detail.tsx` để kiểm được
 * bằng dữ liệu giả. Đây là DỜI mã, không thêm logic: `actionBlocks` là đúng các dòng tính khoá của màn
 * (cùng thứ tự, cùng hàm, cùng chuỗi); `ApprovalActions` dựng đúng thẻ "Khối hành động" cũ. State,
 * handler, server action vẫn ở `approval-detail.tsx`.
 */

export interface Feedback {
  tone: 'success' | 'warning' | 'error';
  message: string;
}

const FEEDBACK_STYLE: Record<Feedback['tone'], string> = {
  success: 'flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm',
  warning:
    'flex items-start gap-2 rounded-md border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100',
  error: 'flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm',
};

/** Ba tầng khoá tách riêng (dời nguyên văn từ `approval-detail.tsx`). */
export function actionBlocks(detail: TokenRequestDetailView | null, working: boolean, rejectReason: string) {
  const decisionBlock = detail ? decisionBlockReason(detail) : 'Đang tải yêu cầu…';
  // FIX-02 B3: cảnh báo số liệu khoá RIÊNG nút "Chấp nhận"; "Từ chối" vẫn bấm được.
  const approveBlock = working ? 'Đang xử lý…' : detail ? approveBlockReason(detail) : 'Đang tải yêu cầu…';
  const approveWarning = detail?.approveWarning ?? null;
  const rejectBlock = working ? 'Đang xử lý…' : (decisionBlock ?? rejectBlockReason(rejectReason));
  return { decisionBlock, approveBlock, rejectBlock, approveWarning };
}

export function ApprovalActions({
  status,
  canReconcile,
  decisionBlock,
  approveBlock,
  rejectBlock,
  approveWarning,
  working,
  rejectReason,
  feedback,
  onRejectReasonChange,
  onApprove,
  onReject,
  onReconcile,
}: {
  status: TokenRequestStatus;
  canReconcile: boolean;
  decisionBlock: string | null;
  approveBlock: string | null;
  rejectBlock: string | null;
  approveWarning: TokenRequestDetailView['approveWarning'];
  working: boolean;
  rejectReason: string;
  feedback: Feedback | null;
  onRejectReasonChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onReconcile: () => void;
}) {
  return (
    <Card aria-label="Khối hành động">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Hành động</CardTitle>
        <StatusBadge status={status} />
      </CardHeader>
      <CardContent className="space-y-4">
        {decisionBlock && (
          <p className="rounded-md border border-border bg-muted/40 p-3 text-sm" data-testid="decision-block-reason">
            {decisionBlock}
          </p>
        )}
        <div className="space-y-1.5">
          <label htmlFor="reject-reason" className="text-sm font-medium">
            Lý do từ chối
          </label>
          <textarea
            id="reject-reason"
            value={rejectReason}
            onChange={(event) => onRejectReasonChange(event.target.value)}
            rows={2}
            disabled={decisionBlock !== null}
            placeholder="Bắt buộc khi từ chối — người lập cần biết phải sửa gì."
            className={INPUT_CLASS}
          />
        </div>
        {approveWarning && (
          <div role="alert" data-testid="approve-warning" className={FEEDBACK_STYLE.warning}>
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <div className="space-y-0.5">
              <p className="font-semibold">{approveWarning.message}</p>
              {approveWarningFigures(approveWarning) && <p>{approveWarningFigures(approveWarning)}</p>}
              <p className="text-xs">Nút &quot;Chấp nhận&quot; đã khoá; có thể từ chối yêu cầu này.</p>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={onApprove} disabled={approveBlock !== null} title={approveBlock ?? undefined}>
            {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Chấp nhận
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onReject}
            disabled={rejectBlock !== null}
            title={rejectBlock ?? undefined}
          >
            <ShieldX className="h-4 w-4" />
            Từ chối
          </Button>
          {canReconcile && (
            <Button
              type="button"
              variant="outline"
              onClick={onReconcile}
              disabled={working}
              title={working ? 'Đang xử lý…' : 'Đọc biên nhận của giao dịch đã gửi rồi chốt theo biên nhận; không gửi giao dịch mới.'}
            >
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Đối soát
            </Button>
          )}
        </div>
        {!decisionBlock && rejectBlock && !working && (
          <p className="text-xs text-muted-foreground" data-testid="reject-block-reason">
            Từ chối: {rejectBlock}
          </p>
        )}
        {feedback && (
          <div role="status" data-tone={feedback.tone} className={FEEDBACK_STYLE[feedback.tone]}>
            {feedback.tone === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            ) : feedback.tone === 'warning' ? (
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
