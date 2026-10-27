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
 * Khối hồ sơ FE-24 chỉ đọc. FIX-01 F1: khối nhập ví (ô "Dùng địa chỉ ví mới", nút "Dùng ví đang kết
 * nối", nút "Lưu") đã bỏ; ô "Ví thanh toán" nằm trong khối hồ sơ, chỉ hiện ví và nhãn định danh. Liên
 * kết "Kết nối ví" là `<a>`, nên phép kiểm "không có nút hay ô nhập" vẫn khoanh cả khối hồ sơ.
 */
const profileBlock = (page: Page) => page.getByRole('main').locator('[data-account-role]');

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

    test(`${role} ${customer ? 'thấy ví thanh toán kèm nhãn định danh' : 'không thấy ví thanh toán'} (FIX-01 F)`, async ({ page, context, baseURL }) => {
      await actAs(context, baseURL!, role);
      await page.goto('/account');
      const main = page.getByRole('main');
      await expect(profileBlock(page)).toBeVisible();

      // F1: khối nhập ví cũ không còn ở bất kỳ vai nào.
      await expect(main.getByLabel('Dùng địa chỉ ví mới')).toHaveCount(0);
      await expect(main.getByRole('button', { name: 'Lưu' })).toHaveCount(0);
      await expect(main.getByRole('heading', { name: /^Ví thanh toán trên chain/ })).toHaveCount(0);
      if (!customer) {
        await expect(main.locator('[data-payment-wallet]')).toHaveCount(0);
        return;
      }
      // F2: project `mock` hiện ví mẫu của hồ sơ, nhãn "Đã định danh".
      await expect(main.locator('[data-payment-wallet]')).toHaveText(/^0x[0-9a-fA-F]{40}$/);
      await expect(main.locator('[data-wallet-bound="true"]')).toHaveText('Đã định danh');
    });
  }

  test('Nhà đầu tư thấy KYC, rủi ro và ví của mình', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'INVESTOR');
    await page.goto('/account');

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Thông tin cá nhân' })).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Hồ sơ định danh và rủi ro' })).toBeVisible();
    await expect(main).toContainText('Ví thanh toán');
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
