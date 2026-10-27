import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAMPLE_WALLETS, type ChainKey } from '@bidv/shared';
import type { ILedgerPort } from '@/lib/ledger';

/**
 * UIUX-01 ca 1 tới 5 (requirements mục 6), chain `mock`, bộ lưu trữ trong bộ nhớ.
 *
 * `getLedger` được bọc để đếm giao dịch cấu hình thực gửi và để cài lỗi vào `vaultConfigEvents`
 * (ca 5), y như cách `be-13-vault-config.test.ts` bọc cổng chuỗi.
 */
const hooks: { sent: string[]; failConfigEvents: boolean } = { sent: [], failConfigEvents: false };
const SETTERS = ['setVaultPayoutWallet', 'setVaultFixedLock', 'setVaultPercentRate', 'setVaultLockMode'];

vi.mock('@/lib/ledger', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/ledger')>();
  const instrument = (ledger: ILedgerPort): ILedgerPort =>
    new Proxy(ledger, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (property === 'vaultConfigEvents' && hooks.failConfigEvents) {
          return async () => {
            throw new mod.LedgerError(target.chain, 'vaultConfigEvents', 'Lỗi cài cho kiểm thử khi đọc sự kiện cấu hình.');
          };
        }
        if (!SETTERS.includes(String(property))) return value;
        return async (arg: unknown) => {
          hooks.sent.push(String(property));
          return (value as (input: unknown) => Promise<unknown>).call(target, arg);
        };
      },
    });
  return { ...mod, getLedger: (chain: ChainKey, signer?: Parameters<typeof mod.getLedger>[1]) => instrument(mod.getLedger(chain, signer)) };
});

const { resetServerEnvCache } = await import('@/lib/config/env');
const { getLedger } = await import('@/lib/ledger');
const { resetMockLedger } = await import('@/lib/ledger/mock.adapter');
const { getTokenRequestStore, getVaultStore, resetMemoryStore, resetStoreCache } = await import('@/lib/store');
const { getVaultOverview, saveVaultConfig } = await import('@/lib/bank/vault.service');
const { configEffectiveAt, planVaultConfig } = await import('@/lib/bank/vault-config');
const { getApprovalStats } = await import('@/lib/bank/token-request.service');
const { resultText } = await import('@/components/maker-checker/request-table');

const CHAIN = 'mock' as const;
const PAYOUT = SAMPLE_WALLETS.NB001;

function actAs(role: string, actor?: string) {
  process.env.DEMO_ROLE = role;
  if (actor === undefined) delete process.env.DEMO_ACTOR;
  else process.env.DEMO_ACTOR = actor;
  resetServerEnvCache();
}

beforeEach(async () => {
  process.env.USE_MOCK_DB = 'true';
  actAs('CONTROLLER', 'KSV001');
  await resetMockLedger();
  resetMemoryStore();
  resetStoreCache();
  await getLedger(CHAIN).whitelist(PAYOUT);
  hooks.sent = [];
  hooks.failConfigEvents = false;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete process.env.DEMO_ROLE;
  delete process.env.DEMO_ACTOR;
  delete process.env.USE_MOCK_DB;
  resetServerEnvCache();
  resetStoreCache();
});

describe('UIUX-01 ca 1: saveVaultConfig kiểm một chế độ', () => {
  for (const [mode, wrongField] of [
    ['PERCENT', 'fixedLock'],
    ['FIXED', 'percent'],
  ] as const) {
    it(`chế độ ${mode} có cả hai ô: VALIDATION gắn vào ô ${wrongField}, không lấy khoá, không giao dịch`, async () => {
      const acquire = vi.spyOn(getVaultStore(), 'acquireOperationLock');
      const result = await saveVaultConfig({ chain: CHAIN, mode, percent: '20', fixedLock: '400' });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe('VALIDATION');
      expect(result.fieldErrors).toEqual({ [wrongField]: ['Chỉ nhập một trong hai: tỷ lệ % hoặc số khoá cố định.'] });
      expect(acquire).not.toHaveBeenCalled();
      expect(hooks.sent).toEqual([]);
    });
  }

  it('chế độ FIXED thiếu fixedLock: VALIDATION ở ô fixedLock', async () => {
    const acquire = vi.spyOn(getVaultStore(), 'acquireOperationLock');
    const result = await saveVaultConfig({ chain: CHAIN, mode: 'FIXED' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
    expect(Object.keys(result.fieldErrors ?? {})).toEqual(['fixedLock']);
    expect(acquire).not.toHaveBeenCalled();
    expect(hooks.sent).toEqual([]);
  });
});

describe('UIUX-01 ca 2: planVaultConfig theo một chế độ', () => {
  const current = {
    lockMode: 'PERCENT' as const,
    fixedLockAmount: 0n,
    percentRateBps: 2_000n,
    pendingPercentRateBps: null,
  };

  it('đích FIXED không có setPercentRate', () => {
    const steps = planVaultConfig(current, { mode: 'FIXED', fixedLock: 400n });
    expect(steps.map((step) => step.kind)).toEqual(['setFixedLock', 'setLockMode']);
  });

  it('đích PERCENT không có setFixedLock', () => {
    const fixed = { ...current, lockMode: 'FIXED' as const, fixedLockAmount: 400n };
    const steps = planVaultConfig(fixed, { mode: 'PERCENT', percentBps: 3_000n });
    expect(steps.map((step) => step.kind)).toEqual(['setPercentRate', 'setLockMode']);
  });
});

describe('UIUX-01 ca 3: configEffectiveAt', () => {
  const event = (param: Parameters<typeof configEffectiveAt>[0]['events'][number]['param'], blockNumber: bigint, logIndex: number, timestamp: number) => ({
    param,
    blockNumber,
    logIndex,
    timestamp,
  });

  it('FIXED: sự kiện mới nhất trong LOCK_MODE và FIXED_LOCK, bỏ qua tỷ lệ', () => {
    const events = [
      event('LOCK_MODE', 5n, 1, 1_500),
      event('FIXED_LOCK', 7n, 0, 1_700),
      event('PERCENT_RATE', 9n, 0, 1_900),
      event('PAYOUT_WALLET', 10n, 0, 2_000),
    ];
    expect(configEffectiveAt({ lockMode: 'FIXED', events })).toEqual({ at: 1_700, unknown: false });
  });

  it('PERCENT: sự kiện tỷ lệ chờ mới hơn không tính', () => {
    const events = [
      event('PERCENT_RATE', 3n, 0, 1_300),
      event('LOCK_MODE', 3n, 1, 1_300),
      event('PENDING_PERCENT_RATE', 8n, 0, 1_800),
    ];
    expect(configEffectiveAt({ lockMode: 'PERCENT', events })).toEqual({ at: 1_300, unknown: false });
  });

  it('đầu vào lộn thứ tự: chọn theo block rồi logIndex, không theo timestamp', () => {
    // Mock gán nhiều sự kiện cùng giây; ở đây cố ý cho timestamp ngược thứ tự block để thấy hàm
    // không dựa vào timestamp.
    const events = [
      event('PERCENT_RATE', 6n, 1, 1_050),
      event('LOCK_MODE', 4n, 0, 1_090),
      event('PERCENT_RATE', 6n, 2, 1_010),
      event('PERCENT_RATE', 2n, 0, 1_099),
    ];
    expect(configEffectiveAt({ lockMode: 'PERCENT', events })).toEqual({ at: 1_010, unknown: false });
    const sameSecond = events.map((item) => ({ ...item, timestamp: 1_000 }));
    expect(configEffectiveAt({ lockMode: 'PERCENT', events: sameSecond })).toEqual({ at: 1_000, unknown: false });
  });

  it('sự kiện chọn ra có timestamp 0: unknown', () => {
    const events = [event('LOCK_MODE', 1n, 0, 900), event('FIXED_LOCK', 2n, 0, 0)];
    expect(configEffectiveAt({ lockMode: 'FIXED', events })).toEqual({ at: null, unknown: true });
  });

  it('UNSET hoặc không có sự kiện: at null', () => {
    expect(configEffectiveAt({ lockMode: 'UNSET', events: [event('LOCK_MODE', 1n, 0, 900)] })).toEqual({ at: null, unknown: false });
    expect(configEffectiveAt({ lockMode: 'PERCENT', events: [] })).toEqual({ at: null, unknown: false });
  });
});

describe('UIUX-01 ca 4: lịch sử phê duyệt', () => {
  it('getApprovalStats().history: chỉ yêu cầu đã quyết định, mới quyết định trước, đúng chain; câu từ chối', async () => {
    const store = getTokenRequestStore();
    const base = {
      tokenSymbol: 'WPT',
      type: 'MINT' as const,
      amount: '10',
      wallet: PAYOUT,
      reason: 'kiểm UIUX-01',
      makerId: 'GDV001',
      makerRole: 'TELLER' as const,
    };
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-26T01:00:00Z'));
    const first = await store.createRequest({ ...base, chain: CHAIN });
    const second = await store.createRequest({ ...base, chain: CHAIN, type: 'BURN', burnSource: 'UNDISTRIBUTED' });
    const pending = await store.createRequest({ ...base, chain: CHAIN });
    const otherChain = await store.createRequest({ ...base, chain: 'hardhat-local' });

    // Quyết định theo thứ tự: second trước, first sau; first mới quyết định nhất.
    vi.setSystemTime(new Date('2026-10-26T02:00:00Z'));
    await store.transitionRequest({
      id: second.id,
      from: ['PENDING'],
      to: 'REJECTED',
      checkerId: 'KSV001',
      checkerRole: 'CONTROLLER',
      rejectReason: 'Sai chứng từ',
    });
    vi.setSystemTime(new Date('2026-10-26T03:00:00Z'));
    await store.transitionRequest({ id: first.id, from: ['PENDING'], to: 'EXECUTING', checkerId: 'KSV001', checkerRole: 'CONTROLLER' });
    await store.transitionRequest({ id: otherChain.id, from: ['PENDING'], to: 'EXECUTING', checkerId: 'KSV001', checkerRole: 'CONTROLLER' });

    const stats = await getApprovalStats(CHAIN);
    expect(stats.ok, stats.ok ? '' : stats.error).toBe(true);
    if (!stats.ok) return;
    expect(stats.data.history.map((row) => row.id)).toEqual([first.id, second.id]);
    expect(stats.data.history.every((row) => row.chain === CHAIN && row.decidedAt !== null)).toBe(true);
    expect(stats.data.history.map((row) => row.id)).not.toContain(pending.id);

    const rejected = stats.data.history.find((row) => row.status === 'REJECTED')!;
    expect(resultText(rejected)).toBe('Kiểm soát viên KSV001 từ chối do: Sai chứng từ');
    expect(resultText({ ...rejected, checkerRole: null })).toBe('KSV001 từ chối do: Sai chứng từ');
  });
});

describe('UIUX-01 ca 5: getVaultOverview cách ly lỗi đọc sự kiện cấu hình', () => {
  it('vaultConfigEvents ném lỗi: vẫn trả trạng thái và lịch sử chốt kỳ, configEffectiveError có giá trị', async () => {
    const saved = await saveVaultConfig({ chain: CHAIN, mode: 'PERCENT', percent: '20' });
    expect(saved.ok, saved.ok ? '' : saved.error).toBe(true);
    await getLedger(CHAIN).closeVaultPeriod(1n, 1_000_000n);

    const healthy = await getVaultOverview({ chain: CHAIN });
    expect(healthy.ok && healthy.data.configEffective).toMatchObject({ unknown: false });
    expect(healthy.ok && healthy.data.configEffective?.at).toBeGreaterThan(0);

    hooks.failConfigEvents = true;
    const overview = await getVaultOverview({ chain: CHAIN });
    expect(overview.ok, overview.ok ? '' : overview.error).toBe(true);
    if (!overview.ok) return;
    expect(overview.data.status).toMatchObject({ lockMode: 'PERCENT', percentRateBps: '2000' });
    expect(overview.data.history).toHaveLength(1);
    expect(overview.data.historyError).toBeNull();
    expect(overview.data.configEffective).toBeNull();
    expect(overview.data.configEffectiveError).toEqual(expect.any(String));
    expect(overview.data.configEffectiveError).not.toBe('');
    expect(overview.data.config).toMatchObject({ mode: 'PERCENT', percentApplies: 'NEXT_PERIOD' });
  });
});
