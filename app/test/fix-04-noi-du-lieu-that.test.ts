import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ILedgerPort } from '@/lib/ledger/ledger.port';

/**
 * FIX-04: nối dữ liệu thật cho Tổng quan Nhà đầu tư, Người bán, Tài khoản; ghi chú "unverified".
 * Ca 1 tới 5, 8 kiểm hai lần đọc THÊM ở `portfolio.service` (B1 số dư VNDB, B2 tên dự án) trên chain
 * mock, kể cả khi lần đọc thêm lỗi. Ca 6, 6b kiểm phần logic thuần của hook dùng chung. Ca 7 quét mã.
 */
const fault = vi.hoisted(() => ({
  /** Lỗi `paymentBalanceOf` sẽ ném; `null` là đọc bình thường. */
  paymentBalance: null as Error | null,
  /** `'throw'`: `findProject` ném; `'none'`: trả `null` như bảng không có dòng. */
  findProject: null as null | 'throw' | 'none',
}));

vi.mock('@/lib/ledger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ledger')>();
  return {
    ...actual,
    getLedger: (...args: Parameters<typeof actual.getLedger>): ILedgerPort => {
      const real = actual.getLedger(...args);
      return new Proxy(real, {
        get(target, prop, receiver) {
          if (prop === 'paymentBalanceOf' && fault.paymentBalance) {
            const error = fault.paymentBalance;
            return async () => {
              throw error;
            };
          }
          const value = Reflect.get(target, prop, receiver);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    },
  };
});

vi.mock('@/lib/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/store')>();
  return {
    ...actual,
    getProjectStore: () => {
      const real = actual.getProjectStore();
      return new Proxy(real, {
        get(target, prop, receiver) {
          if (prop === 'findProject' && fault.findProject === 'throw') {
            return async () => {
              throw new Error('đọc bảng dự án lỗi');
            };
          }
          if (prop === 'findProject' && fault.findProject === 'none') return async () => null;
          const value = Reflect.get(target, prop, receiver);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    },
  };
});

const { resetServerEnvCache } = await import('@/lib/config/env');
const { resetMockLedger, seedMockLedger } = await import('@/lib/ledger/mock.adapter');
const { getLedger } = await import('@/lib/ledger');
const { getProjectStore, resetMemoryStore, resetStoreCache } = await import('@/lib/store');
const { getPortfolio, getTokenSummary } = await import('@/lib/bank/portfolio.service');
const { readEffectiveIssuePrice } = await import('@/lib/bank/issue-price');
const state = await import('@/components/investor/token-summary-state');

const SRC = path.resolve(__dirname, '../src');
const read = (file: string) => readFileSync(path.join(SRC, file), 'utf8');
const CHAIN = 'mock';
const ALICE = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

function actAs(role: string) {
  process.env.DEMO_ROLE = role;
  resetServerEnvCache();
}

beforeEach(() => {
  fault.paymentBalance = null;
  fault.findProject = null;
  resetMockLedger();
  resetMemoryStore();
  resetStoreCache();
  process.env.USE_MOCK_DB = 'true';
  actAs('INVESTOR');
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.DEMO_ROLE;
  delete process.env.USE_MOCK_DB;
  resetServerEnvCache();
  resetStoreCache();
});

async function seedAlice() {
  const ledger = getLedger(CHAIN);
  await ledger.whitelist(ALICE);
  await ledger.mint(ALICE, 7n);
  seedMockLedger({ paymentBalances: { [ALICE]: 2_500_000n } });
  return ledger;
}

describe('FIX-04 B1: số dư VNDB trong getPortfolio', () => {
  it('ca 1: paymentBalance bằng số dư VNDB của ví; các trường cũ không đổi', async () => {
    const ledger = await seedAlice();

    const result = await getPortfolio({ chain: CHAIN, wallet: ALICE });

    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.data.paymentBalance).toBe((await ledger.paymentBalanceOf(ALICE)).toString());
    expect(result.data.paymentBalance).toBe('2500000');
    const info = await ledger.tokenInfo();
    const price = await readEffectiveIssuePrice(CHAIN);
    expect(result.data).toMatchObject({
      wallet: ALICE,
      chain: CHAIN,
      balance: '7',
      valueVnd: (7n * price).toString(),
      issuePriceVnd: price.toString(),
      whitelisted: true,
      frozen: false,
      token: { name: info.name, symbol: info.symbol, decimals: info.decimals, totalSupply: info.totalSupply.toString() },
      recall: null,
    });
  });

  it('ca 2: paymentBalanceOf ném thì lời gọi vẫn ok, paymentBalance null, số dư WPT vẫn đúng', async () => {
    await seedAlice();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fault.paymentBalance = new Error('RPC lỗi');

    const result = await getPortfolio({ chain: CHAIN, wallet: ALICE });

    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.data.paymentBalance).toBeNull();
    expect(result.data.balance).toBe('7');
  });

  it('ca 8: log không lộ nội dung lỗi (địa chỉ RPC kèm khoá)', async () => {
    await seedAlice();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    fault.paymentBalance = new Error('fetch failed https://rpc.example/KEY123');

    const result = await getPortfolio({ chain: CHAIN, wallet: ALICE });

    expect(result.ok).toBe(true);
    expect(logged).toHaveBeenCalled();
    for (const call of logged.mock.calls) {
      for (const arg of call) expect(String(arg)).not.toContain('KEY123');
    }
  });
});

describe('FIX-04 B2: tên dự án trong getTokenSummary', () => {
  it('ca 3: projectName đúng tên trong bảng dự án; các trường cũ không đổi', async () => {
    const result = await getTokenSummary(CHAIN);

    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    const info = await getLedger(CHAIN).tokenInfo();
    const project = await getProjectStore().findProject({ tokenSymbol: info.symbol, chain: CHAIN });
    expect(project?.name).toBeTruthy();
    expect(result.data.projectName).toBe(project?.name);
    expect(result.data).toMatchObject({
      name: info.name,
      symbol: info.symbol,
      decimals: info.decimals,
      totalSupply: info.totalSupply.toString(),
      chain: CHAIN,
      issuePriceVnd: (await readEffectiveIssuePrice(CHAIN)).toString(),
    });
  });

  it('ca 4: findProject ném hoặc bảng không có dòng thì vẫn ok, projectName null', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const info = await getLedger(CHAIN).tokenInfo();
    for (const mode of ['throw', 'none'] as const) {
      fault.findProject = mode;
      const result = await getTokenSummary(CHAIN);
      expect(result.ok, `${mode}: ${result.ok ? '' : result.error}`).toBe(true);
      if (!result.ok) continue;
      expect(result.data.projectName, mode).toBeNull();
      expect(result.data.symbol, mode).toBe(info.symbol);
      expect(result.data.totalSupply, mode).toBe(info.totalSupply.toString());
    }
  });

  it('ca 5: không có quyền portfolio:read thì vẫn bị chặn như trước', async () => {
    for (const role of ['SELLER', 'TELLER', 'CONTROLLER']) {
      actAs(role);
      const result = await getTokenSummary(CHAIN);
      expect(result.ok, role).toBe(false);
      if (!result.ok) expect(result.code, role).toBe('FORBIDDEN');
    }
  });
});

describe('FIX-04 F2: logic thuần của hook dùng chung', () => {
  const summary = { name: 'Wind Power Token', symbol: 'WPT', decimals: 0, totalSupply: '0', chain: 'mock' as const, issuePriceVnd: '100000', projectName: 'Dự án thật' };

  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  it('ca 6a: hai lần gọi cùng khoá lúc đang chạy thì chạy một lần, cùng kết quả; khoá khác chạy riêng', async () => {
    const gate = deferred<string>();
    const run = vi.fn(() => gate.promise);
    const first = state.shareInflight('k-a', run);
    const second = state.shareInflight('k-a', run);
    const other = state.shareInflight('k-b', async () => 'khác');
    gate.resolve('xong');
    expect(await first).toBe('xong');
    expect(await second).toBe('xong');
    expect(await other).toBe('khác');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('ca 6b, 6c: lời gọi reject thì cả hai lần chờ nhận LOAD_FAILED, gọi lại thì chạy lần mới', async () => {
    const gate = deferred<{ ok: true; data: typeof summary }>();
    const call = vi.fn(() => gate.promise);
    const first = state.loadTokenSummary('chain-reject', call);
    const second = state.loadTokenSummary('chain-reject', call);
    gate.reject(new Error('mạng lỗi'));
    expect(await first).toEqual({ key: 'chain-reject', data: null, error: state.LOAD_FAILED });
    expect(await second).toEqual({ key: 'chain-reject', data: null, error: state.LOAD_FAILED });
    expect(call).toHaveBeenCalledTimes(1);

    const again = vi.fn(async () => ({ ok: true as const, data: summary }));
    expect(await state.loadTokenSummary('chain-reject', again)).toEqual({ key: 'chain-reject', data: summary, error: null });
    expect(again).toHaveBeenCalledTimes(1);
  });

  it('ca 6d: kết quả của chain cũ không dùng cho chain mới', () => {
    const loaded = { key: 'mock', data: summary, error: null };
    expect(state.freshFor('hardhat-local', loaded)).toBeNull();
    expect(state.freshFor('mock', loaded)).toBe(loaded);
    expect(state.freshFor('mock', null)).toBeNull();
  });

  it('ca 6b (projectNameView): tên thật khi có, còn lại tên mẫu kèm cờ unverified', () => {
    const sample = 'Điện gió An Viên';
    expect(state.projectNameView({ key: 'mock', data: summary, error: null }, sample)).toEqual({ text: 'Dự án thật', unverified: false });
    expect(state.projectNameView(null, sample)).toEqual({ text: sample, unverified: true });
    expect(state.projectNameView({ key: 'mock', data: null, error: 'lỗi' }, sample)).toEqual({ text: sample, unverified: true });
    expect(state.projectNameView({ key: 'mock', data: { ...summary, projectName: null }, error: null }, sample)).toEqual({
      text: sample,
      unverified: true,
    });
  });
});

describe('FIX-04 quét mã giao diện', () => {
  it('ca 7: MockBadge đã gỡ; UnverifiedNote đúng chỗ; hai hộp không gọi thẳng action; câu cũ đã bỏ', () => {
    const files = [
      'components/investor/issuance-status-box.tsx',
      'components/investor/token-list-box.tsx',
      'components/pages/investor-token-detail.tsx',
      'components/pages/account-info.tsx',
      'components/investor/mock-badge.tsx',
      'components/investor/asset-summary.tsx',
      'components/pages/seller-overview.tsx',
    ];
    for (const file of files) expect(read(file), file).not.toContain('MockBadge');
    for (const file of files.slice(0, 4)) expect(read(file), file).toContain('<UnverifiedNote');

    const detail = read('components/pages/investor-token-detail.tsx');
    const row = /<Row label="WPT dự kiến phát hành">([\s\S]*?)<\/Row>/.exec(detail);
    expect(row?.[1]).toContain('<UnverifiedNote');

    expect(read('components/pages/account-info.tsx').match(/note=\{<UnverifiedNote/g)?.length).toBe(4);
    for (const file of ['components/investor/issuance-status-box.tsx', 'components/investor/token-list-box.tsx']) {
      expect(read(file), file).not.toMatch(/import[^;]*getTokenSummaryAction|getTokenSummaryAction\s*\(/);
      expect(read(file), file).toContain('useTokenSummary(');
    }
    expect(read('components/investor/asset-summary.tsx')).not.toContain('chờ BE-01');
    expect(read('components/pages/seller-overview.tsx')).not.toContain('Hệ thống chưa có lệnh bán lại');
  });
});
