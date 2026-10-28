import { expect, test, type BrowserContext } from '@playwright/test';
import sampleWallets from '../../packages/shared/src/sample-wallets.json';

/**
 * FE-23: Nhà đầu tư rút VNDB tới ví nhận đã whitelist ở `/withdraw` (chỉ project `mock`: máy chủ chuyển
 * thay ví trình duyệt). Tự dựng dữ liệu, không phụ thuộc thứ tự tệp: Giao dịch viên định danh ví NB001
 * (ví nhận) và ví mẫu NDT001 ở `/wallet-binding`, rồi nạp VNDB cho NDT001 ở màn Nạp VNDB.
 */
const INVESTOR = sampleWallets.wallets.NDT001;
const RECEIVER = sampleWallets.wallets.NB001;

async function actAs(context: BrowserContext, baseURL: string, role: 'TELLER' | 'INVESTOR') {
  await context.clearCookies();
  await context.addCookies([
    { name: 'bidv_channel', value: role.toLowerCase(), url: baseURL },
    { name: 'bidv_role', value: role, url: baseURL },
  ]);
}

test.describe.serial('FE-23: Nhà đầu tư rút VNDB', () => {
  test('chuẩn bị: định danh ví nhận và ví gửi, nạp VNDB cho Nhà đầu tư', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'TELLER');
    await page.goto('/demo-payment');
    const unavailable = await page.getByText('Chức năng nạp VNDB mô phỏng không khả dụng').count();
    test.skip(unavailable > 0, 'Cờ ENABLE_DEMO_PAYMENT_MINT tắt: không nạp được VNDB cho Nhà đầu tư trên màn hình.');

    await page.goto('/wallet-binding');
    const form = page.getByRole('form', { name: 'Biểu mẫu định danh ví' });
    for (const [actor, wallet] of [['NB001', RECEIVER], ['NDT001', INVESTOR]] as const) {
      await form.getByLabel('Hồ sơ').selectOption(actor);
      await form.getByLabel('Địa chỉ ví').fill(wallet);
      await form.getByRole('button', { name: 'Định danh và gắn ví' }).click();
      await expect(page.getByLabel('Kết quả định danh ví')).toContainText(wallet);
    }

    await page.goto('/demo-payment');
    await page.getByLabel('Ví đích').fill(INVESTOR);
    await page.getByLabel('Số VNDB').fill('1000');
    await page.getByRole('button', { name: 'Nạp VNDB' }).click();
    await expect(page.getByRole('status')).toContainText(/Đã nạp/);
  });

  test('Nhà đầu tư rút 1 VNDB tới ví NB001, thấy dòng "Hoàn tất"', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'INVESTOR');
    await page.goto('/withdraw');
    const form = page.getByRole('form', { name: 'Biểu mẫu rút VNDB' });
    await expect(form.getByLabel('Ví gửi')).toHaveValue(INVESTOR);
    await expect(page.getByTestId('payment-balance')).not.toHaveText('0');

    await page.getByLabel('Số tiền rút (VNDB)').fill('1');
    await page.getByLabel('Ví nhận').fill(RECEIVER);
    await page.getByLabel('Mục đích').fill('Rút thử e2e FE-23');
    await page.getByRole('button', { name: 'Tạo lệnh rút' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('otp-payment-target')).toContainText(`${RECEIVER} (đã whitelist)`);
    await dialog.getByLabel('Mã một lần').fill('12345');
    await expect(dialog.getByRole('button', { name: 'Xác nhận' })).toBeDisabled();
    await dialog.getByLabel('Mã một lần').fill('123456');
    await dialog.getByRole('button', { name: 'Xác nhận' }).click();

    await expect(page.getByLabel('Kết quả rút VNDB')).toContainText(`Đã rút 1 VNDB tới ví ${RECEIVER}`);
    const row = page.getByRole('table', { name: 'Lệnh rút của tôi' }).locator('tbody tr').first();
    await expect(row).toHaveAttribute('data-status', 'COMPLETED');
    await expect(row).toContainText('Hoàn tất');
  });
});
