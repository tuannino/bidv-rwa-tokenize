import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * UIUX-02: ô chọn token ở đầu màn, bỏ dòng mô tả, gợi ý khi dừng chuột trên menu, tiêu đề Tổng quan.
 * Chain mock. Ô chọn định vị bằng `#token-scope` (nhiều nhãn khác có chữ "token").
 */
type Role = 'TELLER' | 'CONTROLLER' | 'INVESTOR' | 'SELLER';
const CHANNEL: Record<Role, string> = {
  TELLER: 'teller',
  CONTROLLER: 'controller',
  INVESTOR: 'investor',
  SELLER: 'seller',
};

async function actAs(context: BrowserContext, baseURL: string, role: Role) {
  await context.addCookies([
    { name: 'bidv_channel', value: CHANNEL[role], url: baseURL },
    { name: 'bidv_role', value: role, url: baseURL },
  ]);
}

/** Nút đổi theme chỉ hiện sau khi mount: có nó là trang đã hydrate, thao tác bàn phím mới có tác dụng. */
async function waitForHydration(page: Page) {
  await expect(page.locator('button[title^="Chuyển sang"]')).toBeVisible();
}

const SCOPE_SCREENS: [Role, string][] = [
  ['TELLER', '/draft'],
  ['CONTROLLER', '/approvals'],
  ['CONTROLLER', '/config'],
  ['CONTROLLER', '/vault'],
  ['CONTROLLER', '/distribution'],
  ['CONTROLLER', '/recall'],
  ['INVESTOR', '/trade'],
  ['INVESTOR', '/portfolio'],
  ['SELLER', '/seller'],
  ['SELLER', '/seller/withdraw'],
];

const listbox = (page: Page) => page.getByRole('listbox');
const option = (page: Page, symbol: string) => listbox(page).getByRole('option').filter({ hasText: symbol });

test.describe('UIUX-02 ô chọn token', () => {
  test('mười màn có ô chọn WPT, danh sách có dòng TCC chưa hỗ trợ', async ({ page, context, baseURL }) => {
    for (const [role, path] of SCOPE_SCREENS) {
      await actAs(context, baseURL!, role);
      await page.goto(path);
      const input = page.locator('#token-scope');
      await expect(input, path).toBeVisible();
      await expect(input, path).toHaveValue('WPT');
      await expect(input, path).toBeEnabled();
      await waitForHydration(page);
      await input.click();
      await expect(listbox(page), path).toBeVisible();
      await expect(option(page, 'WPT'), path).toBeVisible();
      const tcc = option(page, 'TCC');
      await expect(tcc, path).toHaveAttribute('aria-disabled', 'true');
      await expect(tcc, path).toContainText('(chưa hỗ trợ)');
      await page.keyboard.press('Escape');
    }
  });

  test('gõ lọc, dòng khoá, Esc, Enter, mũi tên, bấm ra ngoài ở màn Vault', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'CONTROLLER');
    await page.goto('/vault');
    await waitForHydration(page);
    const input = page.locator('#token-scope');
    const options = listbox(page).getByRole('option');

    await input.click();
    await page.keyboard.type('WPT');
    await expect(options).toHaveCount(1);
    await expect(options.first()).toContainText('WPT');
    await page.keyboard.press('Escape');

    await input.click();
    await page.keyboard.type('tc');
    await expect(options).toHaveCount(1);
    await expect(options.first()).toContainText('TCC');
    await option(page, 'TCC').click({ force: true });
    await expect(listbox(page)).toBeVisible();
    await expect(input).toHaveValue('tc');

    await input.click();
    await page.keyboard.type('zz');
    await expect(listbox(page)).toContainText('Không có token khớp');
    await page.keyboard.press('Escape');
    await expect(input).toHaveValue('WPT');
    await expect(listbox(page)).toHaveCount(0);

    await input.click();
    await page.keyboard.type('w');
    await page.keyboard.press('Enter');
    await expect(input).toHaveValue('WPT');
    await expect(listbox(page)).toHaveCount(0);

    await input.click();
    await page.keyboard.type('t');
    await expect(options.nth(0)).toContainText('TCC');
    await expect(options.nth(1)).toContainText('WPT');
    await page.keyboard.press('ArrowDown');
    await expect(input).toHaveAttribute('aria-activedescendant', (await options.nth(1).getAttribute('id'))!);
    await page.keyboard.press('Enter');
    await expect(input).toHaveValue('WPT');

    await input.click();
    await page.keyboard.type('tc');
    await page.keyboard.press('Enter');
    await expect(listbox(page)).toBeVisible();
    await page.getByRole('heading', { name: 'Vault thanh toán SPV' }).click();
    await expect(input).toHaveValue('WPT');
    await expect(listbox(page)).toHaveCount(0);

    // Bàn phím từ trạng thái đóng.
    await input.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(input).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(listbox(page)).toBeVisible();
    await expect(input).toHaveAttribute('aria-activedescendant', (await option(page, 'WPT').getAttribute('id'))!);
    await page.keyboard.press('Enter');
    await expect(input).toHaveValue('WPT');
    await expect(listbox(page)).toHaveCount(0);
    await expect(input).toBeFocused();
  });

  test('màn hình nhỏ: danh sách nằm trọn trong khung, trang không cuộn ngang', async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await actAs(context, baseURL!, 'CONTROLLER');
    await page.goto('/vault');
    await waitForHydration(page);
    const input = page.locator('#token-scope');
    await input.click();
    const box = await listbox(page).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    await option(page, 'WPT').click();
    await expect(input).toHaveValue('WPT');
    await expect(listbox(page)).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

const APPROVAL_HINT = 'Duyệt hoặc từ chối yêu cầu phát hành, huỷ token do Giao dịch viên lập.';
const AUDIT_HINT = 'Xem lịch sử mọi thao tác và lần kiểm quyền trong hệ thống.';

/** Màn ở bảng QĐ-7, vai được vào, câu mở đầu của dòng mô tả cũ (design mục 6). */
const OLD_SUBTITLES: [Role, string, string][] = [
  ['INVESTOR', '/account', 'Thông tin hồ sơ của tài'],
  ['CONTROLLER', '/approvals', 'Xem yêu cầu Giao dịch viên'],
  ['TELLER', '/assets', 'Mỗi dự án phát hành WPT'],
  ['TELLER', '/', 'Token hoá quyền hưởng lợi tức'],
  ['CONTROLLER', '/distribution', 'Kiểm soát viên duyệt tổng số VNDB của kỳ trên chain'],
  ['TELLER', '/draft', 'Lập yêu cầu tạo hoặc huỷ'],
  ['INVESTOR', '/orders', 'Lệnh mua và bán của ví'],
  ['INVESTOR', '/portfolio', 'Vị thế WPT của ví đang'],
  ['INVESTOR', '/trade', 'Mua token từ người bán theo giá phát hành'],
  ['INVESTOR', '/withdraw', 'Chuyển VNDB từ ví đã định'],
  ['TELLER', '/kyc', 'Duyệt KYC, whitelist ví để được'],
  ['TELLER', '/mint', 'KYC (mock auto-approve)'],
  ['TELLER', '/transactions', 'Mọi lệnh mua và bán tự'],
  ['CONTROLLER', '/config', 'Giá phát hành WPT áp dụng'],
  ['CONTROLLER', '/recall', 'Thanh toán thực hiện ngoài hệ thống'],
  ['TELLER', '/reconciliation', 'So khớp sản lượng SCADA'],
  ['SELLER', '/seller', 'Tình hình bán token, nguồn cung'],
  ['SELLER', '/seller/transactions', 'Lệnh mua bán token của nhà'],
  ['SELLER', '/seller/withdraw', 'về ví nhận bạn chọn'],
  ['CONTROLLER', '/vault', 'Trạng thái giữ WPT, VNDB và'],
  ['TELLER', '/wallet-binding', 'Ngân hàng định danh ví trên'],
  ['INVESTOR', '/wallet', 'Kết nối ví tự quản để xem vị thế'],
  ['TELLER', '/audit', 'Mọi lần kiểm quyền và mọi'],
];

test.describe('UIUX-02 dòng mô tả và gợi ý', () => {
  test('gợi ý trên mục menu: có mô tả ngay khi tải, hiện sau 3 giây, rời chuột thì mất', async ({
    page,
    context,
    baseURL,
  }) => {
    await actAs(context, baseURL!, 'CONTROLLER');
    await page.goto('/vault');
    await waitForHydration(page);
    const link = page.getByRole('link', { name: /^Phê duyệt lệnh/ });
    await expect(link).toHaveAccessibleDescription(APPROVAL_HINT);
    await expect(link).not.toHaveAccessibleName(new RegExp(APPROVAL_HINT));

    const bubble = page.locator('[data-slot="tooltip-content"]');
    await link.hover();
    await page.waitForTimeout(1000);
    await expect(bubble).toHaveCount(0);
    await page.waitForTimeout(2500);
    await expect(bubble).toBeVisible();
    await expect(bubble).toHaveText(APPROVAL_HINT);
    const linkBox = (await link.boundingBox())!;
    const bubbleBox = (await bubble.boundingBox())!;
    expect(bubbleBox.x).toBeGreaterThanOrEqual(linkBox.x + linkBox.width);
    expect(bubbleBox.x + bubbleBox.width).toBeLessThanOrEqual(page.viewportSize()!.width);

    await page.getByRole('heading', { name: 'Vault thanh toán SPV' }).hover();
    await expect(bubble).toHaveCount(0);
  });

  test('màn Tổng quan của Giao dịch viên đổi tiêu đề, menu giữ "Bảng điều khiển"', async ({
    page,
    context,
    baseURL,
  }) => {
    await actAs(context, baseURL!, 'TELLER');
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tổng quan');
    await expect(page.getByRole('link', { name: /^Bảng điều khiển/ })).toBeVisible();
  });

  test('gợi ý trên tiêu đề Sổ kiểm toán', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'TELLER');
    await page.goto('/audit');
    await waitForHydration(page);
    await page.getByRole('heading', { name: 'Sổ kiểm toán', level: 1 }).hover();
    await page.waitForTimeout(3500);
    await expect(page.locator('[data-slot="tooltip-content"]')).toHaveText(AUDIT_HINT);
  });

  test('không còn dòng mô tả cũ ở 23 màn', async ({ page, context, baseURL }) => {
    for (const [role, path, phrase] of OLD_SUBTITLES) {
      await actAs(context, baseURL!, role);
      await page.goto(path);
      const main = page.getByRole('main');
      await expect(main.getByRole('heading', { level: 1 }), path).toBeVisible();
      await expect(main, path).not.toContainText(phrase);
    }
  });
});
