import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * FE-UX-04d (design mục 3): số lời gọi action, effect của `/withdraw` (QĐ-2), biểu thức khoá nguyên văn (QĐ-1),
 * `WithdrawRequestRow` dựng bằng `renderToStaticMarkup` với dữ liệu giả, bảng sắc trạng thái (QĐ-6).
 */

const read = (file: string) => readFileSync(join(__dirname, '..', 'src/components', file), 'utf8');
const count = (source: string, needle: string) => source.split(needle).length - 1;
const flat = (source: string) => source.replace(/\s+/g, ' ');
const PAGE = 'pages/investor-withdraw.tsx';
const ROW = 'withdraw/withdraw-request-row.tsx';
const FORMAT = 'withdraw/format.ts';

describe('FE-UX-04d nhóm 1: mã nguồn (số lời gọi bằng mốc, biểu thức khoá)', () => {
  it.each([
    ['getPaymentWithdrawPageAction(', 1],
    ['checkPaymentWithdrawTargetAction(', 1],
    ['createPaymentWithdrawAction(', 1],
    ['beginPaymentSendAction(', 1],
    ['submitPaymentWithdrawTxAction(', 1],
    ['cancelPaymentWithdrawAction(', 2],
    ['useEffect(', 1],
  ] as const)(`${PAGE}: %s đúng %i`, (needle, expected) => {
    expect(count(read(PAGE), needle)).toBe(expected);
  });

  it.each([ROW, FORMAT])('%s: không Action(, useEffect(, useState(', (file) => {
    const source = read(file);
    for (const needle of ['Action(', 'useEffect(', 'useState(']) expect(source).not.toContain(needle);
  });

  it(`${PAGE}: không còn const short, const nf`, () => {
    const source = read(PAGE);
    expect(source).not.toContain('const short');
    expect(source).not.toContain('const nf');
  });

  it.each(['disabled={!canSubmit}', 'disabled={!/^\\d{6}$/.test(otp) || busy !== null}', 'busy={busy !== null}'])(
    `${PAGE}: có nguyên văn %s`,
    (expression) => {
      expect(count(flat(read(PAGE)), expression)).toBe(1);
    },
  );

  it(`${ROW}: disabled={busy} đúng 3 lần`, () => {
    expect(count(read(ROW), 'disabled={busy}')).toBe(3);
  });

  it.each([PAGE, ROW, FORMAT])('%s: nhập từ payment-withdraw.service chỉ bằng import type', (file) => {
    const lines = read(file)
      .split('\n')
      .filter((line) => line.includes("from '@/lib/bank/payment-withdraw.service'"));
    for (const line of lines) expect(line.startsWith('import type ')).toBe(true);
  });
});
