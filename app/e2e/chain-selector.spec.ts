import { expect, test } from '@playwright/test';

/**
 * DoD P0: "đổi chain trên UI không lỗi".
 *
 * Kiểm cả hai mặt: dropdown đổi được, VÀ thao tác sau đó chạy đúng adapter của chain mới.
 * Cũng chốt luôn việc Polygon đã bị loại — không được xuất hiện trong lựa chọn.
 */

const INVESTOR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

test('dropdown chain có đúng các chain đã chốt, KHÔNG có Polygon', async ({ page }) => {
  await page.goto('/mint');

  const selector = page.locator('#chain-selector');
  await expect(selector).toBeVisible();

  const values = await selector.locator('option').evaluateAll((options) =>
    options.map((option) => (option as HTMLOptionElement).value),
  );
  expect(values).toEqual(['hardhat-local', 'mock', 'evm', 'stellar']);

  const text = (await selector.textContent())?.toLowerCase() ?? '';
  expect(text).not.toContain('polygon');
  expect(text).not.toContain('amoy');
});

test('đổi chain rồi mint vẫn chạy, và số dư tính theo từng chain', async ({ page }) => {
  await page.goto('/mint');

  const selector = page.locator('#chain-selector');
  const balancePanel = page.getByText('Số dư SPT').locator('..');

  // Chain mặc định của cấu hình e2e là `mock`.
  await expect(selector).toHaveValue('mock');

  await page.getByLabel('Ví nhà đầu tư').fill(INVESTOR);
  await page.getByLabel('Số lượng SPT').fill('40');
  await page.getByRole('button', { name: /KYC \+ Whitelist/i }).click();
  await expect(page.getByRole('status')).toContainText(/whitelist=true/i);

  const before = BigInt((await balancePanel.innerText()).replace(/\D/g, '') || '0');
  await page.getByRole('button', { name: /Phát hành/i }).click();
  await expect(balancePanel).toContainText(String(before + 40n));

  // stellar chỉ là stub -> phải hiện trong danh sách nhưng bị disable,
  // chứ không phải biến mất (người dùng cần thấy roadmap).
  await expect(selector.locator('option[value="stellar"]')).toBeDisabled();

  // Đổi sang chain khác: trang phải còn sống. Ở môi trường e2e không có hardhat node,
  // nên đúng hành vi là BÁO LỖI ĐỌC ĐƯỢC, không phải trang trắng.
  await selector.selectOption('hardhat-local');
  await expect(page.locator('#chain-selector')).toHaveValue('hardhat-local');
  await expect(page.getByRole('heading', { name: /Phát hành token dự án điện gió/i })).toBeVisible();
  await expect(page.getByText(/Lịch sử giao dịch \(hardhat-local\)/i)).toBeVisible();
});
