import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPublicClient,
  createWalletClient,
  http,
  type Abi,
  type Account,
  type Hex,
} from 'viem';
import { hardhat } from 'viem/chains';
import {
  getContractAddress,
  tokenParameters,
  vndTokenAbi,
} from '@bidv/shared';
import type { ILedgerPort, SettlementOrder, TxResult } from '@/lib/ledger/ledger.port';
import { issuePriceConfigKey } from '@/lib/config/issue-price-key';
import { resetServerEnvCache } from '@/lib/config/env';
import { placeSignedOrder } from './helpers/permit-signer';

const fault = vi.hoisted(() => ({
  mode: null as
    | null
    | 'throw-after-settle'
    | 'receipt-timeout'
    | 'tx-unknown'
    | 'lookup-error',
  sendCount: 0,
}));

vi.mock('@/lib/ledger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ledger')>();
  return {
    ...actual,
    getLedger: (...args: Parameters<typeof actual.getLedger>): ILedgerPort => {
      const real = actual.getLedger(...args);
      return {
        ...real,
        async executePurchase(order: SettlementOrder): Promise<TxResult> {
          fault.sendCount += 1;
          if (fault.mode === 'tx-unknown' || fault.mode === 'lookup-error') {
            throw new Error('Lỗi mô phỏng trước khi adapter trả mã giao dịch.');
          }
          if (fault.mode === 'throw-after-settle') {
            await real.executePurchase(order);
            throw new Error('RPC mất phản hồi sau khi chain đã quyết toán.');
          }
          return real.executePurchase(order);
        },
        async executeSale(order: SettlementOrder): Promise<TxResult> {
          fault.sendCount += 1;
          return real.executeSale(order);
        },
        async waitReceipt(txHash: string, timeoutMs?: number): Promise<TxResult> {
          if (fault.mode === 'receipt-timeout') throw new Error('Hết thời gian chờ biên nhận.');
          return real.waitReceipt(txHash, timeoutMs);
        },
        async findOrderSettlement(orderId: string) {
          if (fault.mode === 'tx-unknown') return { status: 'SETTLED_TX_UNKNOWN' } as const;
          if (fault.mode === 'lookup-error') throw new Error('RPC đọc OrderSettled tạm thời lỗi.');
          return real.findOrderSettlement(orderId);
        },
      };
    },
  };
});

const HARDHAT_RPC = process.env.TEST_HARDHAT_RPC;
const ADMIN = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Hex;
const INVESTOR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Hex;
const ADMIN_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const PRICE = BigInt(tokenParameters.wptIssuePriceVnd);
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

async function writeAs(
  accountAddress: Hex,
  address: Hex,
  abi: Abi | readonly unknown[],
  functionName: string,
  args: readonly unknown[],
): Promise<Hex> {
  const account: Account = { address: accountAddress, type: 'json-rpc' };
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
  return hash;
}

const live = HARDHAT_RPC ? describe.sequential : describe.skip;

live('SC-03 — app khớp lệnh và đối soát trên nút Hardhat thật', () => {
  let directLedger: ILedgerPort;
  const vault = getContractAddress('hardhat-local', 'SpvPaymentVault') as Hex;
  const settlement = getContractAddress('hardhat-local', 'OrderSettlement') as Hex;
  const wpt = getContractAddress('hardhat-local', 'ProjectToken') as Hex;
  const vndb = getContractAddress('hardhat-local', 'VNDToken') as Hex;
  const originalEnv = {
    rpc: process.env.RPC_HARDHAT,
    key: process.env.SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL,
    mockDb: process.env.USE_MOCK_DB,
    role: process.env.DEMO_ROLE,
    actor: process.env.DEMO_ACTOR,
  };

  function actAs(role: 'INVESTOR' | 'TELLER') {
    process.env.DEMO_ROLE = role;
    process.env.DEMO_ACTOR = role === 'TELLER' ? 'GDV001' : 'NDT001';
    resetServerEnvCache();
  }

  beforeAll(async () => {
    process.env.RPC_HARDHAT = HARDHAT_RPC;
    process.env.SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL = ADMIN_KEY;
    process.env.USE_MOCK_DB = 'true';
    const { resetChainRegistryCache } = await import('@/lib/chains/registry');
    const { resetSignerCache } = await import('@/lib/signer');
    resetServerEnvCache();
    resetChainRegistryCache();
    resetSignerCache();

    const { createEvmLedger } = await import('@/lib/ledger/evm.adapter');
    directLedger = createEvmLedger('hardhat-local', unlockedSigner(ADMIN));
    await directLedger.waitReceipt((await directLedger.whitelist(INVESTOR)).txHash);
    if (await directLedger.isInitialSupplyMinted()) {
      await directLedger.waitReceipt((await directLedger.mint(vault, 5_000n)).txHash);
    } else {
      await directLedger.waitReceipt((await directLedger.mintInitialSupply(vault, 5_000n)).txHash);
    }
    await writeAs(ADMIN, vndb, vndTokenAbi, 'mint', [INVESTOR, 2_000_000_000n]);
    await writeAs(INVESTOR, vndb, ERC20_APPROVE_ABI, 'approve', [settlement, 2_000_000_000n]);
    await writeAs(INVESTOR, wpt, ERC20_APPROVE_ABI, 'approve', [settlement, 5_000n]);
  });

  beforeEach(async () => {
    fault.mode = null;
    fault.sendCount = 0;
    const { resetMemoryStore, resetStoreCache } = await import('@/lib/store');
    resetMemoryStore();
    resetStoreCache();
    actAs('TELLER');
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

  async function createOrder(status: 'CHECKING' | 'EXECUTING', amount = 1n, side: 'BUY' | 'SELL' = 'BUY') {
    const { getOrderStore } = await import('@/lib/store');
    return getOrderStore().createOrder({
      chain: 'hardhat-local',
      investorWallet: INVESTOR,
      clientRequestId: crypto.randomUUID(),
      side,
      status,
      wptAmount: amount.toString(),
      vndAmount: (amount * PRICE).toString(),
      actorRole: 'INVESTOR',
    });
  }

  it('mua 100 WPT rồi bán 40 WPT qua service; bốn số dư trên chuỗi đúng', async () => {
    const before = {
      investorWpt: await directLedger.balanceOf(INVESTOR),
      investorVndb: await directLedger.paymentBalanceOf(INVESTOR),
      vaultWpt: await directLedger.balanceOf(vault),
      vaultVndb: await directLedger.paymentBalanceOf(vault),
    };
    // FE-05 QĐ-C: lệnh mới trên chain thật phải kèm chữ ký permit; nút Hardhat ký hộ ví nhà đầu tư.
    actAs('INVESTOR');
    const { result: buy } = await placeSignedOrder(HARDHAT_RPC!, {
      investorWallet: INVESTOR,
      side: 'BUY',
      wptAmount: '100',
    });
    expect(buy.ok, buy.ok ? '' : buy.error).toBe(true);
    if (!buy.ok) return;
    expect(buy.data.status).toBe('COMPLETED');

    const { result: sale } = await placeSignedOrder(HARDHAT_RPC!, {
      investorWallet: INVESTOR,
      side: 'SELL',
      wptAmount: '40',
    });
    expect(sale.ok, sale.ok ? '' : sale.error).toBe(true);
    if (!sale.ok) return;
    expect(sale.data.status).toBe('COMPLETED');
    expect(await directLedger.balanceOf(INVESTOR)).toBe(before.investorWpt + 60n);
    expect(await directLedger.paymentBalanceOf(INVESTOR)).toBe(
      before.investorVndb - 60n * PRICE,
    );
    expect(await directLedger.balanceOf(vault)).toBe(before.vaultWpt - 60n);
    expect(await directLedger.paymentBalanceOf(vault)).toBe(before.vaultVndb + 60n * PRICE);

    // FE-05 QĐ-H: permit GHI ĐÈ mức ủy quyền rồi lệnh dùng hết, nên ủy quyền approve sẵn ở beforeAll
    // đã về 0. Các ca R5, R6 phía dưới dựng lệnh kiểu cũ (không chữ ký) cần ủy quyền thực tế: cấp lại.
    await writeAs(INVESTOR, vndb, ERC20_APPROVE_ABI, 'approve', [settlement, 2_000_000_000n]);
    await writeAs(INVESTOR, wpt, ERC20_APPROVE_ABI, 'approve', [settlement, 5_000n]);
  });

  it('bán thiếu allowance WPT bị chặn ở R4 trước khi gửi', async () => {
    // FE-05: lệnh mới đã đi qua chữ ký nên không còn thiếu ủy quyền lúc đặt. R4 vẫn giữ cho lệnh
    // KHÔNG có chữ ký (lệnh trước FE-05) khi quyết toán: ủy quyền thực tế thiếu thì REJECTED, không gửi.
    await writeAs(INVESTOR, wpt, ERC20_APPROVE_ABI, 'approve', [settlement, 0n]);
    const order = await createOrder('CHECKING', 1n, 'SELL');
    const { executeOrder } = await import('@/lib/bank/purchase.service');
    const result = await executeOrder({ chain: 'hardhat-local', orderId: order.id });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INSUFFICIENT_ALLOWANCE');
    expect(fault.sendCount).toBe(0);
    await writeAs(INVESTOR, wpt, ERC20_APPROVE_ABI, 'approve', [settlement, 5_000n]);
  });

  it.each([
    ['lỗi lạ sau khi gửi', 'throw-after-settle'],
    ['timeout biên nhận', 'receipt-timeout'],
  ] as const)('R5 — %s vẫn chốt COMPLETED từ OrderSettled', async (_label, mode) => {
    const order = await createOrder('CHECKING');
    fault.mode = mode;
    const { executeOrder } = await import('@/lib/bank/purchase.service');
    const result = await executeOrder({ chain: 'hardhat-local', orderId: order.id });
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    const { getOrderStore } = await import('@/lib/store');
    expect((await getOrderStore().findOrder(order.id))?.status).toBe('COMPLETED');
  });

  it.each([
    ['SETTLED_TX_UNKNOWN', 'tx-unknown', /đã quyết toán trên chuỗi.*chưa tìm thấy mã/i],
    ['lỗi RPC', 'lookup-error', /không tra được trạng thái quyết toán/i],
  ] as const)('R5 — %s giữ nguyên trạng thái hiện tại', async (_label, mode, pattern) => {
    const order = await createOrder('CHECKING');
    fault.mode = mode;
    const { executeOrder } = await import('@/lib/bank/purchase.service');
    const result = await executeOrder({ chain: 'hardhat-local', orderId: order.id });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(pattern);
    const { getOrderStore } = await import('@/lib/store');
    expect((await getOrderStore().findOrder(order.id))?.status).toBe('EXECUTING');
  });

  it('R6 — EXECUTING mất mã đã quyết toán: chốt mã gốc, không gửi lại', async () => {
    const order = await createOrder('EXECUTING');
    const original = await directLedger.executePurchase({
      orderId: order.id,
      investor: INVESTOR,
      wptAmount: 1n,
      vndAmount: PRICE,
    });
    fault.sendCount = 0;
    const { executeOrder } = await import('@/lib/bank/purchase.service');
    const result = await executeOrder({ chain: 'hardhat-local', orderId: order.id });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.txHash).toBe(original.txHash);
    expect(fault.sendCount).toBe(0);
  });

  it('R6 — EXECUTING mất mã chưa quyết toán: quay qua CHECKING và gửi đúng một lần', async () => {
    const order = await createOrder('EXECUTING');
    const { executeOrder } = await import('@/lib/bank/purchase.service');
    const results = await Promise.all([
      executeOrder({ chain: 'hardhat-local', orderId: order.id }),
      executeOrder({ chain: 'hardhat-local', orderId: order.id }),
    ]);
    expect(results.some((result) => result.ok)).toBe(true);
    expect(fault.sendCount).toBe(1);
    const { getOrderStore } = await import('@/lib/store');
    expect((await getOrderStore().findOrder(order.id))?.status).toBe('COMPLETED');
  });

  it('R6 — giá đổi từ lúc đặt thì bộ kiểm chạy lại và không gửi', async () => {
    const order = await createOrder('EXECUTING');
    await directLedger.waitReceipt((await directLedger.setPurchasePrice(PRICE + 1n)).txHash);
    const { executeOrder } = await import('@/lib/bank/purchase.service');
    const result = await executeOrder({ chain: 'hardhat-local', orderId: order.id });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('PRICE_CHANGED');
    expect(fault.sendCount).toBe(0);
    const { getOrderStore } = await import('@/lib/store');
    expect((await getOrderStore().findOrder(order.id))?.status).toBe('REJECTED');
    await directLedger.waitReceipt((await directLedger.setPurchasePrice(PRICE)).txHash);
  });

  it('R7 — giá hiển thị lấy từ chain và cảnh báo khi database lệch', async () => {
    const { getConfigStore } = await import('@/lib/store');
    await getConfigStore().setConfig({
      key: issuePriceConfigKey('hardhat-local'),
      value: (PRICE + 99n).toString(),
      type: 'bigint',
      changedBy: 'TELLER',
      reason: 'cố ý dựng lệch để kiểm cảnh báo R7',
    });
    const { getIssuePrice } = await import('@/lib/bank/config.service');
    const view = await getIssuePrice('hardhat-local');
    expect(view.priceVnd).toBe(PRICE.toString());
    expect(view.configuredPriceVnd).toBe((PRICE + 99n).toString());
    expect(view.warning).toBe('giá trên hợp đồng khác giá đã cấu hình');
  });
});
