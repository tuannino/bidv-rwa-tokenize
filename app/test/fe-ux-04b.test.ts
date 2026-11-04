import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TokenInfoCard } from '@/components/trading/trade-panels';
import { TradeCheckBlock } from '@/components/trading/trade-check-block';
import type { TradePreviewState } from '@/components/trading/gates';
import type { InvestorTokenInfo } from '@/lib/bank/trade.service';

/**
 * FE-UX-04b (design mục 3): số lời gọi action và effect của `/trade` (QĐ-2), biểu thức khoá ô và nút (QĐ-1), và
 * phần trình bày tách ra (QĐ-5) dựng bằng dữ liệu giả. Các trạng thái này không dựng được trên mock.
 */

const read = (file: string) => readFileSync(join(__dirname, '..', 'src/components', file), 'utf8');
const count = (source: string, needle: string) => source.split(needle).length - 1;
const text = (html: string) => html.replace(/<[^>]+>/g, '');
const WALLET = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

describe('FE-UX-04b nhóm 1: số lời gọi action, effect và biểu thức khoá (bằng mốc)', () => {
  const page = read('pages/investor-trade.tsx');

  it.each([
    ['getTradeContextAction(', 1],
    ['previewTradeAction(', 1],
    ['listOrdersAction(', 1],
    ['placeOrderAction(', 1],
    ['preparePermitAction(', 1],
    ['useEffect(', 3],
  ] as const)('investor-trade.tsx: %s đúng %i', (needle, expected) => {
    expect(count(page, needle)).toBe(expected);
  });

  it.each(['trading/trade-panels.tsx', 'trading/trade-check-block.tsx'])('%s: không Action(, useEffect(, useState(', (file) => {
    const source = read(file);
    expect(source).not.toContain('Action(');
    expect(source).not.toContain('useEffect(');
    expect(source).not.toContain('useState(');
  });

  it('biểu thức khoá ô Số lượng, nút xác nhận, nút gửi giữ nguyên văn', () => {
    const flat = page.replace(/\s+/g, ' ');
    expect(flat).toContain('disabled={tradeBlocked || !ctx.walletBound}');
    expect(flat).toContain('disabled={blockReason !== null}');
    expect(flat).toContain("disabled={submitting || blockReason !== null || walletBlocked || signPhase === 'preparing'}");
  });
});

const conditions = (failKey?: string) =>
  (['account', 'identity', 'wallet', 'token', 'risk'] as const).map((key) => ({
    key,
    label: `Điều kiện ${key}`,
    passed: key !== failKey,
    detail: key === failKey ? `chi tiết ${key} chưa đạt` : `chi tiết ${key}`,
    howToFix: key === failKey ? `cách sửa ${key}` : null,
  }));

const check = (preview: TradePreviewState) => renderToStaticMarkup(createElement(TradeCheckBlock, { preview, wallet: WALLET }));

describe('FE-UX-04b nhóm 2: TradeCheckBlock', () => {
  it('idle và loading', () => {
    expect(text(check({ kind: 'idle' }))).toContain('Nhập số lượng hợp lệ, hệ thống kiểm tra năm điều kiện.');
    expect(text(check({ kind: 'loading' }))).toContain('Đang kiểm tra điều kiện…');
  });

  it('error: có câu lỗi, không role="alert"; notBound thì có data-wallet-not-bound', () => {
    const html = check({ kind: 'error', message: 'Lỗi xem trước giả.' });
    expect(text(html)).toContain('Lỗi xem trước giả.');
    expect(html).not.toContain('role="alert"');
    expect(check({ kind: 'error', message: 'x', notBound: true })).toContain('data-wallet-not-bound');
  });

  it('checked 5 điều kiện, 1 không đạt: đúng thứ tự, data-passed, aria-label, chữ và howToFix', () => {
    const html = check({ kind: 'checked', side: 'BUY', wptAmount: '1', vndAmount: '100000', conditions: conditions('wallet'), canConfirm: false });
    const items = [...html.matchAll(/<li[^>]*data-check="([^"]+)"[^>]*data-passed="([^"]+)"/g)].map((match) => [match[1], match[2]]);
    expect(items).toEqual([
      ['account', 'true'],
      ['identity', 'true'],
      ['wallet', 'false'],
      ['token', 'true'],
      ['risk', 'true'],
    ]);
    expect(count(html, 'aria-label="đạt"')).toBe(4);
    expect(count(html, 'aria-label="không đạt"')).toBe(1);
    const content = text(html);
    expect(content).toContain('Không đạt: chi tiết wallet chưa đạt');
    expect(content).toContain('cách sửa wallet');
  });
});

function fakeToken(overrides: Partial<InvestorTokenInfo> = {}): InvestorTokenInfo {
  return {
    tokenSymbol: 'WPT',
    projectName: 'Dự án điện gió An Viên',
    cap: '10000000',
    issuePriceVnd: '100000',
    tokenStatus: 'ISSUED',
    tradingOpen: true,
    undistributed: '9000',
    terms: { remainingLifetimeYears: 15, annualYieldPercent: 5.8, tradingFeePercent: 0 },
    ...overrides,
  };
}

const tokenCard = (token: InvestorTokenInfo | null) =>
  renderToStaticMarkup(createElement(TokenInfoCard, { token, tradeBlock: null }));

describe('FE-UX-04b nhóm 5: TokenInfoCard', () => {
  it('chưa có dự án', () => {
    expect(text(tokenCard(null))).toContain('Chuỗi này chưa có dự án nào được token hoá.');
  });

  it('có token, đang mở giao dịch: 9 nhãn dt đúng thứ tự, aria-label', () => {
    const html = tokenCard(fakeToken());
    expect(html).toContain('aria-label="Thông tin token"');
    const labels = [...html.matchAll(/<dt[^>]*>(.*?)<\/dt>/g)].map((match) => text(match[1]));
    expect(labels).toEqual([
      'Dự án',
      'Trần phát hành',
      'Giá phát hành',
      'Trạng thái token',
      'Trạng thái giao dịch',
      'Số chưa phân phối',
      'Tuổi thọ còn lại',
      'Lợi tức mục tiêu',
      'Phí giao dịch',
    ]);
  });
});
