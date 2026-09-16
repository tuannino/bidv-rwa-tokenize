/**
 * Gỡ cấp lồng trong `.next/standalone` để @opennextjs/cloudflare đọc được.
 *
 * VÌ SAO CẦN:
 * - `next.config.ts` BUỘC đặt `outputFileTracingRoot`/`turbopack.root` = gốc repo, vì
 *   `@bidv/shared` nằm ngoài `app/` (npm link "file:../packages/shared") và Turbopack chỉ
 *   resolve được khi root là thư mục CHA của cả hai. Đặt root = `app/` thì build fail
 *   "Module not found: @bidv/shared" (đã thử, đã xác nhận).
 * - Next sinh standalone theo đường dẫn TƯƠNG ĐỐI so với tracing root, nên output thành
 *   `.next/standalone/app/.next/...`.
 * - OpenNext tính `packagePath = relative(monorepoRoot, appBuildOutputPath)`. `monorepoRoot`
 *   dò bằng lockfile gần nhất -> chính là `app/` (có `app/package-lock.json`), nên
 *   `packagePath = ""` và nó đọc `.next/standalone/.next/...` -> ENOENT.
 *
 * Script KHÔNG tính đường dẫn lồng theo công thức nữa: nó TÌM thư mục nào thực sự chứa
 * `.next/server/pages-manifest.json` rồi san phẳng thư mục đó lên `.next/standalone/`.
 * Lý do: bản trước tính theo `relative(repoRoot, appDir)` chạy đúng ở máy nhưng build
 * Cloudflare vẫn báo đúng lỗi cũ, nên không tin công thức nữa — tìm thật rồi in ra cây
 * thư mục để log build luôn nói được chuyện gì đã xảy ra.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Dùng fileURLToPath thay vì `import.meta.dirname` (chỉ có từ Node 20.11+);
// repo chưa pin Node nên giữ dạng chạy được trên mọi bản Node có ESM.
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, "..");
const standaloneDir = path.join(appDir, ".next", "standalone");

const TAG = "[flatten-standalone]";
const log = (msg) => console.log(`${TAG} ${msg}`);

/** In cây thư mục (giới hạn độ sâu) để log build Cloudflare tự chẩn đoán được. */
function printTree(dir, maxDepth, depth = 0, prefix = "") {
  if (depth > maxDepth) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    console.log(`${TAG}   ${prefix}${entry.name}${entry.isDirectory() ? "/" : ""}`);
    if (entry.isDirectory() && depth < maxDepth) {
      printTree(path.join(dir, entry.name), maxDepth, depth + 1, `${prefix}  `);
    }
  }
}

/**
 * Tìm thư mục chứa `.next/server/pages-manifest.json`, đó là "app root" thật của standalone.
 * Duyệt theo bề rộng, bỏ qua node_modules cho nhanh.
 */
function findAppRoot(root) {
  const queue = [root];
  while (queue.length > 0) {
    const dir = queue.shift();
    if (fs.existsSync(path.join(dir, ".next", "server", "pages-manifest.json"))) return dir;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      queue.push(path.join(dir, entry.name));
    }
  }
  return undefined;
}

if (!fs.existsSync(standaloneDir)) {
  console.error(
    `${TAG} LỖI: không có ${standaloneDir}.\n` +
      `${TAG} next build đã chạy nhưng KHÔNG sinh standalone. Nguyên nhân hay gặp: thiếu\n` +
      `${TAG} NEXT_PRIVATE_STANDALONE=true (dùng "npm run cf:build" thay vì gọi next build tay).`,
  );
  process.exit(1);
}

const appRoot = findAppRoot(standaloneDir);

if (!appRoot) {
  console.error(`${TAG} LỖI: không tìm thấy .next/server/pages-manifest.json dưới standalone.`);
  console.error(`${TAG} Cây .next/standalone (sâu 3 cấp):`);
  printTree(standaloneDir, 3);
  process.exit(1);
}

if (appRoot === standaloneDir) {
  log("standalone đã phẳng sẵn, không cần làm gì.");
  process.exit(0);
}

log(`app root thật: ${path.relative(standaloneDir, appRoot) || "."}`);

// Chặn trường hợp có file được trace từ NGOÀI app/ (vd `packages/shared`): san phẳng sẽ
// làm sai đường dẫn tương đối từ server root ra các thư mục đó.
const topSegment = path.relative(standaloneDir, appRoot).split(path.sep)[0];
const strays = fs.readdirSync(standaloneDir).filter((entry) => entry !== topSegment);
if (strays.length > 0) {
  console.error(
    `${TAG} DỪNG: có nội dung được trace ngoài "${topSegment}/": ${strays.join(", ")}.\n` +
      `${TAG} San phẳng sẽ làm sai đường dẫn tương đối tới các thư mục này. Cần xử lý tay.`,
  );
  process.exit(1);
}

for (const entry of fs.readdirSync(appRoot)) {
  const from = path.join(appRoot, entry);
  const to = path.join(standaloneDir, entry);
  fs.rmSync(to, { recursive: true, force: true });
  fs.renameSync(from, to);
}

fs.rmSync(path.join(standaloneDir, topSegment), { recursive: true, force: true });

// Xác nhận đúng cái file mà OpenNext sẽ đọc, thay vì tin là đã xong.
const manifest = path.join(standaloneDir, ".next", "server", "pages-manifest.json");
if (!fs.existsSync(manifest)) {
  console.error(`${TAG} LỖI: san phẳng xong mà vẫn thiếu ${manifest}.`);
  printTree(standaloneDir, 2);
  process.exit(1);
}

log(`đã san phẳng ${topSegment}/ -> .next/standalone/ (xác nhận có .next/server/pages-manifest.json)`);
