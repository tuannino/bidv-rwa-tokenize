import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * E2E màn "Giá và phát hành" (FE-07), chain `mock`, lưu trong bộ nhớ.
 *
 * Một chuỗi nối tiếp trên cùng máy chủ e2e: Giao dịch viên đổi giá (hộp xác nhận), đổi vượt ngưỡng
 * (đánh dấu "đã kiểm"), Kiểm soát viên chỉ xem, Nhà đầu tư thấy giá mới ở `/trade` và `/portfolio`.
 * Bước cuối trả lại giá ban đầu: các tệp e2e chạy sau dùng chung máy chủ và chốt số tiền theo giá.
 */

type Role = 'TELLER' | 'CONTROLLER' | 'INVESTOR';
const CHANNEL: Record<Role, string> = { TELLER: 'teller', CONTROLLER: 'controller', INVESTOR: 'investor' };

async function actAs(context: BrowserContext, baseURL: string, role: Role) {
  await context.addCookies([
    { name: 'bidv_channel', value: CHANNEL[role], url: baseURL },
    { name: 'bidv_role', value: role, url: baseURL },
  ]);
}

const vnd = (value: bigint) => value.toLocaleString('vi-VN');
const effectivePrice = (page: Page) => page.getByTestId('effective-price');
const readPrice = async (page: Page) => BigInt((await effectivePrice(page).innerText()).replace(/\D/g, ''));

/** Gõ giá và lý do, bấm "Đổi giá", qua hộp xác nhận thứ nhất. */
async function requestChange(page: Page, from: bigint, to: bigint, reason: string) {
  const card = page.getByLabel('Đổi giá', { exact: true });
  await card.getByLabel('Giá mới (VNDB cho 1 WPT)').fill(to.toString());
  await card.getByLabel('Lý do').fill(reason);
  await card.getByRole('button', { name: 'Đổi giá', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(
    `Đổi giá phát hành từ ${vnd(from)} sang ${vnd(to)} VNDB. Áp dụng ngay cho mọi lệnh mới.`,
  );
  await dialog.getByRole('button', { name: 'Xác nhận đổi giá' }).click();
}

/** Hộp xác nhận thứ hai khi vượt ngưỡng: nút khoá cho tới khi đánh dấu "đã kiểm". */
async function confirmLargeChange(page: Page) {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Giá mới lệch lớn so với giá hiện tại');
  const proceed = dialog.getByRole('button', { name: 'Vẫn đổi giá' });
  await expect(proceed).toBeDisabled();
  await dialog.getByLabel('Tôi đã kiểm số chữ số').check();
  await expect(proceed).toBeEnabled();
  await proceed.click();
}

test.describe.serial('FE-07: Giá và phát hành', () => {
  let original = 0n;
  let raised = 0n;
  let large = 0n;

  test('Giao dịch viên đổi giá qua hộp xác nhận; lịch sử có dòng mới', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'TELLER');
    await page.goto('/config');
    await expect(page.getByRole('heading', { name: 'Giá và phát hành', level: 1 })).toBeVisible();
    for (const block of ['Giá phát hành', 'Đổi giá', 'Tình trạng phát hành', 'Lịch sử đổi giá']) {
      await expect(page.getByRole('heading', { name: block, level: 2, exact: true })).toBeVisible();
    }
    original = await readPrice(page);
    raised = (original * 12n) / 10n;

    await requestChange(page, original, raised, 'Điều chỉnh giá theo quyết định e2e');

    const status = page.getByLabel('Đổi giá', { exact: true }).getByRole('status');
    await expect(status).toContainText(`Đã đổi giá phát hành từ ${vnd(original)} sang ${vnd(raised)} VNDB`);
    await expect(effectivePrice(page)).toHaveText(`${vnd(raised)} VNDB`);
    const history = page.getByRole('table', { name: 'Bảng lịch sử đổi giá' });
    await expect(history.locator('tbody tr').first()).toContainText(vnd(raised));
    await expect(history.locator('tbody tr').first()).toContainText('Điều chỉnh giá theo quyết định e2e');
  });

  test('đổi vượt ngưỡng phải đánh dấu "Tôi đã kiểm số chữ số"', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'TELLER');
    await page.goto('/config');
    await expect(effectivePrice(page)).toHaveText(`${vnd(raised)} VNDB`);
    large = raised * 10n;

    await requestChange(page, raised, large, 'Kiểm hộp xác nhận vượt ngưỡng');
    await confirmLargeChange(page);

    await expect(effectivePrice(page)).toHaveText(`${vnd(large)} VNDB`);
  });

  test('Kiểm soát viên thấy màn nhưng không thấy khối "Đổi giá"', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'CONTROLLER');
    await page.goto('/config');
    await expect(effectivePrice(page)).toHaveText(`${vnd(large)} VNDB`);
    await expect(page.getByRole('heading', { name: 'Lịch sử đổi giá', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Đổi giá', level: 2, exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Đổi giá', exact: true })).toHaveCount(0);
  });

  test('Nhà đầu tư thấy giá mới ở /trade và /portfolio', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'INVESTOR');
    await page.goto('/trade');
    await expect(page.locator('input[aria-label="Giá"]')).toHaveValue(vnd(large));
    await expect(page.locator('dt', { hasText: 'Giá phát hành' }).locator('xpath=following-sibling::dd')).toContainText(vnd(large));

    await page.goto('/portfolio');
    await expect(page.getByRole('heading', { name: 'Trạng thái phát hành' })).toBeVisible();
    await expect(page.locator('main')).toContainText(`${vnd(large)} ₫`);
  });

  test('trả lại giá ban đầu cho các tệp e2e chạy sau', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'TELLER');
    await page.goto('/config');
    await expect(effectivePrice(page)).toHaveText(`${vnd(large)} VNDB`);

    await requestChange(page, large, original, 'Trả giá ban đầu sau kiểm thử e2e');
    await confirmLargeChange(page);

    await expect(effectivePrice(page)).toHaveText(`${vnd(original)} VNDB`);
  });
});
