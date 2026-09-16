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
| Build command | `npx @opennextjs/cloudflare build` |
| Deploy command | `npx wrangler deploy` |

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
Deploy demo **không cần biến nào**: mọi `USE_MOCK_*` mặc định `true`, và
`NEXT_PUBLIC_DEFAULT_CHAIN` thiếu thì `publicConfig()` tự lùi về `mock`
(xem `app/src/lib/config/flags.ts`).

Khi cần đặt, phân biệt hai chỗ — đặt sai chỗ là không có tác dụng:

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
1. **`Could not find compiled Open Next config`** — build command đang là
   `npm run build` (chỉ chạy `next build`). Phải là
   `npx @opennextjs/cloudflare build`. Lưu ý ngược lại: OpenNext **tự gọi**
   `npm run build` làm bước con, nên không được xoá script `build`.
2. **`ENOENT .next/standalone/.next/server/pages-manifest.json`** — do
   `outputFileTracingRoot` = gốc repo làm standalone lồng thêm cấp `app/`. Đã xử lý
   bằng `app/scripts/flatten-standalone.mjs`, gắn qua `buildCommand` trong
   `open-next.config.ts`. Đừng "sửa" bằng cách hạ root về `app/`: Turbopack sẽ không
   resolve được `@bidv/shared`.
3. **`ENOENT resvg.wasm` lúc deploy** — do script build từng xoá
   `node_modules/next/dist/compiled/@vercel/og/*.wasm` trong khi bundle server vẫn
   import tuyệt đối tới chúng. Dùng `outputFileTracingExcludes` (đã có trong
   `next.config.ts`), không xoá file.

## Quy tắc thiết kế để chạy được cả 2
1. Luồng demo public KHÔNG phụ thuộc cứng hardhat node thường trú (free-tier không chạy node).
2. Chain + tích hợp chọn qua feature-flag/registry, không hard-code.
3. Bí mật (RPC key, server signer) qua biến môi trường; không commit.

## Nếu chọn có phí (cân bằng chi phí)
- VPS nhỏ bật-theo-lượt (bật lúc demo, tắt sau) hoặc Cloudflare/Supabase gói trả phí khi vượt free. Vì demo theo lượt, ưu tiên bật/tắt hơn là always-live.
