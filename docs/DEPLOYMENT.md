# Triển khai & Hosting (demo theo lượt)

Mục tiêu: **default free-tier** (rẻ, bật/tắt nhanh, demo theo lượt), nhưng **một codebase chạy được cả 2** chế độ. Chỉ đổi feature-flag/biến môi trường, không sửa code.

## Hai chế độ

| | FREE-TIER (default) | VPS (đầy đủ) |
|---|---|---|
| Web | Cloudflare Workers (`@opennextjs/cloudflare`) | Docker (`docker compose`) |
| DB | Supabase / Neon (Postgres free) | Postgres container |
| Chain | `mock` (mặc định) hoặc `evm` testnet (Sepolia + RPC free) | `hardhat-local` node thật |
| Lệnh | `npm run build` + deploy (wrangler) | `docker compose up` |
| Dùng khi | demo public nhanh, không cần chain thật | demo đầy đủ mọi luồng, có hardhat |

## Ràng buộc Cloudflare (kích thước Worker)
- **Hiện tại (từ 2026-09-04):** giới hạn **64 MiB KHÔNG nén** cho mọi gói (kể cả Free). Giới hạn nén cũ (Free 3 MiB / Paid 10 MiB) **đã bỏ**.
- Thay đổi mới + docs đang cập nhật → **vẫn build gọn để chắc:**
  - Không bundle hardhat, ethers, artifact contract, thư viện node-only vào bundle edge.
  - Dùng **viem** (nhẹ) ở phía web; ABI chỉ giữ hàm cần dùng.
  - Đồ nặng/tooling để ở `packages/contracts-*` (dùng lúc build), không ship vào worker.
  - Kiểm trước khi deploy: `wrangler deploy --dry-run` xem "Total Upload".

## Runbook: Cloudflare Workers Builds (deploy từ Git)

### Tên Worker phải khớp
Tên Worker trên dashboard **phải bằng đúng** `name` trong `app/wrangler.json`, tức
`bidv-rwa-tokenize`. Lệch tên thì build fail ngay
([Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds)). Ngoài ra
`wrangler.json` có service binding `WORKER_SELF_REFERENCE` trỏ về chính
`bidv-rwa-tokenize`, nên đổi tên là hỏng cả binding đó.

### Cấu hình Build

| Mục | Giá trị |
|---|---|
| Root directory | `app` |
| Build command | `npm run cf:build` |
| Deploy command | `npx wrangler deploy` |

**Build command PHẢI là `npm run cf:build`, không phải `npx @opennextjs/cloudflare build`.**
`cf:build` tự xếp thứ tự: `next build` (standalone) → san phẳng → `opennextjs-cloudflare build
--skipNextBuild`. Gọi `npx @opennextjs/cloudflare build` trực tiếp thì bước san phẳng phụ thuộc
hook `buildCommand` trong `open-next.config.ts`, mà hook đó chạy đúng ở máy cục bộ nhưng
KHÔNG được áp dụng trên Workers Builds (log fail không có dòng `[flatten-standalone]`).

- **Root directory = `app`**, không phải gốc repo: đây là nơi có `wrangler.json` và
  `package.json`. Cloudflare vẫn clone TOÀN BỘ repo rồi mới `cd` vào đây, nên
  `@bidv/shared` (`file:../packages/shared`) resolve được. Không cần build
  `packages/shared` trước — nó là TS source, Next transpile trực tiếp
  (`transpilePackages`).
- **Không cần thêm `npm install`** vào build command; Workers Builds tự cài theo
  lockfile trước khi chạy.
- **Deploy command**: `npx @opennextjs/cloudflare deploy` cũng được (nó gọi
  `wrangler deploy` bên trong). Mặc định của Cloudflare là `npx wrangler deploy`
  ([Configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration)).
- **KHÔNG** set "Output directory" — đó là mục của Pages. Worker lấy đường dẫn từ
  `wrangler.json` (`.open-next/worker.js` + `.open-next/assets`).

### Biến môi trường

**BẮT BUỘC cho demo public: `NEXT_PUBLIC_DEFAULT_CHAIN=mock` (đặt ở Build variables).**

Thiếu biến này thì default là `hardhat-local`. `publicConfig()` vẫn coi chain đó
"chọn được" vì `CHAINS['hardhat-local']` có `defaultRpcUrl`, nên KHÔNG tự lùi về `mock`.
Kết quả: trang render 200 bình thường nhưng mọi lời gọi ledger trả 502
`{"ok":false,"code":"LEDGER","error":"HTTP request failed."}` — free-tier không chạy
hardhat node. Đã kiểm bằng workerd: `/api/token?chain=mock` trả 200,
`?chain=hardhat-local` trả 502.

Các `USE_MOCK_*` còn lại mặc định `true` nên không cần đặt.

Khi cần đặt thêm, phân biệt hai chỗ — đặt sai chỗ là không có tác dụng:

| Loại | Đặt ở | Vì sao |
|---|---|---|
| `NEXT_PUBLIC_*` | **Build variables** (trong Settings → Build) | Next nội tuyến vào bundle lúc build, đặt ở runtime không ăn |
| `USE_MOCK_*`, `DEMO_ROLE`, `RPC_*` | Worker → Settings → Variables | server đọc `process.env` lúc chạy |
| `DATABASE_URL`, `SERVER_SIGNER_PRIVATE_KEY*` | Worker → Settings → Variables, dạng **Secret** | không được để lộ dạng plain text |

Muốn dùng Postgres thật (Supabase/Neon) thì đặt `USE_MOCK_DB=false` + `DATABASE_URL`;
để nguyên mặc định thì Txn/audit lưu trong bộ nhớ, đủ cho demo theo lượt.

### Kiểm trước khi đẩy lên dashboard
```bash
cd app
npx @opennextjs/cloudflare build      # phải in "OpenNext build complete"
npx wrangler deploy --dry-run         # xem "Total Upload" so với hạn 64 MiB
```
Mốc tham chiếu lần đo gần nhất: **14600 KiB không nén / 3941 KiB gzip**.

### Bẫy đã gặp (đừng lặp lại)
1. **`Could not find compiled Open Next config`** — build command chỉ chạy `next build`
   thuần. Lưu ý ngược lại: OpenNext **tự gọi** `npm run build` làm bước con, nên không
   được xoá script `build`.
2. **`ENOENT .next/standalone/.next/server/pages-manifest.json`** — do
   `outputFileTracingRoot` = gốc repo làm standalone lồng thêm cấp `app/`. Xử lý bằng
   `app/scripts/flatten-standalone.mjs`. Đừng "sửa" bằng cách hạ root về `app/`:
   Turbopack sẽ không resolve được `@bidv/shared`.
   **Nếu gặp lại lỗi này trên Workers Builds:** kiểm build command có đúng
   `npm run cf:build` chưa. Dựa vào hook `buildCommand` là không đủ — đã fail thật ở
   môi trường đó.
3. **`ENOENT resvg.wasm` lúc deploy** — do script build từng xoá
   `node_modules/next/dist/compiled/@vercel/og/*.wasm` trong khi bundle server vẫn
   import tuyệt đối tới chúng. Dùng `outputFileTracingExcludes` (đã có trong
   `next.config.ts`), không xoá file.
4. **Error 1101 "Worker threw exception" — build/deploy xanh nhưng mở web là chết.**
   Triệu chứng thật (tái hiện bằng `wrangler dev` + curl):
   `Error: Unexpected loadManifest(/.next/server/prefetch-hints.json) call!`.
   `@opennextjs/cloudflare` nội tuyến manifest vào bundle vì workerd không có
   `readFileSync`, nhưng glob của bản 1.14.0 chỉ bắt
   `{*-manifest,required-server-files}.json` nên bỏ sót `prefetch-hints.json` mà Next 16
   mới sinh ra. Sửa bằng cách nâng lên **1.20.1** (glob đã thêm `prefetch-hints` + trả `{}`
   cho các manifest tuỳ chọn).
   Ràng buộc phiên bản: 1.20.2 cần `next >=16.2.11`, 1.20.3+ cần `next >=16.3.3`. Repo đang
   ở Next 16.2.7 nên **1.20.1 là bản mới nhất dùng được**. Muốn lên OpenNext cao hơn thì
   phải nâng Next trước.
5. **`Could not resolve "pg-cloudflare"` lúc bundle worker** — `pg-cloudflare` khai
   `exports` có điều kiện `workerd` trỏ `./esm/index.mjs`, nhưng trace mặc định chỉ lần theo
   `require('pg-cloudflare')` trong `pg/lib/stream.js` nên chỉ copy `dist/`. OpenNext bundle
   theo điều kiện `workerd` -> thiếu file. Sửa bằng `outputFileTracingIncludes` cho cả
   package (đã có trong `next.config.ts`).

6. **`npm error EUSAGE ... npm ci can only install packages when your package.json and
   package-lock.json are in sync`** (kèm `Missing: @emnapi/...`, `Missing: zod@3.25.76`).

   Nguyên nhân là **lệch phiên bản npm**, không phải lockfile hỏng. Workers Builds hiện
   dùng `nodejs@24.18.0` + **`npm@10.9.2`** (đọc dòng "Detected the following tools from
   environment" ở đầu log). npm 11 sinh lock lược bớt một số entry optional/nested mà
   npm 10 vẫn đòi, nên lock do npm 11 tạo pass `npm ci` ở máy nhưng fail trên Cloudflare.

   **Quy tắc: sinh và kiểm lockfile bằng đúng bản npm của Workers Builds.**
   ```bash
   cd app
   npx npm@10.9.2 install --package-lock-only   # sinh lock
   npx npm@10.9.2 ci                            # kiểm như Cloudflare  (BẮT BUỘC)
   npm ci                                       # kiểm luôn npm ở máy, đừng làm hỏng dev
   ```
   Lock sinh bằng npm 10 thì npm 11 vẫn đọc được; ngược lại thì không. Đổi dependency mà
   chưa chạy `npx npm@10.9.2 ci` là chưa xong.

   Kiểm lại bản npm của Cloudflare mỗi lần log đầu build đổi — con số 10.9.2 sẽ cũ đi.
   Repo hiện **chưa pin Node/npm** (không có `.nvmrc`, không có `engines`) nên phía
   Cloudflare tự chọn; đây là món nợ nên xử lý riêng.

### Cách tái hiện lỗi runtime ở máy (đừng debug bằng cách deploy lại)
```bash
cd app
npm run cf:build
npx wrangler dev --port 8788        # chạy đúng workerd như trên Cloudflare
curl --noproxy '*' http://127.0.0.1:8788/
```
Lỗi 1101 trên Cloudflare chỉ hiện "Worker threw exception" không kèm stack; `wrangler dev`
in ra stack đầy đủ. Nhớ `--noproxy '*'` nếu máy có biến proxy.

## Quy tắc thiết kế để chạy được cả 2
1. Luồng demo public KHÔNG phụ thuộc cứng hardhat node thường trú (free-tier không chạy node).
2. Chain + tích hợp chọn qua feature-flag/registry, không hard-code.
3. Bí mật (RPC key, server signer) qua biến môi trường; không commit.

## Nếu chọn có phí (cân bằng chi phí)
- VPS nhỏ bật-theo-lượt (bật lúc demo, tắt sau) hoặc Cloudflare/Supabase gói trả phí khi vượt free. Vì demo theo lượt, ưu tiên bật/tắt hơn là always-live.
