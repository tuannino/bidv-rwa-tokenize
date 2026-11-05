import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * FE-UX-05a: Tổng quan Người bán (`/seller`) và Danh sách giao dịch (`/seller/transactions`). Chỉ chạy trên project
 * `mock` (không có trong `testMatch` của project `hardhat`), vai Người bán; KHÔNG đổi dữ liệu, không giả định có lệnh.
 * Luồng có lệnh mua, bán, rút do `ops-transactions.spec.ts`, `vault-withdraw.spec.ts` phủ.
 */

async function actAsSeller(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    { name: 'bidv_channel', value: 'seller', url: baseURL },
    { name: 'bidv_role', value: 'SELLER', url: baseURL },
  ]);
}

/** Chữ của `main` sau khi bỏ các `select` (lựa chọn của ô lọc không tính là chữ đang tải). */
const mainText = (page: Page) =>
  page.getByRole('main').evaluate((main) => {
    const copy = main.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('select').forEach((select) => select.remove());
    return copy.textContent ?? '';
  });

/**
 * "Tải xong" như nhau ở mốc và nhánh mới: `networkidle`, rồi `/seller` hết chữ "Đang đọc số liệu";
 * `/seller/transactions` hết `[data-loading]` và hết chữ "Đang tải…" ngoài `select` (bản mốc chưa có `data-loading`).
 */
async function openPage(page: Page, path: '/seller' | '/seller/transactions') {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  if (path === '/seller') {
    await expect.poll(async () => (await mainText(page)).includes('Đang đọc số liệu'), { message: path }).toBe(false);
  } else {
    await expect(page.getByRole('main').locator('[data-loading]')).toHaveCount(0);
    await expect.poll(async () => (await mainText(page)).includes('Đang tải…'), { message: path }).toBe(false);
  }
}

/** Chờ hydrate trước mọi `selectOption` (cách `wallet-connect.spec.ts:33`). */
async function waitForHydration(page: Page) {
  await expect(page.locator('button[title^="Chuyển sang"]')).toBeVisible();
}

/**
 * Số `role` trong `main` đo trên `release/ui-v2` @ 11160f1 TRƯỚC khi sửa, bằng chính ca 1, ca 2 chạy trên máy chủ MỚI
 * trong lượt e2e mock đầy đủ (spec chép vào bản mốc).
 */
type RoleCount = { status: number; note: number; alert: number };
const ROLE_COUNTS: Record<'/seller' | '/seller/transactions', RoleCount> = {
  '/seller': { status: -1, note: -1, alert: -1 },
  '/seller/transactions': { status: -1, note: -1, alert: -1 },
};

async function countRoles(page: Page, path: string) {
  const main = page.getByRole('main');
  const count = (name: string) => main.locator(`[role="${name}"]`).count();
  const counts = { status: await count('status'), note: await count('note'), alert: await count('alert') };
  console.log(`FE-UX-05a role counts ${path}: ${JSON.stringify(counts)}`);
  return counts;
}

/** Nhãn ô Trạng thái khi lọc Loại "Rút", theo thứ tự `WITHDRAW_STATUSES` (chép cứng, không nhập tệp `'use client'`). */
const WITHDRAW_OPTIONS = [
  'Mọi trạng thái',
  'Đang đặt ví nhận',
  'Đang đặt ví nhận',
  'Đã đặt ví nhận, chờ gửi rút',
  'Cần xem xét (đặt ví nhận)',
  'Đang gửi',
  'Đã gửi, chờ biên nhận',
  'Hoàn tất',
  'Thất bại',
  'Cần Kiểm soát viên xem',
];

const FILTERS = ['Mã lệnh hoặc nhà đầu tư', 'Loại', 'Trạng thái', 'Từ ngày', 'Đến ngày'];

test.describe('FE-UX-05a Tổng quan và Danh sách giao dịch của Người bán', () => {
  test('ca 1: /seller tiêu đề, lối tắt, ô token, 4 ô số liệu một hàng đúng sắc, 5 chỉ tiêu; role bằng mốc; 390 px một cột', async ({
    page,
    context,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await actAsSeller(context, baseURL!);
    await openPage(page, '/seller');
    const roles = await countRoles(page, '/seller');
    const main = page.getByRole('main');

    await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(main.getByRole('heading', { level: 1 })).toHaveText('Tổng quan');
    const links = main.locator('nav[aria-label="Lối tắt"] a');
    await expect(links).toHaveCount(2);
    expect(await links.evaluateAll((items) => items.map((a) => a.getAttribute('href')))).toEqual([
      '/seller/transactions',
      '/seller/withdraw',
    ]);
    await expect(page.locator('#token-scope')).toBeVisible();

    const kpis = main.locator('[data-kpi]');
    await expect(kpis).toHaveCount(4);
    expect(await kpis.evaluateAll((items) => items.map((k) => k.getAttribute('data-tone')))).toEqual([
      'hl',
      'gold',
      'default',
      'default',
    ]);
    const wide = await Promise.all([0, 1, 2, 3].map(async (i) => (await kpis.nth(i).boundingBox())!));
    for (const box of wide) expect(Math.abs(box.y - wide[0].y), '4 ô cùng hàng ở 1440 px').toBeLessThan(4);
    await expect(main.locator('[data-metric]')).toHaveCount(5);

    await page.setViewportSize({ width: 390, height: 900 });
    const narrow = await Promise.all([0, 1, 2, 3].map(async (i) => (await kpis.nth(i).boundingBox())!));
    for (let i = 1; i < narrow.length; i += 1) {
      expect(narrow[i].y, 'ở 390 px ô sau nằm dưới ô trước').toBeGreaterThan(narrow[i - 1].y + narrow[i - 1].height - 1);
      expect(Math.abs(narrow[i].x - narrow[0].x), 'ở 390 px một cột').toBeLessThan(4);
    }
    expect(roles).toEqual(ROLE_COUNTS['/seller']);
  });

  test('ca 2: /seller/transactions tiêu đề, 5 ô lọc một hàng, trạng thái của loại Rút, phân trang không chấm giữa; role bằng mốc', async ({
    page,
    context,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await actAsSeller(context, baseURL!);
    await openPage(page, '/seller/transactions');
    const roles = await countRoles(page, '/seller/transactions');
    const main = page.getByRole('main');

    await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(main.getByRole('heading', { level: 1 })).toHaveText('Danh sách giao dịch');
    const boxes = await Promise.all(
      FILTERS.map(async (label) => (await main.getByLabel(label, { exact: true }).boundingBox())!),
    );
    for (const box of boxes) expect(Math.abs(box.y - boxes[0].y), 'năm ô lọc cùng hàng ở 1440 px').toBeLessThan(4);
    expect(await main.locator('nav[aria-label="Phân trang"]').innerText()).not.toContain('·');

    await waitForHydration(page);
    await main.getByLabel('Loại', { exact: true }).selectOption('WITHDRAW');
    const options = main.getByLabel('Trạng thái', { exact: true }).locator('option');
    await expect(options).toHaveCount(WITHDRAW_OPTIONS.length);
    const labels = (await options.allInnerTexts()).map((text) => text.trim());
    expect(labels).toEqual(WITHDRAW_OPTIONS);
    expect(labels).not.toContain('Đang khớp');
    expect(labels).not.toContain('Bị từ chối');
    expect(roles).toEqual(ROLE_COUNTS['/seller/transactions']);
  });

  test('ca 3: hai màn ở 1440 và 390 px không tràn ngang trong main, không lỗi console, lỗi trang, cảnh báo hydrate', async ({
    browser,
    baseURL,
  }) => {
    for (const width of [1440, 390]) {
      for (const path of ['/seller', '/seller/transactions'] as const) {
        const ctx = await browser.newContext({ viewport: { width, height: 900 } });
        await actAsSeller(ctx, baseURL!);
        const p = await ctx.newPage();
        const hydration: string[] = [];
        const errors: string[] = [];
        p.on('console', (message) => {
          if (/hydrat/i.test(message.text())) hydration.push(message.text());
          if (message.type() === 'error') errors.push(message.text());
        });
        p.on('pageerror', (error) => errors.push(error.message));
        await openPage(p, path);
        const overflow = await p.getByRole('main').evaluate((main) => main.scrollWidth - main.clientWidth);
        expect(overflow, `${path} ${width}`).toBeLessThanOrEqual(0);
        expect(hydration, `${path} ${width}`).toEqual([]);
        expect(errors, `${path} ${width}`).toEqual([]);
        await ctx.close();
      }
    }
  });

  /** Số action khi mở màn (QĐ-2), cách đếm như `fix-04-noi-du-lieu-that.spec.ts`, thêm chờ 1 giây. */
  test('ca 4: mở mỗi màn đúng 1 action', async ({ browser, baseURL }) => {
    for (const path of ['/seller', '/seller/transactions']) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await actAsSeller(ctx, baseURL!);
      const p = await ctx.newPage();
      let actions = 0;
      p.on('request', (request) => {
        if (request.method() === 'POST' && request.headers()['next-action']) actions += 1;
      });
      await p.goto(path);
      await p.waitForLoadState('networkidle');
      await p.waitForTimeout(1000);
      expect(actions, path).toBe(1);
      await ctx.close();
    }
  });
});
