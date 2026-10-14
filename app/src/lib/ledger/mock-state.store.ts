import 'server-only';

import { WPT_ISSUE_PRICE_VND } from '@/lib/config/issue-terms';

export interface MockSnapshotRecord {
  balances: Map<string, bigint>;
  totalSupply: bigint;
  distributable: bigint;
  paid: Set<string>;
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
  snapshots: Map<number, MockSnapshotRecord>;
  lastSnapshotId: number;
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
    snapshots: new Map(),
    lastSnapshotId: 0,
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
    snapshots: new Map(
      [...source.snapshots].map(([id, snapshot]) => [
        id,
        {
          balances: new Map(snapshot.balances),
          totalSupply: snapshot.totalSupply,
          distributable: snapshot.distributable,
          paid: new Set(snapshot.paid),
        },
      ]),
    ),
    lastSnapshotId: source.lastSnapshotId,
    profitPool: source.profitPool,
    settlementMode: source.settlementMode,
    navRate: source.navRate,
  };
}

type EncodedSnapshot = {
  balances: Record<string, string>;
  totalSupply: string;
  distributable: string;
  paid: string[];
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
  snapshots: Record<string, EncodedSnapshot>;
  lastSnapshotId: number;
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
    snapshots: Object.fromEntries(
      [...state.snapshots.entries()]
        .sort(([left], [right]) => left - right)
        .map(([id, snapshot]) => [
          id.toString(),
          {
            balances: encodeBigintMap(snapshot.balances),
            totalSupply: snapshot.totalSupply.toString(),
            distributable: snapshot.distributable.toString(),
            paid: sortedStrings(snapshot.paid),
          },
        ]),
    ),
    lastSnapshotId: state.lastSnapshotId,
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

export function decodeMockLedgerState(value: unknown): MockLedgerState {
  const root = record(value, 'state');
  const snapshots = new Map<number, MockSnapshotRecord>();
  for (const [rawId, rawSnapshot] of Object.entries(record(root.snapshots, 'snapshots'))) {
    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`MockLedgerState.snapshots có mã sai: ${rawId}.`);
    const snapshot = record(rawSnapshot, `snapshots.${rawId}`);
    snapshots.set(id, {
      balances: decodeBigintMap(snapshot.balances, `snapshots.${rawId}.balances`),
      totalSupply: bigintValue(snapshot.totalSupply, `snapshots.${rawId}.totalSupply`),
      distributable: bigintValue(snapshot.distributable, `snapshots.${rawId}.distributable`),
      paid: new Set(stringArray(snapshot.paid, `snapshots.${rawId}.paid`)),
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
    snapshots,
    lastSnapshotId: integerValue(root.lastSnapshotId, 'lastSnapshotId'),
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
