/**
 * Gỡ một cấp lồng trong `.next/standalone` để @opennextjs/cloudflare đọc được.
 *
 * VÌ SAO CẦN:
 * - `next.config.ts` BUỘC phải đặt `outputFileTracingRoot`/`turbopack.root` = gốc repo,
 *   vì `@bidv/shared` nằm ngoài `app/` (npm link "file:../packages/shared") và Turbopack
 *   chỉ resolve được khi root là thư mục CHA của cả hai. Đặt root = `app/` thì build fail
 *   "Module not found: @bidv/shared" (đã thử, đã xác nhận).
 * - Next sinh standalone theo đường dẫn TƯƠNG ĐỐI so với tracing root, nên output thành
 *   `.next/standalone/app/.next/...`.
 * - OpenNext tính `packagePath = relative(monorepoRoot, appBuildOutputPath)`. Ở đây
 *   `monorepoRoot` được dò bằng lockfile gần nhất -> chính là `app/` (có `app/package-lock.json`),
 *   nên `packagePath = ""` và nó đọc `.next/standalone/.next/...` -> ENOENT.
 *   (OpenNext có set `NEXT_PRIVATE_OUTPUT_TRACE_ROOT = monorepoRoot`, nhưng giá trị khai báo
 *   tường minh trong next.config.ts thắng env var đó.)
 *
 * Script này san phẳng `.next/standalone/app/*` -> `.next/standalone/*` để hai bên khớp nhau,
 * KHÔNG phải sửa `outputFileTracingRoot` (sẽ làm hỏng build).
 *
 * An toàn: `@bidv/shared` được `transpilePackages` nội tuyến vào chunk server nên standalone
 * không chứa gì ngoài `app/`. Script vẫn kiểm tra điều đó và DỪNG nếu gặp thư mục lạ,
 * để không âm thầm tạo ra bundle sai đường dẫn tương đối.
 */
import fs from "node:fs";
import path from "node:path";

const appDir = path.resolve(import.meta.dirname, "..");
const repoRoot = path.join(appDir, "..");
const standaloneDir = path.join(appDir, ".next", "standalone");

// Đúng quy tắc Next: standalone lồng theo đường dẫn app tương đối so với tracing root.
const nestedRel = path.relative(repoRoot, appDir);

if (!fs.existsSync(standaloneDir)) {
  console.error(
    `[flatten-standalone] Không thấy ${standaloneDir}.\n` +
      `Chạy next build với NEXT_PRIVATE_STANDALONE=true trước (xem script "build:standalone").`,
  );
  process.exit(1);
}

if (nestedRel === "" || nestedRel.startsWith("..")) {
  console.log("[flatten-standalone] Không có cấp lồng nào, bỏ qua.");
  process.exit(0);
}

// Đã phẳng rồi (chạy lại lần hai, hoặc Next đổi hành vi) -> không làm gì.
if (fs.existsSync(path.join(standaloneDir, ".next", "server"))) {
  console.log("[flatten-standalone] `.next/standalone/.next/server` đã có, bỏ qua.");
  process.exit(0);
}

const topSegment = nestedRel.split(path.sep)[0];
const nestedDir = path.join(standaloneDir, nestedRel);

if (!fs.existsSync(nestedDir)) {
  console.error(`[flatten-standalone] Không thấy thư mục lồng ${nestedDir}.`);
  process.exit(1);
}

// Chặn trường hợp có file được trace từ NGOÀI app/ (vd `packages/shared`): san phẳng sẽ
// làm sai đường dẫn tương đối từ server root ra các thư mục đó.
const strays = fs.readdirSync(standaloneDir).filter((entry) => entry !== topSegment);
if (strays.length > 0) {
  console.error(
    `[flatten-standalone] DỪNG: có nội dung được trace ngoài "${topSegment}/": ${strays.join(", ")}.\n` +
      `San phẳng sẽ làm sai đường dẫn tương đối tới các thư mục này. Cần xử lý tay.`,
  );
  process.exit(1);
}

for (const entry of fs.readdirSync(nestedDir)) {
  const from = path.join(nestedDir, entry);
  const to = path.join(standaloneDir, entry);
  fs.rmSync(to, { recursive: true, force: true });
  fs.renameSync(from, to);
}

fs.rmSync(path.join(standaloneDir, topSegment), { recursive: true, force: true });

console.log(`[flatten-standalone] Đã san phẳng .next/standalone/${nestedRel}/ -> .next/standalone/`);
