import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { describePolicy, nf } from '@/components/seller/format';
import type { SellerWithdrawPolicy } from '@/lib/bank/seller.service';

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

describe('FE-UX-05a nhóm 1: mã nguồn (số lời gọi bằng mốc, biểu thức khoá)', () => {
  it.each([
    [OVERVIEW, 'getSellerOverviewAction(', 1],
    [OVERVIEW, 'useEffect(', 1],
    [TRANSACTIONS, 'listSellerTransactionsAction(', 1],
    [TRANSACTIONS, 'useEffect(', 1],
  ] as const)('%s: %s đúng %i', (file, needle, expected) => {
    expect(count(read(file), needle)).toBe(expected);
  });

  it.each([BODY, FORMAT])('%s: không Action(, useEffect(, useState(', (file) => {
    const source = read(file);
    for (const needle of ['Action(', 'useEffect(', 'useState(']) expect(source).not.toContain(needle);
  });

  it(`${OVERVIEW}: giữ data-chain={chain}, export lại nf và describePolicy`, () => {
    const source = read(OVERVIEW);
    expect(count(source, 'data-chain={chain}')).toBe(1);
    expect(source).toContain("export { describePolicy, nf } from '@/components/seller/format';");
  });

  it(`${TRANSACTIONS}: hai điều kiện khoá phân trang nguyên văn, nhập nf từ format`, () => {
    const source = read(TRANSACTIONS);
    expect(count(source, 'disabled={page <= 1}')).toBe(1);
    expect(count(source, 'disabled={!data || page >= pages}')).toBe(1);
    expect(source).toContain("import { nf } from '@/components/seller/format';");
  });

  it.each([BODY, FORMAT])('%s: nhập từ seller.service chỉ bằng import type', (file) => {
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
  it('nf: số có dấu chấm hàng nghìn, chữ không phải số giữ nguyên', () => {
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
