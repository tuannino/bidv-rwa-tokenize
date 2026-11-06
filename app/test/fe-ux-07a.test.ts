import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BidvLogo } from '@/components/bidv-logo';

/**
 * FE-UX-07a: trang giới thiệu công khai `/gioi-thieu`, nút về đầu trang, liên kết "Giới thiệu dự án"
 * trên thanh bên Nhà đầu tư (design mục 3). Mã nguồn so sau khi gộp khoảng trắng.
 */
const APP = path.resolve(__dirname, '..');
const read = (file: string) => readFileSync(path.join(APP, file), 'utf8');
const flat = (file: string) => read(file).replace(/\s+/g, ' ');

describe('FE-UX-07a nhóm 1: mã nguồn', () => {
  it('sidebar.tsx: đúng một IntroLink, chỉ với Nhà đầu tư, đứng trước ChainSelector', () => {
    const source = flat('src/components/layout/sidebar.tsx');
    expect(source.match(/<IntroLink\b/g)).toHaveLength(1);
    expect(source).toContain('{config.role === "INVESTOR" && <IntroLink collapsed={collapsed} onNavigate={closeDrawer} />}');
    expect(source.indexOf('<IntroLink')).toBeLessThan(source.indexOf('<ChainSelector'));
  });

  it('intro-link.tsx: không prefetch, trỏ /gioi-thieu, chữ đúng, mũi tên xanh mờ, không aria-current', () => {
    const source = flat('src/components/layout/intro-link.tsx');
    expect(source).toContain('prefetch={false}');
    expect(source).toContain('href="/gioi-thieu"');
    expect(source).toContain('Giới thiệu dự án');
    expect(source).toContain('text-primary/50');
    expect(source).not.toContain('aria-current');
  });
});

/**
 * sha256 của HTML `BidvLogo` dựng trên bản mốc `release/ui-v2` @ `29c5708` (dựng bằng chính
 * `renderToStaticMarkup`, trước khi thêm biến thể). Bản `full` dài 16.515 ký tự nên so băm thay vì chép.
 */
const BASELINE_SHA256 = {
  full: '3b205fabaa7cfb09239e896498076e94e7ed97aba60ddbf336e177fb4e73506e',
  icon: '6ef3dfc7a31b6d459e29f0e4bc26d3e610e107fdace62b2b7a6193811b816675',
};
const logo = (variant: 'full' | 'icon' | 'inline' | 'compact') =>
  renderToStaticMarkup(createElement(BidvLogo, { variant }));
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

describe('FE-UX-07a nhóm 4: BidvLogo', () => {
  it('compact: không khai báo symbol, dùng lại bông mai, hình cao 16 px, có tên', () => {
    const html = logo('compact');
    expect(html).not.toContain('<symbol');
    expect(html).toContain('<use href="#bidv-flower"');
    expect(html).toContain('RWA');
    expect(html).toContain('Tokenize Platform');
    expect(html).toMatch(/^<span role="img" aria-label="BIDV"/);
    expect(html).toMatch(/<svg viewBox="24 60 434 138" class="[^"]*\bh-4\b/);
  });

  it('inline: khai báo đúng một symbol bông mai, có tên', () => {
    const html = logo('inline');
    expect(html.match(/<symbol id="bidv-flower"/g)).toHaveLength(1);
    expect(html).toContain('RWA');
    expect(html).toContain('Tokenize Platform');
    expect(html).toMatch(/^<span role="img" aria-label="BIDV"/);
    expect(html).toMatch(/<svg viewBox="24 60 434 138" class="[^"]*\bh-6\b/);
  });

  it('full và icon dựng HTML giống hệt bản mốc', () => {
    expect(sha256(logo('full'))).toBe(BASELINE_SHA256.full);
    expect(sha256(logo('icon'))).toBe(BASELINE_SHA256.icon);
  });
});

describe('FE-UX-07a nhóm 5: nhóm route', () => {
  const APP_DIR = path.join(APP, 'src/app');
  const GATED = ['(investor)', '(seller)', '(ops)', '(ops-draft)', '(control)', '(wallet)', '(account)'];

  it('mọi route-group là một trong 7 nhóm có cổng hoặc (public)', () => {
    const groups = readdirSync(APP_DIR).filter((entry) => entry.startsWith('('));
    expect(groups.sort()).toEqual([...GATED, '(public)'].sort());
  });

  it('(public) chỉ có layout.tsx và gioi-thieu/page.tsx', () => {
    const root = path.join(APP_DIR, '(public)');
    const files = (readdirSync(root, { recursive: true }) as string[])
      .filter((entry) => statSync(path.join(root, entry)).isFile())
      .map((entry) => entry.split(path.sep).join('/'));
    expect(files.sort()).toEqual(['gioi-thieu/page.tsx', 'layout.tsx']);
  });
});
