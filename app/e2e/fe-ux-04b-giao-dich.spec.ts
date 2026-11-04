import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * FE-UX-04b: màn Giao dịch token (`/trade`). Chỉ chạy trên project `mock` (không có trong `testMatch` của project
 * `hardhat`), vai Nhà đầu tư; KHÔNG gửi lệnh, không đổi dữ liệu. Không giả định trần số lượng hay điều kiện đạt (phụ
 * thuộc nguồn cung do tệp chạy trước tạo). Luồng mua, bán, ký, tạm dừng do `ops-transactions`, `permit-order`,
 * `recall` phủ.
 */

async function actAsInvestor(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    { name: 'bidv_channel', value: 'investor', url: baseURL },
    { name: 'bidv_role', value: 'INVESTOR', url: baseURL },
  ]);
}

/** "Tải xong" như nhau ở mốc và nhánh mới: `networkidle`, rồi hết chữ "Đang đọc số dư và thông tin token". */
async function openTrade(page: Page) {
  await page.goto('/trade');
  await page.waitForLoadState('networkidle');
  await expect
    .poll(async () => (await page.getByRole('main').innerText()).includes('Đang đọc số dư và thông tin token'))
    .toBe(false);
}

/**
 * Số `role` trong `main` đo trên `release/ui-v2` @ e914807 TRƯỚC khi sửa, bằng chính ca 1 chạy trên máy chủ MỚI
 * trong lượt e2e mock đầy đủ (spec chép vào bản mốc).
 */
const ROLE_COUNTS = { status: 0, note: 1, alert: 0 };

async function countRoles(page: Page) {
  const main = page.getByRole('main');
  const count = (name: string) => main.locator(`[role="${name}"]`).count();
  const counts = { status: await count('status'), note: await count('note'), alert: await count('alert') };
  console.log(`FE-UX-04b role counts /trade: ${JSON.stringify(counts)}`);
  return counts;
}

const box = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!;

test.describe('FE-UX-04b Giao dịch token', () => {
  test('ca 1: 1440 px bố cục, dòng mô phỏng là Alert note, Tóm tắt lệnh nền xanh; role bằng mốc', async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await actAsInvestor(context, baseURL!);
    await openTrade(page);
    const roles = await countRoles(page);
    const main = page.getByRole('main');

    await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
    const notes = main.locator('[role="note"]');
    await expect(notes).toHaveCount(1);
    await expect(main.locator('[data-slot="alert"][role="note"]')).toHaveCount(1);
    await expect(notes).toContainText('Không cần kết nối ví trình duyệt');

    const order = main.locator('[data-slot="card"]').filter({ has: page.getByText('Đặt lệnh', { exact: true }) });
    const orderBox = (await order.boundingBox())!;
    const summary = await box(page, '[aria-label="Tóm tắt lệnh"]');
    expect(orderBox.x, 'Đặt lệnh bên trái Tóm tắt lệnh').toBeLessThan(summary.x);
    expect(Math.abs(orderBox.y - summary.y), 'Đặt lệnh và Tóm tắt lệnh cùng đỉnh').toBeLessThan(24);
    await expect(page.locator('[aria-label="Tóm tắt lệnh"]')).toHaveAttribute('data-tone', 'hl');
    const info = await box(page, '[aria-label="Thông tin token"]');
    expect(summary.y, 'Tóm tắt lệnh trên Thông tin token').toBeLessThan(info.y);

    const quantity = (await page.getByLabel('Số lượng').boundingBox())!;
    const price = (await page.locator('input[aria-label="Giá"]').boundingBox())!;
    expect(Math.abs(quantity.y - price.y), 'Số lượng và Giá cùng hàng').toBeLessThan(4);
    expect(await page.getByTestId('quantity-cap').innerText()).toMatch(/^Tối đa/);

    expect(roles).toEqual(ROLE_COUNTS);
  });

  test('ca 2: 390 px Giá dưới Số lượng, Tóm tắt lệnh dưới nút; số lượng 0 báo lỗi và khoá nút', async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await actAsInvestor(context, baseURL!);
    await openTrade(page);

    const quantity = (await page.getByLabel('Số lượng').boundingBox())!;
    const price = (await page.locator('input[aria-label="Giá"]').boundingBox())!;
    expect(price.y, 'Giá dưới Số lượng').toBeGreaterThan(quantity.y + quantity.height - 1);
    const confirm = page.getByRole('button', { name: 'Xác nhận lệnh mua' });
    const confirmBox = (await confirm.boundingBox())!;
    const summary = await box(page, '[aria-label="Tóm tắt lệnh"]');
    expect(summary.y, 'Tóm tắt lệnh dưới nút xác nhận').toBeGreaterThan(confirmBox.y);

    await page.getByLabel('Số lượng').fill('0');
    await expect(
      page.getByRole('main').locator('[role="alert"]').filter({ hasText: 'Số lượng phải là số nguyên lớn hơn 0.' }),
    ).toHaveCount(1);
    await expect(confirm).toBeDisabled();
  });

  test('ca 3: 1440 và 390 px không tràn ngang, không lỗi console, lỗi trang, cảnh báo hydrate', async ({ browser, baseURL }) => {
    for (const width of [1440, 390]) {
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
      await openTrade(p);
      expect(await p.evaluate(() => document.documentElement.scrollWidth), `${width}`).toBeLessThanOrEqual(width);
      expect(hydration, `${width}`).toEqual([]);
      expect(errors, `${width}`).toEqual([]);
      await ctx.close();
    }
  });

  /** Số action khi mở màn (QĐ-2), cách đếm như `fix-04-noi-du-lieu-that.spec.ts`, thêm chờ 1 giây. */
  test('ca 4: mở /trade đúng 1 action', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await actAsInvestor(ctx, baseURL!);
    const p = await ctx.newPage();
    let actions = 0;
    p.on('request', (request) => {
      if (request.method() === 'POST' && request.headers()['next-action']) actions += 1;
    });
    await p.goto('/trade');
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(1000);
    expect(actions).toBe(1);
    await ctx.close();
  });
});
