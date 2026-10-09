# Triển khai & Hosting (demo theo lượt)

Mục tiêu: **default free-tier** (rẻ, bật/tắt nhanh, demo theo lượt), nhưng **một codebase chạy được cả 2** chế độ. Chỉ đổi feature-flag/biến môi trường, không sửa code.

## Hai chế độ

| | FREE-TIER (default) | VPS (đầy đủ) |
|---|---|---|
| Web | Cloudflare Workers (`@opennextjs/cloudflare`) | Docker (`docker compose`) |
| DB | Neon / Supabase qua Cloudflare Hyperdrive | Postgres container |
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

OP-02: `cf:build` lấy mã commit, nhánh và thời điểm UTC từ Git nếu chưa được CI cấp
`BUILD_COMMIT_SHA` / `BUILD_BRANCH` / `BUILD_TIME`. Chỉ ba giá trị công khai này được nhúng
vào bản dựng; không cần đặt lại trên Worker. Sau khi dựng, dùng `scripts/smoke-test.mjs`
với `--expect-commit` để xác nhận bản đang chạy.

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

Demo public không cần đặt `NEXT_PUBLIC_DEFAULT_CHAIN`: source mặc định là `mock`. Có thể đặt
tường minh `NEXT_PUBLIC_DEFAULT_CHAIN=mock` ở Build variables để cấu hình tự mô tả. Chỉ chọn
`hardhat-local` khi deploy có node Hardhat đi kèm; free-tier không có node đó nên mọi lời gọi ledger
sẽ trả lỗi kết nối.

`wrangler.json` là nguồn duy nhất cho biến runtime **không bí mật** của bản deploy. OP-06 đặt sẵn
`USE_MOCK_DB=false`, `ENABLE_SEPOLIA_DEMO_PROJECT=true` và `keep_vars=true`; không đặt lại hai biến
đầu bằng tay trên dashboard. `keep_vars` giữ các secret/biến kết nối đặt trên Dashboard khi chạy
`wrangler deploy`; không được bỏ cờ này nếu chưa chuyển toàn bộ cấu hình sang secrets file an toàn.

Khi cần đặt thêm, phân biệt hai chỗ — đặt sai chỗ là không có tác dụng:

| Loại | Đặt ở | Vì sao |
|---|---|---|
| `NEXT_PUBLIC_*` | **Build variables** (trong Settings → Build) | Next nội tuyến vào bundle lúc build, đặt ở runtime không ăn |
| `USE_MOCK_*`, `DEMO_ROLE`, `ENABLE_DEMO_*` | `app/wrangler.json` → `vars` | nguồn duy nhất của biến runtime không bí mật |
| `ENABLE_READ_DIAGNOSTICS` | Worker runtime variable, nguồn `wrangler.json` | OP-06 bật tạm `true` để log thời gian đường đọc WPT, tắt sau khi chẩn đoán |
| `ENABLE_SEPOLIA_DEMO_PROJECT` | `app/wrangler.json` | `true`: đăng ký WPT Sepolia đã deploy |
| `USE_MOCK_DB` | `app/wrangler.json` | `false`: dữ liệu nghiệp vụ dùng Postgres qua Hyperdrive |
| `ENABLE_DEMO_TOKEN_MINT` | Worker runtime variable | `false`, dùng lập–duyệt |
| `ENABLE_DEMO_PAYMENT_MINT` | Worker runtime variable | `false` khi chỉ kiểm WPT; bật riêng nếu cần demo VNDB |
| `RPC_EVM` | Worker → Settings → Variables, dạng **Secret** | RPC Sepolia có API key; mở chain Sepolia phía server, không đưa endpoint bí mật vào bundle |
| `SERVER_SIGNER_PRIVATE_KEY_EVM` | Worker → Settings → Variables, dạng **Secret** | Cùng ví deployer của bộ SC-02 trên Sepolia, có `MINTER_ROLE` và `AGENT_ROLE` |
| `NEXT_PUBLIC_RPC_EVM` | **Build variables**, tùy chọn | RPC công khai cho ví trình duyệt; không chứa API key bí mật |
| `SERVER_SIGNER_PRIVATE_KEY*` | Worker → Settings → Variables, dạng **Secret** | không được để lộ dạng plain text |

OP-04 dùng bộ địa chỉ Sepolia trong `packages/shared/src/addresses.json` đã commit trên nhánh
triển khai. Xóa các `NEXT_PUBLIC_ADDR_EVM_*` cũ vì env ghi đè tệp; build lại sau khi địa chỉ đổi.
Không cần filesystem runtime để đọc địa chỉ: JSON đã được import vào bản build.
Không đặt `FUNDER_PRIVATE_KEY` hay `PRIVATE_KEY` trên Worker. Các bước cấp phí, deploy,
whitelist và lập–duyệt: [runbook Sepolia](TESTNET_SEPOLIA.md).

Kiểm sau Workers Builds bằng `scripts/smoke-test.mjs` với `--chain=evm` và SHA đang deploy;
script chỉ GET metadata WPT/tổng cung qua adapter, không gửi giao dịch. Bộ chọn Sepolia cần
`RPC_EVM` lúc chạy; `NEXT_PUBLIC_RPC_EVM` chỉ cần khi cấu hình RPC cho ví trình duyệt.

### Cơ sở dữ liệu bền qua Hyperdrive (OP-06)

Worker ưu tiên `env.HYPERDRIVE.connectionString`; `DATABASE_URL` chỉ là đường lùi cho Node/Docker.
Không đặt chuỗi kết nối Neon vào Worker Variables. `app/wrangler.json` chỉ chứa ID Hyperdrive công
khai và `localConnectionString` trỏ PostgreSQL local. Mã dùng `pg` thuần, một `Client` trong mỗi lời
gọi/transaction; không dùng SDK hay tính năng riêng của nhà cung cấp.

Yêu cầu tối thiểu cho mọi nhà cung cấp: PostgreSQL **13+**, TLS, tài khoản có `CONNECT, CREATE` trên
database và `USAGE, CREATE` trên schema `public` ở lần chạy đầu. Role nên sở hữu schema và các object
do ứng dụng tạo vì bước nâng lược đồ có `ALTER TABLE`. Lược đồ và seed tự áp. Hyperdrive trên Workers
Free giới hạn **100.000 câu lệnh/ngày**;
mỗi `SELECT`, `INSERT`, `UPDATE`, `DELETE` và DDL đều được tính. Nguồn:
[Cloudflare pricing](https://developers.cloudflare.com/hyperdrive/platform/pricing/).

#### Neon — cấu hình hiện dùng

1. Neon → project → **Roles** → tạo role riêng (ví dụ `rwa-user`), lưu mật khẩu một lần.
2. Bằng role chủ sở hữu, cấp quyền cho role ứng dụng (đổi tên database/role cho đúng):

   ```sql
   GRANT CONNECT, CREATE ON DATABASE "rwa-bid" TO "rwa-user";
   GRANT USAGE, CREATE ON SCHEMA public TO "rwa-user";
   ALTER SCHEMA public OWNER TO "rwa-user";
   ```

   Nếu database đã có object do role khác sở hữu, kiểm/chuyển ownership có chủ đích; chỉ `GRANT`
   không cho phép `ALTER TABLE` trên object của role khác.
3. Connection Details: chọn đúng branch/database/role và lấy **Direct connection**, không chọn
   chuỗi pooled. Chuỗi này là secret, chỉ dán vào Cloudflare.
4. Cloudflare → Storage & Databases → Hyperdrive → Create configuration → dán chuỗi kết nối.
5. Sao chép ID cấu hình (không phải secret) vào `app/wrangler.json` → `hyperdrive[0].id`.
6. Xác nhận bằng `cd app && npx wrangler hyperdrive get <ID>`: `origin.host` không được chứa
   `-pooler`. Tuyệt đối không ghi chuỗi kết nối vào commit, log hay tài liệu.

Repo hiện dùng ID `bf7828b9f4bb42de9f65123d0f00e4a3`. Hướng dẫn role/driver `pg >= 8.16.3`:
[Cloudflare + Neon](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/neon/).

#### Supabase — theo tài liệu, chưa đo trên dự án này

Dùng **Direct connection**; chính Hyperdrive thực hiện pooling. Cloudflare hiện khuyến cáo không dùng
chuỗi pooled của Supabase cho Hyperdrive. Nếu Direct connection chỉ có IPv6 mà hạ tầng không tới
được, dùng shared pooler **session mode** cổng 5432 như phương án tương thích IPv4, rồi kiểm kết nối
trước khi thay ID. Nguồn chính:
[Cloudflare + Supabase](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/supabase/) và
[các chế độ kết nối Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).

#### PostgreSQL tự dựng — theo tài liệu, local đã đo

Postgres có thể mở endpoint TLS công khai và allow-list dải IP Hyperdrive. Với cơ sở dữ liệu trong
mạng riêng, cách hiện được Cloudflare khuyến nghị là Workers VPC + Cloudflare Tunnel; `cloudflared`
chạy trong mạng có thể tới DB. Cách Tunnel + Access cũ vẫn được hỗ trợ. Nguồn:
[Workers VPC](https://developers.cloudflare.com/hyperdrive/configuration/connect-to-private-database-vpc/) và
[Tunnel + Access](https://developers.cloudflare.com/hyperdrive/configuration/connect-to-private-database/).

Worker local đã chạy thật với Postgres 16 thường qua `localConnectionString`: lập yêu cầu bằng
Giao dịch viên, duyệt bằng Kiểm soát viên, tắt hẳn Wrangler, bật lại và đọc được cùng mã yêu cầu.

#### Đổi nhà cung cấp và chuyển dữ liệu

Tạo/cập nhật Hyperdrive trỏ tới DB mới rồi thay ID trong `wrangler.json`; không sửa mã ứng dụng.
DB mới trống sẽ tự có lược đồ/seed, và mốc phát hành được đối soát từ chuỗi. Lịch sử cũ không tự
chuyển; dùng công cụ chuẩn PostgreSQL (đặt URL trong shell cục bộ, không commit):

```bash
pg_dump --format=custom --no-owner --no-acl "$OLD_DATABASE_URL" --file=bidv-rwa.dump
pg_restore --clean --if-exists --no-owner --no-acl --dbname="$NEW_DATABASE_URL" bidv-rwa.dump
```

#### Kết quả V3

Đã đo ngày 09/10/2026 bằng Worker tạm `bidv-op06-v3-probe-20261009`, không chạm Worker chính:
lần deploy đầu có `OP06_PROBE=1` thì endpoint trả `{"probe":"1"}`; bỏ biến khỏi `wrangler.json`
và deploy lần hai thì trả `{"probe":null}`. Worker probe đã được xoá sau phép đo. Kết luận: biến
plain có ở deployment/dashboard trước **không tự được giữ** khi cấu hình deploy kế tiếp không khai
nó. Vì vậy biến không bí mật phải nằm trong `wrangler.json`; biến/secret do Owner đặt trên Dashboard
được bảo vệ bằng top-level `keep_vars=true`. Mọi cảnh báo deploy nói cấu hình local sẽ xóa RPC/signer
là lỗi chặn phát hành, không bấm tiếp.

Bản PoC mặc định `DEMO_ROLE=TELLER` và `ENABLE_DEMO_PAYMENT_MINT=true`, nên trình duyệt sạch mở
thẳng khu vực Vận hành và chạy được luồng nạp VNDB. Trước khi dùng cùng codebase ở production,
**bắt buộc** đặt `ENABLE_DEMO_PAYMENT_MINT=false` và `ENABLE_DEMO_TOKEN_MINT=false`; vai thật sẽ do
AU-01/session xác thực thay cho `DEMO_ROLE`.

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
