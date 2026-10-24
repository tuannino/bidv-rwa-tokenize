import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Client } from 'pg';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const DB_NAME = `bidv_be05_${process.pid}`;
const previous = { DATABASE_URL: process.env.DATABASE_URL, USE_MOCK_DB: process.env.USE_MOCK_DB };

function isolatedUrl(): string {
  const url = new URL(TEST_DATABASE_URL!);
  url.pathname = `/${DB_NAME}`;
  return url.toString();
}

async function admin<T>(sql: string, url = TEST_DATABASE_URL!): Promise<T[]> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try { return (await client.query(sql)).rows as T[]; }
  finally { await client.end(); }
}

async function stores() {
  const { resetServerEnvCache } = await import('@/lib/config/env');
  resetServerEnvCache();
  const pool = await import('@/lib/store/postgres.pool');
  await pool.pgQuery('SELECT 1');
  return import('@/lib/store');
}

const live = TEST_DATABASE_URL ? describe.sequential : describe.skip;

live('BE-05 — kho thu hồi trên PostgreSQL thật', () => {
  beforeAll(async () => {
    await admin(`DROP DATABASE IF EXISTS "${DB_NAME}"`);
    await admin(`CREATE DATABASE "${DB_NAME}"`);
    process.env.DATABASE_URL = isolatedUrl();
    process.env.USE_MOCK_DB = 'false';
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

  it('khởi tạo đủ cột mới và chỉ mục một đợt hoạt động mỗi chain', async () => {
    await stores();
    const columns = await admin<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='SettlementRound'
         AND column_name IN ('projectId','maturityDate','recallFrom','freezeRequestedAt','unfreezeRequestedAt','activeChain')
       ORDER BY column_name`,
      isolatedUrl(),
    );
    expect(columns.map((row) => row.column_name)).toEqual([
      'activeChain', 'freezeRequestedAt', 'maturityDate', 'projectId', 'recallFrom', 'unfreezeRequestedAt',
    ]);
    const indexes = await admin<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='SettlementRound'`,
      isolatedUrl(),
    );
    expect(indexes.map((row) => row.indexname)).toContain('SettlementRound_activeChain_key');
  });

  it('ghi 1.001 hồ sơ theo lô, chiếm nguyên tử, chặn mở đóng băng sau burn và đóng dự án cùng đợt', async () => {
    const { getProjectStore, getSettlementStore, getStore } = await stores();
    const projects = getProjectStore();
    const settlement = getSettlementStore();
    const project = (await projects.listProjects({ chain: 'mock' }))[0];
    expect(await projects.markIssued({ id: project.id, issuedAt: new Date().toISOString() })).toMatchObject({ status: 'ISSUED' });

    const opened = await settlement.openRecallRound({
      chain: 'mock', projectId: project.id, maturityDate: '2026-10-24', recallFrom: '2026-10-24',
      noticeDays: 0, openedBy: 'KSV001', reason: 'Kiểm chứng PostgreSQL BE-05',
      audit: { actorRole: 'CONTROLLER', action: 'settlement:initiate', outcome: 'SUCCESS', detail: 'Mở đợt', chain: 'mock' },
    });
    expect((await getStore().listAudit({ limit: 20 })).some((row) =>
      row.target === opened.id && row.action === 'settlement:initiate' && row.outcome === 'SUCCESS' && row.detail === 'Mở đợt',
    )).toBe(true);
    await expect(settlement.openRecallRound({
      chain: 'mock', projectId: project.id, maturityDate: '2026-10-24', recallFrom: '2026-10-24',
      noticeDays: 0, openedBy: 'KSV002', reason: 'Đợt trùng chain phải bị từ chối',
      audit: { actorRole: 'CONTROLLER', action: 'settlement:initiate', outcome: 'SUCCESS', detail: 'Mở trùng', chain: 'mock' },
    })).rejects.toMatchObject({ name: 'UniqueConstraintError' });

    const cases = Array.from({ length: 1_001 }, (_, index) => ({
      holderWallet: `0x${(index + 1).toString(16).padStart(40, '0')}`,
      wptAmount: '1', payoutAmount: '0',
    }));
    expect(await settlement.completeFreeze({
      id: opened.id, frozenAt: new Date().toISOString(), cases,
      audit: { actorRole: 'CONTROLLER', action: 'settlement:recall', target: opened.id, outcome: 'SUCCESS', detail: 'Đóng băng', chain: 'mock' },
    })).toMatchObject({ status: 'IN_PROGRESS' });
    expect(await settlement.listRoundCases({ roundId: opened.id })).toHaveLength(1_001);

    const at = new Date().toISOString();
    const claims = await Promise.all([
      settlement.claimCase({ roundId: opened.id, holderWallet: cases[0].holderWallet, at }),
      settlement.claimCase({ roundId: opened.id, holderWallet: cases[0].holderWallet, at }),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(await settlement.attachBurnTx({ roundId: opened.id, holderWallet: cases[0].holderWallet, txHash: `0x${'ab'.repeat(32)}` })).toBe(true);
    expect(await settlement.settleCase({ roundId: opened.id, holderWallet: cases[0].holderWallet, to: 'FAILED', at, reason: 'revert' })).toMatchObject({ status: 'FAILED' });
    expect(await settlement.claimCase({ roundId: opened.id, holderWallet: cases[0].holderWallet, at })).toMatchObject({ status: 'BURNING', burnTxHash: null });
    expect(await settlement.attachBurnTx({ roundId: opened.id, holderWallet: cases[0].holderWallet, txHash: `0x${'cd'.repeat(32)}` })).toBe(true);
    expect(await settlement.settleCase({ roundId: opened.id, holderWallet: cases[0].holderWallet, to: 'BURNED', at })).toMatchObject({ status: 'BURNED' });
    expect(await settlement.requestUnfreeze({ id: opened.id, at })).toBe(false);

    expect(await settlement.completeRound({
      id: opened.id, projectId: project.id, completedAt: at,
      audit: { actorRole: 'CONTROLLER', action: 'settlement:recall', target: opened.id, outcome: 'SUCCESS', detail: 'Hoàn tất', chain: 'mock' },
    })).toMatchObject({ status: 'COMPLETED', activeChain: null });
    expect((await projects.listProjects({ chain: 'mock' }))[0].status).toBe('CLOSED');
  });
});
