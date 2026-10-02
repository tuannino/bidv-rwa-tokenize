# Báo cáo bàn giao — Task FE-22: Màn Lập lệnh, Phê duyệt lệnh, và đóng đường đi vòng

| | |
|---|---|
| Mã task | FE-22 |
| Nhánh | `feat/maker-checker-ui`, tạo **từ `dev`** (`6f32d0a`, sau khi BE-12 merge — PR #30); **rebase lên `dev` @ `7d062db`** sau khi FE-21 merge (PR #31), xem mục 8 |
| Spec | `docs/fe-22-maker-checker-ui/{requirements,tasks}.md` — không có `design.md` |
| Tiến độ | Bước 5/5 xong. Chờ Supervisor nghiệm thu — Kiro **không** merge vào `dev` |

> Quy tắc viết checkpoint: `.kiro/steering/checkpoint.md`.
> Máy kiểm: `node scripts/check-checkpoint.mjs docs/CHECKPOINT_FE22.md docs/fe-22-maker-checker-ui/requirements.md`

---

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md`) | | Bằng chứng |
|---|---|---|---|
| 1 | Hai màn đúng bố cục tài liệu, thay hết trang chỗ trống | ✅ | mục 3.2 · 3.3 · 3.7 · 5 CH-4 |
| 2 | Khối kiểm tra hiện từng điều kiện, khoá nút khi có điều kiện trượt | ✅ | mục 3.2 ca 2 · 3.7 |
| 3 | Nguồn toàn bộ nguồn cung có cảnh báo xác nhận lại | ✅ | mục 3.2 ca 4 · 3.7 |
| 4 | Từ chối bắt buộc có lý do | ✅ | mục 3.3 ca 6 · 3.7 |
| 5 | Người lập không duyệt được yêu cầu của mình, giao diện báo trước | ✅ | mục 3.3 ca 8 |
| 6 | Hiển thị đủ năm trạng thái | ✅ | mục 3.3 việc 13 · 3.7 |
| 7 | Giao dịch viên không còn quyền tạo và huỷ token trực tiếp | ✅ | mục 3.4 ca 9 · 3.5 đột biến 1 |
| 8 | Không còn đường đi vòng, trừ đường dữ liệu thử có hai lớp chặn | ✅ | mục 3.4 ca 10 · 3.5 đột biến 2 |
| 9 | Số việc chờ lấy số thật, điểm cắm của FE-20 đã gỡ | ✅ | mục 3.6 · 4 DV-1 |
| 10 | `run-local-all.sh` xanh | ✅ | mục 7 |

**Kết luận:** 10 ✅ · 0 🔶 · 0 ❌

### 0.2 Việc cần Owner quyết

- **CH-1 — Cách hiểu đột biến 2** "bật cờ đường dữ liệu thử ở môi trường thật: phải bị từ chối".
  Đã chọn: môi trường thật là nơi không ai đặt cờ, đột biến = đổi mặc định cờ sang bật, và kiểm thử
  phải đỏ. Cách hiểu khác (thêm lớp chặn thứ ba theo `NODE_ENV`) **không** làm, vì spec nói đúng hai
  lớp và `efficiency.md` cấm tự thêm tầng kiểm. Mục 5.
- **CH-2 — Sơ đồ `docs/flows/issue.md` vẫn vẽ đường `issueInitialSupply`**, nay là đường dữ liệu thử.
  Đề xuất: FE-07 (hoặc task riêng) đánh số lại luồng `issue` theo lập–duyệt. Mục 5.
- **CH-3 — Tất toán BE-05 từng định "tái dùng `token:burn`"**, nay không vai nào có quyền đó. Đề xuất:
  BE-05 đốt qua lập–duyệt hoặc khai quyền `settlement:*` riêng. Mục 5.
- **CH-4 — Bố cục so với tài liệu yêu cầu mục III.1, III.2**: repo không có bản tài liệu đó, bố cục
  dựng theo danh sách việc 1–13 của spec. Cần Owner đối chiếu khi demo. Mục 5.

---

## 1. Đã làm

| Commit | Mục tiêu |
|---|---|
| `e89d6a4` | Spec vào repo; FE-22 sang `inProgress` |
| `8c16d3e` | Bước 1: khối thông tin token, khối kiểm tra, nhãn năm trạng thái, `lib/format.ts`; bốn phép đọc ở `token-request.service`; `countRequests` lọc theo loại và mốc quyết định |
| `c7eb70d` | Bước 2: màn Lập lệnh (việc 1–7) |
| `bf427d4` | Bước 3: màn Phê duyệt lệnh + màn chi tiết `/approvals/[id]` (việc 8–13) |
| `832861a` | Sửa kiểu trong một ca test của bước 3 (Vitest xanh nhưng `tsc` đỏ — bài học mới, mục 6) |
| `a577dfc` | Bước 4: gỡ `token:mint` / `token:burn` khỏi TELLER, quyền `demo:mint-token` + cờ `ENABLE_DEMO_TOKEN_MINT`, chuyển màn `/mint` |
| `9632f24` | Bước 5: ca 7, việc 18, e2e `maker-checker.spec.ts` |
| `52416f3` | Báo cáo công nghệ (sau rebase là 2.9), bài học, FE-22 sang `done`, checkpoint này |
| (sau rebase) | Gộp tính nguồn cung về `readSupplyMetrics` của FE-21, sửa test FE-21 theo hai lớp chặn, cập nhật checkpoint — mục 8 |

```
$ git diff --stat dev...HEAD | tail -1     # đo trước commit cuối
 42 files changed, 3128 insertions(+), 127 deletions(-)
```

**Chọn CHUYỂN màn `/mint` cũ, không gỡ hẳn (việc 15).** Màn đó có hai phần. (a) KYC + whitelist:
màn Lập lệnh không thay được, và e2e Lập lệnh còn dùng nó để whitelist ví SPV. (b) Phát hành thẳng cho
**ví nhà đầu tư**: lập–duyệt chỉ phát hành vào **ví SPV** nên không thay được, mà đây đúng là thứ cần
để dựng dữ liệu thử. Vì vậy: giữ màn, đổi nút phát hành thành "phát hành dữ liệu thử" sau hai lớp chặn,
thêm dòng trỏ sang `/draft` cho phát hành chính thức. Gỡ hẳn thì mất (a) và mất đường dữ liệu thử mà
việc 17 yêu cầu giữ.

## 2. Đối chiếu DoD theo `tasks.md`

| Bước | DoD | Đạt? | Ghi chú |
|---|---|---|---|
| 0 | FE-22 đang làm, `dev` có BE-12, `scan-pending --check` xanh | ✅ | `e89d6a4`; `dev` @ `6f32d0a` là merge PR #30 |
| 1 | Hai thành phần dùng chung | ✅ | mục 3.1 |
| 2 | Việc 1–7, ca 1–4 | ✅ | mục 3.2 |
| 3 | Việc 8–13, ca 5, 6, 8 | ✅ | mục 3.3 |
| 4 | Việc 14–17, ca 9, 10, hai đột biến, ghi lý do chọn chuyển/gỡ | ✅ | mục 3.4 · 3.5 · 1 |
| 5 | Việc 18, 19, ca 7, báo cáo, trạng thái, `run-local-all.sh` | ✅ | mục 3.6 · 7 |

## 3. Cách chạy / kiểm thử

Chạy từ `app/`. Mức kiểm chứng **Cao**: đủ mười ca, đột biến **chỉ** hai chỗ spec chỉ định.
Ca 9 ở `test/rbac.test.ts`; mọi ca còn lại ở `test/maker-checker-ui.test.ts` (Vitest môi trường
`node`: kiểm phép đọc/ghi của máy chủ + hàm thuần `components/maker-checker/gates.ts` quyết định khoá
nút) và `e2e/maker-checker.spec.ts` (giao diện thật).

```
$ npx vitest run test/maker-checker-ui.test.ts
 Tests  31 passed (31)
$ npx vitest run test/rbac.test.ts test/four-roles-shell.test.ts
 Tests  76 passed (76)
```

### 3.1 Bước 1 — `việc 19`, `việc 13`, `ca 1`: số `1.000.000`, `9.007.199.254.740.993` (quá 2^53 vẫn đúng); `17:05:09Z` → `02/10/2026 00:05:09`; đủ năm nhãn; khối thông tin token đủ chỉ tiêu trước và sau phát hành, ký hiệu viết thường vẫn tra được.

### 3.2 Bước 2 — ca 1, 2, 3, 4

| Ca | Test | Kiểm |
|---|---|---|
| 2 | `ca 2 — …` (3) | Khối kiểm tra máy chủ trả `cap` trượt → `submitBlockReason` khoá, lý do nêu "trần còn lại 100", không lẫn điều kiện đạt; `idle` / `loading` cũng khoá |
| 3 | `ca 3 — …` (2) | Lập xong: `PENDING`; `getDraftStats` +1; `getApprovalStats.pending` +1; `countPendingWork('CONTROLLER')` +1; cờ `mine` chỉ trả yêu cầu của người lập |
| 4 | `ca 4 — …` (2) | `TOTAL_SUPPLY` tự điền số bằng tổng cung máy chủ trả, cảnh báo "TOÀN BỘ nguồn cung (1.000 token)"; mọi điều kiện đạt mà chưa xác nhận vẫn khoá |

### 3.3 Bước 3 — ca 5, 6, 8, việc 13

| Ca | Kiểm |
|---|---|
| 5 | Mint 500: `COMPLETED`, tổng cung 1000 → 1500, còn được phát hành giảm, nhật ký 1 → 2 dòng "Chấp nhận, hoàn tất trên chuỗi"; Burn 400: tổng cung 600, "đã duyệt hôm nay" +1 |
| 6 | `rejectBlockReason('')`, `('   ')` khoá; từ chối có lý do: `REJECTED`, nhật ký thêm dòng kèm lý do, "đã từ chối hôm nay" +1 |
| 8 | Cùng mã `GDV001` mang vai CONTROLLER: `selfApprovalReason` nêu đúng mã, cả hai nút khoá; bấm cố thì máy chủ trả `SELF_APPROVAL` — lời báo trước khớp hành vi thật |
| 13 | `FAILED` và `EXECUTING` đều có dòng nhật ký riêng, không bị giấu |

### 3.4 Bước 4 — ca 9, ca 10

- **Ca 9** (`rbac.test.ts`): TELLER và mọi vai khác không có `token:mint` / `token:burn`; bảng
  `FE22_ACTIONS` chốt `allowed: []`. Mốc `PERMISSIONS_BEFORE_BE08` ghi hai cặp vào
  `INTENTIONALLY_REMOVED` — và kiểm chúng **thật sự đã gỡ**, không để danh sách ngoại lệ giấu quyền sót.
- **Ca 10** (quét mã + chạy thật): lời gọi `.mint(` / `.mintInitialSupply(` / `.burn(` ngoài
  `lib/ledger/` đúng **3** tệp; `executeIssuance({` đúng **2** nơi gọi; `executeBurn` không export;
  `mintToInvestorDirect` và `issueInitialSupply` đều `authorize('demo:mint-token', …,
  assertCanMintDemoToken)`; không chỗ nào còn kiểm `'token:mint'` / `'token:burn'`. Chạy thật: cờ tắt
  → cả hai đường `FORBIDDEN` nêu `ENABLE_DEMO_TOKEN_MINT`, tổng cung giữ 0; cờ bật → CONTROLLER vẫn
  bị chặn, TELLER đi được.

```
$ grep -rnE "\.(mint|mintInitialSupply|burn)\(" app/src | grep -v "^app/src/lib/ledger/" | cut -d: -f1 | sort -u
app/src/lib/bank/issuance.service.ts
app/src/lib/bank/mint.service.ts
app/src/lib/bank/token-request.service.ts
```

### 3.5 Hai đột biến — ĐÃ CHẠY THẬT, cả hai đỏ, trả mã về thì xanh lại

| Đột biến | Sửa tạm | Kết quả (`rbac.test.ts` + `maker-checker-ui.test.ts`, 83 ca) |
|---|---|---|
| 1. Trả `token:mint` cho TELLER | thêm `'token:mint'` vào `ROLE_PERMISSIONS.TELLER` | **4 failed / 79 passed** — có `FE-22 ca 9 — Giao dịch viên không còn quyền tạo và huỷ token trực tiếp` |
| 2. Bật cờ dữ liệu thử ở môi trường thật | `enableDemoTokenMint: boolFlag(false)` → `boolFlag(true)` | **3 failed / 80 passed** — `KHÔNG đặt cờ thì mặc định TẮT…`, `hai cờ độc lập…`, `ca 10 … cờ tắt (mặc định): … bị từ chối` |

Trả mã về: `Tests 83 passed (83)`. Cách hiểu đột biến 2: CH-1.

### 3.6 Bước 5 — ca 7, việc 18

- **Ca 7:** ba trang FE-22 nằm đúng `(ops-draft)` / `(control)`; menu TELLER không có `/approvals`,
  CONTROLLER không có `/draft`; phép đọc số liệu của mỗi màn trả `FORBIDDEN` cho vai kia.
- **Việc 18:** số cạnh menu đã đếm thật từ BE-12 (DV-1). FE-22 gỡ **7** marker `@pending FE-22` còn lại:

```
$ git grep -c "@pending FE-22" dev -- app/src | awk -F: '{s+=$NF} END {print s}'
7
$ git grep -n "@pending FE-22\|@blocked FE-22" -- app/src | wc -l
0
$ node scripts/scan-pending.mjs --check
Marker hợp lệ: 29 điểm cắm, 12 điểm chặn, 35 bước luồng. Không có lỗi.
```

### 3.7 Kiểm thử đầu cuối (Playwright)

`e2e/maker-checker.spec.ts` — 7 ca nối tiếp trên giao diện thật: nhập `wpt` → khối thông tin đủ 9 chỉ
tiêu; số lượng vượt trần → dòng `cap` "Không đạt", nút khoá; gửi → "Đã gửi yêu cầu tạo 1.234 WPT",
dòng "Chờ duyệt", số cạnh menu Lập lệnh +1; Burn toàn bộ nguồn cung → cảnh báo + ô xác nhận, số
lượng tự điền, nút khoá; guard hai chiều; Kiểm soát viên tìm theo mã, mở chi tiết, nút Từ chối khoá
khi trống lý do, Chấp nhận → "Hoàn tất", nhật ký 2 dòng, tổng cung tăng đúng 1.234; bộ lọc có đủ năm
trạng thái.

Máy phiên này có Chromium bản 1194 trong khi Playwright 1.63 đòi bản 1243, nên chạy bằng một cấu hình
tạm trỏ `executablePath` sang `/opt/pw-browsers/chromium` — tệp tạm đã xoá, **không** commit.

| Lần | Kết quả |
|---|---|
| 1 (cả bộ) | 42 passed / **1 failed**: `wallet-connect.spec.ts › có trong menu nhà đầu tư và mở được` (`toHaveURL` hết giờ). Chạy riêng ca đó: **passed**. FE-22 không chạm `/wallet` hay `/portfolio` |
| 2 (cả bộ) | **43 passed (43)** |

Ghi nhận trung thực: ca `wallet-connect` đỏ một lần rồi xanh ở lần sau, cùng mã. Giả thuyết: `next dev`
biên dịch `/wallet` lần đầu chậm hơn thời gian chờ của `toHaveURL`. Chưa chứng minh; nêu ở đây để
Supervisor theo dõi trên CI.

## 4. DEVIATION so với spec

- **DV-1 — Việc 18 phần "lấy số thật" đã làm ở BE-12** (`d9b7146`, `pendingWorkCounts()` gọi
  `countPendingWork`). FE-22 làm phần còn lại: gỡ 7 marker, thêm ca chốt số cạnh menu bằng thẻ
  "Đang chờ duyệt".
- **DV-2 — Thêm bốn phép đọc ở `token-request.service`** (`getTokenInfo`, `getDraftStats`,
  `getApprovalStats`, `getTokenRequestDetail`), cờ `mine` cho `listTokenRequests`, và hai bộ lọc
  `type` / `decidedFrom` cho `countRequests` ở cả hai bản lưu trữ. BE-12 không có nguồn nào cho khối
  thông tin token, các thẻ số liệu hay màn chi tiết; ràng buộc "giao diện không tự tính" buộc phải tính
  ở máy chủ. Bốn phép đọc kiểm quyền bằng `assertCan`, **không** ghi sổ, cùng cách `listAuditLog`.
- **DV-3 — `authorize()` nhận tham số thứ tư `check`** để lần bị chặn vì cờ cũng vào sổ kiểm toán.
- **DV-4 — Hai cờ dùng chung một khuôn trong `demo-payment.ts`** (`DemoGate`), tên tệp giữ nguyên để
  không đổi chỗ nhập; API của BE-08 giữ nguyên, test BE-08 không sửa dòng nào.
- **DV-5 — Thêm route `/approvals/[id]`** cho màn chi tiết (việc 10), trong `(control)` nên cùng cổng.
- **DV-6 — Bật `ENABLE_DEMO_TOKEN_MINT`** ở `playwright.config.ts` và `docker-compose.yml` (hai môi
  trường thử), để `mint.spec.ts` và `npm run demo:mint` vẫn chạy. `.env.example` để `false`.
- **DV-7 — Số liệu "hôm nay" tính theo giờ Việt Nam và toàn hệ thống**, không riêng người duyệt đang
  xem; hai thẻ Lập lệnh đếm yêu cầu **của chính người lập**, cùng nghĩa với số cạnh menu.

## 5. Câu hỏi mở

- **CH-1.** Đột biến 2: (a) đổi mặc định cờ sang bật, kiểm thử phải đỏ — **đã chọn**, khớp mô hình hai
  lớp của BE-08; (b) thêm lớp chặn theo `NODE_ENV=production` để cờ bật cũng bị từ chối — không làm
  vì là lớp thứ ba, và bản `docker compose` (môi trường thử) chạy `NODE_ENV=production`.
- **CH-2.** `@flow issue:1–2` vẫn là `issueInitialSupplyAction` → `issueInitialSupply`. Đã sửa nhãn
  bước 2 và marker `@pending FE-07` cho đúng chốt chặn mới; chưa đánh số lại cả luồng.
- **CH-3.** BE-05 không còn `token:burn` để tái dùng — cần quyết trước khi làm BE-05.
- **CH-4.** Không có tài liệu yêu cầu mục III.1, III.2 trong repo. "Mã người bán" lấy
  `SAMPLE_ACCOUNTS.seller` vì bảng dự án chưa có cột người bán; "mã hoặc ký hiệu token" tra theo ký
  hiệu (bảng dự án chỉ có ký hiệu).

## 6. Tự đánh giá 3 LUẬT kiến trúc

- [x] Mọi call chain qua `ILedgerPort` — ba màn chỉ gọi server action; không component nào nhập
  `viem` / `ethers` (`verify-arch-rules.sh`, mục 7)
- [x] Mọi ký qua `ISigner` — không thêm đường ký nào
- [x] Mọi kiểm quyền qua RBAC — `authorize()` / `assertCan()` / `assertCanMintDemoToken()`; không
  `role ===` nào. Khoá nút ở giao diện chỉ đọc kết quả máy chủ

Bài học mới (đã thêm vào `lessons.md` và 1.6.D báo cáo công nghệ): Vitest xanh không có nghĩa typecheck
xanh — commit `bf427d4` lọt một lỗi kiểu trong test, sửa ở `832861a`.

Báo cáo công nghệ 2.8 → 2.9 (FE-21 đã dùng 2.8 và mục 3.16): metadata, ghi chú phiên bản, 1.4, 1.5, 1.6.D, 3.3, 3.4, 3.5, 3.6, 3.15,
**3.17 mới**, 4.1, 4.3, 4.7; mục 3.10 và `docs/flows/issue.md` sinh lại bằng script.

## 7. Kết quả `run-local-all.sh`

Chạy **hai** lần, không phải một — nói rõ lý do:

| Lần | Kết quả | Nguyên nhân |
|---|---|---|
| 1 | mã thoát 1 — 6 PASS / **1 FAIL** (`LỚP 1 - SPEC TEST CONTRACT EVM`) | `HH502: Couldn't download compiler version list` — chính sách mạng của máy phiên này chặn `binaries.soliditylang.org` (403 "Host not in allowlist"). FE-22 **không** chạm `packages/`: `git diff --name-only dev...HEAD -- packages \| wc -l` → `0` |
| 2 | **mã thoát 0 — 7 PASS / 0 FAIL** | `USE_LOCAL_SOLC=1 bash scripts/run-local-all.sh` — dùng gói `solc` cục bộ, cơ chế `hardhat.config.js` đã có sẵn cho đúng tình huống bị chặn mạng. CI trên GitHub có mạng nên không cần biến này |

```
$ USE_LOCAL_SOLC=1 bash scripts/run-local-all.sh        # lần 2
  => PASS có cảnh báo: luật kiến trúc   (3 cảnh báo có từ trước, không cái nào do FE-22)
     PASS  Bảng quyền không teo lại so với origin/dev (31 -> 32 hành động)
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)
  => PASS: LỚP 3 - KHUÔN CHECKPOINT     (mục 0: 31/60 dòng · 10 ✅)
  => PASS: LỚP 1 - SPEC TEST CONTRACT EVM   67 passing
  => PASS: APP - TYPECHECK
  => PASS: APP - LINT
  => PASS: APP - VITEST                 Tests 648 passed (648)
  => ĐẠT các phần đã chạy: arch markers checkpoint contracts app
```

Ba cảnh báo: `process.env` ở `lib/signer/index.ts`, địa chỉ mẫu trong placeholder của
`components/pages/mint.tsx` (có từ P1, FE-22 chỉ dời số dòng), và `BASE_REF` chưa đặt cho phép so
contract. Cả ba có ở checkpoint BE-12.

Kiểm thử đầu cuối không thuộc bộ mặc định; đã chạy riêng, xem 3.7.

## 8. Rebase lên `dev` sau khi FE-21 merge (PR #31)

PR #32 báo xung đột vì FE-21 merge vào `dev` sau khi nhánh này tạo. Đồng bộ bằng **rebase** theo
`branching.md` §7. Trước khi rebase đã kiểm nhánh trên GitHub không có commit nào của người khác
(`origin/feat/maker-checker-ui` = `2173462`, đúng commit cuối của Kiro), nên đẩy lại bằng
`--force-with-lease`.

| Tệp xung đột | Cách xử lý |
|---|---|
| `.kiro/task-status.json` | Giữ cả hai: FE-21 ở `done`, FE-22 theo từng commit (`inProgress` rồi `done`); không còn mã nào trong `planned` |
| `docs/tech-report.md` mục 3.10 (vùng sinh tự động) | **Không sửa tay**: sinh lại bằng `node scripts/scan-pending.mjs --write-report` ở mỗi commit |
| `docs/flows/issue.md` (sinh tự động) | Sinh lại bằng `node scripts/gen-flow-diagram.mjs issue` |
| `docs/tech-report.md` phần viết tay | FE-21 đã dùng bản **2.8** và mục **3.16**, nên FE-22 lùi thành **2.9** và **3.17**; giữ nguyên toàn bộ chữ của FE-21; số trang chỗ trống đo lại: `grep -rl "PlaceholderPage" app/src/app \| wc -l` → `6`; FE-21 chuyển sang ✅ PR #31 ở 4.7 |

Hai xung đột **ngữ nghĩa** git không báo, phát hiện khi chạy lại kiểm thử:

1. `test/seller-channel.test.ts` (FE-21) dựng dữ liệu bằng `issueInitialSupply` dưới vai Giao dịch
   viên, mà FE-22 đã đặt đường này sau hai lớp chặn: **2 ca đỏ** với thông báo `ENABLE_DEMO_TOKEN_MINT=false`.
   Sửa đúng cách đã làm ở `token-request.test.ts`: bật cờ trong lúc dựng nền rồi tắt.
2. FE-21 thêm `readSupplyMetrics()` tính năm chỉ tiêu nguồn cung, trùng phép tính `supplyBreakdown`
   của FE-22. Gộp: khối kiểm tra Burn và khối thông tin token nay gọi thẳng `readSupplyMetrics`, xoá
   `supplyBreakdown`. Ba nơi (màn Người bán, khối kiểm tra, khối thông tin) không thể ra hai con số khác nhau.

```
$ cd app && npx tsc --noEmit -p . | grep -v "^.next/" | wc -l
0
$ npx vitest run
 Tests  656 passed (656)
```

`USE_LOCAL_SOLC=1 bash scripts/run-local-all.sh` sau rebase: **mã thoát 0**, 7 PASS / 0 FAIL, Vitest
656/656, hardhat 67 passing, bảng quyền 31 → 32 hành động. E2E cả bộ (cấu hình tạm trỏ Chromium của
máy phiên, không commit): **43 passed (43)**.
