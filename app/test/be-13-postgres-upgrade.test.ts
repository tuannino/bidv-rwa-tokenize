import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Client } from 'pg';

/**
 * BE-13 ca 17 (phần lược đồ): database Postgres đang chạy từ trước BE-13 (đủ mọi bảng cũ, thiếu
 * `VaultOperationLock`, `WithdrawRequest` và khoá cấu hình `vault.default_percent_bps`) được nâng
 * khi khởi tạo pool, rồi hai cổng mới chạy được trên đó.
 *
 * Chạy trên database RIÊNG dựng cho tệp này rồi xoá: phải xoá bảng để giả lập database cũ, làm việc
 * đó trên database dùng chung sẽ làm đỏ các tệp Postgres khác đang chạy song song. Kiểm chứng chung
 * còn chạy bộ kiểm thử Postgres trên một database dựng thẳng từ `init.sql` của `dev` (checkpoint).
 */

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const DB_NAME = `bidv_be13_up_${process.pid}`;
const previous = { DATABASE_URL: process.env.DATABASE_URL, USE_MOCK_DB: process.env.USE_MOCK_DB };

function isolatedUrl(): string {
  const url = new URL(TEST_DATABASE_URL!);
  url.pathname = `/${DB_NAME}`;
  return url.toString();
}

async function admin<T>(sql: string, url = TEST_DATABASE_URL!): Promise<T[]> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return (await client.query(sql)).rows as T[];
  } finally {
    await client.end();
  }
}

/** Mỗi lần gọi là một tiến trình mới về mặt module: bộ nhớ đệm "đã khởi tạo lược đồ" trống. */
async function freshModules() {
  vi.resetModules();
  const { resetServerEnvCache } = await import('@/lib/config/env');
  resetServerEnvCache();
  return {
    pool: await import('@/lib/store/postgres.pool'),
    store: await import('@/lib/store'),
  };
}

const tables = () =>
  admin<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('VaultOperationLock', 'WithdrawRequest')
      ORDER BY table_name`,
    isolatedUrl(),
  );

describe.skipIf(!TEST_DATABASE_URL)('BE-13 ca 17: nâng lược đồ trên database có sẵn', () => {
  beforeAll(async () => {
    await admin(`DROP DATABASE IF EXISTS "${DB_NAME}"`);
    await admin(`CREATE DATABASE "${DB_NAME}"`);
    process.env.DATABASE_URL = isolatedUrl();
    process.env.USE_MOCK_DB = 'false';
  });

  afterAll(async () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.resetModules();
    await admin(`DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`);
  });

  it('database thiếu hai bảng BE-13 và khoá cấu hình mới được nâng khi khởi tạo pool; hai cổng chạy được', async () => {
    await (await freshModules()).pool.pgQuery('SELECT 1');
    expect((await tables()).map((row) => row.table_name)).toEqual(['VaultOperationLock', 'WithdrawRequest']);

    // Giả lập database đang chạy trước BE-13.
    await admin(
      `DROP TABLE "WithdrawRequest"; DROP TABLE "VaultOperationLock";
       DELETE FROM "SystemConfig" WHERE "key" = 'vault.default_percent_bps'`,
      isolatedUrl(),
    );
    expect(await tables()).toEqual([]);

    const { pool, store } = await freshModules();
    await pool.pgQuery('SELECT 1');
    expect((await tables()).map((row) => row.table_name)).toEqual(['VaultOperationLock', 'WithdrawRequest']);
    expect(
      await admin(`SELECT "value" FROM "SystemConfig" WHERE "key" = 'vault.default_percent_bps'`, isolatedUrl()),
    ).toEqual([{ value: '2000' }]);

    const vault = store.getVaultStore();
    expect(vault.kind).toBe('prisma');
    expect(await vault.acquireOperationLock({ chain: 'evm', kind: 'WITHDRAW', refId: 'w-1', actor: 'NB001' })).not.toBeNull();
    const created = await vault.createWithdrawRequest({
      id: 'w-1',
      chain: 'evm',
      clientRequestId: crypto.randomUUID(),
      amount: '5',
      purpose: 'nâng lược đồ',
      note: null,
      payoutWallet: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
      claimedBlock: '1',
      createdBy: 'NB001',
    });
    expect(created).toMatchObject({ status: 'SENDING', activeChain: 'evm', amount: '5' });
    expect(await vault.transitionWithdrawRequest({ id: 'w-1', from: 'SENDING', to: 'FAILED', reason: 'kiểm thử' })).toMatchObject({
      status: 'FAILED',
      activeChain: null,
    });
    expect(await vault.releaseOperationLock({ chain: 'evm', refId: 'w-1' })).toBe(true);
  });
});
