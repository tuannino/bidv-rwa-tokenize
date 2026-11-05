import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { explorerTxUrl, type ChainKey } from '@bidv/shared';
import { Button } from '@/components/ui/button';
import { nf } from '@/components/seller/format';
import { SellerWithdrawRow } from '@/components/seller/seller-withdraw-row';
import { short } from '@/components/withdraw/format';
import type { WithdrawRequestView } from '@/lib/bank/withdraw.service';

/**
 * FE-UX-05c (design mục 3): số lời gọi action, effect của `/seller/withdraw` (QĐ-2), biểu thức khoá nguyên văn (QĐ-1),
 * `SellerWithdrawRow` dựng bằng `renderToStaticMarkup` với dữ liệu giả (QĐ-5, QĐ-6), nối callback của dòng `PAYOUT_SET`.
 */

const read = (file: string) => readFileSync(join(__dirname, '..', 'src/components', file), 'utf8');
const count = (source: string, needle: string) => source.split(needle).length - 1;
const flat = (source: string) => source.replace(/\s+/g, ' ');
const PAGE = 'pages/seller-withdraw.tsx';
const ROW = 'seller/seller-withdraw-row.tsx';

describe('FE-UX-05c nhóm 1: mã nguồn (số lời gọi bằng mốc, biểu thức khoá)', () => {
  it.each([
    ['reconcileAndListMyWithdrawRequestsAction(', 1],
    ['checkPayoutWalletAction(', 1],
    ['createWithdrawRequestAction(', 1],
    ['continueWithdrawRequestAction(', 1],
    ['cancelWithdrawRequestAction(', 1],
    ['useEffect(', 1],
    ['useSellerOverview(', 1],
  ] as const)(`${PAGE}: %s đúng %i`, (needle, expected) => {
    expect(count(read(PAGE), needle)).toBe(expected);
  });

  it.each([
    'reconcileAndListMyWithdrawRequestsAction({ chain })',
    'disabled={!canSubmit}',
    'disabled={!address}',
    'disabled={!/^\\d{6}$/.test(otp) || submitting}',
    'aria-label="Kết quả lệnh rút"',
    'data-testid="withdrawable"',
    'data-testid="otp-payout-wallet"',
    'aria-label="Yêu cầu rút của tôi"',
    '<SellerWithdrawRow key={r.id}',
    "role={feedback.tone === 'error' ? 'alert' : 'status'}",
  ])(`${PAGE}: có nguyên văn %s`, (expression) => {
    expect(count(flat(read(PAGE)), expression)).toBe(1);
  });

  it(`${PAGE}: không còn const short, explorerTxUrl`, () => {
    const source = read(PAGE);
    for (const needle of ['const short', 'explorerTxUrl']) expect(source).not.toContain(needle);
  });

  it(`${ROW}: không Action(, useEffect(, useState(; short, nf nhập đúng nguồn; điều kiện PAYOUT_SET`, () => {
    const source = read(ROW);
    for (const needle of ['Action(', 'useEffect(', 'useState(']) expect(source).not.toContain(needle);
    expect(source).toContain("import { short } from '@/components/withdraw/format'");
    expect(source).toContain("import { nf } from '@/components/seller/format'");
    expect(count(source, "row.status === 'PAYOUT_SET'")).toBe(1);
  });

  it.each([PAGE, ROW])('%s: nhập từ withdraw.service chỉ bằng import type', (file) => {
    expect(read(file)).not.toMatch(/^import\s+(?!type\b)[^;]*from '@\/lib\/bank\/withdraw\.service'/m);
  });
});

const ID = '6a0f4c58-2b7e-4d19-8c3a-9e1f0d2b7a64';
const PAYOUT = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
const HASH = '0x8f3c2a91d4e5b6c7a8f9e0d1c2b3a4f5e6d7c8b9a0f1e2d3c4b5a6f7e8d9c0b1';
const REASON = `Biên nhận ${HASH} thành công nhưng không có sự kiện Withdrawn tới ${PAYOUT} đúng 500000000 VNDB.`;
const view = (extra: Partial<WithdrawRequestView>): WithdrawRequestView => ({
  id: ID,
  chain: 'mock',
  amount: '500000000',
  purpose: 'Chi trả nhà thầu',
  note: null,
  payoutWallet: PAYOUT,
  status: 'COMPLETED',
  txHash: null,
  payoutTxHash: null,
  reason: null,
  createdBy: 'NB001',
  createdAt: '2026-11-05T08:30:00.000Z',
  completedAt: null,
  ...extra,
});
const noop = () => {};
const row = (extra: Partial<WithdrawRequestView>, chain: ChainKey = 'mock') =>
  renderToStaticMarkup(
    createElement(
      'table',
      null,
      createElement(
        'tbody',
        null,
        createElement(SellerWithdrawRow, { row: view({ chain, ...extra }), chain, onContinue: noop, onCancel: noop }),
      ),
    ),
  );
const text = (html: string) => html.replace(/<[^>]+>/g, '');
const buttons = (html: string) => [...html.matchAll(/<button[^>]*>.*?<\/button>/g)].map((match) => match[0]);
/** Ô thứ `index` (0 là Mã) của dòng. */
const cell = (html: string, index: number) => [...html.matchAll(/<td[^>]*>.*?<\/td>/g)][index][0];
/** Thẻ mở của nhãn trạng thái (ô thứ 4). */
const badge = (html: string) => cell(html, 4).match(/<span[^>]*data-slot="badge"[^>]*>/)![0];

describe('FE-UX-05c nhóm 2: SellerWithdrawRow', () => {
  it('COMPLETED, txHash, chain mock: không liên kết, span có title mã đầy đủ, "Hoàn tất", không nút', () => {
    const html = row({ status: 'COMPLETED', txHash: HASH });
    expect(html).toContain('data-status="COMPLETED"');
    expect(html).not.toContain('<a');
    expect(html).toContain(`<span title="${HASH}">${short(HASH)}</span>`);
    expect(text(cell(html, 4))).toBe('Hoàn tất');
    expect(buttons(html)).toEqual([]);
  });

  it('COMPLETED, txHash, chain evm: liên kết explorer mở tab mới, chữ rút gọn', () => {
    const html = row({ status: 'COMPLETED', txHash: HASH }, 'evm');
    const link = html.match(/<a[^>]*>.*?<\/a>/)![0];
    expect(link).toContain('target="_blank"');
    expect(link).toContain('rel="noreferrer"');
    expect(link).toContain(`href="${explorerTxUrl('evm', HASH)}"`);
    expect(text(link)).toBe(short(HASH));
  });

  it('PAYOUT_SET, chưa có txHash: đúng 2 nút "Gửi lệnh rút", "Huỷ"; nhãn chờ gửi rút; ô giao dịch rỗng', () => {
    const html = row({ status: 'PAYOUT_SET' });
    expect(buttons(html).map(text)).toEqual(['Gửi lệnh rút', 'Huỷ']);
    expect(text(cell(html, 4))).toBe('Đã đặt ví nhận, chờ gửi rút');
    expect(text(cell(html, 5))).toBe('');
  });

  it('NEEDS_REVIEW có lý do: nhãn "Cần Kiểm soát viên xem" có title bằng lý do, không nút', () => {
    const html = row({ status: 'NEEDS_REVIEW', txHash: HASH, reason: REASON });
    expect(text(cell(html, 4))).toBe('Cần Kiểm soát viên xem');
    expect(badge(html)).toContain(`title="${REASON}"`);
    expect(buttons(html)).toEqual([]);
  });

  it('FAILED không lý do: nhãn "Thất bại", không thuộc tính title trên nhãn', () => {
    const html = row({ status: 'FAILED' });
    expect(text(cell(html, 4))).toBe('Thất bại');
    expect(badge(html)).not.toContain('title=');
  });

  it('mọi dòng: mã 8 ký tự có title, ví nhận rút gọn có title, số tiền theo nf của Người bán', () => {
    const html = row({ status: 'COMPLETED' });
    expect(cell(html, 0)).toContain(`title="${ID}"`);
    expect(text(cell(html, 0))).toBe(ID.slice(0, 8));
    expect(cell(html, 2)).toContain(`title="${PAYOUT}"`);
    expect(text(cell(html, 2))).toBe(short(PAYOUT));
    expect(text(cell(html, 1))).toBe(nf('500000000'));
  });
});

/** Duyệt cây phần tử React (không dựng DOM), trả mọi phần tử thoả `match`. */
function collect(node: ReactNode, match: (element: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap((child) => collect(child, match));
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  const own = match(node) ? [node] : [];
  return [...own, ...collect(node.props.children as ReactNode, match)];
}
const childText = (node: ReactNode): string =>
  Array.isArray(node)
    ? node.map(childText).join('')
    : isValidElement<{ children?: ReactNode }>(node)
      ? childText(node.props.children)
      : typeof node === 'string' || typeof node === 'number'
        ? String(node)
        : '';

describe('FE-UX-05c nhóm 3: nối callback của dòng PAYOUT_SET', () => {
  const buttonsOf = (status: WithdrawRequestView['status'], onContinue: () => void, onCancel: () => void) =>
    collect(SellerWithdrawRow({ row: view({ status }), chain: 'mock', onContinue, onCancel }), (element) => element.type === Button);

  it('"Gửi lệnh rút" gọi onContinue đúng 1 lần, "Huỷ" gọi onCancel đúng 1 lần, không lẫn nhau', () => {
    const onContinue = vi.fn();
    const onCancel = vi.fn();
    const found = buttonsOf('PAYOUT_SET', onContinue, onCancel);
    const send = found.filter((element) => childText(element.props.children as ReactNode) === 'Gửi lệnh rút');
    const cancel = found.filter((element) => childText(element.props.children as ReactNode) === 'Huỷ');
    expect(send).toHaveLength(1);
    expect(cancel).toHaveLength(1);

    (send[0].props.onClick as () => void)();
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(0);

    onContinue.mockReset();
    onCancel.mockReset();
    (cancel[0].props.onClick as () => void)();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledTimes(0);
  });

  it('COMPLETED: không phần tử Button nào', () => {
    expect(buttonsOf('COMPLETED', vi.fn(), vi.fn())).toEqual([]);
  });
});
