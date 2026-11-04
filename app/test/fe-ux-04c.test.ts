import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CHAINS } from '@bidv/shared';
import type { NativeBalanceView } from '@/lib/hooks/use-native-balance';

/**
 * FE-UX-04c (design mục 3): số lời gọi action, effect của `/orders`, `/orders/[id]`, `/wallet` (QĐ-2) và các trạng thái
 * ví không dựng được trên mock, dựng bằng `renderToStaticMarkup` với dữ liệu giả.
 */

const balanceState: { current: NativeBalanceView } = {
  current: { amount: null, symbol: null, loading: false, error: null },
};
vi.mock('@/lib/hooks/use-native-balance', () => ({ useNativeBalance: () => balanceState.current }));

const { WrongChainBanner } = await import('@/components/wallet/wrong-chain-banner');
const { WalletStatusCard } = await import('@/components/wallet/wallet-status-card');
const { NoWalletGuide } = await import('@/components/wallet/no-wallet-guide');
const { UnsupportedChainNotice } = await import('@/components/pages/wallet-connect');

const read = (file: string) => readFileSync(join(__dirname, '..', 'src/components', file), 'utf8');
const count = (source: string, needle: string) => source.split(needle).length - 1;
const text = (html: string) => html.replace(/<[^>]+>/g, '');
const ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as const;

describe('FE-UX-04c nhóm 1: mã nguồn (số lời gọi bằng mốc, chữ cấm)', () => {
  it.each([
    ['pages/investor-orders.tsx', 'listOrdersAction(', 1],
    ['pages/investor-orders.tsx', 'useEffect(', 1],
    ['pages/investor-order-detail.tsx', 'getOrderDetailAction(', 1],
    ['pages/investor-order-detail.tsx', 'useEffect(', 1],
  ] as const)('%s: %s đúng %i', (file, needle, expected) => {
    expect(count(read(file), needle)).toBe(expected);
  });

  it.each([
    'pages/wallet-connect.tsx',
    'wallet/wallet-status-card.tsx',
    'wallet/no-wallet-guide.tsx',
    'wallet/wrong-chain-banner.tsx',
  ])('%s: không Action(', (file) => {
    expect(read(file)).not.toContain('Action(');
  });

  it('investor-orders.tsx không còn const FIELD, có orderStatusTone(', () => {
    const source = read('pages/investor-orders.tsx');
    expect(source).not.toContain('const FIELD');
    expect(source).toContain('orderStatusTone(');
  });

  it('wallet-connect.tsx: export UnsupportedChainNotice; không chấm giữa, gạch dài ngoài dòng chú thích', () => {
    const source = read('pages/wallet-connect.tsx');
    expect(source).toContain('export function UnsupportedChainNotice');
    const offending = source
      .split('\n')
      .filter((line) => /[\u00b7\u2014]/.test(line))
      .filter((line) => !/^\s*(\*|\/\/|\/\*|\{\/\*)/.test(line));
    expect(offending).toEqual([]);
  });
});

const banner = (props: Partial<Parameters<typeof WrongChainBanner>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(WrongChainBanner, { currentLabel: 'chain ID 1', expectedLabel: 'Hardhat Local', onSwitch: () => {}, ...props }),
  );

/** Thuộc tính `disabled` trên thẻ mở `button` (lớp Tailwind `disabled:` không tính). */
const isDisabled = (button: string) => /\sdisabled(=|\s|>)/.test(button.match(/<button[^>]*>/)![0]);

describe('FE-UX-04c nhóm 2: WrongChainBanner', () => {
  it('thường: role="alert", data-slot="alert", chữ, hai nhãn, nút chuyển không disabled', () => {
    const html = banner();
    expect(html).toContain('role="alert"');
    expect(html).toContain('data-slot="alert"');
    const content = text(html);
    expect(content).toContain('Ví đang ở mạng khác');
    expect(content).toContain('chain ID 1');
    expect(content).toContain('Hardhat Local');
    const button = html.match(/<button[^>]*>.*?<\/button>/)![0];
    expect(text(button)).toContain('Chuyển ví sang Hardhat Local');
    expect(isDisabled(button)).toBe(false);
  });

  it('đang chuyển: nút disabled, "Đang chờ ví…"', () => {
    const button = banner({ switching: true }).match(/<button[^>]*>.*?<\/button>/)![0];
    expect(isDisabled(button)).toBe(true);
    expect(text(button)).toContain('Đang chờ ví…');
  });

  it('có lỗi: role="status" chứa câu lỗi; children được dựng', () => {
    const html = banner({ error: 'Ví từ chối chuyển mạng.', children: createElement('span', { 'data-child': '' }, 'Lối khác') });
    expect(html).toMatch(/<p[^>]*role="status"[^>]*>Ví từ chối chuyển mạng\.<\/p>/);
    expect(html).toContain('data-child');
    expect(text(html)).toContain('Lối khác');
  });
});

const card = (chainKey: 'evm' | 'hardhat-local', balance: Partial<NativeBalanceView> = {}) => {
  balanceState.current = { amount: null, symbol: null, loading: false, error: null, ...balance };
  return renderToStaticMarkup(createElement(WalletStatusCard, { address: ADDRESS, chainKey, onDisconnect: () => {} }));
};

describe('FE-UX-04c nhóm 3: WalletStatusCard', () => {
  beforeEach(() => {
    balanceState.current = { amount: null, symbol: null, loading: false, error: null };
  });

  it('có số dư: Kpi vàng chứa số và ký hiệu', () => {
    const html = card('hardhat-local', { amount: '9.999,5', symbol: 'ETH' });
    const kpi = html.slice(html.indexOf('data-kpi'));
    expect(kpi).toContain('data-tone="gold"');
    expect(text(kpi)).toContain('9.999,5');
    expect(text(kpi)).toContain('ETH');
  });

  it.each([
    [{ loading: true }, 'đang đọc…'],
    [{ error: 'Chưa đọc được số dư, có thể node của mạng này chưa chạy.' }, 'Chưa đọc được số dư, có thể node của mạng này chưa chạy.'],
    [{}, 'chưa có'],
  ] as const)('trạng thái số dư %j: có "%s"', (balance, expected) => {
    expect(text(card('hardhat-local', balance))).toContain(expected);
  });

  it.each(['evm', 'hardhat-local'] as const)('%s: thẻ xanh, địa chỉ, sr-only, sao chép, ngắt kết nối, lưới 12 cột', (chainKey) => {
    const html = card(chainKey, { amount: '1', symbol: 'ETH' });
    expect(html).toContain('data-tone="hl"');
    expect(html).toContain(`title="${ADDRESS}"`);
    expect(text(html)).toContain(`Địa chỉ đầy đủ: ${ADDRESS}`);
    expect(html).toContain(`aria-label="Sao chép địa chỉ ví ${ADDRESS}"`);
    expect(text(html)).toContain('Ngắt kết nối');
    expect(text(html)).toContain('Số WPT đang giữ xem ở trang Tổng quan.');
    expect(html).toContain('min-[1100px]:grid-cols-12');
    expect(html).toMatch(/data-slot="card"[^>]*class="[^"]*min-\[1100px\]:col-span-7/);
    expect(html).toMatch(/data-kpi=""[^>]*class="[^"]*min-\[1100px\]:col-span-5/);
    const bare = [...html.matchAll(/class="([^"]*)"/g)]
      .flatMap((match) => match[1].split(/\s+/))
      .filter((cls) => /(^|:)col-span-/.test(cls) && !cls.startsWith('min-[1100px]:'));
    expect(bare).toEqual([]);
    if (chainKey === 'evm') {
      expect(html).toMatch(/<a[^>]*target="_blank"/);
    } else {
      expect(html).not.toContain('<a');
    }
  });
});

describe('FE-UX-04c nhóm 4: NoWalletGuide', () => {
  it('heading, hai liên kết mở tab mới, ol 3 bước, "Tải lại trang này"', () => {
    const html = renderToStaticMarkup(createElement(NoWalletGuide));
    expect(html).toMatch(/role="heading"[^>]*>.*Chưa có ví trong trình duyệt/);
    for (const href of ['https://metamask.io/download/', 'https://rabby.io/']) {
      const link = html.match(new RegExp(`<a[^>]*href="${href.replace(/[./]/g, '\\$&')}"[^>]*>.*?</a>`))![0];
      expect(text(link)).toContain('(mở tab mới)');
    }
    const ol = html.slice(html.indexOf('<ol'), html.indexOf('</ol>'));
    const topLevel = ol.replace(/<ul[\s\S]*?<\/ul>/g, '');
    expect(count(topLevel, '<li')).toBe(3);
    expect(text(html)).toContain('Tải lại trang này');
  });
});

describe('FE-UX-04c nhóm 5: UnsupportedChainNotice', () => {
  it('heading, nhãn mạng, câu đổi mạng có ba nhãn của CHAINS', () => {
    const html = renderToStaticMarkup(createElement(UnsupportedChainNotice, { chainLabel: 'Stellar' }));
    expect(html).toMatch(/role="heading"[^>]*>.*Chưa hỗ trợ ví cho mạng này/);
    const content = text(html);
    expect(content).toContain('Stellar');
    for (const label of [CHAINS['hardhat-local'].label, CHAINS.evm.label, CHAINS.mock.label]) expect(content).toContain(label);
  });
});
