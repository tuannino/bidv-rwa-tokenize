import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import type { RecallBatchProgress, RecallOverview } from '@/lib/bank/recall.service';
import { formatAmount, formatDateTime, formatVnDate } from '@/lib/format';
import { phaseTone } from './case-tone';
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
    <div className="min-w-0 space-y-0.5 rounded-[14px] bg-muted/60 px-3.5 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
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
        <Badge variant={round ? phaseTone(round.phase) : 'info'}>Đợt: {round ? PHASE_LABEL[round.phase] ?? round.phase : 'Chưa có đợt'}</Badge>
        {overview.demoMode && <Badge variant="outline">Chế độ PoC</Badge>}
        {round?.status === 'CANCELLED' && <Badge variant="bad">Đã huỷ</Badge>}
        <Badge variant={overview.settlementMode === true && !completed ? 'warn' : 'outline'}>
          Token trên chuỗi: {chainStatus}
        </Badge>
      </div>
      {/* Mốc 640 px viết bằng px để Tailwind xếp đúng thứ tự với mốc 1100 px (cùng đơn vị). */}
      <dl className="grid gap-3 min-[640px]:grid-cols-2 min-[1100px]:grid-cols-4">
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
      {lockMessage && <Alert tone="warn" role="status">{lockMessage}</Alert>}
      {overview.preview?.truncated && <Alert tone="bad" role="alert">Danh sách ví đang bị cắt; không thể đóng băng an toàn.</Alert>}
      {overview.freezeBlockers.length > 0 && (
        <Alert tone="warn">
          <p className="font-medium">Chưa thể đóng băng:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">{overview.freezeBlockers.map((item) => <li key={item}>{item}</li>)}</ul>
        </Alert>
      )}
      {progress && (
        <Alert tone="info" role="status" aria-live="polite">
          Đã đốt {progress.burned}; đang chờ {progress.pending}; lỗi {progress.failed}; còn lại {progress.remaining}. WPT ngoài vault: {formatAmount(progress.outsideRemaining)}.
          {progress.completed && ' Đợt thu hồi đã hoàn tất.'}
          {progress.errors.length > 0 && <ul className="mt-2 list-disc pl-5">{progress.errors.map((item) => <li key={item.wallet}>{item.wallet}: {item.reason}</li>)}</ul>}
        </Alert>
      )}
    </div>
  );
}
