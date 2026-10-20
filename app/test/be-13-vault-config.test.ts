import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from 'pg';
import { MOCK_VAULT_ADDRESS, SAMPLE_WALLETS, type ChainKey } from '@bidv/shared';
import type { ILedgerPort, VaultStatus } from '@/lib/ledger';
import type { IVaultStore } from '@/lib/store';

/**
 * BE-13 ca 2 đến 6 (QĐ-C, QĐ-D) và phần cấu hình của ca 1, trên chain mock.
 *
 * `getLedger` được bọc để ghi lại ĐÚNG thứ tự giao dịch cấu hình thực gửi, chụp trạng thái chuỗi
 * sau TỪNG giao dịch, cài lỗi vào một bước, hoặc giữ một giao dịch lại để hai lần lưu chồng lên
 * nhau. Mock xác nhận giao dịch ngay khi gửi, nên trạng thái chụp là trạng thái chuỗi sau giao dịch.
 */
type Sent = { kind: string; arg: string };
const hooks: {
  sent: Sent[];
  snapshots: Array<{ after: string; status: VaultStatus }>;
  failOn: string | null;
  gate: Promise<void> | null;
} = { sent: [], snapshots: [], failOn: null, gate: null };

const SETTERS = ['setVaultPayoutWallet', 'setVaultFixedLock', 'setVaultPercentRate', 'setVaultLockMode'] as const;

vi.mock('@/lib/ledger', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/ledger')>();
  const instrument = (ledger: ILedgerPort): ILedgerPort =>
    new Proxy(ledger, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (!(SETTERS as readonly (string | symbol)[]).includes(property)) return value;
        return async (arg: unknown) => {
          const kind = String(property);
          if (hooks.gate) await hooks.gate;
          if (hooks.failOn === kind) {
            hooks.failOn = null;
            throw new mod.LedgerError(target.chain, kind, `Lỗi cài cho kiểm thử ở ${kind}.`, { reverted: true });
          }
          hooks.sent.push({ kind, arg: String(arg) });
          const tx = await (value as (input: unknown) => Promise<unknown>).call(target, arg);
          hooks.snapshots.push({ after: kind, status: (await target.vaultStatus())! });
          return tx;
        };
      },
    });
  return { ...mod, getLedger: (chain: ChainKey, signer?: Parameters<typeof mod.getLedger>[1]) => instrument(mod.getLedger(chain, signer)) };
});

const { resetServerEnvCache } = await import('@/lib/config/env');
const { getLedger } = await import('@/lib/ledger');
const { resetMockLedger } = await import('@/lib/ledger/mock.adapter');
const { getVaultStore, getConfigStore, getStore, resetMemoryStore, resetStoreCache } = await import('@/lib/store');
const { getVaultOverview, saveVaultConfig, vaultConfigLockTakeOverBefore } = await import('@/lib/bank/vault.service');
const { bpsToPercent, percentToBps, planVaultConfig } = await import('@/lib/bank/vault-config');
const { createMemoryVaultStore } = await import('@/lib/store/memory.vault.store');

const CHAIN = 'mock' as const;
const PAYOUT = SAMPLE_WALLETS.NB001;
const OTHER_PAYOUT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

function actAs(role: string) {
  process.env.DEMO_ROLE = role;
  resetServerEnvCache();
}

const raw = (input: { percent?: string; fixedLock?: string; payoutWallet?: string }) =>
  saveVaultConfig({ chain: CHAIN, percent: '20', fixedLock: '', payoutWallet: PAYOUT, ...input });

async function saveOk(input: Parameters<typeof raw>[0]) {
  const result = await raw(input);
  expect(result.ok, result.ok ? '' : `${result.code} ${result.error}`).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

const sentKinds = () => hooks.sent.map((tx) => (tx.kind === 'setVaultLockMode' ? `setVaultLockMode(${tx.arg})` : tx.kind));
const status = async () => (await getLedger(CHAIN).vaultStatus())!;

beforeEach(async () => {
  hooks.sent = [];
  hooks.snapshots = [];
  hooks.failOn = null;
  hooks.gate = null;
  process.env.USE_MOCK_DB = 'true';
  actAs('CONTROLLER');
  await resetMockLedger();
  resetMemoryStore();
  resetStoreCache();
  await getLedger(CHAIN).whitelist(PAYOUT);
  await getLedger(CHAIN).whitelist(OTHER_PAYOUT);
  hooks.sent = [];
  hooks.snapshots = [];
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.DEMO_ROLE;
  delete process.env.USE_MOCK_DB;
  resetServerEnvCache();
  resetStoreCache();
});

describe('BE-13 ca 1 (phần cấu hình): chỉ CONTROLLER lưu được cấu hình khoá', () => {
  for (const role of ['SELLER', 'TELLER', 'INVESTOR', 'UNKNOWN', '']) {
    it(`vai "${role}": FORBIDDEN, không giao dịch nào, có dòng audit DENIED`, async () => {
      actAs(role);
      const result = await raw({});
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('FORBIDDEN');
      expect(hooks.sent).toEqual([]);
      const denied = (await getStore().listAudit({ limit: 5 })).find((row) => row.action === 'vault:configure');
      expect(denied?.outcome).toBe('DENIED');
    });
  }
});

describe('BE-13 ca 2: ưu tiên FIXED', () => {
  it('đặt số cố định thì FIXED; bỏ trống thì về PERCENT với đúng tỷ lệ đã lưu', async () => {
    await saveOk({ percent: '25' });
    expect(await status()).toMatchObject({ lockMode: 'PERCENT', percentRateBps: 2_500n });

    await saveOk({ percent: '25', fixedLock: '500' });
    expect(await status()).toMatchObject({ lockMode: 'FIXED', fixedLockAmount: 500n, percentRateBps: 2_500n });

    await saveOk({ percent: '25', fixedLock: '' });
    expect(await status()).toMatchObject({ lockMode: 'PERCENT', percentRateBps: 2_500n, fixedLockAmount: 500n });
  });
});

describe('BE-13 ca 3: thứ tự giao dịch theo bảng chuyển tiếp QĐ-C', () => {
  /** Chế độ hiện hành không bao giờ mang giá trị 0 hay giá trị chưa lên chuỗi. */
  function expectNoZeroMode() {
    for (const { after, status: snapshot } of hooks.snapshots) {
      if (snapshot.lockMode === 'FIXED') expect(snapshot.fixedLockAmount, `sau ${after}`).toBeGreaterThan(0n);
      if (snapshot.lockMode === 'PERCENT') expect(snapshot.percentRateBps, `sau ${after}`).toBeGreaterThan(0n);
    }
  }

  it('dòng 1, UNSET sang PERCENT: ví nhận, setPercentRate, rồi setLockMode(PERCENT)', async () => {
    const saved = await saveOk({ percent: '20' });
    expect(sentKinds()).toEqual(['setVaultPayoutWallet', 'setVaultPercentRate', 'setVaultLockMode(PERCENT)']);
    expect(saved.steps.map((step) => step.kind)).toEqual(['setPayoutWallet', 'setPercentRate', 'setLockMode']);
    expectNoZeroMode();
  });

  it('dòng 2, UNSET sang FIXED: ví nhận, setFixedLock, rồi setLockMode(FIXED); không gửi tỷ lệ', async () => {
    await saveOk({ fixedLock: '700' });
    expect(sentKinds()).toEqual(['setVaultPayoutWallet', 'setVaultFixedLock', 'setVaultLockMode(FIXED)']);
    expectNoZeroMode();
  });

  it('dòng 3, PERCENT sang FIXED: setFixedLock rồi setLockMode(FIXED)', async () => {
    await saveOk({ percent: '20' });
    hooks.sent = [];
    hooks.snapshots = [];
    await saveOk({ percent: '20', fixedLock: '900' });
    expect(sentKinds()).toEqual(['setVaultFixedLock', 'setVaultLockMode(FIXED)']);
    expectNoZeroMode();
  });

  it('dòng 4, FIXED sang PERCENT: setPercentRate (khi khác) rồi setLockMode(PERCENT), KHÔNG setFixedLock(0)', async () => {
    await saveOk({ fixedLock: '900' });
    hooks.sent = [];
    hooks.snapshots = [];
    await saveOk({ percent: '30' });
    expect(sentKinds()).toEqual(['setVaultPercentRate', 'setVaultLockMode(PERCENT)']);
    expect(hooks.sent.some((tx) => tx.kind === 'setVaultFixedLock')).toBe(false);
    expect((await status()).fixedLockAmount).toBe(900n);
    expectNoZeroMode();

    // Tỷ lệ trên chuỗi đã đúng thì chỉ đổi chế độ.
    await saveOk({ percent: '30', fixedLock: '900' });
    hooks.sent = [];
    await saveOk({ percent: '30' });
    expect(sentKinds()).toEqual(['setVaultLockMode(PERCENT)']);
  });

  it('dòng 5, giữ chế độ: chỉ setter của giá trị đổi; không đổi gì thì không gửi', async () => {
    await saveOk({ percent: '20' });
    hooks.sent = [];
    await saveOk({ percent: '22.5' });
    expect(sentKinds()).toEqual(['setVaultPercentRate']);
    expect((await status()).percentRateBps).toBe(2_250n);

    hooks.sent = [];
    await saveOk({ percent: '22.5', payoutWallet: OTHER_PAYOUT });
    expect(sentKinds()).toEqual(['setVaultPayoutWallet']);

    await saveOk({ percent: '22.5', payoutWallet: OTHER_PAYOUT, fixedLock: '10' });
    hooks.sent = [];
    await saveOk({ percent: '22.5', payoutWallet: OTHER_PAYOUT, fixedLock: '11' });
    expect(sentKinds()).toEqual(['setVaultFixedLock']);

    hooks.sent = [];
    const same = await saveOk({ percent: '22.5', payoutWallet: OTHER_PAYOUT, fixedLock: '11' });
    expect(same.outcome).toBe('NO_CHANGE');
    expect(hooks.sent).toEqual([]);
  });

  it('lỗi ở giao dịch đổi chế độ: chế độ cũ còn nguyên, trả bước đã xong và bước lỗi; lần lưu sau chỉ gửi phần thiếu', async () => {
    await saveOk({ percent: '20' });
    hooks.sent = [];
    hooks.failOn = 'setVaultLockMode';
    const failed = await raw({ percent: '20', fixedLock: '400' });
    expect(failed.ok).toBe(false);
    if (failed.ok) return;
    expect(failed.code).toBe('LEDGER');
    expect(failed.fieldErrors).toMatchObject({
      completedSteps: ['setFixedLock'],
      failedStep: ['Đổi chế độ khoá'],
      payoutChanged: ['false'],
    });
    expect(failed.error).toContain('Ví nhận chưa đổi');
    expect(await status()).toMatchObject({ lockMode: 'PERCENT', percentRateBps: 2_000n, fixedLockAmount: 400n });
    expect(await getVaultStore().findOperationLock(CHAIN)).toBeNull();

    hooks.sent = [];
    await saveOk({ percent: '20', fixedLock: '400' });
    expect(sentKinds()).toEqual(['setVaultLockMode(FIXED)']);
  });

  it('mỗi bước có Txn và audit ghi giá trị cũ, mới, mã giao dịch', async () => {
    const saved = await saveOk({ percent: '20' });
    const txns = await getStore().listTxns({ chain: CHAIN, limit: 20 });
    for (const step of saved.steps) {
      expect(txns.find((txn) => txn.txHash === step.txHash)).toMatchObject({ operation: `vault:${step.kind}`, status: 'CONFIRMED' });
    }
    const audits = (await getStore().listAudit({ limit: 20 })).filter(
      (row) => row.action === 'vault:configure' && row.outcome === 'SUCCESS',
    );
    expect(audits.map((row) => row.detail)).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`ví nhận (chưa đặt) -> ${PAYOUT}`),
        expect.stringContaining('tỷ lệ khoá 0% -> 20%'),
        expect.stringContaining('chế độ khoá UNSET -> PERCENT'),
      ]),
    );
  });
});

describe('BE-13 ca 4: kiểm đầu vào, từ chối trước khi gửi', () => {
  const invalid: Array<[string, Parameters<typeof raw>[0], string]> = [
    ['tỷ lệ 0', { percent: '0' }, 'percent'],
    ['tỷ lệ 0.00', { percent: '0.00' }, 'percent'],
    ['tỷ lệ trên 100', { percent: '100.01' }, 'percent'],
    ['tỷ lệ 101', { percent: '101' }, 'percent'],
    ['ba chữ số thập phân', { percent: '12.345' }, 'percent'],
    ['chuỗi lạ', { percent: '1e2' }, 'percent'],
    ['tỷ lệ âm', { percent: '-5' }, 'percent'],
    ['số cố định 0', { fixedLock: '0' }, 'fixedLock'],
    ['số cố định âm', { fixedLock: '-5' }, 'fixedLock'],
    ['số cố định lẻ', { fixedLock: '1.5' }, 'fixedLock'],
    ['ví nhận bằng 0', { payoutWallet: '0x0000000000000000000000000000000000000000' }, 'payoutWallet'],
    ['ví nhận bằng vault', { payoutWallet: MOCK_VAULT_ADDRESS }, 'payoutWallet'],
    ['ví nhận chưa whitelist', { payoutWallet: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc' }, 'payoutWallet'],
    ['ví nhận sai dạng', { payoutWallet: '0x1234' }, 'payoutWallet'],
  ];
  for (const [label, input, field] of invalid) {
    it(`${label}: VALIDATION ở ô ${field}, không giao dịch, khoá đã nhả`, async () => {
      const before = await getLedger(CHAIN).latestBlockNumber();
      const result = await raw(input);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe('VALIDATION');
      expect(Object.keys(result.fieldErrors ?? {})).toEqual([field]);
      expect(hooks.sent).toEqual([]);
      expect(await getLedger(CHAIN).latestBlockNumber()).toBe(before);
      expect(await getVaultStore().findOperationLock(CHAIN)).toBeNull();
    });
  }

  it('đổi phần trăm sang phần vạn bằng xử lý chuỗi, đúng ở biên', () => {
    expect(percentToBps('100')).toBe(10_000n);
    expect(percentToBps('100.00')).toBe(10_000n);
    expect(percentToBps('0.01')).toBe(1n);
    expect(percentToBps('12.5')).toBe(1_250n);
    expect(percentToBps(' 7.05 ')).toBe(705n);
    expect(percentToBps('')).toBeNull();
    expect(bpsToPercent(1_250n)).toBe('12.5');
    expect(bpsToPercent(705n)).toBe('7.05');
    expect(bpsToPercent(2_000n)).toBe('20');
  });

  it('vault UNSET thì màn điền sẵn tỷ lệ từ vault.default_percent_bps', async () => {
    const overview = await getVaultOverview({ chain: CHAIN });
    expect(overview.ok && overview.data.config).toMatchObject({ percent: '20', fixedLock: '', canConfigure: true });
    await getConfigStore().setConfig({ key: 'vault.default_percent_bps', value: '1750', type: 'number', changedBy: 'CONTROLLER' });
    const changed = await getVaultOverview({ chain: CHAIN });
    expect(changed.ok && changed.data.config?.percent).toBe('17.5');
  });
});

describe('BE-13 ca 5: tỷ lệ chờ áp sau kỳ đầu', () => {
  it('sau một lần chốt kỳ, đổi tỷ lệ thì "chờ áp", lockedAmount chưa đổi; chốt kế tiếp thì áp', async () => {
    await saveOk({ percent: '20' });
    const ledger = getLedger(CHAIN);
    await ledger.closeVaultPeriod(1n, 1_000_000n);
    expect((await status()).lockedAmount).toBe(200_000n);

    await saveOk({ percent: '30' });
    const pending = await status();
    expect(pending).toMatchObject({ percentRateBps: 2_000n, pendingPercentRateBps: 3_000n, lockedAmount: 200_000n });
    const overview = await getVaultOverview({ chain: CHAIN });
    expect(overview.ok && overview.data.status).toMatchObject({ percentRateBps: '2000', pendingPercentRateBps: '3000' });
    expect(overview.ok && overview.data.config?.percent).toBe('30');

    // Lưu lại đúng tỷ lệ đang chờ: không gửi thêm.
    hooks.sent = [];
    expect((await saveOk({ percent: '30' })).outcome).toBe('NO_CHANGE');

    await ledger.closeVaultPeriod(2n, 1_000_000n);
    expect(await status()).toMatchObject({ percentRateBps: 3_000n, pendingPercentRateBps: null, lockedAmount: 300_000n });
  });

  it('kế hoạch so với tỷ lệ chờ khi có', () => {
    const current = { lockMode: 'PERCENT' as const, fixedLockAmount: 0n, percentRateBps: 2_000n, pendingPercentRateBps: 3_000n, payoutWallet: PAYOUT };
    expect(planVaultConfig(current, { percentBps: 3_000n, fixedLock: null, payoutWallet: PAYOUT })).toEqual([]);
    expect(planVaultConfig(current, { percentBps: 2_000n, fixedLock: null, payoutWallet: PAYOUT })).toEqual([
      { kind: 'setPercentRate', bps: 2_000n, previous: 3_000n },
    ]);
  });
});

describe('BE-13 ca 6: khoá vận hành', () => {
  it('hai lần lưu đồng thời: chỉ một bên gửi giao dịch, bên kia VAULT_BUSY', async () => {
    let open!: () => void;
    hooks.gate = new Promise((resolve) => (open = resolve));
    const first = raw({ percent: '20' });
    await vi.waitFor(async () => expect(await getVaultStore().findOperationLock(CHAIN)).not.toBeNull());
    const second = await raw({ percent: '40', fixedLock: '5' });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.code).toBe('VAULT_BUSY');
      expect(second.error).toContain('lần lưu cấu hình khác');
    }
    open();
    hooks.gate = null;
    expect((await first).ok).toBe(true);
    expect(sentKinds()).toEqual(['setVaultPayoutWallet', 'setVaultPercentRate', 'setVaultLockMode(PERCENT)']);
    expect(await getVaultStore().findOperationLock(CHAIN)).toBeNull();
  });

  it('đang có lệnh rút dở (khoá WITHDRAW) thì lưu cấu hình bị chặn; khoá WITHDRAW không tự hết hạn', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const start = new Date('2026-10-20T00:00:00Z');
    vi.setSystemTime(start);
    await getVaultStore().acquireOperationLock({ chain: CHAIN, kind: 'WITHDRAW', refId: 'withdraw-1', actor: 'NB001' });
    vi.setSystemTime(new Date(start.getTime() + 24 * 60 * 60 * 1000));
    const blocked = await raw({ percent: '20' });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.code).toBe('VAULT_BUSY');
      expect(blocked.error).toContain('lệnh rút đang dở');
    }
    expect(hooks.sent).toEqual([]);
    expect((await getVaultStore().findOperationLock(CHAIN))?.refId).toBe('withdraw-1');
  });

  it('khoá CONFIG treo quá thời gian chờ biên nhận thì được tiếp quản; chưa quá thì chặn', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const start = new Date('2026-10-20T00:00:00Z');
    vi.setSystemTime(start);
    await getVaultStore().acquireOperationLock({ chain: CHAIN, kind: 'CONFIG', refId: 'hung', actor: 'KSV001' });

    vi.setSystemTime(new Date(start.getTime() + 10_000));
    const early = await raw({ percent: '20' });
    expect(early.ok || early.code).toBe('VAULT_BUSY');

    // Quá đúng thời gian chờ biên nhận của chain (mock: 30 giây) thì khoá cũ nằm trước mốc tiếp quản.
    const later = new Date(start.getTime() + 31_000);
    expect(vaultConfigLockTakeOverBefore(CHAIN, later).getTime()).toBeGreaterThan(start.getTime());
    vi.setSystemTime(later);
    await saveOk({ percent: '20' });
    expect(await getVaultStore().findOperationLock(CHAIN)).toBeNull();
  });
});

/** Hợp đồng chung của hai bản cổng vault: bản bộ nhớ phải nghiêm ngang bản Postgres. */
function vaultStoreContract(label: string, makeStore: () => IVaultStore, chain: ChainKey) {
  describe(`BE-13 ca 6: hợp đồng khoá vận hành, ${label}`, () => {
    let store: IVaultStore;
    beforeEach(async () => {
      store = makeStore();
      const held = await store.findOperationLock(chain);
      if (held) await store.releaseOperationLock({ chain, refId: held.refId });
    });

    it('một câu lấy khoá: năm lần lấy song song chỉ một lần được', async () => {
      const results = await Promise.all(
        [1, 2, 3, 4, 5].map((n) => store.acquireOperationLock({ chain, kind: 'CONFIG', refId: `r${n}`, actor: 'A' })),
      );
      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it('nhả theo refId: refId khác không nhả được', async () => {
      await store.acquireOperationLock({ chain, kind: 'WITHDRAW', refId: 'w1', actor: 'NB001' });
      expect(await store.releaseOperationLock({ chain, refId: 'khac' })).toBe(false);
      expect((await store.findOperationLock(chain))?.kind).toBe('WITHDRAW');
      expect(await store.releaseOperationLock({ chain, refId: 'w1' })).toBe(true);
      expect(await store.findOperationLock(chain)).toBeNull();
    });

    it('chỉ khoá CONFIG treo quá mốc bị tiếp quản, và chỉ bởi lần lấy CONFIG', async () => {
      const future = new Date(Date.now() + 60_000);
      await store.acquireOperationLock({ chain, kind: 'CONFIG', refId: 'c1', actor: 'A' });
      expect(await store.acquireOperationLock({ chain, kind: 'CONFIG', refId: 'c2', actor: 'B' })).toBeNull();
      expect(
        await store.acquireOperationLock({ chain, kind: 'WITHDRAW', refId: 'w1', actor: 'NB001', takeOverConfigBefore: future }),
      ).toBeNull();
      const taken = await store.acquireOperationLock({ chain, kind: 'CONFIG', refId: 'c3', actor: 'B', takeOverConfigBefore: future });
      expect(taken).toMatchObject({ kind: 'CONFIG', refId: 'c3', actor: 'B' });
      expect(await store.releaseOperationLock({ chain, refId: 'c1' })).toBe(false);
      await store.releaseOperationLock({ chain, refId: 'c3' });

      await store.acquireOperationLock({ chain, kind: 'WITHDRAW', refId: 'w2', actor: 'NB001' });
      expect(
        await store.acquireOperationLock({ chain, kind: 'CONFIG', refId: 'c4', actor: 'B', takeOverConfigBefore: future }),
      ).toBeNull();
      expect((await store.findOperationLock(chain))?.refId).toBe('w2');
    });
  });
}

vaultStoreContract('bộ nhớ', () => createMemoryVaultStore(), CHAIN);

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const DB_NAME = `bidv_be13_cfg_${process.pid}`;

describe.skipIf(!TEST_DATABASE_URL)('Postgres thật (database riêng của tệp)', () => {
  const previous = { DATABASE_URL: process.env.DATABASE_URL };
  const admin = async (sql: string) => {
    const client = new Client({ connectionString: TEST_DATABASE_URL });
    await client.connect();
    try {
      await client.query(sql);
    } finally {
      await client.end();
    }
  };
  const isolatedUrl = () => {
    const url = new URL(TEST_DATABASE_URL!);
    url.pathname = `/${DB_NAME}`;
    return url.toString();
  };

  beforeAll(async () => {
    await admin(`DROP DATABASE IF EXISTS "${DB_NAME}"`);
    await admin(`CREATE DATABASE "${DB_NAME}"`);
    process.env.DATABASE_URL = isolatedUrl();
    resetServerEnvCache();
  });

  afterAll(async () => {
    if (previous.DATABASE_URL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous.DATABASE_URL;
    resetServerEnvCache();
    await admin(`DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`);
  });

  vaultStoreContract(
    'Postgres',
    () => {
      process.env.DATABASE_URL = isolatedUrl();
      process.env.USE_MOCK_DB = 'false';
      resetServerEnvCache();
      resetStoreCache();
      return getVaultStore();
    },
    'hardhat-local',
  );
});
