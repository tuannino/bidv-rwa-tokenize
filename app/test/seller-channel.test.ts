import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG_KEYS } from '@/lib/config/issue-terms';
import { resetServerEnvCache } from '@/lib/config/env';
import { resetMockLedger, seedMockLedger } from '@/lib/ledger/mock.adapter';
import { computeWithdrawLimit, quoteWithdraw } from '@/lib/bank/withdraw-limit';
import { getConfigStore, getOrderStore, resetMemoryStore, resetStoreCache } from '@/lib/store';

/**
 * FE-21 — kênh Người bán, tầng nghiệp vụ. Chuỗi `mock`, bộ lưu trữ trong bộ nhớ.
 * Ca 5 ở tầng route đã do `four-roles-routes.test.ts` chốt; ở đây chốt tầng service.
 */

const CHAIN = 'mock';
const SPV = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
const INVESTOR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

function actAs(role: string) {
  process.env.DEMO_ROLE = role;
  resetServerEnvCache();
}

const service = () => import('@/lib/bank/seller.service');

async function ledger() {
  const { getLedger } = await import('@/lib/ledger');
  return getLedger(CHAIN);
}

/**
 * Phát hành bằng Giao dịch viên, chuyển `out` WPT ra ví nhà đầu tư, rồi quay về Người bán.
 *
 * FE-22: phát hành trực tiếp là đường DỮ LIỆU THỬ, sau hai lớp chặn `demo:mint-token` + cờ
 * `ENABLE_DEMO_TOKEN_MINT`. Bật cờ đúng trong lúc dựng nền rồi tắt, cùng cách `token-request.test.ts`.
 */
async function issueAndDistribute(amount: bigint, out: bigint) {
  const { issueInitialSupply } = await import('@/lib/bank/issuance.service');
  process.env.ENABLE_DEMO_TOKEN_MINT = 'true';
  actAs('TELLER');
  const result = await issueInitialSupply({ chain: CHAIN, spvWallet: SPV, amount: String(amount) });
  delete process.env.ENABLE_DEMO_TOKEN_MINT;
  expect(result.ok, result.ok ? '' : result.error).toBe(true);
  const l = await ledger();
  await l.whitelist(INVESTOR);
  if (out > 0n) await l.transfer(SPV, INVESTOR, out);
  actAs('SELLER');
}

async function setConfig(key: string, value: string) {
  await getConfigStore().setConfig({ key, value, type: 'string', changedBy: 'TELLER' });
}

async function order(
  status: 'COMPLETED' | 'PLACED' | 'REJECTED',
  wpt: string,
  vnd: string,
  wallet = INVESTOR,
  side: 'BUY' | 'SELL' = 'BUY',
) {
  return getOrderStore().createOrder({
    chain: CHAIN,
    investorWallet: wallet,
    side,
    wptAmount: wpt,
    vndAmount: vnd,
    actorRole: 'INVESTOR',
    status,
  });
}

beforeEach(async () => {
  resetMockLedger();
  resetMemoryStore();
  resetStoreCache();
  process.env.USE_MOCK_DB = 'true';
  actAs('TELLER');
  await (await ledger()).whitelist(SPV);
  actAs('SELLER');
});

afterEach(() => {
  delete process.env.DEMO_ROLE;
  delete process.env.USE_MOCK_DB;
  resetServerEnvCache();
  resetStoreCache();
});

describe('ca 1 — Tổng quan đủ sáu khối, số liệu lấy từ nghiệp vụ', () => {
  it('nguồn cung khớp màn Giao dịch viên (getIssuanceStatus) và chuỗi', async () => {
    await issueAndDistribute(1_000n, 300n);
    seedMockLedger({ paymentBalances: { [SPV]: 5_000n }, profitPool: 700n });
    await order('COMPLETED', '10', '1000');
    await order('COMPLETED', '5', '500');
    await order('PLACED', '99', '9900');

    const { getSellerOverview } = await service();
    const result = await getSellerOverview({ chain: CHAIN });
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    const view = result.data;

    // khối 1 — khớp trong ngày: chỉ lệnh COMPLETED
    // BE-14: `sell` hết là `null` — chưa có lệnh bán nào nên ba số 0.
    expect(view.today).toEqual({
      buyCount: 2,
      buyWpt: '15',
      buyVnd: '1500',
      sell: { count: 0, wpt: '0', vnd: '0' },
    });

    // khối 2, 3, 4 — nguồn cung, thông tin token, tồn kho
    expect(view.tokens).toHaveLength(1);
    const [token] = view.tokens;
    const { getIssuanceStatus } = await import('@/lib/bank/issuance.service');
    actAs('TELLER');
    const teller = await getIssuanceStatus({ chain: CHAIN });
    expect(teller.ok).toBe(true);
    if (!teller.ok) return;
    expect(token.cap).toBe(teller.data.plannedTotalSupply);
    expect(token.totalSupply).toBe(teller.data.totalSupplyOnChain);
    expect(token.remaining).toBe(teller.data.remainingCap);
    expect(token.undistributed).toBe('700');
    expect(token.circulating).toBe('300');
    expect(token.tradingOpen).toBe(true);
    expect(token.tokenStatus).toBe('ISSUED');

    // khối 5, 6 — ví: chưa cấu hình hạn mức thì không tự đặt
    expect(view.spvWallet?.toLowerCase()).toBe(SPV.toLowerCase());
    expect(view.wallet).toMatchObject({
      paymentVnd: '5000',
      profitPoolVnd: '700',
      lockedVnd: null,
      withdrawableVnd: null,
      policy: null,
      withdrawFeeVnd: null,
    });
  });
});

describe('ca 2 — Danh sách giao dịch lọc theo từng tiêu chí và phân trang', () => {
  it('lọc theo mã lệnh / nhà đầu tư, trạng thái, loại, khoảng ngày; phân trang', async () => {
    const other = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
    const a = await order('COMPLETED', '1', '100');
    await order('PLACED', '2', '200');
    await order('REJECTED', '3', '300', other);

    const { listSellerTransactions } = await service();
    const list = async (extra: Record<string, unknown>) => {
      const r = await listSellerTransactions({ chain: CHAIN, ...extra });
      expect(r.ok, r.ok ? '' : r.error).toBe(true);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    };

    expect((await list({})).total).toBe(3);
    expect((await list({ q: a.id })).rows.map((r) => r.id)).toEqual([a.id]);
    expect((await list({ q: other.slice(2, 12).toLowerCase() })).total).toBe(1);
    expect((await list({ status: 'PLACED' })).rows.map((r) => r.wptAmount)).toEqual(['2']);
    expect((await list({ type: 'BUY' })).total).toBe(3);

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    expect((await list({ from: today, to: today })).total).toBe(3);
    expect((await list({ to: '2000-01-01' })).total).toBe(0);

    const page1 = await list({ pageSize: 2, page: 1 });
    const page2 = await list({ pageSize: 2, page: 2 });
    expect([page1.rows.length, page2.rows.length, page1.total]).toEqual([2, 1, 3]);
    expect(new Set([...page1.rows, ...page2.rows].map((r) => r.id)).size).toBe(3);
  });
});

describe('BE-14 — lệnh bán tách khỏi lệnh mua ở kênh Người bán', () => {
  it('Tổng quan đếm lệnh bán vào ô bán, không cộng vào ô mua', async () => {
    await issueAndDistribute(1_000n, 300n);
    await order('COMPLETED', '10', '1000');
    await order('COMPLETED', '4', '400', INVESTOR, 'SELL');
    await order('PLACED', '7', '700', INVESTOR, 'SELL');

    const { getSellerOverview } = await service();
    const result = await getSellerOverview({ chain: CHAIN });
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.data.today).toEqual({
      buyCount: 1,
      buyWpt: '10',
      buyVnd: '1000',
      sell: { count: 1, wpt: '4', vnd: '400' },
    });
  });

  it('Danh sách giao dịch mang đúng loại và lọc được theo loại', async () => {
    await order('COMPLETED', '1', '100');
    const sale = await order('COMPLETED', '2', '200', INVESTOR, 'SELL');

    const { listSellerTransactions } = await service();
    const sells = await listSellerTransactions({ chain: CHAIN, type: 'SELL' });
    expect(sells.ok && sells.data.rows.map((r) => [r.id, r.type])).toEqual([[sale.id, 'SELL']]);
    const buys = await listSellerTransactions({ chain: CHAIN, type: 'BUY' });
    expect(buys.ok && buys.data.rows.map((r) => r.type)).toEqual(['BUY']);
  });
});

describe('ca 3 — vượt hạn mức thì báo vượt', () => {
  it('quoteWithdraw: đúng bằng hạn mức thì được, hơn một đồng thì vượt; trừ phí ra số nhận', () => {
    expect(quoteWithdraw('600', '600', '10')).toEqual({ receivedVnd: '590', exceedsLimit: false });
    expect(quoteWithdraw('601', '600', '10').exceedsLimit).toBe(true);
    expect(quoteWithdraw('5', '600', '10').receivedVnd).toBeNull();
    expect(quoteWithdraw('abc', '600', '10')).toEqual({ receivedVnd: null, exceedsLimit: false });
  });
});

describe('ca 4 — đổi chế độ hạn mức trong cấu hình thì hạn mức đổi theo', () => {
  it('FIXED khoá số cố định, PERCENT khoá phần trăm số dư; giá trị hỏng = chưa cấu hình', async () => {
    await issueAndDistribute(10n, 0n);
    seedMockLedger({ paymentBalances: { [SPV]: 1_000n } });
    const { getSellerOverview } = await service();
    const wallet = async () => {
      const r = await getSellerOverview({ chain: CHAIN });
      if (!r.ok) throw new Error(r.error);
      return r.data.wallet;
    };

    await setConfig(CONFIG_KEYS.sellerWithdrawLimitMode, 'FIXED');
    await setConfig(CONFIG_KEYS.sellerWithdrawLimitValue, '250');
    await setConfig(CONFIG_KEYS.sellerWithdrawFeeVnd, '5');
    expect(await wallet()).toMatchObject({ lockedVnd: '250', withdrawableVnd: '750', withdrawFeeVnd: '5' });

    await setConfig(CONFIG_KEYS.sellerWithdrawLimitMode, 'PERCENT');
    await setConfig(CONFIG_KEYS.sellerWithdrawLimitValue, '30');
    expect(await wallet()).toMatchObject({
      lockedVnd: '300',
      withdrawableVnd: '700',
      policy: { mode: 'PERCENT', lockedPercent: 30 },
    });

    await setConfig(CONFIG_KEYS.sellerWithdrawLimitValue, '130');
    expect((await wallet()).withdrawableVnd).toBeNull();
  });

  it('phần khoá không vượt số dư, làm tròn lên', () => {
    expect(computeWithdrawLimit('100', { mode: 'FIXED', lockedVnd: '500' })).toEqual({
      lockedVnd: '100',
      withdrawableVnd: '0',
    });
    expect(computeWithdrawLimit('101', { mode: 'PERCENT', lockedPercent: 10 }).lockedVnd).toBe('11');
  });
});

describe('ca 5 — vai khác gọi thẳng service Người bán đều bị chặn', () => {
  for (const role of ['INVESTOR', 'TELLER', 'CONTROLLER']) {
    it(`${role}: FORBIDDEN ở cả hai service`, async () => {
      actAs(role);
      const { getSellerOverview, listSellerTransactions } = await service();
      const results = await Promise.all([
        getSellerOverview({ chain: CHAIN }),
        listSellerTransactions({ chain: CHAIN }),
      ]);
      expect(results.map((r) => (r.ok ? 'ok' : r.code))).toEqual(['FORBIDDEN', 'FORBIDDEN']);
    });
  }
});
