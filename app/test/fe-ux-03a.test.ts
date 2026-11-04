import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { actionBlocks, ApprovalActions } from '@/components/maker-checker/approval-actions';
import type { TokenRequestDetailView } from '@/lib/bank/token-request.service';
import type { TokenRequestStatus } from '@/lib/store/token-request.store.port';

/**
 * FE-UX-03a (design mục 3): khối hành động của màn chi tiết yêu cầu dựng từ `actionBlocks` với dữ liệu giả.
 * Kiểm `disabled` của từng nút theo tên, có hay không có nút Đối soát, và các `data-testid`. Hai trạng thái
 * có cảnh báo duyệt và `EXECUTING` có `canReconcile` không e2e nào tạo được, nên kiểm ở đây.
 */

const WARNING = {
  kind: 'MINT_REMAINING',
  message: 'Số lượng vượt phần còn được phép phát hành.',
  requested: '500',
  available: '100',
} as NonNullable<TokenRequestDetailView['approveWarning']>;

/** Dữ liệu giả chỉ gồm trường `actionBlocks` và `ApprovalActions` đọc. */
function fakeDetail(status: TokenRequestStatus, opts: { warning?: boolean; canReconcile?: boolean }) {
  return {
    request: { status },
    selfApprovalReason: null,
    approveWarning: opts.warning ? WARNING : null,
    canReconcile: opts.canReconcile ?? false,
  } as unknown as TokenRequestDetailView;
}

function render(detail: TokenRequestDetailView, working: boolean, rejectReason: string) {
  const blocks = actionBlocks(detail, working, rejectReason);
  const noop = () => {};
  return renderToStaticMarkup(
    createElement(ApprovalActions, {
      status: detail.request.status,
      canReconcile: detail.canReconcile,
      ...blocks,
      working,
      rejectReason,
      feedback: null,
      onRejectReasonChange: noop,
      onApprove: noop,
      onReject: noop,
      onReconcile: noop,
    }),
  );
}

/** Thẻ mở của nút có chữ `name` (chữ nằm cuối nội dung nút), hoặc `null` khi không có nút đó. */
function buttonTag(html: string, name: string): string | null {
  for (const match of html.matchAll(/<button\b[^>]*>(.*?)<\/button>/g)) {
    if (match[1]!.replace(/<[^>]+>/g, '').trim() === name) return match[0].slice(0, match[0].indexOf('>') + 1);
  }
  return null;
}
const isDisabled = (tag: string | null) => tag !== null && /\sdisabled(=""|\s|>)/.test(tag);
/** Thuộc tính `disabled` của ô lý do (không nhầm với lớp `disabled:...` trong `fieldClass`). */
const textareaDisabled = (html: string) => isDisabled(html.match(/<textarea[^>]*id="reject-reason"[^>]*>/)?.[0] ?? null);

describe('FE-UX-03a khối hành động theo trạng thái', () => {
  it('PENDING, có cảnh báo duyệt, lý do đã nhập: Chấp nhận khoá, Từ chối mở, không Đối soát', () => {
    const html = render(fakeDetail('PENDING', { warning: true }), false, 'Sai chứng từ');
    expect(isDisabled(buttonTag(html, 'Chấp nhận'))).toBe(true);
    expect(buttonTag(html, 'Từ chối')).not.toBeNull();
    expect(isDisabled(buttonTag(html, 'Từ chối'))).toBe(false);
    expect(buttonTag(html, 'Đối soát')).toBeNull();
    expect(html).toMatch(/data-testid="approve-warning"/);
    expect(html).toMatch(/<div[^>]*role="alert"[^>]*data-testid="approve-warning"|<div[^>]*data-testid="approve-warning"[^>]*role="alert"/);
    expect(html).not.toContain('data-testid="reject-block-reason"');
    expect(textareaDisabled(html)).toBe(false);
  });

  it('PENDING, có cảnh báo duyệt, lý do rỗng: Chấp nhận và Từ chối khoá, có dòng reject-block-reason', () => {
    const html = render(fakeDetail('PENDING', { warning: true }), false, '');
    expect(isDisabled(buttonTag(html, 'Chấp nhận'))).toBe(true);
    expect(isDisabled(buttonTag(html, 'Từ chối'))).toBe(true);
    expect(buttonTag(html, 'Đối soát')).toBeNull();
    expect(html).toContain('data-testid="reject-block-reason"');
    expect(html).toContain('Phải nhập lý do từ chối.');
  });

  it('EXECUTING, canReconcile, không working: Chấp nhận, Từ chối khoá; Đối soát mở; có decision-block-reason, ô lý do khoá', () => {
    const html = render(fakeDetail('EXECUTING', { canReconcile: true }), false, '');
    expect(isDisabled(buttonTag(html, 'Chấp nhận'))).toBe(true);
    expect(isDisabled(buttonTag(html, 'Từ chối'))).toBe(true);
    expect(buttonTag(html, 'Đối soát')).not.toBeNull();
    expect(isDisabled(buttonTag(html, 'Đối soát'))).toBe(false);
    expect(html).toContain('data-testid="decision-block-reason"');
    expect(textareaDisabled(html)).toBe(true);
  });

  it('EXECUTING, canReconcile, working: cả ba nút khoá, không có reject-block-reason', () => {
    const html = render(fakeDetail('EXECUTING', { canReconcile: true }), true, '');
    expect(isDisabled(buttonTag(html, 'Chấp nhận'))).toBe(true);
    expect(isDisabled(buttonTag(html, 'Từ chối'))).toBe(true);
    expect(isDisabled(buttonTag(html, 'Đối soát'))).toBe(true);
    expect(html).not.toContain('data-testid="reject-block-reason"');
  });
});
