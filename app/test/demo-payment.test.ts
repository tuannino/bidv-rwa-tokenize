import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NAV_BY_ROLE, withDemoPayment } from '@/components/layout/nav-config';
import { ROLES } from '@/lib/rbac';
import { canMintDemoPayment } from '@/lib/rbac/demo-payment';
import { CONFIG_KEYS, DEMO_PAYMENT_MINT_MAX_VND } from '@/lib/config/issue-terms';
import { resetServerEnvCache } from '@/lib/config/env';
import { resetMockLedger } from '@/lib/ledger/mock.adapter';
import { getConfigStore, getStore, resetMemoryStore, resetStoreCache } from '@/lib/store';

/**
 * BE-16 — nạp VNDB mô phỏng. Mức kiểm chứng CAO: chức năng này tạo ra tiền.
 *
 * Mọi ca dùng chuỗi `mock` và bản lưu trữ bộ nhớ: chạy không cần node, không cần khoá ký.
 */

const CHAIN = 'mock';
const INVESTOR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const STRANGER = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const MAX = BigInt(DEMO_PAYMENT_MINT_MAX_VND);
/** Mức gợi ý cho nhà đầu tư mẫu, đọc từ nguồn chung thay vì gõ lại số. */
const SAMPLE = MAX / 2n;

function actAs(role: string) {
  process.env.DEMO_ROLE = role;
  resetServerEnvCache();
}

function setFlag(value: string | undefined) {
  if (value === undefined) delete process.env.ENABLE_DEMO_PAYMENT_MINT;
  else process.env.ENABLE_DEMO_PAYMENT_MINT = value;
  resetServerEnvCache();
}

const service = () => import('@/lib/bank/demo-payment.service');

async function ledger() {
  const { getLedger } = await import('@/lib/ledger');
  return getLedger(CHAIN);
}

async function mint(wallet: string, amount: bigint | string) {
  return (await service()).mintDemoPayment({ chain: CHAIN, wallet, amount: String(amount) });
}

const vndb = async (wallet: string) => (await ledger()).paymentBalanceOf(wallet);
const payments = async () =>
  (await getStore().listTxns({ chain: CHAIN })).filter((t) => t.operation === 'payment-mint');
const audit = async () =>
  (await getStore().listAudit({ limit: 200 })).filter((a) => a.action === 'demo:mint-payment');

beforeEach(async () => {
  resetMockLedger();
  resetMemoryStore();
  resetStoreCache();
  process.env.USE_MOCK_DB = 'true';
  setFlag('true');
  actAs('TELLER');
  // Nhà đầu tư mẫu đã KYC/whitelist: có trong danh sách nhà đầu tư.
  await (await ledger()).whitelist(INVESTOR);
});

afterEach(() => {
  delete process.env.DEMO_ROLE;
  delete process.env.USE_MOCK_DB;
  setFlag(undefined);
  resetStoreCache();
});

describe('ca 1 — cờ bật, Giao dịch viên nạp thành công', () => {
  it('số dư VNDB tăng đúng số nạp, trả số dư sau nạp, giao dịch vào bảng Txn', async () => {
    const result = await mint(INVESTOR, SAMPLE);

    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.data.balanceAfter).toBe(SAMPLE.toString());
    expect(await vndb(INVESTOR)).toBe(SAMPLE);

    const [txn] = await payments();
    expect(txn).toMatchObject({
      toWallet: INVESTOR,
      amount: SAMPLE.toString(),
      status: 'CONFIRMED',
      actorRole: 'TELLER',
    });
  });

  it('lịch sử của màn nạp thấy lần nạp vừa rồi, gợi ý nhanh không vượt trần', async () => {
    await mint(INVESTOR, SAMPLE);
    const context = await (await service()).demoPaymentContext({ chain: CHAIN });

    expect(context.ok, context.ok ? '' : context.error).toBe(true);
    if (!context.ok) return;
    expect(context.data.history.map((h) => [h.toWallet, h.amount])).toEqual([
      [INVESTOR, SAMPLE.toString()],
    ]);
    expect(context.data.maxAmount).toBe(MAX.toString());
    expect(context.data.quickAmounts.map((q) => q.amount)).toContain(SAMPLE.toString());
    expect(context.data.quickAmounts.every((q) => BigInt(q.amount) <= MAX)).toBe(true);
  });

  it('ví không có trong danh sách nhà đầu tư (chưa KYC/whitelist) bị từ chối', async () => {
    const rejected = await mint(STRANGER, 1n);
    expect(rejected.ok === false && rejected.code).toBe('NOT_WHITELISTED');
    expect(await vndb(STRANGER)).toBe(0n);
    expect(await payments()).toEqual([]);
  });
});

describe('ca 2 — cờ tắt thì từ chối, KỂ CẢ vai có quyền', () => {
  it.each([undefined, 'false', '0'])('cờ = %s: TELLER bị từ chối, số dư và bảng Txn giữ nguyên', async (flag) => {
    setFlag(flag);
    actAs('TELLER');
    const { can } = await import('@/lib/rbac');
    expect(can('TELLER', 'demo:mint-payment'), 'TELLER vẫn có quyền RBAC').toBe(true);

    const result = await mint(INVESTOR, SAMPLE);

    expect(result.ok === false && result.code).toBe('FORBIDDEN');
    expect(result.ok === false && result.error).toMatch(/ENABLE_DEMO_PAYMENT_MINT/);
    expect(await vndb(INVESTOR)).toBe(0n);
    expect(await payments()).toEqual([]);
  });

  it('cờ tắt thì màn nạp cũng không đọc được dữ liệu', async () => {
    setFlag('false');
    const context = await (await service()).demoPaymentContext({ chain: CHAIN });
    expect(context.ok === false && context.code).toBe('FORBIDDEN');
  });
});

describe('ca 3, 4 — Người bán, Nhà đầu tư, Kiểm soát viên không nạp được dù cờ bật', () => {
  it.each(['SELLER', 'INVESTOR', 'CONTROLLER'])('%s bị từ chối, số dư và bảng Txn giữ nguyên, có bản ghi DENIED', async (role) => {
    actAs(role);

    const result = await mint(INVESTOR, SAMPLE);

    expect(result.ok === false && result.code).toBe('FORBIDDEN');
    expect(await vndb(INVESTOR)).toBe(0n);
    expect(await payments()).toEqual([]);
    expect(await audit()).toMatchObject([{ outcome: 'DENIED', actorRole: role, target: INVESTOR }]);
  });
});

describe('ca 5 — vượt trần một lần nạp thì từ chối', () => {
  it('trần mặc định: MAX đi qua, MAX + 1 bị chặn trước khi gửi giao dịch', async () => {
    const over = await mint(INVESTOR, MAX + 1n);
    expect(over.ok === false && over.code).toBe('PAYMENT_MINT_LIMIT');
    expect(await vndb(INVESTOR)).toBe(0n);
    expect(await payments()).toEqual([]);

    expect((await mint(INVESTOR, MAX)).ok).toBe(true);
  });

  it('trần đọc từ cấu hình: hạ trần thì số trước đó đi qua nay bị chặn', async () => {
    await getConfigStore().setConfig({
      key: CONFIG_KEYS.demoPaymentMintMaxVnd,
      value: '1000',
      type: 'bigint',
      changedBy: 'TELLER',
    });

    expect((await mint(INVESTOR, 1001n)).ok === false).toBe(true);
    expect((await mint(INVESTOR, 1000n)).ok).toBe(true);
    expect(await vndb(INVESTOR)).toBe(1000n);
  });
});

describe('ca 6 — mọi lần nạp và mọi lần bị chặn đều có bản ghi kiểm toán', () => {
  it('thành công: ALLOWED rồi SUCCESS, ghi ai nạp, ví nào, bao nhiêu', async () => {
    await mint(INVESTOR, SAMPLE);
    const rows = await audit();

    expect(rows.map((r) => r.outcome).sort()).toEqual(['ALLOWED', 'SUCCESS']);
    const success = rows.find((r) => r.outcome === 'SUCCESS');
    expect(success).toMatchObject({ actorRole: 'TELLER', target: INVESTOR });
    expect(success?.detail).toContain(`nạp ${SAMPLE} VNDB vào ví ${INVESTOR}`);
  });

  it('bị chặn vì cờ tắt: DENIED, ghi vai và ví đích', async () => {
    setFlag('false');
    await mint(INVESTOR, SAMPLE);
    const rows = await audit();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ outcome: 'DENIED', actorRole: 'TELLER', target: INVESTOR });
    expect(rows[0].detail).toMatch(/ENABLE_DEMO_PAYMENT_MINT/);
  });

  it('bị chặn vì vượt trần hoặc ví lạ: FAILURE, ghi ai, ví nào, bao nhiêu', async () => {
    await mint(INVESTOR, MAX + 1n);
    await mint(STRANGER, 5n);
    const failures = (await audit()).filter((r) => r.outcome === 'FAILURE');

    expect(failures.map((r) => r.target).sort()).toEqual([INVESTOR, STRANGER].sort());
    expect(failures.find((r) => r.target === INVESTOR)?.detail).toContain(`nạp ${MAX + 1n} VNDB vào ví ${INVESTOR}`);
    expect(failures.find((r) => r.target === STRANGER)?.detail).toContain(`nạp 5 VNDB vào ví ${STRANGER}`);
  });
});

describe('ca 7 — cờ tắt thì mục menu không hiện, vào bằng đường dẫn bị chặn', () => {
  const SRC = path.resolve(__dirname, '../src');
  const hrefs = (role: (typeof ROLES)[number]) =>
    withDemoPayment(NAV_BY_ROLE[role], canMintDemoPayment(role)).groups.flatMap((g) =>
      g.items.map((i) => i.href),
    );

  it('cờ tắt: không vai nào thấy mục Nạp VNDB', () => {
    setFlag('false');
    for (const role of ROLES) expect(hrefs(role), role).not.toContain('/demo-payment');
  });

  it('cờ bật: chỉ Giao dịch viên thấy, ở nhóm Vận hành', () => {
    for (const role of ROLES) {
      expect(hrefs(role).includes('/demo-payment'), role).toBe(role === 'TELLER');
    }
    const ops = withDemoPayment(NAV_BY_ROLE.TELLER, true).groups[0];
    expect(ops.label).toBe('Vận hành');
    expect(ops.items.at(-1)?.href).toBe('/demo-payment');
  });

  it('menu và trang dùng ĐÚNG hàm hai lớp của nghiệp vụ; trang nằm trong khu vực vận hành', () => {
    // Đọc tệp thật: trang có mà quên chặn thì vào bằng đường dẫn vẫn mở, và không hằng số nào bắt được.
    const page = readFileSync(path.join(SRC, 'app/(ops)/demo-payment/page.tsx'), 'utf8');
    expect(page).toMatch(/canMintDemoPayment\(role\) \?\s*\(?\s*<DemoPaymentPage/);
    const layout = readFileSync(path.join(SRC, 'components/layout/app-layout.tsx'), 'utf8');
    expect(layout).toContain('withDemoPayment(NAV_BY_ROLE[role], canMintDemoPayment(role))');
  });
});

describe('ca 8 — sau khi nạp, nhà đầu tư đặt được lệnh mua và lệnh khớp', () => {
  const SPV = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';

  it('trần mua từ 0 lên đúng số dư mới / giá; đặt lệnh, khớp lệnh, số dư đổi đúng', async () => {
    const { issueInitialSupply } = await import('@/lib/bank/issuance.service');
    const { getTradeContext } = await import('@/lib/bank/trade.service');
    const { placeOrder, executeOrder } = await import('@/lib/bank/purchase.service');
    const { readIssuePriceVnd } = await import('@/lib/store/config-values');

    // Người bán đã phát hành nguồn cung (đường dữ liệu thử, cờ token bật riêng cho bước dựng này).
    await (await ledger()).whitelist(SPV);
    process.env.ENABLE_DEMO_TOKEN_MINT = 'true';
    const issued = await issueInitialSupply({ chain: CHAIN, spvWallet: SPV });
    delete process.env.ENABLE_DEMO_TOKEN_MINT;
    expect(issued.ok, issued.ok ? '' : issued.error).toBe(true);

    const buyCap = async () => {
      actAs('INVESTOR');
      const context = await getTradeContext({ chain: CHAIN, wallet: INVESTOR });
      if (!context.ok) throw new Error(context.error);
      return BigInt(context.data.caps.BUY.max);
    };
    expect(await buyCap(), 'chưa nạp: trần mua 0').toBe(0n);

    actAs('TELLER');
    expect((await mint(INVESTOR, SAMPLE)).ok).toBe(true);

    const price = await readIssuePriceVnd();
    const cap = await buyCap();
    expect(cap).toBe(SAMPLE / price);

    actAs('INVESTOR');
    const order = await placeOrder({ chain: CHAIN, investorWallet: INVESTOR, wptAmount: cap.toString(), side: 'BUY' });
    expect(order.ok, order.ok ? '' : order.error).toBe(true);
    if (!order.ok) return;

    actAs('TELLER');
    const executed = await executeOrder({ chain: CHAIN, orderId: order.data.id });
    expect(executed.ok, executed.ok ? '' : executed.error).toBe(true);

    const l = await ledger();
    expect(await l.balanceOf(INVESTOR)).toBe(cap);
    expect(await vndb(INVESTOR)).toBe(SAMPLE - cap * price);
    expect(await vndb(SPV)).toBe(cap * price);
  });
});
