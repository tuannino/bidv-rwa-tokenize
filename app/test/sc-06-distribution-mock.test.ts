import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cloneMockLedgerState,
  createDefaultMockLedgerState,
  decodeMockLedgerState,
  encodeMockLedgerState,
  MOCK_CLAIM_WINDOW_MS,
  MockLedgerMigrationError,
  type MockLedgerState,
  type MockLedgerStateStore,
} from '@/lib/ledger/mock-state.store';
import { createMockLedger, resetMockLedger, seedMockLedger } from '@/lib/ledger/mock.adapter';
import type { ILedgerPort } from '@/lib/ledger/ledger.port';

/**
 * SC-06 ca 13: mock ngang hàng `ProfitDistributor` (quỹ một chiều, sổ dự trữ, chống trùng nhãn,
 * hạn nhận, đóng kỳ trả về quỹ) và chuyển đổi CHÍNH XÁC trạng thái mock cũ.
 *
 * Số liệu giống hệt ca 3, 4, 5 của `packages/contracts-evm/test/sc-06-chia-loi-nhuan.test.js`:
 * A giữ 60 WPT, B giữ 40 WPT trên tổng cung 100.
 */

const SPV = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
const A = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const B = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const START = new Date('2026-10-20T00:00:00Z');

async function holders(): Promise<ILedgerPort> {
  const ledger = createMockLedger('mock');
  for (const wallet of [SPV, A, B]) await ledger.whitelist(wallet);
  await ledger.mintInitialSupply(SPV, 100n);
  await ledger.transfer(SPV, A, 60n);
  await ledger.transfer(SPV, B, 40n);
  return ledger;
}

/** Nạp quỹ như "chuyển VNDB thường vào hợp đồng": cộng thêm vào số dư hiện tại. */
async function deposit(ledger: ILedgerPort, amount: bigint) {
  seedMockLedger({ profitPool: (await ledger.profitPoolBalance()) + amount });
}

async function open(ledger: ILedgerPort, label: string): Promise<number> {
  await ledger.openDistribution(label);
  const found = await ledger.findDistribution(label);
  expect(found).not.toBeNull();
  return found!.distributionId;
}

describe('SC-06 ca 13 — mock ngang hàng quỹ chia một chiều', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(START);
    return resetMockLedger();
  });
  afterEach(() => vi.useRealTimers());

  it('ca 3: không tính trùng, kỳ sau chỉ lấy tiền nạp thêm, trả hết hai kỳ không thiếu tiền', async () => {
    const ledger = await holders();
    await deposit(ledger, 1_000_000n);
    const a = await open(ledger, 'mock:A');
    await ledger.distributeBatch(a, [A]);
    expect((await ledger.distributionState(a)).claimed).toBe(600_000n);

    await deposit(ledger, 500_000n);
    expect(await ledger.unallocatedProfit()).toBe(500_000n);
    const b = await open(ledger, 'mock:B');
    expect((await ledger.distributionState(b)).amount).toBe(500_000n);

    await ledger.distributeBatch(b, [A]);
    await ledger.distributeBatch(a, [B]);
    await ledger.distributeBatch(b, [B]);
    expect(await ledger.paymentBalanceOf(A)).toBe(900_000n);
    expect(await ledger.paymentBalanceOf(B)).toBe(600_000n);
    expect(await ledger.profitPoolBalance()).toBe(0n);
    expect(await ledger.reservedProfit()).toBe(0n);
  });

  it('ca 4: đóng kỳ sau hạn trả phần còn lại về quỹ, kỳ sau lấy lại được', async () => {
    const ledger = await holders();
    await deposit(ledger, 1_000_000n);
    const a = await open(ledger, 'mock:A');
    await ledger.distributeBatch(a, [A]);
    vi.setSystemTime(START.getTime() + MOCK_CLAIM_WINDOW_MS);

    const pool = await ledger.profitPoolBalance();
    const reserved = await ledger.reservedProfit();
    const unallocated = await ledger.unallocatedProfit();
    await ledger.closeDistribution(a);
    expect(await ledger.profitPoolBalance()).toBe(pool);
    expect(await ledger.reservedProfit()).toBe(reserved - 400_000n);
    expect(await ledger.unallocatedProfit()).toBe(unallocated + 400_000n);
    const closed = await ledger.distributionState(a);
    expect(closed.closed).toBe(true);
    expect(closed.claimed).toBe(600_000n);

    const c = await open(ledger, 'mock:C');
    expect((await ledger.distributionState(c)).amount).toBe(400_000n);
    await expect(ledger.distributeBatch(a, [B])).rejects.toThrow(/đã đóng/);
  });

  it('ca 5: đóng trước hạn, đóng hai lần bị chặn; kỳ đã trả hết đóng với 0', async () => {
    const ledger = await holders();
    await deposit(ledger, 1_000n);
    const a = await open(ledger, 'mock:A');
    await expect(ledger.closeDistribution(a)).rejects.toThrow(/Chưa hết thời hạn nhận/);

    await ledger.distributeBatch(a, [A, B]);
    vi.setSystemTime(START.getTime() + MOCK_CLAIM_WINDOW_MS);
    await expect(ledger.distributeBatch(a, [A])).rejects.toThrow(/hết thời hạn nhận/);
    const reserved = await ledger.reservedProfit();
    await ledger.closeDistribution(a);
    expect(await ledger.reservedProfit()).toBe(reserved);
    await expect(ledger.closeDistribution(a)).rejects.toThrow(/đã đóng/);
  });

  it('nhãn trùng bị chặn kể cả khi có tiền mới; quỹ chưa phân bổ 0 bị chặn', async () => {
    const ledger = await holders();
    await deposit(ledger, 1_000n);
    await open(ledger, 'mock:A');
    await expect(ledger.openDistribution('mock:B')).rejects.toThrow(/không có phần chưa phân bổ/);
    await deposit(ledger, 500n);
    await expect(ledger.openDistribution('mock:A')).rejects.toThrow(/đã dùng/);
    await expect(ledger.openDistribution('')).rejects.toThrow(/không được để trống/);
    expect(await ledger.reservedProfit()).toBe(1_000n);
  });
});

/** Kho trạng thái giữ đúng một đối tượng đã giải mã, như kho Postgres đọc một dòng JSONB. */
function storeOver(initial: MockLedgerState): MockLedgerStateStore {
  let current = initial;
  return {
    kind: 'memory',
    async read(fn) {
      return fn(current);
    },
    async mutate(fn) {
      const working = cloneMockLedgerState(current);
      const result = fn(working);
      current = working;
      return result;
    },
  };
}

/**
 * JSON trạng thái lưu TRƯỚC SC-06: không có `distributionLedger`, ảnh chụp mang `distributable`
 * và tập `paid`. Kỳ ở ảnh chụp 3 có 1.000.000, A (60%) đã nhận 600.000.
 */
function legacyJson(): Record<string, unknown> {
  const state = createDefaultMockLedgerState();
  state.balances.set(A.toLowerCase(), 60n);
  state.balances.set(B.toLowerCase(), 40n);
  state.whitelisted.add(A.toLowerCase());
  state.whitelisted.add(B.toLowerCase());
  state.totalSupply = 100n;
  state.initialSupplyMinted = true;
  state.lastSnapshotId = 3;
  state.profitPool = 400_000n;
  const encoded = encodeMockLedgerState(state) as unknown as Record<string, unknown>;
  delete encoded.distributionLedger;
  const holders = { [A.toLowerCase()]: '60', [B.toLowerCase()]: '40' };
  encoded.snapshots = {
    '1': { balances: holders, totalSupply: '100', distributable: '0', paid: [] },
    '3': { balances: holders, totalSupply: '100', distributable: '1000000', paid: [A.toLowerCase()] },
  };
  return encoded;
}

describe('SC-06 ca 13 — chuyển đổi trạng thái mock cũ', () => {
  it('kỳ trả một phần chuyển thành dự trữ đúng phần còn nợ; kỳ mới chỉ lấy tiền nạp thêm', async () => {
    const now = START.getTime();
    const migrated = decodeMockLedgerState(legacyJson(), now);
    const ledgerState = migrated.distributionLedger;
    expect(ledgerState.totalReserved).toBe(400_000n);
    expect(ledgerState.nextDistributionId).toBe(4);
    const old = ledgerState.distributions.get(3)!;
    expect(old.amount).toBe(1_000_000n);
    expect(old.claimed).toBe(600_000n);
    expect(old.claimDeadline).toBe(now + MOCK_CLAIM_WINDOW_MS);
    expect(ledgerState.distributions.has(1)).toBe(false);

    const ledger = createMockLedger('mock', { stateStore: storeOver(migrated) });
    expect(await ledger.unallocatedProfit()).toBe(0n);
    expect(await ledger.isDistributionPaid(3, A)).toBe(true);
    await ledger.distributeBatch(3, [A, B]);
    expect(await ledger.paymentBalanceOf(A)).toBe(0n);
    expect(await ledger.paymentBalanceOf(B)).toBe(400_000n);

    const store = storeOver(decodeMockLedgerState(legacyJson(), now));
    const fresh = createMockLedger('mock', { stateStore: store });
    await store.mutate((s) => {
      s.profitPool += 250_000n;
    });
    await fresh.openDistribution('mock:sau-chuyen-doi');
    const next = await fresh.findDistribution('mock:sau-chuyen-doi');
    expect(next!.distributionId).toBe(4);
    expect(next!.amount).toBe(250_000n);
  });

  it('khứ hồi sau chuyển đổi giữ nguyên sổ, không chuyển đổi lần hai', () => {
    const migrated = decodeMockLedgerState(legacyJson(), START.getTime());
    const again = decodeMockLedgerState(encodeMockLedgerState(migrated), START.getTime() + 1);
    expect(again).toEqual(migrated);
  });

  it('thiếu dữ liệu để tính thì báo lỗi cần reset, không tự đoán', () => {
    const missingBalances = legacyJson();
    (missingBalances.snapshots as Record<string, Record<string, unknown>>)['3'].balances = undefined;
    expect(() => decodeMockLedgerState(missingBalances)).toThrow(MockLedgerMigrationError);

    const missingAmount = legacyJson();
    delete (missingAmount.snapshots as Record<string, Record<string, unknown>>)['3'].distributable;
    expect(() => decodeMockLedgerState(missingAmount)).toThrow(/cần reset|reset có kiểm soát/);

    const zeroSupply = legacyJson();
    (zeroSupply.snapshots as Record<string, Record<string, unknown>>)['3'].totalSupply = '0';
    expect(() => decodeMockLedgerState(zeroSupply)).toThrow(MockLedgerMigrationError);
  });
});
