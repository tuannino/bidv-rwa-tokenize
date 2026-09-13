import type { NextConfig } from "next";
import path from "path";

const repoRoot = path.join(__dirname, "..");

/**
 * Bỏ bước type-check TRONG lúc build (chỉ dùng khi build trong container nhỏ).
 *
 * `next build` chạy tsc ở worker riêng; trên VM Docker Desktop mặc định (~1.9GiB)
 * worker này bị OOM-kill dù đã hạ heap. Phần biên dịch thì xong bình thường.
 *
 * Bật cờ này KHÔNG làm mất kiểm tra kiểu: `npm run typecheck` chạy ở host/CI trên
 * cùng tsconfig. Mặc định vẫn là BẬT type-check để không ai vô tình mất lưới an toàn.
 */
const skipTypeCheck = process.env.NEXT_SKIP_TYPECHECK === "1";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: skipTypeCheck },
  // `@bidv/shared` là TS source ngoài app/ (npm link qua "file:../packages/shared"),
  // nên Next phải transpile nó và Turbopack phải nhìn thấy thư mục cha.
  // Xem node_modules/next/dist/docs/.../turbopack.md (mục `root`).
  transpilePackages: ["@bidv/shared"],
  // CỐ TÌNH KHÔNG đặt `output: "standalone"`.
  // Nó chỉ phục vụ @opennextjs/cloudflare (đang bị blocker bên dưới), mà lại làm
  // `next start` báo "does not work with output: standalone" -> hỏng đúng đường đang chạy được
  // (docker compose). Bật lại cùng lúc với việc xử lý blocker free-tier.
  //
  // Docker Desktop mặc định cấp VM nhỏ; nhiều worker sinh trang tĩnh song song
  // làm build bị OOM-kill (exit 137). App chỉ ~14 route nên gộp vào ít worker
  // gần như không ảnh hưởng thời gian build.
  experimental: {
    staticGenerationMaxConcurrency: 2,
    staticGenerationMinPagesPerWorker: 50,
  },
  //
  // Next 16 BẮT BUỘC `outputFileTracingRoot` và `turbopack.root` phải bằng nhau
  // (không bằng nhau thì cảnh báo và lấy giá trị của outputFileTracingRoot).
  // Cả hai đặt ở gốc repo vì Turbopack chỉ resolve được `@bidv/shared`
  // (npm link ra ngoài app/) khi root là thư mục CHA của cả hai
  // — xem node_modules/next/dist/docs/.../turbopack.md, mục `root`.
  //
  // ⚠️ BLOCKER FREE-TIER (chưa xử lý, xem docs/CHECKPOINT_P0_P1.md):
  // root = gốc repo làm output thành `.next/standalone/app/.next/...`, còn
  // @opennextjs/cloudflare đọc cứng `.next/standalone/.next/...` -> build Cloudflare fail ENOENT.
  // KHÔNG ảnh hưởng DoD P0/P1 (dev, next build, next start, docker compose đều chạy).
  outputFileTracingRoot: repoRoot,
  webpack: (config) => {
    const emptyPath = path.resolve(process.cwd(), "src/empty.ts");
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@x402/core": emptyPath,
      "@x402/core/client": emptyPath,
      "@x402/evm/exact/client": emptyPath,
      "@x402/evm/upto/client": emptyPath,
      "@x402/svm/exact/client": emptyPath,
      "@x402/svm/upto/client": emptyPath,
      "@x402/evm": emptyPath,
      "@x402/svm": emptyPath,
      "@x402/client": emptyPath,
      "@vercel/og": emptyPath,
      "next/dist/server/og/image-response": emptyPath,
      "next/dist/compiled/@vercel/og": emptyPath,
    };
    return config;
  },
  // For Next.js 16+ Turbopack
  turbopack: {
    root: repoRoot,
    resolveAlias: {
      "@x402/core": "./src/empty.ts",
      "@x402/core/client": "./src/empty.ts",
      "@x402/evm/exact/client": "./src/empty.ts",
      "@x402/evm/upto/client": "./src/empty.ts",
      "@x402/svm/exact/client": "./src/empty.ts",
      "@x402/svm/upto/client": "./src/empty.ts",
      "@x402/evm": "./src/empty.ts",
      "@x402/svm": "./src/empty.ts",
      "@x402/client": "./src/empty.ts",
      "@x402/*": "./src/empty.ts",
      "@vercel/og": "./src/empty.ts",
      "next/dist/server/og/image-response": "./src/empty.ts",
      "next/dist/compiled/@vercel/og": "./src/empty.ts",
    }
  },
  // Exclude heavy unused WASM binaries from being copied into build functions
  outputFileTracingExcludes: {
    "*": [
      "node_modules/next/dist/compiled/@vercel/og/resvg.wasm",
      "node_modules/next/dist/compiled/@vercel/og/yoga.wasm",
    ],
  }
};

export default nextConfig;
