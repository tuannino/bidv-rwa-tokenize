import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetServerEnvCache } from '@/lib/config/env';
import { resetMockLedger } from '@/lib/ledger/mock.adapter';
import { getStore, resetMemoryStore, resetStoreCache } from '@/lib/store';
import { getPortfolio, getWalletTransactions } from '@/lib/bank/portfolio.service';
import { WPT_ISSUE_PRICE_VND } from '@/lib/bank/issuance';

/**
 * Vị thế nhà đầu tư: kiểm hai thứ dễ sai nhất và đắt nhất nếu sai.
 *
 * 1. Cổng quyền `portfolio:read` — nếu hở thì cán bộ ngân hàng xem được màn nhà đầu tư.
 * 2. Lọc theo ví — nếu hở thì nhà đầu tư A thấy giao dịch của nhà đầu tư B. Đây là rò dữ liệu,
 *    không phải lỗi hiển thị.
 *
 * Vai điều khiển qua `DEMO_ROLE`: ngoài request scope `cookies()` ném lỗi, `currentRole()` bắt
 * lỗi đó rồi lùi về env — nên test đặt được vai mà không cần dựng request giả.
 */

const ALICE = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const BOB = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

/** `mock` để không cần RPC; adapter mock nghiêm ngặt ngang contract thật. */
const CHAIN = 'mock';

function actAs(role: string) {
  process.env.DEMO_ROLE = role;
  resetServerEnvCache();
}

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
  resetServerEnvCache();
  resetStoreCache();
});

describe('getPortfolio — cổng quyền', () => {
  it('INVESTOR đọc được vị thế của mình', async () => {
    const result = await getPortfolio({ chain: CHAIN, wallet: ALICE });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.wallet).toBe(ALICE);
    expect(result.data.balance).toBe('0');
  });

  it('ba vai ngân hàng đều bị từ chối, kèm mã FORBIDDEN', async () => {
    for (const role of ['BANK_ADMIN', 'COMPLIANCE', 'AUDITOR']) {
      actAs(role);
      const result = await getPortfolio({ chain: CHAIN, wallet: ALICE });

      expect(result.ok, `${role} không được đọc vị thế`).toBe(false);
      if (result.ok) continue;
      expect(result.code).toBe('FORBIDDEN');
    }
  });

  it('lần bị từ chối vẫn được ghi vào sổ kiểm toán', async () => {
    actAs('BANK_ADMIN');
    await getPortfolio({ chain: CHAIN, wallet: ALICE });

    const audit = await getStore().listAudit({ limit: 10 });
    const denied = audit.find(
      (entry) => entry.action === 'portfolio:read' && entry.outcome === 'DENIED',
    );
    expect(denied, 'phải có bản ghi DENIED để kênh (audit) thấy được').toBeDefined();
    expect(denied?.actorRole).toBe('BANK_ADMIN');
  });

  it('ví sai định dạng bị chặn ở validate, không đi tới chain', async () => {
    const result = await getPortfolio({ chain: CHAIN, wallet: 'khong-phai-vi' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
  });
});

describe('getPortfolio — số liệu', () => {
  it('số dư đọc từ chain, không phải dữ liệu mẫu', async () => {
    const { getLedger } = await import('@/lib/ledger');
    const ledger = getLedger(CHAIN);
    await ledger.whitelist(ALICE);
    await ledger.mint(ALICE, 250n);

    const result = await getPortfolio({ chain: CHAIN, wallet: ALICE });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.balance).toBe('250');
    expect(result.data.whitelisted).toBe(true);
    expect(result.data.token.totalSupply).toBe('250');
  });

  it('quy đổi theo giá phát hành, và trả dạng chuỗi', async () => {
    const { getLedger } = await import('@/lib/ledger');
    const ledger = getLedger(CHAIN);
    await ledger.whitelist(ALICE);
    await ledger.mint(ALICE, 3n);

    const result = await getPortfolio({ chain: CHAIN, wallet: ALICE });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Chuỗi, không phải number: uint256 vượt Number.MAX_SAFE_INTEGER là mất chính xác.
    expect(typeof result.data.valueVnd).toBe('string');
    expect(result.data.valueVnd).toBe(String(3 * WPT_ISSUE_PRICE_VND));
  });

  it('KHÔNG có trường số dư VNDB (chờ BE-01), thay vì trả 0 bịa', async () => {
    const result = await getPortfolio({ chain: CHAIN, wallet: ALICE });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).not.toHaveProperty('paymentBalance');
    expect(result.data).not.toHaveProperty('vndbBalance');
  });
});

describe('getWalletTransactions — lọc theo ví', () => {
  /** Dựng dữ liệu: một giao dịch của ALICE, một của BOB. */
  async function seedTwoWallets() {
    const store = getStore();
    await store.saveTxn({
      chain: CHAIN,
      operation: 'mint',
      txHash: '0xaaa',
      status: 'CONFIRMED',
      fromWallet: null,
      toWallet: ALICE,
      amount: '100',
      reason: null,
      actorRole: 'BANK_ADMIN',
      actorAddress: null,
    });
    await store.saveTxn({
      chain: CHAIN,
      operation: 'mint',
      txHash: '0xbbb',
      status: 'CONFIRMED',
      fromWallet: null,
      toWallet: BOB,
      amount: '999',
      reason: null,
      actorRole: 'BANK_ADMIN',
      actorAddress: null,
    });
  }

  it('chỉ trả giao dịch của ví được yêu cầu, KHÔNG lẫn ví khác', async () => {
    await seedTwoWallets();

    const result = await getWalletTransactions({ chain: CHAIN, wallet: ALICE });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0].toWallet).toBe(ALICE);
    // Điểm cốt lõi: không có giao dịch nào của BOB rơi vào danh sách của ALICE.
    expect(result.data.some((txn) => txn.toWallet === BOB)).toBe(false);
  });

  it('lọc không phân biệt chữ hoa thường của địa chỉ', async () => {
    await seedTwoWallets();

    const result = await getWalletTransactions({ chain: CHAIN, wallet: ALICE.toLowerCase() });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
  });

  it('thiếu ví thì lỗi validate, KHÔNG trả về danh sách của mọi ví', async () => {
    await seedTwoWallets();

    // Đây là rào chống rò dữ liệu: nếu `wallet` optional thì lời gọi thiếu tham số sẽ
    // trả giao dịch của toàn hệ thống ra màn hình nhà đầu tư.
    const result = await getWalletTransactions({ chain: CHAIN });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
  });

  it('ba vai ngân hàng đều bị từ chối', async () => {
    await seedTwoWallets();

    for (const role of ['BANK_ADMIN', 'COMPLIANCE', 'AUDITOR']) {
      actAs(role);
      const result = await getWalletTransactions({ chain: CHAIN, wallet: ALICE });

      expect(result.ok, `${role} không được đọc lịch sử ví`).toBe(false);
    }
  });

  it('chưa có giao dịch thì trả danh sách rỗng, không phải lỗi', async () => {
    const result = await getWalletTransactions({ chain: CHAIN, wallet: ALICE });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });
});
