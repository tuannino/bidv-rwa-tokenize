import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * FE-UX-04c: Quản lý lệnh (`/orders`), Chi tiết lệnh (`/orders/[id]`), Ví của tôi (`/wallet`). Chỉ chạy trên project
 * `mock` (không có trong `testMatch` của project `hardhat`), vai Nhà đầu tư; KHÔNG đặt lệnh, không đổi dữ liệu. Mã lệnh
 * giả không tồn tại. Luồng có lệnh thật, chi tiết có dữ liệu, ví đã kết nối do `ops-transactions`, `permit-order` phủ.
 */

const FAKE_ORDER = '00000000-0000-4000-8000-000000000000';

async function actAsInvestor(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    { name: 'bidv_channel', value: 'investor', url: baseURL },
    { name: 'bidv_role', value: 'INVESTOR', url: baseURL },
  ]);
}

/**
 * "Tải xong" như nhau ở mốc và nhánh mới: `networkidle`, rồi `main` hết chữ "Đang tải", "Đang kiểm tra". Bỏ phần
 * tử `select` khi đọc chữ: ô lọc Trạng thái của `/orders` có lựa chọn "Đang kiểm tra" (nhãn trạng thái lệnh).
 */
async function openPage(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  const mainText = () =>
    page.getByRole('main').evaluate((main) => {
      const copy = main.cloneNode(true) as HTMLElement;
      copy.querySelectorAll('select').forEach((select) => select.remove());
      return copy.textContent ?? '';
    });
  await expect.poll(async () => /Đang (tải|kiểm tra)/.test(await mainText()), { message: path }).toBe(false);
}

/** Chờ hydrate trước mọi `selectOption` (cách `wallet-connect.spec.ts:33`). */
async function waitForHydration(page: Page) {
  await expect(page.locator('button[title^="Chuyển sang"]')).toBeVisible();
}

/**
 * Số `role` trong `main` đo trên `release/ui-v2` @ e6604d0 TRƯỚC khi sửa, bằng chính ca 1, ca 2 chạy trên máy chủ MỚI
 * trong lượt e2e mock đầy đủ (spec chép vào bản mốc).
 */
type RoleCount = { status: number; note: number; alert: number };
const ROLE_COUNTS: Record<'/orders' | '/wallet', RoleCount> = {
  '/orders': { status: -1, note: -1, alert: -1 },
  '/wallet': { status: -1, note: -1, alert: -1 },
};

async function countRoles(page: Page, path: string) {
  const main = page.getByRole('main');
  const count = (name: string) => main.locator(`[role="${name}"]`).count();
  const counts = { status: await count('status'), note: await count('note'), alert: await count('alert') };
  console.log(`FE-UX-04c role counts ${path}: ${JSON.stringify(counts)}`);
  return counts;
}

const FILTERS = ['Mã lệnh', 'Chiều', 'Trạng thái', 'Từ ngày', 'Đến ngày'];
const filterBoxes = async (page: Page) =>
  Promise.all(FILTERS.map(async (label) => (await page.getByRole('main').getByLabel(label, { exact: true }).boundingBox())!));

test.describe('FE-UX-04c Quản lý lệnh, Chi tiết lệnh, Ví của tôi', () => {
  test('ca 1: /orders tiêu đề, dòng mô phỏng là Alert note, bộ lọc 5 ô; role bằng mốc; lọc mã giả ra EmptyState', async ({
    page,
    context,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await actAsInvestor(context, baseURL!);
    await openPage(page, '/orders');
    const roles = await countRoles(page, '/orders');
    const main = page.getByRole('main');

    await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(main.getByRole('heading', { level: 1 })).toHaveText('Quản lý lệnh');
    await expect(main.locator('[role="note"]')).toHaveCount(1);
    await expect(main.locator('[data-slot="alert"][role="note"]')).toHaveCount(1);
    await expect(main.locator('[role="note"]')).toContainText('Không cần kết nối ví trình duyệt');

    const wide = await filterBoxes(page);
    for (const box of wide) expect(Math.abs(box.y - wide[0].y), 'năm ô lọc cùng hàng ở 1440 px').toBeLessThan(4);

    await page.setViewportSize({ width: 390, height: 900 });
    const narrow = await filterBoxes(page);
    for (let i = 1; i < narrow.length; i += 1) {
      expect(narrow[i].y, 'ở 390 px ô sau nằm dưới ô trước').toBeGreaterThan(narrow[i - 1].y + narrow[i - 1].height - 1);
      expect(Math.abs(narrow[i].x - narrow[0].x), 'ở 390 px một cột').toBeLessThan(4);
    }

    await main.getByLabel('Mã lệnh', { exact: true }).fill(FAKE_ORDER);
    await expect(main.locator('[data-slot="empty-state"]')).toContainText('Không có lệnh nào khớp bộ lọc.');
    expect(roles).toEqual(ROLE_COUNTS['/orders']);
  });

  test('ca 2: /wallet chế độ mô phỏng, ghi chú phạm vi là Alert không role; hardhat-local chưa có ví; role bằng mốc', async ({
    page,
    context,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await actAsInvestor(context, baseURL!);
    await openPage(page, '/wallet');
    await waitForHydration(page);
    const roles = await countRoles(page, '/wallet');
    const main = page.getByRole('main');

    await expect(main.getByRole('heading', { name: 'Đang ở chế độ mô phỏng' })).toBeVisible();
    await expect(main.locator('[role="alert"]')).toHaveCount(0);
    const scope = main.locator('[data-slot="alert"]', { hasText: 'chỉ dùng cho thao tác của nhà đầu tư' });
    await expect(scope).toHaveCount(1);
    expect(await scope.getAttribute('role')).toBeNull();
    const text = await main.innerText();
    expect(text).not.toContain('\u00b7');
    expect(text).not.toContain('\u2014');

    await page.setViewportSize({ width: 390, height: 900 });
    const mockCard = (await main
      .locator('[data-slot="card"]')
      .filter({ has: page.getByRole('heading', { name: 'Đang ở chế độ mô phỏng' }) })
      .boundingBox())!;
    const scopeBox = (await scope.boundingBox())!;
    expect(scopeBox.y, 'ghi chú phạm vi dưới thẻ mô phỏng').toBeGreaterThanOrEqual(mockCard.y + mockCard.height - 1);
    expect(Math.abs(scopeBox.width - mockCard.width), 'hai khối rộng bằng nhau').toBeLessThan(4);

    await page.locator('#chain-selector').selectOption('hardhat-local');
    await expect(main.getByRole('heading', { name: 'Chưa có ví trong trình duyệt' })).toBeVisible();
    expect(roles).toEqual(ROLE_COUNTS['/wallet']);
  });

  test('ca 3: /wallet có ví chưa kết nối: ba ý không chấm giữa, nút Kết nối ví', async ({ page, context, baseURL }) => {
    await actAsInvestor(context, baseURL!);
    await page.addInitScript(() => {
      Object.defineProperty(window, 'ethereum', {
        value: {
          isMetaMask: true,
          request: async ({ method }: { method: string }) => {
            if (method === 'eth_accounts') return [];
            if (method === 'eth_chainId') return '0x7a69';
            throw Object.assign(new Error('không hỗ trợ trong e2e'), { code: 4200 });
          },
          on: () => {},
          removeListener: () => {},
        },
        configurable: true,
      });
    });
    await page.goto('/wallet');
    await waitForHydration(page);
    await page.locator('#chain-selector').selectOption('hardhat-local');

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Chưa kết nối ví' })).toBeVisible();
    const items = main
      .locator('[data-slot="card"]')
      .filter({ has: page.getByRole('heading', { name: 'Chưa kết nối ví' }) })
      .locator('li');
    await expect(items).toHaveCount(3);
    expect((await items.first().innerText()).trim().startsWith('Bước này chỉ đọc địa chỉ ví')).toBe(true);
    await expect(main.getByRole('button', { name: /Kết nối ví/ })).toBeVisible();
  });

  test('ca 4: ba màn ở 1440 và 390 px không tràn ngang trong main, không lỗi console, lỗi trang, cảnh báo hydrate', async ({
    browser,
    baseURL,
  }) => {
    for (const width of [1440, 390]) {
      for (const path of ['/orders', `/orders/${FAKE_ORDER}`, '/wallet']) {
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
        const overflow = await p.getByRole('main').evaluate((main) => main.scrollWidth - main.clientWidth);
        expect(overflow, `${path} ${width}`).toBeLessThanOrEqual(0);
        expect(hydration, `${path} ${width}`).toEqual([]);
        expect(errors, `${path} ${width}`).toEqual([]);
        await ctx.close();
      }
    }
  });

  /** Số action khi mở màn (QĐ-2), cách đếm như `fix-04-noi-du-lieu-that.spec.ts`, thêm chờ 1 giây. */
  test('ca 5: số action khi mở màn trên mock', async ({ browser, baseURL }) => {
    const expected: [string, number][] = [
      ['/orders', 1],
      [`/orders/${FAKE_ORDER}`, 1],
      ['/wallet', 0],
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
