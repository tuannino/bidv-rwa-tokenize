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

/**
 * Số ký tự tối thiểu của `KEEPER_SECRET`.
 *
 * Khoá này là thứ DUY NHẤT chặn người ngoài gọi được điểm vào chia lợi nhuận, nên một khoá
 * ngắn kiểu `"secret"` là không có gì. 32 ký tự là độ dài của một khoá sinh bằng
 * `openssl rand -hex 16`, tức mức thấp nhất mà một lệnh sinh khoá thông thường cho ra.
 *
 * Chặn ở tầng cấu hình, KHÔNG ở route: route chỉ thấy khoá đúng hay sai, còn "khoá quá yếu"
 * phải nổ ra lúc nạp cấu hình để người triển khai biết ngay, chứ không phải im lặng chạy
 * suốt với một khoá đoán được.
 */
export const KEEPER_SECRET_MIN_LENGTH = 32;

/**
 * Khoá bí mật của điểm vào tiến trình định kỳ. Thiếu -> `undefined`, và route TỪ CHỐI hết.
 *
 * Không có giá trị mặc định, và đó là chủ đích: một mặc định trong mã nằm trong repo công
 * khai, nên nó tương đương không có khoá nào.
 */
const keeperSecretSchema = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  })
  .refine((value) => value === undefined || value.length >= KEEPER_SECRET_MIN_LENGTH, {
    message: `KEEPER_SECRET phải dài ít nhất ${KEEPER_SECRET_MIN_LENGTH} ký tự (sinh bằng \`openssl rand -hex 16\`)`,
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
   * Bản PoC demo mặc định BẬT để chạy trọn luồng ngay sau khi clone. Môi trường production
   * BẮT BUỘC ghi đè thành `false`: bật ở đó là cho phép tự phát hành tiền. Cờ này là LỚP CHẶN
   * THỨ HAI, độc lập với bảng quyền RBAC — production phải cấu hình tường minh thay vì dựa vào
   * mặc định dành cho bản demo.
   *
   * Điểm kiểm duy nhất: `lib/rbac/demo-payment.ts`. Đừng đọc cờ này ở chỗ khác.
   */
  enableDemoPaymentMint: boolFlag(true),

  /**
   * Cho phép phát hành WPT TRỰC TIẾP, không qua lập–duyệt — CHỈ MÔI TRƯỜNG THỬ, để dựng dữ liệu thử
   * (FE-22). Mặc định TẮT, cùng lý do và cùng mô hình hai lớp với cờ ở trên: bật trên môi trường
   * thật là mở lại đường đi vòng qua Kiểm soát viên.
   *
   * Điểm kiểm duy nhất: `lib/rbac/demo-payment.ts`. Đừng đọc cờ này ở chỗ khác.
   */
  enableDemoTokenMint: boolFlag(false),

  /**
   * Khoá bí mật cho `POST /api/keeper/distribution` (BE-07).
   *
   * Điểm vào đó chạy một vòng chia lợi nhuận, tức là nó CHUYỂN TIỀN. Không có khoá thì bất kỳ
   * ai biết đường dẫn cũng kích hoạt được, nên route từ chối mọi yêu cầu khi biến này trống —
   * "chưa cấu hình" phải là đóng, không phải mở.
   */
  keeperSecret: keeperSecretSchema,

  /** Vai trò giả lập cho PoC — Phase 4 thay bằng SIWE + session thật. */
  demoRole: z
    .string()
    .optional()
    .transform((value) => (value && value.trim() !== '' ? value.trim().toUpperCase() : 'TELLER')),

  /**
   * Mã tài khoản giả lập cho PoC (BE-12) — AU-01 thay bằng tài khoản của phiên đăng nhập.
   * Trống thì `currentActorId()` lấy mã tài khoản mẫu của vai đang có hiệu lực.
   */
  demoActor: z
    .string()
    .optional()
    .transform((value) => (value && value.trim() !== '' ? value.trim() : undefined)),
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
    // Cùng lý do: không có biến thể NEXT_PUBLIC_.
    enableDemoTokenMint: process.env.ENABLE_DEMO_TOKEN_MINT,
    // KHÔNG có biến thể NEXT_PUBLIC_, cùng lý do với cờ trên: một khoá bí mật lọt vào bundle
    // browser thì mọi người xem trang đều đọc được.
    keeperSecret: process.env.KEEPER_SECRET,
    demoRole: process.env.DEMO_ROLE ?? process.env.NEXT_PUBLIC_DEMO_ROLE,
    demoActor: process.env.DEMO_ACTOR,
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
 * Khoá người gọi gửi lên CÓ khớp `KEEPER_SECRET` hay không.
 *
 * Đây là nơi DUY NHẤT đọc giá trị khoá, cùng khuôn với `signerPrivateKeyFor`: route handler
 * chỉ hỏi khớp hay không, không bao giờ cầm chuỗi khoá. Nhờ vậy một lần `console.log` bất cẩn ở
 * tầng vận chuyển không in được khoá ra nhật ký.
 *
 * ## Hai điều cố ý
 *
 * **1. Chưa cấu hình khoá -> luôn KHÔNG khớp.** Route vì vậy từ chối hết. "Chưa cấu hình" phải
 * là đóng: điểm vào này chuyển tiền, nên mở sẵn khi thiếu cấu hình là hỏng theo chiều tệ nhất.
 *
 * **2. So sánh trong thời gian không phụ thuộc nội dung.** `a === b` của JS thoát ra ngay ở
 * byte đầu khác nhau, nên thời gian trả lời tiết lộ người gọi đã đoán đúng bao nhiêu ký tự
 * đầu — đủ để dò dần cả khoá. Vòng lặp dưới đây luôn đi hết độ dài.
 *
 * Độ dài vẫn lộ (so trước, rồi mới lặp), và đó là đánh đổi có chủ ý: `KEEPER_SECRET` có chặn
 * độ dài tối thiểu nên biết độ dài không giúp thu hẹp được gì đáng kể, còn lặp trên hai chuỗi
 * khác độ dài thì phải tự chọn cách đệm và dễ viết sai hơn chính lỗ hổng đang muốn bịt.
 */
export function keeperSecretMatches(provided: string | null | undefined): boolean {
  const expected = serverEnv().keeperSecret;
  if (!expected || !provided) return false;
  if (provided.length !== expected.length) return false;

  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
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
