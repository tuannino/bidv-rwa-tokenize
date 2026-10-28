import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ILedgerPort } from '@/lib/ledger/ledger.port';
import type { TokenRequestDetailView } from '@/lib/bank/token-request.service';
import { WPT_TOTAL_SUPPLY } from '@/lib/config/issue-terms';
import { MOCK_VAULT_ADDRESS } from '@bidv/shared';

/**
 * FIX-02: Nhà đầu tư không bán (cờ `ENABLE_INVESTOR_SELL`), nhiều yêu cầu Mint cùng lúc, cảnh báo khi
 * duyệt (`approveWarning`), Burn "Toàn bộ nguồn cung" tự điền tổng cung.
 *
 * Chuỗi `mock`, bộ lưu trữ trong bộ nhớ. `vitest.config.ts` bật cờ bán cho cả bộ test (ca bán cũ chạy
 * như trước); ca nào cần cờ tắt thì tự tắt và `afterEach` bật lại.
 */

/**
 * Vỏ bọc `@/lib/ledger`: `getLedger` dựng adapter mới mỗi lần gọi, nên theo dõi đặt ở vỏ bọc: mỗi lời
 * gọi phương thức của cổng (đọc hay ghi) được ghi tên vào `ledgerSpy.calls` khi `ledgerSpy.on` bật.
 * `tokenInfoThrows` giả lỗi đọc tổng cung như các ca `tokenError` của BE-12.
 */
const ledgerSpy = vi.hoisted(() => ({ on: false, calls: [] as string[], tokenInfoThrows: false }));

vi.mock('@/lib/ledger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ledger')>();
  return {
    ...actual,
    getLedger: (...args: Parameters<typeof actual.getLedger>): ILedgerPort => {
      const real = actual.getLedger(...args);
      return new Proxy(real, {
        get(target, prop, receiver) {
          const value = Reflect.get(target, prop, receiver);
          if (typeof value !== 'function') return value;
          return (...callArgs: unknown[]) => {
            if (ledgerSpy.on) ledgerSpy.calls.push(String(prop));
            if (prop === 'tokenInfo' && ledgerSpy.tokenInfoThrows) {
              return Promise.reject(new Error('RPC đọc tổng cung tạm lỗi.'));
            }
            return (value as (...a: unknown[]) => unknown).apply(target, callArgs);
          };
        },
      });
    },
  };
});

const { resetServerEnvCache } = await import('@/lib/config/env');
const { resetMockLedger, seedMockLedger } = await import('@/lib/ledger/mock.adapter');
const { getOrderStore, getStore, getTokenRequestStore, resetMemoryStore, resetStoreCache } = await import('@/lib/store');
const { getLedger } = await import('@/lib/ledger');
const purchase = await import('@/lib/bank/purchase.service');
const { getTradeContext, previewTrade } = await import('@/lib/bank/trade.service');
const tokenRequest = await import('@/lib/bank/token-request.service');
const { tradeSides } = await import('@/components/trading/sides');
const { approveBlockReason, burnAmountShown, burnSourceEffect } = await import('@/components/maker-checker/gates');

const CHAIN = 'mock';
const ALICE = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
/** Ví SPV của luồng mua bán, như `purchase-service.test.ts`. */
const SPV = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
/** Ví nhận Mint của luồng lập duyệt (BE-13 QĐ-G), như `token-request.test.ts`. */
const VAULT = MOCK_VAULT_ADDRESS;
const CAP = BigInt(WPT_TOTAL_SUPPLY);
const SELL_MESSAGE = purchase.INVESTOR_SELL_DISABLED_MESSAGE;

function actAs(role: string, actor?: string) {
  process.env.DEMO_ROLE = role;
  if (actor === undefined) delete process.env.DEMO_ACTOR;
  else process.env.DEMO_ACTOR = actor;
  resetServerEnvCache();
}

function setSellFlag(enabled: boolean) {
  process.env.ENABLE_INVESTOR_SELL = enabled ? 'true' : 'false';
  resetServerEnvCache();
}

beforeEach(() => {
  ledgerSpy.on = false;
  ledgerSpy.calls = [];
  ledgerSpy.tokenInfoThrows = false;
  resetMockLedger();
  resetMemoryStore();
  resetStoreCache();
  process.env.USE_MOCK_DB = 'true';
  setSellFlag(true);
  actAs('INVESTOR');
});

afterEach(() => {
  // Trả cờ về giá trị của `vitest.config.ts` để tệp khác không thấy cờ tắt.
  process.env.ENABLE_INVESTOR_SELL = 'true';
  delete process.env.DEMO_ROLE;
  delete process.env.DEMO_ACTOR;
  delete process.env.USE_MOCK_DB;
  resetServerEnvCache();
  resetStoreCache();
});

// ===========================================================================
//  A. Nhà đầu tư không bán
// ===========================================================================

/** SPV có nguồn cung, Nhà đầu tư đã KYC, có VNDB và uỷ quyền (như `seedReadyToBuy`). */
async function seedReadyToBuy() {
  const ledger = getLedger(CHAIN);
  await ledger.whitelist(SPV);
  await ledger.whitelist(ALICE);
  await ledger.mintInitialSupply(SPV, 1_000n);
  seedMockLedger({ paymentBalances: { [ALICE]: 10_000_000n }, paymentAllowances: { [ALICE]: 10_000_000n } });
}

/** Nhà đầu tư đang giữ `held` WPT: mua qua đúng luồng đặt lệnh. */
async function holdWpt(held: string) {
  await seedReadyToBuy();
  actAs('INVESTOR');
  const bought = await purchase.placeOrder({
    chain: CHAIN, investorWallet: ALICE, wptAmount: held, side: 'BUY', clientRequestId: crypto.randomUUID(),
  });
  expect(bought.ok, bought.ok ? '' : bought.error).toBe(true);
  // Trên `mock`, đặt lệnh khớp ngay trong cùng lời gọi.
  expect(bought.ok && bought.data.status).toBe('COMPLETED');
}

const sellIntent = (wptAmount = '2') => ({ chain: CHAIN, investorWallet: ALICE, wptAmount, side: 'SELL' as const });

describe('FIX-02 ca 1: cờ tắt thì mọi đường đặt lệnh bán bị chặn trước mọi phép đọc chuỗi', () => {
  it('previewTrade, previewPurchase, preparePermit: VALIDATION đúng câu, không gọi phương thức nào của ledger', async () => {
    await holdWpt('5');
    setSellFlag(false);

    for (const [name, call] of [
      ['previewTrade', () => previewTrade(sellIntent())],
      ['previewPurchase', () => purchase.previewPurchase(sellIntent())],
      ['preparePermit', () => purchase.preparePermit(sellIntent())],
    ] as const) {
      ledgerSpy.calls = [];
      ledgerSpy.on = true;
      const result = await call();
      ledgerSpy.on = false;
      expect(result, name).toMatchObject({ ok: false, code: 'VALIDATION', error: SELL_MESSAGE });
      expect(ledgerSpy.calls, name).toEqual([]);
    }
  });

  it('placeOrder: VALIDATION, không đọc số dư, có dòng audit FAILURE, không tạo lệnh', async () => {
    await holdWpt('5');
    setSellFlag(false);
    const ordersBefore = (await getOrderStore().listOrders({})).length;

    ledgerSpy.calls = [];
    ledgerSpy.on = true;
    const result = await purchase.placeOrder({ ...sellIntent(), clientRequestId: crypto.randomUUID() });
    ledgerSpy.on = false;

    expect(result).toMatchObject({ ok: false, code: 'VALIDATION', error: SELL_MESSAGE });
    expect(ledgerSpy.calls.filter((name) => /balance/i.test(name))).toEqual([]);
    expect((await getOrderStore().listOrders({})).length).toBe(ordersBefore);
    const audit = await getStore().listAudit({ limit: 20 });
    expect(
      audit.some((a) => a.action === 'order:place' && a.outcome === 'FAILURE' && a.detail?.includes(SELL_MESSAGE)),
    ).toBe(true);
  });

  it('lệnh mua vẫn chạy khi cờ tắt', async () => {
    await seedReadyToBuy();
    setSellFlag(false);
    const buy = { chain: CHAIN, investorWallet: ALICE, wptAmount: '1', side: 'BUY' as const };

    expect((await previewTrade(buy)).ok).toBe(true);
    expect((await purchase.previewPurchase(buy)).ok).toBe(true);
    const placed = await purchase.placeOrder({ ...buy, clientRequestId: crypto.randomUUID() });
    expect(placed.ok, placed.ok ? '' : placed.error).toBe(true);
  });

  it('vai không có quyền đặt lệnh gọi SELL vẫn nhận FORBIDDEN, không phải VALIDATION', async () => {
    setSellFlag(false);
    for (const role of ['TELLER', 'CONTROLLER', 'SELLER']) {
      actAs(role);
      for (const result of [
        await previewTrade(sellIntent()),
        await purchase.previewPurchase(sellIntent()),
        await purchase.preparePermit(sellIntent()),
        await purchase.placeOrder({ ...sellIntent(), clientRequestId: crypto.randomUUID() }),
      ]) {
        expect(result, role).toMatchObject({ ok: false, code: 'FORBIDDEN' });
      }
    }
  });
});

describe('FIX-02 ca 1b: gửi lại yêu cầu bán đã tạo lúc cờ bật vẫn nhận lại lệnh cũ', () => {
  it('cùng clientRequestId: đúng lệnh cũ, số lệnh không đổi; clientRequestId mới: bị chặn', async () => {
    await holdWpt('5');
    const clientRequestId = crypto.randomUUID();
    const first = await purchase.placeOrder({ ...sellIntent(), clientRequestId });
    expect(first.ok, first.ok ? '' : first.error).toBe(true);
    if (!first.ok) return;
    const count = (await getOrderStore().listOrders({})).length;

    setSellFlag(false);
    const again = await purchase.placeOrder({ ...sellIntent(), clientRequestId });
    expect(again.ok, again.ok ? '' : again.error).toBe(true);
    if (!again.ok) return;
    expect(again.data.id).toBe(first.data.id);
    expect((await getOrderStore().listOrders({})).length).toBe(count);

    const fresh = await purchase.placeOrder({ ...sellIntent(), clientRequestId: crypto.randomUUID() });
    expect(fresh).toMatchObject({ ok: false, code: 'VALIDATION', error: SELL_MESSAGE });
    expect((await getOrderStore().listOrders({})).length).toBe(count);
  });
});

describe('FIX-02 ca 2: màn /trade đọc cờ qua getTradeContext', () => {
  it('cờ tắt: sellEnabled false; cờ bật: true', async () => {
    await seedReadyToBuy();
    setSellFlag(false);
    const off = await getTradeContext({ chain: CHAIN, wallet: ALICE });
    expect(off.ok && off.data.sellEnabled).toBe(false);
    setSellFlag(true);
    const on = await getTradeContext({ chain: CHAIN, wallet: ALICE });
    expect(on.ok && on.data.sellEnabled).toBe(true);
  });

  it('tradeSides: chỉ Mua khi cờ tắt, Mua và Bán khi cờ bật', () => {
    expect(tradeSides(false)).toEqual(['BUY']);
    expect(tradeSides(true)).toEqual(['BUY', 'SELL']);
  });
});

// ===========================================================================
//  B. Nhiều yêu cầu Mint, cảnh báo khi duyệt
// ===========================================================================

const teller = () => actAs('TELLER', 'GDV001');
const controller = () => actAs('CONTROLLER', 'KSV001');

/** Phát hành thẳng một phần trần (dữ liệu thử, bật cờ FE-22 đúng lúc dựng nền). */
async function issueDirect(amount: bigint) {
  const { issueInitialSupply } = await import('@/lib/bank/issuance.service');
  process.env.ENABLE_DEMO_TOKEN_MINT = 'true';
  teller();
  const result = await issueInitialSupply({ chain: CHAIN, spvWallet: VAULT, amount: String(amount) });
  delete process.env.ENABLE_DEMO_TOKEN_MINT;
  resetServerEnvCache();
  expect(result.ok, result.ok ? '' : result.error).toBe(true);
}

const mintInput = (amount: bigint) => ({
  type: 'MINT',
  chain: CHAIN,
  amount: String(amount),
  wallet: VAULT,
  reason: 'phát hành đợt tiếp theo',
  documentRef: 'QD-2026-001',
  effectiveDate: '2026-10-01',
});

const burnInput = (amount: bigint, burnSource: 'UNDISTRIBUTED' | 'TOTAL_SUPPLY') => ({
  type: 'BURN',
  chain: CHAIN,
  amount: String(amount),
  burnSource,
  reason: 'thu hồi phần chưa bán',
});

async function draft(input: Record<string, unknown>): Promise<string> {
  teller();
  const result = await tokenRequest.createTokenRequest(input);
  expect(result.ok, result.ok ? '' : result.error).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.data.request.id;
}

async function detail(requestId: string): Promise<TokenRequestDetailView> {
  controller();
  const result = await tokenRequest.getTokenRequestDetail({ chain: CHAIN, requestId });
  expect(result.ok, result.ok ? '' : result.error).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

async function approve(requestId: string) {
  controller();
  return tokenRequest.approveTokenRequest({ chain: CHAIN, requestId });
}

async function reject(requestId: string) {
  controller();
  return tokenRequest.rejectTokenRequest({ chain: CHAIN, requestId, reason: 'Không đủ số lượng khi duyệt' });
}

async function seedTokenFlow() {
  teller();
  await getLedger(CHAIN).whitelist(VAULT);
}

describe('FIX-02 ca 3: nhiều yêu cầu Mint cùng token được lập cùng lúc', () => {
  it('hai yêu cầu Mint liên tiếp đều lập được; khối kiểm tra không còn khoá chặn yêu cầu đang chờ', async () => {
    await seedTokenFlow();
    await issueDirect(1_000n);
    await draft(mintInput(10n));
    await draft(mintInput(20n));

    const preview = await tokenRequest.previewTokenRequest(mintInput(5n));
    expect(preview.ok, preview.ok ? '' : preview.error).toBe(true);
    if (!preview.ok) return;
    expect(preview.data.checks.map((c) => c.key)).toEqual(['permission', 'project', 'recall', 'cap', 'wallet']);
    expect(preview.data.allPassed).toBe(true);
    expect((await getTokenRequestStore().listRequests()).filter((r) => r.status === 'PENDING')).toHaveLength(2);
  });
});

describe('FIX-02 ca 4: cảnh báo Mint vượt phần còn được phép phát hành', () => {
  const token = { remaining: '100', undistributed: '50', totalSupply: '900' };

  it('approveWarningOf ở biên: bằng thì null, lớn hơn 1 thì có câu', () => {
    const mint = (amount: string) => ({ status: 'PENDING' as const, type: 'MINT' as const, amount, burnSource: null });
    const burn = (amount: string) => ({
      status: 'PENDING' as const, type: 'BURN' as const, amount, burnSource: 'UNDISTRIBUTED' as const,
    });
    expect(tokenRequest.approveWarningOf(mint('100'), token)).toBeNull();
    expect(tokenRequest.approveWarningOf(mint('101'), token)).toMatchObject({
      kind: 'MINT_REMAINING', message: 'Không đủ số lượng token còn được phép phát hành.', requested: '101', available: '100',
    });
    expect(tokenRequest.approveWarningOf(burn('50'), token)).toBeNull();
    expect(tokenRequest.approveWarningOf(burn('51'), token)).toMatchObject({
      kind: 'BURN_UNDISTRIBUTED', message: 'Không đủ số lượng token chưa phân phối còn lại.', requested: '51', available: '50',
    });
  });

  it('ba yêu cầu 60% trần còn lại: duyệt cái đầu thì hai cái sau có cảnh báo, duyệt bị chặn, từ chối được', async () => {
    await seedTokenFlow();
    await issueDirect(1_000n);
    const each = ((CAP - 1_000n) * 60n) / 100n;
    const ids = [await draft(mintInput(each)), await draft(mintInput(each)), await draft(mintInput(each))];
    for (const id of ids) expect((await detail(id)).approveWarning).toBeNull();

    const first = await approve(ids[0]);
    expect(first.ok, first.ok ? '' : first.error).toBe(true);

    for (const id of ids.slice(1)) {
      expect((await detail(id)).approveWarning).toMatchObject({
        kind: 'MINT_REMAINING',
        message: 'Không đủ số lượng token còn được phép phát hành.',
        requested: each.toString(),
        available: (CAP - 1_000n - each).toString(),
      });
    }
    expect(await approve(ids[1])).toMatchObject({ ok: false, code: 'REQUEST_CHECK' });
    expect((await getTokenRequestStore().findRequest(ids[1]))?.status).toBe('PENDING');
    const rejected = await reject(ids[1]);
    expect(rejected.ok, rejected.ok ? '' : rejected.error).toBe(true);
  });
});

describe('FIX-02 ca 5: cảnh báo Burn vượt phần chưa phân phối', () => {
  it('hai yêu cầu Burn, duyệt cái đầu: cái sau có câu cảnh báo', async () => {
    await seedTokenFlow();
    await issueDirect(1_000n);
    const first = await draft(burnInput(600n, 'UNDISTRIBUTED'));
    const second = await draft(burnInput(600n, 'UNDISTRIBUTED'));
    expect((await detail(second)).approveWarning).toBeNull();

    const approved = await approve(first);
    expect(approved.ok, approved.ok ? '' : approved.error).toBe(true);

    expect((await detail(second)).approveWarning).toMatchObject({
      kind: 'BURN_UNDISTRIBUTED',
      message: 'Không đủ số lượng token chưa phân phối còn lại.',
      requested: '600',
      available: '400',
    });
  });
});

describe('FIX-02 ca 6: không còn chờ duyệt, hoặc không đọc được token', () => {
  it('yêu cầu đã từ chối: approveWarning null', async () => {
    await seedTokenFlow();
    await issueDirect(1_000n);
    const id = await draft(burnInput(600n, 'UNDISTRIBUTED'));
    expect((await reject(id)).ok).toBe(true);
    // Số liệu vượt (Mint ngoài trần) cũng không còn cảnh báo khi đã rời PENDING.
    expect(tokenRequest.approveWarningOf(
      { status: 'REJECTED', type: 'MINT', amount: '999', burnSource: null }, { remaining: '1', undistributed: '0', totalSupply: '0' },
    )).toBeNull();
    expect((await detail(id)).approveWarning).toBeNull();
  });

  it('không đọc được thông tin token: TOKEN_UNREADABLE, nút Chấp nhận khoá, Từ chối vẫn chạy', async () => {
    await seedTokenFlow();
    await issueDirect(1_000n);
    const id = await draft(mintInput(10n));
    ledgerSpy.tokenInfoThrows = true;

    const view = await detail(id);
    expect(view.token).toBeNull();
    expect(view.approveWarning?.kind).toBe('TOKEN_UNREADABLE');
    expect(approveBlockReason(view)).toBe(view.approveWarning?.message);

    const rejected = await reject(id);
    expect(rejected.ok, rejected.ok ? '' : rejected.error).toBe(true);
  });
});

describe('FIX-02 ca 7: Burn toàn bộ nguồn cung phải bằng đúng tổng cung', () => {
  it('khác tổng cung bị chặn; bằng thì lập được; tổng cung đổi thì cảnh báo và máy chủ chặn duyệt', async () => {
    await seedTokenFlow();
    await issueDirect(1_000n);

    teller();
    const wrong = await tokenRequest.createTokenRequest(burnInput(999n, 'TOTAL_SUPPLY'));
    expect(wrong.ok).toBe(false);
    if (wrong.ok) return;
    expect(Object.keys(wrong.fieldErrors ?? {})).toEqual(['fullSupply']);
    expect(wrong.fieldErrors?.fullSupply?.[0]).toBe('Số lượng 999; tổng cung hiện tại 1.000.');

    const burnId = await draft(burnInput(1_000n, 'TOTAL_SUPPLY'));
    expect((await detail(burnId)).approveWarning).toBeNull();

    const mintId = await draft(mintInput(500n));
    const minted = await approve(mintId);
    expect(minted.ok, minted.ok ? '' : minted.error).toBe(true);

    const view = await detail(burnId);
    expect(view.approveWarning).toMatchObject({ kind: 'BURN_FULL_SUPPLY', requested: '1000', available: '1500' });
    expect(approveBlockReason(view)).toBe(view.approveWarning?.message);

    const blocked = await approve(burnId);
    expect(blocked).toMatchObject({ ok: false, code: 'REQUEST_CHECK' });
    if (blocked.ok) return;
    expect(Object.keys(blocked.fieldErrors ?? {})).toContain('fullSupply');
    expect((await getTokenRequestStore().findRequest(burnId))?.status).toBe('PENDING');
  });
});

// ===========================================================================
//  Hàm thuần của giao diện
// ===========================================================================

describe('FIX-02 ca 8: approveBlockReason và burnSourceEffect', () => {
  const pending = { status: 'PENDING' } as TokenRequestDetailView['request'];
  const warning = { kind: 'MINT_REMAINING' as const, message: 'Không đủ số lượng token còn được phép phát hành.', requested: '2', available: '1' };

  it('khoá khi có cảnh báo, khi không còn PENDING, khi tự duyệt; mở khi không có gì', () => {
    expect(approveBlockReason({ request: pending, selfApprovalReason: null, approveWarning: null })).toBeNull();
    expect(approveBlockReason({ request: pending, selfApprovalReason: null, approveWarning: warning })).toBe(warning.message);
    expect(approveBlockReason({ request: pending, selfApprovalReason: 'Bạn đã lập yêu cầu này.', approveWarning: null }))
      .toBe('Bạn đã lập yêu cầu này.');
    expect(approveBlockReason({
      request: { status: 'COMPLETED' } as TokenRequestDetailView['request'], selfApprovalReason: null, approveWarning: null,
    })).toMatch(/không còn chờ duyệt/);
  });

  it('burnSourceEffect khi chưa có tổng cung: không in số, không có ký tự gạch dài', () => {
    const effect = burnSourceEffect('TOTAL_SUPPLY', null);
    expect(effect.amount).toBeNull();
    expect(effect.needsConfirmation).toBe(true);
    expect(effect.warning).toMatch(/^Bạn đang yêu cầu huỷ TOÀN BỘ nguồn cung\. /);
    expect(effect.warning).not.toContain('\u2014');
  });
});

describe('FIX-02 ca 9: burnAmountShown', () => {
  it('toàn bộ nguồn cung lấy tổng cung theo từng lần tải; phần chưa phân phối và Mint lấy số đã gõ', () => {
    expect(burnAmountShown('BURN', 'TOTAL_SUPPLY', '', null)).toBe('');
    expect(burnAmountShown('BURN', 'TOTAL_SUPPLY', '', '1000')).toBe('1000');
    expect(burnAmountShown('BURN', 'TOTAL_SUPPLY', '', '1500')).toBe('1500');
    expect(burnAmountShown('BURN', 'TOTAL_SUPPLY', '7', '1500')).toBe('1500');
    expect(burnAmountShown('BURN', 'UNDISTRIBUTED', '', '1500')).toBe('');
    expect(burnAmountShown('BURN', 'UNDISTRIBUTED', '7', '1500')).toBe('7');
    expect(burnAmountShown('MINT', 'TOTAL_SUPPLY', '12', '1500')).toBe('12');
    expect(burnAmountShown('MINT', 'UNDISTRIBUTED', '', null)).toBe('');
  });
});
