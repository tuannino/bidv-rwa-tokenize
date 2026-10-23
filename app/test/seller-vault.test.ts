import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VaultStatus } from '@/lib/ledger';
import { resetServerEnvCache } from '@/lib/config/env';
import { resetMemoryStore, resetStoreCache } from '@/lib/store';

const VAULT = '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853';
const OTHER_SPV = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';

const state = vi.hoisted(() => ({ spv: null as string | null }));
const vault: VaultStatus = {
  address: VAULT,
  wptBalance: 700n,
  vndbBalance: 50_000_000n,
  lockMode: 'PERCENT',
  fixedLockAmount: 0n,
  percentRateBps: 2000n,
  pendingPercentRateBps: null,
  netProceeds: 50_000_000n,
  lockedAmount: 10_000_000n,
  withdrawable: 40_000_000n,
  lastPeriodRef: 0n,
  lastDistributedPrev: 0n,
  percentLocked: 0n,
  payoutWallet: null,
  withdrawalsPaused: false,
};

vi.mock('@/lib/ledger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ledger')>();
  return {
    ...actual,
    getLedger: () => ({
      spvWallet: async () => state.spv,
      vaultStatus: async () => vault,
      isSettlementMode: async () => false,
      profitPoolBalance: async () => 0n,
      tokenInfo: async () => ({ name: 'WPT', symbol: 'WPT', decimals: 0, totalSupply: 700n }),
      // FE-07: hardhat-local có OrderSettlement nên "giá phát hành" của Người bán là giá trên hợp đồng.
      quotePurchase: async (wptAmount: bigint) => wptAmount * 100_000n,
      balanceOf: async (wallet: string) => wallet.toLowerCase() === VAULT.toLowerCase() ? 700n : 0n,
    }),
  };
});

const { getSellerOverview } = await import('@/lib/bank/seller.service');
const OLD_ENV = { role: process.env.DEMO_ROLE, useMockDb: process.env.USE_MOCK_DB };

describe('SC-07 — nguồn vault trong Tổng quan Người bán', () => {
  beforeEach(() => {
    process.env.DEMO_ROLE = 'SELLER';
    process.env.USE_MOCK_DB = 'true';
    state.spv = null;
    resetServerEnvCache();
    resetMemoryStore();
    resetStoreCache();
  });

  afterAll(() => {
    if (OLD_ENV.role === undefined) delete process.env.DEMO_ROLE;
    else process.env.DEMO_ROLE = OLD_ENV.role;
    if (OLD_ENV.useMockDb === undefined) delete process.env.USE_MOCK_DB;
    else process.env.USE_MOCK_DB = OLD_ENV.useMockDb;
    resetServerEnvCache();
    resetStoreCache();
  });

  it('dùng vault làm ví thanh toán và nguồn on-chain ngay cả khi spvWallet còn null', async () => {
    const result = await getSellerOverview({ chain: 'hardhat-local' });
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.data.spvWallet).toBeNull();
    expect(result.data.tokens[0].undistributed).toBe('700');
    expect(result.data.wallet).toMatchObject({
      paymentWallet: VAULT,
      paymentVnd: '50000000',
      lockedVnd: '10000000',
      withdrawableVnd: '40000000',
      warning: null,
      policy: {
        source: 'on-chain',
        lockMode: 'PERCENT',
        percentRateBps: '2000',
        netProceeds: '50000000',
      },
    });
  });

  it('hiện cảnh báo khi ví SPV trên ProjectToken khác vault', async () => {
    state.spv = OTHER_SPV;
    const result = await getSellerOverview({ chain: 'hardhat-local' });
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.data.wallet.warning).toContain('Ví SPV trên chuỗi không phải vault');
    expect(result.data.wallet.paymentWallet).toBe(VAULT);
  });
});
