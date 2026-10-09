# OP-06 — lưu log và phân loại lỗi HTTP, 09/10/2026

Bổ sung checkpoint mục 8. Kiểm ở local; chưa deploy production. Đầu ra dán nguyên văn.

## 1. Cấu hình observability theo schema Wrangler đã cài

Chạy từ gốc repo. persist và invocation logs bật, sampling 1 trong thời gian debug.

```bash
node - <<'JS' > /tmp/op06-observability-schema.log
const fs = require('node:fs');
const Ajv = require('./app/node_modules/ajv');
const schema = JSON.parse(fs.readFileSync('app/node_modules/wrangler/config-schema.json'));
const config = JSON.parse(fs.readFileSync('app/wrangler.json'));
const validate = new Ajv({strict:false}).compile({definitions: schema.definitions, $ref:'#/definitions/Observability'});
if (!validate(config.observability)) { console.error(validate.errors); process.exit(1); }
console.log('PASS: observability matches installed Wrangler schema');
console.log(JSON.stringify(config.observability));
JS
```

```text
PASS: observability matches installed Wrangler schema
{"enabled":true,"head_sampling_rate":1,"logs":{"enabled":true,"invocation_logs":true,"persist":true}}
```

Mã thoát: `0`.

## 2. Kiểm chức năng phần sửa

Chạy từ app/. Kiểm lỗi JSON 403, HTML 502 kèm cf-ray, phản hồi sai khuôn, timeout trước/sau
headers, mất kết nối và hủy lượt cũ. Không thêm đột biến vì phạm vi Owner không yêu cầu.

```bash
npx vitest run test/token-info-read.test.ts test/token-info-route.test.ts test/maker-checker-ui.test.ts > /tmp/op06-http-focused-final.log 2>&1
```

```text

 RUN  v3.2.4 /home/tuanlh/.codex/worktrees/03a6/bidv-rwa-tokenize/app

 ✓ test/token-info-read.test.ts (8 tests) 22ms
 ✓ test/token-info-route.test.ts (6 tests) 13ms
 ✓ test/maker-checker-ui.test.ts (31 tests) 154ms

 Test Files  3 passed (3)
      Tests  45 passed (45)
   Start at  16:29:25
   Duration  841ms (transform 352ms, setup 0ms, collect 1.07s, tests 190ms, environment 0ms, prepare 319ms)
```

Mã thoát: `0`.

## 3. Bộ mặc định

Chạy từ gốc repo: `bash scripts/run-local-all.sh > /tmp/op06-http-all.log 2>&1`, mã thoát 0.
Bỏ phần tiến độ, danh sách từng ca và bảng marker lặp trong log; đầu ra lọc dưới nguyên văn.
Sau bộ này chỉ tăng assert loại exception trong ca timeout body; kiểm lại phần sửa ở mục 2 xanh.

```bash
rg 'PASS: APP|84 passing|Test Files|Tests |Đạt:|Không đạt:' /tmp/op06-http-all.log > /tmp/op06-http-all-summary.log
```

```text
  84 passing (987ms)
[32m  => PASS: APP - TYPECHECK[0m
[32m  => PASS: APP - LINT[0m
 Test Files  35 passed | 2 skipped (37)
      Tests  815 passed | 11 skipped (826)
[32m  => PASS: APP - VITEST[0m
  Đạt:     7
  Không đạt: 0
```

Mã thoát: `0`.
