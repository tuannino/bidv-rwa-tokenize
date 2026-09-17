import { expect, test, type BrowserContext } from '@playwright/test';

/**
 * E2E tách kênh nhà đầu tư (FE-01 v2).
 *
 * Mô hình v2: KÊNH là lựa chọn tường minh (cookie `bidv_channel`), VAI vẫn là cookie
 * `bidv_role`. Hai cookie phải nhất quán — đó là thứ `setChannel` bảo đảm và là thứ mấy ca
 * dưới đây kiểm.
 *
 * Máy chủ e2e chạy với `DEMO_ROLE=BANK_ADMIN` và không có cookie, nên trạng thái ban đầu là
 * kênh Admin console (mặc định `admin`) — xem `playwright.config.ts`.
 */

/** Đặt cả hai cookie, giống hệt việc `setChannel` làm ở server. */
async function enterInvestorChannel(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    { name: 'bidv_channel', value: 'investor', url: baseURL },
    { name: 'bidv_role', value: 'INVESTOR', url: baseURL },
  ]);
}

async function asBankRole(context: BrowserContext, baseURL: string, role: string) {
  await context.addCookies([
    { name: 'bidv_channel', value: 'admin', url: baseURL },
    { name: 'bidv_role', value: role, url: baseURL },
  ]);
}

/**
 * Chờ trang hydrate xong TRƯỚC khi tương tác với bộ chọn.
 *
 * Không có bước này thì `selectOption` chạy lúc onChange chưa gắn: ô chọn đổi giá trị hiển thị
 * mà KHÔNG có POST server action nào, cookie không đổi, và test đỏ với thông báo trỏ sai hoàn
 * toàn về phía điều hướng. Đã mất một vòng truy vì chuyện này.
 *
 * Mốc dùng làm tín hiệu: nút đổi theme trong `header.tsx` chỉ render sau khi mount
 * (`mounted && ...`), nên nó xuất hiện là bằng chứng client đã chạy.
 */
async function waitForHydration(page: import('@playwright/test').Page) {
  await expect(page.locator('button[title^="Chuyển sang"]')).toBeVisible();
}

test.describe('Cổng quyền vào kênh nhà đầu tư', () => {
  test('INVESTOR vào được /portfolio và thấy đủ bốn hộp', async ({ page, context, baseURL }) => {
    await enterInvestorChannel(context, baseURL!);

    await page.goto('/portfolio');
    await expect(page.getByRole('heading', { name: /Tổng quan nhà đầu tư/i })).toBeVisible();

    // Bốn hộp theo R5–R8.
    await expect(page.getByRole('heading', { name: 'Tài sản đã đầu tư' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Trạng thái phát hành' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Giao dịch gần đây' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Token dự án điện gió' })).toBeVisible();
  });

  /**
   * Đây là DoD mà FE-01 v1 KHÔNG đạt được và phải để test ở dạng `fixme`: v1 dùng
   * `balance:read` làm cổng kênh, mà quyền đó nằm trong READ_ONLY nên cả bốn vai đều có.
   * v2 dùng `portfolio:read` chỉ cấp cho INVESTOR, nên ba vai ngân hàng phải bị chặn.
   */
  for (const role of ['BANK_ADMIN', 'COMPLIANCE', 'AUDITOR']) {
    test(`vai ${role} KHÔNG vào được kênh nhà đầu tư`, async ({ page, context, baseURL }) => {
      await asBankRole(context, baseURL!, role);

      await page.goto('/portfolio');
      await expect(
        page.getByRole('heading', { name: /Không có quyền vào kênh Nhà đầu tư/i }),
      ).toBeVisible();
      await expect(page.getByText('portfolio:read')).toBeVisible();
    });
  }

  test('chưa kết nối ví thì MỜI kết nối, không hiện số 0', async ({ page, context, baseURL }) => {
    await enterInvestorChannel(context, baseURL!);

    await page.goto('/portfolio');
    // R5.3 — số 0 là một khẳng định sai khi chưa biết ví nào.
    await expect(page.getByText('Chưa kết nối ví')).toBeVisible();
  });
});

test.describe('Bộ chọn kênh', () => {
  test('đổi sang kênh nhà đầu tư thì về /portfolio và ẩn bộ chọn vai', async ({ page }) => {
    await page.goto('/');
    // Mặc định là Admin console -> phải thấy CẢ HAI bộ chọn.
    await expect(page.locator('#channel-switcher')).toBeVisible();
    await expect(page.locator('#role-switcher')).toBeVisible();

    await waitForHydration(page);
    await page.locator('#channel-switcher').selectOption('investor');

    // R1.3 — điều hướng về trang mặc định của kênh.
    await expect(page).toHaveURL(/\/portfolio$/);
    // R2.1/R2.3 — kênh nhà đầu tư không có bộ chọn vai.
    await expect(page.locator('#role-switcher')).toHaveCount(0);
    // R1.5 — bộ chọn kênh vẫn còn để quay lại được.
    await expect(page.locator('#channel-switcher')).toBeVisible();
  });

  test('đổi về Admin console khi đang là nhà đầu tư thì vai thành BANK_ADMIN', async ({
    page,
    context,
    baseURL,
  }) => {
    await enterInvestorChannel(context, baseURL!);
    await page.goto('/portfolio');

    await waitForHydration(page);
    await page.locator('#channel-switcher').selectOption('admin');

    // R1.4 — về trang tổng quan ngân hàng.
    await expect(page).toHaveURL(/\/$/);
    // R2.4 — vai INVESTOR không có quyền nào của kênh admin, nên phải được đưa về BANK_ADMIN.
    // Sidebar in vai đang có hiệu lực (đọc từ cookie, không phải từ env).
    await expect(page.getByRole('complementary')).toContainText('vai trò BANK_ADMIN');
    await expect(page.locator('#role-switcher')).toBeVisible();
  });

  test('bộ chọn vai KHÔNG còn lựa chọn nhà đầu tư', async ({ page }) => {
    await page.goto('/');

    // R2.2 — chỉ ba vai ngân hàng; vai INVESTOR do bộ chọn KÊNH đặt.
    const options = page.locator('#role-switcher option');
    await expect(options).toHaveCount(3);
    await expect(page.locator('#role-switcher')).not.toContainText('Nhà đầu tư');
  });
});

test.describe('Điều hướng theo kênh', () => {
  test('menu kênh nhà đầu tư không lẫn mục của kênh ngân hàng', async ({
    page,
    context,
    baseURL,
  }) => {
    await enterInvestorChannel(context, baseURL!);
    await page.goto('/portfolio');

    const sidebar = page.getByRole('complementary');
    await expect(sidebar).toContainText('Nghiệp vụ nhà đầu tư');
    await expect(sidebar).toContainText('Mua WPT');
    await expect(sidebar).not.toContainText('Phát hành WPT');
    await expect(sidebar).not.toContainText('Module nghiệp vụ');
  });

  test('menu kênh ngân hàng không lẫn mục của kênh nhà đầu tư', async ({ page }) => {
    await page.goto('/mint');

    const sidebar = page.getByRole('complementary');
    await expect(sidebar).toContainText('Module nghiệp vụ');
    await expect(sidebar).toContainText('Phát hành WPT');
    await expect(sidebar).not.toContainText('Mua WPT');
    await expect(sidebar).not.toContainText('Nghiệp vụ nhà đầu tư');
  });

  test('mục chưa khả dụng không điều hướng được', async ({ page, context, baseURL }) => {
    await enterInvestorChannel(context, baseURL!);
    await page.goto('/portfolio');

    const sidebar = page.getByRole('complementary');
    // Không bọc `Link` -> không có vai trò link, nên bàn phím và trình đọc màn hình cũng
    // không đi tới được (chặn bằng CSS thì vẫn đi tới được).
    await expect(sidebar.getByRole('link', { name: /Mua WPT/i })).toHaveCount(0);
    await expect(sidebar.locator('[aria-disabled="true"]')).toHaveCount(3);
  });
});

test.describe('Trang chi tiết dự án token', () => {
  test('bấm một dòng trong danh sách token thì mở được trang chi tiết', async ({
    page,
    context,
    baseURL,
  }) => {
    await enterInvestorChannel(context, baseURL!);
    await page.goto('/portfolio');

    await page.getByRole('link', { name: /WPT-QTR3/ }).click();

    await expect(page).toHaveURL(/\/tokens\/WPT-QTR3$/);
    await expect(page.getByRole('heading', { name: /Điện gió Hướng Linh 3/i })).toBeVisible();
    // Dự án chưa lên chuỗi phải nói rõ, không hiện số dư 0.
    await expect(page.getByText('chưa triển khai trên chuỗi')).toBeVisible();
  });

  test('dự án đã lên chuỗi hiển thị phần vị thế và nhãn on-chain', async ({
    page,
    context,
    baseURL,
  }) => {
    await enterInvestorChannel(context, baseURL!);
    await page.goto('/tokens/WPT');

    await expect(page.getByRole('heading', { name: /Điện gió Bạc Liêu 1/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Vị thế của bạn' })).toBeVisible();
    await expect(page.getByText('on-chain').first()).toBeVisible();
  });

  test('mã token không tồn tại thì ra trang không tìm thấy', async ({ page, context, baseURL }) => {
    await enterInvestorChannel(context, baseURL!);

    const response = await page.goto('/tokens/KHONG-CO-THAT');

    // R9.4 — trang không tìm thấy, không phải lỗi kỹ thuật 500.
    expect(response?.status()).toBe(404);
  });
});

test.describe('Nhãn dữ liệu mẫu', () => {
  test('số liệu chưa có nguồn thật đều có nhãn', async ({ page, context, baseURL }) => {
    await enterInvestorChannel(context, baseURL!);
    await page.goto('/portfolio');

    // R6.2/R10.2 — có nhãn, và nói rõ chưa có thị trường thứ cấp.
    await expect(page.getByText('dữ liệu mẫu').first()).toBeVisible();
    await expect(page.getByText(/Chưa có thị trường thứ cấp/i).first()).toBeVisible();
  });

  test('KHÔNG hiển thị biến động giá hay khối lượng giao dịch', async ({
    page,
    context,
    baseURL,
  }) => {
    await enterInvestorChannel(context, baseURL!);
    await page.goto('/portfolio');

    // R6.3 — chưa có thị trường thứ cấp thì bày mấy số này ra là trình bày sai bản chất.
    await expect(page.getByText(/khối lượng giao dịch/i)).toHaveCount(0);
    await expect(page.getByText(/biến động giá/i)).toHaveCount(0);
  });
});
