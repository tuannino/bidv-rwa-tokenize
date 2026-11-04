import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * FE-UX-02a: thành phần màn dùng chung và 5 màn Vận hành. Chain mock, máy chủ bản build.
 *
 * Chỉ đọc, không tạo dữ liệu: các spec chạy sau trên cùng máy chủ không bị ảnh hưởng. Chi tiết lệnh
 * không có ca ở đây (design mục 4): `ops-transactions.spec.ts` và `permit-order.spec.ts` đã phủ.
 */
type Role = 'TELLER' | 'CONTROLLER';

async function actAs(context: BrowserContext, baseURL: string, role: Role) {
  await context.addCookies([
    { name: 'bidv_channel', value: role.toLowerCase(), url: baseURL },
    { name: 'bidv_role', value: role, url: baseURL },
  ]);
}

/**
 * Mở màn và chờ tải xong: nút theme hiện (đã hydrate), không còn chữ "Đang đọc" của `/`, không còn
 * `EmptyState` đang tải, và ở `/demo-payment` câu "Tối đa một lần" đã hiện (ngữ cảnh đã đọc xong).
 */
async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('button[title^="Chuyển sang"]')).toBeVisible();
  const main = page.getByRole('main');
  await expect(main.getByText('Đang đọc', { exact: true })).toHaveCount(0);
  await expect(main.locator('[data-slot="empty-state"][data-loading]')).toHaveCount(0);
  if (path === '/demo-payment') await expect(main.getByText(/^Tối đa một lần:/)).toBeVisible();
}

const tile = (page: Page, label: string) =>
  page.getByRole('main').locator('[data-kpi]').filter({ has: page.getByText(label, { exact: true }) });

/**
 * Số `role` trong `main` đo trên `release/ui-v2` @ 2065289 TRƯỚC khi sửa (cùng cách chờ như trên).
 * `/` có một `status`: khung tooltip của biểu đồ recharts.
 */
const ROLE_COUNTS: [string, Role, { status: number; note: number; alert: number }][] = [
  ['/', 'TELLER', { status: 1, note: 0, alert: 0 }],
  ['/demo-payment', 'TELLER', { status: 0, note: 1, alert: 0 }],
  ['/wallet-binding', 'TELLER', { status: 0, note: 0, alert: 0 }],
  ['/transactions', 'CONTROLLER', { status: 0, note: 1, alert: 0 }],
];

test.describe('FE-UX-02a màn Vận hành', () => {
  test('ca 1: / có 5 ô số liệu, sắc đúng QĐ-4', async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await actAs(context, baseURL!, 'TELLER');
    await open(page, '/');
    await expect(page.getByRole('main').locator('[data-kpi]')).toHaveCount(5);
    const tones: [string, string][] = [
      ['Tổng cung token', 'hl'],
      ['Lợi tức đã chia', 'au'],
      ['Sản lượng luỹ kế', 'leaf'],
      ['Dự án đang triển khai', 'default'],
      ['Nhà đầu tư đã định danh', 'default'],
    ];
    for (const [label, tone] of tones) await expect(tile(page, label), label).toHaveAttribute('data-tone', tone);
    const backgroundImage = (label: string) =>
      tile(page, label).evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(await backgroundImage('Tổng cung token')).not.toBe('none');
    expect(await backgroundImage('Tổng cung token')).not.toBe(await backgroundImage('Dự án đang triển khai'));
    // Lưới 12 cột ở 1440 px: ô Tổng cung nằm cột trái, cùng hàng đầu với ô Dự án và cao hơn hẳn (hai hàng).
    const hl = (await tile(page, 'Tổng cung token').boundingBox())!;
    const projects = (await tile(page, 'Dự án đang triển khai').boundingBox())!;
    expect(hl.x).toBeLessThan(projects.x);
    expect(Math.abs(hl.y - projects.y)).toBeLessThanOrEqual(1);
    expect(hl.height).toBeGreaterThan(projects.height * 1.5);
  });

  test('ca 2: /transactions có 3 ô số liệu, Chưa phân phối chỉ chứa con số', async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await actAs(context, baseURL!, 'TELLER');
    await open(page, '/transactions');
    const main = page.getByRole('main');
    await expect(main.locator('[data-kpi]')).toHaveCount(3);
    await expect(main.getByTestId('supply-total')).toHaveAttribute('data-tone', 'hl');
    await expect(main.getByTestId('supply-undistributed')).toHaveAttribute('data-tone', 'leaf');
    await expect(main.getByTestId('supply-circulating')).toHaveAttribute('data-tone', 'default');
    const undistributed = main.getByTestId('supply-undistributed');
    const shown = await undistributed.locator('.tabular-nums').first().innerText();
    const digitsOnly = (text: string) => text.replace(/\D/g, '');
    expect(digitsOnly(shown)).not.toBe('');
    expect(digitsOnly(await undistributed.innerText())).toBe(digitsOnly(shown));
  });

  test('ca 3: số role status, note, alert trong main bằng mốc trước khi sửa', async ({ browser, baseURL }) => {
    for (const [path, role, expected] of ROLE_COUNTS) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await actAs(context, baseURL!, role);
      const page = await context.newPage();
      await open(page, path);
      const main = page.getByRole('main');
      const count = (name: string) => main.locator(`[role="${name}"]`).count();
      const found = { status: await count('status'), note: await count('note'), alert: await count('alert') };
      // `role="status"` của tooltip recharts: mỗi biểu đồ đang vẽ có một. Ở mốc, `/` vẽ một biểu đồ
      // (lợi tức chưa có kỳ hoàn tất); nếu spec chạy trước đã hoàn tất kỳ chia thì vẽ thêm biểu đồ cột.
      // Phần ngoài biểu đồ phải bằng đúng mốc.
      const charts = await main.locator('.recharts-wrapper').count();
      const chartStatus = await main.locator('.recharts-wrapper [role="status"]').count();
      expect(chartStatus, path).toBe(charts);
      const baselineCharts = path === '/' ? 1 : 0;
      expect({ ...found, status: found.status - chartStatus }, path).toEqual({
        ...expected,
        status: expected.status - baselineCharts,
      });
      if (path === '/') expect(charts, path).toBeGreaterThanOrEqual(1);
      await context.close();
    }
  });

  test('ca 4: 390 px không tràn ngang; 1440 và 390 px không lỗi console, không cảnh báo hydrate', async ({
    browser,
    baseURL,
  }) => {
    for (const width of [1440, 390]) {
      for (const [path, role] of ROLE_COUNTS) {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        await actAs(context, baseURL!, role);
        const page = await context.newPage();
        const hydration: string[] = [];
        const errors: string[] = [];
        page.on('console', (message) => {
          if (/hydrat/i.test(message.text())) hydration.push(message.text());
          if (message.type() === 'error') errors.push(message.text());
        });
        page.on('pageerror', (error) => errors.push(error.message));
        await open(page, path);
        if (width === 390) {
          expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(390);
        }
        expect(hydration, `${path} ${width}`).toEqual([]);
        expect(errors, `${path} ${width}`).toEqual([]);
        await context.close();
      }
    }
  });
});
