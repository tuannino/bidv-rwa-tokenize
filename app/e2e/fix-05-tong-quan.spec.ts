import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * FIX-05: màn Tổng quan dùng dữ liệu thật qua một lời gọi `getOpsOverviewAction`; ghi chú
 * "(đang hiển thị dữ liệu mẫu)" sau tiêu đề ba màn vận hành. Chain mock, máy chủ bản build.
 */
async function actAs(context: BrowserContext, baseURL: string, role: 'TELLER' | 'CONTROLLER') {
  await context.addCookies([
    { name: 'bidv_channel', value: role === 'TELLER' ? 'teller' : 'controller', url: baseURL },
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

const LABELS = ['Dự án đang triển khai', 'Tổng cung token', 'Nhà đầu tư đã định danh', 'Sản lượng luỹ kế', 'Lợi tức đã chia'];

test.describe('FIX-05 màn Tổng quan', () => {
  test('Giao dịch viên: 5 thẻ số liệu, ghi chú unverified, một lời gọi khi mở', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'TELLER');
    // Trên dev màn này không gọi action nào khi mở (0); FIX-05 QĐ-2 thêm đúng một.
    expect(await countActions(page, '/')).toBe(1);
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1 })).toHaveText('Tổng quan');
    for (const label of LABELS) await expect(main.getByText(label, { exact: true })).toBeVisible();
    await expect(main.getByText('unverified', { exact: true }).first()).toBeVisible();
    await expect(main.getByText(/whitelisted/i)).toHaveCount(0);
    const projects = main.locator('div.rounded-lg').filter({ has: page.getByText('Dự án đang triển khai', { exact: true }) });
    await expect(projects.locator('.font-mono').first()).toHaveText(/^\d+$/);
  });

  test('ba màn vận hành có ghi chú dữ liệu mẫu, tiêu đề giữ nguyên', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'TELLER');
    for (const [path, title] of [
      ['/assets', 'Dự án điện gió đã token hoá'],
      ['/kyc', 'Nhà đầu tư & KYC'],
      ['/reconciliation', 'Đối soát doanh thu điện'],
    ] as const) {
      expect(await countActions(page, path), path).toBe(0);
      const main = page.getByRole('main');
      await expect(main.getByRole('heading', { level: 1 }), path).toHaveText(title);
      await expect(main.getByText('(đang hiển thị dữ liệu mẫu)', { exact: true }), path).toBeVisible();
    }
  });
});
