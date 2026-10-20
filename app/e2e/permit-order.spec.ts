import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { encodeFunctionData } from 'viem';
import addresses from '../../packages/shared/src/addresses.json';

/**
 * FE-05 ca 14: Nhà đầu tư ký `permit` trên `/trade` (chain `hardhat-local`), project `hardhat`.
 *
 * VÍ GIẢ LẬP (QĐ-J). Chromium của Playwright không có tiện ích ví, nên `window.ethereum` được tiêm
 * vào trang và CHỈ chuyển tiếp ba phương thức sang nút Hardhat thật:
 *   - `eth_accounts` (và `eth_requestAccounts` ánh xạ sang nó): tài khoản của nút, chọn đúng ví mẫu
 *     NDT001 (Hardhat #1) như người dùng chọn tài khoản trong ví;
 *   - `eth_chainId`;
 *   - `eth_signTypedData_v4`: NÚT ký bằng tài khoản mở sẵn, không khoá riêng nào trong mã.
 * Phương thức khác trả lỗi rõ ràng (4200). Chế độ "người dùng huỷ": ký trả lỗi 4001.
 *
 * Lời gọi tới nút đi qua `exposeFunction` (chạy ở phía Node của Playwright), không gọi thẳng từ
 * trang: trang ở `localhost:3200` gọi `127.0.0.1:8545` là lời gọi khác nguồn.
 */

const INVESTOR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const ADMIN = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const CONTRACTS = addresses.chains['hardhat-local'].contracts;
const HARDHAT_RPC = `http://127.0.0.1:${process.env.EVM_LOCAL_PORT ?? 8545}`;

const ERC20 = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

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

async function balanceOf(token: string, owner: string): Promise<bigint> {
  const data = encodeFunctionData({ abi: ERC20, functionName: 'balanceOf', args: [owner as `0x${string}`] });
  return BigInt(await rpc<string>('eth_call', [{ to: token, data }, 'latest']));
}

/** Nạp VNDB cho nhà đầu tư từ ví quản trị (tài khoản mở sẵn của nút). */
async function fundInvestor(amount: bigint) {
  const data = encodeFunctionData({ abi: ERC20, functionName: 'mint', args: [INVESTOR, amount] });
  const hash = await rpc<string>('eth_sendTransaction', [{ from: ADMIN, to: CONTRACTS.VNDToken, data }]);
  const receipt = await rpc<{ status: string }>('eth_getTransactionReceipt', [hash]);
  expect(receipt.status).toBe('0x1');
}

async function orderCount(request: import('@playwright/test').APIRequestContext): Promise<number> {
  const response = await request.get(`/api/purchase?chain=hardhat-local&investorWallet=${INVESTOR}&limit=100`);
  const body = (await response.json()) as { ok: boolean; data?: unknown[] };
  return body.ok ? body.data!.length : -1;
}

async function installWallet(page: Page) {
  await page.exposeFunction('__hardhatRpc', (method: string, params: unknown[]) => rpc(method, params));
  await page.addInitScript((investor: string) => {
    type Rpc = (method: string, params: unknown[]) => Promise<unknown>;
    const w = window as unknown as { __hardhatRpc: Rpc; __rejectSign?: boolean };
    const failure = (message: string, code: number) => Object.assign(new Error(message), { code });
    // Người dùng đã kết nối ví từ trước: wagmi tự kết nối lại khi có cờ này và `eth_accounts` khác
    // rỗng. Hộp chọn ví của RainbowKit không liệt kê connector `injected` khi chưa có WalletConnect
    // projectId, nên không đi qua hộp đó.
    window.localStorage.setItem('wagmi.injected.connected', 'true');
    Object.defineProperty(window, 'ethereum', {
      value: {
        isMetaMask: true,
        request: async ({ method, params }: { method: string; params?: unknown[] }) => {
          switch (method) {
            case 'eth_requestAccounts':
            case 'eth_accounts': {
              const accounts = (await w.__hardhatRpc('eth_accounts', [])) as string[];
              return accounts.filter((account) => account.toLowerCase() === investor.toLowerCase());
            }
            case 'eth_chainId':
              return w.__hardhatRpc('eth_chainId', []);
            case 'eth_signTypedData_v4':
              if (w.__rejectSign) throw failure('User rejected the request.', 4001);
              return w.__hardhatRpc(method, params ?? []);
            default:
              throw failure(`Ví giả lập không hỗ trợ ${method}.`, 4200);
          }
        },
        on: () => {},
        removeListener: () => {},
      },
      configurable: true,
    });
  }, INVESTOR);
}

async function enterInvestorChannel(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    { name: 'bidv_channel', value: 'investor', url: baseURL },
    { name: 'bidv_role', value: 'INVESTOR', url: baseURL },
  ]);
}

async function connectWallet(page: Page) {
  await page.goto('/wallet');
  await expect(page.locator('button[title^="Chuyển sang"]')).toBeVisible();
  await page.locator('#chain-selector').selectOption('hardhat-local');
  await expect(page.locator('main')).toContainText(INVESTOR);
}

async function openTrade(page: Page, side: 'Mua' | 'Bán', quantity: string) {
  await page.goto('/trade');
  await expect(page.getByRole('heading', { name: 'Giao dịch token' })).toBeVisible();
  await page.getByRole('tab', { name: side }).click();
  await page.getByLabel('Số lượng').fill(quantity);
  const confirm = page.getByRole('button', { name: new RegExp(`Xác nhận lệnh ${side.toLowerCase()}`) });
  await expect(confirm).toBeEnabled();
  await confirm.click();
  return page.getByRole('dialog');
}

test.describe.serial('FE-05 ca 14: ký permit trên /trade', () => {
  test.skip(process.env.E2E_CHAIN !== 'hardhat-local', 'Ca này chỉ chạy trong project hardhat.');

  test.beforeAll(async () => {
    // Nguồn cung đã nằm trong vault do `mint.spec.ts` phát hành qua lập duyệt (chạy trước trong
    // project hardhat). Thiếu thì dừng với lý do rõ ràng thay vì đỏ ở một bước khó đoán.
    expect(await balanceOf(CONTRACTS.ProjectToken, CONTRACTS.SpvPaymentVault)).toBeGreaterThan(20n);
    await fundInvestor(100_000_000n);
  });

  test.beforeEach(async ({ page, context, baseURL }) => {
    await enterInvestorChannel(context, baseURL!);
    await installWallet(page);
    await connectWallet(page);
  });

  test('mua: hộp ký nêu đúng số VNDB, ký trong ví, lệnh hoàn tất', async ({ page }) => {
    const before = await balanceOf(CONTRACTS.ProjectToken, INVESTOR);
    const dialog = await openTrade(page, 'Mua', '10');
    const notice = dialog.getByTestId('permit-notice');
    await expect(notice).toContainText('1.000.000 VNDB');
    await expect(notice).toContainText(/hiệu lực đến/);
    await expect(notice).toContainText(/không tốn phí giao dịch/);
    await dialog.getByRole('button', { name: 'Ký và đặt lệnh' }).click();

    await expect(page.getByLabel('Lệnh vừa gửi')).toContainText('Hoàn tất');
    expect(await balanceOf(CONTRACTS.ProjectToken, INVESTOR)).toBe(before + 10n);
  });

  test('bán: hộp ký nêu đúng số WPT, lệnh hoàn tất', async ({ page }) => {
    const before = await balanceOf(CONTRACTS.ProjectToken, INVESTOR);
    const dialog = await openTrade(page, 'Bán', '4');
    await expect(dialog.getByTestId('permit-notice')).toContainText('4 WPT');
    await dialog.getByRole('button', { name: 'Ký và đặt lệnh' }).click();

    await expect(page.getByLabel('Lệnh vừa gửi')).toContainText('Hoàn tất');
    expect(await balanceOf(CONTRACTS.ProjectToken, INVESTOR)).toBe(before - 4n);
  });

  test('huỷ ký (4001): quay lại hộp xác nhận, không tạo lệnh', async ({ page, request }) => {
    const ordersBefore = await orderCount(request);
    const dialog = await openTrade(page, 'Mua', '3');
    await expect(dialog.getByTestId('permit-notice')).toContainText('300.000 VNDB');
    await page.evaluate(() => {
      (window as unknown as { __rejectSign: boolean }).__rejectSign = true;
    });
    await dialog.getByRole('button', { name: 'Ký và đặt lệnh' }).click();

    await expect(dialog.getByTestId('sign-note')).toContainText('Bạn đã huỷ ký');
    await expect(dialog.getByRole('button', { name: 'Ký và đặt lệnh' })).toBeEnabled();
    await expect(page.getByLabel('Lệnh vừa gửi')).toHaveCount(0);
    expect(await orderCount(request)).toBe(ordersBefore);
  });
});
