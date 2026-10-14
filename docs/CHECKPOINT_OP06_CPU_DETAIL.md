# Chi tiết kiểm chứng — OP-06 bổ sung giảm CPU

## 1. Log đếm kết nối trước và sau

Postgres local bật bằng các lệnh đã chạy:

```bash
docker compose exec -T db psql -U bidv -d bidv_rwa -tAc "SHOW log_connections"
docker compose exec -T db psql -U bidv -d bidv_rwa -c "ALTER SYSTEM SET log_connections = on"
docker compose exec -T db psql -U bidv -d bidv_rwa -c "SELECT pg_reload_conf()"
```

```text
off
ALTER SYSTEM
 pg_reload_conf
----------------
 t
(1 row)

on
```

Mỗi cửa sổ chạy `docker compose logs --since <mốc> --until <mốc> db`, rồi đếm đúng dòng
`connection authorized: user=bidv database=bidv_rwa` không có `application_name=`. Như vậy loại
được `pg_isready` của healthcheck và `psql` dùng để kiểm.

### 1.1 Trước sửa — `/draft`: 8

```bash
docker compose logs --since 2026-10-14T10:44:45Z --until 2026-10-14T10:44:48Z db
```

```text
db-1  | 2026-10-14 10:44:46.518 UTC [115588] LOG:  connection authorized: user=bidv database=bidv_rwa
db-1  | 2026-10-14 10:44:46.560 UTC [115589] LOG:  connection authorized: user=bidv database=bidv_rwa
db-1  | 2026-10-14 10:44:46.759 UTC [115591] LOG:  connection authorized: user=bidv database=bidv_rwa
db-1  | 2026-10-14 10:44:46.759 UTC [115590] LOG:  connection authorized: user=bidv database=bidv_rwa
db-1  | 2026-10-14 10:44:46.816 UTC [115592] LOG:  connection authorized: user=bidv database=bidv_rwa
db-1  | 2026-10-14 10:44:46.831 UTC [115593] LOG:  connection authorized: user=bidv database=bidv_rwa
db-1  | 2026-10-14 10:44:46.849 UTC [115594] LOG:  connection authorized: user=bidv database=bidv_rwa
db-1  | 2026-10-14 10:44:46.859 UTC [115595] LOG:  connection authorized: user=bidv database=bidv_rwa
```

### 1.2 Trước sửa — token-info WPT: 1

```bash
docker compose logs --since 2026-10-14T10:45:30Z --until 2026-10-14T10:45:33Z db
```

```text
db-1  | 2026-10-14 10:45:31.292 UTC [115706] LOG:  connection authorized: user=bidv database=bidv_rwa
```

HTTP thực tế: `token status=200 total=0.024289s`.

### 1.3 Trước sửa — chấp nhận Mint: 15

```bash
docker compose logs --since 2026-10-14T10:47:12Z --until 2026-10-14T10:47:14Z db
```

```text
db-1  | 2026-10-14 10:47:12.921 UTC [115992] LOG:  connection authorized: user=bidv database=bidv_rwa
db-1  | 2026-10-14 10:47:12.936 UTC [115993] LOG:  connection authorized: user=bidv database=bidv_rwa
db-1  | 2026-10-14 10:47:12.947 UTC [115994] LOG:  connection authorized: user=bidv database=bidv_rwa
db-1  | 2026-10-14 10:47:12.966 UTC [115996] LOG:  connection authorized: user=bidv database=bidv_rwa
db-1  | 2026-10-14 10:47:12.966 UTC [115995] LOG:  connection authorized: user=bidv database=bidv_rwa
db-1  | 2026-10-14 10:47:12.978 UTC [115997] LOG:  connection authorized: user=bidv database=bidv_rwa
db-1  | 2026-10-14 10:47:13.022 UTC [115998] LOG:  connection authorized: user=bidv database=bidv_rwa
db-1  | 2026-10-14 10:47:13.034 UTC [115999] LOG:  connection authorized: user=bidv database=bidv_rwa
db-1  | 2026-10-14 10:47:13.045 UTC [116000] LOG:  connection authorized: user=bidv database=bidv_rwa
db-1  | 2026-10-14 10:47:13.058 UTC [116001] LOG:  connection authorized: user=bidv database=bidv_rwa
db-1  | 2026-10-14 10:47:13.067 UTC [116002] LOG:  connection authorized: user=bidv database=bidv_rwa
db-1  | 2026-10-14 10:47:13.073 UTC [116003] LOG:  connection authorized: user=bidv database=bidv_rwa
db-1  | 2026-10-14 10:47:13.099 UTC [116004] LOG:  connection authorized: user=bidv database=bidv_rwa
db-1  | 2026-10-14 10:47:13.100 UTC [116005] LOG:  connection authorized: user=bidv database=bidv_rwa
db-1  | 2026-10-14 10:47:13.110 UTC [116006] LOG:  connection authorized: user=bidv database=bidv_rwa
```

### 1.4 Sau sửa — `/draft`: 4

```bash
docker compose logs --since 2026-10-14T10:52:41Z --until 2026-10-14T10:52:44Z db
```

```text
db-1  | 2026-10-14 10:52:42.464 UTC [116957] LOG:  connection authorized: user=bidv database=bidv_rwa
db-1  | 2026-10-14 10:52:42.686 UTC [116958] LOG:  connection authorized: user=bidv database=bidv_rwa
db-1  | 2026-10-14 10:52:42.746 UTC [116959] LOG:  connection authorized: user=bidv database=bidv_rwa
db-1  | 2026-10-14 10:52:42.772 UTC [116960] LOG:  connection authorized: user=bidv database=bidv_rwa
```

### 1.5 Sau sửa — token-info WPT: 1

```bash
docker compose logs --since 2026-10-14T10:52:52Z --until 2026-10-14T10:52:55Z db
```

```text
db-1  | 2026-10-14 10:52:53.064 UTC [116982] LOG:  connection authorized: user=bidv database=bidv_rwa
```

HTTP thực tế: `token status=200 total=0.108453s`.

### 1.6 Sau sửa — chấp nhận Mint: 3

```bash
docker compose logs --since 2026-10-14T10:53:24Z --until 2026-10-14T10:53:27Z db
```

```text
db-1  | 2026-10-14 10:53:25.301 UTC [117077] LOG:  connection authorized: user=bidv database=bidv_rwa
db-1  | 2026-10-14 10:53:25.384 UTC [117078] LOG:  connection authorized: user=bidv database=bidv_rwa
db-1  | 2026-10-14 10:53:25.389 UTC [117079] LOG:  connection authorized: user=bidv database=bidv_rwa
```

## 2. Client theo ExecutionContext

OpenNext 1.20.1 `runWithCloudflareRequestContext` gọi:

```text
return cloudflareContextALS.run({ env, ctx, cf: request.cf }, handler);
```

Vì store của AsyncLocalStorage được tạo cho mỗi `fetch`, `ctx` là object phù hợp làm khoá request.
Test giả lập hai object context khác nhau và 5 query song song mỗi object; kết quả xanh ở mục 4.
Vòng đời đóng dựa trên tài liệu Cloudflare Hyperdrive: client của Worker được garbage-collect và
edge connection tự dọn khi request/invocation kết thúc; không cần gọi `client.end()`.

## 3. Đường nhanh/đường chậm

Ca `lược đồ và seed đủ` kiểm đúng một Client, có query catalog + `expected_projects`, không có
`BEGIN`/`INSERT`. Ca `thiếu dữ liệu seed` kiểm Client request chỉ chạy hai phép đọc, Client thứ hai
chạy `BEGIN`, seed và `COMMIT`.

## 4. Bộ Postgres thật

```bash
TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa_op06_cpu_20261014 \
  npx vitest --run test/store-constraints.test.ts test/postgres-seed.test.ts \
  test/postgres-init-isolation.test.ts test/postgres-request-client.test.ts
```

```text
 RUN  v3.2.4 /Users/anbinh/workSpace/bidv-rwa-tokenize/app

 ✓ test/postgres-init-isolation.test.ts (5 tests) 164ms
 ✓ test/postgres-request-client.test.ts (6 tests) 167ms
 ✓ test/postgres-seed.test.ts (1 test) 199ms
 ✓ test/store-constraints.test.ts (186 tests) 868ms

 Test Files  4 passed (4)
      Tests  198 passed (198)
   Start at  17:51:32
   Duration  1.30s (transform 232ms, setup 0ms, collect 468ms, tests 1.40s, environment 0ms, prepare 181ms)
```

Database tạm được tạo sau khi xác nhận tên chưa tồn tại và đã `dropdb --if-exists` ngay sau test.

## 5. Hai phép đột biến

### 5.1 Quay lại mỗi `pgQuery` một Client

```bash
npx vitest --run test/postgres-request-client.test.ts -t "năm pgQuery song song"
```

```text
 ❯ test/postgres-request-client.test.ts (6 tests | 1 failed | 5 skipped) 137ms
   × Postgres Client theo request Cloudflare > năm pgQuery song song trong một request chỉ tạo một Client 136ms
     → expected [ Array(5) ] to have a length of 1 but got 5

 Test Files  1 failed (1)
      Tests  1 failed | 5 skipped (6)
```

### 5.2 Bỏ kiểm dữ liệu và luôn seed

```bash
npx vitest --run test/postgres-request-client.test.ts -t "lược đồ và seed đủ"
```

```text
 ❯ test/postgres-request-client.test.ts (6 tests | 1 failed | 5 skipped) 128ms
   × khởi tạo nhanh trên Client của request > lược đồ và seed đủ thì không BEGIN, không INSERT và chỉ dùng một Client 128ms
     → expected [ Client{ …(4) }, Client{ …(4) } ] to have a length of 1 but got 2

 Test Files  1 failed (1)
      Tests  1 failed | 5 skipped (6)
```

Hai đột biến đều đã hoàn nguyên; targeted suite xanh lại trước commit.

## 6. Kiểm không rò sau 30 lượt

Trước phép thử:

```bash
docker compose exec -T db psql -U bidv -d bidv_rwa -tAc \
  "SELECT count(*) FROM pg_stat_activity WHERE datname = 'bidv_rwa' AND application_name NOT IN ('psql','pg_isready')"
```

```text
0
```

Playwright headless tải tuần tự `/draft` từ `draft 1/30 status=200` đến:

```text
draft 28/30 status=200
draft 29/30 status=200
draft 30/30 status=200
```

Sau khi gửi `Ctrl-C` dừng Wrangler, chạy lại nguyên lệnh `pg_stat_activity`:

```text
0
```
