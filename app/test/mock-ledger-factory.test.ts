import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { settlementOrder } from './helpers/settlement-order';

const pgClientConstructed = vi.hoisted(() => vi.fn());

vi.mock('pg', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pg')>();
  class CountingClient extends actual.Client {
    constructor(...args: ConstructorParameters<typeof actual.Client>) {
      pgClientConstructed();
      super(...args);
    }
  }
  return { ...actual, Client: CountingClient };
});

const { resetServerEnvCache } = await import('@/lib/config/env');
const { getLedger, getMockLedgerStateStore, resetMockLedger } = await import('@/lib/ledger');
const { getStore, resetStoreCache } = await import('@/lib/store');

const SPV = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
const INVESTOR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

describe('factory kho mock dùng cùng USE_MOCK_DB với kho nghiệp vụ', () => {
  const originalUseMockDb = process.env.USE_MOCK_DB;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    pgClientConstructed.mockClear();
    resetStoreCache();
    resetServerEnvCache();
    resetMockLedger();
  });

  afterEach(() => {
    if (originalUseMockDb === undefined) delete process.env.USE_MOCK_DB;
    else process.env.USE_MOCK_DB = originalUseMockDb;
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    resetStoreCache();
    resetServerEnvCache();
  });

  it('USE_MOCK_DB=true chạy trọn vòng ledger mock mà không tạo pg Client', async () => {
    process.env.USE_MOCK_DB = 'true';
    process.env.DATABASE_URL = 'postgresql://invalid:invalid@127.0.0.1:1/khong-ton-tai';
    resetServerEnvCache();

    expect(getStore().kind).toBe('memory');
    expect(getMockLedgerStateStore('mock').kind).toBe('memory');

    const ledger = getLedger('mock');
    await ledger.whitelist(SPV);
    await ledger.whitelist(INVESTOR);
    await ledger.mintPayment(INVESTOR, 1_000_000n);
    await ledger.mintInitialSupply(SPV, 10n);
    await ledger.executePurchase(await settlementOrder(ledger, INVESTOR, 2n));
    await ledger.executeSale(await settlementOrder(ledger, INVESTOR, 1n));
    await ledger.burn(SPV, 1n);

    expect(await ledger.balanceOf(INVESTOR)).toBe(1n);
    expect((await ledger.tokenInfo()).totalSupply).toBe(9n);
    expect(pgClientConstructed).not.toHaveBeenCalled();
  });

  it('USE_MOCK_DB=false chọn Postgres cho cả hai kho, chưa thao tác thì chưa mở kết nối', () => {
    process.env.USE_MOCK_DB = 'false';
    process.env.DATABASE_URL = 'postgresql://invalid:invalid@127.0.0.1:1/khong-ton-tai';
    resetServerEnvCache();

    expect(getStore().kind).toBe('prisma');
    expect(getMockLedgerStateStore('mock').kind).toBe('postgres');
    expect(pgClientConstructed).not.toHaveBeenCalled();
  });

  it('Postgres lỗi thì báo lỗi rõ, không lùi sang state memory', async () => {
    process.env.USE_MOCK_DB = 'false';
    process.env.DATABASE_URL = 'postgresql://invalid:invalid@127.0.0.1:1/khong-ton-tai';
    resetServerEnvCache();

    await expect(getLedger('mock').isWhitelisted(INVESTOR)).rejects.toThrow(/kho postgres/);
    expect(pgClientConstructed).toHaveBeenCalled();

    process.env.USE_MOCK_DB = 'true';
    resetServerEnvCache();
    expect(await getLedger('mock').isWhitelisted(INVESTOR)).toBe(false);
  });
});
