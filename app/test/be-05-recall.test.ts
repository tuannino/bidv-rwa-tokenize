import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOCK_VAULT_ADDRESS } from '@bidv/shared';
import { resetServerEnvCache } from '@/lib/config/env';
import type { ILedgerPort, TxResult } from '@/lib/ledger/ledger.port';
import { resetMockLedger } from '@/lib/ledger/mock.adapter';
import { getProjectStore, getSettlementStore, getStore, resetMemoryStore, resetStoreCache } from '@/lib/store';
import { addDays, recallPhaseOf, todayVn, tradingBlocked } from '@/lib/bank/recall-phase';

const fault = vi.hoisted(() => ({ receiptThrows: false, freezeSends: 0, burnSends: 0 }));

vi.mock('@/lib/ledger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ledger')>();
  return {
    ...actual,
    getLedger: (...args: Parameters<typeof actual.getLedger>): ILedgerPort => {
      const real = actual.getLedger(...args);
      return {
        ...real,
        async setSettlementMode(enabled: boolean) {
          fault.freezeSends += 1;
          return real.setSettlementMode(enabled);
        },
        async burn(wallet: string, amount: bigint) {
          fault.burnSends += 1;
          return real.burn(wallet, amount);
        },
        async waitReceipt(txHash: string, timeoutMs?: number): Promise<TxResult> {
          if (fault.receiptThrows) throw new Error('tiến trình chết khi chờ receipt');
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
  process.env.ENABLE_DEMO_TOKEN_MINT = 'true';
  actAs('TELLER', 'GDV001');
  const { issueInitialSupply } = await import('@/lib/bank/issuance.service');
  const issued = await issueInitialSupply({ chain: CHAIN, spvWallet: MOCK_VAULT_ADDRESS, amount: '100' });
  expect(issued.ok, issued.ok ? '' : issued.error).toBe(true);
  delete process.env.ENABLE_DEMO_TOKEN_MINT;
  resetServerEnvCache();
  const chain = await ledger();
  await chain.whitelist(INVESTOR);
  await chain.transfer(MOCK_VAULT_ADDRESS, INVESTOR, amount);
  actAs('CONTROLLER', 'KSV001');
}

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
  fault.freezeSends = 0;
  fault.burnSends = 0;
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

  it('lưu freezeTxHash trước khi chờ; lần sau chốt mà không gửi lần hai', async () => {
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
});
