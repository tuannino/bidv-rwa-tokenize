import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createPublicClient,
  createWalletClient,
  decodeFunctionData,
  http,
  parseSignature,
  type Abi,
  type Account,
  type Hex,
} from 'viem';
import { hardhat } from 'viem/chains';
import {
  getContractAddress,
  orderSettlementAbi,
  projectTokenAbi,
  tokenParameters,
  vndTokenAbi,
} from '@bidv/shared';
import type { ILedgerPort } from '@/lib/ledger/ledger.port';
import type { OrderPermit } from '@/lib/store/order.store.port';
import { resetServerEnvCache } from '@/lib/config/env';
import { placeSignedOrder, signPreparedPermit } from './helpers/permit-signer';

/**
 * FE-05 trên nút Hardhat THẬT: ca 1 (domain đọc từ chuỗi), 4, 5, 6, 7b, 8, 11.
 *
 * Chạy trên chuỗi VỪA RESET, một tệp một lệnh (các tệp nút thật dùng chung trạng thái chuỗi):
 *   bash scripts/evm-local.sh reset
 *   (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/fe-05-permit-evm.test.ts)
 *
 * Nhà đầu tư là ví mẫu NDT001 (Hardhat #1): seed cục bộ chỉ KYC, KHÔNG approve gì, nên ủy quyền
 * ban đầu bằng 0. Tệp này cũng không approve lần nào: mọi lệnh đi qua chữ ký permit do nút ký hộ
 * (`eth_signTypedData_v4`), không khoá riêng nào nằm trong mã.
 */

const HARDHAT_RPC = process.env.TEST_HARDHAT_RPC;
const ADMIN = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Hex;
const INVESTOR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Hex;
const ADMIN_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const PRICE = BigInt(tokenParameters.wptIssuePriceVnd);
/** Ca gọi tua thời gian hoặc nhiều giao dịch: ngưỡng riêng, không dựa vào 5 giây mặc định. */
const SLOW = 30_000;

const live = HARDHAT_RPC ? describe.sequential : describe.skip;

live('FE-05: chữ ký permit trên nút Hardhat thật', () => {
  const vault = getContractAddress('hardhat-local', 'SpvPaymentVault') as Hex;
  const settlement = getContractAddress('hardhat-local', 'OrderSettlement') as Hex;
  const wpt = getContractAddress('hardhat-local', 'ProjectToken') as Hex;
  const vndb = getContractAddress('hardhat-local', 'VNDToken') as Hex;
  const publicClient = createPublicClient({ chain: hardhat, transport: http(HARDHAT_RPC) });
  let ledger: ILedgerPort;

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

  async function writeAs(from: Hex, address: Hex, abi: Abi | readonly unknown[], fn: string, args: unknown[]) {
    const account: Account = { address: from, type: 'json-rpc' };
    const wallet = createWalletClient({ account, chain: hardhat, transport: http(HARDHAT_RPC) });
    const { request } = await publicClient.simulateContract({
      account,
      address,
      abi: abi as Abi,
      functionName: fn as never,
      args: args as never,
    });
    const hash = await wallet.writeContract(request as never);
    expect((await publicClient.waitForTransactionReceipt({ hash })).status).toBe('success');
  }

  const allowanceOf = (token: Hex) =>
    publicClient.readContract({
      address: token,
      abi: vndTokenAbi,
      functionName: 'allowance',
      args: [INVESTOR, settlement],
    }) as Promise<bigint>;

  const settlementFunction = async (txHash: string) => {
    const tx = await publicClient.getTransaction({ hash: txHash as Hex });
    return decodeFunctionData({ abi: orderSettlementAbi, data: tx.input }).functionName;
  };

  async function prepared(side: 'BUY' | 'SELL', wptAmount: string) {
    const { preparePermit } = await import('@/lib/bank/purchase.service');
    const result = await preparePermit({ chain: 'hardhat-local', investorWallet: INVESTOR, side, wptAmount });
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) throw new Error(result.error);
    return result.data;
  }

  /** Chữ ký đã ký và tách sẵn, đúng khuôn mà `placeOrder` lưu cùng lệnh. */
  async function storedPermit(side: 'BUY' | 'SELL', wptAmount: string): Promise<OrderPermit> {
    const data = await prepared(side, wptAmount);
    const signed = await signPreparedPermit(HARDHAT_RPC!, INVESTOR, data);
    const { r, s, v, yParity } = parseSignature(signed.signature);
    return {
      token: data.typedData.domain.verifyingContract as Hex,
      spender: data.typedData.message.spender as Hex,
      value: BigInt(data.value),
      nonce: BigInt(data.nonce),
      deadline: BigInt(data.deadline),
      v: v === undefined ? yParity + 27 : Number(v),
      r,
      s,
    };
  }

  /** Bên khác dùng chữ ký trước: gửi thẳng `permit` lên token từ ví quản trị. */
  async function frontRun(token: Hex, permit: OrderPermit) {
    await writeAs(ADMIN, token, vndTokenAbi, 'permit', [
      INVESTOR,
      settlement,
      permit.value,
      permit.deadline,
      permit.v,
      permit.r,
      permit.s,
    ]);
  }

  async function storedOrder(status: 'EXECUTING', wptAmount: bigint, permit: OrderPermit) {
    const { getOrderStore } = await import('@/lib/store');
    return getOrderStore().createOrder({
      chain: 'hardhat-local',
      investorWallet: INVESTOR,
      clientRequestId: crypto.randomUUID(),
      side: 'BUY',
      status,
      wptAmount: wptAmount.toString(),
      vndAmount: (wptAmount * PRICE).toString(),
      actorRole: 'INVESTOR',
      permit,
    });
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
    const { resetMemoryStore, resetStoreCache } = await import('@/lib/store');
    resetMemoryStore();
    resetStoreCache();

    const { getLedger } = await import('@/lib/ledger');
    ledger = getLedger('hardhat-local');
    if (await ledger.isInitialSupplyMinted()) {
      await ledger.waitReceipt((await ledger.mint(vault, 5_000n)).txHash);
    } else {
      await ledger.waitReceipt((await ledger.mintInitialSupply(vault, 5_000n)).txHash);
    }
    await writeAs(ADMIN, vndb, vndTokenAbi, 'mint', [INVESTOR, 2_000_000_000n]);
    // Phát hành ở trên đi thẳng lên chuỗi, không qua nghiệp vụ phát hành; ghi mốc phát hành vào bảng
    // dự án như nghiệp vụ làm, để điều kiện "token được phép giao dịch" của màn xem trước đọc đúng.
    const { getProjectStore } = await import('@/lib/store');
    const [project] = await getProjectStore().listProjects({ chain: 'hardhat-local' });
    if (project && !project.issuedAt) {
      await getProjectStore().markIssued({ id: project.id, issuedAt: new Date().toISOString() });
    }
  }, SLOW);

  beforeEach(() => actAs('INVESTOR'));

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

  it('ca 11: ủy quyền 0, xem trước vẫn cho xác nhận; thiếu VNDB thì không', async () => {
    expect(await allowanceOf(vndb)).toBe(0n);
    const { previewTrade } = await import('@/lib/bank/trade.service');
    const { previewPurchase } = await import('@/lib/bank/purchase.service');
    const intent = { chain: 'hardhat-local', investorWallet: INVESTOR, wptAmount: '10', side: 'BUY' };

    const trade = await previewTrade(intent);
    expect(trade.ok, trade.ok ? '' : trade.error).toBe(true);
    if (trade.ok) expect(trade.data.canConfirm, JSON.stringify(trade.data.conditions)).toBe(true);
    const purchase = await previewPurchase(intent);
    const allowance = purchase.ok ? purchase.data.checks.find((c) => c.id === 'allowance') : undefined;
    expect(allowance).toMatchObject({ ok: true, detail: expect.stringMatching(/sẽ cấp bằng chữ ký/i) });

    const poor = await previewTrade({ ...intent, wptAmount: '30000' });
    expect(poor.ok && poor.data.canConfirm).toBe(false);
  });

  it('ca 1: typed data đọc domain, nonce, timestamp từ chuỗi', async () => {
    const buy = await prepared('BUY', '100');
    const domain = (await publicClient.readContract({
      address: vndb,
      abi: vndTokenAbi,
      functionName: 'eip712Domain',
    })) as readonly [Hex, string, string, bigint, Hex, Hex, readonly bigint[]];
    const latest = (await publicClient.getBlock()).timestamp;
    expect(buy.value).toBe((100n * PRICE).toString());
    expect(buy.typedData.domain).toEqual({
      name: domain[1],
      version: domain[2],
      chainId: Number(domain[3]),
      verifyingContract: vndb,
    });
    expect(buy.typedData.message.spender.toLowerCase()).toBe(settlement.toLowerCase());
    expect(buy.nonce).toBe(
      String(await publicClient.readContract({ address: vndb, abi: vndTokenAbi, functionName: 'nonces', args: [INVESTOR] })),
    );
    expect(BigInt(buy.deadline)).toBe(latest + 1_800n);

    const sell = await prepared('SELL', '40');
    expect(sell.value).toBe('40');
    expect(sell.typedData.domain.verifyingContract).toBe(wpt);
    const wptDomain = await publicClient.readContract({
      address: wpt,
      abi: projectTokenAbi,
      functionName: 'eip712Domain',
    });
    expect(sell.typedData.domain.version).toBe(wptDomain[2]);
  });

  it('ca 4: mua không cần approve: ký, COMPLETED, số dư đúng, giao dịch là buyWithPermit', async () => {
    expect(await allowanceOf(vndb)).toBe(0n);
    const before = { wpt: await ledger.balanceOf(INVESTOR), vndb: await ledger.paymentBalanceOf(INVESTOR) };
    const { result } = await placeSignedOrder(HARDHAT_RPC!, { investorWallet: INVESTOR, side: 'BUY', wptAmount: '100' });
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('COMPLETED');
    expect(await settlementFunction(result.data.txHash!)).toBe('buyWithPermit');
    expect(await ledger.balanceOf(INVESTOR)).toBe(before.wpt + 100n);
    expect(await ledger.paymentBalanceOf(INVESTOR)).toBe(before.vndb - 100n * PRICE);
    expect(await allowanceOf(vndb)).toBe(0n);
  }, SLOW);

  it('ca 5: bán không cần approve: ký WPT, COMPLETED, giao dịch là sellWithPermit', async () => {
    expect(await allowanceOf(wpt)).toBe(0n);
    const before = { wpt: await ledger.balanceOf(INVESTOR), vndb: await ledger.paymentBalanceOf(INVESTOR) };
    const { result } = await placeSignedOrder(HARDHAT_RPC!, { investorWallet: INVESTOR, side: 'SELL', wptAmount: '40' });
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('COMPLETED');
    expect(await settlementFunction(result.data.txHash!)).toBe('sellWithPermit');
    expect(await ledger.balanceOf(INVESTOR)).toBe(before.wpt - 40n);
    expect(await ledger.paymentBalanceOf(INVESTOR)).toBe(before.vndb + 40n * PRICE);
  }, SLOW);

  it('ca 6a: chữ ký bị gửi trước khi đặt lệnh: "nhỏ hơn, đủ", lệnh tạo và COMPLETED', async () => {
    const data = await prepared('BUY', '5');
    const permit = await signPreparedPermit(HARDHAT_RPC!, INVESTOR, data);
    const { r, s, v, yParity } = parseSignature(permit.signature);
    await frontRun(vndb, {
      token: vndb,
      spender: settlement,
      value: BigInt(permit.value),
      nonce: BigInt(permit.nonce),
      deadline: BigInt(permit.deadline),
      v: v === undefined ? yParity + 27 : Number(v),
      r,
      s,
    });
    const { placeOrder } = await import('@/lib/bank/purchase.service');
    const result = await placeOrder({
      chain: 'hardhat-local',
      investorWallet: INVESTOR,
      side: 'BUY',
      wptAmount: '5',
      clientRequestId: crypto.randomUUID(),
      permit,
    });
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (result.ok) expect(result.data.status).toBe('COMPLETED');
  }, SLOW);

  it('ca 6b: chữ ký bị gửi trước sau khi tạo lệnh, trước quyết toán: phục hồi về COMPLETED', async () => {
    const permit = await storedPermit('BUY', '3');
    const order = await storedOrder('EXECUTING', 3n, permit);
    await frontRun(vndb, permit);
    actAs('TELLER');
    const { executeOrder } = await import('@/lib/bank/purchase.service');
    const result = await executeOrder({ chain: 'hardhat-local', orderId: order.id });
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('COMPLETED');
    // Chữ ký đã dùng nên quyết toán bằng ủy quyền thực tế mà chính chữ ký đó vừa cấp.
    expect(await settlementFunction(result.data.txHash)).toBe('buy');
  }, SLOW);

  it('ca 7b: hai tab đồng thời cùng nonce, ủy quyền 0: đúng một lệnh COMPLETED, tiền chỉ đổi một lần', async () => {
    expect(await allowanceOf(vndb)).toBe(0n);
    const { getOrderStore } = await import('@/lib/store');
    const before = { wpt: await ledger.balanceOf(INVESTOR), vndb: await ledger.paymentBalanceOf(INVESTOR) };
    const first = await signPreparedPermit(HARDHAT_RPC!, INVESTOR, await prepared('BUY', '7'));
    const second = await signPreparedPermit(HARDHAT_RPC!, INVESTOR, await prepared('BUY', '7'));
    expect(first.nonce).toBe(second.nonce);
    const ordersBefore = await getOrderStore().countOrders({});

    const { placeOrder } = await import('@/lib/bank/purchase.service');
    const intent = { chain: 'hardhat-local', investorWallet: INVESTOR, side: 'BUY', wptAmount: '7' } as const;
    const results = await Promise.all([
      placeOrder({ ...intent, clientRequestId: crypto.randomUUID(), permit: first }),
      placeOrder({ ...intent, clientRequestId: crypto.randomUUID(), permit: second }),
    ]);

    const completed = results.filter((r) => r.ok && r.data.status === 'COMPLETED');
    expect(completed, JSON.stringify(results)).toHaveLength(1);
    const loser = results.find((r) => !(r.ok && r.data.status === 'COMPLETED'))!;
    if (loser.ok) {
      expect(['REJECTED', 'FAILED']).toContain(loser.data.status);
      expect(loser.data.reason).toMatch(/ký lại|ký mới/);
      expect(await getOrderStore().countOrders({})).toBe(ordersBefore + 2);
    } else {
      expect(loser.code).toBe('VALIDATION');
      expect(await getOrderStore().countOrders({})).toBe(ordersBefore + 1);
    }
    expect(await ledger.balanceOf(INVESTOR)).toBe(before.wpt + 7n);
    expect(await ledger.paymentBalanceOf(INVESTOR)).toBe(before.vndb - 7n * PRICE);
  }, SLOW);

  it('ca 8: phục hồi EXECUTING mất mã dùng chữ ký đã lưu; quá hạn và ủy quyền 0 thì ký lại', async () => {
    const usable = await storedOrder('EXECUTING', 2n, await storedPermit('BUY', '2'));
    actAs('TELLER');
    const { executeOrder } = await import('@/lib/bank/purchase.service');
    const recovered = await executeOrder({ chain: 'hardhat-local', orderId: usable.id });
    expect(recovered.ok, recovered.ok ? '' : recovered.error).toBe(true);
    if (recovered.ok) {
      expect(recovered.data.status).toBe('COMPLETED');
      expect(await settlementFunction(recovered.data.txHash)).toBe('buyWithPermit');
    }

    actAs('INVESTOR');
    const stale = await storedOrder('EXECUTING', 2n, await storedPermit('BUY', '2'));
    await publicClient.request({ method: 'evm_increaseTime' as never, params: [1_900] as never });
    await publicClient.request({ method: 'evm_mine' as never, params: [] as never });
    expect(await allowanceOf(vndb)).toBe(0n);
    actAs('TELLER');
    const rejected = await executeOrder({ chain: 'hardhat-local', orderId: stale.id });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.code).toBe('INSUFFICIENT_ALLOWANCE');
      expect(rejected.error).toMatch(/ký mới|ký lại/);
    }
    const { getOrderStore } = await import('@/lib/store');
    expect((await getOrderStore().findOrder(stale.id))?.status).toBe('REJECTED');
  }, SLOW);
});
