import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONFIG_KEYS,
  DISTRIBUTION_BATCH_SIZE,
  WPT_ISSUE_PRICE_VND,
} from '@/lib/config/issue-terms';
import type { ILedgerPort, TxResult } from '@/lib/ledger/ledger.port';

/**
 * BE-06 — NGHIỆP VỤ CHIA LỢI NHUẬN. Tám ca kiểm thử và hai đột biến ở `requirements.md`.
 *
 * Chạy trên chain `mock`: adapter mock mô phỏng đúng ràng buộc của `ProfitDistributor` thật —
 * chốt số tiền chia được ngay tại lúc chụp ảnh, chia lấy phần nguyên, cờ đã-nhận chống chia hai
 * lần. Nhờ vậy test không cần RPC mà cũng không dễ tính hơn chuỗi.
 *
 * ---------------------------------------------------------------------------------------
 *  RỦI RO CHÍNH MÀ TỆP NÀY BẢO VỆ
 *
 *  Số tiền từng ví do CHUỖI tính (`distributeBatch`), còn sổ thì do service tính lại bằng cùng
 *  công thức. Hai con số đó lệch nhau là loại lỗi tệ nhất của cả task: không lời gọi nào thất
 *  bại, không test đường thuận nào đỏ, vì mỗi con số đều đúng so với nguồn của nó.
 *
 *  Vì vậy mọi ca ở đây đối chiếu SỔ với SỐ DƯ THẬT trên chuỗi (`paymentBalanceOf`), không chỉ
 *  đối chiếu sổ với một con số gõ tay.
 * ---------------------------------------------------------------------------------------
 *
 *  VÌ SAO PHẢI BỌC `@/lib/ledger`
 *
 *  Hai việc không dựng được bằng cách nạp trạng thái: ĐẾM số lần `distributeBatch` được gọi
 *  (ca 6, đột biến 2), và làm MỘT lô thất bại giữa chừng trong khi các lô khác thành công
 *  (ca 7, đột biến 1). Vỏ bọc dưới đây mặc định chuyển tiếp nguyên vẹn sang adapter thật; chỉ
 *  khi test bật cờ thì một lô mới hỏng. Nhờ vậy các ca còn lại vẫn chạy trên adapter thật.
 */

const fault = vi.hoisted(() => ({
  /** Số lần `distributeBatch` được gọi thật — chốt của ca 6 và đột biến 2. */
  batchCalls: 0,
  /** Danh sách ví của từng lần gọi, theo thứ tự — để kiểm không ví nào bị sót. */
  batchWallets: [] as string[][],
  /**
   * Lô thứ mấy phải hỏng (đếm từ 1), `null` = không hỏng lô nào.
   * `throw`: ném lỗi khi gửi, KHÔNG có mã giao dịch.
   * `receipt-failed`: gửi được nhưng biên nhận trả FAILED.
   */
  failBatch: null as null | number,
  failMode: 'throw' as 'throw' | 'receipt-failed',
  /** Mã giao dịch của lô bị hỏng theo kiểu `receipt-failed`, để `waitReceipt` nhận ra. */
  failedTxHash: null as string | null,
  /**
   * Chạy NGAY TRƯỚC khi lô được gửi, trong khi giao dịch còn chưa đi.
   *
   * Đây là cách duy nhất quan sát được trạng thái hồ sơ ở giữa luồng. Chỉ kiểm trạng thái sau khi
   * hàm chạy xong là KHÔNG đủ: khối `catch` sửa hồ sơ về `FAILED`, nên một bản lỗi đánh dấu `PAID`
   * trước khi gửi vẫn để lại trạng thái cuối y hệt bản đúng — đã thử đột biến đó, toàn bộ test
   * xanh. Mà thiệt hại thật xảy ra đúng lúc giữa luồng: tiến trình chết ở đó thì hồ sơ đứng lại ở
   * `PAID` trong khi chưa ai nhận đồng nào.
   */
  onBatch: null as null | ((wallets: readonly string[]) => Promise<void>),
}));

vi.mock('@/lib/ledger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ledger')>();
  return {
    ...actual,
    getLedger: (...args: Parameters<typeof actual.getLedger>): ILedgerPort => {
      const real = actual.getLedger(...args);
      return {
        ...real,
        async distributeBatch(snapshotId: number, wallets: readonly string[]): Promise<TxResult> {
          fault.batchCalls += 1;
          fault.batchWallets.push([...wallets]);
          if (fault.onBatch) await fault.onBatch(wallets);

          if (fault.failBatch === fault.batchCalls) {
            if (fault.failMode === 'throw') {
              throw new actual.LedgerError(
                real.chain,
                'distributeBatch',
                'Mất kết nối RPC khi gửi lô chia lợi nhuận.',
              );
            }
            // Gửi được: có mã giao dịch thật, nhưng chuỗi sẽ trả về FAILED. KHÔNG gọi adapter
            // thật, nên không ví nào trong lô được cộng tiền — đúng như một tx bị revert.
            fault.failedTxHash = `0x${'e'.repeat(64)}`;
            return { txHash: fault.failedTxHash, status: 'PENDING' };
          }
          return real.distributeBatch(snapshotId, wallets);
        },
        async waitReceipt(txHash: string, timeoutMs?: number): Promise<TxResult> {
          if (fault.failedTxHash !== null && txHash === fault.failedTxHash) {
            return { txHash, status: 'FAILED', reason: 'Giao dịch chia lô bị revert on-chain.' };
          }
          return real.waitReceipt(txHash, timeoutMs);
        },
      };
    },
  };
});

const { resetServerEnvCache } = await import('@/lib/config/env');
const { resetMockLedger, seedMockLedger } = await import('@/lib/ledger/mock.adapter');
const { getLedger } = await import('@/lib/ledger');
const {
  getConfigStore,
  getDistributionStore,
  getOrderStore,
  getStore,
  resetMemoryStore,
  resetStoreCache,
} = await import('@/lib/store');
const { distributePeriod, getDistributionPeriod, openPeriod, previewDistribution } = await import(
  '@/lib/bank/distribution.service'
);

const CHAIN = 'mock';

/** Ví Hardhat mặc định — địa chỉ thật có checksum đúng, không phải chuỗi bịa. */
const ALICE = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const BOB = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const CAROL = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
const DUST_WALLET = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';

/**
 * Giá phát hành, đọc từ nguồn duy nhất. Ở tệp này giá chỉ dùng để dựng `vndAmount` của lệnh mua
 * đã hoàn tất — không ca nào phát biểu gì về giá, nên gõ lại con số sẽ làm chúng đỏ khi ngân hàng
 * đổi giá mặc định, đỏ vì một lý do chúng không kiểm.
 */
const PRICE = BigInt(WPT_ISSUE_PRICE_VND);

function actAs(role: string) {
  process.env.DEMO_ROLE = role;
  resetServerEnvCache();
}

/**
 * Một nhà đầu tư ĐANG NẮM WPT và có lệnh mua đã hoàn tất trong sổ.
 *
 * Hai việc, vì danh sách người nhận và số dư nằm ở hai nơi khác nhau: `collectRecipients` đọc
 * bảng lệnh mua (chuỗi không liệt kê được người nắm giữ), còn phần chia đọc `balanceOfAt` từ
 * chuỗi. Thiếu một trong hai thì ví đó vắng khỏi danh sách, hoặc có trong danh sách mà được
 * chia 0 — hai triệu chứng khác nhau của cùng một lỗi dựng bối cảnh.
 *
 * Dùng `mint` chứ KHÔNG dùng `mintInitialSupply` + `executePurchase`: phát hành nguồn cung để lại
 * một ví SPV nắm phần WPT chưa bán, và ví đó vào `totalSupplyAt` nhưng không vào danh sách người
 * nhận — mọi tỷ lệ trong ca kiểm sẽ bị pha loãng bởi một con số không ca nào nói tới.
 */
async function seedHolder(wallet: string, wpt: bigint) {
  const ledger = getLedger(CHAIN);
  await ledger.whitelist(wallet);
  await ledger.mint(wallet, wpt);
  await getOrderStore().createOrder({
    chain: CHAIN,
    investorWallet: wallet,
    wptAmount: wpt.toString(),
    vndAmount: (wpt * PRICE).toString(),
    actorRole: 'INVESTOR',
    status: 'COMPLETED',
  });
}

/** Nạp VNDB vào ví chia lợi nhuận. Phải gọi TRƯỚC `openPeriod`. */
function fundProfitPool(amount: bigint) {
  seedMockLedger({ profitPool: amount });
}

/**
 * Số ví dùng cho các ca chia theo lô, SUY RA từ kích thước lô mặc định.
 *
 * Không gõ `120`: spec viết "120 ví với lô 50" vì mặc định đang là 50, nên một con số tuyệt đối
 * sẽ mô tả sai quan hệ ngay khi ngân hàng đổi mặc định — và ca kiểm đỏ vì một lý do nó không
 * kiểm. Suy ra như dưới đây thì số lô LUÔN là 3, với mọi kích thước lô mặc định.
 */
const HOLDERS = DISTRIBUTION_BATCH_SIZE * 2 + 20;
const EXPECTED_BATCHES = 3;

/** WPT mỗi ví nắm và VNDB mỗi ví được chia — chọn để phép chia không có phần dư. */
const WPT_EACH = 1n;
const SHARE_EACH = 1_000n;

/**
 * `HOLDERS` ví hợp lệ, khác nhau, chữ thường.
 *
 * Chữ thường là dạng KHÔNG mang thông tin checksum nên `normalizeEvmAddress` chấp nhận (EIP-55).
 * Đồng thời nó dựng đúng tình huống đáng lo: sổ giữ chuỗi chữ thường còn adapter chuẩn hoá về
 * dạng checksum, nên nếu `markPayout` được gọi bằng địa chỉ đã chuẩn hoá thì không khớp dòng nào.
 */
function holderWallets(count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) => `0x${'b'.repeat(36)}${index.toString(16).padStart(4, '0')}`,
  );
}

/** Dựng `HOLDERS` ví mỗi ví nắm `WPT_EACH`, và quỹ đủ chia trọn `SHARE_EACH` cho mỗi ví. */
async function seedManyHolders(): Promise<string[]> {
  const wallets = holderWallets(HOLDERS);
  for (const wallet of wallets) await seedHolder(wallet, WPT_EACH);
  fundProfitPool(BigInt(HOLDERS) * SHARE_EACH);
  return wallets;
}

async function setBatchSize(size: number) {
  await getConfigStore().setConfig({
    key: CONFIG_KEYS.distributionBatchSize,
    value: String(size),
    type: 'number',
    changedBy: 'BANK_ADMIN',
  });
}

async function setDustWallet(wallet: string) {
  await getConfigStore().setConfig({
    key: CONFIG_KEYS.distributionDustWallet,
    value: wallet,
    type: 'string',
    changedBy: 'BANK_ADMIN',
  });
}

/** Chia và trả về khung nhìn, đỏ ngay tại đây nếu lời gọi bị từ chối. */
async function distributeOk(periodId: string) {
  const result = await distributePeriod({ chain: CHAIN, periodId });
  expect(result.ok, result.ok ? '' : result.error).toBe(true);
  if (!result.ok) throw new Error('không chia được');
  return result.data;
}

/** Số dư VNDB thật trên chuỗi của một danh sách ví. */
async function paymentBalances(wallets: readonly string[]): Promise<bigint[]> {
  const ledger = getLedger(CHAIN);
  const out: bigint[] = [];
  for (const wallet of wallets) out.push(await ledger.paymentBalanceOf(wallet));
  return out;
}

/** Hồ sơ chia của một kỳ, tra được theo ví. */
async function payoutsByWallet(periodId: string) {
  const rows = await getDistributionStore().listPayouts({ periodId, limit: 1_000 });
  return new Map(rows.map((row) => [row.investorWallet.toLowerCase(), row]));
}

/** Mở kỳ và trả về khung nhìn, đỏ ngay tại đây nếu không mở được. */
async function openPeriodOk(periodKey: string) {
  const result = await openPeriod({ chain: CHAIN, periodKey });
  expect(result.ok, result.ok ? '' : result.error).toBe(true);
  if (!result.ok) throw new Error('không mở được kỳ');
  return result.data;
}

/** Ảnh toàn bộ dữ liệu có thể bị ghi, để chứng minh một hàm đọc không ghi gì. */
async function snapshotStores() {
  return {
    periods: await getDistributionStore().listPeriods({ limit: 500 }),
    payouts: await getDistributionStore().listPayouts({ limit: 500 }),
    orders: await getOrderStore().listOrders({ limit: 500 }),
    audit: await getStore().listAudit({ limit: 500 }),
  };
}

beforeEach(() => {
  fault.batchCalls = 0;
  fault.batchWallets = [];
  fault.failBatch = null;
  fault.failMode = 'throw';
  fault.failedTxHash = null;
  fault.onBatch = null;
  resetMockLedger();
  resetMemoryStore();
  resetStoreCache();
  process.env.USE_MOCK_DB = 'true';
  actAs('BANK_ADMIN');
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.DEMO_ROLE;
  delete process.env.USE_MOCK_DB;
  resetServerEnvCache();
  resetStoreCache();
});

// ===========================================================================
//  CA 1 — chia đúng tỷ lệ
// ===========================================================================
describe('ca 1 — hai ví 70 và 30 phần trăm nhận đúng số tiền', () => {
  it('mở kỳ chốt đúng tổng tiền, tổng cung và mã ảnh chụp', async () => {
    await seedHolder(ALICE, 70n);
    await seedHolder(BOB, 30n);
    fundProfitPool(1_000_000n);

    const period = await openPeriodOk('2026-Q1');

    expect(period).toMatchObject({
      periodKey: '2026-Q1',
      chain: CHAIN,
      totalAmount: '1000000',
      totalSupplyAt: '100',
      status: 'OPEN',
      completedAt: null,
    });
    // Mã ảnh chụp bắt đầu từ 1 giống contract; 0 nghĩa là chưa chốt lần nào.
    expect(period.snapshotId).toBe(1);
  });

  it('xem trước phân bổ đúng tỷ lệ 70/30, không còn phần dư', async () => {
    await seedHolder(ALICE, 70n);
    await seedHolder(BOB, 30n);
    fundProfitPool(1_000_000n);
    const period = await openPeriodOk('2026-Q1');

    const preview = await previewDistribution({ chain: CHAIN, periodId: period.id });

    expect(preview.ok, preview.ok ? '' : preview.error).toBe(true);
    if (!preview.ok) return;

    const byWallet = new Map(preview.data.allocations.map((a) => [a.investorWallet, a]));
    expect(byWallet.get(ALICE)).toMatchObject({ balanceAt: '70', amount: '700000' });
    expect(byWallet.get(BOB)).toMatchObject({ balanceAt: '30', amount: '300000' });
    expect(preview.data.allocated).toBe('1000000');
    expect(preview.data.dust).toBe('0');
  });

  /**
   * Phép kiểm cho THỨ TỰ nhân/chia, không phải cho một tỷ lệ cụ thể.
   *
   * Nếu ai đổi `shareOf` thành `totalAmount * (balanceAt / totalSupplyAt)` thì `bigint` chia lấy
   * phần nguyên biến vế trong ngoặc thành 0 với mọi ví nắm dưới toàn bộ tổng cung, và MỌI người
   * được chia 0. Ca 1 ở trên vẫn bắt được, nhưng ca này nói rõ tính chất đang được bảo vệ: phần
   * chia phải lớn hơn 0 ngay cả khi tỷ lệ nắm giữ rất nhỏ.
   */
  it('ví nắm tỷ lệ rất nhỏ vẫn được chia lớn hơn 0', async () => {
    await seedHolder(ALICE, 1n);
    await seedHolder(BOB, 9_999n);
    fundProfitPool(1_000_000n);
    const period = await openPeriodOk('2026-Q1');

    const preview = await previewDistribution({ chain: CHAIN, periodId: period.id });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;

    const alice = preview.data.allocations.find((a) => a.investorWallet === ALICE);
    expect(BigInt(alice?.amount ?? '0')).toBe(100n);
  });
});

// ===========================================================================
//  CA 2 — ví mua sau thời điểm chốt được chia 0
// ===========================================================================
describe('ca 2 — ví mua WPT sau thời điểm chốt được chia 0', () => {
  it('ví xuất hiện sau ảnh chụp có mặt trong danh sách nhưng phần chia bằng 0', async () => {
    await seedHolder(ALICE, 100n);
    fundProfitPool(500_000n);
    const period = await openPeriodOk('2026-Q1');

    // Mua SAU khi đã chốt quyền: tổng cung trên chuỗi tăng, nhưng ảnh chụp không đổi.
    await seedHolder(BOB, 400n);

    const preview = await previewDistribution({ chain: CHAIN, periodId: period.id });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;

    const byWallet = new Map(preview.data.allocations.map((a) => [a.investorWallet, a]));
    /**
     * BOB phải CÓ MẶT với `amount: '0'`, không phải vắng mặt.
     *
     * Vắng mặt và được chia 0 là hai thông tin khác nhau: vắng mặt nghĩa là chưa ai xét tới ví
     * đó, còn `'0'` là kết luận đã xét và không được chia. Người đối soát cần phân biệt được hai
     * điều này, nên danh sách phải giữ cả ví không được chia.
     */
    expect(byWallet.get(BOB)).toMatchObject({ balanceAt: '0', amount: '0' });
    // Và toàn bộ tiền vẫn thuộc về ví đã nắm giữ TẠI thời điểm chốt.
    expect(byWallet.get(ALICE)).toMatchObject({ balanceAt: '100', amount: '500000' });
    expect(preview.data.allocated).toBe('500000');
  });

  it('tổng cung của kỳ là tổng cung TẠI ảnh chụp, không phải tổng cung hiện tại', async () => {
    await seedHolder(ALICE, 100n);
    fundProfitPool(500_000n);
    const period = await openPeriodOk('2026-Q1');

    await seedHolder(BOB, 400n);

    expect(period.totalSupplyAt).toBe('100');
    // Chuỗi đã có 500 WPT, nhưng kỳ vẫn chia theo 100.
    expect(await getLedger(CHAIN).tokenInfo()).toMatchObject({ totalSupply: 500n });
  });
});

// ===========================================================================
//  XEM TRƯỚC KHÔNG GHI GÌ VÀO CƠ SỞ DỮ LIỆU
// ===========================================================================
describe('xem trước là hàm đọc', () => {
  /**
   * Kiểm cả SỔ KIỂM TOÁN, không chỉ bảng kỳ và bảng hồ sơ chia.
   *
   * Đây là lý do `previewDistribution` dùng `assertCan` thay vì `authorize`: `authorize` ghi một
   * bản ghi kiểm toán mỗi lần gọi, tức là hàm xem trước sẽ ghi vào cơ sở dữ liệu. Không có ca này
   * thì việc đổi sang `authorize` vẫn xanh, và điều kiện hoàn thành số 2 mất chốt chặn.
   */
  it('không thêm dòng nào vào bất kỳ bảng nào, kể cả sổ kiểm toán', async () => {
    await seedHolder(ALICE, 70n);
    await seedHolder(BOB, 30n);
    fundProfitPool(1_000_000n);
    const period = await openPeriodOk('2026-Q1');

    const before = await snapshotStores();
    const preview = await previewDistribution({ chain: CHAIN, periodId: period.id });
    expect(preview.ok).toBe(true);
    const after = await snapshotStores();

    expect(after).toEqual(before);
  });

  it('kỳ không tồn tại thì trả lỗi trạng thái kỳ, không ném ra ngoài', async () => {
    const preview = await previewDistribution({
      chain: CHAIN,
      periodId: '00000000-0000-4000-8000-000000000000',
    });

    expect(preview.ok).toBe(false);
    if (preview.ok) return;
    expect(preview.code).toBe('PERIOD_STATE');
  });

  it('mã kỳ sai dạng bị chặn ở validate', async () => {
    const preview = await previewDistribution({ chain: CHAIN, periodId: 'khong-phai-uuid' });

    expect(preview.ok).toBe(false);
    if (preview.ok) return;
    expect(preview.code).toBe('VALIDATION');
  });
});

// ===========================================================================
//  CA 4 — ví chia lợi nhuận không đủ tiền
// ===========================================================================
describe('ca 4 — ví chia lợi nhuận không có tiền thì không mở được kỳ', () => {
  it('từ chối với mã INSUFFICIENT_PROFIT_POOL và không tốn ảnh chụp nào', async () => {
    await seedHolder(ALICE, 100n);
    // KHÔNG nạp quỹ.

    const result = await openPeriod({ chain: CHAIN, periodKey: '2026-Q1' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('INSUFFICIENT_PROFIT_POOL');

    // Không kỳ nào được tạo.
    expect(await getDistributionStore().listPeriods({ limit: 10 })).toEqual([]);

    /**
     * Và KHÔNG ảnh chụp nào bị tốn.
     *
     * Đây là chốt chặn cho thứ tự các bước: phép kiểm quỹ phải chạy TRƯỚC `takeSnapshot`. Đổi thứ
     * tự thì ca kiểm trên vẫn xanh (vẫn từ chối, vẫn không tạo kỳ) — chỉ phép kiểm này đỏ, vì mỗi
     * lần từ chối lại tiêu một mã ảnh chụp trên chuỗi.
     */
    await expect(getLedger(CHAIN).balanceOfAt(ALICE, 1)).rejects.toThrow(/không tồn tại/i);
  });

  it('lần bị từ chối được ghi vào sổ kiểm toán', async () => {
    await seedHolder(ALICE, 100n);

    await openPeriod({ chain: CHAIN, periodKey: '2026-Q1' });

    const audit = await getStore().listAudit({ limit: 10 });
    const failure = audit.find(
      (entry) => entry.action === 'distribution:snapshot' && entry.outcome === 'FAILURE',
    );
    expect(failure, 'phải có bản ghi FAILURE để kênh (audit) thấy được').toBeDefined();
    expect(failure?.detail).toMatch(/không có VNDB/i);
  });

  it('tổng cung bằng 0 thì từ chối với mã NO_CIRCULATING_SUPPLY', async () => {
    // Có tiền trong quỹ nhưng chưa ai nắm WPT.
    fundProfitPool(1_000_000n);

    const result = await openPeriod({ chain: CHAIN, periodKey: '2026-Q1' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NO_CIRCULATING_SUPPLY');
    expect(await getDistributionStore().listPeriods({ limit: 10 })).toEqual([]);
  });
});

// ===========================================================================
//  CA 5 — mã kỳ trùng
// ===========================================================================
describe('ca 5 — mã kỳ trùng thì từ chối', () => {
  it('lần mở thứ hai bị từ chối, chỉ còn một kỳ và không tốn ảnh chụp thứ hai', async () => {
    await seedHolder(ALICE, 100n);
    fundProfitPool(1_000_000n);
    await openPeriodOk('2026-Q1');

    const second = await openPeriod({ chain: CHAIN, periodKey: '2026-Q1' });

    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.code).toBe('PERIOD_STATE');
    expect(await getDistributionStore().listPeriods({ limit: 10 })).toHaveLength(1);
    // Phép kiểm mã kỳ chạy trước `takeSnapshot`, nên ảnh chụp thứ hai không tồn tại.
    await expect(getLedger(CHAIN).balanceOfAt(ALICE, 2)).rejects.toThrow(/không tồn tại/i);
  });

  /**
   * Chốt chặn THẬT là ràng buộc duy nhất ở cơ sở dữ liệu, không phải lần đọc trước khi ghi.
   *
   * Hai tiến trình song song đều đọc thấy "chưa có kỳ này" rồi cùng ghi — lần đọc không chặn
   * được tình huống đó. Ca này dựng đúng nó bằng cách bắt lần đọc trả `null` trong khi kỳ đã
   * tồn tại thật, rồi khẳng định lời gọi vẫn bị từ chối.
   *
   * Không có ca này thì gỡ ràng buộc duy nhất khỏi lược đồ vẫn xanh toàn bộ.
   */
  it('lần đọc trước khi ghi bị vô hiệu thì ràng buộc duy nhất vẫn chặn', async () => {
    await seedHolder(ALICE, 100n);
    fundProfitPool(1_000_000n);
    await openPeriodOk('2026-Q1');

    vi.spyOn(getDistributionStore(), 'findPeriodByKey').mockResolvedValue(null);

    const second = await openPeriod({ chain: CHAIN, periodKey: '2026-Q1' });

    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.code).toBe('PERIOD_STATE');
    expect(second.error).toMatch(/tiến trình khác/i);

    vi.restoreAllMocks();
    expect(await getDistributionStore().listPeriods({ limit: 10 })).toHaveLength(1);
  });

  it('mã kỳ khác thì mở được kỳ thứ hai với ảnh chụp mới', async () => {
    await seedHolder(ALICE, 100n);
    fundProfitPool(1_000_000n);
    const first = await openPeriodOk('2026-Q1');

    fundProfitPool(2_000_000n);
    const second = await openPeriodOk('2026-Q2');

    expect(second.snapshotId).toBe(first.snapshotId + 1);
    expect(second.totalAmount).toBe('2000000');
  });
});

// ===========================================================================
//  ĐỌC TRẠNG THÁI KỲ
// ===========================================================================
describe('đọc trạng thái kỳ', () => {
  it('tra được theo mã kỳ, không chỉ theo mã trong cơ sở dữ liệu', async () => {
    await seedHolder(ALICE, 100n);
    fundProfitPool(1_000_000n);
    const period = await openPeriodOk('2026-Q1');

    const byKey = await getDistributionPeriod({ chain: CHAIN, periodKey: '2026-Q1' });

    expect(byKey.ok, byKey.ok ? '' : byKey.error).toBe(true);
    if (!byKey.ok) return;
    expect(byKey.data.period.id).toBe(period.id);
    expect(byKey.data.outstanding).toBe(0);
    expect(byKey.data.paidAmount).toBe('0');
  });

  it('truyền cả hai mã, hoặc không truyền mã nào, đều bị chặn ở validate', async () => {
    const both = await getDistributionPeriod({
      chain: CHAIN,
      periodId: '00000000-0000-4000-8000-000000000000',
      periodKey: '2026-Q1',
    });
    const neither = await getDistributionPeriod({ chain: CHAIN });

    for (const result of [both, neither]) {
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.code).toBe('VALIDATION');
    }
  });

  /**
   * Kỳ thuộc chuỗi khác phải bị từ chối, không được trả về.
   *
   * Ảnh chụp số dư thuộc về MỘT chuỗi, nên đọc `balanceOfAt` của chuỗi khác là tra một sổ khác
   * hoàn toàn — và con số trả về trông hoàn toàn hợp lệ nên không gì báo lỗi.
   */
  it('kỳ của chuỗi khác bị từ chối', async () => {
    await seedHolder(ALICE, 100n);
    fundProfitPool(1_000_000n);
    const period = await openPeriodOk('2026-Q1');

    const other = await getDistributionPeriod({ chain: 'hardhat-local', periodId: period.id });

    expect(other.ok).toBe(false);
    if (other.ok) return;
    expect(other.code).toBe('PERIOD_STATE');
    expect(other.error).toMatch(/thuộc chain/i);
  });

  it.each([['INVESTOR'], ['AUDITOR'], ['COMPLIANCE']])(
    'vai %s đọc được trạng thái kỳ hay không, theo đúng bảng RBAC',
    async (role) => {
      const { can } = await import('@/lib/rbac');
      await seedHolder(ALICE, 100n);
      fundProfitPool(1_000_000n);
      const period = await openPeriodOk('2026-Q1');

      actAs(role);
      const result = await getDistributionPeriod({ chain: CHAIN, periodId: period.id });

      // Bảng quyền quyết định, không phải tên vai: `reconcile:read` là dữ liệu toàn hệ nên ba
      // vai ngân hàng có, nhà đầu tư không.
      expect(result.ok).toBe(can(role as never, 'reconcile:read'));
    },
  );
});

// ===========================================================================
//  CA 3 — tổng đã chia bằng tổng tiền của kỳ, phần dư về ví chỉ định
// ===========================================================================
describe('ca 3 — tổng đã chia cộng phần dư bằng đúng tổng tiền của kỳ', () => {
  /**
   * Ba ví chia đều 100 VNDB: mỗi ví `floor(100 × 1 / 3) = 33`, tổng 99, phần dư 1.
   *
   * Chọn con số chia KHÔNG hết là chủ đích — đây là ca duy nhất chứng minh phần dư được ghi nhận
   * thay vì biến mất. Với một tỷ lệ chia hết thì phần dư luôn bằng 0 và khẳng định nào về nó cũng
   * đúng, kể cả khẳng định sai.
   */
  const HOLDERS_3 = [ALICE, BOB, CAROL];
  const POOL = 100n;
  const SHARE = 33n;
  const DUST = 1n;

  async function openThreeWayPeriod() {
    for (const wallet of HOLDERS_3) await seedHolder(wallet, 1n);
    fundProfitPool(POOL);
    return openPeriodOk('2026-Q1');
  }

  it('tổng hồ sơ cộng phần dư bằng tổng tiền, và phần dư ghi nhận cho ví chỉ định', async () => {
    await setDustWallet(DUST_WALLET);
    const period = await openThreeWayPeriod();

    const run = await distributeOk(period.id);

    expect(run.dustWallet).toBe(DUST_WALLET);
    expect(run.dust).toBe(DUST.toString());
    expect(run.paidAmount).toBe((SHARE * 3n).toString());
    // Bất biến chính: không đồng nào bốc hơi và không đồng nào sinh ra thêm.
    expect(BigInt(run.paidAmount) + BigInt(run.dust)).toBe(POOL);
  });

  it('số trong sổ khớp SỐ DƯ THẬT trên chuỗi, và phần dư nằm lại trong ví lợi nhuận', async () => {
    await setDustWallet(DUST_WALLET);
    const period = await openThreeWayPeriod();

    await distributeOk(period.id);

    // Sổ nói mỗi ví 33 thì chuỗi cũng phải chuyển đúng 33 — đây là phép kiểm quan trọng nhất
    // của cả tệp, vì lệch ở đây không lời gọi nào báo lỗi.
    expect(await paymentBalances(HOLDERS_3)).toEqual([SHARE, SHARE, SHARE]);

    const rows = await payoutsByWallet(period.id);
    for (const wallet of HOLDERS_3) {
      expect(rows.get(wallet.toLowerCase())).toMatchObject({ amount: SHARE.toString(), status: 'PAID' });
    }

    /**
     * Phần dư CÒN TRONG VÍ LỢI NHUẬN, chưa chuyển cho ví chỉ định.
     *
     * Đây là giới hạn đã biết, không phải lỗi: `distributeBatch` tự tính phần từng ví nên tầng
     * nghiệp vụ không có đường bảo nó trả thêm cho một ví, và hàm quét phần dư (`sweepDust` của
     * contract) chưa có trong `ILedgerPort`. Ca này khoá lại hành vi hiện tại để lần nối
     * `sweepDust` phải sửa cả test — chứ không để phần dư âm thầm đổi đích.
     */
    expect(await getLedger(CHAIN).profitPoolBalance()).toBe(DUST);
  });

  it('chưa cấu hình ví nhận phần dư thì phần dư giữ lại trong ví lợi nhuận', async () => {
    const period = await openThreeWayPeriod();

    const run = await distributeOk(period.id);

    expect(run.dustWallet).toBeNull();
    expect(run.dust).toBe(DUST.toString());
    expect(await getLedger(CHAIN).profitPoolBalance()).toBe(DUST);
  });

  it('xem trước và lúc chia cho ra cùng một con số', async () => {
    const period = await openThreeWayPeriod();

    const preview = await previewDistribution({ chain: CHAIN, periodId: period.id });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    const run = await distributeOk(period.id);

    /**
     * Xem trước và lúc chia phải đi qua CÙNG một hàm tính. Hai đường tính rời nhau sẽ lệch ở lần
     * sửa đầu tiên, và lúc đó màn hình hiện một số còn hồ sơ ghi số khác — đúng thứ mà màn hình
     * xem trước tồn tại để tránh.
     */
    expect(run.paidAmount).toBe(preview.data.allocated);
    expect(run.dust).toBe(preview.data.dust);
  });
});

// ===========================================================================
//  CA 6 — chia theo lô
// ===========================================================================
describe(`ca 6 — ${HOLDERS} ví với lô ${DISTRIBUTION_BATCH_SIZE} thì gửi ${EXPECTED_BATCHES} lô`, () => {
  it('gọi distributeBatch đúng số lần, không ví nào bị sót và không ví nào lặp', async () => {
    const wallets = await seedManyHolders();
    const period = await openPeriodOk('2026-Q1');

    const run = await distributeOk(period.id);

    expect(run.batchSize).toBe(DISTRIBUTION_BATCH_SIZE);
    expect(run.batches).toBe(EXPECTED_BATCHES);
    expect(fault.batchCalls).toBe(EXPECTED_BATCHES);

    // Không lô nào vượt kích thước cấu hình.
    for (const group of fault.batchWallets) {
      expect(group.length).toBeLessThanOrEqual(DISTRIBUTION_BATCH_SIZE);
    }

    /**
     * Hợp các lô phải bằng ĐÚNG danh sách người nhận — không thiếu, không lặp.
     *
     * Kiểm cả hai chiều và kiểm cả số lượng trước khi so tập hợp: một ví bị gửi hai lần vẫn cho
     * ra tập hợp đúng, nên chỉ so tập hợp thì lỗi lặp lô đi qua được.
     */
    const sent = fault.batchWallets.flat();
    expect(sent).toHaveLength(HOLDERS);
    expect(new Set(sent.map((w) => w.toLowerCase()))).toEqual(
      new Set(wallets.map((w) => w.toLowerCase())),
    );
  });

  it('mọi ví nhận đúng phần của mình và kỳ chuyển sang COMPLETED', async () => {
    const wallets = await seedManyHolders();
    const period = await openPeriodOk('2026-Q1');

    const run = await distributeOk(period.id);

    expect(run.paid).toBe(HOLDERS);
    expect(run.failed).toBe(0);
    expect(run.outstanding).toBe(0);
    expect(run.period.status).toBe('COMPLETED');
    expect(run.period.completedAt).not.toBeNull();

    const balances = await paymentBalances(wallets);
    expect(balances).toEqual(wallets.map(() => SHARE_EACH));
    expect(run.dust).toBe('0');
  });

  /**
   * Hồ sơ chờ phải có ĐỦ trước khi gửi lô đầu tiên (việc 5).
   *
   * Hồ sơ là thứ duy nhất ghi lại "ai được chia bao nhiêu" — chuỗi không liệt kê được người nắm
   * giữ. Gửi trước rồi ghi sau, mà tiến trình chết giữa hai việc, thì tiền đã ra khỏi ví lợi
   * nhuận mà không dòng nào nói nó đi đâu. Ca này đỏ ngay khi ai đó chuyển việc lập hồ sơ vào
   * trong vòng lặp gửi lô.
   */
  it('lập đủ hồ sơ chờ TRƯỚC khi gửi lô đầu tiên', async () => {
    await seedManyHolders();
    const period = await openPeriodOk('2026-Q1');

    const store = getDistributionStore();
    const original = store.createPayouts.bind(store);
    const batchCallsAtWrite: number[] = [];
    vi.spyOn(store, 'createPayouts').mockImplementation(async (arg) => {
      batchCallsAtWrite.push(fault.batchCalls);
      return original(arg);
    });

    await distributeOk(period.id);

    expect(batchCallsAtWrite.length).toBeGreaterThan(0);
    // Mọi lần ghi hồ sơ đều xảy ra khi CHƯA lô nào được gửi.
    for (const calls of batchCallsAtWrite) expect(calls).toBe(0);
  });

  it('gọi lại khi đã hoàn tất thì bị từ chối, không gửi thêm lô nào', async () => {
    await seedManyHolders();
    const period = await openPeriodOk('2026-Q1');
    await distributeOk(period.id);
    const callsAfterFirstRun = fault.batchCalls;

    const again = await distributePeriod({ chain: CHAIN, periodId: period.id });

    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.code).toBe('PERIOD_STATE');
    expect(fault.batchCalls).toBe(callsAfterFirstRun);
  });
});

// ===========================================================================
//  CA 7 — chạy lại sau khi một lô lỗi
// ===========================================================================
describe('ca 7 — chạy lại chỉ chia cho ví chưa nhận', () => {
  it('lô giữa thất bại thì hai lô kia vẫn chi, kỳ ở lại DISTRIBUTING', async () => {
    const wallets = await seedManyHolders();
    const period = await openPeriodOk('2026-Q1');

    // Lô thứ hai gửi được nhưng biên nhận trả FAILED.
    fault.failBatch = 2;
    fault.failMode = 'receipt-failed';

    const run = await distributeOk(period.id);

    expect(run.batches).toBe(EXPECTED_BATCHES);
    expect(run.failed).toBe(DISTRIBUTION_BATCH_SIZE);
    expect(run.paid).toBe(HOLDERS - DISTRIBUTION_BATCH_SIZE);
    expect(run.outstanding).toBe(DISTRIBUTION_BATCH_SIZE);
    // Chưa hoàn tất: còn hồ sơ phải chi.
    expect(run.period.status).toBe('DISTRIBUTING');
    expect(run.period.completedAt).toBeNull();

    /**
     * Ví của lô nào lấy từ CHÍNH LÔ ĐÃ GỬI, không suy từ thứ tự tạo ví.
     *
     * `collectRecipients` đọc `listOrders`, hàm này trả về mới nhất trước và phá thế bằng `id`
     * (uuid ngẫu nhiên) khi hai lệnh trùng mốc phần nghìn giây — nên thứ tự danh sách người nhận
     * KHÔNG suy được từ thứ tự gọi `seedHolder`, và một ca dựa vào đó sẽ đỏ tuỳ lần chạy.
     */
    const failedWallets = fault.batchWallets[1];
    const paidWallets = [...fault.batchWallets[0], ...fault.batchWallets[2]];
    expect(failedWallets).toHaveLength(DISTRIBUTION_BATCH_SIZE);
    expect(await paymentBalances(failedWallets)).toEqual(failedWallets.map(() => 0n));
    expect(await paymentBalances(paidWallets)).toEqual(paidWallets.map(() => SHARE_EACH));
    // Và hợp ba lô vẫn là đúng danh sách người nhận.
    expect(new Set([...failedWallets, ...paidWallets].map((w) => w.toLowerCase()))).toEqual(
      new Set(wallets.map((w) => w.toLowerCase())),
    );
  });

  it('lần chạy thứ hai chỉ gửi ví chưa nhận, và không ai nhận hai lần', async () => {
    const wallets = await seedManyHolders();
    const period = await openPeriodOk('2026-Q1');

    fault.failBatch = 2;
    fault.failMode = 'receipt-failed';
    await distributeOk(period.id);

    // Sự cố đã qua: lần này không lô nào hỏng.
    fault.failBatch = null;
    fault.failedTxHash = null;
    const callsBefore = fault.batchCalls;
    fault.batchWallets = [];

    const rerun = await distributeOk(period.id);

    // Chỉ những ví chưa nhận được gửi lại — đúng MỘT lô, không chia lại cả kỳ.
    expect(fault.batchCalls - callsBefore).toBe(1);
    expect(fault.batchWallets.flat()).toHaveLength(DISTRIBUTION_BATCH_SIZE);
    expect(rerun.paid).toBe(DISTRIBUTION_BATCH_SIZE);
    expect(rerun.outstanding).toBe(0);
    expect(rerun.period.status).toBe('COMPLETED');

    /**
     * KHÔNG AI NHẬN HAI LẦN — bất biến quan trọng nhất của việc chạy lại.
     *
     * Kiểm trên MỌI ví, không chỉ ví của lô lỗi: nếu lần chạy lại gửi cả kỳ thì ví của lô đầu sẽ
     * xuất hiện trong lô gửi lại, và chỉ phép kiểm này bắt được (cờ đã-nhận của contract giữ cho
     * số dư không đổi, nhưng sổ thì đã sai).
     */
    expect(await paymentBalances(wallets)).toEqual(wallets.map(() => SHARE_EACH));
    const rows = await payoutsByWallet(period.id);
    expect([...rows.values()].every((row) => row.status === 'PAID')).toBe(true);
    expect(rows.size).toBe(HOLDERS);
  });
});

// ===========================================================================
//  CA 8 — quyền
// ===========================================================================
describe('ca 8 — vai không có distribution:execute bị chặn', () => {
  it.each([['COMPLIANCE'], ['INVESTOR'], ['AUDITOR']])(
    'vai %s bị từ chối, có bản ghi kiểm toán DENIED, không hồ sơ nào được lập',
    async (role) => {
      await seedHolder(ALICE, 100n);
      fundProfitPool(1_000_000n);
      const period = await openPeriodOk('2026-Q1');

      actAs(role);
      const result = await distributePeriod({ chain: CHAIN, periodId: period.id });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe('FORBIDDEN');

      const audit = await getStore().listAudit({ limit: 20 });
      const denied = audit.find(
        (entry) => entry.action === 'distribution:execute' && entry.outcome === 'DENIED',
      );
      expect(denied, 'phải có bản ghi DENIED để kênh (audit) thấy được').toBeDefined();
      expect(denied?.actorRole).toBe(role);

      // Và KHÔNG đổi gì: không hồ sơ nào, không lô nào, không đồng nào.
      expect(await getDistributionStore().listPayouts({ periodId: period.id })).toEqual([]);
      expect(fault.batchCalls).toBe(0);
      expect(await paymentBalances([ALICE])).toEqual([0n]);
    },
  );

  it.each([['COMPLIANCE'], ['INVESTOR'], ['AUDITOR']])(
    'vai %s không mở được kỳ, và không tốn ảnh chụp nào',
    async (role) => {
      await seedHolder(ALICE, 100n);
      fundProfitPool(1_000_000n);

      actAs(role);
      const result = await openPeriod({ chain: CHAIN, periodKey: '2026-Q1' });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe('FORBIDDEN');
      await expect(getLedger(CHAIN).balanceOfAt(ALICE, 1)).rejects.toThrow(/không tồn tại/i);
    },
  );

  it('vai không có quyền cũng không xem trước được', async () => {
    await seedHolder(ALICE, 100n);
    fundProfitPool(1_000_000n);
    const period = await openPeriodOk('2026-Q1');

    actAs('AUDITOR');
    const preview = await previewDistribution({ chain: CHAIN, periodId: period.id });

    expect(preview.ok).toBe(false);
    if (preview.ok) return;
    expect(preview.code).toBe('FORBIDDEN');
  });
});

// ===========================================================================
//  ĐỘT BIẾN 1 — lô ném lỗi giữa chừng không được đánh dấu đã nhận
// ===========================================================================
describe('đột biến 1 — lô ném lỗi thì không ví nào trong lô bị đánh dấu đã nhận', () => {
  /**
   * ĐỘT BIẾN được nhắm: chuyển `markBatch(..., 'PAID')` lên TRƯỚC `distributeBatch`, hoặc đánh
   * dấu `PAID` bất kể biên nhận.
   *
   * Mọi ca đường thuận vẫn xanh với đột biến đó — hồ sơ vẫn thành `PAID` và tiền vẫn tới ví khi
   * không có lỗi. Chỉ ca này đỏ, và nó đỏ ở đúng chỗ thiệt hại thật: hồ sơ nói đã chi trong khi
   * ví nhà đầu tư không nhận gì, nên không lần chạy lại nào xét tới họ nữa — tiền của họ ở lại
   * trong ví lợi nhuận vĩnh viễn mà sổ nói đã trả xong.
   */
  /**
   * CHỐT CHẶN THẬT của đột biến này: trạng thái hồ sơ NGAY TRƯỚC KHI lô được gửi.
   *
   * Kiểm trạng thái sau khi hàm chạy xong không đủ — đã đo: dựng đột biến "đánh dấu `PAID` trước
   * khi gửi" thì cả 42 ca vẫn xanh, vì khối `catch` sửa hồ sơ về `FAILED` và trạng thái cuối giống
   * hệt bản đúng. Chỗ thiệt hại nằm ở GIỮA luồng: tiến trình chết ngay đó thì hồ sơ đứng lại ở
   * `PAID` trong khi ví nhà đầu tư chưa nhận gì, và không lần chạy lại nào xét tới họ nữa.
   */
  it('chưa hồ sơ nào ở PAID tại thời điểm lô đang được gửi', async () => {
    await seedManyHolders();
    const period = await openPeriodOk('2026-Q1');

    const statusesAtSend: string[] = [];
    fault.onBatch = async (wallets) => {
      const rows = await payoutsByWallet(period.id);
      for (const wallet of wallets) {
        statusesAtSend.push(rows.get(wallet.toLowerCase())?.status ?? 'KHÔNG CÓ HỒ SƠ');
      }
    };

    await distributeOk(period.id);

    expect(statusesAtSend).toHaveLength(HOLDERS);
    // Hồ sơ phải TỒN TẠI (việc 5) nhưng chưa được đánh dấu đã nhận.
    expect(new Set(statusesAtSend)).toEqual(new Set(['PENDING']));
  });

  it('hồ sơ của lô lỗi ở FAILED, không phải PAID, và chưa nhận đồng nào', async () => {
    await seedManyHolders();
    const period = await openPeriodOk('2026-Q1');

    // Ném lỗi khi GỬI: không có mã giao dịch nào, nên không thể suy ra là đã chi.
    fault.failBatch = 2;
    fault.failMode = 'throw';

    const run = await distributeOk(period.id);

    // Lấy từ chính lô đã gửi — thứ tự danh sách người nhận không suy được từ thứ tự tạo ví.
    const failedWallets = fault.batchWallets[1];
    const rows = await payoutsByWallet(period.id);

    for (const wallet of failedWallets) {
      const row = rows.get(wallet.toLowerCase());
      expect(row?.status).toBe('FAILED');
      expect(row?.status).not.toBe('PAID');
    }
    expect(await paymentBalances(failedWallets)).toEqual(failedWallets.map(() => 0n));
    expect(run.failed).toBe(DISTRIBUTION_BATCH_SIZE);
    expect(run.outstanding).toBe(DISTRIBUTION_BATCH_SIZE);
  });

  it('chạy lại chia ĐÚNG phần cho những ví đó, mỗi ví một lần', async () => {
    const wallets = await seedManyHolders();
    const period = await openPeriodOk('2026-Q1');

    fault.failBatch = 2;
    fault.failMode = 'throw';
    await distributeOk(period.id);

    fault.failBatch = null;
    const rerun = await distributeOk(period.id);

    expect(rerun.outstanding).toBe(0);
    expect(rerun.period.status).toBe('COMPLETED');
    // Đúng phần, đúng một lần, cho mọi ví.
    expect(await paymentBalances(wallets)).toEqual(wallets.map(() => SHARE_EACH));
    expect(rerun.paidAmount).toBe((BigInt(HOLDERS) * SHARE_EACH).toString());
  });
});

// ===========================================================================
//  ĐỘT BIẾN 2 — kích thước lô đọc từ tham số hệ thống
// ===========================================================================
describe('đột biến 2 — đổi distribution.batch_size thì số lô đổi, kết quả chia không đổi', () => {
  const ALT_BATCH_SIZE = Math.max(1, DISTRIBUTION_BATCH_SIZE - 20);
  const ALT_BATCHES = Math.ceil(HOLDERS / ALT_BATCH_SIZE);

  /**
   * ĐỘT BIẾN được nhắm: viết cứng kích thước lô trong service.
   *
   * Với một hằng số trong mã, ca "lô mặc định" ở ca 6 vẫn xanh — nó chỉ tình cờ trùng con số. Chỉ
   * ca này đỏ, vì nó đổi tham số trong cơ sở dữ liệu rồi đòi số lần gọi đổi theo.
   *
   * Điều kiện để ca có nghĩa: hai kích thước phải cho ra hai số lô KHÁC nhau. Khẳng định ngay ở
   * đây thay vì tin vào số học — đổi mặc định thành 20 thì hai số bằng nhau và ca này thành một
   * phép kiểm không kiểm gì.
   */
  it('hai kích thước lô cho ra hai số lô khác nhau', () => {
    expect(ALT_BATCHES).not.toBe(EXPECTED_BATCHES);
  });

  it(`lô ${ALT_BATCH_SIZE} thì gửi ${ALT_BATCHES} lô, mỗi ví vẫn nhận đúng phần của mình`, async () => {
    const wallets = await seedManyHolders();
    await setBatchSize(ALT_BATCH_SIZE);
    const period = await openPeriodOk('2026-Q1');

    const run = await distributeOk(period.id);

    expect(run.batchSize).toBe(ALT_BATCH_SIZE);
    expect(run.batches).toBe(ALT_BATCHES);
    expect(fault.batchCalls).toBe(ALT_BATCHES);
    for (const group of fault.batchWallets) {
      expect(group.length).toBeLessThanOrEqual(ALT_BATCH_SIZE);
    }

    // Kết quả chia KHÔNG đổi: đúng danh sách, đúng số tiền, kỳ hoàn tất.
    expect(fault.batchWallets.flat()).toHaveLength(HOLDERS);
    expect(await paymentBalances(wallets)).toEqual(wallets.map(() => SHARE_EACH));
    expect(run.outstanding).toBe(0);
    expect(run.period.status).toBe('COMPLETED');
  });

  it('giá trị cấu hình vô lý bị bỏ qua, lùi về mặc định thay vì không gửi lô nào', async () => {
    await seedManyHolders();
    // `0` là giá trị nguy hiểm nhất: vòng chia lô không sinh ra lô nào, nên hàm chạy xong, báo
    // thành công, và KHÔNG ai được chia đồng nào.
    await setBatchSize(0);
    const period = await openPeriodOk('2026-Q1');

    const run = await distributeOk(period.id);

    expect(run.batchSize).toBe(DISTRIBUTION_BATCH_SIZE);
    expect(run.batches).toBe(EXPECTED_BATCHES);
    expect(run.outstanding).toBe(0);
  });
});
