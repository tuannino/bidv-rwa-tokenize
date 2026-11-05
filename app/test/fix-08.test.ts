import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { activeNavHref } from '@/components/layout/active-nav';
import { NAV_BY_ROLE, withHiddenOps, type NavItem } from '@/components/layout/nav-config';
import { ROLES } from '@/lib/rbac';

/**
 * FIX-08 (design mục 2): thanh bên sáng đúng một mục, mục khớp đường dẫn dài nhất. Ký tự cấm viết
 * bằng escape.
 */

describe('FIX-08 nhóm 1: activeNavHref', () => {
  const SELLER = ['/seller', '/seller/transactions', '/seller/withdraw', '/wallet', '/account'];

  it.each([
    ['/seller', '/seller'],
    ['/seller/transactions', '/seller/transactions'],
    ['/seller/withdraw', '/seller/withdraw'],
    ['/wallet', '/wallet'],
  ])('menu Người bán, %s sáng %s', (pathname, expected) => {
    expect(activeNavHref(SELLER, pathname)).toBe(expected);
  });

  it('tiền tố phải có dấu "/": /wallet-binding, /wallet/x, /walletx', () => {
    const hrefs = ['/wallet', '/wallet-binding'];
    expect(activeNavHref(hrefs, '/wallet-binding')).toBe('/wallet-binding');
    expect(activeNavHref(hrefs, '/wallet/x')).toBe('/wallet');
    expect(activeNavHref(hrefs, '/walletx')).toBeNull();
  });

  it('"/" chỉ khớp chính nó; đường dẫn con của mục khác vẫn khớp mục đó', () => {
    expect(activeNavHref(['/', '/draft'], '/')).toBe('/');
    expect(activeNavHref(['/'], '/draft')).toBeNull();
    expect(activeNavHref(['/', '/transactions'], '/transactions/abc')).toBe('/transactions');
  });

  it('danh sách rỗng, đường dẫn không có trong menu ra null', () => {
    expect(activeNavHref([], '/seller')).toBeNull();
    const investor = NAV_BY_ROLE.INVESTOR.groups.flatMap((group) => group.items.map((item) => item.href));
    expect(activeNavHref(investor, '/tokens/WPT')).toBeNull();
  });

  it('ba tầng lồng nhau lấy tầng sâu nhất; thứ tự danh sách không ảnh hưởng', () => {
    const nested = ['/a', '/a/b', '/a/b/c'];
    expect(activeNavHref(nested, '/a/b/c/d')).toBe('/a/b/c');
    expect(activeNavHref([...nested].reverse(), '/a/b/c/d')).toBe('/a/b/c');
    expect(activeNavHref(['/seller/withdraw', '/seller'], '/seller/withdraw')).toBe('/seller/withdraw');
  });
});

/** Mọi đường dẫn trang có thật: duyệt mọi `page.tsx` dưới `app/src/app` như `four-roles-routes.test.ts`, `[x]` thành `x`. */
const APP_DIR = path.resolve(__dirname, '../src/app');
function allRoutes(): string[] {
  const found = new Set<string>();
  const walk = (current: string, parts: string[]) => {
    for (const entry of readdirSync(current)) {
      const full = path.join(current, entry);
      if (statSync(full).isDirectory()) {
        walk(full, entry.startsWith('(') ? parts : [...parts, entry.replace(/^\[(.+)\]$/, '$1')]);
      } else if (entry === 'page.tsx') {
        found.add('/' + parts.join('/'));
      }
    }
  };
  walk(APP_DIR, []);
  return [...found].sort();
}

/** Quy tắc cũ, chép đúng biểu thức `isActive` của `sidebar.tsx` trước FIX-08. */
const oldIsActive = (item: NavItem, pathname: string) =>
  item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(item.href + '/');

const menuItems = (role: (typeof ROLES)[number]) =>
  withHiddenOps(NAV_BY_ROLE[role], { demoPayment: true, walletBinding: true }).groups.flatMap((group) => group.items);

describe('FIX-08 nhóm 2: so với quy tắc cũ trên mọi trang có thật của bốn vai', () => {
  const routes = allRoutes();

  it('có đủ trang để so (ít nhất 20 đường dẫn, gồm các màn Người bán)', () => {
    expect(routes.length).toBeGreaterThanOrEqual(20);
    for (const route of ['/seller', '/seller/transactions', '/seller/withdraw', '/transactions/id']) {
      expect(routes).toContain(route);
    }
  });

  it.each(ROLES)('%s: menu (gồm nhóm ẩn) không có hai mục cùng href', (role) => {
    const hrefs = menuItems(role).map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('mới sáng nhiều nhất một mục; cũ sáng 0 hoặc 1 thì mới giống hệt; cũ sáng từ 2 thì mới là mục dài nhất', () => {
    const duplicates: string[] = [];
    for (const role of ROLES) {
      const items = menuItems(role);
      const hrefs = items.filter((item) => !item.disabled).map((item) => item.href);
      for (const pathname of routes) {
        const oldLit = items.filter((item) => oldIsActive(item, pathname)).map((item) => item.href);
        const activeHref = activeNavHref(hrefs, pathname);
        const newLit = items.filter((item) => !item.disabled && item.href === activeHref).map((item) => item.href);
        expect(newLit.length, `${role} ${pathname}`).toBeLessThanOrEqual(1);
        if (oldLit.length <= 1) {
          expect(newLit, `${role} ${pathname}`).toEqual(oldLit);
        } else {
          duplicates.push(`${role} ${pathname}`);
          const longest = [...oldLit].sort((a, b) => b.length - a.length)[0];
          expect(newLit, `${role} ${pathname}`).toEqual([longest]);
        }
      }
    }
    // Danh sách chỗ quy tắc cũ sáng từ hai mục, lấy bằng một lần chạy đỏ trên mã cũ (tasks bước 3). Một
    // đường dẫn mới sáng hai mục theo quy tắc cũ sẽ làm test đỏ, buộc xem lại.
    expect(duplicates.sort()).toEqual(['SELLER /seller/transactions', 'SELLER /seller/withdraw']);
  });
});

const LAYOUT = path.resolve(__dirname, '../src/components/layout');
const read = (file: string) => readFileSync(path.join(LAYOUT, file), 'utf8');
const count = (source: string, needle: string) => source.split(needle).length - 1;
/** Dòng mã (bỏ dòng chú thích), cùng quy tắc tasks 6e. */
const codeLines = (source: string) => source.split('\n').filter((line) => !/^\s*(\*|\/\/|\/\*|\{\/\*)/.test(line));

describe('FIX-08 nhóm 3: mã nguồn khung', () => {
  it('sidebar.tsx: một lần activeNavHref, isActive bỏ mục disabled, aria-current, không còn so tiền tố tại chỗ', () => {
    const source = read('sidebar.tsx');
    expect(count(source, 'activeNavHref(')).toBe(1);
    expect(source).toContain('!item.disabled && item.href === activeHref');
    expect(count(source, 'aria-current={active ? "page" : undefined}')).toBe(1);
    expect(source).not.toContain('pathname.startsWith(item.href');
  });

  it.each(['sidebar.tsx', 'channel-switcher.tsx', 'chain-selector.tsx'])('%s: không U+00B7, U+2014 ngoài dòng chú thích', (file) => {
    for (const line of codeLines(read(file))) expect(line, line).not.toMatch(/[\u00b7\u2014]/);
  });

  it('channel-switcher.tsx: nhãn lựa chọn "{vai} ({mã})"; chain-selector.tsx: không còn destructive', () => {
    expect(read('channel-switcher.tsx')).toContain('({SAMPLE_ACCOUNTS[channel]})');
    expect(read('chain-selector.tsx')).not.toContain('destructive');
  });
});
