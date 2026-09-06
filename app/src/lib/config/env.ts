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

const privateKeySchema = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() !== '' ? value.trim() : undefined))
  .refine((value) => value === undefined || /^0x[0-9a-fA-F]{64}$/.test(value), {
    message: 'SERVER_SIGNER_PRIVATE_KEY phải là hex 32 byte có tiền tố 0x',
  });

const envSchema = z.object({
  // --- Chain ---
  defaultChain: chainKeySchema,
  rpcHardhat: optionalUrl,
  rpcEvm: optionalUrl,

  // --- Signer (PoC) ---
  serverSignerPrivateKey: privateKeySchema,

  // --- DB ---
  databaseUrl: optionalUrl,

  // --- Feature flags: mặc định MOCK để mint chạy ngay, không cần setup gì ---
  useMockKyc: boolFlag(true),
  useMockOracle: boolFlag(true),
  useMockCorebank: boolFlag(true),
  /** true = lưu Txn/audit trong bộ nhớ (free-tier). false = dùng Postgres qua DATABASE_URL. */
  useMockDb: boolFlag(true),

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
    databaseUrl: process.env.DATABASE_URL,
    useMockKyc: process.env.USE_MOCK_KYC,
    useMockOracle: process.env.USE_MOCK_ORACLE,
    useMockCorebank: process.env.USE_MOCK_COREBANK,
    useMockDb: process.env.USE_MOCK_DB,
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
