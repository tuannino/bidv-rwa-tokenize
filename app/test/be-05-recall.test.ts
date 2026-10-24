import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOCK_VAULT_ADDRESS } from '@bidv/shared';
import { resetServerEnvCache } from '@/lib/config/env';
import type { ILedgerPort, TxResult } from '@/lib/ledger/ledger.port';
import { resetMockLedger, seedMockLedger } from '@/lib/ledger/mock.adapter';
import { closeProjectInMemory } from '@/lib/store/memory.project.store';
import {
  getDistributionStore,
  getOrderStore,
  getProjectStore,
  getSettlementStore,
  getStore,
  getVaultStore,
  resetMemoryStore,
  resetStoreCache,
} from '@/lib/store';
import { addDays, recallPhaseOf, todayVn, tradingBlocked } from '@/lib/bank/recall-phase';

const fault = vi.hoisted(() => ({
  receiptThrows: false,
  receipts: {} as Record<string, 'PENDING' | 'FAILED'>,
  freezeSubmit: null as null | 'PENDING' | 'FAILED' | 'throw',
  unfreezeSubmit: null as null | 'PENDING' | 'FAILED' | 'throw',
  freezeSends: 0,
  unfreezeSends: 0,
  burnSends: 0,
  burnModes: {} as Record<string, 'FAILED' | 'revert' | 'network'>,
  truncated: false,
  hiddenWallets: [] as string[],
  waitCalls: 0,
  waitGate: null as Promise<void> | null,
}));

vi.mock('@/lib/ledger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ledger')>();
  return {
    ...actual,
    getLedger: (...args: Parameters<typeof actual.getLedger>): ILedgerPort => {
      const real = actual.getLedger(...args);
      return {
        ...real,
        async setSettlementMode(enabled: boolean) {
          if (enabled) fault.freezeSends += 1;
          else fault.unfreezeSends += 1;
          const mode = enabled ? fault.freezeSubmit : fault.unfreezeSubmit;
          if (mode === 'throw') throw new Error(`RPC mất phản hồi khi ${enabled ? 'đóng' : 'mở'} đóng băng.`);
          if (mode) {
            const nonce = enabled ? 10_000 + fault.freezeSends : 20_000 + fault.unfreezeSends;
            const txHash = `0x${nonce.toString(16).padStart(64, '0')}`;
            fault.receipts[txHash] = mode;
            return { txHash, status: 'PENDING' as const };
          }
          return real.setSettlementMode(enabled);
        },
        async burn(wallet: string, amount: bigint) {
          fault.burnSends += 1;
          const mode = fault.burnModes[wallet.toLowerCase()];
          if (mode === 'network') throw new Error(`RPC mất phản hồi khi gửi burn cho ${wallet}.`);
          if (mode === 'revert') {
            throw new actual.LedgerError(real.chain, 'burn', `Burn bị revert cho ${wallet}.`, { reverted: true });
          }
          if (mode === 'FAILED') {
            const txHash = `0x${(30_000 + fault.burnSends).toString(16).padStart(64, '0')}`;
            fault.receipts[txHash] = 'FAILED';
            return { txHash, status: 'PENDING' as const };
          }
          return real.burn(wallet, amount);
        },
        async listTokenWallets() {
          const listed = await real.listTokenWallets();
          const hidden = new Set(fault.hiddenWallets.map((wallet) => wallet.toLowerCase()));
          return {
            ...listed,
            wallets: listed.wallets.filter((entry) => !hidden.has(entry.wallet.toLowerCase())),
            truncated: fault.truncated || listed.truncated,
          };
        },
        async waitReceipt(txHash: string, timeoutMs?: number): Promise<TxResult> {
          fault.waitCalls += 1;
          if (fault.waitGate) await fault.waitGate;
          if (fault.receiptThrows) throw new Error('tiến trình chết khi chờ receipt');
          const forced = fault.receipts[txHash];
          if (forced === 'PENDING') return { txHash, status: 'PENDING' };
          if (forced === 'FAILED') return { txHash, status: 'FAILED', reason: 'Giao dịch bị revert on-chain.' };
          return real.waitReceipt(txHash, timeoutMs);
        },
      };
    },
  };
});

const CHAIN = 'mock' as const;
const INVESTOR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

function actAs(role: string, actor: string) {
  process.env.DEMO_ROLE = role;
  process.env.DEMO_ACTOR = actor;
  resetServerEnvCache();
}

async function ledger() {
  return (await import('@/lib/ledger')).getLedger(CHAIN);
}

async function issueAndDistribute(amount = 10n) {
  await issueOnly();
  const chain = await ledger();
  await chain.whitelist(INVESTOR);
  await chain.transfer(MOCK_VAULT_ADDRESS, INVESTOR, amount);
  actAs('CONTROLLER', 'KSV001');
}

async function issueOnly() {
  process.env.ENABLE_DEMO_TOKEN_MINT = 'true';
  actAs('TELLER', 'GDV001');
  const { issueInitialSupply } = await import('@/lib/bank/issuance.service');
  const issued = await issueInitialSupply({ chain: CHAIN, spvWallet: MOCK_VAULT_ADDRESS, amount: '100' });
  expect(issued.ok, issued.ok ? '' : issued.error).toBe(true);
  delete process.env.ENABLE_DEMO_TOKEN_MINT;
  resetServerEnvCache();
  actAs('CONTROLLER', 'KSV001');
}

const testWallet = (index: number) => `0x${index.toString(16).padStart(40, '0')}`;

async function openToday(noticeDays = 0) {
  actAs('CONTROLLER', 'KSV001');
  const { openRecall } = await import('@/lib/bank/recall.service');
  return openRecall({ chain: CHAIN, maturityDate: todayVn(), noticeDays, reason: 'Dự án đã tới ngày đáo hạn' });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-24T03:00:00.000Z'));
  resetMockLedger();
  resetMemoryStore();
  resetStoreCache();
  process.env.USE_MOCK_DB = 'true';
  process.env.ENABLE_DEMO_RECALL = 'false';
  fault.receiptThrows = false;
  fault.receipts = {};
  fault.freezeSubmit = null;
  fault.unfreezeSubmit = null;
  fault.freezeSends = 0;
  fault.unfreezeSends = 0;
  fault.burnSends = 0;
  fault.burnModes = {};
  fault.truncated = false;
  fault.hiddenWallets = [];
  fault.waitCalls = 0;
  fault.waitGate = null;
  actAs('CONTROLLER', 'KSV001');
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const key of ['USE_MOCK_DB', 'ENABLE_DEMO_RECALL', 'ENABLE_DEMO_TOKEN_MINT', 'DEMO_ROLE', 'DEMO_ACTOR']) delete process.env[key];
  resetServerEnvCache();
  resetStoreCache();
});

describe('BE-05 — pha và mốc ngày Việt Nam', () => {
  it('đổi ngày đúng tại 17:00Z và cộng ngày không lệch múi giờ', () => {
    expect(todayVn(new Date('2026-10-23T16:59:59Z'))).toBe('2026-10-23');
    expect(todayVn(new Date('2026-10-23T17:00:00Z'))).toBe('2026-10-24');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('NOTICE, FROZEN và CLOSED đều chặn giao dịch với cùng một phép quyết định', () => {
    const base = { id: 'r', snapshotId: 0, navRate: '0', chain: CHAIN, initiatedAt: '', completedAt: null,
      projectId: 'p', maturityDate: '2026-10-24', recallFrom: '2026-10-25', noticeDays: 1, openedBy: 'KSV001', reason: 'reason',
      freezeRequestedAt: null, freezeTxHash: null, frozenAt: null, cancelledAt: null, unfreezeRequestedAt: null, unfreezeTxHash: null, activeChain: CHAIN } as const;
    const project = { id: 'p', tokenSymbol: 'WPT', name: 'Wind', totalSupply: '100', status: 'ISSUED', chain: CHAIN, contractAddress: null, issuedAt: '', createdAt: '', updatedAt: '' } as const;
    const notice = recallPhaseOf({ ...base, status: 'INITIATED' }, project, '2026-10-24');
    expect(notice.kind).toBe('NOTICE');
    expect(tradingBlocked(notice, false).blocked).toBe(true);
    expect(recallPhaseOf({ ...base, status: 'IN_PROGRESS' }, project, '2026-10-23').kind).toBe('FROZEN');
    expect(recallPhaseOf(null, { ...project, status: 'CLOSED' }, '2026-10-23').kind).toBe('CLOSED');
  });
});

describe('BE-05 — mở, sửa, huỷ và quyền', () => {
  it('Giao dịch viên bị chặn và có audit DENIED', async () => {
    await issueAndDistribute();
    actAs('TELLER', 'GDV001');
    const { openRecall } = await import('@/lib/bank/recall.service');
    const result = await openRecall({ chain: CHAIN, maturityDate: todayVn(), noticeDays: 0, reason: 'Dự án đã tới ngày đáo hạn' });
    expect(result).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect((await getStore().listAudit({ limit: 20 })).some((row) => row.action === 'settlement:initiate' && row.outcome === 'DENIED')).toBe(true);
  });

  it('từ chối ngày quá khứ, ngày không có thật và hai lần mở cùng chain', async () => {
    await issueAndDistribute();
    const { openRecall } = await import('@/lib/bank/recall.service');
    expect(await openRecall({ chain: CHAIN, maturityDate: '2026-10-23', noticeDays: 0, reason: 'Ngày đã qua mất rồi' })).toMatchObject({ ok: false, code: 'VALIDATION' });
    expect(await openRecall({ chain: CHAIN, maturityDate: '2026-02-30', noticeDays: 0, reason: 'Ngày không tồn tại' })).toMatchObject({ ok: false, code: 'VALIDATION' });
    const first = await openToday();
    expect(first.ok).toBe(true);
    expect(await openToday()).toMatchObject({ ok: false, code: 'REQUEST_STATE' });
  });

  it('sửa mốc tính lại recallFrom rồi huỷ, giải phóng activeChain', async () => {
    await issueAndDistribute();
    const opened = await openToday();
    expect(opened.ok).toBe(true); if (!opened.ok) return;
    const { rescheduleRecall, cancelRecall } = await import('@/lib/bank/recall.service');
    const moved = await rescheduleRecall({ chain: CHAIN, roundId: opened.data.id, maturityDate: '2026-10-25', noticeDays: 2, reason: 'Gia hạn theo quyết định mới' });
    expect(moved.ok && moved.data.recallFrom).toBe('2026-10-27');
    const cancelled = await cancelRecall({ chain: CHAIN, roundId: opened.data.id, reason: 'Huỷ theo quyết định mới' });
    expect(cancelled.ok && cancelled.data.status).toBe('CANCELLED');
    expect(await getSettlementStore().findActiveRound(CHAIN)).toBeNull();
  });

  it('[ca 2] mở đợt ghi audit SUCCESS đủ mốc, số ngày và lý do', async () => {
    await issueOnly();
    const opened = await openToday(0);
    expect(opened.ok).toBe(true);
    const success = (await getStore().listAudit({ limit: 20 })).find(
      (row) => row.action === 'settlement:initiate' && row.outcome === 'SUCCESS',
    );
    expect(success?.target).toBe(opened.ok ? opened.data.id : null);
    expect(success?.detail).toContain(todayVn());
    expect(success?.detail).toContain('0 ngày');
    expect(success?.detail).toContain('Dự án đã tới ngày đáo hạn');
  });

  it('[ca 25] cờ demo chỉ nới noticeDays=0 trên EVM, không nới ngày quá khứ', async () => {
    const project = await getProjectStore().createProject({
      chain: 'evm', tokenSymbol: 'WPT', name: 'Wind EVM', totalSupply: '100', status: 'ISSUED',
    });
    expect(project.status).toBe('ISSUED');
    const { openRecall } = await import('@/lib/bank/recall.service');
    expect(await openRecall({ chain: 'evm', maturityDate: todayVn(), noticeDays: 0, reason: 'Đáo hạn trên EVM thường' }))
      .toMatchObject({ ok: false, code: 'VALIDATION' });
    process.env.ENABLE_DEMO_RECALL = 'true'; resetServerEnvCache();
    expect((await openRecall({ chain: 'evm', maturityDate: todayVn(), noticeDays: 0, reason: 'Trình diễn thu hồi EVM' })).ok).toBe(true);
    expect(await openRecall({ chain: 'evm', maturityDate: addDays(todayVn(), -1), noticeDays: 0, reason: 'Không được lùi ngày demo' }))
      .toMatchObject({ ok: false, code: 'VALIDATION' });
  });

  it('[ca 26] sửa mốc ghi audit cũ/mới; chặn ngày cũ, dấu đóng băng và Giao dịch viên', async () => {
    await issueOnly();
    const opened = await openToday(); expect(opened.ok).toBe(true); if (!opened.ok) return;
    const { rescheduleRecall } = await import('@/lib/bank/recall.service');
    const moved = await rescheduleRecall({
      chain: CHAIN, roundId: opened.data.id, maturityDate: '2026-10-26', noticeDays: 2,
      reason: 'Gia hạn lịch thu hồi theo quyết định',
    });
    expect(moved).toMatchObject({ ok: true, data: { maturityDate: '2026-10-26', recallFrom: '2026-10-28' } });
    expect((await getStore().listAudit({ limit: 20 })).some((row) =>
      row.outcome === 'SUCCESS' && row.detail?.includes('2026-10-24/0') && row.detail.includes('2026-10-26/2'),
    )).toBe(true);
    expect(await rescheduleRecall({
      chain: CHAIN, roundId: opened.data.id, maturityDate: '2026-10-23', noticeDays: 1,
      reason: 'Không được lùi về quá khứ',
    })).toMatchObject({ ok: false, code: 'VALIDATION' });
    actAs('TELLER', 'GDV001');
    expect(await rescheduleRecall({
      chain: CHAIN, roundId: opened.data.id, maturityDate: '2026-10-27', noticeDays: 1,
      reason: 'Giao dịch viên không được sửa',
    })).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    actAs('CONTROLLER', 'KSV001');
    await getSettlementStore().requestFreeze({ id: opened.data.id, at: new Date().toISOString() });
    expect(await rescheduleRecall({
      chain: CHAIN, roundId: opened.data.id, maturityDate: '2026-10-27', noticeDays: 1,
      reason: 'Không sửa sau khi đã đánh dấu',
    })).toMatchObject({ ok: false, code: 'REQUEST_STATE' });
  });
});

describe('BE-05 — chốt chặn giao dịch, Mint và chia lợi nhuận', () => {
  async function readyInvestor() {
    await issueAndDistribute(10n);
    seedMockLedger({
      paymentBalances: { [INVESTOR]: 1_000_000n },
      paymentAllowances: { [INVESTOR]: 1_000_000n },
    });
  }

  it('[ca 3] trước maturityDate vẫn đặt lệnh được và portfolio chưa có recall', async () => {
    await readyInvestor();
    const { openRecall } = await import('@/lib/bank/recall.service');
    expect((await openRecall({
      chain: CHAIN, maturityDate: addDays(todayVn(), 1), noticeDays: 1,
      reason: 'Thông báo trước cho nhà đầu tư',
    })).ok).toBe(true);
    actAs('INVESTOR', 'NDT001');
    const { placeOrder, previewPurchase } = await import('@/lib/bank/purchase.service');
    const previewInput = { chain: CHAIN, investorWallet: INVESTOR, side: 'BUY', wptAmount: '1' };
    const input = { ...previewInput, clientRequestId: crypto.randomUUID() };
    expect((await previewPurchase(previewInput)).ok).toBe(true);
    expect((await placeOrder(input)).ok).toBe(true);
    const { getPortfolio } = await import('@/lib/bank/portfolio.service');
    expect(await getPortfolio({ chain: CHAIN, wallet: INVESTOR })).toMatchObject({ ok: true, data: { recall: null } });
  });

  it('[ca 5] từ maturityDate chặn xem trước và đặt cả lệnh mua lẫn bán ở máy chủ', async () => {
    await readyInvestor();
    expect((await openToday(2)).ok).toBe(true);
    actAs('INVESTOR', 'NDT001');
    const { placeOrder, previewPurchase } = await import('@/lib/bank/purchase.service');
    for (const side of ['BUY', 'SELL'] as const) {
      const previewInput = { chain: CHAIN, investorWallet: INVESTOR, side, wptAmount: '1' };
      const input = { ...previewInput, clientRequestId: crypto.randomUUID() };
      expect(await previewPurchase(previewInput)).toMatchObject({ ok: false, code: 'REQUEST_STATE' });
      expect(await placeOrder(input)).toMatchObject({ ok: false, code: 'REQUEST_STATE' });
    }
  });

  it('[ca 6] dự án CLOSED không có đợt vẫn chặn đặt lệnh', async () => {
    await readyInvestor();
    const project = (await getProjectStore().listProjects({ chain: CHAIN }))[0];
    expect(closeProjectInMemory(project.id)).toBe(true);
    actAs('INVESTOR', 'NDT001');
    const { previewPurchase } = await import('@/lib/bank/purchase.service');
    expect(await previewPurchase({ chain: CHAIN, investorWallet: INVESTOR, side: 'BUY', wptAmount: '1' }))
      .toMatchObject({ ok: false, code: 'REQUEST_STATE' });
  });

  it('[ca 6] settlementMode bật dù không có đợt vẫn chặn đặt lệnh', async () => {
    await readyInvestor();
    await (await ledger()).setSettlementMode(true);
    actAs('INVESTOR', 'NDT001');
    const { previewPurchase } = await import('@/lib/bank/purchase.service');
    expect(await previewPurchase({ chain: CHAIN, investorWallet: INVESTOR, side: 'BUY', wptAmount: '1' }))
      .toMatchObject({ ok: false, code: 'REQUEST_STATE' });
  });

  it('[ca 20] pha FROZEN chặn cả mở kỳ và duyệt chia lợi nhuận', async () => {
    await issueAndDistribute();
    const opened = await openToday(); expect(opened.ok).toBe(true); if (!opened.ok) return;
    const { freezeToken } = await import('@/lib/bank/recall.service');
    expect((await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' })).ok).toBe(true);
    actAs('TELLER', 'GDV001');
    const { openPeriod } = await import('@/lib/bank/distribution.service');
    expect(await openPeriod({ chain: CHAIN, periodKey: 'mock:2026-BE05' })).toMatchObject({ ok: false, code: 'PERIOD_STATE' });
    actAs('CONTROLLER', 'KSV001');
    const { approveDistribution } = await import('@/lib/bank/distribution-approval.service');
    expect(await approveDistribution({ chain: CHAIN, expectedAmount: '1' })).toMatchObject({ ok: false, code: 'PERIOD_STATE' });
  });

  it('[ca 22] tổng quan không ghi audit; portfolio chỉ thêm đúng audit đọc sẵn có', async () => {
    await issueAndDistribute();
    expect((await openToday(2)).ok).toBe(true);
    const { getRecallOverview } = await import('@/lib/bank/recall.service');
    const beforeOverview = await getStore().listAudit({ limit: 100 });
    expect((await getRecallOverview({ chain: CHAIN })).ok).toBe(true);
    expect(await getStore().listAudit({ limit: 100 })).toHaveLength(beforeOverview.length);
    actAs('INVESTOR', 'NDT001');
    const { getPortfolio } = await import('@/lib/bank/portfolio.service');
    const beforePortfolio = await getStore().listAudit({ limit: 100 });
    expect((await getPortfolio({ chain: CHAIN, wallet: INVESTOR })).ok).toBe(true);
    const added = (await getStore().listAudit({ limit: 100 })).slice(0, 1);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ action: 'portfolio:read', outcome: 'ALLOWED' });
    expect((await getStore().listAudit({ limit: 100 })).length).toBe(beforePortfolio.length + 1);
  });
});

describe('BE-05 — đóng băng, phục hồi và thu hồi', () => {
  it('đóng băng loại ví SPV và ví số dư 0 khỏi hồ sơ', async () => {
    await issueAndDistribute();
    const opened = await openToday(); expect(opened.ok).toBe(true); if (!opened.ok) return;
    const { freezeToken } = await import('@/lib/bank/recall.service');
    const frozen = await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' });
    expect(frozen.ok && frozen.data.status).toBe('IN_PROGRESS');
    const cases = await getSettlementStore().listRoundCases({ roundId: opened.data.id });
    expect(cases.map((row) => row.holderWallet)).toEqual([INVESTOR.toLowerCase()]);
    expect(await (await ledger()).isSettlementMode()).toBe(true);
  });

  it('[ca 10] lưu freezeTxHash trước khi chờ; lần sau chốt mà không gửi lần hai', async () => {
    await issueAndDistribute();
    const opened = await openToday(); expect(opened.ok).toBe(true); if (!opened.ok) return;
    const { freezeToken } = await import('@/lib/bank/recall.service');
    fault.receiptThrows = true;
    expect(await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' })).toMatchObject({ ok: false, code: 'REQUEST_STATE' });
    const pending = await getSettlementStore().findActiveRound(CHAIN);
    expect(pending?.freezeTxHash).toMatch(/^0x/);
    fault.receiptThrows = false;
    const retried = await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' });
    expect(retried.ok).toBe(true);
    expect(fault.freezeSends).toBe(1);
  });

  it('mở đóng băng trước lần đốt đầu tiên xoá hồ sơ và cho huỷ', async () => {
    await issueAndDistribute();
    const opened = await openToday(); expect(opened.ok).toBe(true); if (!opened.ok) return;
    const { freezeToken, unfreezeToken, cancelRecall } = await import('@/lib/bank/recall.service');
    expect((await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' })).ok).toBe(true);
    const unfrozen = await unfreezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT', reason: 'Mở lại trước khi thu hồi' });
    expect(unfrozen.ok && unfrozen.data.status).toBe('INITIATED');
    expect(await getSettlementStore().listRoundCases({ roundId: opened.data.id })).toEqual([]);
    expect(await (await ledger()).isSettlementMode()).toBe(false);
    expect((await cancelRecall({ chain: CHAIN, roundId: opened.data.id, reason: 'Huỷ đợt sau khi mở lại' })).ok).toBe(true);
  });

  it('thu hồi hoàn tất, đóng dự án và mỗi ví chỉ gửi burn một lần qua lần phục hồi', async () => {
    await issueAndDistribute();
    const opened = await openToday(); expect(opened.ok).toBe(true); if (!opened.ok) return;
    const { freezeToken, recallBatch } = await import('@/lib/bank/recall.service');
    expect((await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' })).ok).toBe(true);
    fault.receiptThrows = true;
    const first = await recallBatch({ chain: CHAIN, roundId: opened.data.id });
    expect(first.ok && first.data.pending).toBe(1);
    expect((await getSettlementStore().listRoundCases({ roundId: opened.data.id }))[0].burnTxHash).toMatch(/^0x/);
    fault.receiptThrows = false;
    const second = await recallBatch({ chain: CHAIN, roundId: opened.data.id });
    expect(second).toMatchObject({ ok: true, data: { completed: true, outsideRemaining: '0' } });
    expect(fault.burnSends).toBe(1);
    expect((await getProjectStore().listProjects({ chain: CHAIN }))[0].status).toBe('CLOSED');
  });

  it('[ca 7] chặn đóng băng trước recallFrom và khi Giao dịch viên gọi', async () => {
    await issueAndDistribute();
    const opened = await openToday(1); expect(opened.ok).toBe(true); if (!opened.ok) return;
    const { freezeToken } = await import('@/lib/bank/recall.service');
    expect(await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' }))
      .toMatchObject({ ok: false, code: 'REQUEST_STATE' });
    actAs('TELLER', 'GDV001');
    expect(await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' }))
      .toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(fault.freezeSends).toBe(0);
  });

  it('[ca 7] chặn đóng băng khi còn lệnh đang xử lý', async () => {
    await issueAndDistribute();
    const opened = await openToday(); expect(opened.ok).toBe(true); if (!opened.ok) return;
    await getOrderStore().createOrder({
      chain: CHAIN, investorWallet: INVESTOR, wptAmount: '1', vndAmount: '1', actorRole: 'INVESTOR', status: 'PLACED',
    });
    const { freezeToken } = await import('@/lib/bank/recall.service');
    expect(await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' }))
      .toMatchObject({ ok: false, code: 'REQUEST_STATE' });
    expect(fault.freezeSends).toBe(0);
  });

  it('[ca 7] chặn đóng băng khi còn kỳ chia hoạt động hoặc danh sách ví bị cắt', async () => {
    await issueAndDistribute();
    const opened = await openToday(); expect(opened.ok).toBe(true); if (!opened.ok) return;
    const period = await getDistributionStore().openPeriod({
      periodKey: 'mock:active', snapshotId: 1, totalAmount: '1', totalSupplyAt: '100', chain: CHAIN,
    });
    const { freezeToken } = await import('@/lib/bank/recall.service');
    expect(await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' }))
      .toMatchObject({ ok: false, code: 'REQUEST_STATE' });
    await getDistributionStore().setPeriodStatus({ id: period.id, status: 'COMPLETED', completedAt: new Date().toISOString() });
    fault.truncated = true;
    expect(await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' }))
      .toMatchObject({ ok: false, code: 'REQUEST_STATE' });
    expect(fault.freezeSends).toBe(0);
  });

  it('[ca 9] không có Nhà đầu tư vẫn đóng băng và hoàn tất ngay ở lô đầu', async () => {
    await issueOnly();
    const opened = await openToday(); expect(opened.ok).toBe(true); if (!opened.ok) return;
    const { freezeToken, recallBatch } = await import('@/lib/bank/recall.service');
    expect((await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' })).ok).toBe(true);
    expect(await getSettlementStore().listRoundCases({ roundId: opened.data.id })).toEqual([]);
    expect(await recallBatch({ chain: CHAIN, roundId: opened.data.id })).toMatchObject({
      ok: true, data: { burned: 0, remaining: 0, outsideRemaining: '0', completed: true },
    });
  });

  it('[ca 11] receipt đóng băng FAILED xoá dấu và cho gửi lại', async () => {
    await issueAndDistribute();
    const opened = await openToday(); expect(opened.ok).toBe(true); if (!opened.ok) return;
    const { freezeToken } = await import('@/lib/bank/recall.service');
    fault.freezeSubmit = 'FAILED';
    expect(await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' }))
      .toMatchObject({ ok: false, code: 'LEDGER' });
    expect(await getSettlementStore().findActiveRound(CHAIN)).toMatchObject({ freezeRequestedAt: null, freezeTxHash: null });
    fault.freezeSubmit = null;
    expect((await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' })).ok).toBe(true);
    expect(fault.freezeSends).toBe(2);
  });

  it('[ca 11] giao dịch đóng băng treo quá 10 phút được gửi lại nhưng dấu vẫn giữ', async () => {
    await issueAndDistribute();
    const opened = await openToday(); expect(opened.ok).toBe(true); if (!opened.ok) return;
    const { freezeToken } = await import('@/lib/bank/recall.service');
    fault.freezeSubmit = 'PENDING';
    expect(await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' }))
      .toMatchObject({ ok: false, code: 'REQUEST_STATE' });
    vi.setSystemTime(new Date(Date.now() + 11 * 60_000));
    expect(await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' }))
      .toMatchObject({ ok: false, code: 'REQUEST_STATE' });
    expect(fault.freezeSends).toBe(2);
    expect((await getSettlementStore().findActiveRound(CHAIN))?.freezeRequestedAt).not.toBeNull();
  });

  it('[ca 11, 12] lỗi gửi không phải revert giữ dấu, chặn huỷ; dấu cũ không mã được gửi lại', async () => {
    await issueAndDistribute();
    const opened = await openToday(); expect(opened.ok).toBe(true); if (!opened.ok) return;
    const { cancelRecall, freezeToken } = await import('@/lib/bank/recall.service');
    fault.freezeSubmit = 'throw';
    expect(await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' }))
      .toMatchObject({ ok: false, code: 'UNKNOWN' });
    const settlement = getSettlementStore();
    expect((await settlement.findActiveRound(CHAIN))?.freezeRequestedAt).not.toBeNull();
    const cancelStore = vi.spyOn(settlement, 'cancelRound');
    expect(await cancelRecall({ chain: CHAIN, roundId: opened.data.id, reason: 'Không được huỷ lúc đang gửi' }))
      .toMatchObject({ ok: false, code: 'REQUEST_STATE' });
    expect(cancelStore).not.toHaveBeenCalled();
    vi.setSystemTime(new Date(Date.now() + 11 * 60_000));
    fault.freezeSubmit = null;
    expect((await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' })).ok).toBe(true);
    expect(fault.freezeSends).toBe(2);
  });

  it('[ca 12] huỷ sau maturityDate mở lại giao dịch', async () => {
    await issueAndDistribute();
    const opened = await openToday(2); expect(opened.ok).toBe(true); if (!opened.ok) return;
    actAs('INVESTOR', 'NDT001');
    const { previewPurchase } = await import('@/lib/bank/purchase.service');
    const input = { chain: CHAIN, investorWallet: INVESTOR, side: 'BUY', wptAmount: '1' };
    expect(await previewPurchase(input)).toMatchObject({ ok: false, code: 'REQUEST_STATE' });
    actAs('CONTROLLER', 'KSV001');
    const { cancelRecall } = await import('@/lib/bank/recall.service');
    expect((await cancelRecall({ chain: CHAIN, roundId: opened.data.id, reason: 'Huỷ để mở lại giao dịch' })).ok).toBe(true);
    actAs('INVESTOR', 'NDT001');
    expect((await previewPurchase(input)).ok).toBe(true);
  });

  it('[ca 13] 23 ví chạy đúng ba lô 10, 10, 3; mỗi ví một Txn recall', async () => {
    await issueOnly();
    const chain = await ledger();
    for (let index = 1; index <= 23; index += 1) {
      const wallet = testWallet(index + 100);
      await chain.whitelist(wallet); await chain.transfer(MOCK_VAULT_ADDRESS, wallet, 1n);
    }
    const opened = await openToday(); expect(opened.ok).toBe(true); if (!opened.ok) return;
    const { freezeToken, recallBatch } = await import('@/lib/bank/recall.service');
    expect((await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' })).ok).toBe(true);
    expect(await recallBatch({ chain: CHAIN, roundId: opened.data.id })).toMatchObject({ ok: true, data: { burned: 10, remaining: 13, completed: false } });
    expect(await recallBatch({ chain: CHAIN, roundId: opened.data.id })).toMatchObject({ ok: true, data: { burned: 20, remaining: 3, completed: false } });
    expect(await recallBatch({ chain: CHAIN, roundId: opened.data.id })).toMatchObject({ ok: true, data: { burned: 23, remaining: 0, completed: true } });
    expect(fault.burnSends).toBe(23);
    expect((await getStore().listTxns({ chain: CHAIN, limit: 100 })).filter((row) => row.operation === 'recall')).toHaveLength(23);
  });

  it('[ca 14] chết sau khi gửi hai ví giữ cả hai hash và lần sau không burn lại', async () => {
    await issueOnly();
    const chain = await ledger();
    for (const wallet of [testWallet(201), testWallet(202)]) {
      await chain.whitelist(wallet); await chain.transfer(MOCK_VAULT_ADDRESS, wallet, 2n);
    }
    const opened = await openToday(); expect(opened.ok).toBe(true); if (!opened.ok) return;
    const { freezeToken, recallBatch } = await import('@/lib/bank/recall.service');
    expect((await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' })).ok).toBe(true);
    fault.receiptThrows = true;
    expect(await recallBatch({ chain: CHAIN, roundId: opened.data.id })).toMatchObject({ ok: true, data: { pending: 2 } });
    expect((await getSettlementStore().listRoundCases({ roundId: opened.data.id })).every((row) => row.burnTxHash)).toBe(true);
    fault.receiptThrows = false;
    expect(await recallBatch({ chain: CHAIN, roundId: opened.data.id })).toMatchObject({ ok: true, data: { completed: true } });
    expect(fault.burnSends).toBe(2);
  });

  it('[ca 15] receipt FAILED và revert ghi lý do; lượt sau xoá hash cũ và gửi lại', async () => {
    await issueOnly();
    const chain = await ledger(); const a = testWallet(301); const b = testWallet(302);
    for (const wallet of [a, b]) { await chain.whitelist(wallet); await chain.transfer(MOCK_VAULT_ADDRESS, wallet, 3n); }
    const opened = await openToday(); expect(opened.ok).toBe(true); if (!opened.ok) return;
    const { freezeToken, recallBatch } = await import('@/lib/bank/recall.service');
    expect((await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' })).ok).toBe(true);
    fault.burnModes[a.toLowerCase()] = 'FAILED'; fault.burnModes[b.toLowerCase()] = 'revert';
    expect(await recallBatch({ chain: CHAIN, roundId: opened.data.id })).toMatchObject({ ok: true, data: { failed: 2, completed: false } });
    const failed = await getSettlementStore().listRoundCases({ roundId: opened.data.id });
    expect(failed.every((row) => row.status === 'FAILED' && row.reason)).toBe(true);
    const oldHash = failed.find((row) => row.holderWallet === a.toLowerCase())?.burnTxHash;
    fault.burnModes = {};
    expect(await recallBatch({ chain: CHAIN, roundId: opened.data.id })).toMatchObject({ ok: true, data: { completed: true } });
    const retried = await getSettlementStore().listRoundCases({ roundId: opened.data.id });
    expect(retried.find((row) => row.holderWallet === a.toLowerCase())?.burnTxHash).not.toBe(oldHash);
  });

  it('[bổ sung nghiệm thu] lỗi gửi burn không phải revert trả ví và lý do, không xoá dấu BURNING', async () => {
    await issueAndDistribute();
    const opened = await openToday(); expect(opened.ok).toBe(true); if (!opened.ok) return;
    const { freezeToken, recallBatch } = await import('@/lib/bank/recall.service');
    expect((await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' })).ok).toBe(true);
    fault.burnModes[INVESTOR.toLowerCase()] = 'network';
    const result = await recallBatch({ chain: CHAIN, roundId: opened.data.id });
    expect(result).toMatchObject({
      ok: true,
      data: { pending: 1, errors: [{ wallet: INVESTOR.toLowerCase(), reason: expect.stringContaining('RPC mất phản hồi') }] },
    });
    expect((await getSettlementStore().listRoundCases({ roundId: opened.data.id }))[0]).toMatchObject({ status: 'BURNING', burnTxHash: null });
  });

  it('[ca 16] hai lượt thu hồi đồng thời: một lượt bị khoá, mỗi ví chỉ burn một lần', async () => {
    await issueAndDistribute();
    const opened = await openToday(); expect(opened.ok).toBe(true); if (!opened.ok) return;
    const { freezeToken, recallBatch } = await import('@/lib/bank/recall.service');
    expect((await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' })).ok).toBe(true);
    let release!: () => void;
    fault.waitCalls = 0;
    fault.waitGate = new Promise<void>((resolve) => { release = resolve; });
    const first = recallBatch({ chain: CHAIN, roundId: opened.data.id });
    for (let index = 0; index < 200 && fault.burnSends === 0; index += 1) await Promise.resolve();
    expect(fault.burnSends).toBe(1);
    for (let index = 0; index < 200 && fault.waitCalls === 0; index += 1) await Promise.resolve();
    expect(fault.waitCalls).toBe(1);
    expect(await recallBatch({ chain: CHAIN, roundId: opened.data.id })).toMatchObject({ ok: false, code: 'REQUEST_STATE' });
    fault.waitGate = null; release();
    expect((await first).ok).toBe(true);
    expect(fault.burnSends).toBe(1);
  });

  it('[ca 16] khoá RECALL chết được tiếp quản, khoá còn hạn thì không', async () => {
    await issueAndDistribute();
    const opened = await openToday(); expect(opened.ok).toBe(true); if (!opened.ok) return;
    const { freezeToken, recallBatch } = await import('@/lib/bank/recall.service');
    expect((await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' })).ok).toBe(true);
    expect(await getVaultStore().acquireOperationLock({ chain: CHAIN, kind: 'RECALL', refId: 'dead', actor: 'KSV-DEAD' })).not.toBeNull();
    expect(await recallBatch({ chain: CHAIN, roundId: opened.data.id })).toMatchObject({ ok: false, code: 'REQUEST_STATE' });
    vi.setSystemTime(new Date(Date.now() + 211_000));
    expect(await recallBatch({ chain: CHAIN, roundId: opened.data.id })).toMatchObject({ ok: true, data: { completed: true } });
  });

  it('[ca 18] không đóng khi ngoài vault còn cung chưa có hồ sơ; lô sau lập bổ sung đúng ví', async () => {
    await issueAndDistribute(5n);
    const opened = await openToday(); expect(opened.ok).toBe(true); if (!opened.ok) return;
    const { freezeToken, recallBatch } = await import('@/lib/bank/recall.service');
    expect((await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' })).ok).toBe(true);
    const late = testWallet(401); const chain = await ledger(); await chain.whitelist(late);
    await chain.forcedTransfer(MOCK_VAULT_ADDRESS, late, 2n);
    fault.hiddenWallets = [late];
    expect(await recallBatch({ chain: CHAIN, roundId: opened.data.id })).toMatchObject({
      ok: true, data: { remaining: 0, outsideRemaining: '2', completed: false },
    });
    fault.hiddenWallets = [];
    expect(await recallBatch({ chain: CHAIN, roundId: opened.data.id })).toMatchObject({ ok: true, data: { completed: true } });
    expect((await getSettlementStore().listRoundCases({ roundId: opened.data.id })).map((row) => row.holderWallet).sort())
      .toEqual([INVESTOR.toLowerCase(), late.toLowerCase()].sort());
  });

  it('[ca 19] IN_PROGRESS nhưng token không đóng băng thì lô dừng trước khi burn', async () => {
    await issueAndDistribute();
    const opened = await openToday(); expect(opened.ok).toBe(true); if (!opened.ok) return;
    const { freezeToken, recallBatch } = await import('@/lib/bank/recall.service');
    expect((await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' })).ok).toBe(true);
    await (await ledger()).setSettlementMode(false);
    expect(await recallBatch({ chain: CHAIN, roundId: opened.data.id })).toMatchObject({ ok: false, code: 'REQUEST_STATE' });
    expect(fault.burnSends).toBe(0);
  });

  it('[ca 28] không mở đóng băng khi có hồ sơ BURNING hoặc BURNED có hash', async () => {
    await issueAndDistribute();
    const opened = await openToday(); expect(opened.ok).toBe(true); if (!opened.ok) return;
    const { freezeToken, unfreezeToken } = await import('@/lib/bank/recall.service');
    expect((await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' })).ok).toBe(true);
    const store = getSettlementStore();
    expect(await store.claimCase({ roundId: opened.data.id, holderWallet: INVESTOR, at: new Date().toISOString() })).not.toBeNull();
    expect(await unfreezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT', reason: 'Không được mở lúc đang gửi burn' }))
      .toMatchObject({ ok: false, code: 'REQUEST_STATE' });
    expect(fault.unfreezeSends).toBe(0);
    expect(await store.attachBurnTx({ roundId: opened.data.id, holderWallet: INVESTOR, txHash: `0x${'a'.repeat(64)}` })).toBe(true);
    await store.settleCase({ roundId: opened.data.id, holderWallet: INVESTOR, to: 'BURNED', at: new Date().toISOString() });
    expect(await unfreezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT', reason: 'Không được mở sau khi đã burn' }))
      .toMatchObject({ ok: false, code: 'REQUEST_STATE' });
    expect(fault.unfreezeSends).toBe(0);
  });

  it('[ca 29] unfreeze PENDING chặn recall; receipt FAILED xoá dấu nhưng giữ IN_PROGRESS', async () => {
    await issueAndDistribute();
    const opened = await openToday(); expect(opened.ok).toBe(true); if (!opened.ok) return;
    const { freezeToken, recallBatch, unfreezeToken } = await import('@/lib/bank/recall.service');
    expect((await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' })).ok).toBe(true);
    fault.unfreezeSubmit = 'PENDING';
    expect(await unfreezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT', reason: 'Thử mở trước burn' }))
      .toMatchObject({ ok: false, code: 'REQUEST_STATE' });
    expect(await recallBatch({ chain: CHAIN, roundId: opened.data.id })).toMatchObject({ ok: false, code: 'REQUEST_STATE' });
    expect(fault.burnSends).toBe(0);
    const pending = await getSettlementStore().findActiveRound(CHAIN);
    expect(pending?.unfreezeRequestedAt).not.toBeNull();
    if (pending?.unfreezeTxHash) fault.receipts[pending.unfreezeTxHash] = 'FAILED';
    expect(await unfreezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT', reason: 'Đối soát mở thất bại' }))
      .toMatchObject({ ok: false, code: 'LEDGER' });
    expect(await getSettlementStore().findActiveRound(CHAIN)).toMatchObject({ status: 'IN_PROGRESS', unfreezeRequestedAt: null, unfreezeTxHash: null });
  });

  it('[sửa lỗi] burnedAmount ở tổng quan lấy amount Txn recall thật, không lấy wptAmount hồ sơ', async () => {
    await issueAndDistribute();
    const opened = await openToday(); expect(opened.ok).toBe(true); if (!opened.ok) return;
    const { freezeToken, getRecallOverview } = await import('@/lib/bank/recall.service');
    expect((await freezeToken({ chain: CHAIN, roundId: opened.data.id, confirmSymbol: 'WPT' })).ok).toBe(true);
    const store = getSettlementStore();
    await store.claimCase({ roundId: opened.data.id, holderWallet: INVESTOR, at: new Date().toISOString() });
    const txHash = `0x${'b'.repeat(64)}`;
    await getStore().saveTxn({ chain: CHAIN, operation: 'recall', txHash, status: 'CONFIRMED', fromWallet: INVESTOR, toWallet: null, amount: '7', reason: null, actorRole: 'CONTROLLER', actorAddress: null });
    await store.attachBurnTx({ roundId: opened.data.id, holderWallet: INVESTOR, txHash });
    await store.settleCase({ roundId: opened.data.id, holderWallet: INVESTOR, to: 'BURNED', at: new Date().toISOString() });
    expect(await getRecallOverview({ chain: CHAIN })).toMatchObject({ ok: true, data: { cases: [{ wptAmount: '10', burnedAmount: '7' }] } });
  });
});
