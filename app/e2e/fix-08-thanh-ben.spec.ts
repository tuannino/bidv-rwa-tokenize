import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * FIX-08: thanh bên sáng đúng một mục (mục khớp đường dẫn dài nhất); chữ khung bỏ ký tự cấm. Chỉ chạy trên
 * project `mock`; không đổi dữ liệu. Mục sáng đếm bằng `aside nav a[aria-current="page"]`.
 */

type Role = 'INVESTOR' | 'SELLER' | 'TELLER';

async function actAs(context: BrowserContext, baseURL: string, role: Role) {
  await context.addCookies([
    { name: 'bidv_channel', value: role.toLowerCase(), url: baseURL },
    { name: 'bidv_role', value: role, url: baseURL },
  ]);
}

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

const lit = (page: Page) => page.locator('aside nav a[aria-current="page"]');

/** Mỗi liên kết trong menu: có `aria-current` không, có đúng lớp nền chính (so cả tên lớp qua `classList`) không. */
const primaryFlags = (page: Page) =>
  page.locator('aside nav a').evaluateAll((links) =>
    links.map((link) => ({ current: link.getAttribute('aria-current') === 'page', primary: link.classList.contains('bg-primary') })),
  );

test.describe('FIX-08 thanh bên sáng đúng một mục', () => {
  test('ca 1: Người bán ba màn sáng đúng mục của màn; 390 px ngăn kéo cũng đúng một mục', async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await actAs(context, baseURL!, 'SELLER');
    for (const [path, label] of [
      ['/seller', 'Tổng quan'],
      ['/seller/transactions', 'Danh sách giao dịch'],
      ['/seller/withdraw', 'Tạo lệnh rút'],
    ] as const) {
      await open(page, path);
      await expect(lit(page), path).toHaveCount(1);
      await expect(lit(page).locator('[data-nav-label]'), path).toHaveText(label);
      const flags = await primaryFlags(page);
      for (const flag of flags) expect(flag.primary, path).toBe(flag.current);
    }

    await page.setViewportSize({ width: 390, height: 900 });
    await open(page, '/seller/withdraw');
    await page.getByRole('button', { name: 'Mở menu' }).click();
    await expect(page.locator('aside')).toBeVisible();
    await expect(lit(page)).toHaveCount(1);
    await expect(lit(page).locator('[data-nav-label]')).toHaveText('Tạo lệnh rút');
  });

  test('ca 2: Giao dịch viên /, /transactions, chi tiết giao dịch; Nhà đầu tư /tokens/WPT không mục nào sáng', async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await actAs(context, baseURL!, 'TELLER');
    for (const [path, href] of [
      ['/', '/'],
      ['/transactions', '/transactions'],
      ['/transactions/khong-co', '/transactions'],
    ] as const) {
      await open(page, path);
      await expect(lit(page), path).toHaveCount(1);
      await expect(lit(page), path).toHaveAttribute('href', href);
    }
    await expect(page.locator('aside nav a').first()).toHaveAttribute('href', '/');

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await actAs(ctx, baseURL!, 'INVESTOR');
    const p = await ctx.newPage();
    await open(p, '/tokens/WPT');
    await expect(p.locator('aside nav a')).not.toHaveCount(0);
    await expect(lit(p)).toHaveCount(0);
    await ctx.close();
  });

  test('ca 3: chữ ô chọn vai và ô chọn chain không còn ký tự cấm', async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await actAs(context, baseURL!, 'TELLER');
    await open(page, '/transactions');
    const channels = page.locator('#channel-switcher option');
    await expect(channels).toHaveText([
      'Nhà đầu tư (NDT001)',
      'Người bán (NB001)',
      'Giao dịch viên (GDV001)',
      'Kiểm soát viên (KSV001)',
    ]);
    const texts = [
      ...(await channels.allTextContents()),
      ...(await page.locator('#chain-selector option').allTextContents()),
    ];
    for (const text of texts) expect(text, text).not.toMatch(/[\u00b7\u2014]/);
    const stellar = page.locator('#chain-selector option[value="stellar"]');
    await expect(stellar).toBeDisabled();
    expect((await stellar.textContent())!.endsWith(': chưa dùng được')).toBe(true);
  });
});
