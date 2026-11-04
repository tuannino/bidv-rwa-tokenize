import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConnectWalletPrompt, OrderSummary, PermitNotice, TokenInfoCard, TrackedOrder } from '@/components/trading/trade-panels';
import { TradeCheckBlock } from '@/components/trading/trade-check-block';
import type { TradePreviewState } from '@/components/trading/gates';
import type { InvestorTokenInfo } from '@/lib/bank/trade.service';
import type { OrderView, PermitPreparationView } from '@/lib/bank/purchase.service';
import type { UseWalletStatusResult } from '@/lib/hooks/use-wallet-status';
import { formatAmount } from '@/lib/format';

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

  it('investor-trade.tsx không còn const FIELD, amber-', () => {
    expect(page).not.toContain('const FIELD');
    expect(page).not.toContain('amber-');
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

function fakeOrder(overrides: Partial<OrderView> = {}): OrderView {
  return {
    id: '11111111-2222-3333-4444-555555555555',
    chain: 'mock',
    investorWallet: WALLET,
    side: 'BUY',
    wptAmount: '1',
    vndAmount: '100000',
    status: 'COMPLETED',
    txHash: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    reason: null,
    createdAt: '2026-11-04T10:00:00.000Z',
    updatedAt: '2026-11-04T10:00:05.000Z',
    steps: [],
    settlement: { atomic: true, entries: [], outcome: 'APPLIED', rule: 'Quy tắc giả.' },
    ...overrides,
  };
}

const tracked = (order: OrderView) => renderToStaticMarkup(createElement(TrackedOrder, { order, chain: order.chain }));

describe('FE-UX-04b nhóm 3: TrackedOrder', () => {
  it('REJECTED, NONE_APPLIED, có reason, mock: tiêu đề, liên kết, mã mô phỏng, reason; không câu đang quyết toán', () => {
    const html = tracked(
      fakeOrder({
        status: 'REJECTED',
        reason: 'Lý do từ chối giả.',
        settlement: { atomic: true, entries: [], outcome: 'NONE_APPLIED', rule: 'Quy tắc giả.' },
      }),
    );
    const content = text(html);
    expect(html).toContain('aria-label="Lệnh vừa gửi"');
    expect(content).toContain('Bị từ chối');
    expect(html).toContain('href="/orders/11111111-2222-3333-4444-555555555555"');
    expect(content).toContain('Mã giao dịch mô phỏng');
    expect(content).toContain('Lý do từ chối giả.');
    expect(content).not.toContain('Hệ thống đang tự quyết toán');
  });

  it('EXECUTING, PENDING, không reason: có câu đang quyết toán, không có data-slot="alert"', () => {
    const html = tracked(
      fakeOrder({ status: 'EXECUTING', settlement: { atomic: true, entries: [], outcome: 'PENDING', rule: 'Quy tắc giả.' } }),
    );
    expect(text(html)).toContain('Hệ thống đang tự quyết toán');
    expect(html).not.toContain('data-slot="alert"');
  });
});

function fakeWalletStatus(canSign: boolean): UseWalletStatusResult {
  return {
    status: { kind: 'ready', address: WALLET, chainKey: 'hardhat-local' },
    canSign,
    blockedReason: canSign ? null : 'Lý do không ký được giả.',
    switchToExpected: async () => {},
    switching: false,
    switchError: null,
    disconnect: () => {},
  };
}

const PREPARED = {
  chain: 'hardhat-local',
  side: 'BUY',
  wptAmount: '2',
  vndAmount: '200000',
  tokenSymbol: 'VNDB',
  value: '200000',
  nonce: '0',
  deadline: '1793800000',
  deadlineAt: '2026-11-04T12:00:00.000Z',
  typedData: {},
} as unknown as PermitPreparationView;

const permit = (prepared: PermitPreparationView | null, preparing: boolean, canSign: boolean) =>
  renderToStaticMarkup(createElement(PermitNotice, { prepared, preparing, walletStatus: fakeWalletStatus(canSign) }));

describe('FE-UX-04b nhóm 4: PermitNotice', () => {
  it('đang chuẩn bị', () => {
    expect(text(permit(null, true, true))).toContain('Đang chuẩn bị nội dung chữ ký ủy quyền…');
  });

  it('đã chuẩn bị: permit-notice chứa số và token sẽ ký', () => {
    const html = permit(PREPARED, false, true);
    expect(html).toContain('data-testid="permit-notice"');
    expect(text(html)).toContain(`${formatAmount('200000')} VNDB`);
  });

  it('không ký được: có blockedReason, không permit-notice', () => {
    const html = permit(PREPARED, false, false);
    expect(text(html)).toContain('Lý do không ký được giả.');
    expect(html).not.toContain('permit-notice');
  });
});

const summary = (total: string | null, balances: { wpt: string; vndb: string } | null) =>
  renderToStaticMarkup(createElement(OrderSummary, { side: 'BUY', quantity: '1', priceVnd: '100000', total, balances }));

describe('FE-UX-04b nhóm 6: OrderSummary', () => {
  it('balances null: "Không có" 2 lần, aria-label, data-tone="hl"; total null: "Chưa có"; 6 nhãn đúng thứ tự', () => {
    const html = summary(null, null);
    const content = text(html);
    expect(count(content, 'Không có')).toBe(2);
    expect(html).toContain('aria-label="Tóm tắt lệnh"');
    expect(html).toContain('data-tone="hl"');
    expect(content).toContain('Chưa có');
    const labels = [...html.matchAll(/<dt[^>]*>(.*?)<\/dt>/g)].map((match) => text(match[1]));
    expect(labels).toEqual(['Loại lệnh', 'Số lượng', 'Giá', 'Tổng giá trị dự kiến', 'Token đang giữ', 'Số dư VNDB']);
  });
});

describe('FE-UX-04b nhóm 7: ConnectWalletPrompt', () => {
  it('EmptyState, chữ, liên kết Ví của tôi', () => {
    const html = renderToStaticMarkup(createElement(ConnectWalletPrompt));
    const content = text(html);
    expect(html).toContain('data-slot="empty-state"');
    expect(content).toContain('Chưa kết nối ví');
    expect(content).toContain('Kết nối ví ở góc trên phải, hoặc mở');
    expect(content).toContain('để đặt lệnh mua hoặc bán token.');
    expect(html).toMatch(/<a[^>]*href="\/wallet"[^>]*>Ví của tôi<\/a>/);
  });
});
