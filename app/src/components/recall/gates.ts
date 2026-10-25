import type { TradeContextView } from '@/lib/bank/trade.service';
import type { PortfolioView } from '@/lib/bank/portfolio.service';
import type { RecallOverview } from '@/lib/bank/recall.service';
import type { RecallPhaseKind } from '@/lib/bank/recall-phase';
import { formatAmount, formatVnDate } from '@/lib/format';

export function currentStep(overview: RecallOverview): 1 | 2 | 3 | 4 | null {
  if (!overview.round || overview.round.status === 'CANCELLED') return null;
  const steps: Partial<Record<RecallPhaseKind, 1 | 2 | 3 | 4>> = {
    SCHEDULED: 1,
    NOTICE: 2,
    FROZEN: 3,
    CLOSED: 4,
  };
  return steps[overview.round.phase] ?? null;
}

export type RecallControls = {
  open: boolean;
  openBlockedReason: string | null;
  reschedule: boolean;
  cancel: boolean;
  freeze: 'send' | 'recheck' | 'blocked' | 'hidden';
  unfreeze: 'send' | 'recheck' | 'locked-after-burn' | 'hidden';
  recall: {
    mode: 'hidden' | 'blocked' | 'first' | 'next';
    askConfirm: boolean;
    blockedReason: string | null;
  };
};

const hiddenControls = (): RecallControls => ({
  open: false,
  openBlockedReason: null,
  reschedule: false,
  cancel: false,
  freeze: 'hidden',
  unfreeze: 'hidden',
  recall: { mode: 'hidden', askConfirm: false, blockedReason: null },
});

export function chainLockMessage(lock: RecallOverview['chainLock']): string | null {
  if (!lock || lock.stale) return null;
  if (lock.kind === 'WITHDRAW') return 'Có lệnh rút vault đang xử lý; Kiểm soát viên xử lý ở màn Vault trước.';
  if (lock.kind === 'CONFIG') return 'Đang lưu cấu hình vault.';
  if (lock.kind === 'RECALL') return 'Đang có thao tác thu hồi khác.';
  return 'Đang có thao tác khác trên chain.';
}

export function recallControls(overview: RecallOverview): RecallControls {
  if (!overview.canManage) return hiddenControls();

  const round = overview.round;
  const open = overview.project?.status === 'ISSUED' && (!round || round.status === 'CANCELLED');
  const openBlockedReason = overview.project?.status === 'CLOSED'
    ? 'Dự án đã đóng.'
    : overview.project?.status !== 'ISSUED'
      ? 'Dự án chưa phát hành nên chưa mở được đợt thu hồi.'
      : null;
  const editable = round?.status === 'INITIATED' && !round.freezeRequestedAt;
  const freeze: RecallControls['freeze'] = round?.status !== 'INITIATED'
    ? 'hidden'
    : round.freezeRequestedAt
      ? 'recheck'
      : overview.canFreeze
        ? 'send'
        : 'blocked';
  const unfreeze: RecallControls['unfreeze'] = round?.status !== 'IN_PROGRESS'
    ? 'hidden'
    : !overview.canUnfreeze
      ? 'locked-after-burn'
      : round.unfreezeRequestedAt
        ? 'recheck'
        : 'send';

  let recall: RecallControls['recall'] = { mode: 'hidden', askConfirm: false, blockedReason: null };
  if (round?.status === 'IN_PROGRESS') {
    const lockReason = chainLockMessage(overview.chainLock);
    const blockedReason = round.unfreezeRequestedAt
      ? 'Đang mở đóng băng; không thể đồng thời gửi lệnh thu hồi.'
      : overview.settlementMode !== true
        ? 'Token chưa ở trạng thái đóng băng trên chuỗi.'
        : lockReason;
    recall = blockedReason
      ? { mode: 'blocked', askConfirm: false, blockedReason }
      : overview.canUnfreeze
        ? { mode: 'first', askConfirm: true, blockedReason: null }
        : { mode: 'next', askConfirm: false, blockedReason: null };
  }

  return {
    open,
    openBlockedReason,
    reschedule: editable,
    cancel: editable && overview.settlementMode !== true,
    freeze,
    unfreeze,
    recall,
  };
}

export function symbolMatches(typed: string, symbol: string): boolean {
  return typed.trim() === symbol;
}

export const CASE_STATUS_LABELS: Record<string, string> = {
  NOTIFIED: 'Chờ đốt',
  BURNING: 'Đang gửi',
  BURNED: 'Đã đốt',
  FAILED: 'Lỗi',
};

export function tradingStatusLabel(
  phase: RecallPhaseKind,
  tradingOpen: boolean,
  page: 'trade' | 'seller',
): string {
  if (tradingOpen) return page === 'trade' ? 'Đang mở' : 'Đang mở bán';
  if (phase === 'NOTICE') return 'Tạm dừng (đến hạn dự án)';
  if (phase === 'FROZEN') return 'Tạm dừng (đã đóng băng)';
  if (phase === 'CLOSED') return 'Đã đóng';
  return 'Tạm dừng (đang đóng băng)';
}

export function recallNoticeText(
  recall: NonNullable<PortfolioView['recall']>,
): { title: string; body: string } {
  const amount = formatAmount(recall.amount);
  if (recall.phase === 'FROZEN') {
    return {
      title: 'Thu hồi token',
      body: `WPT đang bị đóng băng để thu hồi. Số WPT sẽ hoặc đã bị thu hồi: ${amount}.`,
    };
  }
  if (recall.phase === 'CLOSED') {
    return { title: 'Dự án đã đóng', body: `Dự án đã đóng. Đã thu hồi ${amount} WPT của ví này.` };
  }

  const timing = recall.daysLeft > 0
    ? `Từ ngày ${formatVnDate(recall.recallFrom)} ngân hàng sẽ thu hồi ${amount} WPT trong ví này (còn ${recall.daysLeft} ngày).`
    : recall.daysLeft === 0
      ? `Từ hôm nay ngân hàng sẽ thu hồi ${amount} WPT trong ví này.`
      : `Ngân hàng sẽ thu hồi ${amount} WPT trong ví này.`;
  return {
    title: 'Thông báo thu hồi token',
    body: `Dự án hết hạn ngày ${formatVnDate(recall.maturityDate)}. ${timing} Giao dịch mua bán đã tạm dừng. Thanh toán thực hiện ngoài hệ thống.`,
  };
}

export function tradeBlockText(block: NonNullable<TradeContextView['tradeBlock']>): string {
  if (block.phase === 'NOTICE') {
    return block.maturityDate
      ? `Dự án đã đến hạn ngày ${formatVnDate(block.maturityDate)}; giao dịch mua bán đã tạm dừng.`
      : 'Dự án đã đến hạn; giao dịch mua bán đã tạm dừng.';
  }
  if (block.phase === 'FROZEN') return 'WPT đang bị đóng băng để thu hồi; giao dịch mua bán đã tạm dừng.';
  if (block.phase === 'CLOSED') return 'Dự án đã đóng; giao dịch token không còn mở.';
  return block.settlementMode
    ? 'Token đang bị đóng băng trên chuỗi; giao dịch mua bán đã tạm dừng.'
    : 'Giao dịch mua bán đang tạm dừng.';
}
