import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CHAINS } from '@bidv/shared';
import { headerProgress, stepProgress } from '@/components/layout/header-progress';
import { HeaderWalletButtonView } from '@/components/layout/header-wallet-button';
import { resolveWalletStatus } from '@/lib/wallet/wallet-status';

/**
 * FE-UX-07b: thanh đầu theo bản chốt, nhãn chain "Private Chain" (design mục 3).
 */
const APP = path.resolve(__dirname, '..');
const read = (file: string) => readFileSync(path.join(APP, file), 'utf8');
const flat = (file: string) => read(file).replace(/\s+/g, ' ');
/** Lớp đứng riêng (ranh giới token), để `top-2.5` không khớp nhầm `top-2`. */
const hasClass = (source: string, name: string) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|[\\s"\'`])' + escaped + '([\\s"\'`]|$)').test(source);
};
/** Màu cứng và `*-destructive` (cùng regex tasks bước 6b). */
const HARD_COLOR =
  /\b(bg|text|border|ring|fill|stroke|from|to|via)-(white|black|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3})\b|#[0-9a-fA-F]{3,8}\b|rgba?\(|-destructive\b/;
const isComment = (line: string) => /^\s*(\*|\/\/|\/\*|\{\/\*)/.test(line);

describe('FE-UX-07b nhóm 1: mã nguồn', () => {
  const header = read('src/components/layout/header.tsx');
  const headerFlat = flat('src/components/layout/header.tsx');

  it('tiến độ cuộn ghi thẳng lên phần tử, không state; một trình nghe scroll thụ động, gỡ khi unmount', () => {
    expect(header).not.toContain('useState(');
    expect(header).toContain('setProperty("--hp"');
    expect(header).toContain('requestAnimationFrame(');
    expect(header).toContain('cancelAnimationFrame(');
    expect(headerFlat).toMatch(/addEventListener\(["']scroll["'], \w+, \{ passive: true \}\)/);
    expect(header).toMatch(/removeEventListener\(["']scroll["']/);
  });

  it('kích thước, vị trí theo QĐ-1; bỏ nền thẻ cũ và dính sát đỉnh', () => {
    // Tên lớp ghép từ mảnh: Tailwind quét cả thư mục test, viết liền sẽ sinh thêm CSS.
    const wide = ['min-[1100px]', ':'].join('');
    for (const name of [`${wide}mx-6`, ['mx', '3'].join('-'), ['top', '2'].join('-'), `${wide}top-2.5`, ['h', '[46px]'].join('-'), `${wide}h-11`]) {
      expect(hasClass(header, name), name).toBe(true);
    }
    expect(hasClass(header, ['top', '0'].join('-'))).toBe(false);
    expect(header).not.toContain(['bg-card', '80'].join('/'));
  });

  it('giữ logic khung: inert, nút menu, đường chân trời, title nút Sáng Tối; nút ví qua HeaderWalletButton', () => {
    expect(header).toContain('inert={open}');
    expect(header).toContain('id={MENU_BUTTON_ID}');
    expect(header).toContain('data-horizon');
    expect(headerFlat).toContain('title={resolvedTheme === "dark" ? "Chuyển sang Light mode" : "Chuyển sang Dark mode"}');
    expect(header).not.toContain('<ConnectButton');
    expect(header).toContain('<HeaderWalletButton />');
  });

  it('globals.css có đủ 7 token; --hdr-on, --hdr-shadow có ở cả :root và .dark', () => {
    const css = read('src/app/globals.css');
    const root = css.slice(css.indexOf(':root {'), css.indexOf('.dark {'));
    const dark = css.slice(css.indexOf('.dark {'), css.indexOf('@layer base'));
    for (const token of ['--hdr-on', '--hdr-shadow', '--hdr-accent-from', '--hdr-accent-to', '--hdr-gold-from', '--hdr-gold-to', '--hdr-gold-ink']) {
      expect(root, token).toContain(`${token}:`);
    }
    expect(dark).toContain('--hdr-on:');
    expect(dark).toContain('--hdr-shadow:');
  });

  it('không mã màu trong header.tsx, header-wallet-button.tsx, header-progress.ts', () => {
    for (const file of ['header.tsx', 'header-wallet-button.tsx', 'header-progress.ts']) {
      const lines = read(`src/components/layout/${file}`).split('\n').filter((line) => !isComment(line) && HARD_COLOR.test(line));
      expect(lines, file).toEqual([]);
    }
  });
});

describe('FE-UX-07b nhóm 2: hàm thuần tiến độ', () => {
  it('headerProgress kẹp trong 0..1; quãng dưới 60 coi là 60', () => {
    expect(headerProgress({ scrollTop: -20, range: 100 })).toBe(0);
    expect(headerProgress({ scrollTop: 0, range: 100 })).toBe(0);
    expect(headerProgress({ scrollTop: 50, range: 100 })).toBe(0.5);
    expect(headerProgress({ scrollTop: 500, range: 100 })).toBe(1);
    expect(headerProgress({ scrollTop: 30, range: 10 })).toBe(0.5);
  });

  it('stepProgress: giảm chuyển động về đích ngay; không thì đơn điệu, tới đúng 1 trong tối đa 40 bước', () => {
    expect(stepProgress({ current: 0, target: 1, reduce: true })).toBe(1);
    expect(stepProgress({ current: 0.7, target: 0.2, reduce: true })).toBe(0.2);
    let value = 0;
    let steps = 0;
    while (value !== 1 && steps < 40) {
      const next = stepProgress({ current: value, target: 1, reduce: false });
      expect(next).toBeGreaterThan(value);
      value = next;
      steps++;
    }
    expect(value).toBe(1);
    expect(steps).toBeLessThanOrEqual(40);
  });
});

describe('FE-UX-07b nhóm 3: HeaderWalletButtonView', () => {
  const view = (props: Parameters<typeof HeaderWalletButtonView>[0]) => renderToStaticMarkup(createElement(HeaderWalletButtonView, props));

  it('chưa kết nối: chữ "Kết nối ví", biểu tượng ẩn với trình đọc, nền vàng; dưới 640 px chỉ biểu tượng, có tên', () => {
    const html = view({ state: 'disconnected', onClick: () => {} });
    expect(html).toMatch(/^<button[^>]*aria-label="Kết nối ví"/);
    expect(html).toContain('Kết nối ví</span>');
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(html).toContain('--hdr-gold-from');
    expect(html).toContain(['max-[640px]', 'sr-only'].join(':'));
  });

  it('sai mạng: nút "Sai mạng" nền đỏ nhạt', () => {
    const html = view({ state: 'wrong-network', onClick: () => {} });
    expect(html).toMatch(/^<button/);
    expect(html).toContain('Sai mạng');
    expect(html).toContain(['bg', 'bad', 'bg'].join('-'));
  });

  it('đã kết nối: hiện nhãn truyền vào', () => {
    expect(view({ state: 'connected', label: '0xf39F…2266', onClick: () => {} })).toContain('0xf39F…2266');
  });

  it('chưa sẵn sàng: giữ chỗ ẩn, không phải nút bấm', () => {
    const html = view({ state: 'loading' });
    expect(html).toMatch(/^<span aria-hidden="true"/);
    expect(html).not.toContain('<button');
    expect(html).toContain(['pointer', 'events', 'none'].join('-'));
  });

  it('không chấm giữa, gạch dài trong HTML', () => {
    for (const state of ['loading', 'disconnected', 'wrong-network', 'connected'] as const) {
      expect(view({ state, label: 'x' })).not.toMatch(/[\u00b7\u2014]/);
    }
  });
});

describe('FE-UX-07b nhóm 4: nhãn chain', () => {
  it('hardhat-local hiển thị "Private Chain"; khoá, chainId, RPC giữ nguyên', () => {
    const info = CHAINS['hardhat-local'];
    expect(info.label).toBe('Private Chain');
    expect(info.key).toBe('hardhat-local');
    expect(info.chainId).toBe(31337);
    expect(info.defaultRpcUrl).toBe('http://127.0.0.1:8545');
  });

  const base = { mounted: true, hasInjectedProvider: true, isConnected: true, address: '0x0000000000000000000000000000000000000001' as const };

  it('app ở evm, ví ở chain 31337: chain-mismatch có walletChain "Private Chain"', () => {
    const status = resolveWalletStatus({ ...base, appChain: 'evm', walletChainId: 31337 });
    expect(status.kind).toBe('chain-mismatch');
    expect(status.kind === 'chain-mismatch' && status.walletChain).toBe('Private Chain');
  });

  it('app ở hardhat-local, ví ở chain 1: wrong-chain có expectedLabel "Private Chain"', () => {
    const status = resolveWalletStatus({ ...base, appChain: 'hardhat-local', walletChainId: 1 });
    expect(status.kind).toBe('wrong-chain');
    expect(status.kind === 'wrong-chain' && status.expectedLabel).toBe('Private Chain');
  });
});
