import { Gavel, Loader2, Lock, RefreshCw, ShieldCheck, ShieldX } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardTitleIcon } from '@/components/ui/card';
import { fieldClass } from '@/components/ui/field';
import type { TokenRequestDetailView } from '@/lib/bank/token-request.service';
import type { TokenRequestStatus } from '@/lib/store/token-request.store.port';
import { approveBlockReason, approveWarningFigures, decisionBlockReason, rejectBlockReason } from './gates';
import { StatusBadge } from './status-badge';

/**
 * Khối hành động của màn chi tiết yêu cầu (FE-UX-03a QĐ-10), tách khỏi `approval-detail.tsx` để kiểm được
 * bằng dữ liệu giả. Đây là DỜI mã, không thêm logic: `actionBlocks` là đúng các dòng tính khoá của màn
 * (cùng thứ tự, cùng hàm, cùng chuỗi); `ApprovalActions` dựng đúng thẻ "Khối hành động" cũ. State,
 * handler, server action vẫn ở `approval-detail.tsx`.
 *
 * Kiểu (FE-UX-03a QĐ-4): lý do khoá quyết định là `Alert warn` biểu tượng khoá (không `role`); cảnh báo duyệt
 * `Alert warn` giữ `role="alert"`; phản hồi `Alert` theo tone, giữ `role="status"` và `data-tone`; ô lý do
 * `fieldClass`. Từ 1100 px: cột trái (khoá, lý do, cảnh báo), cột phải 3 nút cao 48 px xếp dọc.
 */

export interface Feedback {
  tone: 'success' | 'warning' | 'error';
  message: string;
}

const FEEDBACK_TONE = { success: 'ok', warning: 'warn', error: 'bad' } as const;

const ACTION_BUTTON = 'h-12 flex-1 min-[1100px]:w-full min-[1100px]:flex-none';

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
      {/* Lưới hai cột: tiêu đề bên trái, nhãn trạng thái góc phải (không dùng CardAction để module thẻ dùng
          chung không phình ra ở các trang khác). */}
      <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-center">
        <CardTitle className="flex items-center gap-2.5 text-base">
          <CardTitleIcon>
            <Gavel />
          </CardTitleIcon>
          Hành động
        </CardTitle>
        <StatusBadge status={status} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-5 min-[1100px]:grid-cols-[minmax(0,420px)_15rem] min-[1100px]:justify-between">
          <div className="min-w-0 space-y-4">
            {decisionBlock && (
              <Alert
                tone="warn"
                icon={<Lock className="mt-px size-[18px] shrink-0" aria-hidden="true" />}
                data-testid="decision-block-reason"
              >
                {decisionBlock}
              </Alert>
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
                placeholder="Bắt buộc khi từ chối, người lập cần biết phải sửa gì."
                className={fieldClass}
              />
            </div>
            {approveWarning && (
              <Alert tone="warn" role="alert" data-testid="approve-warning">
                <div className="space-y-0.5">
                  <p className="font-semibold">{approveWarning.message}</p>
                  {approveWarningFigures(approveWarning) && <p>{approveWarningFigures(approveWarning)}</p>}
                  <p className="text-xs">Nút &quot;Chấp nhận&quot; đã khoá; có thể từ chối yêu cầu này.</p>
                </div>
              </Alert>
            )}
          </div>
          <div className="flex flex-wrap gap-3 min-[1100px]:flex-col min-[1100px]:flex-nowrap">
            <Button
              type="button"
              size="lg"
              className={ACTION_BUTTON}
              onClick={onApprove}
              disabled={approveBlock !== null}
              title={approveBlock ?? undefined}
            >
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Chấp nhận
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="lg"
              className={ACTION_BUTTON}
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
                size="lg"
                className={ACTION_BUTTON}
                onClick={onReconcile}
                disabled={working}
                title={working ? 'Đang xử lý…' : 'Đọc biên nhận của giao dịch đã gửi rồi chốt theo biên nhận; không gửi giao dịch mới.'}
              >
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Đối soát
              </Button>
            )}
          </div>
        </div>
        {!decisionBlock && rejectBlock && !working && (
          <p className="text-xs text-muted-foreground" data-testid="reject-block-reason">
            Từ chối: {rejectBlock}
          </p>
        )}
        {feedback && (
          <Alert tone={FEEDBACK_TONE[feedback.tone]} role="status" data-tone={feedback.tone}>
            {feedback.message}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
