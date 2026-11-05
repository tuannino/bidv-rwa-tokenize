import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AuditTable } from '@/components/audit/audit-table';
import { TxnHistoryTable } from '@/components/mint/txn-history-table';
import type { TxnView } from '@/lib/bank/mint.service';
import type { AuditRecord } from '@/lib/store/store.port';

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

  it(`${AUDIT_PAGE}: Server Component, một lần đọc sổ, gọi AuditTable`, () => {
    const source = flat(read(AUDIT_PAGE));
    expect(count(source, 'listAuditLog(')).toBe(1);
    expect(source).not.toContain("'use client'");
    expect(source).not.toContain('"use client"');
    expect(source).not.toContain('Action(');
    expect(count(source, '<AuditTable entries={result.data} />')).toBe(1);
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
});
