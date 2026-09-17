import { beforeEach, describe, expect, it } from 'vitest';
import { LedgerError } from '@/lib/ledger/ledger.port';
import { createMockLedger, resetMockLedger, seedMockLedger } from '@/lib/ledger/mock.adapter';
import { InvalidAddressError } from '@/lib/ledger/address';

/**
 * Mock ledger phải NGHIÊM NGẶT NGANG contract thật.
 *
 * Nếu mock dễ tính hơn `ProjectToken._update`, demo sẽ "xanh ở mock, đỏ ở chain thật" —
 * đúng loại lỗi mà mock phải ngăn, không phải tạo ra.
 */

const INVESTOR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const OTHER = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const RECOVERY = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';

describe('mock ledger', () => {
  beforeEach(() => resetMockLedger());

  it('mint cho ví đã whitelist làm tăng số dư và tổng cung', async () => {
    const ledger = createMockLedger();
    await ledger.whitelist(INVESTOR);

    const result = await ledger.mint(INVESTOR, 100n);
    expect(result.status).toBe('CONFIRMED');
    expect(await ledger.balanceOf(INVESTOR)).toBe(100n);
    expect((await ledger.tokenInfo()).totalSupply).toBe(100n);
  });

  it('CHẶN mint cho ví chưa whitelist (giống require "phat hanh cho vi chua KYC")', async () => {
    const ledger = createMockLedger();
    await expect(ledger.mint(INVESTOR, 100n)).rejects.toThrow(LedgerError);
    expect(await ledger.balanceOf(INVESTOR)).toBe(0n);
  });

  it('CHẶN mint số lượng <= 0', async () => {
    const ledger = createMockLedger();
    await ledger.whitelist(INVESTOR);
    await expect(ledger.mint(INVESTOR, 0n)).rejects.toThrow(/lớn hơn 0/);
    await expect(ledger.mint(INVESTOR, -5n)).rejects.toThrow(/lớn hơn 0/);
  });

  it('CHẶN mint cho ví bị đóng băng', async () => {
    const ledger = createMockLedger();
    await ledger.whitelist(INVESTOR);
    await ledger.freeze(INVESTOR, true);
    await expect(ledger.mint(INVESTOR, 10n)).rejects.toThrow(/đóng băng/);
  });

  it('transfer đòi cả hai đầu đã whitelist và không bị băng', async () => {
    const ledger = createMockLedger();
    await ledger.whitelist(INVESTOR);
    await ledger.mint(INVESTOR, 50n);

    await expect(ledger.transfer(INVESTOR, OTHER, 10n)).rejects.toThrow(/chưa KYC/);

    await ledger.whitelist(OTHER);
    await ledger.transfer(INVESTOR, OTHER, 10n);
    expect(await ledger.balanceOf(INVESTOR)).toBe(40n);
    expect(await ledger.balanceOf(OTHER)).toBe(10n);

    await ledger.freeze(OTHER, true);
    await expect(ledger.transfer(INVESTOR, OTHER, 5n)).rejects.toThrow(/đóng băng/);
  });

  it('forcedTransfer bỏ qua trạng thái băng của bên gửi nhưng bên nhận vẫn phải KYC', async () => {
    const ledger = createMockLedger();
    await ledger.whitelist(INVESTOR);
    await ledger.mint(INVESTOR, 30n);
    await ledger.freeze(INVESTOR, true);

    // Bên nhận chưa KYC -> vẫn chặn, giống require trong forcedTransfer().
    await expect(ledger.forcedTransfer(INVESTOR, RECOVERY, 30n)).rejects.toThrow(/chưa KYC/);

    await ledger.whitelist(RECOVERY);
    await ledger.forcedTransfer(INVESTOR, RECOVERY, 30n);
    expect(await ledger.balanceOf(INVESTOR)).toBe(0n);
    expect(await ledger.balanceOf(RECOVERY)).toBe(30n);
  });

  it('không đốt quá số dư', async () => {
    const ledger = createMockLedger();
    await ledger.whitelist(INVESTOR);
    await ledger.mint(INVESTOR, 10n);
    await expect(ledger.burn(INVESTOR, 11n)).rejects.toThrow(/không đủ/);
  });

  it('địa chỉ sai định dạng bị chặn ngay, không âm thầm tạo ví mới', async () => {
    const ledger = createMockLedger();
    await expect(ledger.balanceOf('khong-phai-vi')).rejects.toThrow(InvalidAddressError);
    await expect(ledger.whitelist('0x123')).rejects.toThrow(InvalidAddressError);
  });

  it('địa chỉ khác hoa/thường vẫn là cùng một ví', async () => {
    const ledger = createMockLedger();
    await ledger.whitelist(INVESTOR.toLowerCase());
    await ledger.mint(INVESTOR.toUpperCase().replace('0X', '0x'), 7n);
    expect(await ledger.balanceOf(INVESTOR)).toBe(7n);
  });
});

describe('chuẩn hoá địa chỉ theo EIP-55', () => {
  beforeEach(() => resetMockLedger());

  it('nhận dạng toàn chữ thường và toàn chữ HOA (không mang checksum)', async () => {
    const ledger = createMockLedger();
    await ledger.whitelist(INVESTOR.toLowerCase());
    await ledger.mint(`0x${INVESTOR.slice(2).toUpperCase()}`, 7n);
    expect(await ledger.balanceOf(INVESTOR)).toBe(7n);
  });

  it('từ chối địa chỉ hoa-thường lẫn lộn có checksum sai (bắt lỗi gõ/copy)', async () => {
    const ledger = createMockLedger();
    // Đổi 1 ký tự sang chữ hoa -> checksum EIP-55 không còn khớp.
    const broken = `0x70997970c51812DC3A010C7d01b50e0d17dc79C8`;
    await expect(ledger.whitelist(broken)).rejects.toThrow(/Checksum EIP-55/);
  });
});

// =============================================================================
//  BA LUỒNG MỚI (BE-01) — mỗi describe dưới đây phủ một nhóm ràng buộc ở
//  docs/be-01-ledger-port/design.md mục 3. Mock dễ tính hơn contract thật là lỗi,
//  nên mỗi ca TỪ CHỐI đều kiểm luôn "trạng thái không đổi", không chỉ kiểm có ném lỗi.
// =============================================================================

/** Ví thanh toán SPV — giữ WPT chưa bán, nhận VNDB khi khớp lệnh. */
const SPV = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
const PRICE = 100_000n; // giá mặc định của mock: 1 WPT = 100.000 VNDB

/** Dựng sẵn: SPV + nhà đầu tư đã KYC, nguồn cung đã phát hành vào ví SPV. */
async function issuedLedger(supply = 1_000n) {
  const ledger = createMockLedger();
  await ledger.whitelist(SPV);
  await ledger.whitelist(INVESTOR);
  await ledger.mintInitialSupply(SPV, supply);
  return ledger;
}

describe('R1 — phát hành một lần vào ví thanh toán SPV', () => {
  beforeEach(() => resetMockLedger());

  it('phát hành toàn bộ nguồn cung vào ví SPV và ghi nhận đã phát hành', async () => {
    const ledger = createMockLedger();
    expect(await ledger.isInitialSupplyMinted()).toBe(false);

    await ledger.whitelist(SPV);
    await ledger.mintInitialSupply(SPV, 1_000n);

    expect(await ledger.isInitialSupplyMinted()).toBe(true);
    expect(await ledger.balanceOf(SPV)).toBe(1_000n);
    expect((await ledger.tokenInfo()).totalSupply).toBe(1_000n);
  });

  // design mục 3, dòng "Phát hành lần hai"
  it('CHẶN phát hành lần hai và không làm phình tổng cung', async () => {
    const ledger = await issuedLedger(1_000n);

    await expect(ledger.mintInitialSupply(SPV, 1n)).rejects.toThrow(/đã được phát hành/);
    expect((await ledger.tokenInfo()).totalSupply).toBe(1_000n);
    expect(await ledger.balanceOf(SPV)).toBe(1_000n);
  });

  // design mục 3, dòng "Số lượng bằng 0 hoặc âm"
  it('CHẶN phát hành số lượng <= 0 và không đánh dấu đã phát hành', async () => {
    const ledger = createMockLedger();
    await ledger.whitelist(SPV);

    await expect(ledger.mintInitialSupply(SPV, 0n)).rejects.toThrow(/lớn hơn 0/);
    await expect(ledger.mintInitialSupply(SPV, -1n)).rejects.toThrow(/lớn hơn 0/);
    expect(await ledger.isInitialSupplyMinted()).toBe(false);
  });

  it('CHẶN phát hành vào ví chưa KYC', async () => {
    const ledger = createMockLedger();
    await expect(ledger.mintInitialSupply(SPV, 1_000n)).rejects.toThrow(/chưa KYC/);
    expect(await ledger.isInitialSupplyMinted()).toBe(false);
  });

  // spvWallet() thêm ở BE-02: không có nó thì tầng nghiệp vụ không lấy được địa chỉ để
  // kiểm "ví SPV còn đủ WPT" trước khi gửi giao dịch (BE-02 QĐ-2, phép kiểm thứ 3).
  it('spvWallet trả null khi chưa phát hành, trả đúng ví sau khi phát hành', async () => {
    const ledger = createMockLedger();
    // `null` là câu trả lời có nghĩa ("chưa phát hành"), không phải lỗi.
    expect(await ledger.spvWallet()).toBeNull();

    await ledger.whitelist(SPV);
    await ledger.mintInitialSupply(SPV, 1_000n);

    expect(await ledger.spvWallet()).toBe(SPV);
    // Địa chỉ trả về phải dùng được ngay làm tham số đọc số dư — đó là mục đích duy nhất.
    expect(await ledger.balanceOf((await ledger.spvWallet()) as string)).toBe(1_000n);
  });
});

describe('R2 — khớp lệnh mua', () => {
  beforeEach(() => resetMockLedger());

  it('báo giá chỉ nhân số lượng với giá bán, không gọi nguồn tỷ giá nào', async () => {
    const ledger = createMockLedger();
    expect(await ledger.quotePurchase(1n)).toBe(PRICE);
    expect(await ledger.quotePurchase(7n)).toBe(7n * PRICE);
    await expect(ledger.quotePurchase(0n)).rejects.toThrow(/lớn hơn 0/);
  });

  it('khớp lệnh chuyển VNDB và WPT trong cùng một lần gọi', async () => {
    const ledger = await issuedLedger(1_000n);
    const cost = 10n * PRICE;
    seedMockLedger({
      paymentBalances: { [INVESTOR]: cost },
      paymentAllowances: { [INVESTOR]: cost },
    });

    await ledger.executePurchase(INVESTOR, 10n);

    expect(await ledger.balanceOf(INVESTOR)).toBe(10n);
    expect(await ledger.balanceOf(SPV)).toBe(990n);
    expect(await ledger.paymentBalanceOf(INVESTOR)).toBe(0n);
    expect(await ledger.paymentBalanceOf(SPV)).toBe(cost);
    expect(await ledger.paymentAllowanceOf(INVESTOR)).toBe(0n);
    // Khớp lệnh KHÔNG phát hành thêm: tổng cung giữ nguyên.
    expect((await ledger.tokenInfo()).totalSupply).toBe(1_000n);
  });

  // design mục 3, dòng "Khớp lệnh khi nhà đầu tư thiếu VNDB"
  it('CHẶN khớp lệnh khi nhà đầu tư thiếu VNDB, và KHÔNG chuyển WPT', async () => {
    const ledger = await issuedLedger(1_000n);
    const cost = 10n * PRICE;
    seedMockLedger({
      paymentBalances: { [INVESTOR]: cost - 1n }, // thiếu đúng 1 đồng
      paymentAllowances: { [INVESTOR]: cost },
    });

    await expect(ledger.executePurchase(INVESTOR, 10n)).rejects.toThrow(/Số dư VNDB không đủ/);
    expect(await ledger.balanceOf(INVESTOR)).toBe(0n);
    expect(await ledger.balanceOf(SPV)).toBe(1_000n);
    expect(await ledger.paymentBalanceOf(INVESTOR)).toBe(cost - 1n);
  });

  // design mục 3, dòng "Khớp lệnh khi thiếu ủy quyền"
  it('CHẶN khớp lệnh khi thiếu ủy quyền VNDB dù số dư đủ', async () => {
    const ledger = await issuedLedger(1_000n);
    const cost = 10n * PRICE;
    seedMockLedger({
      paymentBalances: { [INVESTOR]: cost },
      paymentAllowances: { [INVESTOR]: cost - 1n },
    });

    await expect(ledger.executePurchase(INVESTOR, 10n)).rejects.toThrow(/Ủy quyền VNDB không đủ/);
    expect(await ledger.balanceOf(INVESTOR)).toBe(0n);
    expect(await ledger.paymentBalanceOf(INVESTOR)).toBe(cost);
  });

  // design mục 3, dòng "Khớp lệnh khi ví thanh toán SPV thiếu WPT"
  it('CHẶN khớp lệnh khi ví SPV thiếu WPT, và KHÔNG trừ VNDB', async () => {
    const ledger = await issuedLedger(5n); // nguồn cung chỉ 5 WPT
    const cost = 10n * PRICE;
    seedMockLedger({
      paymentBalances: { [INVESTOR]: cost },
      paymentAllowances: { [INVESTOR]: cost },
    });

    await expect(ledger.executePurchase(INVESTOR, 10n)).rejects.toThrow(/SPV không đủ WPT/);
    expect(await ledger.paymentBalanceOf(INVESTOR)).toBe(cost);
    expect(await ledger.paymentAllowanceOf(INVESTOR)).toBe(cost);
    expect(await ledger.balanceOf(SPV)).toBe(5n);
    expect(await ledger.balanceOf(INVESTOR)).toBe(0n);
  });

  // tasks mục 4.2 — kiểm riêng: thất bại thì KHÔNG bên nào đổi số dư
  it('khớp lệnh thất bại thì KHÔNG bên nào đổi số dư (WPT lẫn VNDB)', async () => {
    const ledger = await issuedLedger(1_000n);
    seedMockLedger({ paymentBalances: { [INVESTOR]: 1n }, paymentAllowances: { [INVESTOR]: 1n } });

    const before = {
      wptInvestor: await ledger.balanceOf(INVESTOR),
      wptSpv: await ledger.balanceOf(SPV),
      vndInvestor: await ledger.paymentBalanceOf(INVESTOR),
      vndSpv: await ledger.paymentBalanceOf(SPV),
      allowance: await ledger.paymentAllowanceOf(INVESTOR),
      totalSupply: (await ledger.tokenInfo()).totalSupply,
    };

    await expect(ledger.executePurchase(INVESTOR, 10n)).rejects.toThrow(LedgerError);

    expect({
      wptInvestor: await ledger.balanceOf(INVESTOR),
      wptSpv: await ledger.balanceOf(SPV),
      vndInvestor: await ledger.paymentBalanceOf(INVESTOR),
      vndSpv: await ledger.paymentBalanceOf(SPV),
      allowance: await ledger.paymentAllowanceOf(INVESTOR),
      totalSupply: (await ledger.tokenInfo()).totalSupply,
    }).toEqual(before);
  });

  it('CHẶN khớp lệnh khi chưa phát hành nguồn cung', async () => {
    const ledger = createMockLedger();
    await ledger.whitelist(INVESTOR);
    seedMockLedger({ paymentBalances: { [INVESTOR]: 10n * PRICE }, paymentAllowances: { [INVESTOR]: 10n * PRICE } });

    await expect(ledger.executePurchase(INVESTOR, 10n)).rejects.toThrow(/Chưa phát hành nguồn cung/);
  });

  it('CHẶN khớp lệnh cho ví chưa KYC hoặc đang bị băng', async () => {
    const ledger = await issuedLedger(1_000n);
    const cost = 10n * PRICE;
    seedMockLedger({
      paymentBalances: { [INVESTOR]: cost, [OTHER]: cost },
      paymentAllowances: { [INVESTOR]: cost, [OTHER]: cost },
    });

    await expect(ledger.executePurchase(OTHER, 10n)).rejects.toThrow(/chưa KYC/);

    await ledger.freeze(INVESTOR, true);
    await expect(ledger.executePurchase(INVESTOR, 10n)).rejects.toThrow(/đóng băng/);
    expect(await ledger.balanceOf(SPV)).toBe(1_000n);
  });

  it('CHẶN khớp lệnh số lượng <= 0', async () => {
    const ledger = await issuedLedger(1_000n);
    await expect(ledger.executePurchase(INVESTOR, 0n)).rejects.toThrow(/lớn hơn 0/);
  });
});

describe('R3 — canTransfer: kiểm trước, có lý do đọc được', () => {
  beforeEach(() => resetMockLedger());

  it('cho phép khi cả hai đầu đã KYC, không băng, đủ số dư', async () => {
    const ledger = createMockLedger();
    await ledger.whitelist(INVESTOR);
    await ledger.whitelist(OTHER);
    await ledger.mint(INVESTOR, 10n);

    expect(await ledger.canTransfer(INVESTOR, OTHER, 10n)).toEqual({ allowed: true });
  });

  it('trả lý do tiếng Việt cho từng nguyên nhân từ chối, không phải mã lỗi thô', async () => {
    const ledger = createMockLedger();
    await ledger.whitelist(INVESTOR);
    await ledger.mint(INVESTOR, 10n);

    // Bên nhận chưa KYC
    let check = await ledger.canTransfer(INVESTOR, OTHER, 5n);
    expect(check).toMatchObject({ allowed: false });
    expect(check.allowed === false && check.reason).toMatch(/Bên nhận chưa KYC/);

    // Thiếu số dư
    await ledger.whitelist(OTHER);
    check = await ledger.canTransfer(INVESTOR, OTHER, 11n);
    expect(check.allowed === false && check.reason).toMatch(/Số dư WPT không đủ/);

    // Bên nhận bị băng
    await ledger.freeze(OTHER, true);
    check = await ledger.canTransfer(INVESTOR, OTHER, 5n);
    expect(check.allowed === false && check.reason).toMatch(/Bên nhận đang bị đóng băng/);
  });

  it('KHÔNG đổi trạng thái: gọi canTransfer nhiều lần số dư giữ nguyên', async () => {
    const ledger = createMockLedger();
    await ledger.whitelist(INVESTOR);
    await ledger.whitelist(OTHER);
    await ledger.mint(INVESTOR, 10n);

    await ledger.canTransfer(INVESTOR, OTHER, 10n);
    await ledger.canTransfer(INVESTOR, OTHER, 10n);

    expect(await ledger.balanceOf(INVESTOR)).toBe(10n);
    expect(await ledger.balanceOf(OTHER)).toBe(0n);
  });

  it('lý do của canTransfer khớp với lý do transfer thật sự từ chối', async () => {
    const ledger = createMockLedger();
    await ledger.whitelist(INVESTOR);
    await ledger.mint(INVESTOR, 10n);

    const check = await ledger.canTransfer(INVESTOR, OTHER, 5n);
    expect(check.allowed).toBe(false);
    // canTransfer nói "bên nhận chưa KYC" thì transfer cũng phải chết vì đúng lý do đó.
    await expect(ledger.transfer(INVESTOR, OTHER, 5n)).rejects.toThrow(/Bên nhận chưa KYC/);
  });

  it('CHẶN kiểm với số lượng <= 0', async () => {
    const ledger = createMockLedger();
    await expect(ledger.canTransfer(INVESTOR, OTHER, 0n)).rejects.toThrow(/lớn hơn 0/);
  });
});

describe('R4 — chốt quyền và đọc số dư theo thời điểm', () => {
  beforeEach(() => resetMockLedger());

  it('mã snapshot đầu tiên là 1 và tăng dần', async () => {
    const ledger = createMockLedger();
    expect((await ledger.takeSnapshot()).snapshotId).toBe(1);
    expect((await ledger.takeSnapshot()).snapshotId).toBe(2);
  });

  it('takeSnapshot trả về cả biên nhận giao dịch và mã snapshot', async () => {
    const ledger = createMockLedger();
    const { tx, snapshotId } = await ledger.takeSnapshot();
    expect(tx.status).toBe('CONFIRMED');
    expect(tx.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(snapshotId).toBe(1);
  });

  it('balanceOfAt và totalSupplyAt đọc từ ảnh chụp, không phải số dư hiện thời', async () => {
    const ledger = createMockLedger();
    await ledger.whitelist(INVESTOR);
    await ledger.mint(INVESTOR, 100n);

    const { snapshotId } = await ledger.takeSnapshot();
    await ledger.mint(INVESTOR, 50n); // biến động SAU thời điểm chốt

    expect(await ledger.balanceOfAt(INVESTOR, snapshotId)).toBe(100n);
    expect(await ledger.totalSupplyAt(snapshotId)).toBe(100n);
    expect(await ledger.balanceOf(INVESTOR)).toBe(150n);
  });

  // tasks mục 4.3 — kiểm riêng: mua WPT sau khi chốt quyền không làm đổi ảnh chụp cũ
  it('mua WPT sau khi chốt quyền thì balanceOfAt ở mã snapshot cũ KHÔNG đổi', async () => {
    const ledger = await issuedLedger(1_000n);
    const cost = 10n * PRICE;
    seedMockLedger({ paymentBalances: { [INVESTOR]: cost }, paymentAllowances: { [INVESTOR]: cost } });

    const { snapshotId } = await ledger.takeSnapshot();
    expect(await ledger.balanceOfAt(INVESTOR, snapshotId)).toBe(0n);
    expect(await ledger.balanceOfAt(SPV, snapshotId)).toBe(1_000n);

    await ledger.executePurchase(INVESTOR, 10n);

    // Số dư hiện thời đổi...
    expect(await ledger.balanceOf(INVESTOR)).toBe(10n);
    // ...nhưng ảnh chụp cũ thì không.
    expect(await ledger.balanceOfAt(INVESTOR, snapshotId)).toBe(0n);
    expect(await ledger.balanceOfAt(SPV, snapshotId)).toBe(1_000n);
    expect(await ledger.totalSupplyAt(snapshotId)).toBe(1_000n);
  });

  // design mục 3, dòng "Đọc số dư tại mã snapshot không tồn tại"
  it('CHẶN đọc tại mã snapshot không tồn tại, lý do nêu mã hợp lệ hiện có', async () => {
    const ledger = createMockLedger();

    // Chưa chốt lần nào -> hướng người gọi đi gọi takeSnapshot.
    await expect(ledger.balanceOfAt(INVESTOR, 1)).rejects.toThrow(/Chưa chốt quyền lần nào/);

    await ledger.takeSnapshot();
    await expect(ledger.balanceOfAt(INVESTOR, 9)).rejects.toThrow(/Mã hợp lệ hiện có: 1\.\.1/);
    await expect(ledger.totalSupplyAt(9)).rejects.toThrow(/Mã hợp lệ hiện có: 1\.\.1/);
  });

  it('CHẶN mã snapshot 0, âm hoặc không phải số nguyên (giống require của contract)', async () => {
    const ledger = createMockLedger();
    await ledger.takeSnapshot();

    await expect(ledger.balanceOfAt(INVESTOR, 0)).rejects.toThrow(/số nguyên dương/);
    await expect(ledger.balanceOfAt(INVESTOR, -1)).rejects.toThrow(/số nguyên dương/);
    await expect(ledger.totalSupplyAt(1.5)).rejects.toThrow(/số nguyên dương/);
  });
});

describe('R5 — chia lợi nhuận theo lô', () => {
  beforeEach(() => resetMockLedger());

  /** SPV giữ 700, hai nhà đầu tư giữ 200 và 100; quỹ lợi nhuận 1.000.000 VNDB. */
  async function fundedLedger() {
    const ledger = await issuedLedger(1_000n);
    await ledger.whitelist(OTHER);
    await ledger.transfer(SPV, INVESTOR, 200n);
    await ledger.transfer(SPV, OTHER, 100n);
    seedMockLedger({ profitPool: 1_000_000n });
    return ledger;
  }

  it('chia theo tỉ lệ nắm giữ tại snapshot và trừ đúng quỹ', async () => {
    const ledger = await fundedLedger();
    const { snapshotId } = await ledger.takeSnapshot();

    await ledger.distributeBatch(snapshotId, [INVESTOR, OTHER]);

    // 1.000.000 * 200/1000 = 200.000 ; * 100/1000 = 100.000
    expect(await ledger.paymentBalanceOf(INVESTOR)).toBe(200_000n);
    expect(await ledger.paymentBalanceOf(OTHER)).toBe(100_000n);
    expect(await ledger.profitPoolBalance()).toBe(700_000n);
  });

  it('chia nhiều lô cho ra cùng kết quả như chia một lô (kích thước lô do nghiệp vụ)', async () => {
    const ledger = await fundedLedger();
    const { snapshotId } = await ledger.takeSnapshot();

    await ledger.distributeBatch(snapshotId, [INVESTOR]);
    await ledger.distributeBatch(snapshotId, [OTHER]);

    expect(await ledger.paymentBalanceOf(INVESTOR)).toBe(200_000n);
    expect(await ledger.paymentBalanceOf(OTHER)).toBe(100_000n);
    expect(await ledger.profitPoolBalance()).toBe(700_000n);
  });

  it('ví đã nhận trong kỳ thì không nhận lần hai, kể cả trùng trong cùng một lô', async () => {
    const ledger = await fundedLedger();
    const { snapshotId } = await ledger.takeSnapshot();

    await ledger.distributeBatch(snapshotId, [INVESTOR, INVESTOR]); // trùng trong lô
    expect(await ledger.paymentBalanceOf(INVESTOR)).toBe(200_000n);

    await ledger.distributeBatch(snapshotId, [INVESTOR]); // chia lại lần hai
    expect(await ledger.paymentBalanceOf(INVESTOR)).toBe(200_000n);
    expect(await ledger.profitPoolBalance()).toBe(800_000n);
  });

  // design mục 3, dòng "Chia khi ví lợi nhuận thiếu tiền"
  it('CHẶN chia khi quỹ thiếu tiền, TRƯỚC khi chuyển cho bất kỳ ai', async () => {
    const ledger = await fundedLedger();
    const { snapshotId } = await ledger.takeSnapshot();

    // Rút quỹ xuống dưới mức phải trả cho lô. Ở chain thật tương đương số dư VNDB
    // của hợp đồng chia bị hụt (đã sweepDust/withdraw, hoặc nạp thiếu).
    seedMockLedger({ profitPool: 1_000n });

    await expect(ledger.distributeBatch(snapshotId, [INVESTOR, OTHER])).rejects.toThrow(
      /không đủ tiền: cần 300000 VNDB cho lô này, chỉ có 1000/,
    );
    // KHÔNG ai nhận được đồng nào, quỹ cũng không bị trừ.
    expect(await ledger.paymentBalanceOf(INVESTOR)).toBe(0n);
    expect(await ledger.paymentBalanceOf(OTHER)).toBe(0n);
    expect(await ledger.profitPoolBalance()).toBe(1_000n);
  });

  it('CHẶN chia ở mã snapshot không tồn tại', async () => {
    const ledger = await fundedLedger();
    await expect(ledger.distributeBatch(7, [INVESTOR])).rejects.toThrow(/không tồn tại|Chưa chốt/);
  });

  it('CHẶN chia khi tổng cung tại snapshot bằng 0', async () => {
    const ledger = createMockLedger();
    seedMockLedger({ profitPool: 1_000n });
    const { snapshotId } = await ledger.takeSnapshot();

    await expect(ledger.distributeBatch(snapshotId, [INVESTOR])).rejects.toThrow(/bằng 0/);
  });

  it('CHẶN chia với danh sách ví trống', async () => {
    const ledger = await fundedLedger();
    const { snapshotId } = await ledger.takeSnapshot();
    await expect(ledger.distributeBatch(snapshotId, [])).rejects.toThrow(/trống/);
  });

  it('quỹ chia của kỳ chốt tại snapshot nên nạp thêm sau đó không đổi phần được chia', async () => {
    const ledger = await fundedLedger();
    const { snapshotId } = await ledger.takeSnapshot();

    seedMockLedger({ profitPool: 5_000_000n }); // nạp thêm SAU khi chốt
    await ledger.distributeBatch(snapshotId, [INVESTOR]);

    // Vẫn là 1.000.000 * 200/1000, không phải 5.000.000 * 200/1000.
    expect(await ledger.paymentBalanceOf(INVESTOR)).toBe(200_000n);
  });
});

describe('R6 — tất toán', () => {
  beforeEach(() => resetMockLedger());

  it('bật/tắt và đọc lại được trạng thái tất toán', async () => {
    const ledger = createMockLedger();
    expect(await ledger.isSettlementMode()).toBe(false);

    await ledger.setSettlementMode(true);
    expect(await ledger.isSettlementMode()).toBe(true);

    await ledger.setSettlementMode(false);
    expect(await ledger.isSettlementMode()).toBe(false);
  });

  it('đặt và đọc giá NAV, chặn giá <= 0', async () => {
    const ledger = createMockLedger();
    await ledger.setNavRate(123_456n);
    expect(await ledger.navRate()).toBe(123_456n);

    await expect(ledger.setNavRate(0n)).rejects.toThrow(/lớn hơn 0/);
    expect(await ledger.navRate()).toBe(123_456n); // không bị ghi đè bởi lần gọi lỗi
  });

  // design mục 3, hai dòng "Chuyển nhượng khi đang tất toán" + "Đốt khi đang tất toán"
  // (tasks mục 4.4 — kiểm riêng)
  it('đang tất toán thì chuyển nhượng bị chặn, đốt vẫn chạy', async () => {
    const ledger = createMockLedger();
    await ledger.whitelist(INVESTOR);
    await ledger.whitelist(OTHER);
    await ledger.mint(INVESTOR, 100n);

    await ledger.setSettlementMode(true);

    await expect(ledger.transfer(INVESTOR, OTHER, 10n)).rejects.toThrow(/tất toán/);
    expect(await ledger.balanceOf(INVESTOR)).toBe(100n);
    expect(await ledger.balanceOf(OTHER)).toBe(0n);

    // Đốt là chính việc phải làm khi tất toán -> phải chạy được.
    await ledger.burn(INVESTOR, 40n);
    expect(await ledger.balanceOf(INVESTOR)).toBe(60n);
    expect((await ledger.tokenInfo()).totalSupply).toBe(60n);
  });

  it('đang tất toán thì canTransfer trả lý do tất toán, và khớp lệnh bị chặn', async () => {
    const ledger = await issuedLedger(1_000n);
    const cost = 10n * PRICE;
    seedMockLedger({ paymentBalances: { [INVESTOR]: cost }, paymentAllowances: { [INVESTOR]: cost } });
    await ledger.setSettlementMode(true);

    const check = await ledger.canTransfer(SPV, INVESTOR, 10n);
    expect(check.allowed === false && check.reason).toMatch(/tất toán/);
    await expect(ledger.executePurchase(INVESTOR, 10n)).rejects.toThrow(/tất toán/);
    expect(await ledger.balanceOf(SPV)).toBe(1_000n);
  });

  it('tắt tất toán thì chuyển nhượng chạy lại bình thường', async () => {
    const ledger = createMockLedger();
    await ledger.whitelist(INVESTOR);
    await ledger.whitelist(OTHER);
    await ledger.mint(INVESTOR, 100n);

    await ledger.setSettlementMode(true);
    await expect(ledger.transfer(INVESTOR, OTHER, 10n)).rejects.toThrow(/tất toán/);

    await ledger.setSettlementMode(false);
    await ledger.transfer(INVESTOR, OTHER, 10n);
    expect(await ledger.balanceOf(OTHER)).toBe(10n);
  });
});
