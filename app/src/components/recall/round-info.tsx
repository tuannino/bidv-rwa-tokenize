import { Badge } from '@/components/ui/badge';
import type { RecallBatchProgress, RecallOverview } from '@/lib/bank/recall.service';
import { formatAmount, formatDateTime, formatVnDate } from '@/lib/format';
import { chainLockMessage } from './gates';

const PHASE_LABEL: Record<string, string> = {
  NONE: 'Chưa mở',
  SCHEDULED: 'Đã lập lịch',
  NOTICE: 'Đang báo trước',
  FROZEN: 'Đang thu hồi',
  CLOSED: 'Đã hoàn tất',
};

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

export function RoundInfo({ overview, progress }: { overview: RecallOverview; progress: RecallBatchProgress | null }) {
  const round = overview.round;
  const lockMessage = chainLockMessage(overview.chainLock);
  const completed = round?.phase === 'CLOSED';
  const chainStatus = overview.settlementMode === true
    ? completed ? 'Đã đóng băng sau thu hồi' : 'Đang đóng băng'
    : overview.settlementMode === false ? 'Đang mở' : 'Không đọc được';
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">Đợt: {round ? PHASE_LABEL[round.phase] ?? round.phase : 'Chưa có đợt'}</Badge>
        {overview.demoMode && <Badge variant="outline">Chế độ PoC</Badge>}
        {round?.status === 'CANCELLED' && <Badge variant="destructive">Đã huỷ</Badge>}
        <Badge variant={overview.settlementMode === true && !completed ? 'destructive' : 'outline'}>
          Token trên chuỗi: {chainStatus}
        </Badge>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Item label="Dự án" value={overview.project ? `${overview.project.name} (${overview.project.tokenSymbol})` : 'Chưa có'} />
        <Item label="Ngày hết hạn" value={round?.maturityDate ? formatVnDate(round.maturityDate) : '-'} />
        <Item label="Bắt đầu thu hồi" value={round?.recallFrom ? formatVnDate(round.recallFrom) : '-'} />
        <Item label="Báo trước" value={round?.noticeDays !== null && round?.noticeDays !== undefined ? `${round.noticeDays} ngày` : '-'} />
        <Item label="Tới ngày hết hạn" value={!round ? '-' : round.daysToMaturity === 0 ? 'Hôm nay' : round.daysToMaturity < 0 ? `Đã qua ${Math.abs(round.daysToMaturity)} ngày` : `Còn ${round.daysToMaturity} ngày`} />
        <Item label="Tới ngày thu hồi" value={!round ? '-' : round.daysToRecall === 0 ? 'Hôm nay' : round.daysToRecall < 0 ? `Đã qua ${Math.abs(round.daysToRecall)} ngày` : `Còn ${round.daysToRecall} ngày`} />
        <Item label="WPT ngoài vault" value={formatAmount(overview.supplyOutsideVault)} />
        <Item label="Lệnh đang xử lý" value={String(overview.inFlightOrders.PLACED + overview.inFlightOrders.CHECKING + overview.inFlightOrders.EXECUTING)} />
        <Item label="Kỳ chia đang mở" value={overview.activeDistribution ? 'Có' : 'Không'} />
        <Item label="Mở đợt lúc" value={round ? formatDateTime(round.initiatedAt) : '-'} />
      </dl>
      {round?.status === 'CANCELLED' && <p className="text-sm font-medium">Đợt gần nhất đã huỷ: hết hạn {round.maturityDate ? formatVnDate(round.maturityDate) : '-'}, bắt đầu thu hồi {round.recallFrom ? formatVnDate(round.recallFrom) : '-'}.</p>}
      {overview.project?.status === 'CLOSED' && round?.completedAt && <p className="text-sm font-medium">Dự án đã đóng lúc {formatDateTime(round.completedAt)}.</p>}
      {round?.reason && <p className="text-sm"><span className="text-muted-foreground">Lý do: </span>{round.reason}</p>}
      {lockMessage && <p role="status" className="rounded-md border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">{lockMessage}</p>}
      {overview.preview?.truncated && <p role="alert" className="text-sm text-destructive">Danh sách ví đang bị cắt; không thể đóng băng an toàn.</p>}
      {overview.freezeBlockers.length > 0 && (
        <div className="rounded-md border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">Chưa thể đóng băng:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">{overview.freezeBlockers.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      )}
      {progress && (
        <div role="status" aria-live="polite" className="rounded-md border bg-muted/40 p-3 text-sm">
          Đã đốt {progress.burned}; đang chờ {progress.pending}; lỗi {progress.failed}; còn lại {progress.remaining}. WPT ngoài vault: {formatAmount(progress.outsideRemaining)}.
          {progress.completed && ' Đợt thu hồi đã hoàn tất.'}
          {progress.errors.length > 0 && <ul className="mt-2 list-disc pl-5">{progress.errors.map((item) => <li key={item.wallet}>{item.wallet}: {item.reason}</li>)}</ul>}
        </div>
      )}
    </div>
  );
}
