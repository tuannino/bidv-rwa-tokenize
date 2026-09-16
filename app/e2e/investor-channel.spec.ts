import { expect, test } from '@playwright/test';

/**
 * E2E phân tách kênh nhà đầu tư (FE-01).
 *
 * Đặt vai trò bằng cùng cơ chế mà bộ đổi vai dùng: cookie `bidv_role`.
 */

async function asRole(
  context: import('@playwright/test').BrowserContext,
  baseURL: string,
  role: string,
) {
  await context.addCookies([{ name: 'bidv_role', value: role, url: baseURL }]);
}

test.describe('Kênh nhà đầu tư', () => {
  test('vai INVESTOR vào được kênh và thấy menu nghiệp vụ nhà đầu tư', async ({
    page,
    context,
    baseURL,
  }) => {
    await asRole(context, baseURL!, 'INVESTOR');

    await page.goto('/portfolio');
    await expect(
      page.getByRole('heading', { name: /Tổng quan nhà đầu tư/i }),
    ).toBeVisible();

    // R3.3 — menu của kênh nhà đầu tư, đúng nhóm và đúng ký hiệu WPT.
    const sidebar = page.getByRole('complementary');
    await expect(sidebar).toContainText('Nghiệp vụ nhà đầu tư');
    await expect(sidebar).toContainText('Mua WPT');
    await expect(sidebar).toContainText('Lợi nhuận');
    await expect(sidebar).toContainText('Tất toán');

    // R4.1 — KHÔNG được thấy menu của kênh ngân hàng.
    await expect(sidebar).not.toContainText('Phát hành WPT');
    await expect(sidebar).not.toContainText('Đối soát doanh thu');
    await expect(sidebar).not.toContainText('Module nghiệp vụ');
  });

  test('mục menu chưa khả dụng thì không điều hướng được', async ({ page, context, baseURL }) => {
    await asRole(context, baseURL!, 'INVESTOR');
    await page.goto('/portfolio');

    // Bước 2: mục `disabled` không bọc Link nên không có vai trò link.
    const sidebar = page.getByRole('complementary');
    await expect(sidebar.getByRole('link', { name: /Mua WPT/i })).toHaveCount(0);
    await expect(sidebar.locator('[aria-disabled="true"]')).toHaveCount(3);
  });

  test('vai INVESTOR không vào được kênh ngân hàng', async ({ page, context, baseURL }) => {
    await asRole(context, baseURL!, 'INVESTOR');

    await page.goto('/mint');
    await expect(page.getByRole('heading', { name: /Không có quyền vào kênh/i })).toBeVisible();
    await expect(page.getByText('token:mint, investor:whitelist')).toBeVisible();
  });

  test('menu kênh ngân hàng KHÔNG chứa mục của kênh nhà đầu tư', async ({
    page,
    context,
    baseURL,
  }) => {
    await asRole(context, baseURL!, 'BANK_ADMIN');
    await page.goto('/mint');

    // R4.2 (phần menu) — nhãn kênh ngân hàng giữ nguyên, không lẫn mục nhà đầu tư.
    const sidebar = page.getByRole('complementary');
    await expect(sidebar).toContainText('Module nghiệp vụ');
    await expect(sidebar).toContainText('Phát hành WPT');
    await expect(sidebar).not.toContainText('Mua WPT');
    await expect(sidebar).not.toContainText('Nghiệp vụ nhà đầu tư');
  });

  /**
   * R4.2 / DoD "vai ngân hàng vào /portfolio thì bị chặn" — CHƯA ĐẠT ĐƯỢC.
   *
   * Không phải lỗi cài đặt: `requireAny={['balance:read']}` là đúng theo R2.1, nhưng
   * `permissions.ts` xếp `balance:read` vào nhóm READ_ONLY mà CẢ BỐN vai đều có
   * (BANK_ADMIN/COMPLIANCE/AUDITOR spread READ_ONLY, INVESTOR khai trực tiếp).
   * Nên guard này không chặn được ai. Sửa đúng cần thêm quyền mới vào `permissions.ts`,
   * mà R2.4 và mục "Việc KHÔNG được làm" của tasks.md đều cấm trong FE-01.
   *
   * Giữ test ở dạng `fixme` để không mất dấu yêu cầu: nó hiện trong báo cáo là chưa
   * chạy, thay vì biến mất im lặng. Bỏ `fixme` ngay khi Owner chốt phương án
   * (xem docs/CHECKPOINT_FE01.md, mục Câu hỏi mở).
   */
  test.fixme('vai BANK_ADMIN không vào được kênh nhà đầu tư', async ({ page, context, baseURL }) => {
    await asRole(context, baseURL!, 'BANK_ADMIN');

    await page.goto('/portfolio');
    await expect(page.getByRole('heading', { name: /Không có quyền vào kênh Nhà đầu tư/i })).toBeVisible();
  });
});
