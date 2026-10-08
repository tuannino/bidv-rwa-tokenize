# OP-06: Lưu dữ liệu bền trên bản deploy Cloudflare (Postgres qua Hyperdrive)

| | |
|---|---|
| Nhánh | `ops/06-cloudflare-db`, từ `dev` @ `182b9b1` (OP-04 đã merge qua PR #43, #44) |
| Điểm | 5 |
| Mức kiểm chứng | **Cao** (đổi lớp kết nối dùng chung cho 8 cổng lưu trữ, đổi một chốt chặn của luồng phát hành) |
| Thứ tự | Đợt 5, làm ngay. Gánh luôn **nợ điều kiện 6 của OP-04** (kiểm lập duyệt trên bản deploy) |
| Người làm | Claude Code hoặc Codex. Chủ dự án tạo cơ sở dữ liệu, cấu hình Hyperdrive, đặt secret |

## Mục tiêu

Chủ dự án báo ngày 08/10: trên bản deploy Cloudflare, cứ thoát ra vào lại là mất lịch sử thử. Nguyên
nhân không nằm ở trình duyệt: với `USE_MOCK_DB=true`, dữ liệu nghiệp vụ nằm trong bộ nhớ của Worker và
mất khi Cloudflare thu hồi hoặc đổi tiến trình. Đây cũng là lý do lập duyệt hỏng khi người lập và người
duyệt rơi vào hai tiến trình khác nhau.

Sau task này: bản deploy dùng Postgres thật, lập yêu cầu Mint ở một lượt, duyệt ở lượt khác, đóng trình
duyệt mở lại vẫn còn lịch sử; luồng Mint, Mint, Burn chạy trên Sepolia từ bản deploy.

## Nguồn yêu cầu

- Chủ dự án ngày 08/10: bật lưu cơ sở dữ liệu; nợ kiểm Cloudflare của OP-04 dồn sang task này.
- Tài liệu Cloudflare (Supervisor đọc 08/10):
  - "Do not create database clients or connection pools in the global scope" và "You should always
    create database clients inside your request handlers": client tạo ở phạm vi toàn cục bị cũ và
    truy vấn sau đó ném lỗi, vì Worker không cho dùng I/O xuyên request.
  - Hyperdrive là cách được khuyến nghị, có trong gói Workers Free, giới hạn **100.000 truy vấn mỗi
    ngày**, cần `pg` từ 8.16.3 (repo đang dùng đúng 8.16.3).

## Hiện trạng đã đo (Supervisor, `dev` @ `182b9b1`)

```bash
grep -n "new Pool\|GLOBAL_KEY\|readFile\|process.cwd" app/src/lib/store/postgres.pool.ts
# Pool dat o globalThis, dung chung moi request; ensureSchema doc prisma/init.sql bang node:fs
grep -n "USE_MOCK_DB\|ENABLE_SEPOLIA" app/wrangler.json
# "USE_MOCK_DB": "true" dat cung trong vars; KHONG co ENABLE_SEPOLIA_DEMO_PROJECT
grep -rn "getCloudflareContext" app/src || echo "chua dung binding Cloudflare nao"
grep -n "minted && project.issuedAt === null" -A6 app/src/lib/bank/issuance.service.ts
grep -n "ON CONFLICT (\"tokenSymbol\",\"chain\") DO NOTHING" app/src/lib/store/postgres.pool.ts
grep -n "memoryState\|globalThis" app/src/lib/ledger/mock.adapter.ts | head -3
```

Bốn vướng đã thấy:

| # | Vướng | Hậu quả trên Worker |
|---|---|---|
| V1 | `Pool` ở `globalThis`, dùng chung mọi request | Truy vấn ở request thứ hai trở đi có thể ném lỗi hoặc treo |
| V2 | `ensureSchema` đọc `prisma/init.sql` bằng `node:fs` | Worker không có tệp đó lúc chạy; có thể lỗi ngay ở truy vấn đầu |
| V3 | `wrangler.json` đặt cứng `USE_MOCK_DB=true`, thiếu `ENABLE_SEPOLIA_DEMO_PROJECT` | Workers Builds dựng từ tệp này; biến đặt tay trên dashboard có thể bị đè hoặc mất khi deploy (cần đo) |
| V4 | **Chốt "chuỗi đã phát hành mà bảng dự án chưa ghi mốc"** trong `executeIssuance` | Bộ Sepolia OP-04 đã `initialSupplyMinted = true`. Mọi cơ sở dữ liệu mới (Postgres mới, hay bộ nhớ sau khi khởi động lại) có dự án `issuedAt = null`, nên **mọi lần duyệt Mint từ nay đều bị chặn `ORDER_STATE`**, cả ở máy cục bộ lẫn Cloudflare. Checkpoint OP-04 chưa nêu điểm này |

Thêm một giới hạn **không** sửa ở task này: chain `mock` giữ số dư trong bộ nhớ (`mock.adapter.ts`).
Khi dữ liệu nghiệp vụ đã bền mà số dư `mock` vẫn mất theo tiến trình, hai bên sẽ lệch. Ghi rõ trong
runbook: thử trên bản deploy dùng chain `evm` (Sepolia).

## Quyết định thiết kế

**QĐ-1. Một đường kết nối duy nhất: mỗi lời gọi một `Client`.** `pgQuery` mở `Client`, truy vấn, đóng.
`pgTransaction` mở một `Client` cho cả transaction rồi đóng. Không còn `Pool` ở phạm vi toàn cục, kể cả
khi chạy Node (docker, kiểm thử), để không có hai đường hành xử khác nhau. Với Hyperdrive, mở `Client`
rẻ vì Hyperdrive giữ pool phía sau. Người làm đo thời gian bộ 186 ca ràng buộc Postgres trước và sau,
ghi vào checkpoint; chậm hơn **quá 2 lần** thì dừng lại hỏi Supervisor, không tự thêm đường thứ hai.

**QĐ-2. Chuỗi kết nối:** nếu có binding `HYPERDRIVE` (đọc qua `getCloudflareContext` của
`@opennextjs/cloudflare`, bọc try/catch vì ngoài Worker hàm này ném lỗi) thì dùng
`env.HYPERDRIVE.connectionString`; nếu không thì `DATABASE_URL`. Thiếu cả hai mà `USE_MOCK_DB=false`
thì báo lỗi nêu đủ hai cách sửa.

**QĐ-3. Lược đồ nhúng vào mã lúc build, không đọc tệp lúc chạy.** Thêm tệp sinh
`app/src/lib/store/init-sql.generated.ts` (xuất một chuỗi), sinh từ `prisma/init.sql` bằng script.
`npm run db:sql` sinh cả hai. Kiểm thử bắt buộc: chuỗi trong tệp sinh **trùng từng byte** với
`prisma/init.sql`, để không có hai nguồn lược đồ trôi dạt. `ensureSchema` giữ nguyên logic (khoá tư vấn,
savepoint, seed), chạy một lần mỗi tiến trình; lời hứa lỗi thì xoá để lần sau thử lại, không giữ lời hứa
hỏng mãi.

**QĐ-4. `wrangler.json` là nguồn duy nhất cho biến không bí mật của bản deploy.** Đổi
`USE_MOCK_DB` thành `"false"`, thêm `ENABLE_SEPOLIA_DEMO_PROJECT: "true"`, thêm khối `hyperdrive` với
`binding: "HYPERDRIVE"` và `id` do chủ dự án tạo (id không phải bí mật; chuỗi kết nối nằm trong cấu
hình Hyperdrive, không nằm trong repo). `localConnectionString` trỏ tới Postgres cục bộ để chạy thử
bằng `wrangler`. Chuỗi kết nối Neon và khoá ký vẫn là **Secret** đặt trên dashboard.

**QĐ-5. Đối soát mốc phát hành từ chuỗi (sửa V4).** Khi `executeIssuance` thấy chuỗi đã phát hành mà
`issuedAt` còn rỗng: ghi mốc bằng `markIssued` (khoá lạc quan như cũ), ghi một dòng sổ kiểm toán
`outcome: 'SUCCESS'`, `action: 'token:mint'`, nội dung nói rõ "đối soát mốc phát hành từ chuỗi, không
phát hành thêm", rồi **đi tiếp đường `mint`** của chính lần duyệt đó. Lý do: chuỗi là nguồn sự thật cuối
cùng (đúng như chú thích hiện có); chặn mãi thì không ai gỡ được vì không có màn đối soát. `markIssued`
trả rỗng (lời gọi khác đã ghi) thì đọc lại dự án và đi tiếp nếu mốc đã có; chỉ trả lỗi khi đọc lại vẫn
rỗng. Ca kiểm thử cũ khẳng định "trả `ORDER_STATE`" phải **sửa** theo hành vi mới, ghi rõ trong checkpoint
là đổi có chủ ý theo spec này.

**QĐ-6. Seed dự án cập nhật địa chỉ hợp đồng khi dự án chưa phát hành.** `ON CONFLICT ... DO NOTHING`
đổi thành cập nhật `contractAddress` **chỉ khi** dòng hiện có `issuedAt IS NULL` và địa chỉ khác. Dự án
đã phát hành thì không đụng. Lý do: OP-05 sẽ triển khai lại Sepolia; không sửa thì cơ sở dữ liệu giữ địa
chỉ cũ mãi.

**QĐ-7. Không gắn với nhà cung cấp nào (chủ dự án yêu cầu 08/10).** Chủ dự án dùng Neon trước, nhưng
phải đổi được sang Supabase hoặc Postgres tự dựng **mà không sửa mã**. Cách giữ:
- Mã chỉ biết "một chuỗi kết nối Postgres" (QĐ-2). Không dùng SDK riêng của nhà cung cấp
  (`@neondatabase/serverless`, `@supabase/supabase-js`...), không dùng tính năng riêng (nhánh Neon,
  Row Level Security, API REST của Supabase). Kiểm bằng lệnh ở `tasks.md` Bước 5.
- Yêu cầu tối thiểu với cơ sở dữ liệu ghi rõ trong runbook: Postgres **13 trở lên** (lược đồ và seed
  dùng `gen_random_uuid()` có sẵn từ bản 13), người dùng kết nối có quyền tạo bảng (lần chạy đầu tự áp
  lược đồ), kết nối TLS.
- Đổi nhà cung cấp = sửa cấu hình Hyperdrive trên dashboard (hoặc tạo cấu hình mới rồi thay `id` trong
  `wrangler.json`). Cơ sở dữ liệu mới bắt đầu trống: lược đồ và seed tự áp, mốc phát hành tự đối soát
  từ chuỗi nhờ QĐ-5; lịch sử lệnh cũ **không** tự chuyển, muốn giữ thì chủ dự án tự `pg_dump` /
  `pg_restore` (runbook có lệnh mẫu).
- Runbook có ba công thức: **Neon**; **Supabase** (dùng chuỗi kết nối trực tiếp hoặc pooler chế độ phiên
  cho Hyperdrive, người làm kiểm lại khuyến nghị hiện hành trong tài liệu Hyperdrive và ghi nguồn);
  **Postgres tự dựng** (cổng công khai có TLS, hoặc máy trong mạng riêng nối qua Cloudflare Tunnel theo
  tài liệu Hyperdrive "Connect to a private database using Tunnel"). Công thức nào chưa chạy thật thì ghi
  rõ "theo tài liệu, chưa đo".
- Bằng chứng tính khả chuyển: Worker cục bộ ở việc 6 đã chạy với Postgres thường (tự dựng), bản deploy ở
  việc 9 chạy với Neon. Hai nơi khác nhau, cùng một mã.

## Việc cần làm

1. **Kết nối** theo QĐ-1, QĐ-2 trong `postgres.pool.ts`. Giữ chữ ký `pgQuery`, `pgTransaction` để 8 cổng
   Postgres không phải sửa.
2. **Lược đồ** theo QĐ-3: script sinh, tệp sinh, sửa `db:sql`, kiểm thử trùng byte, bỏ `node:fs` khỏi
   `postgres.pool.ts`.
3. **Đối soát mốc** theo QĐ-5 trong `issuance.service.ts`, kèm kiểm thử: (a) chuỗi đã phát hành, bảng
   chưa có mốc: duyệt Mint chạy được, gọi `mint` không gọi `mintInitialSupply`, có dòng kiểm toán đối
   soát; (b) chạy lại lần hai không ghi dòng đối soát nữa; (c) hành vi cũ khi chuỗi chưa phát hành không
   đổi. Chạy trên `mock` và trên `hardhat-local` (khung OP-03).
4. **Seed** theo QĐ-6, kiểm thử trên Postgres thật.
5. **Cấu hình** theo QĐ-4: `wrangler.json`, `.env.example`, `docker-compose.yml` nếu cần.
6. **Chạy thử Worker cục bộ**: `npm run cf:build` rồi chạy bản Worker bằng `wrangler dev` (hoặc
   `opennextjs-cloudflare preview`) với `localConnectionString` trỏ Postgres cục bộ. Đo: (a) lập yêu cầu
   Mint ở request 1, duyệt ở request 2 bằng vai khác; (b) tắt hẳn tiến trình Worker, bật lại, lịch sử
   còn nguyên; (c) không có lỗi I/O xuyên request trong log. Chain dùng `hardhat-local` để không tốn phí.
7. **Đo V3**: một biến đặt trên dashboard mà không có trong `wrangler.json` thì sau lần deploy kế tiếp
   còn hay mất (xem tab Variables trước và sau). Ghi kết quả vào runbook; quyết định cuối vẫn là QĐ-4.
8. **[Chủ dự án] Hạ tầng**: tạo Postgres miễn phí (Neon khuyến nghị, chọn vùng gần Singapore), tạo cấu
   hình Hyperdrive trỏ tới nó, gửi lại **id** Hyperdrive (không gửi chuỗi kết nối). Người làm điền id vào
   `wrangler.json`.
9. **[Chủ dự án] Kiểm trên bản deploy sau merge** (nợ OP-04 điều kiện 6): `smoke-test.mjs --chain=evm`
   xanh; trên Sepolia lập và duyệt một Mint, một Burn, bằng hai lượt trình duyệt khác nhau, đóng trình
   duyệt mở lại thấy lịch sử; ghi mã giao dịch và đường Etherscan. Phí theo quy tắc tài khoản tổng.
10. **Tài liệu**: `docs/DEPLOYMENT.md` (mục cơ sở dữ liệu viết lại: Hyperdrive, hạn 100.000 truy vấn
    mỗi ngày, yêu cầu tối thiểu và ba công thức theo QĐ-7, cách đổi nhà cung cấp, lệnh mẫu chuyển dữ liệu), `docs/TESTNET_SEPOLIA.md` (bỏ câu "không khởi động lại giữa ba giao dịch",
    thêm giới hạn chain `mock`), `docs/tech-report.md` (nợ "dữ liệu theo isolate" chuyển đóng).
11. **Trạng thái**: commit đầu chuyển `OP-04` sang `done` (chủ dự án nghiệm thu 08/10, nợ điều kiện 6
    chuyển sang task này) và `OP-06` sang `inProgress`; thêm `OP-06` nếu chưa có trong tệp.

12. **Đổi tên danh sách nhà máy điện gió** (chủ dự án yêu cầu 08/10, việc nhỏ đi kèm, không tính
    thêm điểm). Giữ nguyên mọi số liệu mẫu (công suất, số tua bin, sản lượng...), chỉ đổi:

    | Dòng cũ trong `MOCK_PROJECTS` | Tên mới | Vị trí | Mã | Ký hiệu token | Vùng |
    |---|---|---|---|---|---|
    | Điện gió Bạc Liêu 1 (đã lên chuỗi) | Điện gió An Viên | An Viên | `WIND-AVN-01` | `WPT` (giữ) | giữ `NEARSHORE` |
    | Điện gió Hướng Linh 3, Quảng Trị | Điện gió Phú Quý | Phú Quý (Bình Thuận) | `WIND-PQY-02` | `WPT-PQY` | `ONSHORE_COASTAL` |
    | Điện gió Ninh Thuận 7 | Điện gió Ninh Thuận | Ninh Thuận | `WIND-NTH-03` | `WPT-NTH` | giữ `ONSHORE_COASTAL` |

    Đổi theo: `SEED_PROJECT_NAME` thành `Dự án điện gió An Viên` (`seed-data.ts`); tên pháp nhân
    `Công ty Cổ phần Điện gió Bạc Liêu` thành `Công ty Cổ phần Điện gió An Viên`
    (`account-profile.service.ts`); kiểm thử và e2e đang khớp chữ cũ (`account-info.test.ts`,
    `e2e/account-info.spec.ts`, `e2e/investor-channel.spec.ts` có `WPT-QTR3`). Tìm hết bằng:

    ```bash
    grep -rnE "Bạc Liêu|Hướng Linh|Quảng Trị|Ninh Thuận 7|WIND-(BLI|QTR|NTH)|WPT-(QTR3|NTH7)" app/src app/test app/e2e docs/SPEC.md docs/guide.md
    ```

    Sau khi sửa, lệnh trên chỉ còn được trả về dòng gợi ý vùng trong `assets.tsx` (`REGION_HINTS`, mô tả
    vùng địa lý chung, giữ nguyên). Postgres đã có dòng dự án cũ thì tên **không** tự đổi (seed không ghi
    đè); cơ sở dữ liệu Neon mới thì đúng tên mới.

## Ràng buộc

- Không commit chuỗi kết nối, mật khẩu, khoá. `wrangler.json` chỉ chứa id Hyperdrive và
  `localConnectionString` trỏ `localhost`.
- Không đổi lược đồ (`schema.prisma`), không thêm ORM, không đổi chữ ký 8 cổng lưu trữ.
- Không sửa chain `mock` để lưu bền.
- Checkpoint dán nguyên văn đầu ra lệnh đã chạy (luật `efficiency.md`).

## Tác động

| | Tệp |
|---|---|
| Sửa | `app/src/lib/mock-data.ts`, `app/src/lib/store/seed-data.ts`, `app/src/lib/bank/account-profile.service.ts`, kiểm thử và e2e khớp tên cũ (việc 12), `app/src/lib/store/postgres.pool.ts`, `app/src/lib/bank/issuance.service.ts`, `app/wrangler.json`, `app/package.json` (`db:sql`), `.env.example`, `docs/DEPLOYMENT.md`, `docs/TESTNET_SEPOLIA.md`, `docs/tech-report.md`, `.kiro/task-status.json`, kiểm thử phát hành hiện có (ca chốt cũ) |
| Mới | `app/src/lib/store/init-sql.generated.ts`, script sinh, kiểm thử trùng byte, kiểm thử đối soát mốc, kiểm thử seed |
| Không đụng | hợp đồng, `ILedgerPort`, `ISigner`, 8 tệp `postgres.*.store.ts` (trừ khi bắt buộc, phải nêu lý do) |

## Mức kiểm chứng: Cao

| Ca | Kiểm |
|---|---|
| 1 | Bộ ràng buộc Postgres (`TEST_DATABASE_URL`) xanh đủ 186 ca trở lên, kèm thời gian trước và sau |
| 2 | Kiểm thử trùng byte giữa tệp sinh và `prisma/init.sql`; đột biến: sửa một ký tự trong `init.sql` thì ca đỏ |
| 3 | Đối soát mốc: ba ca (a), (b), (c) ở việc 3; đột biến: khôi phục chốt cũ thì ca (a) đỏ |
| 4 | Seed: dự án chưa phát hành được cập nhật địa chỉ; dự án đã phát hành giữ nguyên |
| 5 | Worker cục bộ: (a), (b), (c) ở việc 6, có log nguyên văn |
| 6 | Bản deploy: smoke `--chain=evm` xanh; Mint và Burn Sepolia lập duyệt qua hai lượt trình duyệt, có Etherscan; lịch sử còn sau khi mở lại |
| 7 | Bộ mặc định `run-local-all.sh` xanh; không có bí mật trong lịch sử commit |
| 8 | Không có SDK hay tính năng riêng của nhà cung cấp trong `app/` (lệnh ở `tasks.md` Bước 5) |

## Điều kiện hoàn thành

- [ ] Không còn `Pool` toàn cục và không còn `node:fs` trong `postgres.pool.ts`; chuỗi kết nối theo QĐ-2.
- [ ] Lược đồ nhúng theo QĐ-3, có kiểm thử trùng byte và đột biến.
- [ ] Đối soát mốc phát hành theo QĐ-5, ba ca kiểm thử, đột biến đỏ đúng ca.
- [ ] Seed cập nhật địa chỉ theo QĐ-6, kiểm trên Postgres thật.
- [ ] `wrangler.json` theo QĐ-4, có id Hyperdrive do chủ dự án cấp.
- [ ] Worker cục bộ: lập duyệt qua hai request, giữ dữ liệu sau khởi động lại, không lỗi I/O xuyên request.
- [ ] Bản deploy: smoke `--chain=evm` xanh, Mint và Burn Sepolia lập duyệt có Etherscan, lịch sử bền (đóng nợ OP-04 điều kiện 6).
- [ ] Runbook `DEPLOYMENT.md`, `TESTNET_SEPOLIA.md` đúng hiện trạng, có kết quả đo V3, giới hạn chain `mock`, yêu cầu tối thiểu với cơ sở dữ liệu và ba công thức Neon, Supabase, tự dựng (QĐ-7); mã không dùng SDK hay tính năng riêng của nhà cung cấp.
- [ ] Danh sách nhà máy đổi theo việc 12; lệnh tìm chữ cũ chỉ còn dòng gợi ý vùng.
- [ ] Bộ mặc định xanh, bộ ràng buộc Postgres xanh, không có bí mật trong lịch sử commit.

## Không làm

- Không lưu bền số dư chain `mock`.
- Không làm màn đối soát cho Kiểm soát viên (QĐ-5 tự đối soát có ghi sổ).
- Không đổi sang Prisma Client hay driver khác `pg`.
- Không xử lý xác thực thật (AU-01); `DEMO_ROLE` giữ nguyên.
