import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyTypedData } from 'viem';
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { buildPermitTypedData, findContractAddress } from '@bidv/shared';
import type { ILedgerPort, PermitToken, SettlementOrder, SettlementPermit } from '@/lib/ledger/ledger.port';

/**
 * FE-05: chữ ký permit khi đặt lệnh, phần KHÔNG cần nút Hardhat (ca 1, 2, 3, 6a, 7a, 9, 10, 11
 * phần xem trước, 13). Ca 4 đến 8 và 11 trên nút thật ở `fe-05-permit-evm.test.ts`.
 *
 * ---------------------------------------------------------------------------------------
 *  CHUỖI GIẢ CHO `hardhat-local`
 *
 *  `getLedger('hardhat-local')` trả adapter mock (số dư, KYC, giá, khớp lệnh nguyên tử y như
 *  hợp đồng) cộng phần permit mô phỏng ĐÚNG `OrderSettlement._permit` và ERC-2612:
 *    - `permitNonce` / `latestBlockTimestamp` đọc từ bộ đếm của test;
 *    - hàm `WithPermit` kiểm `value` bằng số lệnh (`PermitValueMismatch`), rồi THỬ permit: chữ ký
 *      khôi phục đúng chủ ví với nonce HIỆN TẠI và còn hạn thì đặt ủy quyền bằng `value` và tăng
 *      nonce; sai thì nuốt lỗi như `try ... catch {}` của hợp đồng;
 *    - chiều bán đòi ủy quyền WPT thật (mock gốc không mô phỏng ủy quyền WPT).
 *  Địa chỉ token và OrderSettlement lấy từ address book hardhat-local, nên domain, spender và
 *  verifyingContract là địa chỉ thật mà mã nghiệp vụ tự tra.
 *
 *  Ví nhà đầu tư là khoá SINH NGẪU NHIÊN lúc chạy (`generatePrivateKey`): không khoá nào nằm trong
 *  repo, và kết quả không phụ thuộc ví nào.
 * ---------------------------------------------------------------------------------------
 */

const sim = vi.hoisted(() => ({
  now: 1_800_000_000n,
  nonces: new Map<string, bigint>(),
  wptAllowances: new Map<string, bigint>(),
  calls: [] as string[],
}));

const TOKEN_NAMES: Record<PermitToken, string> = {
  payment: 'VND Bank Token',
  project: 'Wind Project Token',
};
const tokenAddress = (token: PermitToken) =>
  findContractAddress('hardhat-local', token === 'payment' ? 'VNDToken' : 'ProjectToken') as `0x${string}`;
const SETTLEMENT = findContractAddress('hardhat-local', 'OrderSettlement') as `0x${string}`;
const nonceKey = (token: PermitToken, owner: string) => `${token}:${owner.toLowerCase()}`;

/**
 * HF-02: ca "chain thiếu OrderSettlement" từng dựa vào address book THẬT của `evm`. OP-05 nạp bộ hợp
 * đồng Sepolia có OrderSettlement nên ca này đi tiếp, gọi RPC Sepolia thật từ kiểm thử rồi trả ok.
 * Ở tệp này `evm` được coi như chưa có OrderSettlement, độc lập với lần triển khai nào; `hardhat-local`
 * (chain các ca khác dùng) giữ địa chỉ thật.
 */
vi.mock('@bidv/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@bidv/shared')>();
  return {
    ...actual,
    findContractAddress: (chain: Parameters<typeof actual.findContractAddress>[0], contract: Parameters<typeof actual.findContractAddress>[1]) =>
      chain === 'evm' && contract === 'OrderSettlement' ? undefined : actual.findContractAddress(chain, contract),
  };
});

vi.mock('@/lib/ledger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ledger')>();
  const { seedMockLedger } = await import('@/lib/ledger/mock.adapter');

  /** `OrderSettlement._permit`: `value` sai thì revert; permit hỏng thì nuốt lỗi và đi tiếp. */
  async function trySimulatedPermit(token: PermitToken, owner: string, expected: bigint, p: SettlementPermit) {
    if (p.value !== expected) {
      throw new actual.LedgerError('hardhat-local', 'execute', `PermitValueMismatch(${expected}, ${p.value})`, {
        reverted: true,
      });
    }
    const nonce = sim.nonces.get(nonceKey(token, owner)) ?? 0n;
    const typed = buildPermitTypedData({
      tokenName: TOKEN_NAMES[token],
      version: '1',
      chainId: 31337,
      verifyingContract: tokenAddress(token),
      owner: owner as `0x${string}`,
      spender: SETTLEMENT,
      value: p.value,
      nonce,
      deadline: p.deadline,
    });
    const signature = `${p.r}${p.s.slice(2)}${p.v.toString(16).padStart(2, '0')}` as `0x${string}`;
    const valid =
      p.deadline >= sim.now &&
      (await verifyTypedData({ address: owner as `0x${string}`, ...typed, signature }).catch(() => false));
    if (!valid) return;
    sim.nonces.set(nonceKey(token, owner), nonce + 1n);
    if (token === 'payment') await seedMockLedger({ paymentAllowances: { [owner]: p.value } });
    else sim.wptAllowances.set(owner.toLowerCase(), p.value);
  }

  const simulated = (base: ILedgerPort): ILedgerPort => ({
    ...base,
    chain: 'hardhat-local',
    async latestBlockTimestamp() {
      return sim.now;
    },
    async permitDomain(token) {
      return {
        fields: '0x0f',
        name: TOKEN_NAMES[token],
        version: '1',
        chainId: 31337n,
        verifyingContract: tokenAddress(token),
        salt: `0x${'0'.repeat(64)}`,
        extensions: [],
      };
    },
    async permitNonce(token, owner) {
      return sim.nonces.get(nonceKey(token, owner)) ?? 0n;
    },
    async wptAllowanceOf(owner) {
      return sim.wptAllowances.get(owner.toLowerCase()) ?? 0n;
    },
    async executePurchase(order: SettlementOrder) {
      sim.calls.push(order.permit ? 'buyWithPermit' : 'buy');
      if (order.permit) await trySimulatedPermit('payment', order.investor, order.vndAmount, order.permit);
      return base.executePurchase(order);
    },
    async executeSale(order: SettlementOrder) {
      sim.calls.push(order.permit ? 'sellWithPermit' : 'sell');
      if (order.permit) await trySimulatedPermit('project', order.investor, order.wptAmount, order.permit);
      const allowance = sim.wptAllowances.get(order.investor.toLowerCase()) ?? 0n;
      if (allowance < order.wptAmount) {
        throw new actual.LedgerError('hardhat-local', 'executeSale', 'ERC20InsufficientAllowance', {
          reverted: true,
        });
      }
      sim.wptAllowances.set(order.investor.toLowerCase(), allowance - order.wptAmount);
      return base.executeSale(order);
    },
  });

  return {
    ...actual,
    getLedger: (...args: Parameters<typeof actual.getLedger>): ILedgerPort =>
      args[0] === 'hardhat-local' ? simulated(actual.getLedger('mock')) : actual.getLedger(...args),
  };
});

const { resetServerEnvCache } = await import('@/lib/config/env');
const { resetMockLedger, seedMockLedger } = await import('@/lib/ledger/mock.adapter');
const { getOrderStore, getStore, resetMemoryStore, resetStoreCache } = await import('@/lib/store');
const { getLedger } = await import('@/lib/ledger');
const { listOrders, placeOrder, preparePermit, previewPurchase } = await import('@/lib/bank/purchase.service');
const { placeOrderAction } = await import('@/app/actions/purchase');
const purchaseRoute = await import('@/app/api/purchase/route');

const CHAIN = 'hardhat-local';
const SPV = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
const PRICE = 100_000n;

let investor: PrivateKeyAccount;
let other: PrivateKeyAccount;

function actAs(role: string) {
  process.env.DEMO_ROLE = role;
  resetServerEnvCache();
}

/** Nhà đầu tư đã KYC, có VNDB, ủy quyền ban đầu 0, đang giữ 100 WPT để bán. */
async function seedMarket() {
  const ledger = getLedger(CHAIN);
  for (const wallet of [SPV, investor.address, other.address]) await ledger.whitelist(wallet);
  await ledger.mintInitialSupply(SPV, 10_000n);
  await seedMockLedger({
    wptPriceVnd: PRICE,
    paymentBalances: { [investor.address]: 1_000_000_000n, [SPV]: 1_000_000_000n },
    paymentAllowances: { [investor.address]: 0n },
  });
}

type Prepared = Awaited<ReturnType<typeof preparePermit>> & { ok: true };

/** Đúng việc màn hình làm: đổi số chuỗi về bigint rồi ký typed data máy chủ đã dựng. */
async function signPrepared(prepared: Prepared['data'], signer: PrivateKeyAccount = investor) {
  const { typedData } = prepared;
  const signature = await signer.signTypedData({
    domain: { ...typedData.domain, verifyingContract: typedData.domain.verifyingContract as `0x${string}` },
    types: typedData.types,
    primaryType: typedData.primaryType,
    message: {
      owner: typedData.message.owner as `0x${string}`,
      spender: typedData.message.spender as `0x${string}`,
      value: BigInt(typedData.message.value),
      nonce: BigInt(typedData.message.nonce),
      deadline: BigInt(typedData.message.deadline),
    },
  });
  return { value: prepared.value, deadline: prepared.deadline, nonce: prepared.nonce, signature };
}

async function prepare(side: 'BUY' | 'SELL', wptAmount: string) {
  const prepared = await preparePermit({ chain: CHAIN, investorWallet: investor.address, side, wptAmount });
  expect(prepared.ok, prepared.ok ? '' : prepared.error).toBe(true);
  return (prepared as Prepared).data;
}

async function orderCount() {
  return getOrderStore().countOrders({});
}

beforeEach(async () => {
  sim.now = 1_800_000_000n;
  sim.nonces.clear();
  sim.wptAllowances.clear();
  sim.calls.length = 0;
  investor = privateKeyToAccount(generatePrivateKey());
  other = privateKeyToAccount(generatePrivateKey());
  await resetMockLedger();
  resetMemoryStore();
  resetStoreCache();
  process.env.USE_MOCK_DB = 'true';
  actAs('INVESTOR');
  await seedMarket();
});

afterEach(() => {
  delete process.env.DEMO_ROLE;
  delete process.env.USE_MOCK_DB;
  resetServerEnvCache();
  resetStoreCache();
});

describe('FE-05 ca 1: preparePermit', () => {
  it('mua 100 WPT: value 10.000.000, spender OrderSettlement, token VNDB, nonce và deadline theo chuỗi', async () => {
    sim.nonces.set(nonceKey('payment', investor.address), 3n);
    const data = await prepare('BUY', '100');
    expect(data.value).toBe('10000000');
    expect(data.vndAmount).toBe('10000000');
    expect(data.tokenSymbol).toBe('VNDB');
    expect(data.nonce).toBe('3');
    expect(data.deadline).toBe((sim.now + 1_800n).toString());
    expect(data.typedData.domain).toEqual({
      name: TOKEN_NAMES.payment,
      version: '1',
      chainId: 31337,
      verifyingContract: tokenAddress('payment'),
    });
    expect(data.typedData.message.spender.toLowerCase()).toBe(SETTLEMENT.toLowerCase());
    expect(data.typedData.message.owner.toLowerCase()).toBe(investor.address.toLowerCase());
  });

  it('bán 40 WPT: value 40, verifyingContract ProjectToken', async () => {
    const data = await prepare('SELL', '40');
    expect(data.value).toBe('40');
    expect(data.tokenSymbol).toBe('WPT');
    expect(data.typedData.domain.verifyingContract).toBe(tokenAddress('project'));
  });

  it('mock, chain thiếu OrderSettlement và vai không có order:place đều bị chặn', async () => {
    const base = { investorWallet: investor.address, wptAmount: '1', side: 'BUY' };
    const onMock = await preparePermit({ ...base, chain: 'mock' });
    expect(onMock).toMatchObject({ ok: false, code: 'VALIDATION' });

    const noSettlement = await preparePermit({ ...base, chain: 'evm' });
    expect(noSettlement).toMatchObject({ ok: false, code: 'LEDGER' });
    expect(noSettlement.ok ? '' : noSettlement.error).toMatch(/chưa có địa chỉ OrderSettlement/);

    actAs('TELLER');
    expect(await preparePermit({ ...base, chain: CHAIN })).toMatchObject({ ok: false, code: 'FORBIDDEN' });
  });
});

describe('FE-05 ca 2: kiểm chữ ký khi đặt lệnh', () => {
  it('chữ ký đúng tạo lệnh, lưu chữ ký và khớp bằng buyWithPermit', async () => {
    const data = await prepare('BUY', '100');
    const placed = await placeOrder({
      chain: CHAIN,
      investorWallet: investor.address,
      wptAmount: '100',
      side: 'BUY',
      clientRequestId: crypto.randomUUID(),
      permit: await signPrepared(data),
    });
    expect(placed.ok, placed.ok ? '' : placed.error).toBe(true);
    if (!placed.ok) return;
    expect(placed.data.status).toBe('COMPLETED');
    expect(sim.calls).toEqual(['buyWithPermit']);
    const stored = await getOrderStore().findOrder(placed.data.id);
    expect(stored?.permit).toMatchObject({ value: 10_000_000n, nonce: 0n, spender: SETTLEMENT.toLowerCase() });
  });

  /** Mỗi biến thể là một cách chữ ký hoặc payload lệch khỏi lệnh; tất cả phải VALIDATION, không bản ghi. */
  const variants: Array<[string, (data: Prepared['data']) => Promise<Record<string, unknown>>]> = [
    ['chữ ký của ví khác', async (data) => signPrepared(data, other)],
    ['value khác số lệnh', async (data) => ({ ...(await signPrepared(data)), value: '9999999' })],
    ['nonce trong payload khác nonce đã ký', async (data) => ({ ...(await signPrepared(data)), nonce: '1' })],
    ['deadline khác số đã ký', async (data) => ({ ...(await signPrepared(data)), deadline: (BigInt(data.deadline) + 1n).toString() })],
    [
      'ký cho spender khác',
      async (data) =>
        signPrepared({
          ...data,
          typedData: { ...data.typedData, message: { ...data.typedData.message, spender: other.address } },
        }),
    ],
    [
      'ký trên token khác (domain ProjectToken cho lệnh mua)',
      async (data) =>
        signPrepared({
          ...data,
          typedData: {
            ...data.typedData,
            domain: { ...data.typedData.domain, name: TOKEN_NAMES.project, verifyingContract: tokenAddress('project') },
          },
        }),
    ],
    ['chữ ký sai khuôn', async (data) => ({ ...(await signPrepared(data)), signature: '0x1234' })],
    ['payload có trường lạ', async (data) => ({ ...(await signPrepared(data)), token: tokenAddress('payment') })],
  ];

  it.each(variants)('%s: VALIDATION, số bản ghi lệnh không đổi', async (_label, build) => {
    const data = await prepare('BUY', '100');
    const before = await orderCount();
    const result = await placeOrder({
      chain: CHAIN,
      investorWallet: investor.address,
      wptAmount: '100',
      side: 'BUY',
      clientRequestId: crypto.randomUUID(),
      permit: await build(data),
    });
    expect(result).toMatchObject({ ok: false, code: 'VALIDATION' });
    expect(await orderCount()).toBe(before);
    expect(sim.calls).toEqual([]);
  });
});

describe('FE-05 ca 3: giá đổi giữa chuẩn bị và đặt lệnh', () => {
  it('ký theo 100.000, giá thành 110.000: từ chối "giá đã đổi..., ký lại", không tạo lệnh', async () => {
    const data = await prepare('BUY', '100');
    const permit = await signPrepared(data);
    await seedMockLedger({ wptPriceVnd: 110_000n });
    const result = await placeOrder({
      chain: CHAIN,
      investorWallet: investor.address,
      wptAmount: '100',
      side: 'BUY',
      clientRequestId: crypto.randomUUID(),
      permit,
    });
    expect(result).toMatchObject({ ok: false, code: 'VALIDATION' });
    expect(result.ok ? '' : result.error).toMatch(/giá đã đổi.*ký lại/i);
    expect(await orderCount()).toBe(0);
  });
});

describe('FE-05 ca 6a, 7a: phân loại nonce', () => {
  it('6a: chữ ký đã bị gửi trước nhưng ủy quyền đủ: nhận, lệnh COMPLETED', async () => {
    const data = await prepare('BUY', '10');
    const permit = await signPrepared(data);
    // Bên khác gửi permit bằng chính chữ ký này: nonce tăng, ủy quyền bằng số đã ký.
    sim.nonces.set(nonceKey('payment', investor.address), 1n);
    await seedMockLedger({ paymentAllowances: { [investor.address]: BigInt(data.value) } });
    const placed = await placeOrder({
      chain: CHAIN,
      investorWallet: investor.address,
      wptAmount: '10',
      side: 'BUY',
      clientRequestId: crypto.randomUUID(),
      permit,
    });
    expect(placed.ok, placed.ok ? '' : placed.error).toBe(true);
    if (placed.ok) expect(placed.data.status).toBe('COMPLETED');
  });

  it('7a: hai lệnh tuần tự ký cùng nonce, ủy quyền ban đầu 0: lệnh 2 "đã được dùng, ký lại", không bản ghi', async () => {
    const first = await signPrepared(await prepare('BUY', '10'));
    const second = await signPrepared(await prepare('BUY', '10'));
    expect(first.nonce).toBe(second.nonce);

    const one = await placeOrder({
      chain: CHAIN,
      investorWallet: investor.address,
      wptAmount: '10',
      side: 'BUY',
      clientRequestId: crypto.randomUUID(),
      permit: first,
    });
    expect(one.ok && one.data.status).toBe('COMPLETED');
    const before = await orderCount();
    const balance = await getLedger(CHAIN).paymentBalanceOf(investor.address);

    const two = await placeOrder({
      chain: CHAIN,
      investorWallet: investor.address,
      wptAmount: '10',
      side: 'BUY',
      clientRequestId: crypto.randomUUID(),
      permit: second,
    });
    expect(two).toMatchObject({ ok: false, code: 'VALIDATION' });
    expect(two.ok ? '' : two.error).toMatch(/đã được dùng, ký lại/);
    expect(await orderCount()).toBe(before);
    expect(await getLedger(CHAIN).paymentBalanceOf(investor.address)).toBe(balance);
  });

  it('nonce đã ký lớn hơn nonce hiện tại: "chữ ký không hợp lệ"', async () => {
    sim.nonces.set(nonceKey('payment', investor.address), 5n);
    const data = await prepare('BUY', '10');
    const permit = await signPrepared(data);
    sim.nonces.set(nonceKey('payment', investor.address), 4n);
    const result = await placeOrder({
      chain: CHAIN,
      investorWallet: investor.address,
      wptAmount: '10',
      side: 'BUY',
      clientRequestId: crypto.randomUUID(),
      permit,
    });
    expect(result.ok ? '' : result.error).toMatch(/Chữ ký không hợp lệ/);
  });

  it('chữ ký còn dưới 2 phút: "sắp hết hạn, ký lại"', async () => {
    const permit = await signPrepared(await prepare('BUY', '10'));
    sim.now += 1_800n - 119n;
    const result = await placeOrder({
      chain: CHAIN,
      investorWallet: investor.address,
      wptAmount: '10',
      side: 'BUY',
      clientRequestId: crypto.randomUUID(),
      permit,
    });
    expect(result.ok ? '' : result.error).toMatch(/sắp hết hạn, ký lại/);
    expect(await orderCount()).toBe(0);
  });

  it('gửi lại cùng clientRequestId sau khi chữ ký đã dùng: trả lệnh cũ, không từ chối', async () => {
    const permit = await signPrepared(await prepare('BUY', '10'));
    const request = {
      chain: CHAIN,
      investorWallet: investor.address,
      wptAmount: '10',
      side: 'BUY',
      clientRequestId: crypto.randomUUID(),
      permit,
    };
    const first = await placeOrder(request);
    const again = await placeOrder(request);
    expect(first.ok && again.ok && again.data.id === first.data.id).toBe(true);
    expect(sim.calls).toEqual(['buyWithPermit']);
  });

  it('bán: ký WPT, khớp bằng sellWithPermit, không cần approve trước', async () => {
    await placeOrder({
      chain: CHAIN,
      investorWallet: investor.address,
      wptAmount: '100',
      side: 'BUY',
      clientRequestId: crypto.randomUUID(),
      permit: await signPrepared(await prepare('BUY', '100')),
    });
    expect(sim.wptAllowances.get(investor.address.toLowerCase()) ?? 0n).toBe(0n);
    const sold = await placeOrder({
      chain: CHAIN,
      investorWallet: investor.address,
      wptAmount: '40',
      side: 'SELL',
      clientRequestId: crypto.randomUUID(),
      permit: await signPrepared(await prepare('SELL', '40')),
    });
    expect(sold.ok && sold.data.status).toBe('COMPLETED');
    expect(sim.calls).toEqual(['buyWithPermit', 'sellWithPermit']);
    expect(await getLedger(CHAIN).balanceOf(investor.address)).toBe(60n);
  });
});

describe('FE-05 ca 9: cổng công khai trên chain thật bắt buộc chữ ký', () => {
  it('server action và POST /api/purchase không permit: VALIDATION kể cả khi đã approve đủ', async () => {
    await seedMockLedger({ paymentAllowances: { [investor.address]: 10_000_000_000n } });
    const body = {
      chain: CHAIN,
      investorWallet: investor.address,
      wptAmount: '10',
      side: 'BUY',
      clientRequestId: crypto.randomUUID(),
    };
    const viaAction = await placeOrderAction(body);
    expect(viaAction).toMatchObject({ ok: false, code: 'VALIDATION' });
    expect(viaAction.ok ? '' : viaAction.error).toMatch(/cần chữ ký ủy quyền từ ví/);

    const response = await purchaseRoute.POST(
      new Request('http://localhost/api/purchase', {
        method: 'POST',
        body: JSON.stringify({ ...body, clientRequestId: crypto.randomUUID() }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, code: 'VALIDATION' });
    expect(await orderCount()).toBe(0);
    expect(sim.calls).toEqual([]);
  });

  it('gửi permit trên mock: VALIDATION, không tạo lệnh', async () => {
    const result = await placeOrder({
      chain: 'mock',
      investorWallet: investor.address,
      wptAmount: '1',
      side: 'BUY',
      clientRequestId: crypto.randomUUID(),
      permit: { value: '1', deadline: '1', nonce: '0', signature: `0x${'1'.repeat(130)}` },
    });
    expect(result).toMatchObject({ ok: false, code: 'VALIDATION' });
    expect(await orderCount()).toBe(0);
  });
});

describe('FE-05 ca 10: chữ ký không lộ ra ngoài', () => {
  it('OrderView, GET/POST /api/purchase và audit của lệnh không chứa r, s hay chữ ký', async () => {
    const permit = await signPrepared(await prepare('BUY', '100'));
    const r = permit.signature.slice(2, 66).toLowerCase();
    const s = permit.signature.slice(66, 130).toLowerCase();
    const leaks = (text: string) => {
      const lower = text.toLowerCase();
      return lower.includes(r) || lower.includes(s) || lower.includes(permit.signature.toLowerCase());
    };

    const response = await purchaseRoute.POST(
      new Request('http://localhost/api/purchase', {
        method: 'POST',
        body: JSON.stringify({
          chain: CHAIN,
          investorWallet: investor.address,
          wptAmount: '100',
          side: 'BUY',
          clientRequestId: crypto.randomUUID(),
          permit,
        }),
      }),
    );
    const posted = await response.text();
    expect(response.status).toBe(200);
    expect(leaks(posted)).toBe(false);
    expect(posted).not.toMatch(/"permit"/);

    const listed = await purchaseRoute.GET(
      new Request(`http://localhost/api/purchase?chain=${CHAIN}&investorWallet=${investor.address}`),
    );
    const listedText = await listed.text();
    expect(listedText).toContain('COMPLETED');
    expect(leaks(listedText)).toBe(false);

    const views = await listOrders({ chain: CHAIN, investorWallet: investor.address });
    expect(views.ok && views.data.length).toBe(1);
    expect(leaks(JSON.stringify(views))).toBe(false);

    const audit = await getStore().listAudit({ limit: 500 });
    expect(audit.length).toBeGreaterThan(0);
    expect(leaks(JSON.stringify(audit))).toBe(false);
  });
});

describe('FE-05 ca 11 (phần xem trước) và ca 13: mock không đổi', () => {
  it('xem trước trên chain thật, ủy quyền 0: đạt, chi tiết "sẽ cấp bằng chữ ký"; thiếu VNDB vẫn chặn', async () => {
    const preview = await previewPurchase({ chain: CHAIN, investorWallet: investor.address, wptAmount: '10' });
    expect(preview.ok && preview.data.canPlaceOrder).toBe(true);
    const allowance = preview.ok ? preview.data.checks.find((c) => c.id === 'allowance') : undefined;
    expect(allowance).toMatchObject({ ok: true, detail: expect.stringMatching(/sẽ cấp bằng chữ ký/i) });

    await seedMockLedger({ paymentBalances: { [investor.address]: 0n } });
    const poor = await previewPurchase({ chain: CHAIN, investorWallet: investor.address, wptAmount: '10' });
    expect(poor.ok && poor.data.canPlaceOrder).toBe(false);
    expect(poor.ok && poor.data.blockers).toEqual(['paymentBalance']);
  });

  it('mock: xem trước vẫn đòi ủy quyền thực tế; đặt lệnh không hỏi ký', async () => {
    const ledger = getLedger('mock');
    await seedMockLedger({ paymentAllowances: { [investor.address]: 0n } });
    const blocked = await previewPurchase({ chain: 'mock', investorWallet: investor.address, wptAmount: '10' });
    expect(blocked.ok && blocked.data.blockers).toEqual(['allowance']);

    await seedMockLedger({ paymentAllowances: { [investor.address]: 1_000_000n } });
    expect(await ledger.paymentAllowanceOf(investor.address)).toBe(1_000_000n);
    const placed = await placeOrder({
      chain: 'mock',
      investorWallet: investor.address,
      wptAmount: '10',
      side: 'BUY',
      clientRequestId: crypto.randomUUID(),
    });
    expect(placed.ok && placed.data.status).toBe('COMPLETED');
    const stored = placed.ok ? await getOrderStore().findOrder(placed.data.id) : null;
    expect(stored?.permit).toBeNull();
    expect(sim.calls).toEqual([]);
  });

  it('client gửi trường lạ (kiểu tự khai đã ủy quyền) vào xem trước: bị loại', async () => {
    const result = await previewPurchase({
      chain: CHAIN,
      investorWallet: investor.address,
      wptAmount: '10',
      allowanceSource: { kind: 'signed' },
    });
    expect(result).toMatchObject({ ok: false, code: 'VALIDATION' });
  });
});
