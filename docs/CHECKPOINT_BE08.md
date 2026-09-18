# Báo cáo bàn giao — BE-08: Bổ sung quyền RBAC cho ba luồng

| | |
|---|---|
| Task | BE-08 (Backend, S1, P0, 2 điểm) |
| Nhánh | `feat/rbac-actions`, tạo **từ `dev`** (`fdb7b55`) |
| Spec | `docs/be-08-rbac-actions/{requirements,design,tasks}.md` |
| Commit | 5 commit, xem mục 1 |
| Phạm vi | Chỉ sửa **bảng dữ liệu** quyền + thêm cờ chặn. **Không** có logic nghiệp vụ |

---

## 1. Đã làm

Năm commit, mỗi commit một mục tiêu và đều ở trạng thái build/test được:

| Commit | Nội dung |
|---|---|
| `10dc80c` | `feat(rbac): thêm hành động cho ba luồng mint, burn, distribute` — 10 action vào `ACTIONS`, `reconcile:read` vào `READ_ONLY` |
| `c51fca4` | `feat(rbac): gán quyền mới theo vai trò` — cập nhật `ROLE_PERMISSIONS` theo ma trận `design.md` §2 |
| `9f3bf61` | `feat(config): cờ chặn chức năng phát hành VNDB demo` — `ENABLE_DEMO_PAYMENT_MINT` + `rbac/demo-payment.ts` + `.env.example` + `publicConfig()` |
| `71574aa` | `test(rbac): kiểm thử ma trận quyền mới` — 8 → 32 test |
| `9151503` | `docs: cập nhật ma trận quyền trong báo cáo công nghệ` — `tech-report.md` 3.3 / 3.6 / 1.5 / metadata |

Diff so với `dev`: 7 file, +509 / −20.

```
.env.example                     |   9 +
app/src/lib/config/env.ts        |  15 ++
app/src/lib/config/flags.ts      |  14 ++
app/src/lib/rbac/demo-payment.ts |  65 ++++++   (MỚI)
app/src/lib/rbac/permissions.ts  |  86 +++++++-
app/test/rbac.test.ts            | 250 +++++++++++++++++++++-
docs/tech-report.md              |  90 ++++++--
```

---

## 2. Ma trận quyền cuối cùng

21 action (11 cũ + 10 mới), 4 vai trò. Số 21 **đếm lại từ mã nguồn**, không theo tài liệu:

```
$ awk "/^export const ACTIONS = \[/,/^\] as const;/" app/src/lib/rbac/permissions.ts | grep -cE "^  '"
21
```

| Action | BANK_ADMIN | COMPLIANCE | INVESTOR | AUDITOR | Ghi chú |
|---|:--:|:--:|:--:|:--:|---|
| `token:mint` | ✅ | ❌ | ❌ | ❌ | cũ |
| `token:burn` | ✅ | ❌ | ❌ | ❌ | cũ — tái dùng cho bước đốt của luồng tất toán |
| `token:freeze` | ✅ | ✅ | ❌ | ❌ | cũ |
| `token:clawback` | ✅ | ❌ | ❌ | ❌ | cũ |
| `investor:whitelist` | ✅ | ✅ | ❌ | ❌ | cũ |
| `kyc:approve` | ✅ | ✅ | ❌ | ❌ | cũ |
| `token:transfer` | ❌ | ❌ | ✅ | ❌ | cũ |
| `order:place` | ❌ | ❌ | **✅** | ❌ | **mới** |
| `order:execute` | **✅** | ❌ | ❌ | ❌ | **mới** |
| `distribution:snapshot` | **✅** | ❌ | ❌ | ❌ | **mới** |
| `distribution:execute` | **✅** | ❌ | ❌ | ❌ | **mới** |
| `settlement:initiate` | **✅** | ❌ | ❌ | ❌ | **mới** |
| `settlement:set-nav` | **✅** | ❌ | ❌ | ❌ | **mới** |
| `settlement:confirm` | ❌ | ❌ | **✅** | ❌ | **mới** |
| `treasury:manage` | **✅** | ❌ | ❌ | ❌ | **mới** |
| `demo:mint-payment` | **✅ + cờ** | ❌ | ❌ | ❌ | **mới** — hai lớp chặn |
| `reconcile:read` | **✅** | **✅** | ❌ | **✅** | **mới** — qua `READ_ONLY` |
| `portfolio:read` | ❌ | ❌ | ✅ | ❌ | cũ |
| `balance:read` | ✅ | ✅ | ✅ | ✅ | cũ |
| `txn:read` | ✅ | ✅ | ✅ | ✅ | cũ |
| `audit:read` | ✅ | ✅ | ❌ | ✅ | cũ |

Khớp từng dòng với `design.md` §2. `BANK_ADMIN` **không** có `order:place` và
`settlement:confirm` — đã kiểm bằng test riêng.

---

## 3. Đối chiếu DoD

| Điều kiện (requirements §5) | Đạt? | Bằng chứng |
|---|:--:|---|
| 10 hành động mới có trong `ACTIONS` | ✅ | `ACTIONS` từ 11 → 21, đếm bằng `awk` ở mục 2 |
| Ma trận quyền đúng theo R2, có test cho từng dòng | ✅ | Bảng `NEW_ACTIONS` trong `rbac.test.ts`, mỗi dòng lặp qua toàn bộ `ROLES` nên có cả ca cho phép và ca bị chặn |
| `demo:mint-payment` bị chặn khi cờ tắt, kể cả `BANK_ADMIN` | ✅ | 3 test: không đặt cờ, cờ `false`, và loại lỗi ném ra |
| Không quyền nào đang có bị mất | ✅ | Mốc `PERMISSIONS_BEFORE_BE08` chép từ `git show dev:...`, test đối chiếu từng vai |
| `bash scripts/run-local-all.sh` xanh toàn bộ | ✅ | Đạt 6 / Không đạt 0 — xem mục 4 |
| `tech-report.md` mục 3.3 cập nhật ma trận quyền | ✅ | Commit `9151503` |

| Yêu cầu chức năng | Đạt? | Ghi chú |
|---|:--:|---|
| R1 — 10 hành động mới | ✅ | Đúng tên như bảng trong `requirements.md` |
| R2.1 — `BANK_ADMIN` đủ 8 quyền mới + quyền cũ | ✅ | |
| R2.2 — `COMPLIANCE` có `reconcile:read`, không có 3 quyền thực hiện | ✅ | Test riêng cho ba quyền bị chặn |
| R2.3 — `INVESTOR` có `order:place`, `settlement:confirm` | ✅ | |
| R2.4 — `AUDITOR` có `reconcile:read`, không quyền ghi nào | ✅ | Test lặp qua 16 action ghi |
| R2.5 — không vai nào ngoài `BANK_ADMIN` có `demo:mint-payment` | ✅ | Test kiểm cả khi cờ **đã bật**: cờ không tự cấp quyền |
| R3.1–R3.4 — hai lớp chặn, cờ mặc định tắt | ✅ | `demo-payment.ts`, thứ tự cờ trước quyền sau |
| R4.1 — chữ ký `can()`/`assertCan()` giữ nguyên | ✅ | `can.ts` **không bị sửa một dòng** |
| R4.2 — không sửa `FALLBACK_ROLE` | ✅ | Vẫn `AUDITOR` |
| R4.3 — không bỏ quyền nào | ✅ | |
| R4.4 — mỗi hành động mới có test | ✅ | Và có test **chốt lại chính điều đó** cho tương lai (xem mục 4) |

Ba việc trong danh sách "KHÔNG được làm" của `tasks.md` đều giữ: `can.ts`, `session.ts`,
`FALLBACK_ROLE` không bị sửa; không có logic nghiệp vụ nào dùng các quyền này.

---

## 4. Cách chạy / kiểm thử

```bash
bash scripts/run-local-all.sh          # toàn bộ, không cần mạng
cd app && npx vitest --run test/rbac.test.ts   # chỉ phần BE-08
```

**Kết quả thật, lần chạy cuối trên `9151503`:**

```
  Đạt:     6
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 1 - SPEC TEST CONTRACT EVM
    PASS  LỚP 1 - SPEC TEST CONTRACT SOROBAN
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST      -> Test Files 8 passed, Tests 145 passed
  Không đạt: 0
```

`rbac.test.ts`: **8 → 32 test**. Tổng test app: 121 → 145.

`verify-arch-rules.sh`: PASS 20, FAIL 0, WARN 6. **Cả 6 cảnh báo đều có từ trước**, không
liên quan BE-08: `SIGNER_KIND` đọc ở `signer/index.ts`, địa chỉ ví mẫu trong `mint.tsx`,
`BASE_REF` chưa đặt, và 3 spec Stellar chưa tới lượt làm. `eslint` còn 1 warning cũ ở
`src/empty.ts`.

### Đã kiểm test có thật sự bắt lỗi, không xanh giả

Test xanh không chứng minh được gì nếu nó không đỏ khi mã sai. Đã thử ba đột biến rồi
hoàn nguyên bằng `git checkout --`:

| Đột biến | Kết quả |
|---|---|
| Thêm `order:execute` cho `AUDITOR` | 3 test đỏ (ma trận, vai lạ, AUDITOR-chỉ-đọc) |
| Bỏ `token:transfer` của `INVESTOR` | 1 test đỏ (mốc chống hồi quy) |
| Bỏ dòng kiểm cờ trong `canMintDemoPayment()` | 3 test đỏ (cờ mặc định, cờ `false`, các cách viết cờ) |

Đáng chú ý: đột biến 1 và 2 **không** bị bộ test cũ bắt — test "kênh (audit) chỉ đọc" của
FE-01 chỉ liệt kê 7 action ghi, và không test nào kiểm `INVESTOR` có `token:transfer`. Đó là
lý do thêm `ALL_WRITE_ACTIONS` và `PERMISSIONS_BEFORE_BE08`.

### Ba luật kiến trúc

```
$ grep -rnE "from '(viem|ethers)'" app/src/ | grep -v "src/lib/"      # rỗng
$ grep -rln "SERVER_SIGNER_PRIVATE_KEY" app/src/
app/src/lib/signer/server.signer.ts
app/src/lib/config/env.ts
$ grep -rnE "role ===|role ==" app/src/ | grep -v "src/lib/rbac/"     # rỗng
```

`process.env.ENABLE_DEMO_PAYMENT_MINT` chỉ đọc ở `lib/config/env.ts` — đúng luật "env chỉ
đọc ở một chỗ".

---

## 5. DEVIATION so với spec

**D1. Thêm file `app/src/lib/rbac/demo-payment.ts` — không có trong `design.md` §3.**

`design.md` §3 liệt kê 5 file thay đổi, trong đó `flags.ts` được ghi là "đưa cờ ra cấu hình
công khai nếu giao diện cần ẩn nút". Nhưng `tasks.md` 3.2 yêu cầu "viết hàm kiểm tra dùng
chung: cờ trước, quyền sau" mà không nói đặt ở đâu. Đã đặt thành file riêng trong `lib/rbac/`
vì ba lý do:

1. Đây là **kiểm quyền**, thuộc `lib/rbac` theo LUẬT #3, không thuộc `lib/config`.
2. Hàm phải đọc env nên cần `server-only`; `rbac/index.ts` là barrel **client-safe**
   (component dùng `can()` để ẩn/hiện nút). Nhét vào barrel là làm mọi component
   `import ... from '@/lib/rbac'` fail build. File riêng, không export ra barrel, giải quyết
   việc này mà vẫn để `server-only` chặn cứng nếu ai import từ client.
3. `flags.ts` giữ đúng một trách nhiệm: tính cấu hình công khai. Nó **có** import hàm này để
   tính `publicConfig().demoPaymentMint`, nên vẫn đúng ý `tasks.md` 3.4.

**D2. `publicConfig()` phơi ra `demoPaymentMint` là "cờ AND quyền", không phải cờ trơn.**

`tasks.md` 3.4 nói "đưa cờ ra `publicConfig()`". Đã phơi kết quả của **đúng hàm mà server
dùng để chặn** thay vì cờ thô. Nếu phơi cờ thô, client phải tự làm
`config.enableDemoPaymentMint && can(config.role, 'demo:mint-payment')` — hai lớp bị nhân bản
ở hai nơi và sẽ lệch nhau ở lần sửa đầu tiên. Đã ghi rõ trong kiểu `PublicConfig` rằng đây là
gợi ý **hiển thị**, chốt chặn thật vẫn ở server.

**D3. Thêm một test không có trong `tasks.md` §4:** test đối chiếu `ACTIONS` với bảng
`NEW_ACTIONS`, để lần sau ai thêm action mà quên test là đỏ ngay. R4.4 nói "mỗi hành động mới
PHẢI có test"; test này biến yêu cầu đó thành thứ máy kiểm được thay vì trông vào việc người
review nhớ ra.

---

## 6. Sai lệch tài liệu phát hiện được (đã sửa)

Theo `tech-report-maintenance.md` §6, ghi lại chứ không sửa lén:

**Bảng kế hoạch ở `tech-report.md` 4.2 và 4.3 dặn tạo action trùng nghĩa với BE-08.**

- 4.2 (luồng redeem, chưa xây): "thêm action `token:redeem` (INVESTOR ✅)".
- 4.3 (luồng distribution, chưa xây): "thêm `distribution:create` (BANK_ADMIN)".

BE-08 đã chốt `settlement:*` (vì luồng chốt là ngân hàng điều phối và đốt, không phải nhà đầu
tư tự đổi) và tách `distribution:snapshot` / `distribution:execute`. Để nguyên hai dòng đó là
dẫn dev sau tạo action thứ hai cùng nghĩa, rồi hệ thống có hai đường phân quyền cho cùng một
việc. Đã đổi thành "quyền **đã có sẵn** từ BE-08" kèm dòng "**KHÔNG** thêm ...".

**Dòng mô tả `READ_ONLY` trong 3.3 đã lệch** sau khi thêm `reconcile:read` (ghi 3 quyền, thực
tế 4). Đã sửa.

---

## 7. Câu hỏi mở

**Q1. `treasury:manage` là một quyền hay nên tách?**

`requirements.md` R1 ghi `treasury:manage` = "quản trị hai ví SPV và ví chia lợi nhuận". Đã
làm đúng một quyền như spec. Nhưng "quản trị" gộp cả *xem cấu hình ví* và *đổi địa chỉ ví*,
mà hai việc đó khác hẳn nhau về mức rủi ro: đổi địa chỉ ví nhận tiền là thao tác nguy hiểm
nhất trong cả hệ thống.

Hai cách hiểu:
- (a) Một quyền như hiện tại, phân biệt mức rủi ro ở tầng nghiệp vụ (maker-checker).
- (b) Tách `treasury:read` và `treasury:set-wallet`, để RBAC chặn được ngay ở cổng.

Đề xuất: giữ (a) trong BE-08 vì spec ghi vậy, và để lại quyết định cho task nào thực sự xây
màn hình quản trị ví. Nếu Supervisor muốn (b) thì đây là lúc rẻ nhất để tách — chưa có mã nào
dùng quyền này.

**Q2. Ai đặt guard cho `demo:mint-payment`?**

`tasks.md` cấm viết logic nghiệp vụ, nên BE-08 chỉ giao `assertCanMintDemoPayment()` mà không
có chỗ gọi. `requirements.md` §4 ghi "chức năng phát hành VNDB thật thuộc spec riêng, task mới
theo chốt Q1", nhưng không nói rõ **chức năng demo** thuộc task nào. Hiện tại hàm này chưa có
người dùng — nếu không có task nhận thì nó sẽ là mã chết. Xin xác nhận task nào sẽ gọi nó.

---

## 8. Tự đánh giá 3 LUẬT kiến trúc

- [x] **Mọi call chain qua `ILedgerPort`** — BE-08 không chạm tầng ledger. `grep` viem/ethers
      ngoài `src/lib/` cho kết quả rỗng.
- [x] **Mọi ký qua `ISigner`** — không chạm tầng signer. `SERVER_SIGNER_PRIVATE_KEY` vẫn chỉ
      xuất hiện ở `config/env.ts` và `signer/server.signer.ts`.
- [x] **Mọi kiểm quyền qua RBAC** — đây chính là nội dung task. Không thêm so sánh role cứng
      nào; `grep "role ==="` ngoài `lib/rbac` rỗng. `can()`/`assertCan()` giữ nguyên chữ ký,
      `can.ts` không bị sửa. Chốt chặn cờ cũng đi qua `can()` chứ không tự đọc bảng quyền.

---

## 9. Trạng thái nhánh

Chưa merge. Theo `branching.md` §8, Kiro không tự merge vào `dev` — chờ nghiệm thu PASS rồi
Owner merge.

Tự kiểm trước PR (`branching.md` §11):

- [x] Nhánh tạo từ `dev` (`fdb7b55`), không từ nhánh phụ
- [x] `dev` đã kiểm lành trước khi lấy nền: `packages/` 73 file, `app/src/lib/ledger` 6 file,
      `AssetRegistry` 0 file
- [x] `bash scripts/run-local-all.sh` xanh toàn bộ
- [x] Có spec đủ 3 file (`docs/be-08-rbac-actions/`)
- [x] Có checkpoint (file này)
- [x] `docs/tech-report.md` đã cập nhật theo `tech-report-maintenance.md`
- [x] Nhánh chỉ giải quyết một mục tiêu
- [ ] Đã được nghiệm thu PASS — **đang chờ Supervisor**

Ghi chú về vị trí spec: spec của task này nằm ở `docs/be-08-rbac-actions/` (do Owner giao ở
đó), không phải `.kiro/specs/`. Đủ 3 file `requirements.md` / `design.md` / `tasks.md`. Nếu
Supervisor muốn theo đúng `branching.md` §11 thì chuyển sang `.kiro/specs/be-08-rbac-actions/`
là một lệnh `git mv`.

---

## 10. Phục hồi sau khi bị revert khỏi `dev`

> Mục này ghi lại một lần sự cố và cách sửa. Giữ lại làm tiền lệ, đừng xoá.

### 10.1. Chuyện đã xảy ra

BE-08 đã từng được merge vào `dev` (PR #16, merge commit `1afcddf`), rồi bị **revert** ngay
sau đó (PR #18, commit `874276c Revert "Feat/rbac actions"`) và **chưa bao giờ được phục hồi**.
`874276c` là commit thường (một cha là `1afcddf`), diff 11 file, và nằm trong lịch sử `dev`.

Hệ quả: mọi thành quả BE-08 biến mất khỏi `dev` — `app/src/lib/rbac/demo-payment.ts`,
10 action RBAC, cờ `ENABLE_DEMO_PAYMENT_MINT`, `docs/CHECKPOINT_BE08.md` và cả spec
`docs/be-08-rbac-actions/`. Trong khi đó BE-02 rồi BE-09 tiếp tục merge vào `dev` và sửa
cùng những file đó.

### 10.2. Cách phục hồi: `git revert 874276c` — và vì sao KHÔNG merge lại nhánh cũ

Đã dùng đúng một lệnh, theo `branching.md` §6:

```bash
git worktree add -b fix/restore-be08 /tmp/wt-be08 origin/dev
git revert --no-commit 874276c
```

**Merge lại `origin/feat/rbac-actions` là SAI và sẽ không phục hồi được gì.** Sau khi revert,
các commit của nhánh đó vẫn nằm trong lịch sử `dev`, nên lần merge sau git chỉ so với
merge-base, coi mọi thứ là "đã có" và bỏ qua đúng phần đã bị revert. Cherry-pick từng commit
cũng vậy. Đây không phải suy luận — chính lỗi này từng làm `dev` mất sạch `packages/` và
`app/src/lib/` (`branching.md` §5, §6 và `lessons.md`).

Trước khi lấy nền, đã kiểm `dev` lành theo `branching.md` §4–§5:

| Phép kiểm | Kết quả | Ngưỡng |
|---|---|---|
| `git log --oneline -3 origin/dev` | `9400467` merge BE-09 ở đỉnh | phải thấy merge commit BE-09 |
| `git ls-tree -r --name-only origin/dev \| grep -c '^packages/'` | 73 | > 0 |
| `git ls-tree -r --name-only origin/dev \| grep -c '^app/src/lib/ledger'` | 6 | > 0 |
| `git ls-tree -r --name-only origin/dev \| grep -c AssetRegistry` | 0 | = 0 |

### 10.3. Xung đột và cách giải — HỢP, không chọn một bên

Đây là phục hồi, không phải thay thế: mọi thứ BE-02/BE-09 đã thêm phải còn nguyên, đồng thời
thứ của BE-08 quay lại. 2 trong 11 file xung đột, 9 file tự hoà.

| File | Tình trạng | Cách giải |
|---|---|---|
| `app/src/lib/rbac/permissions.ts` | **xung đột** (3 khối) | HỢP hai tập: `ACTIONS` 24 phần tử, `READ_ONLY` 6 phần tử, `ROLE_PERMISSIONS` hợp theo từng vai |
| `docs/tech-report.md` | **xung đột** (1 khối, metadata) | Giữ dòng phase của BE-02+BE-09, thêm BE-08 vào; bump 1.7 → **1.8**; ma trận 3.3 viết lại thành hợp 24 action kèm cột "Nguồn" |
| `app/test/rbac.test.ts` | tự hoà | Giữ CẢ hai bộ test. Thêm bảng `BE02_ACTIONS` — xem 10.5 |
| `.env.example` | tự hoà | Thêm lại khối `ENABLE_DEMO_PAYMENT_MINT`, không xoá cờ nào đang có |
| `app/src/lib/config/env.ts` | tự hoà | Thêm lại `enableDemoPaymentMint: boolFlag(false)` |
| `app/src/lib/config/flags.ts` | tự hoà | Thêm lại `demoPaymentMint: canMintDemoPayment(role)` |
| `app/src/lib/rbac/demo-payment.ts` | tự hoà (thêm mới) | Phục hồi nguyên trạng |
| `docs/CHECKPOINT_BE08.md` | tự hoà (thêm mới) | Phục hồi nguyên trạng + mục 10 này |
| `docs/be-08-rbac-actions/{requirements,design,tasks}.md` | tự hoà (thêm mới) | Phục hồi nguyên trạng |

### 10.4. `ACTIONS` cuối cùng: 24 = hợp chính xác của 21 (BE-08) và 16 (BE-02), giao 13

Đối chiếu bằng máy với `git show 1afcddf:app/src/lib/rbac/permissions.ts` và
`git show origin/dev:app/src/lib/rbac/permissions.ts`: **không thiếu phần tử nào, không thừa
phần tử nào, không trùng lặp**.

| Nguồn | Action |
|---|---|
| **Chỉ BE-08** (8) | `distribution:snapshot`, `distribution:execute`, `settlement:initiate`, `settlement:set-nav`, `settlement:confirm`, `treasury:manage`, `demo:mint-payment`, `reconcile:read` |
| **Chỉ BE-02** (3) | `order:expire`, `order:read`, `order:read:all` |
| **Cả hai khai** (13) | `token:mint`, `token:burn`, `token:freeze`, `token:clawback`, `investor:whitelist`, `kyc:approve`, `token:transfer`, `order:place`, `order:execute`, `balance:read`, `txn:read`, `audit:read`, `portfolio:read` |

⚠️ **Ghi chú `docs/CHECKPOINT_BE02.md` nói "năm quyền `order:*` thuộc phạm vi BE-08" là ghi chú
PHẠM VI, không phải "BE-08 đã khai đủ năm".** Đo trên mã thật: BE-08 khai hai (`order:place`,
`order:execute`), BE-02 khai thêm ba. Suy diễn từ ghi chú đó sẽ dẫn tới kết luận sai là BE-02
không thêm gì.

`ROLE_PERMISSIONS` cũng là hợp chính xác theo từng vai (kiểm bằng máy, không đọc mắt):

| Vai | BE-08 | BE-02/dev | Sau phục hồi |
|---|:--:|:--:|:--:|
| `BANK_ADMIN` | 17 | 13 | **20** |
| `COMPLIANCE` | 7 | 8 | **9** |
| `INVESTOR` | 6 | 6 | **7** |
| `AUDITOR` | 4 | 5 | **6** |

`READ_ONLY` = `['balance:read','txn:read','audit:read','order:read','order:read:all','reconcile:read']`
— hợp của `['...,'reconcile:read']` (BE-08) và `['...,'order:read','order:read:all']` (BE-02).
`portfolio:read` vẫn **cố tình** không nằm trong nhóm này, vì nó là cổng vào kênh nhà đầu tư.

### 10.5. Đã sửa gì trong test, và vì sao

Một test của BE-08 đỏ sau khi hợp hai tập — **đã sửa test theo mã hiện tại, không nới quyền,
không bỏ test**:

- **Triệu chứng:** test `mọi hành động mới đều có dòng trong bảng test (R4.4)` đối chiếu
  `ACTIONS` với `ACTIONS_BEFORE_BE08 ∪ NEW_ACTIONS`. Ba action BE-02 (`order:expire`,
  `order:read`, `order:read:all`) không thuộc tập nào nên bị báo là chưa được phủ.
- **Đã sửa:** thêm bảng `BE02_ACTIONS` (3 dòng, đủ `action`/`allowed`/`why`) và cho nó vào
  **cả** phép đối chiếu phủ **và** `it.each` ma trận, nên ba action đó được kiểm thật chứ
  không chỉ được khai là "đã phủ". Thêm `order:expire` vào `ALL_WRITE_ACTIONS` vì đó là
  thao tác ghi.
- **Vì sao tách bảng riêng thay vì nhồi vào `NEW_ACTIONS`:** `NEW_ACTIONS` là ma trận của đúng
  10 hành động BE-08 (`docs/be-08-rbac-actions/design.md` §2), và `docs/tech-report.md` 3.3
  đang đếm theo con số đó. Nhồi chung là làm cả hai chỗ nói sai nguồn gốc của quyền.
- **Không sửa** `PERMISSIONS_BEFORE_BE08`: đó là mốc chống hồi quy "không vai nào MẤT quyền
  đã có trước BE-08", kiểm theo kiểu tập con nên vẫn đúng và vẫn có ích sau khi `dev` có thêm
  quyền của BE-02.

### 10.6. Kết quả kiểm chứng

`bash scripts/run-local-all.sh` từ gốc worktree — **xanh toàn bộ, 0 FAIL**:

```
########## TỔNG KẾT ##########
  Đạt:     6
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 1 - SPEC TEST CONTRACT EVM
    PASS  LỚP 1 - SPEC TEST CONTRACT SOROBAN
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST
  Không đạt: 0
  => ĐẠT toàn bộ kiểm chứng cục bộ.
```

- Luật kiến trúc: `PASS: 20  FAIL: 0  WARN: 6` — 6 cảnh báo là **có từ trước**, không liên
  quan tới BE-08 (spec Stellar chưa tới lượt, `BASE_REF` chưa đặt, `process.env`/địa chỉ EVM
  đã xác nhận có chủ đích).
- Vitest: **272 test / 11 file, pass hết**. Riêng `test/rbac.test.ts` **38 test**.
- Lint: 1 warning `src/empty.ts` — có từ trước, đã ghi ở bảng nợ kỹ thuật 1.6.C của báo cáo.

Kiểm bằng sự tồn tại, không tin diff:

```
test -f app/src/lib/rbac/demo-payment.ts     # CÓ
test -f docs/CHECKPOINT_BE08.md              # CÓ
ls docs/be-08-rbac-actions/                  # design.md requirements.md tasks.md
git grep -c "order:place" -- app/src/lib/rbac/permissions.ts   # 6 (BE-02 còn nguyên)
git grep -n '^<<<<<<<\|^>>>>>>>'             # rỗng
```

### 10.7. Trạng thái nhánh `fix/restore-be08`

Nền: `origin/dev` tại `9400467`. Làm trong worktree riêng `/tmp/wt-be08` để không phải
`git checkout` trong repo chính (repo chính đang ở `feat/wallet-connect` và có thư mục
untracked vốn được theo dõi trên `dev` → checkout sẽ vỡ).

**Chưa merge, và Kiro không tự merge.** Nhánh này phục hồi cả một tính năng nên cần Owner
nghiệm thu trước (`branching.md` §8). Không merge lại `origin/feat/rbac-actions`, không
cherry-pick, không force-push.
