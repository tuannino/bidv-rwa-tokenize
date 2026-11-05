import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PaymentWalletContent, type AccountWalletState } from '@/components/account/payment-wallet-content';

/**
 * FE-UX-05b (design mục 3): số lời gọi action, effect của `/account` (QĐ-2), ranh giới máy chủ (QĐ-1), chữ viết tắt
 * (QĐ-6), `AccountInfoPage` bốn vai và biến thể, `PaymentWalletContent` các nhánh không dựng được trên mock.
 */

const read = (file: string) => readFileSync(join(__dirname, '..', 'src/components', file), 'utf8');
const count = (source: string, needle: string) => source.split(needle).length - 1;
const INFO = 'pages/account-info.tsx';
const WALLET = 'pages/account-wallet.tsx';
const CONTENT = 'account/payment-wallet-content.tsx';
const text = (html: string) => html.replace(/<[^>]+>/g, '');

describe('FE-UX-05b nhóm 1: mã nguồn (số lời gọi bằng mốc, ranh giới máy chủ)', () => {
  it.each([
    [WALLET, 'getAccountWalletAction(', 1],
    [WALLET, 'useEffect(', 1],
  ] as const)('%s: %s đúng %i', (file, needle, expected) => {
    expect(count(read(file), needle)).toBe(expected);
  });

  it.each([INFO, CONTENT])('%s: không Action(, useEffect(, useState(', (file) => {
    const source = read(file);
    for (const needle of ['Action(', 'useEffect(', 'useState(']) expect(source).not.toContain(needle);
  });

  it(`${CONTENT}: không wagmi`, () => {
    expect(read(CONTENT)).not.toContain('wagmi');
  });

  it(`${WALLET}: giữ export PaymentWalletValue, gọi PaymentWalletContent bằng context`, () => {
    const source = read(WALLET);
    expect(source).toContain('export function PaymentWalletValue');
    expect(source).toContain('<PaymentWalletContent state={useContext(AccountWalletContext)} />');
  });

  it(`${CONTENT}: mọi câu nhập từ @/lib/bank/ là import type`, () => {
    expect(read(CONTENT)).not.toMatch(/^import\s+(?!type\b)[^;]*from '@\/lib\/bank\//m);
  });
});

const WALLET_ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const content = (state: AccountWalletState | null) => renderToStaticMarkup(createElement(PaymentWalletContent, { state }));
const ok = (wallet: string | null, bound: boolean): AccountWalletState => ({
  chain: 'mock',
  connected: undefined,
  result: { ok: true, data: { wallet, bound } } as AccountWalletState['result'],
});

describe('FE-UX-05b nhóm 4: PaymentWalletContent', () => {
  it('state null: "Đang đọc…"', () => {
    expect(text(content(null))).toBe('Đang đọc…');
  });

  it('chain thật chưa kết nối: "Chưa kết nối ví." kèm liên kết /wallet "Kết nối ví"', () => {
    const html = content({ chain: 'evm', connected: undefined, result: null });
    expect(text(html)).toContain('Chưa kết nối ví.');
    const link = html.match(/<a[^>]*>.*?<\/a>/)![0];
    expect(link).toContain('href="/wallet"');
    expect(text(link)).toBe('Kết nối ví');
  });

  it('mock đang đọc: "Đang đọc…"', () => {
    expect(text(content({ chain: 'mock', connected: undefined, result: null }))).toBe('Đang đọc…');
  });

  it('lỗi đọc ví: câu lỗi, không role', () => {
    const html = content({
      chain: 'mock',
      connected: undefined,
      result: { ok: false, code: 'VALIDATION', error: 'Dữ liệu không hợp lệ.' } as AccountWalletState['result'],
    });
    expect(text(html)).toBe('Dữ liệu không hợp lệ.');
    expect(html).not.toContain('role=');
  });

  it('ok, wallet null: "Chưa kết nối ví.", không liên kết', () => {
    const html = content(ok(null, false));
    expect(text(html)).toBe('Chưa kết nối ví.');
    expect(html).not.toContain('<a');
  });

  it.each([
    [true, 'Đã định danh'],
    [false, 'Ví chưa được định danh'],
  ] as const)('ok, ví 42 ký tự, bound %s: data-payment-wallet, data-wallet-bound, chữ "%s"', (bound, label) => {
    const html = content(ok(WALLET_ADDRESS, bound));
    expect(html).toMatch(new RegExp(`<span[^>]*data-payment-wallet[^>]*>${WALLET_ADDRESS}</span>`));
    const badge = html.match(new RegExp(`<span[^>]*data-wallet-bound="${bound}"[^>]*>(.*?)</span>`))!;
    expect(badge[1]).toBe(label);
  });
});
