import { describe, expect, it } from 'vitest';
import type { RecallOverview } from '@/lib/bank/recall.service';
import type { SettlementRoundStatus } from '@/lib/store/settlement.store.port';
import {
  CASE_STATUS_LABELS,
  chainLockMessage,
  currentStep,
  recallControls,
  recallNoticeText,
  symbolMatches,
  tradeBlockText,
  tradingStatusLabel,
} from '@/components/recall/gates';
import { confirmBlockReason, type TradePreviewState } from '@/components/trading/gates';
import { formatVnDate } from '@/lib/format';
import { operationLabel } from '@/lib/txn-labels';

const round = (status: SettlementRoundStatus = 'INITIATED') => ({
  id: '00000000-0000-4000-8000-000000000001',
  snapshotId: 0,
  navRate: '0',
  status,
  chain: 'mock' as const,
  initiatedAt: '2026-10-25T00:00:00.000Z',
  completedAt: status === 'COMPLETED' ? '2026-10-25T01:00:00.000Z' : null,
  projectId: 'project-1',
  maturityDate: '2026-10-25',
  recallFrom: '2026-10-25',
  noticeDays: 0,
  openedBy: 'KSV001',
  reason: 'Dự án đã đến hạn',
  freezeRequestedAt: null,
  freezeTxHash: null,
  frozenAt: status === 'IN_PROGRESS' ? '2026-10-25T00:10:00.000Z' : null,
  cancelledAt: status === 'CANCELLED' ? '2026-10-25T00:05:00.000Z' : null,
  unfreezeRequestedAt: null,
  unfreezeTxHash: null,
  activeChain: status === 'COMPLETED' || status === 'CANCELLED' ? null : 'mock' as const,
  phase: status === 'IN_PROGRESS' ? 'FROZEN' as const : status === 'COMPLETED' ? 'CLOSED' as const : 'NOTICE' as const,
  daysToMaturity: 0,
  daysToRecall: 0,
});

function overview(overrides: Partial<RecallOverview> = {}): RecallOverview {
  return {
    chain: 'mock',
    project: { id: 'project-1', tokenSymbol: 'WPT', name: 'Điện gió', status: 'ISSUED' },
    round: round(),
    settlementMode: false,
    inFlightOrders: { PLACED: 0, CHECKING: 0, EXECUTING: 0 },
    activeDistribution: false,
    chainLock: null,
    cases: [],
    preview: { wallets: [], truncated: false },
    supplyOutsideVault: '0',
    canManage: true,
    canUnfreeze: false,
    canFreeze: true,
    demoMode: false,
    today: '2026-10-25',
    minNoticeDays: 0,
    freezeBlockers: [],
    ...overrides,
  };
}

describe('FE-10 gates màn Thu hồi token', () => {
  it('[ca 1] currentStep chỉ hiện cho đợt đang hoạt động và ánh xạ đúng bốn pha', () => {
    expect(currentStep(overview({ round: null }))).toBeNull();
    expect(currentStep(overview({ round: { ...round(), phase: 'SCHEDULED' } }))).toBe(1);
    expect(currentStep(overview())).toBe(2);
    expect(currentStep(overview({ round: round('IN_PROGRESS') }))).toBe(3);
    expect(currentStep(overview({ round: round('COMPLETED') }))).toBe(4);
    expect(currentStep(overview({ round: round('CANCELLED') }))).toBeNull();
  });

  it('[ca 2] chỉ Kiểm soát viên có nút ghi; mở đợt chỉ khi dự án ISSUED', () => {
    const readOnly = recallControls(overview({ canManage: false }));
    expect(readOnly).toEqual(expect.objectContaining({ open: false, reschedule: false, cancel: false, freeze: 'hidden', unfreeze: 'hidden' }));
    expect(readOnly.recall.mode).toBe('hidden');
    expect(recallControls(overview({ round: null })).open).toBe(true);
    expect(recallControls(overview({ round: round('CANCELLED') })).open).toBe(true);
    const draft = recallControls(overview({ round: null, project: { id: 'p', tokenSymbol: 'WPT', name: 'Wind', status: 'DRAFT' } }));
    expect(draft.open).toBe(false);
    expect(draft.openBlockedReason).toMatch(/chưa phát hành/);
    const closed = recallControls(overview({ round: null, project: { id: 'p', tokenSymbol: 'WPT', name: 'Wind', status: 'CLOSED' } }));
    expect(closed.open).toBe(false);
    expect(closed.openBlockedReason).toMatch(/đã đóng/);
  });

  it('[ca 3, 4] dấu giao dịch chuyển nút sang kiểm tra lại; đã burn thì khoá mở đóng băng', () => {
    expect(recallControls(overview({ round: { ...round(), freezeRequestedAt: '2026-10-25T00:00:00Z' } })).freeze).toBe('recheck');
    const unfreezing = overview({ round: { ...round('IN_PROGRESS'), unfreezeRequestedAt: '2026-10-25T00:00:00Z' }, settlementMode: true, canUnfreeze: true });
    expect(recallControls(unfreezing).unfreeze).toBe('recheck');
    expect(recallControls(unfreezing).recall.mode).toBe('blocked');
    const burned = recallControls(overview({ round: round('IN_PROGRESS'), settlementMode: true, canUnfreeze: false }));
    expect(burned.unfreeze).toBe('locked-after-burn');
    expect(burned.recall).toEqual({ mode: 'next', askConfirm: false, blockedReason: null });
  });

  it('[ca 5] symbolMatches bỏ khoảng trắng nhưng phân biệt hoa thường', () => {
    expect(symbolMatches('WPT', 'WPT')).toBe(true);
    expect(symbolMatches(' wpt ', 'WPT')).toBe(false);
    expect(symbolMatches(' WPT ', 'WPT')).toBe(true);
  });

  it('[ca 6] lượt đầu hỏi xác nhận; settlementMode hoặc khoá chain chặn thu hồi', () => {
    expect(recallControls(overview({ round: round('IN_PROGRESS'), settlementMode: true, canUnfreeze: true })).recall)
      .toEqual({ mode: 'first', askConfirm: true, blockedReason: null });
    expect(recallControls(overview({ round: round('IN_PROGRESS'), settlementMode: false, canUnfreeze: true })).recall.mode).toBe('blocked');
    expect(recallControls(overview({
      round: round('IN_PROGRESS'), settlementMode: true, canUnfreeze: true,
      chainLock: { kind: 'WITHDRAW', acquiredAt: '2026-10-25T00:00:00Z', stale: false },
    })).recall.blockedReason).toMatch(/Vault/);
    expect(chainLockMessage({ kind: 'RECALL', acquiredAt: '', stale: true })).toBeNull();
  });

  it('[ca 7] nhãn giao dịch đủ mã nghiệp vụ và fallback vault', () => {
    expect([
      'purchase', 'sale', 'mint', 'mintInitialSupply', 'payment-mint', 'burn', 'recall', 'freeze',
      'unfreeze', 'whitelist', 'distribute', 'distribution-open', 'vault-close-period', 'vault:withdraw',
    ].map(operationLabel)).toEqual([
      'Mua', 'Bán', 'Phát hành', 'Phát hành nguồn cung ban đầu', 'Cấp VNDB thử', 'Huỷ token',
      'Thu hồi', 'Đóng băng toàn hệ thống', 'Mở đóng băng', 'Định danh ví', 'Nhận chia lợi nhuận',
      'Mở kỳ chia', 'Chốt kỳ vault', 'Rút VNDB từ vault',
    ]);
    expect(operationLabel('vault:setPercentRate')).toBe('Cấu hình vault');
    expect(operationLabel('ma-la')).toBe('ma-la');
  });

  it('[ca 8] nhãn giao dịch phân biệt mọi pha và hai trang', () => {
    expect(tradingStatusLabel('NONE', true, 'trade')).toBe('Đang mở');
    expect(tradingStatusLabel('NONE', true, 'seller')).toBe('Đang mở bán');
    expect(tradingStatusLabel('NOTICE', false, 'trade')).toMatch(/đến hạn/);
    expect(tradingStatusLabel('FROZEN', false, 'seller')).toMatch(/đóng băng/);
    expect(tradingStatusLabel('CLOSED', false, 'seller')).toBe('Đã đóng');
    expect(tradingStatusLabel('SCHEDULED', false, 'trade')).toMatch(/đang đóng băng/);
  });

  it('[ca 12] nội dung thông báo đúng ba pha và số ngày dương, bằng 0, âm', () => {
    const notice = { maturityDate: '2026-10-25', recallFrom: '2026-10-26', daysLeft: 1, phase: 'NOTICE' as const, amount: '1000' };
    expect(recallNoticeText(notice).body).toContain('25/10/2026');
    expect(recallNoticeText(notice).body).toContain('còn 1 ngày');
    expect(recallNoticeText({ ...notice, daysLeft: 0 }).body).toContain('Từ hôm nay');
    expect(recallNoticeText({ ...notice, daysLeft: -1 }).body).not.toContain('còn -1');
    expect(recallNoticeText({ ...notice, phase: 'FROZEN' }).body).toContain('đóng băng');
    expect(recallNoticeText({ ...notice, phase: 'CLOSED' }).body).toContain('Đã thu hồi 1.000 WPT');
    expect(formatVnDate('sai')).toBe('sai');
  });

  it('[ca 13] confirmBlockReason ưu tiên chốt tradeBlocked', () => {
    const caps = { BUY: { max: '10', reason: 'mua' }, SELL: { max: '10', reason: 'bán' } };
    const preview: TradePreviewState = { kind: 'checked', side: 'BUY', wptAmount: '1', vndAmount: '1', conditions: [], canConfirm: true };
    expect(confirmBlockReason('1', 'BUY', caps, preview, true)).toMatch(/tạm dừng/);
    expect(confirmBlockReason('1', 'BUY', caps, preview)).toBeNull();
    expect(tradeBlockText({ phase: 'NOTICE', settlementMode: false, maturityDate: '2026-10-25', recallFrom: '2026-10-25' })).toContain('25/10/2026');
  });

  it('bảng trạng thái hồ sơ có đủ nhãn thu hồi', () => {
    expect(CASE_STATUS_LABELS).toMatchObject({ NOTIFIED: 'Chờ đốt', BURNING: 'Đang gửi', BURNED: 'Đã đốt', FAILED: 'Lỗi' });
  });
});
