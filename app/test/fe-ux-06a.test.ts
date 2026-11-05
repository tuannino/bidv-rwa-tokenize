import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FilterBtn } from '@/components/ops/filter-button';

/**
 * FE-UX-06a (design mục 3): mã nguồn ba màn dữ liệu mẫu và `FilterBtn` dùng chung (QĐ-2, QĐ-4).
 *
 * `TxLink` của `/assets` gọi `useSelectedChain`, hàm này đọc `usePublicConfig` và ném lỗi khi thiếu `ConfigProvider`:
 * giả `useSelectedChain` trả chain `mock` (không có explorer nên `TxLink` ra `span`). `HoverHint`, `DropdownMenu` dựng
 * được bằng `renderToStaticMarkup`, không cần giả.
 */
vi.mock('@/lib/chains/use-selected-chain', () => ({ useSelectedChain: () => ({ chain: 'mock' }) }));

const read = (file: string) => readFileSync(join(__dirname, '..', 'src/components', file), 'utf8');
const count = (source: string, needle: string | RegExp) =>
  typeof needle === 'string' ? source.split(needle).length - 1 : (source.match(new RegExp(needle, 'g')) ?? []).length;
const PAGES = ['pages/assets.tsx', 'pages/kyc.tsx', 'pages/reconciliation.tsx'];
const FILTER = 'ops/filter-button.tsx';

describe('FE-UX-06a nhóm 1: mã nguồn', () => {
  it.each(PAGES)('%s: một dòng nhập FilterBtn từ components/ops, không còn bản cục bộ, không action, effect', (file) => {
    const source = read(file);
    expect(count(source, /import \{ FilterBtn \} from ["']@\/components\/ops\/filter-button["']/)).toBe(1);
    for (const needle of ['function FilterBtn', 'Action(', 'useEffect(']) expect(source).not.toContain(needle);
  });

  it(`${FILTER}: export function FilterBtn, aria-pressed={active}`, () => {
    const source = read(FILTER);
    expect(count(source, 'export function FilterBtn')).toBe(1);
    expect(count(source, 'aria-pressed={active}')).toBe(1);
  });
});

const button = (active: boolean) =>
  renderToStaticMarkup(createElement(FilterBtn, { active, onClick: () => {}, label: 'Trên bờ, Ven biển' }));

describe('FE-UX-06a nhóm 2: FilterBtn', () => {
  it('active true: type="button", aria-pressed="true", chữ đúng label', () => {
    const html = button(true);
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-pressed="true"');
    expect(html.replace(/<[^>]+>/g, '')).toBe('Trên bờ, Ven biển');
  });

  it('active false: aria-pressed="false"', () => {
    expect(button(false)).toContain('aria-pressed="false"');
  });
});
