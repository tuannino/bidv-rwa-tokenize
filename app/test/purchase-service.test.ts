import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WPT_ISSUE_PRICE_VND } from '@/lib/config/issue-terms';
import type { ILedgerPort, TxResult } from '@/lib/ledger/ledger.port';

/**
 * Nghiệp vụ lệnh mua WPT — chín ca ở `tasks.md` bước 7.
 *
 * Chạy trên chain `mock`: adapter mock mô phỏng đúng ràng buộc tuân thủ của contract thật
 * (BE-01), nên test không cần RPC mà vẫn không dễ tính hơn chuỗi.
 *
 * ---------------------------------------------------------------------------------------
 *  VÌ SAO PHẢI BỌC `@/lib/ledger`
 *
 *  Ca 7.6 cần một lần khớp lệnh THẤT BẠI SAU khi bốn phép kiểm đã đạt. Trên mock thì tình
 *  huống đó không dựng được bằng cách nạp trạng thái: bốn phép kiểm đọc đúng những điều
 *  kiện mà `executePurchase` kiểm lại, nên hễ bốn phép đạt là `executePurchase` thành công.
 *  Đó là tính chất TỐT của thiết kế, nhưng nó khiến nhánh `FAILED` không có đường vào.
 *
 *  Vỏ bọc dưới đây mặc định chuyển tiếp nguyên vẹn sang adapter thật; chỉ khi test bật cờ
 *  thì `executePurchase`/`waitReceipt` mới hỏng theo kịch bản. Nhờ vậy tám ca còn lại vẫn
 *  chạy trên adapter thật, không phải trên một bản giả.
 * ---------------------------------------------------------------------------------------
 */

const fault = vi.hoisted(() => ({
  /** `throw`: ném lỗi ledger khi gửi. `receipt-failed`: gửi được nhưng biên nhận FAILED. */
  mode: null as null | 'throw' | 'receipt-failed',
  /** Đếm số lần `executePurchase` thực sự được gọi — chốt của ca 7.7. */
  sendCount: 0,
}));

vi.mock('@/lib/ledger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ledger')>();
  return {
    ...actual,
    getLedger: (...args: Parameters<typeof actual.getLedger>): ILedgerPort => {
      const real = actual.getLedger(...args);
      return {
        ...real,
        async executePurchase(investor: string, wptAmount: bigint): Promise<TxResult> {
          fault.sendCount += 1;
          if (fault.mode === 'throw') {
            throw new actual.LedgerError(
              real.chain,
              'executePurchase',
              'Ví thanh toán SPV không đủ WPT: cần nhiều hơn số còn lại.',
            );
          }
          if (fault.mode === 'receipt-failed') {
            // Gửi được: có mã giao dịch thật, nhưng chuỗi sẽ trả về FAILED.
            return { txHash: `0x${'f'.repeat(64)}`, status: 'PENDING' };
          }
          return real.executePurchase(investor, wptAmount);
        },
        // BE-14 — cùng kịch bản hỏng cho chiều bán, cùng bộ đếm số lần gửi.
        async executeSale(investor: string, wptAmount: bigint): Promise<TxResult> {
          fault.sendCount += 1;
          if (fault.mode === 'throw') {
            throw new actual.LedgerError(
              real.chain,
              'executeSale',
              'Mất kết nối giữa chừng khi gửi giao dịch khớp lệnh bán.',
            );
          }
          if (fault.mode === 'receipt-failed') {
            return { txHash: `0x${'e'.repeat(64)}`, status: 'PENDING' };
          }
          return real.executeSale(investor, wptAmount);
        },
        async waitReceipt(txHash: string, timeoutMs?: number): Promise<TxResult> {
          if (fault.mode === 'receipt-failed') {
            return { txHash, status: 'FAILED', reason: 'Giao dịch bị revert on-chain.' };
          }
          return real.waitReceipt(txHash, timeoutMs);
        },
      };
    },
  };
});

const { resetServerEnvCache } = await import('@/lib/config/env');
const { resetMockLedger, seedMockLedger } = await import('@/lib/ledger/mock.adapter');
const { getOrderStore, getStore, resetMemoryStore, resetStoreCache } = await import('@/lib/store');
const { getLedger } = await import('@/lib/ledger');
const {
  executeOrder,
  expireStaleOrders,
  listOrders,
  orderDailyStats,
  placeOrder: placeOrderService,
  previewPurchase,
} = await import('@/lib/bank/purchase.service');

/** Giữ các ca lịch sử tập trung vào điều chúng kiểm; ca BE-17 truyền mã cố định riêng. */
async function placeOrder(input: unknown) {
  if (typeof input !== 'object' || input === null || 'clientRequestId' in input) {
    return placeOrderService(input);
  }
  return placeOrderService({ ...input, clientRequestId: crypto.randomUUID() });
}

const ALICE = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const BOB = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const SPV = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';

const CHAIN = 'mock';
/**
 * Giá bán mặc định, ĐỌC TỪ NGUỒN DUY NHẤT `lib/config/issue-terms.ts` (BE-04 việc 16).
 *
 * Giá ở đây là DỮ LIỆU: các ca dưới nhân nó với số lượng để dựng số dư VNDB và mức uỷ quyền, rồi
 * đối chiếu `vndAmount` của lệnh. Không ca nào phát biểu "giá phải bằng 100.000", nên gõ lại con
 * số sẽ làm chúng đỏ khi ngân hàng đổi giá mặc định — đỏ vì một lý do chúng không kiểm.
 */
const PRICE = BigInt(WPT_ISSUE_PRICE_VND);

function actAs(role: string) {
  process.env.DEMO_ROLE = role;
  resetServerEnvCache();
}

/**
 * Dựng bối cảnh: SPV và nhà đầu tư đã KYC, nguồn cung đã phát hành vào ví SPV,
 * nhà đầu tư có VNDB và đã cấp ủy quyền.
 *
 * `seedMockLedger` nạp VNDB và mức ủy quyền — hai thứ mà `ILedgerPort` chỉ ĐỌC chứ không
 * tạo ra (ở chuỗi thật là `VNDToken.mint` và `approve` từ ví nhà đầu tư).
 */
async function seedReadyToBuy(options?: {
  supply?: bigint;
  vndb?: bigint;
  allowance?: bigint;
  investor?: string;
}) {
  const { supply = 1_000n, vndb = 10_000_000n, allowance = 10_000_000n, investor = ALICE } = options ?? {};
  const ledger = getLedger(CHAIN);
  await ledger.whitelist(SPV);
  await ledger.whitelist(investor);
  await ledger.mintInitialSupply(SPV, supply);
  seedMockLedger({
    paymentBalances: { [investor]: vndb },
    paymentAllowances: { [investor]: allowance },
  });
  return ledger;
}

/**
 * Cấp ĐỦ điều kiện mua cho một nhà đầu tư thứ hai.
 *
 * KHÔNG gọi `seedReadyToBuy` lần nữa: `mintInitialSupply` chỉ chạy được một lần cho cả dự
 * án (R1.3), lần hai bị hợp đồng từ chối. Ví thứ hai chỉ cần KYC và tiền.
 */
async function fundInvestor(investor: string, amount = 10_000_000n) {
  await getLedger(CHAIN).whitelist(investor);
  seedMockLedger({
    paymentBalances: { [investor]: amount },
    paymentAllowances: { [investor]: amount },
  });
}

/**
 * Ba cách một lệnh ĐÃ ĐẶT mất điều kiện trước khi khớp.
 *
 * Từ BE-03, `placeOrder` kiểm điều kiện TRƯỚC khi tạo bản ghi, nên không còn đặt được một
 * lệnh vốn đã thiếu điều kiện — và đó là chủ đích của BE-03. Ca "khớp lệnh bị từ chối" vì
 * thế phải dựng đúng như ngoài đời: đặt lệnh lúc đủ điều kiện, rồi điều kiện đổi trước khi
 * khớp. Bảng này là nguồn duy nhất của ba tình huống đó, dùng cho cả ca 7.2/7.3/7.4 và cho
 * ca "hai đường kiểm không lệch nhau".
 */
const DEGRADATIONS = [
  {
    name: 'nhà đầu tư rút hết VNDB sau khi đặt lệnh',
    /** Hạ điều kiện SAU khi lệnh đã ở PLACED. */
    degrade: async () => {
      seedMockLedger({ paymentBalances: { [ALICE]: 0n } });
    },
    code: 'INSUFFICIENT_PAYMENT_BALANCE',
    blocker: 'paymentBalance',
    reasonPattern: /Số dư VNDB không đủ/,
  },
  {
    name: 'nhà đầu tư thu hồi ủy quyền VNDB sau khi đặt lệnh',
    degrade: async () => {
      seedMockLedger({ paymentAllowances: { [ALICE]: 0n } });
    },
    code: 'INSUFFICIENT_ALLOWANCE',
    blocker: 'allowance',
    reasonPattern: /Ủy quyền VNDB không đủ/,
  },
  {
    name: 'tồn WPT ở ví SPV tụt xuống dưới số đã đặt',
    // `burn` là đường duy nhất hạ tồn của ví SPV mà không phải khớp một lệnh khác:
    // `seedMockLedger` chỉ nạp được số dư VNDB, không nạp số dư WPT.
    degrade: async () => {
      await getLedger(CHAIN).burn(SPV, 998n);
    },
    code: 'INSUFFICIENT_SUPPLY',
    blocker: 'supply',
    reasonPattern: /không đủ WPT/,
  },
] as const;

/**
 * Dựng một lệnh PLACED để kiểm riêng đường can thiệp lịch sử.
 *
 * Từ BE-17, API đặt lệnh thật tự quyết toán ngay nên không thể dùng nó để chuẩn bị một lệnh
 * đang chờ rồi mới thay đổi điều kiện. Store là seam đúng để mô phỏng tiến trình chết ngay sau
 * lúc tạo bản ghi; các ca của `placeOrder` phía trên vẫn đi qua API thật.
 */
async function placeAsInvestor(wptAmount: string, investor = ALICE): Promise<string> {
  const placed = await getOrderStore().createOrder({
    chain: CHAIN,
    investorWallet: investor,
    clientRequestId: crypto.randomUUID(),
    side: 'BUY',
    wptAmount,
    vndAmount: (BigInt(wptAmount) * PRICE).toString(),
    actorRole: 'INVESTOR',
  });
  actAs('TELLER');
  return placed.id;
}

/**
 * Cấu trúc state của các bản lưu trữ bộ nhớ — chỉ dùng để giả lập thời gian trong test.
 *
 * Một khoá `globalThis` duy nhất (`memory.state.ts`) chia theo vùng; lệnh mua nằm ở vùng
 * `order` do `memory.order.store.ts` khai.
 */
interface MemoryStoreShape {
  __bidvMemoryStores__?: { order?: { orders: { createdAt: string }[] } };
}

/** Đẩy `createdAt` của một lệnh về mốc chỉ định, để thử nhánh hết hạn mà không phải chờ. */
function makeOrderStale(index: number, createdAt: string): void {
  const orders = (globalThis as MemoryStoreShape).__bidvMemoryStores__?.order?.orders;
  if (!orders?.[index]) throw new Error(`không có lệnh ở vị trí ${index} trong store bộ nhớ`);
  orders[index].createdAt = createdAt;
}

/** Ảnh chụp số dư hai bên, để so trước/sau. */
async function snapshotBalances(investor = ALICE) {
  const ledger = getLedger(CHAIN);
  return {
    investorWpt: await ledger.balanceOf(investor),
    investorVndb: await ledger.paymentBalanceOf(investor),
    spvWpt: await ledger.balanceOf(SPV),
    spvVndb: await ledger.paymentBalanceOf(SPV),
  };
}

beforeEach(() => {
  fault.mode = null;
  fault.sendCount = 0;
  resetMockLedger();
  resetMemoryStore();
  resetStoreCache();
  process.env.USE_MOCK_DB = 'true';
  actAs('INVESTOR');
});

afterEach(() => {
  delete process.env.DEMO_ROLE;
  delete process.env.USE_MOCK_DB;
  resetServerEnvCache();
  resetStoreCache();
});

// =============================================================================
//  ĐẶT LỆNH
// =============================================================================
describe('placeOrder', () => {
  it('bắt buộc clientRequestId đúng dạng UUID', async () => {
    await seedReadyToBuy();
    const missing = await placeOrderService({
      chain: CHAIN,
      investorWallet: ALICE,
      wptAmount: '1',
    });
    const malformed = await placeOrderService({
      chain: CHAIN,
      investorWallet: ALICE,
      wptAmount: '1',
      clientRequestId: 'khong-phai-uuid',
    });
    expect(missing.ok).toBe(false);
    expect(malformed.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe('VALIDATION');
    if (!malformed.ok) expect(malformed.code).toBe('VALIDATION');
  });

  it('gửi lại cùng mã và cùng nội dung trả đúng lệnh cũ, không tạo hay gửi lần hai', async () => {
    await seedReadyToBuy();
    const clientRequestId = crypto.randomUUID();
    const input = { chain: CHAIN, investorWallet: ALICE, wptAmount: '2', clientRequestId };

    const first = await placeOrderService(input);
    const repeated = await placeOrderService(input);

    expect(first.ok && repeated.ok).toBe(true);
    if (!first.ok || !repeated.ok) return;
    expect(repeated.data.id).toBe(first.data.id);
    expect(await getOrderStore().listOrders({ investorWallet: ALICE })).toHaveLength(1);
    expect(fault.sendCount).toBe(1);
  });

  it('gửi lại cùng mã nhưng khác nội dung bị từ chối rõ ràng', async () => {
    await seedReadyToBuy();
    const clientRequestId = crypto.randomUUID();
    await placeOrderService({
      chain: CHAIN,
      investorWallet: ALICE,
      wptAmount: '2',
      clientRequestId,
    });

    const conflict = await placeOrderService({
      chain: CHAIN,
      investorWallet: ALICE,
      wptAmount: '3',
      clientRequestId,
    });
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) {
      expect(conflict.code).toBe('VALIDATION');
      expect(conflict.error).toMatch(/đã được dùng.*nội dung khác/);
    }
    expect(await getOrderStore().listOrders({ investorWallet: ALICE })).toHaveLength(1);
  });

  it('hai lời gọi song song cùng mã tạo đúng một lệnh', async () => {
    await seedReadyToBuy();
    const clientRequestId = crypto.randomUUID();
    const input = { chain: CHAIN, investorWallet: ALICE, wptAmount: '2', clientRequestId };

    const [first, second] = await Promise.all([
      placeOrderService(input),
      placeOrderService(input),
    ]);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.data.id).toBe(first.data.id);
    expect(await getOrderStore().listOrders({ investorWallet: ALICE })).toHaveLength(1);
    expect(fault.sendCount, 'hai request song song chỉ được phát đúng một giao dịch').toBe(1);
  });

  it('hai ví được dùng cùng mã yêu cầu mà không va chạm', async () => {
    await seedReadyToBuy();
    await fundInvestor(BOB);
    const clientRequestId = crypto.randomUUID();
    const [alice, bob] = await Promise.all([
      placeOrderService({
        chain: CHAIN,
        investorWallet: ALICE,
        wptAmount: '1',
        clientRequestId,
      }),
      placeOrderService({
        chain: CHAIN,
        investorWallet: BOB,
        wptAmount: '1',
        clientRequestId,
      }),
    ]);
    expect(alice.ok && bob.ok).toBe(true);
    if (alice.ok && bob.ok) expect(alice.data.id).not.toBe(bob.data.id);
  });

  it('tính đúng số VNDB phải trả và lưu vào lệnh', async () => {
    await seedReadyToBuy();

    const result = await placeOrder({ chain: CHAIN, investorWallet: ALICE, wptAmount: '7' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('COMPLETED');
    expect(result.data.wptAmount).toBe('7');
    expect(result.data.vndAmount).toBe((7n * PRICE).toString());
    // Chuỗi, không phải number: uint256 vượt Number.MAX_SAFE_INTEGER là mất chính xác.
    expect(typeof result.data.vndAmount).toBe('string');
    expect(result.data.txHash).toMatch(/^0x/);
  });

  it('tự gửi đúng một giao dịch và cập nhật đủ bốn số dư ngay khi đặt lệnh', async () => {
    await seedReadyToBuy();
    const before = await snapshotBalances();

    await placeOrder({ chain: CHAIN, investorWallet: ALICE, wptAmount: '5' });

    expect(fault.sendCount).toBe(1);
    expect(await snapshotBalances()).toEqual({
      investorWpt: before.investorWpt + 5n,
      investorVndb: before.investorVndb - 5n * PRICE,
      spvWpt: before.spvWpt - 5n,
      spvVndb: before.spvVndb + 5n * PRICE,
    });
  });

  it('lệnh bán hợp lệ cũng tự quyết toán trong chính lời gọi đặt lệnh', async () => {
    await seedReadyToBuy();
    const bought = await placeOrder({ chain: CHAIN, investorWallet: ALICE, wptAmount: '5' });
    expect(bought.ok && bought.data.status).toBe('COMPLETED');
    const beforeSale = await snapshotBalances();

    const sold = await placeOrder({
      chain: CHAIN,
      investorWallet: ALICE,
      wptAmount: '2',
      side: 'SELL',
    });

    expect(sold.ok).toBe(true);
    if (!sold.ok) return;
    expect(sold.data.status).toBe('COMPLETED');
    expect(sold.data.txHash).toMatch(/^0x/);
    expect(await snapshotBalances()).toEqual({
      investorWpt: beforeSale.investorWpt - 2n,
      investorVndb: beforeSale.investorVndb + 2n * PRICE,
      spvWpt: beforeSale.spvWpt + 2n,
      spvVndb: beforeSale.spvVndb - 2n * PRICE,
    });
    expect(fault.sendCount).toBe(2);
  });

  it('đường tự động chỉ quyết toán lệnh vừa tạo, không nhận mã lệnh khác từ dữ liệu vào', async () => {
    await seedReadyToBuy();
    const victimId = await placeAsInvestor('2');
    actAs('INVESTOR');

    const result = await placeOrderService({
      chain: CHAIN,
      investorWallet: ALICE,
      wptAmount: '1',
      clientRequestId: crypto.randomUUID(),
      orderId: victimId,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.id).not.toBe(victimId);
    expect(result.data.status).toBe('COMPLETED');
    expect((await getOrderStore().findOrder(victimId))?.status).toBe('PLACED');
    expect(fault.sendCount).toBe(1);
  });

  it('quyết toán lỗi vẫn trả lệnh đã lưu cùng trạng thái và lý do cuối', async () => {
    await seedReadyToBuy();
    fault.mode = 'throw';

    const result = await placeOrder({ chain: CHAIN, investorWallet: ALICE, wptAmount: '2' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('FAILED');
    expect(result.data.reason).toMatch(/không đủ WPT/);
    expect((await getOrderStore().findOrder(result.data.id))?.status).toBe('FAILED');
  });

  it('vai không có order:place bị chặn, có bản ghi kiểm toán DENIED', async () => {
    for (const role of ['SELLER', 'TELLER', 'CONTROLLER']) {
      actAs(role);
      const result = await placeOrder({ chain: CHAIN, investorWallet: ALICE, wptAmount: '1' });
      expect(result.ok, `${role} không được đặt lệnh`).toBe(false);
      if (result.ok) continue;
      expect(result.code).toBe('FORBIDDEN');
    }

    const audit = await getStore().listAudit({ limit: 20 });
    const denied = audit.filter((e) => e.action === 'order:place' && e.outcome === 'DENIED');
    expect(denied.length).toBe(3);
  });

  it('số lượng 0, âm, hoặc thập phân bị chặn ở validate', async () => {
    for (const wptAmount of ['0', '-1', '1.5', 'abc', '']) {
      const result = await placeOrder({ chain: CHAIN, investorWallet: ALICE, wptAmount });
      expect(result.ok, `wptAmount=${wptAmount}`).toBe(false);
      if (result.ok) continue;
      expect(result.code).toBe('VALIDATION');
    }
  });

  // ===========================================================================
  //  BE-03 — CHẶN LỆNH RÁC: thiếu điều kiện thì KHÔNG tạo bản ghi
  // ===========================================================================
  /**
   * Điểm cốt lõi của cả ba ca dưới đây là "sổ lệnh vẫn TRỐNG", không phải "có trả về lỗi".
   * Chỉ kiểm mã lỗi thì test vẫn xanh khi lệnh được tạo rồi bị từ chối ngay sau đó — đúng
   * cái hành vi mà BE-03 dựng để bỏ đi.
   */
  async function expectNotPlaced(wptAmount: string, code: string, reasonPattern: RegExp) {
    const result = await placeOrder({ chain: CHAIN, investorWallet: ALICE, wptAmount });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(code);
    expect(result.error).toMatch(reasonPattern);

    expect(await getOrderStore().listOrders({}), 'không được tạo bản ghi lệnh nào').toHaveLength(0);

    // Không có bản ghi lệnh thì sổ kiểm toán là dấu vết DUY NHẤT còn lại của lần đặt lệnh
    // bị từ chối. Thiếu nó là mất hẳn việc đã xảy ra.
    const audit = await getStore().listAudit({ limit: 20 });
    const rejected = audit.find((e) => e.action === 'order:place' && e.outcome === 'FAILURE');
    expect(rejected?.detail).toMatch(reasonPattern);
  }

  it('thiếu số dư VNDB thì KHÔNG tạo lệnh', async () => {
    // Đủ ủy quyền nhưng không đủ tiền: tách hai điều kiện để chắc chắn phép kiểm nào chạy.
    //
    // `PRICE - 1n` chứ không phải một con số tuyệt đối: điều ca này dựng là tình huống THIẾU TIỀN,
    // và một con số cố định chỉ còn thiếu khi giá mặc định đủ lớn. Ở giá nhỏ nó thành DƯ tiền, lúc
    // đó ca kiểm đỏ vì tình huống nó cần đã bốc hơi — không phải vì mã sai.
    await seedReadyToBuy({ vndb: PRICE - 1n, allowance: 10_000_000n });

    await expectNotPlaced('1', 'INSUFFICIENT_PAYMENT_BALANCE', /Số dư VNDB không đủ/);
  });

  it('thiếu ủy quyền VNDB thì KHÔNG tạo lệnh', async () => {
    await seedReadyToBuy({ vndb: 10_000_000n, allowance: PRICE - 1n });

    await expectNotPlaced('1', 'INSUFFICIENT_ALLOWANCE', /Ủy quyền VNDB không đủ/);
  });

  it('ví SPV không đủ WPT thì KHÔNG tạo lệnh', async () => {
    await seedReadyToBuy({ supply: 3n });

    await expectNotPlaced('4', 'INSUFFICIENT_SUPPLY', /không đủ WPT/);
  });

  /**
   * Ca này TRƯỚC BE-03 nằm ở `executeOrder`. Chuyển sang đây vì sau BE-03 nó KHÔNG CÒN ĐẠT
   * ĐƯỢC ở đó: lệnh chỉ tồn tại khi đã phát hành nguồn cung, mà nguồn cung phát hành rồi
   * thì không thu lại được — tức `spvWallet()` không bao giờ trả `null` khi đã có lệnh.
   * Phép kiểm vẫn còn nguyên trong bộ kiểm, chỉ đổi chỗ bắt được nó.
   */
  it('chưa phát hành nguồn cung thì KHÔNG tạo lệnh, mã INSUFFICIENT_SUPPLY', async () => {
    // Không gọi mintInitialSupply -> `spvWallet()` trả null, không có ví nào để đọc tồn.
    await getLedger(CHAIN).whitelist(ALICE);
    seedMockLedger({
      paymentBalances: { [ALICE]: 10_000_000n },
      paymentAllowances: { [ALICE]: 10_000_000n },
    });

    await expectNotPlaced('1', 'INSUFFICIENT_SUPPLY', /Chưa phát hành nguồn cung/);
  });
});

// =============================================================================
//  BE-03 — XEM TRƯỚC ĐIỀU KIỆN MUA
// =============================================================================
describe('previewPurchase', () => {
  /** Ảnh chụp mọi thứ xem trước KHÔNG được phép chạm tới. */
  async function snapshotStore() {
    return {
      orders: await getOrderStore().listOrders({}),
      audit: await getStore().listAudit({ limit: 200 }),
      txns: await getStore().listTxns({}),
    };
  }

  it('ca 1 — đủ điều kiện: canPlaceOrder đúng, vndAmount khớp báo giá', async () => {
    const ledger = await seedReadyToBuy();

    const result = await previewPurchase({ chain: CHAIN, investorWallet: ALICE, wptAmount: '3' });

    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.data.canPlaceOrder).toBe(true);
    expect(result.data.blockers).toEqual([]);
    // Khớp BÁO GIÁ của ledger, không phải một con số gõ lại trong test.
    expect(result.data.vndAmount).toBe((await ledger.quotePurchase(3n)).toString());
    expect(result.data.wptAmount).toBe('3');
    // Cả bốn phép kiểm đều đã chạy và đều đạt. Phép kiểm giá KHÔNG chạy: chưa có lệnh nào
    // nên không có giá cũ để so.
    expect(result.data.checks.map((c) => c.id)).toEqual([
      'paymentBalance',
      'allowance',
      'supply',
      'transferable',
    ]);
    expect(result.data.checks.every((c) => c.ok)).toBe(true);
  });

  /**
   * Ca 2 — ba tình huống thiếu điều kiện. Kiểm đúng `blockers`, và kiểm luôn rằng xem trước
   * không hề tạo lệnh: đây là đường mà FE-05 gọi liên tục trong lúc người dùng gõ.
   */
  it('ca 2a — thiếu số dư VNDB: blockers đúng, có howToFix và actual/required', async () => {
    // Thiếu ĐÚNG 1 VNDB so với giá một WPT. Suy từ `PRICE` chứ không gõ `99_999n`: con số tuyệt
    // đối chỉ thiếu 1 khi giá mặc định còn là 100.000, còn phần thiếu là điều ca này thật sự kiểm.
    const shortfall = 1n;
    await seedReadyToBuy({ vndb: PRICE - shortfall, allowance: 10_000_000n });

    const result = await previewPurchase({ chain: CHAIN, investorWallet: ALICE, wptAmount: '1' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.canPlaceOrder).toBe(false);
    expect(result.data.blockers).toEqual(['paymentBalance']);

    const blocked = result.data.checks.find((c) => !c.ok);
    expect(blocked?.ok).toBe(false);
    if (!blocked || blocked.ok) return;
    expect(blocked.reason).toMatch(/Số dư VNDB không đủ/);
    expect(blocked.actual).toBe((PRICE - shortfall).toString());
    expect(blocked.required).toBe(PRICE.toString());
    // Viết cho cán bộ ngân hàng đọc: không có từ kỹ thuật của ví.
    expect(blocked.howToFix).toMatch(new RegExp(`Nạp thêm ${shortfall} VNDB`));
    expect(blocked.howToFix).not.toMatch(/allowance|approve|revert/i);

    expect(await getOrderStore().listOrders({})).toHaveLength(0);
  });

  it('ca 2b — thiếu ủy quyền VNDB: blockers đúng, không tạo lệnh', async () => {
    await seedReadyToBuy({ vndb: 10_000_000n, allowance: PRICE - 1n });

    const result = await previewPurchase({ chain: CHAIN, investorWallet: ALICE, wptAmount: '1' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.blockers).toEqual(['allowance']);
    // Phép kiểm số dư đã chạy và ĐẠT, nên nó có mặt và `ok`. Phép kiểm sau nó thì vắng —
    // vắng nghĩa là chưa kiểm, không phải đã đạt.
    expect(result.data.checks.map((c) => c.id)).toEqual(['paymentBalance', 'allowance']);

    const blocked = result.data.checks.find((c) => !c.ok);
    if (!blocked || blocked.ok) throw new Error('phải có đúng một phép kiểm trượt');
    expect(blocked.howToFix).not.toMatch(/allowance|approve|revert/i);
    expect(await getOrderStore().listOrders({})).toHaveLength(0);
  });

  it('ca 2c — ví SPV thiếu WPT: blockers đúng, không tạo lệnh', async () => {
    await seedReadyToBuy({ supply: 3n });

    const result = await previewPurchase({ chain: CHAIN, investorWallet: ALICE, wptAmount: '4' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.canPlaceOrder).toBe(false);
    expect(result.data.blockers).toEqual(['supply']);
    expect(await getOrderStore().listOrders({})).toHaveLength(0);
  });

  it('ca 3 — xem trước KHÔNG ghi gì vào cơ sở dữ liệu', async () => {
    await seedReadyToBuy();
    const before = await snapshotStore();

    // Gọi nhiều lần, cả ca đạt lẫn ca bị chặn: FE-05 gọi theo từng ký tự người dùng gõ.
    for (const wptAmount of ['1', '3', '999999']) {
      const result = await previewPurchase({ chain: CHAIN, investorWallet: ALICE, wptAmount });
      expect(result.ok, `wptAmount=${wptAmount}`).toBe(true);
    }

    const after = await snapshotStore();
    expect(after.orders, 'không được tạo lệnh').toEqual(before.orders);
    expect(after.txns, 'không được ghi giao dịch').toEqual(before.txns);
    // Kể cả sổ kiểm toán: `authorize()` ghi một bản ghi cho MỖI lời gọi, nên dùng nó ở đây
    // sẽ đổ hàng chục bản ghi "đã cho phép xem" cho một lần mua.
    expect(after.audit, 'không được ghi sổ kiểm toán').toEqual(before.audit);
    expect(fault.sendCount).toBe(0);
  });

  /**
   * Ca 4 — CA THEN CHỐT. Cùng dữ liệu vào, xem trước và `executeOrder` phải trượt CÙNG MỘT
   * phép kiểm. Đây là thứ giữ hai đường không lệch nhau về sau: cả hai gọi cùng một
   * `runPurchaseChecks`, và ca này là cái đỏ lên nếu ai đó viết đường kiểm thứ hai.
   */
  for (const scenario of DEGRADATIONS) {
    it(`ca 4 — ${scenario.name}: xem trước và khớp lệnh trượt cùng một phép kiểm`, async () => {
      await seedReadyToBuy();
      const orderId = await placeAsInvestor('3');
      await scenario.degrade();

      // Xem trước TRƯỚC, vì nó chỉ đọc; khớp lệnh sau vì nó đổi trạng thái lệnh.
      actAs('INVESTOR');
      const preview = await previewPurchase({
        chain: CHAIN,
        investorWallet: ALICE,
        wptAmount: '3',
      });
      actAs('TELLER');
      const executed = await executeOrder({ chain: CHAIN, orderId });

      expect(preview.ok).toBe(true);
      expect(executed.ok).toBe(false);
      if (!preview.ok || executed.ok) return;

      const blocked = preview.data.checks.find((c) => !c.ok);
      if (!blocked || blocked.ok) throw new Error('xem trước phải thấy một phép kiểm trượt');

      // Cùng phép kiểm, cùng mã lỗi, cùng câu lý do — không chỉ "cùng thất bại".
      expect(preview.data.blockers).toEqual([scenario.blocker]);
      expect(blocked.code).toBe(executed.code);
      expect(blocked.reason).toBe(executed.error);
      expect(preview.data.canPlaceOrder).toBe(false);
    });
  }

  it('vai không có order:place không xem trước được', async () => {
    await seedReadyToBuy();

    for (const role of ['SELLER', 'TELLER', 'CONTROLLER']) {
      actAs(role);
      const result = await previewPurchase({ chain: CHAIN, investorWallet: ALICE, wptAmount: '1' });
      expect(result.ok, `${role} không được xem trước`).toBe(false);
      if (result.ok) continue;
      expect(result.code).toBe('FORBIDDEN');
    }
  });

  it('số lượng sai dạng bị chặn ở validate, dùng CÙNG schema với đặt lệnh', async () => {
    await seedReadyToBuy();

    for (const wptAmount of ['0', '-1', '1.5', 'abc', '']) {
      const preview = await previewPurchase({ chain: CHAIN, investorWallet: ALICE, wptAmount });
      const placed = await placeOrder({ chain: CHAIN, investorWallet: ALICE, wptAmount });

      // Hai đường phải từ chối CÙNG mã: xem trước nói "hợp lệ" cho dữ liệu mà đặt lệnh từ
      // chối vì sai dạng là đúng cái sai mà màn hình xem trước tồn tại để tránh.
      expect(preview.ok, `wptAmount=${wptAmount}`).toBe(false);
      expect(placed.ok).toBe(false);
      if (preview.ok || placed.ok) continue;
      expect(preview.code).toBe('VALIDATION');
      expect(preview.code).toBe(placed.code);
    }
  });
});

// =============================================================================
//  7.2 / 7.3 / 7.4 — TỪ CHỐI TRƯỚC KHI GỬI GIAO DỊCH
// =============================================================================
describe('executeOrder — từ chối trước khi gửi giao dịch', () => {
  /**
   * Cả ba ca dưới đây kiểm CÙNG ba điều: mã lỗi đúng, lệnh về `REJECTED`, và
   * `executePurchase` KHÔNG được gọi. Điều thứ ba là điều quan trọng nhất — mục đích của
   * bốn phép kiểm là không đốt phí vào giao dịch chắc chắn revert; test chỉ kiểm mã lỗi
   * thì vẫn xanh khi ai đó xoá hết phép kiểm và để hợp đồng tự từ chối.
   */
  async function expectRejected(orderId: string, code: string, reasonPattern: RegExp) {
    const before = await snapshotBalances();
    const result = await executeOrder({ chain: CHAIN, orderId });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(code);
    expect(result.error).toMatch(reasonPattern);

    // KHÔNG gửi giao dịch -> không tốn phí.
    expect(fault.sendCount, 'không được gửi giao dịch nào').toBe(0);
    expect(await snapshotBalances()).toEqual(before);

    const order = await getOrderStore().findOrder(orderId);
    expect(order?.status).toBe('REJECTED');
    expect(order?.txHash, 'REJECTED thì không có mã giao dịch').toBeNull();
    expect(order?.reason).toMatch(reasonPattern);
  }

  /**
   * 7.2 / 7.3 / 7.4 — cùng ba tình huống cũ, dựng theo đường đi có thật sau BE-03: lệnh
   * được đặt khi đủ điều kiện, rồi điều kiện tụt xuống trước khi khớp. Mã lỗi, câu lý do
   * và trạng thái `REJECTED` giữ nguyên như BE-02.
   */
  for (const scenario of DEGRADATIONS) {
    it(`${scenario.name} -> REJECTED, không gửi giao dịch`, async () => {
      await seedReadyToBuy();
      const orderId = await placeAsInvestor('3');
      await scenario.degrade();

      await expectRejected(orderId, scenario.code, scenario.reasonPattern);
    });
  }

  it('thứ tự kiểm: thiếu cả tiền lẫn ủy quyền thì báo THIẾU TIỀN trước', async () => {
    // Trả lời "chưa cấp ủy quyền" cho người chưa có tiền là chỉ sai việc phải làm.
    await seedReadyToBuy();
    const orderId = await placeAsInvestor('1');
    seedMockLedger({ paymentBalances: { [ALICE]: 0n }, paymentAllowances: { [ALICE]: 0n } });

    const result = await executeOrder({ chain: CHAIN, orderId });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('INSUFFICIENT_PAYMENT_BALANCE');
  });

  it('giá đổi sau khi đặt lệnh thì REJECTED với PRICE_CHANGED', async () => {
    await seedReadyToBuy();
    const orderId = await placeAsInvestor('2');

    // Ngân hàng đổi giá bán giữa lúc đặt và lúc khớp.
    seedMockLedger({ wptPriceVnd: 150_000n });

    const result = await executeOrder({ chain: CHAIN, orderId });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('PRICE_CHANGED');
    // Số đã chốt vẫn là số cũ: nghiệp vụ TỪ CHỐI, không âm thầm thu theo giá mới.
    const order = await getOrderStore().findOrder(orderId);
    expect(order?.vndAmount).toBe((2n * PRICE).toString());
    expect(fault.sendCount).toBe(0);
  });

  it('nhà đầu tư bị đóng băng thì bị chặn ở phép kiểm chuyển nhượng', async () => {
    const ledger = await seedReadyToBuy();
    const orderId = await placeAsInvestor('1');
    await ledger.freeze(ALICE, true);

    const result = await executeOrder({ chain: CHAIN, orderId });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/đóng băng/);
    expect(fault.sendCount).toBe(0);
    expect((await getOrderStore().findOrder(orderId))?.status).toBe('REJECTED');
  });
});

// =============================================================================
//  7.5 — KHỚP THÀNH CÔNG
// =============================================================================
describe('7.5 — khớp lệnh thành công', () => {
  it('số dư hai bên đổi đúng, cả WPT và VNDB', async () => {
    await seedReadyToBuy({ supply: 1_000n, vndb: 10_000_000n, allowance: 10_000_000n });
    const before = await snapshotBalances();
    const orderId = await placeAsInvestor('3');

    const result = await executeOrder({ chain: CHAIN, orderId });

    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;

    const cost = 3n * PRICE;
    const after = await snapshotBalances();
    expect(after.investorWpt).toBe(before.investorWpt + 3n);
    expect(after.spvWpt).toBe(before.spvWpt - 3n);
    expect(after.investorVndb).toBe(before.investorVndb - cost);
    expect(after.spvVndb).toBe(before.spvVndb + cost);
  });

  it('lệnh về COMPLETED, có mã giao dịch, số dư đọc lại TỪ CHUỖI', async () => {
    await seedReadyToBuy();
    const orderId = await placeAsInvestor('3');

    const result = await executeOrder({ chain: CHAIN, orderId });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.status).toBe('COMPLETED');
    expect(result.data.txStatus).toBe('CONFIRMED');
    expect(result.data.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    // R3.4: không tin biên nhận, đọc lại số dư thật.
    expect(result.data.balanceAfter).toBe((await getLedger(CHAIN).balanceOf(ALICE)).toString());
    expect(result.data.balanceAfter).toBe('3');

    const order = await getOrderStore().findOrder(orderId);
    expect(order?.status).toBe('COMPLETED');
    expect(order?.txHash).toBe(result.data.txHash);
  });

  it('giao dịch được lưu vào sổ Txn và audit ghi SUCCESS với vai ĐANG KHỚP', async () => {
    await seedReadyToBuy();
    const orderId = await placeAsInvestor('2');
    await executeOrder({ chain: CHAIN, orderId });

    const txns = await getStore().listTxns({ chain: CHAIN, wallet: ALICE });
    const purchase = txns.find((t) => t.operation === 'purchase');
    expect(purchase, 'phải có bản ghi giao dịch để đối soát').toBeDefined();
    expect(purchase?.status).toBe('CONFIRMED');
    expect(purchase?.amount).toBe('2');
    // Vai GỬI giao dịch, không phải vai đã đặt lệnh.
    expect(purchase?.actorRole).toBe('TELLER');

    const audit = await getStore().listAudit({ limit: 30 });
    const success = audit.find((e) => e.action === 'order:execute' && e.outcome === 'SUCCESS');
    expect(success?.actorRole).toBe('TELLER');
    expect(success?.detail).toMatch(/khớp 2 WPT/);
  });
});

// =============================================================================
//  7.6 — KHỚP THẤT BẠI
// =============================================================================
describe('7.6 — khớp lệnh thất bại', () => {
  it('gửi giao dịch lỗi: KHÔNG bên nào đổi số dư, lệnh về FAILED', async () => {
    await seedReadyToBuy();
    const orderId = await placeAsInvestor('3');
    const before = await snapshotBalances();

    fault.mode = 'throw';
    const result = await executeOrder({ chain: CHAIN, orderId });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('LEDGER');

    // Điểm cốt lõi: không nửa vời. Không ai bị trừ, không ai được cộng.
    expect(await snapshotBalances()).toEqual(before);

    const order = await getOrderStore().findOrder(orderId);
    // FAILED, KHÔNG phải REJECTED: đã chiếm EXECUTING nên không còn chứng minh được là
    // chưa có giao dịch nào lên chuỗi.
    expect(order?.status).toBe('FAILED');
    expect(order?.reason).toMatch(/không đủ WPT/);
  });

  it('biên nhận FAILED: lệnh về FAILED, số dư không đổi, sổ Txn ghi FAILED', async () => {
    await seedReadyToBuy();
    const orderId = await placeAsInvestor('3');
    const before = await snapshotBalances();

    fault.mode = 'receipt-failed';
    const result = await executeOrder({ chain: CHAIN, orderId });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('LEDGER');
    expect(result.error).toMatch(/revert/);
    expect(await snapshotBalances()).toEqual(before);

    const order = await getOrderStore().findOrder(orderId);
    expect(order?.status).toBe('FAILED');
    // R3.2: mã giao dịch được lưu TRƯỚC khi chờ biên nhận, nên vẫn còn dấu vết đối soát.
    expect(order?.txHash).toBe(`0x${'f'.repeat(64)}`);

    const txn = (await getStore().listTxns({ chain: CHAIN, wallet: ALICE })).find(
      (t) => t.operation === 'purchase',
    );
    expect(txn?.status).toBe('FAILED');
  });

  it('lệnh FAILED không khớp lại được', async () => {
    await seedReadyToBuy();
    const orderId = await placeAsInvestor('3');
    fault.mode = 'throw';
    await executeOrder({ chain: CHAIN, orderId });

    fault.mode = null;
    const again = await executeOrder({ chain: CHAIN, orderId });
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.code).toBe('ORDER_STATE');
    expect(again.error).toMatch(/FAILED/);
  });
});

// =============================================================================
//  7.7 — CHỈ GỬI MỘT GIAO DỊCH
// =============================================================================
describe('7.7 — một lệnh chỉ gửi đúng một giao dịch', () => {
  it('gọi executeOrder hai lần tuần tự: chỉ một lần gửi', async () => {
    await seedReadyToBuy();
    const orderId = await placeAsInvestor('3');

    const first = await executeOrder({ chain: CHAIN, orderId });
    const second = await executeOrder({ chain: CHAIN, orderId });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe('ORDER_STATE');

    expect(fault.sendCount, 'chỉ được gửi ĐÚNG MỘT giao dịch').toBe(1);
    // Nhà đầu tư bị trừ tiền đúng một lần.
    expect((await snapshotBalances()).investorVndb).toBe(10_000_000n - 3n * PRICE);
    expect((await snapshotBalances()).investorWpt).toBe(3n);
  });

  it('gọi đồng thời hai lần: chỉ một lần gửi, một lời gọi bị chặn', async () => {
    await seedReadyToBuy();
    const orderId = await placeAsInvestor('3');

    // Đây là ca mà khoá lạc quan tồn tại để xử lý: hai lời gọi cùng thấy PLACED.
    const [a, b] = await Promise.all([
      executeOrder({ chain: CHAIN, orderId }),
      executeOrder({ chain: CHAIN, orderId }),
    ]);

    expect([a.ok, b.ok].filter(Boolean).length, 'đúng một lời gọi thành công').toBe(1);
    expect(fault.sendCount, 'chỉ được gửi ĐÚNG MỘT giao dịch').toBe(1);
    expect((await snapshotBalances()).investorVndb).toBe(10_000_000n - 3n * PRICE);

    const loser = a.ok ? b : a;
    if (!loser.ok) expect(loser.code).toBe('ORDER_STATE');
  });

  it('lệnh đã COMPLETED thì gọi lại trả ORDER_STATE, không gửi thêm', async () => {
    await seedReadyToBuy();
    const orderId = await placeAsInvestor('3');
    await executeOrder({ chain: CHAIN, orderId });

    fault.sendCount = 0;
    const again = await executeOrder({ chain: CHAIN, orderId });

    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.code).toBe('ORDER_STATE');
    expect(again.error).toMatch(/COMPLETED/);
    expect(fault.sendCount).toBe(0);
  });

  it('khớp lệnh trên chain khác chain đã đặt bị từ chối', async () => {
    await seedReadyToBuy();
    const orderId = await placeAsInvestor('3');

    const result = await executeOrder({ chain: 'hardhat-local', orderId });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('ORDER_STATE');
    expect(fault.sendCount).toBe(0);
  });
});

// =============================================================================
//  7.8 — NHÀ ĐẦU TƯ KHÔNG XEM ĐƯỢC LỆNH CỦA VÍ KHÁC
// =============================================================================
describe('7.8 — listOrders lọc theo ví ở tầng nghiệp vụ', () => {
  async function seedTwoInvestors() {
    await seedReadyToBuy({ investor: ALICE });
    // BOB phải có tiền, không chỉ có KYC: từ BE-03 `placeOrder` kiểm điều kiện nên một ví
    // rỗng không đặt được lệnh nào, và cả bốn ca dưới đây cần BOB có đúng một lệnh.
    await fundInvestor(BOB);
    await placeAsInvestor('1', ALICE);
    await placeAsInvestor('2', BOB);
  }

  it('danh sách của ALICE KHÔNG lẫn lệnh của BOB', async () => {
    await seedTwoInvestors();
    actAs('INVESTOR');

    const result = await listOrders({ chain: CHAIN, investorWallet: ALICE });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0].investorWallet).toBe(ALICE);
    expect(result.data.some((o) => o.investorWallet === BOB)).toBe(false);
  });

  it('nhà đầu tư KHÔNG truyền ví thì lỗi validate, KHÔNG trả lệnh của mọi ví', async () => {
    await seedTwoInvestors();
    actAs('INVESTOR');

    // Rào chống rò dữ liệu: thiếu tham số phải thành lỗi validate, không thành
    // "trả về toàn bộ sổ lệnh".
    const result = await listOrders({ chain: CHAIN });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
    expect(result.fieldErrors?.investorWallet).toBeDefined();
  });

  it('vai ngân hàng xem được toàn bộ lệnh và lọc được theo trạng thái', async () => {
    await seedTwoInvestors();
    actAs('TELLER');

    const all = await listOrders({ chain: CHAIN });
    expect(all.ok).toBe(true);
    if (!all.ok) return;
    expect(all.data).toHaveLength(2);

    const placed = await listOrders({ chain: CHAIN, status: 'PLACED' });
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    expect(placed.data).toHaveLength(2);

    const completed = await listOrders({ chain: CHAIN, status: 'COMPLETED' });
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;
    expect(completed.data).toHaveLength(0);
  });

  it('lọc không phân biệt chữ hoa thường của địa chỉ', async () => {
    await seedTwoInvestors();
    actAs('INVESTOR');

    const result = await listOrders({ chain: CHAIN, investorWallet: ALICE.toLowerCase() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
  });

  it('trạng thái lạ bị chặn ở validate', async () => {
    actAs('TELLER');
    const result = await listOrders({ chain: CHAIN, status: 'PAID' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
  });
});

// =============================================================================
//  7.9 — VAI KHÔNG CÓ order:execute BỊ CHẶN VÀ CÓ BẢN GHI KIỂM TOÁN
// =============================================================================
describe('7.9 — cổng quyền order:execute', () => {
  it('ba vai không có quyền đều bị chặn, không gửi giao dịch, có bản ghi DENIED', async () => {
    await seedReadyToBuy();
    const orderId = await placeAsInvestor('3');
    const before = await snapshotBalances();

    for (const role of ['INVESTOR', 'SELLER', 'CONTROLLER']) {
      actAs(role);
      const result = await executeOrder({ chain: CHAIN, orderId });

      expect(result.ok, `${role} không được khớp lệnh`).toBe(false);
      if (result.ok) continue;
      expect(result.code).toBe('FORBIDDEN');
    }

    expect(fault.sendCount).toBe(0);
    expect(await snapshotBalances()).toEqual(before);

    const audit = await getStore().listAudit({ limit: 30 });
    const denied = audit.filter((e) => e.action === 'order:execute' && e.outcome === 'DENIED');
    expect(denied.length, 'cả ba lần bị chặn đều phải có bản ghi').toBe(3);
    expect(denied.map((e) => e.actorRole).sort()).toEqual(['CONTROLLER', 'INVESTOR', 'SELLER']);
  });

  it('bị chặn KHÔNG làm đổi trạng thái lệnh', async () => {
    await seedReadyToBuy();
    const orderId = await placeAsInvestor('3');

    actAs('INVESTOR');
    await executeOrder({ chain: CHAIN, orderId });

    // Vẫn PLACED: một lần bị chặn không được đẩy lệnh sang CHECKING rồi bỏ đó.
    expect((await getOrderStore().findOrder(orderId))?.status).toBe('PLACED');
  });
});

// =============================================================================
//  LỆNH QUÁ HẠN
// =============================================================================
describe('expireStaleOrders', () => {
  it('chuyển lệnh PLACED quá hạn sang EXPIRED và ghi sổ kiểm toán', async () => {
    await seedReadyToBuy();
    const orderId = await placeAsInvestor('1');

    const orderStore = getOrderStore();
    expect(await orderStore.listOrders({})).toHaveLength(1);

    // Kéo `createdAt` về quá khứ thay vì chờ thật.
    //
    // Chạm thẳng vào state của bản bộ nhớ là có chủ ý: `IOrderStore` không có (và không nên
    // có) method sửa thời điểm tạo — một method như vậy chỉ phục vụ test mà lại mở đường
    // viết lại lịch sử trong sản phẩm. Đổi ngược đồng hồ hệ thống thì ảnh hưởng cả tiến
    // trình. Cách này chỉ hỏng khi `memory.store.ts` đổi cấu trúc, và lúc đó test đỏ đúng chỗ.
    makeOrderStale(0, new Date(Date.now() - 60 * 60_000).toISOString());

    actAs('TELLER');
    const result = await expireStaleOrders({ olderThanMinutes: 30 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.expired).toBe(1);
    expect((await orderStore.findOrder(orderId))?.status).toBe('EXPIRED');

    const audit = await getStore().listAudit({ limit: 20 });
    expect(audit.some((e) => e.action === 'order:expire' && e.outcome === 'SUCCESS')).toBe(true);
  });

  it('KHÔNG chạm lệnh còn mới', async () => {
    await seedReadyToBuy();
    const orderId = await placeAsInvestor('1');

    actAs('TELLER');
    const result = await expireStaleOrders({ olderThanMinutes: 30 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.expired).toBe(0);
    expect((await getOrderStore().findOrder(orderId))?.status).toBe('PLACED');
  });

  it('olderThanMinutes = 0 bị chặn ở validate', async () => {
    actAs('TELLER');
    // Cho 0 đi qua sẽ hết hạn cả lệnh vừa đặt xong, tức giết luồng mua bằng một tham số nhầm.
    const result = await expireStaleOrders({ olderThanMinutes: 0 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
  });

  it('vai không có order:expire bị chặn', async () => {
    for (const role of ['INVESTOR', 'SELLER', 'CONTROLLER']) {
      actAs(role);
      const result = await expireStaleOrders({ olderThanMinutes: 30 });
      expect(result.ok, `${role} không được dọn lệnh`).toBe(false);
    }
  });
});

// =============================================================================
//  BE-14 — CHIỀU BÁN VÀ NĂM BƯỚC QUYẾT TOÁN
// =============================================================================
//
//  Nhà đầu tư có WPT bằng cách MUA trước qua đúng luồng mua (không có hàm nạp WPT), nên mọi ca
//  dưới đây cũng đi qua chiều mua — chiều bán không có lối tắt nào khác ngoài đời.

/** Nhà đầu tư mua `held` WPT qua luồng mua thật; ví SPV nhận VNDB từ chính lần mua đó. */
async function holdWpt(held: string, investor = ALICE) {
  if (investor === ALICE) await seedReadyToBuy();
  else await fundInvestor(investor);
  const orderId = await placeAsInvestor(held, investor);
  const bought = await executeOrder({ chain: CHAIN, orderId });
  expect(bought.ok, bought.ok ? '' : bought.error).toBe(true);
}

/** Dựng lệnh BÁN ở PLACED để kiểm riêng đường can thiệp tay. */
async function placeSaleAsInvestor(wptAmount: string, investor = ALICE): Promise<string> {
  const placed = await getOrderStore().createOrder({
    chain: CHAIN,
    investorWallet: investor,
    clientRequestId: crypto.randomUUID(),
    side: 'SELL',
    wptAmount,
    vndAmount: (BigInt(wptAmount) * PRICE).toString(),
    actorRole: 'INVESTOR',
  });
  actAs('TELLER');
  return placed.id;
}

/** Phần chưa phân phối (WPT còn trong ví SPV) và phần đang lưu hành — cùng công thức BE-12. */
async function supplySplit() {
  const ledger = getLedger(CHAIN);
  const undistributed = await ledger.balanceOf(SPV);
  const { totalSupply } = await ledger.tokenInfo();
  return { undistributed, circulating: totalSupply - undistributed };
}

describe('BE-14 ca 1 — bán thành công', () => {
  it('token về ví người bán, VNDB về nhà đầu tư, số đúng, lệnh COMPLETED', async () => {
    await holdWpt('10');
    const before = await snapshotBalances();
    const orderId = await placeSaleAsInvestor('4');

    const result = await executeOrder({ chain: CHAIN, orderId });

    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    const proceeds = 4n * PRICE;
    expect(await snapshotBalances()).toEqual({
      investorWpt: before.investorWpt - 4n,
      investorVndb: before.investorVndb + proceeds,
      spvWpt: before.spvWpt + 4n,
      spvVndb: before.spvVndb - proceeds,
    });
    expect(result.data.status).toBe('COMPLETED');
    expect(result.data.side).toBe('SELL');
    // Số VNDB CHỐT lúc đặt lệnh theo giá cấu hình — nhà đầu tư không nhập giá.
    expect(result.data.vndAmount).toBe(proceeds.toString());
    expect(result.data.balanceAfter).toBe('6');
    expect(result.data.paymentBalanceAfter).toBe((before.investorVndb + proceeds).toString());
  });

  it('sổ Txn ghi nghiệp vụ "sale", chiều WPT từ nhà đầu tư', async () => {
    await holdWpt('5');
    const orderId = await placeSaleAsInvestor('2');
    await executeOrder({ chain: CHAIN, orderId });

    const txns = await getStore().listTxns({ chain: CHAIN, wallet: ALICE });
    const sale = txns.find((t) => t.operation === 'sale');
    expect(sale?.status).toBe('CONFIRMED');
    expect(sale?.fromWallet).toBe(ALICE);
    expect(sale?.amount).toBe('2');
  });

  it('xem trước lệnh bán dùng chung bộ kiểm: báo giá theo cấu hình, không có phép chặn', async () => {
    await holdWpt('5');
    actAs('INVESTOR');
    const preview = await previewPurchase({ chain: CHAIN, investorWallet: ALICE, wptAmount: '3', side: 'SELL' });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.data.side).toBe('SELL');
    expect(preview.data.vndAmount).toBe((3n * PRICE).toString());
    expect(preview.data.canPlaceOrder).toBe(true);
    expect(preview.data.checks.map((c) => c.id)).toEqual(['holding', 'sellerLiquidity', 'transferable']);
  });
});

describe('BE-14 ca 2 — bán khi thiếu token: từ chối, KHÔNG gửi giao dịch', () => {
  it('đặt lệnh vượt số đang giữ bị chặn trước khi tạo bản ghi', async () => {
    await holdWpt('3');
    fault.sendCount = 0;
    actAs('INVESTOR');

    const placed = await placeOrder({ chain: CHAIN, investorWallet: ALICE, wptAmount: '4', side: 'SELL' });

    expect(placed.ok).toBe(false);
    if (placed.ok) return;
    expect(placed.code).toBe('INSUFFICIENT_HOLDING');
    expect((await getOrderStore().listOrders({ side: 'SELL' })).length).toBe(0);
    expect(fault.sendCount).toBe(0);
  });

  it('token tụt xuống sau khi đặt: khớp lệnh REJECTED, không gửi, số dư không đổi', async () => {
    await holdWpt('5');
    await getLedger(CHAIN).whitelist(BOB);
    const orderId = await placeSaleAsInvestor('5');
    // Nhà đầu tư chuyển bớt WPT đi sau khi đặt lệnh bán.
    await getLedger(CHAIN).transfer(ALICE, BOB, 2n);
    fault.sendCount = 0;
    const before = await snapshotBalances();

    const result = await executeOrder({ chain: CHAIN, orderId });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('INSUFFICIENT_HOLDING');
    expect(fault.sendCount).toBe(0);
    expect(await snapshotBalances()).toEqual(before);
    expect((await getOrderStore().findOrder(orderId))?.status).toBe('REJECTED');
  });
});

describe('BE-14 ca 3 — ví người bán thiếu VNDB: từ chối, không bên nào đổi số dư', () => {
  it('xem trước và đặt lệnh nêu đúng phép kiểm thanh khoản người bán', async () => {
    await holdWpt('5');
    // Ví SPV chỉ còn đủ trả cho 1 WPT.
    seedMockLedger({ paymentBalances: { [SPV]: PRICE } });
    actAs('INVESTOR');

    const preview = await previewPurchase({ chain: CHAIN, investorWallet: ALICE, wptAmount: '2', side: 'SELL' });
    expect(preview.ok && preview.data.blockers).toEqual(['sellerLiquidity']);

    const placed = await placeOrder({ chain: CHAIN, investorWallet: ALICE, wptAmount: '2', side: 'SELL' });
    expect(placed.ok).toBe(false);
    if (placed.ok) return;
    expect(placed.code).toBe('INSUFFICIENT_SELLER_LIQUIDITY');
  });

  it('VNDB của người bán tụt sau khi đặt: REJECTED trước khi gửi, số dư hai bên giữ nguyên', async () => {
    await holdWpt('5');
    const orderId = await placeSaleAsInvestor('3');
    seedMockLedger({ paymentBalances: { [SPV]: 0n } });
    fault.sendCount = 0;
    const before = await snapshotBalances();

    const result = await executeOrder({ chain: CHAIN, orderId });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('INSUFFICIENT_SELLER_LIQUIDITY');
    expect(fault.sendCount).toBe(0);
    expect(await snapshotBalances()).toEqual(before);
    expect((await getOrderStore().findOrder(orderId))?.status).toBe('REJECTED');
  });
});

describe('BE-14 ca 4 — bán làm tăng phần chưa phân phối, giảm phần đang lưu hành', () => {
  it('đúng bằng số lượng bán, tổng cung không đổi', async () => {
    await holdWpt('10');
    const before = await supplySplit();
    const orderId = await placeSaleAsInvestor('4');

    await executeOrder({ chain: CHAIN, orderId });

    const after = await supplySplit();
    expect(after.undistributed).toBe(before.undistributed + 4n);
    expect(after.circulating).toBe(before.circulating - 4n);
  });
});

describe('BE-14 đột biến 1 — khớp lệnh bán thất bại giữa chừng', () => {
  it('KHÔNG bên nào đổi số dư, lệnh FAILED, bước quyết toán trượt, không bút toán nào ghi', async () => {
    await holdWpt('5');
    const orderId = await placeSaleAsInvestor('3');
    const before = await snapshotBalances();
    const splitBefore = await supplySplit();

    fault.mode = 'throw';
    const result = await executeOrder({ chain: CHAIN, orderId });

    expect(result.ok).toBe(false);
    expect(await snapshotBalances()).toEqual(before);
    expect(await supplySplit()).toEqual(splitBefore);

    actAs('TELLER');
    const listed = await listOrders({ chain: CHAIN, orderId });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    const order = listed.data[0];
    expect(order.status).toBe('FAILED');
    expect(order.steps.map((step) => step.state)).toEqual(['done', 'done', 'done', 'failed', 'pending']);
    expect(order.settlement.outcome).toBe('NONE_APPLIED');
  });
});

describe('BE-14 ca 5 — năm bước quyết toán có mốc thời gian, ánh xạ đúng từ bảy trạng thái', () => {
  const STEP_IDS = ['created', 'checking', 'reconciling', 'settling', 'completed'];

  it('lệnh bán hoàn tất: đủ năm bước, mỗi bước có mốc, mốc không lùi', async () => {
    await holdWpt('5');
    const orderId = await placeSaleAsInvestor('2');
    await executeOrder({ chain: CHAIN, orderId });

    const listed = await listOrders({ chain: CHAIN, orderId });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    const { steps, settlement } = listed.data[0];
    expect(steps.map((step) => step.id)).toEqual(STEP_IDS);
    expect(steps.every((step) => step.state === 'done' && step.at !== null)).toBe(true);
    const times = steps.map((step) => Date.parse(step.at!));
    expect([...times].sort((a, b) => a - b)).toEqual(times);

    // Bước quyết toán là MỘT bước: bốn bút toán, cùng thành công.
    expect(settlement.atomic).toBe(true);
    expect(settlement.outcome).toBe('APPLIED');
    expect(settlement.rule).toMatch(/cùng thành công hoặc cùng huỷ/);
    expect(settlement.entries).toEqual([
      { account: 'INVESTOR', asset: 'WPT', direction: 'DEBIT', amount: '2' },
      { account: 'SELLER', asset: 'WPT', direction: 'CREDIT', amount: '2' },
      { account: 'SELLER', asset: 'VNDB', direction: 'DEBIT', amount: (2n * PRICE).toString() },
      { account: 'INVESTOR', asset: 'VNDB', direction: 'CREDIT', amount: (2n * PRICE).toString() },
    ]);
  });

  /**
   * Bảy trạng thái -> năm bước. Dựng lệnh ở từng trạng thái qua CHÍNH cổng lưu trữ (đúng các
   * lần chuyển mà nghiệp vụ dùng), rồi đọc qua `listOrders` — tức là đọc đúng thứ giao diện nhận.
   */
  it.each([
    ['PLACED', [], ['done', 'pending', 'pending', 'pending', 'pending']],
    ['CHECKING', ['CHECKING'], ['done', 'current', 'pending', 'pending', 'pending']],
    ['EXECUTING', ['CHECKING', 'EXECUTING'], ['done', 'done', 'done', 'current', 'pending']],
    ['COMPLETED', ['CHECKING', 'EXECUTING', 'COMPLETED'], ['done', 'done', 'done', 'done', 'done']],
    ['REJECTED', ['CHECKING', 'REJECTED'], ['done', 'failed', 'pending', 'pending', 'pending']],
    ['FAILED', ['CHECKING', 'EXECUTING', 'FAILED'], ['done', 'done', 'done', 'failed', 'pending']],
    ['EXPIRED', ['EXPIRED'], ['done', 'failed', 'pending', 'pending', 'pending']],
  ] as const)('%s', async (status, path, expected) => {
    const store = getOrderStore();
    const created = await store.createOrder({
      chain: CHAIN,
      investorWallet: ALICE,
      side: 'SELL',
      wptAmount: '1',
      vndAmount: PRICE.toString(),
      actorRole: 'INVESTOR',
    });
    let from: string = 'PLACED';
    for (const to of path) {
      // Đúng luồng thật: rời EXECUTING thì giao dịch đã được gửi và gắn mã.
      if (from === 'EXECUTING') {
        await store.attachOrderTxHash({ id: created.id, txHash: `0x${'a'.repeat(63)}${path.length}` });
      }
      const moved = await store.transitionOrder({ id: created.id, from: [from as 'PLACED'], to });
      expect(moved?.status).toBe(to);
      from = to;
    }

    actAs('TELLER');
    const listed = await listOrders({ chain: CHAIN, orderId: created.id });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    const { steps } = listed.data[0];
    expect(listed.data[0].status).toBe(status);
    expect(steps.map((step) => step.state)).toEqual(expected);
    // Bước xong, đang làm hoặc trượt đều có mốc (trừ "quyết toán đang làm" khi chưa gửi giao
    // dịch); bước chưa tới không có mốc.
    for (const step of steps) {
      if (step.state === 'pending') expect(step.at, step.id).toBeNull();
      else if (!(step.id === 'settling' && step.state === 'current')) expect(step.at, step.id).not.toBeNull();
    }
  });
});

describe('BE-14 ca 6 — nhà đầu tư không xem được lệnh của ví khác', () => {
  async function aliceSellsBobBuys() {
    await holdWpt('5', ALICE);
    await placeSaleAsInvestor('1', ALICE);
    await fundInvestor(BOB);
    const bobOrderId = await placeAsInvestor('2', BOB);
    return bobOrderId;
  }

  it('danh sách của ALICE không lẫn lệnh của BOB, kể cả khi dò đúng mã lệnh của BOB', async () => {
    const bobOrderId = await aliceSellsBobBuys();
    actAs('INVESTOR');

    const mine = await listOrders({ chain: CHAIN, investorWallet: ALICE });
    expect(mine.ok).toBe(true);
    if (!mine.ok) return;
    expect(mine.data.length).toBeGreaterThan(0);
    expect(mine.data.every((o) => o.investorWallet === ALICE)).toBe(true);

    const probe = await listOrders({ chain: CHAIN, investorWallet: ALICE, orderId: bobOrderId });
    expect(probe.ok).toBe(true);
    if (!probe.ok) return;
    expect(probe.data).toHaveLength(0);
  });

  it('người bán và hai vai vận hành xem toàn bộ, không cần truyền ví', async () => {
    await aliceSellsBobBuys();
    for (const role of ['SELLER', 'TELLER', 'CONTROLLER']) {
      actAs(role);
      const all = await listOrders({ chain: CHAIN });
      expect(all.ok, role).toBe(true);
      if (!all.ok) return;
      const wallets = new Set(all.data.map((o) => o.investorWallet));
      expect(wallets, role).toEqual(new Set([ALICE, BOB]));
    }
  });

  it('việc 11 — lọc theo chiều, trạng thái, khoảng ngày và mã lệnh', async () => {
    const bobOrderId = await aliceSellsBobBuys();
    actAs('TELLER');

    const sells = await listOrders({ chain: CHAIN, side: 'SELL' });
    expect(sells.ok && sells.data.map((o) => o.side)).toEqual(['SELL']);

    const placedBuys = await listOrders({ chain: CHAIN, side: 'BUY', status: 'PLACED' });
    expect(placedBuys.ok && placedBuys.data.map((o) => o.id)).toEqual([bobOrderId]);

    const byId = await listOrders({ chain: CHAIN, orderId: bobOrderId });
    expect(byId.ok && byId.data.map((o) => o.id)).toEqual([bobOrderId]);

    const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
    const inDay = await listOrders({ chain: CHAIN, fromDate: today, toDate: today });
    expect(inDay.ok && inDay.data.length).toBe(3);
    const tomorrow = new Date(Date.parse(`${today}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    const later = await listOrders({ chain: CHAIN, fromDate: tomorrow });
    expect(later.ok && later.data.length).toBe(0);

    const reversed = await listOrders({ chain: CHAIN, fromDate: tomorrow, toDate: today });
    expect(reversed.ok).toBe(false);
    if (reversed.ok) return;
    expect(reversed.code).toBe('VALIDATION');
  });
});

describe('BE-14 ca 7 — số liệu khớp lệnh trong ngày đủ bốn ô, đúng cả hai chiều', () => {
  it('hai lệnh mua và một lệnh bán đã khớp; lệnh chưa khớp không được đếm', async () => {
    await holdWpt('10'); // mua 1: 10 WPT
    const secondBuy = await placeAsInvestor('2'); // mua 2: 2 WPT
    await executeOrder({ chain: CHAIN, orderId: secondBuy });
    const sale = await placeSaleAsInvestor('3'); // bán: 3 WPT
    await executeOrder({ chain: CHAIN, orderId: sale });
    await placeSaleAsInvestor('1'); // còn PLACED — không đếm

    actAs('SELLER');
    const stats = await orderDailyStats({ chain: CHAIN });

    expect(stats.ok, stats.ok ? '' : stats.error).toBe(true);
    if (!stats.ok) return;
    expect(stats.data.tiles.map((t) => [t.id, t.value])).toEqual([
      ['buyCount', '2'],
      ['buyValue', (12n * PRICE).toString()],
      ['sellCount', '1'],
      ['sellValue', (3n * PRICE).toString()],
    ]);
    expect(stats.data.bySide.SELL.wptAmount).toBe('3');
  });

  it('hai vai vận hành xem được; nhà đầu tư bị chặn vì đây là số liệu toàn hệ', async () => {
    for (const role of ['TELLER', 'CONTROLLER']) {
      actAs(role);
      expect((await orderDailyStats({})).ok, role).toBe(true);
    }
    actAs('INVESTOR');
    const denied = await orderDailyStats({});
    expect(denied.ok).toBe(false);
  });

  it('ngày khác không lẫn số liệu hôm nay', async () => {
    await holdWpt('2');
    actAs('TELLER');
    const stats = await orderDailyStats({ chain: CHAIN, date: '2020-01-01' });
    expect(stats.ok && stats.data.tiles.map((t) => t.value)).toEqual(['0', '0', '0', '0']);
  });
});
