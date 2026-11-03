import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * FE-UX-01b: khung giao diện. Thanh bên thẻ nổi 270 px, thu gọn 88 px và nhớ lựa chọn; thanh đầu chỉ
 * còn tên màn, "Kết nối ví", nút Sáng Tối; dưới 1100 px thanh bên là ngăn kéo. Chain mock, máy chủ
 * bản build. Mỗi ca chạy trong context mới (không mang `localStorage` của ca khác).
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

/** Nút theme chỉ hiện sau khi hydrate (`useIsMounted`), dùng làm mốc "trang đã chạy JS". */
async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('button[title^="Chuyển sang"]')).toBeVisible();
}

const asideWidth = (page: Page) =>
  page.locator('aside').evaluate((el) => Math.round(el.getBoundingClientRect().width));

test.describe('FE-UX-01b khung giao diện', () => {
  test('ca 1: thanh bên 270 px, thu gọn 88 px, nhớ lựa chọn khi tải lại, không lệch hydrate', async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await actAs(context, baseURL!, 'TELLER');
    const hydration: string[] = [];
    page.on('console', (message) => {
      if (/hydrat/i.test(message.text())) hydration.push(message.text());
    });
    await open(page, '/');
    expect(Math.abs((await asideWidth(page)) - 270)).toBeLessThanOrEqual(2);

    await page.getByRole('button', { name: 'Thu gọn thanh bên', exact: true }).click();
    await expect.poll(() => asideWidth(page)).toBe(88);
    expect(await page.evaluate(() => localStorage.getItem('bidv-rail'))).toBe('1');

    await page.reload();
    await expect(page.locator('button[title^="Chuyển sang"]')).toBeVisible();
    // Lần đo ĐẦU sau khi trang chạy JS: đã là 88 px, không đo dần (hiệu ứng chỉ bật sau lần bấm).
    expect(await asideWidth(page)).toBe(88);
    await expect(page.getByRole('button', { name: 'Mở rộng thanh bên', exact: true })).toBeVisible();
    expect(hydration).toEqual([]);
  });

  test('ca 2: khi thu gọn vẫn giữ tên mục, số việc chờ trong liên kết, ô chọn vai, số liên kết', async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await actAs(context, baseURL!, 'TELLER');
    await open(page, '/');
    const aside = page.locator('aside');
    const expanded = await aside.locator('a').count();

    await page.getByRole('button', { name: 'Thu gọn thanh bên', exact: true }).click();
    await expect.poll(() => asideWidth(page)).toBe(88);
    await expect(aside.getByRole('link', { name: /Lập lệnh/ })).toBeVisible();
    const pending = aside.getByLabel(/việc đang chờ/).first();
    await expect(pending).toBeVisible();
    await expect(pending).toHaveText(/^\d+$/);
    expect(await pending.evaluate((el) => el.closest('a') !== null)).toBe(true);
    await expect(page.locator('#channel-switcher')).toHaveCount(1);
    expect(await page.locator('#channel-switcher').evaluate((el) => el.tagName)).toBe('SELECT');
    await expect(aside.locator('a')).toHaveCount(expanded);
  });

  test('ca 3: tên màn trên thanh đầu là phần tử cuối của breadcrumbs, đúng một h1, header ngoài main', async ({ browser, baseURL }) => {
    for (const [role, path, title] of [
      ['TELLER', '/', 'Tổng quan'],
      ['TELLER', '/draft', 'Lập lệnh'],
      ['INVESTOR', '/portfolio', 'Tổng quan'],
      ['INVESTOR', '/tokens/WPT', 'WPT'],
    ] as const) {
      const context = await browser.newContext();
      await actAs(context, baseURL!, role);
      const page = await context.newPage();
      await open(page, path);
      // Thanh đầu của khung (màn có thể có `header` riêng trong nội dung, ví dụ thẻ ở `/draft`).
      const header = page.locator('header:has(button[title^="Chuyển sang"])');
      await expect(header, path).toHaveCount(1);
      await expect(header.locator('p').first(), path).toHaveText(title);
      await expect(header.getByRole('heading'), path).toHaveCount(0);
      expect(await header.evaluate((el) => el.closest('main') === null), path).toBe(true);
      await expect(page.locator('h1'), path).toHaveCount(1);
      await expect(page.locator('main h1'), path).toHaveCount(1);
      await context.close();
    }
  });

  test('ca 4: 390 px, ngăn kéo mở bằng nút menu, đóng bằng Esc, lớp phủ, mục menu; không tràn ngang', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await actAs(context, baseURL!, 'TELLER');
    const page = await context.newPage();
    await open(page, '/');
    const aside = page.locator('aside');
    const menu = page.getByRole('button', { name: 'Mở menu' });

    await expect(aside).toBeHidden();
    await expect(page.locator('button[title^="Chuyển sang"]')).toBeVisible();
    expect(await aside.evaluate((el) => el.hasAttribute('inert'))).toBe(true);

    await menu.click();
    await expect(aside).toBeVisible();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('button', { name: 'Đóng menu' })).toBeFocused();
    expect(await page.locator('main').evaluate((el) => el.hasAttribute('inert'))).toBe(true);
    expect(await page.locator('header').evaluate((el) => el.hasAttribute('inert'))).toBe(true);

    await page.keyboard.press('Escape');
    await expect(aside).toBeHidden();
    await expect(menu).toBeFocused();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(await page.locator('main').evaluate((el) => el.hasAttribute('inert'))).toBe(false);

    await menu.click();
    await expect(aside).toBeVisible();
    // Lớp phủ phủ cả màn; bấm vào phần không bị thanh bên che (bên phải).
    await page.locator('[data-shell-overlay]').click({ position: { x: 370, y: 420 } });
    await expect(aside).toBeHidden();

    await menu.click();
    await aside.getByRole('link', { name: /Lập lệnh/ }).click();
    await expect(page).toHaveURL(/\/draft$/);
    await expect(aside).toBeHidden();
    await context.close();

    for (const [role, path] of [
      ['TELLER', '/'],
      ['TELLER', '/draft'],
      ['CONTROLLER', '/approvals'],
      ['INVESTOR', '/portfolio'],
      ['SELLER', '/seller'],
    ] as const) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await actAs(ctx, baseURL!, role);
      const p = await ctx.newPage();
      await open(p, path);
      await p.waitForLoadState('networkidle');
      expect(await p.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(390);
      await ctx.close();
    }
  });

  test('ca 5: ô chọn vai và chain là select gốc trong thanh bên; đổi vai chạy như cũ', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'TELLER');
    await open(page, '/');
    const aside = page.getByRole('complementary');
    for (const id of ['#channel-switcher', '#chain-selector']) {
      await expect(aside.locator(id), id).toHaveCount(1);
      expect(await page.locator(id).evaluate((el) => el.tagName), id).toBe('SELECT');
    }
    await page.locator('#channel-switcher').selectOption('investor');
    await expect(page).toHaveURL(/\/portfolio$/);
    await expect(aside).toContainText('vai trò INVESTOR');
    await expect(aside).toContainText('Giao dịch token');
  });

  test('ca 6: công tắc Lưu ký có ở Giao dịch viên kèm ghi chú, không có ở Nhà đầu tư', async ({ browser, baseURL }) => {
    const teller = await browser.newContext();
    await actAs(teller, baseURL!, 'TELLER');
    const page = await teller.newPage();
    await open(page, '/');
    const toggle = page.getByRole('complementary').getByRole('switch', { name: 'Lưu ký Fireblocks' });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    // Máy chủ e2e không cấu hình Fireblocks: công tắc khoá, gợi ý đúng câu của `CustodyToggle`.
    await expect(toggle).toBeDisabled();
    await expect(toggle).toHaveAttribute('title', 'Chưa cấu hình Fireblocks');
    // Không đặt `FIREBLOCKS_CHAIN_ASSETS` thì bảng chain rỗng: đúng một câu của `custodyNotes`.
    const notes = page.locator('#custody-toggle-notes');
    await expect(toggle).toHaveAttribute('aria-describedby', 'custody-toggle-notes');
    await expect(notes.locator('p')).toHaveText(['Không áp dụng cho chain này']);
    await expect(notes).toBeVisible();
    await teller.close();

    const investor = await browser.newContext();
    await actAs(investor, baseURL!, 'INVESTOR');
    const p = await investor.newPage();
    await open(p, '/portfolio');
    await expect(p.getByRole('switch', { name: 'Lưu ký Fireblocks' })).toHaveCount(0);
    await investor.close();
  });
});
