import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * FE-UX-04a: Tổng quan nhà đầu tư (`/portfolio`) và Chi tiết token (`/tokens/[symbol]`). Chỉ chạy trên project
 * `mock` (không có trong `testMatch` của project `hardhat`), vai Nhà đầu tư; không đặt lệnh, không đổi dữ liệu.
 *
 * Trên mock, Tổng quan không có ví trình duyệt (Tài sản, Giao dịch ở nhánh chưa kết nối) và chi tiết token không
 * có khối `role` phụ thuộc số dư, nên số `role` không đổi theo dữ liệu các tệp e2e chạy trước.
 */

async function actAsInvestor(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    { name: 'bidv_channel', value: 'investor', url: baseURL },
    { name: 'bidv_role', value: 'INVESTOR', url: baseURL },
  ]);
}

/** "Tải xong" như nhau ở mốc và nhánh mới (mốc chưa có `data-loading`): `networkidle`, rồi hết chữ "Đang đọc/tải". */
async function openPage(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await expect.poll(async () => /Đang (đọc|tải)/.test(await page.getByRole('main').innerText()), { message: path }).toBe(false);
}

/**
 * Số `role` trong `main` đo trên `release/ui-v2` @ ad133aa TRƯỚC khi sửa, bằng chính ca 1, ca 2 chạy trên máy chủ
 * MỚI trong lượt e2e mock đầy đủ (spec chép vào bản mốc).
 */
type RoleCount = { status: number; note: number; alert: number };
const ROLE_COUNTS: Record<'/portfolio' | '/tokens/WPT' | '/tokens/WPT-PQY', RoleCount> = {
  '/portfolio': { status: -1, note: -1, alert: -1 },
  '/tokens/WPT': { status: -1, note: -1, alert: -1 },
  '/tokens/WPT-PQY': { status: -1, note: -1, alert: -1 },
};

async function countRoles(page: Page, path: string) {
  const main = page.getByRole('main');
  const count = (name: string) => main.locator(`[role="${name}"]`).count();
  const counts = { status: await count('status'), note: await count('note'), alert: await count('alert') };
  console.log(`FE-UX-04a role counts ${path}: ${JSON.stringify(counts)}`);
  return counts;
}

const headings = async (page: Page) =>
  (await page.getByRole('main').getByRole('heading', { level: 2 }).allInnerTexts()).map((text) => text.trim());
const card = (page: Page, title: string) =>
  page.getByRole('main').locator('[data-slot="card"]').filter({ has: page.getByRole('heading', { name: title, level: 2 }) });

test.describe('FE-UX-04a Tổng quan nhà đầu tư và chi tiết token', () => {
  test('ca 1: /portfolio bố cục, thứ tự thẻ, Trạng thái phát hành, danh sách token; role bằng mốc', async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await actAsInvestor(context, baseURL!);
    await openPage(page, '/portfolio');
    const roles = await countRoles(page, '/portfolio');
    const main = page.getByRole('main');

    const h1 = await main.getByRole('heading', { level: 1 }).boundingBox();
    const scope = await page.locator('#token-scope').boundingBox();
    expect(Math.abs(h1!.y - scope!.y), 'h1 và ô chọn token cùng hàng').toBeLessThan(24);

    expect(await headings(page)).toEqual(['Tài sản đã đầu tư', 'Trạng thái phát hành', 'Giao dịch gần đây', 'Token dự án điện gió']);
    await expect(card(page, 'Tài sản đã đầu tư')).toHaveAttribute('data-tone', 'hl');

    const labels = (await card(page, 'Trạng thái phát hành').locator('dt').allInnerTexts()).map((text) =>
      text.replace(/on-chain|unverified/gi, '').trim(),
    );
    expect(labels).toEqual(['Ký hiệu token', 'Tổng cung đã phát hành', 'Giá phát hành', 'Dự án', 'Trạng thái vận hành']);
    const note = card(page, 'Trạng thái phát hành').locator('[data-slot="alert"]', { hasText: 'Chưa có thị trường thứ cấp' });
    await expect(note).toHaveCount(1);
    expect(await note.evaluate((element) => element.closest('dl') === null), 'câu thị trường thứ cấp nằm ngoài dl').toBe(true);

    const hrefs = await card(page, 'Token dự án điện gió').locator('a').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    expect(hrefs).toEqual(['/tokens/WPT', '/tokens/WPT-PQY', '/tokens/WPT-NTH']);

    const text = await main.innerText();
    expect(text).not.toContain('·');
    expect(text).not.toContain('—');
    expect(roles).toEqual(ROLE_COUNTS['/portfolio']);
  });

  test('ca 2: /tokens/WPT và /tokens/WPT-PQY thứ tự thẻ, Vị thế của bạn, Tình hình vận hành; role bằng mốc', async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await actAsInvestor(context, baseURL!);
    const roles: Partial<Record<keyof typeof ROLE_COUNTS, RoleCount>> = {};
    // Đếm trước mọi phép kiểm bố cục ở cả hai trang.
    for (const path of ['/tokens/WPT', '/tokens/WPT-PQY'] as const) {
      await openPage(page, path);
      roles[path] = await countRoles(page, path);
    }

    await openPage(page, '/tokens/WPT');
    expect(await headings(page)).toEqual(['Vị thế của bạn', 'Thông tin dự án', 'Thông tin token', 'Tình hình vận hành']);
    await expect(card(page, 'Vị thế của bạn')).toHaveAttribute('data-tone', 'hl');
    await expect(page.getByRole('main').getByText('Đang giữ', { exact: true })).toBeVisible();
    const operation = card(page, 'Tình hình vận hành');
    const kpis = operation.locator('[data-kpi]');
    await expect(kpis).toHaveCount(2);
    await expect(kpis.nth(0)).toContainText('Sản lượng luỹ kế');
    await expect(kpis.nth(0)).toHaveAttribute('data-tone', 'leaf');
    await expect(kpis.nth(1)).toContainText('Hệ số công suất');
    await expect(kpis.nth(1)).toHaveAttribute('data-tone', 'default');
    await expect(operation.locator('li')).toHaveCount(6);

    await openPage(page, '/tokens/WPT-PQY');
    expect((await headings(page))[0]).toBe('Vị thế của bạn');
    await expect(card(page, 'Vị thế của bạn')).toContainText('Chưa có token trên chuỗi nên chưa có vị thế');
    await expect(page.getByRole('main').getByText('Đang giữ', { exact: true })).toHaveCount(0);

    expect(roles['/tokens/WPT']).toEqual(ROLE_COUNTS['/tokens/WPT']);
    expect(roles['/tokens/WPT-PQY']).toEqual(ROLE_COUNTS['/tokens/WPT-PQY']);
  });

  test('ca 3: 1440 và 390 px không tràn ngang, không lỗi console, lỗi trang, cảnh báo hydrate', async ({ browser, baseURL }) => {
    for (const width of [1440, 390]) {
      for (const path of ['/portfolio', '/tokens/WPT', '/tokens/WPT-PQY']) {
        const ctx = await browser.newContext({ viewport: { width, height: 900 } });
        await actAsInvestor(ctx, baseURL!);
        const p = await ctx.newPage();
        const hydration: string[] = [];
        const errors: string[] = [];
        p.on('console', (message) => {
          if (/hydrat/i.test(message.text())) hydration.push(message.text());
          if (message.type() === 'error') errors.push(message.text());
        });
        p.on('pageerror', (error) => errors.push(error.message));
        await openPage(p, path);
        expect(await p.evaluate(() => document.documentElement.scrollWidth), `${path} ${width}`).toBeLessThanOrEqual(width);
        expect(hydration, `${path} ${width}`).toEqual([]);
        expect(errors, `${path} ${width}`).toEqual([]);
        await ctx.close();
      }
    }
  });

  /**
   * Số action khi mở màn (QĐ-2), cách đếm như `fix-04-noi-du-lieu-that.spec.ts`. `/portfolio` khi CÓ ví (3 action)
   * không dựng được vì Playwright không có ví trình duyệt: bất biến đó giữ bằng unit test đọc mã nguồn.
   */
  test('ca 4: số action khi mở màn trên mock', async ({ browser, baseURL }) => {
    const expected: [string, number][] = [
      ['/portfolio', 1],
      ['/tokens/WPT', 1],
      ['/tokens/WPT-PQY', 0],
      ['/tokens/WPT-NTH', 0],
    ];
    for (const [path, count] of expected) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await actAsInvestor(ctx, baseURL!);
      const p = await ctx.newPage();
      let actions = 0;
      p.on('request', (request) => {
        if (request.method() === 'POST' && request.headers()['next-action']) actions += 1;
      });
      await p.goto(path);
      await p.waitForLoadState('networkidle');
      await p.waitForTimeout(1000);
      expect(actions, path).toBe(count);
      await ctx.close();
    }
  });
});
