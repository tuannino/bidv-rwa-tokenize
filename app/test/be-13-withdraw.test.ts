import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from 'pg';
import { MOCK_VAULT_ADDRESS, SAMPLE_WALLETS, type ChainKey } from '@bidv/shared';
import type { ILedgerPort, VaultWithdrawalReceipt } from '@/lib/ledger';
import type { IVaultStore } from '@/lib/store';

/**
 * BE-13 ca 8 đến 11 (QĐ-E, QĐ-F) và phần rút của ca 1, trên chain mock. Ca 7 (nút Hardhat thật) ở
 * `be-13-vault-evm.test.ts`.
 *
 * `getLedger` được bọc để đếm số lần gửi `withdraw` (chứng minh "không tự gửi lại") và để dựng biên
 * nhận thành công mà không có sự kiện khớp (ca 11).
 */
const hooks: {
  withdrawCalls: bigint[];
  receiptOverride: ((txHash: string) => VaultWithdrawalReceipt | null) | null;
} = { withdrawCalls: [], receiptOverride: null };

vi.mock('@/lib/ledger', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/ledger')>();
  const instrument = (ledger: ILedgerPort): ILedgerPort =>
    new Proxy(ledger, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (property === 'withdrawFromVault') {
          return async (amount: bigint) => {
            hooks.withdrawCalls.push(amount);
            return target.withdrawFromVault(amount);
          };
        }
        if (property === 'vaultWithdrawalReceipt' && hooks.receiptOverride) {
          const override = hooks.receiptOverride;
          return async (txHash: string) => override(txHash);
        }
        return value;
      },
    });
  return {
    ...mod,
    getLedger: (chain: ChainKey, signer?: Parameters<typeof mod.getLedger>[1]) => instrument(mod.getLedger(chain, signer)),
  };
});

const { resetServerEnvCache } = await import('@/lib/config/env');
const { getLedger, getMockLedgerStateStore } = await import('@/lib/ledger');
const { resetMockLedger, seedMockLedger } = await import('@/lib/ledger/mock.adapter');
const { getStore, getVaultStore, resetMemoryStore, resetStoreCache, UniqueConstraintError } = await import('@/lib/store');
const { createWithdrawRequest, listMyWithdrawRequests, listWithdrawReviews, reconcileWithdrawRequests, resolveWithdrawRequest } =
  await import('@/lib/bank/withdraw.service');
const { saveVaultConfig } = await import('@/lib/bank/vault.service');
const { createMemoryVaultStore } = await import('@/lib/store/memory.vault.store');

const CHAIN = 'mock' as const;
const PAYOUT = SAMPLE_WALLETS.NB001;
const OPERATOR = '0x0000000000000000000000000000000000000001';
let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${(++seq).toString(16).padStart(12, '0')}`;

function actAs(role: string) {
  process.env.DEMO_ROLE = role;
  resetServerEnvCache();
}

const request = (input: Partial<{ amount: string; otp: string; clientRequestId: string; purpose: string; note: string }> = {}) =>
  createWithdrawRequest({
    chain: CHAIN,
    amount: '100',
    purpose: 'Chi trả vận hành',
    note: '',
    otp: '123456',
    clientRequestId: uuid(),
    ...input,
  });

/** Vault mock FIXED khoá 400 trên 1.000 VNDB: được rút 600; ví nhận NB001. */
async function preparedVault(vndb = 1_000n) {
  actAs('CONTROLLER');
  const ledger = getLedger(CHAIN);
  await ledger.whitelist(PAYOUT);
  await seedMockLedger({ paymentBalances: { [MOCK_VAULT_ADDRESS]: vndb } }, getMockLedgerStateStore(CHAIN));
  const saved = await saveVaultConfig({ chain: CHAIN, percent: '20', fixedLock: '400', payoutWallet: PAYOUT });
  expect(saved.ok, saved.ok ? '' : saved.error).toBe(true);
  actAs('SELLER');
  hooks.withdrawCalls = [];
}

const audits = async (action: string) =>
  (await getStore().listAudit({ limit: 200 })).filter((row) => row.action === action);

beforeEach(async () => {
  hooks.withdrawCalls = [];
  hooks.receiptOverride = null;
  process.env.USE_MOCK_DB = 'true';
  await resetMockLedger();
  resetMemoryStore();
  resetStoreCache();
  await preparedVault();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete process.env.DEMO_ROLE;
  delete process.env.USE_MOCK_DB;
  resetServerEnvCache();
  resetStoreCache();
});

describe('BE-13 ca 1 (phần rút): chỉ SELLER tạo lệnh rút, chỉ CONTROLLER xử lý NEEDS_REVIEW', () => {
  for (const role of ['CONTROLLER', 'TELLER', 'INVESTOR', 'UNKNOWN', '', 'null']) {
    it(`vai "${role}" tạo lệnh rút: FORBIDDEN, không gửi gì`, async () => {
      actAs(role);
      const result = await request();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('FORBIDDEN');
      expect(hooks.withdrawCalls).toEqual([]);
    });
  }

  for (const role of ['SELLER', 'TELLER', 'INVESTOR', 'UNKNOWN']) {
    it(`vai "${role}" xử lý NEEDS_REVIEW: FORBIDDEN`, async () => {
      actAs(role);
      const result = await resolveWithdrawRequest({ chain: CHAIN, id: 'x', outcome: 'FAILED', reason: 'r' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('FORBIDDEN');
    });
  }
});

describe('BE-13 rút thành công trên mock', () => {
  it('COMPLETED, ví nhận tăng đúng, withdrawable giảm đúng, Txn và audit có dòng, khoá đã nhả', async () => {
    const before = (await getLedger(CHAIN).vaultStatus())!;
    const payoutBefore = await getLedger(CHAIN).paymentBalanceOf(PAYOUT);
    const created = await request({ amount: '250' });
    expect(created.ok, created.ok ? '' : created.error).toBe(true);
    if (!created.ok) return;
    expect(created.data).toMatchObject({ status: 'COMPLETED', amount: '250', payoutWallet: PAYOUT });
    expect(await getLedger(CHAIN).paymentBalanceOf(PAYOUT)).toBe(payoutBefore + 250n);
    expect((await getLedger(CHAIN).vaultStatus())!.withdrawable).toBe(before.withdrawable - 250n);
    const txn = await getStore().findTxnByHash(CHAIN, created.data.txHash!);
    expect(txn).toMatchObject({ operation: 'vault:withdraw', status: 'CONFIRMED', amount: '250' });
    expect((await audits('vault:withdraw')).some((row) => row.outcome === 'SUCCESS' && row.detail?.includes('hoàn tất'))).toBe(true);
    expect(await getVaultStore().findOperationLock(CHAIN)).toBeNull();
    expect(hooks.withdrawCalls).toEqual([250n]);

    const mine = await listMyWithdrawRequests({ chain: CHAIN });
    expect(mine.ok && mine.data.map((row) => row.id)).toEqual([created.data.id]);
  });
});

describe('BE-13 ca 8: chặn trước khi gửi', () => {
  async function expectBlocked(run: () => ReturnType<typeof request>, code: string, text: string) {
    const nonce = await getLedger(CHAIN).latestBlockNumber();
    const auditCount = (await audits('vault:withdraw')).filter((row) => row.outcome === 'FAILURE').length;
    const result = await run();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(code);
      expect(result.error).toContain(text);
    }
    expect(hooks.withdrawCalls).toEqual([]);
    expect(await getLedger(CHAIN).latestBlockNumber()).toBe(nonce);
    expect((await audits('vault:withdraw')).filter((row) => row.outcome === 'FAILURE').length).toBe(auditCount + 1);
    expect((await listMyWithdrawRequests({ chain: CHAIN })).ok && (await listMyWithdrawRequests({ chain: CHAIN }))).toMatchObject({ data: [] });
  }

  it('vượt withdrawable đúng 1 đồng', async () => {
    await expectBlocked(() => request({ amount: '601' }), 'VALIDATION', 'vượt phần được rút 600');
  });

  it('chưa đặt ví nhận', async () => {
    await resetMockLedger();
    resetMemoryStore();
    await seedMockLedger({ paymentBalances: { [MOCK_VAULT_ADDRESS]: 1_000n } });
    await expectBlocked(() => request(), 'WITHDRAW_STATE', 'chưa có ví nhận');
  });

  it('vault tạm dừng rút', async () => {
    await seedMockLedger({ vaultPaused: true });
    await expectBlocked(() => request(), 'WITHDRAW_STATE', 'tạm dừng');
  });

  it('đã có lệnh dở (khoá WITHDRAW đang giữ)', async () => {
    await getVaultStore().acquireOperationLock({ chain: CHAIN, kind: 'WITHDRAW', refId: 'other', actor: 'NB001' });
    await expectBlocked(() => request(), 'VAULT_BUSY', 'đã có lệnh rút đang dở');
  });

  it('Kiểm soát viên đang lưu cấu hình (khoá CONFIG đang giữ)', async () => {
    await getVaultStore().acquireOperationLock({ chain: CHAIN, kind: 'CONFIG', refId: 'cfg', actor: 'KSV001' });
    await expectBlocked(() => request(), 'VAULT_BUSY', 'đang lưu cấu hình');
  });

  for (const otp of ['12345', '1234567', 'abcdef', '12 456', '']) {
    it(`mã một lần sai dạng "${otp}": từ chối, mã không lọt vào lỗi hay audit`, async () => {
      await expectBlocked(() => request({ otp }), 'VALIDATION', 'sáu chữ số');
      const failure = (await audits('vault:withdraw')).at(-1);
      if (otp) expect(JSON.stringify(failure)).not.toContain(otp);
    });
  }

  it('mã một lần đúng không bao giờ được lưu hay ghi vào audit', async () => {
    const created = await request({ otp: '987654' });
    expect(created.ok).toBe(true);
    const everything = JSON.stringify({
      audits: await getStore().listAudit({ limit: 200 }),
      txns: await getStore().listTxns({ limit: 50 }),
      requests: await getVaultStore().listWithdrawRequests({ chain: CHAIN }),
    });
    expect(everything).not.toContain('987654');
  });
});

describe('BE-13 ca 9: chống trùng và song song', () => {
  it('cùng clientRequestId cùng nội dung trả lệnh cũ, không gửi lần hai; khác nội dung bị từ chối', async () => {
    const id = uuid();
    const first = await request({ clientRequestId: id, amount: '100' });
    expect(first.ok).toBe(true);
    const again = await request({ clientRequestId: id, amount: '100' });
    expect(again.ok && first.ok && again.data.id === first.data.id).toBe(true);
    expect(hooks.withdrawCalls).toEqual([100n]);

    const different = await request({ clientRequestId: id, amount: '101' });
    expect(different.ok).toBe(false);
    if (!different.ok) {
      expect(different.code).toBe('WITHDRAW_STATE');
      expect(different.error).toContain('nội dung khác');
    }
    expect(hooks.withdrawCalls).toEqual([100n]);
  });

  it('hai lệnh song song mỗi lệnh dưới withdrawable nhưng cộng lại vượt: đúng một lệnh được tạo', async () => {
    const results = await Promise.all([request({ amount: '400' }), request({ amount: '400' })]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const loser = results.find((result) => !result.ok);
    expect(loser && !loser.ok && loser.code).toBe('VAULT_BUSY');
    expect(hooks.withdrawCalls).toEqual([400n]);
    expect(await getVaultStore().listWithdrawRequests({ chain: CHAIN })).toHaveLength(1);
  });
});

describe('BE-13 ca 10: mất mã giao dịch', () => {
  async function lostHash() {
    vi.useFakeTimers({ toFake: ['Date'] });
    const start = new Date('2026-10-20T00:00:00Z');
    vi.setSystemTime(start);
    const store = getVaultStore();
    const original = store.transitionWithdrawRequest.bind(store);
    const spy = vi.spyOn(store, 'transitionWithdrawRequest').mockImplementation(async (input) => {
      if (input.to === 'SENT') throw new Error('Mất kết nối cơ sở dữ liệu ngay sau khi gửi (cài cho kiểm thử).');
      return original(input);
    });
    const result = await request({ amount: '300' });
    spy.mockRestore();
    expect(result.ok).toBe(false);
    expect(hooks.withdrawCalls).toEqual([300n]);
    const [lost] = await store.listWithdrawRequests({ chain: CHAIN });
    expect(lost).toMatchObject({ status: 'SENDING', txHash: null });
    return { lost: lost!, start };
  }

  it('đối soát chuyển NEEDS_REVIEW kèm đúng một ứng viên, KHÔNG tự COMPLETED, không gửi lại; lệnh mới bị chặn', async () => {
    const { lost, start } = await lostHash();

    // Chưa quá thời gian chờ biên nhận: đối soát để yên.
    await reconcileWithdrawRequests({ chain: CHAIN });
    expect((await getVaultStore().findWithdrawRequest(lost.id))?.status).toBe('SENDING');

    vi.setSystemTime(new Date(start.getTime() + 31_000));
    const reconciled = await reconcileWithdrawRequests({ chain: CHAIN });
    expect(reconciled.ok).toBe(true);
    const review = await getVaultStore().findWithdrawRequest(lost.id);
    expect(review).toMatchObject({ status: 'NEEDS_REVIEW', txHash: null });
    expect(review?.reason).toContain('1 sự kiện Withdrawn ứng viên');
    expect(hooks.withdrawCalls).toEqual([300n]);

    // Idempotent: chạy lại không thêm audit.
    const count = (await audits('vault:reconcile')).filter((row) => row.outcome === 'FAILURE').length;
    await reconcileWithdrawRequests({ chain: CHAIN });
    expect((await audits('vault:reconcile')).filter((row) => row.outcome === 'FAILURE').length).toBe(count);

    actAs('CONTROLLER');
    const reviews = await listWithdrawReviews({ chain: CHAIN });
    expect(reviews.ok && reviews.data[0]?.candidates).toEqual([
      expect.objectContaining({ to: PAYOUT, amount: '300', operator: OPERATOR }),
    ]);

    actAs('SELLER');
    const blocked = await request({ amount: '1' });
    expect(blocked.ok || blocked.code).toBe('VAULT_BUSY');
    expect(hooks.withdrawCalls).toEqual([300n]);
  });

  it('Kiểm soát viên: mã đúng thì COMPLETED (Txn, audit đúng một lần dù gọi hai lần); mã khác bị từ chối; FAILED cần lý do', async () => {
    const { lost, start } = await lostHash();
    vi.setSystemTime(new Date(start.getTime() + 31_000));
    await reconcileWithdrawRequests({ chain: CHAIN });
    actAs('CONTROLLER');
    const [candidate] = (await listWithdrawReviews({ chain: CHAIN })).ok
      ? ((await listWithdrawReviews({ chain: CHAIN })) as { data: { candidates: { txHash: string }[] }[] }).data[0]!.candidates
      : [];

    // Mã của giao dịch khác (giao dịch cấu hình) bị từ chối.
    const configTx = (await getStore().listTxns({ chain: CHAIN, limit: 50 })).find((txn) => txn.operation.startsWith('vault:set'))!;
    const wrong = await resolveWithdrawRequest({ chain: CHAIN, id: lost.id, outcome: 'COMPLETED', txHash: configTx.txHash });
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.code).toBe('WITHDRAW_STATE');

    const noReason = await resolveWithdrawRequest({ chain: CHAIN, id: lost.id, outcome: 'FAILED' });
    expect(noReason.ok).toBe(false);
    if (!noReason.ok) expect(noReason.code).toBe('VALIDATION');

    expect(await getStore().findTxnByHash(CHAIN, candidate!.txHash)).toBeNull();
    const done = await resolveWithdrawRequest({ chain: CHAIN, id: lost.id, outcome: 'COMPLETED', txHash: candidate!.txHash });
    expect(done.ok && done.data).toMatchObject({ status: 'COMPLETED', txHash: candidate!.txHash });
    const twice = await resolveWithdrawRequest({ chain: CHAIN, id: lost.id, outcome: 'COMPLETED', txHash: candidate!.txHash });
    expect(twice.ok).toBe(true);
    expect(await getStore().findTxnByHash(CHAIN, candidate!.txHash)).toMatchObject({ operation: 'vault:withdraw', status: 'CONFIRMED' });
    const successes = (await audits('vault:reconcile')).filter((row) => row.outcome === 'SUCCESS');
    expect(successes).toHaveLength(1);
    expect(await getVaultStore().findOperationLock(CHAIN)).toBeNull();
    expect(hooks.withdrawCalls).toEqual([300n]);
  });

  it('Kiểm soát viên đánh dấu FAILED có lý do: khoá nhả, lệnh mới tạo được', async () => {
    const { lost, start } = await lostHash();
    vi.setSystemTime(new Date(start.getTime() + 31_000));
    await reconcileWithdrawRequests({ chain: CHAIN });
    actAs('CONTROLLER');
    const failed = await resolveWithdrawRequest({
      chain: CHAIN,
      id: lost.id,
      outcome: 'FAILED',
      reason: 'Đã kiểm explorer, không có giao dịch',
    });
    expect(failed.ok && failed.data).toMatchObject({ status: 'FAILED', reason: 'Đã kiểm explorer, không có giao dịch' });
    actAs('SELLER');
    expect((await request({ amount: '1' })).ok).toBe(true);
  });
});

describe('BE-13 ca 11: biên nhận thành công nhưng không có sự kiện khớp', () => {
  it('NEEDS_REVIEW, không COMPLETED, khoá vẫn giữ', async () => {
    hooks.receiptOverride = (txHash) => ({ txHash, status: 'CONFIRMED', withdrawals: [] });
    const result = await request({ amount: '200' });
    expect(result.ok && result.data.status).toBe('NEEDS_REVIEW');
    expect(result.ok && result.data.reason).toContain('không có sự kiện Withdrawn');
    expect((await getVaultStore().findOperationLock(CHAIN))?.kind).toBe('WITHDRAW');
  });

  it('sự kiện tới ví khác hoặc sai số tiền cũng không khớp', async () => {
    hooks.receiptOverride = (txHash) => ({
      txHash,
      status: 'CONFIRMED',
      withdrawals: [
        { to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', amount: 200n, operator: OPERATOR, txHash, blockNumber: 1n, logIndex: 0 },
        { to: PAYOUT, amount: 199n, operator: OPERATOR, txHash, blockNumber: 1n, logIndex: 1 },
      ],
    });
    const result = await request({ amount: '200' });
    expect(result.ok && result.data.status).toBe('NEEDS_REVIEW');
  });

  it('biên nhận revert: FAILED, khoá nhả', async () => {
    hooks.receiptOverride = (txHash) => ({ txHash, status: 'FAILED', withdrawals: [] });
    const result = await request({ amount: '200' });
    expect(result.ok && result.data.status).toBe('FAILED');
    expect(await getVaultStore().findOperationLock(CHAIN)).toBeNull();
  });
});

/** Ràng buộc của bảng lệnh rút ở chính tầng lưu trữ: bản bộ nhớ nghiêm ngang Postgres (ca 9). */
function withdrawStoreContract(label: string, makeStore: () => IVaultStore, chain: ChainKey) {
  describe(`BE-13 ca 9: ràng buộc WithdrawRequest, ${label}`, () => {
    let store: IVaultStore;
    const base = (id: string, clientRequestId: string) => ({
      id,
      chain,
      clientRequestId,
      amount: '10',
      purpose: 'p',
      note: null,
      payoutWallet: PAYOUT,
      claimedBlock: '7',
      createdBy: 'NB001',
    });
    beforeEach(() => {
      store = makeStore();
    });

    it('một lệnh đang dở mỗi chain (activeChain); về trạng thái cuối thì nhả chỗ', async () => {
      const tag = `${Date.now()}${Math.random()}`;
      const first = await store.createWithdrawRequest(base(`a-${tag}`, `c1-${tag}`));
      await expect(store.createWithdrawRequest(base(`b-${tag}`, `c2-${tag}`))).rejects.toMatchObject({
        name: 'UniqueConstraintError',
        columns: ['activeChain'],
      });
      await store.transitionWithdrawRequest({ id: first.id, from: 'SENDING', to: 'SENT', txHash: `0x${tag.replace(/\D/g, '').padEnd(64, '1').slice(0, 64)}` });
      const done = await store.transitionWithdrawRequest({ id: first.id, from: 'SENT', to: 'COMPLETED' });
      expect(done).toMatchObject({ status: 'COMPLETED', activeChain: null });
      expect(done?.completedAt).not.toBeNull();
      const second = await store.createWithdrawRequest(base(`b-${tag}`, `c2-${tag}`));
      expect(second.activeChain).toBe(chain);
      await store.transitionWithdrawRequest({ id: second.id, from: 'SENDING', to: 'FAILED', reason: 'x' });
    });

    it('trùng (chain, clientRequestId) và trùng txHash bị chặn; chuyển ngoài bảng bị chặn; sai from trả null', async () => {
      const tag = `${Date.now()}${Math.random()}`;
      const hash = `0x${'ab'.repeat(31)}${tag.replace(/\D/g, '').slice(-2).padStart(2, '0')}`;
      const first = await store.createWithdrawRequest(base(`d-${tag}`, `dup-${tag}`));
      await store.transitionWithdrawRequest({ id: first.id, from: 'SENDING', to: 'FAILED', reason: 'x' });
      await expect(store.createWithdrawRequest(base(`e-${tag}`, `dup-${tag}`))).rejects.toBeInstanceOf(UniqueConstraintError);

      const second = await store.createWithdrawRequest(base(`f-${tag}`, `g-${tag}`));
      expect(await store.transitionWithdrawRequest({ id: second.id, from: 'SENT', to: 'COMPLETED' })).toBeNull();
      await expect(store.transitionWithdrawRequest({ id: second.id, from: 'SENDING', to: 'COMPLETED' })).rejects.toThrow(
        'không chuyển được',
      );
      await store.transitionWithdrawRequest({ id: second.id, from: 'SENDING', to: 'SENT', txHash: hash });
      await store.transitionWithdrawRequest({ id: second.id, from: 'SENT', to: 'NEEDS_REVIEW', reason: 'r' });
      await store.transitionWithdrawRequest({ id: second.id, from: 'NEEDS_REVIEW', to: 'FAILED', reason: 'r' });

      const third = await store.createWithdrawRequest(base(`h-${tag}`, `i-${tag}`));
      await expect(store.transitionWithdrawRequest({ id: third.id, from: 'SENDING', to: 'SENT', txHash: hash })).rejects.toMatchObject({
        columns: ['txHash'],
      });
      await store.transitionWithdrawRequest({ id: third.id, from: 'SENDING', to: 'FAILED', reason: 'x' });
    });
  });
}

withdrawStoreContract('bộ nhớ', () => createMemoryVaultStore(), CHAIN);

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const DB_NAME = `bidv_be13_wd_${process.pid}`;

describe.skipIf(!TEST_DATABASE_URL)('Postgres thật (database riêng của tệp)', () => {
  const previous = { DATABASE_URL: process.env.DATABASE_URL };
  const admin = async (sql: string) => {
    const client = new Client({ connectionString: TEST_DATABASE_URL });
    await client.connect();
    try {
      await client.query(sql);
    } finally {
      await client.end();
    }
  };
  const isolatedUrl = () => {
    const url = new URL(TEST_DATABASE_URL!);
    url.pathname = `/${DB_NAME}`;
    return url.toString();
  };

  beforeAll(async () => {
    await admin(`DROP DATABASE IF EXISTS "${DB_NAME}"`);
    await admin(`CREATE DATABASE "${DB_NAME}"`);
  });

  afterAll(async () => {
    if (previous.DATABASE_URL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous.DATABASE_URL;
    resetServerEnvCache();
    await admin(`DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`);
  });

  withdrawStoreContract(
    'Postgres',
    () => {
      process.env.DATABASE_URL = isolatedUrl();
      process.env.USE_MOCK_DB = 'false';
      resetServerEnvCache();
      resetStoreCache();
      return getVaultStore();
    },
    'hardhat-local',
  );

  it('hai lệnh rút song song qua service trên Postgres: đúng một lệnh được tạo', async () => {
    process.env.DATABASE_URL = isolatedUrl();
    process.env.USE_MOCK_DB = 'false';
    resetServerEnvCache();
    resetStoreCache();
    // USE_MOCK_DB=false đưa cả MockLedgerState vào Postgres: dựng lại vault mock trên database riêng này.
    await preparedVault();
    const results = await Promise.all([request({ amount: '400' }), request({ amount: '400' })]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(hooks.withdrawCalls).toEqual([400n]);
    const rows = await getVaultStore().listWithdrawRequests({ chain: CHAIN });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('COMPLETED');
  });
});
