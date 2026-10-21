import { expect, test, type BrowserContext, type Page } from '@playwright/test';

type AccountRole = 'INVESTOR' | 'SELLER' | 'TELLER' | 'CONTROLLER';

const CHANNEL: Record<AccountRole, string> = {
  INVESTOR: 'investor',
  SELLER: 'seller',
  TELLER: 'teller',
  CONTROLLER: 'controller',
};

async function actAs(context: BrowserContext, baseURL: string, role: AccountRole) {
  await context.addCookies([
    { name: 'bidv_channel', value: CHANNEL[role], url: baseURL },
    { name: 'bidv_role', value: role, url: baseURL },
  ]);
}

/**
 * Khối hồ sơ FE-24 (phần chỉ đọc) và khối "Ví liên kết" của OP-05 QĐ-I nằm cạnh nhau trong `main`.
 * Phép kiểm "không có điều khiển sửa" khoanh vào khối hồ sơ; khối ví liên kết có ô nhập và nút là đúng
 * phạm vi mới, và chỉ vai khách hàng có.
 */
const profileBlock = (page: Page) => page.getByRole('main').locator('[data-account-role]');
const walletBlock = (page: Page) => page.getByRole('main').locator('[aria-label="Ví liên kết"]');

test.describe('FE-24 — Thông tin tài khoản', () => {
  for (const [role, name, actorId, customer] of [
    ['INVESTOR', 'Nguyễn Văn An', 'NDT001', true],
    ['SELLER', 'Công ty Cổ phần Điện gió An Viên', 'NB001', true],
    ['TELLER', 'Lê Minh Cường', 'GDV001', false],
    ['CONTROLLER', 'Phạm Thu Dung', 'KSV001', false],
  ] as const) {
    test(`${role} mở được hồ sơ của chính mình; khối hồ sơ chỉ đọc`, async ({ page, context, baseURL }) => {
      await actAs(context, baseURL!, role);
      await page.goto('/account');

      const profile = profileBlock(page);
      await expect(profile).toHaveAttribute('data-account-role', role);
      await expect(profile.getByRole('heading', { name: 'Thông tin tài khoản', level: 1 })).toBeVisible();
      await expect(profile).toContainText(name);
      await expect(profile).toContainText(actorId);
      await expect(profile).toContainText('Chỉ đọc');
      await expect(profile.locator('button, input, textarea, select')).toHaveCount(0);
    });

    test(`${role} ${customer ? 'thấy' : 'không thấy'} khối ví liên kết (OP-05 QĐ-I)`, async ({ page, context, baseURL }) => {
      await actAs(context, baseURL!, role);
      await page.goto('/account');
      await expect(profileBlock(page)).toBeVisible();

      const wallet = walletBlock(page);
      if (!customer) {
        await expect(wallet).toHaveCount(0);
        await expect(page.getByRole('main').getByRole('heading', { name: /^Ví liên kết trên chain/ })).toHaveCount(0);
        return;
      }
      await expect(wallet.getByRole('heading', { name: /^Ví liên kết trên chain/ })).toBeVisible();
      await expect(wallet.getByLabel('Địa chỉ ví')).toBeVisible();
      await expect(wallet.getByRole('button', { name: 'Dùng ví đang kết nối' })).toBeVisible();
      await expect(wallet.getByRole('button', { name: 'Lưu' })).toBeVisible();
    });
  }

  test('Nhà đầu tư thấy KYC, rủi ro và ví của mình', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'INVESTOR');
    await page.goto('/account');

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Thông tin cá nhân' })).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Hồ sơ định danh và rủi ro' })).toBeVisible();
    await expect(main).toContainText('Địa chỉ ví');
    await expect(main).toContainText('Hạn mức giao dịch mỗi ngày');
  });

  test('Người bán thấy pháp nhân, liên hệ và ví thanh toán', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'SELLER');
    await page.goto('/account');

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Thông tin pháp nhân' })).toBeVisible();
    await expect(main).toContainText('Người liên hệ');
    await expect(main).toContainText('Ví thanh toán');
  });

  for (const role of ['TELLER', 'CONTROLLER'] as const) {
    test(`${role} không thấy hồ sơ đầu tư và địa chỉ ví`, async ({ page, context, baseURL }) => {
      await actAs(context, baseURL!, role);
      await page.goto('/account');

      const main = page.getByRole('main');
      await expect(main.getByRole('heading', { name: 'Thông tin cán bộ' })).toBeVisible();
      await expect(main.getByRole('heading', { name: 'Hồ sơ định danh và rủi ro' })).toHaveCount(0);
      await expect(main).not.toContainText('Địa chỉ ví');
      await expect(main).not.toContainText('Ví thanh toán');
    });
  }
});
