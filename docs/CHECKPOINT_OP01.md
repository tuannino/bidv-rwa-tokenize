# Báo cáo bàn giao — Task OP-01: tích hợp liên tục, cổng bảo vệ `dev`, tạm dừng Stellar

| | |
|---|---|
| Mã task | OP-01 |
| Nhánh | `op/01-ci`, tạo **từ `dev`** (`0f5dd8e`) |
| Spec | `docs/op-01-ci/{requirements,tasks}.md` (**không có** `design.md`) |
| Yêu cầu hợp nhất | [#28](https://github.com/tuannino/bidv-rwa-tokenize/pull/28) → `dev` |
| Tiến độ | Bước 6/6 xong. Chờ Supervisor nghiệm thu — Kiro **không** merge vào `dev` |

---

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md`) | | Bằng chứng |
|---|---|---|---|
| 1 | `run-local-all.sh` không gọi `cargo`, có thông báo Soroban tạm dừng, không khuyên cài Rust | ✅ | mục 3.1 |
| 2 | `verify-arch-rules.sh` không còn phép kiểm Stellar và ba mục spec Stellar | ✅ | mục 3.2 |
| 3 | Mã nguồn Stellar giữ nguyên, kiểm thử hiện có vẫn xanh | ✅ | mục 3.3 · 3.4 |
| 4 | Hai tệp quy tắc trong `.kiro/steering` chuyển Stellar thành phần mở rộng tương lai | ✅ | mục 1 (Bước 1) |
| 5 | `docs/tech-report.md` có mục ghi phần Stellar tạm dừng | ✅ | mục 1 (Bước 1) — mục 2.6 |
| 6 | Quy trình tự động có ba việc, chạy khi đẩy lên `dev` và khi mở yêu cầu hợp nhất | ✅ | mục 3.9 |
| 7 | Việc A và việc B xanh trên một yêu cầu hợp nhất thử | ✅ | mục 3.10 — cả **ba** việc xanh |
| 8 | Quy trình tự động gọi lại các phần của `run-local-all.sh`, không chép danh sách lệnh | ✅ | mục 3.8 |
| 9 | Bớt một hành động khỏi bảng quyền thì phép kiểm báo đỏ | ✅ | mục 3.5 (ca 4) |
| 10 | Đường dẫn đọc phiên bản và kiểm khói hoạt động | ✅ | mục 3.6 (ca 5) · 3.7 (ca 6) |
| 11 | Có lưu đệm cho phụ thuộc, trình biên dịch Solidity, trình duyệt kiểm thử, đệm dựng bản | ✅ | mục 3.9 — bảng 5 chỗ |
| 12 | Có hướng dẫn bật bảo vệ nhánh `dev` | ✅ | mục 1 (Bước 6) — `docs/BRANCH_PROTECTION.md` |
| 13 | `run-local-all.sh` xanh | ✅ | mục 3.11 |

**Kết luận:** 13 ✅ · 0 🔶 · 0 ❌

### 0.2 Việc cần Owner quyết

- **Bật bảo vệ nhánh `dev`** theo `docs/BRANCH_PROTECTION.md`. Đây là cấu hình kho mã, spec
  ghi rõ "chủ kho mã tự bật, task này chỉ viết hướng dẫn". Chưa bật thì cổng chưa có hiệu lực:
  quy trình tự động vẫn chạy và vẫn báo đỏ, nhưng **không chặn** được ai hợp nhất.
- **Chốt phiên bản Node.** `ci.yml` đang dùng `22`; steering ghi `.nvmrc = 20` nhưng repo không
  có `.nvmrc` lẫn `engines.node`. Chi tiết và số đo ở mục 5 (câu hỏi mở CH-1).
- **Một sai lệch số đo trong tài liệu** đã sửa theo số đo thật, cần xác nhận: `tech-report.md`
  ghi 309 test / 13 tệp, đo thật 517 / 19. Chi tiết mục 4 (SL-1).

---

## 1. Đã làm

Tám commit, mỗi commit một mục tiêu. Trình tự theo `tasks.md`: Phần A (tạm dừng Stellar) trước,
rồi Phần B (tích hợp liên tục), để không dựng quy trình rồi lại phải gỡ.

| # | Commit | Bước | Mục tiêu |
|---|---|---|---|
| 1 | `99a87ad` | 0 + 1 | Tạm dừng Stellar ở khâu kiểm chứng, giữ nguyên mã nguồn |
| 2 | `033f304` | 2 | Tách `run-local-all.sh` thành 7 phần gọi riêng được |
| 3 | `f63b010` | 3 | Chặn bảng quyền teo lại + `GET /api/version` + 6 test |
| 4 | `e4d9738` | 4 | `scripts/smoke-test.mjs` |
| 5 | `122cff7` | 5 | `.github/workflows/ci.yml` — ba việc |
| 6 | `9df0fad` | 6 | `docs/BRANCH_PROTECTION.md` |
| 7 | `a3f6211` | 6 | Báo cáo công nghệ: mục 2.7, metadata 2.4 → 2.5, đo lại số test |
| 8 | (commit này) | 6 | OP-01 sang `done`, báo cáo bàn giao |

### Bước 1 — tạm dừng Stellar (việc 1–5 của spec)

| Gỡ khỏi khâu kiểm chứng | Ở đâu |
|---|---|
| Nhánh `cargo test` | `run-local-all.sh` — xoá cả khối `if command -v cargo`, thay bằng **một dòng** `c_yel` không tính vào PASS/FAIL |
| Phép kiểm `@stellar/stellar-sdk` | `verify-arch-rules.sh` — thay bằng khối chú thích nêu lý do và điều kiện thêm lại |
| Ba mục spec `p4-mint-stellar` / `p7-…-stellar` / `p12-…-stellar` | cùng tệp, vòng `for s in …` |
| Yêu cầu bắt buộc liên quan Stellar | `.kiro/steering/tech.md` (dòng stack) + `structure.md` (thêm mục "Stellar: phần mở rộng tương lai, đang TẠM DỪNG") |

Lý do bỏ **từng** phép kiểm, không bỏ cả cụm: phép kiểm `@stellar/stellar-sdk` quét một thư viện
**chưa có trong `app/package.json`**, nên nó luôn xanh — một dòng PASS không phát biểu điều gì. Ba
mục spec Stellar thì sinh ra ba dòng WARN **vĩnh viễn** cho việc không ai sắp làm; cảnh báo không
bao giờ tắt được thì người đọc học cách bỏ qua cả cột WARN.

**Hai phép kiểm còn nhắc Stellar thì GIỮ**, và `tech-report.md` mục 2.6 ghi rõ để người sau không
"dọn" nhầm: (a) contract ID Stellar hardcode — đó là luật *một nguồn sự thật*, vẫn đúng hôm nay;
(b) `packages/contracts-stellar/contracts/**/*.rs` trong phép so với `BASE_REF` — đó **chính là**
thứ bảo vệ mã nguồn Stellar khỏi bị sửa.

`docs/tech-report.md` mục **2.6** có bảng giữ/gỡ, lý do giữ mã, và điều kiện nối lại.

### Bước 2 — tách `run-local-all.sh` (việc 8)

Bảy phần: `arch` · `markers` · `checkpoint` · `contracts` · `app` · `build` · `e2e`.
Bộ mặc định = năm phần đầu, tức **hành vi không đổi** khi chạy không tham số. `build` và `e2e` cố ý
ở ngoài: cả hai nặng, và `build` cần mạng (`next/font/google` ở `app/src/app/layout.tsx`).

Tên phần sai → thoát **2**, không phải 1. Phân biệt "gọi sai" với "có mục đỏ": gõ sai tên phần mà
trả 0 thì CI xanh oan, mà trả 1 thì bị đọc là test đỏ.

### Bước 3 — bảng quyền + đường dẫn đọc phiên bản (việc 10, 11)

- `verify-arch-rules.sh` mục LUẬT 3: số hành động trong `ACTIONS` không ít hơn bản trên nền, **và**
  không hành động nào của nền biến mất (bắt cả ca đổi tên — giữ số đếm nhưng vẫn mất một quyền).
  Đếm bằng `node` nhúng trong script vì khối `ACTIONS` có chú thích khối chứa dấu ngoặc và tên hành
  động trong dấu nháy ngược, nên `grep -c` đếm lẫn cả chú thích.
- `app/src/lib/config/build-info.ts` + `app/src/app/api/version/route.ts` + 6 test.

### Bước 4 — kiểm khói (việc 12)

`scripts/smoke-test.mjs <địa-chỉ-gốc>`, chạy **tay**, chưa gắn vào triển khai. Hai phép kiểm, ba
mã thoát. Chỉ gọi `GET`.

### Bước 5 — quy trình tự động (việc 6, 7, 9, 13)

`.github/workflows/ci.yml`: ba việc song song, mỗi việc gọi lại các phần của `run-local-all.sh`.

### Bước 6 — tài liệu (việc 14)

`docs/BRANCH_PROTECTION.md` (hướng dẫn Owner tự bật) + `tech-report.md` mục 2.7 + báo cáo này.

---

## 2. Đối chiếu DoD theo bước của `tasks.md`

| Bước | DoD trong `tasks.md` | Đạt? | Bằng chứng |
|---|---|---|---|
| 0 | OP-01 ở `inProgress`, `scan-pending --check` xanh | ✅ | mục 3.0 |
| 1 | Không còn `cargo`; test hiện có vẫn xanh; mã Stellar còn nguyên | ✅ | 3.1 · 3.3 · 3.4 |
| 2 | Gọi riêng từng phần được; không tham số thì hành vi giữ nguyên | ✅ | 3.8 |
| 3 | Bớt một hành động → đỏ; `/api/version` đúng cả hai chế độ | ✅ | 3.5 · 3.6 |
| 4 | Kiểm khói xanh khi app chạy, đỏ khi không gọi được | ✅ | 3.7 |
| 5 | Ba việc chạy thật trên PR thử, A và B xanh; có ghi thời gian | ✅ | 3.10 |
| 6 | Hướng dẫn bảo vệ nhánh; `tech-report.md` cập nhật; `run-local-all.sh` xanh | ✅ | 3.11 · mục 1 |

---

## 3. Cách chạy / kiểm thử — bằng chứng đã đo

Mọi con số dưới đây kèm lệnh đã dùng để đo ra nó (`.kiro/steering/checkpoint.md` mục 2).

### 3.0 Trạng thái task (Bước 0)

```
$ node scripts/scan-pending.mjs --check ; echo "exit=$?"
Marker hợp lệ: 19 điểm cắm, 12 điểm chặn, 35 bước luồng. Không có lỗi.
exit=0
```

Không marker nào chờ OP-01, nên không có marker phải dọn khi chuyển task sang `done`:

```
$ node scripts/scan-pending.mjs --json | node -e '<đếm marker có task === "OP-01">'
0 marker cho OP-01
```

### 3.1 Ca 1 — không còn `cargo`, không còn dòng khuyên cài Rust

```
$ grep -nEi "cargo|cài rust|rustup|rust 1\." scripts/run-local-all.sh
(rỗng)
```

Rỗng = đạt. Trước khi sửa, `grep -n "Soroban\|cargo\|Rust"` cho **5 dòng** (đúng số đo trong spec).
Dòng thông báo thay thế, in ra khi phần `contracts` chạy:

```
  (Soroban: tạm dừng ở khâu kiểm chứng, không cần chạy — mã nguồn Rust giữ nguyên)
```

Một dòng, không tính vào `PASSED`/`FAILED`, không đổi mã thoát, và **không** khuyên cài gì.

> ⚠️ Lần viết đầu, khối chú thích đầu tệp có câu "không ai phải cài Rust để làm việc trên dự án
> này". Câu đó nói **đúng** ý nhưng vẫn khớp `grep "cài Rust"`, tức một người review grep lại sẽ
> thấy một kết quả phải đọc kỹ mới biết là vô hại. Đã đổi thành "bộ công cụ Rust KHÔNG còn là thứ
> phải có trong môi trường làm việc" để phép kiểm của ca 1 cho ra kết quả rỗng thật.

### 3.2 Ca — `verify-arch-rules.sh` không còn phép kiểm Stellar

```
$ grep -n "stellar" scripts/verify-arch-rules.sh
44:# phần mở rộng tương lai, đang TẠM DỪNG: `@stellar/stellar-sdk` chưa nằm trong
48:# `app/src/lib/ledger/stellar.adapter.ts` và `packages/contracts-stellar/`.
231:            'packages/contracts-stellar/contracts/**/*.rs' 2>/dev/null | grep -v spec_tests || true)
308:# Ba spec Stellar (`p4-mint-stellar`, `p7-profit-distribution-stellar`,
309:# `p12-redemption-stellar`) đã được GỠ khỏi danh sách này (OP-01). Chuỗi Stellar là phần mở
```

Trước khi sửa: **5 dòng**, trong đó 4 dòng là **mã thi hành** (3 dòng phép kiểm
`@stellar/stellar-sdk`, 1 dòng ba mục spec). Sau khi sửa: 4 trong 5 dòng còn lại là **chú thích**
giải thích vì sao gỡ; **một** dòng mã duy nhất còn nhắc Stellar là dòng 231 — phép so contract với
`BASE_REF`, tức thứ **bảo vệ** mã nguồn Stellar, cố ý giữ.

Đổi về số mục PASS/WARN (chạy `bash scripts/verify-arch-rules.sh`):

| | Trước | Sau |
|---|---|---|
| PASS | 20 | 19, rồi **20** khi thêm phép kiểm bảng quyền ở Bước 3 |
| WARN | 6 | **3** (mất 3 dòng WARN spec Stellar) |
| FAIL | 0 | 0 |

### 3.3 Ca 3 — mã nguồn Stellar còn nguyên

```
$ find packages/contracts-stellar -name '*.rs' -not -path '*/target/*' | wc -l
8
$ ls -la app/src/lib/ledger/stellar.adapter.ts
-rw-r--r-- 1 … 5503 … app/src/lib/ledger/stellar.adapter.ts
$ grep -n "stellar" packages/shared/src/chains.ts | head
 5: * Thứ tự ưu tiên theo SPEC §1: hardhat-local (mặc định) -> evm -> stellar.
69:  stellar: {
70:    key: 'stellar',
72:    family: 'stellar',
88:export const CHAIN_ORDER: ChainKey[] = ['hardhat-local', 'mock', 'evm', 'stellar'];
```

Và không tệp nào trong danh sách "không sửa" của spec bị chạm:

```
$ git diff --name-only dev...HEAD | grep -E "contracts-stellar|stellar.adapter|shared/src/(chains|types)|CHECKPOINT_"
(rỗng)
```

### 3.4 Ca 2 — kiểm thử hiện có vẫn xanh, kể cả ca chuỗi ngoài họ Ethereum

```
$ cd app && npx vitest run test/wallet-status.test.ts
 ✓ test/wallet-status.test.ts (30 tests) 15ms
```

Tệp này có 6 ca nhắc `stellar`, trong đó ca số 3 là ca đúng phần dễ vỡ:

```
$ grep -n "stellar\|unsupported-chain" app/test/wallet-status.test.ts | head -3
62:  it('3. chain stellar thì unsupported-chain, không mời cài ví EVM', () => {
65:      input({ appChain: 'stellar', hasInjectedProvider: false, isConnected: false }),
68:    expect(status.kind).toBe('unsupported-chain');
```

Cả bộ (số đo dùng cho `tech-report.md` mục 2.5):

```
$ cd app && npx vitest run
 Test Files  19 passed (19)
      Tests  517 passed (517)
$ cd app && npx playwright test --list
Total: 30 tests in 4 files
$ cd packages/contracts-evm && npx hardhat test
  67 passing (962ms)
```

### 3.5 Ca 4 — bớt một hành động khỏi bảng quyền thì báo đỏ

Nền mặc định là `origin/dev`. Bảng quyền hiện có **24** hành động:

```
$ node -e '<đọc khối ACTIONS, bỏ chú thích, đếm chuỗi nháy đơn>' # cùng thuật toán script dùng
24
token:mint token:burn token:freeze token:clawback investor:whitelist kyc:approve
token:transfer order:place order:execute order:expire distribution:snapshot
distribution:execute settlement:initiate settlement:set-nav settlement:confirm
treasury:manage demo:mint-payment balance:read txn:read audit:read order:read
order:read:all reconcile:read portfolio:read
```

Trạng thái bình thường:

```
  PASS  Bảng quyền không teo lại so với origin/dev (24 -> 24 hành động)
```

**Đột biến A — bớt một hành động.** Xoá dòng `'token:clawback',` khỏi `ACTIONS`:

```
  FAIL  Bảng quyền MẤT hành động so với origin/dev (24 -> 23). Đã mất:
        token:clawback
        Mất quyền khỏi dev đã xảy ra thật (BE-08). Phục hồi rồi chạy lại; cố ý bỏ thì phải có DEVIATION trong checkpoint.
$ bash scripts/verify-arch-rules.sh >/dev/null 2>&1 ; echo exit=$?
exit=1
  PASS: 19   FAIL: 1   WARN: 3
  => KHÔNG ĐẠT. Phải sửa 1 mục trước khi nộp checkpoint.
```

**Đột biến B — đổi tên một hành động** (`token:clawback` → `token:clawback2`). Số đếm **không đổi**
nên phép so thuần số đếm sẽ bỏ qua; phép so theo tập hợp thì bắt được:

```
  FAIL  Bảng quyền MẤT hành động so với origin/dev (24 -> 24). Đã mất:
        token:clawback
```

Cả hai đột biến **đã chạy thật**, không chỉ dựng lên rồi ghi vào báo cáo. Tệp đã phục hồi:

```
$ git diff --quiet app/src/lib/rbac/permissions.ts && echo PHUC_HOI_OK
PHUC_HOI_OK
```

**Ca nền không tồn tại** (đẩy lần đầu lên một nhánh mới thì `github.event.before` là toàn số 0):

```
$ RBAC_BASE_REF=0000000000000000000000000000000000000000 bash scripts/verify-arch-rules.sh
  WARN  Không đọc được bảng quyền ở 0000… nên bỏ qua phép so (nền chưa có tệp này?)
  PASS: 19   FAIL: 0   WARN: 4     → exit=2
```

WARN, **không đỏ**: đỏ ở đó là đỏ vì cách lấy mã nguồn, không vì mã nguồn.

### 3.6 Ca 5 — đường dẫn đọc phiên bản

Sáu test đơn vị (`app/test/build-info.test.ts`):

```
$ cd app && npx vitest run test/build-info.test.ts
 ✓ test/build-info.test.ts (6 tests) 3ms
```

Và đo trên **bản dựng thật** (`npx next start`), không chỉ ở tầng hàm:

```
# CÓ biến môi trường
$ curl -s http://localhost:3210/api/version
{"ok":true,"data":{"commit":"abc1234def5678","branch":"op/01-ci",
 "buildTime":"2026-09-29T09:00:00.000Z",
 "source":{"commit":"env","branch":"env","buildTime":"env"}}}

# KHÔNG có biến nào — giá trị dự phòng
$ curl -s http://localhost:3211/api/version
{"ok":true,"data":{"commit":"local","branch":"local",
 "buildTime":"2026-09-29T09:49:22.888Z",
 "source":{"commit":"fallback","branch":"fallback","buildTime":"fallback"}}}
```

Route **không** bị đóng băng vào bản dựng — `next build` xếp nó vào nhóm chạy lúc có yêu cầu:

```
$ cd app && npm run build | grep "api/version"
├ ƒ /api/version
```

(`ƒ` = chạy lúc có yêu cầu.) Đã đọc `node_modules/next/dist/docs/01-app/01-getting-started/
15-route-handlers.md` dòng 51 trước khi viết: Next 16 **không** cache Route Handler theo mặc định,
và `next.config.ts` **không** bật Cache Components. Vẫn khai `dynamic = 'force-dynamic'` tường minh
vì một `/api/version` bị đóng băng sẽ trả 200 kèm mã commit CŨ — kiểm khói báo xanh cho đúng thứ nó
phải phát hiện.

### 3.7 Ca 6 — kiểm khói

| Tình huống | Lệnh | Kết quả |
|---|---|---|
| App đang chạy | `node scripts/smoke-test.mjs http://localhost:3210` | `=> ĐẠT toàn bộ 2 phép kiểm.` · **exit 0** |
| Cổng không ai nghe | `… http://localhost:3999 --timeout=3000` | `=> CHƯA ĐẠT: 2/2 phép kiểm đỏ.` · **exit 1** |
| `--expect-commit` khớp | `… --expect-commit=abc1234def5678` | 3/3 PASS · **exit 0** |
| `--expect-commit` lệch | `… --expect-commit=sai-bet` | `CHƯA ĐẠT: 1/3` · **exit 1** |
| Thiếu địa chỉ gốc | `node scripts/smoke-test.mjs` | in cách dùng · **exit 2** |
| Tham số lạ | `… --tham-so-la` | in cách dùng · **exit 2** |
| Địa chỉ có `/` cuối | `… "http://localhost:3210/"` | không sinh `//api/...` (đếm được 0) |

Bản chạy đủ, ca đạt:

```
KIỂM KHÓI http://localhost:3210  (chuỗi=mock, hạn chờ=10000ms)
  PASS  GET /api/version
        commit=abc1234def5678 nhánh=op/01-ci dựng=2026-09-29T09:00:00.000Z
  PASS  GET /api/token?chain=mock
        WPT trên mock, tổng cung 0
  => ĐẠT toàn bộ 2 phép kiểm.
```

Ca dự phòng vẫn **xanh** nhưng có ghi chú, đúng thiết kế (dự phòng không phải lỗi):

```
  PASS  GET /api/version
        commit=local nhánh=local dựng=… (dự phòng: commit, branch, buildTime)
```

### 3.8 Việc 8 — một nguồn danh sách việc

```
$ bash scripts/run-local-all.sh --list
Các phần gọi riêng được:
  * arch
  * markers
  * checkpoint
  * contracts
  * app
    build
    e2e
  * = thuộc bộ mặc định (chạy khi không truyền tham số)
```

Bằng chứng `ci.yml` **không chép** danh sách lệnh — mỗi việc chỉ có một dòng gọi vào script:

```
$ grep -n "run-local-all" .github/workflows/ci.yml
  6:#      bash scripts/run-local-all.sh --list
110:        run: bash scripts/run-local-all.sh arch markers checkpoint app
141:        run: bash scripts/run-local-all.sh contracts
196:            bash scripts/run-local-all.sh build e2e
```

Không lệnh kiểm nào (`vitest`, `eslint`, `tsc`, `hardhat`, `playwright`) xuất hiện trong `ci.yml`:

```
$ grep -cE "vitest|eslint|tsc |hardhat test|playwright test" .github/workflows/ci.yml
0
```

**Hành vi khi chạy không tham số giữ nguyên** — so trước/sau khi tách:

```
$ bash scripts/run-local-all.sh
  Phần đã chạy: arch markers checkpoint contracts app
  Đạt:     7        Không đạt: 0        exit=0
```

Bảy mục PASS, không mục nào FAIL, đúng như trước Bước 2. Tên phần sai thì thoát 2:

```
$ bash scripts/run-local-all.sh khong-co-phan-nay >/dev/null 2>&1 ; echo exit=$?
exit=2
```

### 3.9 Việc 6, 9, 13 — cấu hình quy trình tự động

Đọc bằng máy để khỏi phải tin mắt:

```
$ python3 -c "import yaml,json; d=yaml.safe_load(open('.github/workflows/ci.yml')); ..."
YAML hợp lệ.
on = {"push": {"branches": ["dev"]}, "pull_request": {"branches": ["dev"]}}
jobs = ['app', 'contracts', 'heavy']
  app:       name="A - ung dung (cong bat buoc)"        timeout=20  continue-on-error=None
  contracts: name="B - hop dong EVM (cong bat buoc)"    timeout=20  continue-on-error=None
  heavy:     name="C - phan nang (KHONG chan hop nhat)" timeout=30  continue-on-error=None
env = {'NODE_VERSION': '22'}
permissions = {'contents': 'read'}
```

Ba việc là ba `job` cùng cấp, **không** có `needs:` giữa chúng → chạy song song (xác nhận bằng thời
gian thực tế ở 3.10: tổng lượt chạy ≈ thời gian việc dài nhất, không phải tổng ba việc).

Cú pháp bash của **mọi** đoạn `run:` đã kiểm bằng `bash -n`:

```
$ <trích từng đoạn run: trong ci.yml rồi bash -n>
9 đoạn: 9 OK · số đoạn lỗi: 0
```

**Năm chỗ lưu đệm (việc 9):**

| # | Đệm gì | Đường dẫn | Khoá |
|---|---|---|---|
| 1 | Phụ thuộc `app` | qua `setup-node` `cache: npm` | `app/package-lock.json` |
| 2 | Phụ thuộc `contracts-evm` | qua `setup-node` `cache: npm` | `packages/contracts-evm/package-lock.json` |
| 3 | Trình biên dịch Solidity | `~/.cache/hardhat-nodejs` | hash `hardhat.config.js` (chứa `version: "0.8.28"`) |
| 4 | Trình duyệt Playwright | `~/.cache/ms-playwright` | hash `app/package-lock.json` |
| 5 | Đệm dựng bản | `app/.next/cache` | lockfile + `app/src/**` + `packages/shared/src/**`, kèm `restore-keys` |

Chỗ dễ sai ở #4, đã xử lý: đệm giữ **thư mục** trình duyệt chứ **không** giữ gói `.deb` mà nó cần.
Nên có hai bước loại trừ nhau — `playwright install --with-deps` khi đệm trượt,
`playwright install-deps` khi đệm khớp. Thiếu bước thứ hai thì lượt chạy **có đệm** hỏng theo kiểu
khó đoán: trình duyệt đủ file mà không khởi động được.

**Cả hai nhánh đã chạy thật**, mỗi nhánh một lượt (chi tiết ở 3.10):

| Lượt | Nhánh đi qua | Bước bị bỏ qua |
|---|---|---|
| 1 (`a3f6211`) | đệm **trượt** → `install --with-deps` | `Cài thư viện hệ thống cho trình duyệt đã có trong đệm` |
| 2 (`d4f9f8e`) | đệm **khớp** → `install-deps` | `Tải trình duyệt Playwright (chỉ khi chưa có trong đệm)` |

Đệm có tác dụng đo được ở việc B: **26 s → 19 s** (trình biên dịch Solidity không phải tải lại).

**Việc C không chặn hợp nhất (việc 13)** — thực hiện bằng cách nào:

| Cách | Chọn? | Vì sao |
|---|---|---|
| `continue-on-error: true` | **Không** | Biến việc C thành dấu XANH trong khi nó vừa đỏ. Một cổng nói dối còn tệ hơn không có cổng, và repo này đã có nhiều bài học đúng loại "xanh oan" |
| Chỉ đưa A và B vào danh sách phép kiểm bắt buộc của bảo vệ nhánh | **Có** | Việc C hiện đỏ đúng như thật, mà vẫn không chặn được hợp nhất. Siết sau = một lần bấm ở cấu hình kho mã |

Ghi ở `docs/BRANCH_PROTECTION.md` mục 5 kèm **điều kiện siết**: việc C xanh liên tục 10 lượt.

**Không dùng secret nào** (ràng buộc "không để lộ khóa bí mật trong nhật ký chạy"):

```
$ grep -c "secrets\." .github/workflows/ci.yml
0
```

Ba việc chỉ đọc mã nguồn và chạy kiểm thử trên bản `mock`; không khoá ký, không chuỗi kết nối cơ sở
dữ liệu, `permissions: contents: read`.

Hai chi tiết an toàn khác trong cùng tệp:

- **Không nội suy `${{ }}` vào thân `run:`.** `github.base_ref` và `github.event.before` truyền qua
  `env:` của bước. Nội suy thẳng vào shell là một lỗ chèn lệnh, kể cả khi giá trị hiện tại vô hại.
- **Dùng tên biến `RBAC_BASE_REF`, KHÔNG dùng `BASE_REF`.** `BASE_REF` là biến bật phép kiểm
  "contract không được sửa so với nền" ở cùng tệp `verify-arch-rules.sh`; đặt nó trong CI sẽ làm
  **đỏ mọi yêu cầu hợp nhất có sửa contract**, tức chặn đúng các task SC-0x. Đã tránh có chủ đích.

Phiên bản action **đo** chứ không nhớ theo trí nhớ:

```
$ for r in actions/checkout actions/setup-node actions/cache actions/upload-artifact; do
    git ls-remote --tags --refs "https://github.com/$r" | awk -F/ '{print $NF}' \
      | grep -E '^v[0-9]+$' | sort -V | tail -1 ; done
v7   v7   v6   v7
```

→ dùng `checkout@v7`, `setup-node@v7`, `cache@v6`, `upload-artifact@v7`.

### 3.10 Ca 7 — quy trình chạy thật trên yêu cầu hợp nhất thử

PR **#28** (`op/01-ci` → `dev`), lượt chạy `36567158728`, commit `a3f6211`, sự kiện
`pull_request`. Kết quả **cả ba** việc:

| Việc | Kết luận | Thời gian |
|---|---|---|
| `A - ung dung (cong bat buoc)` | ✅ success | **82 s** |
| `B - hop dong EVM (cong bat buoc)` | ✅ success | **26 s** |
| `C - phan nang (KHONG chan hop nhat)` | ✅ success | **196 s** |

Điều kiện hoàn thành chỉ đòi A và B; việc C cũng xanh, nên chưa có gì phải hoãn.

Mọi bước trong ba việc đều `success`, trừ **hai** bước `skipped` đúng như thiết kế:

| Bước bỏ qua | Vì sao đúng |
|---|---|
| `Cài thư viện hệ thống cho trình duyệt đã có trong đệm` | Lượt chạy đầu nên đệm trình duyệt **trượt**, nhánh `--with-deps` đã chạy. Hai bước loại trừ nhau |
| `Giữ vết Playwright khi kiểm thử đầu cuối đỏ` | Có `if: failure()`, mà kiểm thử đầu cuối **xanh** |

Lệnh đo (không cần `gh`, dùng API công khai):

```
$ curl -s ".../actions/runs/36567158728/jobs" | node -e '<in name, conclusion, thời lượng>'
A - ung dung (cong bat buoc) => success | 82s
C - phan nang (KHONG chan hop nhat) => success | 196s
B - hop dong EVM (cong bat buoc) => success | 26s
```

Tổng thời gian lượt chạy ≈ 196 s (thời gian việc dài nhất), không phải 304 s (tổng ba việc) →
xác nhận ba việc chạy **song song**.

**Lượt chạy thứ hai** — commit `d4f9f8e` (báo cáo này + `task-status.json`), lượt `36660290248`:

| Việc | Kết luận | Thời gian | So lượt 1 |
|---|---|---|---|
| `A - ung dung (cong bat buoc)` | ✅ success | 93 s | +11 s |
| `B - hop dong EVM (cong bat buoc)` | ✅ success | **19 s** | **−7 s** (đệm solc khớp) |
| `C - phan nang (KHONG chan hop nhat)` | ✅ success | 200 s | +4 s |

Lượt này đi qua **nhánh còn lại** của đệm trình duyệt: bước `Tải trình duyệt Playwright (chỉ khi
chưa có trong đệm)` báo `skipped`, tức đệm khớp và bước `install-deps` đã chạy. Đây là bằng chứng
cho CH-3, vốn còn để mở sau lượt 1.

> Lượt chạy của **commit cuối cùng** (commit thêm chính đoạn này) không có trong báo cáo, và không
> thể có: ghi kết quả của một lượt vào tệp rồi commit tệp đó sẽ sinh một lượt mới. Cắt ở đây và nói
> rõ, thay vì chạy vòng thêm một lần nữa. Supervisor xem trạng thái mới nhất ở PR #28.

### 3.11 Điều kiện 13 — `run-local-all.sh` xanh

```
$ bash scripts/run-local-all.sh
  PASS: 20   FAIL: 0   WARN: 3
  => ĐẠT nhưng có 3 cảnh báo cần xác nhận có chủ đích.
  => PASS có cảnh báo: luật kiến trúc
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)
  => PASS: LỚP 3 - KHUÔN CHECKPOINT
  67 passing (1s)
  => PASS: LỚP 1 - SPEC TEST CONTRACT EVM
  (Soroban: tạm dừng ở khâu kiểm chứng, không cần chạy — mã nguồn Rust giữ nguyên)
  => PASS: APP - TYPECHECK
  => PASS: APP - LINT
 Test Files  19 passed (19)
      Tests  517 passed (517)
  => PASS: APP - VITEST
  Phần đã chạy: arch markers checkpoint contracts app
  Đạt:     7        Không đạt: 0
  => ĐẠT các phần đã chạy: arch markers checkpoint contracts app
exit=0
```

Ba WARN của `verify-arch-rules.sh` (mã thoát 2 = "PASS có cảnh báo", không phải lỗi) đều có từ
trước OP-01: hai địa chỉ EVM hardcode trong `mint.tsx` (mẫu nhập, đã xác nhận có chủ đích) và một
WARN "chưa đặt `BASE_REF` nên bỏ qua so sánh contract". Trước OP-01 có **6** WARN; ba dòng mất đi là
ba mục spec Stellar.

`PASS: 20` là **19 + 1**: phép kiểm bảng quyền ở Bước 3 bù lại đúng một mục cho phép kiểm
`@stellar/stellar-sdk` đã gỡ ở Bước 1 (trước OP-01 cũng là 20).

Mục "LỚP 3 - KHUÔN CHECKPOINT" ở lượt chạy này là **bỏ qua thành PASS**, không phải đã kiểm:
`--in-progress` chỉ kiểm task đang ở `inProgress`, và commit cuối đã chuyển OP-01 sang `done`. Kết
quả kiểm thật của báo cáo này lấy bằng dạng hai tham số, ngay dưới đây.

Khuôn báo cáo này (dùng dạng hai tham số, vì `--in-progress` chỉ kiểm task đang ở `inProgress` và
commit cuối chuyển OP-01 sang `done` theo `docs/tech-report-maintenance.md` §3):

```
$ node scripts/check-checkpoint.mjs docs/CHECKPOINT_OP01.md docs/op-01-ci/requirements.md
ĐẠT     docs/CHECKPOINT_OP01.md
  mục 0: 31/60 dòng · bảng đối chiếu 13 dòng / 13 điều kiện · 13 ✅ 0 🔶 0 ❌ · cả tệp 768/800 dòng
exit=0
```

### 3.12 Lệnh để Supervisor tái hiện

```bash
# Toàn bộ cổng cục bộ (đúng tập việc mà CI kiểm, trừ build/e2e)
bash scripts/run-local-all.sh

# Từng việc của CI, gọi đúng như ci.yml gọi
bash scripts/run-local-all.sh --list
RBAC_BASE_REF=origin/dev bash scripts/run-local-all.sh arch markers checkpoint app  # việc A
bash scripts/run-local-all.sh contracts                                            # việc B
BUILD_COMMIT_SHA=$(git rev-parse HEAD) BUILD_BRANCH=op/01-ci \
  BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  bash scripts/run-local-all.sh build e2e                                          # việc C (cần mạng)

# Ca 4 — phép kiểm bảng quyền có răng (nhớ phục hồi tệp sau khi thử)
cp app/src/lib/rbac/permissions.ts /tmp/perm.bak
perl -0pi -e "s/^  'token:clawback',\n//m" app/src/lib/rbac/permissions.ts
bash scripts/verify-arch-rules.sh ; echo "exit=$?"     # mong đợi: FAIL 24 -> 23, exit 1
cp /tmp/perm.bak app/src/lib/rbac/permissions.ts && rm /tmp/perm.bak

# Ca 5 + 6 — đường dẫn đọc phiên bản và kiểm khói
cd app && npx vitest run test/build-info.test.ts && npm run build
BUILD_COMMIT_SHA=abc1234 BUILD_BRANCH=thu BUILD_TIME=2026-09-29T09:00:00.000Z \
  NEXT_PUBLIC_DEFAULT_CHAIN=mock USE_MOCK_DB=true npx next start --port 3210 &
cd .. && node scripts/smoke-test.mjs http://localhost:3210        # mong đợi exit 0
node scripts/smoke-test.mjs http://localhost:3999 --timeout=3000  # mong đợi exit 1

# Khuôn báo cáo bàn giao
node scripts/check-checkpoint.mjs docs/CHECKPOINT_OP01.md docs/op-01-ci/requirements.md
```

Tệp này đang **792/800 dòng**, tức gần ngưỡng phải tách. Vòng review sau cần thêm chỗ thì tách phần
chi tiết ra `docs/CHECKPOINT_OP01_DETAIL.md` theo `.kiro/steering/checkpoint.md` mục 3, **đừng cắt
bằng chứng** cho vừa hạn mức.

> ⚠️ Máy có `http_proxy`/`https_proxy` thì thêm `no_proxy='*'` cho hai lệnh kiểm khói, không thì
> yêu cầu đi qua proxy và không bao giờ tới được `localhost`.

---

## 4. Sai lệch so với spec

### SL-1 — Số test trong `tech-report.md` lệch số đo thật

| | |
|---|---|
| Tài liệu ghi | Vitest **309 test / 13 tệp** (`tech-report.md` mục 2.5, có từ trước OP-01) |
| Đo thật | **511 test / 18 tệp** trước khi thêm test của task này; **517 / 19** sau |
| Đã làm | Dùng **số đo thật**, sửa mục 2.5 thành 517 / 19 |

Theo `.kiro/steering/checkpoint.md` mục 2: khi con số trong tài liệu lệch số đo thật thì dùng số đo
thật và ghi thành một mục sai lệch, không im lặng sửa cũng không im lặng làm theo. Con số 309 lệch
**từ trước** OP-01 (gần 200 test được thêm qua BE-04/06/07 mà mục 2.5 không cập nhật theo), không
phải do task này gây ra.

### SL-2 — Thêm một tệp ngoài bảng "Tác động" của spec

Bảng Tác động của spec liệt kê 3 tệp mới. Đã tạo **5**:

| Tệp | Có trong bảng? | Lý do |
|---|:--:|---|
| `.github/workflows/ci.yml` | ✅ | |
| `scripts/smoke-test.mjs` | ✅ | |
| `app/src/app/api/version/route.ts` | ✅ | |
| `app/src/lib/config/build-info.ts` | ❌ | Bắt buộc theo luật kiến trúc: `process.env` chỉ được đọc trong `app/src/lib/config/`. Đọc env thẳng trong route handler sẽ vi phạm (`verify-arch-rules.sh` bắt được). **Không** nhét vào `env.ts` vì `serverEnv()` **ném lỗi** khi cấu hình sai, còn `/api/version` là nơi đầu tiên người ta gọi khi nghi bản triển khai có vấn đề — nó phải trả lời được **kể cả lúc** cấu hình đang sai |
| `docs/BRANCH_PROTECTION.md` | ❌ | Sản phẩm của việc 14 ("viết hướng dẫn bật bảo vệ nhánh `dev`"); spec yêu cầu nội dung nhưng không nêu tệp. Đặt ở `docs/` thay vì nhét vào `tech-report.md` vì đây là danh sách việc Owner **làm một lần**, không phải tài liệu tra cứu |
| `app/test/build-info.test.ts` | ❌ | Ca 5 của spec đòi kiểm cả hai chế độ của đường dẫn đọc phiên bản |

Không thêm phụ thuộc nào (ràng buộc "không thêm phụ thuộc mới vào ứng dụng"):

```
$ git diff dev...HEAD -- app/package.json app/package-lock.json packages/contracts-evm/package.json | wc -l
0
```

### SL-3 — Việc C của spec ghi "hai việc chạy song song" nhưng liệt kê ba

Mục 7 của spec mở đầu bằng "Hai việc chạy song song" rồi liệt kê **ba** gạch đầu dòng (A, B, C), và
mục 13 cùng điều kiện hoàn thành đều nói tới ba việc. Đã hiểu là **ba việc**, trong đó hai việc là
cổng bắt buộc — đó là cách đọc duy nhất khớp với mục 13 ("Việc A và việc B là cổng bắt buộc. Việc C
không chặn"). Ghi ra đây để Supervisor xác nhận, không phải để tự ý chọn.

---

## 5. Câu hỏi mở

### CH-1 — Chốt phiên bản Node cho nơi chạy tự động (cần Owner quyết)

**Bằng chứng, đo được:**

```
$ git ls-files | grep -E "\.nvmrc|\.node-version"
(rỗng)
$ grep -rn "engines" app/package.json packages/contracts-evm/package.json
(rỗng)
$ node --version          # máy đã đo toàn bộ bằng chứng của task này
v22.13.0
$ node -e '<quét engines.node của các gói trong app/node_modules>'
vite            ^20.19.0 || >=22.12.0
@vitejs/plugin-react  ^20.19.0 || >=22.12.0
yargs           ^20.19.0 || ^22.12.0 || >=23
miniflare       >=22.0.0
wrangler        >=22.0.0
next            >=20.9.0
```

**Hai cách hiểu:**

| | Hiểu là gì | Hệ quả |
|---|---|---|
| (a) | `.kiro/steering/tech.md` ghi "Node pinning: `.nvmrc` = 20 + `engines.node`" là **quyết định đã chốt**, chỉ chưa ai làm | Phải đặt `NODE_VERSION: '20'`, **thêm** `.nvmrc` và `engines.node` — nhưng Node 20 chỉ chạy được **từ 20.19**, và toàn bộ bằng chứng của task này đo trên 22.13 |
| (b) | Con số 20 là ý định cũ, chưa từng có hiệu lực ở đâu trong repo | Đặt `NODE_VERSION` bằng phiên bản **đã đo**, tức 22, và sửa lại `tech.md` |

**Đã làm:** chọn (b) — `NODE_VERSION: '22'`, kèm khối chú thích trong `ci.yml` nêu đủ số đo trên và
nói rõ đây là câu hỏi mở. Lý do chọn: nơi chạy tự động nên giống nơi đã đo bằng chứng; đặt 20 là
tạo ra một môi trường **chưa ai chạy thử** rồi tin nó.

**Chưa làm, chờ Owner:** thêm `.nvmrc` + `engines.node`, và sửa `tech.md`. Không tự làm vì cả hai
đụng vào một quyết định ghi trong steering, và `.nvmrc` ảnh hưởng máy của mọi người.

Đề xuất: `.nvmrc = 22`, `engines.node = ">=20.19.0"` (ngưỡng thật đo được, không phải con số tròn),
`NODE_VERSION` giữ 22.

### CH-2 — Kiểm khói chưa có nơi để gọi vào

Spec ghi "chạy bằng tay, chưa gắn vào triển khai", nên `smoke-test.mjs` hiện **không** được gọi ở
đâu. Nó chỉ có ích khi có một bản triển khai thường trú. Hiện repo có đường deploy Cloudflare
(`@opennextjs/cloudflare`) nhưng không có bước triển khai tự động.

Câu hỏi: khi dựng bước triển khai (task nào?), gọi kiểm khói ở đâu — ngay sau `wrangler deploy`
trong cùng lượt chạy, hay một lượt chạy riêng theo lịch? Không tự chọn vì việc này quyết định
`smoke-test.mjs` có cần thêm cơ chế thử lại hay không (bản triển khai vừa lên thường chưa phục vụ
ngay ở yêu cầu đầu).

### CH-3 — Bước `playwright install-deps` chưa từng chạy → **ĐÃ ĐÓNG**

Nêu ra sau lượt chạy 1 vì đây là chỗ đúng loại "xanh ở lượt đầu, đỏ ở lượt sau": nhánh "đệm trình
duyệt **khớp**" chưa có lượt nào đi qua, mà lượt đầu thì **luôn** trượt đệm.

**Đã đóng bằng lượt chạy 2** (`36660290248`, commit `d4f9f8e`): bước `Tải trình duyệt Playwright`
báo `skipped` → đệm khớp → `install-deps` chạy, và việc C vẫn xanh (200 s). Cả hai nhánh của cặp
bước loại trừ nhau nay đều có bằng chứng — bảng ở mục 3.9.

Giữ mục này lại thay vì xoá, để lần sau ai sửa hai bước đó biết chúng **đã** được kiểm cả hai
nhánh, và kiểm bằng cách nào.

---

## 6. Tự đánh giá 3 LUẬT kiến trúc

- [x] **Mọi call chain qua `ILedgerPort`.** Task này **không** thêm lời gọi chuỗi nào.
      `GET /api/version` chỉ đọc ba biến môi trường. `smoke-test.mjs` chỉ gọi HTTP `GET` vào ứng
      dụng, không nói chuyện với chuỗi. `verify-arch-rules.sh` xác nhận: `PASS Không có import
      viem/ethers ngoài app/src/lib`.
- [x] **Mọi ký qua `ISigner`.** Không thêm thao tác ký nào, không thêm khoá nào.
      `PASS Không có private key dạng hex 64 ký tự nhúng trong mã nguồn`.
- [x] **Mọi kiểm quyền qua RBAC.** Không thêm/bớt/đổi hành động nào trong bảng quyền — vẫn **24**,
      và nay có phép kiểm tự động chặn việc nó teo lại (mục 3.5).
      `PASS Không có so sánh role cứng ngoài lib/rbac`.

**`GET /api/version` cố ý KHÔNG có kiểm quyền — điều này cần đọc kỹ, không phải sơ suất.** Đường dẫn
này là thứ phải trả lời được **trước khi** đăng nhập được: nó tồn tại để kiểm khói sau triển khai và
để trả lời "máy đang chạy bản nào" lúc có sự cố. Bọc nó bằng RBAC thì nó vô dụng đúng lúc cần nhất.
Cái nó tiết lộ: mã commit, tên nhánh, mốc thời gian — kho mã này **công khai**, nên mã commit không
phải thông tin kín. Nó không đọc cơ sở dữ liệu, không gọi chuỗi, không chạm biến bí mật nào, và chỉ
nhận `GET`. Nếu về sau repo thành kho riêng thì đây là chỗ phải xét lại.

---

## 7. Tự kiểm trước khi mở PR (`branching.md` §11)

- [x] Nhánh tạo **từ `dev`**, không phải từ nhánh phụ — `git checkout -b op/01-ci dev` sau
      `git pull origin dev`; nền `0f5dd8e` = `origin/dev` lúc bắt đầu
- [x] `dev` đã kiểm là lành trước khi lấy nền (`branching.md` §5): `packages/` **73** tệp,
      `app/src/lib/ledger` **6** tệp, `AssetRegistry` **0**
- [x] Đã ở trên `dev` mới nhất — `git pull origin dev` báo `Already up to date`, chưa có commit mới
      trên `dev` kể từ đó nên **chưa cần** rebase. Trước khi hợp nhất sẽ `git fetch && git rebase
      origin/dev` rồi chạy lại cổng
- [x] `bash scripts/run-local-all.sh` xanh toàn bộ — mục 3.11
- [x] Có spec trong `docs/op-01-ci/` — **2** tệp (`requirements.md`, `tasks.md`). Không có
      `design.md`, và theo `.kiro/steering/efficiency.md` mục 5 thì "không có tệp này là bình thường"
- [x] Có báo cáo bàn giao (tệp này). **Chưa** nghiệm thu — Kiro không merge
- [x] `docs/tech-report.md` đã cập nhật theo `docs/tech-report-maintenance.md` — mục 2.6, 2.7,
      metadata 2.4 → 2.5, cây 1.4, mục 2.5 (số test đo lại), 3.6, 3.10, 4.7, phụ lục
- [x] Nhánh chỉ giải quyết một mục tiêu: dựng cổng kiểm tự động. Việc tạm dừng Stellar nằm trong
      cùng mục tiêu đó — spec yêu cầu làm **trước** để không dựng quy trình rồi lại phải gỡ
- [x] Không chạm tệp nào trong danh sách "không sửa" của spec — mục 3.3

Phạm vi thay đổi:

```
$ git diff --stat dev...HEAD | tail -1
 14 files changed, 1263 insertions(+), 67 deletions(-)
```

(chưa tính commit cuối: báo cáo này + `task-status.json`)
