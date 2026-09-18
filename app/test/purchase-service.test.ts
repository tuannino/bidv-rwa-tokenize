import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
const { executeOrder, expireStaleOrders, listOrders, placeOrder } = await import(
  '@/lib/bank/purchase.service'
);

const ALICE = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const BOB = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const SPV = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';

const CHAIN = 'mock';
/** Giá mặc định của adapter mock: 1 WPT = 100.000 VNDB. */
const PRICE = 100_000n;

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

/** Đặt lệnh với vai INVESTOR rồi trả về mã lệnh, đồng thời đổi sang vai ngân hàng. */
async function placeAsInvestor(wptAmount: string, investor = ALICE): Promise<string> {
  actAs('INVESTOR');
  const placed = await placeOrder({ chain: CHAIN, investorWallet: investor, wptAmount });
  expect(placed.ok, `đặt lệnh phải thành công: ${placed.ok ? '' : placed.error}`).toBe(true);
  if (!placed.ok) throw new Error('không đặt được lệnh');
  actAs('BANK_ADMIN');
  return placed.data.id;
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
  it('tính đúng số VNDB phải trả và lưu vào lệnh', async () => {
    await seedReadyToBuy();

    const result = await placeOrder({ chain: CHAIN, investorWallet: ALICE, wptAmount: '7' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('PLACED');
    expect(result.data.wptAmount).toBe('7');
    expect(result.data.vndAmount).toBe((7n * PRICE).toString());
    // Chuỗi, không phải number: uint256 vượt Number.MAX_SAFE_INTEGER là mất chính xác.
    expect(typeof result.data.vndAmount).toBe('string');
    expect(result.data.txHash).toBeNull();
  });

  it('KHÔNG gửi giao dịch nào khi chỉ đặt lệnh', async () => {
    await seedReadyToBuy();
    const before = await snapshotBalances();

    await placeOrder({ chain: CHAIN, investorWallet: ALICE, wptAmount: '5' });

    expect(fault.sendCount).toBe(0);
    expect(await snapshotBalances()).toEqual(before);
  });

  it('vai không có order:place bị chặn, có bản ghi kiểm toán DENIED', async () => {
    for (const role of ['BANK_ADMIN', 'COMPLIANCE', 'AUDITOR']) {
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

  it('7.2 — thiếu số dư VNDB thì REJECTED, không gửi giao dịch', async () => {
    // Đủ ủy quyền nhưng không đủ tiền: tách hai điều kiện để chắc chắn phép kiểm nào chạy.
    await seedReadyToBuy({ vndb: 99_999n, allowance: 10_000_000n });
    const orderId = await placeAsInvestor('1');

    await expectRejected(orderId, 'INSUFFICIENT_PAYMENT_BALANCE', /Số dư VNDB không đủ/);
  });

  it('7.3 — thiếu ủy quyền VNDB thì REJECTED', async () => {
    await seedReadyToBuy({ vndb: 10_000_000n, allowance: 99_999n });
    const orderId = await placeAsInvestor('1');

    await expectRejected(orderId, 'INSUFFICIENT_ALLOWANCE', /Ủy quyền VNDB không đủ/);
  });

  it('7.4 — ví thanh toán SPV thiếu WPT thì REJECTED', async () => {
    await seedReadyToBuy({ supply: 3n });
    const orderId = await placeAsInvestor('4');

    await expectRejected(orderId, 'INSUFFICIENT_SUPPLY', /không đủ WPT/);
  });

  it('chưa phát hành nguồn cung thì REJECTED với INSUFFICIENT_SUPPLY', async () => {
    // Không gọi mintInitialSupply -> `spvWallet()` trả null, không có ví nào để đọc tồn.
    const ledger = getLedger(CHAIN);
    await ledger.whitelist(ALICE);
    seedMockLedger({ paymentBalances: { [ALICE]: 10_000_000n }, paymentAllowances: { [ALICE]: 10_000_000n } });
    const orderId = await placeAsInvestor('1');

    await expectRejected(orderId, 'INSUFFICIENT_SUPPLY', /Chưa phát hành nguồn cung/);
  });

  it('thứ tự kiểm: thiếu cả tiền lẫn ủy quyền thì báo THIẾU TIỀN trước', async () => {
    // Trả lời "chưa cấp ủy quyền" cho người chưa có tiền là chỉ sai việc phải làm.
    await seedReadyToBuy({ vndb: 0n, allowance: 0n });
    const orderId = await placeAsInvestor('1');

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
    expect(purchase?.actorRole).toBe('BANK_ADMIN');

    const audit = await getStore().listAudit({ limit: 30 });
    const success = audit.find((e) => e.action === 'order:execute' && e.outcome === 'SUCCESS');
    expect(success?.actorRole).toBe('BANK_ADMIN');
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
    await getLedger(CHAIN).whitelist(BOB);
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
    actAs('BANK_ADMIN');

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
    actAs('BANK_ADMIN');
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

    for (const role of ['INVESTOR', 'COMPLIANCE', 'AUDITOR']) {
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
    expect(denied.map((e) => e.actorRole).sort()).toEqual(['AUDITOR', 'COMPLIANCE', 'INVESTOR']);
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

    actAs('BANK_ADMIN');
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

    actAs('BANK_ADMIN');
    const result = await expireStaleOrders({ olderThanMinutes: 30 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.expired).toBe(0);
    expect((await getOrderStore().findOrder(orderId))?.status).toBe('PLACED');
  });

  it('olderThanMinutes = 0 bị chặn ở validate', async () => {
    actAs('BANK_ADMIN');
    // Cho 0 đi qua sẽ hết hạn cả lệnh vừa đặt xong, tức giết luồng mua bằng một tham số nhầm.
    const result = await expireStaleOrders({ olderThanMinutes: 0 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
  });

  it('vai không có order:expire bị chặn', async () => {
    for (const role of ['INVESTOR', 'COMPLIANCE', 'AUDITOR']) {
      actAs(role);
      const result = await expireStaleOrders({ olderThanMinutes: 30 });
      expect(result.ok, `${role} không được dọn lệnh`).toBe(false);
    }
  });
});
