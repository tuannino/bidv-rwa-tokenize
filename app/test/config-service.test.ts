import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG_KEYS, WPT_ISSUE_PRICE_VND } from '@/lib/config/issue-terms';
import { resetServerEnvCache } from '@/lib/config/env';
import { resetMockLedger } from '@/lib/ledger/mock.adapter';
import { getConfigStore, getStore, resetMemoryStore, resetStoreCache } from '@/lib/store';

/**
 * BE-04 — GIÁ HIỂN THỊ VÀ GIÁ KHỚP LỆNH LUÔN LÀ MỘT CON SỐ.
 *
 * Đây là rủi ro chính của cả task. Giá tồn tại ở hai nơi: cơ sở dữ liệu (thứ màn hình đọc để
 * HIỂN THỊ) và ledger (thứ `executePurchase` đọc để TRỪ TIỀN). Lệch nhau thì nhà đầu tư thấy một
 * giá và bị trừ theo giá khác, mà KHÔNG phép kiểm nào bắt được — cả hai con số đều đúng so với
 * nguồn của chúng.
 *
 * Vì vậy mọi ca ở đây so `getIssuePrice()` với `ledger.quotePurchase(1n)`, chứ không so với một
 * con số gõ tay. So với con số gõ tay thì test chỉ kiểm "giá bằng X", không kiểm "hai nguồn không
 * lệch nhau" — chệch đúng tính chất cần bảo vệ.
 *
 * Vai điều khiển qua `DEMO_ROLE`: ngoài request scope `cookies()` ném lỗi, `currentRole()` bắt lỗi
 * đó rồi lùi về env — nên test đặt được vai mà không cần dựng request giả.
 */

/** `mock` để không cần RPC; adapter mock nghiêm ngặt ngang contract thật. */
const CHAIN = 'mock';

/**
 * Giá mặc định ở nguồn duy nhất, và hai giá thử SUY RA TỪ NÓ (BE-04 việc 16, ca 5).
 *
 * Vì sao không gõ `'120000'` / `'150000'` như hằng số: ngưỡng đổi giá so giá mới với giá ĐANG CÓ
 * HIỆU LỰC, nên một con số tuyệt đối chỉ "trong ngưỡng" khi giá mặc định còn là 100.000. Đổi mặc
 * định thành 500.000 thì `'120000'` trở thành mức giảm hơn 4 lần và bị từ chối — cả nhóm ca đỏ vì
 * một lý do không ca nào trong đó đang kiểm.
 *
 * Suy ra từ nguồn thì hai con số dưới đây LUÔN nằm trong ngưỡng hệ số 2, với mọi giá mặc định.
 */
const DEFAULT_PRICE = BigInt(WPT_ISSUE_PRICE_VND);
/** +20%: đổi giá bình thường, không cần xác nhận. */
const NEAR_PRICE = ((DEFAULT_PRICE * 12n) / 10n).toString();
/** +50%: vẫn trong ngưỡng, dùng khi một ca cần hai mức giá khác nhau. */
const NEAR_PRICE_2 = ((DEFAULT_PRICE * 15n) / 10n).toString();

function actAs(role: string) {
  process.env.DEMO_ROLE = role;
  resetServerEnvCache();
}

/**
 * Nhập lại module SAU khi đã dựng môi trường.
 *
 * Cần thiết vì `getLedger` đọc `serverEnv()` và `config.service` giữ tham chiếu tới cổng lưu trữ
 * qua factory; nhập một lần ở đầu tệp rồi đổi env sẽ để lời gọi đi vào bản đã dựng trước đó.
 */
async function services() {
  return import('@/lib/bank/config.service');
}

async function mockLedger() {
  const { getLedger } = await import('@/lib/ledger');
  return getLedger(CHAIN);
}

beforeEach(() => {
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
//  CA 1 — sau khi đặt giá, giá hiển thị == giá khớp lệnh
// ===========================================================================
describe('ca 1 — giá trong cơ sở dữ liệu bằng giá quotePurchase trả về', () => {
  it('trạng thái khởi tạo: hai nguồn đã khớp nhau', async () => {
    const { getIssuePrice } = await services();

    const view = await getIssuePrice();
    const quoted = await (await mockLedger()).quotePurchase(1n);

    expect(BigInt(view.priceVnd)).toBe(quoted);
  });

  /**
   * Ba giá TUỲ Ý trải nhiều bậc độ lớn, kèm `confirmLargeChange: true`.
   *
   * Cố ý KHÔNG suy từ giá mặc định: điều cần kiểm ở đây là "hai nguồn bằng nhau với MỌI giá", nên
   * chúng phải khác giá mặc định và khác nhau rõ rệt. Có xác nhận nên ngưỡng không chen vào, và
   * phép so là giá đặt vào với chính nó — độc lập hoàn toàn với giá mặc định là bao nhiêu.
   */
  it.each([['250000'], ['1'], ['99999999999999999999999999']])(
    'đặt giá %s rồi đọc lại: cơ sở dữ liệu và ledger cùng một con số',
    async (priceVnd) => {
      const { getIssuePrice, setIssuePrice } = await services();

      const result = await setIssuePrice({ chain: CHAIN, priceVnd, confirmLargeChange: true });
      expect(result.ok, result.ok ? '' : result.error).toBe(true);

      const view = await getIssuePrice();
      const quoted = await (await mockLedger()).quotePurchase(1n);

      expect(view.priceVnd).toBe(priceVnd);
      expect(quoted).toBe(BigInt(priceVnd));
      expect(BigInt(view.priceVnd)).toBe(quoted);
    },
  );

  it('giá mới áp vào TIỀN THẬT BỊ TRỪ, không chỉ vào con số báo giá', async () => {
    const { setIssuePrice } = await services();
    const { seedMockLedger } = await import('@/lib/ledger/mock.adapter');
    const SPV = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
    const INVESTOR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

    const ledger = await mockLedger();
    await ledger.whitelist(SPV);
    await ledger.whitelist(INVESTOR);
    await ledger.mintInitialSupply(SPV, 1_000n);

    await setIssuePrice({ chain: CHAIN, priceVnd: NEAR_PRICE_2, confirmLargeChange: true });

    // Suy từ giá vừa đặt, không gõ lại con số: nạp sai số VNDB thì khớp lệnh trượt ở phép kiểm số
    // dư và ca này đỏ vì một lý do khác hẳn điều nó đang kiểm.
    const cost = 2n * BigInt(NEAR_PRICE_2);
    seedMockLedger({ paymentBalances: { [INVESTOR]: cost }, paymentAllowances: { [INVESTOR]: cost } });
    await ledger.executePurchase(INVESTOR, 2n);

    expect(await ledger.paymentBalanceOf(INVESTOR)).toBe(0n);
    expect(await ledger.balanceOf(INVESTOR)).toBe(2n);
  });

  it('ghi cả dòng lịch sử, giữ được giá cũ để đối soát', async () => {
    const { setIssuePrice } = await services();

    await setIssuePrice({ chain: CHAIN, priceVnd: NEAR_PRICE, reason: 'điều chỉnh đợt hai' });

    const history = await getConfigStore().listConfigHistory({ key: CONFIG_KEYS.issuePriceVnd });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      newValue: NEAR_PRICE,
      changedBy: 'BANK_ADMIN',
      reason: 'điều chỉnh đợt hai',
    });
    expect(history[0].oldValue).toBe(String(WPT_ISSUE_PRICE_VND));
  });
});

// ===========================================================================
//  CA 2 — giá không hợp lệ và giá vượt ngưỡng bị từ chối
// ===========================================================================
describe('ca 2 — giá âm hoặc 0 bị từ chối; lệch quá ngưỡng cần xác nhận', () => {
  /** Giá 0 biến khớp lệnh thành "mua không mất tiền" — chốt chặn quan trọng nhất của validate. */
  it.each([['0'], ['-1'], ['1.5'], ['abc'], ['']])('giá "%s" bị từ chối ở validate', async (priceVnd) => {
    const { getIssuePrice, setIssuePrice } = await services();
    const before = await getIssuePrice();

    const result = await setIssuePrice({ chain: CHAIN, priceVnd });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
    // Và KHÔNG đổi gì: cả cơ sở dữ liệu lẫn ledger.
    expect((await getIssuePrice()).priceVnd).toBe(before.priceVnd);
    expect(await (await mockLedger()).quotePurchase(1n)).toBe(BigInt(before.priceVnd));
  });

  it('lệch quá ngưỡng mà không xác nhận thì bị từ chối, hai nguồn không đổi', async () => {
    const { getIssuePrice, setIssuePrice } = await services();
    const before = await getIssuePrice();
    // Ngưỡng mặc định là hệ số 2, nên gấp 10 lần chắc chắn vượt.
    const tenfold = (BigInt(before.priceVnd) * 10n).toString();

    const result = await setIssuePrice({ chain: CHAIN, priceVnd: tenfold });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
    expect(result.error).toMatch(/ngưỡng|lệch quá/i);
    expect((await getIssuePrice()).priceVnd).toBe(before.priceVnd);
    expect(await (await mockLedger()).quotePurchase(1n)).toBe(BigInt(before.priceVnd));
  });

  it('giảm quá ngưỡng cũng bị từ chối, không chỉ tăng', async () => {
    const { getIssuePrice, setIssuePrice } = await services();
    const before = await getIssuePrice();
    const tenth = (BigInt(before.priceVnd) / 10n).toString();

    const result = await setIssuePrice({ chain: CHAIN, priceVnd: tenth });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
  });

  /**
   * Mức lệch BÌNH THƯỜNG phải đi qua được. Không có ca này thì một ngưỡng quá chặt (ví dụ đổi
   * sang phần trăm nhỏ) vẫn xanh, và nó chặn luôn việc sửa giá hợp lệ.
   */
  it('lệch trong ngưỡng thì KHÔNG cần xác nhận', async () => {
    const { setIssuePrice } = await services();
    const before = BigInt((await (await services()).getIssuePrice()).priceVnd);

    const result = await setIssuePrice({ chain: CHAIN, priceVnd: ((before * 3n) / 2n).toString() });

    expect(result.ok, result.ok ? '' : result.error).toBe(true);
  });

  it('có xác nhận thì mức lệch lớn được chấp nhận và áp xuống cả hai nguồn', async () => {
    const { getIssuePrice, setIssuePrice } = await services();
    const tenfold = (BigInt((await getIssuePrice()).priceVnd) * 10n).toString();

    const result = await setIssuePrice({
      chain: CHAIN,
      priceVnd: tenfold,
      confirmLargeChange: true,
    });

    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    expect((await getIssuePrice()).priceVnd).toBe(tenfold);
    expect(await (await mockLedger()).quotePurchase(1n)).toBe(BigInt(tenfold));
  });
});

// ===========================================================================
//  CA 3 — lệnh đã đặt giữ giá cũ sau khi đổi giá
// ===========================================================================
describe('ca 3 — lệnh đã đặt giữ nguyên số VNDB đã chốt', () => {
  /**
   * `PurchaseOrder.vndAmount` được CHỐT lúc đặt lệnh, không tính lại khi khớp: nhà đầu tư trả
   * đúng giá đã thấy lúc bấm. Đổi giá sau đó không được sửa con số đã chốt — nếu sửa thì người ta
   * bị trừ một số tiền mà họ chưa từng đồng ý.
   */
  it('đổi giá sau khi đặt lệnh KHÔNG làm đổi vndAmount của lệnh', async () => {
    const { setIssuePrice, getIssuePrice } = await services();
    const { placeOrder } = await import('@/lib/bank/purchase.service');
    const { getOrderStore } = await import('@/lib/store');
    const INVESTOR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    const SPV = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';

    const priceAtOrder = BigInt((await getIssuePrice()).priceVnd);

    // Dựng đủ điều kiện để `placeOrder` chấp nhận: nguồn cung đã phát hành, nhà đầu tư đã KYC,
    // có VNDB và đã uỷ quyền.
    const ledger = await mockLedger();
    await ledger.whitelist(SPV);
    await ledger.whitelist(INVESTOR);
    await ledger.mintInitialSupply(SPV, 1_000n);
    const { seedMockLedger } = await import('@/lib/ledger/mock.adapter');
    const cost = 10n * priceAtOrder;
    seedMockLedger({ paymentBalances: { [INVESTOR]: cost }, paymentAllowances: { [INVESTOR]: cost } });

    actAs('INVESTOR');
    const placed = await placeOrder({ chain: CHAIN, investorWallet: INVESTOR, wptAmount: '10' });
    expect(placed.ok, placed.ok ? '' : placed.error).toBe(true);
    if (!placed.ok) return;

    expect(placed.data.vndAmount).toBe((10n * priceAtOrder).toString());

    // Ngân hàng đổi giá SAU khi lệnh đã được đặt.
    actAs('BANK_ADMIN');
    const changed = await setIssuePrice({ chain: CHAIN, priceVnd: NEAR_PRICE_2 });
    expect(changed.ok, changed.ok ? '' : changed.error).toBe(true);

    // Lệnh cũ vẫn giữ đúng con số đã chốt.
    const stored = await getOrderStore().findOrder(placed.data.id);
    expect(stored?.vndAmount).toBe((10n * priceAtOrder).toString());
  });
});

// ===========================================================================
//  ĐỘT BIẾN 1 — setPurchasePrice ném lỗi thì cơ sở dữ liệu KHÔNG đổi
// ===========================================================================
describe('đột biến 1 — đẩy giá xuống ledger thất bại thì cơ sở dữ liệu không đổi', () => {
  /**
   * Đây là phép kiểm cho THỨ TỰ, không phải cho một nhánh lỗi.
   *
   * Nếu ai đổi `setIssuePrice` thành "ghi cơ sở dữ liệu trước, đẩy xuống ledger sau" thì mọi ca
   * đường thuận ở trên VẪN XANH — hai nguồn vẫn khớp khi không có lỗi. Chỉ ca này đỏ. Vì vậy nó
   * là chốt chặn duy nhất cho câu "không ghi cơ sở dữ liệu trước khi đẩy giá xuống ledger".
   */
  it('ledger từ chối thì giá trong cơ sở dữ liệu giữ nguyên và không có dòng lịch sử nào', async () => {
    const { getIssuePrice, setIssuePrice } = await services();
    const ledgerModule = await import('@/lib/ledger');
    const before = await getIssuePrice();

    // Tiêm một ledger mà `setPurchasePrice` luôn ném — mô phỏng chuỗi từ chối / mất mạng.
    const real = ledgerModule.getLedger(CHAIN);
    vi.spyOn(ledgerModule, 'getLedger').mockReturnValue({
      ...real,
      setPurchasePrice: async () => {
        throw new ledgerModule.LedgerError(CHAIN, 'setPurchasePrice', 'chuỗi từ chối đặt giá');
      },
    });

    const result = await setIssuePrice({ chain: CHAIN, priceVnd: NEAR_PRICE });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('LEDGER');

    vi.restoreAllMocks();
    // Cơ sở dữ liệu KHÔNG đổi.
    expect((await getIssuePrice()).priceVnd).toBe(before.priceVnd);
    expect(await getConfigStore().listConfigHistory({ key: CONFIG_KEYS.issuePriceVnd })).toEqual([]);
  });

  /**
   * Chiều còn lại của cùng một bất biến: ghi cơ sở dữ liệu thất bại thì giá trên ledger phải được
   * hoàn nguyên. Không có bước hoàn nguyên thì ledger bán theo giá mới trong khi mọi màn hình hiện
   * giá cũ — tệ hơn lúc chưa đổi, vì người dùng còn nhận thông báo thất bại và tin là chưa có gì
   * thay đổi.
   */
  it('ghi cơ sở dữ liệu thất bại thì giá trên ledger được đẩy về giá cũ', async () => {
    const { getIssuePrice, setIssuePrice } = await services();
    const before = await getIssuePrice();

    vi.spyOn(getConfigStore(), 'setConfig').mockRejectedValue(new Error('mất kết nối cơ sở dữ liệu'));

    const result = await setIssuePrice({ chain: CHAIN, priceVnd: NEAR_PRICE });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/hoàn nguyên/i);

    vi.restoreAllMocks();
    // Ledger đã về lại giá cũ, nên hai nguồn vẫn khớp.
    expect(await (await mockLedger()).quotePurchase(1n)).toBe(BigInt(before.priceVnd));
    expect((await getIssuePrice()).priceVnd).toBe(before.priceVnd);
  });
});

// ===========================================================================
//  ĐỘT BIẾN 2 — tắt isConfig thì bị từ chối DÙ CÓ treasury:manage
// ===========================================================================
describe('đột biến 2 — hai lớp quyền, tắt lớp nào cũng bị chặn', () => {
  it('BANK_ADMIN có treasury:manage và isConfig nên đổi được', async () => {
    const { can } = await import('@/lib/rbac');
    const { isConfigRole } = await import('@/lib/rbac/config-role');
    const { setIssuePrice } = await services();

    expect(can('BANK_ADMIN', 'treasury:manage')).toBe(true);
    expect(isConfigRole('BANK_ADMIN')).toBe(true);

    const result = await setIssuePrice({ chain: CHAIN, priceVnd: NEAR_PRICE });
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
  });

  /**
   * ĐỘT BIẾN: tắt `isConfig` của BANK_ADMIN trong khi vai đó VẪN có `treasury:manage`.
   *
   * Nếu `assertCanConfigure` chỉ gọi `assertCan(role, 'treasury:manage')` rồi bỏ lớp thứ hai thì
   * ca này xanh oan. Đây là phép kiểm duy nhất chứng minh lớp `isConfig` thật sự được hỏi.
   */
  it('tắt isConfig thì TỪ CHỐI dù vai vẫn có treasury:manage', async () => {
    const { CONFIG_ROLES, isConfigRole } = await import('@/lib/rbac/config-role');
    const { can } = await import('@/lib/rbac');
    const { getIssuePrice, setIssuePrice } = await services();
    const before = await getIssuePrice();

    /**
     * Sửa THẬT bảng dữ liệu, không dùng `vi.spyOn` trên module.
     *
     * `assertCanConfigure` gọi `isConfigRole` như một tham chiếu trong cùng module, nên vá đối
     * tượng namespace ở ngoài KHÔNG đổi được lời gọi bên trong — đã thử, ca kiểm xanh oan. Đổi
     * chính bảng `CONFIG_ROLES` mới là tắt `isConfig` thật, và nó cũng đúng nghĩa đột biến mà
     * spec yêu cầu.
     */
    CONFIG_ROLES.BANK_ADMIN = false;
    try {
      expect(isConfigRole('BANK_ADMIN')).toBe(false);
      // Quyền RBAC KHÔNG bị chạm — đó là điểm của đột biến này.
      expect(can('BANK_ADMIN', 'treasury:manage')).toBe(true);

      const result = await setIssuePrice({ chain: CHAIN, priceVnd: NEAR_PRICE });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe('FORBIDDEN');
      expect(result.error).toMatch(/isConfig/);

      // Không đổi gì ở cả hai nguồn.
      expect((await getIssuePrice()).priceVnd).toBe(before.priceVnd);
      expect(await (await mockLedger()).quotePurchase(1n)).toBe(BigInt(before.priceVnd));
    } finally {
      // `finally` chứ không đặt ở cuối thân hàm: ca kiểm trượt giữa đường vẫn phải trả bảng về
      // nguyên trạng, nếu không thì mọi ca sau đỏ theo và triệu chứng che mất lỗi thật.
      CONFIG_ROLES.BANK_ADMIN = true;
    }
  });

  it.each([['COMPLIANCE'], ['INVESTOR'], ['AUDITOR']])(
    'vai %s bị từ chối và lần bị chặn được ghi vào sổ kiểm toán',
    async (role) => {
      const { setIssuePrice } = await services();
      actAs(role);

      const result = await setIssuePrice({ chain: CHAIN, priceVnd: NEAR_PRICE });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe('FORBIDDEN');

      const audit = await getStore().listAudit({ limit: 10 });
      const denied = audit.find(
        (entry) => entry.action === 'treasury:manage' && entry.outcome === 'DENIED',
      );
      expect(denied, 'phải có bản ghi DENIED để kênh (audit) thấy được').toBeDefined();
      expect(denied?.actorRole).toBe(role);
    },
  );

  it('lần đổi giá thành công được ghi vào sổ kiểm toán kèm giá cũ và giá mới', async () => {
    const { setIssuePrice } = await services();

    await setIssuePrice({ chain: CHAIN, priceVnd: NEAR_PRICE });

    const audit = await getStore().listAudit({ limit: 10 });
    const success = audit.find(
      (entry) => entry.action === 'treasury:manage' && entry.outcome === 'SUCCESS',
    );
    expect(success?.detail).toContain(NEAR_PRICE);
    expect(success?.detail).toContain(String(WPT_ISSUE_PRICE_VND));
  });
});

// ===========================================================================
//  Nạp giá vào ledger mô phỏng sau khi tiến trình khởi động lại
// ===========================================================================
describe('ledger mô phỏng nạp giá từ cấu hình', () => {
  /**
   * State của mock nằm trên `globalThis` nên mất khi tiến trình khởi động lại, còn giá đã cấu
   * hình thì nằm trong cơ sở dữ liệu và vẫn còn. Không nạp lại thì sau restart, mock khớp lệnh
   * theo GIÁ MẶC ĐỊNH trong khi màn hình hiện giá đã cấu hình — cùng một lỗi lệch giá, chỉ khác
   * là nó chỉ xuất hiện sau khi khởi động lại nên càng khó lần.
   */
  it('mất state của mock nhưng giá vẫn theo cấu hình đã lưu', async () => {
    const { setIssuePrice, getIssuePrice } = await services();

    await setIssuePrice({ chain: CHAIN, priceVnd: NEAR_PRICE_2 });

    // Mô phỏng khởi động lại: xoá state của mock, GIỮ cơ sở dữ liệu.
    resetMockLedger();

    expect(await (await mockLedger()).quotePurchase(1n)).toBe(BigInt(NEAR_PRICE_2));
    expect((await getIssuePrice()).priceVnd).toBe(NEAR_PRICE_2);
  });

  /**
   * Dữ liệu khởi tạo nạp sẵn dòng giá, nên trạng thái sạch là `configured: true` với giá bằng
   * mặc định trong mã. Đó là điều đúng để khẳng định: `configured` phân biệt "có dòng trong bảng"
   * với "không có dòng", chứ không phân biệt "đã đổi giá" với "chưa đổi".
   */
  it('trạng thái khởi tạo: có dòng cấu hình, giá bằng mặc định trong mã', async () => {
    const { getIssuePrice } = await services();

    const view = await getIssuePrice();
    expect(view.configured).toBe(true);
    expect(view.priceVnd).toBe(String(WPT_ISSUE_PRICE_VND));
    expect(await (await mockLedger()).quotePurchase(1n)).toBe(BigInt(WPT_ISSUE_PRICE_VND));
  });

  /**
   * Nhánh LÙI VỀ MẶC ĐỊNH, kiểm riêng vì dữ liệu khởi tạo luôn nạp dòng giá nên đường thuận không
   * bao giờ chạy qua nhánh này. Nó vẫn phải đúng: một cơ sở dữ liệu dựng TRƯỚC BE-04 không có
   * dòng nào, và lúc đó giá hiển thị phải là mặc định trong mã, không phải 0 hay lỗi.
   */
  it('bảng trống thì lùi về mặc định trong mã, cờ configured tắt', async () => {
    const { getIssuePrice } = await services();
    vi.spyOn(getConfigStore(), 'getConfig').mockResolvedValue(null);

    const view = await getIssuePrice();

    expect(view.configured).toBe(false);
    expect(view.priceVnd).toBe(String(WPT_ISSUE_PRICE_VND));
    expect(view.updatedBy).toBeNull();
    expect(view.updatedAt).toBeNull();
  });
});
