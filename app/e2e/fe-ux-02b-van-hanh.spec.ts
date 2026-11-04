import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * FE-UX-02b: 3 màn Vận hành có nhiều logic (`/draft`, `/config`, `/recall`). Chain mock, máy chủ
 * bản build.
 *
 * Chỉ đọc, không tạo dữ liệu (không lập yêu cầu, không mở đợt thu hồi): các spec chạy sau trên cùng
 * máy chủ không bị ảnh hưởng. Luồng có dữ liệu do `maker-checker.spec.ts`, `recall.spec.ts`,
 * `fe-07-price-config.spec.ts` phủ; bước thu hồi kiểm ở `test/fe-ux-02b.test.ts`.
 */
type Role = 'TELLER' | 'CONTROLLER';

async function actAs(context: BrowserContext, baseURL: string, role: Role) {
  await context.addCookies([
    { name: 'bidv_channel', value: role.toLowerCase(), url: baseURL },
    { name: 'bidv_role', value: role, url: baseURL },
  ]);
}

/**
 * Mở màn và chờ tải xong: nút Sáng Tối hiện (đã hydrate), trong `main` không còn chữ bắt đầu bằng
 * "Đang tải" (`/config` "Đang tải…", `/recall` "Đang tải tình trạng thu hồi...", bảng `/draft`) và
 * không còn `EmptyState` đang tải.
 */
async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('button[title^="Chuyển sang"]')).toBeVisible();
  const main = page.getByRole('main');
  await expect(main.getByText(/^\s*Đang tải/)).toHaveCount(0);
  await expect(main.locator('[data-slot="empty-state"][data-loading]')).toHaveCount(0);
  await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
}

/**
 * Số `role` trong `main` đo trên `release/ui-v2` @ 27a52ad TRƯỚC khi sửa, trong lượt e2e mock đầy đủ
 * cùng thứ tự tệp (spec này chép tạm vào nhánh mốc), vì các spec chạy trước để lại dữ liệu.
 */
const ROLE_COUNTS: [string, Role, { status: number; note: number; alert: number }][] = [
  ['/draft', 'TELLER', { status: 0, note: 0, alert: 0 }],
  ['/config', 'TELLER', { status: 0, note: 0, alert: 0 }],
  ['/recall', 'TELLER', { status: 0, note: 0, alert: 0 }],
  ['/recall', 'CONTROLLER', { status: 0, note: 0, alert: 0 }],
];

test.describe('FE-UX-02b màn Vận hành', () => {
  test('ca 1: ô số liệu /draft sắc default, /config sắc au và hl, effective-price nằm trong giá trị', async ({
    page,
    context,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await actAs(context, baseURL!, 'TELLER');
    await open(page, '/draft');
    const draftMain = page.getByRole('main');
    await expect(draftMain.locator('[data-kpi]')).toHaveCount(2);
    for (const label of ['Yêu cầu tạo token đang chờ', 'Yêu cầu huỷ token đang chờ']) {
      const tile = draftMain.getByLabel(label, { exact: true });
      await expect(tile, label).toHaveAttribute('data-kpi', '');
      await expect(tile, label).toHaveAttribute('data-tone', 'default');
    }

    await open(page, '/config');
    const main = page.getByRole('main');
    const tile = (text: string) => main.locator('[data-kpi]').filter({ hasText: text });
    await expect(tile('Giá áp dụng')).toHaveCount(1);
    await expect(tile('Giá áp dụng')).toHaveAttribute('data-tone', 'au');
    await expect(tile('Tổng cung trên chuỗi')).toHaveCount(1);
    await expect(tile('Tổng cung trên chuỗi')).toHaveAttribute('data-tone', 'hl');
    const price = main.getByTestId('effective-price');
    await expect(price).toHaveText(/^[\d.]+ VNDB$/);
    expect(await price.evaluate((el) => el.hasAttribute('data-kpi'))).toBe(false);
    await expect(tile('Giá áp dụng').getByTestId('effective-price')).toHaveCount(1);
  });

  test('ca 2: số role status, note, alert trong main bằng mốc trước khi sửa', async ({ browser, baseURL }) => {
    const found: Record<string, { status: number; note: number; alert: number }> = {};
    for (const [path, role] of ROLE_COUNTS) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await actAs(context, baseURL!, role);
      const page = await context.newPage();
      await open(page, path);
      const main = page.getByRole('main');
      const count = (name: string) => main.locator(`[role="${name}"]`).count();
      found[`${path} ${role}`] = { status: await count('status'), note: await count('note'), alert: await count('alert') };
      await context.close();
    }
    console.log(`FE-UX-02b role counts: ${JSON.stringify(found)}`);
    for (const [path, role, expected] of ROLE_COUNTS) expect(found[`${path} ${role}`], `${path} ${role}`).toEqual(expected);
  });

  test('ca 3: 390 px không tràn ngang; 1440 và 390 px không lỗi console, không cảnh báo hydrate', async ({
    browser,
    baseURL,
  }) => {
    for (const width of [1440, 390]) {
      for (const path of ['/draft', '/config', '/recall']) {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        await actAs(context, baseURL!, 'TELLER');
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
