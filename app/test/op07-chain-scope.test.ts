import { readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resetServerEnvCache } from '@/lib/config/env';
import { createPostgresStore } from '@/lib/store/postgres.store';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const previousDatabaseUrl = process.env.DATABASE_URL;
const previousUseMockDb = process.env.USE_MOCK_DB;

describe.skipIf(!TEST_DATABASE_URL)('Txn Postgres được phân vùng theo chain', () => {
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
    resetServerEnvCache();
  });

  it('cùng một ví chỉ thấy giao dịch thuộc chain được hỏi', async () => {
    const store = createPostgresStore();
    const wallet = `0x${randomUUID().replaceAll('-', '').padEnd(40, '0').slice(0, 40)}`;
    const mockHash = `0x${randomUUID().replaceAll('-', '').padEnd(64, '0').slice(0, 64)}`;
    const evmHash = `0x${randomUUID().replaceAll('-', '').padEnd(64, '1').slice(0, 64)}`;
    const base = {
      operation: 'whitelist',
      status: 'CONFIRMED' as const,
      fromWallet: null,
      toWallet: wallet,
      amount: null,
      reason: null,
      actorRole: 'TELLER' as const,
      actorAddress: null,
    };
    await store.saveTxn({ ...base, chain: 'mock', txHash: mockHash });
    await store.saveTxn({ ...base, chain: 'evm', txHash: evmHash });

    expect((await store.listTxns({ chain: 'mock', wallet })).map((row) => row.txHash)).toEqual([mockHash]);
    expect((await store.listTxns({ chain: 'evm', wallet })).map((row) => row.txHash)).toEqual([evmHash]);
  });
});

describe('màn Mint tải lịch sử theo chain đang chọn', () => {
  it('truyền activeChain vào listTransactionsAction', () => {
    const source = readFileSync(path.resolve(__dirname, '../src/components/pages/mint.tsx'), 'utf8');
    expect(source).toContain('listTransactionsAction({ chain: activeChain, limit: 20 })');
  });
});
