import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FilterBtn } from '@/components/ops/filter-button';
import { AssetsPage } from '@/components/pages/assets';
import { KycPage } from '@/components/pages/kyc';
import { ReconciliationPage } from '@/components/pages/reconciliation';
import { MOCK_PROJECTS, MOCK_WIND_STATS } from '@/lib/mock-data';

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

  it.each(PAGES)('%s: không StatCard, KpiCard, GRID, khung tự viết, -destructive', (file) => {
    const source = read(file);
    for (const needle of ['function StatCard', 'function KpiCard', 'const GRID', 'rounded-lg border', '-destructive', "'destructive'"]) {
      expect(source, needle).not.toContain(needle);
    }
  });

  it.each(PAGES)('%s: mọi lớp col-span- có tiền tố mốc', (file) => {
    for (const span of read(file).match(/[\w:[\]-]*col-span-[\w-]+/g) ?? []) {
      expect(span, span).toMatch(/^min-\[\d+px\]:col-span-/);
    }
  });

  it('reconciliation.tsx: sắc ô Kỳ lệch giữ đúng điều kiện cũ', () => {
    expect(read('pages/reconciliation.tsx')).toMatch(
      /MOCK_WIND_STATS\.pendingReconciliations > 0 \? (["'])gold\1 : (["'])default\2/,
    );
  });

  it('assets.tsx: ba câu REGION_HINTS mới; không U+00B7, U+2014 ngoài dòng chú thích', () => {
    const source = read('pages/assets.tsx');
    for (const text of [
      'Gia Lai, Quảng Trị, Đắk Lắk: gió mùa ổn định',
      'Ninh Thuận, Bình Thuận: hệ số công suất cao',
      'Bạc Liêu, Trà Vinh: móng trụ trong bãi bồi',
    ]) {
      expect(source).toContain(text);
    }
    const code = source.split('\n').filter((line) => !/^\s*(\*|\/\/|\/\*|\{\/\*)/.test(line));
    for (const line of code) expect(line, line).not.toMatch(/[\u00b7\u2014]/);
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
    expect(html).toMatch(/class="[^"]*\bbg-primary\b/);
    expect(html.replace(/<[^>]+>/g, '')).toBe('Trên bờ, Ven biển');
  });

  it('active false: aria-pressed="false"', () => {
    const html = button(false);
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toMatch(/\bbg-primary\b/);
  });
});

const render = (page: () => React.ReactElement) => renderToStaticMarkup(createElement(page));
const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
const kpis = (html: string) =>
  [...html.matchAll(/<div data-kpi="" data-tone="([^"]+)"[^>]*>(.*?)<\/p>/g)].map((match) => ({
    tone: match[1],
    label: text(match[2]),
  }));
const heads = (html: string) => [...html.matchAll(/<th data-slot="table-head"[^>]*>(.*?)<\/th>/g)].map((m) => text(m[1]));
/** Thẻ mở của phần tử có chữ (con trực tiếp) hoặc thuộc tính khớp. */
const openTag = (html: string, pattern: RegExp) => html.match(pattern)?.[0] ?? '';
const POC = 'Chưa hỗ trợ trong PoC';

describe('FE-UX-06a nhóm 3: ba trang', () => {
  it('AssetsPage: 4 ô số liệu, 8 cột, đủ dòng, CF dấu phẩy, hai nút khoá trỏ chú thích, ghi chú ngoài h1', () => {
    const html = render(AssetsPage);
    expect(kpis(html)).toEqual([
      { tone: 'default', label: 'Dự án điện gió' },
      { tone: 'default', label: 'Tổng công suất đặt' },
      { tone: 'hl', label: 'WPT đã phát hành' },
      { tone: 'leaf', label: 'Sản lượng luỹ kế' },
    ]);
    expect(heads(html)).toEqual([
      'Mã & Tên dự án',
      'Vùng',
      'Công suất',
      'WPT phát hành',
      'Sản lượng luỹ kế',
      'Trạng thái',
      'Vận hành từ',
      'TX Hash',
    ]);
    const body = html.match(/<tbody[^>]*>(.*?)<\/tbody>/)![1];
    const rows = body.match(/<tr\b/g) ?? [];
    expect(rows).toHaveLength(MOCK_PROJECTS.length);
    for (const row of body.split('<tr').slice(1)) {
      expect(text(row)).toContain('CF ');
      expect(text(row)).toContain('%, ');
      expect(row).not.toMatch(/\u00b7/);
    }
    const refresh = openTag(html, /<button[^>]*aria-label="Làm mới"[^>]*>/);
    const add = openTag(html, /<button[^>]*>(?=(?:(?!<\/button>).)*Thêm dự án)/);
    for (const tag of [refresh, add]) {
      expect(tag).toMatch(/\sdisabled(=""|\s|>)/);
      expect(tag).toContain('aria-describedby="assets-poc-note"');
    }
    expect(html).toMatch(new RegExp(`<span id="assets-poc-note"[^>]*>${POC}</span>`));
    expect(text(html).split(POC)).toHaveLength(2);
    expect(html).toContain('(đang hiển thị dữ liệu mẫu)');
    expect(html.match(/<h1[^>]*>(.*?)<\/h1>/)![1]).not.toContain('đang hiển thị dữ liệu mẫu');
  });

  it('KycPage: 4 ô số liệu 0, 8 cột, ô rỗng, /mint là font-code đầu tiên, phân trang khoá, nút Làm mới khoá', () => {
    const html = render(KycPage);
    expect(kpis(html)).toEqual([
      { tone: 'hl', label: 'Tổng nhà đầu tư' },
      { tone: 'default', label: 'Đã whitelist' },
      { tone: 'gold', label: 'Chờ duyệt KYC' },
      { tone: 'default', label: 'Đang đóng băng' },
    ]);
    for (const value of html.match(/<span class="tabular-nums">([^<]*)<\/span>/g) ?? []) expect(text(value)).toBe('0');
    expect(heads(html)).toEqual([
      'Nhà đầu tư',
      'CCCD',
      'Cấp KYC',
      'Khẩu vị RR',
      'Địa chỉ ví',
      'WPT nắm giữ',
      'Trạng thái',
      'Đăng ký',
    ]);
    const empty = html.match(/<div data-slot="empty-state".*?<\/div><\/div>/)![0];
    expect(text(empty)).toContain('Chưa có nhà đầu tư nào trong danh sách.');
    expect(text(empty)).toContain('Bảng này đọc từ DB nhà đầu tư, nối ở Phase 4.');
    expect(html.match(/class="[^"]*\bfont-code\b[^"]*"[^>]*>([^<]*)</)![1]).toBe('/mint');
    for (const label of ['Trang trước', 'Trang sau']) {
      expect(openTag(html, new RegExp(`<button[^>]*>(?=${label}<)`))).toMatch(/\sdisabled(=""|\s|>)/);
    }
    const refresh = openTag(html, /<button[^>]*aria-label="Làm mới"[^>]*>/);
    expect(refresh).toMatch(/\sdisabled(=""|\s|>)/);
    expect(refresh).toContain('aria-describedby="kyc-poc-note"');
    expect(html).toMatch(new RegExp(`<span id="kyc-poc-note"[^>]*>${POC}</span>`));
    expect(text(html).split(POC)).toHaveLength(2);
  });

  it('ReconciliationPage: 3 thẻ nguồn, 3 ô số liệu, MWh tách khỏi số, 7 cột, ô rỗng, nút khoá', () => {
    const html = render(ReconciliationPage);
    for (const label of ['SCADA nhà máy', 'Hoá đơn EVN', 'On-chain']) expect(text(html)).toContain(label);
    expect(text(html).split('Chờ nối ở Phase 3')).toHaveLength(4);
    expect(kpis(html)).toEqual([
      { tone: 'hl', label: 'Kỳ đã đối soát khớp' },
      { tone: 'default', label: 'Sản lượng đã đối soát' },
      { tone: MOCK_WIND_STATS.pendingReconciliations > 0 ? 'gold' : 'default', label: 'Kỳ lệch chờ xử lý' },
    ]);
    const output = html.match(/Sản lượng đã đối soát<\/p>.*?<\/small>/)![0];
    expect(output).toMatch(/<span class="tabular-nums">[^<]*<\/span><small[^>]*>MWh<\/small>/);
    expect(heads(html)).toEqual(['Kỳ', 'Dự án', 'SCADA (MWh)', 'EVN (MWh)', 'On-chain (MWh)', 'Lệch', 'Kết quả']);
    expect(text(html.match(/<div data-slot="empty-state".*?<\/div><\/div>/)![0])).toContain('Chưa có kỳ nào để đối soát.');
    const refresh = openTag(html, /<button[^>]*>(?=(?:(?!<\/button>).)*Làm mới dữ liệu)/);
    expect(refresh).toMatch(/\sdisabled(=""|\s|>)/);
    expect(refresh).toContain('aria-describedby="reconciliation-poc-note"');
    expect(html).toMatch(new RegExp(`<span id="reconciliation-poc-note"[^>]*>${POC}</span>`));
    expect(text(html).split(POC)).toHaveLength(2);
  });
});
