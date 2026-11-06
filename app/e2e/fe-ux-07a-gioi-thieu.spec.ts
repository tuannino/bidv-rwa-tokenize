import { gzipSync } from 'node:zlib';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * FE-UX-07a: trang giới thiệu công khai `/gioi-thieu`, nút về đầu trang, liên kết "Giới thiệu dự án" trên
 * thanh bên Nhà đầu tư (design mục 3). Chỉ chạy project `mock`; không đổi dữ liệu nghiệp vụ. Mọi ca chặn
 * video (YouTube) để không phụ thuộc mạng ngoài; lỗi console chỉ tính thông điệp của khung chính.
 */

const NEW_H1 = 'Nền tảng Token hoá dự án điện gió, đầu tư bền vững, lợi tức dài hạn';
const VIDEO = /youtube|ytimg|googlevideo/;

/** Chặn video, đếm mọi yêu cầu tới YouTube (đếm trước khi chặn, tính cả yêu cầu bị chặn). */
async function blockVideo(context: BrowserContext) {
  const seen = { count: 0 };
  await context.route(VIDEO, (route) => {
    seen.count++;
    return route.abort();
  });
  return seen;
}

/** Lỗi console của khung chính, `pageerror`, và thông điệp nhắc tới hydrate. */
function watchErrors(page: Page, baseURL: string) {
  const errors = { console: [] as string[], page: [] as string[], hydration: [] as string[] };
  page.on('console', (message) => {
    if (/hydrat/i.test(message.text())) errors.hydration.push(message.text());
    if (message.type() === 'error' && message.location().url.startsWith(baseURL)) errors.console.push(message.text());
  });
  page.on('pageerror', (error) => errors.page.push(error.message));
  return errors;
}

async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

async function openLanding(page: Page) {
  const response = await page.goto('/gioi-thieu');
  await settle(page);
  return response;
}

const nextFrame = (page: Page) => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
const opacity = (page: Page, selector: string) =>
  page.locator(selector).evaluate((element) => Number(getComputedStyle(element).opacity));
const toTop = (page: Page) => page.getByRole('button', { name: 'Về đầu trang' });

async function actAs(context: BrowserContext, baseURL: string, channel: string, role: string) {
  await context.addCookies([
    { name: 'bidv_channel', value: channel, url: baseURL },
    { name: 'bidv_role', value: role, url: baseURL },
  ]);
}

test.describe('FE-UX-07a trang giới thiệu', () => {
  test('ca 1: công khai, không thanh bên, không gọi server action khi mở, không lỗi', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
    await blockVideo(context);
    const page = await context.newPage();
    const errors = watchErrors(page, baseURL!);
    let actions = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.headers()['next-action']) actions++;
    });

    const response = await openLanding(page);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText(NEW_H1);
    await expect(page.locator('#app-sidebar')).toHaveCount(0);
    await expect(page.locator('[data-page-enter]')).toHaveCount(0);
    expect(actions).toBe(0);
    expect(errors).toEqual({ console: [], page: [], hydration: [] });
    await context.close();
  });

  test('ca 2: thanh trên cùng mép khung nội dung; neo không bị che; ẩn khi cuộn xuống chậm, hiện khi cuộn lên', async ({
    page,
    context,
  }) => {
    await blockVideo(context);
    const header = page.locator('header');
    for (const width of [1440, 1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await openLanding(page);
      const bar = (await header.boundingBox())!;
      const frame = (await page.locator('h2').first().locator('xpath=..').boundingBox())!;
      expect(Math.abs(bar.x - frame.x), `${width} mép trái`).toBeLessThanOrEqual(1);
      expect(Math.abs(bar.x + bar.width - (frame.x + frame.width)), `${width} mép phải`).toBeLessThanOrEqual(1);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await openLanding(page);
    await page.getByRole('navigation', { name: 'Mục trang chủ' }).getByRole('link', { name: 'Dự án' }).click();
    // Chờ cuộn mượt dừng hẳn.
    let last = -1;
    await expect
      .poll(async () => {
        const y = await page.evaluate(() => window.scrollY);
        const still = y === last && y > 0;
        last = y;
        return still;
      })
      .toBe(true);
    const barBottom = await header.evaluate((element) => element.getBoundingClientRect().bottom);
    const sectionTop = await page.locator('#du-an').evaluate((element) => element.getBoundingClientRect().top);
    expect(sectionTop).toBeGreaterThanOrEqual(barBottom);

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await nextFrame(page);
    await page.mouse.move(720, 450);
    for (let i = 0; i < 450; i++) {
      await page.mouse.wheel(0, 2);
      await nextFrame(page);
    }
    await expect.poll(() => opacity(page, 'header')).toBe(0);
    for (let i = 0; i < 20; i++) {
      await page.mouse.wheel(0, -2);
      await nextFrame(page);
    }
    await expect.poll(() => opacity(page, 'header')).toBe(1);
    await expect.poll(() => header.evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
  });

  test('ca 3: nút về đầu trang ẩn ở đầu trang, hiện mờ sau 80% cửa sổ, nằm trong lề phải, bấm thì về đầu', async ({
    page,
    context,
  }) => {
    await blockVideo(context);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openLanding(page);
    const button = toTop(page);
    const sel = 'button[aria-label="Về đầu trang"]';

    await expect.poll(() => opacity(page, sel)).toBe(0);
    await expect(button).toHaveAttribute('inert', '');
    const focusables = await page.evaluate(() => document.querySelectorAll('a[href], button').length);
    for (let i = 0; i < focusables + 2; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).not.toBe('Về đầu trang');
    }

    await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 0.8 + 300, behavior: 'instant' }));
    await expect.poll(() => button.evaluate((element) => element.hasAttribute('inert'))).toBe(false);
    await expect.poll(() => opacity(page, sel)).toBeGreaterThanOrEqual(0.5);
    expect(await opacity(page, sel)).toBeLessThanOrEqual(0.7);
    await button.hover();
    await expect.poll(() => opacity(page, sel)).toBe(1);

    const box = (await button.boundingBox())!;
    const frame = (await page.locator('h2').first().locator('xpath=..').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(frame.x + frame.width + 8);
    expect(1440 - (box.x + box.width)).toBeGreaterThanOrEqual(12);

    await button.click();
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 3000 }).toBe(0);
    expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toBe('BIDV RWA Tokenize Platform');

    await page.setViewportSize({ width: 390, height: 844 });
    await openLanding(page);
    await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 0.8 + 300, behavior: 'instant' }));
    await expect.poll(() => button.evaluate((element) => element.hasAttribute('inert'))).toBe(false);
    // Chờ hết 300 ms dịch lên khi hiện.
    await expect.poll(async () => Math.abs((await button.boundingBox())!.y - 84)).toBeLessThanOrEqual(1);
    const small = (await button.boundingBox())!;
    expect(small.x).toBeGreaterThanOrEqual(0);
    expect(small.x + small.width).toBeLessThanOrEqual(390);
  });

  test('ca 4: mỗi nút vào đúng khu vực, đặt đúng hai cookie', async ({ browser, baseURL }) => {
    const cases = [
      { scope: '#vai-tro', name: 'Vào khu nhà đầu tư', path: '/portfolio', channel: 'investor', role: 'INVESTOR' },
      { scope: '#vai-tro', name: 'Vào khu người bán', path: '/seller', channel: 'seller', role: 'SELLER' },
      { scope: '#vai-tro', name: 'Vào khu vận hành', path: '/', channel: 'teller', role: 'TELLER' },
      { scope: '#vai-tro', name: 'Vào khu kiểm soát', path: '/', channel: 'controller', role: 'CONTROLLER' },
      { scope: 'header', name: 'Vào hệ thống', path: '/', channel: 'teller', role: 'TELLER' },
      { scope: 'main section:first-of-type', name: 'Tôi là nhà đầu tư', path: '/portfolio', channel: 'investor', role: 'INVESTOR' },
    ];
    for (const item of cases) {
      const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
      await blockVideo(context);
      const page = await context.newPage();
      await openLanding(page);
      await page.locator(item.scope).getByRole('button', { name: item.name, exact: true }).click();
      await page.waitForURL((url) => url.pathname === item.path);
      if (item.path === '/portfolio') await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tổng quan nhà đầu tư');
      const cookies = Object.fromEntries((await context.cookies()).map((cookie) => [cookie.name, cookie.value]));
      expect(cookies.bidv_channel, item.name).toBe(item.channel);
      expect(cookies.bidv_role, item.name).toBe(item.role);
      await context.close();
    }
  });

  test('ca 5: không cuộn ngang, không lỗi ở ba bề rộng hai giao diện; video theo chế độ chuyển động; JS không vượt /account', async ({
    browser,
    baseURL,
  }) => {
    for (const theme of ['light', 'dark']) {
      for (const width of [1440, 1100, 390]) {
        const context = await browser.newContext({ baseURL, viewport: { width, height: 900 } });
        await blockVideo(context);
        await context.addInitScript((value) => {
          try {
            localStorage.setItem('theme', value);
          } catch {}
        }, theme);
        const page = await context.newPage();
        const errors = watchErrors(page, baseURL!);
        await openLanding(page);
        const overflow = await page.evaluate(() => {
          const root = document.scrollingElement!;
          return root.scrollWidth - root.clientWidth;
        });
        expect(overflow, `${theme} ${width}`).toBeLessThanOrEqual(0);
        expect(errors.console, `${theme} ${width}`).toEqual([]);
        expect(errors.page, `${theme} ${width}`).toEqual([]);
        await context.close();
      }
    }

    const normal = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
    await blockVideo(normal);
    const normalPage = await normal.newPage();
    await openLanding(normalPage);
    await expect(normalPage.locator('iframe[src*="youtube-nocookie.com/embed/M52hkUDVe5w"]')).toHaveCount(1);
    await normal.close();

    const reduced = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const seen = await blockVideo(reduced);
    const reducedPage = await reduced.newPage();
    await reducedPage.goto('/gioi-thieu');
    await reducedPage.waitForLoadState('networkidle');
    await reducedPage.waitForTimeout(2000);
    expect(seen.count).toBe(0);
    await expect(reducedPage.locator('iframe')).toHaveCount(0);
    const play = reducedPage.getByRole('button', { name: 'Phát video giới thiệu dự án điện gió' });
    await expect(play).toBeVisible();
    await play.click();
    await expect(reducedPage.locator('iframe[src*="youtube-nocookie.com/embed/M52hkUDVe5w"]')).toHaveCount(1);
    await expect.poll(() => seen.count).toBeGreaterThan(0);
    await reduced.close();

    const scriptGzip = async (path: string, cookies: boolean) => {
      const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
      await blockVideo(context);
      if (cookies) await actAs(context, baseURL!, 'investor', 'INVESTOR');
      await context.addInitScript(() => {
        try {
          localStorage.setItem('theme', 'light');
        } catch {}
      });
      const page = await context.newPage();
      const bodies: Promise<number>[] = [];
      page.on('response', (response) => {
        if (response.request().resourceType() === 'script') {
          bodies.push(response.body().then((body) => gzipSync(body).length, () => 0));
        }
      });
      await page.goto(path);
      await settle(page);
      const total = (await Promise.all(bodies)).reduce((sum, size) => sum + size, 0);
      await context.close();
      return total;
    };
    const landing = await scriptGzip('/gioi-thieu', false);
    const account = await scriptGzip('/account', true);
    console.log(`FE-UX-07a JS gzip: /gioi-thieu ${landing} B, /account ${account} B`);
    expect(landing).toBeLessThanOrEqual(account);
  });

  test('ca 6: liên kết "Giới thiệu dự án" chỉ ở thanh bên Nhà đầu tư, trên ô chain, thu gọn còn biểu tượng', async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
    await blockVideo(context);
    await actAs(context, baseURL!, 'investor', 'INVESTOR');
    const page = await context.newPage();
    await page.goto('/portfolio');
    await settle(page);
    const aside = page.locator('aside');
    const link = aside.getByRole('link', { name: 'Giới thiệu dự án' });
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute('href', '/gioi-thieu');
    await expect(page.locator('aside nav a[href="/gioi-thieu"]')).toHaveCount(0);
    const linkBox = (await link.boundingBox())!;
    const chainBox = (await aside.locator('label[for="chain-selector"]').boundingBox())!;
    expect(linkBox.y + linkBox.height).toBeLessThan(chainBox.y);

    await page.getByRole('button', { name: 'Thu gọn thanh bên' }).click();
    await expect(aside).toHaveAttribute('data-rail', 'collapsed');
    await expect(link).toHaveCount(1);
    await expect.poll(async () => (await link.boundingBox())!.width).toBeLessThanOrEqual(64);
    await page.getByRole('button', { name: 'Mở rộng thanh bên', exact: true }).click();

    await link.click();
    await page.waitForURL((url) => url.pathname === '/gioi-thieu');
    await expect(page.locator('h1')).toHaveText(NEW_H1);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/portfolio');
    await settle(page);
    await page.getByRole('button', { name: 'Mở menu' }).click();
    await aside.getByRole('link', { name: 'Giới thiệu dự án' }).click();
    await page.waitForURL((url) => url.pathname === '/gioi-thieu');
    await expect(page.locator('h1')).toHaveText(NEW_H1);
    await context.close();

    for (const [channel, role, path] of [
      ['teller', 'TELLER', '/'],
      ['controller', 'CONTROLLER', '/approvals'],
      ['seller', 'SELLER', '/seller'],
    ]) {
      const other = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
      await actAs(other, baseURL!, channel, role);
      const otherPage = await other.newPage();
      await otherPage.goto(path);
      await settle(otherPage);
      await expect(otherPage.locator('aside'), role).toHaveCount(1);
      await expect(otherPage.locator('aside a[href="/gioi-thieu"]'), role).toHaveCount(0);
      await other.close();
    }
  });
});
