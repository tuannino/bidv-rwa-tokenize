import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

/**
 * FE-UX-05b: Thông tin tài khoản (`/account`). Chỉ chạy trên project `mock` (không có trong `testMatch` của project
 * `hardhat`); KHÔNG đổi dữ liệu. Vai đặt bằng cookie như `account-info.spec.ts`. Nội dung từng vai, ví mock
 * "Đã định danh", màn chỉ đọc do `account-info.spec.ts` phủ.
 */

type AccountRole = 'INVESTOR' | 'SELLER' | 'TELLER' | 'CONTROLLER';
const CHANNEL: Record<AccountRole, string> = {
  INVESTOR: 'investor',
  SELLER: 'seller',
  TELLER: 'teller',
  CONTROLLER: 'controller',
};
const CUSTOMER: Record<AccountRole, boolean> = { INVESTOR: true, SELLER: true, TELLER: false, CONTROLLER: false };

async function actAs(context: BrowserContext, baseURL: string, role: AccountRole) {
  await context.addCookies([
    { name: 'bidv_channel', value: CHANNEL[role], url: baseURL },
    { name: 'bidv_role', value: role, url: baseURL },
  ]);
}

/** "Tải xong" như nhau ở mốc và nhánh mới: `networkidle`; vai khách hàng chờ thêm ô ví hiện. */
async function openAccount(page: Page, role: AccountRole) {
  await page.goto('/account');
  await page.waitForLoadState('networkidle');
  if (CUSTOMER[role]) await expect(page.locator('[data-payment-wallet]')).toBeVisible();
}

/**
 * Số `role` trong `main` đo trên `release/ui-v2` @ d5e6b0e TRƯỚC khi sửa, bằng chính ca 1, ca 2 chạy trên máy chủ MỚI
 * trong lượt e2e mock đầy đủ (spec chép vào bản mốc).
 */
type RoleCount = { status: number; note: number; alert: number };
const ROLE_COUNTS: Record<'INVESTOR' | 'SELLER' | 'TELLER', RoleCount> = {
  INVESTOR: { status: -1, note: -1, alert: -1 },
  SELLER: { status: -1, note: -1, alert: -1 },
  TELLER: { status: -1, note: -1, alert: -1 },
};

async function countRoles(page: Page, role: AccountRole) {
  const main = page.getByRole('main');
  const count = (name: string) => main.locator(`[role="${name}"]`).count();
  const counts = { status: await count('status'), note: await count('note'), alert: await count('alert') };
  console.log(`FE-UX-05b role counts ${role}: ${JSON.stringify(counts)}`);
  return counts;
}

const hero = (page: Page) => page.getByRole('main').locator('[data-account-hero]');
const cardWithHeading = (page: Page, name: string, level = 2) =>
  page
    .getByRole('main')
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole('heading', { name, level }) });

/** Hai khối cùng hàng: lệch đỉnh dưới 4 px, khối trái nằm bên trái, chiều cao lệch dưới 2 px. */
async function sameRow(left: Locator, right: Locator, what: string) {
  const a = (await left.boundingBox())!;
  const b = (await right.boundingBox())!;
  expect(Math.abs(a.y - b.y), `${what}: cùng đỉnh`).toBeLessThan(4);
  expect(a.x, `${what}: khối trái bên trái`).toBeLessThan(b.x);
  expect(Math.abs(a.height - b.height), `${what}: cao bằng nhau`).toBeLessThan(2);
}

test.describe('FE-UX-05b Thông tin tài khoản', () => {
  test('ca 1: Nhà đầu tư 1440 px ô xanh và ba thẻ đúng lưới, ô Hạn mức vàng; role bằng mốc; 390 px một cột', async ({
    page,
    context,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await actAs(context, baseURL!, 'INVESTOR');
    await openAccount(page, 'INVESTOR');
    const roles = await countRoles(page, 'INVESTOR');
    const main = page.getByRole('main');

    await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(main.getByRole('heading', { level: 1 })).toHaveText('Thông tin tài khoản');
    for (const text of ['Nguyễn Văn An', 'NDT001', 'Nhà đầu tư', 'NA']) await expect(hero(page)).toContainText(text);

    const personal = cardWithHeading(page, 'Thông tin cá nhân');
    const account = cardWithHeading(page, 'Thông tin tài khoản');
    const risk = cardWithHeading(page, 'Hồ sơ định danh và rủi ro');
    await sameRow(hero(page), personal, 'ô xanh và Thông tin cá nhân');
    await sameRow(account, risk, 'Thông tin tài khoản và Hồ sơ định danh và rủi ro');

    const tiles = risk.locator('dl > div');
    const first = await Promise.all([0, 1, 2].map(async (i) => (await tiles.nth(i).boundingBox())!));
    for (const box of first) expect(Math.abs(box.y - first[0].y), 'ba ô đầu thẻ rủi ro cùng hàng').toBeLessThan(4);
    await expect(tiles.filter({ hasText: 'Hạn mức giao dịch mỗi ngày' })).toHaveClass(/tile-gold/);
    await expect(main.locator('[data-wallet-bound="true"]')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 900 });
    const boxes = await Promise.all([hero(page), personal, account, risk].map(async (l) => (await l.boundingBox())!));
    for (let i = 1; i < boxes.length; i += 1) {
      expect(Math.abs(boxes[i].x - boxes[0].x), 'ở 390 px cùng lề trái').toBeLessThan(2);
      expect(Math.abs(boxes[i].width - boxes[0].width), 'ở 390 px rộng bằng nhau').toBeLessThan(2);
      expect(boxes[i].y, 'ở 390 px ô xanh trên cùng, thẻ sau dưới thẻ trước').toBeGreaterThan(boxes[i - 1].y);
    }
    expect(roles).toEqual(ROLE_COUNTS.INVESTOR);
  });

  test('ca 2: Người bán ô xanh pháp nhân, thẻ có người liên hệ; Giao dịch viên ô xanh và thẻ cán bộ cùng hàng; role bằng mốc', async ({
    browser,
    baseURL,
  }) => {
    const seller = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await actAs(seller, baseURL!, 'SELLER');
    const s = await seller.newPage();
    await openAccount(s, 'SELLER');
    const sellerRoles = await countRoles(s, 'SELLER');
    for (const text of ['Tên pháp nhân', 'Công ty Cổ phần Điện gió An Viên', 'NB001', 'AV']) {
      await expect(hero(s)).toContainText(text);
    }
    const legal = cardWithHeading(s, 'Thông tin pháp nhân');
    await expect(legal).toContainText('Người liên hệ');
    await expect(legal).toContainText('Trần Thị Bình');
    await seller.close();

    const teller = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await actAs(teller, baseURL!, 'TELLER');
    const t = await teller.newPage();
    await openAccount(t, 'TELLER');
    const tellerRoles = await countRoles(t, 'TELLER');
    for (const text of ['Lê Minh Cường', 'Giao dịch viên', 'LC']) await expect(hero(t)).toContainText(text);
    const staff = cardWithHeading(t, 'Thông tin cán bộ');
    await expect(staff).toContainText('GDV001');
    await sameRow(hero(t), staff, 'ô xanh và Thông tin cán bộ');
    await expect(t.getByRole('main').locator('[data-payment-wallet]')).toHaveCount(0);
    await teller.close();

    expect(sellerRoles).toEqual(ROLE_COUNTS.SELLER);
    expect(tellerRoles).toEqual(ROLE_COUNTS.TELLER);
  });

  test('ca 3: bốn vai ở 1440 và 390 px không tràn ngang trong main, không lỗi console, lỗi trang, cảnh báo hydrate', async ({
    browser,
    baseURL,
  }) => {
    for (const width of [1440, 390]) {
      for (const role of ['INVESTOR', 'SELLER', 'TELLER', 'CONTROLLER'] as const) {
        const ctx = await browser.newContext({ viewport: { width, height: 900 } });
        await actAs(ctx, baseURL!, role);
        const p = await ctx.newPage();
        const hydration: string[] = [];
        const errors: string[] = [];
        p.on('console', (message) => {
          if (/hydrat/i.test(message.text())) hydration.push(message.text());
          if (message.type() === 'error') errors.push(message.text());
        });
        p.on('pageerror', (error) => errors.push(error.message));
        await openAccount(p, role);
        const overflow = await p.getByRole('main').evaluate((main) => main.scrollWidth - main.clientWidth);
        expect(overflow, `${role} ${width}`).toBeLessThanOrEqual(0);
        expect(hydration, `${role} ${width}`).toEqual([]);
        expect(errors, `${role} ${width}`).toEqual([]);
        await ctx.close();
      }
    }
  });

  /** Số action khi mở màn (QĐ-2), cách đếm như `fix-04-noi-du-lieu-that.spec.ts`, thêm chờ 1 giây. */
  test('ca 4: số action khi mở /account theo vai', async ({ browser, baseURL }) => {
    const expected: [AccountRole, number][] = [
      ['INVESTOR', 1],
      ['SELLER', 1],
      ['TELLER', 0],
      ['CONTROLLER', 0],
    ];
    for (const [role, count] of expected) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await actAs(ctx, baseURL!, role);
      const p = await ctx.newPage();
      let actions = 0;
      p.on('request', (request) => {
        if (request.method() === 'POST' && request.headers()['next-action']) actions += 1;
      });
      await p.goto('/account');
      await p.waitForLoadState('networkidle');
      await p.waitForTimeout(1000);
      expect(actions, role).toBe(count);
      await ctx.close();
    }
  });
});
