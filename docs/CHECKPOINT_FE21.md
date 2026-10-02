# Báo cáo bàn giao — Task FE-21: Kênh Người bán

| | |
|---|---|
| Mã task | FE-21 |
| Nhánh | `feat/seller-channel`, tạo **từ `dev`** (`6f32d0a`, sau khi BE-12 merge — PR #30) |
| Spec | `docs/fe-21-seller-channel/{requirements,tasks}.md` — không có `design.md`, xem mục 4 DV-4 |
| Tiến độ | Bước 4/4 xong. Chờ Supervisor nghiệm thu — **không** merge vào `dev` |

> Quy tắc viết checkpoint: `.kiro/steering/checkpoint.md`.
> Máy kiểm: `node scripts/check-checkpoint.mjs docs/CHECKPOINT_FE21.md docs/fe-21-seller-channel/requirements.md`

---

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md`) | | Bằng chứng |
|---|---|---|---|
| 1 | Ba màn đúng bố cục tài liệu yêu cầu, thay hết trang chỗ trống | ✅ | mục 3.1 · 3.2 · 3.3 |
| 2 | Hạn mức đọc từ cấu hình, hỗ trợ cả hai chế độ, không viết cứng | ✅ | mục 3.4 |
| 3 | Vượt hạn mức thì khoá nút kèm cảnh báo | 🔶 | mục 3.4 · 5 CH-2 |
| 4 | Phần gọi nghiệp vụ rút có điểm cắm chờ BE-13, ghi rõ trên màn | ✅ | mục 3.5 · 5 CH-1 |
| 5 | Guard vai trò vẫn đúng | ✅ | mục 3.6 |
| 6 | `run-local-all.sh` xanh | ✅ | mục 3.7 · 4 DV-3 |

**Kết luận:** 5 ✅ · 1 🔶 · 0 ❌

### 0.2 Việc cần Owner quyết

- **CH-1 — mã `BE-13` chưa có trong lộ trình.** `requirements.md` nhắc BE-13 nhưng
  `.kiro/task-status.json` chưa có, nên marker `@pending BE-13` không qua được máy quét. Đã đặt
  `BE-13` vào `planned`. Xin xác nhận tên.
- **CH-2 — hạn mức và phí rút KHÔNG có mặc định, KHÔNG nạp sẵn.** Spec cấm viết cứng, nên chưa
  cấu hình thì màn rút khoá nút và hiện "—". Hệ quả: bản demo chưa có ai đặt ba khoá thì không thử
  được ca vượt hạn mức trên giao diện, và chưa có màn nào đặt được ba khoá này. Xin Owner cho giá
  trị để nạp sẵn ở `seed-data.ts`, hoặc chỉ định task làm màn cấu hình.
- **CH-3 — nghĩa của "mua" và "bán" ở khối khớp lệnh trong ngày.** Đã hiểu: *mua* = nhà đầu tư
  mua WPT từ Người bán (lệnh `COMPLETED` trong ngày, giờ Việt Nam); *bán* = bán lại, hệ thống
  chưa có nên hiện "—" kèm ghi chú. Cách hiểu khác: nhìn từ phía Người bán thì hai cột đảo nhau.
- **CH-4 — "dữ liệu của mình" = sổ lệnh và số dư của ví SPV trên chuỗi đang chọn.** Đúng khi
  mỗi chuỗi có một người bán. Có nhiều người bán thì lệnh phải mang ví người bán — đổi lược đồ.

---

## 1. Đã làm

| Commit | Mục tiêu |
|---|---|
| `c49b59a` | Spec vào repo; FE-21 sang `inProgress`; đặt trước `BE-13` (CH-1) |
| `bd1fddc` | Tầng nghiệp vụ chỉ đọc: `seller.service.ts`, `withdraw-limit.ts`, `readSupplyMetrics()`, ba khoá cấu hình, `actions/seller.ts`, test |
| `e5b729a` | Ba màn thay ba trang chỗ trống; sinh lại mục điểm cắm và sơ đồ luồng `issue` |
| (cuối) | Báo cáo công nghệ 2.8, FE-21 sang `done`, checkpoint này |

```
$ git diff --stat dev...HEAD | tail -1      # trước commit cuối
 19 files changed, 1418 insertions(+), 58 deletions(-)
```

## 2. Đối chiếu DoD

| Bước trong `tasks.md` | DoD | Đạt? | Ghi chú |
|---|---|---|---|
| 0 | FE-21 sang đang làm, `scan-pending --check` xanh | ✅ | `c49b59a` |
| 1 | Việc 1–7, ca 1 | ✅ | mục 3.1 |
| 2 | Việc 8–9, ca 2 | ✅ | mục 3.2 |
| 3 | Việc 10–15, ca 3, 4 | 🔶 | mục 3.3 · 3.4 |
| 4 | Ca 5, báo cáo công nghệ, trạng thái task, `run-local-all.sh` | ✅ | mục 3.6 · 3.7 |

## 3. Cách chạy / kiểm thử

Mức kiểm chứng **vừa**: test chức năng cho phần đã sửa, không đột biến.

```
$ cd app && npx vitest run test/seller-channel.test.ts
 ✓ test/seller-channel.test.ts (8 tests)
```

### 3.1 Ca 1 — Tổng quan đủ sáu khối, số liệu từ nghiệp vụ

Màn `/seller` (`components/pages/seller-overview.tsx`) gọi một server action `getSellerOverviewAction`
và chỉ định dạng số. Sáu khối: khớp lệnh trong ngày, nguồn cung **kèm định nghĩa từng chỉ tiêu**,
thông tin token, bảng tồn kho, tài sản ví thanh toán (khoá / còn rút được), số dư ví. Hai nút tắt là
liên kết, không có nút ghi.

Yêu cầu 16 (khớp màn Giao dịch viên): năm chỉ tiêu đi qua **một** hàm `readSupplyMetrics()` cạnh
`remainingIssuanceCap()`. Test đối chiếu từng con số với `getIssuanceStatus()` gọi bằng vai `TELLER`
trên cùng trạng thái chuỗi; chưa phân phối / lưu hành kiểm với số dư thật sau khi chuyển 300 WPT ra
ví nhà đầu tư.

### 3.2 Ca 2 — lọc và phân trang

`listSellerTransactions()`: lọc theo mã lệnh hoặc ví (không phân biệt hoa thường), loại, trạng
thái, khoảng ngày (giờ Việt Nam); phân trang `page`/`pageSize`. Test kiểm từng tiêu chí riêng và hai
trang không trùng dòng. Cột "bước hiện tại" suy từ trạng thái theo mô hình BE-02.

### 3.3 Màn Tạo lệnh rút

Biểu mẫu năm trường; khối "Hệ thống tính" hiện số dư, phần khoá, hạn mức, phí, số nhận được — bốn số
đầu là số thật từ máy chủ. Xác nhận qua hộp mã một lần sáu chữ số; xong thì thêm dòng vào bảng "Yêu
cầu rút của tôi" (dữ liệu tạm, xem 3.5).

### 3.4 Ca 3, 4 — hạn mức

- Ba khoá mới trong `SystemConfig`: `seller.withdraw_limit_mode` (`FIXED` | `PERCENT`),
  `seller.withdraw_limit_value`, `seller.withdraw_fee_vnd`. **Không mặc định trong mã**; thiếu hoặc
  hỏng → `null` → nút khoá.
- Ca 4: test đặt `FIXED 250` rồi đổi `PERCENT 30` trên cùng số dư 1.000, hạn mức đổi `750 → 700`;
  `PERCENT 130` thành "chưa cấu hình".
- Ca 3: `quoteWithdraw()` báo `exceedsLimit` khi số nhập hơn hạn mức một đồng. Nút gắn
  `disabled={!canSubmit}` với `canSubmit` gồm `!quote.exceedsLimit`; cảnh báo `role="alert"`.
  **Khoảng cách (🔶):** phần gắn vào nút chưa có kiểm thử giao diện tự động — dev server chạy
  bộ nhớ không có đường đặt ba khoá từ ngoài (CH-2). Đã thử tay trạng thái "chưa cấu hình" trên
  trình duyệt: ba số "—", nút khoá.

### 3.5 Điểm cắm BE-13

```
$ git grep -c "@pending BE-13" -- app/src
app/src/components/pages/seller-withdraw.tsx:1
$ node scripts/scan-pending.mjs --check
Marker hợp lệ: 34 điểm cắm, 12 điểm chặn, 35 bước luồng. Không có lỗi.
```

Marker gắn trên hàm `confirm` — BE-13 chỉ thay thân hàm. Dùng `@pending` vì spec gọi là "điểm cắm"
và giao diện đã chạy. Trên màn có khung "Chờ BE-13 … dữ liệu tạm", bảng yêu cầu mang nhãn dữ liệu
mẫu. Ba marker `@pending FE-21` trên trang chỗ trống đã gỡ (36 → 34 = −3 +1).

```
$ grep -rl PlaceholderPage app/src/app | wc -l
8
```

### 3.6 Ca 5 — guard vai trò

- Tầng service: `INVESTOR`, `TELLER`, `CONTROLLER` gọi cả hai hàm đều nhận `FORBIDDEN` (3 test).
- Tầng route: `four-roles-routes.test.ts` của FE-20 vẫn xanh, không sửa.
- Trình duyệt: cookie `bidv_role=TELLER` vào `/seller/withdraw` → "Không có quyền vào kênh Người bán".
- Bảng quyền không đổi: `SELLER` không nhận quyền ghi nào.

### 3.7 Cổng kiểm chứng

```
$ bash scripts/run-local-all.sh        # lần 1
    FAIL  APP - VITEST   (mục điểm cắm của tech-report lạc hậu — DV-3)
$ node scripts/scan-pending.mjs --write-report
$ bash scripts/run-local-all.sh        # lần 2 — kết quả ở cuối, mục 3.8
```

### 3.8 Kết quả lần chạy cuối

```
$ bash scripts/run-local-all.sh
    PASS  luật kiến trúc (có cảnh báo)   — 20 PASS · 0 FAIL · 3 WARN, ba cảnh báo có từ trước (FE-20 mục 3.9)
    PASS  LỚP 3 - ĐIỂM CẮM (marker)
    PASS  LỚP 3 - KHUÔN CHECKPOINT
    PASS  LỚP 1 - SPEC TEST CONTRACT EVM
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST                 — 23 tệp · 619 test
  => ĐẠT các phần đã chạy: arch markers checkpoint contracts app
exit=0
$ node scripts/check-checkpoint.mjs docs/CHECKPOINT_FE21.md docs/fe-21-seller-channel/requirements.md
ĐẠT  mục 0: 29/60 dòng · 6 dòng / 6 điều kiện · 5 ✅ 1 🔶 0 ❌
```

Nền `dev` có 611 test / 22 tệp; FE-21 thêm một tệp, 8 test (`619 − 8`).

## 4. DEVIATION so với spec

- **DV-1 — thêm `readSupplyMetrics()` vào `issuance.service.ts`.** Không đổi hành vi hàm nào có
  sẵn; số dòng dịch nên sinh lại `docs/flows/issue.md`. Khối kiểm tra Burn của BE-12 vẫn tự tính
  cùng công thức, **không** chuyển sang hàm mới để không chạm mã BE-12 — hai chỗ cùng công thức.
- **DV-2 — tài liệu tách khỏi commit mã**, như FE-20: commit cuối gộp báo cáo + trạng thái task.
- **DV-3 — `run-local-all.sh` chạy hai lần**, trái "đúng một lần". Lần 1 đỏ vì mục điểm cắm trong
  báo cáo nhóm theo trạng thái task, và FE-21 vừa sang `done`.
- **DV-4 — spec chỉ hai tệp, nằm ở `docs/`** (như FE-20 CH-4).
- **Không thêm ca e2e.** Mức vừa; ca 5 tầng route đã có test đọc cây route thật.

## 5. Câu hỏi mở

Xem 0.2 (CH-1 … CH-4).

## 6. Tự đánh giá 3 LUẬT kiến trúc

- [x] Mọi call chain qua `ILedgerPort` — `seller.service` dùng `getLedger()`
- [x] Mọi ký qua `ISigner` — FE-21 không ký gì
- [x] Mọi kiểm quyền qua RBAC — `authorize('seller:read', …)` trong service
