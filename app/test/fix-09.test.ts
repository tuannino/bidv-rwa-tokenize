import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeAbiParameters, encodeEventTopics, TransactionNotFoundError, TransactionReceiptNotFoundError, type Hex } from 'viem';
import { getContractAddress, vndTokenAbi, type ChainKey } from '@bidv/shared';
import type { ILedgerPort, PaymentTransferEvidence, PaymentTransferQuery } from '@/lib/ledger';

/**
 * FIX-09 (requirements mục 4): nhận đúng lần chuyển VNDB của lệnh rút khi ví gói calldata (EIP-7702).
 *
 * Một chuỗi giả trong tệp (`chain`) phục vụ hai lớp: ledger giả của nhóm 3 (đọc thẳng `chain`, quét theo nhãn
 * bằng `inputCarriesTag`) và client viem giả của nhóm 4b (`createPublicClient` bị thay), để adapter EVM THẬT
 * (`createEvmLedger`) đọc giao dịch, biên nhận, log từ cùng dữ liệu. Không gọi mạng; dữ liệu giao dịch nguồn lấy
 * từ fixture đọc trên Sepolia.
 */

interface ChainTx {
  hash: string;
  from: string;
  input: string;
  status: 'success' | 'reverted';
  blockNumber: bigint;
  logs: Array<{ address: string; from: string; to: string; value: bigint }>;
}

const chain = { block: 100n, txs: new Map<string, ChainTx>(), balances: new Map<string, bigint>(), whitelisted: new Set<string>() };
const lower = (value: string) => value.toLowerCase();
const VND = getContractAddress('evm', 'VNDToken');

/** Client viem giả: chỉ bốn lời đọc adapter dùng cho lệnh rút VNDB. */
const fakeClient = {
  async getBlockNumber() {
    return chain.block;
  },
  async getTransaction({ hash }: { hash: Hex }) {
    const tx = chain.txs.get(lower(hash));
    if (!tx) throw new TransactionNotFoundError({ hash });
    return { hash: tx.hash, from: tx.from, input: tx.input };
  },
  async getTransactionReceipt({ hash }: { hash: Hex }) {
    const tx = chain.txs.get(lower(hash));
    if (!tx) throw new TransactionReceiptNotFoundError({ hash });
    return {
      status: tx.status,
      logs: tx.logs.map((log) => ({
        address: log.address,
        topics: encodeEventTopics({ abi: vndTokenAbi, eventName: 'Transfer', args: { from: log.from as Hex, to: log.to as Hex } }),
        data: encodeAbiParameters([{ type: 'uint256' }], [log.value]),
      })),
    };
  },
  async getLogs({ address, args, fromBlock, toBlock }: { address: string; args: { from: string; to: string }; fromBlock: bigint; toBlock: bigint }) {
    return [...chain.txs.values()]
      .filter((tx) => tx.status === 'success' && tx.blockNumber >= fromBlock && tx.blockNumber <= toBlock)
      .flatMap((tx) =>
        tx.logs
          .map((log, logIndex) => ({ log, logIndex }))
          .filter(({ log }) => lower(log.address) === lower(address) && lower(log.from) === lower(args.from) && lower(log.to) === lower(args.to))
          .map(({ log, logIndex }) => ({
            args: { from: log.from, to: log.to, value: log.value },
            transactionHash: tx.hash,
            blockNumber: tx.blockNumber,
            logIndex,
          })),
      );
  },
};

vi.mock('viem', async (importOriginal) => ({
  ...(await importOriginal<typeof import('viem')>()),
  createPublicClient: () => fakeClient,
}));

/** `adapter`: ba lời đọc lệnh rút lấy từ adapter EVM thật (nhóm 4b); `fake`: ledger giả (nhóm 3). */
const reading: { mode: 'fake' | 'adapter' } = { mode: 'fake' };

function chainLedger(): ILedgerPort {
  const fake = {
    async paymentTxSender(txHash: string) {
      return chain.txs.get(lower(txHash))?.from ?? null;
    },
    async paymentTransferReceipt(txHash: string): Promise<PaymentTransferEvidence> {
      const tx = chain.txs.get(lower(txHash));
      if (!tx) return { status: 'UNKNOWN', txFrom: null, input: null, transfers: [] };
      return {
        status: tx.status === 'success' ? 'CONFIRMED' : 'FAILED',
        txFrom: tx.from,
        input: tx.input as Hex,
        transfers: tx.logs.filter((log) => lower(log.address) === lower(VND)).map(({ from, to, value }) => ({ from, to, value })),
      };
    },
    async findPaymentTransferByTag({ from, to, value, tag, fromBlock }: PaymentTransferQuery) {
      const found = [...chain.txs.values()]
        .filter((tx) => tx.status === 'success' && tx.blockNumber >= fromBlock)
        .filter((tx) => tx.logs.some((log) => lower(log.address) === lower(VND) && lower(log.from) === lower(from) && lower(log.to) === lower(to) && log.value === value))
        .sort((a, b) => (a.blockNumber < b.blockNumber ? -1 : 1))
        .find((tx) => lower(tx.from) === lower(from) && inputCarriesTag(tx.input, tag));
      return found ? { txHash: found.hash, blockNumber: found.blockNumber } : null;
    },
  };
  const reads = reading.mode === 'adapter' ? createEvmLedger('evm', {} as never) : fake;
  const impl = {
    chain: 'evm' as ChainKey,
    async spvWallet() {
      return null;
    },
    async isWhitelisted(wallet: string) {
      return chain.whitelisted.has(lower(wallet));
    },
    async paymentBalanceOf(wallet: string) {
      return chain.balances.get(lower(wallet)) ?? 0n;
    },
    async latestBlockNumber() {
      return chain.block;
    },
    paymentTxSender: (txHash: string) => reads.paymentTxSender(txHash),
    paymentTransferReceipt: (txHash: string) => reads.paymentTransferReceipt(txHash),
    findPaymentTransferByTag: (query: PaymentTransferQuery) => reads.findPaymentTransferByTag(query),
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
  return { ...mod, getLedger: (key: ChainKey, signer?: Parameters<typeof mod.getLedger>[1]) => (key === 'evm' ? chainLedger() : mod.getLedger(key, signer)) };
});

const { resetServerEnvCache } = await import('@/lib/config/env');
const { createEvmLedger } = await import('@/lib/ledger/evm.adapter');
const { inputCarriesTag } = await import('@/lib/ledger/payment-tag');
const { getPaymentWithdrawStore, resetMemoryStore, resetStoreCache } = await import('@/lib/store');
const { beginPaymentSend, createPaymentWithdraw, getPaymentWithdrawPage, matchesTransfer, paymentTag, paymentTransferCalldata, RESCAN_WINDOW_MS, submitPaymentWithdrawTx } =
  await import('@/lib/bank/payment-withdraw.service');
const { bindWalletForTest } = await import('./helpers/wallet-binding');

/** Giao dịch nguồn trên Sepolia (tasks bước 2): type 4, gói lồng, revert, không log. */
const fixture = JSON.parse(readFileSync(join(__dirname, 'fixtures/fix-09-tx-0xbbc9.json'), 'utf8')) as {
  transaction: { hash: string; from: string; to: string; type: string; input: string };
  receipt: { status: string; logs: unknown[]; gasUsed: string };
};
const SOURCE_TAG = '618a1b300552bd77f7984a017b4933cc41d8d9c3fd23db23dff2154a63a99981';
/** Ví gửi là ví của giao dịch nguồn, để ca giao dịch nguồn đi đúng luồng lệnh rút. */
const INV = fixture.transaction.from;
const RECEIVER = '0x2222222222222222222222222222222222222222';
const STRANGER = '0x4444444444444444444444444444444444444444';

/** Calldata gói lồng theo khuôn giao dịch nguồn, thay nhãn nguồn bằng nhãn của lệnh `id`. */
const wrapped = (id: string) => fixture.transaction.input.replace(SOURCE_TAG, paymentTag(id).slice(2));

let hashSeq = 0;
const nextHash = () => `0x${(0xf09000 + ++hashSeq).toString(16).padStart(64, '0')}`;
let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${(++seq).toString(16).padStart(12, '0')}`;

/** Ví "phát" một giao dịch. Mặc định: ví gửi tới ví nhận 100 VNDB, thành công. */
function broadcast(input: { input: string; hash?: string; from?: string; status?: ChainTx['status']; logs?: ChainTx['logs'] }): ChainTx {
  chain.block += 1n;
  const tx: ChainTx = {
    hash: lower(input.hash ?? nextHash()),
    from: input.from ?? INV,
    input: input.input,
    status: input.status ?? 'success',
    blockNumber: chain.block,
    logs: input.logs ?? [{ address: VND, from: INV, to: RECEIVER, value: 100n }],
  };
  chain.txs.set(tx.hash, tx);
  return tx;
}

async function sending() {
  const created = await createPaymentWithdraw({
    chain: 'evm',
    wallet: INV,
    toWallet: RECEIVER,
    amount: '100',
    purpose: 'Chuyển sang ví khác',
    otp: '123456',
    clientRequestId: uuid(),
  });
  if (!created.ok) throw new Error(`Tạo lệnh lỗi: ${created.error}`);
  const begun = await beginPaymentSend({ chain: 'evm', id: created.data.id });
  if (!begun.ok) throw new Error(`Gửi tới ví lỗi: ${begun.error}`);
  return begun.data;
}

const submit = (id: string, txHash: string) => submitPaymentWithdrawTx({ chain: 'evm', id, txHash });
const status = async (id: string) => (await getPaymentWithdrawStore().findById(id))?.status;
const page = () => getPaymentWithdrawPage({ chain: 'evm', wallet: INV });

beforeEach(async () => {
  reading.mode = 'fake';
  chain.block = 100n;
  chain.txs = new Map();
  chain.balances = new Map([[lower(INV), 1_000n]]);
  chain.whitelisted = new Set([lower(RECEIVER)]);
  process.env.USE_MOCK_DB = 'true';
  process.env.DEMO_ROLE = 'INVESTOR';
  process.env.DEMO_ACTOR = 'NDT001';
  resetServerEnvCache();
  resetMemoryStore();
  resetStoreCache();
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

describe('FIX-09 nhóm 1: inputCarriesTag', () => {
  const tag = paymentTag('lenh-a');
  const bare = tag.slice(2);

  it('nhãn ở cuối calldata `transfer`, ở giữa có đệm sau: true', () => {
    expect(inputCarriesTag(paymentTransferCalldata({ id: 'lenh-a', toWallet: RECEIVER, amount: '100' }), tag)).toBe(true);
    expect(inputCarriesTag(`0xa9059cbb${'11'.repeat(40)}${bare}${'00'.repeat(8)}`, tag)).toBe(true);
  });

  it('giao dịch nguồn thật: chứa nhãn đúng ranh giới byte nhưng KHÔNG kết thúc bằng nhãn', () => {
    const input = fixture.transaction.input;
    expect(input).toHaveLength(3018);
    expect(inputCarriesTag(input, `0x${SOURCE_TAG}`)).toBe(true);
    expect(input.endsWith(SOURCE_TAG)).toBe(false);
    expect(inputCarriesTag(input, tag)).toBe(false);
  });

  it('chỉ khớp ở vị trí lẻ: false; lẻ trước rồi chẵn sau: true', () => {
    expect(inputCarriesTag(`0xa${bare}0`, tag)).toBe(false);
    expect(inputCarriesTag(`0xa${bare}0${bare}`, tag)).toBe(true);
  });

  it('chữ hoa, có hoặc không 0x: như nhau; nhãn sai độ dài, input rỗng: false', () => {
    const input = `0xa9059cbb${bare}`;
    for (const [i, t] of [[input, tag], [input.toUpperCase().replace('0X', '0x'), tag.toUpperCase()], [input.slice(2), bare]] as const) {
      expect(inputCarriesTag(i, t), `${i.slice(0, 12)} ${t.slice(0, 6)}`).toBe(true);
    }
    expect(inputCarriesTag(input, bare.slice(2))).toBe(false);
    expect(inputCarriesTag(input, `${bare}00`)).toBe(false);
    expect(inputCarriesTag(input, 'z'.repeat(64))).toBe(false);
    expect(inputCarriesTag('', tag)).toBe(false);
    expect(inputCarriesTag('0x', tag)).toBe(false);
  });
});

describe('FIX-09 nhóm 2: matchesTransfer với calldata gói lồng', () => {
  const request = { id: 'lenh-b', fromWallet: INV, toWallet: RECEIVER, amount: '100' };
  const evidence = (over: Partial<Pick<PaymentTransferEvidence, 'txFrom' | 'input' | 'transfers'>> = {}) => ({
    txFrom: INV,
    input: wrapped(request.id) as Hex,
    transfers: [{ from: INV, to: RECEIVER, value: 100n }],
    ...over,
  });

  it('người gửi là ví gửi, log khớp: true; calldata thường (nhãn ở cuối) vẫn true', () => {
    expect(matchesTransfer(request, evidence())).toBe(true);
    expect(matchesTransfer(request, evidence({ input: paymentTransferCalldata(request) }))).toBe(true);
  });

  it('người gửi khác, log sai số lượng, nhãn của lệnh khác lồng bên trong: false', () => {
    expect(matchesTransfer(request, evidence({ txFrom: STRANGER }))).toBe(false);
    expect(matchesTransfer(request, evidence({ transfers: [{ from: INV, to: RECEIVER, value: 99n }] }))).toBe(false);
    expect(matchesTransfer(request, evidence({ input: wrapped('lenh-khac') as Hex }))).toBe(false);
  });
});

describe('FIX-09 nhóm 3: đối soát với ledger giả quét theo inputCarriesTag', () => {
  it('SUBMITTED, biên nhận CONFIRMED, calldata gói lồng, log khớp: COMPLETED', async () => {
    const view = await sending();
    const tx = broadcast({ input: wrapped(view.id) });
    const done = await submit(view.id, tx.hash);
    expect(done.ok && done.data).toMatchObject({ status: 'COMPLETED', completedTxHash: tx.hash });
  });

  it('biên nhận FAILED (revert như giao dịch nguồn): vẫn FAILED', async () => {
    const view = await sending();
    const tx = broadcast({ input: wrapped(view.id), status: 'reverted', logs: [] });
    const result = await submit(view.id, tx.hash);
    expect(result.ok && result.data.status).toBe('FAILED');
  });

  it('lệnh FAILED, giao dịch gói lồng khớp lên chuỗi sau: mở màn trong 24 giờ thì COMPLETED, quá 24 giờ thì giữ FAILED (QĐ-3)', async () => {
    const now = Date.now();
    vi.useFakeTimers({ toFake: ['Date'] });
    for (const [label, later] of [
      ['trong cửa sổ', RESCAN_WINDOW_MS - 60_000],
      ['quá cửa sổ', RESCAN_WINDOW_MS + 60_000],
    ] as const) {
      vi.setSystemTime(now);
      const view = await sending();
      const reverted = broadcast({ input: wrapped(view.id), status: 'reverted', logs: [] });
      expect((await submit(view.id, reverted.hash)).ok, label).toBe(true);
      expect(await status(view.id), label).toBe('FAILED');
      const good = broadcast({ input: wrapped(view.id) });
      vi.setSystemTime(now + later);
      await page();
      const record = await getPaymentWithdrawStore().findById(view.id);
      if (label === 'trong cửa sổ') expect(record).toMatchObject({ status: 'COMPLETED', completedTxHash: good.hash });
      else expect(record?.status, label).toBe('FAILED');
    }
  });

  it('một giao dịch gói hai lệnh cùng ví nhận, cùng số: lệnh đang gửi COMPLETED, lệnh FAILED trước đó giữ FAILED', async () => {
    const first = await sending();
    const reverted = broadcast({ input: wrapped(first.id), status: 'reverted', logs: [] });
    await submit(first.id, reverted.hash);
    expect(await status(first.id)).toBe('FAILED');
    const second = await sending();
    const both = broadcast({ input: `${wrapped(second.id)}${paymentTag(first.id).slice(2)}${'00'.repeat(8)}` });
    await page();
    expect(await getPaymentWithdrawStore().findById(second.id)).toMatchObject({ status: 'COMPLETED', completedTxHash: both.hash });
    expect(await status(first.id)).toBe('FAILED');
  });
});

describe('FIX-09 nhóm 4: mã nguồn', () => {
  const read = (file: string) => readFileSync(join(__dirname, '..', 'src/lib', file), 'utf8');
  /** Thân hàm `name`: từ chỗ khai báo tới hàm kế tiếp cùng cấp. */
  const body = (source: string, name: string, next: RegExp) => {
    const start = source.search(new RegExp(`(function |async )${name}\\(`));
    expect(start, name).toBeGreaterThan(-1);
    const rest = source.slice(start + 1);
    const end = rest.search(next);
    return end === -1 ? rest : rest.slice(0, end);
  };

  it('hai chỗ đối chiếu gọi inputCarriesTag, thân hàm không còn endsWith', () => {
    const service = read('bank/payment-withdraw.service.ts');
    const adapter = read('ledger/evm.adapter.ts');
    expect(service).toContain('inputCarriesTag(');
    expect(adapter).toContain('inputCarriesTag(');
    expect(body(service, 'matchesTransfer', /\n(export )?(async )?function /)).not.toContain('endsWith');
    expect(body(adapter, 'findPaymentTransferByTag', /\n {4}async \w+\(/)).not.toContain('endsWith');
  });

  it('payment-tag.ts không nhập mô-đun nào', () => {
    expect(read('ledger/payment-tag.ts')).not.toMatch(/^\s*import\s/m);
  });
});

describe('FIX-09 nhóm 4b: adapter EVM thật trên client viem giả', () => {
  beforeEach(() => {
    reading.mode = 'adapter';
  });

  it('có mã giao dịch: biên nhận CONFIRMED kèm input, transfers; lệnh SUBMITTED thành COMPLETED', async () => {
    const view = await sending();
    const tx = broadcast({ input: wrapped(view.id) });
    const evidence = await createEvmLedger('evm', {} as never).paymentTransferReceipt(tx.hash);
    expect(evidence).toMatchObject({ status: 'CONFIRMED', input: wrapped(view.id) });
    expect(lower(evidence.txFrom ?? '')).toBe(lower(INV));
    expect(evidence.transfers.map(({ from, to, value }) => [lower(from), lower(to), value])).toEqual([[lower(INV), lower(RECEIVER), 100n]]);
    const done = await submit(view.id, tx.hash);
    expect(done.ok && done.data).toMatchObject({ status: 'COMPLETED', completedTxHash: tx.hash });
  });

  it('mất mã: findPaymentTransferByTag trả đúng mã; người gửi giao dịch khác ví gửi: null', async () => {
    const ledger = createEvmLedger('evm', {} as never);
    const query = { from: INV, to: RECEIVER, value: 100n, tag: paymentTag('lenh-c'), fromBlock: 0n };
    const tx = broadcast({ input: wrapped('lenh-c') });
    expect(await ledger.findPaymentTransferByTag(query)).toEqual({ txHash: tx.hash, blockNumber: tx.blockNumber });
    chain.txs.clear();
    broadcast({ input: wrapped('lenh-c'), from: STRANGER });
    expect(await ledger.findPaymentTransferByTag(query)).toBeNull();
  });

  it('giao dịch nguồn thật (revert, không log): biên nhận FAILED; lệnh SUBMITTED mang mã đó vẫn FAILED', async () => {
    expect(fixture.receipt).toMatchObject({ status: '0x0', logs: [] });
    const view = await sending();
    const source = broadcast({ hash: fixture.transaction.hash, input: fixture.transaction.input, status: 'reverted', logs: [] });
    expect(await createEvmLedger('evm', {} as never).paymentTransferReceipt(source.hash)).toMatchObject({ status: 'FAILED', transfers: [] });
    const result = await submit(view.id, source.hash);
    expect(result.ok && result.data.status).toBe('FAILED');
  });
});
