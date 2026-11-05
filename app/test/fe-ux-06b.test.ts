import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import AuditPage from '@/app/(ops)/audit/page';
import { AuditTable } from '@/components/audit/audit-table';
import { TokenInfoBlock } from '@/components/maker-checker/token-info-block';
import { TxnHistoryTable } from '@/components/mint/txn-history-table';
import { listAuditLog } from '@/lib/bank/audit.service';
import type { TxnView } from '@/lib/bank/mint.service';
import type { TokenInfoView } from '@/lib/bank/token-request.service';
import type { AuditRecord } from '@/lib/store/store.port';

/** Nhóm 5: trang `/audit` dựng thật; khung đọc cookie nên giả thành chỉ trả `children` (design mục 3). */
vi.mock('@/lib/bank/audit.service', () => ({ listAuditLog: vi.fn() }));
vi.mock('@/components/layout/app-layout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => children,
}));

/**
 * FE-UX-06b (design mục 3): `/mint`, `/audit`, hai bảng tách ra (QĐ-2). Ký tự cấm viết bằng escape; mã nguồn so sau khi
 * gộp khoảng trắng.
 */

const read = (file: string) => readFileSync(join(__dirname, '..', 'src', file), 'utf8');
const flat = (source: string) => source.replace(/\s+/g, ' ');
const count = (source: string, needle: string) => source.split(needle).length - 1;
const MINT = 'components/pages/mint.tsx';
const AUDIT_PAGE = 'app/(ops)/audit/page.tsx';
const TXN_TABLE = 'components/mint/txn-history-table.tsx';
const AUDIT_TABLE = 'components/audit/audit-table.tsx';
const ACCOUNT_PAGE = 'app/(account)/account/page.tsx';
const TOKEN_INFO = 'components/maker-checker/token-info-block.tsx';
/** Dòng mã (bỏ dòng chú thích), cùng quy tắc tasks 6e. */
const codeLines = (source: string) => source.split('\n').filter((line) => !/^\s*(\*|\/\/|\/\*|\{\/\*)/.test(line));
const NO_DESTRUCTIVE = ['-destructive', "'destructive'", '"destructive"'];

describe('FE-UX-06b nhóm 1: mã nguồn', () => {
  it(`${MINT}: số lời gọi action, effect giữ nguyên; tải lịch sử nguyên văn; gọi TxnHistoryTable`, () => {
    const source = flat(read(MINT));
    for (const needle of ['listTransactionsAction(', 'readBalanceAction(', 'onboardInvestorAction(', 'mintAction(']) {
      expect(count(source, needle), needle).toBe(1);
    }
    expect(count(source, 'useEffect(')).toBe(2);
    expect(source).toContain('listTransactionsAction({ chain: activeChain, limit: 20 })');
    expect(count(source, '<TxnHistoryTable txns={txns} />')).toBe(1);
  });

  it(`${MINT}: nhãn, nút, điều kiện khoá, role giữ nguyên văn; không -destructive, khung ô nhập tự viết, U+00B7, U+2014`, () => {
    const raw = read(MINT);
    const source = flat(raw);
    for (const needle of [
      "variant={status.frozen ? 'bad' : 'outline'}",
      "variant={status.whitelisted ? 'ok' : 'warn'}",
      '1. KYC + Whitelist',
      '2. Phát hành dữ liệu thử',
      'disabled={pending || !wallet || !mayWhitelist}',
      'disabled={pending || !wallet || !mayMint}',
      'role="status"',
    ]) {
      expect(source, needle).toContain(needle);
    }
    for (const needle of [...NO_DESTRUCTIVE, 'rounded-md border border-border bg-background']) {
      expect(source, needle).not.toContain(needle);
    }
    for (const line of codeLines(raw)) expect(line, line).not.toMatch(/[\u00b7\u2014]/);
  });

  it(`${AUDIT_PAGE}: Server Component, một lần đọc sổ, gọi AuditTable`, () => {
    const source = flat(read(AUDIT_PAGE));
    expect(count(source, 'listAuditLog(')).toBe(1);
    expect(source).not.toContain("'use client'");
    expect(source).not.toContain('"use client"');
    expect(source).not.toContain('Action(');
    expect(count(source, '<AuditTable entries={result.data} />')).toBe(1);
    for (const needle of NO_DESTRUCTIVE) expect(source, needle).not.toContain(needle);
    for (const line of codeLines(read(AUDIT_PAGE))) expect(line, line).not.toMatch(/\u2014/);
  });

  it(`${ACCOUNT_PAGE}: câu lỗi giữ role="alert", sắc bad-ink`, () => {
    const source = flat(read(ACCOUNT_PAGE));
    expect(count(source, 'role="alert" className="text-sm text-bad-ink"')).toBe(1);
    expect(source).not.toContain('text-destructive');
  });

  it(`${TOKEN_INFO}: không cắt chữ, một cột, xuống dòng giá trị dài`, () => {
    const source = read(TOKEN_INFO);
    expect(source).not.toContain('truncate');
    expect(source).not.toContain('sm:grid-cols-2');
    expect(source).toContain('[overflow-wrap:anywhere]');
  });

  it.each([MINT, AUDIT_PAGE, TXN_TABLE, AUDIT_TABLE, ACCOUNT_PAGE, TOKEN_INFO])('%s: mọi lớp col-span- có tiền tố mốc', (file) => {
    for (const span of read(file).match(/[\w:[\]-]*col-span-[\w-]+/g) ?? []) {
      expect(span, span).toMatch(/^min-\[\d+px\]:col-span-/);
    }
  });

  it.each([TXN_TABLE, AUDIT_TABLE])('%s: không action, hook; nhập từ lib/bank, lib/store chỉ là import type', (file) => {
    const source = read(file);
    for (const needle of ['Action(', 'useEffect(', 'useState(']) expect(source, needle).not.toContain(needle);
    const imports = source.match(/^import\s[^;]*;/gm) ?? [];
    for (const statement of imports.filter((line) => /['"]@\/lib\/(bank|store)\//.test(line))) {
      expect(statement, statement).toMatch(/^import type\s/);
    }
  });
});

const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
const heads = (html: string) => [...html.matchAll(/<th data-slot="table-head"[^>]*>(.*?)<\/th>/g)].map((m) => text(m[1]));
const rows = (html: string) => html.match(/<tbody[^>]*>(.*?)<\/tbody>/)![1].split('<tr').slice(1);
const cells = (row: string) => [...row.matchAll(/<td\b([^>]*)>(.*?)<\/td>/g)].map((m) => ({ attrs: m[1], html: m[2] }));

const WALLET = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const txn = (over: Partial<TxnView>): TxnView => ({
  id: 'txn-1',
  chain: 'mock',
  operation: 'MINT',
  txHash: '0xabc',
  status: 'CONFIRMED',
  fromWallet: null,
  toWallet: WALLET,
  amount: '1000',
  reason: null,
  actorRole: 'TELLER',
  createdAt: '2026-11-05T03:04:05.000Z',
  ...over,
});
const TXNS: TxnView[] = [
  txn({ id: 'a', status: 'CONFIRMED' }),
  txn({ id: 'b', status: 'FAILED' }),
  txn({ id: 'c', status: 'PENDING', toWallet: null, amount: null }),
];

describe('FE-UX-06b nhóm 2: TxnHistoryTable', () => {
  const html = renderToStaticMarkup(createElement(TxnHistoryTable, { txns: TXNS }));

  it('6 cột đúng thứ tự, một dòng mỗi giao dịch', () => {
    expect(heads(html)).toEqual(['Thời điểm', 'Nghiệp vụ', 'Ví nhận', 'Số lượng', 'Trạng thái', 'Vai trò']);
    expect(rows(html)).toHaveLength(3);
  });

  it('nhãn trạng thái là đúng mã; ví in 10 ký tự đầu, "…", 4 ký tự cuối; số lượng canh phải', () => {
    const [first, second, third] = rows(html).map(cells);
    expect([first, second, third].map((row) => text(row[4].html))).toEqual(['CONFIRMED', 'FAILED', 'PENDING']);
    expect(text(first[2].html)).toBe(`${WALLET.slice(0, 10)}…${WALLET.slice(-4)}`);
    expect(first[3].attrs).toMatch(/class="[^"]*\btext-right\b/);
    expect(text(first[3].html)).toBe('1000');
    expect(text(first[5].html)).toBe('TELLER');
  });

  it('nhãn CONFIRMED, FAILED, PENDING sắc ok, bad, warn; ví và số lượng rỗng là U+2013', () => {
    const [first, second, third] = rows(html).map(cells);
    expect(first[4].html).toMatch(/class="[^"]*\bbg-ok-bg\b/);
    expect(second[4].html).toMatch(/class="[^"]*\bbg-bad-bg\b/);
    expect(third[4].html).toMatch(/class="[^"]*\bbg-warn-bg\b/);
    expect(text(third[2].html)).toBe('\u2013');
    expect(text(third[3].html)).toBe('\u2013');
    expect(html).not.toMatch(/\u2014/);
  });
});

const audit = (over: Partial<AuditRecord>): AuditRecord => ({
  id: 'audit-1',
  actorRole: 'TELLER',
  action: 'token:mint',
  target: WALLET,
  outcome: 'ALLOWED',
  detail: 'Phát hành 1000 WPT',
  chain: 'mock',
  createdAt: '2026-11-05T03:04:05.000Z',
  ...over,
});
const ENTRIES: AuditRecord[] = [
  audit({ id: 'a', outcome: 'ALLOWED' }),
  audit({ id: 'b', outcome: 'SUCCESS' }),
  audit({ id: 'c', outcome: 'DENIED' }),
  audit({ id: 'd', outcome: 'FAILURE', target: null, detail: null }),
];

describe('FE-UX-06b nhóm 3: AuditTable', () => {
  const html = renderToStaticMarkup(createElement(AuditTable, { entries: ENTRIES }));

  it('6 cột đúng thứ tự, một dòng mỗi bản ghi', () => {
    expect(heads(html)).toEqual(['Thời điểm', 'Vai trò', 'Hành động', 'Đối tượng', 'Kết quả', 'Chi tiết']);
    expect(rows(html)).toHaveLength(4);
  });

  it('nhãn kết quả đúng mã; đối tượng in 10 ký tự đầu rồi "…"; chi tiết là chữ detail', () => {
    const all = rows(html).map(cells);
    expect(all.map((row) => text(row[4].html))).toEqual(['ALLOWED', 'SUCCESS', 'DENIED', 'FAILURE']);
    expect(text(all[0][3].html)).toBe(`${WALLET.slice(0, 10)}…`);
    expect(text(all[0][2].html)).toBe('token:mint');
    expect(text(all[0][5].html)).toBe('Phát hành 1000 WPT');
  });

  it('sắc ok, ok, bad, bad; đối tượng và chi tiết rỗng là U+2013; ô Chi tiết có title khi có detail', () => {
    const all = rows(html).map(cells);
    const tones = ['bg-ok-bg', 'bg-ok-bg', 'bg-bad-bg', 'bg-bad-bg'];
    all.forEach((row, i) => expect(row[4].html).toMatch(new RegExp(`class="[^"]*\\b${tones[i]}\\b`)));
    expect(text(all[3][3].html)).toBe('\u2013');
    expect(text(all[3][5].html)).toBe('\u2013');
    expect(html).not.toMatch(/\u2014/);
    expect(all[0][5].attrs).toContain('title="Phát hành 1000 WPT"');
    expect(all[3][5].attrs).not.toContain('title=');
  });
});

const CONTRACT = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const SPV = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
const INFO: TokenInfoView = {
  chain: 'mock',
  tokenSymbol: 'WPT',
  projectName: 'Điện gió Bạc Liêu',
  contractAddress: CONTRACT,
  cap: '1000000',
  remaining: '900000',
  totalSupply: '100000',
  undistributed: '40000',
  circulating: '60000',
  sellerCode: 'NB001',
  spvWallet: SPV,
  issuedAt: '2026-11-05T03:04:05.000Z',
};
const LABELS = [
  'Dự án',
  'Hợp đồng',
  'Trần phát hành',
  'Số còn được phát hành',
  'Tổng cung hiện tại',
  'Số chưa phân phối',
  'Số đang lưu hành',
  'Mã người bán',
  'Ví thanh toán',
  'Phát hành lần đầu',
];
const block = (props: { info: TokenInfoView | null; error?: string | null; loading?: boolean }) =>
  renderToStaticMarkup(createElement(TokenInfoBlock, props));

describe('FE-UX-06b nhóm 4: TokenInfoBlock', () => {
  it('10 cặp dt/dd liền kề đúng thứ tự; dd không truncate; ví 42 ký tự hiện đủ; aria-label', () => {
    const html = block({ info: INFO });
    expect(html).toContain('aria-label="Khối thông tin token"');
    const pairs = [...html.matchAll(/<dt[^>]*>(.*?)<\/dt><dd([^>]*)>(.*?)<\/dd>/g)];
    expect(pairs.map((m) => text(m[1]))).toEqual(LABELS);
    expect(html.match(/<dt\b/g)).toHaveLength(10);
    expect(html.match(/<dd\b/g)).toHaveLength(10);
    for (const m of pairs) expect(m[2]).not.toMatch(/\btruncate\b/);
    expect(text(pairs[8][3])).toBe(SPV);
    expect(text(pairs[8][3])).toHaveLength(42);
    expect(text(pairs[1][3])).toBe(CONTRACT);
  });

  it('ba trạng thái đang tải, lỗi, chưa nhập ra đúng câu hiện có', () => {
    expect(text(block({ info: null, loading: true }))).toContain('Đang đọc thông tin token');
    expect(text(block({ info: null, error: 'Không đọc được token' }))).toContain('Không đọc được token');
    expect(text(block({ info: null }))).toContain('Nhập mã hoặc ký hiệu token, hệ thống tự đổ thông tin.');
  });
});

const renderAudit = async (result: Awaited<ReturnType<typeof listAuditLog>>) => {
  const mocked = vi.mocked(listAuditLog);
  mocked.mockReset();
  mocked.mockResolvedValue(result);
  const html = renderToStaticMarkup(await AuditPage());
  expect(mocked).toHaveBeenCalledTimes(1);
  expect(mocked).toHaveBeenCalledWith(100);
  expect(html.match(/<h1\b/g)).toHaveLength(1);
  expect(text(html.match(/<h1[^>]*>(.*?)<\/h1>/)![1])).toBe('Sổ kiểm toán');
  return html;
};

describe('FE-UX-06b nhóm 5: trang /audit dựng thật', () => {
  it('lỗi: Alert sắc bad chứa câu lỗi, không role, không bảng', async () => {
    const html = await renderAudit({ ok: false, code: 'UNKNOWN', error: 'Lỗi đọc sổ thử' });
    const alert = html.match(/<div data-slot="alert"[^>]*>/)![0];
    expect(alert).toContain('data-tone="bad"');
    expect(alert).not.toContain('role=');
    expect(text(html)).toContain('Lỗi đọc sổ thử');
    expect(html).not.toContain('<table');
  });

  it('rỗng: EmptyState giữ câu cũ', async () => {
    const html = await renderAudit({ ok: true, data: [] });
    expect(text(html.match(/<div data-slot="empty-state".*?<\/div><\/div>/)![0])).toContain('Chưa có bản ghi.');
    expect(html).not.toContain('<table');
  });

  it('một bản ghi DENIED: có bảng, nhãn sắc bad', async () => {
    const html = await renderAudit({ ok: true, data: [audit({ outcome: 'DENIED' })] });
    expect(html).toContain('<table');
    expect(html).toMatch(/<span[^>]*class="[^"]*\bbg-bad-bg\b[^"]*"[^>]*>DENIED<\/span>/);
  });
});
