import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addressBook,
  getContractAddress,
  spvPaymentVaultAbi,
  type DeploymentRecord,
} from '@bidv/shared';
import {
  createPublicClient,
  createWalletClient,
  http,
  type Abi,
  type Account,
  type Hex,
} from 'viem';
import { hardhat } from 'viem/chains';
import { CONTROLLER_NAV, TELLER_NAV } from '@/components/layout/nav-config';
import { getSellerOverview } from '@/lib/bank/seller.service';
import { getVaultOverview } from '@/lib/bank/vault.service';
import { resetChainRegistryCache } from '@/lib/chains/registry';
import { resetServerEnvCache } from '@/lib/config/env';
import { createEvmLedger } from '@/lib/ledger/evm.adapter';
import { createMockLedger } from '@/lib/ledger/mock.adapter';
import { createStellarLedger } from '@/lib/ledger/stellar.adapter';
import { LedgerError } from '@/lib/ledger/ledger.port';
import { can } from '@/lib/rbac';
import type { ISigner } from '@/lib/signer';
import { resetMemoryStore, resetStoreCache } from '@/lib/store';

const HARDHAT_RPC = process.env.TEST_HARDHAT_RPC;
const ADMIN = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as const;
const ORIGINAL_MOCK_ENV = {
  role: process.env.DEMO_ROLE,
  useMockDb: process.env.USE_MOCK_DB,
};

const signer: ISigner = {
  kind: 'server',
  async getAddress() { return ADMIN; },
  async getAccount() { return { address: ADMIN, type: 'json-rpc' } as Account; },
};

const navHrefs = (nav: typeof TELLER_NAV) => nav.groups.flatMap((group) => group.items.map((item) => item.href));

describe('SC-07 — adapter rỗng, quyền và menu vault', () => {
  afterAll(() => {
    if (ORIGINAL_MOCK_ENV.role === undefined) delete process.env.DEMO_ROLE;
    else process.env.DEMO_ROLE = ORIGINAL_MOCK_ENV.role;
    if (ORIGINAL_MOCK_ENV.useMockDb === undefined) delete process.env.USE_MOCK_DB;
    else process.env.USE_MOCK_DB = ORIGINAL_MOCK_ENV.useMockDb;
    resetServerEnvCache();
    resetStoreCache();
  });

  it('mock và stellar công khai trạng thái chưa triển khai thay vì ném lỗi', async () => {
    const mock = createMockLedger('mock');
    const stellar = createStellarLedger('stellar');
    expect(await mock.vaultStatus()).toBeNull();
    expect(await mock.vaultPeriodCloses(10)).toEqual([]);
    expect(await stellar.vaultStatus()).toBeNull();
    expect(await stellar.vaultPeriodCloses(10)).toEqual([]);
  });

  it('chỉ TELLER và CONTROLLER có quyền và mục /vault', () => {
    for (const role of ['TELLER', 'CONTROLLER'] as const) expect(can(role, 'vault:read')).toBe(true);
    for (const role of ['INVESTOR', 'SELLER'] as const) expect(can(role, 'vault:read')).toBe(false);
    expect(navHrefs(TELLER_NAV)).toContain('/vault');
    expect(navHrefs(CONTROLLER_NAV)).toContain('/vault');
  });

  it('service trả null trên mock và chặn vai không có quyền', async () => {
    process.env.USE_MOCK_DB = 'true';
    process.env.DEMO_ROLE = 'TELLER';
    resetServerEnvCache();
    resetMemoryStore();
    resetStoreCache();
    const allowed = await getVaultOverview({ chain: 'mock' });
    expect(allowed.ok && allowed.data).toMatchObject({ status: null, history: [] });

    process.env.DEMO_ROLE = 'SELLER';
    resetServerEnvCache();
    const denied = await getVaultOverview({ chain: 'mock' });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.code).toBe('FORBIDDEN');
  });
});

const live = HARDHAT_RPC ? describe.sequential : describe.skip;

live('SC-07 — vault qua adapter và service trên nút Hardhat thật', () => {
  const oldEnv = {
    rpc: process.env.RPC_HARDHAT,
    role: process.env.DEMO_ROLE,
    useMockDb: process.env.USE_MOCK_DB,
  };
  const vaultAddress = getContractAddress('hardhat-local', 'SpvPaymentVault') as Hex;
  const ledger = createEvmLedger('hardhat-local', signer);

  beforeAll(() => {
    process.env.RPC_HARDHAT = HARDHAT_RPC;
    process.env.USE_MOCK_DB = 'true';
    process.env.DEMO_ROLE = 'TELLER';
    resetServerEnvCache();
    resetChainRegistryCache();
    resetMemoryStore();
    resetStoreCache();
  });

  afterAll(() => {
    const restore = (key: string, value: string | undefined) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    };
    restore('RPC_HARDHAT', oldEnv.rpc);
    restore('DEMO_ROLE', oldEnv.role);
    restore('USE_MOCK_DB', oldEnv.useMockDb);
    resetServerEnvCache();
    resetChainRegistryCache();
    resetStoreCache();
  });

  async function write(functionName: string, args: readonly unknown[]) {
    const account: Account = { address: ADMIN, type: 'json-rpc' };
    const publicClient = createPublicClient({ chain: hardhat, transport: http(HARDHAT_RPC) });
    const walletClient = createWalletClient({ account, chain: hardhat, transport: http(HARDHAT_RPC) });
    const { request } = await publicClient.simulateContract({
      account,
      address: vaultAddress,
      abi: spvPaymentVaultAbi as Abi,
      functionName: functionName as never,
      args: args as never,
    });
    const hash = await walletClient.writeContract(request as never);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    expect(receipt.status).toBe('success');
  }

  it('đọc trạng thái sau chuỗi cấu hình/chốt kỳ và quét sự kiện từ deployBlock', async () => {
    const before = await ledger.vaultStatus();
    expect(before?.address.toLowerCase()).toBe(vaultAddress.toLowerCase());
    const nextPeriod = (before?.lastPeriodRef ?? 0n) + 1n;

    await write('setPercentRate', [2500n]);
    await write('setLockMode', [2]);
    await write('closePeriod', [nextPeriod, 50_000_000n]);

    const status = await ledger.vaultStatus();
    expect(status).toMatchObject({
      address: vaultAddress,
      lockMode: 'PERCENT',
      percentRateBps: 2500n,
      pendingPercentRateBps: null,
      lastPeriodRef: nextPeriod,
      lastDistributedPrev: 50_000_000n,
      percentLocked: 12_500_000n,
    });
    const history = await ledger.vaultPeriodCloses(10);
    expect(history[0]).toMatchObject({
      periodRef: nextPeriod,
      distributedPrev: 50_000_000n,
      rateBps: 2500n,
      percentLocked: 12_500_000n,
      operator: ADMIN,
    });
    expect(history[0].blockNumber).toBeGreaterThanOrEqual(BigInt(addressBook['hardhat-local']!.deployBlock!));
  });

  it('thiếu deployBlock thì báo rõ và không quét từ block 0', async () => {
    const deployment = addressBook['hardhat-local'] as DeploymentRecord;
    const saved = deployment.deployBlock;
    delete deployment.deployBlock;
    try {
      await expect(ledger.vaultPeriodCloses(10)).rejects.toThrow(LedgerError);
      await expect(ledger.vaultPeriodCloses(10)).rejects.toThrow(/Thiếu block triển khai/);
    } finally {
      deployment.deployBlock = saved;
    }
  });

  it('Tổng quan Người bán lấy ví và luật khoá từ on-chain kể cả trước Mint đầu', async () => {
    process.env.DEMO_ROLE = 'SELLER';
    resetServerEnvCache();
    const result = await getSellerOverview({ chain: 'hardhat-local' });
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.data.wallet.paymentWallet?.toLowerCase()).toBe(vaultAddress.toLowerCase());
    expect(result.data.wallet).toMatchObject({
      paymentVnd: '0',
      lockedVnd: '12500000',
      withdrawableVnd: '0',
      policy: {
        source: 'on-chain',
        lockMode: 'PERCENT',
        percentRateBps: '2500',
        percentLocked: '12500000',
      },
    });
  });
});
