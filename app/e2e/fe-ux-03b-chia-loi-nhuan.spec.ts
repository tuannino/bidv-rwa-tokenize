import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * FE-UX-03b: màn Chia lợi nhuận (`/distribution`). Chỉ chạy trên project `mock` (không có trong `testMatch` của
 * project `hardhat`). CHỈ ĐỌC: không nạp quỹ, không duyệt. Tệp chạy theo thứ tự tên, trước
 * `ops-transactions.spec.ts` và `zz-distribution-approval.spec.ts`, nên quỹ mock bằng 0 và lịch sử rỗng.
 * Luồng duyệt, chia, lịch sử, hồ sơ trả có dữ liệu do `zz-distribution-approval.spec.ts` phủ (mock và Hardhat).
 */
type Role = 'TELLER' | 'CONTROLLER';
const ROLES: Role[] = ['CONTROLLER', 'TELLER'];

async function actAs(context: BrowserContext, baseURL: string, role: Role) {
  await context.clearCookies();
  await context.addCookies([
    { name: 'bidv_channel', value: role.toLowerCase(), url: baseURL },
    { name: 'bidv_role', value: role, url: baseURL },
  ]);
}

/** "Tải xong" giống nhau ở mốc và nhánh mới: chờ `networkidle` rồi chờ vùng "Quỹ chia" hiện. */
async function openDistribution(page: Page) {
  await page.goto('/distribution');
  await page.waitForLoadState('networkidle');
  await expect(page.getByLabel('Quỹ chia')).toBeVisible();
}

/**
 * Số `role` trong `main` đo trên `release/ui-v2` @ e996915 TRƯỚC khi sửa, bằng chính ca 2 chạy trong lượt e2e
 * mock đầy đủ (spec chép tạm vào bản mốc).
 */
const ROLE_COUNTS: Record<Role, { status: number; note: number; alert: number }> = {
  CONTROLLER: { status: 0, note: 0, alert: 0 },
  TELLER: { status: 0, note: 0, alert: 0 },
};

async function countRoles(page: Page) {
  const main = page.getByRole('main');
  const count = (name: string) => main.locator(`[role="${name}"]`).count();
  return { status: await count('status'), note: await count('note'), alert: await count('alert') };
}

const KPI_TONES: [string, string][] = [
  ['Số dư quỹ', 'au'],
  ['Chưa phân bổ', 'gold'],
  ['Tổng dự trữ các kỳ', 'default'],
  ['Ngưỡng tối thiểu', 'default'],
];

test.describe('FE-UX-03b Chia lợi nhuận', () => {
  test('ca 1: vùng Quỹ chia có 4 ô số liệu đúng sắc; Giao dịch viên không có nút Duyệt chia', async ({
    page,
    context,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const role of ROLES) {
      await actAs(context, baseURL!, role);
      await openDistribution(page);
      const pool = page.getByLabel('Quỹ chia');
      await expect(pool.locator('[data-kpi]'), role).toHaveCount(4);
      for (const [label, tone] of KPI_TONES) {
        await expect(pool.locator('[data-kpi]').filter({ hasText: label }), `${role} ${label}`).toHaveAttribute('data-tone', tone);
      }
      if (role === 'TELLER') await expect(page.getByRole('button', { name: /^Duyệt chia/ })).toHaveCount(0);
    }
  });

  test('ca 2: role status, note, alert trong main bằng mốc ở hai vai', async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const counts: Partial<Record<Role, Awaited<ReturnType<typeof countRoles>>>> = {};
    for (const role of ROLES) {
      await actAs(context, baseURL!, role);
      await openDistribution(page);
      counts[role] = await countRoles(page);
    }
    console.log(`FE-UX-03b role counts: ${JSON.stringify(counts)}`);
    for (const role of ROLES) expect(counts[role], role).toEqual(ROLE_COUNTS[role]);
  });

  test('ca 3: 1440 và 390 px không tràn ngang, không lỗi console, không cảnh báo hydrate', async ({ browser, baseURL }) => {
    for (const width of [1440, 390]) {
      for (const role of ROLES) {
        const ctx = await browser.newContext({ viewport: { width, height: 900 } });
        await actAs(ctx, baseURL!, role);
        const p = await ctx.newPage();
        const hydration: string[] = [];
        const errors: string[] = [];
        p.on('console', (message) => {
          if (/hydrat/i.test(message.text())) hydration.push(message.text());
          if (message.type() === 'error') errors.push(message.text());
        });
        p.on('pageerror', (error) => errors.push(error.message));
        await openDistribution(p);
        expect(await p.evaluate(() => document.documentElement.scrollWidth), `${role} ${width}`).toBeLessThanOrEqual(width);
        expect(hydration, `${role} ${width}`).toEqual([]);
        expect(errors, `${role} ${width}`).toEqual([]);
        await ctx.close();
      }
    }
  });
});
