# Báo cáo bàn giao — OP-06: dữ liệu bền trên Cloudflare qua Hyperdrive

| | |
|---|---|
| Mã task | OP-06 |
| Nhánh | `ops/06-cloudflare-db`, từ `dev` @ `182b9b1` |
| Spec | `docs/op-06-cloudflare-db/{requirements,tasks}.md` |
| Mức kiểm chứng | Cao |
| Tiến độ | Bổ sung sửa timeout GET/trace đã kiểm local; cần deploy lại và nghiệm thu Mint/Burn bền |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện | Trạng thái | Bằng chứng |
|---|---|---|---|
| 1 | Không Pool/fs runtime; Hyperdrive trước, DATABASE_URL sau | ✅ | mục 2.1 |
| 2 | SQL nhúng trùng byte và đột biến đỏ | ✅ | mục 2.2 |
| 3 | Tự đối soát mốc phát hành, ba ca và đột biến | ✅ | mục 2.3 |
| 4 | Seed cập nhật địa chỉ đúng QĐ-6 trên Postgres thật | ✅ | mục 2.4 |
| 5 | `wrangler.json` có cấu hình và ID Hyperdrive thật | ✅ | mục 3.1 |
| 6 | Worker local lập–duyệt bền qua restart, không lỗi I/O | ✅ | mục 3.2 |
| 7 | Bản deploy Neon + Sepolia có smoke/Mint/Burn/lịch sử bền | 🔶 | mục 4, 6 |
| 8 | Runbook đủ ba nhà cung cấp, V3, giới hạn mock/DB | ✅ | mục 3.3 |
| 9 | Danh sách nhà máy đổi đúng, số liệu giữ nguyên | ✅ | mục 3.4 |
| 10 | Bộ mặc định/Postgres xanh, không lộ bí mật | ✅ | mục 5, 6 |

**Kết luận:** 9 ✅ · 1 🔶 · 0 ❌. Giữ OP-06 ở `inProgress` đến kiểm sau merge.

### 0.2 Việc Owner chạy sau merge

- Workers Builds dựng từ `dev`; đặt `RPC_EVM` và `SERVER_SIGNER_PRIVATE_KEY_EVM` dạng Secret.
- Chạy `smoke-test.mjs --chain=evm`; lập–duyệt một Mint, một Burn ở hai lượt trình duyệt, mở lại
  thấy lịch sử; gửi ID yêu cầu, tx hash/Etherscan và output không chứa secret để cập nhật mục 4.

---

## 1. Phạm vi và quyết định

- Binding Hyperdrive là nguồn kết nối Worker; `DATABASE_URL` chỉ dùng Node/Docker.
- Mỗi `pgQuery` mở/đóng một `Client`; mỗi transaction dùng một `Client`; không giữ I/O toàn cục.
- SQL sinh từ Prisma được nhúng lúc build, không đọc filesystem runtime.
- Chuỗi là nguồn sự thật cuối: chuỗi đã phát hành nhưng DB chưa có mốc thì ghi bù audit/mốc và
  tiếp tục `mint`, không gọi lại `mintInitialSupply` và không chặn vĩnh viễn.
- Seed chỉ đổi `contractAddress` khi `issuedAt IS NULL`.
- Không thêm SDK Neon/Supabase; đổi nhà cung cấp chỉ đổi Hyperdrive.

Sai khác hiệu năng đã báo Owner: bộ Postgres sạch trước sửa mất **1,04 s** (tests 316 ms), sau sửa
mất **2,33 s** (tests 1,22 s), tỷ lệ **2,24×**, vượt ngưỡng 2×. Owner chấp nhận ngày 09/10/2026 và
yêu cầu giữ con số trong tài liệu. Không tạo đường Pool riêng để che độ chậm.

## 2. Bằng chứng mã và kiểm thử

### 2.1 Kết nối

`postgres.pool.ts` không còn `Pool`, `node:fs`, `readFile` hay `process.cwd`. Binding được đọc qua
`getCloudflareContext()` trong request; thiếu binding thì dùng `DATABASE_URL`; thiếu cả hai báo rõ
hai cách sửa. Tám store giữ nguyên chữ ký `pgQuery`/`pgTransaction`.

### 2.2 SQL nhúng và đột biến

Ca `init-sql-generated.test.ts` so từng byte. Khi sửa một ký tự ở comment đầu `prisma/init.sql`,
ca duy nhất đỏ vì chuỗi khác; hoàn nguyên thì xanh. Tệp sinh do `npm run db:embed-sql`; `db:sql`
gọi tiếp script này.

```text
Test Files  1 failed (1)
Tests       1 failed (1)
AssertionError: expected generated SQL to equal prisma/init.sql byte-for-byte
```

### 2.3 Đối soát mốc và Hardhat

Đột biến khôi phục chốt `ORDER_STATE` cũ:

```text
FAIL  test/issuance-service.test.ts > ... > chuỗi đã phát hành mà DB chưa có mốc thì đối soát rồi dùng mint, không mintInitialSupply
AssertionError: Chuỗi đã phát hành tổng cung nhưng dự án chưa có mốc phát hành; cần đối soát trước.: expected false to be true
Test Files  1 failed (1)
Tests       1 failed | 26 skipped (27)
```

Sau hoàn nguyên:

```text
✓ test/issuance-service.test.ts (27 tests)
Test Files  1 passed (1)
Tests       27 passed (27)
```

Adapter/service trên node Hardhat tự dựng:

```text
✓ test/evm-issuance.test.ts (10 tests | 1 skipped) 4515ms
Test Files  1 passed (1)
Tests       9 passed | 1 skipped (10)
```

Ca service xác nhận chỉ một audit “Đối soát mốc phát hành từ chuỗi”, chỉ giao dịch `mint` và hai
lần duyệt đồng thời chỉ phát đúng một giao dịch.

### 2.4 Seed trên PostgreSQL thật

```bash
TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa_op06_baseline \
  npx vitest --run test/postgres-seed.test.ts
```

```text
✓ test/postgres-seed.test.ts (1 test) 150ms
Test Files  1 passed (1)
Tests       1 passed (1)
```

Test bọc transaction rồi rollback: địa chỉ sai được sửa khi `issuedAt=NULL`; sau khi đặt `issuedAt`,
seed chạy lại vẫn giữ địa chỉ đã khoá.

## 3. Worker, V3 và dữ liệu mẫu

### 3.1 Cấu hình

`app/wrangler.json` có `USE_MOCK_DB=false`, `ENABLE_SEPOLIA_DEMO_PROJECT=true`, `keep_vars=true`, binding
`HYPERDRIVE` ID `bf7828b9f4bb42de9f65123d0f00e4a3`, và `localConnectionString` chỉ tới localhost.
`npm run cf:build` hoàn tất với `OpenNext build complete.`

### 3.2 Worker local bền qua restart

Postgres 16 local + Hardhat local + `wrangler dev`, hai vai/các request riêng:

```text
[wrangler:info] Ready on http://127.0.0.1:8787
{"phase":"created-and-approved","requestId":"61209ce4-bc1b-48e6-9ea4-7c31153eae99"}
⎔ Shutting down local server...
[wrangler:info] Ready on http://127.0.0.1:8787
{"phase":"verified-after-restart","requestId":"61209ce4-bc1b-48e6-9ea4-7c31153eae99"}
```

Lượt thành công có các GET/POST 200 và không có lỗi I/O xuyên request. Lỗi 502 đầu tiên được xác
định là nút Hardhat do terminal trước dừng; khi giữ node ở terminal riêng, API token và toàn luồng xanh.

### 3.3 V3 và runbook

Đo bằng Worker probe riêng để không deploy nhánh chưa merge lên Worker chính:

```text
env.OP06_PROBE ("1")      Environment Variable
Current Version ID: 520e8652-0855-497b-89e7-642882180c25
{"probe":"1"}

# bỏ OP06_PROBE khỏi wrangler.json rồi deploy tiếp
Current Version ID: eeb4c80c-5bcf-4a62-934b-76e289dfb160
{"probe":null}
Successfully deleted bidv-op06-v3-probe-20261009
```

Kết luận: biến plain không có trong cấu hình mới bị mất. Lượt deploy production ngày 09/10 tái xác
nhận cảnh báo này; đã rollback ngay về version có RPC/signer, thêm `keep_vars=true`, rồi deploy lại
thành công mà không còn cảnh báo xoá biến. `DEPLOYMENT.md` vì vậy quy định `wrangler.json` là nguồn
biến không bí mật; biến/secret Dashboard được giữ bởi `keep_vars`. Runbook có Neon, Supabase Direct
connection, Postgres tự dựng qua Workers VPC/Tunnel, Postgres 13+/TLS/quyền tạo bảng, giới hạn
100.000 query/ngày và `pg_dump`/`pg_restore`. `guide.md` ghi rõ cách lấy Hyperdrive ID.

### 3.4 Đổi tên nhà máy

Đã đổi An Viên (`WIND-AVN-01`, WPT), Phú Quý (`WIND-PQY-02`, `WPT-PQY`) và Ninh Thuận
(`WIND-NTH-03`, `WPT-NTH`), giữ mọi số liệu. Pháp nhân và seed đổi sang An Viên. Các chuỗi địa lý
“Quảng Trị”/“Bạc Liêu” còn lại chỉ là gợi ý vùng `REGION_HINTS`, đúng spec.

## 4. Kiểm bản deploy — đọc đã xanh, giao dịch đang chờ

Ngày 09/10/2026, theo yêu cầu xử lý lỗi production, đã kiểm Worker chính với Neon + Hyperdrive:

```text
# trước sửa: action chỉ đọc Postgres, chưa gọi chain
stats status=200 ttfb=66.479703s total=66.481805s

# sau đường kiểm catalog, bản deploy version 8f05028f-2617-4dd6-b491-a47190757928
stats status=200 ttfb=0.713155s total=0.713671s
token status=200 ttfb=8.916898s total=8.917563s
token2 status=200 ttfb=9.208451s total=9.209348s

# smoke chính thức trên cùng version, dùng đúng commit đầy đủ
PASS /api/version
PASS commit 9c3610342307a8f32d9a75396034f178348cf2ee
PASS /api/token?chain=evm totalSupply=2700
```

Action token trả WPT/An Viên, contract `0xB8e9…6A02`, tổng cung `2700`, ví SPV
`0x5a5B…c4fd` và đủ năm chỉ tiêu. Nguyên nhân 66 giây: mỗi isolate chạy lại hơn một trăm DDL +
SAVEPOINT dù schema đã đủ. Bản sửa đối chiếu toàn bộ bảng/enum/index/constraint từ chính
`INIT_SQL` bằng một query catalog; thiếu mới chạy DDL. Client có timeout, giao diện kết thúc loading
sau 15 giây thay vì quay vô hạn.

Hyperdrive ban đầu dùng Neon hostname `-pooler`; đã đổi sang Direct hostname theo tài liệu Cloudflare
(Hyperdrive đã là pooler). Không ghi hostname/credential vào repo.

Điều kiện 7 vẫn 🔶 vì chưa gửi Mint/Burn mới và chưa kiểm lịch sử sau đóng/mở trình duyệt. Chỉ sau
ba bằng chứng đó mới chuyển OP-06 sang `done`.

## 5. Bộ kiểm cuối và bí mật

Kết quả bộ mặc định cuối:

```text
TỔNG KẾT (luật kiến trúc): PASS 20 · FAIL 0 · WARN 3 có chủ đích
Marker hợp lệ: 18 điểm cắm, 10 điểm chặn, 35 bước luồng. Không có lỗi.
Contract EVM: 84 passing
APP - TYPECHECK: PASS
APP - LINT: PASS
APP - VITEST:
  Test Files  32 passed | 2 skipped (34)
  Tests       796 passed | 11 skipped (807)

TỔNG KẾT run-local-all.sh
  Phần đã chạy: arch markers checkpoint contracts app
  Đạt: 7
  Không đạt: 0
  => ĐẠT các phần đã chạy: arch markers checkpoint contracts app
```

Bộ Postgres và kiểm không gắn nhà cung cấp/bí mật:

```text
# database tạm mới hoàn toàn: bidv_rwa_op06_coldfix_20261009
✓ test/postgres-seed.test.ts (1 test) 181ms
✓ test/store-constraints.test.ts (186 tests) 871ms
Test Files  2 passed (2)
Tests       187 passed (187)

# grep SDK/provider trong app/src + package.json
# (không có đầu ra)

# quét mẫu bí mật trong git log origin/dev..HEAD
133:+TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa_op06_baseline \
789:+      "localConnectionString": "postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa"
```

Hai kết quả quét là tài khoản `bidv:bidv` của PostgreSQL **local** theo đúng spec: một dòng lệnh test
trong checkpoint và `localConnectionString` bắt buộc của Wrangler. Không có hostname ngoài máy,
khóa riêng, RPC API key, chuỗi Neon hay SDK nhà cung cấp trong lịch sử nhánh.


## 6. Bổ sung xử lý timeout giao diện — 09/10/2026

Theo chỉ định Owner, tiếp tục commit/debug trên cùng nhánh `ops/06-cloudflare-db` sau PR #46.
Phạm vi bổ sung: GET chỉ đọc qua service kiểm quyền, hủy fetch cũ, thử lại giữ biểu mẫu,
phân biệt timeout/lỗi mạng, dùng chung phép đọc SPV và trace thời gian DB/schema/RPC.
`ENABLE_READ_DIAGNOSTICS` mặc định false, Wrangler bật tạm true; tắt sau khi thu đủ log.
Không thay đường lập/duyệt lệnh, signer, adapter, hợp đồng hoặc quy tắc Mint/Burn.

Bằng chứng nguyên văn và mã thoát: [CHECKPOINT_OP06_TIMEOUT_DETAIL.md](CHECKPOINT_OP06_TIMEOUT_DETAIL.md)
mục 1–5. Bộ mặc định xanh, PostgreSQL thật và hai ca giao diện chỉ đọc xanh; Worker local
đọc qua Hyperdrive tới PostgreSQL tạm được HTTP 200. Node đọc Sepolia được HTTP 200.
Các phép đo local không đại diện độ trễ Neon production.

Sai lệch đã xử lý: sơ đồ `issue.md` lệch số dòng sau thêm trace, đã sinh lại bằng script.
ESLint quét cache bundle `.wrangler` gây heap OOM sau kiểm Worker local; đã bỏ cache sinh ra
khỏi ESLint như `.open-next`, rồi chạy lại bộ mặc định xanh. Chi tiết ở mục 5 của tệp bằng chứng.

Chưa xác nhận timeout production hết. Sau review/merge, Workers Builds cần dựng bản mới;
Owner thử WPT tại `/draft`, nếu lỗi gửi **Mã tra cứu** và log `op06.read` cùng id.
`db.schema.wait`/`db.connect`/`db.query` lâu chỉ về DB; `rpc.*` lâu chỉ về RPC;
không có `request/start` chỉ về lượt gọi chưa vào handler hoặc bản deploy cũ.
Giữ điều kiện 7 ở 🔶 và OP-06 `inProgress` đến có bằng chứng deploy và Mint/Burn/lịch sử bền.
