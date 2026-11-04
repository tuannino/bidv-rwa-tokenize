import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RequestCheckBlock } from '@/components/maker-checker/request-check-block';
import { StatusBadge } from '@/components/maker-checker/status-badge';
import { caseTone, phaseTone, type CaseRowStatus } from '@/components/recall/case-tone';
import { RecallSteps } from '@/components/recall/steps';
import type { RecallPhaseKind } from '@/lib/bank/recall-phase';
import type { TokenRequestStatus } from '@/lib/store/token-request.store.port';

/**
 * FE-UX-02b (design mục 3): sắc hồ sơ thu hồi và giai đoạn đợt; khối kiểm tra giữ dấu cách giữa nhãn
 * và kết quả; nhãn trạng thái yêu cầu token có sắc; bước thu hồi có `data-state`, `data-tone`.
 */

describe('FE-UX-02b case-tone', () => {
  // Bảng design mục 2. `Record<..., ...>` nên thêm trạng thái mới mà quên dòng ở đây là lỗi typecheck.
  const CASES: Record<CaseRowStatus, ReturnType<typeof caseTone>> = {
    NOTIFIED: 'warn',
    CONFIRMED: 'info',
    PAID: 'info',
    BURNING: 'info',
    BURNED: 'ok',
    FAILED: 'bad',
    PREVIEW: 'info',
  };
  const PHASES: Record<RecallPhaseKind, ReturnType<typeof phaseTone>> = {
    NONE: 'info',
    SCHEDULED: 'info',
    NOTICE: 'info',
    FROZEN: 'info',
    CLOSED: 'info',
  };

  it('mọi trạng thái hồ sơ (kể cả dòng Dự kiến) có sắc đúng bảng', () => {
    for (const [status, tone] of Object.entries(CASES)) expect(caseTone(status), status).toBe(tone);
  });

  it('giá trị lạ từ máy chủ là info', () => {
    expect(caseTone('KHONG_CO')).toBe('info');
  });

  it('mọi giai đoạn đợt là info', () => {
    for (const [phase, tone] of Object.entries(PHASES)) expect(phaseTone(phase as RecallPhaseKind), phase).toBe(tone);
  });
});

/** Chữ hiển thị: bỏ thẻ HTML, gộp khoảng trắng như trình duyệt. */
const visibleText = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

describe('FE-UX-02b khối kiểm tra và nhãn trạng thái yêu cầu token', () => {
  it('điều kiện cap không đạt: giữ data-check, data-passed và đúng một dấu cách giữa nhãn và kết quả', () => {
    const html = renderToStaticMarkup(
      createElement(RequestCheckBlock, {
        preview: {
          kind: 'checked',
          allPassed: false,
          checks: [
            { key: 'kyc', label: 'Ví đã định danh', passed: true, detail: 'đã whitelist' },
            { key: 'cap', label: 'Không vượt trần còn lại', passed: false, detail: 'còn 5 WPT' },
          ],
        },
      }),
    );
    expect(html).toMatch(/<li[^>]*data-check="cap"[^>]*data-passed="false"/);
    const cap = html.match(/<li[^>]*data-check="cap"[^>]*>(.*?)<\/li>/)![1]!;
    expect(visibleText(cap)).toContain('Không vượt trần còn lại Không đạt');
    expect(visibleText(cap)).not.toContain('Không vượt trần còn lạiKhông đạt');
    expect(visibleText(cap)).not.toContain('Không vượt trần còn lại  Không đạt');
  });

  const VARIANTS: Record<TokenRequestStatus, string> = {
    PENDING: 'warn',
    EXECUTING: 'info',
    COMPLETED: 'ok',
    REJECTED: 'bad',
    FAILED: 'bad',
  };

  for (const [status, variant] of Object.entries(VARIANTS)) {
    it(`StatusBadge ${status}: data-status và data-variant ${variant}`, () => {
      const html = renderToStaticMarkup(createElement(StatusBadge, { status: status as TokenRequestStatus }));
      expect(html).toContain(`data-status="${status}"`);
      expect(html).toContain(`data-variant="${variant}"`);
    });
  }
});

describe('FE-UX-02b RecallSteps', () => {
  const items = (html: string) =>
    [...html.matchAll(/<li([^>]*)>/g)].map((match) => {
      const attrs = match[1]!;
      const attr = (name: string) => attrs.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
      return { state: attr('data-state'), tone: attr('data-tone'), current: attr('aria-current') };
    });

  for (const current of [1, 2, 3, 4] as const) {
    it(`current = ${current}: bước trước done ok, bước hiện tại current warn aria-current, bước sau pending muted`, () => {
      const list = items(renderToStaticMarkup(createElement(RecallSteps, { current })));
      expect(list).toHaveLength(4);
      list.forEach((item, index) => {
        const step = index + 1;
        if (step < current) expect(item).toEqual({ state: 'done', tone: 'ok', current: null });
        else if (step === current) expect(item).toEqual({ state: 'current', tone: 'warn', current: 'step' });
        else expect(item).toEqual({ state: 'pending', tone: 'muted', current: null });
      });
    });
  }

  it('current rỗng thì không có li', () => {
    expect(renderToStaticMarkup(createElement(RecallSteps, { current: null }))).not.toContain('<li');
  });
});
