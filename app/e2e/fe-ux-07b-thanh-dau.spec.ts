import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * FE-UX-07b: thanh đầu theo bản chốt, nhãn chain "Private Chain" (design mục 3). Chỉ project `mock`; không
 * đổi dữ liệu. Ca cuộn dùng `/vault` của Giao dịch viên: ở 1440 px `/transactions` không cuộn được (nội
 * dung ngắn hơn cửa sổ), `/approvals` chỉ cuộn được khoảng 380 px; `/vault` cuộn được hơn 600 px.
 */

const SCROLL_PAGE = '/vault';

async function actAs(context: BrowserContext, baseURL: string, channel: string, role: string) {
  await context.addCookies([
    { name: 'bidv_channel', value: channel, url: baseURL },
    { name: 'bidv_role', value: role, url: baseURL },
  ]);
}

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('button[title^="Chuyển sang"]')).toBeVisible();
  await page.waitForTimeout(1000);
}

const bar = (page: Page) => page.locator('header:has(button[title^="Chuyển sang"])');
const hp = (page: Page) => bar(page).evaluate((el) => Number.parseFloat(getComputedStyle(el).getPropertyValue('--hp')));
const scrollTo = (page: Page, y: number) =>
  bar(page).evaluate((el, top) => {
    el.parentElement!.scrollTop = top;
    return el.parentElement!.scrollTop;
  }, y);
const css = (page: Page, selector: string, prop: string) =>
  bar(page).locator(selector).first().evaluate((el, name) => getComputedStyle(el).getPropertyValue(name), prop);

test.describe('FE-UX-07b thanh đầu', () => {
  test('ca 1: hình học trùng khung nội dung ở 1440, 1100, 1099, 390 px; dính cách đỉnh khi cuộn', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'teller', 'TELLER');
    for (const width of [1440, 1100, 1099, 390]) {
      const wide = width >= 1100;
      await page.setViewportSize({ width, height: 900 });
      await open(page, SCROLL_PAGE);
      const geometry = await bar(page).evaluate((el) => {
        const r = el.getBoundingClientRect();
        const main = document.querySelector('main')!;
        const m = main.getBoundingClientRect();
        const s = getComputedStyle(main);
        return {
          left: r.left,
          right: r.right,
          height: r.height,
          radius: getComputedStyle(el).borderTopLeftRadius,
          contentLeft: m.left + parseFloat(s.paddingLeft),
          contentRight: m.right - parseFloat(s.paddingRight),
        };
      });
      expect(Math.abs(geometry.left - geometry.contentLeft), `${width} trái`).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.right - geometry.contentRight), `${width} phải`).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.height - (wide ? 44 : 46)), `${width} cao`).toBeLessThanOrEqual(1);
      expect(geometry.radius, `${width} bo`).toBe(wide ? '18px' : '16px');
      expect(await scrollTo(page, 600), `${width} cuộn được 600 px`).toBeGreaterThanOrEqual(600);
      await expect.poll(async () => Math.abs((await bar(page).boundingBox())!.y - (wide ? 10 : 8))).toBeLessThanOrEqual(1);
    }
  });

  test('ca 2: hai trạng thái theo --hp, Sáng và Tối; 390 px Sáng ở đầu trang nền 4%', async ({ browser, baseURL }) => {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
      await actAs(context, baseURL!, 'teller', 'TELLER');
      await context.addInitScript((value) => {
        try {
          localStorage.setItem('theme', value);
        } catch {}
      }, theme);
      const page = await context.newPage();
      await open(page, SCROLL_PAGE);
      expect(await hp(page), theme).toBe(0);
      expect(await css(page, 'p', 'opacity'), theme).toBe('0');
      expect(await css(page, '[data-horizon]', 'opacity'), theme).toBe('0');

      await scrollTo(page, 500);
      await expect.poll(() => hp(page)).toBe(1);
      await expect(bar(page)).toHaveAttribute('data-on', '');
      expect(await css(page, 'p', 'opacity')).toBe('1');
      expect(await css(page, 'p', 'color')).toBe('rgb(255, 255, 255)');
      expect(await css(page, 'p', 'font-size')).toBe('14px');
      expect(await css(page, 'p', 'font-weight')).toBe('700');
      expect(await css(page, '[data-header-bg]', 'background-color')).toBe(theme === 'dark' ? 'rgba(2, 30, 29, 0.92)' : 'rgba(3, 46, 45, 0.9)');
      expect(await css(page, '[data-header-bg]', 'opacity')).toBe('1');

      await scrollTo(page, 0);
      await expect.poll(() => hp(page)).toBe(0);
      await context.close();
    }

    const narrow = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
    await actAs(narrow, baseURL!, 'teller', 'TELLER');
    const page = await narrow.newPage();
    await open(page, SCROLL_PAGE);
    expect(Math.abs(Number(await css(page, '[data-header-bg]', 'opacity')) - 0.04 / 0.9)).toBeLessThanOrEqual(0.01);
    await narrow.close();
  });

  test('ca 3: giảm chuyển động thì --hp nhảy thẳng, đường chân trời đứng yên', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await actAs(context, baseURL!, 'teller', 'TELLER');
    const page = await context.newPage();
    await open(page, SCROLL_PAGE);
    await scrollTo(page, 500);
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    expect(await hp(page)).toBe(1);
    const animation = await bar(page)
      .locator('[data-horizon]')
      .evaluate((el) => getComputedStyle(el, '::after').animationName);
    expect(animation).toBe('none');
    await context.close();
  });

  test('ca 4: nút ví, nút Sáng Tối, hộp thoại RainbowKit; logo nhỏ dưới 1100 px mờ dần, không chồng tên màn', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'teller', 'TELLER');
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, SCROLL_PAGE);
    const wallet = bar(page).getByRole('button', { name: 'Kết nối ví' });
    const walletBox = (await wallet.boundingBox())!;
    expect(Math.abs(walletBox.height - 30)).toBeLessThanOrEqual(1);
    expect(await wallet.evaluate((el) => getComputedStyle(el).fontSize)).toBe('13px');
    const themeBox = (await bar(page).locator('button[title^="Chuyển sang"]').boundingBox())!;
    expect(Math.round(themeBox.width)).toBe(30);
    expect(Math.round(themeBox.height)).toBe(30);

    await wallet.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, SCROLL_PAGE);
    const small = bar(page).getByRole('button', { name: 'Kết nối ví' });
    expect(Math.abs((await small.boundingBox())!.width - 38)).toBeLessThanOrEqual(1);

    const logo = bar(page).getByRole('img', { name: 'BIDV' });
    const logoOpacity = () => logo.evaluate((el) => Number(getComputedStyle(el.parentElement!).opacity));
    await expect(logo).toHaveCount(1);
    expect(await logoOpacity()).toBe(1);
    await scrollTo(page, 500);
    await expect.poll(() => hp(page)).toBe(1);
    expect(await logoOpacity()).toBe(0);
    const a = (await logo.boundingBox())!;
    const b = (await bar(page).locator('p').first().boundingBox())!;
    const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    expect(overlap).toBe(false);
  });

  test('ca 5: nhãn "Private Chain"; năm màn không lỗi ở 1440 và 390 px', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
    await actAs(context, baseURL!, 'teller', 'TELLER');
    const page = await context.newPage();
    await open(page, '/');
    await expect(page.locator('#chain-selector option[value="hardhat-local"]')).toHaveText('Private Chain');
    // Nhãn cũ ghép từ mảnh để lệnh kiểm tasks 6f (tìm chữ này ở dòng thêm mới) không bắt nhầm phép kiểm.
    const oldLabel = ['Hardhat', 'Local'].join(' ');
    expect(await page.evaluate((text) => document.body.innerHTML.includes(text), oldLabel)).toBe(false);
    await context.close();

    for (const width of [1440, 390]) {
      for (const [channel, role, path] of [
        ['teller', 'TELLER', '/'],
        ['investor', 'INVESTOR', '/portfolio'],
        ['seller', 'SELLER', '/seller'],
        ['controller', 'CONTROLLER', '/approvals'],
        ['investor', 'INVESTOR', '/wallet'],
      ]) {
        const ctx = await browser.newContext({ baseURL, viewport: { width, height: 900 } });
        await actAs(ctx, baseURL!, channel, role);
        const p = await ctx.newPage();
        const errors: string[] = [];
        p.on('console', (message) => {
          if (message.type() === 'error' || /hydrat/i.test(message.text())) errors.push(message.text());
        });
        p.on('pageerror', (error) => errors.push(error.message));
        await open(p, path);
        expect(errors, `${width} ${path}`).toEqual([]);
        await ctx.close();
      }
    }
  });
});
