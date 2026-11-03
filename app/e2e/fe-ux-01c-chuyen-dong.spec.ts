import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { MOCK_VAULT_ADDRESS } from '../../packages/shared/src/mock-vault';

/**
 * FE-UX-01c: chuyển động nhẹ bằng CSS và nền trôi. Chain mock, máy chủ bản build, 1440 px.
 *
 * Ca 4 lập thêm MỘT yêu cầu tạo token (để số việc chờ khác 0) nên đặt cuối tệp. Bước điền form chép
 * từ `maker-checker.spec.ts` ca 1 đến 3 (không import spec cũ).
 */
const SPV = MOCK_VAULT_ADDRESS;

async function actAs(context: BrowserContext, baseURL: string, role: 'TELLER') {
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

const style = (locator: Locator, prop: string, pseudo?: string) =>
  locator.evaluate((el, [p, ps]) => getComputedStyle(el, ps ?? null).getPropertyValue(p as string), [prop, pseudo] as const);

/** Phần x của thuộc tính `translate` (ví dụ "-120%" hoặc "0px -1px"): số có dấu, `none` là 0. */
const translateX = (value: string) => (value === 'none' ? 0 : parseFloat(value.split(' ')[0]));

/** Điền thẻ tạo token ở `/draft` tới khi nút "Gửi yêu cầu tạo token" mở (chép maker-checker ca 1 đến 3). */
async function fillMint(page: Page) {
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
  await card.getByLabel('Lý do').fill('Thử chuyển động e2e');
  await card.getByLabel('Số lượng').fill('7');
  const submit = card.getByRole('button', { name: /Gửi yêu cầu tạo token/ });
  await expect(submit).toBeEnabled();
  return submit;
}

test.describe('FE-UX-01c chuyển động', () => {
  test.beforeEach(async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await actAs(context, baseURL!, 'TELLER');
  });

  test('ca 1: nền trôi cố định dưới nội dung, không chặn bấm, giữ nguyên khi đổi màn', async ({ page }) => {
    await open(page, '/');
    const bgfx = page.locator('[data-bgfx]');
    await expect(bgfx).toHaveCount(1);
    await expect(bgfx).toHaveAttribute('aria-hidden', 'true');
    expect(await style(bgfx, 'position')).toBe('fixed');
    expect(await style(bgfx, 'pointer-events')).toBe('none');
    await expect(bgfx.locator('> *')).toHaveCount(3);
    const first = bgfx.locator('> *').first();
    expect(await style(first, 'animation-name')).toBe('drift');
    const inView = await first.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
    });
    expect(inView).toBe(true);
    expect(await page.locator('aside').evaluate((el) => getComputedStyle(el.parentElement!).backgroundColor)).toBe(
      'rgba(0, 0, 0, 0)',
    );
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    // Nền không che: một liên kết dạng nút trong `main` vẫn bấm được (kiểm khả năng bấm, không điều hướng).
    await page.getByRole('main').getByRole('link', { name: 'Phát hành WPT' }).click({ trial: true });

    await bgfx.evaluate((el) => el.setAttribute('data-test-mark', '1'));
    await page.getByRole('complementary').getByRole('link', { name: /Lập lệnh/ }).click();
    await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'Lập lệnh' })).toBeVisible();
    await expect(page.locator('[data-bgfx][data-test-mark="1"]')).toHaveCount(1);
  });

  test('ca 2: vào màn chạy rise đúng một lần, thanh bên giữ thu gọn', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('bidv-rail', '1');
      } catch {}
    });
    await open(page, '/');
    await expect(page.locator('aside')).toHaveAttribute('data-rail', 'collapsed');
    await page.evaluate(() => {
      const w = window as unknown as { __anim: { name: string; path: string; enter: boolean }[] };
      w.__anim = [];
      document.addEventListener(
        'animationstart',
        (event) => {
          const target = event.target as Element;
          w.__anim.push({
            name: event.animationName,
            path: location.pathname,
            enter: target.hasAttribute?.('data-page-enter') ?? false,
          });
        },
        true,
      );
    });

    for (const [link, path, title] of [
      [/Lập lệnh/, '/draft', 'Lập lệnh'],
      [/Giao dịch/, '/transactions', 'Giao dịch toàn hệ thống'],
    ] as const) {
      await page.evaluate(() => document.querySelector('[data-page-enter]')?.setAttribute('data-old', '1'));
      const before = await page.evaluate(() => (window as unknown as { __anim: unknown[] }).__anim.length);
      await page.getByRole('complementary').getByRole('link', { name: link }).first().click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole('main').getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
      const enter = page.locator('[data-page-enter]');
      await expect.poll(() => style(enter, 'opacity'), { message: path }).toBe('1');
      await expect.poll(() => style(enter, 'transform'), { message: path }).toBe('none');
      const rises = await page.evaluate(
        (from) =>
          (window as unknown as { __anim: { name: string; enter: boolean }[] }).__anim
            .slice(from)
            .filter((a) => a.name === 'rise' && a.enter).length,
        before,
      );
      expect(rises, path).toBe(1);
      // DOM của vùng nội dung đã thay (không cần `key`).
      await expect(page.locator('[data-page-enter][data-old]'), path).toHaveCount(0);
      expect(await style(enter, 'animation-iteration-count'), path).toBe('1');
      expect(await style(enter, 'animation-duration'), path).toBe('0.5s');
      await expect(page.locator('aside'), path).toHaveAttribute('data-rail', 'collapsed');
    }
  });

  test('ca 3: rê nút chính có nhấc và quét sáng; nút aria-disabled không; biểu tượng menu, nút theme xoay', async ({ page }) => {
    const submit = await fillMint(page);
    expect(translateX(await style(submit, 'translate', '::after'))).toBeLessThan(0);
    await submit.hover();
    await expect.poll(() => style(submit, 'translate')).not.toBe('none');
    await expect.poll(async () => translateX(await style(submit, 'translate', '::after'))).toBeGreaterThan(0);

    // Nút đang bật nhưng gắn aria-disabled (Base UI focusableWhenDisabled): không nhấc, không quét.
    await page.mouse.move(0, 0);
    await expect.poll(() => style(submit, 'translate')).toBe('none');
    await expect.poll(async () => translateX(await style(submit, 'translate', '::after'))).toBeLessThan(0);
    await submit.evaluate((el) => el.setAttribute('aria-disabled', 'true'));
    await submit.hover();
    await page.waitForTimeout(800);
    expect(await style(submit, 'translate')).toBe('none');
    expect(translateX(await style(submit, 'translate', '::after'))).toBeLessThan(0);

    const item = page.getByRole('complementary').getByRole('link', { name: /Giao dịch/ }).first();
    await item.hover();
    await expect.poll(() => style(item.locator('span').first(), 'rotate')).not.toBe('none');

    const theme = page.locator('button[title^="Chuyển sang"]');
    await theme.hover();
    await expect.poll(() => style(theme, 'rotate')).not.toBe('none');
  });

  test('ca 5: giảm chuyển động tắt mọi animation, transition; quầng không will-change; nội dung hiện ngay', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    await actAs(context, baseURL!, 'TELLER');
    const page = await context.newPage();
    for (const path of ['/', '/draft']) {
      await open(page, path);
      const blob = page.locator('[data-bgfx] > *').first();
      const enter = page.locator('[data-page-enter]');
      const horizon = page.locator('[data-horizon]');
      expect(await style(blob, 'animation-name'), path).toBe('none');
      expect(await style(enter, 'animation-name'), path).toBe('none');
      expect(await style(horizon, 'animation-name', '::after'), path).toBe('none');
      expect(await style(blob, 'will-change'), path).toBe('auto');
      expect(await style(enter, 'opacity'), path).toBe('1');
    }
    const button = page.getByLabel('Thẻ tạo token').getByRole('button', { name: /Gửi yêu cầu tạo token/ });
    expect(await style(button, 'transition-duration')).toBe('0s');
    await context.close();
  });

  // Đặt cuối tệp: lập thêm một yêu cầu tạo token.
  test('ca 4: đường chân trời chạy; số việc chờ 0 đứng yên, khác 0 có vòng sáng', async ({ page }) => {
    await open(page, '/');
    const horizon = page.locator('[data-horizon]');
    expect(await style(horizon, 'animation-name', '::after')).toBe('horizon');
    expect(await style(horizon, 'animation-iteration-count', '::after')).toBe('infinite');

    const zeros = page.locator('[aria-label$="việc đang chờ"]').filter({ hasText: /^0$/ });
    for (const badge of await zeros.all()) {
      await expect(badge).not.toHaveAttribute('data-beacon');
      expect(await style(badge, 'animation-name', '::after')).toBe('none');
    }

    const submit = await fillMint(page);
    await submit.click();
    await expect(page.getByLabel('Thẻ tạo token').getByRole('status')).toContainText(/Đã gửi yêu cầu tạo 7 WPT/);
    const badge = page.getByRole('complementary').getByRole('link', { name: /Lập lệnh/ }).getByLabel(/việc đang chờ/);
    await expect(badge).not.toHaveText('0');
    await expect(badge).toHaveAttribute('data-beacon', '');
    expect(await style(badge, 'animation-name', '::after')).toBe('beacon');
  });
});
