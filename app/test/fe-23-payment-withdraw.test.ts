import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from 'pg';
import { createPublicClient, createWalletClient, decodeFunctionData, http, type Account, type Hex } from 'viem';
import { hardhat } from 'viem/chains';
import {
  getContractAddress,
  MOCK_PROFIT_DISTRIBUTOR_ADDRESS,
  MOCK_VAULT_ADDRESS,
  PUBLIC_SAMPLE_WALLETS,
  SAMPLE_WALLETS,
  vaultAddressFor,
  vndTokenAbi,
  type ChainKey,
} from '@bidv/shared';
import type { ILedgerPort, PaymentTransferEvidence, PaymentTransferQuery, TxResult } from '@/lib/ledger';

/**
 * FE-23 ca 1 tới 14 (gồm 12b, 12c, 12d), requirements mục 7.
 *
 * Chain `mock` dùng ledger mock thật (máy chủ chuyển thay ví, QĐ-4). Chain `evm` dùng một chuỗi GIẢ
 * dựng trong tệp (bọc `getLedger` bằng `vi.mock`): test tự "phát" giao dịch với người gửi, dữ liệu gọi,
 * log `Transfer`, kết cục tuỳ ý, nên dựng được các ca mà ví thật mới gây ra (mất mã, tăng tốc, khai
 * sai mã). Ba phương thức đọc của chuỗi giả theo đúng luật của adapter EVM: biên nhận chỉ giải log của
 * hợp đồng VNDB; quét theo nhãn lọc người gửi, người nhận, số lượng, rồi đọc giao dịch và chỉ nhận khi
 * người gửi là ví gửi và `input` kết thúc bằng nhãn.
 */

interface FakeTx {
  hash: string;
  from: string;
  input: Hex;
  status: 'CONFIRMED' | 'FAILED' | 'PENDING';
  blockNumber: bigint;
  logs: Array<{ address: string; from: string; to: string; value: bigint }>;
}

const VND = getContractAddress('evm', 'VNDToken');
const lower = (value: string) => value.toLowerCase();

const evm = {
  whitelisted: new Set<string>(),
  balances: new Map<string, bigint>(),
  block: 100n,
  txs: new Map<string, FakeTx>(),
};

const hooks: {
  /** Ném sau khi `mockTransferPayment` đã chuyển (ca 12d). */
  failAfterMockTransfer: boolean;
  mockTransferCalls: number;
} = { failAfterMockTransfer: false, mockTransferCalls: 0 };

function fakeEvmLedger(): ILedgerPort {
  const impl = {
    chain: 'evm' as ChainKey,
    async spvWallet() {
      return null;
    },
    async isWhitelisted(wallet: string) {
      return evm.whitelisted.has(lower(wallet));
    },
    async paymentBalanceOf(wallet: string) {
      return evm.balances.get(lower(wallet)) ?? 0n;
    },
    async latestBlockNumber() {
      return evm.block;
    },
    async paymentTxSender(txHash: string) {
      return evm.txs.get(lower(txHash))?.from ?? null;
    },
    async paymentTransferReceipt(txHash: string): Promise<PaymentTransferEvidence> {
      const tx = evm.txs.get(lower(txHash));
      if (!tx) return { status: 'UNKNOWN', txFrom: null, input: null, transfers: [] };
      if (tx.status === 'PENDING') return { status: 'PENDING', txFrom: tx.from, input: tx.input, transfers: [] };
      return {
        status: tx.status,
        txFrom: tx.from,
        input: tx.input,
        transfers: tx.logs.filter((log) => lower(log.address) === lower(VND)).map(({ from, to, value }) => ({ from, to, value })),
      };
    },
    async findPaymentTransferByTag({ from, to, value, tag, fromBlock }: PaymentTransferQuery) {
      const candidates = [...evm.txs.values()]
        .filter((tx) => tx.status === 'CONFIRMED' && tx.blockNumber >= fromBlock)
        .filter((tx) =>
          tx.logs.some(
            (log) => lower(log.address) === lower(VND) && lower(log.from) === lower(from) && lower(log.to) === lower(to) && log.value === value,
          ),
        )
        .sort((a, b) => (a.blockNumber < b.blockNumber ? -1 : a.blockNumber > b.blockNumber ? 1 : 0));
      const found = candidates.find((tx) => lower(tx.from) === lower(from) && lower(tx.input).endsWith(lower(tag).slice(2)));
      return found ? { txHash: found.hash, blockNumber: found.blockNumber } : null;
    },
  };
  return new Proxy(impl, {
    get(target, property) {
      if (property in target) return Reflect.get(target, property);
      if (property === 'mockTransferPayment' || property === 'then') return undefined;
      return () => {
        throw new Error(`Chuỗi giả không có ${String(property)}`);
      };
    },
  }) as unknown as ILedgerPort;
}

vi.mock('@/lib/ledger', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/ledger')>();
  const instrument = (ledger: ILedgerPort): ILedgerPort =>
    new Proxy(ledger, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (property === 'mockTransferPayment' && typeof value === 'function') {
          return async (...args: [string, string, bigint, `0x${string}`]): Promise<TxResult> => {
            hooks.mockTransferCalls += 1;
            const result = await (value as (...input: typeof args) => Promise<TxResult>).apply(target, args);
            if (hooks.failAfterMockTransfer) throw new Error('Mô phỏng mất kết nối sau khi chuyển.');
            return result;
          };
        }
        return value;
      },
    });
  return {
    ...mod,
    getLedger: (chain: ChainKey, signer?: Parameters<typeof mod.getLedger>[1]) =>
      chain === 'evm' ? fakeEvmLedger() : instrument(mod.getLedger(chain, signer)),
  };
});

const { resetServerEnvCache } = await import('@/lib/config/env');
const { getLedger, getMockLedgerStateStore } = await import('@/lib/ledger');
const { resetMockLedger, seedMockLedger } = await import('@/lib/ledger/mock.adapter');
const { getPaymentWithdrawStore, getStore, resetMemoryStore, resetStoreCache, UniqueConstraintError } = await import('@/lib/store');
const {
  beginPaymentSend,
  cancelPaymentWithdraw,
  createPaymentWithdraw,
  getPaymentWithdrawPage,
  matchesTransfer,
  paymentTag,
  submitPaymentWithdrawTx,
} = await import('@/lib/bank/payment-withdraw.service');
const { bindWalletForTest } = await import('./helpers/wallet-binding');

/** Ví gửi và ví nhận trên chuỗi giả `evm` (không phải ví mẫu công khai). */
const INV = '0x1111111111111111111111111111111111111111';
const RECEIVER = '0x2222222222222222222222222222222222222222';
const OTHER = '0x3333333333333333333333333333333333333333';
const STRANGER = '0x4444444444444444444444444444444444444444';
const MOCK_INV = SAMPLE_WALLETS.NDT001;
const MOCK_RECEIVER = SAMPLE_WALLETS.NB001;

let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${(++seq).toString(16).padStart(12, '0')}`;
let hashSeq = 0;
const nextHash = () => `0x${(0xabc000 + ++hashSeq).toString(16).padStart(64, '0')}`;

function actAs(role: string, actor?: string) {
  process.env.DEMO_ROLE = role;
  if (actor === undefined) delete process.env.DEMO_ACTOR;
  else process.env.DEMO_ACTOR = actor;
  resetServerEnvCache();
}

function resetEvm() {
  evm.whitelisted = new Set([lower(RECEIVER), lower(OTHER)]);
  evm.balances = new Map([[lower(INV), 1_000n]]);
  evm.block = 100n;
  evm.txs = new Map();
}

/** Ví "phát" một giao dịch lên chuỗi giả. Mặc định: đúng lần chuyển của lệnh, có nhãn, thành công. */
function broadcast(input: {
  id?: string;
  hash?: string;
  from?: string;
  to?: string;
  amount?: bigint;
  data?: Hex;
  status?: FakeTx['status'];
  logs?: FakeTx['logs'];
  extraLogs?: FakeTx['logs'];
}): FakeTx {
  evm.block += 1n;
  const from = input.from ?? INV;
  const to = input.to ?? RECEIVER;
  const amount = input.amount ?? 100n;
  const tx: FakeTx = {
    hash: lower(input.hash ?? nextHash()),
    from,
    input: input.data ?? (`0xa9059cbb${'0'.repeat(128)}${input.id ? paymentTag(input.id).slice(2) : ''}` as Hex),
    status: input.status ?? 'CONFIRMED',
    blockNumber: evm.block,
    logs: input.logs ?? [{ address: VND, from, to, value: amount }, ...(input.extraLogs ?? [])],
  };
  evm.txs.set(tx.hash, tx);
  return tx;
}

const request = (input: Partial<{ chain: ChainKey; wallet: string; toWallet: string; amount: string; otp: string; clientRequestId: string; purpose: string }> = {}) =>
  createPaymentWithdraw({
    chain: 'evm',
    wallet: INV,
    toWallet: RECEIVER,
    amount: '100',
    purpose: 'Chuyển sang ví khác',
    otp: '123456',
    clientRequestId: uuid(),
    ...input,
  });

async function created(input: Parameters<typeof request>[0] = {}) {
  const result = await request(input);
  if (!result.ok) throw new Error(`Tạo lệnh lỗi: ${result.error}`);
  return result.data;
}

async function sending(input: Parameters<typeof request>[0] = {}) {
  const view = await created(input);
  const begun = await beginPaymentSend({ chain: input.chain ?? 'evm', id: view.id });
  if (!begun.ok) throw new Error(`A8 lỗi: ${begun.error}`);
  return begun.data;
}

const status = async (id: string) => (await getPaymentWithdrawStore().findById(id))?.status;
const audits = async () => (await getStore().listAudit({ limit: 500 })).filter((row) => row.action === 'payment:withdraw');
const page = (chain: ChainKey = 'evm', wallet = INV) => getPaymentWithdrawPage({ chain, wallet });

beforeEach(async () => {
  hooks.failAfterMockTransfer = false;
  hooks.mockTransferCalls = 0;
  process.env.USE_MOCK_DB = 'true';
  await resetMockLedger();
  resetMemoryStore();
  resetStoreCache();
  resetEvm();
  actAs('INVESTOR', 'NDT001');
  await bindWalletForTest('evm', INV, 'NDT001');
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.DEMO_ROLE;
  delete process.env.DEMO_ACTOR;
  delete process.env.USE_MOCK_DB;
  resetServerEnvCache();
  resetStoreCache();
});

async function seedMock(balance = 1_000n) {
  await seedMockLedger({ paymentBalances: { [MOCK_INV]: balance } }, getMockLedgerStateStore('mock'));
  await getLedger('mock').whitelist(MOCK_RECEIVER);
}

describe('FE-23 ca 1, 2: mock và chốt chặn ví gửi', () => {
  it('ca 1: mock, A1 rồi A8: COMPLETED, ví gửi giảm, ví nhận tăng đúng số; audit SUCCESS', async () => {
    await seedMock();
    const ledger = getLedger('mock');
    const before = await ledger.paymentBalanceOf(MOCK_RECEIVER);
    const view = await created({ chain: 'mock', wallet: MOCK_INV, toWallet: MOCK_RECEIVER, amount: '250' });
    expect(view.status).toBe('CREATED');
    expect(await ledger.paymentBalanceOf(MOCK_INV)).toBe(1_000n);
    const done = await beginPaymentSend({ chain: 'mock', id: view.id });
    expect(done.ok && done.data, done.ok ? '' : done.error).toMatchObject({ status: 'COMPLETED', txRequest: null });
    expect(done.ok && done.data.completedTxHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(await ledger.paymentBalanceOf(MOCK_INV)).toBe(750n);
    expect(await ledger.paymentBalanceOf(MOCK_RECEIVER)).toBe(before + 250n);
    expect((await audits()).map((row) => row.outcome)).toEqual(expect.arrayContaining(['SUCCESS']));
    expect((await audits()).some((row) => row.outcome === 'SUCCESS' && row.detail?.includes('hoàn tất'))).toBe(true);
  });

  it('ca 2: ví gửi chưa định danh: WALLET_NOT_BOUND, không tạo lệnh', async () => {
    evm.balances.set(lower(STRANGER), 1_000n);
    const result = await request({ wallet: STRANGER });
    expect(result).toMatchObject({ ok: false, code: 'WALLET_NOT_BOUND' });
    expect(await getPaymentWithdrawStore().findActive('evm', STRANGER)).toBeNull();
    expect(await getPaymentWithdrawStore().listByWallet('evm', STRANGER, { limit: 10 })).toEqual([]);
  });
});

describe('FE-23 ca 3: ví nhận bị từ chối', () => {
  const evmCases: Array<[string, string]> = [
    ['chưa whitelist', STRANGER],
    ['bằng ví gửi', INV],
    ['địa chỉ 0', '0x0000000000000000000000000000000000000000'],
    ['địa chỉ hợp đồng VNDB', VND],
    ['vault của chain', vaultAddressFor('evm')!],
    ['ví mẫu công khai', PUBLIC_SAMPLE_WALLETS[0]!],
  ];
  for (const [label, toWallet] of evmCases) {
    it(`evm, ${label}: từ chối, không tạo lệnh, audit FAILURE`, async () => {
      evm.whitelisted.add(lower(toWallet));
      if (label === 'chưa whitelist') evm.whitelisted.delete(lower(toWallet));
      const result = await request({ toWallet });
      expect(result).toMatchObject({ ok: false, code: 'VALIDATION' });
      expect(result.ok ? null : Object.keys(result.fieldErrors ?? {})).toEqual(['toWallet']);
      expect(await getPaymentWithdrawStore().listByWallet('evm', INV, { limit: 10 })).toEqual([]);
      expect((await audits()).map((row) => row.outcome)).toContain('FAILURE');
    });
  }

  for (const [label, toWallet] of [
    ['vault mock', MOCK_VAULT_ADDRESS],
    ['quỹ chia lợi nhuận mock', MOCK_PROFIT_DISTRIBUTOR_ADDRESS],
  ] as const) {
    it(`mock, ${label}: từ chối, không tạo lệnh, audit FAILURE`, async () => {
      await seedMock();
      await getLedger('mock').whitelist(MOCK_PROFIT_DISTRIBUTOR_ADDRESS);
      const result = await request({ chain: 'mock', wallet: MOCK_INV, toWallet });
      expect(result).toMatchObject({ ok: false, code: 'VALIDATION' });
      expect(await getPaymentWithdrawStore().listByWallet('mock', MOCK_INV, { limit: 10 })).toEqual([]);
      expect((await audits()).map((row) => row.outcome)).toContain('FAILURE');
    });
  }
});

describe('FE-23 ca 4: số dư, mã một lần', () => {
  it('vượt số dư: từ chối; mã một lần sai: từ chối, không dòng audit nào chứa mã', async () => {
    expect(await request({ amount: '1001' })).toMatchObject({ ok: false, code: 'VALIDATION', error: 'Số dư VNDB không đủ.' });
    const wrong = await request({ otp: '98765' });
    expect(wrong).toMatchObject({ ok: false, code: 'VALIDATION' });
    const all = await getStore().listAudit({ limit: 500 });
    expect(all.some((row) => row.detail?.includes('98765') || row.target?.includes('98765'))).toBe(false);
    expect(await getPaymentWithdrawStore().listByWallet('evm', INV, { limit: 10 })).toEqual([]);
  });
});

describe('FE-23 ca 5: giao dịch cần gửi chỉ trả một lần', () => {
  it('A1 không trả giao dịch; A8 trả đúng `to`, calldata `transfer` nối nhãn; A8 lần hai và A1 gọi lại không trả giao dịch', async () => {
    const clientRequestId = uuid();
    const first = await request({ clientRequestId });
    expect(first.ok, first.ok ? '' : first.error).toBe(true);
    if (!first.ok) return;
    expect('txRequest' in first.data).toBe(false);

    const begun = await beginPaymentSend({ chain: 'evm', id: first.data.id });
    expect(begun.ok && begun.data.status).toBe('SENDING');
    const txRequest = begun.ok ? begun.data.txRequest : null;
    expect(txRequest).toMatchObject({ chainId: 11155111, to: VND, value: '0' });
    const data = txRequest!.data;
    expect(data.slice(-64)).toBe(paymentTag(first.data.id).slice(2));
    const decoded = decodeFunctionData({ abi: vndTokenAbi, data: data.slice(0, -64) as Hex });
    expect(decoded.functionName).toBe('transfer');
    expect(decoded.args?.map(String)).toEqual([RECEIVER, '100']);

    const again = await beginPaymentSend({ chain: 'evm', id: first.data.id });
    expect(again).toMatchObject({ ok: false, code: 'WITHDRAW_STATE', error: 'Lệnh đã được gửi tới ví; chờ kết quả hoặc huỷ.' });
    expect('data' in again).toBe(false);

    const retried = await request({ clientRequestId });
    expect(retried.ok && retried.data).toMatchObject({ id: first.data.id, status: 'SENDING' });
    expect(retried.ok && 'txRequest' in retried.data).toBe(false);
  });
});

describe('FE-23 ca 6 tới 9: báo mã và bằng chứng', () => {
  it('ca 6: người gửi khác ví gửi: từ chối, lệnh giữ SENDING; nút chưa thấy giao dịch: vẫn SUBMITTED', async () => {
    const view = await sending();
    const foreign = broadcast({ from: OTHER, id: view.id });
    expect(await submitPaymentWithdrawTx({ chain: 'evm', id: view.id, txHash: foreign.hash })).toMatchObject({
      ok: false,
      code: 'WITHDRAW_STATE',
    });
    expect(await status(view.id)).toBe('SENDING');
    const unseen = await submitPaymentWithdrawTx({ chain: 'evm', id: view.id, txHash: nextHash() });
    expect(unseen.ok && unseen.data.status).toBe('SUBMITTED');
  });

  it('ca 7: biên nhận CONFIRMED, đúng người gửi, đúng nhãn, Transfer khớp (cùng log khác): COMPLETED', async () => {
    const view = await sending();
    const tx = broadcast({ id: view.id, extraLogs: [{ address: VND, from: OTHER, to: STRANGER, value: 5n }] });
    const result = await submitPaymentWithdrawTx({ chain: 'evm', id: view.id, txHash: tx.hash });
    expect(result.ok && result.data).toMatchObject({ status: 'COMPLETED', completedTxHash: tx.hash });
    expect((await getPaymentWithdrawStore().findById(view.id))?.activeWallet).toBeNull();
  });

  const mismatches: Array<[string, (id: string) => Parameters<typeof broadcast>[0]]> = [
    ['sai số', (id) => ({ id, logs: [{ address: VND, from: INV, to: RECEIVER, value: 99n }] })],
    ['sai ví nhận', (id) => ({ id, logs: [{ address: VND, from: INV, to: OTHER, value: 100n }] })],
    ['sai người gửi giao dịch', (id) => ({ id, from: OTHER, logs: [{ address: VND, from: INV, to: RECEIVER, value: 100n }] })],
    ['sai nhãn', () => ({ id: 'lệnh khác' })],
    ['log của hợp đồng khác', (id) => ({ id, logs: [{ address: OTHER, from: INV, to: RECEIVER, value: 100n }] })],
  ];
  for (const [label, make] of mismatches) {
    it(`ca 8: biên nhận khớp ${label}: FAILED sau khi quét theo nhãn không thấy`, async () => {
      const view = await sending();
      const tx = broadcast(make(view.id));
      // Mã do trình duyệt báo; người gửi khác thì A2 đã chặn, nên dựng thẳng SUBMITTED cho ca đó.
      if (label === 'sai người gửi giao dịch') {
        await getPaymentWithdrawStore().transition({ id: view.id, from: 'SENDING', to: 'SUBMITTED', submittedTxHash: tx.hash });
        await page();
      } else {
        await submitPaymentWithdrawTx({ chain: 'evm', id: view.id, txHash: tx.hash });
      }
      const record = await getPaymentWithdrawStore().findById(view.id);
      expect(record?.status).toBe('FAILED');
      expect(record?.completedTxHash).toBeNull();
    });
  }

  it('ca 9: biên nhận FAILED: FAILED; PENDING: giữ SUBMITTED; UNKNOWN quá 30 phút: quét thấy (tăng tốc, cùng nhãn) thì COMPLETED, không thấy thì FAILED', async () => {
    const failedView = await sending();
    const reverted = broadcast({ id: failedView.id, status: 'FAILED' });
    await submitPaymentWithdrawTx({ chain: 'evm', id: failedView.id, txHash: reverted.hash });
    expect(await status(failedView.id)).toBe('FAILED');

    const pendingView = await sending();
    const waiting = broadcast({ id: pendingView.id, status: 'PENDING' });
    await submitPaymentWithdrawTx({ chain: 'evm', id: pendingView.id, txHash: waiting.hash });
    expect(await status(pendingView.id)).toBe('SUBMITTED');
    evm.txs.delete(waiting.hash);

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 31 * 60_000);
    // Giao dịch đã báo bị thay bằng "tăng tốc": mã mới, cùng nhãn.
    const replacement = broadcast({ id: pendingView.id });
    await page();
    expect(await getPaymentWithdrawStore().findById(pendingView.id)).toMatchObject({
      status: 'COMPLETED',
      completedTxHash: replacement.hash,
    });

    const lostView = await sending();
    await submitPaymentWithdrawTx({ chain: 'evm', id: lostView.id, txHash: nextHash() });
    expect(await status(lostView.id)).toBe('SUBMITTED');
    vi.setSystemTime(Date.now() + 31 * 60_000);
    await page();
    expect(await status(lostView.id)).toBe('FAILED');
  });
});

describe('FE-23 ca 10, 11: người khác lệnh, huỷ, lệnh đang dở', () => {
  it('ca 10: người khác lệnh gọi A2, A3, A8: WITHDRAW_STATE; huỷ khi giao dịch đã lên chuỗi: COMPLETED; huỷ không thấy rồi giao dịch vào khối: mở màn trong 24 giờ COMPLETED', async () => {
    const mine = await created();
    actAs('INVESTOR', 'NDT002');
    expect(await beginPaymentSend({ chain: 'evm', id: mine.id })).toMatchObject({ ok: false, code: 'WITHDRAW_STATE' });
    expect(await submitPaymentWithdrawTx({ chain: 'evm', id: mine.id, txHash: nextHash() })).toMatchObject({ ok: false, code: 'WITHDRAW_STATE' });
    expect(await cancelPaymentWithdraw({ chain: 'evm', id: mine.id })).toMatchObject({ ok: false, code: 'WITHDRAW_STATE' });
    actAs('INVESTOR', 'NDT001');
    expect(await status(mine.id)).toBe('CREATED');

    await beginPaymentSend({ chain: 'evm', id: mine.id });
    broadcast({ id: mine.id });
    const rejected = await cancelPaymentWithdraw({ chain: 'evm', id: mine.id, walletRejected: true });
    expect(rejected.ok && rejected.data.status).toBe('COMPLETED');

    const later = await sending();
    const cancelled = await cancelPaymentWithdraw({ chain: 'evm', id: later.id, walletRejected: true });
    expect(cancelled.ok && cancelled.data).toMatchObject({ status: 'CANCELLED', reason: 'Trình duyệt báo người dùng từ chối ký' });
    const lateTx = broadcast({ id: later.id });
    await page();
    expect(await getPaymentWithdrawStore().findById(later.id)).toMatchObject({ status: 'COMPLETED', completedTxHash: lateTx.hash });
  });

  it('ca 11: lệnh đang dở cùng ví chặn lệnh thứ hai; cùng mã cùng nội dung trả lệnh cũ; khác nội dung WITHDRAW_STATE', async () => {
    const clientRequestId = uuid();
    const first = await created({ clientRequestId });
    expect(await request()).toMatchObject({
      ok: false,
      code: 'WITHDRAW_STATE',
      error: 'Ví đang có lệnh rút chưa xong; chờ hoặc huỷ lệnh đó.',
    });
    const same = await request({ clientRequestId });
    expect(same.ok && same.data.id).toBe(first.id);
    expect(await request({ clientRequestId, amount: '101' })).toMatchObject({ ok: false, code: 'WITHDRAW_STATE' });
    expect(await getPaymentWithdrawStore().listByWallet('evm', INV, { limit: 10 })).toHaveLength(1);
  });
});

describe('FE-23 ca 12: mất phản hồi, hết hạn, nhãn tách lệnh', () => {
  it('ca 12: SENDING, ví đã phát nhưng trình duyệt không báo mã; A1 gọi lại không nhận giao dịch, A8 bị từ chối; đối soát sau 30 phút vẫn quét thấy: COMPLETED; SENDING quá 30 phút không thấy: EXPIRED', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-28T01:00:00Z'));
    const clientRequestId = uuid();
    const view = await sending({ clientRequestId });
    const tx = broadcast({ id: view.id });
    const retried = await request({ clientRequestId });
    expect(retried.ok && 'txRequest' in retried.data).toBe(false);
    expect(await beginPaymentSend({ chain: 'evm', id: view.id })).toMatchObject({ ok: false, code: 'WITHDRAW_STATE' });
    vi.setSystemTime(new Date('2026-10-28T01:31:00Z'));
    await page();
    expect(await getPaymentWithdrawStore().findById(view.id)).toMatchObject({ status: 'COMPLETED', completedTxHash: tx.hash });
    expect([...evm.txs.values()].filter((item) => item.input.endsWith(paymentTag(view.id).slice(2)))).toHaveLength(1);

    const silent = await sending();
    vi.setSystemTime(new Date('2026-10-28T02:05:00Z'));
    await page();
    expect(await status(silent.id)).toBe('EXPIRED');
  });

  it('ca 12b: R1 EXPIRED, R2 SENDING cùng ví nhận, cùng số, cùng khối tạo; giao dịch của R1 vào khối sau: gán cho R1, R2 không nhận', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-28T01:00:00Z'));
    const r1 = await sending();
    vi.setSystemTime(new Date('2026-10-28T01:31:00Z'));
    await page();
    expect(await status(r1.id)).toBe('EXPIRED');
    const r2 = await sending();
    const createdBlocks = await Promise.all([r1.id, r2.id].map(async (id) => (await getPaymentWithdrawStore().findById(id))?.createdBlock));
    expect(createdBlocks[0]).toBe(createdBlocks[1]);
    const tx = broadcast({ id: r1.id });
    await page();
    expect(await getPaymentWithdrawStore().findById(r1.id)).toMatchObject({ status: 'COMPLETED', completedTxHash: tx.hash });
    expect(await getPaymentWithdrawStore().findById(r2.id)).toMatchObject({ status: 'SENDING', completedTxHash: null });
  });

  it('ca 12c: R1 khai mã T của R2; đối soát R2 theo nhãn vẫn nhận T, R1 không nhận T', async () => {
    const r2 = await sending();
    await cancelPaymentWithdraw({ chain: 'evm', id: r2.id });
    expect(await status(r2.id)).toBe('CANCELLED');
    const r1 = await sending();
    const t = nextHash();
    const submitted = await submitPaymentWithdrawTx({ chain: 'evm', id: r1.id, txHash: t });
    expect(submitted.ok && submitted.data.status).toBe('SUBMITTED');
    broadcast({ id: r2.id, hash: t });
    await page();
    expect(await getPaymentWithdrawStore().findById(r2.id)).toMatchObject({ status: 'COMPLETED', completedTxHash: t });
    expect(await getPaymentWithdrawStore().findById(r1.id)).toMatchObject({ status: 'FAILED', completedTxHash: null });
  });

  it('ca 12d: mock, lỗi sau mockTransferPayment trước khi chốt: SENDING; đối soát sau COMPLETED; chuyển lại cùng nhãn không trừ lần hai', async () => {
    await seedMock();
    const ledger = getLedger('mock');
    const view = await created({ chain: 'mock', wallet: MOCK_INV, toWallet: MOCK_RECEIVER, amount: '300' });
    hooks.failAfterMockTransfer = true;
    const broken = await beginPaymentSend({ chain: 'mock', id: view.id });
    expect(broken.ok).toBe(false);
    expect(await status(view.id)).toBe('SENDING');
    expect(await ledger.paymentBalanceOf(MOCK_INV)).toBe(700n);
    hooks.failAfterMockTransfer = false;
    await page('mock', MOCK_INV);
    expect(await status(view.id)).toBe('COMPLETED');
    await ledger.mockTransferPayment!(MOCK_INV, MOCK_RECEIVER, 300n, paymentTag(view.id));
    expect(await ledger.paymentBalanceOf(MOCK_INV)).toBe(700n);
  });
});

describe('FE-23 hàm thuần', () => {
  it('matchesTransfer: đủ ba điều kiện mới đạt', () => {
    const request = { id: 'r1', fromWallet: INV, toWallet: RECEIVER, amount: '100' };
    const input = `0xa9059cbb${'0'.repeat(128)}${paymentTag('r1').slice(2)}` as Hex;
    const transfers = [{ from: INV, to: RECEIVER, value: 100n }];
    expect(matchesTransfer(request, { txFrom: INV.toUpperCase().replace('0X', '0x'), input, transfers })).toBe(true);
    expect(matchesTransfer(request, { txFrom: OTHER, input, transfers })).toBe(false);
    expect(matchesTransfer(request, { txFrom: INV, input: `0xa9059cbb${paymentTag('r2').slice(2)}`, transfers })).toBe(false);
    expect(matchesTransfer(request, { txFrom: INV, input, transfers: [{ from: INV, to: RECEIVER, value: 101n }] })).toBe(false);
  });
});

// =============================================================================
//  CA 13: POSTGRES
// =============================================================================

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const DB_NAME = `bidv_fe23_${process.pid}`;

function isolatedUrl(): string {
  const url = new URL(TEST_DATABASE_URL!);
  url.pathname = `/${DB_NAME}`;
  return url.toString();
}

async function admin(sql: string) {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

describe.skipIf(!TEST_DATABASE_URL)('FE-23 ca 13: Postgres', () => {
  const previous = process.env.DATABASE_URL;

  beforeAll(async () => {
    await admin(`DROP DATABASE IF EXISTS "${DB_NAME}"`);
    await admin(`CREATE DATABASE "${DB_NAME}"`);
  });

  beforeEach(async () => {
    process.env.USE_MOCK_DB = 'false';
    process.env.DATABASE_URL = isolatedUrl();
    resetServerEnvCache();
    resetStoreCache();
    await bindWalletForTest('evm', INV, 'NDT001');
  });

  afterAll(async () => {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    await admin(`DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`);
  });

  it('hai lần tạo đồng thời cùng ví: đúng một lệnh; hai lần A8 đồng thời: đúng một lần trả giao dịch; completedTxHash duy nhất theo chain', async () => {
    const results = await Promise.all([request(), request()]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.find((result) => !result.ok)).toMatchObject({ code: 'WITHDRAW_STATE' });
    const view = results.find((result) => result.ok)!;
    if (!view.ok) return;

    const begun = await Promise.all([
      beginPaymentSend({ chain: 'evm', id: view.data.id }),
      beginPaymentSend({ chain: 'evm', id: view.data.id }),
    ]);
    expect(begun.filter((result) => result.ok && result.data.txRequest !== null)).toHaveLength(1);

    const tx = broadcast({ id: view.data.id });
    const done = await submitPaymentWithdrawTx({ chain: 'evm', id: view.data.id, txHash: tx.hash });
    expect(done.ok && done.data.status).toBe('COMPLETED');

    // Lệnh khác (ví khác) không chốt được cùng mã trên cùng chain.
    const store = getPaymentWithdrawStore();
    const other = await store.create({
      id: uuid(),
      chain: 'evm',
      clientRequestId: uuid(),
      actorId: 'NDT001',
      fromWallet: OTHER,
      toWallet: RECEIVER,
      amount: '1',
      purpose: 'thử',
      note: null,
      createdBlock: '0',
    });
    await store.transition({ id: other.id, from: 'CREATED', to: 'SENDING' });
    await expect(store.transition({ id: other.id, from: 'SENDING', to: 'COMPLETED', completedTxHash: tx.hash })).rejects.toBeInstanceOf(
      UniqueConstraintError,
    );
  });
});

// =============================================================================
//  CA 14: NÚT HARDHAT
// =============================================================================

const HARDHAT_RPC = process.env.TEST_HARDHAT_RPC;
const ADMIN_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

describe.skipIf(!HARDHAT_RPC)('FE-23 ca 14: nút Hardhat', () => {
  const keys = ['RPC_HARDHAT', 'SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL'] as const;
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const investor = SAMPLE_WALLETS.NDT001 as Hex;
  const receiver = SAMPLE_WALLETS.NB001 as Hex;

  beforeAll(async () => {
    process.env.RPC_HARDHAT = HARDHAT_RPC;
    process.env.SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL = ADMIN_KEY;
    const { resetSignerCache } = await import('@/lib/signer');
    const { resetChainRegistryCache } = await import('@/lib/chains/registry');
    resetServerEnvCache();
    resetChainRegistryCache();
    resetSignerCache();
  });

  afterAll(async () => {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
    resetServerEnvCache();
  });

  /** Giả trình duyệt: nút Hardhat mở khoá sẵn ví mẫu, nên gửi bằng account `json-rpc`, không cần khoá riêng. */
  async function sendFromWallet(txRequest: { to: Hex; data: Hex }) {
    const wallet = createWalletClient({ chain: hardhat, transport: http(HARDHAT_RPC) });
    const reader = createPublicClient({ chain: hardhat, transport: http(HARDHAT_RPC) });
    const hash = await wallet.sendTransaction({
      account: { address: investor, type: 'json-rpc' } as Account,
      to: txRequest.to,
      data: txRequest.data,
      chain: hardhat,
    });
    const receipt = await reader.waitForTransactionReceipt({ hash });
    expect(receipt.status).toBe('success');
    return hash;
  }

  it('A1, A8, ví gửi calldata có nhãn: chuyển thành công, số dư đúng; báo mã: COMPLETED; lệnh thứ hai không báo mã: đối soát theo nhãn COMPLETED', async () => {
    const ledger = getLedger('hardhat-local');
    await ledger.waitReceipt((await ledger.whitelist(receiver)).txHash);
    await ledger.waitReceipt((await ledger.mintPayment(investor, 1_000n)).txHash);
    const before = { investor: await ledger.paymentBalanceOf(investor), receiver: await ledger.paymentBalanceOf(receiver) };

    const first = await created({ chain: 'hardhat-local', wallet: investor, toWallet: receiver, amount: '100' });
    const begun = await beginPaymentSend({ chain: 'hardhat-local', id: first.id });
    expect(begun.ok && begun.data.txRequest?.chainId, begun.ok ? '' : begun.error).toBe(31337);
    if (!begun.ok || !begun.data.txRequest) return;
    const hash = await sendFromWallet(begun.data.txRequest);
    expect(await ledger.paymentBalanceOf(investor)).toBe(before.investor - 100n);
    expect(await ledger.paymentBalanceOf(receiver)).toBe(before.receiver + 100n);
    const done = await submitPaymentWithdrawTx({ chain: 'hardhat-local', id: first.id, txHash: hash });
    expect(done.ok && done.data, done.ok ? '' : done.error).toMatchObject({ status: 'COMPLETED', completedTxHash: hash });

    const second = await created({ chain: 'hardhat-local', wallet: investor, toWallet: receiver, amount: '100' });
    const begun2 = await beginPaymentSend({ chain: 'hardhat-local', id: second.id });
    if (!begun2.ok || !begun2.data.txRequest) throw new Error('A8 lần hai không trả giao dịch');
    const hash2 = await sendFromWallet(begun2.data.txRequest);
    const pageResult = await page('hardhat-local', investor);
    expect(pageResult.ok, pageResult.ok ? '' : pageResult.error).toBe(true);
    expect(await getPaymentWithdrawStore().findById(second.id)).toMatchObject({ status: 'COMPLETED', completedTxHash: hash2 });
  }, 60_000);
});
