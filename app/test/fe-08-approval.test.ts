import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOCK_VAULT_ADDRESS } from '@bidv/shared';
import { SAMPLE_ACCOUNTS } from '@/lib/session/channel';
import { CONFIG_KEYS, WPT_ISSUE_PRICE_VND } from '@/lib/config/issue-terms';
import type { ILedgerPort, TxResult } from '@/lib/ledger/ledger.port';

/**
 * FE-08: Kiểm soát viên duyệt con số kỳ rồi hệ thống mới chia, trên chain `mock` (vault mock của
 * BE-13). Ca 1, 3, 4, 5, 6, 7 (bộ nhớ), 9, 10, 11, 12. Ca 2, 4, 5, 7, 8 trên nút Hardhat thật ở
 * `fe-08-approval-evm.test.ts`.
 *
 * Mọi ca về tiền đối chiếu SỐ DƯ THẬT trên chuỗi mock (`paymentBalanceOf`) và số lần gửi giao dịch
 * (vỏ bọc dưới), không chỉ đối chiếu sổ.
 */

const hook = vi.hoisted(() => ({
  openCalls: 0,
  batchCalls: 0,
  vaultCloseCalls: 0,
  /** Chạy ngay trước khi gửi `openDistribution`: chen tiền vào quỹ trong lúc mở kỳ (ca 4). */
  beforeOpen: null as null | (() => Promise<void>),
  /**
   * Giao dịch chốt kỳ vault TREO: trả mã giao dịch mà chưa vào khối (chưa đổi trạng thái vault, chưa
   * có sự kiện), biên nhận còn `PENDING`. `mineDeferred` của ca kiểm cho nó vào khối sau.
   */
  deferVaultClose: false,
  deferred: null as null | { ref: bigint; amount: bigint; txHash: string; mined: boolean },
}));

vi.mock('@/lib/ledger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ledger')>();
  return {
    ...actual,
    getLedger: (...args: Parameters<typeof actual.getLedger>): ILedgerPort => {
      const real = actual.getLedger(...args);
      return new Proxy(real, {
        get(target, prop, receiver) {
          if (prop === 'openDistribution') {
            return async (periodKey: string): Promise<TxResult> => {
              hook.openCalls += 1;
              if (hook.beforeOpen) await hook.beforeOpen();
              return target.openDistribution(periodKey);
            };
          }
          if (prop === 'distributeBatch') {
            return async (id: number, wallets: readonly string[]): Promise<TxResult> => {
              hook.batchCalls += 1;
              return target.distributeBatch(id, wallets);
            };
          }
          if (prop === 'closeVaultPeriod') {
            return async (ref: bigint, amount: bigint): Promise<TxResult> => {
              hook.vaultCloseCalls += 1;
              if (hook.deferVaultClose) {
                hook.deferred = { ref, amount, txHash: `0x${'d'.repeat(64)}`, mined: false };
                return { txHash: hook.deferred.txHash, status: 'PENDING' };
              }
              return target.closeVaultPeriod(ref, amount);
            };
          }
          if (prop === 'waitReceipt') {
            return async (txHash: string, timeoutMs?: number): Promise<TxResult> => {
              if (hook.deferred?.txHash === txHash) {
                return { txHash, status: hook.deferred.mined ? 'CONFIRMED' : 'PENDING' };
              }
              return target.waitReceipt(txHash, timeoutMs);
            };
          }
          return Reflect.get(target, prop, receiver);
        },
      });
    },
  };
});

const { resetServerEnvCache } = await import('@/lib/config/env');
const { resetMockLedger, seedMockLedger } = await import('@/lib/ledger/mock.adapter');
const { getLedger } = await import('@/lib/ledger');
const { getConfigStore, getDistributionStore, getKeeperStore, getOrderStore, getStore, resetMemoryStore, resetStoreCache } =
  await import('@/lib/store');
const approval = await import('@/lib/bank/distribution-approval.service');
const { openPeriod, distributePeriod } = await import('@/lib/bank/distribution.service');
const { runDistributionCycle, DISTRIBUTION_JOB_NAME } = await import('@/lib/bank/distribution-trigger.service');
const { expireStaleOrders } = await import('@/lib/bank/purchase.service');
const actions = await import('@/app/actions/distribution');

const CHAIN = 'mock';
const INVESTOR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const LATE = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
const PRICE = BigInt(WPT_ISSUE_PRICE_VND);
const KSV = SAMPLE_ACCOUNTS.controller;
const START = new Date('2026-10-21T23:59:00Z');

function actAs(role: string, actor?: string) {
  process.env.DEMO_ROLE = role;
  if (actor) process.env.DEMO_ACTOR = actor;
  else delete process.env.DEMO_ACTOR;
  resetServerEnvCache();
}

let orderSeq = 0;
const nextOrderId = () => `00000000-0000-4000-8000-${(++orderSeq).toString(16).padStart(12, '0')}`;

/**
 * Bảng OP-05 trên mock: Mint đầu 1.000.000 WPT vào vault, nhà đầu tư mua 100 rồi bán 40 (còn 60),
 * vault khoá PERCENT 20%. Quỹ chia nhận 1.000.000 VNDB.
 */
async function seedOp05() {
  const ledger = getLedger(CHAIN);
  await ledger.whitelist(INVESTOR);
  await ledger.mintInitialSupply(MOCK_VAULT_ADDRESS, 1_000_000n);
  await seedMockLedger({
    paymentBalances: { [INVESTOR]: 1_000_000_000n },
    paymentAllowances: { [INVESTOR]: 1_000_000_000n },
  });
  await ledger.executePurchase({ orderId: nextOrderId(), investor: INVESTOR, wptAmount: 100n, vndAmount: 100n * PRICE });
  await ledger.executeSale({ orderId: nextOrderId(), investor: INVESTOR, wptAmount: 40n, vndAmount: 40n * PRICE });
  await getOrderStore().createOrder({
    chain: CHAIN,
    investorWallet: INVESTOR,
    wptAmount: '100',
    vndAmount: (100n * PRICE).toString(),
    actorRole: 'INVESTOR',
    status: 'COMPLETED',
  });
  await ledger.setVaultPercentRate(2_000n);
  await ledger.setVaultLockMode('PERCENT');
  await seedMockLedger({ profitPool: 1_000_000n });
  return ledger;
}

async function approveAs(expectedAmount: string, actor = KSV) {
  actAs('CONTROLLER', actor);
  return approval.approveDistribution({ chain: CHAIN, expectedAmount });
}

async function approveOk(expectedAmount: string) {
  const result = await approveAs(expectedAmount);
  expect(result.ok, result.ok ? '' : result.error).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

async function balances(ledger: ILedgerPort) {
  return {
    investor: await ledger.paymentBalanceOf(INVESTOR),
    vault: await ledger.paymentBalanceOf(MOCK_VAULT_ADDRESS),
    pool: await ledger.profitPoolBalance(),
  };
}

async function setBatchLimits(size: number, max: number) {
  for (const [key, value] of [
    [CONFIG_KEYS.distributionBatchSize, size],
    [CONFIG_KEYS.distributionMaxBatchesPerRun, max],
  ] as const) {
    await getConfigStore().setConfig({ key, value: String(value), type: 'number', changedBy: 'TELLER' });
  }
}

const approveAudit = async () =>
  (await getStore().listAudit({ limit: 500 })).filter((row) => row.action === 'distribution:approve');

beforeEach(() => {
  Object.assign(hook, {
    openCalls: 0,
    batchCalls: 0,
    vaultCloseCalls: 0,
    beforeOpen: null,
    deferVaultClose: false,
    deferred: null,
  });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(START);
  resetMockLedger();
  resetMemoryStore();
  resetStoreCache();
  process.env.USE_MOCK_DB = 'true';
  actAs('TELLER');
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

// ===========================================================================
//  CA 12 (mock) và một phần ca 2: duyệt đúng số, vault DONE, chia đủ
// ===========================================================================
describe('FE-08 ca 12: mock cho cùng số với bảng OP-05', () => {
  it('duyệt 1.000.000: APPROVED, vault DONE, DISTRIBUTED; nhà đầu tư nhận 60, vault 999.940, percentLocked 200.000', async () => {
    const ledger = await seedOp05();
    const before = await balances(ledger);

    const result = await approveOk('1000000');

    expect(result.outcome).toBe('DISTRIBUTED');
    expect(result.period).toMatchObject({
      approvalStatus: 'APPROVED',
      expectedAmount: '1000000',
      approvedAmount: '1000000',
      totalAmount: '1000000',
      approvedBy: KSV,
      vaultCloseStatus: 'DONE',
      status: 'COMPLETED',
      reapprovedFrom: null,
      active: false,
    });
    expect(result.period.approvedAt).toBe(START.toISOString());
    const after = await balances(ledger);
    expect(after.investor - before.investor).toBe(60n);
    expect(after.vault - before.vault).toBe(999_940n);
    expect((await ledger.vaultStatus())!.percentLocked).toBe(200_000n);
    expect(hook).toMatchObject({ openCalls: 1, vaultCloseCalls: 1 });

    const runs = await getKeeperStore().listRuns({ jobName: DISTRIBUTION_JOB_NAME, limit: 10 });
    expect(runs.map((run) => run.triggerSource)).toEqual(['MANUAL']);
  });
});

// ===========================================================================
//  CA 1: quyền
// ===========================================================================
describe('FE-08 ca 1: chỉ CONTROLLER duyệt, duyệt lại, tiếp tục; hai vai vận hành đọc được', () => {
  it.each(['TELLER', 'SELLER', 'INVESTOR', 'UNKNOWN_ROLE'])('vai %s: FORBIDDEN cả ba hành động, không gửi gì', async (role) => {
    await seedOp05();
    actAs(role);
    const periodId = '00000000-0000-4000-8000-000000000999';

    const results = [
      await approval.approveDistribution({ chain: CHAIN, expectedAmount: '1000000' }),
      await approval.reapproveDistribution({ chain: CHAIN, periodId, amount: '1000000' }),
      await approval.continueDistribution({ chain: CHAIN, periodId }),
    ];

    // Vai lạ trong cookie hay env quy về vai mặc định TELLER (`currentRole`), nên cũng bị chặn.
    for (const result of results) expect(!result.ok && result.code).toBe('FORBIDDEN');
    expect(hook).toMatchObject({ openCalls: 0, batchCalls: 0, vaultCloseCalls: 0 });
    expect(await getDistributionStore().listPeriods({ limit: 10 })).toHaveLength(0);
    expect((await approveAudit()).filter((row) => row.outcome === 'DENIED')).toHaveLength(3);
  });

  it('bốn action cũ không còn trong actions/distribution.ts; action mới có mặt', () => {
    for (const name of ['openPeriodAction', 'distributePeriodAction', 'runDistributionCycleAction', 'previewDistributionAction']) {
      expect(name in actions, name).toBe(false);
    }
    for (const name of [
      'approveDistributionAction',
      'reapproveDistributionAction',
      'continueDistributionAction',
      'getDistributionOverviewAction',
      'listDistributionPeriodsAction',
      'listDistributionPayoutsAction',
      'listDistributionRunsAction',
    ]) {
      expect(typeof (actions as Record<string, unknown>)[name], name).toBe('function');
    }
  });

  it.each(['TELLER', 'CONTROLLER'])('vai %s đọc được tổng quan, danh sách kỳ, hồ sơ, lịch chạy', async (role) => {
    await seedOp05();
    const done = await approveOk('1000000');
    actAs(role);

    const overview = await actions.getDistributionOverviewAction({ chain: CHAIN });
    const periods = await actions.listDistributionPeriodsAction({ chain: CHAIN });
    const payouts = await actions.listDistributionPayoutsAction({ chain: CHAIN, periodId: done.period.id });
    const runs = await actions.listDistributionRunsAction({ limit: 10 });

    for (const result of [overview, periods, payouts, runs]) expect(result.ok, result.ok ? '' : result.error).toBe(true);
    expect(overview.ok && overview.data.viewerCanApprove).toBe(role === 'CONTROLLER');
  });

  it.each(['SELLER', 'INVESTOR'])('vai %s không đọc được màn chia', async (role) => {
    actAs(role);
    const overview = await actions.getDistributionOverviewAction({ chain: CHAIN });
    expect(!overview.ok && overview.code).toBe('FORBIDDEN');
  });

  it('đường cũ của Giao dịch viên không chia được kỳ chưa duyệt (lõi chặn)', async () => {
    await seedOp05();
    actAs('TELLER');
    const opened = await openPeriod({ chain: CHAIN, periodKey: 'mock:cu-01' });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    const paid = await distributePeriod({ chain: CHAIN, periodId: opened.data.id });

    expect(!paid.ok && paid.error).toMatch(/chưa có lần duyệt nào/);
    expect(hook.batchCalls).toBe(0);
    expect(hook.vaultCloseCalls).toBe(0);
  });
});

// ===========================================================================
//  CA 3: số đổi trước khi duyệt
// ===========================================================================
describe('FE-08 ca 3: số trong quỹ đổi trước khi duyệt', () => {
  it('từ chối "số trong quỹ đã đổi", không gửi giao dịch, không tạo kỳ, sổ kiểm toán ghi mã người', async () => {
    await seedOp05();
    await seedMockLedger({ profitPool: 1_000_500n }); // tiền vào sau khi Kiểm soát viên xem màn

    const result = await approveAs('1000000');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Số trong quỹ đã đổi, xem lại rồi duyệt/);
    expect(hook).toMatchObject({ openCalls: 0, batchCalls: 0, vaultCloseCalls: 0 });
    expect(await getDistributionStore().listPeriods({ limit: 10 })).toHaveLength(0);
    const audit = await approveAudit();
    expect(audit.some((row) => row.outcome === 'FAILURE' && row.detail?.includes(KSV) && row.detail.includes('đã đổi'))).toBe(true);
  });

  it('dưới ngưỡng thì từ chối, không gửi gì', async () => {
    await seedOp05();
    await getConfigStore().setConfig({
      key: CONFIG_KEYS.distributionMinNewBalance,
      value: '2000000',
      type: 'bigint',
      changedBy: 'TELLER',
    });

    const result = await approveAs('1000000');

    expect(!result.ok && result.code).toBe('INSUFFICIENT_PROFIT_POOL');
    expect(hook.openCalls).toBe(0);
  });
});

// ===========================================================================
//  CA 4: số đổi trong lúc mở kỳ
// ===========================================================================
describe('FE-08 ca 4: số đổi trong lúc mở kỳ (chen tiền)', () => {
  it('AMOUNT_CHANGED, không chốt vault, không lô; duyệt lại số sai bị từ chối; đúng số thì chốt vault và chia', async () => {
    const ledger = await seedOp05();
    const before = await balances(ledger);
    hook.beforeOpen = async () => {
      await seedMockLedger({ profitPool: 1_000_100n }); // 100 VNDB vào quỹ giữa bước 3 và lúc thực thi
      hook.beforeOpen = null;
    };

    const changed = await approveOk('1000000');

    expect(changed.outcome).toBe('AMOUNT_CHANGED');
    expect(changed.period).toMatchObject({
      status: 'OPEN',
      approvalStatus: 'AMOUNT_CHANGED',
      expectedAmount: '1000000',
      totalAmount: '1000100',
      approvedAmount: null,
      vaultCloseStatus: null,
    });
    expect(hook).toMatchObject({ batchCalls: 0, vaultCloseCalls: 0 });
    const mid = await balances(ledger);
    expect([mid.investor, mid.vault]).toEqual([before.investor, before.vault]);

    // Tải lại: tổng quan đọc từ lưu trữ bền, thấy đúng AMOUNT_CHANGED và cả hai số.
    actAs('TELLER');
    const overview = await approval.getDistributionOverview({ chain: CHAIN });
    expect(overview.ok && overview.data.active).toMatchObject({
      nextAction: 'REAPPROVE',
      period: { approvalStatus: 'AMOUNT_CHANGED', expectedAmount: '1000000', totalAmount: '1000100' },
    });

    // Duyệt mới bị từ chối vì đang có kỳ hoạt động; duyệt lại số sai bị từ chối.
    expect((await approveAs('0100')).ok).toBe(false);
    const wrong = await approval.reapproveDistribution({ chain: CHAIN, periodId: changed.period.id, amount: '1000000' });
    expect(!wrong.ok && wrong.error).toMatch(/phải bằng đúng số trên chuỗi/);
    expect(hook).toMatchObject({ batchCalls: 0, vaultCloseCalls: 0, openCalls: 1 });

    actAs('CONTROLLER', 'KSV002');
    const right = await approval.reapproveDistribution({ chain: CHAIN, periodId: changed.period.id, amount: '1000100' });
    expect(right.ok, right.ok ? '' : right.error).toBe(true);
    if (!right.ok) return;
    expect(right.data.outcome).toBe('DISTRIBUTED');
    expect(right.data.period).toMatchObject({
      approvalStatus: 'APPROVED',
      approvedAmount: '1000100',
      reapprovedFrom: '1000000',
      approvedBy: 'KSV002',
      vaultCloseStatus: 'DONE',
    });
    expect(hook.vaultCloseCalls).toBe(1);
    const after = await balances(ledger);
    expect(after.investor - before.investor).toBe(60n); // floor(1.000.100 × 60 / 1.000.000)
    expect((await ledger.vaultStatus())!.lastDistributedPrev).toBe(1_000_100n);

    const history = await approval.listDistributionPeriods({ chain: CHAIN });
    expect(history.ok && history.data.rows[0]).toMatchObject({
      period: { reapprovedFrom: '1000000', approvedAmount: '1000100', approvedBy: 'KSV002' },
      triggerSources: ['MANUAL'],
    });
  });
});

// ===========================================================================
//  CA 5: chốt vault chưa xong thì không trả
// ===========================================================================
describe('FE-08 ca 5: vault PENDING, SENT, CONFLICT không có lô nào', () => {
  it('PENDING: không lô, số dư không đổi; tiếp tục thì chốt rồi chia', async () => {
    const ledger = await seedOp05();
    const before = await balances(ledger);
    const store = getDistributionStore();
    // Mọi lần giành quyền gửi chốt trong lần duyệt này đều thua (tiến trình khác đang giữ).
    vi.spyOn(store, 'transitionVaultClose').mockImplementation(async () => null);

    const pending = await approveOk('1000000');

    expect(pending.outcome).toBe('VAULT_PENDING');
    expect(pending.period.vaultCloseStatus).toBe('PENDING');
    expect(hook).toMatchObject({ batchCalls: 0, vaultCloseCalls: 0 });
    expect((await balances(ledger)).investor).toBe(before.investor);
    vi.restoreAllMocks();

    const resumed = await approval.continueDistribution({ chain: CHAIN, periodId: pending.period.id });
    expect(resumed.ok && resumed.data.outcome).toBe('DISTRIBUTED');
    expect(hook.vaultCloseCalls).toBe(1);
  });

  it('SENT: không lô; đối soát xong thì tiếp tục được, không gửi chốt lần hai', async () => {
    const ledger = await seedOp05();
    const before = await balances(ledger);
    hook.deferVaultClose = true; // giao dịch chốt đã gửi, chưa vào khối

    const sent = await approveOk('1000000');

    expect(sent.outcome).toBe('VAULT_PENDING');
    expect(sent.period.vaultCloseStatus).toBe('SENT');
    expect(hook).toMatchObject({ batchCalls: 0, vaultCloseCalls: 1 });
    expect((await balances(ledger)).investor).toBe(before.investor);

    actAs('TELLER');
    const overview = await approval.getDistributionOverview({ chain: CHAIN });
    expect(overview.ok && overview.data.active).toMatchObject({ pendingOnChain: true, nextAction: 'CONTINUE' });

    // Tiếp tục khi giao dịch vẫn treo: vẫn không lô nào, không gửi chốt lần hai.
    actAs('CONTROLLER', KSV);
    const still = await approval.continueDistribution({ chain: CHAIN, periodId: sent.period.id });
    expect(still.ok && still.data.outcome).toBe('VAULT_PENDING');
    expect(hook).toMatchObject({ batchCalls: 0, vaultCloseCalls: 1 });

    // Giao dịch vào khối: đối soát thấy PeriodClosed khớp số, DONE, rồi chia.
    hook.deferVaultClose = false;
    await ledger.closeVaultPeriod(hook.deferred!.ref, hook.deferred!.amount);
    hook.deferred!.mined = true;
    hook.vaultCloseCalls -= 1; // lần vừa rồi là "khối đào" giao dịch treo, không phải lần gửi mới
    const resumed = await approval.continueDistribution({ chain: CHAIN, periodId: sent.period.id });
    expect(resumed.ok && resumed.data.outcome).toBe('DISTRIBUTED');
    expect(hook.vaultCloseCalls).toBe(1);
    expect((await balances(ledger)).investor - before.investor).toBe(60n);
  });

  it('CONFLICT: không lô, khoá nút ("cần xử lý tay"), tiếp tục vẫn không trả', async () => {
    const ledger = await seedOp05();
    const before = await balances(ledger);
    const store = getDistributionStore();
    vi.spyOn(store, 'transitionVaultClose').mockImplementation(async () => null);
    const pending = await approveOk('1000000');
    vi.restoreAllMocks();
    // Một script chốt đúng mã kỳ vault đã giữ chỗ với số khác.
    await ledger.closeVaultPeriod(BigInt(pending.period.vaultPeriodRef!), 999n);

    const conflict = await approval.continueDistribution({ chain: CHAIN, periodId: pending.period.id });

    expect(conflict.ok && conflict.data.outcome).toBe('VAULT_CONFLICT');
    expect(hook.batchCalls).toBe(0);
    expect((await balances(ledger)).investor).toBe(before.investor);
    actAs('TELLER');
    const overview = await approval.getDistributionOverview({ chain: CHAIN });
    expect(overview.ok && overview.data.active).toMatchObject({ nextAction: 'MANUAL_REVIEW' });
    expect(overview.ok && overview.data.active?.note).toMatch(/cần xử lý tay/);
  });
});

// ===========================================================================
//  CA 6: keeper
// ===========================================================================
describe('FE-08 ca 6: keeper chỉ tiếp tục kỳ đã duyệt', () => {
  async function cycle() {
    actAs('TELLER');
    const result = await runDistributionCycle({ chain: CHAIN });
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) throw new Error(result.error);
    vi.setSystemTime(Date.now() + 1_000); // khoá vòng rỗng theo mốc thời gian không trùng
    return result.data;
  }

  it('có tiền chưa duyệt: AWAITING_APPROVAL, không mở kỳ, không gửi gì', async () => {
    await seedOp05();
    const view = await cycle();
    expect(view.outcome).toBe('AWAITING_APPROVAL');
    expect(hook).toMatchObject({ openCalls: 0, batchCalls: 0, vaultCloseCalls: 0 });
    expect(await getDistributionStore().listPeriods({ limit: 10 })).toHaveLength(0);
  });

  it('kỳ AMOUNT_CHANGED: AWAITING_APPROVAL, không trả', async () => {
    await seedOp05();
    hook.beforeOpen = async () => {
      await seedMockLedger({ profitPool: 1_000_100n });
      hook.beforeOpen = null;
    };
    await approveOk('1000000');
    const view = await cycle();
    expect(view.outcome).toBe('AWAITING_APPROVAL');
    expect(hook).toMatchObject({ batchCalls: 0, vaultCloseCalls: 0 });
  });

  it('kỳ APPROVED còn lô: keeper tiếp tục, triggerSource KEEPER', async () => {
    const ledger = await seedOp05();
    await setBatchLimits(1, 1);
    const first = await approveOk('1000000');
    expect(first.outcome).toBe('PARTIAL');

    const view = await cycle();

    expect(view.outcome).toBe('DISTRIBUTED');
    expect(view.periodId).toBe(first.period.id);
    const runs = await getKeeperStore().listRuns({ jobName: DISTRIBUTION_JOB_NAME, limit: 10 });
    const byNo = new Map(runs.map((run) => [run.periodKey.split('#')[1], run.triggerSource]));
    expect([byNo.get('1'), byNo.get('2')]).toEqual(['MANUAL', 'KEEPER']);
    expect((await ledger.vaultStatus())!.lastPeriodRef).toBe(1n);
  });

  it('expire-orders không đổi: vẫn chạy qua route với vai mặc định', async () => {
    actAs('TELLER');
    const result = await expireStaleOrders({ chain: CHAIN });
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
  });
});

// ===========================================================================
//  CA 7 (bộ nhớ): tối đa một kỳ hoạt động mỗi chain
// ===========================================================================
describe('FE-08 ca 7: cạnh tranh trên bản bộ nhớ', () => {
  /**
   * Chặn mọi lần giữ chỗ ở một chốt hẹn: cả hai lần duyệt đều đã qua phép đọc "chưa có kỳ hoạt động"
   * rồi mới cùng ghi, nên chỉ ràng buộc `activeChain` (không phải phép đọc) quyết định.
   */
  function gateReservations(count: number) {
    const store = getDistributionStore();
    const original = store.reservePeriod.bind(store);
    const keys: string[] = [];
    let release!: () => void;
    let firstArrived!: () => void;
    const all = new Promise<void>((resolve) => (release = resolve));
    const first = new Promise<void>((resolve) => (firstArrived = resolve));
    vi.spyOn(store, 'reservePeriod').mockImplementation(async (input) => {
      keys.push(input.periodKey);
      if (keys.length === 1) firstArrived();
      if (keys.length >= count) release();
      await all;
      return original(input);
    });
    return { keys, first };
  }

  it('hai lần duyệt sinh hai mã kỳ khác ngày UTC: chỉ một kỳ hoạt động, không ai nhận hai lần', async () => {
    const ledger = await seedOp05();
    const before = await balances(ledger);
    const gate = gateReservations(2);

    actAs('CONTROLLER', 'KSV001');
    const a = approval.approveDistribution({ chain: CHAIN, expectedAmount: '1000000' });
    await gate.first;
    vi.setSystemTime(new Date('2026-10-22T00:00:30Z')); // qua ranh giới ngày UTC
    actAs('CONTROLLER', 'KSV002');
    const b = approval.approveDistribution({ chain: CHAIN, expectedAmount: '1000000' });
    const results = await Promise.all([a, b]);

    expect(gate.keys).toEqual(['mock:2026-10-21-01', 'mock:2026-10-22-01']);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const lost = results.find((result) => !result.ok);
    expect(lost && !lost.ok && lost.error).toMatch(/Đang có kỳ hoạt động/);
    expect(await getDistributionStore().listPeriods({ limit: 10 })).toHaveLength(1);
    expect(hook.openCalls).toBe(1);
    expect((await balances(ledger)).investor - before.investor).toBe(60n);
  });

  it('hai Kiểm soát viên duyệt cùng lúc với hai số khác nhau: số sai bị từ chối, một kỳ', async () => {
    await seedOp05();
    actAs('CONTROLLER', 'KSV001');
    const a = approval.approveDistribution({ chain: CHAIN, expectedAmount: '1000000' });
    actAs('CONTROLLER', 'KSV002');
    const b = approval.approveDistribution({ chain: CHAIN, expectedAmount: '999999' });
    const [ra, rb] = await Promise.all([a, b]);

    expect(ra.ok).toBe(true);
    expect(!rb.ok && rb.error).toMatch(/đã đổi/);
    expect(await getDistributionStore().listPeriods({ limit: 10 })).toHaveLength(1);
  });

  it('Kiểm soát viên duyệt đồng thời với keeper: một kỳ, không ai nhận hai lần', async () => {
    const ledger = await seedOp05();
    const before = await balances(ledger);
    actAs('CONTROLLER', KSV);
    const a = approval.approveDistribution({ chain: CHAIN, expectedAmount: '1000000' });
    actAs('TELLER');
    const k = runDistributionCycle({ chain: CHAIN });
    const [ra, rk] = await Promise.all([a, k]);

    expect(ra.ok, ra.ok ? '' : ra.error).toBe(true);
    expect(rk.ok).toBe(true);
    expect(await getDistributionStore().listPeriods({ limit: 10 })).toHaveLength(1);
    expect((await balances(ledger)).investor - before.investor).toBe(60n);
    expect(hook.vaultCloseCalls).toBe(1);
  });
});

// ===========================================================================
//  CA 9: kỳ cũ chưa duyệt
// ===========================================================================
describe('FE-08 ca 9: kỳ hoạt động tạo trước FE-08 (approvalStatus null)', () => {
  it('không được trả bởi keeper, tiếp tục hay đường cũ cho tới khi duyệt lại số trên chuỗi', async () => {
    const ledger = await seedOp05();
    actAs('TELLER');
    const legacy = await openPeriod({ chain: CHAIN, periodKey: 'mock:2026-Q3' }); // kỳ mở bằng đường cũ
    expect(legacy.ok).toBe(true);
    if (!legacy.ok) return;
    expect(legacy.data).toMatchObject({ approvalStatus: null, expectedAmount: null });

    expect((await runDistributionCycle({ chain: CHAIN })).ok && hook.batchCalls).toBe(0);
    actAs('CONTROLLER', KSV);
    const cont = await approval.continueDistribution({ chain: CHAIN, periodId: legacy.data.id });
    expect(!cont.ok && cont.error).toMatch(/chưa được duyệt đúng số/);
    expect(hook).toMatchObject({ batchCalls: 0, vaultCloseCalls: 0 });

    const re = await approval.reapproveDistribution({ chain: CHAIN, periodId: legacy.data.id, amount: '1000000' });
    expect(re.ok && re.data.outcome).toBe('DISTRIBUTED');
    expect(re.ok && re.data.period).toMatchObject({ approvalStatus: 'APPROVED', reapprovedFrom: null, approvedBy: KSV });
    expect(await ledger.paymentBalanceOf(INVESTOR)).toBeGreaterThan(0n);
  });
});

// ===========================================================================
//  CA 10: đọc
// ===========================================================================
describe('FE-08 ca 10: API đọc', () => {
  it('dự kiến bằng shareOf trên số dư hiện tại, có ví được 0; danh sách bị cắt thì khoá', async () => {
    await seedOp05();
    await getOrderStore().createOrder({
      chain: CHAIN,
      investorWallet: LATE,
      wptAmount: '0',
      vndAmount: '0',
      actorRole: 'INVESTOR',
      status: 'COMPLETED',
    });
    actAs('TELLER');

    const overview = await approval.getDistributionOverview({ chain: CHAIN });

    expect(overview.ok, overview.ok ? '' : overview.error).toBe(true);
    if (!overview.ok) return;
    const byWallet = new Map(overview.data.forecast!.rows.map((row) => [row.wallet.toLowerCase(), row]));
    expect(byWallet.get(INVESTOR.toLowerCase())).toMatchObject({ balance: '60', share: '60', isVault: false });
    expect(byWallet.get(MOCK_VAULT_ADDRESS.toLowerCase())).toMatchObject({ balance: '999940', share: '999940', isVault: true });
    expect(byWallet.get(LATE.toLowerCase())).toMatchObject({ balance: '0', share: '0' });
    expect(overview.data).toMatchObject({
      supported: true,
      pool: { unallocatedBalance: '1000000', poolBalance: '1000000', reservedBalance: '0' },
      viewerCanApprove: false,
      approveBlockers: [],
      forecast: { allocated: '1000000', dust: '0', truncated: false, totalSupply: '1000000' },
    });

    const recipients = await import('@/lib/bank/distribution.service');
    vi.spyOn(getOrderStore(), 'listOrders').mockResolvedValue(
      Array.from({ length: recipients.MAX_RECIPIENT_SCAN }, () => ({ investorWallet: INVESTOR })) as never,
    );
    const truncated = await approval.getDistributionOverview({ chain: CHAIN });
    expect(truncated.ok && truncated.data.forecast?.truncated).toBe(true);
    expect(truncated.ok && truncated.data.approveBlockers.join(' ')).toMatch(/không đầy đủ/);
  });

  it('danh sách hồ sơ phân trang không thiếu ví, gồm ví được 0; lịch sử đúng người duyệt, số, nguồn', async () => {
    await seedOp05();
    for (const wallet of ['0x1111111111111111111111111111111111111111', '0x2222222222222222222222222222222222222222', LATE]) {
      await getOrderStore().createOrder({
        chain: CHAIN,
        investorWallet: wallet,
        wptAmount: '0',
        vndAmount: '0',
        actorRole: 'INVESTOR',
        status: 'COMPLETED',
      });
    }
    const done = await approveOk('1000000');
    actAs('TELLER');

    const seen: string[] = [];
    let total = 0;
    for (let page = 1; page <= 3; page += 1) {
      const result = await approval.listDistributionPayouts({ chain: CHAIN, periodId: done.period.id, page, pageSize: 2 });
      expect(result.ok, result.ok ? '' : result.error).toBe(true);
      if (!result.ok) return;
      total = result.data.total;
      seen.push(...result.data.rows.map((row) => row.investorWallet.toLowerCase()));
    }
    expect(total).toBe(5); // nhà đầu tư, vault, ba ví được 0
    expect(new Set(seen).size).toBe(5);
    expect(seen).toContain(LATE.toLowerCase());

    const history = await approval.listDistributionPeriods({ chain: CHAIN, page: 1, pageSize: 10 });
    expect(history.ok && history.data).toMatchObject({
      total: 1,
      rows: [
        {
          triggerSources: ['MANUAL'],
          runCount: 1,
          period: { approvedBy: KSV, expectedAmount: '1000000', approvedAmount: '1000000', totalAmount: '1000000' },
        },
      ],
    });
    const runs = await approval.listDistributionPeriods({ chain: CHAIN, page: 2, pageSize: 10 });
    expect(runs.ok && runs.data.rows).toEqual([]);
  });
});

// ===========================================================================
//  CA 11: chain không vault
// ===========================================================================
describe('FE-08 ca 11: chain không có vault (stellar)', () => {
  it('nút duyệt bị vô hiệu (lý do trên tổng quan) và service từ chối, không gửi gì', async () => {
    const stellarLedger = (await import('@/lib/ledger')).getLedger('stellar');
    expect(await stellarLedger.vaultStatus()).toBeNull();

    actAs('CONTROLLER', KSV);
    const result = await approval.approveDistribution({ chain: 'stellar', expectedAmount: '1000000' });

    expect(!result.ok && result.error).toMatch(/không hỗ trợ luồng chia đã duyệt/);
    expect(hook.openCalls).toBe(0);
    const overview = await approval.getDistributionOverview({ chain: 'stellar' });
    expect(overview.ok && overview.data).toMatchObject({ supported: false, pool: null, forecast: null, active: null });
    expect(overview.ok && overview.data.approveBlockers.join(' ')).toMatch(/không hỗ trợ luồng chia đã duyệt/);
    const audit = await approveAudit();
    expect(audit.some((row) => row.outcome === 'FAILURE' && row.chain === 'stellar')).toBe(true);
  });
});
