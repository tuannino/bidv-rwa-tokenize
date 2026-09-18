import 'server-only';

import { z } from 'zod';
import { DEFAULT_CHAIN, isChainKey, type ChainKey } from '@bidv/shared';

/**
 * Biến môi trường phía SERVER, đã validate. Đọc env ở đây và CHỈ ở đây.
 *
 * `import 'server-only'` khiến build fail ngay nếu có Client Component nào import file này —
 * đó là hàng rào chống rò `SERVER_SIGNER_PRIVATE_KEY` ra bundle browser.
 */

/** "true"/"1"/"yes" -> true. Thiếu biến -> dùng mặc định truyền vào. */
const boolFlag = (defaultValue: boolean) =>
  z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined || value.trim() === '') return defaultValue;
      return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
    });

const chainKeySchema = z
  .string()
  .optional()
  .transform((value): ChainKey => (isChainKey(value) ? value : DEFAULT_CHAIN));

const optionalUrl = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() !== '' ? value.trim() : undefined));

/**
 * Khóa riêng, chuẩn hoá về dạng có tiền tố `0x`.
 *
 * MetaMask (và hardhat) xuất/chấp nhận khóa KHÔNG có `0x`, nên người làm theo runbook rất dễ
 * dán vào dạng 64 hex trơn. viem thì bắt buộc có `0x` và báo lỗi rất khó hiểu
 * ("invalid private key, expected hex or 32 bytes, got string"). Tự thêm tiền tố ở đây,
 * thay vì để lỗi đó nổ ra giữa lúc gửi giao dịch.
 */
const privateKeySchema = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    if (!trimmed) return undefined;
    return /^[0-9a-fA-F]{64}$/.test(trimmed) ? `0x${trimmed}` : trimmed;
  })
  .refine((value) => value === undefined || /^0x[0-9a-fA-F]{64}$/.test(value), {
    message:
      'SERVER_SIGNER_PRIVATE_KEY phải là hex 32 byte (64 ký tự), có hoặc không có tiền tố 0x',
  });

const envSchema = z.object({
  // --- Chain ---
  defaultChain: chainKeySchema,
  rpcHardhat: optionalUrl,
  rpcEvm: optionalUrl,

  // --- Signer (PoC) ---
  /** Khóa dùng chung, áp cho mọi chain không có khóa riêng. */
  serverSignerPrivateKey: privateKeySchema,
  /**
   * Khóa riêng theo chain. Cần vì ROLE on-chain gắn với TỪNG chain: ví admin của
   * hardhat-local (Hardhat account #0) khác ví ngân hàng đã deploy lên Sepolia.
   * Chỉ có một khóa dùng chung thì đổi chain trên UI sẽ hỏng — ví ký không có role,
   * contract revert `AccessControlUnauthorizedAccount`.
   */
  serverSignerPrivateKeyHardhatLocal: privateKeySchema,
  serverSignerPrivateKeyEvm: privateKeySchema,

  // --- DB ---
  databaseUrl: optionalUrl,

  // --- Feature flags: mặc định MOCK để mint chạy ngay, không cần setup gì ---
  useMockKyc: boolFlag(true),
  useMockOracle: boolFlag(true),
  useMockCorebank: boolFlag(true),
  /** true = lưu Txn/audit trong bộ nhớ (free-tier). false = dùng Postgres qua DATABASE_URL. */
  useMockDb: boolFlag(true),

  /**
   * Cho phép cán bộ ngân hàng tự phát hành VNDB vào ví chỉ định — CHỈ MÔI TRƯỜNG THỬ.
   *
   * Mặc định TẮT, và đây là mặc định duy nhất đúng: bật trên môi trường thật là cho phép
   * tự phát hành tiền. Cờ này là LỚP CHẶN THỨ HAI, độc lập với bảng quyền RBAC — bảng quyền
   * nằm trong mã nguồn, ai gán nhầm vai `BANK_ADMIN` là chức năng mở ra ngay; cờ thì nằm
   * ở cấu hình triển khai nên hai lớp không cùng hỏng vì một sai sót.
   *
   * Điểm kiểm duy nhất: `lib/rbac/demo-payment.ts`. Đừng đọc cờ này ở chỗ khác.
   */
  enableDemoPaymentMint: boolFlag(false),

  /** Vai trò giả lập cho PoC — Phase 4 thay bằng SIWE + session thật. */
  demoRole: z
    .string()
    .optional()
    .transform((value) => (value && value.trim() !== '' ? value.trim().toUpperCase() : 'BANK_ADMIN')),
});

export type ServerEnv = z.infer<typeof envSchema>;

function load(): ServerEnv {
  const parsed = envSchema.safeParse({
    defaultChain: process.env.NEXT_PUBLIC_DEFAULT_CHAIN,
    // Biến KHÔNG public thắng: trong Docker, server gọi `http://chain:8545` còn
    // browser phải gọi `http://localhost:8545` (cổng đã publish). Hai giá trị khác nhau
    // cho cùng một chain, nên không thể dùng chung một biến.
    rpcHardhat: process.env.RPC_HARDHAT ?? process.env.NEXT_PUBLIC_RPC_HARDHAT,
    rpcEvm: process.env.RPC_EVM ?? process.env.NEXT_PUBLIC_RPC_EVM,
    serverSignerPrivateKey: process.env.SERVER_SIGNER_PRIVATE_KEY,
    serverSignerPrivateKeyHardhatLocal: process.env.SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL,
    serverSignerPrivateKeyEvm: process.env.SERVER_SIGNER_PRIVATE_KEY_EVM,
    databaseUrl: process.env.DATABASE_URL,
    useMockKyc: process.env.USE_MOCK_KYC,
    useMockOracle: process.env.USE_MOCK_ORACLE,
    useMockCorebank: process.env.USE_MOCK_COREBANK,
    useMockDb: process.env.USE_MOCK_DB,
    // KHÔNG có biến thể NEXT_PUBLIC_: cờ phải do người triển khai đặt ở server, không
    // để lộ ra bundle browser như một thứ có thể bật được từ phía client.
    enableDemoPaymentMint: process.env.ENABLE_DEMO_PAYMENT_MINT,
    demoRole: process.env.DEMO_ROLE ?? process.env.NEXT_PUBLIC_DEMO_ROLE,
  });

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Cấu hình môi trường không hợp lệ:\n${detail}\nXem .env.example.`);
  }
  return parsed.data;
}

let cached: ServerEnv | undefined;

/** Lazy + cache: không đọc env lúc import để build/prerender không nổ vì thiếu biến. */
export function serverEnv(): ServerEnv {
  cached ??= load();
  return cached;
}

/** Chỉ dùng trong test để nạp lại env sau khi đổi process.env. */
export function resetServerEnvCache(): void {
  cached = undefined;
}

/**
 * Khóa ký cho một chain: ưu tiên khóa RIÊNG của chain, không có thì lấy khóa dùng chung.
 *
 * Đây là nơi DUY NHẤT quyết định "chain nào dùng khóa nào" (LUẬT 2: khóa chỉ đọc ở
 * config/env.ts và signer/server.signer.ts).
 */
export function signerPrivateKeyFor(chain: ChainKey): string | undefined {
  const env = serverEnv();
  switch (chain) {
    case 'hardhat-local':
      return env.serverSignerPrivateKeyHardhatLocal ?? env.serverSignerPrivateKey;
    case 'evm':
      return env.serverSignerPrivateKeyEvm ?? env.serverSignerPrivateKey;
    case 'stellar':
    case 'mock':
      return env.serverSignerPrivateKey;
  }
}
