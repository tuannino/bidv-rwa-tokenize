import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  WPT_ANNUAL_YIELD_PERCENT,
  WPT_ISSUE_PRICE_VND,
  WPT_REMAINING_LIFETIME_YEARS,
  WPT_TRADING_FEE_PERCENT,
} from '@/lib/config/issue-terms';
import { resetServerEnvCache } from '@/lib/config/env';
import { formatAmount } from '@/lib/format';
import { resetMockLedger, seedMockLedger } from '@/lib/ledger/mock.adapter';
import { resetMemoryStore, resetStoreCache } from '@/lib/store';
import { ROLES, can } from '@/lib/rbac';
import { AREA_GATES } from '@/lib/rbac/area-gates';
import type { OrderView } from '@/lib/bank/purchase.service';
import { ORDER_STATUSES } from '@/lib/store/order.store.port';
import {
  ORDER_COLUMNS,
  ORDER_STATUS_LABELS,
  confirmBlockReason,
  isSettled,
  orderQueryOf,
  quantityBlockReason,
  sortOrders,
  unitPriceOf,
  type TradePreviewState,
} from '@/components/trading/gates';

/**
 * FE-25: màn Giao dịch token và Quản lý lệnh của Nhà đầu tư.
 *
 * Vitest chạy môi trường `node`, không dựng DOM. Mỗi ca kiểm ở hai tầng mà màn hình đứng lên, cùng
 * cách FE-22: (1) phép đọc / ghi của máy chủ màn hình gọi (`trade.service`, `purchase.service`), (2)
 * hàm thuần ở `components/trading/gates.ts` quyết định ô nào chặn, nút nào khoá.
 *
 * Chuỗi `mock` + bộ lưu trữ trong bộ nhớ. Giá đọc từ `WPT_ISSUE_PRICE_VND`, không gõ số. Nguồn cung
 * phát hành bằng đường dữ liệu thử (`issueInitialSupply` sau hai lớp chặn), cùng cách
 * `seller-channel.test.ts`, để bảng dự án chuyển `ISSUED` như ngoài đời.
 */

const CHAIN = 'mock';
const SPV = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
const ALICE = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const BOB = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const PRICE = BigInt(WPT_ISSUE_PRICE_VND);

function actAs(role: string) {
  process.env.DEMO_ROLE = role;
  resetServerEnvCache();
}

const trade = () => import('@/lib/bank/trade.service');
const purchase = () => import('@/lib/bank/purchase.service');

async function ledger() {
  const { getLedger } = await import('@/lib/ledger');
  return getLedger(CHAIN);
}

/** Phát hành `supply` vào ví SPV và cấp KYC + `vndb` VNDB (kèm uỷ quyền) cho các ví nhà đầu tư. */
async function seed(supply: bigint, vndb: bigint, investors: string[] = [ALICE]) {
  const { issueInitialSupply } = await import('@/lib/bank/issuance.service');
  actAs('TELLER');
  const l = await ledger();
  await l.whitelist(SPV);
  process.env.ENABLE_DEMO_TOKEN_MINT = 'true';
  const issued = await issueInitialSupply({ chain: CHAIN, spvWallet: SPV, amount: String(supply) });
  delete process.env.ENABLE_DEMO_TOKEN_MINT;
  expect(issued.ok, issued.ok ? '' : issued.error).toBe(true);
  for (const wallet of investors) {
    await l.whitelist(wallet);
    seedMockLedger({ paymentBalances: { [wallet]: vndb }, paymentAllowances: { [wallet]: vndb } });
  }
  actAs('INVESTOR');
}

async function context(wallet = ALICE) {
  const { getTradeContext } = await trade();
  const result = await getTradeContext({ chain: CHAIN, wallet });
  expect(result.ok, result.ok ? '' : result.error).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

async function preview(wptAmount: string, side: 'BUY' | 'SELL' = 'BUY', wallet = ALICE) {
  const { previewTrade } = await trade();
  const result = await previewTrade({ chain: CHAIN, investorWallet: wallet, wptAmount, side });
  expect(result.ok, result.ok ? '' : result.error).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

/** Kết quả kiểm tra dưới dạng trạng thái màn hình giữ. */
const asState = (data: Awaited<ReturnType<typeof preview>>): TradePreviewState => ({ kind: 'checked', ...data });

/** Đặt lệnh như màn hình (vai INVESTOR), trả lệnh. */
async function place(wptAmount: string, side: 'BUY' | 'SELL' = 'BUY', wallet = ALICE): Promise<OrderView> {
  const { placeOrder } = await purchase();
  actAs('INVESTOR');
  const result = await placeOrder({ chain: CHAIN, investorWallet: wallet, wptAmount, side });
  expect(result.ok, result.ok ? '' : result.error).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

/** Ngân hàng khớp lệnh (vai TELLER), rồi quay về vai INVESTOR. */
async function execute(orderId: string) {
  const { executeOrder } = await purchase();
  actAs('TELLER');
  const result = await executeOrder({ chain: CHAIN, orderId });
  actAs('INVESTOR');
  expect(result.ok, result.ok ? '' : result.error).toBe(true);
}

async function list(filters: Parameters<typeof orderQueryOf>[2], wallet = ALICE) {
  const { listOrders } = await purchase();
  const result = await listOrders(orderQueryOf(CHAIN, wallet, filters));
  expect(result.ok, result.ok ? '' : result.error).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

const NO_FILTER = { orderId: '', side: '', status: '', fromDate: '', toDate: '' } as const;

beforeEach(() => {
  resetMockLedger();
  resetMemoryStore();
  resetStoreCache();
  process.env.USE_MOCK_DB = 'true';
  actAs('INVESTOR');
});

afterEach(() => {
  delete process.env.DEMO_ROLE;
  delete process.env.USE_MOCK_DB;
  delete process.env.ENABLE_DEMO_TOKEN_MINT;
  resetServerEnvCache();
  resetStoreCache();
});

describe('việc 14: số lượng và số tiền có phân cách hàng nghìn', () => {
  it('dùng chung formatAmount', () => {
    expect(formatAmount('1234567')).toBe('1.234.567');
    expect(formatAmount((12n * PRICE).toString())).toBe((12n * PRICE).toLocaleString('vi-VN'));
  });
});

describe('ca 1: nhập quá trần mua thì ô số lượng tự chặn và hiện lý do', () => {
  it('trần do số dư chia giá: vượt 1 token bị chặn, bằng trần thì qua', async () => {
    await seed(1_000n, 5n * PRICE);
    const ctx = await context();
    expect(ctx.caps.BUY.max).toBe('5');
    expect(ctx.caps.BUY.reason).toMatch(/số dư/);
    expect(ctx.priceVnd).toBe(PRICE.toString());
    expect(ctx.token?.terms).toEqual({
      remainingLifetimeYears: WPT_REMAINING_LIFETIME_YEARS,
      annualYieldPercent: WPT_ANNUAL_YIELD_PERCENT,
      tradingFeePercent: WPT_TRADING_FEE_PERCENT,
    });

    expect(quantityBlockReason('6', 'BUY', ctx.caps)).toMatch(/Vượt trần.*số dư/);
    expect(quantityBlockReason('5', 'BUY', ctx.caps)).toBeNull();
    expect(quantityBlockReason('1.5', 'BUY', ctx.caps)).toMatch(/số nguyên/);
  });

  it('trần do số chưa phân phối khi số dư dư dả', async () => {
    await seed(3n, 100n * PRICE);
    const ctx = await context();
    expect(ctx.caps.BUY.max).toBe('3');
    expect(quantityBlockReason('4', 'BUY', ctx.caps)).toMatch(/chưa phân phối/);
  });
});

describe('ca 2: nhập quá số token đang giữ ở thẻ bán thì bị chặn', () => {
  it('trần bán bằng số đang giữ, đọc từ chuỗi sau khi mua', async () => {
    await seed(1_000n, 10n * PRICE);
    const order = await place('4');
    await execute(order.id);

    const ctx = await context();
    expect(ctx.balances.wpt).toBe('4');
    expect(ctx.caps.SELL.max).toBe('4');
    expect(quantityBlockReason('5', 'SELL', ctx.caps)).toMatch(/Vượt trần.*đang giữ/);
    expect(quantityBlockReason('4', 'SELL', ctx.caps)).toBeNull();
  });
});

describe('ca 3: một điều kiện trước lệnh không đạt thì nút xác nhận bị khoá', () => {
  it('đủ năm điều kiện thì nút mở', async () => {
    await seed(1_000n, 10n * PRICE);
    const ctx = await context();
    const data = await preview('2');
    expect(data.conditions.map((c) => c.key)).toEqual(['account', 'identity', 'wallet', 'token', 'risk']);
    expect(data.canConfirm).toBe(true);
    expect(data.vndAmount).toBe((2n * PRICE).toString());
    expect(confirmBlockReason('2', 'BUY', ctx.caps, asState(data))).toBeNull();
  });

  it('ví bị đóng băng: điều kiện Ví trượt, nút khoá và nêu đúng điều kiện', async () => {
    await seed(1_000n, 10n * PRICE);
    const ctx = await context();
    await (await ledger()).freeze(ALICE, true);

    const data = await preview('2');
    expect(data.conditions.find((c) => c.key === 'wallet')?.passed).toBe(false);
    expect(data.canConfirm).toBe(false);
    expect(confirmBlockReason('2', 'BUY', ctx.caps, asState(data))).toMatch(/Chưa đạt điều kiện: .*Ví/);
  });

  it('ví chưa định danh: điều kiện Định danh trượt', async () => {
    await seed(1_000n, 10n * PRICE, []);
    seedMockLedger({ paymentBalances: { [BOB]: 10n * PRICE }, paymentAllowances: { [BOB]: 10n * PRICE } });
    const data = await preview('1', 'BUY', BOB);
    expect(data.conditions.find((c) => c.key === 'identity')?.passed).toBe(false);
    expect(data.canConfirm).toBe(false);
  });

  it('rủi ro đọc từ bộ kiểm số dư: thiếu uỷ quyền VNDB thì trượt kèm việc cần làm', async () => {
    await seed(1_000n, 10n * PRICE);
    seedMockLedger({ paymentAllowances: { [ALICE]: 0n } });
    const risk = (await preview('2')).conditions.find((c) => c.key === 'risk');
    expect(risk?.passed).toBe(false);
    expect(risk?.detail).toMatch(/Ủy quyền VNDB không đủ/);
    expect(risk?.howToFix).toBeTruthy();
  });

  it('phản hồi kiểm tra của số lượng cũ không mở nút cho số lượng mới', async () => {
    await seed(1_000n, 10n * PRICE);
    const ctx = await context();
    const stale = asState(await preview('2'));
    expect(confirmBlockReason('3', 'BUY', ctx.caps, stale)).toMatch(/Đang kiểm tra/);
  });
});

describe('ca 4: gửi lệnh xong thì số dư và danh sách lệnh cập nhật', () => {
  it('danh sách có lệnh ngay sau khi gửi; ngân hàng khớp xong thì số dư đổi', async () => {
    await seed(1_000n, 10n * PRICE);
    const before = await context();

    const order = await place('3');
    const listed = await list(NO_FILTER);
    expect(listed.map((o) => o.id)).toEqual([order.id]);
    expect(isSettled(listed[0])).toBe(false);

    await execute(order.id);
    const [settled] = await list({ ...NO_FILTER, orderId: order.id });
    expect(isSettled(settled)).toBe(true);
    expect(settled.txHash).toMatch(/^0x[0-9a-f]{64}$/);

    const after = await context();
    expect(BigInt(after.balances.wpt)).toBe(BigInt(before.balances.wpt) + 3n);
    expect(BigInt(after.balances.vndb)).toBe(BigInt(before.balances.vndb) - 3n * PRICE);
  });

  it('lệnh bán đi cùng đường: số dư VNDB tăng sau khi khớp', async () => {
    await seed(1_000n, 10n * PRICE);
    await execute((await place('5')).id);
    const before = await context();

    await execute((await place('2', 'SELL')).id);

    const after = await context();
    expect(BigInt(after.balances.wpt)).toBe(BigInt(before.balances.wpt) - 2n);
    expect(BigInt(after.balances.vndb)).toBe(BigInt(before.balances.vndb) + 2n * PRICE);
  });
});

describe('ca 5: màn chi tiết hiện đủ năm bước kèm mốc thời gian', () => {
  it('lệnh đã khớp: năm bước xong, mỗi bước có mốc; có nhật ký đặt và khớp; nêu rõ quyết toán một bước', async () => {
    await seed(1_000n, 10n * PRICE);
    const order = await place('2');
    await execute(order.id);

    const { getOrderDetail } = await trade();
    const result = await getOrderDetail({ chain: CHAIN, investorWallet: ALICE, orderId: order.id });
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    const { order: detail, audit } = result.data;

    expect(detail.steps).toHaveLength(5);
    expect(detail.steps.every((step) => step.state === 'done' && step.at !== null)).toBe(true);
    expect(detail.settlement.rule).toMatch(/cùng thành công hoặc cùng huỷ/);
    expect(detail.settlement.entries).toHaveLength(4);
    expect(audit.map((entry) => entry.action)).toEqual(expect.arrayContaining(['order:place', 'order:execute']));
  });
});

describe('ca 6: bộ lọc hoạt động theo từng tiêu chí; mọi cột sắp xếp được', () => {
  async function threeOrders() {
    await seed(1_000n, 20n * PRICE);
    const buy1 = await place('5');
    await execute(buy1.id);
    const sell = await place('1', 'SELL');
    const buy2 = await place('2');
    return { buy1, sell, buy2 };
  }

  it('lọc theo chiều, trạng thái, mã lệnh, khoảng ngày', async () => {
    const { buy1, sell, buy2 } = await threeOrders();

    expect((await list({ ...NO_FILTER, side: 'SELL' })).map((o) => o.id)).toEqual([sell.id]);
    expect((await list({ ...NO_FILTER, status: 'COMPLETED' })).map((o) => o.id)).toEqual([buy1.id]);
    expect((await list({ ...NO_FILTER, orderId: buy2.id })).map((o) => o.id)).toEqual([buy2.id]);

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    expect(await list({ ...NO_FILTER, fromDate: today, toDate: today })).toHaveLength(3);
    expect(await list({ ...NO_FILTER, toDate: '2020-01-01' })).toHaveLength(0);
  });

  it('mọi cột sắp xếp được hai chiều, số so theo giá trị', async () => {
    await threeOrders();
    const rows = await list(NO_FILTER);
    // Giá trị của từng cột để kiểm thứ tự; số đổi sang `bigint` để so theo giá trị, không so chuỗi.
    const valueOf: Record<(typeof ORDER_COLUMNS)[number], (o: OrderView) => string | bigint> = {
      id: (o) => o.id,
      createdAt: (o) => o.createdAt,
      updatedAt: (o) => o.updatedAt,
      side: (o) => o.side,
      status: (o) => ORDER_STATUS_LABELS[o.status],
      wptAmount: (o) => BigInt(o.wptAmount),
      vndAmount: (o) => BigInt(o.vndAmount),
      price: (o) => BigInt(unitPriceOf(o)),
    };
    const ordered = (values: Array<string | bigint>, dir: 1 | -1) =>
      values.every((v, i) => i === 0 || (typeof v === 'bigint'
        ? dir * Number((v as bigint) - (values[i - 1] as bigint)) >= 0
        : dir * (v as string).localeCompare(values[i - 1] as string, 'vi') >= 0));
    for (const column of ORDER_COLUMNS) {
      const asc = sortOrders(rows, column, 'asc').map(valueOf[column]);
      const desc = sortOrders(rows, column, 'desc').map(valueOf[column]);
      expect(ordered(asc, 1), `${column} tăng dần`).toBe(true);
      expect(ordered(desc, -1), `${column} giảm dần`).toBe(true);
    }
    // "10" < "9" nếu so chuỗi; so giá trị thì 1 < 2 < 5.
    expect(sortOrders(rows, 'wptAmount', 'asc').map((o) => o.wptAmount)).toEqual(['1', '2', '5']);
  });

  it('bộ lọc trạng thái có đủ bảy trạng thái', () => {
    expect(Object.keys(ORDER_STATUS_LABELS).sort()).toEqual([...ORDER_STATUSES].sort());
  });
});

describe('ca 7: nhà đầu tư không thấy lệnh của ví khác', () => {
  it('danh sách và màn chi tiết đều không lộ lệnh của BOB cho ALICE', async () => {
    await seed(1_000n, 10n * PRICE, [ALICE, BOB]);
    await place('1', 'BUY', ALICE);
    const bobOrder = await place('2', 'BUY', BOB);

    const mine = await list(NO_FILTER, ALICE);
    expect(mine.every((o) => o.investorWallet === ALICE)).toBe(true);
    expect(await list({ ...NO_FILTER, orderId: bobOrder.id }, ALICE)).toHaveLength(0);

    const { getOrderDetail } = await trade();
    const probe = await getOrderDetail({ chain: CHAIN, investorWallet: ALICE, orderId: bobOrder.id });
    expect(probe.ok).toBe(false);
    if (probe.ok) return;
    expect(probe.code).toBe('ORDER_STATE');
  });
});

describe('ca 8: vai khác vào hai màn này bị chặn', () => {
  const INVESTOR_DIR = path.resolve(__dirname, '../src/app/(investor)');

  it('ba trang nằm trong khu vực Nhà đầu tư, chỉ vai INVESTOR qua cổng', () => {
    for (const page of ['trade/page.tsx', 'orders/page.tsx', 'orders/[id]/page.tsx']) {
      expect(existsSync(path.join(INVESTOR_DIR, page)), page).toBe(true);
    }
    for (const role of ROLES) {
      const allowed = AREA_GATES.investor.some((action) => can(role, action));
      expect(allowed, role).toBe(role === 'INVESTOR');
    }
  });

  it('gọi thẳng phép đọc của màn giao dịch bằng vai khác thì bị từ chối', async () => {
    await seed(1_000n, 10n * PRICE);
    const { getTradeContext, previewTrade } = await trade();
    for (const role of ['SELLER', 'TELLER', 'CONTROLLER']) {
      actAs(role);
      const ctx = await getTradeContext({ chain: CHAIN, wallet: ALICE });
      const pre = await previewTrade({ chain: CHAIN, investorWallet: ALICE, wptAmount: '1', side: 'BUY' });
      expect(ctx.ok, role).toBe(false);
      expect(pre.ok, role).toBe(false);
      if (!ctx.ok) expect(ctx.code, role).toBe('FORBIDDEN');
    }
  });

  it('hai trang chỗ trống đã thay, không còn điểm cắm chờ FE-05 / FE-06 trên đó', () => {
    for (const page of ['trade/page.tsx', 'orders/page.tsx']) {
      const source = readFileSync(path.join(INVESTOR_DIR, page), 'utf8');
      expect(source, page).not.toMatch(/PlaceholderPage|@pending/);
    }
  });
});
