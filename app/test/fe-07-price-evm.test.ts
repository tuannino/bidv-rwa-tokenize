import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPublicClient,
  createWalletClient,
  http,
  type Abi,
  type Account,
  type Hex,
} from 'viem';
import { hardhat } from 'viem/chains';
import { getContractAddress, tokenParameters, vndTokenAbi } from '@bidv/shared';
import type { ILedgerPort } from '@/lib/ledger/ledger.port';
import { resetServerEnvCache } from '@/lib/config/env';
import { placeSignedOrder } from './helpers/permit-signer';

/**
 * FE-07 trên nút Hardhat thật: đổi giá qua `setIssuePrice` chờ biên nhận rồi mới ghi database;
 * `OrderSettlement.price` đọc lại bằng giá mới; lệnh mua đặt sau đó chốt và quyết toán theo giá mới.
 *
 * Chạy khi có `TEST_HARDHAT_RPC` (reset nút trước tệp: `bash scripts/evm-local.sh reset`).
 */

const HARDHAT_RPC = process.env.TEST_HARDHAT_RPC;
const CHAIN = 'hardhat-local';
const ADMIN = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Hex;
const INVESTOR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Hex;
const ADMIN_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const DEPLOY_PRICE = BigInt(tokenParameters.wptIssuePriceVnd);
const ERC20_APPROVE_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

function unlockedSigner(address: Hex) {
  const account: Account = { address, type: 'json-rpc' };
  return {
    kind: 'server' as const,
    async getAddress() {
      return address;
    },
    async getAccount() {
      return account;
    },
  };
}

async function writeAs(from: Hex, address: Hex, abi: Abi | readonly unknown[], functionName: string, args: readonly unknown[]) {
  const account: Account = { address: from, type: 'json-rpc' };
  const publicClient = createPublicClient({ chain: hardhat, transport: http(HARDHAT_RPC) });
  const walletClient = createWalletClient({ account, chain: hardhat, transport: http(HARDHAT_RPC) });
  const { request } = await publicClient.simulateContract({
    account,
    address,
    abi: abi as Abi,
    functionName: functionName as never,
    args: args as never,
  });
  const hash = await walletClient.writeContract(request as never);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  expect(receipt.status).toBe('success');
}

function actAs(role: 'INVESTOR' | 'TELLER') {
  process.env.DEMO_ROLE = role;
  process.env.DEMO_ACTOR = role === 'TELLER' ? 'GDV001' : 'NDT001';
  resetServerEnvCache();
}

const live = HARDHAT_RPC ? describe.sequential : describe.skip;

live('FE-07: đổi giá phát hành trên nút Hardhat thật', () => {
  let directLedger: ILedgerPort;
  const vault = getContractAddress(CHAIN, 'SpvPaymentVault') as Hex;
  const settlement = getContractAddress(CHAIN, 'OrderSettlement') as Hex;
  const vndb = getContractAddress(CHAIN, 'VNDToken') as Hex;
  const originalEnv = {
    rpc: process.env.RPC_HARDHAT,
    key: process.env.SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL,
    mockDb: process.env.USE_MOCK_DB,
    role: process.env.DEMO_ROLE,
    actor: process.env.DEMO_ACTOR,
  };

  beforeAll(async () => {
    process.env.RPC_HARDHAT = HARDHAT_RPC;
    process.env.SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL = ADMIN_KEY;
    process.env.USE_MOCK_DB = 'true';
    const { resetChainRegistryCache } = await import('@/lib/chains/registry');
    const { resetSignerCache } = await import('@/lib/signer');
    const { resetMemoryStore, resetStoreCache } = await import('@/lib/store');
    resetServerEnvCache();
    resetChainRegistryCache();
    resetSignerCache();
    resetMemoryStore();
    resetStoreCache();

    const { createEvmLedger } = await import('@/lib/ledger/evm.adapter');
    directLedger = createEvmLedger(CHAIN, unlockedSigner(ADMIN));
    await directLedger.waitReceipt((await directLedger.whitelist(INVESTOR)).txHash);
    if (await directLedger.isInitialSupplyMinted()) {
      await directLedger.waitReceipt((await directLedger.mint(vault, 1_000n)).txHash);
    } else {
      await directLedger.waitReceipt((await directLedger.mintInitialSupply(vault, 1_000n)).txHash);
    }
    await writeAs(ADMIN, vndb, vndTokenAbi, 'mint', [INVESTOR, 2_000_000_000n]);
    await writeAs(INVESTOR, vndb, ERC20_APPROVE_ABI, 'approve', [settlement, 2_000_000_000n]);
  });

  afterAll(async () => {
    const restore = (key: string, value: string | undefined) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    };
    restore('RPC_HARDHAT', originalEnv.rpc);
    restore('SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL', originalEnv.key);
    restore('USE_MOCK_DB', originalEnv.mockDb);
    restore('DEMO_ROLE', originalEnv.role);
    restore('DEMO_ACTOR', originalEnv.actor);
    const { resetChainRegistryCache } = await import('@/lib/chains/registry');
    const { resetSignerCache } = await import('@/lib/signer');
    resetServerEnvCache();
    resetChainRegistryCache();
    resetSignerCache();
  });

  it('đổi giá qua setIssuePrice: hợp đồng, database, lịch sử cùng giá mới; lệnh mua sau đó chốt theo giá mới', async () => {
    expect(await directLedger.quotePurchase(1n), 'nút vừa reset: giá triển khai').toBe(DEPLOY_PRICE);
    const next = (DEPLOY_PRICE * 12n) / 10n;

    actAs('TELLER');
    const { setIssuePrice, getIssuePrice, getPriceConfigOverview } = await import('@/lib/bank/config.service');
    const changed = await setIssuePrice({ chain: CHAIN, priceVnd: next.toString(), reason: 'kiểm FE-07 trên Hardhat' });
    expect(changed.ok, changed.ok ? '' : changed.error).toBe(true);
    if (!changed.ok) return;

    // Hợp đồng đã đổi: setIssuePrice chỉ trả ok sau biên nhận CONFIRMED.
    expect(await directLedger.quotePurchase(1n)).toBe(next);
    const view = await getIssuePrice(CHAIN);
    expect(view).toMatchObject({ priceVnd: next.toString(), configuredPriceVnd: next.toString(), warning: null, onChain: true });
    const overview = await getPriceConfigOverview({ chain: CHAIN });
    expect(overview.ok && overview.data.history[0]).toMatchObject({
      newValue: next.toString(),
      txHash: changed.data.txHash,
      reason: 'kiểm FE-07 trên Hardhat',
    });

    const vndbBefore = await directLedger.paymentBalanceOf(INVESTOR);
    actAs('INVESTOR');
    const { result: buy } = await placeSignedOrder(HARDHAT_RPC!, {
      investorWallet: INVESTOR,
      side: 'BUY',
      wptAmount: '10',
    });
    expect(buy.ok, buy.ok ? '' : buy.error).toBe(true);
    if (!buy.ok) return;
    expect(buy.data.status).toBe('COMPLETED');
    expect(buy.data.vndAmount).toBe((10n * next).toString());
    expect(await directLedger.paymentBalanceOf(INVESTOR)).toBe(vndbBefore - 10n * next);
  });
});
