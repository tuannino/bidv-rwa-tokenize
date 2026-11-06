import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

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
