import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WPT_ISSUE_PRICE_VND } from '@/lib/config/issue-terms';
import { resetServerEnvCache } from '@/lib/config/env';
import { resetMockLedger, seedMockLedger } from '@/lib/ledger/mock.adapter';
import { getStore, resetMemoryStore, resetStoreCache } from '@/lib/store';

/**
 * FE-07: màn "Giá và phát hành" (ca 7) và MỘT NGUỒN GIÁ cho màn khách hàng (ca 8, lệch L-02).
 *
 * Chạy trên chain `mock`, bộ nhớ. Ca 8 cần một chain chốt lệnh theo giá trên hợp đồng mà giá đó
 * KHÁC giá trong database: khai địa chỉ OrderSettlement cho `mock` qua biến môi trường (cùng đường
 * `findContractAddress` đọc ở mọi chain), rồi đặt giá trong state ledger mock khác giá cấu hình.
 */

const CHAIN = 'mock';
const ALICE = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const ORDER_SETTLEMENT_ENV = 'NEXT_PUBLIC_ADDR_MOCK_ORDER_SETTLEMENT';
const DEFAULT_PRICE = BigInt(WPT_ISSUE_PRICE_VND);

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
  delete process.env.DEMO_ROLE;
  delete process.env.USE_MOCK_DB;
  delete process.env[ORDER_SETTLEMENT_ENV];
  resetServerEnvCache();
  resetStoreCache();
});

const auditCount = async () => (await getStore().listAudit({ limit: 500 })).length;

describe('FE-07 ca 7: getPriceConfigOverviewAction', () => {
  it('trả đủ bốn khối, canEdit đúng theo vai, không thêm dòng AuditLog nào', async () => {
    const { getPriceConfigOverviewAction } = await import('@/app/actions/config');
    const before = await auditCount();

    const teller = await getPriceConfigOverviewAction({ chain: CHAIN });
    actAs('CONTROLLER');
    const controller = await getPriceConfigOverviewAction({ chain: CHAIN });

    expect(await auditCount(), 'mở màn là phép đọc, không ghi sổ kiểm toán').toBe(before);
    expect(teller.ok, teller.ok ? '' : teller.error).toBe(true);
    expect(controller.ok, controller.ok ? '' : controller.error).toBe(true);
    if (!teller.ok || !controller.ok) return;

    expect(teller.data.canEdit).toBe(true);
    expect(controller.data.canEdit).toBe(false);

    const { price, issuance, history, inFlightOrders, thresholdTimes } = teller.data;
    expect(price.ok && price.data).toMatchObject({
      priceVnd: DEFAULT_PRICE.toString(),
      configuredPriceVnd: DEFAULT_PRICE.toString(),
      warning: null,
      onChain: false,
    });
    expect(thresholdTimes).toBeGreaterThan(1);
    expect(issuance.ok && issuance.data).toMatchObject({ tokenSymbol: 'WPT', overCap: false });
    expect(history).toEqual([]);
    expect(inFlightOrders).toEqual({ PLACED: 0, CHECKING: 0, EXECUTING: 0 });
  });

  it('lịch sử đổi giá tách mã giao dịch khỏi lý do; vai khách hàng không mở được màn', async () => {
    const { getPriceConfigOverviewAction, setIssuePriceAction } = await import('@/app/actions/config');
    const next = ((DEFAULT_PRICE * 12n) / 10n).toString();
    const changed = await setIssuePriceAction({ chain: CHAIN, priceVnd: next, reason: 'điều chỉnh theo quyết định' });
    expect(changed.ok, changed.ok ? '' : changed.error).toBe(true);
    if (!changed.ok) return;

    const overview = await getPriceConfigOverviewAction({ chain: CHAIN });
    expect(overview.ok && overview.data.history).toEqual([
      expect.objectContaining({
        changedBy: 'TELLER',
        oldValue: DEFAULT_PRICE.toString(),
        newValue: next,
        reason: 'điều chỉnh theo quyết định',
        txHash: changed.data.txHash,
      }),
    ]);

    actAs('INVESTOR');
    const denied = await getPriceConfigOverviewAction({ chain: CHAIN });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.code).toBe('FORBIDDEN');
  });
});

describe('FE-07 ca 8: giá trên chuỗi khác database thì mọi màn khách hàng hiện giá trên chuỗi', () => {
  it('readEffectiveIssuePrice, getPortfolio, getTokenSummary, getSellerOverview, /trade cùng một con số', async () => {
    const onChain = DEFAULT_PRICE + 23_456n;
    process.env[ORDER_SETTLEMENT_ENV] = '0x00000000000000000000000000000000000000f7';
    await seedMockLedger({ wptPriceVnd: onChain });

    const { readEffectiveIssuePrice } = await import('@/lib/bank/issue-price');
    const { readIssuePriceVnd } = await import('@/lib/store/config-values');
    const { getIssuePrice } = await import('@/lib/bank/config.service');
    expect(await readIssuePriceVnd(CHAIN), 'database vẫn là giá cũ').toBe(DEFAULT_PRICE);
    expect(await readEffectiveIssuePrice(CHAIN)).toBe(onChain);
    expect((await getIssuePrice(CHAIN)).warning).toMatch(/khác giá đã cấu hình/);

    const { getPortfolio, getTokenSummary } = await import('@/lib/bank/portfolio.service');
    const { getTradeContext } = await import('@/lib/bank/trade.service');
    const { getSellerOverview } = await import('@/lib/bank/seller.service');

    actAs('INVESTOR');
    const portfolio = await getPortfolio({ chain: CHAIN, wallet: ALICE });
    const summary = await getTokenSummary(CHAIN);
    const trade = await getTradeContext({ chain: CHAIN, wallet: ALICE });
    actAs('SELLER');
    const seller = await getSellerOverview({ chain: CHAIN });

    for (const result of [portfolio, summary, trade, seller]) {
      expect(result.ok, result.ok ? '' : result.error).toBe(true);
    }
    if (!portfolio.ok || !summary.ok || !trade.ok || !seller.ok) return;
    const expected = onChain.toString();
    expect(portfolio.data.issuePriceVnd).toBe(expected);
    expect(summary.data.issuePriceVnd).toBe(expected);
    expect(trade.data.token?.issuePriceVnd).toBe(expected);
    expect(trade.data.priceVnd).toBe(expected);
    expect(seller.data.tokens[0]?.issuePriceVnd).toBe(expected);
  });
});
