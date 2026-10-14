import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetServerEnvCache } from '@/lib/config/env';
import { getLedger } from '@/lib/ledger';
import { LedgerError } from '@/lib/ledger/ledger.port';
import {
  createDefaultMockLedgerState,
  decodeMockLedgerState,
  encodeMockLedgerState,
  memoryMockLedgerStateStore,
  type MockLedgerStateStore,
} from '@/lib/ledger/mock-state.store';
import { createMockLedger, resetMockLedger, seedMockLedger } from '@/lib/ledger/mock.adapter';
import { createPostgresMockLedgerStateStore } from '@/lib/ledger/postgres-mock-state.store';
import { getProjectStore, getTokenRequestStore, resetStoreCache } from '@/lib/store';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const previousDatabaseUrl = process.env.DATABASE_URL;
const previousUseMockDb = process.env.USE_MOCK_DB;
const previousRole = process.env.DEMO_ROLE;
const previousActor = process.env.DEMO_ACTOR;

const SPV = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
const INVESTOR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const OTHER = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

describe('mã hoá MockLedgerState', () => {
  it('khứ hồi đủ Map, Set, bigint và snapshot', () => {
    const state = createDefaultMockLedgerState();
    state.balances.set('0xabc', 123n);
    state.whitelisted.add('0xabc');
    state.frozen.add('0xdef');
    state.totalSupply = 123n;
    state.nonce = 9;
    state.initialSupplyMinted = true;
    state.spvWallet = '0xabc';
    state.wptPriceVnd = 456n;
    state.priceHydrated = true;
    state.paymentBalances.set('0xabc', 789n);
    state.paymentAllowances.set('0xabc', 321n);
    state.snapshots.set(1, {
      balances: new Map([['0xabc', 123n]]),
      totalSupply: 123n,
      distributable: 999n,
      paid: new Set(['0xabc']),
    });
    state.lastSnapshotId = 1;
    state.profitPool = 999n;
    state.settlementMode = true;
    state.navRate = 777n;

    expect(decodeMockLedgerState(encodeMockLedgerState(state))).toEqual(state);
  });
});

function sharedStateStoreContract(label: string, makeStore: () => MockLedgerStateStore): void {
  describe(`hợp đồng kho trạng thái — ${label}`, () => {
    let store: MockLedgerStateStore;

    beforeEach(async () => {
      store = makeStore();
      await resetMockLedger(store);
    });

    it('hai ledger độc lập thấy whitelist và toàn bộ trạng thái đã ghi', async () => {
      const first = createMockLedger('mock', { stateStore: store });
      await first.whitelist(SPV);
      await first.whitelist(INVESTOR);
      await first.whitelist(OTHER);
      await first.freeze(OTHER, true);
      await first.setPurchasePrice(250_000n);
      await first.mintInitialSupply(SPV, 1_000n);
      await first.mintPayment(INVESTOR, 500_000n);
      await first.transfer(SPV, INVESTOR, 100n);
      await seedMockLedger({ profitPool: 1_000_000n }, store);
      const snapshotId = (await first.takeSnapshot()).snapshotId;
      await first.distributeBatch(snapshotId, [INVESTOR]);
      await first.setSettlementMode(true);
      await first.setNavRate(123_456n);

      const second = createMockLedger('mock', { stateStore: makeStore() });
      expect(await second.isWhitelisted(INVESTOR)).toBe(true);
      expect(await second.isFrozen(OTHER)).toBe(true);
      expect(await second.isInitialSupplyMinted()).toBe(true);
      expect(await second.spvWallet()).toBe(SPV);
      expect(await second.balanceOf(SPV)).toBe(900n);
      expect(await second.balanceOf(INVESTOR)).toBe(100n);
      expect((await second.tokenInfo()).totalSupply).toBe(1_000n);
      expect(await second.paymentBalanceOf(INVESTOR)).toBe(600_000n);
      expect(await second.paymentAllowanceOf(INVESTOR)).toBe(500_000n);
      expect(await second.quotePurchase(2n)).toBe(500_000n);
      expect(await second.totalSupplyAt(snapshotId)).toBe(1_000n);
      expect(await second.profitPoolBalance()).toBe(900_000n);
      await second.distributeBatch(snapshotId, [INVESTOR]);
      expect(await second.paymentBalanceOf(INVESTOR)).toBe(600_000n);
      expect(await second.isSettlementMode()).toBe(true);
      expect(await second.navRate()).toBe(123_456n);
    });

    it('lỗi nghiệp vụ không ghi trạng thái nửa vời', async () => {
      const ledger = createMockLedger('mock', { stateStore: store });
      await expect(ledger.mint(INVESTOR, 1n)).rejects.toThrow(/chưa KYC/);
      expect(await ledger.balanceOf(INVESTOR)).toBe(0n);
      expect((await ledger.tokenInfo()).totalSupply).toBe(0n);
    });

    it('hai phát hành ban đầu song song chỉ đúng một lần thành công', async () => {
      const first = createMockLedger('mock', { stateStore: store });
      const second = createMockLedger('mock', { stateStore: makeStore() });
      await first.whitelist(SPV);

      const results = await Promise.allSettled([
        first.mintInitialSupply(SPV, 1_000n),
        second.mintInitialSupply(SPV, 1_000n),
      ]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      expect((await first.tokenInfo()).totalSupply).toBe(1_000n);
      expect(await first.balanceOf(SPV)).toBe(1_000n);
    });

    it('hai lệnh mua song song không thể làm âm số dư SPV', async () => {
      const first = createMockLedger('mock', { stateStore: store });
      const second = createMockLedger('mock', { stateStore: makeStore() });
      await first.whitelist(SPV);
      await first.whitelist(INVESTOR);
      await first.mintInitialSupply(SPV, 100n);
      const price = await first.quotePurchase(1n);
      await seedMockLedger(
        {
          paymentBalances: { [INVESTOR]: 120n * price },
          paymentAllowances: { [INVESTOR]: 120n * price },
        },
        store,
      );

      const results = await Promise.allSettled([
        first.executePurchase(INVESTOR, 60n),
        second.executePurchase(INVESTOR, 60n),
      ]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(await first.balanceOf(SPV)).toBe(40n);
      expect(await first.balanceOf(INVESTOR)).toBe(60n);
    });
  });
}

sharedStateStoreContract('memory', () => memoryMockLedgerStateStore);

describe.skipIf(!TEST_DATABASE_URL)('Postgres MockLedgerState', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    process.env.USE_MOCK_DB = 'false';
    resetServerEnvCache();
  });

  afterAll(() => {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousUseMockDb === undefined) delete process.env.USE_MOCK_DB;
    else process.env.USE_MOCK_DB = previousUseMockDb;
    if (previousRole === undefined) delete process.env.DEMO_ROLE;
    else process.env.DEMO_ROLE = previousRole;
    if (previousActor === undefined) delete process.env.DEMO_ACTOR;
    else process.env.DEMO_ACTOR = previousActor;
    resetStoreCache();
    resetServerEnvCache();
  });

  sharedStateStoreContract('Postgres', () => createPostgresMockLedgerStateStore('mock'));

  it('whitelist + lập ở A, xoá cache tiến trình, duyệt ở B vẫn thành công', async () => {
    const regressionWallet = '0x5a5B0Ab8613bA0F16e257228e4109A8F611Ec4fd';
    const tokenSymbol = `OP07${Date.now().toString(36).slice(-8)}`.toUpperCase();
    const stateStore = createPostgresMockLedgerStateStore('mock');
    await resetMockLedger(stateStore);
    await stateStore.mutate((state) => {
      state.nonce = Date.now();
    });
    resetStoreCache();
    process.env.DEMO_ROLE = 'TELLER';
    process.env.DEMO_ACTOR = 'GDV-OP07';
    resetServerEnvCache();
    await getProjectStore().createProject({
      tokenSymbol,
      name: 'Hồi quy OP-07',
      totalSupply: '1000',
      chain: 'mock',
    });

    const { createTokenRequest, approveTokenRequest } = await import('@/lib/bank/token-request.service');
    await getLedger('mock').whitelist(regressionWallet);
    const created = await createTokenRequest({
      type: 'MINT',
      chain: 'mock',
      tokenSymbol,
      amount: '700',
      wallet: regressionWallet,
      reason: 'hồi quy OP-07 qua Worker isolate',
      documentRef: 'OP07-REGRESSION',
      effectiveDate: '2026-10-14',
    });
    expect(created.ok, created.ok ? '' : created.error).toBe(true);
    if (!created.ok) return;

    const requestId = created.data.request.id;
    resetStoreCache();
    resetServerEnvCache();
    process.env.DEMO_ROLE = 'CONTROLLER';
    process.env.DEMO_ACTOR = 'KSV-OP07';
    resetServerEnvCache();

    expect(await getLedger('mock').isWhitelisted(regressionWallet)).toBe(true);
    const approved = await approveTokenRequest({ requestId });
    expect(approved.ok, approved.ok ? '' : approved.error).toBe(true);
    if (!approved.ok) return;
    expect(approved.data.status).toBe('COMPLETED');
    expect(approved.data.wallet).toBe(regressionWallet);
    expect((await getLedger('mock').tokenInfo()).totalSupply).toBe(700n);
    expect((await getTokenRequestStore().findRequest(requestId))?.status).toBe('COMPLETED');
  });
});

describe('lỗi kho trạng thái', () => {
  it('ném LedgerError rõ ràng và không lùi sang memory', async () => {
    await resetMockLedger();
    const broken: MockLedgerStateStore = {
      kind: 'postgres',
      read: async () => {
        throw new Error('database unavailable');
      },
      mutate: async () => {
        throw new Error('database unavailable');
      },
    };
    const ledger = createMockLedger('mock', { stateStore: broken });

    await expect(ledger.whitelist(INVESTOR)).rejects.toThrow(LedgerError);
    await expect(ledger.whitelist(INVESTOR)).rejects.toThrow(/kho postgres/);
    expect(await createMockLedger().isWhitelisted(INVESTOR)).toBe(false);
  });
});
