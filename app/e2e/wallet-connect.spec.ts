import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * E2E màn kết nối ví (FE-02).
 *
 * Chromium của Playwright KHÔNG có tiện ích ví nào, nên môi trường này dựng được đúng bốn
 * trạng thái: `loading`, `mock`, `unsupported-chain`, `no-provider`. Ba trạng thái còn lại
 * (`disconnected`, `wrong-chain`, `chain-mismatch`, `ready`) cần ví thật ký, phải kiểm tay —
 * xem bảng trong `docs/CHECKPOINT_FE02.md`. Logic quyết định của cả tám trạng thái đã có
 * unit test ở `test/wallet-status.test.ts`.
 *
 * Máy chủ e2e chạy `NEXT_PUBLIC_DEFAULT_CHAIN=mock` và `DEMO_ROLE=BANK_ADMIN` (xem
 * `playwright.config.ts`), nên phải đặt cookie mới vào được kênh nhà đầu tư.
 */

/** Đặt cả hai cookie, giống hệt việc `setChannel` làm ở server. */
async function enterInvestorChannel(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    { name: 'bidv_channel', value: 'investor', url: baseURL },
    { name: 'bidv_role', value: 'INVESTOR', url: baseURL },
  ]);
}

/**
 * Chờ hydrate xong TRƯỚC khi tương tác với bộ chọn.
 *
 * Mốc dùng làm tín hiệu: nút đổi theme trong `header.tsx` chỉ render sau khi mount, nên nó
 * xuất hiện là bằng chứng client đã chạy. Không có bước này thì `selectOption` chạy lúc
 * onChange chưa gắn: ô chọn đổi giá trị hiển thị mà không có gì xảy ra.
 */
async function waitForHydration(page: Page) {
  await expect(page.locator('button[title^="Chuyển sang"]')).toBeVisible();
}

test.describe('Trang Ví của tôi', () => {
  test('có trong menu nhà đầu tư và mở được', async ({ page, context, baseURL }) => {
    await enterInvestorChannel(context, baseURL!);

    await page.goto('/portfolio');
    const link = page.getByRole('link', { name: /Ví của tôi/ }).first();
    await expect(link).toBeVisible();

    await link.click();
    await expect(page).toHaveURL(/\/wallet$/);
    await expect(page.getByRole('heading', { name: 'Ví của tôi', level: 1 })).toBeVisible();
  });

  /**
   * R4.3 — chế độ mô phỏng không cần ví thật, nên KHÔNG được hiện bất kỳ cảnh báo ví nào.
   * Đây là trạng thái mặc định của bản triển khai miễn phí, tức là thứ đa số người xem demo
   * gặp đầu tiên.
   */
  test('chế độ mock: nói rõ không cần ví, KHÔNG cảnh báo sai mạng', async ({
    page,
    context,
    baseURL,
  }) => {
    await enterInvestorChannel(context, baseURL!);
    await page.goto('/wallet');
    await waitForHydration(page);

    await expect(page.locator('#chain-selector')).toHaveValue('mock');
    await expect(page.getByRole('heading', { name: /Đang ở chế độ mô phỏng/ })).toBeVisible();
    await expect(page.getByText(/không cần ví thật/)).toBeVisible();

    /*
     * Không cảnh báo sai mạng, không đòi cài ví, không mời kết nối.
     *
     * Phạm vi phải bó trong `main`: `page.getByRole('alert')` toàn trang bắt luôn vùng thông
     * báo rỗng mà Next.js Dev Tools chèn vào cuối `body`, nên phép kiểm "không có alert nào"
     * đỏ vì lý do chẳng liên quan gì tới ví.
     */
    await expect(page.locator('main').getByRole('alert')).toHaveCount(0);
    await expect(page.getByText('Ví đang ở mạng khác')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Chưa có ví trong trình duyệt/ })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Chưa kết nối ví/ })).toHaveCount(0);
  });

  /**
   * R2.1 — không có ví thì hướng dẫn cài, KHÔNG hiện lỗi kỹ thuật và KHÔNG màn trắng.
   * Phải đổi mạng sang hardhat-local trước, vì `mock` đứng trước mọi phép kiểm ví.
   */
  test('không có ví trong trình duyệt: hiện hướng dẫn cài, không lỗi kỹ thuật', async ({
    page,
    context,
    baseURL,
  }) => {
    await enterInvestorChannel(context, baseURL!);
    await page.goto('/wallet');
    await waitForHydration(page);

    await page.locator('#chain-selector').selectOption('hardhat-local');

    await expect(page.getByRole('heading', { name: /Chưa có ví trong trình duyệt/ })).toBeVisible();
    // Hướng dẫn phải có liên kết tải ví thật, không chỉ nói suông.
    await expect(page.getByRole('link', { name: /MetaMask/ })).toHaveAttribute(
      'href',
      /metamask\.io/,
    );
    // Bước hay bị kẹt nhất: cài xong mà không tải lại trang.
    await expect(page.getByText(/Tải lại trang này/)).toBeVisible();

    // R2.2 — không được lộ thuật ngữ kỹ thuật ra màn hình.
    const body = (await page.locator('main').innerText()).toLowerCase();
    for (const jargon of ['provider', 'injected', 'eip-1193', 'undefined', 'null']) {
      expect(body, `không được hiện thuật ngữ "${jargon}"`).not.toContain(jargon);
    }
  });

  /**
   * Mạng Stellar không thuộc họ EVM. `stellar` đang bị disable trong bộ chọn (adapter stub)
   * nên không chọn được từ giao diện — đó là lý do ca này kiểm bằng cách khẳng định option
   * bị disable, thay vì bịa ra một đường đi không tồn tại.
   */
  test('mạng Stellar bị disable trong bộ chọn nên không vào được trạng thái ví Stellar', async ({
    page,
    context,
    baseURL,
  }) => {
    await enterInvestorChannel(context, baseURL!);
    await page.goto('/wallet');
    await waitForHydration(page);

    await expect(page.locator('#chain-selector option[value="stellar"]')).toBeDisabled();
  });

  /** R6.1 và R6.3 — lần kết xuất đầu không phụ thuộc trạng thái ví. */
  test('không có lỗi lệch kết xuất khi tải trang', async ({ page, context, baseURL }) => {
    await enterInvestorChannel(context, baseURL!);

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/wallet');
    await waitForHydration(page);
    // Chờ thêm một nhịp để React kịp báo lệch kết xuất nếu có.
    await page.waitForTimeout(1000);

    const hydrationErrors = consoleErrors.filter((text) =>
      /hydrat|did not match|server rendered|text content does not match/i.test(text),
    );

    expect(hydrationErrors, `lỗi lệch kết xuất:\n${hydrationErrors.join('\n')}`).toEqual([]);
    expect(pageErrors, `ngoại lệ chưa bắt:\n${pageErrors.join('\n')}`).toEqual([]);
  });

  /**
   * Trang mới nằm trong route-group `(client)` nên phải được `ChannelGuard` bảo vệ sẵn.
   * Kiểm để chắc là guard ở layout group thật sự phủ trang thêm sau, không phải chỉ trên giấy.
   */
  for (const role of ['BANK_ADMIN', 'COMPLIANCE', 'AUDITOR']) {
    test(`vai ${role} KHÔNG vào được trang ví của nhà đầu tư`, async ({
      page,
      context,
      baseURL,
    }) => {
      await context.addCookies([
        { name: 'bidv_channel', value: 'admin', url: baseURL! },
        { name: 'bidv_role', value: role, url: baseURL! },
      ]);

      await page.goto('/wallet');
      await expect(
        page.getByRole('heading', { name: /Không có quyền vào kênh Nhà đầu tư/i }),
      ).toBeVisible();
    });
  }
});
