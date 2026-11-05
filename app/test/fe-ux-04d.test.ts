import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { explorerTxUrl, type ChainKey } from '@bidv/shared';
import { badgeVariants } from '@/components/ui/badge';
import { short } from '@/components/withdraw/format';
import { PAYMENT_WITHDRAW_STATUS_LABELS, PAYMENT_WITHDRAW_STATUS_TONES } from '@/components/withdraw/labels';
import { WithdrawRequestRow } from '@/components/withdraw/withdraw-request-row';
import type { PaymentWithdrawView } from '@/lib/bank/payment-withdraw.service';

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

  it(`${PAGE}: không còn const FIELD, const short, const nf`, () => {
    const source = read(PAGE);
    expect(source).not.toContain('const FIELD');
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

const ID = '3f9a1c2e-7b44-4d1a-9e0f-2c8b6a5d4e3f';
const TO = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
const HASH = '0x8f3c2a91d4e5b6c7a8f9e0d1c2b3a4f5e6d7c8b9a0f1e2d3c4b5a6f7e8d9c0b1';
const view = (extra: Partial<PaymentWithdrawView>): PaymentWithdrawView => ({
  id: ID,
  chain: 'mock',
  fromWallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  toWallet: TO,
  amount: '1250000',
  purpose: 'Thanh toán',
  note: null,
  status: 'CREATED',
  submittedTxHash: null,
  completedTxHash: null,
  reason: null,
  createdAt: '2026-11-05T08:30:00.000Z',
  completedAt: null,
  ...extra,
});
const row = (extra: Partial<PaymentWithdrawView>, chain: ChainKey = 'mock', busy = false) =>
  renderToStaticMarkup(
    createElement(
      'table',
      null,
      createElement(
        'tbody',
        null,
        createElement(WithdrawRequestRow, { row: view({ chain, ...extra }), chain, busy, onSend: () => {}, onCancel: () => {} }),
      ),
    ),
  );
const text = (html: string) => html.replace(/<[^>]+>/g, '');
const buttons = (html: string) => [...html.matchAll(/<button[^>]*>.*?<\/button>/g)].map((match) => match[0]);
const button = (html: string, label: string) => buttons(html).find((b) => text(b) === label);
/** Thuộc tính `disabled` trên thẻ mở `button` (lớp Tailwind `disabled:` không tính). */
const isDisabled = (b: string) => /\sdisabled(=|\s|>)/.test(b.match(/<button[^>]*>/)![0]);
/** Ô thứ `index` (0 là Mã) của dòng. */
const cell = (html: string, index: number) => [...html.matchAll(/<td[^>]*>.*?<\/td>/g)][index][0];

describe('FE-UX-04d nhóm 2: WithdrawRequestRow', () => {
  it('CREATED, busy false, chưa có mã giao dịch: hai nút không disabled, ô mã giao dịch rỗng', () => {
    const html = row({});
    expect(html).toContain('data-status="CREATED"');
    expect(isDisabled(button(html, 'Gửi từ ví')!)).toBe(false);
    expect(isDisabled(button(html, 'Huỷ')!)).toBe(false);
    expect(text(cell(html, 5))).toBe('');
  });

  it('CREATED, busy true: hai nút disabled', () => {
    const html = row({}, 'mock', true);
    expect(buttons(html)).toHaveLength(2);
    for (const b of buttons(html)) expect(isDisabled(b)).toBe(true);
  });

  it('SENDING: câu chờ ví, nút Huỷ, không nút Gửi từ ví', () => {
    const html = row({ status: 'SENDING' }, 'hardhat-local');
    expect(text(html)).toContain('Đang chờ ví ký hoặc kết quả trên chuỗi');
    expect(button(html, 'Huỷ')).toBeDefined();
    expect(button(html, 'Gửi từ ví')).toBeUndefined();
  });

  it('SUBMITTED trên evm: liên kết explorer mở tab mới, chữ rút gọn, không nút', () => {
    const html = row({ status: 'SUBMITTED', submittedTxHash: HASH }, 'evm');
    const link = html.match(/<a[^>]*>.*?<\/a>/)![0];
    expect(link).toContain('target="_blank"');
    expect(link).toContain(`href="${explorerTxUrl('evm', HASH)}"`);
    expect(text(link)).toBe(short(HASH));
    expect(buttons(html)).toEqual([]);
  });

  it('COMPLETED trên mock: không liên kết, span có title mã đầy đủ, "Hoàn tất", không nút', () => {
    const html = row({ status: 'COMPLETED', completedTxHash: HASH });
    expect(html).not.toContain('<a');
    expect(html).toContain(`<span title="${HASH}">${short(HASH)}</span>`);
    expect(text(html)).toContain('Hoàn tất');
    expect(buttons(html)).toEqual([]);
  });

  it('CANCELLED có lý do: "Đã huỷ" và lý do', () => {
    const html = row({ status: 'CANCELLED', reason: 'Trình duyệt báo người dùng từ chối ký' }, 'hardhat-local');
    expect(text(html)).toContain('Đã huỷ');
    expect(text(cell(html, 6))).toBe('Trình duyệt báo người dùng từ chối ký');
  });

  it.each(Object.keys(PAYMENT_WITHDRAW_STATUS_LABELS) as PaymentWithdrawView['status'][])(
    '%s: mã 8 ký tự có title, ví nhận rút gọn có title, nhãn có lớp sắc theo bảng',
    (status) => {
      const html = row({ status });
      expect(cell(html, 0)).toContain(`title="${ID}"`);
      expect(text(cell(html, 0))).toBe(ID.slice(0, 8));
      expect(cell(html, 3)).toContain(`title="${TO}"`);
      expect(text(cell(html, 3))).toBe(short(TO));
      const badge = cell(html, 4)
        .match(/<span[^>]*data-slot="badge"[^>]*>/)![0]
        .replace(/&amp;/g, '&')
        .replace(/&gt;/g, '>');
      for (const cls of badgeVariants({ variant: PAYMENT_WITHDRAW_STATUS_TONES[status] }).split(/\s+/)) {
        expect(badge).toContain(cls);
      }
      expect(text(cell(html, 4))).toBe(PAYMENT_WITHDRAW_STATUS_LABELS[status]);
    },
  );
});

describe('FE-UX-04d nhóm 3: bảng sắc trạng thái', () => {
  it('7 khoá trùng khoá nhãn, giá trị đúng QĐ-6', () => {
    expect(Object.keys(PAYMENT_WITHDRAW_STATUS_TONES).sort()).toEqual(Object.keys(PAYMENT_WITHDRAW_STATUS_LABELS).sort());
    expect(PAYMENT_WITHDRAW_STATUS_TONES).toEqual({
      CREATED: 'warn',
      SENDING: 'warn',
      SUBMITTED: 'warn',
      COMPLETED: 'ok',
      FAILED: 'bad',
      CANCELLED: 'info',
      EXPIRED: 'info',
    });
  });
});
