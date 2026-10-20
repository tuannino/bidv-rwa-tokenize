import { expect, test, type BrowserContext } from '@playwright/test';
import sampleWallets from '../../packages/shared/src/sample-wallets.json';

/**
 * BE-13 ca 15: Kiểm soát viên lưu cấu hình khoá trên `/vault` và thấy màn cập nhật; Người bán tạo
 * lệnh rút ở `/seller/withdraw` và thấy `COMPLETED`. Chạy cả project `mock` lẫn `hardhat`.
 *
 * Vault cần sẵn VNDB từ lệnh mua của tệp chạy trước (Playwright chạy tệp theo tên): `mock` có lệnh
 * mua của `ops-transactions.spec.ts`, `hardhat` có lệnh mua của `permit-order.spec.ts`. Khoá cố định
 * 1 VNDB nên phần được rút là toàn bộ số dư trừ 1, đủ cho lần rút 1 VNDB dù số dư là bao nhiêu.
 */
const PAYOUT = sampleWallets.wallets.NB001;

async function actAs(context: BrowserContext, baseURL: string, role: 'TELLER' | 'CONTROLLER' | 'SELLER') {
  await context.clearCookies();
  await context.addCookies([
    { name: 'bidv_channel', value: role.toLowerCase(), url: baseURL },
    { name: 'bidv_role', value: role, url: baseURL },
  ]);
}

test.describe.serial('BE-13 ca 15: cấu hình khoá vault và rút qua màn hình', () => {
  test('chuẩn bị: whitelist ví nhận NB001 bằng màn KYC có sẵn', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'TELLER');
    await page.goto('/mint');
    await page.getByLabel('Ví nhà đầu tư').fill(PAYOUT);
    await page.getByRole('button', { name: /KYC \+ Whitelist/i }).click();
    await expect(page.getByRole('status')).toContainText(/whitelist=true/i);
  });

  test('Kiểm soát viên lưu cấu hình, /vault cập nhật', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'CONTROLLER');
    await page.goto('/vault');
    const form = page.getByRole('form', { name: 'Biểu mẫu cấu hình khoá' });
    await expect(form).toBeVisible();
    await form.getByLabel('Tỷ lệ khoá PERCENT (%)').fill('20');
    await form.getByLabel('Số khoá cố định (VNDB, để trống được)').fill('1');
    await form.getByLabel('Ví nhận tiền rút').fill(PAYOUT);
    await form.getByRole('button', { name: 'Lưu cấu hình khoá' }).click();
    await expect(page.getByLabel('Kết quả lưu cấu hình')).toContainText(
      /Đã lưu cấu hình lên chuỗi|Chuỗi đã đúng cấu hình này/,
    );
    await expect(page.getByText('Khoá số tiền cố định', { exact: true })).toBeVisible();
    await expect(page.getByText(PAYOUT, { exact: true }).first()).toBeVisible();
  });

  test('vai khác chỉ xem cấu hình', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'TELLER');
    await page.goto('/vault');
    await expect(page.getByText('Chỉ Kiểm soát viên lưu được cấu hình; vai của bạn chỉ xem.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lưu cấu hình khoá' })).toHaveCount(0);
  });

  test('Người bán tạo lệnh rút, thấy COMPLETED', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'SELLER');
    await page.goto('/seller/withdraw');
    await expect(page.getByLabel('Ví nhận (đặt bởi Kiểm soát viên)')).toHaveValue(PAYOUT);
    await expect(page.getByText('Phí ngân hàng ngoài chuỗi: chưa áp dụng (POC).')).toBeVisible();
    await page.getByLabel('Số tiền rút (VNDB)').fill('1');
    await page.getByLabel('Mục đích').fill('Rút thử e2e BE-13');
    await page.getByRole('button', { name: 'Tạo lệnh rút' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Mã một lần').fill('12345');
    await expect(dialog.getByRole('button', { name: 'Xác nhận' })).toBeDisabled();
    await dialog.getByLabel('Mã một lần').fill('123456');
    await dialog.getByRole('button', { name: 'Xác nhận' }).click();

    await expect(page.getByLabel('Kết quả lệnh rút')).toContainText(`Đã rút 1 VNDB về ví ${PAYOUT}`);
    const row = page.getByRole('table', { name: 'Yêu cầu rút của tôi' }).locator('tbody tr').first();
    await expect(row).toHaveAttribute('data-status', 'COMPLETED');
    await expect(row).toContainText('Hoàn tất');

    await page.goto('/seller/transactions');
    await page.getByLabel('Loại').selectOption('WITHDRAW');
    await expect(page.locator('tbody tr[data-type="WITHDRAW"]').first()).toContainText('Rút');
  });
});
