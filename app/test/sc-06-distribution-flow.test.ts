import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG_KEYS, WPT_ISSUE_PRICE_VND } from '@/lib/config/issue-terms';
import type { ILedgerPort, TxResult } from '@/lib/ledger/ledger.port';

/**
 * SC-06 trên chain `mock`: mở kỳ có giữ chỗ và phục hồi (ca 15), đối soát "đã trả" (ca 17), vòng
 * đời EXPIRED/CLOSED (ca 18), BE-07 theo phần chưa phân bổ (ca 19), mã kỳ theo chain (ca 20).
 *
 * Mock mô phỏng đúng quỹ một chiều của `ProfitDistributor` (ca 13), nên các ca chạy trên adapter
 * thật; vỏ bọc dưới đây chỉ chen lỗi khi một ca bật cờ.
 */

const fault = vi.hoisted(() => ({
  openCalls: 0,
  batchCalls: 0,
  /** `findDistribution` trả `null` thêm bấy nhiêu lần (giả lập đọc chậm một nhịp). */
  hideFind: 0,
  /** Lô thứ mấy chạy THẬT trên chuỗi rồi ném lỗi như mất biên nhận. */
  batchLandsThenThrows: null as null | number,
  /** Ví đã được tra `isDistributionPaid`, theo thứ tự. */
  paidChecks: [] as string[],
}));

vi.mock('@/lib/ledger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ledger')>();
  return {
    ...actual,
    getLedger: (...args: Parameters<typeof actual.getLedger>): ILedgerPort => {
      const real = actual.getLedger(...args);
      return {
        ...real,
        async openDistribution(periodKey: string): Promise<TxResult> {
          fault.openCalls += 1;
          return real.openDistribution(periodKey);
        },
        async findDistribution(periodKey: string) {
          if (fault.hideFind > 0) {
            fault.hideFind -= 1;
            return null;
          }
          return real.findDistribution(periodKey);
        },
        async isDistributionPaid(distributionId: number, wallet: string): Promise<boolean> {
          fault.paidChecks.push(wallet.toLowerCase());
          return real.isDistributionPaid(distributionId, wallet);
        },
        async distributeBatch(distributionId: number, wallets: readonly string[]): Promise<TxResult> {
          fault.batchCalls += 1;
          const tx = await real.distributeBatch(distributionId, wallets);
          if (fault.batchLandsThenThrows === fault.batchCalls) {
            throw new actual.LedgerError(real.chain, 'distributeBatch', 'Mất kết nối RPC sau khi gửi lô.');
          }
          return tx;
        },
      };
    },
  };
});

const { resetServerEnvCache } = await import('@/lib/config/env');
const { resetMockLedger, seedMockLedger } = await import('@/lib/ledger/mock.adapter');
const { MOCK_CLAIM_WINDOW_MS } = await import('@/lib/ledger/mock-state.store');
const { getLedger } = await import('@/lib/ledger');
const { getConfigStore, getDistributionStore, getOrderStore, resetMemoryStore, resetStoreCache } =
  await import('@/lib/store');
const { distributePeriod, getDistributionPeriod, openPeriod, recoverOpeningPeriod } = await import(
  '@/lib/bank/distribution.service'
);
const { runDistributionCycle } = await import('@/lib/bank/distribution-trigger.service');
const { approveDistribution } = await import('@/lib/bank/distribution-approval.service');

const CHAIN = 'mock';
const PRICE = BigInt(WPT_ISSUE_PRICE_VND);
const A = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const B = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const START = new Date('2026-10-20T00:00:00Z');

async function seedHolder(wallet: string, wpt: bigint) {
  const ledger = getLedger(CHAIN);
  await ledger.whitelist(wallet);
  await ledger.mint(wallet, wpt);
  await getOrderStore().createOrder({
    chain: CHAIN,
    investorWallet: wallet,
    wptAmount: wpt.toString(),
    vndAmount: (wpt * PRICE).toString(),
    actorRole: 'INVESTOR',
    status: 'COMPLETED',
  });
}

/** A 60 WPT, B 40 WPT. */
async function holders() {
  await seedHolder(A, 60n);
  await seedHolder(B, 40n);
}

async function deposit(amount: bigint) {
  seedMockLedger({ profitPool: (await getLedger(CHAIN).profitPoolBalance()) + amount });
}

async function setConfig(key: string, value: string, type: 'bigint' | 'number') {
  await getConfigStore().setConfig({ key, value, type, changedBy: 'TELLER' });
}

/**
 * Mở kỳ bằng đường cũ rồi ghi kỳ đã duyệt đúng số trên chuỗi ở cổng lưu trữ (FE-08: lõi chia đòi
 * `APPROVED`). Các ca SC-06 ở đây kiểm phần mở, đối soát và vòng đời; luồng duyệt kiểm ở FE-08.
 */
async function openOk(periodKey: string) {
  const result = await openPeriod({ chain: CHAIN, periodKey });
  expect(result.ok, result.ok ? '' : result.error).toBe(true);
  if (!result.ok) throw new Error(result.error);
  const approved = await getDistributionStore().setApproval({
    id: result.data.id,
    from: null,
    approvalStatus: 'APPROVED',
    approvedAmount: result.data.totalAmount,
    approvedBy: 'kiem-thu',
    approvedAt: new Date().toISOString(),
  });
  expect(approved?.approvalStatus).toBe('APPROVED');
  return result.data;
}

/** FE-08 QĐ-E: kỳ mới chỉ mở bằng lần duyệt của Kiểm soát viên (một lượt chia đi kèm). */
async function approveOk() {
  const amount = await getLedger(CHAIN).unallocatedProfit();
  process.env.DEMO_ROLE = 'CONTROLLER';
  resetServerEnvCache();
  try {
    const result = await approveDistribution({ chain: CHAIN, expectedAmount: amount.toString() });
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) throw new Error(result.error);
    return result.data;
  } finally {
    process.env.DEMO_ROLE = 'TELLER';
    resetServerEnvCache();
  }
}

async function distributeOk(periodId: string) {
  const result = await distributePeriod({ chain: CHAIN, periodId });
  expect(result.ok, result.ok ? '' : result.error).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

async function cycleOk() {
  const result = await runDistributionCycle({ chain: CHAIN });
  expect(result.ok, result.ok ? '' : result.error).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

async function payouts(periodId: string) {
  const rows = await getDistributionStore().listPayouts({ periodId, limit: 100 });
  return new Map(rows.map((row) => [row.investorWallet.toLowerCase(), row]));
}

beforeEach(() => {
  fault.openCalls = 0;
  fault.batchCalls = 0;
  fault.hideFind = 0;
  fault.batchLandsThenThrows = null;
  fault.paidChecks = [];
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(START);
  resetMockLedger();
  resetMemoryStore();
  resetStoreCache();
  process.env.USE_MOCK_DB = 'true';
  process.env.DEMO_ROLE = 'TELLER';
  resetServerEnvCache();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete process.env.DEMO_ROLE;
  delete process.env.USE_MOCK_DB;
  resetServerEnvCache();
  resetStoreCache();
});

describe('SC-06 ca 15: mở kỳ có giữ chỗ và phục hồi', () => {
  it('(a) giao dịch lên chuỗi, lỗi trước khi ghi database: phục hồi đúng kỳ, không tạo kỳ thứ hai', async () => {
    await holders();
    await deposit(1_000_000n);
    vi.spyOn(getDistributionStore(), 'setOpenTxHash').mockRejectedValueOnce(
      new Error('mất kết nối cơ sở dữ liệu'),
    );

    const failed = await openPeriod({ chain: CHAIN, periodKey: 'mock:Q1' });
    expect(failed.ok).toBe(false);
    const stuck = await getDistributionStore().findPeriodByKey('mock:Q1');
    expect(stuck?.status).toBe('OPENING');
    expect(stuck?.distributionId).toBeNull();
    const onChain = await getLedger(CHAIN).findDistribution('mock:Q1');
    expect(onChain?.amount).toBe(1_000_000n);

    const recovered = await recoverOpeningPeriod({ chain: CHAIN, periodKey: 'mock:Q1' });
    expect(recovered.ok, recovered.ok ? '' : recovered.error).toBe(true);
    if (!recovered.ok) return;
    expect(recovered.data).toMatchObject({
      status: 'OPEN',
      distributionId: onChain!.distributionId,
      totalAmount: '1000000',
      snapshotId: onChain!.snapshotId,
    });
    expect(fault.openCalls).toBe(1);
    expect(await getLedger(CHAIN).reservedProfit()).toBe(1_000_000n);
  });

  it('(b) gửi lại cùng mã khi kỳ đã có: hợp đồng chặn, ứng dụng hoàn tất từ findDistribution', async () => {
    await holders();
    await deposit(1_000_000n);
    await getLedger(CHAIN).openDistribution('mock:Q1'); // lần gửi trước, mất hết dấu vết
    await getDistributionStore().reservePeriod({ periodKey: 'mock:Q1', chain: CHAIN });
    await deposit(500_000n);
    fault.hideFind = 1; // phục hồi đọc trượt một nhịp nên gửi lại

    const recovered = await recoverOpeningPeriod({ chain: CHAIN, periodKey: 'mock:Q1' });

    expect(recovered.ok, recovered.ok ? '' : recovered.error).toBe(true);
    if (!recovered.ok) return;
    expect(fault.openCalls).toBe(2);
    expect(recovered.data.totalAmount).toBe('1000000');
    expect(await getLedger(CHAIN).unallocatedProfit()).toBe(500_000n);
  });

  it('(c) hai tiến trình cùng mở một mã: database chặn, chỉ một giao dịch', async () => {
    await holders();
    await deposit(1_000_000n);

    const results = await Promise.all([
      openPeriod({ chain: CHAIN, periodKey: 'mock:Q1' }),
      openPeriod({ chain: CHAIN, periodKey: 'mock:Q1' }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const rejected = results.find((result) => !result.ok);
    expect(rejected && !rejected.ok && rejected.code).toBe('PERIOD_STATE');
    expect(fault.openCalls).toBe(1);
    expect(await getDistributionStore().listPeriods({ limit: 10 })).toHaveLength(1);
  });

  it('(d) có tiền mới đúng lúc phục hồi: không tạo kỳ trùng nhãn, tiền mới để kỳ sau', async () => {
    await holders();
    await deposit(1_000_000n);
    vi.spyOn(getDistributionStore(), 'setOpenTxHash').mockRejectedValueOnce(new Error('mất kết nối'));
    await openPeriod({ chain: CHAIN, periodKey: 'mock:Q1' });
    await deposit(700_000n);

    const recovered = await recoverOpeningPeriod({ chain: CHAIN, periodKey: 'mock:Q1' });

    expect(recovered.ok && recovered.data.totalAmount).toBe('1000000');
    expect(fault.openCalls).toBe(1);
    expect(await getLedger(CHAIN).unallocatedProfit()).toBe(700_000n);
  });

  it('chuỗi chắc chắn từ chối: bỏ bản giữ chỗ, mã kỳ dùng lại được', async () => {
    await holders();
    await deposit(1_000_000n);
    const reserved = await getDistributionStore().reservePeriod({ periodKey: 'mock:Q1', chain: CHAIN });
    await getLedger(CHAIN).openDistribution('mock:other'); // kỳ khác giữ hết quỹ
    seedMockLedger({ profitPool: 1_000_000n });

    const recovered = await recoverOpeningPeriod({ chain: CHAIN, periodKey: 'mock:Q1' });

    expect(recovered.ok).toBe(false);
    if (recovered.ok) return;
    expect(recovered.code).toBe('INSUFFICIENT_PROFIT_POOL');
    expect(await getDistributionStore().findPeriod(reserved.id)).toBeNull();
  });
});

describe('SC-06 ca 17: đối soát "đã trả" từ chuỗi', () => {
  it('tự nhận giữa hai vòng, lô đã lên chuỗi chưa ghi, FAILED lên chuỗi muộn: đều PAID, không trả hai lần', async () => {
    const C = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
    await holders();
    await seedHolder(C, 1n);
    await deposit(1_010_000n); // tổng cung 101: A 600.000, B 400.000, C 10.000
    const period = await openOk('mock:Q1');
    await setConfig(CONFIG_KEYS.distributionBatchSize, '1', 'number');
    await setConfig(CONFIG_KEYS.distributionMaxBatchesPerRun, '1', 'number');
    const ledger = getLedger(CHAIN);

    // 1) Lô đầu lên chuỗi rồi mất biên nhận: không ghi FAILED mù.
    fault.batchLandsThenThrows = 1;
    const first = await distributeOk(period.id);
    expect(first.paid).toBe(1);
    expect(first.failed).toBe(0);
    const afterFirst = await payouts(period.id);
    const landed = [A, B, C].find((wallet) => afterFirst.get(wallet.toLowerCase())?.status === 'PAID')!;
    const [selfClaimer, lateFailed] = [A, B, C].filter((wallet) => wallet !== landed);

    // 2) Một ví tự nhận ngoài ứng dụng giữa hai vòng.
    await ledger.distributeBatch(period.distributionId!, [selfClaimer]);
    // 3) Một hồ sơ bị ghi FAILED, nhưng giao dịch của nó lên chuỗi muộn.
    await getDistributionStore().markPayout({
      periodId: period.id,
      investorWallet: afterFirst.get(lateFailed.toLowerCase())!.investorWallet,
      status: 'FAILED',
    });
    await ledger.distributeBatch(period.distributionId!, [lateFailed]);

    const balances = async () =>
      Promise.all([A, B, C].map((wallet) => ledger.paymentBalanceOf(wallet)));
    const before = await balances();
    expect(before).toEqual([600_000n, 400_000n, 10_000n]);

    const second = await distributeOk(period.id);

    expect(second.reconciled).toBe(2);
    expect(second.batches).toBe(0);
    expect(second.outstanding).toBe(0);
    expect(second.period.status).toBe('COMPLETED');
    expect(await balances()).toEqual(before);
    const rows = await payouts(period.id);
    for (const wallet of [A, B, C]) expect(rows.get(wallet.toLowerCase())?.status).toBe('PAID');
  });

  it('hồ sơ phần 0 ghi PAID không gọi chuỗi và không bị đối soát sai', async () => {
    await holders();
    await deposit(1_000_000n);
    const period = await openOk('mock:Q1');
    const LATE = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
    await seedHolder(LATE, 5n); // mua sau ảnh chụp: phần 0

    const run = await distributeOk(period.id);

    expect(run.zero).toBe(1);
    const late = (await payouts(period.id)).get(LATE.toLowerCase());
    expect(late).toMatchObject({ status: 'PAID', amount: '0', txHash: null });
    expect(fault.paidChecks).not.toContain(LATE.toLowerCase());
  });
});

describe('SC-06 ca 18: vòng đời kỳ hết hạn và đã đóng', () => {
  it('quá hạn còn hồ sơ chưa trả: kỳ EXPIRED, hồ sơ EXPIRED, không gửi lô; đóng thì CLOSED', async () => {
    await holders();
    await deposit(1_000_000n);
    const period = await openOk('mock:Q1');
    await setConfig(CONFIG_KEYS.distributionBatchSize, '1', 'number');
    await setConfig(CONFIG_KEYS.distributionMaxBatchesPerRun, '1', 'number');
    await distributeOk(period.id); // chỉ một ví nhận
    vi.setSystemTime(START.getTime() + MOCK_CLAIM_WINDOW_MS);
    const calls = fault.batchCalls;

    const expired = await distributeOk(period.id);

    expect(fault.batchCalls).toBe(calls);
    expect(expired.period.status).toBe('EXPIRED');
    expect(expired.expired).toBe(1);
    const statuses = [...(await payouts(period.id)).values()].map((row) => row.status).sort();
    expect(statuses).toEqual(['EXPIRED', 'PAID']);

    await getLedger(CHAIN).closeDistribution(period.distributionId!);
    const closed = await distributeOk(period.id);
    expect(closed.period.status).toBe('CLOSED');
    expect([...(await payouts(period.id)).values()].filter((row) => row.status === 'PAID')).toHaveLength(1);
    const again = await distributePeriod({ chain: CHAIN, periodId: period.id });
    expect(again.ok).toBe(false);
  });

  it('BE-07: kỳ hết hạn không chặn kỳ sau; FE-08: kỳ sau chờ duyệt rồi mới mở', async () => {
    await holders();
    await deposit(1_000_000n);
    await setConfig(CONFIG_KEYS.distributionBatchSize, '1', 'number');
    await setConfig(CONFIG_KEYS.distributionMaxBatchesPerRun, '1', 'number');
    const first = await approveOk();
    expect(first.outcome).toBe('PARTIAL');

    vi.setSystemTime(START.getTime() + MOCK_CLAIM_WINDOW_MS);
    const ended = await cycleOk();
    expect(ended.outcome).toBe('PERIOD_ENDED');
    expect(ended.periodId).toBe(first.period.id);

    await deposit(2_000n);
    expect((await cycleOk()).outcome).toBe('AWAITING_APPROVAL');
    const next = await approveOk();
    expect(next.period.id).not.toBe(first.period.id);
  });
});

describe('SC-06 ca 19: BE-07 theo phần chưa phân bổ', () => {
  it('ba kỳ liên tiếp đều để lại phần lẻ: không chia trùng, không bỏ sót', async () => {
    await seedHolder(A, 1n);
    await seedHolder(B, 2n);
    const ledger = getLedger(CHAIN);
    const totals: bigint[] = [];
    for (const [index, amount] of [1_000_001n, 2_000_002n, 3_000_001n].entries()) {
      await deposit(amount);
      // Đồng hồ giả đứng yên: nhích một giây để khoá vòng rỗng `idle#<mốc>` không trùng vòng trước.
      vi.setSystemTime(START.getTime() + (index + 1) * 1_000);
      expect((await cycleOk()).outcome).toBe('AWAITING_APPROVAL');
      const run = await approveOk();
      expect(run.outcome).toBe('DISTRIBUTED');
      totals.push(BigInt((await getDistributionStore().findPeriod(run.period.id))!.totalAmount));
    }
    // Mỗi kỳ lấy đúng số vừa nạp, không lấy lại phần lẻ đang nằm trong dự trữ của kỳ trước.
    expect(totals).toEqual([1_000_001n, 2_000_002n, 3_000_001n]);
    const paid = (await ledger.paymentBalanceOf(A)) + (await ledger.paymentBalanceOf(B));
    const pool = await ledger.profitPoolBalance();
    expect(paid + pool).toBe(6_000_004n);
    expect(await ledger.reservedProfit()).toBe(pool);
    vi.setSystemTime(START.getTime() + 10_000);
    expect((await cycleOk()).outcome).toBe('NO_NEW_FUNDS');
  });

  it('phản ví dụ 1: đóng kỳ cũ khi không nạp thêm, phần được giải phóng mở thành kỳ mới khi vượt ngưỡng', async () => {
    await holders();
    await deposit(1_000_000n);
    await setConfig(CONFIG_KEYS.distributionBatchSize, '1', 'number');
    await setConfig(CONFIG_KEYS.distributionMaxBatchesPerRun, '1', 'number');
    const first = await approveOk(); // một ví nhận, ví kia chưa
    vi.setSystemTime(START.getTime() + MOCK_CLAIM_WINDOW_MS);
    await cycleOk(); // kỳ EXPIRED
    const period = (await getDistributionStore().findPeriod(first.period.id))!;
    const state = await getLedger(CHAIN).distributionState(period.distributionId!);
    const released = state.amount - state.claimed;
    await getLedger(CHAIN).closeDistribution(period.distributionId!);

    expect((await cycleOk()).outcome).toBe('AWAITING_APPROVAL');
    const next = await approveOk();

    const opened = (await getDistributionStore().findPeriod(next.period.id))!;
    expect(opened.totalAmount).toBe(released.toString());
    expect([400_000n, 600_000n]).toContain(released);
  });

  it('phản ví dụ 2: tiền kỳ hết hạn còn nợ (chưa đóng) KHÔNG bị nhận nhầm là tiền mới', async () => {
    await holders();
    await deposit(1_000_000n);
    await setConfig(CONFIG_KEYS.distributionBatchSize, '1', 'number');
    await setConfig(CONFIG_KEYS.distributionMaxBatchesPerRun, '1', 'number');
    const first = await approveOk();
    vi.setSystemTime(START.getTime() + MOCK_CLAIM_WINDOW_MS);
    await cycleOk(); // EXPIRED, phần chưa trả còn trong dự trữ, chưa đóng
    const period = (await getDistributionStore().findPeriod(first.period.id))!;
    const state = await getLedger(CHAIN).distributionState(period.distributionId!);

    const idle = await cycleOk();

    expect(idle.outcome).toBe('NO_NEW_FUNDS');
    expect(idle.reservedBalance).toBe((state.amount - state.claimed).toString());
    expect(await getDistributionStore().listPeriods({ limit: 10 })).toHaveLength(1);
  });
});

describe('SC-06 ca 20: mã kỳ theo chain', () => {
  it('mã thiếu tiền tố bị từ chối ở kỳ mới; mã tự động có tiền tố; kỳ cũ không tiền tố vẫn đọc được', async () => {
    await holders();
    await deposit(1_000_000n);

    const bare = await openPeriod({ chain: CHAIN, periodKey: '2026-Q1' });
    expect(bare.ok).toBe(false);
    if (!bare.ok) expect(bare.code).toBe('VALIDATION');
    const wrongChain = await openPeriod({ chain: CHAIN, periodKey: 'evm:2026-Q1' });
    expect(wrongChain.ok).toBe(false);

    // FE-08: mã của lần duyệt là `<chain>:<ngày UTC>-NN`.
    const approved = await approveOk();
    expect(approved.period.periodKey).toMatch(/^mock:\d{4}-\d{2}-\d{2}-01$/);

    const legacy = await getDistributionStore().openPeriod({
      periodKey: '2025-Q4',
      snapshotId: 1,
      totalAmount: '0',
      totalSupplyAt: '100',
      chain: CHAIN,
      status: 'COMPLETED',
    });
    const read = await getDistributionPeriod({ chain: CHAIN, periodKey: '2025-Q4' });
    expect(read.ok && read.data.period.id).toBe(legacy.id);
  });
});

describe('BE-13 QĐ-G: SC-06 QĐ-G nay áp cả chain mock', () => {
  it('lượt chia đầu đẩy số đã dành cho kỳ vào closePeriod của vault mock, mã kỳ vault tăng tuần tự', async () => {
    await holders();
    await deposit(1_000_000n);
    const first = await openOk('mock:Q1');
    // FE-08 QĐ-D: chốt kỳ vault là cửa trước lô đầu tiên, không còn chạy lúc mở kỳ.
    expect(first.vaultCloseStatus).toBeNull();
    const firstRun = await distributeOk(first.id);
    expect(firstRun.period).toMatchObject({ vaultCloseStatus: 'DONE', vaultPeriodRef: 1 });
    expect(await getLedger(CHAIN).findVaultPeriodClose(1n)).toMatchObject({
      periodRef: 1n,
      distributedPrev: BigInt(first.totalAmount),
    });

    await deposit(500_000n);
    const opened = await openOk('mock:Q2');
    const second = (await distributeOk(opened.id)).period;
    expect(second).toMatchObject({ vaultCloseStatus: 'DONE', vaultPeriodRef: 2 });
    const status = await getLedger(CHAIN).vaultStatus();
    expect(status?.lastPeriodRef).toBe(2n);
    expect(status?.lastDistributedPrev).toBe(BigInt(second.totalAmount));
    expect((await getLedger(CHAIN).vaultPeriodCloses(10)).map((close) => close.periodRef)).toEqual([2n, 1n]);
  });

  it('FE-08: lần duyệt trên mock chốt kỳ vault đúng một lần', async () => {
    await holders();
    await deposit(1_000_000n);
    const approved = await approveOk();
    const period = await getDistributionPeriod({ chain: CHAIN, periodId: approved.period.id });
    expect(period.ok && period.data.period).toMatchObject({ vaultCloseStatus: 'DONE', vaultPeriodRef: 1 });
    expect(await getLedger(CHAIN).vaultPeriodCloses(10)).toHaveLength(1);
  });
});
