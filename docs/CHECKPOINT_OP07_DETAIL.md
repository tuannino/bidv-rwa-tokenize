# Chi tiết kiểm chứng — OP-07

## 1. Hiện trạng và 59 ca cũ

Trước sửa, phép tái hiện tạm whitelist ở thể hiện A, xoá state toàn cục để mô phỏng isolate B rồi đọc
lại. Kỳ vọng `true`, thực tế `false`:

```text
AssertionError: expected false to be true
```

Ca tái hiện tạm đã xoá sau khi có ca Postgres chính thức. Bộ cũ không sửa nội dung:

```bash
grep -c "it(" app/test/mock-ledger.test.ts
npx vitest --run test/mock-ledger.test.ts test/issue-price-single-source.test.ts
```

```text
59
 ✓ test/mock-ledger.test.ts (61 tests)
 ✓ test/issue-price-single-source.test.ts (16 tests)
 Test Files  2 passed (2)
      Tests  77 passed (77)
```

## 2. Bộ hợp đồng memory và Postgres thật

Không đặt `TEST_DATABASE_URL`, cùng tệp chạy phần memory và bỏ qua phần Postgres:

```bash
npx vitest --run test/mock-ledger-state-store.test.ts test/mock-ledger-factory.test.ts
```

```text
 ✓ test/mock-ledger-state-store.test.ts (11 tests | 5 skipped)
 ✓ test/mock-ledger-factory.test.ts (3 tests)
 Test Files  2 passed (2)
      Tests  9 passed | 5 skipped (14)
```

Trên Postgres cục bộ riêng:

```bash
TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa_op07_test \
  npx vitest --run test/mock-ledger-state-store.test.ts test/op07-chain-scope.test.ts \
  test/postgres-seed.test.ts test/init-sql-generated.test.ts
```

```text
 Test Files  4 passed (4)
      Tests  15 passed (15)
```

Bộ này gồm mã hoá khứ hồi; hợp đồng hai kho; hai ledger độc lập; restart; rollback; hai Mint đầu song
song; hai mua song song; hồi quy maker-checker đúng ví; chain scope; seed và SQL sinh từ Prisma.

## 3. Bốn phép đột biến

### 3.1 Bỏ `FOR UPDATE`

```text
× hai phát hành đầu đồng thời chỉ đúng một thành công
  → expected 2 to be 1
```

### 3.2 Bắt lỗi Postgres rồi lùi về memory

```text
× lỗi kho không lùi âm thầm sang trạng thái bộ nhớ
× kết nối Postgres sai ném lỗi rõ thay vì trả trạng thái rỗng
  → promise resolved instead of rejecting
```

### 3.3 Tách precheck khỏi `mutate` trong `mintInitialSupply`

```text
× hai phát hành đầu đồng thời chỉ đúng một thành công (memory)
× hai phát hành đầu đồng thời chỉ đúng một thành công (postgres)
  → expected 2 to be 1
```

### 3.4 Luôn chọn Postgres bất kể `USE_MOCK_DB`

```text
× USE_MOCK_DB=true chọn đồng thời hai kho memory và không tạo Client pg
  → expected 'postgres' to be 'memory'
```

Mỗi đột biến chỉ tồn tại trong working tree, chạy đúng ca bảo vệ, rồi được hoàn nguyên trước commit.

## 4. Ngắt database và không pha trộn

```bash
npx vitest --run test/mock-ledger-factory.test.ts
```

```text
 ✓ test/mock-ledger-factory.test.ts (3 tests)
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

Ca thứ nhất đặt memory mode với URL không tồn tại, chạy whitelist, nạp VNDB, Mint, Burn, mua và bán;
spy xác nhận `pg.Client` không được tạo. Ca thứ hai kiểm `false` chọn cả business store và ledger store
Postgres. Ca thứ ba thực sự gọi URL sai và nhận lỗi, không fallback.

## 5. Schema rỗng và phép đo Worker local

Trên database test, đã chạy:

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

Postgres báo 19 đối tượng bị xoá. Request/ca đầu dựng lại, rồi:

```text
 ✓ test/mock-ledger-state-store.test.ts (11 tests)
 ✓ test/postgres-seed.test.ts (1 test)
 ✓ test/init-sql-generated.test.ts (1 test)
 Test Files  3 passed (3)
      Tests  13 passed (13)

MockLedgerState | project_seeds 4 | role_seeds 4 | config_seeds 7
```

Đo kết nối trên Worker local:

```bash
npm run cf:build
npx wrangler dev --port 8787
docker compose logs --since 2026-10-14T15:55:13Z --until 2026-10-14T15:55:25Z db
```

UI xác nhận:

```text
request=df0cb393-5e3c-4d29-822b-08a122631d20
Đã chấp nhận. Yêu cầu đã thực hiện xong trên chuỗi.
```

Log nguyên văn, chỉ bốn dòng `connection authorized` không mang `application_name=pg_isready`:

```text
db-1 | 2026-10-14 15:55:18.764 UTC [136804] LOG: connection authorized: user=bidv database=bidv_rwa_op07_measure
db-1 | 2026-10-14 15:55:18.796 UTC [136805] LOG: connection authorized: user=bidv database=bidv_rwa_op07_measure
db-1 | 2026-10-14 15:55:18.856 UTC [136806] LOG: connection authorized: user=bidv database=bidv_rwa_op07_measure
db-1 | 2026-10-14 15:55:18.862 UTC [136807] LOG: connection authorized: user=bidv database=bidv_rwa_op07_measure
```

Database đo sau đó đã xoá; `log_connections`, `.env.local` và `wrangler.json` đã trả về nguyên trạng.

## 6. Playwright

OP-07 không sửa tệp trong `app/e2e`. Lượt cuối bằng `bash scripts/run-local-all.sh build e2e` được dán
ở mục 7 để chốt số ca sau task; đối chiếu Git xác nhận số ca nguồn không đổi so với `origin/dev`.

## 7. Bộ kiểm cuối

### 7.1 Cổng mặc định

```bash
bash scripts/run-local-all.sh
```

```text
84 passing
Test Files  39 passed | 2 skipped (41)
     Tests  831 passed | 17 skipped (848)

########## TỔNG KẾT ##########
  Phần đã chạy: arch markers checkpoint contracts app
  Đạt:     7
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 3 - ĐIỂM CẮM (marker)
    PASS  LỚP 3 - KHUÔN CHECKPOINT
    PASS  LỚP 1 - SPEC TEST CONTRACT EVM
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST
  Không đạt: 0
  => ĐẠT các phần đã chạy: arch markers checkpoint contracts app
```

Mã thoát `0`. Máy marker đo `18` điểm cắm, `10` điểm chặn, `35` bước luồng. Checkpoint đo mục 0
`25/60` dòng, đủ `10/10` điều kiện.

### 7.2 Toàn bộ Vitest với Postgres thật

```bash
TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa_op07_test npx vitest --run
```

```text
 Test Files  40 passed | 1 skipped (41)
      Tests  905 passed | 10 skipped (915)
   Duration  2.93s
```

Mã thoát `0`.

### 7.3 Build và Playwright

```bash
bash scripts/run-local-all.sh build e2e
```

```text
Running 60 tests using 1 worker
  4 skipped
  56 passed (24.6s)

########## TỔNG KẾT ##########
  Phần đã chạy: build e2e
  Đạt:     2
    PASS  APP - BUILD BẢN PHÁT HÀNH
    PASS  APP - E2E (PLAYWRIGHT)
  Không đạt: 0
  => ĐẠT các phần đã chạy: build e2e
```

Mã thoát `0`. OP-07 không sửa `app/e2e`; `git diff --exit-code origin/dev -- app/e2e` thoát `0`,
nên danh sách 60 ca trước/sau là cùng một nguồn test, không có ca bị bỏ hoặc sửa để xanh.

### 7.4 Quét bí mật

```bash
git log -p origin/dev..HEAD | grep -nE \
  "postgres(ql)?://[^@ ]+:[^@ ]+@[^l1d ]|PRIVATE_KEY=0x[0-9a-fA-F]{64}"
```

```text
(không có đầu ra)
```

Mã thoát `1` của `grep`: không có dòng khớp, tức lịch sử nhánh không chứa credential Postgres ngoài
localhost/test được biểu thức cho phép và không có private key 64 ký tự.
