import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * FE-UX-06a: ba màn dữ liệu mẫu (`/assets`, `/kyc`, `/reconciliation`). Chỉ chạy trên project `mock` (không có trong
 * `testMatch` của project `hardhat`), vai Giao dịch viên; KHÔNG đổi dữ liệu (ba màn chỉ đọc số mẫu).
 */

type SamplePath = '/assets' | '/kyc' | '/reconciliation';
const PAGES: { path: SamplePath; title: string; kpis: number }[] = [
  { path: '/assets', title: 'Dự án điện gió đã token hoá', kpis: 4 },
  { path: '/kyc', title: 'Nhà đầu tư & KYC', kpis: 4 },
  { path: '/reconciliation', title: 'Đối soát doanh thu điện', kpis: 3 },
];

/** Số dự án vùng "Trên bờ, Ven biển" trong `MOCK_PROJECTS` (`lib/mock-data.ts`, hai dự án `ONSHORE_COASTAL`). */
const COASTAL_PROJECTS = 2;

async function actAsTeller(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    { name: 'bidv_channel', value: 'teller', url: baseURL },
    { name: 'bidv_role', value: 'TELLER', url: baseURL },
  ]);
}

async function open(page: Page, path: SamplePath) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

/**
 * Số `role` trong `main` đo trên `release/ui-v2` @ 9eac384 TRƯỚC khi sửa, bằng chính ca 1 chạy trên máy chủ MỚI (spec
 * chép vào bản mốc).
 */
type RoleCount = { status: number; note: number; alert: number };
const ROLE_COUNTS: Record<SamplePath, RoleCount> = {
  '/assets': { status: 0, note: 0, alert: 0 },
  '/kyc': { status: 0, note: 0, alert: 0 },
  '/reconciliation': { status: 0, note: 0, alert: 0 },
};

async function countRoles(page: Page, path: SamplePath) {
  const main = page.getByRole('main');
  const count = (name: string) => main.locator(`[role="${name}"]`).count();
  const counts = { status: await count('status'), note: await count('note'), alert: await count('alert') };
  console.log(`FE-UX-06a role counts ${path}: ${JSON.stringify(counts)}`);
  return counts;
}

/** Nhóm lọc: phần tử chứa đúng chữ nhãn nhóm (ví dụ "Vùng:"), tìm nút trong đó. */
const filterGroup = (page: Page, label: string) =>
  page
    .getByRole('main')
    .locator('div')
    .filter({ has: page.getByText(label, { exact: true }) })
    .filter({ has: page.locator('[aria-pressed]') })
    .last();
const projectRows = (page: Page) => page.getByRole('main').locator('tbody tr');

test.describe('FE-UX-06a ba màn dữ liệu mẫu', () => {
  test('ca 1: ba màn 1440 px một h1, ghi chú dữ liệu mẫu, ô số liệu cùng hàng, bảng trong khung cuộn, chú thích PoC; role bằng mốc; 390 px một cột', async ({
    page,
    context,
    baseURL,
  }) => {
    await actAsTeller(context, baseURL!);
    const roles: Partial<Record<SamplePath, RoleCount>> = {};
    for (const { path } of PAGES) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await open(page, path);
      roles[path] = await countRoles(page, path);
    }

    for (const { path, title, kpis } of PAGES) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await open(page, path);
      const main = page.getByRole('main');
      await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(main.getByRole('heading', { level: 1 })).toHaveText(title);
      await expect(main.getByText('(đang hiển thị dữ liệu mẫu)')).toBeVisible();

      const cells = main.locator('[data-kpi]');
      await expect(cells).toHaveCount(kpis);
      const wide = await Promise.all(Array.from({ length: kpis }, async (_, i) => (await cells.nth(i).boundingBox())!));
      for (const box of wide) expect(Math.abs(box.y - wide[0].y), `${path}: ô số liệu cùng hàng`).toBeLessThan(4);
      if (path === '/reconciliation') {
        const sources = main.locator('[data-slot="card"]').filter({ hasText: 'Chờ nối ở Phase 3' });
        await expect(sources).toHaveCount(3);
        const boxes = await Promise.all([0, 1, 2].map(async (i) => (await sources.nth(i).boundingBox())!));
        for (const box of boxes) expect(Math.abs(box.y - boxes[0].y), 'ba thẻ nguồn cùng hàng').toBeLessThan(4);
      }
      await expect(main.locator('[data-slot="table-container"] table')).toHaveCount(1);
      await expect(main.getByText('Chưa hỗ trợ trong PoC', { exact: true })).toBeVisible();

      await page.setViewportSize({ width: 390, height: 900 });
      const narrow = await Promise.all(Array.from({ length: kpis }, async (_, i) => (await cells.nth(i).boundingBox())!));
      for (const box of narrow) expect(Math.abs(box.x - narrow[0].x), `${path}: 390 px một cột`).toBeLessThan(2);
      const pills = main.locator('[aria-pressed]');
      for (let i = 0; i < (await pills.count()); i += 1) {
        expect((await pills.nth(i).boundingBox())!.height, `${path}: viên nang một dòng`).toBeLessThanOrEqual(32);
      }
    }
    for (const { path } of PAGES) expect(roles[path], path).toEqual(ROLE_COUNTS[path]);
  });

  test('ca 2: nút khoá, menu không mở; lọc bằng chuột và bàn phím; ô tìm nhận chữ', async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await actAsTeller(context, baseURL!);
    const main = page.getByRole('main');

    await open(page, '/assets');
    await expect(main.getByRole('button', { name: 'Làm mới', exact: true })).toBeDisabled();
    const add = main.getByRole('button', { name: 'Thêm dự án', exact: true });
    await expect(add).toBeDisabled();
    await add.click({ force: true });
    await expect(page.locator('[role="menu"]')).toHaveCount(0);
    const region = filterGroup(page, 'Vùng:');
    await region.getByRole('button', { name: 'Trên bờ, Ven biển', exact: true }).click();
    await expect(region.getByRole('button', { name: 'Trên bờ, Ven biển', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(region.getByRole('button', { name: 'Tất cả', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await expect(projectRows(page)).toHaveCount(COASTAL_PROJECTS);
    await region.getByRole('button', { name: 'Trên bờ, Cao nguyên', exact: true }).click();
    await expect(projectRows(page)).toHaveCount(0);
    await expect(main.locator('[data-slot="empty-state"]')).toContainText('Không có dự án nào khớp bộ lọc');
    await region.getByRole('button', { name: 'Tất cả', exact: true }).click();
    await expect(projectRows(page)).toHaveCount(3);

    await open(page, '/kyc');
    await page.getByLabel('Tìm nhà đầu tư').fill('Nguyễn');
    await expect(page.getByLabel('Tìm nhà đầu tư')).toHaveValue('Nguyễn');
    const vip = filterGroup(page, 'Cấp KYC:').getByRole('button', { name: 'VIP', exact: true });
    await vip.click();
    await expect(vip).toHaveAttribute('aria-pressed', 'true');
    await expect(main.getByRole('button', { name: 'Làm mới', exact: true })).toBeDisabled();

    await open(page, '/reconciliation');
    await expect(main.getByRole('button', { name: 'Làm mới dữ liệu', exact: true })).toBeDisabled();
    const firstProject = filterGroup(page, 'Dự án:').locator('[aria-pressed]').nth(1);
    await firstProject.click();
    await expect(firstProject).toHaveAttribute('aria-pressed', 'true');

    // Bàn phím trên /assets.
    await open(page, '/assets');
    const coastal = filterGroup(page, 'Vùng:').getByRole('button', { name: 'Trên bờ, Ven biển', exact: true });
    const highland = filterGroup(page, 'Vùng:').getByRole('button', { name: 'Trên bờ, Cao nguyên', exact: true });
    const focused = (locator: ReturnType<typeof page.locator>) =>
      locator.evaluate((element) => element === document.activeElement);
    let reached = false;
    for (let i = 0; i < 80 && !reached; i += 1) {
      await page.keyboard.press('Tab');
      reached = await focused(coastal);
    }
    expect(reached, 'Tab tới nút lọc "Trên bờ, Ven biển"').toBe(true);
    await page.keyboard.press('Enter');
    await expect(coastal).toHaveAttribute('aria-pressed', 'true');
    await expect(projectRows(page)).toHaveCount(COASTAL_PROJECTS);
    // "Trên bờ, Cao nguyên" đứng TRƯỚC "Trên bờ, Ven biển" (thứ tự `REGION_LABELS`), nên lùi một nút.
    await page.keyboard.press('Shift+Tab');
    expect(await focused(highland), 'Shift+Tab sang "Trên bờ, Cao nguyên"').toBe(true);
    await page.keyboard.press('Space');
    await expect(highland).toHaveAttribute('aria-pressed', 'true');
    await expect(projectRows(page)).toHaveCount(0);
    await expect(main.locator('[data-slot="empty-state"]')).toBeVisible();

    const trigger = main.getByRole('button', { name: 'Thêm dự án', exact: true });
    for (const key of ['Enter', 'Space', 'ArrowDown']) {
      await trigger.focus();
      await page.keyboard.press(key);
      await expect(page.locator('[role="menu"]'), key).toHaveCount(0);
    }
  });

  test('ca 3: ba màn ở 1440 và 390 px không tràn ngang trong main, không lỗi console, lỗi trang, cảnh báo hydrate', async ({
    browser,
    baseURL,
  }) => {
    for (const width of [1440, 390]) {
      for (const { path } of PAGES) {
        const ctx = await browser.newContext({ viewport: { width, height: 900 } });
        await actAsTeller(ctx, baseURL!);
        const p = await ctx.newPage();
        const hydration: string[] = [];
        const errors: string[] = [];
        p.on('console', (message) => {
          if (/hydrat/i.test(message.text())) hydration.push(message.text());
          if (message.type() === 'error') errors.push(message.text());
        });
        p.on('pageerror', (error) => errors.push(error.message));
        await open(p, path);
        const overflow = await p.getByRole('main').evaluate((main) => main.scrollWidth - main.clientWidth);
        expect(overflow, `${path} ${width}`).toBeLessThanOrEqual(0);
        expect(hydration, `${path} ${width}`).toEqual([]);
        expect(errors, `${path} ${width}`).toEqual([]);
        await ctx.close();
      }
    }
  });

  /** Số action khi mở màn, cách đếm như `fix-04-noi-du-lieu-that.spec.ts`, thêm chờ 1 giây. */
  test('ca 4: mở mỗi màn 0 action', async ({ browser, baseURL }) => {
    for (const { path } of PAGES) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await actAsTeller(ctx, baseURL!);
      const p = await ctx.newPage();
      let actions = 0;
      p.on('request', (request) => {
        if (request.method() === 'POST' && request.headers()['next-action']) actions += 1;
      });
      await p.goto(path);
      await p.waitForLoadState('networkidle');
      await p.waitForTimeout(1000);
      expect(actions, path).toBe(0);
      await ctx.close();
    }
  });
});
