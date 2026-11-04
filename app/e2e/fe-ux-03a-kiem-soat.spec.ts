import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { MOCK_VAULT_ADDRESS } from '../../packages/shared/src/mock-vault';

/**
 * FE-UX-03a: 2 màn Kiểm soát duyệt yêu cầu (`/approvals`, `/approvals/[id]`). Chain mock, máy chủ bản
 * build.
 *
 * Tệp có 2 `test`: ca 1 (ô số liệu), và ca 2 gộp ca 3 (design mục 3). Ca 2 TỰ lập một yêu cầu tạo token
 * (chép bước của `fe-ux-01c-chuyen-dong.spec.ts`, không import spec cũ), kiểm rồi Kiểm soát viên TỪ CHỐI
 * đúng yêu cầu đó trong `finally`, để số việc chờ trở lại như trước ca và spec chạy sau không đổi kết quả.
 */
const SPV = MOCK_VAULT_ADDRESS;
type Role = 'TELLER' | 'CONTROLLER';

async function actAs(context: BrowserContext, baseURL: string, role: Role) {
  await context.addCookies([
    { name: 'bidv_channel', value: role.toLowerCase(), url: baseURL },
    { name: 'bidv_role', value: role, url: baseURL },
  ]);
}

/** Nút theme chỉ hiện sau khi hydrate: mốc "trang đã chạy JS". */
async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('button[title^="Chuyển sang"]')).toBeVisible();
}

const KPI_LABELS = ['Đang chờ duyệt', 'Đã duyệt hôm nay', 'Đã từ chối hôm nay'];

/**
 * Số `role` trong `main` đo trên `release/ui-v2` @ 7b3216d TRƯỚC khi sửa, bằng chính ca này chạy trong
 * lượt e2e mock đầy đủ (spec chép tạm vào bản mốc).
 */
const ROLE_COUNTS = {
  approvals: { status: 0, note: 0, alert: 0 },
  detail: { status: 0, note: 0, alert: 0 },
};

async function countRoles(page: Page) {
  const main = page.getByRole('main');
  const count = (name: string) => main.locator(`[role="${name}"]`).count();
  return { status: await count('status'), note: await count('note'), alert: await count('alert') };
}

/** "Tải xong" giống nhau ở mốc và nhánh mới (không dựa vào `[data-loading]`, mốc không có). */
async function openApprovals(page: Page, requestId: string) {
  await open(page, '/approvals');
  await page.waitForLoadState('networkidle');
  await expect(page.getByLabel('Hàng chờ tạo token', { exact: true }).first().locator(`[data-request-id="${requestId}"]`)).toBeVisible();
}

async function openDetail(page: Page, requestId: string) {
  await open(page, `/approvals/${requestId}`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByLabel('Khối hành động')).toBeVisible();
}

test.describe('FE-UX-03a Kiểm soát duyệt yêu cầu', () => {
  test('ca 1: /approvals có 3 ô số liệu sắc default, giữ aria-label', async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await actAs(context, baseURL!, 'CONTROLLER');
    await open(page, '/approvals');
    const main = page.getByRole('main');
    // Chờ số liệu đọc xong trước khi kiểm (thay mốc chờ cũ ở maker-checker.spec.ts:142).
    for (const label of KPI_LABELS) {
      await expect
        .poll(async () => (await main.getByLabel(label, { exact: true }).locator('.tabular-nums').first().innerText()).trim(), {
          message: label,
        })
        .toMatch(/^\d{1,3}(\.\d{3})*$/);
    }
    await expect(main.locator('[data-kpi]')).toHaveCount(3);
    for (const label of KPI_LABELS) {
      const tile = main.getByLabel(label, { exact: true });
      await expect(tile, label).toHaveAttribute('data-kpi', '');
      await expect(tile, label).toHaveAttribute('data-tone', 'default');
    }
  });

  test('ca 2 và 3: role trong main bằng mốc; 1440 và 390 px không tràn, không lỗi console, không cảnh báo hydrate', async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await actAs(context, baseURL!, 'TELLER');

    // Giao dịch viên lập một yêu cầu tạo token (chép fe-ux-01c-chuyen-dong.spec.ts fillMint).
    await page.goto('/mint');
    await page.getByLabel('Ví nhà đầu tư').fill(SPV);
    await page.getByRole('button', { name: /KYC \+ Whitelist/i }).click();
    await expect(page.getByRole('status')).toContainText(/whitelist=true/i);
    await open(page, '/draft');
    const card = page.getByLabel('Thẻ tạo token');
    await card.getByLabel('Mã hoặc ký hiệu token').fill('wpt');
    await expect(card.getByLabel('Khối thông tin token')).toContainText('20.000.000');
    const wallet = card.getByLabel(/Ví đích/);
    if (await wallet.isEditable()) await wallet.fill(SPV);
    await card.getByLabel('Lý do').fill('Thử bố cục Kiểm soát e2e');
    await card.getByLabel('Số lượng').fill('3');
    const submit = card.getByRole('button', { name: /Gửi yêu cầu tạo token/ });
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(card.getByRole('status')).toContainText(/Đã gửi yêu cầu tạo 3 WPT/);
    const requestId = await page
      .getByRole('table', { name: 'Yêu cầu tạo token đã lập' })
      .locator('tbody tr')
      .first()
      .getAttribute('data-request-id');
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);

    try {
      // Ca 2: Kiểm soát viên mở /approvals, rồi chi tiết từ hàng chờ tạo token; đếm role trong main.
      await actAs(context, baseURL!, 'CONTROLLER');
      await openApprovals(page, requestId!);
      const approvalsRoles = await countRoles(page);
      await page
        .getByLabel('Hàng chờ tạo token', { exact: true })
        .first()
        .locator(`[data-request-id="${requestId}"]`)
        .getByRole('link')
        .click();
      await expect(page).toHaveURL(new RegExp(`/approvals/${requestId}$`));
      await openDetail(page, requestId!);
      const detailRoles = await countRoles(page);
      console.log(`FE-UX-03a role counts: ${JSON.stringify({ approvals: approvalsRoles, detail: detailRoles })}`);
      expect(approvalsRoles, '/approvals').toEqual(ROLE_COUNTS.approvals);
      expect(detailRoles, '/approvals/[id]').toEqual(ROLE_COUNTS.detail);

      // Ca 3: 1440 và 390 px, mỗi màn trên một ngữ cảnh mới để bắt lỗi console từ lúc tải.
      for (const width of [1440, 390]) {
        for (const kind of ['approvals', 'detail'] as const) {
          const ctx = await browser.newContext({ viewport: { width, height: 900 } });
          await actAs(ctx, baseURL!, 'CONTROLLER');
          const p = await ctx.newPage();
          const hydration: string[] = [];
          const errors: string[] = [];
          p.on('console', (message) => {
            if (/hydrat/i.test(message.text())) hydration.push(message.text());
            if (message.type() === 'error') errors.push(message.text());
          });
          p.on('pageerror', (error) => errors.push(error.message));
          if (kind === 'approvals') await openApprovals(p, requestId!);
          else await openDetail(p, requestId!);
          expect(await p.evaluate(() => document.documentElement.scrollWidth), `${kind} ${width}`).toBeLessThanOrEqual(width);
          expect(hydration, `${kind} ${width}`).toEqual([]);
          expect(errors, `${kind} ${width}`).toEqual([]);
          await ctx.close();
        }
      }
    } finally {
      // Dọn dữ liệu: Kiểm soát viên từ chối đúng yêu cầu vừa lập.
      await actAs(context, baseURL!, 'CONTROLLER');
      await open(page, `/approvals/${requestId}`);
      const actions = page.getByLabel('Khối hành động');
      await expect(actions).toContainText('Chờ duyệt');
      await actions.getByLabel('Lý do từ chối').fill('Dọn dữ liệu ca Kiểm soát');
      await actions.getByRole('button', { name: 'Từ chối' }).click();
      await expect(page.getByRole('status').filter({ hasText: /Đã từ chối yêu cầu/ })).toBeVisible();
    }
  });
});
