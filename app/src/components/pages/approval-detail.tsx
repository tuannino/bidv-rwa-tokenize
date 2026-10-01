'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck, ShieldX, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/maker-checker/status-badge';
import { INPUT_CLASS } from '@/components/maker-checker/stat-card';
import { TokenInfoBlock } from '@/components/maker-checker/token-info-block';
import {
  BURN_SOURCE_LABELS,
  decisionBlockReason,
  describeInvalid,
  rejectBlockReason,
} from '@/components/maker-checker/gates';
import {
  approveTokenRequestAction,
  getTokenRequestDetailAction,
  rejectTokenRequestAction,
} from '@/app/actions/token-request';
import type { TokenRequestDetailView } from '@/lib/bank/token-request.service';
import { formatAmount, formatDateTime } from '@/lib/format';

/**
 * Màn **chi tiết yêu cầu** — vai Kiểm soát viên (FE-22 việc 10–13).
 *
 * Bốn khối: hành động (chấp nhận / từ chối), thông tin token, nội dung yêu cầu, nhật ký. Mọi thứ
 * đọc từ `getTokenRequestDetailAction`; sau mỗi quyết định thì đọc LẠI toàn bộ, nên trạng thái,
 * số liệu nguồn cung và nhật ký trên màn hình là của máy chủ chứ không phải của form.
 *
 * Nút bị khoá TRƯỚC khi bấm khi người xem chính là người lập (`selfApprovalReason` do máy chủ
 * tính bằng cùng phép so mà lần duyệt dùng), và nút từ chối khoá khi chưa nhập lý do. Chốt chặn
 * thật vẫn ở service.
 */

interface Feedback {
  tone: 'success' | 'error';
  message: string;
}

export function ApprovalDetailPage({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState<{
    key: number;
    data: TokenRequestDetailView | null;
    error: string | null;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [working, startWork] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void getTokenRequestDetailAction({ requestId }).then((result) => {
      if (cancelled) return;
      setLoaded(
        result.ok
          ? { key: revision, data: result.data, error: null }
          : { key: revision, data: null, error: result.error },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [requestId, revision]);

  const reload = useCallback(() => {
    setRevision((value) => value + 1);
    // Số việc chờ cạnh menu do `AppLayout` (Server Component) dựng — làm mới để nó đọc lại.
    router.refresh();
  }, [router]);

  const detail = loaded?.data ?? null;
  const decisionBlock = detail ? decisionBlockReason(detail) : 'Đang tải yêu cầu…';
  const approveBlock = working ? 'Đang xử lý…' : decisionBlock;
  const rejectBlock = working ? 'Đang xử lý…' : (decisionBlock ?? rejectBlockReason(rejectReason));

  const approve = () =>
    startWork(async () => {
      setFeedback(null);
      const result = await approveTokenRequestAction({ requestId });
      setFeedback(
        result.ok
          ? { tone: 'success', message: 'Đã chấp nhận. Yêu cầu đã thực hiện xong trên chuỗi.' }
          : { tone: 'error', message: describeInvalid(result.error, result.fieldErrors) },
      );
      reload();
    });

  const reject = () =>
    startWork(async () => {
      setFeedback(null);
      const result = await rejectTokenRequestAction({ requestId, reason: rejectReason });
      if (result.ok) setRejectReason('');
      setFeedback(
        result.ok
          ? { tone: 'success', message: 'Đã từ chối yêu cầu. Người lập sẽ thấy lý do trong bảng yêu cầu đã lập.' }
          : { tone: 'error', message: describeInvalid(result.error, result.fieldErrors) },
      );
      reload();
    });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Chi tiết yêu cầu</h1>
          <p className="font-mono text-xs text-muted-foreground">{requestId}</p>
        </div>
        <Link href="/approvals" className="flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Về danh sách
        </Link>
      </header>

      {loaded?.error && <p className="text-sm text-destructive">{loaded.error}</p>}

      {detail && (
        <>
          <Card aria-label="Khối hành động">
            <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">Hành động</CardTitle>
              <StatusBadge status={detail.request.status} />
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
                  onChange={(event) => setRejectReason(event.target.value)}
                  rows={2}
                  disabled={decisionBlock !== null}
                  placeholder="Bắt buộc khi từ chối — người lập cần biết phải sửa gì."
                  className={INPUT_CLASS}
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="button" onClick={approve} disabled={approveBlock !== null} title={approveBlock ?? undefined}>
                  {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Chấp nhận
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={reject}
                  disabled={rejectBlock !== null}
                  title={rejectBlock ?? undefined}
                >
                  <ShieldX className="h-4 w-4" />
                  Từ chối
                </Button>
              </div>
              {!decisionBlock && rejectBlock && !working && (
                <p className="text-xs text-muted-foreground" data-testid="reject-block-reason">
                  Từ chối: {rejectBlock}
                </p>
              )}
              {feedback && (
                <div
                  role="status"
                  className={
                    feedback.tone === 'success'
                      ? 'flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm'
                      : 'flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm'
                  }
                >
                  {feedback.tone === 'success' ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <TokenInfoBlock info={detail.token} error={detail.tokenError} />

            <Card size="sm" aria-label="Khối nội dung yêu cầu">
              <CardHeader>
                <CardTitle className="text-sm">Nội dung yêu cầu</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-y-2 text-sm">
                  <Row label="Loại">{detail.request.type === 'MINT' ? 'Tạo token' : 'Huỷ token'}</Row>
                  <Row label="Token">
                    {detail.request.tokenSymbol} ({detail.request.chain})
                  </Row>
                  <Row label="Số lượng" mono>
                    {formatAmount(detail.request.amount)}
                  </Row>
                  {detail.request.burnSource && (
                    <Row label="Nguồn">{BURN_SOURCE_LABELS[detail.request.burnSource]}</Row>
                  )}
                  <Row label="Ví tác động" mono>
                    {detail.request.wallet}
                  </Row>
                  <Row label="Lý do">{detail.request.reason}</Row>
                  <Row label="Chứng từ">{detail.request.documentRef ?? '—'}</Row>
                  <Row label="Ngày hiệu lực">{detail.request.effectiveDate ?? '—'}</Row>
                  <Row label="Ghi chú">{detail.request.note ?? '—'}</Row>
                  <Row label="Người lập">{detail.request.makerId}</Row>
                  <Row label="Thời điểm lập">{formatDateTime(detail.request.createdAt)}</Row>
                  <Row label="Mã giao dịch" mono>
                    {detail.request.txHash ?? '—'}
                  </Row>
                </dl>
              </CardContent>
            </Card>
          </div>

          <Card aria-label="Nhật ký">
            <CardHeader>
              <CardTitle className="text-base">Nhật ký</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {detail.timeline.map((entry, index) => (
                  <li key={`${entry.at}-${index}`} className="grid gap-1 border-l-2 border-primary/40 pl-3 text-sm sm:grid-cols-[11rem_minmax(0,1fr)]">
                    <span className="font-mono text-xs text-muted-foreground">{formatDateTime(entry.at)}</span>
                    <span>
                      <span className="font-medium">{entry.label}</span>
                      {entry.actor && <span className="text-muted-foreground"> · {entry.actor}</span>}
                      {entry.detail && (
                        <span className="block break-all text-xs text-muted-foreground">{entry.detail}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Row({ label, mono, children }: { label: string; mono?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 border-b border-border/60 py-1">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={mono ? 'break-all text-right font-mono' : 'text-right'}>{children}</dd>
    </div>
  );
}
