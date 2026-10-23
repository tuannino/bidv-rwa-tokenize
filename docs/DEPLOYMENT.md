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

## Bộ hợp đồng EVM sau SC-09

Bản EVM hiện gồm bảy địa chỉ: `ProjectToken`, `VNDToken`, `ProfitDistributor`, `Redemption`,
`IdentityRegistry`, `ModularCompliance`, `AllowAllModule`. Bốn hợp đồng đầu giữ nguyên thứ tự
triển khai; ba hợp đồng ERC-3643 nối thêm phía sau. Sau khi đổi từ bản trước SC-09:

```bash
bash scripts/evm-local.sh reset
cd packages/contracts-evm
npx hardhat run scripts/verify-deployment.js --network localhost
```

`reset` là bắt buộc vì bytecode hai token đã đổi và nút cũ không được triển khai đè. Script deploy
tự nối `ProjectToken` với registry/compliance, gắn token vào compliance, thêm `AllowAllModule`, rồi
seed các ví mẫu vào `IdentityRegistry` với mã quốc gia Việt Nam 704.

Sepolia trong `addresses.json` vẫn là bộ trước SC-09 cho tới khi chủ dự án chạy lại runbook
[TESTNET_SEPOLIA.md](TESTNET_SEPOLIA.md). Trong khoảng đó, adapter `evm` chủ động dừng trước RPC với
thông báo cần triển khai lại; không lùi về API whitelist cũ. Sau deploy phải commit cả ba địa chỉ
mới và ABI sinh lại, xóa mọi `NEXT_PUBLIC_ADDR_EVM_*` cũ đang ghi đè JSON, rồi build lại app.

Bộ chính giữ OpenZeppelin **5.6.1**, Solidity 0.8.28 và EVM target **Cancun** để dùng ERC-2612
`permit`. Tương thích Hyperledger Besu chưa thuộc SC-09 và chưa được khẳng định; cần task riêng đo
phiên bản Besu hỗ trợ Cancun hoặc chốt phương án compiler/OZ. Không hạ OZ hay coi network `besu`
trong Hardhat config là bằng chứng tương thích.

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
| `ENABLE_READ_DIAGNOSTICS` | Worker runtime variable, nguồn `wrangler.json` | `false`; chỉ bật tạm để điều tra một lượt đọc WPT rồi tắt lại |
| `ENABLE_SEPOLIA_DEMO_PROJECT` | `app/wrangler.json` | `true`: đăng ký WPT Sepolia đã deploy |
| `USE_MOCK_DB` | `app/wrangler.json` | `false`: dữ liệu nghiệp vụ dùng Postgres qua Hyperdrive |
| `ENABLE_DEMO_TOKEN_MINT` | Worker runtime variable | `false`, dùng lập–duyệt |
| `ENABLE_DEMO_PAYMENT_MINT` | `app/wrangler.json` | `true` trên bản PoC testnet (OP-05 CH-6); production bắt buộc `false` |
| `RPC_EVM` | Worker → Settings → Variables, dạng **Secret** | RPC Sepolia có API key; mở chain Sepolia phía server, không đưa endpoint bí mật vào bundle |
| `SERVER_SIGNER_PRIVATE_KEY_EVM` | Worker → Settings → Variables, dạng **Secret** | Cùng ví deployer của bộ SC-09 trên Sepolia, có vai token và `IdentityRegistry.AGENT_ROLE` |
| `NEXT_PUBLIC_RPC_EVM` | **Build variables**, tùy chọn | RPC công khai cho ví trình duyệt; không chứa API key bí mật |
| `SERVER_SIGNER_PRIVATE_KEY*` | Worker → Settings → Variables, dạng **Secret** | không được để lộ dạng plain text |
| `KEEPER_SECRET` | Worker, mục Settings, Variables, dạng **Secret** | Ít nhất 32 ký tự. Khoá API keeper (`/api/keeper/*`, Bearer); thiếu hay sai thì API trả 401 cho mọi lời gọi. Đặt cả khi không có lịch gọi (OP-05 QĐ-G) |

Sau khi chủ dự án triển khai SC-09, dùng bộ địa chỉ Sepolia trong
`packages/shared/src/addresses.json` đã commit trên nhánh triển khai. Xóa các
`NEXT_PUBLIC_ADDR_EVM_*` cũ vì env ghi đè tệp; build lại sau khi địa chỉ đổi.
Không cần filesystem runtime để đọc địa chỉ: JSON đã được import vào bản build.
Không đặt `FUNDER_PRIVATE_KEY` hay `PRIVATE_KEY` trên Worker. Các bước cấp phí, deploy,
whitelist và lập–duyệt: [runbook Sepolia](TESTNET_SEPOLIA.md).

Kiểm sau Workers Builds bằng `scripts/smoke-test.mjs` với `--chain=evm` và SHA đang deploy;
script chỉ GET metadata WPT/tổng cung qua adapter, không gửi giao dịch. Bộ chọn Sepolia cần
`RPC_EVM` lúc chạy; `NEXT_PUBLIC_RPC_EVM` chỉ cần khi cấu hình RPC cho ví trình duyệt.

### Cơ sở dữ liệu bền qua Hyperdrive (OP-06)

Worker ưu tiên `env.HYPERDRIVE.connectionString`; `DATABASE_URL` chỉ là đường lùi cho Node/Docker.
Không đặt chuỗi kết nối Neon vào Worker Variables. `app/wrangler.json` chỉ chứa ID Hyperdrive công
khai và `localConnectionString` trỏ PostgreSQL local. Mã dùng `pg` thuần: trên Worker, mọi
`pgQuery` trong cùng một request dùng chung một `Client`; request khác có `Client` khác và
`pgTransaction` luôn dùng kết nối riêng để câu lệnh ngoài transaction không chen vào. Ngoài Worker
(Node/Vitest/Docker), mỗi lời gọi vẫn mở/đóng một `Client` như trước. Không dùng SDK hay tính năng
riêng của nhà cung cấp.

Client Worker được tạo bên trong invocation và khoá theo `getCloudflareContext().ctx`, không đặt ở
global để dùng xuyên request. Không gọi `client.end()` trong request Worker: runtime tự thu hồi edge
connection khi invocation kết thúc, còn Hyperdrive giữ pool origin. Nguồn:
[Cloudflare — Connection lifecycle](https://developers.cloudflare.com/hyperdrive/concepts/connection-lifecycle/).
Đường khởi động lạnh chỉ đọc catalog và kiểm đủ seed; khi cả hai đủ thì không `BEGIN` và không chạy
`INSERT`. Thiếu một trong hai mới mở kết nối riêng, lấy advisory lock rồi chạy DDL/seed như trước.

Workers Free giới hạn **10 ms CPU cho mỗi HTTP request** và trả lỗi 1102 khi vượt tài nguyên
([Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)). Vì vậy
không được đổi lại thành một Client
mỗi query, không bật `ENABLE_READ_DIAGNOSTICS` thường trực và không chạy seed ở mọi cold start.
Nếu bản deploy còn lỗi 1102, Owner đo CPU P50/P90 trong 15 phút với `USE_MOCK_DB=false`; nếu không
tiệm cận mốc mock đã đo ngày 14/10/2026 thì nâng Workers Paid thay vì tiếp tục mở rộng task này.

Yêu cầu tối thiểu cho mọi nhà cung cấp: PostgreSQL **13+**, TLS, tài khoản có `CONNECT, CREATE` trên
database và `USAGE, CREATE` trên schema `public` ở lần chạy đầu. Các object ứng dụng tạo phải thuộc
role ứng dụng vì bước nâng lược đồ có `ALTER TABLE`; không cần chuyển chủ schema `public`.
Lược đồ và seed tự áp. Hyperdrive trên Workers Free giới hạn **100.000 câu lệnh/ngày**;
mỗi `SELECT`, `INSERT`, `UPDATE`, `DELETE` và DDL đều được tính. Nguồn:
[Cloudflare pricing](https://developers.cloudflare.com/hyperdrive/platform/pricing/).

#### Sự cố Indexer: dựng lại cache sự kiện (IN-01)

`ChainEvent` và `IndexerCursor` chỉ là cache có thể dựng lại từ RPC. Chỉ dùng quy trình này khi
phát hiện reorg sâu hơn `INDEXER_CONFIRMATIONS`, scope sai, hoặc dữ liệu cache không khớp chuỗi.
Đây là thao tác production có thể làm lượt đọc đầu chậm và tăng tải RPC: **phải có Sếp quyết định
trước khi chạy**.

1. Xác định đúng `chain`; tạm tránh mở đồng thời các màn đọc lịch sử trên chain đó.
2. Sao lưu hoặc ghi lại số dòng và cursor hiện tại để điều tra.
3. Trong một transaction, xoá cache của đúng chain — không đụng bảng nghiệp vụ:

   ```sql
   BEGIN;
   DELETE FROM "ChainEvent" WHERE "chain" = '<chain>';
   DELETE FROM "IndexerCursor" WHERE "chain" = '<chain>';
   COMMIT;
   ```

4. Mở `/vault` ba lần trên đúng chain. Mỗi lượt đẩy cursor tối đa
   `INDEXER_MAX_BLOCKS_PER_SYNC`; trong lúc chưa bắt kịp, kết quả vẫn đọc đủ trực tiếp từ RPC.
5. Kiểm `IndexerCursor.lastBlock`, lịch sử cấu hình/chốt kỳ và nhật ký lỗi RPC. Không chỉnh tay
   cursor hoặc giữ một phần `ChainEvent`: cả hai bảng phải cùng một scope `(anchor, vault, token)`.

#### Đọc-sau-ghi và cache Hyperdrive (bắt buộc)

Ứng dụng dùng dữ liệu quyền, maker-checker và trạng thái chain mock vừa ghi xong ở request kế tiếp,
nên cấu hình Hyperdrive gắn với binding `HYPERDRIVE` **phải tắt query cache**. Hyperdrive mặc định có
thể giữ `SELECT` 60 giây và phục vụ bản cũ thêm 15 giây; câu ghi không tự xoá kết quả đọc đã cache.
Nguồn: [Cloudflare — Query caching](https://developers.cloudflare.com/hyperdrive/concepts/query-caching/).

```bash
npx wrangler hyperdrive update <HYPERDRIVE_ID> --caching-disabled
npx wrangler hyperdrive get <HYPERDRIVE_ID>
```

Kiểm trên Dashboard hoặc đầu ra lệnh `get` rằng caching ở trạng thái disabled. Owner xác nhận cấu
hình đang dùng đã tắt cache ngày 14/10/2026. Đây là cấu hình ngoài repo; tạo Hyperdrive mới hoặc đổi
ID thì phải kiểm lại, không được suy ra từ ID cũ.

#### Hyperdrive mới cho mỗi thế hệ hợp đồng (OP-05 QĐ-A)

Triển khai lại bộ hợp đồng `evm` thì dùng **database mới trống** và **Hyperdrive mới** trỏ vào nó; database cũ
giữ nguyên làm lịch sử. Lý do: dự án WPT `evm` trên database cũ đã phát hành nên seed không ghi lại địa chỉ
token mới (`Project.contractAddress` chỉ cập nhật khi `issuedAt IS NULL`), và người nhận chia lợi nhuận, lịch
sử lệnh của hai thế hệ hợp đồng sẽ trộn vào nhau.

- Tạo Hyperdrive bằng chuỗi kết nối **trực tiếp** của Neon (bỏ chọn connection pooling): Hyperdrive tự giữ
  pool. Tắt cache ngay khi tạo: `npx wrangler hyperdrive create <tên> --connection-string="<chuỗi>" --caching-disabled`.
- ID mới đi **cùng PR với address book mới** (`addresses.json` khoá `evm` và `packages/shared/generated/*`).
  Không sửa origin của Hyperdrive cũ tại chỗ: Worker cũ đang chạy sẽ seed địa chỉ cũ vào database mới.
- Lùi bằng cách revert PR đó: bản cũ dựng lại với Hyperdrive cũ, database cũ còn nguyên.
- Kiểm chỉ đọc trước và sau: `scripts/op05-db-check.sql` (một transaction `READ ONLY`, chỉ số đếm và định danh).

Các bước tay đầy đủ, kèm "phải thấy gì": [runbook Sepolia](TESTNET_SEPOLIA.md) bước 3, 4, 8, 11.

#### Trạng thái chain mock theo `USE_MOCK_DB` (OP-07)

Một cờ chọn đồng thời kho nghiệp vụ và kho ledger mock; không có chế độ pha trộn:

| `USE_MOCK_DB` | Workflow/Txn | Trạng thái chain mock | Mục đích |
|---|---|---|---|
| `true` | RAM | RAM (`globalThis`) | Local/test; không mở kết nối DB, mất khi restart và không bền qua isolate |
| `false` | PostgreSQL | PostgreSQL, bảng `MockLedgerState` | Worker/Neon; bền qua restart và dùng chung giữa các isolate |

`MockLedgerState` giữ một dòng JSONB cho mỗi chain; mọi ghi dùng transaction và
`SELECT ... FOR UPDATE`. `Txn` chỉ là lịch sử/audit, không dùng để dựng lại ledger. Lỗi PostgreSQL
được trả rõ ràng và **không** tự fallback sang RAM. Chain thật (`evm`, `hardhat-local`, `stellar`)
vẫn lấy state từ chain, không đọc bảng này.

#### Làm mới Neon sau khi triển khai OP-07

Chỉ Owner thực hiện sau khi OP-07 đã merge/deploy. Thao tác dưới đây **xoá toàn bộ dữ liệu trong
schema `public`**, gồm lịch sử mock và EVM; trạng thái Sepolia on-chain không bị xoá.

1. Xác nhận query cache của Hyperdrive đã tắt như mục trên.
2. Neon Console → đúng project/branch/database → SQL Editor, đăng nhập bằng database owner và chạy:

   ```sql
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   GRANT ALL ON SCHEMA public TO "<role ứng dụng>";
   GRANT USAGE ON SCHEMA public TO PUBLIC;
   ```

   Thay `"<role ứng dụng>"` bằng role trong chuỗi kết nối Hyperdrive (ví dụ `"rwa-user"`).
   Cấp lại quyền sau `CREATE SCHEMA`: quyền trên schema đã xóa không tự chuyển sang schema mới.
   **Không dùng `ALTER SCHEMA ... OWNER`**: Neon có thể báo `must be able to SET ROLE` khi role
   quản trị không được chuyển sang role ứng dụng. Hai lệnh `GRANT` ở trên không đổi chủ schema;
   ứng dụng kết nối bằng role riêng sẽ sở hữu các bảng/index do chính nó tạo.

3. Mở web đúng một lần. Request đầu tiên tự tạo lại toàn bộ bảng, gồm `MockLedgerState`, và seed dữ
   liệu nền. Lượt đầu có thể chậm hơn vì chạy DDL.
4. Kiểm trong Neon:

   ```sql
   SELECT to_regclass('public."MockLedgerState"');
   SELECT count(*) FROM "Project";
   SELECT count(*) FROM "Role";
   SELECT count(*) FROM "SystemConfig";
   ```

5. Trên bản deploy chọn chain Mock: trình duyệt A whitelist và lập Mint; đóng A, mở trình duyệt B
   bằng vai KSV và duyệt cùng request. Sau đó ghi ở A và đọc ngay ở B để xác nhận read-after-write.
   Ghi request ID vào checkpoint nghiệm thu.

Phương án thay thế an toàn hơn khi cần giữ khả năng quay lại: tạo Neon branch/database mới, trỏ
Hyperdrive sang đó rồi deploy ID mới. Không replay `Txn` sang `MockLedgerState`. Sau reset, dự án
Sepolia trở về `DRAFT`; lần duyệt Mint kế tiếp tự đối soát mốc phát hành từ chain, còn số dư và tổng
cung trên Sepolia giữ nguyên.

#### Neon — cấu hình hiện dùng

1. Neon → project → **Roles** → tạo role riêng (ví dụ `rwa-user`), lưu mật khẩu một lần.
2. Bằng role chủ sở hữu, cấp quyền cho role ứng dụng (đổi tên database/role cho đúng):

   ```sql
   GRANT CONNECT, CREATE ON DATABASE "rwa-bid" TO "rwa-user";
   GRANT ALL ON SCHEMA public TO "rwa-user";
   GRANT USAGE ON SCHEMA public TO PUBLIC;
   ```

   Không dùng `ALTER SCHEMA ... OWNER`: Neon có thể báo `must be able to SET ROLE`. Nếu database
   đã có object do role khác sở hữu, kiểm đúng chủ sở hữu; chỉ `GRANT` trên schema không cho phép
   `ALTER TABLE` trên object của role khác. Runbook làm mới ở trên tạo lại bảng bằng role ứng dụng.
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
