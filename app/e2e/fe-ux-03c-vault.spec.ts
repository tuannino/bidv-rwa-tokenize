import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * FE-UX-03c: màn Vault thanh toán SPV (`/vault`). Chỉ chạy trên project `mock` (không có trong `testMatch` của
 * project `hardhat`). KHÔNG lưu cấu hình, không đối soát. Trên máy chủ mới, theo thứ tự tên tệp, vault đang
 * `UNSET` và danh sách rỗng; khi chạy cục bộ `reuseExistingServer` có thể dùng lại máy chủ đã qua
 * `vault-withdraw.spec.ts` (vault `FIXED`), nên ca 1 đọc chế độ từ màn và phép đếm `role` ở ca 2 chỉ chạy khi
 * `UNSET`. Luồng lưu cấu hình, rút, lịch sử có dữ liệu do `vault-withdraw.spec.ts` phủ (mock và Hardhat).
 */
type Role = 'TELLER' | 'CONTROLLER';
const ROLES: Role[] = ['CONTROLLER', 'TELLER'];
type Mode = 'UNSET' | 'FIXED' | 'PERCENT';

async function actAs(context: BrowserContext, baseURL: string, role: Role) {
  await context.clearCookies();
  await context.addCookies([
    { name: 'bidv_channel', value: role.toLowerCase(), url: baseURL },
    { name: 'bidv_role', value: role, url: baseURL },
  ]);
}

/** "Tải xong" như nhau ở mốc và nhánh mới: chờ `networkidle` rồi chờ ô số liệu (hoặc ô trạng thái cũ) hiện. */
async function openVault(page: Page) {
  await page.goto('/vault');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('main').locator('dt', { hasText: 'Chế độ khoá' }).first()).toBeVisible();
}

const MODE_TEXT: Record<string, Mode> = {
  'Chưa cấu hình, khoá toàn bộ': 'UNSET',
  'Khoá số tiền cố định': 'FIXED',
  'Khoá theo tỷ lệ kỳ': 'PERCENT',
};

/** Chế độ khoá đang hiện ở ô "Chế độ khoá" của thẻ trạng thái. */
async function readMode(page: Page): Promise<Mode> {
  const text = (await page.getByRole('main').locator('div:has(> dt)').filter({ has: page.locator('dt', { hasText: /^Chế độ khoá$/ }) }).locator('dd').first().innerText()).trim();
  const mode = MODE_TEXT[text];
  expect(mode, `chế độ khoá "${text}"`).toBeDefined();
  return mode!;
}

/**
 * Số `role` trong `main` đo trên `release/ui-v2` @ 1238a54 TRƯỚC khi sửa, bằng chính ca 2 chạy trên máy chủ MỚI
 * trong lượt e2e mock đầy đủ (spec chép tạm vào bản mốc), vault `UNSET`.
 */
const ROLE_COUNTS: Record<Role, { status: number; note: number; alert: number }> = {
  CONTROLLER: { status: -1, note: -1, alert: -1 },
  TELLER: { status: -1, note: -1, alert: -1 },
};

async function countRoles(page: Page) {
  const main = page.getByRole('main');
  const count = (name: string) => main.locator(`[role="${name}"]`).count();
  return { status: await count('status'), note: await count('note'), alert: await count('alert') };
}

const KPIS: [string, string][] = [
  ['Số dư VNDB', 'au'],
  ['Số VNDB đang khoá', 'default'],
  ['Số dư WPT', 'default'],
  ['VNDB có thể rút', 'gold'],
];

const STATUS_FIELDS: Record<Mode, string[]> = {
  UNSET: ['Chế độ khoá', 'Lợi nhuận chia quý trước', 'Ngày cấu hình có hiệu lực', 'Địa chỉ vault', 'Trạng thái rút'],
  FIXED: ['Chế độ khoá', 'Mức khoá cố định', 'Lợi nhuận chia quý trước', 'Ngày cấu hình có hiệu lực', 'Địa chỉ vault', 'Trạng thái rút'],
  PERCENT: ['Chế độ khoá', 'Tỷ lệ áp', 'Lợi nhuận chia quý trước', 'Ngày cấu hình có hiệu lực', 'Địa chỉ vault', 'Trạng thái rút'],
};

const boxShadow = (page: Page, label: string) =>
  page
    .getByRole('radiogroup', { name: 'Chế độ khoá' })
    .locator('label', { hasText: label })
    .evaluate((element) => getComputedStyle(element).boxShadow);

test.describe('FE-UX-03c Vault thanh toán SPV', () => {
  test('ca 1: 4 ô số liệu đúng thứ tự và sắc; thẻ trạng thái đúng nhãn theo chế độ khoá', async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const role of ROLES) {
      await actAs(context, baseURL!, role);
      await openVault(page);
      const kpis = page.getByRole('main').locator('[data-kpi]');
      await expect(kpis, role).toHaveCount(4);
      for (const [index, [label, tone]] of KPIS.entries()) {
        await expect(kpis.nth(index), `${role} ${label}`).toContainText(label);
        await expect(kpis.nth(index), `${role} ${label}`).toHaveAttribute('data-tone', tone);
      }
      const mode = await readMode(page);
      const labels = (await page.getByRole('main').locator('dt').allInnerTexts()).map((text) => text.trim());
      expect(labels, `${role} ${mode}`).toEqual(STATUS_FIELDS[mode]);
    }
  });

  test('ca 2: nhóm chế độ khoá bấm chuột, phím mũi tên, vòng tiêu điểm; role trong main bằng mốc', async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const counts: Partial<Record<Role, Awaited<ReturnType<typeof countRoles>>>> = {};
    let mode: Mode = 'UNSET';

    for (const role of ROLES) {
      await actAs(context, baseURL!, role);
      await openVault(page);
      await expect(page.getByRole('main').locator('[data-kpi]').first()).toBeVisible();
      mode = await readMode(page);
      // Đếm NGAY sau khi tải, trước mọi tương tác (chọn chế độ làm hiện thêm role="note").
      if (mode === 'UNSET') {
        counts[role] = await countRoles(page);
        console.log(`FE-UX-03c role counts ${role}: ${JSON.stringify(counts[role])}`);
      }

      const group = page.getByRole('radiogroup', { name: 'Chế độ khoá' });
      if (role === 'CONTROLLER') {
        const fixed = group.getByLabel('Khoá số cố định');
        await fixed.click();
        await expect(fixed).toBeChecked();
        await expect(page.getByLabel('Tỷ lệ khoá (%)')).toHaveCount(0);
        await expect(page.getByLabel('Số khoá cố định (VNDB)')).toBeVisible();
        expect(await boxShadow(page, 'Khoá số cố định'), 'bấm chuột không hiện vòng tiêu điểm').toBe('none');

        await page.keyboard.press('ArrowLeft');
        const percent = group.getByLabel('Theo tỷ lệ %');
        await expect(percent).toBeChecked();
        await expect(percent).toBeFocused();
        expect(await percent.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
        expect(await boxShadow(page, 'Theo tỷ lệ %'), 'bàn phím hiện vòng tiêu điểm').not.toBe('none');
        await expect(page.getByLabel('Tỷ lệ khoá (%)')).toBeVisible();
        await expect(page.getByLabel('Số khoá cố định (VNDB)')).toHaveCount(0);
      } else {
        for (const radio of await group.getByRole('radio').all()) await expect(radio).toBeDisabled();
      }
    }

    if (mode === 'UNSET') {
      for (const role of ROLES) expect(counts[role], role).toEqual(ROLE_COUNTS[role]);
    } else {
      const description = `vault đang ${mode} (máy chủ dùng lại), bỏ phép đếm role; chạy trên máy chủ mới để đếm`;
      test.info().annotations.push({ type: 'bo-dem-role', description });
      console.log('BO-DEM-ROLE ' + description);
    }
  });

  test('ca 3: 1440 và 390 px không tràn ngang, không lỗi console, lỗi trang, cảnh báo hydrate', async ({ browser, baseURL }) => {
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
        await openVault(p);
        expect(await p.evaluate(() => document.documentElement.scrollWidth), `${role} ${width}`).toBeLessThanOrEqual(width);
        expect(hydration, `${role} ${width}`).toEqual([]);
        expect(errors, `${role} ${width}`).toEqual([]);
        await ctx.close();
      }
    }
  });
});
