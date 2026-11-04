import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WithdrawReviewItem } from '@/components/vault/withdraw-review-item';
import type { WithdrawReviewView } from '@/lib/bank/withdraw.service';

/**
 * FE-UX-03c (design mục 3): số lời gọi action và effect của màn `/vault` (QĐ-2), và một dòng "Lệnh rút cần xem
 * xét" dựng bằng dữ liệu giả (QĐ-5). Mock không tạo được lệnh `NEEDS_REVIEW`, `PAYOUT_REVIEW`, nên kiểm ô, nút
 * và `disabled` ở đây.
 */

describe('FE-UX-03c số lời gọi action và effect trong vault-status.tsx', () => {
  const source = readFileSync(join(__dirname, '..', 'src/components/pages/vault-status.tsx'), 'utf8');
  const count = (needle: string) => source.split(needle).length - 1;

  it('1 getVaultOverviewAction, 1 getVaultConfigHistoryAction, 2 listWithdrawReviewsAction, 3 useEffect (bằng mốc)', () => {
    expect(count('getVaultOverviewAction(')).toBe(1);
    expect(count('getVaultConfigHistoryAction(')).toBe(1);
    expect(count('listWithdrawReviewsAction(')).toBe(2);
    expect(count('useEffect(')).toBe(3);
  });
});

const ID = '3f2a9c1e-7b44-4c1a-9e2d-5a6b7c8d9e0f';
const CANDIDATE = '0x' + 'cd'.repeat(32);
const PAYOUT_TX = '0x' + 'ef'.repeat(32);

function fakeRow(status: 'NEEDS_REVIEW' | 'PAYOUT_REVIEW', opts: { candidates?: boolean; payoutTxHash?: string | null } = {}): WithdrawReviewView {
  return {
    id: ID,
    chain: 'evm',
    amount: '1500000',
    purpose: 'Rút thử',
    note: null,
    payoutWallet: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    status,
    txHash: null,
    payoutTxHash: opts.payoutTxHash ?? null,
    reason: status === 'PAYOUT_REVIEW' ? 'Mất mã giao dịch đặt ví nhận sau khi gửi.' : 'Mất mã giao dịch rút sau khi gửi.',
    createdBy: 'NB001',
    createdAt: '2026-11-04T10:00:00.000Z',
    completedAt: null,
    candidates: opts.candidates
      ? [{ txHash: CANDIDATE, blockNumber: '18412', to: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', amount: '1500000', operator: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' }]
      : [],
  };
}

function render(row: WithdrawReviewView, canResolve: boolean, busy: boolean) {
  const noop = () => {};
  return renderToStaticMarkup(
    createElement(WithdrawReviewItem, { row, canResolve, busy, txHash: '', reason: '', onChange: noop, onResolve: noop }),
  );
}

const text = (html: string) => html.replace(/<[^>]+>/g, '');
/** Các thẻ mở `<button>` có chữ đúng `name`. */
function buttons(html: string, name: string): string[] {
  return [...html.matchAll(/<button\b[^>]*>(.*?)<\/button>/g)]
    .filter((match) => text(match[1]!).trim() === name)
    .map((match) => match[0].slice(0, match[0].indexOf('>') + 1));
}
const isDisabled = (tag: string) => /\sdisabled(=""|\s|>)/.test(tag);
const hasInput = (html: string, label: string) => html.includes(`aria-label="${label} ${ID}"`);

describe('FE-UX-03c dòng lệnh rút cần xem xét theo trạng thái', () => {
  it('NEEDS_REVIEW, có quyền chốt, không busy, 1 ứng viên: ô mã giao dịch, hai nút mở; câu ứng viên cắt 8 ký tự kèm block', () => {
    const html = render(fakeRow('NEEDS_REVIEW', { candidates: true }), true, false);
    expect(html).toMatch(new RegExp(`^<div [^>]*data-request="${ID}"`));
    expect(hasInput(html, 'Mã giao dịch xác nhận')).toBe(true);
    expect(hasInput(html, 'Lý do thất bại')).toBe(true);
    for (const name of ['Xác nhận hoàn tất', 'Đánh dấu thất bại']) {
      expect(buttons(html, name), name).toHaveLength(1);
      expect(isDisabled(buttons(html, name)[0]!), name).toBe(false);
    }
    expect(text(html)).toContain(`${CANDIDATE.slice(0, 8)}…${CANDIDATE.slice(-6)} (block 18412)`);
  });

  it('NEEDS_REVIEW, không ứng viên: câu ứng viên kết thúc "không có"', () => {
    const html = render(fakeRow('NEEDS_REVIEW'), true, false);
    expect(html).toMatch(new RegExp(`^<div [^>]*data-request="${ID}"`));
    expect(text(html)).toMatch(/không chứng minh thuộc lệnh này\):\s*không có/);
  });

  it('PAYOUT_REVIEW, có quyền chốt, có payoutTxHash: chỉ ô lý do và nút Đánh dấu thất bại; câu bước đặt ví nhận', () => {
    const html = render(fakeRow('PAYOUT_REVIEW', { payoutTxHash: PAYOUT_TX }), true, false);
    expect(html).toMatch(new RegExp(`^<div [^>]*data-request="${ID}"`));
    expect(buttons(html, 'Xác nhận hoàn tất')).toHaveLength(0);
    expect(hasInput(html, 'Mã giao dịch xác nhận')).toBe(false);
    expect(hasInput(html, 'Lý do thất bại')).toBe(true);
    expect(buttons(html, 'Đánh dấu thất bại')).toHaveLength(1);
    expect(text(html)).toContain(`Lệnh dừng ở bước đặt ví nhận (giao dịch ${PAYOUT_TX.slice(0, 8)}…${PAYOUT_TX.slice(-6)})`);
  });

  it('busy: mọi nút có disabled ở cả hai trạng thái', () => {
    for (const status of ['NEEDS_REVIEW', 'PAYOUT_REVIEW'] as const) {
      const html = render(fakeRow(status), true, true);
      expect(html).toMatch(new RegExp(`^<div [^>]*data-request="${ID}"`));
      const all = [...html.matchAll(/<button\b[^>]*>/g)].map((match) => match[0]);
      expect(all.length, status).toBeGreaterThan(0);
      for (const tag of all) expect(isDisabled(tag), `${status} ${tag}`).toBe(true);
    }
  });

  it('không có quyền chốt: không ô nhập, không nút ở cả hai trạng thái', () => {
    for (const status of ['NEEDS_REVIEW', 'PAYOUT_REVIEW'] as const) {
      const html = render(fakeRow(status, { candidates: true }), false, false);
      expect(html).toMatch(new RegExp(`^<div [^>]*data-request="${ID}"`));
      expect(html, status).not.toMatch(/<input\b|<button\b/);
    }
  });
});
