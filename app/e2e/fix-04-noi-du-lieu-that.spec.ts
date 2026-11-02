import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * FIX-04: dữ liệu thật ở Tổng quan Nhà đầu tư, Tổng quan Người bán, Tài khoản; ghi chú "unverified".
 * Chain mock. Số dư VNDB cần ví kết nối qua wagmi nên kiểm bằng vitest ca 1, 2 và ảnh trên hardhat.
 */
type Role = 'INVESTOR' | 'SELLER';
const CHANNEL: Record<Role, string> = { INVESTOR: 'investor', SELLER: 'seller' };
/** Tên dự án trong bảng dự án của bản mock (`lib/store/seed-data.ts`). */
const PROJECT_NAME = 'Dự án điện gió An Viên';
/** Tên mẫu ở `lib/mock-data.ts` của dự án đã lên chuỗi. */
const SAMPLE_NAME = 'Điện gió An Viên';
const LOAD_FAILED = 'Chưa đọc được thông tin token, thử tải lại trang.';

async function actAs(context: BrowserContext, baseURL: string, role: Role) {
  await context.addCookies([
    { name: 'bidv_channel', value: CHANNEL[role], url: baseURL },
    { name: 'bidv_role', value: role, url: baseURL },
  ]);
}

/** Đếm POST có header `next-action` từ lúc mở tới `networkidle` (cách `recall.spec.ts`). */
async function countActions(page: Page, path: string): Promise<number> {
  let count = 0;
  const onRequest = (request: import('@playwright/test').Request) => {
    if (request.method() === 'POST' && request.headers()['next-action']) count += 1;
  };
  page.on('request', onRequest);
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  page.off('request', onRequest);
  return count;
}

const issuanceBox = (page: Page) =>
  page.locator('[data-slot="card"]').filter({ has: page.getByRole('heading', { name: 'Trạng thái phát hành' }) });
const tokenListBox = (page: Page) =>
  page.locator('[data-slot="card"]').filter({ has: page.getByRole('heading', { name: 'Token dự án điện gió' }) });

test.describe('FIX-04 nối dữ liệu thật', () => {
  test('Tổng quan Nhà đầu tư: tên dự án thật, không còn câu chờ BE-01, có ghi chú unverified', async ({
    page,
    context,
    baseURL,
  }) => {
    await actAs(context, baseURL!, 'INVESTOR');
    expect(await countActions(page, '/portfolio')).toBeLessThanOrEqual(1);
    await expect(page.getByText('chờ BE-01')).toHaveCount(0);
    const box = issuanceBox(page);
    await expect(box.getByText(PROJECT_NAME)).toBeVisible();
    await expect(box.getByText('Chưa đọc được')).toHaveCount(0);
    await expect(page.getByText('unverified', { exact: true }).first()).toBeVisible();
    await expect(tokenListBox(page).getByText(PROJECT_NAME)).toBeVisible();
  });

  test('Tổng quan Người bán: lệnh bán trong ngày là số, không còn câu chưa có lệnh bán lại', async ({
    page,
    context,
    baseURL,
  }) => {
    await actAs(context, baseURL!, 'SELLER');
    expect(await countActions(page, '/seller')).toBeLessThanOrEqual(1);
    await expect(page.getByText('Hệ thống chưa có lệnh bán lại.')).toHaveCount(0);
    const sell = page.locator('div.rounded-lg').filter({ has: page.getByText('Số lượng bán', { exact: true }) });
    await expect(sell).toContainText(/\d/);
    await expect(sell).toContainText('WPT');
  });

  test('Tài khoản: ghi chú unverified cạnh tiêu đề khối hồ sơ', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'INVESTOR');
    expect(await countActions(page, '/account')).toBeLessThanOrEqual(1);
    const heading = page.getByRole('heading', { name: /^Thông tin cá nhân/ });
    await expect(heading).toBeVisible();
    await expect(heading.getByText('unverified', { exact: true })).toBeVisible();
  });

  test('lời gọi thông tin token bị reject: hai hộp hết tải, dòng token hiện tên mẫu kèm unverified', async ({
    page,
    context,
    baseURL,
  }) => {
    await actAs(context, baseURL!, 'INVESTOR');
    await page.route('**/*', async (route) => {
      const request = route.request();
      if (request.method() === 'POST' && request.headers()['next-action']) return route.abort();
      return route.continue();
    });
    await page.goto('/portfolio');

    const box = issuanceBox(page);
    await expect(box.getByText('Đang đọc thông số token')).toHaveCount(0, { timeout: 10_000 });
    await expect(box.getByText(LOAD_FAILED)).toBeVisible({ timeout: 10_000 });
    const list = tokenListBox(page);
    const sampleRow = list.getByRole('link').filter({ hasText: 'WPT' }).first();
    await expect(sampleRow).toContainText(SAMPLE_NAME);
    await expect(sampleRow.getByTitle('Tên mẫu, chưa đọc được tên dự án trong hệ thống')).toBeVisible();

    await page.unroute('**/*');
    await page.reload();
    await expect(issuanceBox(page).getByText(PROJECT_NAME)).toBeVisible();
    await expect(tokenListBox(page).getByText(PROJECT_NAME)).toBeVisible();
  });
});
