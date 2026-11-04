'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { actionBlocks, ApprovalActions, type Feedback } from '@/components/maker-checker/approval-actions';
import { TokenInfoBlock } from '@/components/maker-checker/token-info-block';
import { BURN_SOURCE_LABELS, describeInvalid } from '@/components/maker-checker/gates';
import {
  approveTokenRequestAction,
  getTokenRequestDetailAction,
  reconcileTokenRequestAction,
  rejectTokenRequestAction,
} from '@/app/actions/token-request';
import type { Result } from '@/lib/bank/result';
import type { TokenRequestDetailView } from '@/lib/bank/token-request.service';
import { receiptTimeoutFor } from '@/lib/ledger/ledger.port';
import type { TokenRequestRecord } from '@/lib/store/token-request.store.port';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
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
 *
 * HF-05: duyệt mà chưa có biên nhận thì yêu cầu giữ "Đang thực hiện": màn báo vàng, không nói
 * "đã thực hiện xong". Nút "Đối soát" hiện khi máy chủ báo `canReconcile` (đọc cùng lần mở màn,
 * không thêm action); đối soát chỉ chạy khi bấm.
 */

/** Câu báo theo trạng thái yêu cầu SAU khi duyệt hoặc đối soát. */
export function outcomeFeedback(
  result: Result<TokenRequestRecord & { notice?: string }>,
  after: 'approve' | 'reconcile',
): Feedback {
  if (!result.ok) return { tone: 'error', message: describeInvalid(result.error, result.fieldErrors) };
  const request = result.data;
  // IN-04: máy chủ nêu sẵn câu khi yêu cầu giữ Đang thực hiện vì chưa rõ (Fireblocks, lượt khác, không khớp).
  if (request.notice && request.status === 'EXECUTING') return { tone: 'warning', message: request.notice };
  switch (request.status) {
    case 'COMPLETED':
      return {
        tone: 'success',
        message:
          after === 'approve'
            ? 'Đã chấp nhận. Yêu cầu đã thực hiện xong trên chuỗi.'
            : 'Đã đối soát: giao dịch đã xác nhận trên chuỗi, yêu cầu hoàn tất.',
      };
    case 'FAILED':
      return {
        tone: 'error',
        message: `Đã đối soát: giao dịch không thực hiện được trên chuỗi, yêu cầu chuyển Thất bại${
          request.failureReason ? ` (${request.failureReason})` : ''
        }.`,
      };
    default: {
      const seconds = Math.round(receiptTimeoutFor(request.chain) / 1000);
      return {
        tone: 'warning',
        message:
          after === 'approve'
            ? `Đã gửi lên chuỗi nhưng chưa có xác nhận sau ${seconds} giây. Yêu cầu giữ trạng thái Đang thực hiện; bấm Đối soát sau ít phút.`
            : 'Chưa có biên nhận cho giao dịch. Yêu cầu giữ trạng thái Đang thực hiện; bấm Đối soát sau ít phút.',
      };
    }
  }
}

export function ApprovalDetailPage({ requestId }: { requestId: string }) {
  const { chain } = useSelectedChain();
  const router = useRouter();
  const [revision, setRevision] = useState(0);
  const loadKey = `${chain}|${revision}`;
  const [loaded, setLoaded] = useState<{
    key: string;
    data: TokenRequestDetailView | null;
    error: string | null;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [working, startWork] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void getTokenRequestDetailAction({ requestId, chain }).then((result) => {
      if (cancelled) return;
      setLoaded(
        result.ok
          ? { key: loadKey, data: result.data, error: null }
          : { key: loadKey, data: null, error: result.error },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [chain, loadKey, requestId, revision]);

  const reload = useCallback(() => {
    setRevision((value) => value + 1);
    // Số việc chờ cạnh menu do `AppLayout` (Server Component) dựng — làm mới để nó đọc lại.
    router.refresh();
  }, [router]);

  const fresh = loaded?.key === loadKey ? loaded : null;
  const detail = fresh?.data ?? null;
  const { decisionBlock, approveBlock, rejectBlock, approveWarning } = actionBlocks(detail, working, rejectReason);

  const approve = () =>
    startWork(async () => {
      setFeedback(null);
      const result = await approveTokenRequestAction({ requestId, chain });
      setFeedback(outcomeFeedback(result, 'approve'));
      reload();
    });

  const reconcile = () =>
    startWork(async () => {
      setFeedback(null);
      const result = await reconcileTokenRequestAction({ requestId, chain });
      setFeedback(outcomeFeedback(result, 'reconcile'));
      reload();
    });

  const reject = () =>
    startWork(async () => {
      setFeedback(null);
      const result = await rejectTokenRequestAction({ requestId, chain, reason: rejectReason });
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
          <p className="font-code text-xs text-muted-foreground">{requestId}</p>
        </div>
        <Link prefetch={false} href="/approvals" className="flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Về danh sách
        </Link>
      </header>

      {fresh?.error && <p className="text-sm text-destructive">{fresh.error}</p>}

      {detail && (
        <>
          <ApprovalActions
            status={detail.request.status}
            canReconcile={detail.canReconcile}
            decisionBlock={decisionBlock}
            approveBlock={approveBlock}
            rejectBlock={rejectBlock}
            approveWarning={approveWarning}
            working={working}
            rejectReason={rejectReason}
            feedback={feedback}
            onRejectReasonChange={setRejectReason}
            onApprove={approve}
            onReject={reject}
            onReconcile={reconcile}
          />

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
                  <Row label="Thực hiện qua">{detail.custodyLabel}</Row>
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
                    <span className="tabular-nums text-xs text-muted-foreground">{formatDateTime(entry.at)}</span>
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
      <dd className={mono ? 'break-all text-right font-code' : 'text-right'}>{children}</dd>
    </div>
  );
}
