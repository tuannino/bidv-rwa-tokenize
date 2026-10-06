import { expect, test, type BrowserContext } from '@playwright/test';

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

test.describe('FE-24 — Thông tin tài khoản', () => {
  for (const [role, name, actorId] of [
    ['INVESTOR', 'Nguyễn Văn An', 'NDT001'],
    ['SELLER', 'Công ty Cổ phần Điện gió Bạc Liêu', 'NB001'],
    ['TELLER', 'Lê Minh Cường', 'GDV001'],
    ['CONTROLLER', 'Phạm Thu Dung', 'KSV001'],
  ] as const) {
    test(`${role} mở được hồ sơ của chính mình`, async ({ page, context, baseURL }) => {
      await actAs(context, baseURL!, role);
      await page.goto('/account');

      const main = page.getByRole('main');
      await expect(main.getByRole('heading', { name: 'Thông tin tài khoản', level: 1 })).toBeVisible();
      await expect(main).toContainText(name);
      await expect(main).toContainText(actorId);
      await expect(main).toContainText('Chỉ đọc');
      await expect(main.locator('button, input, textarea, select')).toHaveCount(0);
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
