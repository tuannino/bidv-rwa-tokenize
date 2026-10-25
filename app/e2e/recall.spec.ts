import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { MOCK_VAULT_ADDRESS } from '../../packages/shared/src/mock-vault';

type Role = 'INVESTOR' | 'TELLER' | 'CONTROLLER';

async function actAs(context: BrowserContext, baseURL: string, role: Role) {
  await context.clearCookies();
  await context.addCookies([
    { name: 'bidv_channel', value: role.toLowerCase(), url: baseURL },
    { name: 'bidv_role', value: role, url: baseURL },
  ]);
}

async function ensureIssued(page: Page, context: BrowserContext, baseURL: string) {
  await actAs(context, baseURL, 'CONTROLLER');
  await page.goto('/recall');
  await expect(page.getByText('Đang tải tình trạng thu hồi...')).toHaveCount(0);
  if (await page.getByRole('button', { name: 'Mở đợt thu hồi' }).count()) return;
  await expect(page.getByText(/Dự án chưa phát hành/)).toBeVisible();
  await actAs(context, baseURL, 'TELLER');
  await page.goto('/mint');
  await page.getByLabel('Ví nhà đầu tư').fill(MOCK_VAULT_ADDRESS);
  await page.getByRole('button', { name: /KYC \+ Whitelist/i }).click();
  await expect(page.getByRole('status')).toContainText(/whitelist=true/i);

  await page.goto('/draft');
  const card = page.getByLabel('Thẻ tạo token');
  await card.getByLabel('Mã hoặc ký hiệu token').fill('WPT');
  await expect(card.getByLabel('Khối thông tin token')).toContainText('Dự án điện gió');
  const wallet = card.getByLabel(/Ví đích/);
  if (await wallet.isEditable()) await wallet.fill(MOCK_VAULT_ADDRESS);
  await card.getByLabel('Số lượng').fill('1');
  await card.getByLabel('Lý do').fill('Dựng dữ liệu cho E2E FE-10');
  const submit = card.getByRole('button', { name: /Gửi yêu cầu tạo token/ });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(card.getByRole('status')).toContainText(/chờ Kiểm soát viên duyệt/);
  const requestId = await page.getByRole('table', { name: 'Yêu cầu tạo token đã lập' }).locator('tbody tr').first().getAttribute('data-request-id');
  expect(requestId).toMatch(/^[0-9a-f-]{36}$/);

  await actAs(context, baseURL, 'CONTROLLER');
  await page.goto(`/approvals/${requestId}`);
  const actions = page.getByLabel('Khối hành động');
  await actions.getByRole('button', { name: 'Chấp nhận' }).click();
  await expect(actions.getByRole('status')).toContainText(/Đã chấp nhận/);
  await expect(actions).toContainText('Hoàn tất');
}

async function cancelActiveRound(page: Page) {
  const unfreeze = page.getByRole('button', { name: 'Mở đóng băng trên toàn hệ thống' });
  if (await unfreeze.count()) {
    await unfreeze.click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Gõ WPT để xác nhận').fill('WPT');
    await dialog.getByLabel('Lý do mở đóng băng').fill('Dọn trạng thái sau kiểm thử');
    await dialog.getByRole('button', { name: 'Mở đóng băng', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  }
  const cancel = page.getByRole('button', { name: 'Huỷ đợt' });
  if (await cancel.count()) {
    await cancel.click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Lý do huỷ').fill('Dọn trạng thái sau kiểm thử');
    await dialog.getByRole('button', { name: 'Xác nhận huỷ' }).click();
    await expect(dialog).toHaveCount(0);
  }
}

test.describe.serial('FE-10: màn Thu hồi token', () => {
  test.afterAll(async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await actAs(context, baseURL!, 'CONTROLLER');
      await page.goto('/recall');
      await cancelActiveRound(page);
    } finally {
      await context.close();
    }
  });

  test('luồng đảo ngược: mở, chặn giao dịch, đóng băng, mở lại và huỷ', async ({ page, context, baseURL }) => {
    await ensureIssued(page, context, baseURL!);

    await actAs(context, baseURL!, 'CONTROLLER');
    let actionCount = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.headers()['next-action']) actionCount += 1;
    });
    await page.goto('/recall');
    await page.waitForLoadState('networkidle');
    expect(actionCount).toBe(1);

    await page.getByRole('button', { name: 'Mở đợt thu hồi' }).click();
    const openDialog = page.getByRole('dialog');
    const date = openDialog.getByLabel('Ngày hết hạn');
    await date.fill((await date.getAttribute('min'))!);
    await openDialog.getByLabel('Số ngày báo trước').fill('0');
    await openDialog.getByLabel('Lý do').fill('Kiểm thử đầu cuối FE-10');
    await openDialog.getByRole('button', { name: 'Mở đợt', exact: true }).click();
    await expect(openDialog).toHaveCount(0);
    await expect(page.getByRole('listitem').filter({ hasText: 'Đến hạn' })).toHaveAttribute('aria-current', 'step');

    await actAs(context, baseURL!, 'INVESTOR');
    await page.goto('/trade');
    await expect(page.getByText('Giao dịch tạm dừng', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Số lượng')).toBeDisabled();
    await expect(page.getByRole('button', { name: /Xác nhận lệnh/ })).toBeDisabled();

    await actAs(context, baseURL!, 'TELLER');
    actionCount = 0;
    await page.goto('/recall');
    await page.waitForLoadState('networkidle');
    expect(actionCount).toBe(1);
    await expect(page.getByText('Giao dịch viên chỉ được xem tình trạng và danh sách hồ sơ.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đóng băng trên toàn hệ thống' })).toHaveCount(0);

    await actAs(context, baseURL!, 'CONTROLLER');
    await page.goto('/recall');
    await page.getByRole('button', { name: 'Đóng băng trên toàn hệ thống' }).click();
    const freezeDialog = page.getByRole('dialog');
    const freezeSubmit = freezeDialog.getByRole('button', { name: 'Đóng băng', exact: true });
    await expect(freezeSubmit).toBeDisabled();
    await freezeDialog.getByLabel('Gõ WPT để xác nhận').fill('WPT');
    await expect(freezeSubmit).toBeEnabled();
    await freezeSubmit.click();
    await expect(freezeDialog).toHaveCount(0);
    await expect(page.getByRole('listitem').filter({ hasText: 'Đã đóng băng' })).toHaveAttribute('aria-current', 'step');

    await page.getByRole('button', { name: 'Mở đóng băng trên toàn hệ thống' }).click();
    const unfreezeDialog = page.getByRole('dialog');
    await unfreezeDialog.getByLabel('Gõ WPT để xác nhận').fill('WPT');
    await unfreezeDialog.getByLabel('Lý do mở đóng băng').fill('Hoàn nguyên sau kiểm thử');
    await unfreezeDialog.getByRole('button', { name: 'Mở đóng băng', exact: true }).click();
    await expect(unfreezeDialog).toHaveCount(0);

    await page.getByRole('button', { name: 'Huỷ đợt' }).click();
    const cancelDialog = page.getByRole('dialog');
    await expect(cancelDialog).toContainText('Huỷ đợt sẽ mở lại giao dịch nếu đã tới ngày hết hạn');
    await cancelDialog.getByLabel('Lý do huỷ').fill('Trả trạng thái sau kiểm thử đầu cuối');
    await cancelDialog.getByRole('button', { name: 'Xác nhận huỷ' }).click();
    await expect(cancelDialog).toHaveCount(0);
    await expect(page.getByText('Đợt gần nhất đã huỷ')).toBeVisible();

    await actAs(context, baseURL!, 'INVESTOR');
    await page.goto('/trade');
    await expect(page.getByText('Giao dịch tạm dừng', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Số lượng')).toBeEnabled();
  });
});
