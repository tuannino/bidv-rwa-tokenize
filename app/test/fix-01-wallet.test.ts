import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from 'pg';
import { MOCK_VAULT_ADDRESS, PUBLIC_SAMPLE_WALLETS, SAMPLE_WALLETS, type ChainKey } from '@bidv/shared';
import type { ILedgerPort, TxReceiptStatus, VaultStatus } from '@/lib/ledger';
import type { TxResult } from '@bidv/shared';
import type { Role } from '@/lib/rbac';

/**
 * FIX-01 ca 1 tới 24 và 20b (requirements mục 7), chain `mock`, bộ nhớ; ca 20 (phần Postgres), 23, 24
 * chạy thêm trên Postgres khi có `TEST_DATABASE_URL`.
 *
 * `getLedger` được bọc để: đếm lời gọi ghi (whitelist, đặt ví nhận, rút) và lời gọi đọc số dư theo ví;
 * giả lập biên nhận (`waitReceipt`), kết cục đọc ngay (`txReceiptStatus`), giao dịch đang chờ của ví
 * ký (`hasPendingSignerTx`), lỗi khi gửi đặt ví nhận, và ví nhận đọc lại từ vault. Mock xác nhận mọi
 * giao dịch ngay khi gửi, nên các kết cục "chưa có biên nhận" chỉ dựng được bằng cách này.
 */
const hooks: {
  calls: Array<{ method: string; arg?: string }>;
  waitReceipt: ((txHash: string) => TxResult | null) | null;
  txReceiptStatus: ((txHash: string) => TxReceiptStatus) | null;
  pendingSignerTx: boolean;
  /** Ném khi gửi đặt ví nhận: `reverted` hay lỗi chưa rõ. */
  payoutSendError: 'reverted' | 'unknown' | null;
  /** Đặt ví nhận "chưa thực thi trên chuỗi": trả mã giả, không đổi trạng thái mock. */
  payoutNotExecuted: boolean;
  /** Đổi ví nhận đọc từ vault ở lần đọc thứ `n` (đếm từ 1). */
  vaultStatus: ((status: VaultStatus, n: number) => VaultStatus) | null;
  vaultStatusCount: number;
  /** Gửi rút xong thì ném lỗi chưa rõ (mất mã giao dịch). */
  withdrawLosesHash: boolean;
} = {
  calls: [],
  waitReceipt: null,
  txReceiptStatus: null,
  pendingSignerTx: false,
  payoutSendError: null,
  payoutNotExecuted: false,
  vaultStatus: null,
  vaultStatusCount: 0,
  withdrawLosesHash: false,
};

let fakeHash = 0;
const nextFakeHash = () => `0x${(0xf1_0000 + ++fakeHash).toString(16).padStart(64, '0')}`;

vi.mock('@/lib/ledger', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/ledger')>();
  const WATCHED = ['whitelist', 'setVaultPayoutWallet', 'withdrawFromVault', 'balanceOf', 'paymentBalanceOf', 'waitReceipt', 'txReceiptStatus'];
  const instrument = (ledger: ILedgerPort): ILedgerPort =>
    new Proxy(ledger, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        const name = String(property);
        if (name === 'vaultStatus') {
          return async () => {
            const status = await target.vaultStatus();
            hooks.vaultStatusCount += 1;
            return status && hooks.vaultStatus ? hooks.vaultStatus(status, hooks.vaultStatusCount) : status;
          };
        }
        if (name === 'hasPendingSignerTx') return async () => hooks.pendingSignerTx;
        if (!WATCHED.includes(name)) return value;
        return async (...args: unknown[]) => {
          hooks.calls.push({ method: name, arg: args[0] === undefined ? undefined : String(args[0]) });
          if (name === 'setVaultPayoutWallet') {
            if (hooks.payoutSendError === 'reverted') {
              throw new mod.LedgerError(target.chain, name, 'Mô phỏng revert khi đặt ví nhận.', { reverted: true });
            }
            if (hooks.payoutSendError === 'unknown') throw new Error('Mất kết nối RPC khi gửi đặt ví nhận.');
            if (hooks.payoutNotExecuted) return { txHash: nextFakeHash(), status: 'PENDING' } satisfies TxResult;
          }
          if (name === 'withdrawFromVault' && hooks.withdrawLosesHash) {
            await target.withdrawFromVault(args[0] as bigint);
            throw new Error('Mất kết nối sau khi gửi rút.');
          }
          if (name === 'waitReceipt' && hooks.waitReceipt) {
            const faked = hooks.waitReceipt(String(args[0]));
            if (faked) return faked;
          }
          if (name === 'txReceiptStatus' && hooks.txReceiptStatus) return hooks.txReceiptStatus(String(args[0]));
          return (value as (...input: unknown[]) => Promise<unknown>).apply(target, args);
        };
      },
    });
  return { ...mod, getLedger: (chain: ChainKey, signer?: Parameters<typeof mod.getLedger>[1]) => instrument(mod.getLedger(chain, signer)) };
});

const { resetServerEnvCache } = await import('@/lib/config/env');
const { getLedger, getMockLedgerStateStore } = await import('@/lib/ledger');
const { resetMockLedger, seedMockLedger } = await import('@/lib/ledger/mock.adapter');
const { getOrderStore, getStore, getVaultStore, getWalletBindingStore, resetMemoryStore, resetStoreCache } = await import('@/lib/store');
const { bindProfileWallet, listWalletBindings } = await import('@/lib/bank/wallet-binding.service');
const { resolveWalletOwner } = await import('@/lib/bank/wallet-owner');
const { getPortfolio, getWalletTransactions } = await import('@/lib/bank/portfolio.service');
const { listOrders, placeOrder, preparePermit, previewPurchase } = await import('@/lib/bank/purchase.service');
const { getOrderDetail, getTradeContext } = await import('@/lib/bank/trade.service');
const { listTransactions, readBalance } = await import('@/lib/bank/mint.service');
const {
  cancelWithdrawRequest,
  continueWithdrawRequest,
  createWithdrawRequest,
  reconcileWithdrawRequests,
  resolveWithdrawRequest,
} = await import('@/lib/bank/withdraw.service');
const { saveVaultConfig } = await import('@/lib/bank/vault.service');
const { planVaultConfig } = await import('@/lib/bank/vault-config');
const { HIDDEN_OPS_GROUP_LABEL, NAV_BY_ROLE, withHiddenOps } = await import('@/components/layout/nav-config');
const { can } = await import('@/lib/rbac');
const { canMintDemoPayment } = await import('@/lib/rbac/demo-payment');
const { bindWalletForTest } = await import('./helpers/wallet-binding');

const CHAIN = 'mock' as const;
const INVESTOR_SAMPLE = SAMPLE_WALLETS.NDT001;
const SELLER_SAMPLE = SAMPLE_WALLETS.NB001;
/** Ví thật của nhà đầu tư (không phải ví mẫu), chưa gắn cho hồ sơ nào. */
const FRESH = '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc';
const SECOND = '0x976EA74026E726554dB657fA54763abd0C3a0aa9';
/** Ví nhận mới Người bán chọn khi rút. */
const NEW_PAYOUT = '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955';
const PUBLIC_SAMPLE = PUBLIC_SAMPLE_WALLETS[0]!;
const TAKEN = 'Ví đã được định danh cho hồ sơ khác.';
let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${(++seq).toString(16).padStart(12, '0')}`;

function actAs(role: string, actor?: string) {
  process.env.DEMO_ROLE = role;
  if (actor === undefined) delete process.env.DEMO_ACTOR;
  else process.env.DEMO_ACTOR = actor;
  resetServerEnvCache();
}

const callsOf = (method: string) => hooks.calls.filter((call) => call.method === method);
const audits = async (action: string) => (await getStore().listAudit({ limit: 500 })).filter((row) => row.action === action);

function resetHooks() {
  hooks.calls = [];
  hooks.waitReceipt = null;
  hooks.txReceiptStatus = null;
  hooks.pendingSignerTx = false;
  hooks.payoutSendError = null;
  hooks.payoutNotExecuted = false;
  hooks.vaultStatus = null;
  hooks.vaultStatusCount = 0;
  hooks.withdrawLosesHash = false;
}

beforeEach(async () => {
  resetHooks();
  process.env.USE_MOCK_DB = 'true';
  await resetMockLedger();
  resetMemoryStore();
  resetStoreCache();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete process.env.DEMO_ROLE;
  delete process.env.DEMO_ACTOR;
  delete process.env.USE_MOCK_DB;
  delete process.env.ENABLE_DEMO_PAYMENT_MINT;
  resetServerEnvCache();
  resetStoreCache();
});

// =============================================================================
//  A. GẮN VÍ (ca 1 tới 7)
// =============================================================================

describe('FIX-01 ca 1 tới 6: bindProfileWallet', () => {
  beforeEach(() => actAs('TELLER', 'GDV001'));

  it('ca 1: gắn ví mới: whitelist trên ledger, có dòng WalletBinding, audit investor:whitelist và profile:wallet:bind SUCCESS', async () => {
    const result = await bindProfileWallet({ chain: CHAIN, actorId: 'NDT001', wallet: FRESH });
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({ created: true, binding: { wallet: FRESH, actorId: 'NDT001', boundBy: 'GDV001' } });
    expect(result.data.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(callsOf('whitelist').map((call) => call.arg)).toEqual([FRESH]);
    expect(await getLedger(CHAIN).isWhitelisted(FRESH)).toBe(true);
    expect(await getWalletBindingStore().findByWallet(CHAIN, FRESH.toLowerCase())).toMatchObject({ actorId: 'NDT001' });
    expect((await audits('investor:whitelist')).map((row) => row.outcome)).toContain('SUCCESS');
    expect((await audits('profile:wallet:bind')).map((row) => row.outcome)).toEqual(['SUCCESS']);
  });

  it('ca 2: ví đã gắn cho hồ sơ khác: VALIDATION, không giao dịch, không đổi bảng', async () => {
    await bindWalletForTest(CHAIN, FRESH, 'NB001');
    const result = await bindProfileWallet({ chain: CHAIN, actorId: 'NDT001', wallet: FRESH });
    expect(result).toMatchObject({ ok: false, code: 'VALIDATION', error: TAKEN });
    expect(callsOf('whitelist')).toEqual([]);
    expect(await getWalletBindingStore().list(CHAIN, 10)).toHaveLength(1);
    expect((await resolveWalletOwner(CHAIN, FRESH))?.actorId).toBe('NB001');
    // Ví mẫu của hồ sơ khác trên chain thử nghiệm cũng là "thuộc hồ sơ khác".
    expect(await bindProfileWallet({ chain: CHAIN, actorId: 'NDT001', wallet: SELLER_SAMPLE })).toMatchObject({ ok: false, error: TAKEN });
  });

  it('ca 3: gắn lại đúng hồ sơ cũ, ví đã whitelist: không giao dịch, thành công, bảng không thêm dòng', async () => {
    expect((await bindProfileWallet({ chain: CHAIN, actorId: 'NDT001', wallet: FRESH })).ok).toBe(true);
    hooks.calls = [];
    const again = await bindProfileWallet({ chain: CHAIN, actorId: 'NDT001', wallet: FRESH });
    expect(again.ok && again.data).toMatchObject({ created: false, txHash: null });
    expect(callsOf('whitelist')).toEqual([]);
    expect(await getWalletBindingStore().list(CHAIN, 10)).toHaveLength(1);
  });

  it('ca 4: ví mẫu công khai của Hardhat trên chain evm: VALIDATION, không giao dịch', async () => {
    const result = await bindProfileWallet({ chain: 'evm', actorId: 'NDT001', wallet: PUBLIC_SAMPLE });
    expect(result).toMatchObject({
      ok: false,
      code: 'VALIDATION',
      error: 'Ví mẫu công khai của Hardhat không định danh được trên chain thật.',
    });
    expect(hooks.calls).toEqual([]);
    expect(await getWalletBindingStore().list('evm', 10)).toEqual([]);
  });

  for (const status of ['FAILED', 'PENDING'] as const) {
    it(`ca 5: biên nhận whitelist ${status}: không ghi gắn, trả LEDGER`, async () => {
      hooks.waitReceipt = (txHash) => ({ txHash, status });
      const result = await bindProfileWallet({ chain: CHAIN, actorId: 'NDT001', wallet: FRESH });
      expect(result).toMatchObject({ ok: false, code: 'LEDGER' });
      expect(await getWalletBindingStore().findByWallet(CHAIN, FRESH)).toBeNull();
      expect((await audits('profile:wallet:bind')).map((row) => row.outcome)).toEqual(['FAILURE']);
    });
  }

  for (const role of ['CONTROLLER', 'INVESTOR'] as const) {
    it(`ca 6: vai ${role} gọi gắn ví: FORBIDDEN, audit DENIED`, async () => {
      actAs(role);
      const result = await bindProfileWallet({ chain: CHAIN, actorId: 'NDT001', wallet: FRESH });
      expect(result).toMatchObject({ ok: false, code: 'FORBIDDEN' });
      expect(hooks.calls).toEqual([]);
      expect((await audits('investor:whitelist')).map((row) => row.outcome)).toEqual(['DENIED']);
    });
  }

  it('A2: danh sách ví đã gắn chỉ đọc database, mới gắn trước, kèm danh sách hồ sơ', async () => {
    await bindWalletForTest(CHAIN, FRESH, 'NDT001');
    await new Promise((resolve) => setTimeout(resolve, 5));
    await bindWalletForTest(CHAIN, SECOND, 'NB001');
    hooks.calls = [];
    const listed = await listWalletBindings({ chain: CHAIN });
    expect(listed.ok && listed.data.rows.map((row) => [row.wallet, row.actorId, row.role])).toEqual([
      [SECOND, 'NB001', 'SELLER'],
      [FRESH, 'NDT001', 'INVESTOR'],
    ]);
    expect(listed.ok && listed.data.profiles.map((p) => p.actorId)).toEqual(['NDT001', 'NB001']);
    expect(hooks.calls).toEqual([]);
  });
});

describe('FIX-01 ca 7: resolveWalletOwner', () => {
  it('một hồ sơ hai ví cùng chủ; ví mẫu chỉ có hiệu lực trên mock, hardhat-local', async () => {
    await bindWalletForTest(CHAIN, FRESH, 'NDT001');
    await bindWalletForTest(CHAIN, SECOND, 'NDT001');
    expect((await resolveWalletOwner(CHAIN, FRESH))?.actorId).toBe('NDT001');
    expect((await resolveWalletOwner(CHAIN, SECOND.toLowerCase()))?.actorId).toBe('NDT001');
    for (const chain of ['mock', 'hardhat-local'] as const) {
      expect((await resolveWalletOwner(chain, INVESTOR_SAMPLE))?.actorId).toBe('NDT001');
      expect((await resolveWalletOwner(chain, SELLER_SAMPLE))?.actorId).toBe('NB001');
    }
    for (const chain of ['evm', 'stellar'] as const) {
      expect(await resolveWalletOwner(chain, INVESTOR_SAMPLE)).toBeNull();
    }
    expect(await resolveWalletOwner('hardhat-local', FRESH)).toBeNull();
  });
});

// =============================================================================
//  D. CHỐT CHẶN VÍ CỦA PHIÊN (ca 8 tới 10)
// =============================================================================

describe('FIX-01 ca 8: phép đọc dữ liệu tài khoản của Nhà đầu tư', () => {
  beforeEach(() => actAs('INVESTOR', 'NDT001'));

  const reads = {
    getPortfolio: () => (wallet: string) => getPortfolio({ chain: CHAIN, wallet }),
    getWalletTransactions: () => (wallet: string) => getWalletTransactions({ chain: CHAIN, wallet }),
    listOrders: () => (wallet: string) => listOrders({ chain: CHAIN, investorWallet: wallet }),
    getOrderDetail: () => (wallet: string) =>
      getOrderDetail({ chain: CHAIN, investorWallet: wallet, orderId: '00000000-0000-4000-8000-000000000999' }),
  };

  for (const [name, make] of Object.entries(reads)) {
    it(`${name}: ví chưa gắn và ví của hồ sơ khác đều WALLET_NOT_BOUND kèm audit DENIED; ví đã gắn, ví mẫu trên mock đạt`, async () => {
      const read = make();
      for (const wallet of [FRESH, SELLER_SAMPLE]) {
        const denied = await read(wallet);
        expect(denied).toMatchObject({ ok: false, code: 'WALLET_NOT_BOUND', error: 'Ví chưa được định danh' });
      }
      const deniedRows = (await getStore().listAudit({ limit: 50 })).filter((row) => row.outcome === 'DENIED');
      expect(deniedRows.map((row) => row.detail)).toEqual(['Ví chưa được định danh', 'Ví chưa được định danh']);
      expect(deniedRows.every((row) => !row.detail?.includes('NB001'))).toBe(true);

      await bindWalletForTest(CHAIN, FRESH, 'NDT001');
      for (const wallet of [FRESH, INVESTOR_SAMPLE]) {
        const allowed = await read(wallet);
        // Chi tiết lệnh với mã không có: qua cổng ví rồi mới báo không tìm thấy.
        if (name === 'getOrderDetail') expect(allowed).toMatchObject({ ok: false, code: 'ORDER_STATE' });
        else expect(allowed.ok, allowed.ok ? '' : allowed.error).toBe(true);
      }
    });
  }

  it('getTradeContext với ví chưa gắn: ok, walletBound false, balances null, không đọc số dư ví đó', async () => {
    const result = await getTradeContext({ chain: CHAIN, wallet: FRESH });
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({ walletBound: false, balances: null });
    expect(result.data.caps.BUY.max).toBe('0');
    expect(result.data.caps.SELL.max).toBe('0');
    const balanceReads = hooks.calls.filter(
      (call) => (call.method === 'balanceOf' || call.method === 'paymentBalanceOf') && call.arg?.toLowerCase() === FRESH.toLowerCase(),
    );
    expect(balanceReads).toEqual([]);
    const bound = await getTradeContext({ chain: CHAIN, wallet: INVESTOR_SAMPLE });
    expect(bound.ok && bound.data.walletBound).toBe(true);
    expect(bound.ok && bound.data.balances).not.toBeNull();
  });
});

describe('FIX-01 ca 9: đặt lệnh với ví chưa gắn', () => {
  it('placeOrder, preparePermit, previewPurchase: WALLET_NOT_BOUND, không tạo lệnh, không gửi giao dịch', async () => {
    actAs('INVESTOR', 'NDT001');
    const before = await getOrderStore().countOrders({});
    const input = { chain: CHAIN, investorWallet: FRESH, wptAmount: '1', side: 'BUY' as const };
    expect(await placeOrder({ ...input, clientRequestId: uuid() })).toMatchObject({ ok: false, code: 'WALLET_NOT_BOUND' });
    expect(await preparePermit(input)).toMatchObject({ ok: false, code: 'WALLET_NOT_BOUND' });
    expect(await previewPurchase(input)).toMatchObject({ ok: false, code: 'WALLET_NOT_BOUND' });
    expect(await getOrderStore().countOrders({})).toBe(before);
    expect(hooks.calls).toEqual([]);
    // placeOrder ghi sổ DENIED; hai hàm dùng assertCan không ghi.
    const denied = (await getStore().listAudit({ limit: 50 })).filter((row) => row.outcome === 'DENIED');
    expect(denied.map((row) => row.action)).toEqual(['order:place']);
  });
});

describe('FIX-01 ca 10: phép đọc phải có chain, dùng đúng chain đã kiểm', () => {
  it('Giao dịch viên xem toàn bộ như cũ; Nhà đầu tư thiếu chain hoặc ví: VALIDATION; ví gắn khác hồ sơ theo chain', async () => {
    const orders = getOrderStore();
    await orders.createOrder({ chain: 'evm', investorWallet: FRESH, wptAmount: '1', vndAmount: '100', actorRole: 'INVESTOR' });
    await orders.createOrder({ chain: 'hardhat-local', investorWallet: FRESH, wptAmount: '2', vndAmount: '200', actorRole: 'INVESTOR' });
    const store = getStore();
    for (const chain of ['evm', 'hardhat-local'] as const) {
      await store.saveTxn({
        chain,
        operation: 'purchase',
        txHash: nextFakeHash(),
        status: 'CONFIRMED',
        fromWallet: null,
        toWallet: FRESH,
        amount: '1',
        reason: null,
        actorRole: 'INVESTOR',
        actorAddress: null,
      });
    }

    actAs('TELLER', 'GDV001');
    const all = await listOrders({});
    expect(all.ok && all.data.length).toBe(2);

    actAs('INVESTOR', 'NDT001');
    expect(await listOrders({ investorWallet: FRESH })).toMatchObject({ ok: false, code: 'VALIDATION' });
    expect(await listTransactions({ wallet: FRESH })).toMatchObject({ ok: false, code: 'VALIDATION' });
    expect(await listTransactions({ chain: 'evm' })).toMatchObject({ ok: false, code: 'VALIDATION' });
    expect(await listTransactions({ chain: 'evm', wallet: FRESH })).toMatchObject({ ok: false, code: 'WALLET_NOT_BOUND' });
    expect(await readBalance({ chain: CHAIN, wallet: FRESH })).toMatchObject({ ok: false, code: 'WALLET_NOT_BOUND' });

    await bindWalletForTest('evm', FRESH, 'NDT001');
    await bindWalletForTest('hardhat-local', FRESH, 'NB001');
    expect(await listOrders({ chain: 'hardhat-local', investorWallet: FRESH })).toMatchObject({ ok: false, code: 'WALLET_NOT_BOUND' });
    expect(await listTransactions({ chain: 'hardhat-local', wallet: FRESH })).toMatchObject({ ok: false, code: 'WALLET_NOT_BOUND' });
    const evmOrders = await listOrders({ chain: 'evm', investorWallet: FRESH });
    expect(evmOrders.ok && evmOrders.data.map((order) => order.chain)).toEqual(['evm']);
    const evmTxns = await listTransactions({ chain: 'evm', wallet: FRESH });
    expect(evmTxns.ok && evmTxns.data.map((txn) => txn.chain)).toEqual(['evm']);
  });
});

// =============================================================================
//  G. RÚT TIỀN VỚI VÍ NHẬN DO NGƯỜI BÁN CHỌN (ca 11 tới 20b)
// =============================================================================

/** Vault mock FIXED khoá 400 trên 1.000 VNDB (được rút 600); ví nhận đang đặt là NB001. */
async function preparedVault(options: { payout?: string | null } = {}) {
  actAs('CONTROLLER', 'KSV001');
  const ledger = getLedger(CHAIN);
  for (const wallet of [SELLER_SAMPLE, NEW_PAYOUT]) await ledger.whitelist(wallet);
  await seedMockLedger({ paymentBalances: { [MOCK_VAULT_ADDRESS]: 1_000n } }, getMockLedgerStateStore(CHAIN));
  const saved = await saveVaultConfig({ chain: CHAIN, mode: 'FIXED', fixedLock: '400' });
  expect(saved.ok, saved.ok ? '' : saved.error).toBe(true);
  const payout = options.payout === undefined ? SELLER_SAMPLE : options.payout;
  if (payout) await ledger.setVaultPayoutWallet(payout);
  actAs('SELLER', 'NB001');
  resetHooks();
}

const withdraw = (input: Partial<{ amount: string; otp: string; clientRequestId: string; payoutWallet: string; chain: ChainKey }> = {}) =>
  createWithdrawRequest({
    chain: CHAIN,
    amount: '100',
    purpose: 'Chi trả vận hành',
    note: '',
    otp: '123456',
    clientRequestId: uuid(),
    payoutWallet: NEW_PAYOUT,
    ...input,
  });

/** Ghi lại mọi trạng thái lệnh đi qua (trạng thái đầu và từng lần chuyển thành công). */
function trackStatuses() {
  const store = getVaultStore();
  const seen: string[] = [];
  const create = store.createWithdrawRequest.bind(store);
  const transition = store.transitionWithdrawRequest.bind(store);
  vi.spyOn(store, 'createWithdrawRequest').mockImplementation(async (input) => {
    const record = await create(input);
    seen.push(record.status);
    return record;
  });
  vi.spyOn(store, 'transitionWithdrawRequest').mockImplementation(async (input) => {
    const record = await transition(input);
    if (record) seen.push(record.status);
    return record;
  });
  return seen;
}

/**
 * Hai yêu cầu đồng thời cùng mã: một lệnh đi hết; yêu cầu kia hoặc nhận lại chính lệnh đó (đến sau khi
 * lệnh đã có), hoặc `VAULT_BUSY` (đến khi khoá đang giữ). Không yêu cầu nào tạo lệnh thứ hai.
 */
function expectOneWinner(results: Array<Awaited<ReturnType<typeof createWithdrawRequest>>>) {
  const summary = results.map((r) => (r.ok ? r.data.status : r.code)).join(' ');
  expect(results.filter((r) => r.ok && r.data.status === 'COMPLETED').length, summary).toBeGreaterThanOrEqual(1);
  expect(results.every((r) => r.ok || r.code === 'VAULT_BUSY'), summary).toBe(true);
}

const lockHeld = async () => (await getVaultStore().findOperationLock(CHAIN)) !== null;
const vaultPayout = async () => (await getLedger(CHAIN).vaultStatus())?.payoutWallet ?? null;

/** Một lệnh dừng ở `PAYOUT_SET`: đặt ví nhận chưa có biên nhận lúc tạo, đối soát thấy CONFIRMED sau đó. */
async function payoutSetRequest() {
  hooks.payoutNotExecuted = true;
  hooks.waitReceipt = (txHash) => (txHash.startsWith('0x0000000000') && BigInt(txHash) > 0xf10000n ? { txHash, status: 'PENDING' } : null);
  const created = await withdraw();
  expect(created.ok && created.data.status, created.ok ? '' : created.error).toBe('PAYOUT_SENT');
  if (!created.ok) throw new Error(created.error);
  // Giao dịch đặt ví nhận vào block: mô phỏng bằng chính setter của mock, rồi kết cục CONFIRMED.
  hooks.payoutNotExecuted = false;
  await getLedger(CHAIN).setVaultPayoutWallet(NEW_PAYOUT);
  hooks.txReceiptStatus = () => 'CONFIRMED';
  hooks.waitReceipt = null;
  hooks.calls = [];
  await reconcileWithdrawRequests({ chain: CHAIN });
  const record = await getVaultStore().findWithdrawRequest(created.data.id);
  expect(record?.status).toBe('PAYOUT_SET');
  return record!;
}

describe('FIX-01 ca 11, 12: rút với ví nhận chọn ở lệnh', () => {
  beforeEach(() => preparedVault());

  it('ca 11: ví khác ví đang đặt: PAYOUT_SENDING, PAYOUT_SENT (có mã), SENDING, SENT, COMPLETED; đặt ví nhận rồi mới rút', async () => {
    const seen = trackStatuses();
    const before = await getLedger(CHAIN).paymentBalanceOf(NEW_PAYOUT);
    const created = await withdraw();
    expect(created.ok, created.ok ? '' : created.error).toBe(true);
    if (!created.ok) return;
    expect(seen).toEqual(['PAYOUT_SENDING', 'PAYOUT_SENT', 'SENDING', 'SENT', 'COMPLETED']);
    expect(created.data).toMatchObject({ status: 'COMPLETED', payoutWallet: NEW_PAYOUT });
    expect(created.data.payoutTxHash).toMatch(/^0x[0-9a-f]{64}$/);
    const order = hooks.calls.filter((c) => c.method === 'setVaultPayoutWallet' || c.method === 'withdrawFromVault').map((c) => c.method);
    expect(order).toEqual(['setVaultPayoutWallet', 'withdrawFromVault']);
    expect(await getLedger(CHAIN).paymentBalanceOf(NEW_PAYOUT)).toBe(before + 100n);
    const events = await getLedger(CHAIN).findVaultWithdrawals({ fromBlock: 0n, to: NEW_PAYOUT });
    expect(events.map((event) => event.amount)).toEqual([100n]);
    expect((await audits('vault:payout:set')).map((row) => row.outcome)).toContain('SUCCESS');
    expect(await lockHeld()).toBe(false);
  });

  it('ca 12: đúng ví đang đặt: không có giao dịch đặt ví nhận, lệnh bắt đầu ở SENDING', async () => {
    const seen = trackStatuses();
    const created = await withdraw({ payoutWallet: SELLER_SAMPLE.toLowerCase() });
    expect(created.ok && created.data.status, created.ok ? '' : created.error).toBe('COMPLETED');
    expect(seen[0]).toBe('SENDING');
    expect(callsOf('setVaultPayoutWallet')).toEqual([]);
    expect(created.ok && created.data.payoutTxHash).toBeNull();
  });
});

describe('FIX-01 ca 13: từ chối ví nhận trước khi tạo lệnh', () => {
  beforeEach(() => preparedVault());

  const cases: Array<[string, Partial<{ payoutWallet: string; chain: ChainKey }>]> = [
    ['chưa whitelist', { payoutWallet: FRESH }],
    ['ví 0', { payoutWallet: '0x0000000000000000000000000000000000000000' }],
    ['bằng địa chỉ vault', { payoutWallet: MOCK_VAULT_ADDRESS }],
    ['ví mẫu công khai trên evm', { payoutWallet: PUBLIC_SAMPLE, chain: 'evm' }],
  ];
  for (const [label, input] of cases) {
    it(`${label}: không tạo lệnh, không giao dịch, audit FAILURE`, async () => {
      const result = await withdraw(input);
      expect(result).toMatchObject({ ok: false, code: 'VALIDATION' });
      expect(result.ok ? null : Object.keys(result.fieldErrors ?? {})).toEqual(['payoutWallet']);
      expect(await getVaultStore().listWithdrawRequests({ chain: input.chain ?? CHAIN })).toEqual([]);
      expect(callsOf('setVaultPayoutWallet')).toEqual([]);
      expect(callsOf('withdrawFromVault')).toEqual([]);
      expect((await audits('vault:withdraw')).map((row) => row.outcome)).toContain('FAILURE');
      expect(await getVaultStore().findOperationLock(input.chain ?? CHAIN)).toBeNull();
    });
  }

  it('G2b: vault mock chưa có ví nhận: rút được với ví hợp lệ', async () => {
    await resetMockLedger();
    resetMemoryStore();
    await preparedVault({ payout: null });
    expect(await vaultPayout()).toBeNull();
    const created = await withdraw();
    expect(created.ok && created.data.status, created.ok ? '' : created.error).toBe('COMPLETED');
  });
});

describe('FIX-01 ca 14, 15: lỗi khi đặt ví nhận', () => {
  beforeEach(() => preparedVault());

  it('ca 14: revert khi gửi: FAILED, khoá nhả; lỗi chưa rõ: giữ PAYOUT_SENDING, giữ khoá, không rút; đối soát quá hạn: PAYOUT_REVIEW', async () => {
    hooks.payoutSendError = 'reverted';
    const reverted = await withdraw();
    expect(reverted).toMatchObject({ ok: false, code: 'LEDGER' });
    const [first] = await getVaultStore().listWithdrawRequests({ chain: CHAIN });
    expect(first?.status).toBe('FAILED');
    expect(await lockHeld()).toBe(false);

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-27T01:00:00Z'));
    hooks.payoutSendError = 'unknown';
    const unknown = await withdraw();
    expect(unknown).toMatchObject({ ok: false, code: 'LEDGER' });
    expect(unknown.ok ? '' : unknown.error).toContain('Chưa rõ giao dịch đặt ví nhận');
    // Đồng hồ giả lùi về trước lệnh đầu, nên tìm theo trạng thái thay vì theo thứ tự mới nhất.
    const [latest] = await getVaultStore().listWithdrawRequests({ chain: CHAIN, statuses: ['PAYOUT_SENDING'] });
    expect(latest?.status).toBe('PAYOUT_SENDING');
    expect(await lockHeld()).toBe(true);
    expect(callsOf('withdrawFromVault')).toEqual([]);

    hooks.payoutSendError = null;
    await reconcileWithdrawRequests({ chain: CHAIN });
    expect((await getVaultStore().findWithdrawRequest(latest!.id))?.status).toBe('PAYOUT_SENDING');
    vi.setSystemTime(new Date('2026-10-27T03:00:00Z'));
    await reconcileWithdrawRequests({ chain: CHAIN });
    expect((await getVaultStore().findWithdrawRequest(latest!.id))?.status).toBe('PAYOUT_REVIEW');
    expect(await lockHeld()).toBe(true);
    expect(callsOf('withdrawFromVault')).toEqual([]);
  });

  it('ca 15: biên nhận đặt ví nhận FAILED: FAILED, khoá nhả, vault giữ ví cũ, không rút', async () => {
    hooks.payoutNotExecuted = true;
    hooks.waitReceipt = (txHash) => ({ txHash, status: 'FAILED', reason: 'revert' });
    const result = await withdraw();
    expect(result).toMatchObject({ ok: false, code: 'LEDGER' });
    const [request] = await getVaultStore().listWithdrawRequests({ chain: CHAIN });
    expect(request).toMatchObject({ status: 'FAILED' });
    expect(request?.payoutTxHash).toMatch(/^0x/);
    expect(await lockHeld()).toBe(false);
    expect(await vaultPayout()).toBe(SELLER_SAMPLE);
    expect(callsOf('withdrawFromVault')).toEqual([]);
  });
});

describe('FIX-01 ca 16: biên nhận đặt ví nhận chưa có', () => {
  beforeEach(() => preparedVault());

  it('PAYOUT_SENT giữ khoá; lệnh mới chọn ví đang hiện trên chuỗi: VAULT_BUSY, không rút; CONFIRMED thì đối soát sang PAYOUT_SET (không chờ); gửi rút COMPLETED', async () => {
    hooks.payoutNotExecuted = true;
    hooks.waitReceipt = (txHash) => ({ txHash, status: 'PENDING' });
    const created = await withdraw();
    expect(created.ok && created.data.status, created.ok ? '' : created.error).toBe('PAYOUT_SENT');
    if (!created.ok) return;
    expect(await lockHeld()).toBe(true);

    // Khoá quá hạn mà giao dịch cũ còn chờ: lệnh mới chọn đúng ví đang hiện trên chuỗi vẫn bị chặn.
    hooks.waitReceipt = null;
    const second = await withdraw({ payoutWallet: SELLER_SAMPLE });
    expect(second).toMatchObject({ ok: false, code: 'VAULT_BUSY' });
    expect(callsOf('withdrawFromVault')).toEqual([]);

    hooks.txReceiptStatus = () => 'PENDING';
    await reconcileWithdrawRequests({ chain: CHAIN });
    expect((await getVaultStore().findWithdrawRequest(created.data.id))?.status).toBe('PAYOUT_SENT');

    hooks.payoutNotExecuted = false;
    await getLedger(CHAIN).setVaultPayoutWallet(NEW_PAYOUT);
    hooks.txReceiptStatus = () => 'CONFIRMED';
    hooks.calls = [];
    await reconcileWithdrawRequests({ chain: CHAIN });
    expect((await getVaultStore().findWithdrawRequest(created.data.id))?.status).toBe('PAYOUT_SET');
    expect(callsOf('waitReceipt')).toEqual([]);
    expect(callsOf('txReceiptStatus')).toHaveLength(1);
    expect(callsOf('withdrawFromVault')).toEqual([]);

    const sent = await continueWithdrawRequest({ chain: CHAIN, id: created.data.id, otp: '123456' });
    expect(sent.ok && sent.data.status, sent.ok ? '' : sent.error).toBe('COMPLETED');
    expect(callsOf('withdrawFromVault')).toHaveLength(1);
    expect(await lockHeld()).toBe(false);
  });

  it('biến thể: txReceiptStatus UNKNOWN sau thời gian chờ: PAYOUT_REVIEW', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-27T01:00:00Z'));
    hooks.payoutNotExecuted = true;
    hooks.waitReceipt = (txHash) => ({ txHash, status: 'PENDING' });
    const created = await withdraw();
    if (!created.ok) throw new Error(created.error);
    hooks.txReceiptStatus = () => 'UNKNOWN';
    await reconcileWithdrawRequests({ chain: CHAIN });
    expect((await getVaultStore().findWithdrawRequest(created.data.id))?.status).toBe('PAYOUT_SENT');
    vi.setSystemTime(new Date('2026-10-27T03:00:00Z'));
    await reconcileWithdrawRequests({ chain: CHAIN });
    expect((await getVaultStore().findWithdrawRequest(created.data.id))?.status).toBe('PAYOUT_REVIEW');
    expect(callsOf('withdrawFromVault')).toEqual([]);
  });
});

describe('FIX-01 ca 17: ví trên vault không khớp ví của lệnh', () => {
  beforeEach(() => preparedVault());

  it('CONFIRMED nhưng đọc lại ra ví khác: PAYOUT_REVIEW, không rút', async () => {
    hooks.vaultStatus = (status) =>
      callsOf('setVaultPayoutWallet').length > 0 ? { ...status, payoutWallet: FRESH } : status;
    const result = await withdraw();
    expect(result).toMatchObject({ ok: false, code: 'WITHDRAW_STATE' });
    const [request] = await getVaultStore().listWithdrawRequests({ chain: CHAIN });
    expect(request?.status).toBe('PAYOUT_REVIEW');
    expect(callsOf('withdrawFromVault')).toEqual([]);
    expect(await lockHeld()).toBe(true);
  });

  it('lần đọc cuối trước khi gửi rút ra ví khác: FAILED, không rút, khoá nhả', async () => {
    // Cùng ví đang đặt: lần đọc 1 trong khoá, lần 2 là lần đọc cuối trước `withdrawFromVault`.
    hooks.vaultStatus = (status, n) => (n >= 2 ? { ...status, payoutWallet: FRESH } : status);
    const result = await withdraw({ payoutWallet: SELLER_SAMPLE });
    expect(result).toMatchObject({ ok: false, code: 'WITHDRAW_STATE', error: 'Ví nhận trên vault khác ví của lệnh; không gửi rút.' });
    const [request] = await getVaultStore().listWithdrawRequests({ chain: CHAIN });
    expect(request?.status).toBe('FAILED');
    expect(callsOf('withdrawFromVault')).toEqual([]);
    expect(await lockHeld()).toBe(false);
  });
});

describe('FIX-01 ca 18: tiếp tục và huỷ lệnh PAYOUT_SET', () => {
  beforeEach(() => preparedVault());

  it('vượt phần được rút: FAILED, khoá nhả, không rút', async () => {
    const request = await payoutSetRequest();
    await seedMockLedger({ paymentBalances: { [MOCK_VAULT_ADDRESS]: 450n } }, getMockLedgerStateStore(CHAIN));
    const result = await continueWithdrawRequest({ chain: CHAIN, id: request.id, otp: '123456' });
    expect(result).toMatchObject({ ok: false, code: 'WITHDRAW_STATE' });
    expect((await getVaultStore().findWithdrawRequest(request.id))?.status).toBe('FAILED');
    expect(await lockHeld()).toBe(false);
    expect(callsOf('withdrawFromVault')).toEqual([]);
  });

  it('đang tạm dừng: FAILED, khoá nhả, không rút', async () => {
    const request = await payoutSetRequest();
    await seedMockLedger({ vaultPaused: true }, getMockLedgerStateStore(CHAIN));
    const result = await continueWithdrawRequest({ chain: CHAIN, id: request.id, otp: '123456' });
    expect(result).toMatchObject({ ok: false, code: 'WITHDRAW_STATE', error: 'Vault đang tạm dừng rút.' });
    expect((await getVaultStore().findWithdrawRequest(request.id))?.status).toBe('FAILED');
    expect(await lockHeld()).toBe(false);
    expect(callsOf('withdrawFromVault')).toEqual([]);
  });

  it('người không tạo lệnh: WITHDRAW_STATE; mã một lần sai: không giao dịch', async () => {
    const request = await payoutSetRequest();
    actAs('SELLER', 'NB002');
    expect(await continueWithdrawRequest({ chain: CHAIN, id: request.id, otp: '123456' })).toMatchObject({
      ok: false,
      code: 'WITHDRAW_STATE',
    });
    actAs('SELLER', 'NB001');
    expect(await continueWithdrawRequest({ chain: CHAIN, id: request.id, otp: '12' })).toMatchObject({ ok: false, code: 'VALIDATION' });
    expect(callsOf('withdrawFromVault')).toEqual([]);
    expect((await getVaultStore().findWithdrawRequest(request.id))?.status).toBe('PAYOUT_SET');
  });

  it('huỷ lệnh PAYOUT_SET: FAILED, khoá nhả; lệnh ở trạng thái khác: WITHDRAW_STATE', async () => {
    const request = await payoutSetRequest();
    const cancelled = await cancelWithdrawRequest({ chain: CHAIN, id: request.id });
    expect(cancelled.ok && cancelled.data).toMatchObject({ status: 'FAILED', reason: 'Đã huỷ' });
    expect(await lockHeld()).toBe(false);
    expect(await vaultPayout()).toBe(NEW_PAYOUT);
    expect(await cancelWithdrawRequest({ chain: CHAIN, id: request.id })).toMatchObject({ ok: false, code: 'WITHDRAW_STATE' });
  });
});

describe('FIX-01 ca 19: mã một lần sai khi tạo lệnh', () => {
  beforeEach(() => preparedVault());

  it('không giao dịch; không dòng audit nào chứa mã đã nhập', async () => {
    const result = await withdraw({ otp: '98765' });
    expect(result).toMatchObject({ ok: false, code: 'VALIDATION' });
    expect(hooks.calls.filter((c) => c.method === 'setVaultPayoutWallet' || c.method === 'withdrawFromVault')).toEqual([]);
    const all = await getStore().listAudit({ limit: 100 });
    expect(all.some((row) => row.detail?.includes('98765') || row.target?.includes('98765'))).toBe(false);
  });
});

describe('FIX-01 ca 20: chống trùng có ví nhận (bộ nhớ)', () => {
  beforeEach(() => preparedVault());

  it('cùng mã, khác ví khi lệnh cũ PAYOUT_SENT: WITHDRAW_STATE, không giao dịch mới', async () => {
    hooks.payoutNotExecuted = true;
    hooks.waitReceipt = (txHash) => ({ txHash, status: 'PENDING' });
    const clientRequestId = uuid();
    const first = await withdraw({ clientRequestId });
    expect(first.ok && first.data.status).toBe('PAYOUT_SENT');
    hooks.calls = [];
    const differ = await withdraw({ clientRequestId, payoutWallet: SELLER_SAMPLE });
    expect(differ).toMatchObject({ ok: false, code: 'WITHDRAW_STATE' });
    expect(hooks.calls.filter((c) => c.method === 'setVaultPayoutWallet' || c.method === 'withdrawFromVault')).toEqual([]);
  });

  it('hai yêu cầu đồng thời cùng mã, cùng nội dung: đúng một lệnh, một lần đặt ví nhận, một lần rút', async () => {
    const clientRequestId = uuid();
    const results = await Promise.all([withdraw({ clientRequestId }), withdraw({ clientRequestId })]);
    expectOneWinner(results);
    expect(await getVaultStore().listWithdrawRequests({ chain: CHAIN })).toHaveLength(1);
    expect(callsOf('setVaultPayoutWallet')).toHaveLength(1);
    expect(callsOf('withdrawFromVault')).toHaveLength(1);
  });
});

describe('FIX-01 ca 20b: Kiểm soát viên chốt lệnh PAYOUT_REVIEW', () => {
  beforeEach(() => preparedVault());

  async function payoutReviewRequest() {
    hooks.vaultStatus = (status) =>
      callsOf('setVaultPayoutWallet').length > 0 ? { ...status, payoutWallet: FRESH } : status;
    await withdraw();
    hooks.vaultStatus = null;
    const [request] = await getVaultStore().listWithdrawRequests({ chain: CHAIN });
    expect(request?.status).toBe('PAYOUT_REVIEW');
    actAs('CONTROLLER', 'KSV001');
    return request!;
  }

  it('còn giao dịch đang chờ: từ chối; không còn: chốt FAILED, khoá nhả; COMPLETED: từ chối', async () => {
    const request = await payoutReviewRequest();
    expect(await resolveWithdrawRequest({ chain: CHAIN, id: request.id, outcome: 'COMPLETED', txHash: request.payoutTxHash! })).toMatchObject({
      ok: false,
      code: 'WITHDRAW_STATE',
    });
    hooks.pendingSignerTx = true;
    const blocked = await resolveWithdrawRequest({ chain: CHAIN, id: request.id, outcome: 'FAILED', reason: 'đã kiểm explorer' });
    expect(blocked).toMatchObject({
      ok: false,
      code: 'WITHDRAW_STATE',
      error: 'Ví ký ngân hàng còn giao dịch đang chờ; chờ giao dịch đó có kết cục rồi chốt lại.',
    });
    expect(await lockHeld()).toBe(true);
    hooks.pendingSignerTx = false;
    const failed = await resolveWithdrawRequest({ chain: CHAIN, id: request.id, outcome: 'FAILED', reason: 'đã kiểm explorer' });
    expect(failed.ok && failed.data.status).toBe('FAILED');
    expect(await lockHeld()).toBe(false);
  });

  it('hồi quy: lệnh NEEDS_REVIEW thường (tạo thẳng SENDING, mất mã rút) vẫn chốt COMPLETED bằng mã ứng viên', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-27T01:00:00Z'));
    hooks.withdrawLosesHash = true;
    const lost = await withdraw({ payoutWallet: SELLER_SAMPLE });
    expect(lost).toMatchObject({ ok: false, code: 'LEDGER' });
    vi.setSystemTime(new Date('2026-10-27T03:00:00Z'));
    await reconcileWithdrawRequests({ chain: CHAIN });
    const [request] = await getVaultStore().listWithdrawRequests({ chain: CHAIN });
    expect(request?.status).toBe('NEEDS_REVIEW');
    const [candidate] = await getLedger(CHAIN).findVaultWithdrawals({ fromBlock: 0n, to: SELLER_SAMPLE, amount: 100n });
    actAs('CONTROLLER', 'KSV001');
    const done = await resolveWithdrawRequest({ chain: CHAIN, id: request!.id, outcome: 'COMPLETED', txHash: candidate!.txHash });
    expect(done.ok && done.data.status, done.ok ? '' : done.error).toBe('COMPLETED');
  });
});

// =============================================================================
//  H. CẤU HÌNH VAULT, C. MENU (ca 21, 22)
// =============================================================================

describe('FIX-01 ca 21: Kiểm soát viên không còn đặt ví nhận', () => {
  it('saveVaultConfig bỏ qua payoutWallet; planVaultConfig không bao giờ trả bước đặt ví nhận', async () => {
    actAs('CONTROLLER', 'KSV001');
    const saved = await saveVaultConfig({ chain: CHAIN, mode: 'PERCENT', percent: '20', payoutWallet: SELLER_SAMPLE });
    expect(saved.ok, saved.ok ? '' : saved.error).toBe(true);
    expect(saved.ok && saved.data.steps.map((step) => step.kind)).toEqual(['setPercentRate', 'setLockMode']);
    expect(callsOf('setVaultPayoutWallet')).toEqual([]);
    expect(await vaultPayout()).toBeNull();
    for (const lockMode of ['UNSET', 'FIXED', 'PERCENT'] as const) {
      const current = { lockMode, fixedLockAmount: 5n, percentRateBps: 100n, pendingPercentRateBps: null };
      for (const target of [{ mode: 'FIXED' as const, fixedLock: 7n }, { mode: 'PERCENT' as const, percentBps: 300n }]) {
        expect(planVaultConfig(current, target).map((step) => step.kind)).not.toContain('setPayoutWallet');
      }
    }
  });
});

describe('FIX-01 ca 22: nhóm menu Nghiệp vụ ẩn', () => {
  const menu = (role: Role) =>
    withHiddenOps(NAV_BY_ROLE[role], { demoPayment: canMintDemoPayment(role), walletBinding: can(role, 'investor:whitelist') });
  const hidden = (role: Role) => menu(role).groups.find((group) => group.label === HIDDEN_OPS_GROUP_LABEL);

  it('cờ bật: Giao dịch viên có nhóm thu gọn, Nạp VNDB đứng trước Định danh ví; vai khác không có nhóm', () => {
    process.env.ENABLE_DEMO_PAYMENT_MINT = 'true';
    resetServerEnvCache();
    const group = hidden('TELLER');
    expect(group).toMatchObject({ collapsible: true });
    expect(group?.items.map((item) => item.label)).toEqual(['Nạp VNDB', 'Định danh ví']);
    expect(menu('TELLER').groups.map((g) => g.label).slice(0, 2)).toEqual(['Vận hành', HIDDEN_OPS_GROUP_LABEL]);
    for (const role of ['INVESTOR', 'SELLER', 'CONTROLLER'] as const) expect(hidden(role), role).toBeUndefined();
  });

  it('cờ tắt: chỉ còn Định danh ví', () => {
    process.env.ENABLE_DEMO_PAYMENT_MINT = 'false';
    resetServerEnvCache();
    expect(hidden('TELLER')?.items.map((item) => item.href)).toEqual(['/wallet-binding']);
  });
});

// =============================================================================
//  POSTGRES (ca 20 phần Postgres, ca 23, ca 24)
// =============================================================================

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const DB_NAME = `bidv_fix01_${process.pid}`;

function isolatedUrl(): string {
  const url = new URL(TEST_DATABASE_URL!);
  url.pathname = `/${DB_NAME}`;
  return url.toString();
}

async function admin<T>(sql: string, url = TEST_DATABASE_URL!): Promise<T[]> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return (await client.query(sql)).rows as T[];
  } finally {
    await client.end();
  }
}

describe.skipIf(!TEST_DATABASE_URL)('FIX-01 Postgres: ca 23, 24, 20', () => {
  const previous = { DATABASE_URL: process.env.DATABASE_URL };

  beforeAll(async () => {
    await admin(`DROP DATABASE IF EXISTS "${DB_NAME}"`);
    await admin(`CREATE DATABASE "${DB_NAME}"`);
    process.env.DATABASE_URL = isolatedUrl();
  });

  beforeEach(() => {
    process.env.USE_MOCK_DB = 'false';
    process.env.DATABASE_URL = isolatedUrl();
    resetServerEnvCache();
    resetStoreCache();
  });

  afterAll(async () => {
    if (previous.DATABASE_URL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous.DATABASE_URL;
    await admin(`DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`);
  });

  it('ca 23: database cũ có ProfileWallet 2 dòng, chưa có WalletBinding: khởi tạo pool tạo bảng mới (rỗng, có chỉ mục), ProfileWallet giữ nguyên', async () => {
    vi.resetModules();
    const first = await import('@/lib/store/postgres.pool');
    await first.pgQuery('SELECT 1');
    await admin(
      `DROP TABLE "WalletBinding";
       INSERT INTO "ProfileWallet" ("actorId","chain","wallet","walletKey","updatedBy")
       VALUES ('NDT001','evm','${FRESH}','${FRESH.toLowerCase()}','NDT001'),
              ('NB001','evm','${SECOND}','${SECOND.toLowerCase()}','NB001')`,
      isolatedUrl(),
    );
    vi.resetModules();
    const { resetServerEnvCache: resetEnv } = await import('@/lib/config/env');
    resetEnv();
    const second = await import('@/lib/store/postgres.pool');
    await second.pgQuery('SELECT 1');
    expect(await admin(`SELECT count(*)::int AS n FROM "WalletBinding"`, isolatedUrl())).toEqual([{ n: 0 }]);
    const indexes = await admin<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'WalletBinding' ORDER BY indexname`,
      isolatedUrl(),
    );
    expect(indexes.map((row) => row.indexname)).toEqual([
      'WalletBinding_chain_actorId_idx',
      'WalletBinding_chain_boundAt_idx',
      'WalletBinding_pkey',
    ]);
    expect(await admin(`SELECT count(*)::int AS n FROM "ProfileWallet"`, isolatedUrl())).toEqual([{ n: 2 }]);
    vi.resetModules();
  });

  it('ca 24: hai lần gắn cùng ví cho hai hồ sơ song song: đúng một thành công; cùng hồ sơ hai ví: cả hai thành công', async () => {
    actAs('TELLER', 'GDV001');
    const wallet = '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f';
    const [a, b] = await Promise.all([
      bindProfileWallet({ chain: CHAIN, actorId: 'NDT001', wallet }),
      bindProfileWallet({ chain: CHAIN, actorId: 'NB001', wallet }),
    ]);
    const outcomes = [a, b].map((result) => (result.ok ? 'ok' : result.error));
    expect(outcomes.filter((outcome) => outcome === 'ok')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome === TAKEN)).toHaveLength(1);

    const [c, d] = await Promise.all([
      bindProfileWallet({ chain: CHAIN, actorId: 'NDT001', wallet: '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720' }),
      bindProfileWallet({ chain: CHAIN, actorId: 'NDT001', wallet: '0xBcd4042DE499D14e55001CcbB24a551F3b954096' }),
    ]);
    expect(c.ok && d.ok, [c, d].map((r) => (r.ok ? '' : r.error)).join(' ')).toBe(true);
  });

  it('ca 20 (Postgres): cùng mã khác ví khi lệnh cũ PAYOUT_SENT bị từ chối; hai yêu cầu đồng thời cùng nội dung: một lệnh, một lần đặt ví nhận', async () => {
    await preparedVault();
    hooks.payoutNotExecuted = true;
    hooks.waitReceipt = (txHash) => ({ txHash, status: 'PENDING' });
    const clientRequestId = uuid();
    const first = await withdraw({ clientRequestId });
    expect(first.ok && first.data.status, first.ok ? '' : first.error).toBe('PAYOUT_SENT');
    hooks.calls = [];
    expect(await withdraw({ clientRequestId, payoutWallet: SELLER_SAMPLE })).toMatchObject({ ok: false, code: 'WITHDRAW_STATE' });
    expect(hooks.calls.filter((c) => c.method === 'setVaultPayoutWallet' || c.method === 'withdrawFromVault')).toEqual([]);

    // Dọn lệnh dở rồi thử song song trên vault mới.
    if (first.ok) {
      hooks.txReceiptStatus = () => 'FAILED';
      await reconcileWithdrawRequests({ chain: CHAIN });
      expect((await getVaultStore().findWithdrawRequest(first.data.id))?.status).toBe('FAILED');
    }
    resetHooks();
    const concurrent = uuid();
    const results = await Promise.all([withdraw({ clientRequestId: concurrent }), withdraw({ clientRequestId: concurrent })]);
    expectOneWinner(results);
    const rows = (await getVaultStore().listWithdrawRequests({ chain: CHAIN })).filter((row) => row.clientRequestId === concurrent);
    expect(rows).toHaveLength(1);
    expect(callsOf('setVaultPayoutWallet')).toHaveLength(1);
    expect(callsOf('withdrawFromVault')).toHaveLength(1);
  });
});
