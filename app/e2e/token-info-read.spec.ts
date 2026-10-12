import { expect, test } from '@playwright/test';

/** Chỉ đọc: không lập/duyệt yêu cầu, không whitelist, không gửi giao dịch. */
test('tra cứu WPT vẫn chạy khi hàng chờ Server Action bị giữ', async ({ page }) => {
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/draft', async (route) => {
    if (route.request().method() === 'POST' && route.request().headers()['next-action']) {
      await blocked;
    }
    await route.continue();
  });
  try {
    const queued = page.waitForRequest((request) => request.method() === 'POST' && Boolean(request.headers()['next-action']));
    await page.goto('/draft'); await queued;
    const card = page.getByLabel('Thẻ tạo token');
    await card.getByLabel('Mã hoặc ký hiệu token').fill('WPT');
    await expect(card.getByLabel('Khối thông tin token')).toContainText('Dự án', { timeout: 14_000 });
    await expect(card.getByLabel('Khối thông tin token')).not.toContainText('sau 15 giây');
  } finally { release(); }
});

test('lỗi mạng có nút thử lại và lần sau đọc được, giữ nội dung biểu mẫu', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/token-info?**', async (route) => {
    if (++attempts === 1) await route.abort('failed');
    else await route.continue();
  });
  await page.goto('/draft');
  const card = page.getByLabel('Thẻ tạo token');
  await card.getByLabel('Mã hoặc ký hiệu token').fill('WPT');
  await expect(card.getByLabel('Khối thông tin token')).toContainText('Mất kết nối tới máy chủ');
  await expect(card.getByLabel('Khối thông tin token')).not.toContainText('sau 15 giây');
  await card.getByRole('button', { name: 'Thử đọc lại thông tin token' }).click();
  await expect(card.getByLabel('Khối thông tin token')).toContainText('Dự án');
  await expect(card.getByLabel('Mã hoặc ký hiệu token')).toHaveValue('WPT');
  expect(attempts).toBe(2);
});
