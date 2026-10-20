import 'server-only';

import { WPT_ISSUE_PRICE_VND } from '@/lib/config/issue-terms';

export interface MockSnapshotRecord {
  balances: Map<string, bigint>;
  totalSupply: bigint;
}

/** Hạn nhận mặc định của `ProfitDistributor.claimWindow` (180 ngày), dùng cho mock. */
export const MOCK_CLAIM_WINDOW_MS = 180 * 24 * 60 * 60 * 1000;

/** Một kỳ chia của mock, ngang hàng `ProfitDistributor.Distribution` (SC-06). */
export interface MockDistributionRecord {
  snapshotId: number;
  period: string;
  amount: bigint;
  claimed: bigint;
  totalSupplyAt: bigint;
  /** Mốc hết hạn nhận, mili giây từ epoch. */
  claimDeadline: number;
  closed: boolean;
  /** Ví đã nhận (kể cả phần 0), như `hasClaimed` của hợp đồng. */
  paid: Set<string>;
}

/** Sổ kỳ chia và sổ dự trữ của quỹ một chiều (SC-06 QĐ-A, QĐ-B). */
export interface MockDistributionLedger {
  distributions: Map<number, MockDistributionRecord>;
  /** Nhãn kỳ đã dùng ở `openDistribution` -> mã kỳ. */
  byPeriod: Map<string, number>;
  nextDistributionId: number;
  totalReserved: bigint;
}

/** Toàn bộ nguồn sự thật của chain mock. Không thêm state ở ngoài kiểu này. */
export interface MockLedgerState {
  balances: Map<string, bigint>;
  whitelisted: Set<string>;
  frozen: Set<string>;
  totalSupply: bigint;
  nonce: number;
  initialSupplyMinted: boolean;
  spvWallet?: string;
  wptPriceVnd: bigint;
  priceHydrated: boolean;
  paymentBalances: Map<string, bigint>;
  paymentAllowances: Map<string, bigint>;
  /**
   * Mã lệnh -> mã giao dịch giả. Với Postgres, trường này nằm trong cùng một dòng JSONB
   * của chain nên mỗi lần ghi sẽ ghi lại cả khối; chấp nhận được ở quy mô bản trình diễn.
   */
  settledOrders: Map<string, string>;
  snapshots: Map<number, MockSnapshotRecord>;
  lastSnapshotId: number;
  distributionLedger: MockDistributionLedger;
  profitPool: bigint;
  settlementMode: boolean;
  navRate: bigint;
}

/** Callback phải đồng bộ để một mutate luôn nằm trọn trong cùng critical section/transaction. */
export interface MockLedgerStateStore {
  readonly kind: 'memory' | 'postgres';
  read<T>(fn: (state: Readonly<MockLedgerState>) => T): Promise<T>;
  mutate<T>(fn: (state: MockLedgerState) => T): Promise<T>;
  resetForTest?(): void | Promise<void>;
}

const DEFAULT_WPT_PRICE_VND = BigInt(WPT_ISSUE_PRICE_VND);

const emptyDistributionLedger = (): MockDistributionLedger => ({
  distributions: new Map(),
  byPeriod: new Map(),
  nextDistributionId: 0,
  totalReserved: 0n,
});

export function createDefaultMockLedgerState(): MockLedgerState {
  return {
    balances: new Map(),
    whitelisted: new Set(),
    frozen: new Set(),
    totalSupply: 0n,
    nonce: 0,
    initialSupplyMinted: false,
    spvWallet: undefined,
    wptPriceVnd: DEFAULT_WPT_PRICE_VND,
    priceHydrated: false,
    paymentBalances: new Map(),
    paymentAllowances: new Map(),
    settledOrders: new Map(),
    snapshots: new Map(),
    lastSnapshotId: 0,
    distributionLedger: emptyDistributionLedger(),
    profitPool: 0n,
    settlementMode: false,
    navRate: DEFAULT_WPT_PRICE_VND,
  };
}

export function cloneMockLedgerState(source: Readonly<MockLedgerState>): MockLedgerState {
  return {
    balances: new Map(source.balances),
    whitelisted: new Set(source.whitelisted),
    frozen: new Set(source.frozen),
    totalSupply: source.totalSupply,
    nonce: source.nonce,
    initialSupplyMinted: source.initialSupplyMinted,
    spvWallet: source.spvWallet,
    wptPriceVnd: source.wptPriceVnd,
    priceHydrated: source.priceHydrated,
    paymentBalances: new Map(source.paymentBalances),
    paymentAllowances: new Map(source.paymentAllowances),
    settledOrders: new Map(source.settledOrders),
    snapshots: new Map(
      [...source.snapshots].map(([id, snapshot]) => [
        id,
        { balances: new Map(snapshot.balances), totalSupply: snapshot.totalSupply },
      ]),
    ),
    lastSnapshotId: source.lastSnapshotId,
    distributionLedger: {
      distributions: new Map(
        [...source.distributionLedger.distributions].map(([id, record]) => [
          id,
          { ...record, paid: new Set(record.paid) },
        ]),
      ),
      byPeriod: new Map(source.distributionLedger.byPeriod),
      nextDistributionId: source.distributionLedger.nextDistributionId,
      totalReserved: source.distributionLedger.totalReserved,
    },
    profitPool: source.profitPool,
    settlementMode: source.settlementMode,
    navRate: source.navRate,
  };
}

type EncodedSnapshot = {
  balances: Record<string, string>;
  totalSupply: string;
};

type EncodedDistribution = {
  snapshotId: number;
  period: string;
  amount: string;
  claimed: string;
  totalSupplyAt: string;
  claimDeadline: number;
  closed: boolean;
  paid: string[];
};

type EncodedDistributionLedger = {
  distributions: Record<string, EncodedDistribution>;
  byPeriod: Record<string, number>;
  nextDistributionId: number;
  totalReserved: string;
};

export type EncodedMockLedgerState = {
  balances: Record<string, string>;
  whitelisted: string[];
  frozen: string[];
  totalSupply: string;
  nonce: number;
  initialSupplyMinted: boolean;
  spvWallet?: string;
  wptPriceVnd: string;
  priceHydrated: boolean;
  paymentBalances: Record<string, string>;
  paymentAllowances: Record<string, string>;
  settledOrders?: Record<string, string>;
  snapshots: Record<string, EncodedSnapshot>;
  lastSnapshotId: number;
  distributionLedger: EncodedDistributionLedger;
  profitPool: string;
  settlementMode: boolean;
  navRate: string;
};

const sortedStrings = (values: Iterable<string>): string[] => [...values].sort();

function encodeBigintMap(values: ReadonlyMap<string, bigint>): Record<string, string> {
  return Object.fromEntries(
    [...values.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => [key, value.toString()]),
  );
}

function encodeDistributionLedger(ledger: MockDistributionLedger): EncodedDistributionLedger {
  return {
    distributions: Object.fromEntries(
      [...ledger.distributions.entries()]
        .sort(([left], [right]) => left - right)
        .map(([id, record]) => [
          id.toString(),
          {
            snapshotId: record.snapshotId,
            period: record.period,
            amount: record.amount.toString(),
            claimed: record.claimed.toString(),
            totalSupplyAt: record.totalSupplyAt.toString(),
            claimDeadline: record.claimDeadline,
            closed: record.closed,
            paid: sortedStrings(record.paid),
          },
        ]),
    ),
    byPeriod: Object.fromEntries(
      [...ledger.byPeriod.entries()].sort(([left], [right]) => left.localeCompare(right)),
    ),
    nextDistributionId: ledger.nextDistributionId,
    totalReserved: ledger.totalReserved.toString(),
  };
}

export function encodeMockLedgerState(state: Readonly<MockLedgerState>): EncodedMockLedgerState {
  return {
    balances: encodeBigintMap(state.balances),
    whitelisted: sortedStrings(state.whitelisted),
    frozen: sortedStrings(state.frozen),
    totalSupply: state.totalSupply.toString(),
    nonce: state.nonce,
    initialSupplyMinted: state.initialSupplyMinted,
    ...(state.spvWallet ? { spvWallet: state.spvWallet } : {}),
    wptPriceVnd: state.wptPriceVnd.toString(),
    priceHydrated: state.priceHydrated,
    paymentBalances: encodeBigintMap(state.paymentBalances),
    paymentAllowances: encodeBigintMap(state.paymentAllowances),
    settledOrders: Object.fromEntries([...state.settledOrders].sort(([left], [right]) => left.localeCompare(right))),
    snapshots: Object.fromEntries(
      [...state.snapshots.entries()]
        .sort(([left], [right]) => left - right)
        .map(([id, snapshot]) => [
          id.toString(),
          {
            balances: encodeBigintMap(snapshot.balances),
            totalSupply: snapshot.totalSupply.toString(),
          },
        ]),
    ),
    lastSnapshotId: state.lastSnapshotId,
    distributionLedger: encodeDistributionLedger(state.distributionLedger),
    profitPool: state.profitPool.toString(),
    settlementMode: state.settlementMode,
    navRate: state.navRate.toString(),
  };
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`MockLedgerState.${label} phải là object.`);
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`MockLedgerState.${label} phải là string.`);
  return value;
}

function bigintValue(value: unknown, label: string): bigint {
  const raw = stringValue(value, label);
  if (!/^-?\d+$/.test(raw)) throw new Error(`MockLedgerState.${label} không phải số nguyên.`);
  return BigInt(raw);
}

function integerValue(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`MockLedgerState.${label} phải là số nguyên không âm.`);
  }
  return value as number;
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`MockLedgerState.${label} phải là boolean.`);
  return value;
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`MockLedgerState.${label} phải là mảng string.`);
  }
  return value;
}

function decodeBigintMap(value: unknown, label: string): Map<string, bigint> {
  return new Map(
    Object.entries(record(value, label)).map(([key, item]) => [key, bigintValue(item, `${label}.${key}`)]),
  );
}

function decodeDistributionLedger(value: unknown): MockDistributionLedger {
  const root = record(value, 'distributionLedger');
  const distributions = new Map<number, MockDistributionRecord>();
  for (const [rawId, raw] of Object.entries(record(root.distributions, 'distributionLedger.distributions'))) {
    const id = Number(rawId);
    const label = `distributionLedger.distributions.${rawId}`;
    if (!Number.isSafeInteger(id) || id < 0) throw new Error(`MockLedgerState.${label} có mã sai.`);
    const item = record(raw, label);
    distributions.set(id, {
      snapshotId: integerValue(item.snapshotId, `${label}.snapshotId`),
      period: stringValue(item.period, `${label}.period`),
      amount: bigintValue(item.amount, `${label}.amount`),
      claimed: bigintValue(item.claimed, `${label}.claimed`),
      totalSupplyAt: bigintValue(item.totalSupplyAt, `${label}.totalSupplyAt`),
      claimDeadline: integerValue(item.claimDeadline, `${label}.claimDeadline`),
      closed: booleanValue(item.closed, `${label}.closed`),
      paid: new Set(stringArray(item.paid, `${label}.paid`)),
    });
  }
  return {
    distributions,
    byPeriod: new Map(
      Object.entries(record(root.byPeriod, 'distributionLedger.byPeriod')).map(([period, id]) => [
        period,
        integerValue(id, `distributionLedger.byPeriod.${period}`),
      ]),
    ),
    nextDistributionId: integerValue(root.nextDistributionId, 'distributionLedger.nextDistributionId'),
    totalReserved: bigintValue(root.totalReserved, 'distributionLedger.totalReserved'),
  };
}

/** Lỗi trạng thái mock cũ không đủ dữ liệu để chuyển đổi chính xác (SC-06 QĐ-D). */
export class MockLedgerMigrationError extends Error {
  constructor(detail: string) {
    super(
      `Trạng thái chain mock cũ không chuyển đổi được sang sổ dự trữ SC-06: ${detail}. ` +
        'Không tự đoán số đã chia; làm mới MockLedgerState của chain này theo runbook OP-07 ' +
        '(reset có kiểm soát) rồi nạp lại quỹ.',
    );
    this.name = 'MockLedgerMigrationError';
  }
}

/**
 * Chuyển ảnh chụp kiểu cũ (trước SC-06: mỗi ảnh chụp mang `distributable` và tập `paid`) thành
 * sổ kỳ chia CHÍNH XÁC, không coi là sổ rỗng (SC-06 QĐ-D):
 * - mỗi ảnh chụp có `distributable > 0` thành kỳ `distributionId = snapshotId`;
 * - `claimed` = tổng phần nguyên của các ví trong tập đã trả, cùng công thức với hợp đồng;
 * - hạn nhận tính lại từ lúc chuyển đổi; bộ đếm kỳ mới bắt đầu từ `max(snapshotId) + 1`.
 * Thiếu số dư tại ảnh chụp hoặc tổng cung thì báo lỗi cần reset, không đoán.
 */
function migrateLegacyDistributions(
  rawSnapshots: Record<string, unknown>,
  now: number,
): MockDistributionLedger {
  const ledger = emptyDistributionLedger();
  let maxSnapshotId = -1;
  for (const [rawId, rawSnapshot] of Object.entries(rawSnapshots)) {
    const id = Number(rawId);
    maxSnapshotId = Math.max(maxSnapshotId, id);
    const snapshot = record(rawSnapshot, `snapshots.${rawId}`);
    if (snapshot.distributable === undefined) {
      throw new MockLedgerMigrationError(`ảnh chụp ${rawId} thiếu số tiền chia (distributable)`);
    }
    const amount = bigintValue(snapshot.distributable, `snapshots.${rawId}.distributable`);
    if (amount === 0n) continue;
    if (snapshot.balances === undefined || snapshot.totalSupply === undefined) {
      throw new MockLedgerMigrationError(`ảnh chụp ${rawId} thiếu số dư tại ảnh chụp hoặc tổng cung`);
    }
    const balances = decodeBigintMap(snapshot.balances, `snapshots.${rawId}.balances`);
    const totalSupply = bigintValue(snapshot.totalSupply, `snapshots.${rawId}.totalSupply`);
    if (totalSupply === 0n) {
      throw new MockLedgerMigrationError(`ảnh chụp ${rawId} có tiền chia nhưng tổng cung bằng 0`);
    }
    const paid = new Set(stringArray(snapshot.paid ?? [], `snapshots.${rawId}.paid`));
    const claimed = [...paid].reduce(
      (sum, wallet) => sum + (amount * (balances.get(wallet) ?? 0n)) / totalSupply,
      0n,
    );
    ledger.distributions.set(id, {
      snapshotId: id,
      period: `legacy-snapshot-${id}`,
      amount,
      claimed,
      totalSupplyAt: totalSupply,
      claimDeadline: now + MOCK_CLAIM_WINDOW_MS,
      closed: false,
      paid,
    });
    ledger.totalReserved += amount - claimed;
  }
  ledger.nextDistributionId = maxSnapshotId + 1;
  return ledger;
}

export function decodeMockLedgerState(value: unknown, now: number = Date.now()): MockLedgerState {
  const root = record(value, 'state');
  const rawSnapshots = record(root.snapshots, 'snapshots');
  // Trạng thái lưu trước SC-06 không có sổ kỳ chia: chuyển đổi chính xác từ ảnh chụp kiểu cũ,
  // TRƯỚC khi giải mã ảnh chụp, để thiếu dữ liệu báo đúng lỗi cần reset.
  const distributionLedger =
    root.distributionLedger === undefined
      ? migrateLegacyDistributions(rawSnapshots, now)
      : decodeDistributionLedger(root.distributionLedger);
  const snapshots = new Map<number, MockSnapshotRecord>();
  for (const [rawId, rawSnapshot] of Object.entries(rawSnapshots)) {
    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`MockLedgerState.snapshots có mã sai: ${rawId}.`);
    const snapshot = record(rawSnapshot, `snapshots.${rawId}`);
    snapshots.set(id, {
      balances: decodeBigintMap(snapshot.balances, `snapshots.${rawId}.balances`),
      totalSupply: bigintValue(snapshot.totalSupply, `snapshots.${rawId}.totalSupply`),
    });
  }

  const spvWallet = root.spvWallet;
  if (spvWallet !== undefined && typeof spvWallet !== 'string') {
    throw new Error('MockLedgerState.spvWallet phải là string hoặc không có.');
  }

  return {
    balances: decodeBigintMap(root.balances, 'balances'),
    whitelisted: new Set(stringArray(root.whitelisted, 'whitelisted')),
    frozen: new Set(stringArray(root.frozen, 'frozen')),
    totalSupply: bigintValue(root.totalSupply, 'totalSupply'),
    nonce: integerValue(root.nonce, 'nonce'),
    initialSupplyMinted: booleanValue(root.initialSupplyMinted, 'initialSupplyMinted'),
    spvWallet,
    wptPriceVnd: bigintValue(root.wptPriceVnd, 'wptPriceVnd'),
    priceHydrated: booleanValue(root.priceHydrated, 'priceHydrated'),
    paymentBalances: decodeBigintMap(root.paymentBalances, 'paymentBalances'),
    paymentAllowances: decodeBigintMap(root.paymentAllowances, 'paymentAllowances'),
    // Tương thích trạng thái Neon có trước SC-03: thiếu trường = chưa lệnh nào quyết toán.
    settledOrders: new Map(
      Object.entries(root.settledOrders === undefined ? {} : record(root.settledOrders, 'settledOrders'))
        .map(([orderId, txHash]) => [orderId, stringValue(txHash, `settledOrders.${orderId}`)]),
    ),
    snapshots,
    lastSnapshotId: integerValue(root.lastSnapshotId, 'lastSnapshotId'),
    distributionLedger,
    profitPool: bigintValue(root.profitPool, 'profitPool'),
    settlementMode: booleanValue(root.settlementMode, 'settlementMode'),
    navRate: bigintValue(root.navRate, 'navRate'),
  };
}

const GLOBAL_KEY = '__bidvMockLedgerState__';

type MockStateHolder = typeof globalThis & { [GLOBAL_KEY]?: MockLedgerState };

function memoryState(): MockLedgerState {
  const holder = globalThis as MockStateHolder;
  holder[GLOBAL_KEY] ??= createDefaultMockLedgerState();
  return holder[GLOBAL_KEY];
}

export const memoryMockLedgerStateStore: MockLedgerStateStore = {
  kind: 'memory',

  async read(fn) {
    return fn(memoryState());
  },

  async mutate(fn) {
    const holder = globalThis as MockStateHolder;
    const working = cloneMockLedgerState(memoryState());
    const result = fn(working);
    holder[GLOBAL_KEY] = working;
    return result;
  },

  resetForTest() {
    const holder = globalThis as MockStateHolder;
    delete holder[GLOBAL_KEY];
  },
};
