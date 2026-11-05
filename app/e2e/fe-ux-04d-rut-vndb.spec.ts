import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import sampleWallets from '../../packages/shared/src/sample-wallets.json';

/**
 * FE-UX-04d: màn Rút VNDB của Nhà đầu tư (`/withdraw`). Chỉ chạy trên project `mock` (không có trong `testMatch` của
 * project `hardhat`), vai Nhà đầu tư; KHÔNG tạo lệnh, không đổi dữ liệu. Tệp chạy trước `investor-withdraw.spec.ts` nên
 * số dư có thể là 0: không giả định số dư. Luồng tạo lệnh, mã một lần, kết quả do `investor-withdraw.spec.ts` phủ.
 */

const INVESTOR = sampleWallets.wallets.NDT001;
const RECEIVER = sampleWallets.wallets.NB001;

async function actAsInvestor(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    { name: 'bidv_channel', value: 'investor', url: baseURL },
    { name: 'bidv_role', value: 'INVESTOR', url: baseURL },
  ]);
}

/** "Tải xong" như nhau ở mốc và nhánh mới: `networkidle`, rồi `main` hết chữ "Đang đọc số dư". */
async function openWithdraw(page: Page) {
  await page.goto('/withdraw');
  await page.waitForLoadState('networkidle');
  await expect.poll(async () => (await page.getByRole('main').innerText()).includes('Đang đọc số dư')).toBe(false);
}

/**
 * Số `role` trong `main` đo trên `release/ui-v2` @ 400ffcc TRƯỚC khi sửa, bằng chính ca 1 chạy trên máy chủ MỚI trong
 * lượt e2e mock đầy đủ (spec chép vào bản mốc).
 */
const ROLE_COUNTS = { status: 0, note: 0, alert: 0 };

async function countRoles(page: Page) {
  const main = page.getByRole('main');
  const count = (name: string) => main.locator(`[role="${name}"]`).count();
  const counts = { status: await count('status'), note: await count('note'), alert: await count('alert') };
  console.log(`FE-UX-04d role counts /withdraw: ${JSON.stringify(counts)}`);
  return counts;
}

const cardWith = (page: Page, selector: string) =>
  page.getByRole('main').locator('[data-slot="card"]').filter({ has: page.locator(selector) });

test.describe('FE-UX-04d Rút VNDB', () => {
  test('ca 1: 1440 px bố cục, ô Số dư sau rút dính đáy thẻ, không hiệu ứng nổi; role bằng mốc', async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await actAsInvestor(context, baseURL!);
    await openWithdraw(page);
    const roles = await countRoles(page);
    const main = page.getByRole('main');

    await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(main.getByRole('heading', { level: 1 })).toHaveText('Rút VNDB');
    const form = page.getByRole('form', { name: 'Biểu mẫu rút VNDB' });
    await expect(form.getByLabel('Ví gửi')).toHaveValue(INVESTOR);

    const formCard = (await cardWith(page, 'form[aria-label="Biểu mẫu rút VNDB"]').boundingBox())!;
    const calcCard = cardWith(page, '[data-testid="payment-balance"]');
    const calcBox = (await calcCard.boundingBox())!;
    expect(formCard.x, 'Thông tin lệnh rút bên trái Hệ thống tính').toBeLessThan(calcBox.x);
    expect(Math.abs(formCard.y - calcBox.y), 'hai thẻ cùng đỉnh').toBeLessThan(24);

    const kpi = calcCard.locator('[data-kpi][data-tone="au"]');
    await expect(kpi).toContainText('Số dư sau rút');
    const kpiBox = (await kpi.boundingBox())!;
    expect(calcBox.y + calcBox.height - (kpiBox.y + kpiBox.height), 'ô dính đáy thẻ').toBeLessThanOrEqual(40);
    const dlBox = (await calcCard.locator('dl').boundingBox())!;
    expect(formCard.height, 'thẻ Thông tin lệnh rút cao hơn').toBeGreaterThan(calcBox.height - 1);
    expect(kpiBox.y - (dlBox.y + dlBox.height), 'ô không nằm ngay sau dl').toBeGreaterThan(24);

    await kpi.hover();
    await page.waitForTimeout(500);
    const style = await kpi.evaluate((element) => {
      const computed = getComputedStyle(element);
      return { transform: computed.transform, boxShadow: computed.boxShadow };
    });
    expect(style).toEqual({ transform: 'none', boxShadow: 'none' });

    await expect(page.locator('[data-wallet-bound="true"]')).toBeVisible();
    const table = page.getByRole('table', { name: 'Lệnh rút của tôi' });
    const empty = main.locator('[data-slot="empty-state"]', { hasText: 'Chưa có lệnh rút VNDB nào' });
    await expect(table.or(empty)).toBeVisible();
    expect(roles).toEqual(ROLE_COUNTS);
  });

  test('ca 2: vượt số dư báo lỗi, khoá nút; 390 px Hệ thống tính dưới nút, hai thẻ rộng bằng nhau', async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await actAsInvestor(context, baseURL!);
    await openWithdraw(page);

    await page.getByLabel('Ví nhận').fill(RECEIVER);
    await page.getByLabel('Mục đích').fill('Kiểm bố cục, không gửi');
    await page.getByLabel('Số tiền rút (VNDB)').fill('999999999999999');
    await expect(
      page.getByRole('main').locator('[role="alert"]').filter({ hasText: 'Vượt số dư: chỉ rút được tối đa' }),
    ).toHaveCount(1);
    const submit = page.getByRole('button', { name: 'Tạo lệnh rút' });
    await expect(submit).toBeDisabled();

    await page.setViewportSize({ width: 390, height: 900 });
    const submitBox = (await submit.boundingBox())!;
    const formCard = (await cardWith(page, 'form[aria-label="Biểu mẫu rút VNDB"]').boundingBox())!;
    const calcCard = (await cardWith(page, '[data-testid="payment-balance"]').boundingBox())!;
    expect(calcCard.y, 'Hệ thống tính dưới nút Tạo lệnh rút').toBeGreaterThan(submitBox.y);
    expect(Math.abs(calcCard.width - formCard.width), 'hai thẻ rộng bằng nhau').toBeLessThan(4);
  });

  test('ca 3: 1440 và 390 px không tràn ngang trong main, không lỗi console, lỗi trang, cảnh báo hydrate', async ({ browser, baseURL }) => {
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
      await openWithdraw(p);
      const overflow = await p.getByRole('main').evaluate((main) => main.scrollWidth - main.clientWidth);
      expect(overflow, `${width}`).toBeLessThanOrEqual(0);
      expect(hydration, `${width}`).toEqual([]);
      expect(errors, `${width}`).toEqual([]);
      await ctx.close();
    }
  });

  /** Số action khi mở màn (QĐ-2), cách đếm như `fix-04-noi-du-lieu-that.spec.ts`, thêm chờ 1 giây. */
  test('ca 4: mở /withdraw đúng 1 action', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await actAsInvestor(ctx, baseURL!);
    const p = await ctx.newPage();
    let actions = 0;
    p.on('request', (request) => {
      if (request.method() === 'POST' && request.headers()['next-action']) actions += 1;
    });
    await p.goto('/withdraw');
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(1000);
    expect(actions).toBe(1);
    await ctx.close();
  });
});
