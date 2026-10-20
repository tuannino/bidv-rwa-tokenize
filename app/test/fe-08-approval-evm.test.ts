import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account, Hex } from 'viem';
import { SAMPLE_WALLETS, getContractAddress } from '@bidv/shared';
import { CONFIG_KEYS } from '@/lib/config/issue-terms';
import type { ILedgerPort, TxResult } from '@/lib/ledger/ledger.port';
import type { ISigner } from '@/lib/signer';
import { placeSignedOrder } from './helpers/permit-signer';

/**
 * FE-08 trên nút Hardhat THẬT (`TEST_HARDHAT_RPC`, nút vừa dựng lại bằng `scripts/evm-local.sh
 * reset`): ca 2 (bảng OP-05), 4 (số đổi trong lúc mở kỳ), 5 (vault PENDING, SENT, CONFLICT), 7
 * (cạnh tranh), 8 (tiếp tục, dừng ở từng khoảng hở). Chạy riêng một lệnh: ca 2 cần vault mới triển
 * khai để số khoá đúng bảng.
 *
 * Mọi giao dịch đi qua adapter EVM thật; vỏ bọc `@/lib/ledger` chỉ đếm số lần gửi và chen lỗi khi
 * một ca bật cờ.
 */

const hook = vi.hoisted(() => ({
  openCalls: 0,
  batchCalls: 0,
  vaultCloseCalls: 0,
  beforeOpen: null as null | (() => Promise<void>),
  /** Giao dịch chốt vault treo: trả mã giả, chưa gửi; `mined` khi ca kiểm cho vào khối. */
  deferVaultClose: false,
  deferred: null as null | { ref: bigint; amount: bigint; txHash: string; mined: boolean },
  /**
   * Tiến trình "chết" ngay sau khi gửi giao dịch chốt vault hoặc gửi một lô: từ lúc đó mọi lời gọi
   * chuỗi đều thất bại (`dead`) cho tới khi ca kiểm "khởi động lại" bằng cách hạ cờ.
   */
  dieAfter: null as null | 'vaultClose' | 'batch',
  dead: false,
}));

vi.mock('@/lib/ledger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ledger')>();
  return {
    ...actual,
    getLedger: (...args: Parameters<typeof actual.getLedger>): ILedgerPort => {
      const real = actual.getLedger(...args);
      return new Proxy(real, {
        get(target, prop, receiver) {
          const value = Reflect.get(target, prop, receiver);
          if (hook.dead && typeof value === 'function') {
            return async () => {
              throw new Error('tiến trình đã dừng');
            };
          }
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
              const tx = await target.distributeBatch(id, wallets);
              if (hook.dieAfter === 'batch') hook.dead = true;
              return tx;
            };
          }
          if (prop === 'closeVaultPeriod') {
            return async (ref: bigint, amount: bigint): Promise<TxResult> => {
              hook.vaultCloseCalls += 1;
              if (hook.deferVaultClose) {
                hook.deferred = { ref, amount, txHash: `0x${'d'.repeat(64)}`, mined: false };
                return { txHash: hook.deferred.txHash, status: 'PENDING' };
              }
              const tx = await target.closeVaultPeriod(ref, amount);
              if (hook.dieAfter === 'vaultClose') hook.dead = true;
              return tx;
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

const HARDHAT_RPC = process.env.TEST_HARDHAT_RPC;
const CHAIN = 'hardhat-local' as const;
const ADMIN = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as const;
const ADMIN_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const INVESTOR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Hex;
const PAYOUT = SAMPLE_WALLETS.NB001;
const VAULT = getContractAddress(CHAIN, 'SpvPaymentVault');
const DISTRIBUTOR = getContractAddress(CHAIN, 'ProfitDistributor');

const signer: ISigner = {
  kind: 'server',
  async getAddress() {
    return ADMIN;
  },
  async getAccount() {
    return { address: ADMIN, type: 'json-rpc' } as Account;
  },
};

const live = HARDHAT_RPC ? describe.sequential : describe.skip;

live('FE-08 trên nút Hardhat thật', () => {
  const keys = ['RPC_HARDHAT', 'SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL', 'USE_MOCK_DB', 'DEMO_ROLE', 'DEMO_ACTOR'] as const;
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  let direct: ILedgerPort;
  let approval: typeof import('@/lib/bank/distribution-approval.service');
  let trigger: typeof import('@/lib/bank/distribution-trigger.service');
  let store: typeof import('@/lib/store');
  let resetServerEnvCache: () => void;

  function actAs(role: 'CONTROLLER' | 'TELLER' | 'INVESTOR', actor?: string) {
    process.env.DEMO_ROLE = role;
    if (actor) process.env.DEMO_ACTOR = actor;
    else delete process.env.DEMO_ACTOR;
    resetServerEnvCache();
  }

  async function confirmed(pending: Promise<TxResult>) {
    const tx = await pending;
    const receipt = await direct.waitReceipt(tx.txHash);
    expect(receipt.status, receipt.reason).toBe('CONFIRMED');
  }

  async function fund(amount: bigint) {
    await confirmed(direct.mintPayment(DISTRIBUTOR, amount));
    return direct.unallocatedProfit();
  }

  async function approveAs(expected: bigint, actor = 'KSV001') {
    actAs('CONTROLLER', actor);
    return approval.approveDistribution({ chain: CHAIN, expectedAmount: expected.toString() });
  }

  async function continueAs(periodId: string) {
    actAs('CONTROLLER', 'KSV001');
    return approval.continueDistribution({ chain: CHAIN, periodId });
  }

  async function setBatchLimits(size: number, max: number) {
    for (const [key, value] of [
      [CONFIG_KEYS.distributionBatchSize, size],
      [CONFIG_KEYS.distributionMaxBatchesPerRun, max],
    ] as const) {
      await store.getConfigStore().setConfig({ key, value: String(value), type: 'number', changedBy: 'TELLER' });
    }
  }

  const investorVndb = () => direct.paymentBalanceOf(INVESTOR);
  const vaultVndb = () => direct.paymentBalanceOf(VAULT);

  beforeAll(async () => {
    process.env.RPC_HARDHAT = HARDHAT_RPC;
    process.env.SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL = ADMIN_KEY;
    process.env.USE_MOCK_DB = 'true';
    const env = await import('@/lib/config/env');
    resetServerEnvCache = env.resetServerEnvCache;
    const { resetChainRegistryCache } = await import('@/lib/chains/registry');
    const { resetSignerCache } = await import('@/lib/signer');
    const { createEvmLedger } = await import('@/lib/ledger/evm.adapter');
    store = await import('@/lib/store');
    resetServerEnvCache();
    resetChainRegistryCache();
    resetSignerCache();
    store.resetMemoryStore();
    store.resetStoreCache();
    approval = await import('@/lib/bank/distribution-approval.service');
    trigger = await import('@/lib/bank/distribution-trigger.service');
    direct = createEvmLedger(CHAIN, signer);

    // Bảng OP-05: Mint đầu 1.000.000 WPT vào vault, vault khoá PERCENT 20%, mua 100 rồi bán 40.
    for (const wallet of [INVESTOR, PAYOUT]) await confirmed(direct.whitelist(wallet));
    await confirmed(direct.mintInitialSupply(VAULT, 1_000_000n));
    await confirmed(direct.mintPayment(INVESTOR, 2_000_000_000n));
    const { saveVaultConfig } = await import('@/lib/bank/vault.service');
    actAs('CONTROLLER', 'KSV001');
    const saved = await saveVaultConfig({ chain: CHAIN, percent: '20', fixedLock: '', payoutWallet: PAYOUT });
    expect(saved.ok, saved.ok ? '' : saved.error).toBe(true);
    actAs('INVESTOR', 'NDT001');
    for (const [side, wptAmount] of [['BUY', '100'], ['SELL', '40']] as const) {
      const { result } = await placeSignedOrder(HARDHAT_RPC!, { investorWallet: INVESTOR, side, wptAmount });
      expect(result.ok && result.data.status, result.ok ? '' : result.error).toBe('COMPLETED');
    }
    expect(await direct.balanceOf(INVESTOR)).toBe(60n);
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    Object.assign(hook, {
      openCalls: 0,
      batchCalls: 0,
      vaultCloseCalls: 0,
      beforeOpen: null,
      deferVaultClose: false,
      deferred: null,
      dieAfter: null,
      dead: false,
    });
  });

  afterAll(async () => {
    vi.useRealTimers();
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
    resetServerEnvCache();
  });

  it('ca 2: duyệt 1.000.000: APPROVED, vault DONE, DISTRIBUTED; nhà đầu tư nhận 60, vault 999.940, percentLocked 200.000', async () => {
    await setBatchLimits(50, 10);
    expect(await fund(1_000_000n)).toBe(1_000_000n);
    const before = { investor: await investorVndb(), vault: await vaultVndb() };

    const result = await approveAs(1_000_000n);

    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.data.outcome).toBe('DISTRIBUTED');
    expect(result.data.period).toMatchObject({
      approvalStatus: 'APPROVED',
      approvedAmount: '1000000',
      approvedBy: 'KSV001',
      vaultCloseStatus: 'DONE',
      status: 'COMPLETED',
    });
    expect(result.data.period.approvedAt).not.toBeNull();
    expect((await investorVndb()) - before.investor).toBe(60n);
    expect((await vaultVndb()) - before.vault).toBe(999_940n);
    expect((await direct.vaultStatus())!.percentLocked).toBe(200_000n);
    expect(hook).toMatchObject({ openCalls: 1, vaultCloseCalls: 1 });
  });

  it('ca 4: tiền vào quỹ trong lúc mở kỳ: AMOUNT_CHANGED, không chốt vault, không lô; duyệt lại số sai bị từ chối, đúng số thì chia', async () => {
    const expected = await fund(500_000n);
    const vaultRef = (await direct.vaultStatus())!.lastPeriodRef;
    const before = { investor: await investorVndb(), vault: await vaultVndb() };
    hook.beforeOpen = async () => {
      hook.beforeOpen = null;
      await confirmed(direct.mintPayment(DISTRIBUTOR, 100n));
    };

    const changed = await approveAs(expected);

    expect(changed.ok && changed.data.outcome).toBe('AMOUNT_CHANGED');
    if (!changed.ok) return;
    expect(changed.data.period).toMatchObject({
      approvalStatus: 'AMOUNT_CHANGED',
      expectedAmount: expected.toString(),
      totalAmount: (expected + 100n).toString(),
      vaultCloseStatus: null,
    });
    expect(hook).toMatchObject({ batchCalls: 0, vaultCloseCalls: 0 });
    expect((await direct.vaultStatus())!.lastPeriodRef).toBe(vaultRef);
    expect([await investorVndb(), await vaultVndb()]).toEqual([before.investor, before.vault]);

    // Tải lại (đọc lưu trữ bền): vẫn AMOUNT_CHANGED và hai số.
    actAs('TELLER');
    const overview = await approval.getDistributionOverview({ chain: CHAIN });
    expect(overview.ok && overview.data.active?.period).toMatchObject({
      approvalStatus: 'AMOUNT_CHANGED',
      expectedAmount: expected.toString(),
      totalAmount: (expected + 100n).toString(),
    });

    actAs('CONTROLLER', 'KSV002');
    const wrong = await approval.reapproveDistribution({ chain: CHAIN, periodId: changed.data.period.id, amount: expected.toString() });
    expect(wrong.ok).toBe(false);
    expect(hook.batchCalls).toBe(0);

    const right = await approval.reapproveDistribution({
      chain: CHAIN,
      periodId: changed.data.period.id,
      amount: (expected + 100n).toString(),
    });
    expect(right.ok, right.ok ? '' : right.error).toBe(true);
    if (!right.ok) return;
    expect(right.data).toMatchObject({
      outcome: 'DISTRIBUTED',
      period: { reapprovedFrom: expected.toString(), approvedBy: 'KSV002', vaultCloseStatus: 'DONE' },
    });
    expect((await direct.vaultStatus())!.lastDistributedPrev).toBe(expected + 100n);
    expect(await investorVndb()).toBeGreaterThan(before.investor);

    actAs('TELLER');
    const history = await approval.listDistributionPeriods({ chain: CHAIN });
    expect(history.ok && history.data.rows[0].period.reapprovedFrom).toBe(expected.toString());
  });

  it('ca 5 PENDING: không có distributeTo, số dư không đổi; tiếp tục thì chốt rồi chia', async () => {
    const expected = await fund(300_000n);
    const before = await investorVndb();
    vi.spyOn(store.getDistributionStore(), 'transitionVaultClose').mockImplementation(async () => null);

    const pending = await approveAs(expected);

    expect(pending.ok && pending.data.outcome).toBe('VAULT_PENDING');
    expect(pending.ok && pending.data.period.vaultCloseStatus).toBe('PENDING');
    expect(hook).toMatchObject({ batchCalls: 0, vaultCloseCalls: 0 });
    expect(await investorVndb()).toBe(before);
    vi.restoreAllMocks();

    const resumed = await continueAs(pending.ok ? pending.data.period.id : '');
    expect(resumed.ok && resumed.data.outcome).toBe('DISTRIBUTED');
    expect(hook.vaultCloseCalls).toBe(1);
  });

  it('ca 5 SENT: giao dịch chốt treo thì không có lô; vào khối thì tiếp tục được, không chốt lần hai', async () => {
    const expected = await fund(300_000n);
    const before = await investorVndb();
    const ref = (await direct.vaultStatus())!.lastPeriodRef;
    hook.deferVaultClose = true;

    const sent = await approveAs(expected);

    expect(sent.ok && sent.data.outcome).toBe('VAULT_PENDING');
    if (!sent.ok) return;
    expect(sent.data.period.vaultCloseStatus).toBe('SENT');
    expect(hook).toMatchObject({ batchCalls: 0, vaultCloseCalls: 1 });
    expect(await investorVndb()).toBe(before);

    hook.deferVaultClose = false;
    await confirmed(direct.closeVaultPeriod(hook.deferred!.ref, hook.deferred!.amount));
    hook.deferred!.mined = true;

    const resumed = await continueAs(sent.data.period.id);
    expect(resumed.ok && resumed.data.outcome).toBe('DISTRIBUTED');
    expect(hook.vaultCloseCalls).toBe(1);
    expect((await direct.vaultStatus())!.lastPeriodRef).toBe(ref + 1n);
  });

  it('ca 7: Kiểm soát viên duyệt đồng thời với keeper; hai Kiểm soát viên với hai số; hai mã khác ngày UTC: một kỳ hoạt động, không ai nhận hai lần', async () => {
    // (a) duyệt và keeper cùng lúc.
    let expected = await fund(200_000n);
    let before = await investorVndb();
    let periods = (await store.getDistributionStore().listPeriods({ chain: CHAIN, limit: 100 })).length;
    actAs('CONTROLLER', 'KSV001');
    const a = approval.approveDistribution({ chain: CHAIN, expectedAmount: expected.toString() });
    actAs('TELLER');
    const k = trigger.runDistributionCycle({ chain: CHAIN });
    const [ra, rk] = await Promise.all([a, k]);
    expect(ra.ok, ra.ok ? '' : ra.error).toBe(true);
    expect(rk.ok, rk.ok ? '' : rk.error).toBe(true);
    expect((await store.getDistributionStore().listPeriods({ chain: CHAIN, limit: 100 })).length).toBe(periods + 1);
    expect((await investorVndb()) - before).toBe((expected * 60n) / 1_000_000n);

    // (b) hai Kiểm soát viên, hai số khác nhau.
    expected = await fund(200_000n);
    before = await investorVndb();
    periods += 1;
    actAs('CONTROLLER', 'KSV001');
    const b1 = approval.approveDistribution({ chain: CHAIN, expectedAmount: expected.toString() });
    actAs('CONTROLLER', 'KSV002');
    const b2 = approval.approveDistribution({ chain: CHAIN, expectedAmount: (expected + 1n).toString() });
    const results = await Promise.all([b1, b2]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect((await store.getDistributionStore().listPeriods({ chain: CHAIN, limit: 100 })).length).toBe(periods + 1);
    expect((await investorVndb()) - before).toBe((expected * 60n) / 1_000_000n);

    // (c) hai lần duyệt cùng số, sinh hai mã kỳ khác ngày UTC: chốt hẹn ở bước giữ chỗ.
    expected = await fund(200_000n);
    before = await investorVndb();
    periods += 1;
    const distribution = store.getDistributionStore();
    const reserve = distribution.reservePeriod.bind(distribution);
    const keysSeen: string[] = [];
    let release!: () => void;
    let firstArrived!: () => void;
    const all = new Promise<void>((resolve) => (release = resolve));
    const first = new Promise<void>((resolve) => (firstArrived = resolve));
    vi.spyOn(distribution, 'reservePeriod').mockImplementation(async (input) => {
      keysSeen.push(input.periodKey);
      if (keysSeen.length === 1) firstArrived();
      if (keysSeen.length === 2) release();
      await all;
      return reserve(input);
    });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2030-01-01T23:59:58Z'));
    actAs('CONTROLLER', 'KSV001');
    const c1 = approval.approveDistribution({ chain: CHAIN, expectedAmount: expected.toString() });
    await first;
    vi.setSystemTime(new Date('2030-01-02T00:00:05Z'));
    actAs('CONTROLLER', 'KSV002');
    const c2 = approval.approveDistribution({ chain: CHAIN, expectedAmount: expected.toString() });
    const raced = await Promise.all([c1, c2]);
    vi.useRealTimers();
    vi.restoreAllMocks();

    expect(keysSeen.map((key) => key.slice(0, 'hardhat-local:2030-01-0X'.length)).sort()).toEqual([
      'hardhat-local:2030-01-01',
      'hardhat-local:2030-01-02',
    ]);
    expect(raced.filter((result) => result.ok)).toHaveLength(1);
    expect((await distribution.listPeriods({ chain: CHAIN, limit: 100 })).length).toBe(periods + 1);
    expect(await distribution.findActivePeriod(CHAIN)).toBeNull();
    expect((await investorVndb()) - before).toBe((expected * 60n) / 1_000_000n);
  });

  it('ca 8: mỗi lượt một lô: duyệt PARTIAL, duyệt mới bị từ chối, tiếp tục thì DISTRIBUTED', async () => {
    await setBatchLimits(1, 1);
    const expected = await fund(400_000n);

    const first = await approveAs(expected);
    expect(first.ok && first.data.outcome).toBe('PARTIAL');
    expect(hook.batchCalls).toBe(1);
    if (!first.ok) return;

    // Tiền mới vào quỹ trong lúc kỳ còn dở: số duyệt khớp quỹ nhưng chain đang có kỳ hoạt động.
    const more = await fund(5_000n);
    const again = await approveAs(more);
    expect(!again.ok && again.error).toMatch(/Đang có kỳ hoạt động/);

    const resumed = await continueAs(first.data.period.id);
    expect(resumed.ok && resumed.data.outcome).toBe('DISTRIBUTED');
    expect(hook.batchCalls).toBe(2);
    await setBatchLimits(50, 10);
  });

  it('ca 8: dừng tiến trình sau mở kỳ, sau gửi chốt vault, sau gửi lô; tiếp tục không gửi trùng', async () => {
    const distribution = store.getDistributionStore();

    // (1) Sau mở kỳ: giao dịch đã lên chuỗi, chưa ghi được mã giao dịch.
    let expected = await fund(100_000n);
    vi.spyOn(distribution, 'setOpenTxHash').mockRejectedValueOnce(new Error('tiến trình dừng sau khi gửi mở kỳ'));
    const died = await approveAs(expected);
    expect(died.ok).toBe(false);
    const opening = (await distribution.findActivePeriod(CHAIN))!;
    expect(opening.status).toBe('OPENING');
    vi.restoreAllMocks();
    const recovered = await continueAs(opening.id);
    expect(recovered.ok && recovered.data.outcome, recovered.ok ? '' : recovered.error).toBe('DISTRIBUTED');
    expect(hook.openCalls).toBe(1);

    // (2) Sau gửi chốt vault.
    expected = await fund(100_000n);
    let ref = (await direct.vaultStatus())!.lastPeriodRef;
    hook.dieAfter = 'vaultClose';
    const diedVault = await approveAs(expected);
    expect(diedVault.ok).toBe(false);
    const sentPeriod = (await distribution.findActivePeriod(CHAIN))!;
    expect(sentPeriod.vaultCloseStatus).toBe('SENT');
    expect((await direct.vaultStatus())!.lastPeriodRef).toBe(ref + 1n);
    Object.assign(hook, { dieAfter: null, dead: false });
    const closes = hook.vaultCloseCalls;
    const afterVault = await continueAs(sentPeriod.id);
    expect(afterVault.ok && afterVault.data.outcome).toBe('DISTRIBUTED');
    expect(hook.vaultCloseCalls).toBe(closes);
    expect((await direct.vaultStatus())!.lastPeriodRef).toBe(ref + 1n);

    // (3) Sau gửi lô.
    expected = await fund(100_000n);
    ref = (await direct.vaultStatus())!.lastPeriodRef;
    const before = await investorVndb();
    hook.dieAfter = 'batch';
    const diedBatch = await approveAs(expected);
    expect(diedBatch.ok).toBe(false);
    const batchPeriod = (await distribution.findActivePeriod(CHAIN))!;
    const sentRows = await distribution.listPayouts({ periodId: batchPeriod.id, status: 'SENT', limit: 10 });
    expect(sentRows.length).toBeGreaterThan(0);
    Object.assign(hook, { dieAfter: null, dead: false });
    const batches = hook.batchCalls;
    const afterBatch = await continueAs(batchPeriod.id);
    expect(afterBatch.ok && afterBatch.data.outcome).toBe('DISTRIBUTED');
    expect(hook.batchCalls).toBe(batches); // ví đã nhận được đối soát từ chuỗi, không gửi lại
    expect((await investorVndb()) - before).toBe((expected * 60n) / 1_000_000n);
  });

  it('ca 5 CONFLICT: script chốt mã kỳ vault với số khác: không lô, khoá nút cần xử lý tay', async () => {
    const expected = await fund(100_000n);
    const before = await investorVndb();
    vi.spyOn(store.getDistributionStore(), 'transitionVaultClose').mockImplementation(async () => null);
    const pending = await approveAs(expected);
    vi.restoreAllMocks();
    expect(pending.ok && pending.data.outcome).toBe('VAULT_PENDING');
    if (!pending.ok) return;
    await confirmed(direct.closeVaultPeriod(BigInt(pending.data.period.vaultPeriodRef!), 999n));

    const conflict = await continueAs(pending.data.period.id);

    expect(conflict.ok && conflict.data.outcome).toBe('VAULT_CONFLICT');
    expect(hook.batchCalls).toBe(0);
    expect(await investorVndb()).toBe(before);
    actAs('TELLER');
    const overview = await approval.getDistributionOverview({ chain: CHAIN });
    expect(overview.ok && overview.data.active?.nextAction).toBe('MANUAL_REVIEW');
  });
});
