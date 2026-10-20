import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOCK_VAULT_ADDRESS, SAMPLE_WALLETS } from '@bidv/shared';
import { saveVaultConfig } from '@/lib/bank/vault.service';
import { getSellerOverview, listSellerTransactions } from '@/lib/bank/seller.service';
import { createWithdrawRequest } from '@/lib/bank/withdraw.service';
import { resetServerEnvCache } from '@/lib/config/env';
import { getLedger } from '@/lib/ledger';
import { resetMockLedger, seedMockLedger } from '@/lib/ledger/mock.adapter';
import { getConfigStore, getOrderStore, getVaultStore, resetMemoryStore, resetStoreCache } from '@/lib/store';

/**
 * BE-13 ca 13 (gỡ hạn mức và phí FE-21, QĐ-H) và ca 14 (danh sách giao dịch Người bán gộp lệnh rút,
 * QĐ-I), trên chain mock và bộ lưu trữ trong bộ nhớ.
 */

const CHAIN = 'mock' as const;
const PAYOUT = SAMPLE_WALLETS.NB001;
const INVESTOR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
let seq = 0;
const uuid = () => `00000000-0000-4000-9000-${(++seq).toString(16).padStart(12, '0')}`;

function actAs(role: string) {
  process.env.DEMO_ROLE = role;
  resetServerEnvCache();
}

const withdraw = (amount: string) =>
  createWithdrawRequest({ chain: CHAIN, amount, purpose: 'Chi trả vận hành', note: '', otp: '000000', clientRequestId: uuid() });

beforeEach(async () => {
  process.env.USE_MOCK_DB = 'true';
  await resetMockLedger();
  resetMemoryStore();
  resetStoreCache();
  actAs('CONTROLLER');
  await getLedger(CHAIN).whitelist(PAYOUT);
  await seedMockLedger({ paymentBalances: { [MOCK_VAULT_ADDRESS]: 1_000n } });
  const saved = await saveVaultConfig({ chain: CHAIN, percent: '20', fixedLock: '400', payoutWallet: PAYOUT });
  expect(saved.ok, saved.ok ? '' : saved.error).toBe(true);
  actAs('SELLER');
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.DEMO_ROLE;
  delete process.env.USE_MOCK_DB;
  resetServerEnvCache();
  resetStoreCache();
});

describe('BE-13 ca 13: gỡ hạn mức và phí FE-21', () => {
  it('ba khoá cũ có giá trị trong database không ảnh hưởng gì; số nhận bằng số rút', async () => {
    const before = await getSellerOverview({ chain: CHAIN });
    for (const [key, value] of [
      ['seller.withdraw_limit_mode', 'PERCENT'],
      ['seller.withdraw_limit_value', '90'],
      ['seller.withdraw_fee_vnd', '50'],
    ]) {
      await getConfigStore().setConfig({ key, value, type: 'string', changedBy: 'TELLER' });
    }
    const after = await getSellerOverview({ chain: CHAIN });
    expect(after.ok && after.data.wallet).toEqual(before.ok && before.data.wallet);
    expect(after.ok && after.data.wallet).toMatchObject({ lockedVnd: '400', withdrawableVnd: '600', payoutWallet: PAYOUT });
    expect(after.ok && after.data.wallet).not.toHaveProperty('withdrawFeeVnd');

    const payoutBefore = await getLedger(CHAIN).paymentBalanceOf(PAYOUT);
    const done = await withdraw('600');
    expect(done.ok && done.data.status).toBe('COMPLETED');
    expect(await getLedger(CHAIN).paymentBalanceOf(PAYOUT)).toBe(payoutBefore + 600n);
  });
});

describe('BE-13 ca 14: danh sách giao dịch Người bán gộp lệnh rút', () => {
  async function order(status: 'COMPLETED' | 'PLACED', wpt: string) {
    return getOrderStore().createOrder({
      chain: CHAIN,
      investorWallet: INVESTOR,
      side: 'BUY',
      wptAmount: wpt,
      vndAmount: (BigInt(wpt) * 100_000n).toString(),
      actorRole: 'INVESTOR',
      status,
    });
  }

  const list = async (input: Record<string, unknown>) => {
    const result = await listSellerTransactions({ chain: CHAIN, ...input });
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) throw new Error(result.error);
    return result.data;
  };

  it('lệnh rút xuất hiện đúng loại, trạng thái, thứ tự mới nhất trước', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T01:00:00Z'));
    const buy = await order('COMPLETED', '3');
    vi.setSystemTime(new Date('2026-10-20T02:00:00Z'));
    const done = await withdraw('100');
    expect(done.ok).toBe(true);
    vi.setSystemTime(new Date('2026-10-20T03:00:00Z'));
    const placed = await order('PLACED', '1');

    const page = await list({});
    expect(page.rows.map((row) => [row.type, row.id, row.status])).toEqual([
      ['BUY', placed.id, 'PLACED'],
      ['WITHDRAW', done.ok && done.data.id, 'COMPLETED'],
      ['BUY', buy.id, 'COMPLETED'],
    ]);
    const row = page.rows[1]!;
    expect(row.type === 'WITHDRAW' && row).toMatchObject({ payoutWallet: PAYOUT, vndAmount: '100', purpose: 'Chi trả vận hành' });
    expect((await list({ type: 'WITHDRAW' })).rows.map((r) => r.type)).toEqual(['WITHDRAW']);
    expect((await list({ type: 'BUY' })).total).toBe(2);
    expect((await list({ q: PAYOUT.slice(2, 12).toLowerCase() })).rows.map((r) => r.type)).toEqual(['WITHDRAW']);
  });

  it('phân trang ổn định khi hai bản ghi cùng thời điểm (thứ tự phụ theo id)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T05:00:00Z'));
    const created = [await order('COMPLETED', '1')];
    const w = await withdraw('10');
    expect(w.ok).toBe(true);
    created.push(await order('COMPLETED', '2'));
    const ids = [...created.map((o) => o.id), w.ok ? w.data.id : ''];
    const expected = [...ids].sort().reverse();

    const pages = [await list({ pageSize: 2, page: 1 }), await list({ pageSize: 2, page: 2 })];
    expect(pages.flatMap((p) => p.rows.map((r) => r.id))).toEqual(expected);
    // Đọc lại cho đúng cùng thứ tự.
    const again = [await list({ pageSize: 2, page: 1 }), await list({ pageSize: 2, page: 2 })];
    expect(again.flatMap((p) => p.rows.map((r) => r.id))).toEqual(expected);
  });

  it('lọc theo trạng thái rút; trạng thái không thuộc loại đang lọc bị từ chối', async () => {
    await order('COMPLETED', '1');
    const done = await withdraw('100');
    expect(done.ok).toBe(true);
    await getVaultStore().acquireOperationLock({ chain: CHAIN, kind: 'WITHDRAW', refId: 'review', actor: 'NB001' });
    // Một lệnh NEEDS_REVIEW dựng thẳng ở tầng lưu trữ (luồng tới trạng thái này đã có ở ca 10, 11).
    const review = await getVaultStore().createWithdrawRequest({
      id: 'review',
      chain: CHAIN,
      clientRequestId: uuid(),
      amount: '5',
      purpose: 'p',
      note: null,
      payoutWallet: PAYOUT,
      claimedBlock: '0',
      createdBy: 'NB001',
    });
    await getVaultStore().transitionWithdrawRequest({ id: review.id, from: 'SENDING', to: 'NEEDS_REVIEW', reason: 'r' });

    expect((await list({ type: 'WITHDRAW', status: 'NEEDS_REVIEW' })).rows.map((r) => r.id)).toEqual(['review']);
    expect((await list({ type: 'WITHDRAW', status: 'COMPLETED' })).rows.map((r) => r.type)).toEqual(['WITHDRAW']);
    // Không lọc loại: COMPLETED khớp cả lệnh mua và lệnh rút.
    expect((await list({ status: 'COMPLETED' })).rows.map((r) => r.type).sort()).toEqual(['BUY', 'WITHDRAW']);
    expect((await list({ status: 'NEEDS_REVIEW' })).total).toBe(1);

    for (const [type, status] of [
      ['WITHDRAW', 'PLACED'],
      ['BUY', 'NEEDS_REVIEW'],
      ['SELL', 'SENT'],
    ]) {
      const result = await listSellerTransactions({ chain: CHAIN, type, status });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('VALIDATION');
    }
  });
});
