import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { initialsOf } from '@/components/account/initials';
import { PaymentWalletContent, type AccountWalletState } from '@/components/account/payment-wallet-content';
import { AccountInfoPage } from '@/components/pages/account-info';
import { findOwnAccountProfile, type AccountProfileView } from '@/lib/bank/account-profile.service';
import type { Role } from '@/lib/rbac';
import { ROLE_LABELS } from '@/lib/role-labels';

/**
 * FE-UX-05b (design mục 3): số lời gọi action, effect của `/account` (QĐ-2), ranh giới máy chủ (QĐ-1), chữ viết tắt
 * (QĐ-6), `AccountInfoPage` bốn vai và biến thể, `PaymentWalletContent` các nhánh không dựng được trên mock.
 */

const read = (file: string) => readFileSync(join(__dirname, '..', 'src/components', file), 'utf8');
const count = (source: string, needle: string) => source.split(needle).length - 1;
const INFO = 'pages/account-info.tsx';
const WALLET = 'pages/account-wallet.tsx';
const CONTENT = 'account/payment-wallet-content.tsx';
const INITIALS = 'account/initials.ts';
const text = (html: string) => html.replace(/<[^>]+>/g, '');

describe('FE-UX-05b nhóm 1: mã nguồn (số lời gọi bằng mốc, ranh giới máy chủ)', () => {
  it.each([
    [WALLET, 'getAccountWalletAction(', 1],
    [WALLET, 'useEffect(', 1],
  ] as const)('%s: %s đúng %i', (file, needle, expected) => {
    expect(count(read(file), needle)).toBe(expected);
  });

  it.each([INFO, CONTENT, INITIALS])('%s: không Action(, useEffect(, useState(', (file) => {
    const source = read(file);
    for (const needle of ['Action(', 'useEffect(', 'useState(']) expect(source).not.toContain(needle);
  });

  it.each([CONTENT, INITIALS])('%s: không wagmi', (file) => {
    expect(read(file)).not.toContain('wagmi');
  });

  it(`${INFO}: thành phần máy chủ, không sắc destructive, 4 note= UnverifiedNote và 1 trong ProfileHero`, () => {
    const source = read(INFO);
    expect(source).not.toContain("'use client'");
    expect(source).not.toContain('-destructive');
    expect(source).not.toContain("'destructive'");
    expect(count(source, 'note={<UnverifiedNote')).toBe(4);
    expect(count(source, '<UnverifiedNote') - count(source, 'note={<UnverifiedNote')).toBe(1);
    expect(count(source, 'function ProfileHero')).toBe(1);
    expect(count(source, '<ProfileHero')).toBe(2);
  });

  it(`${INFO}: mọi lớp col-span- có tiền tố mốc`, () => {
    const bare = [...read(INFO).matchAll(/(?:className|class)=["'`{][^"'`}]*["'`}]/g)]
      .flatMap((match) => match[0].split(/[\s"'`{}]+/))
      .filter((cls) => /(^|:)col-span-/.test(cls) && !/^min-\[\d+px\]:/.test(cls));
    expect(bare).toEqual([]);
  });

  it(`${WALLET}: không còn text-destructive`, () => {
    expect(read(WALLET)).not.toContain('text-destructive');
  });

  it(`${WALLET}: giữ export PaymentWalletValue, gọi PaymentWalletContent bằng context`, () => {
    const source = read(WALLET);
    expect(source).toContain('export function PaymentWalletValue');
    expect(source).toContain('<PaymentWalletContent state={useContext(AccountWalletContext)} />');
  });

  it.each([CONTENT, INITIALS])('%s: mọi câu nhập từ @/lib/bank/ là import type', (file) => {
    expect(read(file)).not.toMatch(/^import\s+(?!type\b)[^;]*from '@\/lib\/bank\//m);
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
    expect(html).toMatch(/<span class="text-bad-ink">Dữ liệu không hợp lệ\.<\/span>/);
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
    expect(badge[0]).toContain(bound ? 'bg-ok-bg' : 'bg-bad-bg');
  });
});

describe('FE-UX-05b nhóm 2: initialsOf', () => {
  it.each([
    ['Nguyễn Văn An', false, 'NA'],
    ['Công ty Cổ phần Điện gió An Viên', true, 'AV'],
    ['Lê Minh Cường', false, 'LC'],
    ['Phạm Thu Dung', false, 'PD'],
    ['đỗ hùng', false, 'ĐH'],
    ['  An  ', false, 'A'],
    ['', false, ''],
  ] as const)('"%s" (tổ chức %s) là "%s"', (name, organization, expected) => {
    expect(initialsOf(name, organization)).toBe(expected);
  });
});

const ACTORS: Record<Role, string> = { INVESTOR: 'NDT001', SELLER: 'NB001', TELLER: 'GDV001', CONTROLLER: 'KSV001' };
const INITIALS_OF: Record<Role, string> = { INVESTOR: 'NA', SELLER: 'AV', TELLER: 'LC', CONTROLLER: 'PD' };
const profileOf = (role: Role) => findOwnAccountProfile(role, ACTORS[role])!;
const page = (profile: AccountProfileView) => renderToStaticMarkup(createElement(AccountInfoPage, { profile }));
/** Các khối thẻ theo thứ tự HTML (mỗi khối từ `data-slot="card"` tới khối sau). */
const cards = (html: string) => html.split('data-slot="card"').slice(1);
const dts = (block: string) =>
  [...block.matchAll(/<dt[^>]*>(.*?)<\/dt>/g)].map((match) => text(match[1]).replace('unverified', '').trim());
const titles = (html: string) => [...html.matchAll(/role="heading"[^>]*>(.*?)<\/div>/g)].map((match) => text(match[1]).replace('unverified', '').trim());
/** Lớp của ô `Field` có nhãn `label`. */
const fieldClass = (block: string, label: string) =>
  block.match(new RegExp(`<div class="([^"]*)"><dt[^>]*>${label}</dt>`))![1];
const badge = (tone: string, label: string) => new RegExp(`<span[^>]*class="[^"]*${tone}[^"]*"[^>]*>${label}</span>`);

describe('FE-UX-05b nhóm 3: AccountInfoPage', () => {
  it.each(['INVESTOR', 'SELLER', 'TELLER', 'CONTROLLER'] as const)('%s: một ô xanh, một h1, chỉ đọc, ô xanh đủ chữ', (role) => {
    const profile = profileOf(role);
    const html = page(profile);
    expect(count(html, 'data-account-hero')).toBe(1);
    expect(count(html, '<h1')).toBe(1);
    for (const tag of ['<button', '<input', '<textarea', '<select']) expect(html).not.toContain(tag);
    expect(html).not.toMatch(/class="[^"]*\b(bg|text)-destructive\b/);
    const hero = cards(html)[0];
    expect(hero).toContain('data-account-hero');
    expect(text(hero)).toContain(profile.fullName);
    expect(text(hero)).toContain(ROLE_LABELS[role]);
    expect(hero).toMatch(new RegExp(`<span aria-hidden="true"[^>]*>${INITIALS_OF[role]}</span>`));
    expect(hero).not.toContain('role="heading"');
  });

  it('Nhà đầu tư: thứ tự trường ô xanh và ba thẻ, unverified 4 lần, ô Hạn mức vàng, ví hết hàng, thẻ dòng', () => {
    const html = page(profileOf('INVESTOR'));
    const [hero, personal, account, risk] = cards(html);
    expect(dts(hero)).toEqual(['Họ và tên', 'Mã người dùng', 'Vai trò']);
    expect(titles(html)).toEqual(['Thông tin cá nhân', 'Thông tin tài khoản', 'Hồ sơ định danh và rủi ro']);
    expect(dts(personal)).toEqual(['Số điện thoại', 'Thư điện tử', 'Trạng thái định danh', 'Ví thanh toán']);
    expect(dts(account)).toEqual(['Trạng thái', 'Ngày tạo', 'Hoạt động gần nhất']);
    expect(dts(risk)).toEqual([
      'Loại khách hàng',
      'Trạng thái định danh',
      'Xếp hạng rủi ro',
      'Phòng chống rửa tiền',
      'Hạn mức giao dịch mỗi ngày',
    ]);
    expect(count(text(html), 'unverified')).toBe(4);
    expect(fieldClass(risk, 'Hạn mức giao dịch mỗi ngày')).toContain('tile-gold');
    expect(fieldClass(personal, 'Ví thanh toán')).toContain('min-[640px]:col-span-full');
    expect(count(html, 'role="heading"')).toBe(3);
    for (const label of ['Trạng thái', 'Ngày tạo', 'Hoạt động gần nhất']) {
      const cls = fieldClass(account, label);
      expect(cls).toContain('justify-between');
      expect(cls).not.toContain('bg-muted/60');
    }
  });

  it('Người bán: Tên pháp nhân ở ô xanh, Người liên hệ trước Số điện thoại, ví rộng 2 cột, không "Họ và tên"', () => {
    const html = page(profileOf('SELLER'));
    const [hero, legal] = cards(html);
    expect(dts(hero)[0]).toBe('Tên pháp nhân');
    expect(dts(legal).slice(0, 2)).toEqual(['Người liên hệ', 'Số điện thoại']);
    const wallet = fieldClass(legal, 'Ví thanh toán');
    expect(wallet).toContain('min-[640px]:col-span-2');
    expect(wallet).not.toContain('col-span-full');
    expect(text(html)).not.toContain('Họ và tên');
  });

  it.each(['TELLER', 'CONTROLLER'] as const)('%s: ô xanh Họ và tên, Vai trò; thẻ cán bộ 5 trường; unverified 2 lần; không ví', (role) => {
    const html = page(profileOf(role));
    const [hero, staff] = cards(html);
    expect(dts(hero)).toEqual(['Họ và tên', 'Vai trò']);
    expect(dts(staff)).toEqual(['Mã cán bộ', 'Trạng thái', 'Số điện thoại', 'Thư điện tử', 'Hoạt động gần nhất']);
    expect(count(text(html), 'unverified')).toBe(2);
    expect(count(html, 'role="heading"')).toBe(1);
    expect(text(html)).not.toContain('Ví thanh toán');
  });

  it.each(['INVESTOR', 'TELLER'] as const)('%s status LOCKED: "Đã khoá" là Badge bg-bad-bg', (role) => {
    expect(page({ ...profileOf(role), status: 'LOCKED' } as AccountProfileView)).toMatch(badge('bg-bad-bg', 'Đã khoá'));
  });

  it.each([
    ['APPROVED', 'bg-ok-bg', 'Đã xác minh'],
    ['PENDING', 'bg-warn-bg', 'Đang xác minh'],
    ['REJECTED', 'bg-bad-bg', 'Không đạt'],
  ] as const)('identityStatus %s: Badge %s "%s" ở thẻ đầu, thẻ rủi ro là chữ trơn', (identityStatus, tone, label) => {
    const html = page({ ...profileOf('INVESTOR'), identityStatus } as AccountProfileView);
    expect(html).toMatch(badge(tone, label));
    expect(count(html, `>${label}</span>`)).toBe(1);
    expect(count(text(html), label)).toBe(2);
  });

  it.each([
    ['LOW', 'bg-secondary', 'Thấp'],
    ['MEDIUM', 'bg-warn-bg', 'Trung bình'],
    ['HIGH', 'bg-bad-bg', 'Cao'],
  ] as const)('riskRating %s: Badge %s "%s"', (riskRating, tone, label) => {
    expect(page({ ...profileOf('INVESTOR'), riskRating } as AccountProfileView)).toMatch(badge(tone, label));
  });
});
