import { defineConfig, devices } from '@playwright/test';

/**
 * E2E cho luồng MINT.
 *
 * Mặc định chạy ở chế độ `mock` + lưu trong bộ nhớ, nên `npm run test:e2e` không cần
 * hardhat node lẫn Postgres. Muốn kiểm chain thật: `E2E_CHAIN=hardhat-local` (phải có node chạy).
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);

/**
 * Phải là `localhost`, KHÔNG dùng `127.0.0.1`.
 * Next dev chặn truy cập cross-origin vào tài nguyên `/_next/*`; vào bằng 127.0.0.1
 * thì chunk client bị chặn -> trang KHÔNG hydrate -> mọi nút nằm nguyên trạng thái
 * server-render (disabled) và test đợi vô ích.
 */
const HOST = process.env.E2E_HOST ?? 'localhost';
const BASE_URL = process.env.E2E_BASE_URL ?? `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false, // ledger mock dùng state chung -> chạy tuần tự
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next dev --port ${PORT}`,
        url: BASE_URL,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
        env: {
          NEXT_PUBLIC_DEFAULT_CHAIN: process.env.E2E_CHAIN ?? 'mock',
          USE_MOCK_KYC: 'true',
          USE_MOCK_DB: 'true',
          DEMO_ROLE: 'BANK_ADMIN',
          // Không cần khóa thật ở chế độ mock, nhưng đặt sẵn để đổi sang hardhat-local là chạy.
          SERVER_SIGNER_PRIVATE_KEY:
            '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
          RPC_HARDHAT: 'http://127.0.0.1:8545',
        },
      },
});
