import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { STEP_STATE_LABELS } from '@/components/trading/gates';
import { orderStatusTone, settlementStepTone } from '@/components/trading/order-status-tone';
import { SettlementProgress } from '@/components/trading/settlement-progress';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { ORDER_STATUSES, type OrderStatus } from '@/lib/bank/purchase.state';
import type { SettlementStepView, SettlementView } from '@/lib/bank/settlement-steps';

/**
 * FE-UX-02a (design mục 4): ánh xạ sắc trạng thái lệnh, `Alert` và `EmptyState` không tự đặt `role`,
 * `SettlementProgress` giữ `data-step`, `data-state`, nhãn trạng thái bước và thêm `data-tone`.
 */

describe('FE-UX-02a orderStatusTone', () => {
  // Bảng QĐ-3. `Record<OrderStatus, ...>` nên thêm trạng thái mới mà quên dòng ở đây là lỗi typecheck.
  const EXPECTED: Record<OrderStatus, ReturnType<typeof orderStatusTone>> = {
    PLACED: 'warn',
    CHECKING: 'warn',
    EXECUTING: 'warn',
    COMPLETED: 'ok',
    REJECTED: 'bad',
    FAILED: 'bad',
    EXPIRED: 'info',
  };

  it('mọi giá trị ORDER_STATUSES có sắc đúng bảng', () => {
    expect(ORDER_STATUSES).toHaveLength(7);
    for (const status of ORDER_STATUSES) expect(orderStatusTone(status), status).toBe(EXPECTED[status]);
  });

  it('settlementStepTone đủ 4 trạng thái bước', () => {
    expect(settlementStepTone('done')).toBe('ok');
    expect(settlementStepTone('current')).toBe('warn');
    expect(settlementStepTone('failed')).toBe('bad');
    expect(settlementStepTone('pending')).toBe('muted');
  });
});

/** Thẻ mở đầu tiên của HTML, tức phần tử gốc của thành phần. */
const rootTag = (html: string) => html.slice(0, html.indexOf('>') + 1);

describe('FE-UX-02a Alert và EmptyState không tự đặt role', () => {
  const cases = [
    ...(['ok', 'warn', 'bad', 'info'] as const).map((tone) => ({
      name: `Alert ${tone}`,
      render: (props: Record<string, string>) => createElement(Alert, { tone, ...props }, 'Nội dung'),
    })),
    { name: 'EmptyState', render: (props: Record<string, string>) => createElement(EmptyState, props, 'Rỗng') },
    {
      name: 'EmptyState loading',
      render: (props: Record<string, string>) => createElement(EmptyState, { loading: true, ...props }, 'Đang tải…'),
    },
    {
      name: 'EmptyState bad',
      render: (props: Record<string, string>) => createElement(EmptyState, { tone: 'bad', ...props }, 'Lỗi'),
    },
  ];

  for (const { name, render } of cases) {
    it(`${name}: không truyền thì không có role; truyền thì chuyển tiếp lên gốc`, () => {
      const bare = renderToStaticMarkup(render({}));
      expect(bare).not.toMatch(/\srole=/);
      const root = rootTag(renderToStaticMarkup(render({ role: 'status', 'aria-label': 'Kết quả', 'data-x': '1' })));
      expect(root).toContain('role="status"');
      expect(root).toContain('aria-label="Kết quả"');
      expect(root).toContain('data-x="1"');
    });
  }
});

describe('FE-UX-02a SettlementProgress', () => {
  const steps: SettlementStepView[] = [
    { id: 'created', label: 'Tạo lệnh', state: 'done', at: '2026-11-01T01:00:00.000Z' },
    { id: 'checking', label: 'Kiểm tra', state: 'done', at: '2026-11-01T01:01:00.000Z' },
    { id: 'reconciling', label: 'Đối chiếu số dư', state: 'current', at: '2026-11-01T01:02:00.000Z' },
    { id: 'settling', label: 'Quyết toán', state: 'failed', at: '2026-11-01T01:03:00.000Z' },
    { id: 'completed', label: 'Hoàn tất', state: 'pending', at: null },
  ];
  const settlement: SettlementView = {
    atomic: true,
    entries: [
      { account: 'INVESTOR', asset: 'VNDB', direction: 'DEBIT', amount: '100' },
      { account: 'SELLER', asset: 'VNDB', direction: 'CREDIT', amount: '100' },
      { account: 'SELLER', asset: 'WPT', direction: 'DEBIT', amount: '1' },
      { account: 'INVESTOR', asset: 'WPT', direction: 'CREDIT', amount: '1' },
    ],
    outcome: 'APPLIED',
    rule: 'Quy tắc giả',
  };

  it('đủ 5 bước đúng thứ tự, giữ data-state, nhãn trạng thái và data-tone theo settlementStepTone', () => {
    const html = renderToStaticMarkup(createElement(SettlementProgress, { steps, settlement }));
    const items = [...html.matchAll(/<li data-step="([^"]+)" data-state="([^"]+)" data-tone="([^"]+)"[^>]*>(.*?)<\/li>/g)].filter(
      (match) => match[1] !== undefined,
    );
    expect(items.map((match) => match[1])).toEqual(steps.map((step) => step.id));
    items.forEach((match, index) => {
      const step = steps[index]!;
      expect(match[2]).toBe(step.state);
      expect(match[3]).toBe(settlementStepTone(step.state));
      expect(match[4]).toContain(step.label);
      expect(match[4]).toContain(STEP_STATE_LABELS[step.state]);
    });
    expect(items.map((match) => match[3])).toEqual(['ok', 'ok', 'warn', 'bad', 'muted']);
    // "Kết cục: …" nằm trọn một phần tử (QĐ-7).
    expect(html).toMatch(/<p[^>]*>Kết cục: cả bốn bút toán đã ghi\.<\/p>/);
  });
});
