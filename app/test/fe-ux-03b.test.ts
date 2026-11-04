import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ActivePeriodCard } from '@/components/distribution/active-period-card';
import {
  approvalStatusTone,
  payoutStatusTone,
  periodStatusTone,
  runStatusTone,
  vaultCloseStatusTone,
} from '@/components/distribution/status-tone';
import type { ActivePeriodView } from '@/lib/bank/distribution-approval.service';
import {
  DISTRIBUTION_APPROVAL_STATUSES,
  DISTRIBUTION_PAYOUT_STATUSES,
  DISTRIBUTION_PERIOD_STATUSES,
  VAULT_CLOSE_STATUSES,
} from '@/lib/store/distribution.store.port';
import { KEEPER_RUN_STATUSES } from '@/lib/store/keeper.store.port';

/**
 * FE-UX-03b (design mục 3): sắc nhãn trạng thái (QĐ-4) và thẻ "Kỳ hoạt động" dựng bằng dữ liệu giả (QĐ-10).
 * Kỳ `OPENING`, `REAPPROVE`, `CONTINUE` khó tạo trên mock, nên kiểm nút theo tên và `disabled` ở đây.
 */

describe('FE-UX-03b sắc nhãn trạng thái', () => {
  const cases: [string, readonly string[], (status: string) => string, Record<string, string>][] = [
    ['kỳ', DISTRIBUTION_PERIOD_STATUSES, periodStatusTone, {
      OPENING: 'warn', OPEN: 'info', DISTRIBUTING: 'warn', COMPLETED: 'ok', EXPIRED: 'bad', CLOSED: 'info',
    }],
    ['duyệt', DISTRIBUTION_APPROVAL_STATUSES, approvalStatusTone, { APPROVED: 'ok', AMOUNT_CHANGED: 'warn' }],
    ['hồ sơ trả', DISTRIBUTION_PAYOUT_STATUSES, payoutStatusTone, {
      PENDING: 'warn', SENT: 'info', PAID: 'ok', FAILED: 'bad', EXPIRED: 'bad',
    }],
    ['lịch chạy', KEEPER_RUN_STATUSES, runStatusTone, { RUNNING: 'warn', SUCCESS: 'ok', FAILED: 'bad' }],
    ['chốt vault', VAULT_CLOSE_STATUSES, vaultCloseStatusTone, { PENDING: 'warn', SENT: 'info', DONE: 'ok', CONFLICT: 'bad' }],
  ];

  for (const [name, statuses, tone, expected] of cases) {
    it(`${name}: mọi giá trị đúng bảng QĐ-4, giá trị lạ là info`, () => {
      expect(Object.fromEntries(statuses.map((status) => [status, tone(status)]))).toEqual(expected);
      expect(tone('KHONG_CO')).toBe('info');
      expect(tone('toString')).toBe('info');
    });
  }
});

const TX = '0x' + 'ab'.repeat(32);

/** `ActivePeriodView` giả: chỉ các trường thẻ đọc. */
function fakeActive(opts: {
  nextAction: ActivePeriodView['nextAction'];
  status?: string;
  pendingOnChain?: boolean;
  openTxHash?: string | null;
}): ActivePeriodView {
  return {
    period: {
      id: 'p1',
      periodKey: 'evm:2026-11-04-01',
      status: opts.status ?? 'OPEN',
      approvalStatus: opts.nextAction === 'REAPPROVE' ? 'AMOUNT_CHANGED' : 'APPROVED',
      expectedAmount: '4800000000',
      approvedAmount: opts.nextAction === 'REAPPROVE' ? null : '4800000000',
      totalAmount: '4812500000',
      vaultCloseStatus: opts.nextAction === 'CONTINUE' ? 'DONE' : null,
      vaultCloseTxHash: null,
      openTxHash: opts.openTxHash ?? null,
    },
    progress: { total: 3, paid: 1, sent: 0, failed: 0, expired: 0, outstanding: 2, paidAmount: '1600000000' },
    pendingOnChain: opts.pendingOnChain ?? false,
    nextAction: opts.nextAction,
    note: 'Ghi chú giả.',
  } as unknown as ActivePeriodView;
}

function render(active: ActivePeriodView, canApprove: boolean, busy: boolean) {
  const noop = () => {};
  return renderToStaticMarkup(
    createElement(ActivePeriodCard, { chain: 'evm', active, canApprove, busy, onReapprove: noop, onContinue: noop }),
  );
}

/** Thẻ `<button>` đầy đủ có chữ khớp `name` (bỏ thẻ con và chú thích), hoặc `null`. */
function button(html: string, name: RegExp): string | null {
  for (const match of html.matchAll(/<button\b[^>]*>(.*?)<\/button>/g)) {
    if (name.test(match[1]!.replace(/<[^>]+>/g, '').trim())) return match[0];
  }
  return null;
}
const openTag = (tag: string | null) => (tag === null ? null : tag.slice(0, tag.indexOf('>') + 1));
const isDisabled = (tag: string | null) => /\sdisabled(=""|\s|>)/.test(openTag(tag) ?? '');
const hasSpinner = (tag: string | null) => /animate-spin/.test(tag ?? '');
const text = (html: string) => html.replace(/<[^>]+>/g, '');

const REAPPROVE = /^Duyệt lại số thực tế [\d.]+ VNDB$/;
const CONTINUE = /^Tiếp tục chia$/;

function expectCommon(html: string) {
  expect(html).toMatch(/^<[^>]*aria-label="Kỳ hoạt động"/);
  expect(html).toMatch(/<[^>]*role="status"[^>]*aria-label="Ghi chú kỳ hoạt động"|<[^>]*aria-label="Ghi chú kỳ hoạt động"[^>]*role="status"/);
}

describe('FE-UX-03b thẻ Kỳ hoạt động theo trạng thái', () => {
  it('REAPPROVE, OPEN, có quyền, không busy: nút Duyệt lại mở, không có Tiếp tục chia', () => {
    const html = render(fakeActive({ nextAction: 'REAPPROVE' }), true, false);
    expectCommon(html);
    const reapprove = button(html, REAPPROVE);
    expect(reapprove).not.toBeNull();
    expect(text(reapprove!)).toBe('Duyệt lại số thực tế 4.812.500.000 VNDB');
    expect(isDisabled(reapprove)).toBe(false);
    expect(button(html, CONTINUE)).toBeNull();
  });

  it('CONTINUE, có quyền, không busy: nút Tiếp tục chia mở, không quay; không có Duyệt lại', () => {
    const html = render(fakeActive({ nextAction: 'CONTINUE' }), true, false);
    expectCommon(html);
    const next = button(html, CONTINUE);
    expect(next).not.toBeNull();
    expect(isDisabled(next)).toBe(false);
    expect(hasSpinner(next)).toBe(false);
    expect(button(html, REAPPROVE)).toBeNull();
  });

  it('REAPPROVE, OPENING, đang đối soát, có mã mở kỳ: không có Duyệt lại; có câu đối soát, liên kết, "chưa đọc được"', () => {
    const html = render(fakeActive({ nextAction: 'REAPPROVE', status: 'OPENING', pendingOnChain: true, openTxHash: TX }), true, false);
    expectCommon(html);
    expect(button(html, REAPPROVE)).toBeNull();
    expect(text(html)).toContain('Đã gửi lên chuỗi, đang đối soát');
    expect(html).toMatch(new RegExp(`<a [^>]*href="[^"]*/tx/${TX}"`));
    expect(text(html)).toMatch(/Số thực tế trên chuỗi\s*chưa đọc được/);
  });

  it('busy: nút tương ứng bị khoá; Tiếp tục chia có biểu tượng quay', () => {
    const reapprove = button(render(fakeActive({ nextAction: 'REAPPROVE' }), true, true), REAPPROVE);
    expect(reapprove).not.toBeNull();
    expect(isDisabled(reapprove)).toBe(true);
    const next = button(render(fakeActive({ nextAction: 'CONTINUE' }), true, true), CONTINUE);
    expect(next).not.toBeNull();
    expect(isDisabled(next)).toBe(true);
    expect(hasSpinner(next)).toBe(true);
  });

  it('không có quyền duyệt: không có nút thao tác nào', () => {
    for (const nextAction of ['REAPPROVE', 'CONTINUE'] as const) {
      const html = render(fakeActive({ nextAction }), false, false);
      expectCommon(html);
      expect(html, nextAction).not.toMatch(/<button\b/);
    }
  });
});
