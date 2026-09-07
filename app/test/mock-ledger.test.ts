import { beforeEach, describe, expect, it } from 'vitest';
import { LedgerError } from '@/lib/ledger/ledger.port';
import { createMockLedger, resetMockLedger } from '@/lib/ledger/mock.adapter';
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
