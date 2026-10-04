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

test('FE-06 — Giao dịch viên xử lý, Kiểm soát viên chỉ xem, hai vai khách hàng bị chặn', async ({
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
  await mint.getByLabel('Mã hoặc ký hiệu token').fill('WPT');
  const target = mint.getByLabel(/Ví đích/);
  if (await target.isEditable()) await target.fill(SPV);
  await mint.getByLabel('Số lượng').fill('100');
  await mint.getByLabel('Lý do').fill('Nguồn cung e2e FE-06');
  await mint.getByRole('button', { name: /Gửi yêu cầu tạo token/ }).click();
  await expect(mint.getByRole('status')).toContainText(/chờ Kiểm soát viên duyệt/);
  const requestId = await page
    .getByRole('table', { name: 'Yêu cầu tạo token đã lập' })
    .locator('tbody tr')
    .first()
    .getAttribute('data-request-id');
  expect(requestId).toBeTruthy();

  await actAs(context, baseURL!, 'CONTROLLER');
  await page.goto(`/approvals/${requestId}`);
  await page.getByLabel('Khối hành động').getByRole('button', { name: 'Chấp nhận' }).click();
  await expect(page.getByLabel('Khối hành động').getByRole('status')).toContainText(/Đã chấp nhận/);

  // Nạp VNDB mô phỏng cũng tự cấp allowance trên mock; sau đó đặt lệnh qua transport công khai.
  await actAs(context, baseURL!, 'TELLER');
  await page.goto('/demo-payment');
  await page.getByLabel('Ví đích').fill(ALICE);
  await page.getByLabel('Số VNDB').fill('1000000');
  await page.getByRole('button', { name: 'Nạp VNDB' }).click();
  await expect(page.getByRole('status')).toContainText(/Đã nạp/);

  await actAs(context, baseURL!, 'INVESTOR');
  const placed = await post(page, '/api/purchase', {
    chain: CHAIN,
    investorWallet: ALICE,
    side: 'BUY',
    wptAmount: '2',
  });
  const orderId = placed.data?.id;
  expect(orderId).toBeTruthy();

  await actAs(context, baseURL!, 'TELLER');
  await page.goto('/transactions');
  await expect(page.getByRole('heading', { name: 'Giao dịch toàn hệ thống' })).toBeVisible();
  const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: orderId!.slice(0, 8) }) });
  const undistributed = page.getByTestId('supply-undistributed');
  const beforeSupply = BigInt((await undistributed.innerText()).replace(/\D/g, ''));
  await expect(row).toContainText('Đã đặt');
  await row.getByRole('button', { name: 'Khớp lệnh' }).click();
  await expect(page.getByRole('status')).toContainText(/Đã khớp lệnh/);
  await expect(row).toContainText('Hoàn tất');
  await expect
    .poll(async () => BigInt((await undistributed.innerText()).replace(/\D/g, '')))
    .toBe(beforeSupply - 2n);

  await row.getByRole('link', { name: orderId!.slice(0, 8) }).click();
  await expect(page.getByRole('heading', { name: `Lệnh mua ${orderId!.slice(0, 8)}` })).toBeVisible();
  await expect(page.getByText('Tiến trình quyết toán', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Về danh sách giao dịch' }).click();

  await actAs(context, baseURL!, 'CONTROLLER');
  await page.goto('/transactions');
  await expect(page.getByRole('note')).toContainText(/chỉ có quyền xem/);
  await expect(page.getByRole('button', { name: 'Khớp lệnh' })).toHaveCount(0);

  for (const role of ['INVESTOR', 'SELLER'] as const) {
    await actAs(context, baseURL!, role);
    await page.goto('/transactions');
    await expect(page.getByRole('heading', { name: /Không có quyền vào kênh/ })).toBeVisible();
  }
});
