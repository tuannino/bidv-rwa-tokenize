import { expect, test, type BrowserContext } from '@playwright/test';
import addresses from '../../packages/shared/src/addresses.json';

/**
 * FE-08 ca 13: Kiểm soát viên duyệt chia trên `/distribution`, thấy kỳ hoàn tất và lịch sử; Giao
 * dịch viên không thấy nút duyệt. Chạy cả project `mock` lẫn `hardhat`.
 *
 * Tên tệp bắt đầu bằng `zz-` để chạy SAU MỌI tệp khác (Playwright chạy theo tên): cần nguồn cung WPT
 * và người nắm giữ từ các tệp trước (`ops-transactions.spec.ts` trên mock, `mint.spec.ts` và
 * `permit-order.spec.ts` trên hardhat).
 *
 * SPV nạp quỹ chia bằng màn có sẵn: whitelist địa chỉ quỹ ở `/mint`, nạp VNDB ở `/demo-payment`.
 * Trên mock, số dư VNDB của địa chỉ quỹ logic CHÍNH LÀ quỹ chia (như EVM); trên hardhat là hợp đồng
 * `ProfitDistributor` đã triển khai.
 */
const ON_HARDHAT = (process.env.E2E_CHAIN ?? 'mock') === 'hardhat-local';
/** Địa chỉ quỹ logic trên mock: `MOCK_PROFIT_DISTRIBUTOR_ADDRESS` của `@bidv/shared`. */
const MOCK_DISTRIBUTOR = '0x67C48fdA18F68acf2eD6d8A80436930Ff226948e';
const DISTRIBUTOR = ON_HARDHAT ? addresses.chains['hardhat-local'].contracts.ProfitDistributor : MOCK_DISTRIBUTOR;
const DEPOSIT = '1000000';

async function actAs(context: BrowserContext, baseURL: string, role: 'TELLER' | 'CONTROLLER') {
  await context.clearCookies();
  await context.addCookies([
    { name: 'bidv_channel', value: role.toLowerCase(), url: baseURL },
    { name: 'bidv_role', value: role, url: baseURL },
  ]);
}

test.describe.serial('FE-08 ca 13: Kiểm soát viên duyệt chia trên màn hình', () => {
  test('chuẩn bị: SPV nạp 1.000.000 VNDB vào quỹ chia qua màn có sẵn', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'TELLER');
    await page.goto('/mint');
    await page.getByLabel('Ví nhà đầu tư').fill(DISTRIBUTOR);
    await page.getByRole('button', { name: /KYC \+ Whitelist/i }).click();
    await expect(page.getByRole('status')).toContainText(/whitelist=true/i);

    await page.goto('/demo-payment');
    await page.getByLabel('Ví đích').fill(DISTRIBUTOR);
    await page.getByLabel('Số VNDB').fill(DEPOSIT);
    await page.getByRole('button', { name: 'Nạp VNDB' }).click();
    await expect(page.getByRole('status')).toContainText(/Đã nạp/);
  });

  test('Giao dịch viên xem quỹ và dự kiến, không thấy nút duyệt', async ({ page, context, baseURL }) => {
    await actAs(context, baseURL!, 'TELLER');
    await page.goto('/distribution');
    await expect(page.getByLabel('Quỹ chia')).toContainText('Chưa phân bổ');
    await expect(page.getByRole('table', { name: 'Người nhận dự kiến' })).toContainText('(vault)');
    await expect(page.getByRole('button', { name: /^Duyệt chia/ })).toHaveCount(0);
    await expect(page.getByLabel('Duyệt chia')).toHaveCount(0);
  });

  test('Kiểm soát viên duyệt: hộp xác nhận nói rõ phạm vi, kỳ hoàn tất, lịch sử có người duyệt', async ({
    page,
    context,
    baseURL,
  }) => {
    await actAs(context, baseURL!, 'CONTROLLER');
    await page.goto('/distribution');
    const approve = page.getByLabel('Duyệt chia').getByRole('button', { name: /^Duyệt chia [\d.]+ VNDB$/ });
    await expect(approve).toBeEnabled();
    await approve.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(
      'Kiểm soát viên duyệt tổng số VNDB của kỳ; danh sách và tỷ lệ chỉ là dự kiến. Quyền hưởng cuối cùng chốt theo ảnh chụp trên chuỗi lúc mở kỳ.',
    );
    await expect(dialog).toContainText('bấm duyệt sẽ chuyển tiền');
    await dialog.getByRole('button', { name: 'Duyệt và chia' }).click();

    await expect(page.getByLabel('Kết quả thao tác chia')).toContainText('Kỳ đã chia xong.', { timeout: 60_000 });
    const history = page.getByRole('table', { name: 'Danh sách kỳ chia' });
    const row = history.locator('tbody tr').first();
    await expect(row).toContainText('Hoàn tất');
    await expect(row).toContainText('Đã duyệt');
    await expect(row).toContainText('KSV001');
    await expect(row).toContainText('Kiểm soát viên');
    await expect(page.getByLabel('Kỳ hoạt động')).toHaveCount(0);

    await row.getByRole('button', { name: 'Xem hồ sơ' }).click();
    await expect(page.getByRole('table', { name: 'Hồ sơ trả từng ví' })).toContainText('Đã trả');
  });
});
