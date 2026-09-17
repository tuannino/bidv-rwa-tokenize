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
