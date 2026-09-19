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
  // ĐÃ XỬ LÝ (trước đây ghi là "BLOCKER FREE-TIER"):
  // root = gốc repo làm output thành `.next/standalone/app/.next/...`, còn
  // @opennextjs/cloudflare đọc `.next/standalone/.next/...` -> build Cloudflare fail ENOENT.
  // KHÔNG hạ root về `app/` được: Turbopack mất khả năng resolve `@bidv/shared`
  // (đã thử, fail "Module not found"). Cách xử lý: san phẳng standalone sau `next build`
  // — xem scripts/flatten-standalone.mjs + `buildCommand` trong open-next.config.ts.
  outputFileTracingRoot: repoRoot,
  //
  // ALIAS `@x402/*` -> src/empty.ts: BẮT BUỘC, đã đo bằng thực nghiệm (MC-01 Bước 7).
  //
  // Vì sao cần dù `@x402/*` KHÔNG có trong package.json và không có node_modules/@x402:
  // chúng là peerDependencies TÙY CHỌN của @coinbase/cdp-sdk (npm không cài), nhưng mã của
  // cdp-sdk vẫn `import` chúng, và cdp-sdk nằm trong đồ thị module của app theo chuỗi:
  //   src/components/providers.tsx -> @rainbow-me/rainbowkit -> @wagmi/connectors/baseAccount
  //   -> @base-org/account -> @coinbase/cdp-sdk
  // Bỏ nhóm alias này ra thì `next build` FAIL với 8 lỗi "Module not found" ở 5 specifier:
  //   @x402/core/client, @x402/evm/exact/client, @x402/evm/upto/client,
  //   @x402/svm/exact/client, @x402/evm
  //
  // ĐIỀU KIỆN XÓA: khi `cd app && npm ls @coinbase/cdp-sdk` trả về rỗng (tức wagmi/connectors
  // không còn kéo @base-org/account), thì bỏ alias + xóa src/empty.ts + chạy lại `npm run build`.
  //
  // ĐÃ GỠ (đo được là không cần): 3 alias `@vercel/og`,
  // `next/dist/server/og/image-response`, `next/dist/compiled/@vercel/og`. App không dùng OG
  // image, không tệp nào nhập ImageResponse. Bỏ ra thì `next build`, `build:standalone` và
  // `cf:build` đều xanh, và `.open-next` ra CÙNG kích thước (52608 KB) với CÙNG số tham chiếu
  // resvg.wasm/yoga.wasm (5+5) — tức alias này chưa từng khớp lần nào.
  // Hai dòng wasm ở `outputFileTracingExcludes` bên dưới là cơ chế KHÁC, vẫn cần, đừng gộp.
  //
  // Khối `webpack` dưới đây KHÔNG chạy trong bất kỳ đường build nào của repo: Next 16 mặc định
  // dùng Turbopack, và nó chỉ chặn build khi có `webpack` mà KHÔNG có `turbopack`
  // (xem node_modules/next/dist/lib/turbopack-warning.js: `hasWebpackConfig && !hasTurboConfig`).
  // Giữ lại làm đường thoát cho `next build --webpack`; đã kiểm `--webpack` chạy được.
  //
  // Ở đây phải liệt kê ĐỦ 5 specifier, KHÔNG rút về một khóa tiền tố `"@x402"` như bên
  // Turbopack: alias của webpack là phép THAY THẾ tiền tố, nên `@x402/core/client` gặp khóa
  // `"@x402"` sẽ thành `<emptyPath>/core/client` -> vẫn "Module not found" (đã thử, fail 5 lỗi).
  webpack: (config) => {
    const emptyPath = path.resolve(process.cwd(), "src/empty.ts");
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@x402/core/client": emptyPath,
      "@x402/evm/exact/client": emptyPath,
      "@x402/evm/upto/client": emptyPath,
      "@x402/svm/exact/client": emptyPath,
      "@x402/evm": emptyPath,
    };
    return config;
  },
  // For Next.js 16+ Turbopack
  turbopack: {
    root: repoRoot,
    // Một dòng wildcard là đủ: đã đo, nó phủ cả 5 specifier kể trên. Không cần liệt kê tay.
    resolveAlias: {
      "@x402/*": "./src/empty.ts",
    }
  },
  // `pg-cloudflare` khai `exports` có điều kiện `workerd` trỏ tới `./esm/index.mjs`.
  // Trace mặc định chỉ lần theo `require('pg-cloudflare')` trong pg/lib/stream.js nên chỉ
  // copy `dist/`, thiếu `esm/`. OpenNext bundle worker theo điều kiện `workerd` -> esbuild
  // báo `Could not resolve "pg-cloudflare"`. Ép copy cả package để có `esm/`.
  outputFileTracingIncludes: {
    "*": ["node_modules/pg-cloudflare/**"],
  },
  // Không copy WASM nặng của @vercel/og (app không dùng OG image) vào output đã trace.
  //
  // ⚠️ ĐỪNG xoá thẳng các file này khỏi node_modules như script build cũ từng làm
  // (`rm -f node_modules/next/dist/compiled/@vercel/og/*.wasm`). Bundle server của OpenNext
  // vẫn còn `import ... from "<abs>/resvg.wasm"`, nên xoá file làm `wrangler deploy` fail
  // ENOENT ở plugin wrangler-module-collector. Khai báo exclude ở đây là đủ và an toàn.
  outputFileTracingExcludes: {
    "*": [
      "node_modules/next/dist/compiled/@vercel/og/resvg.wasm",
      "node_modules/next/dist/compiled/@vercel/og/yoga.wasm",
    ],
  }
};

export default nextConfig;
