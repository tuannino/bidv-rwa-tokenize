import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * FE-UX-01a: nền giao diện. Mặc định Sáng, token màu, font Roboto và Roboto Condensed (`font-code`),
 * độ bo của thành phần nền, không còn `font-mono` ngoài khung. Chain mock, máy chủ bản build.
 * Mỗi ca chạy trong context mới của Playwright nên không mang theo lựa chọn theme của ca khác.
 */
type Role = 'TELLER' | 'CONTROLLER' | 'INVESTOR' | 'SELLER';

const CHANNEL: Record<Role, string> = {
  TELLER: 'teller',
  CONTROLLER: 'controller',
  INVESTOR: 'investor',
  SELLER: 'seller',
};

async function actAs(context: BrowserContext, baseURL: string, role: Role) {
  await context.addCookies([
    { name: 'bidv_channel', value: CHANNEL[role], url: baseURL },
    { name: 'bidv_role', value: role, url: baseURL },
  ]);
}

/** Mở màn và chờ tiêu đề chính hiện, tức trang đã vẽ xong phần nội dung. */
async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
}

const bodyBackground = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const htmlHasDark = (page: Page) => page.evaluate(() => document.documentElement.classList.contains('dark'));

test.describe('FE-UX-01a nền giao diện', () => {
  test('ca 1: mở lần đầu ra giao diện Sáng', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'TELLER');
    await open(page, '/');
    expect(await htmlHasDark(page)).toBe(false);
    expect(await bodyBackground(page)).toBe('rgb(239, 244, 244)');
  });

  test('ca 2: bấm đổi sang Tối, tải lại vẫn Tối', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'TELLER');
    await open(page, '/');
    await page.locator('button[title^="Chuyển sang"]').click();
    await expect.poll(() => htmlHasDark(page)).toBe(true);
    expect(await bodyBackground(page)).toBe('rgb(8, 15, 15)');
    await page.reload();
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
    expect(await htmlHasDark(page)).toBe(true);
    expect(await bodyBackground(page)).toBe('rgb(8, 15, 15)');
  });

  test('ca 3: chữ dùng Roboto, font nạp thật', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'TELLER');
    await open(page, '/');
    const result = await page.evaluate(async () => {
      await document.fonts.ready;
      // Tên họ font do next/font sinh, đọc từ biến --font-roboto (phần tử đầu, bỏ dấu nháy).
      const variable = getComputedStyle(document.documentElement).getPropertyValue('--font-roboto');
      const family = variable.split(',')[0].trim().replace(/^["']|["']$/g, '');
      await document.fonts.load(`500 14px "${family}"`);
      return {
        bodyFont: getComputedStyle(document.body).fontFamily,
        family,
        loaded: document.fonts.check(`500 14px "${family}"`),
      };
    });
    expect(result.family).toContain('Roboto');
    expect(result.bodyFont).toContain('Roboto');
    expect(result.bodyFont).not.toContain('Condensed');
    expect(result.bodyFont.startsWith(`"${result.family}"`) || result.bodyFont.startsWith(result.family)).toBe(true);
    expect(result.loaded).toBe(true);
  });

  test('ca 4: lớp font-code dùng Roboto Condensed và có trong CSS xuất ra', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'TELLER');
    await open(page, '/kyc');
    const code = page.getByRole('main').locator('.font-code').first();
    await expect(code).toHaveText('/mint');
    expect(await code.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Condensed');
    // Tailwind đặt lớp tiện ích trong `@layer utilities` nên phải tìm cả quy tắc lồng bên trong.
    const hasRule = await page.evaluate(() => {
      const found = (rules: CSSRuleList): boolean =>
        Array.from(rules).some((rule) =>
          rule instanceof CSSStyleRule
            ? rule.selectorText === '.font-code'
            : rule instanceof CSSGroupingRule && found(rule.cssRules),
        );
      return Array.from(document.styleSheets).some((sheet) => {
        try {
          return found(sheet.cssRules);
        } catch {
          return false;
        }
      });
    });
    expect(hasRule).toBe(true);
  });

  test('ca 5: Card bo 22 px, Button bo tròn hoàn toàn với nền xanh ngọc', async ({ page, context, baseURL }) => {
    // Màn `/` không dùng Card hay Button của components/ui (thẻ số liệu và nút "Phát hành WPT" là
    // phần tử riêng của màn), nên kiểm trên `/draft` của cùng vai: có Card và nút chính "Gửi duyệt".
    await actAs(context, baseURL!, 'TELLER');
    await open(page, '/draft');
    const card = page.getByRole('main').locator('[data-slot="card"]').first();
    await expect(card).toBeVisible();
    expect(await card.evaluate((el) => getComputedStyle(el).borderRadius)).toBe('22px');

    const primary = page.getByRole('main').locator('[data-slot="button"].bg-primary').first();
    await expect(primary).toBeVisible();
    const button = await primary.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        radius: parseFloat(style.borderTopLeftRadius),
        height: el.getBoundingClientRect().height,
        background: style.backgroundColor,
      };
    });
    expect(button.height).toBeGreaterThan(0);
    expect(button.radius).toBeGreaterThanOrEqual(button.height / 2);
    expect(button.background).toBe('rgb(23, 110, 109)');
  });

  test('ca 6: không còn font-mono ngoài thanh bên ở 4 màn', async ({ browser, baseURL }) => {
    for (const [path, role] of [
      ['/', 'TELLER'],
      ['/portfolio', 'INVESTOR'],
      ['/approvals', 'CONTROLLER'],
      ['/seller', 'SELLER'],
    ] as const) {
      const context = await browser.newContext();
      await actAs(context, baseURL!, role);
      const page = await context.newPage();
      await open(page, path);
      // Chờ phần đọc dữ liệu sau hydrate vẽ xong để đếm cả phần tử hiện muộn.
      await page.waitForLoadState('networkidle');
      const counts = await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('.font-mono'));
        return { outside: all.filter((el) => !el.closest('aside')).length, total: all.length };
      });
      expect(counts.outside, path).toBe(0);
      // Màn đã vẽ đủ: có ít nhất một phần tử dùng lớp mới.
      expect(await page.locator('.tabular-nums, .font-code').count(), path).toBeGreaterThan(0);
      await context.close();
    }
  });
});
