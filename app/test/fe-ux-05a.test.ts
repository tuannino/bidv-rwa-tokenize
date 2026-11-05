import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { describePolicy, nf } from '@/components/seller/format';
import { SellerOverviewBody } from '@/components/seller/seller-overview-body';
import { WITHDRAW_STATUS_LABELS, WITHDRAW_STATUS_TONES } from '@/components/seller/labels';
import type { SellerOverviewView, SellerWithdrawPolicy } from '@/lib/bank/seller.service';

/**
 * FE-UX-05a (design mục 3): số lời gọi action, effect của `/seller`, `/seller/transactions` (QĐ-2), biểu thức khoá
 * nguyên văn (QĐ-1), `format.ts`, `SellerOverviewBody` dựng bằng `renderToStaticMarkup` với dữ liệu giả, bảng sắc lệnh rút.
 */

const read = (file: string) => readFileSync(join(__dirname, '..', 'src/components', file), 'utf8');
const count = (source: string, needle: string) => source.split(needle).length - 1;
const OVERVIEW = 'pages/seller-overview.tsx';
const TRANSACTIONS = 'pages/seller-transactions.tsx';
const BODY = 'seller/seller-overview-body.tsx';
const FORMAT = 'seller/format.ts';
/** Hook đọc tổng quan, nhãn và sắc lệnh rút tách khỏi hai trang để `/seller/withdraw` không kéo cả trang (QĐ-9, Supervisor duyệt). */
const HOOK = 'seller/use-seller-overview.ts';
const LABELS = 'seller/labels.ts';
const WITHDRAW = 'pages/seller-withdraw.tsx';

describe('FE-UX-05a nhóm 1: mã nguồn (số lời gọi bằng mốc, biểu thức khoá)', () => {
  it.each([
    [HOOK, 'getSellerOverviewAction(', 1],
    [HOOK, 'useEffect(', 1],
    [OVERVIEW, 'getSellerOverviewAction(', 0],
    [OVERVIEW, 'useEffect(', 0],
    [TRANSACTIONS, 'listSellerTransactionsAction(', 1],
    [TRANSACTIONS, 'useEffect(', 1],
  ] as const)('%s: %s đúng %i', (file, needle, expected) => {
    expect(count(read(file), needle)).toBe(expected);
  });

  it.each([BODY, FORMAT, LABELS])('%s: không Action(, useEffect(, useState(', (file) => {
    const source = read(file);
    for (const needle of ['Action(', 'useEffect(', 'useState(']) expect(source).not.toContain(needle);
  });

  it(`${OVERVIEW}: giữ data-chain={chain}, gọi useSellerOverview( đúng 1 lần`, () => {
    const source = read(OVERVIEW);
    expect(count(source, 'data-chain={chain}')).toBe(1);
    expect(count(source, 'useSellerOverview(')).toBe(1);
  });

  it(`${WITHDRAW}: nhập từ ba tệp mới, không còn nhập từ ./seller-overview, ./seller-transactions`, () => {
    const source = read(WITHDRAW);
    expect(source).toContain("import { describePolicy, nf } from '@/components/seller/format';");
    expect(source).toContain("import { WITHDRAW_STATUS_LABELS } from '@/components/seller/labels';");
    expect(source).toContain("import { useSellerOverview } from '@/components/seller/use-seller-overview';");
    expect(source).not.toContain("from './seller-overview'");
    expect(source).not.toContain("from './seller-transactions'");
  });

  it(`${TRANSACTIONS}: hai điều kiện khoá phân trang nguyên văn, nhập nf từ format, nhãn và sắc từ labels, không còn const FIELD`, () => {
    const source = read(TRANSACTIONS);
    expect(source).not.toContain('const FIELD');
    expect(count(source, 'disabled={page <= 1}')).toBe(1);
    expect(count(source, 'disabled={!data || page >= pages}')).toBe(1);
    expect(source).toContain("import { nf } from '@/components/seller/format';");
    expect(source).toContain("import { WITHDRAW_STATUS_LABELS, WITHDRAW_STATUS_TONES } from '@/components/seller/labels';");
  });

  it.each([BODY, FORMAT, HOOK])('%s: nhập từ seller.service chỉ bằng import type', (file) => {
    const lines = read(file)
      .split('\n')
      .filter((line) => line.includes("from '@/lib/bank/seller.service'"));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line.startsWith('import type ')).toBe(true);
  });

  it(`${BODY}: không MockBadge, không câu "Hệ thống chưa có lệnh bán lại"`, () => {
    const source = read(BODY);
    expect(source).not.toContain('MockBadge');
    expect(source).not.toContain('Hệ thống chưa có lệnh bán lại');
  });
});

const policy = (extra: Partial<SellerWithdrawPolicy>): SellerWithdrawPolicy => ({
  source: 'on-chain',
  lockMode: 'UNSET',
  fixedLockAmount: '0',
  percentRateBps: '0',
  netProceeds: '0',
  percentLocked: '0',
  ...extra,
});

describe('FE-UX-05a nhóm 2: format.ts', () => {
  it('nf: rỗng là gạch ngang U+2013 (QĐ-7), số có dấu chấm hàng nghìn, chữ không phải số giữ nguyên', () => {
    expect(nf(null)).toBe('\u2013');
    expect(nf(undefined)).toBe('\u2013');
    expect(nf('1250')).toBe('1.250');
    expect(nf('abc')).toBe('abc');
  });

  it('describePolicy: bốn câu như mã mốc', () => {
    expect(describePolicy(null)).toBe('Chain này chưa có vault thanh toán: chưa rút được.');
    expect(describePolicy(policy({}))).toBe('Nguồn on-chain: chưa cấu hình, vault khoá toàn bộ.');
    expect(describePolicy(policy({ lockMode: 'FIXED', fixedLockAmount: '500000' }))).toBe(
      'Nguồn on-chain: khoá cố định 500.000 VNDB.',
    );
    expect(
      describePolicy(
        policy({ lockMode: 'PERCENT', percentRateBps: '2500', netProceeds: '1000000', percentLocked: '250000' }),
      ),
    ).toBe('Nguồn on-chain: khoá 25% theo kỳ, làm tròn xuống; thu ròng 1.000.000 VNDB, phần khoá kỳ gần nhất 250.000 VNDB.');
  });
});

const TOKEN = {
  tokenSymbol: 'WPT',
  projectName: 'Dự án điện gió An Viên',
  issuePriceVnd: '100000',
  tokenStatus: 'ISSUED' as const,
  tradingOpen: true,
  terms: { remainingLifetimeYears: 18, annualYieldPercent: 8.5, tradingFeePercent: 0 },
  cap: '20000000',
  remaining: '19998000',
  totalSupply: '2000',
  undistributed: '1500',
  circulating: '500',
};
const overview = (): SellerOverviewView => ({
  chain: 'hardhat-local',
  recallPhase: 'NONE',
  spvWallet: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
  today: { buyCount: 3, buyWpt: '120', buyVnd: '12000000', sell: { count: 1, wpt: '20', vnd: '2000000' } },
  tokens: [TOKEN],
  wallet: {
    paymentWallet: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    paymentVnd: '14000000',
    profitPoolVnd: '3500000',
    lockedVnd: '3500000',
    withdrawableVnd: '10500000',
    policy: {
      source: 'on-chain',
      lockMode: 'PERCENT',
      fixedLockAmount: '0',
      percentRateBps: '2500',
      netProceeds: '14000000',
      percentLocked: '3500000',
    },
    payoutWallet: null,
    withdrawalsPaused: false,
    warning: null,
  },
});
const body = (data: SellerOverviewView) => renderToStaticMarkup(createElement(SellerOverviewBody, { data }));
const text = (html: string) => html.replace(/<[^>]+>/g, '');
/** Khối `[data-kpi]` thứ `i` (theo thứ tự trong HTML) kèm thẻ mở của cha trực tiếp. */
const kpis = (html: string) => [...html.matchAll(/(<div[^>]*>)<div data-kpi=""[^>]*data-tone="([^"]+)"[^>]*>(.*?)<\/div><\/div>/g)];
/** Thẻ mở của ô `Stat` có nhãn `label`. */
const stat = (html: string, label: string) => html.match(new RegExp(`<div class="([^"]*)"><p[^>]*>${label}</p>`))![1];

describe('FE-UX-05a nhóm 3: SellerOverviewBody', () => {
  it('đủ số, có token, có ví, không cảnh báo: 4 ô đúng thứ tự, sắc, cha div.rounded-lg; 5 chỉ tiêu; ô còn rút được nền vàng', () => {
    const html = body(overview());
    const cells = kpis(html);
    expect(cells.map((m) => m[2])).toEqual(['hl', 'gold', 'default', 'default']);
    expect(cells.map((m) => m[1])).toEqual(Array(4).fill('<div class="rounded-lg">'));
    const labels = cells.map((m) => text(m[3]));
    ['Số lượng mua', 'Tổng giá trị mua', 'Số lượng bán', 'Tổng giá trị bán'].forEach((label, i) =>
      expect(labels[i].startsWith(label)).toBe(true),
    );
    expect([...html.matchAll(/data-metric="([^"]+)"/g)].map((m) => m[1])).toEqual([
      'cap',
      'remaining',
      'totalSupply',
      'undistributed',
      'circulating',
    ]);
    expect(text(html)).toContain('Địa chỉ vault:');
    expect(html).not.toContain('role="alert"');
    expect(stat(html, 'VNDB còn rút được')).toContain('tile-gold');
    expect(stat(html, 'Hạn mức còn rút được')).toContain('tile-gold');
    expect(stat(html, 'Phần khoá')).not.toContain('tile-gold');
  });

  it('wallet.warning có chữ: đúng 2 role="alert" chứa câu cảnh báo', () => {
    const data = overview();
    data.wallet.warning = 'Đối soát: ProjectToken còn ghi một ví SPV khác vault.';
    const alerts = [...body(data).matchAll(/<div[^>]*role="alert"[^>]*>(.*?)<\/div><\/div>/g)];
    expect(alerts).toHaveLength(2);
    for (const alert of alerts) expect(text(alert[1])).toContain('Đối soát: ProjectToken còn ghi một ví SPV khác vault.');
  });

  it('tokens rỗng: "Chưa có dự án trên chuỗi này." đúng 2 lần', () => {
    const data = overview();
    data.tokens = [];
    expect(text(body(data)).split('Chưa có dự án trên chuỗi này.').length - 1).toBe(2);
  });

  it('chưa có ví thanh toán: câu "Chưa phát hành lần nào…"', () => {
    const data = overview();
    data.wallet.paymentWallet = null;
    expect(text(body(data))).toContain('Chưa phát hành lần nào nên chưa có ví thanh toán.');
  });

  it('không lệnh bán trong ngày: ô Số lượng bán giá trị "0", phụ "0 lệnh"', () => {
    const data = overview();
    data.today.sell = { count: 0, wpt: '0', vnd: '0' };
    const sell = kpis(body(data))[2][3];
    expect(sell).toMatch(/<span class="tabular-nums">0<\/span>/);
    expect(text(sell)).toContain('0 lệnh');
  });

  it('giao dịch tạm dừng: nhãn Trạng thái giao dịch là Badge sắc warn', () => {
    const data = overview();
    data.recallPhase = 'FROZEN';
    data.tokens = [{ ...TOKEN, tradingOpen: false }];
    const html = body(data);
    const row = html.match(/<dt[^>]*>Trạng thái giao dịch<\/dt><dd>(<span[^>]*>)(.*?)<\/span>/)!;
    expect(row[1]).toContain('data-slot="badge"');
    expect(row[1]).toContain('bg-warn-bg');
    expect(row[2]).toBe('Tạm dừng (đã đóng băng)');
  });
});

describe('FE-UX-05a nhóm 4: bảng sắc lệnh rút', () => {
  it('khoá trùng khoá nhãn, giá trị đúng QĐ-6', () => {
    expect(Object.keys(WITHDRAW_STATUS_TONES).sort()).toEqual(Object.keys(WITHDRAW_STATUS_LABELS).sort());
    for (const [status, tone] of Object.entries(WITHDRAW_STATUS_TONES)) {
      expect(tone, status).toBe(status === 'COMPLETED' ? 'ok' : status === 'FAILED' ? 'bad' : 'warn');
    }
  });
});
