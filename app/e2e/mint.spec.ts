import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

/**
 * E2E luồng MINT qua giao diện (T1.6).
 *
 * Kiểm bằng cái mà nghiệm thu Phase 1 yêu cầu: từ UI, mint 100 -> **balance = 100**,
 * và giao dịch xuất hiện trong lịch sử. Đọc số dư lấy từ ledger (server action),
 * không phải từ state cục bộ của form.
 */

// Hardhat account #1 — dùng cho cả mock lẫn hardhat-local.
const INVESTOR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
// NB001 — ví SPV mẫu do OP-03 nạp whitelist khi dựng chain hardhat.
const SPV = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
const ON_HARDHAT = process.env.E2E_CHAIN === 'hardhat-local';
const HARDHAT_RPC = `http://127.0.0.1:${process.env.EVM_LOCAL_PORT ?? 8545}`;

async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const response = await fetch(HARDHAT_RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const body = (await response.json()) as { result?: T; error?: { message?: string } };
  if (body.result === undefined) throw new Error(body.error?.message ?? `${method} thất bại.`);
  return body.result;
}

const blockNumber = async () => BigInt(await rpc<string>('eth_blockNumber'));

async function actAs(
  context: BrowserContext,
  baseURL: string,
  role: 'TELLER' | 'CONTROLLER',
) {
  await context.addCookies([
    { name: 'bidv_channel', value: role === 'TELLER' ? 'teller' : 'controller', url: baseURL },
    { name: 'bidv_role', value: role, url: baseURL },
  ]);
}

async function infoNumber(scope: Locator, label: string): Promise<bigint> {
  const text = await scope
    .locator('dt', { hasText: label })
    .locator('xpath=following-sibling::dd')
    .innerText();
  return BigInt(text.replace(/\D/g, '') || '0');
}

test.describe('Phát hành token điện gió', () => {
  test('KYC + whitelist rồi mint 100 WPT thì số dư thành 100', async ({ page }) => {
    test.skip(ON_HARDHAT, 'Đường dữ liệu thử chỉ còn chạy trên mock từ SC-02.');
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
    test.skip(ON_HARDHAT, 'Hardhat từ chối toàn bộ đường dữ liệu thử trước kiểm whitelist.');
    await page.goto('/mint');

    // Ví khác, chưa qua bước KYC.
    await page.getByLabel('Ví nhà đầu tư').fill('0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC');
    await page.getByLabel('Số lượng WPT').fill('10');

    await page.getByRole('button', { name: /Phát hành/i }).click();
    await expect(page.getByRole('status')).toContainText(/chưa được whitelist/i);
  });

  test('hardhat: đường /mint bị từ chối trước khi gửi giao dịch', async ({ page }) => {
    test.skip(!ON_HARDHAT, 'Ca này chỉ chạy trong project hardhat.');
    await page.goto('/mint');
    await page.getByLabel('Ví nhà đầu tư').fill(SPV);
    await page.getByLabel('Số lượng WPT').fill('10');

    const before = await blockNumber();
    await page.getByRole('button', { name: /Phát hành/i }).click();
    await expect(page.getByRole('status')).toContainText(
      'Đường dữ liệu thử chỉ chạy trên mock; phát hành chính thức qua luồng lập duyệt.',
    );
    expect(await blockNumber()).toBe(before);
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

async function draftOfficialRequest(
  page: Page,
  context: BrowserContext,
  baseURL: string,
  type: 'MINT' | 'BURN',
  amount: string,
): Promise<string> {
  await actAs(context, baseURL, 'TELLER');
  await page.goto('/draft');
  const card = page.getByLabel(type === 'MINT' ? 'Thẻ tạo token' : 'Thẻ huỷ token');
  await card.getByLabel('Mã hoặc ký hiệu token').fill('WPT');
  await expect(card.getByLabel('Khối thông tin token')).toContainText('Trần phát hành');

  if (type === 'MINT') {
    const wallet = card.getByLabel(/Ví đích/);
    if (await wallet.isEditable()) await wallet.fill(SPV);
  }
  await card.getByLabel('Số lượng').fill(amount);
  await card.getByLabel('Lý do').fill(
    type === 'MINT' ? 'Phát hành SC-02 trên hardhat' : 'Huỷ phần chưa phân phối SC-02',
  );

  const submit = card.getByRole('button', {
    name: type === 'MINT' ? /Gửi yêu cầu tạo token/ : /Gửi yêu cầu huỷ token/,
  });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(card.getByRole('status')).toContainText(/chờ Kiểm soát viên duyệt/);

  const table = page.getByRole('table', {
    name: type === 'MINT' ? 'Yêu cầu tạo token đã lập' : 'Yêu cầu huỷ token đã lập',
  });
  const row = table.locator('tbody tr').first();
  await expect(row).toContainText(type === 'MINT' ? 'Chờ duyệt' : 'Chờ duyệt');
  const id = await row.getAttribute('data-request-id');
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  return id!;
}

async function approveOfficialRequest(
  page: Page,
  context: BrowserContext,
  baseURL: string,
  requestId: string,
  type: 'MINT' | 'BURN',
): Promise<{ txHash: string; supply: bigint; spvBalance: bigint }> {
  await actAs(context, baseURL, 'CONTROLLER');
  await page.goto('/approvals');
  const queue = page.getByLabel(type === 'MINT' ? 'Hàng chờ tạo token' : 'Hàng chờ huỷ token');
  await queue.getByLabel('Tìm kiếm').fill(requestId.slice(0, 8));
  await queue.getByRole('link', { name: requestId.slice(0, 8) }).click();

  const actions = page.getByLabel('Khối hành động');
  await actions.getByRole('button', { name: 'Chấp nhận' }).click();
  await expect(actions.getByRole('status')).toContainText(/Đã chấp nhận/);
  await expect(actions).toContainText('Hoàn tất');

  const timeline = page.getByLabel('Nhật ký');
  await expect(timeline).toContainText(/0x[0-9a-f]{64}/i);
  const txHash = (await timeline.innerText()).match(/0x[0-9a-f]{64}/i)?.[0];
  expect(txHash).toBeTruthy();
  const receipt = await rpc<{ status: string; blockNumber: string }>('eth_getTransactionReceipt', [
    txHash,
  ]);
  expect(receipt.status).toBe('0x1');

  const info = page.getByLabel('Khối thông tin token');
  const result = {
    txHash: txHash!,
    supply: await infoNumber(info, 'Tổng cung hiện tại'),
    spvBalance: await infoNumber(info, 'Số chưa phân phối'),
  };
  console.log(
    `[SC-02] ${type} tx=${result.txHash} receipt=${receipt.status} block=${BigInt(receipt.blockNumber)}`,
  );
  return result;
}

test.describe.serial('SC-02 — lập duyệt Mint/Burn trên hardhat', () => {
  test.skip(!ON_HARDHAT, 'Luồng này chỉ chạy trong project hardhat của OP-03.');

  test('Mint lần đầu vào NB001 qua Giao dịch viên và Kiểm soát viên', async ({
    page,
    context,
    baseURL,
  }) => {
    const requestId = await draftOfficialRequest(page, context, baseURL!, 'MINT', '1000');
    const result = await approveOfficialRequest(page, context, baseURL!, requestId, 'MINT');
    expect(result.supply).toBe(1_000n);
    expect(result.spvBalance).toBe(1_000n);
  });

  test('Mint lần hai cùng NB001; vượt trần bị chặn trước khi gửi', async ({
    page,
    context,
    baseURL,
  }) => {
    const requestId = await draftOfficialRequest(page, context, baseURL!, 'MINT', '250');
    const result = await approveOfficialRequest(page, context, baseURL!, requestId, 'MINT');
    expect(result.supply).toBe(1_250n);
    expect(result.spvBalance).toBe(1_250n);

    await actAs(context, baseURL!, 'TELLER');
    await page.goto('/draft');
    const card = page.getByLabel('Thẻ tạo token');
    await card.getByLabel('Mã hoặc ký hiệu token').fill('WPT');
    await expect(card.getByLabel('Khối thông tin token')).toContainText('Trần phát hành');
    await card.getByLabel('Số lượng').fill('20000000');
    await card.getByLabel('Lý do').fill('Ca vượt trần không được gửi');
    await expect(card.getByLabel('Khối kiểm tra trước khi lập').locator('[data-check="cap"]')).toHaveAttribute(
      'data-passed',
      'false',
    );
    const before = await blockNumber();
    await expect(card.getByRole('button', { name: /Gửi yêu cầu tạo token/ })).toBeDisabled();
    expect(await blockNumber()).toBe(before);
  });

  test('Burn phần chưa phân phối qua cùng luồng lập duyệt', async ({ page, context, baseURL }) => {
    const requestId = await draftOfficialRequest(page, context, baseURL!, 'BURN', '300');
    const result = await approveOfficialRequest(page, context, baseURL!, requestId, 'BURN');
    expect(result.supply).toBe(950n);
    expect(result.spvBalance).toBe(950n);
  });
});
