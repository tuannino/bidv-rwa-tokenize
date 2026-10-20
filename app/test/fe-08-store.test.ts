import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from 'pg';
import { resetServerEnvCache } from '@/lib/config/env';
import type { IDistributionStore } from '@/lib/store/distribution.store.port';
import type { IKeeperStore } from '@/lib/store/keeper.store.port';
import { createMemoryDistributionStore } from '@/lib/store/memory.distribution.store';
import { createMemoryKeeperStore } from '@/lib/store/memory.keeper.store';
import { resetMemoryStores } from '@/lib/store/memory.state';
import { UNIQUE_CONSTRAINTS, UniqueConstraintError } from '@/lib/store/store.errors';

/**
 * FE-08 QĐ-B: cột duyệt, `activeChain` (mỗi chain tối đa một kỳ hoạt động) và `triggerSource` ở
 * CẢ HAI cổng lưu trữ, cùng một bộ ca (bản bộ nhớ phải nghiêm ngặt ngang Postgres). Bản Postgres
 * chạy trên database RIÊNG của tệp rồi xoá, vì ca kiểm cần chain trống kỳ hoạt động. Thêm ca nâng
 * lược đồ trên database có sẵn (mẫu `be-13-postgres-upgrade.test.ts`).
 */

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const DB_NAME = `bidv_fe08_${process.pid}`;
const UPGRADE_DB = `bidv_fe08_up_${process.pid}`;
const previous = { DATABASE_URL: process.env.DATABASE_URL, USE_MOCK_DB: process.env.USE_MOCK_DB };

function urlFor(name: string): string {
  const url = new URL(TEST_DATABASE_URL!);
  url.pathname = `/${name}`;
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

interface Backend {
  distribution: IDistributionStore;
  keeper: IKeeperStore;
  reset: () => void;
}

const backends: Array<[string, () => Promise<Backend>]> = [
  [
    'bộ nhớ',
    async () => ({
      distribution: createMemoryDistributionStore(),
      keeper: createMemoryKeeperStore(),
      reset: resetMemoryStores,
    }),
  ],
];
if (TEST_DATABASE_URL) {
  backends.push([
    'Postgres',
    async () => {
      const { createPostgresDistributionStore } = await import('@/lib/store/postgres.distribution.store');
      const { createPostgresKeeperStore } = await import('@/lib/store/postgres.keeper.store');
      return {
        distribution: createPostgresDistributionStore(),
        keeper: createPostgresKeeperStore(),
        reset: () => {},
      };
    },
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

const now = () => new Date().toISOString();

describe('FE-08: ràng buộc activeChain khai trong bảng ánh xạ lỗi', () => {
  it('DistributionPeriod_activeChain_key ánh xạ về bảng và cột', () => {
    expect(UNIQUE_CONSTRAINTS.DistributionPeriod_activeChain_key).toEqual({
      table: 'DistributionPeriod',
      columns: ['activeChain'],
    });
  });
});

describe.each(backends)('FE-08 QĐ-B: cổng lưu trữ bản %s', (_label, make) => {
  let store: Backend;

  beforeEach(async () => {
    store = await make();
    store.reset();
    // Mỗi ca bắt đầu với mọi chain trống kỳ hoạt động (database riêng của tệp, không đụng ai).
    for (const chain of ['mock', 'evm', 'hardhat-local', 'stellar'] as const) {
      const active = await store.distribution.findActivePeriod(chain);
      if (!active) continue;
      if (active.status === 'OPENING') await store.distribution.deleteOpeningPeriod(active.id);
      else await store.distribution.setPeriodStatus({ id: active.id, status: 'CLOSED', completedAt: now() });
    }
  });

  it('giữ chỗ đặt activeChain; kỳ thứ hai cùng chain (mã khác) bị chặn bằng UniqueConstraintError trên activeChain', async () => {
    const first = await store.distribution.reservePeriod({ periodKey: `mock:${randomUUID()}`, chain: 'mock' });
    expect(first).toMatchObject({ status: 'OPENING', activeChain: 'mock', approvalStatus: null, expectedAmount: null });
    expect((await store.distribution.findActivePeriod('mock'))?.id).toBe(first.id);

    await expect(
      store.distribution.reservePeriod({ periodKey: `mock:${randomUUID()}`, chain: 'mock' }),
    ).rejects.toMatchObject({ name: 'UniqueConstraintError', table: 'DistributionPeriod', columns: ['activeChain'] });
    // Chain khác không bị ảnh hưởng.
    const other = await store.distribution.reservePeriod({ periodKey: `evm:${randomUUID()}`, chain: 'evm' });
    expect(other.activeChain).toBe('evm');
    expect(await store.distribution.listPeriods({ chain: 'mock', limit: 10 })).toHaveLength(1);
  });

  it('hai lần giữ chỗ đồng thời với hai mã khác nhau: đúng một bên thắng', async () => {
    const results = await Promise.allSettled([
      store.distribution.reservePeriod({ periodKey: `mock:2026-10-21-${randomUUID()}`, chain: 'mock' }),
      store.distribution.reservePeriod({ periodKey: `mock:2026-10-22-${randomUUID()}`, chain: 'mock' }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const lost = results.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    expect(lost.reason).toBeInstanceOf(UniqueConstraintError);
  });

  it('trạng thái cuối đặt activeChain null trong cùng câu cập nhật; quay lại hoạt động khi chain đã có kỳ khác thì bị chặn', async () => {
    const first = await store.distribution.reservePeriod({ periodKey: `mock:${randomUUID()}`, chain: 'mock' });
    for (const status of ['COMPLETED', 'EXPIRED', 'CLOSED'] as const) {
      const moved = await store.distribution.setPeriodStatus({ id: first.id, status, completedAt: now() });
      expect(moved).toMatchObject({ status, activeChain: null });
    }
    expect(await store.distribution.findActivePeriod('mock')).toBeNull();

    const second = await store.distribution.reservePeriod({ periodKey: `mock:${randomUUID()}`, chain: 'mock' });
    expect(second.activeChain).toBe('mock');
    await expect(store.distribution.setPeriodStatus({ id: first.id, status: 'OPEN' })).rejects.toBeInstanceOf(
      UniqueConstraintError,
    );
    expect((await store.distribution.findPeriod(first.id))?.status).toBe('CLOSED');
  });

  it('openPeriod: trạng thái hoạt động giữ chỗ chain, trạng thái cuối thì không', async () => {
    const closed = await store.distribution.openPeriod({
      periodKey: `ky-${randomUUID()}`,
      snapshotId: 1,
      totalAmount: '10',
      totalSupplyAt: '1',
      chain: 'mock',
      status: 'COMPLETED',
    });
    expect(closed.activeChain).toBeNull();
    const open = await store.distribution.openPeriod({
      periodKey: `ky-${randomUUID()}`,
      snapshotId: 1,
      totalAmount: '10',
      totalSupplyAt: '1',
      chain: 'mock',
    });
    expect(open).toMatchObject({ status: 'OPEN', activeChain: 'mock' });
  });

  it('giữ chỗ kèm duyệt ghi số duyệt, người duyệt, thời điểm; kết luận để trống', async () => {
    const reserved = await store.distribution.reservePeriod({
      periodKey: `mock:${randomUUID()}`,
      chain: 'mock',
      approval: { expectedAmount: '123456789012345678901234567890', approvedBy: 'KSV001' },
    });
    expect(reserved).toMatchObject({
      expectedAmount: '123456789012345678901234567890',
      approvedBy: 'KSV001',
      approvalStatus: null,
      approvedAmount: null,
      reapprovedFrom: null,
    });
    expect(Date.parse(reserved.approvedAt!)).toBeGreaterThan(Date.now() - 60_000);
  });

  it('setApproval có điều kiện: chỉ từ đúng kết luận hiện tại, chỉ kỳ hoạt động, hai bên cùng ghi thì một bên thắng', async () => {
    const period = await store.distribution.reservePeriod({
      periodKey: `mock:${randomUUID()}`,
      chain: 'mock',
      approval: { expectedAmount: '100', approvedBy: 'KSV001' },
    });
    const both = await Promise.all([
      store.distribution.setApproval({ id: period.id, from: null, approvalStatus: 'AMOUNT_CHANGED', approvedAmount: null }),
      store.distribution.setApproval({ id: period.id, from: null, approvalStatus: 'APPROVED', approvedAmount: '100' }),
    ]);
    expect(both.filter(Boolean)).toHaveLength(1);
    const current = (await store.distribution.findPeriod(period.id))!;

    // Sai `from` thì không đổi gì.
    const wrongFrom = current.approvalStatus === 'APPROVED' ? 'AMOUNT_CHANGED' : 'APPROVED';
    expect(
      await store.distribution.setApproval({ id: period.id, from: wrongFrom, approvalStatus: 'APPROVED', approvedAmount: '1' }),
    ).toBeNull();

    // Duyệt lại từ đúng kết luận: ghi đủ trường.
    const at = now();
    const re = await store.distribution.setApproval({
      id: period.id,
      from: current.approvalStatus,
      approvalStatus: 'APPROVED',
      approvedAmount: '105',
      approvedBy: 'KSV002',
      approvedAt: at,
      reapprovedFrom: '100',
    });
    expect(re).toMatchObject({ approvalStatus: 'APPROVED', approvedAmount: '105', approvedBy: 'KSV002', reapprovedFrom: '100' });
    expect(re!.approvedAt).toBe(at);

    // Kỳ đã ở trạng thái cuối thì không ghi kết luận nữa.
    await store.distribution.setPeriodStatus({ id: period.id, status: 'COMPLETED', completedAt: now() });
    expect(
      await store.distribution.setApproval({ id: period.id, from: 'APPROVED', approvalStatus: 'AMOUNT_CHANGED' }),
    ).toBeNull();
  });

  it('phân trang kỳ và hồ sơ: đếm đủ, không thiếu dòng, không trùng dòng', async () => {
    const chain = 'stellar' as const;
    const ids: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const period = await store.distribution.openPeriod({
        periodKey: `${chain}:${randomUUID()}`,
        snapshotId: 1,
        totalAmount: '10',
        totalSupplyAt: '1',
        chain,
        status: 'COMPLETED',
      });
      ids.push(period.id);
    }
    const total = await store.distribution.countPeriods({ chain });
    const seen: string[] = [];
    for (let offset = 0; offset < total; offset += 2) {
      seen.push(...(await store.distribution.listPeriods({ chain, limit: 2, offset })).map((row) => row.id));
    }
    expect(new Set(seen).size).toBe(total);
    for (const id of ids) expect(seen).toContain(id);

    const wallets = Array.from({ length: 7 }, (_, index) => `0x${'a'.repeat(38)}${index.toString().padStart(2, '0')}`);
    await store.distribution.createPayouts({
      periodId: ids[0],
      rows: wallets.map((investorWallet, index) => ({ investorWallet, balanceAt: String(index), amount: String(index) })),
    });
    expect(await store.distribution.countPayouts({ periodId: ids[0] })).toBe(7);
    const pages = [0, 3, 6].map((offset) => store.distribution.listPayouts({ periodId: ids[0], limit: 3, offset }));
    const rows = (await Promise.all(pages)).flat().map((row) => row.investorWallet);
    expect(rows.sort()).toEqual([...wallets].sort());
  });

  it('KeeperRun: triggerSource mặc định KEEPER, ghi được MANUAL; lọc theo tiền tố so nguyên văn (không phải mẫu LIKE)', async () => {
    const job = `fe08-${randomUUID()}`;
    const key = `mock:2026_10%21-01`;
    const keeperRun = await store.keeper.startRun({ jobName: job, periodKey: `${key}#1` });
    const manualRun = await store.keeper.startRun({ jobName: job, periodKey: `${key}#2`, triggerSource: 'MANUAL' });
    await store.keeper.startRun({ jobName: job, periodKey: 'mock:2026x10y21-01#1' }); // khớp nếu `_`/`%` là ký tự đại diện
    expect(keeperRun.triggerSource).toBe('KEEPER');
    expect(manualRun.triggerSource).toBe('MANUAL');

    const filtered = await store.keeper.listRuns({ jobName: job, periodKeyPrefix: `${key}#`, limit: 10 });
    expect(filtered.map((run) => [run.periodKey, run.triggerSource]).sort()).toEqual([
      [`${key}#1`, 'KEEPER'],
      [`${key}#2`, 'MANUAL'],
    ]);
    // @ts-expect-error: nguồn kích hoạt lạ bị chặn lúc chạy.
    await expect(store.keeper.startRun({ jobName: job, periodKey: 'x#1', triggerSource: 'CRON' })).rejects.toThrow();
  });
});

// ===========================================================================
//  NÂNG LƯỢC ĐỒ TRÊN DATABASE CÓ SẴN (ca 15)
// ===========================================================================

async function freshModules() {
  vi.resetModules();
  const env = await import('@/lib/config/env');
  env.resetServerEnvCache();
  return {
    pool: await import('@/lib/store/postgres.pool'),
    store: await import('@/lib/store'),
  };
}

describe.skipIf(!TEST_DATABASE_URL)('FE-08 ca 15: nâng lược đồ trên database đang chạy trước FE-08', () => {
  beforeAll(async () => {
    await admin(`DROP DATABASE IF EXISTS "${UPGRADE_DB}"`);
    await admin(`CREATE DATABASE "${UPGRADE_DB}"`);
  });

  afterAll(async () => {
    process.env.DATABASE_URL = urlFor(DB_NAME);
    vi.resetModules();
    await admin(`DROP DATABASE IF EXISTS "${UPGRADE_DB}" WITH (FORCE)`);
  });

  it('thiếu cột duyệt, activeChain, triggerSource: pool tự thêm, điền activeChain cho kỳ cũ hoạt động sớm nhất mỗi chain, chỉ mục duy nhất có mặt', async () => {
    process.env.DATABASE_URL = urlFor(UPGRADE_DB);
    process.env.USE_MOCK_DB = 'false';
    await (await freshModules()).pool.pgQuery('SELECT 1');

    // Giả lập database trước FE-08: gỡ bảy cột kỳ chia, cột KeeperRun và chỉ mục duy nhất.
    await admin(
      `DROP INDEX "DistributionPeriod_activeChain_key";
       ALTER TABLE "DistributionPeriod" DROP COLUMN "approvalStatus", DROP COLUMN "expectedAmount",
         DROP COLUMN "approvedAmount", DROP COLUMN "approvedBy", DROP COLUMN "approvedAt",
         DROP COLUMN "reapprovedFrom", DROP COLUMN "activeChain";
       ALTER TABLE "KeeperRun" DROP COLUMN "triggerSource";
       INSERT INTO "DistributionPeriod" ("id","periodKey","snapshotId","totalAmount","totalSupplyAt","status","chain","openedAt")
       VALUES ('cu-1','mock:cu-1',1,100,10,'OPEN','mock','2026-01-01T00:00:00Z'),
              ('cu-2','mock:cu-2',2,200,10,'DISTRIBUTING','mock','2026-02-01T00:00:00Z'),
              ('cu-3','mock:cu-3',3,300,10,'COMPLETED','mock','2025-12-01T00:00:00Z'),
              ('cu-4','evm:cu-4',1,400,10,'OPEN','evm','2026-03-01T00:00:00Z');
       INSERT INTO "KeeperRun" ("id","jobName","periodKey","status") VALUES ('run-cu','distribution-trigger','mock:cu-1#1','SUCCESS');`,
      urlFor(UPGRADE_DB),
    );

    const { pool, store } = await freshModules();
    await pool.pgQuery('SELECT 1');

    const columns = await admin<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'DistributionPeriod'
          AND column_name IN ('approvalStatus','expectedAmount','approvedAmount','approvedBy','approvedAt','reapprovedFrom','activeChain')`,
      urlFor(UPGRADE_DB),
    );
    expect(columns).toHaveLength(7);
    expect(
      await admin(`SELECT indexname FROM pg_indexes WHERE indexname = 'DistributionPeriod_activeChain_key'`, urlFor(UPGRADE_DB)),
    ).toHaveLength(1);

    const distribution = store.getDistributionStore();
    expect(distribution.kind).toBe('prisma');
    // Kỳ cũ hoạt động sớm nhất mỗi chain giữ chỗ; kỳ cũ thứ hai cùng chain và kỳ đã xong thì không.
    expect((await distribution.findActivePeriod('mock'))?.id).toBe('cu-1');
    expect((await distribution.findActivePeriod('evm'))?.id).toBe('cu-4');
    expect((await distribution.findPeriod('cu-2'))?.activeChain).toBeNull();
    expect((await distribution.findPeriod('cu-3'))?.activeChain).toBeNull();
    expect(await distribution.findPeriod('cu-1')).toMatchObject({ approvalStatus: null, expectedAmount: null, approvedBy: null });

    const [run] = await store.getKeeperStore().listRuns({ jobName: 'distribution-trigger', limit: 5 });
    expect(run).toMatchObject({ id: 'run-cu', triggerSource: 'KEEPER' });

    // Ràng buộc mới chạy trên database vừa nâng.
    await expect(distribution.reservePeriod({ periodKey: 'mock:moi', chain: 'mock' })).rejects.toMatchObject({
      columns: ['activeChain'],
    });
  });
});
