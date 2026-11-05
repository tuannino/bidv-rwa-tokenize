import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import sampleWallets from '../../packages/shared/src/sample-wallets.json';

/**
 * FE-UX-06b: `/mint` (Phát hành dữ liệu thử), `/audit` (Sổ kiểm toán), khối thông tin token ở `/draft`. Chỉ chạy trên
 * project `mock` (không có trong `testMatch` của project `hardhat`), vai Giao dịch viên. Tệp chạy trước
 * `maker-checker.spec.ts`, `mint.spec.ts`. KHÔNG bấm phát hành với ví đã whitelist; bước KYC chỉ ở ca 2 với ví NDT001 (ví này
 * có thể đã hoặc chưa whitelist tuỳ thứ tự chạy, sau khi bấm phải là `whitelist=true`). Phần đếm (`role`, action) là các
 * test tên bắt đầu "mốc:", chỉ dựa vào chữ `h1` và cách đếm để chạy được trên bản build mốc bằng `--grep mốc:`.
 */

const INVESTOR = sampleWallets.wallets.NDT001;
/** Ví Hardhat #2, chưa whitelist trên mock: máy chủ từ chối phát hành, không gửi giao dịch (như `mint.spec.ts:91-99`). */
const NOT_WHITELISTED = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

type OpsPath = '/mint' | '/audit';
const TITLES: Record<OpsPath, RegExp> = {
  '/mint': /Phát hành token dự án điện gió/,
  '/audit': /Sổ kiểm toán/,
};

async function actAsTeller(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    { name: 'bidv_channel', value: 'teller', url: baseURL },
    { name: 'bidv_role', value: 'TELLER', url: baseURL },
  ]);
}

/** "Tải xong" như nhau ở mốc và nhánh mới: `networkidle` cộng 1 giây (debounce 300 ms của `/mint`). */
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

/**
 * Số `role` trong `main` và số action khi mở màn đo trên `release/ui-v2` @ d2a5bca TRƯỚC khi sửa, bằng các test "mốc:"
 * của tệp này chạy trên máy chủ MỚI (spec chép vào bản mốc).
 */
type RoleCount = { status: number; note: number; alert: number };
const ROLE_COUNTS: Record<OpsPath, RoleCount> = {
  '/mint': { status: 0, note: 0, alert: 0 },
  '/audit': { status: 0, note: 0, alert: 0 },
};
const OPEN_ACTIONS: Record<OpsPath, number> = { '/mint': 1, '/audit': 0 };

const cardWithHeading = (page: Page, name: string | RegExp) =>
  page
    .getByRole('main')
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole('heading', { name, level: 2 }) });
const fits = (locator: ReturnType<Page['locator']>) =>
  locator.evaluate((element) => element.scrollWidth <= element.clientWidth + 1);

test.describe('FE-UX-06b Phát hành dữ liệu thử, Sổ kiểm toán, khối thông tin token', () => {
  test('mốc: role trong main ở /mint và /audit', async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await actAsTeller(context, baseURL!);
    for (const path of ['/mint', '/audit'] as const) {
      await open(page, path);
      await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText(TITLES[path]);
      const main = page.getByRole('main');
      const count = (name: string) => main.locator(`[role="${name}"]`).count();
      const counts = { status: await count('status'), note: await count('note'), alert: await count('alert') };
      console.log(`FE-UX-06b role counts ${path}: ${JSON.stringify(counts)}`);
      expect(counts, path).toEqual(ROLE_COUNTS[path]);
    }
  });

  /** Cách đếm như `fix-04-noi-du-lieu-that.spec.ts`, thêm chờ 1 giây. */
  test('mốc: số action khi mở /mint và /audit', async ({ browser, baseURL }) => {
    for (const path of ['/mint', '/audit'] as const) {
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
      console.log(`FE-UX-06b open actions ${path}: ${actions}`);
      expect(actions, path).toBe(OPEN_ACTIONS[path]);
      await ctx.close();
    }
  });

  test('ca 1: /mint thẻ Nhà đầu tư trái thẻ Trạng thái on-chain, ba heading cấp 2; /audit heading, bảng hoặc ô rỗng; 390 px xếp dọc', async ({
    page,
    context,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await actAsTeller(context, baseURL!);
    await open(page, '/mint');
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
    for (const name of ['Nhà đầu tư', 'Trạng thái on-chain', 'Lịch sử giao dịch (mock)']) {
      await expect(main.getByRole('heading', { name, level: 2, exact: true })).toHaveCount(1);
    }
    const investor = cardWithHeading(page, 'Nhà đầu tư');
    const onchain = cardWithHeading(page, 'Trạng thái on-chain');
    const left = (await investor.boundingBox())!;
    const right = (await onchain.boundingBox())!;
    expect(left.x, 'Nhà đầu tư bên trái').toBeLessThan(right.x);
    expect(Math.abs(left.y - right.y), 'cùng đỉnh').toBeLessThan(4);
    expect(left.width, 'thẻ trái rộng hơn').toBeGreaterThan(right.width);
    await expect(main.locator('[role="status"]')).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 900 });
    const narrowLeft = (await investor.boundingBox())!;
    const narrowRight = (await onchain.boundingBox())!;
    expect(narrowRight.y, 'Trạng thái on-chain dưới Nhà đầu tư').toBeGreaterThan(narrowLeft.y + narrowLeft.height - 1);
    expect(Math.abs(narrowRight.width - narrowLeft.width), 'rộng bằng nhau').toBeLessThan(4);

    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, '/audit');
    await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(main.getByRole('heading', { level: 1 })).toHaveText('Sổ kiểm toán');
    await expect(main.getByRole('heading', { name: 'Bản ghi gần nhất', level: 2 })).toHaveCount(1);
    await expect(main.getByRole('table').or(main.locator('[data-slot="empty-state"]'))).toBeVisible();
  });

  test('ca 2: KYC cho kết quả một status, nhãn đã KYC xanh; khối thông tin token không cắt chữ; 390 px lỗi ví chưa whitelist không tràn', async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await actAsTeller(context, baseURL!);
    await open(page, '/mint');
    const main = page.getByRole('main');
    await page.getByLabel('Ví nhà đầu tư').fill(INVESTOR);
    const onchain = cardWithHeading(page, 'Trạng thái on-chain');
    await expect(onchain).toContainText('Số dư WPT');
    await main.getByRole('button', { name: /KYC \+ Whitelist/ }).click();
    const status = main.locator('[role="status"]');
    await expect(status).toHaveCount(1);
    await expect(status).toContainText('whitelist=true');
    expect(await status.innerText()).not.toContain('\u00b7');
    await expect(onchain.getByText('đã KYC', { exact: true })).toHaveClass(/\bbg-ok-bg\b/);
    await expect(main.getByRole('button', { name: /Phát hành/ })).toHaveCount(1);

    await open(page, '/draft');
    const card = page.getByLabel('Thẻ tạo token');
    await card.getByLabel('Mã hoặc ký hiệu token').fill('WPT');
    const block = card.getByLabel('Khối thông tin token');
    await expect(block).toContainText('Trần phát hành');
    const values = block.locator('dd');
    for (let i = 0; i < (await values.count()); i += 1) {
      expect(await fits(values.nth(i)), `dd ${i} không bị cắt`).toBe(true);
      await expect(values.nth(i)).not.toHaveClass(/\btruncate\b/);
    }
    const wallet = block.locator('dt', { hasText: 'Ví thanh toán' }).locator('xpath=following-sibling::dd[1]');
    const walletText = (await wallet.innerText()).trim();
    if (/^0x[0-9a-f]{40}$/i.test(walletText)) expect(walletText).toHaveLength(42);

    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
    await actAsTeller(ctx, baseURL!);
    const p = await ctx.newPage();
    await open(p, '/mint');
    await p.getByLabel('Ví nhà đầu tư').fill(NOT_WHITELISTED);
    await p.getByRole('main').getByRole('button', { name: /Phát hành/ }).click();
    const error = p.getByRole('main').locator('[role="status"]');
    await expect(error).toContainText('chưa được whitelist');
    expect(await fits(error), 'kết quả lỗi không tràn').toBe(true);
    expect(await fits(cardWithHeading(p, 'Nhà đầu tư')), 'thẻ Nhà đầu tư không tràn').toBe(true);
    await ctx.close();
  });

  test('ca 3: /mint, /audit, /draft ở 1440 và 390 px không tràn ngang trong main, không lỗi console, lỗi trang, cảnh báo hydrate', async ({
    browser,
    baseURL,
  }) => {
    for (const width of [1440, 390]) {
      for (const path of ['/mint', '/audit', '/draft']) {
        const ctx = await browser.newContext({ viewport: { width, height: 900 } });
        await actAsTeller(ctx, baseURL!);
        const p = await ctx.newPage();
        const hydration: string[] = [];
        const errors: string[] = [];
        p.on('console', (message) => {
          if (/hydrat/i.test(message.text())) hydration.push(message.text());
          if (message.type() === 'error') errors.push(message.text());
        });
        p.on('pageerror', (e) => errors.push(e.message));
        await open(p, path);
        const overflow = await p.getByRole('main').evaluate((main) => main.scrollWidth - main.clientWidth);
        expect(overflow, `${path} ${width}`).toBeLessThanOrEqual(0);
        expect(hydration, `${path} ${width}`).toEqual([]);
        expect(errors, `${path} ${width}`).toEqual([]);
        await ctx.close();
      }
    }
  });
});
