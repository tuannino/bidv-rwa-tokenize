import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CHAIN_KEYS, CHAINS, explorerTxUrl } from '@bidv/shared';
import { AssetHoldings } from '@/components/investor/asset-holdings';
import { TransactionTable } from '@/components/investor/transaction-table';
import { WalletNotBoundNotice } from '@/components/investor/wallet-not-bound-notice';
import { recallNoticeText } from '@/components/recall/gates';
import type { TxnView } from '@/lib/bank/mint.service';
import type { PortfolioView } from '@/lib/bank/portfolio.service';

/**
 * FE-UX-04a (design mục 4): số lời gọi action và effect của hai màn (QĐ-2), và phần trình bày tách ra (QĐ-5) dựng
 * bằng dữ liệu giả. Trên mock, Tổng quan đòi ví trình duyệt nên không dựng được nhánh có số liệu; kiểm ở đây.
 */

const read = (file: string) => readFileSync(join(__dirname, '..', 'src/components', file), 'utf8');
const count = (source: string, needle: string) => source.split(needle).length - 1;
const text = (html: string) => html.replace(/<[^>]+>/g, '');

describe('FE-UX-04a nhóm 1: số lời gọi action và effect (bằng mốc)', () => {
  it.each([
    ['investor/asset-summary.tsx', 'getPortfolioAction('],
    ['investor/transaction-history-box.tsx', 'getWalletTransactionsAction('],
    ['pages/investor-token-detail.tsx', 'getPortfolioAction('],
  ])('%s: đúng 1 %s và 1 useEffect(', (file, action) => {
    const source = read(file);
    expect(count(source, action)).toBe(1);
    expect(count(source, 'useEffect(')).toBe(1);
  });

  it.each(['investor/asset-holdings.tsx', 'investor/transaction-table.tsx'])('%s: không Action(, useEffect(, useState(', (file) => {
    const source = read(file);
    expect(source).not.toContain('Action(');
    expect(source).not.toContain('useEffect(');
    expect(source).not.toContain('useState(');
  });

  it('investor-portfolio.tsx vẫn là Server Component', () => {
    expect(read('pages/investor-portfolio.tsx')).not.toContain("'use client'");
  });
});

function fakePortfolio(overrides: Partial<PortfolioView> = {}): PortfolioView {
  return {
    wallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    chain: 'mock',
    balance: '150',
    valueVnd: '15000000',
    issuePriceVnd: '100000',
    whitelisted: true,
    frozen: false,
    token: { name: 'Wind Power Token', symbol: 'WPT', decimals: 0, totalSupply: '10000' },
    recall: null,
    paymentBalance: '2500000',
    ...overrides,
  };
}

const holdings = (data: PortfolioView) => renderToStaticMarkup(createElement(AssetHoldings, { data }));

describe('FE-UX-04a nhóm 2: AssetHoldings', () => {
  it('bình thường: số giữ, giá trị, quy đổi, đã KYC, số dư VNDB đúng thứ tự; không đóng băng, không role="status"', () => {
    const html = holdings(fakePortfolio());
    const content = text(html);
    for (const part of ['WPT đang giữ', '150', '15.000.000 ₫', 'Quy đổi theo giá phát hành 100.000 ₫/WPT', 'đã KYC', '2.500.000 VNDB']) {
      expect(content, part).toContain(part);
    }
    expect(content).not.toContain('đang đóng băng');
    expect(html).not.toContain('role="status"');
    const order = ['đang giữ', 'Giá trị theo giá phát hành', 'đã KYC', 'Số dư VNDB'].map((part) => content.indexOf(part));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('chưa KYC và đang đóng băng', () => {
    const content = text(holdings(fakePortfolio({ whitelisted: false, frozen: true })));
    expect(content).toContain('chưa KYC');
    expect(content).toContain('đang đóng băng');
  });

  it('không đọc được số dư VNDB', () => {
    expect(text(holdings(fakePortfolio({ paymentBalance: null })))).toContain('Chưa đọc được số dư VNDB');
  });

  it.each(['NOTICE', 'FROZEN', 'CLOSED'] as const)('thu hồi pha %s: đúng một role="status" chứa title, body, đứng trước "đang giữ"', (phase) => {
    const recall = { maturityDate: '2026-12-31', recallFrom: '2027-01-15', daysLeft: 12, phase, amount: '150' };
    const html = holdings(fakePortfolio({ recall }));
    expect(count(html, 'role="status"')).toBe(1);
    const notice = recallNoticeText(recall);
    const content = text(html);
    expect(content).toContain(notice.title);
    expect(content).toContain(notice.body);
    expect(content.indexOf(notice.body)).toBeLessThan(content.indexOf('đang giữ'));
  });
});

function fakeTxn(overrides: Partial<TxnView> = {}): TxnView {
  return {
    id: 'txn-1',
    chain: 'mock',
    operation: 'MINT',
    txHash: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    status: 'CONFIRMED',
    fromWallet: null,
    toWallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    amount: '150',
    reason: null,
    actorRole: 'OPERATOR',
    createdAt: '2026-11-01T08:00:00.000Z',
    ...overrides,
  };
}

const table = (rows: TxnView[]) => renderToStaticMarkup(createElement(TransactionTable, { rows }));
const HASH = '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

describe('FE-UX-04a nhóm 3: TransactionTable', () => {
  it('chain mock, 3 dòng CONFIRMED, PENDING, FAILED: cột đúng thứ tự, chữ trạng thái giữ mã, "–", không liên kết', () => {
    const html = table([
      fakeTxn({ id: 'a', status: 'CONFIRMED' }),
      fakeTxn({ id: 'b', status: 'PENDING', amount: null }),
      fakeTxn({ id: 'c', status: 'FAILED' }),
    ]);
    const heads = [...html.matchAll(/<th[^>]*>(.*?)<\/th>/g)].map((match) => text(match[1]));
    expect(heads).toEqual(['Thời điểm', 'Nghiệp vụ', 'Số lượng', 'Trạng thái', 'Tra cứu']);
    const content = text(html);
    for (const status of ['CONFIRMED', 'PENDING', 'FAILED']) expect(content).toContain(status);
    expect(content).toContain('–');
    expect(html).not.toContain('<a');
    const titles = [...html.matchAll(/title="([^"]*)"/g)].map((match) => match[1]);
    expect(titles).toHaveLength(3);
    for (const title of titles) {
      expect(title.endsWith('không có trình khám phá')).toBe(true);
      expect(title).not.toContain('\u2014');
    }
    expect(content).not.toContain('\u2014');
  });

  it.each([
    ['CONFIRMED', 'bg-ok-bg'],
    ['FAILED', 'bg-bad-bg'],
    ['PENDING', 'bg-info-bg'],
  ] as const)('trạng thái %s dùng nhãn %s', (status, tone) => {
    expect(table([fakeTxn({ status })])).toContain(tone);
  });

  it('chain có trình khám phá: một liên kết mở tab mới, href bằng explorerTxUrl', () => {
    const chain = CHAIN_KEYS.find((key) => CHAINS[key].explorerBaseUrl)!;
    const html = table([fakeTxn({ chain, txHash: HASH })]);
    expect(count(html, '<a ')).toBe(1);
    expect(html).toContain(`href="${explorerTxUrl(chain, HASH)}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});

describe('FE-UX-04a nhóm 4: WalletNotBoundNotice', () => {
  it('giữ role="alert", data-wallet-not-bound, chữ; ví rút gọn trong phần tử font-code', () => {
    const wallet = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    expect(wallet).toHaveLength(42);
    const html = renderToStaticMarkup(createElement(WalletNotBoundNotice, { wallet }));
    expect(count(html, 'role="alert"')).toBe(1);
    expect(html).toContain('data-wallet-not-bound');
    expect(text(html)).toContain('Ví chưa được định danh');
    expect(html).toMatch(/<span class="font-code">0x7099…79C8<\/span>/);
  });
});
