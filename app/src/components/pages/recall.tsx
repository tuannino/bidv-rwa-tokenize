'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  cancelRecallAction,
  freezeTokenAction,
  getRecallOverviewAction,
  openRecallAction,
  recallBatchAction,
  rescheduleRecallAction,
  unfreezeTokenAction,
} from '@/app/actions/recall';
import { RecallCasesTable } from '@/components/recall/cases-table';
import { RecallControls, type RecallStage } from '@/components/recall/controls';
import { RECALL_FIELD, RecallDialog } from '@/components/recall/dialogs';
import { currentStep, recallControls, symbolMatches } from '@/components/recall/gates';
import { RoundInfo } from '@/components/recall/round-info';
import { RecallSteps } from '@/components/recall/steps';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RecallBatchProgress, RecallOverview } from '@/lib/bank/recall.service';
import { addDays, isCalendarDate } from '@/lib/bank/recall-phase';
import type { Result } from '@/lib/bank/result';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { formatVnDate } from '@/lib/format';

const REASON_MIN = 5;
const REASON_MAX = 200;

type Loaded = { chain: string; result: Result<RecallOverview> };

function tomorrow(value: string): string {
  return addDays(value, 1);
}

export function RecallPage() {
  const { chain } = useSelectedChain();
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [staged, setStaged] = useState<{ chain: string; value: RecallStage }>({ chain, value: 'idle' });
  const [maturityDate, setMaturityDate] = useState('');
  const [noticeDays, setNoticeDays] = useState('1');
  const [reason, setReason] = useState('');
  const [unfreezeReason, setUnfreezeReason] = useState('');
  const [confirmSymbol, setConfirmSymbol] = useState('');
  const [feedback, setFeedback] = useState<{ chain: string; message: string | null }>({ chain, message: null });
  const [batchProgress, setBatchProgress] = useState<{ chain: string; value: RecallBatchProgress | null }>({ chain, value: null });
  const [busy, startWork] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void getRecallOverviewAction({ chain }).then((result) => {
      if (!cancelled) setLoaded({ chain, result });
    });
    return () => { cancelled = true; };
  }, [chain, revision]);

  const overview = loaded?.chain === chain && loaded.result.ok ? loaded.result.data : null;
  const loadError = loaded?.chain === chain && !loaded.result.ok ? loaded.result.error : null;
  const stage = staged.chain === chain ? staged.value : 'idle';
  const actionError = feedback.chain === chain ? feedback.message : null;
  const progress = batchProgress.chain === chain ? batchProgress.value : null;
  const setStage = useCallback((value: RecallStage) => setStaged({ chain, value }), [chain]);
  const setActionError = useCallback((message: string | null) => setFeedback({ chain, message }), [chain]);
  const setProgress = useCallback((value: RecallBatchProgress | null) => setBatchProgress({ chain, value }), [chain]);

  const showStage = useCallback((next: RecallStage) => {
    setActionError(null);
    setConfirmSymbol('');
    setReason('');
    if (overview) {
      const existingDate = next === 'reschedule' ? overview.round?.maturityDate : null;
      setMaturityDate(existingDate ?? tomorrow(overview.today));
      setNoticeDays(String(next === 'reschedule' ? overview.round?.noticeDays ?? 30 : 30));
    }
    setStage(next);
  }, [overview, setActionError, setStage]);

  const finish = useCallback((result: Result<unknown>, batch?: Result<RecallBatchProgress>) => {
    if (result.ok) {
      setActionError(null);
      setStage('idle');
    } else {
      setActionError(result.error);
    }
    if (batch?.ok) setProgress(batch.data);
    setRevision((value) => value + 1);
  }, [setActionError, setProgress, setStage]);

  const run = useCallback((work: () => Promise<Result<unknown>>) => {
    setActionError(null);
    startWork(async () => finish(await work()));
  }, [finish, setActionError]);

  const runRecall = useCallback(() => {
    if (!overview?.round) return;
    setActionError(null);
    startWork(async () => {
      const result = await recallBatchAction({ chain, roundId: overview.round?.id });
      finish(result, result);
    });
  }, [chain, finish, overview, setActionError]);

  const controls = useMemo(() => overview ? recallControls(overview) : null, [overview]);
  const noticeNumber = Number(noticeDays);
  const calculatedRecall = isCalendarDate(maturityDate) && Number.isInteger(noticeNumber)
    ? addDays(maturityDate, noticeNumber)
    : null;
  const reasonValid = reason.trim().length >= REASON_MIN && reason.trim().length <= REASON_MAX;
  const unfreezeReasonValid = unfreezeReason.trim().length >= REASON_MIN && unfreezeReason.trim().length <= REASON_MAX;
  const datesValid = Boolean(
    overview
      && isCalendarDate(maturityDate)
      && maturityDate >= overview.today
      && Number.isInteger(noticeNumber)
      && noticeNumber >= overview.minNoticeDays
      && noticeNumber <= 365,
  );
  const symbol = overview?.project?.tokenSymbol ?? '';

  const submitRound = (kind: 'open' | 'reschedule') => {
    if (!overview || !datesValid || !reasonValid) {
      setActionError(`Kiểm tra ngày, số ngày báo trước và lý do từ ${REASON_MIN} tới ${REASON_MAX} ký tự.`);
      return;
    }
    const input = { chain, maturityDate, noticeDays: noticeNumber, reason: reason.trim() };
    run(() => kind === 'open'
      ? openRecallAction(input)
      : rescheduleRecallAction({ ...input, roundId: overview.round?.id }));
  };

  if (!loaded || loaded.chain !== chain) {
    return <p role="status" className="text-sm text-muted-foreground">Đang tải tình trạng thu hồi...</p>;
  }
  if (loadError || !overview || !controls) {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-destructive">{loadError ?? 'Không tải được tình trạng thu hồi.'}</p>
        <Button variant="outline" onClick={() => setRevision((value) => value + 1)}>Thử lại</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Thu hồi token</h1>
        <p className="mt-1 text-sm text-muted-foreground">Lập lịch, đóng băng và thu hồi WPT khi dự án hết hạn. Thanh toán thực hiện ngoài hệ thống trong phạm vi PoC.</p>
      </div>

      <RecallSteps current={currentStep(overview)} />

      <Card>
        <CardHeader><CardTitle>Tình trạng đợt thu hồi</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <RoundInfo overview={overview} progress={progress} />
          {overview.canManage ? (
            <RecallControls
              state={controls}
              busy={busy}
              onStage={showStage}
              onRecheckFreeze={() => overview.round && run(() => freezeTokenAction({ chain, roundId: overview.round?.id, confirmSymbol: symbol }))}
              onRecheckUnfreeze={() => showStage('unfreeze')}
              onRecall={runRecall}
            />
          ) : <p className="text-sm text-muted-foreground">Giao dịch viên chỉ được xem tình trạng và danh sách hồ sơ.</p>}
          {actionError && stage === 'idle' && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{overview.cases.length > 0 ? 'Hồ sơ thu hồi' : 'Danh sách ví dự kiến'}</CardTitle></CardHeader>
        <CardContent><RecallCasesTable overview={overview} /></CardContent>
      </Card>

      <RecallDialog
        open={stage === 'open' || stage === 'reschedule'}
        title={stage === 'reschedule' ? 'Sửa mốc thu hồi' : 'Mở đợt thu hồi'}
        description={`Ngày hết hạn không được trước hôm nay. Chain này cần báo trước ít nhất ${overview.minNoticeDays} ngày.`}
        busy={busy}
        submitLabel={stage === 'reschedule' ? 'Lưu mốc mới' : 'Mở đợt'}
        error={actionError}
        submitDisabled={!datesValid || !reasonValid}
        onClose={() => setStage('idle')}
        onSubmit={() => submitRound(stage === 'reschedule' ? 'reschedule' : 'open')}
      >
        <label className="grid gap-1 text-sm">Ngày hết hạn
          <input className={RECALL_FIELD} type="date" min={overview.today} value={maturityDate} onChange={(event) => setMaturityDate(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">Số ngày báo trước
          <input className={RECALL_FIELD} type="number" min={overview.minNoticeDays} max={365} value={noticeDays} onChange={(event) => setNoticeDays(event.target.value)} />
        </label>
        <p className="text-sm text-muted-foreground">Ngày bắt đầu thu hồi: {calculatedRecall ? formatVnDate(calculatedRecall) : 'chưa hợp lệ'}</p>
        <label className="grid gap-1 text-sm">Lý do
          <textarea className={RECALL_FIELD} maxLength={REASON_MAX} value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <p className="text-xs text-muted-foreground">{reason.length}/{REASON_MAX} ký tự</p>
      </RecallDialog>

      <RecallDialog
        open={stage === 'cancel'}
        title="Huỷ đợt thu hồi"
        description="Huỷ đợt sẽ mở lại giao dịch nếu đã tới ngày hết hạn. Đợt đã huỷ vẫn được giữ trong lịch sử."
        busy={busy}
        submitLabel="Xác nhận huỷ"
        destructive
        error={actionError}
        submitDisabled={!reasonValid}
        onClose={() => setStage('idle')}
        onSubmit={() => {
          if (!overview.round || !reasonValid) return setActionError(`Lý do phải có từ ${REASON_MIN} tới ${REASON_MAX} ký tự.`);
          run(() => cancelRecallAction({ chain, roundId: overview.round?.id, reason: reason.trim() }));
        }}
      >
        <label className="grid gap-1 text-sm">Lý do huỷ
          <textarea className={RECALL_FIELD} maxLength={REASON_MAX} value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
      </RecallDialog>

      <RecallDialog
        open={stage === 'freeze' || stage === 'first-recall' || stage === 'unfreeze'}
        title={stage === 'freeze' ? 'Đóng băng token' : stage === 'unfreeze' ? 'Mở đóng băng token' : 'Thu hồi lô đầu'}
        description={stage === 'freeze'
          ? `Tạm dừng ${overview.project?.name ?? 'token'} (${symbol}) trên chuỗi ${chain}. Mọi chuyển nhượng, mua bán ${symbol} dừng. Có thể mở đóng băng trước khi đốt ví đầu tiên; sau đó không mở lại được. Token khác không bị ảnh hưởng.`
          : stage === 'first-recall'
            ? 'Từ lần này không mở đóng băng được nữa.'
            : `Gõ đúng ký hiệu ${symbol} và nêu lý do để mở đóng băng trên chuỗi ${chain}.`}
        busy={busy}
        submitLabel={stage === 'freeze' ? 'Đóng băng' : stage === 'unfreeze' ? 'Mở đóng băng' : 'Thu hồi lô đầu'}
        destructive={stage !== 'unfreeze'}
        error={actionError}
        submitDisabled={!symbolMatches(confirmSymbol, symbol) || (stage === 'unfreeze' && !unfreezeReasonValid)}
        onClose={() => setStage('idle')}
        onSubmit={() => {
          if (!symbolMatches(confirmSymbol, symbol)) return setActionError(`Hãy gõ đúng ký hiệu ${symbol} để xác nhận.`);
          if (stage === 'unfreeze') {
            if (!overview.round || !unfreezeReasonValid) return setActionError(`Lý do phải có từ ${REASON_MIN} tới ${REASON_MAX} ký tự.`);
            run(() => unfreezeTokenAction({ chain, roundId: overview.round?.id, confirmSymbol, reason: unfreezeReason.trim() }));
          } else if (stage === 'freeze') {
            if (overview.round) run(() => freezeTokenAction({ chain, roundId: overview.round?.id, confirmSymbol }));
          } else {
            runRecall();
          }
        }}
      >
        <label className="grid gap-1 text-sm">Gõ {symbol} để xác nhận
          <input className={RECALL_FIELD} autoComplete="off" value={confirmSymbol} onChange={(event) => setConfirmSymbol(event.target.value)} />
        </label>
        {stage === 'unfreeze' && <label className="grid gap-1 text-sm">Lý do mở đóng băng
          <textarea className={RECALL_FIELD} maxLength={REASON_MAX} value={unfreezeReason} onChange={(event) => setUnfreezeReason(event.target.value)} />
        </label>}
      </RecallDialog>
    </div>
  );
}
