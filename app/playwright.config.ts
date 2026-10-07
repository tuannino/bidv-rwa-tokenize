import { defineConfig, devices } from '@playwright/test';

/**
 * Kiểm thử đầu cuối, hai project, chọn bằng `E2E_CHAIN` (chain mặc định của máy chủ đang kiểm):
 *
 *   - `mock` (mặc định): toàn bộ bộ đầu cuối, lưu trong bộ nhớ. KHÔNG cần hardhat node lẫn
 *     Postgres, và PHẢI chạy khi không có node: `chain-selector.spec.ts` kiểm trang báo lỗi đọc
 *     được khi đổi sang `hardhat-local` mà không có node.
 *   - `hardhat` (`E2E_CHAIN=hardhat-local`): các ca đã chạy được trên chuỗi thật. Cần node đã
 *     triển khai và nạp ví mẫu: `bash scripts/evm-local.sh up`, hoặc chạy trọn bằng
 *     `bash scripts/run-local-all.sh evm`.
 *
 * Máy chủ là BẢN BUILD (`next start`), không phải `next dev`: `next dev` biên dịch trang lúc
 * truy cập lần đầu, và ở môi trường chậm làm ca trượt ngẫu nhiên (OP-03). Bản build của
 * project `mock` là `.next` do phần `build` của `run-local-all.sh` dựng; của project `hardhat`
 * là thư mục riêng `HARDHAT_DIST_DIR`, vì `NEXT_PUBLIC_DEFAULT_CHAIN` bị nhúng lúc dựng nên
 * một bản build không đổi được chain mặc định. Gỡ lỗi bằng `next dev`: đặt `E2E_DEV=1`.
 */
const CHAIN = process.env.E2E_CHAIN ?? 'mock';
const ON_HARDHAT = CHAIN === 'hardhat-local';
const USE_DEV = process.env.E2E_DEV === '1';

/** Thư mục build riêng của project `hardhat` (phần `evm` của run-local-all.sh dựng). */
const HARDHAT_DIST_DIR = '.next-hardhat';

/** Hai cổng khác nhau để máy chủ của project này không bị nhận nhầm là của project kia. */
const PORT = Number(process.env.E2E_PORT ?? (ON_HARDHAT ? 3200 : 3100));

/**
 * Phải là `localhost`, KHÔNG dùng `127.0.0.1`.
 * Next dev chặn truy cập cross-origin vào tài nguyên `/_next/*`; vào bằng 127.0.0.1
 * thì chunk client bị chặn -> trang KHÔNG hydrate -> mọi nút nằm nguyên trạng thái
 * server-render (disabled) và test đợi vô ích.
 */
const HOST = process.env.E2E_HOST ?? 'localhost';
const BASE_URL = process.env.E2E_BASE_URL ?? `http://${HOST}:${PORT}`;

/**
 * Máy có `http_proxy`/`https_proxy` (mạng công ty) thì phép kiểm "server đã sẵn sàng" của
 * Playwright đi qua proxy và không bao giờ tới được localhost -> báo
 * "Timed out waiting 120000ms from config.webServer" dù `next dev` đã lên trong ~0.2s.
 *
 * Đặt ở đây thay vì để người chạy tự nhớ `no_proxy=...`: triệu chứng trỏ sai hoàn toàn về
 * phía server, rất mất thời gian truy.
 */
const NO_PROXY_HOSTS = ['localhost', '127.0.0.1', HOST].join(',');
process.env.NO_PROXY = process.env.NO_PROXY
  ? `${process.env.NO_PROXY},${NO_PROXY_HOSTS}`
  : NO_PROXY_HOSTS;
process.env.no_proxy = process.env.NO_PROXY;

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
  projects: [
    ON_HARDHAT
      ? {
          name: 'hardhat',
          testMatch: ['mint.spec.ts', 'wallet-connect.spec.ts'],
          use: { ...devices['Desktop Chrome'] },
        }
      : { name: 'mock', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: USE_DEV ? `npx next dev --port ${PORT}` : `npx next start --port ${PORT}`,
        url: BASE_URL,
        timeout: 120_000,
        // Project `hardhat` luôn cần máy chủ MỚI: dữ liệu nghiệp vụ nằm trong bộ nhớ, và máy chủ
        // cũ còn giữ dữ liệu của chuỗi trước lần `reset` thì lệch chuỗi hiện tại.
        reuseExistingServer: !process.env.CI && !ON_HARDHAT,
        env: {
          ...(ON_HARDHAT && { NEXT_DIST_DIR: HARDHAT_DIST_DIR }),
          // Chỉ có tác dụng với `next dev`; bản build đã nhúng giá trị lúc dựng.
          NEXT_PUBLIC_DEFAULT_CHAIN: CHAIN,
          USE_MOCK_KYC: 'true',
          USE_MOCK_DB: 'true',
          DEMO_ROLE: 'TELLER',
          // Máy chủ e2e là môi trường THỬ: bật đường phát hành trực tiếp cho dữ liệu thử (màn
          // `/mint`, `POST /api/mint`). Môi trường thật để cờ này tắt — xem `.env.example`.
          ENABLE_DEMO_TOKEN_MINT: 'true',
          ENABLE_DEMO_PAYMENT_MINT: 'true',
          // Không cần khóa thật ở chế độ mock, nhưng đặt sẵn để đổi sang hardhat-local là chạy.
          SERVER_SIGNER_PRIVATE_KEY:
            '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
          RPC_HARDHAT: `http://127.0.0.1:${process.env.EVM_LOCAL_PORT ?? 8545}`,
        },
      },
});
