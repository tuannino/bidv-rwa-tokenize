import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { resetServerEnvCache } from '@/lib/config/env';
import { createMemoryProfileWalletStore } from '@/lib/store/memory.profile-wallet.store';
import { resetMemoryStores } from '@/lib/store/memory.state';
import type { IProfileWalletStore } from '@/lib/store/profile-wallet.store.port';
import { UNIQUE_CONSTRAINTS, UniqueConstraintError } from '@/lib/store/store.errors';

/**
 * OP-05 QĐ-I: cổng ví liên kết ở CẢ HAI bản, cùng một bộ ca (bản bộ nhớ nghiêm ngặt ngang Postgres).
 * Bản Postgres chạy trên database RIÊNG của tệp rồi xoá (mẫu `fe-08-store.test.ts`).
 */

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const DB_NAME = `bidv_op05_${process.pid}`;
const previous = { DATABASE_URL: process.env.DATABASE_URL, USE_MOCK_DB: process.env.USE_MOCK_DB };

function urlFor(name: string): string {
  const url = new URL(TEST_DATABASE_URL!);
  url.pathname = `/${name}`;
  return url.toString();
}

async function admin(sql: string): Promise<void> {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

const backends: Array<[string, () => Promise<IProfileWalletStore>]> = [
  ['bộ nhớ', async () => createMemoryProfileWalletStore()],
];
if (TEST_DATABASE_URL) {
  backends.push([
    'Postgres',
    async () => (await import('@/lib/store/postgres.profile-wallet.store')).createPostgresProfileWalletStore(),
  ]);
}

beforeAll(async () => {
  if (!TEST_DATABASE_URL) return;
  await admin(`DROP DATABASE IF EXISTS "${DB_NAME}"`);
  await admin(`CREATE DATABASE "${DB_NAME}"`);
  process.env.DATABASE_URL = urlFor(DB_NAME);
  process.env.USE_MOCK_DB = 'false';
  resetServerEnvCache();
});

afterAll(async () => {
  if (!TEST_DATABASE_URL) return;
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetServerEnvCache();
  await admin(`DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`);
});

const A = '0xAAAA00000000000000000000000000000000aaaa';
const B = '0xBBBB00000000000000000000000000000000bbbb';

describe('OP-05: ràng buộc ví liên kết khai trong bảng ánh xạ lỗi', () => {
  it('ProfileWallet_chain_walletKey_key ánh xạ về bảng và cột', () => {
    expect(UNIQUE_CONSTRAINTS.ProfileWallet_chain_walletKey_key).toEqual({
      table: 'ProfileWallet',
      columns: ['chain', 'walletKey'],
    });
  });
});

describe.each(backends)('OP-05 QĐ-I: cổng ví liên kết bản %s', (label, make) => {
  let store: IProfileWalletStore;
  // Mỗi ca dùng mã hồ sơ riêng: database Postgres của tệp giữ dòng giữa các ca.
  let seq = 0;
  let actor: (name: string) => string;

  beforeEach(async () => {
    store = await make();
    if (label === 'bộ nhớ') resetMemoryStores();
    seq += 1;
    actor = (name) => `${name}-${seq}`;
  });

  it('ghi, thay ví trả ví cũ, đọc lại theo hồ sơ và theo ví không phân biệt hoa thường', async () => {
    const first = await store.link({ actorId: actor('NDT'), chain: 'evm', wallet: `${A.slice(0, -1)}${seq}`, updatedBy: actor('NDT') });
    expect(first.previous).toBeNull();
    const wallet = `${B.slice(0, -1)}${seq}`;
    const second = await store.link({ actorId: actor('NDT'), chain: 'evm', wallet, updatedBy: actor('NDT') });
    expect(second.previous).toBe(first.record.wallet);
    expect(second.record).toMatchObject({ actorId: actor('NDT'), chain: 'evm', wallet });

    expect((await store.findByActor(actor('NDT'), 'evm'))?.wallet).toBe(wallet);
    expect((await store.findByWallet('evm', wallet.toLowerCase()))?.actorId).toBe(actor('NDT'));
    expect(await store.findByWallet('evm', first.record.wallet)).toBeNull();
    expect(await store.findByActor(actor('NDT'), 'mock')).toBeNull();
  });

  it('một ví hai hồ sơ trên cùng chain: UniqueConstraintError; khác chain thì được', async () => {
    const wallet = `${A.slice(0, -2)}${seq}f`;
    await store.link({ actorId: actor('NDT'), chain: 'evm', wallet, updatedBy: actor('NDT') });
    await expect(
      store.link({ actorId: actor('NB'), chain: 'evm', wallet: wallet.toUpperCase().replace('0X', '0x'), updatedBy: actor('NB') }),
    ).rejects.toBeInstanceOf(UniqueConstraintError);
    expect(await store.findByActor(actor('NB'), 'evm')).toBeNull();
    await expect(store.link({ actorId: actor('NB'), chain: 'mock', wallet, updatedBy: actor('NB') })).resolves.toBeTruthy();
  });

  it('liên kết lại đúng ví đang có của mình thì được (không vướng ràng buộc của chính mình)', async () => {
    const wallet = `${B.slice(0, -2)}${seq}e`;
    await store.link({ actorId: actor('NDT'), chain: 'evm', wallet, updatedBy: actor('NDT') });
    const again = await store.link({ actorId: actor('NDT'), chain: 'evm', wallet, updatedBy: actor('NDT') });
    expect(again.previous).toBe(wallet);
  });
});
