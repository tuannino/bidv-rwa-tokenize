import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const CHAIN = 'mock';
const SPV = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
const ALICE = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

type TestRole = 'INVESTOR' | 'SELLER' | 'TELLER' | 'CONTROLLER';

async function actAs(context: BrowserContext, baseURL: string, role: TestRole) {
  const channel = role === 'INVESTOR' ? 'investor' : role === 'SELLER' ? 'seller' : role.toLowerCase();
  await context.addCookies([
    { name: 'bidv_channel', value: channel, url: baseURL },
    { name: 'bidv_role', value: role, url: baseURL },
  ]);
}

async function post(page: Page, path: string, body: object) {
  const response = await page.request.post(path, { data: body });
  const result = (await response.json()) as { ok: boolean; error?: string; data?: { id?: string } };
  expect(result.ok, result.error).toBe(true);
  return result;
}

test('FE-06 / OP-02 — xử lý giao dịch và hai màn chi tiết Mock không cần ví', async ({
  page,
  context,
  baseURL,
}) => {
  await actAs(context, baseURL!, 'TELLER');
  await post(page, '/api/investors', {
    chain: CHAIN,
    wallet: SPV,
    fullName: 'Ví thanh toán e2e FE-06',
    nationalId: 'FE06-SPV',
  });
  await post(page, '/api/investors', {
    chain: CHAIN,
    wallet: ALICE,
    fullName: 'Nhà đầu tư e2e FE-06',
    nationalId: 'FE06-INVESTOR',
  });

  // Tạo thêm nguồn cung qua đúng luồng lập–duyệt, để ca chạy độc lập với các tệp e2e khác.
  await page.goto('/draft');
  const mint = page.getByLabel('Thẻ tạo token');
  const mintReason = `Nguồn cung e2e FE-06 ${Date.now()}`;
  await mint.getByLabel('Mã hoặc ký hiệu token').fill('WPT');
  const remainingText = await mint
    .getByLabel('Khối thông tin token')
    .locator('dt', { hasText: 'Số còn được phát hành' })
    .locator('xpath=following-sibling::dd')
    .innerText();
  const remaining = BigInt(remainingText.replace(/\D/g, '') || '0');
  if (remaining > 0n) {
    const target = mint.getByLabel(/Ví đích/);
    if (await target.isEditable()) await target.fill(SPV);
    await mint.getByLabel('Số lượng').fill(String(remaining < 100n ? remaining : 100n));
    await mint.getByLabel('Lý do').fill(mintReason);
    await mint.getByRole('button', { name: /Gửi yêu cầu tạo token/ }).click();
    await expect(mint.getByRole('status')).toContainText(/chờ Kiểm soát viên duyệt/);
    // Các tệp E2E dùng chung mock ledger. Không lấy `.first()` vì đó có thể là yêu cầu cũ
    // đã hoàn tất do maker-checker tạo trước; nhận diện đúng dòng vừa gửi bằng lý do duy nhất.
    const requestRow = page
      .getByRole('table', { name: 'Yêu cầu tạo token đã lập' })
      .locator('tbody tr')
      .filter({ hasText: mintReason });
    await expect(requestRow).toHaveCount(1);
    const requestId = await requestRow.getAttribute('data-request-id');
    expect(requestId).toBeTruthy();

    await actAs(context, baseURL!, 'CONTROLLER');
    await page.goto(`/approvals/${requestId}`);
    await page.getByLabel('Khối hành động').getByRole('button', { name: 'Chấp nhận' }).click();
    await expect(page.getByLabel('Khối hành động').getByRole('status')).toContainText(/Đã chấp nhận/);
  }

  // Nạp VNDB mô phỏng cũng tự cấp allowance trên mock; sau đó Nhà đầu tư đặt lệnh trên đúng UI.
  await actAs(context, baseURL!, 'TELLER');
  await page.goto('/demo-payment');
  await page.getByLabel('Ví đích').fill(ALICE);
  await page.getByLabel('Số VNDB').fill('1000000');
  await page.getByRole('button', { name: 'Nạp VNDB' }).click();
  await expect(page.getByRole('status')).toContainText(/Đã nạp/);

  await actAs(context, baseURL!, 'INVESTOR');
  await page.goto('/trade');
  await expect(page.getByRole('note')).toContainText(/Không cần kết nối ví trình duyệt/);
  await page.getByLabel('Số lượng').fill('2');
  const confirm = page.getByRole('button', { name: 'Xác nhận lệnh mua' });
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Gửi lệnh' }).click();
  const detailLink = page.getByLabel('Lệnh vừa gửi').getByRole('link', { name: 'Xem chi tiết' });
  await expect(detailLink).toBeVisible();
  await expect(page.getByLabel('Lệnh vừa gửi')).toContainText('Hoàn tất');
  await expect(page.getByLabel('Lệnh vừa gửi')).toContainText(/Mã giao dịch/);
  const detailHref = await detailLink.getAttribute('href');
  const orderId = detailHref?.split('/').pop();
  expect(orderId).toMatch(/^[0-9a-f-]{36}$/);

  await actAs(context, baseURL!, 'TELLER');
  await page.goto('/transactions');
  await expect(page.getByRole('heading', { name: 'Giao dịch toàn hệ thống' })).toBeVisible();
  const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: orderId!.slice(0, 8) }) });
  const undistributed = page.getByTestId('supply-undistributed');
  await expect(row).toContainText('Hoàn tất');
  await expect(row.getByRole('button')).toHaveCount(0);
  const undistributedAfterBuy = BigInt((await undistributed.innerText()).replace(/\D/g, ''));

  await row.getByRole('link', { name: orderId!.slice(0, 8) }).click();
  await expect(page.getByRole('heading', { name: `Lệnh mua ${orderId!.slice(0, 8)}` })).toBeVisible();
  await expect(page.getByText('Tiến trình quyết toán', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Về danh sách giao dịch' }).click();

  await actAs(context, baseURL!, 'CONTROLLER');
  await page.goto('/transactions');
  await expect(page.getByRole('note')).toContainText(/chỉ có quyền xem/);
  await expect(page.getByRole('button', { name: /Tiếp tục quyết toán|Đối soát giao dịch/ })).toHaveCount(0);

  await actAs(context, baseURL!, 'INVESTOR');
  await page.goto('/orders');
  const ownRow = page.getByRole('row').filter({ hasText: orderId!.slice(0, 8) });
  await expect(ownRow).toContainText('Hoàn tất');

  // OP-02 ca 6: link Chi tiết dùng đúng ví hồ sơ trên Mock, không cần extension.
  await ownRow.getByRole('link', { name: 'Chi tiết' }).click();
  await expect(page.getByRole('heading', { name: `Lệnh mua ${orderId!.slice(0, 8)}` })).toBeVisible();
  await expect(page.getByText(ALICE, { exact: true })).toBeVisible();
  await expect(page.getByText('Kết cục: cả bốn bút toán đã ghi.')).toBeVisible();
  await expect(page.getByText('Chưa kết nối ví', { exact: true })).toHaveCount(0);

  // OP-02 ca 7: số dư đã đọc qua service, không chỉ render tiêu đề thẻ vị thế.
  await page.goto('/tokens/WPT');
  await expect(page.getByText('Đang giữ', { exact: true })).toBeVisible();
  await expect(page.getByText('Giá trị theo giá phát hành', { exact: true })).toBeVisible();
  await expect(page.getByText(/Kết nối ví ở góc trên phải/)).toHaveCount(0);

  // Chiều bán đi qua cùng UI và tự khớp; số chưa phân phối tăng lại 1, không cần GDV bấm.
  await page.goto('/trade');
  await page.getByRole('tab', { name: 'Bán' }).click();
  await page.getByLabel('Số lượng').fill('1');
  const confirmSell = page.getByRole('button', { name: 'Xác nhận lệnh bán' });
  await expect(confirmSell).toBeEnabled();
  await confirmSell.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Gửi lệnh' }).click();
  const sellHref = await page
    .getByLabel('Lệnh vừa gửi')
    .getByRole('link', { name: 'Xem chi tiết' })
    .getAttribute('href');
  const sellOrderId = sellHref?.split('/').pop();
  expect(sellOrderId).toMatch(/^[0-9a-f-]{36}$/);
  await expect(page.getByLabel('Lệnh vừa gửi')).toContainText('Hoàn tất');

  await actAs(context, baseURL!, 'TELLER');
  await page.goto('/transactions');
  const sellRow = page.getByRole('row').filter({
    has: page.getByRole('link', { name: sellOrderId!.slice(0, 8) }),
  });
  await expect(sellRow).toContainText('Hoàn tất');
  await expect(sellRow.getByRole('button')).toHaveCount(0);
  await expect
    .poll(async () => BigInt((await page.getByTestId('supply-undistributed').innerText()).replace(/\D/g, '')))
    .toBe(undistributedAfterBuy + 1n);

  // Burn phần chưa phân phối cũng đi qua maker-checker và làm tổng cung giảm đúng số duyệt.
  await page.goto('/draft');
  const burn = page.getByLabel('Thẻ huỷ token');
  const burnReason = `Huỷ nguồn cung e2e FE-06 ${Date.now()}`;
  await burn.getByLabel('Mã hoặc ký hiệu token').fill('WPT');
  const totalText = await burn
    .getByLabel('Khối thông tin token')
    .locator('dt', { hasText: 'Tổng cung hiện tại' })
    .locator('xpath=following-sibling::dd')
    .innerText();
  const totalBeforeBurn = BigInt(totalText.replace(/\D/g, '') || '0');
  await burn.getByLabel('Số lượng').fill('10');
  await burn.getByLabel('Lý do').fill(burnReason);
  await burn.getByRole('button', { name: /Gửi yêu cầu huỷ token/ }).click();
  await expect(burn.getByRole('status')).toContainText(/chờ Kiểm soát viên duyệt/);
  const burnRow = page
    .getByRole('table', { name: 'Yêu cầu huỷ token đã lập' })
    .locator('tbody tr')
    .filter({ hasText: burnReason });
  const burnRequestId = await burnRow.getAttribute('data-request-id');
  expect(burnRequestId).toBeTruthy();

  await actAs(context, baseURL!, 'CONTROLLER');
  await page.goto(`/approvals/${burnRequestId}`);
  await page.getByLabel('Khối hành động').getByRole('button', { name: 'Chấp nhận' }).click();
  await expect(page.getByLabel('Khối hành động').getByRole('status')).toContainText(/Đã chấp nhận/);
  await expect
    .poll(async () => {
      const text = await page
        .getByLabel('Khối thông tin token')
        .locator('dt', { hasText: 'Tổng cung hiện tại' })
        .locator('xpath=following-sibling::dd')
        .innerText();
      return BigInt(text.replace(/\D/g, '') || '0');
    })
    .toBe(totalBeforeBurn - 10n);

  await actAs(context, baseURL!, 'INVESTOR');
  await page.goto('/transactions');
  await expect(page.getByRole('heading', { name: /Không có quyền vào kênh/ })).toBeVisible();
  await actAs(context, baseURL!, 'SELLER');
  await page.goto('/transactions');
  await expect(page.getByRole('heading', { name: /Không có quyền vào kênh/ })).toBeVisible();
});

test('OP-02 — hai màn chi tiết vẫn mời kết nối ví trên chain thật', async ({ page, context, baseURL }) => {
  await actAs(context, baseURL!, 'INVESTOR');
  for (const path of ['/orders/00000000-0000-0000-0000-000000000001', '/tokens/WPT']) {
    await page.goto(path);
    // Chờ hydration trước khi đổi chain, giống khuôn các test chọn kênh.
    await expect(page.locator('button[title^="Chuyển sang"]')).toBeVisible();
    await page.locator('#chain-selector').selectOption('hardhat-local');
    if (path.startsWith('/orders/')) {
      await expect(page.getByText('Chưa kết nối ví', { exact: true })).toBeVisible();
    } else {
      await expect(page.getByText(/Kết nối ví ở góc trên phải/)).toBeVisible();
      await expect(page.getByText('Đang giữ', { exact: true })).toHaveCount(0);
    }
  }
});
