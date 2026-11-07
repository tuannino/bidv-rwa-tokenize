import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BidvLogo } from '@/components/bidv-logo';
import { LandingPage } from '@/components/landing/landing-page';
import { LANDING_ROLES, landingChromeState } from '@/components/landing/landing-data';
import { CHANNEL_HOME, isChannel } from '@/lib/session/channel';

// Form vào khu vực gọi server action `setChannel`; dựng HTML không cần action thật.
vi.mock('@/app/actions/session', () => ({ setChannel: vi.fn() }));

/**
 * FE-UX-07a: trang giới thiệu công khai `/gioi-thieu`, nút về đầu trang, liên kết "Giới thiệu dự án"
 * trên thanh bên Nhà đầu tư (design mục 3). Mã nguồn so sau khi gộp khoảng trắng.
 */
const APP = path.resolve(__dirname, '..');
const read = (file: string) => readFileSync(path.join(APP, file), 'utf8');
const flat = (file: string) => read(file).replace(/\s+/g, ' ');

const LANDING_DIR = 'src/components/landing';
const LANDING_FILES = readdirSync(path.join(APP, LANDING_DIR)).map((file) => `${LANDING_DIR}/${file}`);
const ROUTE_FILES = ['src/app/(public)/layout.tsx', 'src/app/(public)/gioi-thieu/page.tsx'];

/** Màu cứng và `*-destructive` (cùng regex tasks bước 6b). */
const HARD_COLOR =
  /\b(bg|text|border|ring|fill|stroke|from|to|via)-(white|black|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3})\b|#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(|-destructive\b/;
/** Ký tự cấm: chấm giữa, gạch dài, mũi tên, dấu nhân, gạch nối liền dấu lớn hơn. */
const FORBIDDEN = /[\u00b7\u2014\u2192\u00d7]|-\x3e/;
const isComment = (line: string) => /^\s*(\*|\/\/|\/\*|\{\/\*)/.test(line);

/** Câu MỚI của QĐ-5 và câu bản chốt tương ứng (không được còn). */
const NEW_H1 = 'Nền tảng Token hoá dự án điện gió, đầu tư bền vững, lợi tức dài hạn';
const NEW_SENTENCES = [
  'Đầu tư dài hạn, lợi nhuận bền vững - Đối tác của BIDV',
  'Các dự án điện gió lớn phù hợp định hướng ESG, sản lượng điện đều đặn',
  'Tiền điện định kỳ chuyển về vault thanh toán do BIDV quản lý',
];
const OLD_SENTENCES = [
  'Gió An Viên,',
  'Mỗi dự án có token riêng. WPT của Điện gió An Viên đã phát hành trên chuỗi; hai dự án còn lại đang là dữ liệu mẫu.',
  '62 tua-bin tại An Viên quay theo mùa gió',
  'Tiền điện về vault thanh toán SPV',
];

describe('FE-UX-07a nhóm 1: mã nguồn', () => {
  it('sidebar.tsx: đúng một IntroLink, đứng trước ChainSelector', () => {
    const source = flat('src/components/layout/sidebar.tsx');
    expect(source.match(/<IntroLink\b/g)).toHaveLength(1);
    expect(source).toContain('<IntroLink collapsed={collapsed} onNavigate={closeDrawer} />');
    expect(source.indexOf('<IntroLink')).toBeLessThan(source.indexOf('<ChainSelector'));
  });

  it('intro-link.tsx: chỉ hiện với vai vào được khu Nhà đầu tư, kiểm qua can(), không so sánh vai cứng', () => {
    const source = flat('src/components/layout/intro-link.tsx');
    expect(source).toContain('if (!AREA_GATES.investor.some((action) => can(config.role, action))) return null;');
    expect(source).not.toMatch(/role\s*[!=]==?|[!=]==?\s*['"](INVESTOR|SELLER|TELLER|CONTROLLER)['"]/);
  });

  it('intro-link.tsx: không prefetch, trỏ /gioi-thieu, chữ đúng, mũi tên xanh mờ, không aria-current', () => {
    const source = flat('src/components/layout/intro-link.tsx');
    expect(source).toContain('prefetch={false}');
    expect(source).toContain('href="/gioi-thieu"');
    expect(source).toContain('Giới thiệu dự án');
    expect(source).toContain('text-primary/50');
    expect(source).not.toContain('aria-current');
  });

  it('trang, landing-page, turbine-scene dựng ở server; không action, fetch, lenis, khối Sơ đồ', () => {
    for (const file of ['src/app/(public)/gioi-thieu/page.tsx', `${LANDING_DIR}/landing-page.tsx`, `${LANDING_DIR}/turbine-scene.tsx`]) {
      expect(read(file), file).not.toMatch(/['"]use client['"]/);
    }
    for (const file of [...LANDING_FILES, ...ROUTE_FILES]) {
      const source = read(file);
      expect(source, file).not.toContain('Action(');
      expect(source, file).not.toContain('fetch(');
      expect(source, file).not.toMatch(/lenis/i);
      expect(source, file).not.toContain('Sơ đồ trang xem thử');
    }
    const layout = read('src/app/(public)/layout.tsx');
    expect(layout).not.toContain('ChannelGuard');
    expect(layout).not.toContain('AREA_GATES');
  });

  it('câu chữ QĐ-5: có câu MỚI, không còn câu bản chốt tương ứng; mã video khai báo đúng một lần', () => {
    const page = flat(`${LANDING_DIR}/landing-page.tsx`);
    for (const sentence of NEW_SENTENCES) expect(page).toContain(sentence);
    expect(page).toContain('Nền tảng Token hoá dự án điện gió, đầu tư bền vững,');
    expect(page).toContain('lợi tức dài hạn');
    const all = LANDING_FILES.map((file) => flat(file)).join('\n');
    for (const sentence of OLD_SENTENCES) expect(all).not.toContain(sentence);
    const hits = LANDING_FILES.filter((file) => read(file).includes('M52hkUDVe5w'));
    expect(hits).toEqual([`${LANDING_DIR}/landing-data.ts`]);
    expect(read(`${LANDING_DIR}/landing-data.ts`).match(/M52hkUDVe5w/g)).toHaveLength(1);
  });

  it('tệp trong components/landing: không mã màu, không ký tự cấm ngoài chú thích', () => {
    expect(LANDING_FILES.filter((file) => /\.(tsx|ts|module\.css)$/.test(file))).toHaveLength(LANDING_FILES.length);
    for (const file of LANDING_FILES) {
      const lines = read(file).split('\n');
      const colors = lines.filter((line) => !isComment(line) && HARD_COLOR.test(line));
      expect(colors, file).toEqual([]);
      const forbidden = lines.filter((line) => !isComment(line) && FORBIDDEN.test(line));
      expect(forbidden, file).toEqual([]);
    }
  });

  it('globals.css: --lp-deep đúng một lần, trong :root, không trong .dark', () => {
    const css = read('src/app/globals.css');
    expect(css.match(/--lp-deep:/g)).toHaveLength(1);
    const root = css.slice(css.indexOf(':root {'), css.indexOf('.dark {'));
    expect(root).toContain('--lp-deep:');
    const dark = css.slice(css.indexOf('.dark {'), css.indexOf('@layer base'));
    expect(dark).not.toContain('--lp-deep');
  });

  it('landing-chrome.tsx: một trình nghe scroll thụ động, gỡ khi unmount, gom bằng requestAnimationFrame', () => {
    const source = flat(`${LANDING_DIR}/landing-chrome.tsx`);
    expect(source.match(/addEventListener\('scroll'/g)).toHaveLength(1);
    expect(source).toMatch(/addEventListener\('scroll', \w+, \{ passive: true \}\)/);
    expect(source).toContain("removeEventListener('scroll'");
    expect(source).toContain('requestAnimationFrame(');
    expect(source).toContain('cancelAnimationFrame(');
    // QĐ-8: nút về đầu trang lúc ẩn có inert (không bấm được, không nhận Tab).
    expect(source).toContain('inert={!showTop}');
  });
});

describe('FE-UX-07a nhóm 2: LANDING_ROLES và landingChromeState', () => {
  it('bốn vai đúng bảng QĐ-4, đúng thứ tự và chữ', () => {
    expect(LANDING_ROLES.map((role) => [role.channel, role.title, role.cta])).toEqual([
      ['investor', 'Nhà đầu tư', 'Vào khu nhà đầu tư'],
      ['seller', 'Người bán', 'Vào khu người bán'],
      ['teller', 'Giao dịch viên', 'Vào khu vận hành'],
      ['controller', 'Kiểm soát viên', 'Vào khu kiểm soát'],
    ]);
    for (const role of LANDING_ROLES) expect(isChannel(role.channel)).toBe(true);
    expect(LANDING_ROLES.map((role) => CHANNEL_HOME[role.channel])).toEqual(['/portfolio', '/seller', '/', '/']);
  });

  const VIEWPORT = 900;
  type State = { navHidden: boolean; anchorY: number };
  const run = (start: State, ys: number[]) => {
    let state = start;
    return ys.map((y) => {
      const next = landingChromeState({ y, anchorY: state.anchorY, viewportHeight: VIEWPORT, navHidden: state.navHidden });
      state = next;
      return next.navHidden;
    });
  };
  const steps = (from: number, delta: number, count: number) => Array.from({ length: count }, (_, i) => from + delta * (i + 1));

  it('(a), (b) cuộn chậm 2 px mỗi lần: ẩn ở lần thứ 4, rồi cuộn lên hiện ở lần thứ 4', () => {
    const down = run({ navHidden: false, anchorY: 200 }, steps(200, 2, 20));
    expect(down.indexOf(true)).toBe(3);
    expect(down.slice(3).every(Boolean)).toBe(true);
    const up = run({ navHidden: true, anchorY: 240 }, steps(240, -2, 20));
    expect(up.indexOf(false)).toBe(3);
    // Chuỗi nối tiếp thật: trạng thái sau (a) là đầu vào của (b).
    const both = run({ navHidden: false, anchorY: 200 }, [...steps(200, 2, 20), ...steps(240, -2, 20)]);
    expect(both[3]).toBe(true);
    expect(both.slice(20).indexOf(false)).toBe(3);
  });

  it('(c) chưa quá 160 px thì luôn hiện', () => {
    expect(run({ navHidden: false, anchorY: 100 }, steps(100, 2, 30)).some(Boolean)).toBe(false);
  });

  it('(d) đang ẩn ở 900, nhảy về 150 thì hiện', () => {
    expect(run({ navHidden: true, anchorY: 900 }, [150])).toEqual([false]);
  });

  it('(e) dao động 3 px quanh điểm đảo chiều không đổi trạng thái', () => {
    const shown = run({ navHidden: false, anchorY: 400 }, Array.from({ length: 20 }, (_, i) => (i % 2 ? 403 : 400)));
    expect(shown.some(Boolean)).toBe(false);
    const hidden = run({ navHidden: true, anchorY: 400 }, Array.from({ length: 20 }, (_, i) => (i % 2 ? 397 : 400)));
    expect(hidden.every(Boolean)).toBe(true);
  });

  it('(f) nút về đầu trang hiện khi đã quá 80% chiều cao cửa sổ', () => {
    const at = (y: number) => landingChromeState({ y, anchorY: y, viewportHeight: VIEWPORT, navHidden: false }).showTop;
    expect(at(VIEWPORT * 0.8)).toBe(false);
    expect(at(VIEWPORT * 0.8 + 1)).toBe(true);
  });
});

describe('FE-UX-07a nhóm 3: dựng LandingPage', () => {
  const html = renderToStaticMarkup(createElement(LandingPage));
  const text = (fragment: string) => fragment.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const between = (from: string, to: string) => html.slice(html.indexOf(from), html.indexOf(to));

  it('không iframe (máy chủ luôn dựng ảnh nền video); đúng một h1 câu MỚI; 5 h2 đúng thứ tự', () => {
    expect(html).not.toContain('<iframe');
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(text(html.match(/<h1\b[^>]*>(.*?)<\/h1>/s)![1])).toBe(NEW_H1);
    expect([...html.matchAll(/<h2\b[^>]*>(.*?)<\/h2>/gs)].map((m) => text(m[1]))).toEqual([
      'Gió hoá dòng tiền trong năm chặng',
      'Ba dự án điện gió',
      'Một nền tảng, bốn vai',
      'Minh bạch và kiểm soát như ngân hàng',
      'Sẵn sàng xem thử hệ thống?',
    ]);
  });

  it('sáu ô số liệu đọc từ hằng, ô nào cũng có unverified', () => {
    const stats = between('data-kpi=""', 'id="cach-hoat-dong"');
    const kpis = stats.split('data-kpi=""').slice(1).map((kpi) => text(kpi.slice(kpi.indexOf('>') + 1)));
    expect(kpis).toHaveLength(6);
    for (const kpi of kpis) expect(kpi).toContain('unverified');
    const paid = kpis.find((kpi) => kpi.startsWith('Lợi tức đã chia'))!;
    expect(paid).toContain('5,8');
    expect(paid).toContain('6 kỳ');
    const capacity = kpis.find((kpi) => kpi.startsWith('Công suất đặt'))!;
    expect(capacity).toContain('148,2');
    expect(capacity).toContain('82 tua-bin');
  });

  it('ba thẻ dự án đúng thứ tự mock-data; hai dự án mẫu có unverified; An Viên ON-CHAIN', () => {
    const articles = [...html.matchAll(/<article\b.*?<\/article>/gs)].map((m) => text(m[0]));
    expect(articles).toHaveLength(3);
    expect(articles.map((article) => ['Điện gió An Viên', 'Điện gió Phú Quý', 'Điện gió Ninh Thuận'].find((name) => article.includes(name)))).toEqual([
      'Điện gió An Viên',
      'Điện gió Phú Quý',
      'Điện gió Ninh Thuận',
    ]);
    expect(articles[0]).toContain('ON-CHAIN, WPT');
    expect(articles[0]).not.toContain('unverified');
    expect(articles[1]).toContain('unverified');
    expect(articles[2]).toContain('unverified');
  });

  it('khối vai có bốn form, nút đúng chữ LANDING_ROLES', () => {
    const roles = between('id="vai-tro"', 'id="minh-bach"');
    expect(roles.match(/<form\b/g)).toHaveLength(4);
    const buttons = [...roles.matchAll(/<button\b[^>]*type="submit"[^>]*>(.*?)<\/button>/gs)].map((m) => text(m[1]));
    expect(buttons).toEqual(LANDING_ROLES.map((role) => role.cta));
  });

  it('13 ảnh 3D có thật trên đĩa, alt rỗng; không href="#"; neo nào cũng có id', () => {
    const images = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]).filter((tag) => tag.includes('/landing/3d/'));
    expect(images).toHaveLength(13);
    for (const tag of images) {
      expect(tag).toContain('alt=""');
      const src = tag.match(/src="([^"]+)"/)![1];
      expect(existsSync(path.join(APP, 'public', src)), src).toBe(true);
    }
    expect(html).not.toContain('href="#"');
    for (const id of ['du-an', 'cach-hoat-dong', 'vai-tro', 'minh-bach']) {
      expect(html).toContain(`href="#${id}"`);
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).not.toMatch(/[\u00b7\u2014]/);
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
