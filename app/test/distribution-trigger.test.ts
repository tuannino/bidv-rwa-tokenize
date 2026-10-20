import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONFIG_KEYS,
  DISTRIBUTION_MIN_NEW_BALANCE,
  DISTRIBUTION_STUCK_AFTER_RUNS,
  WPT_ISSUE_PRICE_VND,
} from '@/lib/config/issue-terms';
import type { ILedgerPort, TxResult } from '@/lib/ledger/ledger.port';

/**
 * BE-07 — TIẾN TRÌNH TỰ ĐỘNG CHIA LỢI NHUẬN. Chín ca kiểm thử và hai đột biến ở
 * `requirements.md`.
 *
 * FE-08 QĐ-E (CH-3) đổi vai của tiến trình: keeper KHÔNG BAO GIỜ mở kỳ. Tiền mới thì báo
 * `AWAITING_APPROVAL`; Kiểm soát viên duyệt (`approveDistribution`) mới mở kỳ và chạy lượt chia đầu;
 * keeper chỉ chia tiếp kỳ đã `APPROVED`. Các ca dưới giữ nguyên tính chất BE-07 đang bảo vệ (không
 * chia trùng, mốc số dư, lô lỗi) nhưng kỳ được mở bằng lần duyệt thay vì bởi keeper.
 *
 * Chạy trên chain `mock`: adapter mock mô phỏng đúng ràng buộc của `ProfitDistributor` thật,
 * KỂ CẢ việc chia lợi nhuận làm GIẢM số dư ví lợi nhuận (`s.profitPool -= total`). Chi tiết đó
 * là trung tâm của cả tệp này — nó là lý do mốc số dư phải là "số dư dự kiến còn lại" chứ không
 * phải tổng tiền đã nhận luỹ tiến.
 *
 * ---------------------------------------------------------------------------------------
 *  BA RỦI RO MÀ TỆP NÀY BẢO VỆ
 *
 *  1. **Chia trùng.** Hai vòng chạy đồng thời cùng gửi một lô là trả tiền hai lần. Chốt chặn
 *     là ràng buộc duy nhất `(jobName, periodKey)` của `KeeperRun`, nên phép kiểm phải dựng
 *     được tình huống hai vòng ĐỒNG THỜI thật, không phải hai lời gọi nối tiếp.
 *
 *  2. **Mốc số dư đi trước thực tế.** Cập nhật mốc khi kỳ còn dở làm phần tiền chưa chia bị
 *     coi là đã xử lý, và nó nằm lại trong ví vĩnh viễn — không lỗi nào, không ai biết. Vì vậy
 *     mọi ca chia dở đều kiểm mốc KHÔNG đổi, không chỉ kiểm `outcome`.
 *
 *  3. **Đánh dấu nhầm khi lô lỗi.** Ví trong lô lỗi mà bị coi là đã nhận thì lượt sau bỏ qua
 *     họ. Vì vậy đột biến 2 đối chiếu SỐ DƯ THẬT trên chuỗi, không chỉ đối chiếu trạng thái
 *     hồ sơ.
 * ---------------------------------------------------------------------------------------
 *
 *  VÌ SAO PHẢI BỌC `@/lib/ledger`
 *
 *  Hai việc không dựng được bằng cách nạp trạng thái: làm MỘT lô thất bại giữa chừng trong khi
 *  các lô khác thành công (đột biến 2), và ĐỒNG BỘ hai vòng chạy để chúng thật sự tranh nhau
 *  một chỗ (đột biến 1). Vỏ bọc dưới đây mặc định chuyển tiếp nguyên vẹn sang adapter thật.
 */

const fault = vi.hoisted(() => ({
  /** Số lần `distributeBatch` được gọi thật. */
  batchCalls: 0,
  /** Danh sách ví của từng lần gọi, theo thứ tự — nguồn duy nhất để biết ví nào ở lô nào. */
  batchWallets: [] as string[][],
  /** Lô thứ mấy phải ném lỗi (đếm từ 1), `null` = không lô nào. */
  failBatch: null as null | number,
  /**
   * Chạy mỗi lần `profitPoolBalance` được gọi. Dùng làm CHỐT HẸN cho đột biến 1.
   *
   * Không dùng `Promise.all` trơn để dựng tình huống đồng thời: hai vòng có cùng chuỗi `await`
   * nên vòng đi trước có thể chạy xong hẳn trước khi vòng sau tới chỗ tranh chấp, và khi đó
   * phép kiểm đo một tình huống khác hẳn tình huống nó nói đang đo — xanh mà vô nghĩa.
   */
  onPoolBalance: null as null | (() => Promise<void>),
}));

vi.mock('@/lib/ledger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ledger')>();
  return {
    ...actual,
    getLedger: (...args: Parameters<typeof actual.getLedger>): ILedgerPort => {
      const real = actual.getLedger(...args);
      return {
        ...real,
        async profitPoolBalance(): Promise<bigint> {
          if (fault.onPoolBalance) await fault.onPoolBalance();
          return real.profitPoolBalance();
        },
        async distributeBatch(snapshotId: number, wallets: readonly string[]): Promise<TxResult> {
          fault.batchCalls += 1;
          fault.batchWallets.push([...wallets]);

          if (fault.failBatch === fault.batchCalls) {
            throw new actual.LedgerError(
              real.chain,
              'distributeBatch',
              'Mất kết nối RPC khi gửi lô chia lợi nhuận.',
            );
          }
          return real.distributeBatch(snapshotId, wallets);
        },
      };
    },
  };
});

const { KEEPER_SECRET_MIN_LENGTH, resetServerEnvCache } = await import('@/lib/config/env');
const { resetMockLedger, seedMockLedger } = await import('@/lib/ledger/mock.adapter');
const { getLedger } = await import('@/lib/ledger');
const {
  getConfigStore,
  getDistributionStore,
  getKeeperStore,
  getOrderStore,
  getStore,
  resetMemoryStore,
  resetStoreCache,
} = await import('@/lib/store');
const { DISTRIBUTION_JOB_NAME, listDistributionRuns, runDistributionCycle } = await import(
  '@/lib/bank/distribution-trigger.service'
);
const { approveDistribution } = await import('@/lib/bank/distribution-approval.service');
const { POST: keeperRoute } = await import('@/app/api/keeper/distribution/route');

const CHAIN = 'mock';

/** Giá phát hành, đọc từ nguồn duy nhất — chỉ dùng để dựng `vndAmount` của lệnh mua. */
const PRICE = BigInt(WPT_ISSUE_PRICE_VND);

function actAs(role: string) {
  process.env.DEMO_ROLE = role;
  resetServerEnvCache();
}

/**
 * Một nhà đầu tư ĐANG NẮM WPT và có lệnh mua đã hoàn tất trong sổ.
 *
 * Hai việc, vì danh sách người nhận và số dư nằm ở hai nơi: `collectRecipients` đọc bảng lệnh
 * mua (chuỗi không liệt kê được người nắm giữ), còn phần chia đọc `balanceOfAt` từ chuỗi.
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

/** ĐẶT số dư ví chia lợi nhuận (không phải cộng thêm). */
function setProfitPool(amount: bigint) {
  seedMockLedger({ profitPool: amount });
}

/** Ví hợp lệ, khác nhau, chữ thường — dạng không mang checksum nên adapter chấp nhận. */
function holderWallets(count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) => `0x${'c'.repeat(36)}${index.toString(16).padStart(4, '0')}`,
  );
}

async function setConfigValue(key: string, value: string, type: 'bigint' | 'number' | 'string') {
  await getConfigStore().setConfig({ key, value, type, changedBy: 'TELLER' });
}

/** Mốc số dư đã xử lý, đọc thẳng từ bảng tham số — nguồn mà tiến trình thật cũng đọc. */
async function readMark(): Promise<string> {
  const row = await getConfigStore().getConfig(CONFIG_KEYS.distributionLastSettledBalance);
  return row?.value ?? 'chưa có dòng nào';
}

/** Chạy một vòng và đỏ ngay tại đây nếu bị từ chối. */
async function cycleOk() {
  const result = await runDistributionCycle({ chain: CHAIN });
  expect(result.ok, result.ok ? '' : result.error).toBe(true);
  if (!result.ok) throw new Error('vòng chạy bị từ chối');
  return result.data;
}

async function listRuns() {
  return getKeeperStore().listRuns({ jobName: DISTRIBUTION_JOB_NAME, limit: 100 });
}

/**
 * FE-08: Kiểm soát viên duyệt đúng phần chưa phân bổ hiện tại. Lần duyệt mở kỳ và chạy MỘT lượt
 * chia (nguồn `MANUAL`); trả về khung nhìn của lần duyệt, đỏ ngay tại đây nếu bị từ chối.
 */
async function approveOk() {
  const amount = await getLedger(CHAIN).unallocatedProfit();
  actAs('CONTROLLER');
  try {
    const result = await approveDistribution({ chain: CHAIN, expectedAmount: amount.toString() });
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) throw new Error('không duyệt được');
    return result.data;
  } finally {
    actAs('TELLER');
  }
}

async function listPeriods() {
  return getDistributionStore().listPeriods({ limit: 100 });
}

/** Sổ kiểm toán của hành động chia, mới nhất trước. */
async function distributionAudit() {
  const rows = await getStore().listAudit({ limit: 500 });
  return rows.filter((row) => row.action === 'distribution:execute');
}

/** Số dư VNDB thật trên chuỗi của một danh sách ví. */
async function paymentBalances(wallets: readonly string[]): Promise<bigint[]> {
  const ledger = getLedger(CHAIN);
  const out: bigint[] = [];
  for (const wallet of wallets) out.push(await ledger.paymentBalanceOf(wallet));
  return out;
}

/**
 * Chốt hẹn cho `count` bên: bên nào tới trước thì chờ, tới đủ thì tất cả cùng đi.
 *
 * Mở MỘT LẦN rồi thông luôn cho mọi lần gọi sau (`await` trên một promise đã resolve không
 * chặn). Bắt buộc phải như vậy: `openPeriod` còn đọc số dư ví lợi nhuận hai lần nữa, và một
 * chốt hẹn đóng lại sau khi mở sẽ treo cả hai vòng.
 */
function barrier(count: number): () => Promise<void> {
  let seen = 0;
  let open!: () => void;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });

  return async () => {
    seen += 1;
    if (seen >= count) open();
    await opened;
  };
}

/** Khoá đủ dài theo `KEEPER_SECRET_MIN_LENGTH` — dạng `openssl rand -hex 16` cho ra. */
const SECRET = 'a'.repeat(KEEPER_SECRET_MIN_LENGTH);

/** Gọi điểm vào tiến trình định kỳ. `token === null` nghĩa là không gửi header nào. */
async function callKeeper(token: string | null, body: unknown = { chain: CHAIN }) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token !== null) headers.authorization = `Bearer ${token}`;

  return keeperRoute(
    new Request('https://bank.example/api/keeper/distribution', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  fault.batchCalls = 0;
  fault.batchWallets = [];
  fault.failBatch = null;
  fault.onPoolBalance = null;
  resetMockLedger();
  resetMemoryStore();
  resetStoreCache();
  process.env.USE_MOCK_DB = 'true';
  actAs('TELLER');
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.DEMO_ROLE;
  delete process.env.USE_MOCK_DB;
  delete process.env.KEEPER_SECRET;
  delete process.env.NEXT_PUBLIC_DEFAULT_CHAIN;
  resetServerEnvCache();
  resetStoreCache();
});

// ===========================================================================
//  CA 1 — số dư không tăng
// ===========================================================================
describe('ca 1 — số dư không tăng thì không mở kỳ, không chia', () => {
  it('ghi một vòng chạy không có việc và không chạm chuỗi để ghi', async () => {
    await seedHolder(holderWallets(1)[0], 10n);
    // SC-06 QĐ-I: căn cứ là phần CHƯA PHÂN BỔ của quỹ. Quỹ trống thì không có tiền mới, dù mốc
    // hiển thị là bao nhiêu.
    await setConfigValue(CONFIG_KEYS.distributionLastSettledBalance, '7', 'bigint');
    setProfitPool(0n);

    const view = await cycleOk();

    expect(view.outcome).toBe('NO_NEW_FUNDS');
    expect(view.periodId).toBeNull();
    expect(view.batches).toBe(0);
    expect(await listPeriods()).toHaveLength(0);
    expect(fault.batchCalls).toBe(0);

    // Vòng rỗng VẪN phải có dòng mốc chạy: "đã chạy và không có việc" khác "chưa chạy".
    const runs = await listRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ status: 'SUCCESS', error: null });
    expect(runs[0].finishedAt).not.toBeNull();
  });

  it('mốc số dư không đổi', async () => {
    await setConfigValue(CONFIG_KEYS.distributionLastSettledBalance, '7', 'bigint');
    setProfitPool(7n);

    await cycleOk();

    expect(await readMark()).toBe('7');
  });
});

// ===========================================================================
//  CA 2: số dư tăng, keeper chờ duyệt; Kiểm soát viên duyệt thì mở đúng một kỳ, chia hết
// ===========================================================================
describe('ca 2: số dư tăng thì keeper chờ duyệt, Kiểm soát viên duyệt thì mở kỳ và chia', () => {
  /**
   * Ba ví nắm 1/2/3 trên tổng cung 6, quỹ 1.000.001 VNDB.
   *
   * Chọn để phép chia CÓ phần dư (166.666 + 333.333 + 500.000 = 999.999, dư 2): mốc số dư mới
   * phải là 2, khác 0. Một bối cảnh chia chẵn sẽ cho mốc 0 và khi đó phép kiểm "mốc cập nhật
   * đúng" không phân biệt được với "mốc không được ghi".
   */
  async function seedThreeHolders() {
    const [a, b, c] = holderWallets(3);
    await seedHolder(a, 1n);
    await seedHolder(b, 2n);
    await seedHolder(c, 3n);
    setProfitPool(1_000_001n);
    return [a, b, c] as const;
  }

  it('FE-08 QĐ-E: keeper thấy tiền mới thì AWAITING_APPROVAL, không mở kỳ, không gửi gì', async () => {
    await seedThreeHolders();

    const view = await cycleOk();

    expect(view.outcome).toBe('AWAITING_APPROVAL');
    expect(view.periodId).toBeNull();
    expect(await listPeriods()).toHaveLength(0);
    expect(fault.batchCalls).toBe(0);
  });

  it('lần duyệt mở đúng MỘT kỳ với mã theo ngày UTC và số thứ tự', async () => {
    await seedThreeHolders();

    const approved = await approveOk();

    expect(approved.outcome).toBe('DISTRIBUTED');
    expect(approved.runNo).toBe(1);

    const periods = await listPeriods();
    expect(periods).toHaveLength(1);
    // Tiền tố chain + ngày UTC + số thứ tự trong ngày.
    expect(periods[0].periodKey).toMatch(/^mock:\d{4}-\d{2}-\d{2}-\d{2}$/);
    expect(periods[0].periodKey).toBe(approved.period.periodKey);
    expect(periods[0]).toMatchObject({ status: 'COMPLETED', totalAmount: '1000001', approvalStatus: 'APPROVED' });
  });

  it('tiền tới đúng ví theo tỷ lệ nắm giữ, đối chiếu số dư THẬT trên chuỗi', async () => {
    const [a, b, c] = await seedThreeHolders();

    await approveOk();

    expect(await paymentBalances([a, b, c])).toEqual([166_666n, 333_333n, 500_000n]);
  });

  it('cập nhật mốc số dư bằng phần dư còn lại trong ví, không phải bằng tổng đã nhận', async () => {
    await seedThreeHolders();

    await approveOk();

    // 1.000.001 - 999.999 = 2 đồng phần dư nằm lại trong ví chia lợi nhuận.
    expect(await readMark()).toBe('2');
    expect(await getLedger(CHAIN).profitPoolBalance()).toBe(2n);
  });

  it('vòng keeper kế tiếp thấy phần dư KHÔNG phải tiền mới nên không đề nghị kỳ thứ hai', async () => {
    await seedThreeHolders();
    await approveOk();

    const second = await cycleOk();

    expect(second.outcome).toBe('NO_NEW_FUNDS');
    expect(await listPeriods()).toHaveLength(1);
  });

  it('lần nạp tiếp theo: keeper chờ duyệt, lần duyệt mở kỳ MỚI với số thứ tự tăng', async () => {
    await seedThreeHolders();
    const first = await approveOk();

    // SPV nạp thêm: 2 đồng phần dư cộng 600.000 mới.
    setProfitPool(600_002n);
    expect((await cycleOk()).outcome).toBe('AWAITING_APPROVAL');
    const second = await approveOk();

    expect(second.outcome).toBe('DISTRIBUTED');
    expect(second.period.periodKey).not.toBe(first.period.periodKey);
    expect(second.period.periodKey.endsWith('-02')).toBe(true);
    expect(await listPeriods()).toHaveLength(2);
  });
});

// ===========================================================================
//  CA 3 + CA 4 — chia nhiều vòng, mốc chỉ đổi khi xong toàn bộ
// ===========================================================================
describe('ca 3 và 4 — nhiều ví hơn số lô cho phép mỗi vòng', () => {
  /** Sáu ví mỗi ví 1 WPT, quỹ 6.001 -> mỗi ví 1.000, phần dư 1. */
  async function seedSixHolders() {
    const wallets = holderWallets(6);
    for (const wallet of wallets) await seedHolder(wallet, 1n);
    setProfitPool(6_001n);
    return wallets;
  }

  /** Lô 2 ví, tối đa 2 lô mỗi vòng -> 4 ví mỗi vòng, 6 ví cần hai vòng. */
  async function limitToFourWalletsPerRun() {
    await setConfigValue(CONFIG_KEYS.distributionBatchSize, '2', 'number');
    await setConfigValue(CONFIG_KEYS.distributionMaxBatchesPerRun, '2', 'number');
  }

  it('lượt đầu (lần duyệt) chia dở và mốc số dư KHÔNG đổi', async () => {
    await seedSixHolders();
    await limitToFourWalletsPerRun();

    const first = await approveOk();

    expect(first.outcome).toBe('PARTIAL');
    expect(first.run?.batches).toBe(2);
    expect(first.run?.paid).toBe(4);
    expect(first.run?.outstanding).toBe(2);
    // Chưa chia xong -> chưa được ghi mốc. Bảng còn TRỐNG, không phải ghi giá trị cũ.
    expect(await readMark()).toBe('chưa có dòng nào');
  });

  it('vòng keeper chia tiếp ĐÚNG kỳ đang dở, không mở kỳ mới', async () => {
    await seedSixHolders();
    await limitToFourWalletsPerRun();
    const first = await approveOk();

    const second = await cycleOk();

    expect(second.outcome).toBe('DISTRIBUTED');
    expect(second.periodId).toBe(first.period.id);
    expect(second.runNo).toBe(2);
    expect(await listPeriods()).toHaveLength(1);
  });

  it('chia xong TOÀN BỘ mới cập nhật mốc số dư', async () => {
    const wallets = await seedSixHolders();
    await limitToFourWalletsPerRun();

    await approveOk();
    expect(await readMark()).toBe('chưa có dòng nào');

    const second = await cycleOk();

    expect(second.outstanding).toBe(0);
    expect(await readMark()).toBe('1');
    expect(await paymentBalances(wallets)).toEqual([1_000n, 1_000n, 1_000n, 1_000n, 1_000n, 1_000n]);
  });

  it('hai vòng của cùng một kỳ là hai dòng mốc chạy khác nhau, ghi đúng nguồn kích hoạt', async () => {
    await seedSixHolders();
    await limitToFourWalletsPerRun();
    await approveOk();
    await cycleOk();

    const runs = await listRuns();
    expect(runs).toHaveLength(2);
    // FE-08: vòng 1 do Kiểm soát viên bấm duyệt, vòng 2 do keeper.
    const byNo = new Map(runs.map((run) => [run.periodKey.split('#')[1], run.triggerSource]));
    expect(byNo.get('1')).toBe('MANUAL');
    expect(byNo.get('2')).toBe('KEEPER');
    // Khoá ghép `<mã kỳ>#<số vòng>` là thứ cho hai vòng nối tiếp cùng chạy được, trong khi
    // ràng buộc duy nhất vẫn chặn hai vòng ĐỒNG THỜI.
    expect(runs.map((run) => run.periodKey).sort()).toEqual(
      [1, 2].map((no) => `${runs[0].periodKey.split('#')[0]}#${no}`),
    );

    const log = await listDistributionRuns({ limit: 10 });
    expect(log.ok).toBe(true);
    if (!log.ok) return;
    expect(log.data.map((row) => row.runNo).sort()).toEqual([1, 2]);
  });
});

// ===========================================================================
//  CA 5 — mức tăng dưới ngưỡng tối thiểu
// ===========================================================================
describe('ca 5 — số dư tăng dưới ngưỡng tối thiểu thì không mở kỳ', () => {
  it('mặc định trong mã chặn mức tăng nhỏ', async () => {
    await seedHolder(holderWallets(1)[0], 10n);
    setProfitPool(BigInt(DISTRIBUTION_MIN_NEW_BALANCE) - 1n);

    const view = await cycleOk();

    expect(view.outcome).toBe('BELOW_MIN_NEW_BALANCE');
    expect(await listPeriods()).toHaveLength(0);
    expect(fault.batchCalls).toBe(0);
  });

  /**
   * Ngưỡng đọc từ THAM SỐ HỆ THỐNG, không viết cứng.
   *
   * Phép kiểm này dùng một giá trị mà mặc định trong mã sẽ cho kết luận NGƯỢC LẠI: 5.000 lớn
   * hơn mặc định 1.000 nên nếu ngưỡng bị viết cứng thì kỳ được mở và ca này đỏ.
   */
  it('ngưỡng cấu hình được, và giá trị cấu hình thắng mặc định', async () => {
    await seedHolder(holderWallets(1)[0], 10n);
    await setConfigValue(CONFIG_KEYS.distributionMinNewBalance, '10000', 'bigint');
    setProfitPool(5_000n);

    const view = await cycleOk();

    expect(view.outcome).toBe('BELOW_MIN_NEW_BALANCE');
    expect(await listPeriods()).toHaveLength(0);
  });

  it('đúng ngưỡng thì chờ Kiểm soát viên duyệt (FE-08: keeper không mở kỳ)', async () => {
    await seedHolder(holderWallets(1)[0], 10n);
    await setConfigValue(CONFIG_KEYS.distributionMinNewBalance, '5000', 'bigint');
    setProfitPool(5_000n);

    const view = await cycleOk();

    expect(view.outcome).toBe('AWAITING_APPROVAL');
    expect(await listPeriods()).toHaveLength(0);
  });
});

// ===========================================================================
//  CA 6: quỹ hụt so với dự trữ (SC-06 QĐ-I thay "số dư giảm so với mốc")
// ===========================================================================
describe('ca 6: quỹ hụt so với tổng dự trữ thì dừng và ghi cảnh báo', () => {
  /**
   * Kỳ chia dở giữ 6.001 VNDB dự trữ; rồi quỹ bị rút xuống 1.000 (trên chuỗi thật: đốt VNDB trong
   * quỹ bằng BURNER_ROLE). Mốc số dư hiển thị không liên quan: đặt 0 để chắc nó không quyết định.
   */
  async function shortfall() {
    for (const wallet of holderWallets(6)) await seedHolder(wallet, 1n);
    setProfitPool(6_001n);
    await setConfigValue(CONFIG_KEYS.distributionBatchSize, '2', 'number');
    await setConfigValue(CONFIG_KEYS.distributionMaxBatchesPerRun, '1', 'number');
    await approveOk();
    setProfitPool(1_000n);
  }

  it('từ chối với mã INSUFFICIENT_PROFIT_POOL, không gửi lô và không mở kỳ mới', async () => {
    await shortfall();
    const calls = fault.batchCalls;

    const result = await runDistributionCycle({ chain: CHAIN });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('INSUFFICIENT_PROFIT_POOL');
    expect(result.error).toContain('THẤP HƠN tổng dự trữ');
    expect(fault.batchCalls).toBe(calls);
    expect(await listPeriods()).toHaveLength(1);
  });

  it('để lại dòng mốc chạy THẤT BẠI và một bản ghi kiểm toán', async () => {
    await shortfall();

    await runDistributionCycle({ chain: CHAIN });

    const runs = (await listRuns()).filter((run) => run.status === 'FAILED');
    expect(runs).toHaveLength(1);
    expect(runs[0].error).toContain('THẤP HƠN tổng dự trữ');

    const audit = await distributionAudit();
    expect(
      audit.some((row) => row.outcome === 'FAILURE' && row.detail?.includes('THẤP HƠN tổng dự trữ')),
    ).toBe(true);
  });

  it('số dư thấp hơn mốc hiển thị KHÔNG còn là bất thường khi quỹ đủ dự trữ', async () => {
    await setConfigValue(CONFIG_KEYS.distributionLastSettledBalance, '5000', 'bigint');
    setProfitPool(0n);

    const view = await cycleOk();

    expect(view.outcome).toBe('NO_NEW_FUNDS');
    expect(await readMark()).toBe('5000');
  });
});

// ===========================================================================
//  CA 7 — kỳ treo quá số vòng cấu hình
// ===========================================================================
describe('ca 7 — kỳ chưa xong sau số vòng cấu hình thì có cảnh báo', () => {
  /** Năm ví, mỗi vòng chỉ chia được một ví -> cần năm vòng. Ngưỡng treo hạ xuống 2. */
  async function seedSlowPeriod() {
    const wallets = holderWallets(5);
    for (const wallet of wallets) await seedHolder(wallet, 1n);
    setProfitPool(5_000n);
    await setConfigValue(CONFIG_KEYS.distributionBatchSize, '1', 'number');
    await setConfigValue(CONFIG_KEYS.distributionMaxBatchesPerRun, '1', 'number');
    await setConfigValue(CONFIG_KEYS.distributionStuckAfterRuns, '2', 'number');
    return wallets;
  }

  it('vòng trong ngưỡng chưa cảnh báo', async () => {
    await seedSlowPeriod();

    const first = await approveOk();

    expect(first.outcome).toBe('PARTIAL');
    const runs = await listRuns();
    expect(runs[0]).toMatchObject({ status: 'SUCCESS', error: null });
  });

  it('vòng chạm ngưỡng thì ghi cảnh báo vào mốc chạy VÀ sổ kiểm toán', async () => {
    await seedSlowPeriod();
    await approveOk();

    const second = await cycleOk();

    expect(second.stuck).toBe(true);
    expect(second.message).toContain('CẢNH BÁO');

    const stuckRun = (await listRuns()).find((run) => run.periodKey.endsWith('#2'));
    expect(stuckRun?.status).toBe('FAILED');
    expect(stuckRun?.error).toContain('CẢNH BÁO');

    const audit = await distributionAudit();
    expect(
      audit.some((row) => row.outcome === 'FAILURE' && row.detail?.includes('CẢNH BÁO')),
    ).toBe(true);
  });

  it('ngưỡng đọc từ tham số hệ thống, không viết cứng', async () => {
    const wallets = holderWallets(5);
    for (const wallet of wallets) await seedHolder(wallet, 1n);
    setProfitPool(5_000n);
    await setConfigValue(CONFIG_KEYS.distributionBatchSize, '1', 'number');
    await setConfigValue(CONFIG_KEYS.distributionMaxBatchesPerRun, '1', 'number');
    // Ngưỡng cao hơn mặc định trong mã: nếu viết cứng thì vòng thứ 3 đã cảnh báo.
    await setConfigValue(
      CONFIG_KEYS.distributionStuckAfterRuns,
      String(DISTRIBUTION_STUCK_AFTER_RUNS + 2),
      'number',
    );

    await approveOk();
    await cycleOk();
    const third = await cycleOk();

    expect(third.runNo).toBe(3);
    expect(third.stuck).toBe(false);
  });

  it('cảnh báo KHÔNG làm mất phần đã chia: các vòng sau vẫn chia tiếp tới hết', async () => {
    const wallets = await seedSlowPeriod();

    await approveOk();
    for (let i = 0; i < 4; i += 1) await cycleOk();

    expect(await paymentBalances(wallets)).toEqual([1_000n, 1_000n, 1_000n, 1_000n, 1_000n]);
    expect(await readMark()).toBe('0');
  });
});

// ===========================================================================
//  CA 8 — quyền của hàm kích hoạt tay
// ===========================================================================
describe('ca 8 — vai không có distribution:execute bị chặn', () => {
  it.each(['CONTROLLER', 'SELLER', 'INVESTOR'])('vai %s bị từ chối', async (role) => {
    await seedHolder(holderWallets(1)[0], 10n);
    setProfitPool(1_000_000n);
    actAs(role);

    const result = await runDistributionCycle({ chain: CHAIN });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('FORBIDDEN');
    expect(await listPeriods()).toHaveLength(0);
    expect(await listRuns()).toHaveLength(0);
  });

  it('lần bị chặn vẫn để lại vết trong sổ kiểm toán', async () => {
    setProfitPool(1_000_000n);
    actAs('CONTROLLER');

    await runDistributionCycle({ chain: CHAIN });

    const audit = await distributionAudit();
    expect(audit.some((row) => row.outcome === 'DENIED' && row.actorRole === 'CONTROLLER')).toBe(true);
  });

  it('chain sai dạng bị chặn ở validate', async () => {
    const result = await runDistributionCycle({ chain: 'polygon' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
  });
});

// ===========================================================================
//  ĐỘT BIẾN 1 — hai vòng chạy ĐỒNG THỜI cùng một kỳ
// ===========================================================================
describe('đột biến 1 — hai vòng đồng thời không chia trùng', () => {
  /**
   * FE-08: keeper không mở kỳ, nên tranh chấp xảy ra trên kỳ ĐÃ DUYỆT còn dở. Hai ví, mỗi lô một
   * ví, mỗi lượt một lô: lần duyệt chia ví thứ nhất, hai vòng keeper đồng thời tranh nhau ví thứ hai.
   */
  async function seedTwoHolders() {
    const [a, b] = holderWallets(2);
    await seedHolder(a, 1n);
    await seedHolder(b, 1n);
    setProfitPool(1_000n);
    await setConfigValue(CONFIG_KEYS.distributionBatchSize, '1', 'number');
    await setConfigValue(CONFIG_KEYS.distributionMaxBatchesPerRun, '1', 'number');
    expect((await approveOk()).outcome).toBe('PARTIAL');
    return [a, b] as const;
  }

  it('chỉ một vòng chia, vòng còn lại dừng ngay', async () => {
    await seedTwoHolders();
    // Chốt hẹn: cả hai vòng đọc số dư xong rồi mới cho đi tiếp, nên chúng thật sự tranh nhau.
    fault.onPoolBalance = barrier(2);

    const results = await Promise.all([
      runDistributionCycle({ chain: CHAIN }),
      runDistributionCycle({ chain: CHAIN }),
    ]);

    // So theo TẬP, không theo thứ tự: vòng nào thắng là chi tiết của bộ lập lịch, không phải
    // tính chất đang được bảo vệ.
    const outcomes = results
      .map((r) => (r.ok ? r.data.outcome : `err:${r.code}`))
      .sort();
    expect(outcomes).toEqual(['ALREADY_RUNNING', 'DISTRIBUTED']);
  });

  it('chỉ một kỳ và chỉ gửi số lô của một vòng', async () => {
    await seedTwoHolders();
    const before = fault.batchCalls;
    fault.onPoolBalance = barrier(2);

    await Promise.all([
      runDistributionCycle({ chain: CHAIN }),
      runDistributionCycle({ chain: CHAIN }),
    ]);

    expect(await listPeriods()).toHaveLength(1);
    // Còn một ví, lô 1 -> đúng một lô. Hai vòng cùng chia sẽ là hai lô.
    expect(fault.batchCalls).toBe(before + 1);
  });

  it('tổng tiền đã chia KHÔNG vượt tổng tiền của kỳ', async () => {
    const [a, b] = await seedTwoHolders();
    fault.onPoolBalance = barrier(2);

    await Promise.all([
      runDistributionCycle({ chain: CHAIN }),
      runDistributionCycle({ chain: CHAIN }),
    ]);

    const balances = await paymentBalances([a, b]);
    expect(balances).toEqual([500n, 500n]);
    expect(balances.reduce((total, value) => total + value, 0n)).toBeLessThanOrEqual(1_000n);
    // Và ví lợi nhuận không bị rút quá: 1.000 - 1.000 = 0.
    expect(await getLedger(CHAIN).profitPoolBalance()).toBe(0n);
  });

  it('vòng bị dừng KHÔNG ghi dòng mốc chạy thứ hai cho cùng số vòng', async () => {
    await seedTwoHolders();
    fault.onPoolBalance = barrier(2);

    await Promise.all([
      runDistributionCycle({ chain: CHAIN }),
      runDistributionCycle({ chain: CHAIN }),
    ]);

    // Vòng 1 là lần duyệt (MANUAL), vòng 2 là MỘT vòng keeper; không có dòng #2 thứ hai.
    const runs = await listRuns();
    expect(runs.map((run) => run.periodKey.split('#')[1]).sort()).toEqual(['1', '2']);
  });

  /**
   * Tình huống mà chỗ chạy là LỚP BẢO VỆ DUY NHẤT.
   *
   * Với kỳ mới, ràng buộc duy nhất `periodKey` của bảng kỳ chia còn đỡ được vòng thứ hai. Với
   * kỳ ĐANG DỞ thì không: không ai mở kỳ nữa, nên hai vòng cùng đi thẳng vào `distributePeriod`
   * của cùng một kỳ và cùng gửi lô cho cùng những ví. Cờ đã-nhận trên chuỗi giữ cho không ai
   * bị trả hai lần, nhưng phí đã tốn và hai lời gọi `markPayout` chồng nhau.
   *
   * Vì vậy ca này đo SỐ LẦN GỬI LÔ tăng thêm, không chỉ đo `outcome`.
   */
  it('hai vòng đồng thời trên kỳ ĐANG DỞ: chỉ một vòng gửi lô', async () => {
    const wallets = holderWallets(6);
    for (const wallet of wallets) await seedHolder(wallet, 1n);
    setProfitPool(6_000n);
    await setConfigValue(CONFIG_KEYS.distributionBatchSize, '2', 'number');
    await setConfigValue(CONFIG_KEYS.distributionMaxBatchesPerRun, '2', 'number');

    const first = await approveOk();
    expect(first.outcome).toBe('PARTIAL');
    const batchesAfterFirstRun = fault.batchCalls;

    fault.onPoolBalance = barrier(2);
    const results = await Promise.all([
      runDistributionCycle({ chain: CHAIN }),
      runDistributionCycle({ chain: CHAIN }),
    ]);

    const outcomes = results.map((r) => (r.ok ? r.data.outcome : `err:${r.code}`)).sort();
    expect(outcomes).toEqual(['ALREADY_RUNNING', 'DISTRIBUTED']);
    // Còn 2 ví, lô 2 -> đúng MỘT lô nữa. Hai vòng cùng chia sẽ là hai lô.
    expect(fault.batchCalls).toBe(batchesAfterFirstRun + 1);
    expect(await paymentBalances(wallets)).toEqual([
      1_000n, 1_000n, 1_000n, 1_000n, 1_000n, 1_000n,
    ]);
  });
});

// ===========================================================================
//  ĐỘT BIẾN 2 — một lô ném lỗi giữa chừng
// ===========================================================================
describe('đột biến 2 — lô lỗi không đánh dấu nhầm, vòng sau chia đúng cho ví còn thiếu', () => {
  /** Ba ví, mỗi lô một ví, tối đa 5 lô -> cả ba lô đi trong một vòng. */
  async function seedThreeOneEach() {
    const wallets = holderWallets(3);
    for (const wallet of wallets) await seedHolder(wallet, 1n);
    setProfitPool(3_000n);
    await setConfigValue(CONFIG_KEYS.distributionBatchSize, '1', 'number');
    await setConfigValue(CONFIG_KEYS.distributionMaxBatchesPerRun, '5', 'number');
    return wallets;
  }

  it('mốc số dư không đổi khi còn ví chưa nhận', async () => {
    await seedThreeOneEach();
    fault.failBatch = 2;

    const view = await approveOk();

    expect(view.outcome).toBe('PARTIAL');
    expect(view.run?.failed).toBe(1);
    expect(view.run?.outstanding).toBe(1);
    expect(await readMark()).toBe('chưa có dòng nào');
  });

  it('ví trong lô lỗi KHÔNG bị đánh dấu đã nhận và chưa nhận đồng nào', async () => {
    await seedThreeOneEach();
    fault.failBatch = 2;

    const view = await approveOk();

    /**
     * Ví của lô lỗi lấy từ CHÍNH lời gọi đã gửi lô, không suy từ thứ tự tạo dữ liệu:
     * `collectRecipients` đọc `listOrders` trả về mới nhất trước và phá thế bằng uuid, nên
     * thứ tự lô không trùng thứ tự `seedHolder`.
     */
    const failedWallet = fault.batchWallets[1][0];

    expect(await paymentBalances([failedWallet])).toEqual([0n]);

    const rows = await getDistributionStore().listPayouts({
      periodId: view.period.id,
      limit: 100,
    });
    const failedRow = rows.find(
      (row) => row.investorWallet.toLowerCase() === failedWallet.toLowerCase(),
    );
    expect(failedRow?.status).toBe('FAILED');
    expect(failedRow?.txHash).toBeNull();
  });

  it('vòng sau chia đúng cho ví còn thiếu, không trả lần hai cho ví đã nhận', async () => {
    const wallets = await seedThreeOneEach();
    fault.failBatch = 2;
    const first = await approveOk();
    const failedWallet = fault.batchWallets[1][0];

    fault.failBatch = null;
    const second = await cycleOk();

    expect(second.periodId).toBe(first.period.id);
    expect(second.outcome).toBe('DISTRIBUTED');
    // Chỉ một lô nữa: đúng ví còn thiếu, không gửi lại hai ví đã nhận.
    expect(second.batches).toBe(1);
    expect(fault.batchWallets[fault.batchWallets.length - 1]).toEqual([failedWallet]);

    // Mỗi ví đúng 1.000, không ai nhận 2.000.
    expect(await paymentBalances(wallets)).toEqual([1_000n, 1_000n, 1_000n]);
    expect(await readMark()).toBe('0');
  });
});

// ===========================================================================
//  VÍ LỢI NHUẬN KHÔNG ĐỦ TIỀN CHO PHẦN CÒN PHẢI CHIA
// ===========================================================================
describe('ví lợi nhuận thiếu tiền giữa kỳ thì dừng, không chia một phần rồi bỏ dở', () => {
  it('từ chối với mã INSUFFICIENT_PROFIT_POOL và không gửi lô nào', async () => {
    const wallets = holderWallets(4);
    for (const wallet of wallets) await seedHolder(wallet, 1n);
    setProfitPool(4_000n);
    await setConfigValue(CONFIG_KEYS.distributionBatchSize, '1', 'number');
    await setConfigValue(CONFIG_KEYS.distributionMaxBatchesPerRun, '1', 'number');

    await approveOk();
    const batchesAfterFirstRun = fault.batchCalls;

    // Tiền rời ví lợi nhuận bằng một đường ngoài hệ thống, còn 500 trong khi cần 3.000.
    setProfitPool(500n);
    const result = await runDistributionCycle({ chain: CHAIN });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('INSUFFICIENT_PROFIT_POOL');
    expect(fault.batchCalls).toBe(batchesAfterFirstRun);

    // SC-06 QĐ-I: quỹ hụt được phát hiện TRƯỚC khi chọn kỳ, nên vòng dừng ở khoá vòng rỗng,
    // không chiếm khoá `#2` của kỳ.
    const failedRun = (await listRuns()).find((run) => run.status === 'FAILED');
    expect(failedRun?.periodKey.startsWith('idle#')).toBe(true);
    expect(failedRun?.error).toContain('phải nạp bù');
  });
});

// ===========================================================================
//  CA 9 — điểm vào của tiến trình định kỳ
// ===========================================================================
describe('ca 9 — route handler chỉ chạy khi có khoá bí mật đúng', () => {
  /** Một bối cảnh đủ để một vòng chạy làm được việc thật, nên "bị chặn" mới có ý nghĩa. */
  async function seedReadyToDistribute() {
    const [a, b] = holderWallets(2);
    await seedHolder(a, 1n);
    await seedHolder(b, 1n);
    setProfitPool(1_000n);
    return [a, b] as const;
  }

  /** Không việc gì xảy ra: không kỳ, không mốc chạy, không lô nào gửi. */
  async function expectNothingHappened() {
    expect(await listPeriods()).toHaveLength(0);
    expect(await listRuns()).toHaveLength(0);
    expect(fault.batchCalls).toBe(0);
  }

  it('không có header thì từ chối 401', async () => {
    await seedReadyToDistribute();
    process.env.KEEPER_SECRET = SECRET;
    resetServerEnvCache();

    const response = await callKeeper(null);

    expect(response.status).toBe(401);
    await expectNothingHappened();
  });

  it('khoá sai thì từ chối 401', async () => {
    await seedReadyToDistribute();
    process.env.KEEPER_SECRET = SECRET;
    resetServerEnvCache();

    const response = await callKeeper('b'.repeat(KEEPER_SECRET_MIN_LENGTH));

    expect(response.status).toBe(401);
    await expectNothingHappened();
  });

  it('khoá đúng độ dài nhưng lệch một ký tự vẫn bị từ chối', async () => {
    await seedReadyToDistribute();
    process.env.KEEPER_SECRET = SECRET;
    resetServerEnvCache();

    // Cùng độ dài: phép so sánh trong thời gian cố định phải đi hết chuỗi rồi mới kết luận.
    const response = await callKeeper(`${SECRET.slice(0, -1)}b`);

    expect(response.status).toBe(401);
    await expectNothingHappened();
  });

  /**
   * "Chưa cấu hình" phải là ĐÓNG.
   *
   * Đây là phép kiểm quan trọng nhất của ca 9: một bản triển khai quên đặt `KEEPER_SECRET` mà
   * route lại cho qua thì điểm vào chuyển tiền thành công khai, và không lỗi nào báo.
   */
  it('chưa cấu hình KEEPER_SECRET thì từ chối MỌI khoá', async () => {
    await seedReadyToDistribute();
    delete process.env.KEEPER_SECRET;
    resetServerEnvCache();

    const withToken = await callKeeper(SECRET);
    const withoutToken = await callKeeper(null);

    expect(withToken.status).toBe(401);
    expect(withoutToken.status).toBe(401);
    await expectNothingHappened();
  });

  it('câu trả lời không nói khoá đã cấu hình hay chưa', async () => {
    process.env.KEEPER_SECRET = SECRET;
    resetServerEnvCache();
    const wrongKey = (await (await callKeeper('c'.repeat(KEEPER_SECRET_MIN_LENGTH))).json()) as {
      error: string;
    };

    delete process.env.KEEPER_SECRET;
    resetServerEnvCache();
    const noKey = (await (await callKeeper(SECRET)).json()) as { error: string };

    // Hai câu giống nhau: khác nhau là chỉ cho người dò biết họ đang ở bước nào.
    expect(wrongKey.error).toBe(noKey.error);
  });

  it('khoá đúng thì chạy một vòng thật: chưa duyệt thì chờ, kỳ đã duyệt dở thì chia tiếp', async () => {
    const [a, b] = await seedReadyToDistribute();
    process.env.KEEPER_SECRET = SECRET;
    resetServerEnvCache();

    // FE-08 QĐ-E: tiền chưa duyệt thì endpoint không trả đồng nào.
    const waiting = await callKeeper(SECRET);
    const waitingPayload = (await waiting.json()) as { ok: boolean; data: { outcome: string } };
    expect(waiting.status).toBe(200);
    expect(waitingPayload.data.outcome).toBe('AWAITING_APPROVAL');
    expect(await paymentBalances([a, b])).toEqual([0n, 0n]);

    await setConfigValue(CONFIG_KEYS.distributionBatchSize, '1', 'number');
    await setConfigValue(CONFIG_KEYS.distributionMaxBatchesPerRun, '1', 'number');
    await approveOk();
    process.env.KEEPER_SECRET = SECRET;
    resetServerEnvCache();

    const response = await callKeeper(SECRET);
    const payload = (await response.json()) as { ok: boolean; data: { outcome: string } };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.outcome).toBe('DISTRIBUTED');
    expect(await paymentBalances([a, b])).toEqual([500n, 500n]);
  });

  it('thân yêu cầu trống thì lấy chain mặc định của bản triển khai', async () => {
    await seedReadyToDistribute();
    process.env.KEEPER_SECRET = SECRET;
    process.env.NEXT_PUBLIC_DEFAULT_CHAIN = CHAIN;
    resetServerEnvCache();

    const response = await callKeeper(SECRET, {});
    const payload = (await response.json()) as { ok: boolean; data: { chain: string } };

    expect(response.status).toBe(200);
    expect(payload.data.chain).toBe(CHAIN);
  });

  it('vai không có quyền vẫn bị RBAC chặn dù khoá đúng', async () => {
    await seedReadyToDistribute();
    process.env.KEEPER_SECRET = SECRET;
    // `actAs` tự nạp lại env, nên đặt khoá TRƯỚC rồi đổi vai là đủ — cả hai cùng một lần nạp.
    actAs('CONTROLLER');

    const response = await callKeeper(SECRET);

    // Khoá bí mật trả lời "có phải tiến trình của mình", RBAC trả lời "được làm gì". Hai lớp.
    expect(response.status).toBe(403);
    expect(await listPeriods()).toHaveLength(0);
  });

  it('công việc dọn lệnh treo cũng đi qua điểm vào này', async () => {
    process.env.KEEPER_SECRET = SECRET;
    resetServerEnvCache();

    const response = await callKeeper(SECRET, { job: 'expire-orders' });
    const payload = (await response.json()) as { ok: boolean; data: { expired: number } };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.expired).toBe(0);
  });

  it('tên công việc lạ bị từ chối 400 và không chạy gì', async () => {
    await seedReadyToDistribute();
    process.env.KEEPER_SECRET = SECRET;
    resetServerEnvCache();

    const response = await callKeeper(SECRET, { job: 'chuyen-het-tien-cho-toi' });

    expect(response.status).toBe(400);
    await expectNothingHappened();
  });
});
