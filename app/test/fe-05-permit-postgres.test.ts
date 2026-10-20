import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Client } from 'pg';
import type { OrderPermit } from '@/lib/store/order.store.port';

/**
 * FE-05 ca 12 (migration cột `permit`) và ca 10 phần đọc dòng hỏng, trên Postgres THẬT.
 *
 * Chạy trên một database RIÊNG dựng cho tệp này rồi xoá: ca này phải xoá cột `permit` để giả lập
 * database Neon đang chạy từ trước FE-05, làm việc đó trên database dùng chung sẽ làm đỏ các tệp
 * Postgres khác đang chạy song song.
 */

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const DB_NAME = `bidv_fe05_${process.pid}`;
const previous = {
  DATABASE_URL: process.env.DATABASE_URL,
  USE_MOCK_DB: process.env.USE_MOCK_DB,
};

function isolatedUrl(): string {
  const url = new URL(TEST_DATABASE_URL!);
  url.pathname = `/${DB_NAME}`;
  return url.toString();
}

async function admin<T>(fn: (client: Client) => Promise<T>, url = TEST_DATABASE_URL!): Promise<T> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Mỗi lần gọi là một tiến trình mới về mặt module: bộ nhớ đệm "đã khởi tạo lược đồ" trống. */
async function freshPool() {
  vi.resetModules();
  return import('@/lib/store/postgres.pool');
}

const PERMIT: OrderPermit = {
  token: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  spender: '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
  value: 10_000_000n,
  deadline: 1_800_001_800n,
  nonce: 0n,
  v: 27,
  r: `0x${'AB'.repeat(32)}`,
  s: `0x${'cd'.repeat(32)}`,
};

describe.skipIf(!TEST_DATABASE_URL)('FE-05 ca 12: cột permit trên Postgres thật', () => {
  beforeAll(async () => {
    await admin((c) => c.query(`DROP DATABASE IF EXISTS "${DB_NAME}"`));
    await admin((c) => c.query(`CREATE DATABASE "${DB_NAME}"`));
    process.env.DATABASE_URL = isolatedUrl();
    process.env.USE_MOCK_DB = 'false';
    const { resetServerEnvCache } = await import('@/lib/config/env');
    resetServerEnvCache();
  });

  afterAll(async () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.resetModules();
    await admin((c) => c.query(`DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`));
  });

  const permitColumn = () =>
    admin(
      (c) =>
        c.query(
          `SELECT data_type FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'permit'`,
        ),
      isolatedUrl(),
    );

  it('database dựng từ trước FE-05 (thiếu cột permit) được thêm cột khi khởi tạo pool', async () => {
    await (await freshPool()).pgQuery('SELECT 1');
    expect((await permitColumn()).rows).toEqual([{ data_type: 'jsonb' }]);

    // Giả lập Neon đang chạy: đủ bảng, chỉ mục, ràng buộc của bản trước, chỉ thiếu cột mới. Cột
    // SC-06 đi cùng vì cùng một lỗi: phép kiểm "sẵn sàng" trước đây không nhìn tới cột thêm sau.
    await admin(
      (c) =>
        c.query(
          `ALTER TABLE "PurchaseOrder" DROP COLUMN "permit";
           ALTER TABLE "DistributionPeriod" DROP COLUMN "vaultCloseStatus"`,
        ),
      isolatedUrl(),
    );
    expect((await permitColumn()).rows).toEqual([]);

    await (await freshPool()).pgQuery('SELECT 1');
    expect((await permitColumn()).rows).toEqual([{ data_type: 'jsonb' }]);
    const sc06 = await admin(
      (c) =>
        c.query(
          `SELECT 1 FROM information_schema.columns
            WHERE table_name = 'DistributionPeriod' AND column_name = 'vaultCloseStatus'`,
        ),
      isolatedUrl(),
    );
    expect(sc06.rowCount).toBe(1);
  });

  it('ghi rồi đọc lại permit đúng khuôn JSON; dòng hỏng coi như không có permit, log không lộ nội dung', async () => {
    vi.resetModules();
    const { createPostgresOrderStore } = await import('@/lib/store/postgres.order.store');
    const store = createPostgresOrderStore();
    const order = await store.createOrder({
      chain: 'hardhat-local',
      investorWallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      clientRequestId: crypto.randomUUID(),
      side: 'BUY',
      wptAmount: '100',
      vndAmount: '10000000',
      actorRole: 'INVESTOR',
      permit: PERMIT,
    });
    expect(order.permit).toEqual({
      ...PERMIT,
      token: PERMIT.token.toLowerCase(),
      spender: PERMIT.spender.toLowerCase(),
      r: PERMIT.r.toLowerCase(),
    });

    const raw = await admin(
      (c) => c.query(`SELECT "permit" FROM "PurchaseOrder" WHERE "id" = $1`, [order.id]),
      isolatedUrl(),
    );
    expect(raw.rows[0].permit).toEqual({
      token: PERMIT.token.toLowerCase(),
      spender: PERMIT.spender.toLowerCase(),
      value: '10000000',
      deadline: '1800001800',
      nonce: '0',
      v: 27,
      r: PERMIT.r.toLowerCase(),
      s: PERMIT.s,
    });

    await admin(
      (c) =>
        c.query(`UPDATE "PurchaseOrder" SET "permit" = $2::jsonb WHERE "id" = $1`, [
          order.id,
          JSON.stringify({ ...raw.rows[0].permit, value: 10_000_000 }),
        ]),
      isolatedUrl(),
    );
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const broken = await store.findOrder(order.id);
      expect(broken?.permit).toBeNull();
      expect(log).toHaveBeenCalledTimes(1);
      const logged = JSON.stringify(log.mock.calls);
      expect(logged).toContain(order.id);
      expect(logged).not.toContain('abab');
      expect(logged).not.toContain('cdcd');
    } finally {
      log.mockRestore();
    }

    const legacy = await store.createOrder({
      chain: 'mock',
      investorWallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      clientRequestId: crypto.randomUUID(),
      wptAmount: '1',
      vndAmount: '100000',
      actorRole: 'INVESTOR',
    });
    expect(legacy.permit).toBeNull();
  });
});
