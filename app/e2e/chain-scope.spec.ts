import { expect, test, type BrowserContext, type Page } from '@playwright/test';

type Role = 'TELLER' | 'CONTROLLER' | 'SELLER';

async function actAs(context: BrowserContext, baseURL: string, role: Role) {
  const channel = role === 'TELLER' ? 'teller' : role === 'CONTROLLER' ? 'controller' : 'seller';
  await context.addCookies([
    { name: 'bidv_channel', value: channel, url: baseURL },
    { name: 'bidv_role', value: role, url: baseURL },
  ]);
}

async function expectChainSwitch(page: Page, path: string, heading: string) {
  await page.goto(path);
  const selector = page.locator('#chain-selector');
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  await selector.selectOption('mock');
  await expect(page.getByText('Chain đang xem: mock', { exact: false })).toBeVisible();
  await selector.selectOption('hardhat-local');
  await expect(page.getByText('Chain đang xem: hardhat-local', { exact: false })).toBeVisible();
}

test('FE-27 — Lập lệnh, Duyệt, Giao dịch và Tổng quan người bán đổi theo chain', async ({
  page,
  context,
  baseURL,
}) => {
  await actAs(context, baseURL!, 'TELLER');
  await expectChainSwitch(page, '/draft', 'Lập lệnh');
  await expectChainSwitch(page, '/transactions', 'Giao dịch toàn hệ thống');

  await actAs(context, baseURL!, 'CONTROLLER');
  await expectChainSwitch(page, '/approvals', 'Phê duyệt lệnh');

  await actAs(context, baseURL!, 'SELLER');
  await expectChainSwitch(page, '/seller', 'Tổng quan');
});
