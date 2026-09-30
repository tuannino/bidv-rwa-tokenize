import { expect, test } from '@playwright/test';

/**
 * E2E luồng MINT qua giao diện (T1.6).
 *
 * Kiểm bằng cái mà nghiệm thu Phase 1 yêu cầu: từ UI, mint 100 -> **balance = 100**,
 * và giao dịch xuất hiện trong lịch sử. Đọc số dư lấy từ ledger (server action),
 * không phải từ state cục bộ của form.
 */

// Hardhat account #1 — dùng cho cả mock lẫn hardhat-local.
const INVESTOR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

test.describe('Phát hành token điện gió', () => {
  test('KYC + whitelist rồi mint 100 WPT thì số dư thành 100', async ({ page }) => {
    await page.goto('/mint');

    await expect(page.getByRole('heading', { name: /Phát hành token dự án điện gió/i })).toBeVisible();

    await page.getByLabel('Ví nhà đầu tư').fill(INVESTOR);
    await page.getByLabel('Số lượng WPT').fill('100');

    // Bước 1: KYC mock auto-approve -> whitelist on-chain.
    await page.getByRole('button', { name: /KYC \+ Whitelist/i }).click();
    await expect(page.getByRole('status')).toContainText(/whitelist=true/i);
    await expect(page.getByText('đã KYC')).toBeVisible();

    // Số dư TRƯỚC khi phát hành. Kiểm theo mức TĂNG chứ không chốt cứng "= 100":
    // chain `mock` reset theo tiến trình, nhưng hardhat-local giữ state giữa các lần chạy,
    // nên chốt cứng sẽ đỏ oan ở lần chạy thứ hai.
    const balancePanel = page.getByText('Số dư WPT').locator('..');
    const before = BigInt((await balancePanel.innerText()).replace(/\D/g, '') || '0');

    // Bước 2: phát hành.
    await page.getByRole('button', { name: /Phát hành/i }).click();
    await expect(page.getByRole('status')).toContainText(/Đã phát hành 100 WPT/i);

    // Nghiệm thu: số dư đọc lại từ ledger tăng đúng 100.
    await expect(balancePanel).toContainText(String(before + 100n));

    // Giao dịch đã được lưu và hiển thị trong lịch sử.
    const history = page.getByRole('table').last();
    await expect(history).toContainText('mint');
    await expect(history).toContainText('CONFIRMED');
  });

  test('mint cho ví chưa whitelist bị từ chối kèm lý do rõ ràng', async ({ page }) => {
    await page.goto('/mint');

    // Ví khác, chưa qua bước KYC.
    await page.getByLabel('Ví nhà đầu tư').fill('0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC');
    await page.getByLabel('Số lượng WPT').fill('10');

    await page.getByRole('button', { name: /Phát hành/i }).click();
    await expect(page.getByRole('status')).toContainText(/chưa được whitelist/i);
  });

  test('vai Nhà đầu tư không vào được khu vực Vận hành', async ({ page, context, baseURL }) => {
    // Cùng cơ chế mà bộ chọn vai trò dùng (cookie bidv_role).
    await context.addCookies([{ name: 'bidv_role', value: 'INVESTOR', url: baseURL! }]);
    await page.goto('/mint');
    await expect(page.getByRole('heading', { name: /Không có quyền vào kênh/i })).toBeVisible();
  });

  /**
   * FE-20: Kiểm soát viên CÓ `ops:read` nên vào được khu vực Vận hành, nhưng KHÔNG có
   * `token:mint`. Ca này chốt rằng cổng khu vực và quyền nghiệp vụ là HAI lớp khác nhau —
   * vào được trang không có nghĩa là làm được việc.
   */
  test('Kiểm soát viên vào được Vận hành nhưng không phát hành được', async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([
      { name: 'bidv_channel', value: 'controller', url: baseURL! },
      { name: 'bidv_role', value: 'CONTROLLER', url: baseURL! },
    ]);

    // Sổ kiểm toán vẫn còn, và vai này đọc được (`audit:read`).
    await page.goto('/audit');
    await expect(page.getByRole('heading', { name: /Sổ kiểm toán/i })).toBeVisible();

    // Trang phát hành mở được (cùng khu vực) nhưng thao tác bị service từ chối.
    await page.goto('/mint');
    await expect(
      page.getByRole('heading', { name: /Phát hành token dự án điện gió/i }),
    ).toBeVisible();

    /**
     * Nút phát hành bị VÔ HIỆU kèm lý do, chứ không phải bấm rồi nhận lỗi.
     *
     * Đây là hành vi đúng hơn: nút bấm được rồi báo lỗi bắt người dùng thử mới biết mình
     * không được phép. `disabled` + `title` nói trước, và `can(role, action)` là thứ quyết
     * định — không phải `if (role === ...)` ở component.
     */
    const issueButton = page.getByRole('button', { name: /Phát hành/i });
    await expect(issueButton).toBeDisabled();
    await expect(issueButton).toHaveAttribute('title', /CONTROLLER không có quyền/i);
  });
});
