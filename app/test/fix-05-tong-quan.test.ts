import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetServerEnvCache } from '@/lib/config/env';
import * as ledgerModule from '@/lib/ledger';
import { resetMockLedger } from '@/lib/ledger/mock.adapter';
import {
  getDistributionStore,
  getProjectStore,
  getStore,
  getWalletBindingStore,
  resetMemoryStore,
  resetStoreCache,
} from '@/lib/store';
import {
  getOpsOverview,
  OVERVIEW_BINDING_LIMIT,
  OVERVIEW_PERIOD_LIMIT,
} from '@/lib/bank/overview.service';

/**
 * FIX-05: số liệu màn Tổng quan (`getOpsOverview`). Chỉ đọc, kiểm bằng `assertCan` (không ghi sổ
 * kiểm toán); mỗi nguồn lỗi thì đúng trường đó `null`. Ca 1 tới 5 trên bộ nhớ, ca 3b trên Postgres
 * thật, ca 5 và 6 quét mã.
 */
const SRC = path.resolve(__dirname, '../src');
const read = (file: string) => readFileSync(path.join(SRC, file), 'utf8');
const CHAIN = 'mock';
const W = (n: number) => `0x${n.toString(16).padStart(40, '0')}`;

function actAs(role: string) {
  process.env.DEMO_ROLE = role;
  resetServerEnvCache();
}

beforeEach(() => {
  resetMockLedger();
  resetMemoryStore();
  resetStoreCache();
  process.env.USE_MOCK_DB = 'true';
  actAs('TELLER');
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete process.env.DEMO_ROLE;
  delete process.env.USE_MOCK_DB;
  resetServerEnvCache();
  resetStoreCache();
});

async function markSampleProjectIssued() {
  const [project] = await getProjectStore().listProjects({ chain: CHAIN });
  expect(project?.status).toBe('DRAFT');
  await getProjectStore().markIssued({ id: project.id, issuedAt: new Date().toISOString() });
}

async function bind(wallet: string, actorId: string) {
  await getWalletBindingStore().bind({ chain: CHAIN, wallet, actorId, boundBy: 'TEST' });
}

/** Kỳ chia cách nhau 1 giây để thứ tự "mới nhất trước" của store ổn định. */
async function openPeriods(specs: Array<{ key: string; amount: string; status: 'COMPLETED' | 'OPEN' }>) {
  vi.useFakeTimers({ toFake: ['Date'] });
  let at = Date.parse('2026-11-01T00:00:00Z');
  for (const spec of specs) {
    vi.setSystemTime(at);
    await getDistributionStore().openPeriod({
      periodKey: spec.key,
      snapshotId: 1,
      totalAmount: spec.amount,
      totalSupplyAt: '1000',
      chain: CHAIN,
      status: spec.status,
    });
    at += 1000;
  }
  vi.useRealTimers();
}

const COMPLETED = Array.from({ length: 7 }, (_, i) => ({
  key: `mock:2026-K${i + 1}`,
  amount: String((i + 1) * 1000),
  status: 'COMPLETED' as const,
}));

describe('FIX-05 getOpsOverview (bộ nhớ)', () => {
  it('ca 1: dự án đã phát hành, tổng cung, hồ sơ nhà đầu tư, lợi tức đã chia, 6 kỳ gần nhất', async () => {
    await markSampleProjectIssued();
    await bind(W(1), 'NDT001');
    await bind(W(2), 'NDT001');
    await bind(W(3), 'NB001');
    await bind(W(4), 'NDT999');
    await openPeriods([...COMPLETED, { key: 'mock:2026-OPEN', amount: '999999', status: 'OPEN' }]);

    const result = await getOpsOverview(CHAIN);

    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    const info = await ledgerModule.getLedger(CHAIN).tokenInfo();
    expect(result.data.issuedProjects).toBe(1);
    expect(result.data.supply).toEqual({ symbol: info.symbol, totalSupply: info.totalSupply.toString() });
    expect(result.data.investors).toEqual({ count: 1, truncated: false });
    expect(result.data.profit?.totalAmount).toBe(String(28_000));
    expect(result.data.profit?.periods).toBe(7);
    expect(result.data.profit?.truncated).toBe(false);
    expect(result.data.profit?.series.map((p) => p.periodKey)).toEqual(COMPLETED.slice(1).map((p) => p.key));
    expect(result.data.profit?.series.at(-1)).toEqual({ periodKey: 'mock:2026-K7', amount: '7000' });
  });

  it('ca 2: từng nguồn lỗi thì đúng trường đó null, ba trường còn lại đúng; log không lộ nội dung lỗi', async () => {
    await markSampleProjectIssued();
    await bind(W(1), 'NDT001');
    await openPeriods(COMPLETED.slice(0, 2));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const boom = () => {
      throw new Error('fetch failed https://rpc.example/KEY123');
    };
    const baseline = await getOpsOverview(CHAIN);
    expect(baseline.ok).toBe(true);
    if (!baseline.ok) return;

    const cases = [
      { field: 'issuedProjects', arm: () => vi.spyOn(getProjectStore(), 'listProjects').mockImplementation(async () => boom()) },
      {
        field: 'supply',
        arm: () => {
          const real = ledgerModule.getLedger(CHAIN);
          return vi.spyOn(ledgerModule, 'getLedger').mockReturnValue({ ...real, tokenInfo: async () => boom() });
        },
      },
      { field: 'investors', arm: () => vi.spyOn(getWalletBindingStore(), 'list').mockImplementation(async () => boom()) },
      { field: 'profit', arm: () => vi.spyOn(getDistributionStore(), 'listPeriods').mockImplementation(async () => boom()) },
    ] as const;

    for (const { field, arm } of cases) {
      const spy = arm();
      const result = await getOpsOverview(CHAIN);
      spy.mockRestore();
      expect(result.ok, field).toBe(true);
      if (!result.ok) continue;
      for (const key of ['issuedProjects', 'supply', 'investors', 'profit'] as const) {
        if (key === field) expect(result.data[key], field).toBeNull();
        else expect(result.data[key], `${field}: ${key}`).toEqual(baseline.data[key]);
      }
    }
    expect(logged).toHaveBeenCalled();
    for (const call of logged.mock.calls) for (const arg of call) expect(String(arg)).not.toContain('KEY123');
  });

  it('ca 3: Kiểm soát viên đọc được; Nhà đầu tư, Người bán bị từ chối; chain sai; không ghi sổ kiểm toán', async () => {
    const before = (await getStore().listAudit({ limit: 500 })).length;

    for (const role of ['TELLER', 'CONTROLLER']) {
      actAs(role);
      expect((await getOpsOverview(CHAIN)).ok, role).toBe(true);
    }
    for (const role of ['INVESTOR', 'SELLER']) {
      actAs(role);
      const result = await getOpsOverview(CHAIN);
      expect(result.ok, role).toBe(false);
      if (!result.ok) expect(result.code, role).toBe('FORBIDDEN');
    }
    actAs('TELLER');
    const invalid = await getOpsOverview('khong-co-chain');
    expect(!invalid.ok && invalid.code).toBe('VALIDATION');

    expect((await getStore().listAudit({ limit: 500 })).length).toBe(before);
  });

  it('ca 4: chạm giới hạn đọc thì báo truncated', async () => {
    const rows = Array.from({ length: OVERVIEW_BINDING_LIMIT }, (_, i) => ({
      chain: CHAIN,
      wallet: W(i + 1),
      actorId: 'NDT001',
      boundBy: 'TEST',
      boundAt: '2026-11-01T00:00:00.000Z',
    }));
    vi.spyOn(getWalletBindingStore(), 'list').mockResolvedValue(rows as never);
    const periods = Array.from({ length: OVERVIEW_PERIOD_LIMIT }, (_, i) => ({ periodKey: `k${i}`, totalAmount: '1' }));
    vi.spyOn(getDistributionStore(), 'listPeriods').mockResolvedValue(periods as never);

    const result = await getOpsOverview(CHAIN);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.investors).toEqual({ count: 1, truncated: true });
    expect(result.data.profit?.truncated).toBe(true);
    expect(result.data.profit?.periods).toBe(OVERVIEW_PERIOD_LIMIT);
  });

  it('ca 5: hai service dùng chung readOrNull, không còn hàm orNull riêng', () => {
    for (const file of ['lib/bank/portfolio.service.ts', 'lib/bank/overview.service.ts']) {
      const source = read(file);
      expect(source, file).toMatch(/import \{ readOrNull \} from '\.\/read-or-null';/);
      expect(source, file).not.toMatch(/function orNull/);
    }
  });

  it('ca 6: màn Tổng quan dùng action mới, bỏ số mẫu cũ; ghi chú dữ liệu mẫu đặt ngoài h1', () => {
    const dashboard = read('components/pages/dashboard.tsx');
    expect(dashboard).toContain('getOpsOverviewAction');
    for (const gone of ['MOCK_PROJECTS', 'whitelistedInvestors', 'wptIssued', 'profitDistributedVndBn', 'distributionPeriods']) {
      expect(dashboard, gone).not.toContain(gone);
    }
    expect(dashboard.match(/<UnverifiedNote/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    for (const file of ['assets', 'kyc', 'reconciliation']) {
      const source = read(`components/pages/${file}.tsx`);
      expect(source, file).toContain('<SampleDataNote />');
      const h1 = /<h1[\s\S]*?<\/h1>/.exec(source)?.[0] ?? '';
      expect(h1, file).not.toContain('SampleDataNote');
    }
  });
});

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const DB_NAME = `bidv_fix05_${process.pid}`;
const previous = { DATABASE_URL: process.env.DATABASE_URL, USE_MOCK_DB: process.env.USE_MOCK_DB };

async function admin(sql: string) {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

describe.skipIf(!TEST_DATABASE_URL)('FIX-05 ca 3b: getOpsOverview trên PostgreSQL thật', () => {
  beforeAll(async () => {
    await admin(`DROP DATABASE IF EXISTS "${DB_NAME}"`);
    await admin(`CREATE DATABASE "${DB_NAME}"`);
    const url = new URL(TEST_DATABASE_URL!);
    url.pathname = `/${DB_NAME}`;
    process.env.DATABASE_URL = url.toString();
    vi.resetModules();
  });

  afterAll(async () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.resetModules();
    await admin(`DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`);
  });

  it('1 dự án ISSUED, 2 kỳ COMPLETED, 1 kỳ OPEN, 2 ví của NDT001', async () => {
    process.env.USE_MOCK_DB = 'false';
    const env = await import('@/lib/config/env');
    env.resetServerEnvCache();
    const store = await import('@/lib/store');
    const [project] = await store.getProjectStore().listProjects({ chain: CHAIN });
    await store.getProjectStore().markIssued({ id: project.id, issuedAt: new Date().toISOString() });
    for (const [n, actorId] of [[1, 'NDT001'], [2, 'NDT001']] as const) {
      await store.getWalletBindingStore().bind({ chain: CHAIN, wallet: W(n), actorId, boundBy: 'TEST' });
    }
    const distribution = store.getDistributionStore();
    for (const [key, status] of [['mock:pg-1', 'COMPLETED'], ['mock:pg-2', 'COMPLETED'], ['mock:pg-3', 'OPEN']] as const) {
      await distribution.openPeriod({ periodKey: key, snapshotId: 1, totalAmount: '500', totalSupplyAt: '1000', chain: CHAIN, status });
    }
    const { getOpsOverview: overview } = await import('@/lib/bank/overview.service');

    const result = await overview(CHAIN);

    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.data.issuedProjects).toBe(1);
    expect(result.data.profit?.periods).toBe(2);
    expect(result.data.investors?.count).toBe(1);
  });
});
