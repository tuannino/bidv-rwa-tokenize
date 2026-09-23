import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WPT_ISSUE_PRICE_VND } from '@/lib/config/issue-terms';
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
const { getDistributionStore, getOrderStore, getStore, resetMemoryStore, resetStoreCache } =
  await import('@/lib/store');
const { getDistributionPeriod, openPeriod, previewDistribution } = await import(
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
