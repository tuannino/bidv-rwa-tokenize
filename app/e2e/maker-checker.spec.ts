import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * E2E màn Lập lệnh và Phê duyệt lệnh (FE-22).
 *
 * Một chuỗi nối tiếp trên cùng máy chủ e2e (chuỗi `mock`, lưu trong bộ nhớ): Giao dịch viên lập
 * yêu cầu tạo token, Kiểm soát viên mở hàng chờ rồi chấp nhận, số liệu nguồn cung và nhật ký đổi
 * theo. Ca tự duyệt (ca 8) cần đổi MÃ TÀI KHOẢN, thứ máy chủ e2e cố định bằng biến môi trường, nên
 * kiểm ở `test/maker-checker-ui.test.ts`.
 *
 * Không chốt cứng tổng cung: các tệp e2e khác chạy trên cùng máy chủ và có thể đã phát hành.
 */

// Hardhat account #4 — ví thanh toán SPV dùng trong các test phía máy chủ.
const SPV = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
const AMOUNT = 1234;

async function actAs(context: BrowserContext, baseURL: string, role: 'TELLER' | 'CONTROLLER') {
  await context.addCookies([
    { name: 'bidv_channel', value: role === 'TELLER' ? 'teller' : 'controller', url: baseURL },
    { name: 'bidv_role', value: role, url: baseURL },
  ]);
}

const mintCard = (page: Page) => page.getByLabel('Thẻ tạo token');
const burnCard = (page: Page) => page.getByLabel('Thẻ huỷ token');

/** Số trong một ô của khối thông tin token, bỏ dấu chấm hàng nghìn. */
async function infoNumber(page: Page, scope: ReturnType<typeof mintCard>, label: string) {
  const text = await scope.locator('dt', { hasText: label }).locator('xpath=following-sibling::dd').innerText();
  return BigInt(text.replace(/\D/g, '') || '0');
}

test.describe.serial('Lập lệnh và Phê duyệt lệnh', () => {
  let requestId = '';
  let supplyBefore = 0n;

  test('chuẩn bị: whitelist ví SPV bằng màn KYC có sẵn', async ({ page }) => {
    await page.goto('/mint');
    await page.getByLabel('Ví nhà đầu tư').fill(SPV);
    await page.getByRole('button', { name: /KYC \+ Whitelist/i }).click();
    await expect(page.getByRole('status')).toContainText(/whitelist=true/i);
  });

  test('ca 1, 2, 3 — Giao dịch viên lập yêu cầu tạo token', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'TELLER');
    await page.goto('/draft');
    await expect(page.getByRole('heading', { name: 'Lập lệnh' })).toBeVisible();

    const card = mintCard(page);
    // Ca 1: nhập ký hiệu thì khối thông tin token tự đổ đủ chỉ tiêu.
    await card.getByLabel('Mã hoặc ký hiệu token').fill('wpt');
    const info = card.getByLabel('Khối thông tin token');
    for (const label of [
      'Dự án',
      'Hợp đồng',
      'Trần phát hành',
      'Số còn được phát hành',
      'Tổng cung hiện tại',
      'Số chưa phân phối',
      'Số đang lưu hành',
      'Mã người bán',
      'Ví thanh toán',
    ]) {
      await expect(info.locator('dt', { hasText: label })).toBeVisible();
    }
    await expect(info).toContainText('20.000.000');
    supplyBefore = await infoNumber(page, info, 'Tổng cung hiện tại');

    const wallet = card.getByLabel(/Ví đích/);
    if (await wallet.isEditable()) await wallet.fill(SPV);
    await card.getByLabel('Lý do').fill('Phát hành đợt e2e');

    // Ca 2: vượt trần còn lại thì nút gửi khoá, khối kiểm tra nêu đúng điều kiện trượt.
    await card.getByLabel('Số lượng').fill('999999999999');
    const checks = card.getByLabel('Khối kiểm tra trước khi lập');
    await expect(checks.locator('[data-check="cap"]')).toHaveAttribute('data-passed', 'false');
    await expect(checks).toContainText(/Không vượt trần còn lại Không đạt/);
    const submit = card.getByRole('button', { name: /Gửi yêu cầu tạo token/ });
    await expect(submit).toBeDisabled();
    await expect(card.getByTestId('mint-block-reason')).toContainText(/Không vượt trần còn lại/);

    // Trong trần thì mọi điều kiện đạt, nút mở.
    await card.getByLabel('Số lượng').fill(String(AMOUNT));
    await expect(checks.locator('[data-check="cap"]')).toHaveAttribute('data-passed', 'true');
    await expect(submit).toBeEnabled();

    const badge = page.getByRole('link', { name: /Lập lệnh/ }).getByLabel(/việc đang chờ/);
    const draftBefore = Number(await badge.innerText());

    // Ca 3: gửi xong có thông báo, yêu cầu ở trạng thái chờ duyệt, số việc chờ tăng.
    await submit.click();
    await expect(card.getByRole('status')).toContainText(/Đã gửi yêu cầu tạo 1\.234 WPT/);
    await expect(card.getByRole('status')).toContainText(/chờ Kiểm soát viên duyệt/);
    const mine = page.getByRole('table', { name: 'Yêu cầu tạo token đã lập' });
    const row = mine.locator('tbody tr').first();
    await expect(row).toContainText('1.234');
    await expect(row).toContainText('Chờ duyệt');
    requestId = (await row.getAttribute('data-request-id')) ?? '';
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
    await expect(badge).toHaveText(String(draftBefore + 1));
  });

  test('ca 4 — chọn nguồn toàn bộ nguồn cung thì có cảnh báo xác nhận lại', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'TELLER');
    await page.goto('/draft');
    const card = burnCard(page);
    await card.getByLabel('Mã hoặc ký hiệu token').fill('WPT');
    await expect(card.getByLabel('Khối thông tin token')).toContainText('Tổng cung hiện tại');

    await card.getByLabel('Nguồn huỷ').selectOption('TOTAL_SUPPLY');
    const warning = card.getByRole('alert');
    await expect(warning).toContainText(/TOÀN BỘ nguồn cung/);
    await expect(warning.getByLabel('Tôi xác nhận huỷ toàn bộ nguồn cung')).not.toBeChecked();
    // Tự điền số lượng bằng tổng cung máy chủ trả.
    const total = await infoNumber(page, card.getByLabel('Khối thông tin token'), 'Tổng cung hiện tại');
    await expect(card.getByLabel('Số lượng')).toHaveValue(total.toString());
    await expect(card.getByRole('button', { name: /Gửi yêu cầu huỷ token/ })).toBeDisabled();
  });

  test('ca 7 — guard hai chiều: Giao dịch viên không vào được Phê duyệt', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'TELLER');
    await page.goto('/approvals');
    await expect(page.getByRole('heading', { name: /Không có quyền vào kênh/ })).toBeVisible();
    await page.goto(`/approvals/${requestId}`);
    await expect(page.getByRole('heading', { name: /Không có quyền vào kênh/ })).toBeVisible();
  });

  test('ca 7 — guard hai chiều: Kiểm soát viên không vào được Lập lệnh', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'CONTROLLER');
    await page.goto('/draft');
    await expect(page.getByRole('heading', { name: /Không có quyền vào kênh/ })).toBeVisible();
  });

  test('ca 5, 6 — Kiểm soát viên từ chối phải có lý do; chấp nhận thì hoàn tất', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'CONTROLLER');
    await page.goto('/approvals');
    await expect(page.getByRole('heading', { name: 'Phê duyệt lệnh' })).toBeVisible();
    await expect(page.getByLabel('Đang chờ duyệt')).not.toContainText('—');

    // Hàng chờ có ô tìm kiếm và bộ lọc trạng thái, mặc định đang chờ duyệt.
    const queue = page.getByLabel('Hàng chờ tạo token');
    await expect(queue.getByLabel('Trạng thái')).toHaveValue('PENDING');
    await queue.getByLabel('Tìm kiếm').fill(requestId.slice(0, 8));
    await queue.getByRole('link', { name: requestId.slice(0, 8) }).click();

    await expect(page.getByRole('heading', { name: 'Chi tiết yêu cầu' })).toBeVisible();
    const actions = page.getByLabel('Khối hành động');
    await expect(actions).toContainText('Chờ duyệt');
    await expect(page.getByLabel('Khối nội dung yêu cầu')).toContainText('1.234');
    const timeline = page.getByLabel('Nhật ký');
    await expect(timeline.locator('li')).toHaveCount(1);

    // Ca 6: chưa nhập lý do thì nút từ chối khoá.
    const reject = actions.getByRole('button', { name: 'Từ chối' });
    await expect(reject).toBeDisabled();
    await expect(page.getByTestId('reject-block-reason')).toContainText(/Phải nhập lý do/);
    await actions.getByLabel('Lý do từ chối').fill('thử');
    await expect(reject).toBeEnabled();
    await actions.getByLabel('Lý do từ chối').fill('');
    await expect(reject).toBeDisabled();

    // Ca 5: chấp nhận → hoàn tất, nguồn cung đổi, nhật ký thêm một dòng.
    await actions.getByRole('button', { name: 'Chấp nhận' }).click();
    await expect(actions.getByRole('status')).toContainText(/Đã chấp nhận/);
    await expect(actions).toContainText('Hoàn tất');
    await expect(timeline.locator('li')).toHaveCount(2);
    await expect(timeline).toContainText('Chấp nhận, hoàn tất trên chuỗi');
    const info = page.getByLabel('Khối thông tin token');
    await expect
      .poll(() => infoNumber(page, info, 'Tổng cung hiện tại'))
      .toBe(supplyBefore + BigInt(AMOUNT));
    await expect(actions.getByRole('button', { name: 'Chấp nhận' })).toBeDisabled();
  });

  test('việc 13 — bộ lọc trạng thái có đủ năm trạng thái', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'CONTROLLER');
    await page.goto('/approvals');
    const options = page.getByLabel('Hàng chờ tạo token').getByLabel('Trạng thái').locator('option');
    await expect(options).toHaveText([
      'Tất cả trạng thái',
      'Chờ duyệt',
      'Đang xử lý',
      'Hoàn tất',
      'Từ chối',
      'Thất bại',
    ]);
    await page.getByLabel('Hàng chờ tạo token').getByLabel('Trạng thái').selectOption('COMPLETED');
    await expect(page.getByLabel('Hàng chờ tạo token').locator(`[data-request-id="${requestId}"]`)).toContainText(
      'Hoàn tất',
    );
  });
});
