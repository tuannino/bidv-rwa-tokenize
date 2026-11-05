import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import sampleWallets from '../../packages/shared/src/sample-wallets.json';

/**
 * FE-UX-05c: màn Tạo lệnh rút của Người bán (`/seller/withdraw`). Chỉ chạy trên project `mock` (không có trong
 * `testMatch` của project `hardhat`), vai Người bán; KHÔNG tạo lệnh, không đổi dữ liệu. Tệp chạy trước
 * `ops-transactions.spec.ts`, `vault-withdraw.spec.ts` nên không giả định số dư, ví nhận đang đặt hay có lệnh. Luồng tạo
 * lệnh, mã một lần, kết quả, dòng "Hoàn tất" do `vault-withdraw.spec.ts` phủ (mock và Hardhat).
 */

/** Ví khác ví nhận đang đặt (trên mock ví đang đặt là `null`, hoặc NB001 sau `vault-withdraw`). */
const OTHER_WALLET = sampleWallets.wallets.NDT001;

async function actAsSeller(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    { name: 'bidv_channel', value: 'seller', url: baseURL },
    { name: 'bidv_role', value: 'SELLER', url: baseURL },
  ]);
}

/** "Tải xong" như nhau ở mốc và nhánh mới: `networkidle`, rồi `main` hết chữ "Đang đọc số dư". */
async function openWithdraw(page: Page) {
  await page.goto('/seller/withdraw');
  await page.waitForLoadState('networkidle');
  await expect.poll(async () => (await page.getByRole('main').innerText()).includes('Đang đọc số dư')).toBe(false);
}

/**
 * Số `role` trong `main` và số action khi mở màn đo trên `release/ui-v2` @ d035407 TRƯỚC khi sửa, bằng chính ca 1, ca 4
 * chạy trên máy chủ MỚI (spec chép vào bản mốc).
 */
const ROLE_COUNTS = { status: 0, note: 0, alert: 0 };
const OPEN_ACTIONS = 2;

async function countRoles(page: Page) {
  const main = page.getByRole('main');
  const count = (name: string) => main.locator(`[role="${name}"]`).count();
  const counts = { status: await count('status'), note: await count('note'), alert: await count('alert') };
  console.log(`FE-UX-05c role counts /seller/withdraw: ${JSON.stringify(counts)}`);
  return counts;
}

const cardWith = (page: Page, selector: string) =>
  page.getByRole('main').locator('[data-slot="card"]').filter({ has: page.locator(selector) });
const formCard = (page: Page) =>
  page
    .getByRole('main')
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole('heading', { name: 'Thông tin lệnh rút', level: 2 }) });

test.describe('FE-UX-05c Tạo lệnh rút của Người bán', () => {
  test('ca 1: 1440 px hai thẻ cùng hàng, Hệ thống tính 4 dòng đúng thứ tự, danh sách hoặc ô rỗng; role bằng mốc', async ({
    page,
    context,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await actAsSeller(context, baseURL!);
    await openWithdraw(page);
    const roles = await countRoles(page);
    const main = page.getByRole('main');

    await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(main.getByRole('heading', { level: 1 })).toHaveText('Tạo lệnh rút');
    await expect(page.locator('#token-scope')).toBeVisible();

    const left = (await formCard(page).boundingBox())!;
    const calc = cardWith(page, '[data-testid="withdrawable"]');
    const right = (await calc.boundingBox())!;
    expect(left.x, 'Thông tin lệnh rút bên trái Hệ thống tính').toBeLessThan(right.x);
    expect(Math.abs(left.y - right.y), 'hai thẻ cùng đỉnh').toBeLessThan(4);
    expect(left.width, 'thẻ trái rộng hơn thẻ phải').toBeGreaterThan(right.width);

    const terms = (await calc.locator('dt').allInnerTexts()).map((text) => text.trim());
    expect(terms).toEqual(['Số dư VNDB của vault', 'Phần khoá', 'Phần được rút', 'Số tiền nhận được']);
    await expect(main.getByText('Phí ngân hàng ngoài chuỗi: chưa áp dụng (POC).')).toBeVisible();

    const table = page.getByRole('table', { name: 'Yêu cầu rút của tôi' });
    const empty = main.locator('[data-slot="empty-state"]', { hasText: 'Chưa có yêu cầu rút nào trên chain này.' });
    await expect(table.or(empty)).toBeVisible();
    expect(roles).toEqual(ROLE_COUNTS);
  });

  test('ca 2: đổi ví nhận hiện câu ghi chú, vượt phần được rút báo lỗi và khoá nút; 390 px Hệ thống tính dưới nút', async ({
    page,
    context,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await actAsSeller(context, baseURL!);
    await openWithdraw(page);
    const main = page.getByRole('main');

    await page.getByLabel('Mục đích').fill('Kiểm bố cục, không gửi');
    await page.getByLabel('Ví nhận', { exact: true }).fill(OTHER_WALLET);
    await expect(
      main
        .locator('[role="note"]')
        .filter({ hasText: 'Đổi ví nhận: hệ thống gửi thêm một giao dịch đặt ví nhận trước khi rút.' }),
    ).toBeVisible();
    await expect(main).not.toContainText('Chain này chưa có vault');
    await expect(main).not.toContainText('Vault đang tạm dừng rút');

    await page.getByLabel('Số tiền rút (VNDB)').fill('999999999999999');
    await expect(main.locator('[role="alert"]').filter({ hasText: 'Vượt phần được rút: chỉ rút được tối đa' })).toHaveCount(1);
    const submit = page.getByRole('button', { name: 'Tạo lệnh rút' });
    await expect(submit).toBeDisabled();

    await page.setViewportSize({ width: 390, height: 900 });
    const submitBox = (await submit.boundingBox())!;
    const left = (await formCard(page).boundingBox())!;
    const right = (await cardWith(page, '[data-testid="withdrawable"]').boundingBox())!;
    expect(right.y, 'Hệ thống tính dưới nút Tạo lệnh rút').toBeGreaterThan(submitBox.y);
    expect(Math.abs(right.width - left.width), 'hai thẻ rộng bằng nhau').toBeLessThan(4);
  });

  test('ca 3: 1440 và 390 px không tràn ngang trong main, không lỗi console, lỗi trang, cảnh báo hydrate', async ({
    browser,
    baseURL,
  }) => {
    for (const width of [1440, 390]) {
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
      await openWithdraw(p);
      const overflow = await p.getByRole('main').evaluate((main) => main.scrollWidth - main.clientWidth);
      expect(overflow, `${width}`).toBeLessThanOrEqual(0);
      expect(hydration, `${width}`).toEqual([]);
      expect(errors, `${width}`).toEqual([]);
      await ctx.close();
    }
  });

  /** Số action khi mở màn (QĐ-2), cách đếm như `fix-04-noi-du-lieu-that.spec.ts`, thêm chờ 1 giây. */
  test('ca 4: số action khi mở /seller/withdraw bằng mốc', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await actAsSeller(ctx, baseURL!);
    const p = await ctx.newPage();
    let actions = 0;
    p.on('request', (request) => {
      if (request.method() === 'POST' && request.headers()['next-action']) actions += 1;
    });
    await p.goto('/seller/withdraw');
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(1000);
    console.log(`FE-UX-05c open actions /seller/withdraw: ${actions}`);
    expect(actions).toBe(OPEN_ACTIONS);
    await ctx.close();
  });
});
