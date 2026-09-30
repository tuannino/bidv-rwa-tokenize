# Báo cáo bàn giao — Task FE-20: Khung bốn vai trò theo tài liệu yêu cầu

| | |
|---|---|
| Mã task | FE-20 |
| Nhánh | `feat/four-roles-shell`, tạo **từ `dev`** (`a9a60c6`) |
| Spec | `docs/fe-20-four-roles/{requirements,tasks}.md` — **không có `design.md`**, xem mục 5 CH-4 |
| Tiến độ | Bước 5/5 xong. Chờ Supervisor nghiệm thu — Kiro **không** merge vào `dev` |

> Quy tắc viết checkpoint: `.kiro/steering/checkpoint.md`.
> Máy kiểm: `node scripts/check-checkpoint.mjs docs/CHECKPOINT_FE20.md docs/fe-20-four-roles/requirements.md`

---

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md`) | | Bằng chứng |
|---|---|---|---|
| 1 | Bốn vai trò mới thay bốn vai cũ, cơ chế `can` giữ nguyên | ✅ | mục 3.1 · 3.4 |
| 2 | Bộ chọn đủ bốn vai kèm mã tài khoản mẫu; bộ chọn vai cũ đã gỡ | ✅ | mục 3.2 · 3.5 |
| 3 | Bốn nhóm menu đúng tài liệu yêu cầu | ✅ | mục 3.2 · 3.4 |
| 4 | Mỗi vai chỉ vào được khu vực của mình, có kiểm thử cả hai chiều | ✅ | mục 3.3 · 3.4 |
| 5 | Mọi màn chưa làm có trang chỗ trống ghi rõ task thay thế | 🔶 | mục 3.3 · 4 DV-1 · 5 CH-1 |
| 6 | Số việc chờ hiển thị cạnh menu, có điểm cắm chờ backend | ✅ | mục 3.3 · 3.6 |
| 7 | Ba màn đã có vẫn chạy bình thường | ✅ | mục 3.5 · 3.7 |
| 8 | Không còn tệp nào nhắc hai vai trò cũ | 🔶 | mục 3.8 · 4 DV-2 |
| 9 | `run-local-all.sh` xanh | ✅ | mục 3.9 |

**Kết luận:** 7 ✅ · 2 🔶 · 0 ❌

### 0.2 Việc cần Owner quyết

- **CH-1 — năm mã task đặt trước.** Yêu cầu 8 và 11 bắt mỗi trang chỗ trống ghi task sẽ thay,
  nhưng lộ trình **chưa có mã** cho năm việc. Đã đặt `BE-12`, `FE-21`, `FE-22`, `FE-23`, `FE-24`
  vào `planned` kèm giải thích ở khoá `_reservedByFE20`. Xin Owner xác nhận tên hoặc đổi tên.
- **CH-2 — `FALLBACK_ROLE` đổi sang `SELLER`.** `requirements.md` không nói tới, mà vai cũ giữ
  chỗ này đã bị gỡ nên buộc phải chọn. Đề xuất giữ `SELLER`; lý do ở mục 5.
- **CH-3 — `/mint`, `/kyc`, `/assets`, `/reconciliation`, `/audit` nay KHÔNG có trong menu.**
  Mã vẫn chạy, vào được bằng đường dẫn. Xin Owner xác nhận để FE-22 gộp hoặc bỏ.
- **CH-4 — spec chỉ có hai tệp và nằm ở `docs/`, không ở `.kiro/specs/`.** Trái
  `branching.md` §11. Xin Owner xác nhận trước khi mở PR.

---

## 1. Đã làm

Năm commit, chia theo mục tiêu:

| Commit | Mục tiêu |
|---|---|
| `be8c0ea` | Spec vào repo; FE-20 sang `inProgress`; đặt trước năm mã task (CH-1) |
| `e822280` | Bốn vai trò + bốn cổng khu vực trong `lib/rbac`; gỡ `role-switcher`; sửa mọi test nhắc vai cũ |
| `fdcac36` | Bốn khu vực một-một với vai; bộ chọn bốn vai; bốn nhóm menu; nguồn số việc chờ |
| `2d7f797` | Bảy route-group; 11 trang chỗ trống; thêm `wallet:connect`; cập nhật e2e |

| `651b91e` | Báo cáo công nghệ 2.6, FE-20 sang `done`, checkpoint này |

Commit cuối gộp tài liệu + trạng thái task theo `docs/tech-report-maintenance.md` §3.

```
$ git diff --stat dev...HEAD | tail -1
 73 files changed, 2926 insertions(+), 604 deletions(-)
```

### Thay đổi chính, theo thứ tự phụ thuộc

1. **`ROLES` = `INVESTOR | SELLER | TELLER | CONTROLLER`.** `TELLER` là vai ngân hàng cũ đổi tên,
   **giữ nguyên bộ quyền**. `CONTROLLER` nhận phần chỉ-đọc của hai vai đã gỡ.
2. **Năm action mới**, tất cả là cổng hiển thị: `seller:read`, `wallet:connect`, `ops:read`,
   `ops:draft:read`, `ops:approve:read`. Bảng `ACTIONS` chỉ **thêm**, không bớt.
3. **Bốn khu vực ↔ bốn vai, một-một** (`CHANNEL_ROLE`). Bộ chọn khu vực và bộ chọn vai nhập
   thành một ô; `role-switcher.tsx` đã xoá.
4. **`NavSection` đổi thành danh sách nhóm.** Kiểm soát viên cần ba nhóm theo tài liệu.
5. **Bảy route-group**, mỗi group một cổng, bảng cổng ở `lib/rbac/area-gates.ts`.
6. **11 trang chỗ trống** dùng chung `PlaceholderPage`.
7. **Số việc đang chờ** cạnh hai mục tài liệu chỉ định, nguồn số ở `lib/nav/pending-work.ts`.

## 2. Đối chiếu DoD

| Bước trong `tasks.md` | DoD | Đạt? | Ghi chú |
|---|---|---|---|
| 0 | FE-20 có trong danh sách trạng thái, `scan-pending --check` xanh | ✅ | mục 3.6 |
| 1 | Việc 1–2, sửa test nhắc vai cũ, ca 1 | ✅ | mục 3.1 · 3.8 |
| 2 | Việc 3–5, bốn nhóm menu, ca 6 | ✅ | mục 3.2 |
| 3 | Việc 6–9, ca 2/3/4/5/7 | 🔶 | mục 3.3 · 4 DV-1 |
| 4 | Việc 10–11, `scan-pending --check` xanh | ✅ | mục 3.6 |
| 5 | Báo cáo công nghệ, trạng thái task, `run-local-all.sh` một lần | ✅ | mục 3.9 · 3.10 |

## 3. Cách chạy / kiểm thử

Mọi lệnh chạy từ gốc repo trừ khi ghi khác. Mức kiểm chứng của spec là **vừa**, nên không dựng
đột biến nào — `requirements.md` không chỉ định.

### 3.1 Ca 1 — bốn vai mới, hai vai cũ không còn

```
$ cd app && npx vitest run test/rbac.test.ts
Test Files  1 passed (1)
     Tests  48 passed (48)
```

Ba ca trong `describe('RBAC — bốn vai trò theo tài liệu yêu cầu (FE-20 ca 1)')` kiểm **cả hai
chiều**: bốn vai mới có mặt theo đúng thứ tự, và ba tên cũ (`BANK_ADMIN`, `COMPLIANCE`,
`AUDITOR`) vừa không có trong `ROLES` vừa bị `isRole()` từ chối. Chỉ kiểm chiều "có mặt" thì
một lần thêm lại vai cũ sẽ lọt, mà thêm lại là đủ để `FALLBACK_ROLE` quay về một vai không có
trong tài liệu.

**Cơ chế `can` giữ nguyên:** `can.ts` không đổi một dòng logic nào.

```
$ git diff dev...HEAD -- app/src/lib/rbac/can.ts | grep -c '^[-+][^-+]'
2
```

Hai dòng đó là **một câu chú thích** bị đổi (nó nêu tên vai cũ) — xem mục 4 DV-2.

### 3.2 Ca 6 + menu — `test/four-roles-shell.test.ts`

```
$ cd app && npx vitest run test/four-roles-shell.test.ts
Test Files  1 passed (1)
     Tests  19 passed (19)
```

Bảng `URD_MENU` trong tệp test **chép nguyên văn** bảng "Menu theo tài liệu yêu cầu" của
`requirements.md`, rồi so với `NAV_BY_ROLE`. Chép vào test thay vì đọc tệp tài liệu là có chủ ý:
đọc tệp thì một lần ai sửa tài liệu là test tự xanh theo và không ai biết giao diện đã lệch bản
đã chốt.

Ngoài bốn menu, tệp còn chốt: phím tắt không trùng trong cùng menu, đường dẫn không trùng, menu
khách hàng không lẫn mục vận hành và ngược lại, `CHANNEL_ROLE` ↔ `ROLE_CHANNEL` là hai chiều của
cùng một quan hệ, và **trang mặc định của mỗi vai nằm trong menu của vai đó** (hạ cánh vào trang
không có trong menu là trạng thái không chỉ ra được đường về).

### 3.3 Ca 2, 3, 4, 5, 7 — `test/four-roles-routes.test.ts`

```
$ cd app && npx vitest run test/four-roles-routes.test.ts
Test Files  1 passed (1)
     Tests  22 passed (22)
```

Tệp này **đọc cây route thật trên đĩa** rồi đối chiếu, không chỉ kiểm hằng số. Lý do: cây route
của App Router là thư mục, không phải một bảng ai đó khai, nên hai lỗi dưới đây không thể phát
hiện bằng cách đọc hằng số và cũng lọt qua `tsc`:

- một mục menu trỏ tới đường dẫn **không có trang**;
- một trang nằm **ngoài mọi route-group**, tức không cổng nào, mà cũng không có chỗ nào ghi rằng
  đó là chủ ý (`/` từng ở tình trạng này trước FE-20).

Nó còn đọc **tệp layout thật** để bắt ca `AREA_GATES` đúng mà layout nối sai cổng.

Bảng `EXPECTED_ACCESS` viết tường minh, **không** suy từ `AREA_GATES` — suy từ chính thứ đang
kiểm thì phép kiểm luôn xanh:

| Khu vực | Route group | Cổng | Vai vào được |
|---|---|---|---|
| Nhà đầu tư | `(investor)` | `portfolio:read` | INVESTOR |
| Người bán | `(seller)` | `seller:read` | SELLER |
| Vận hành | `(ops)` | `ops:read` | TELLER, CONTROLLER |
| Lập lệnh | `(ops-draft)` | `ops:draft:read` | TELLER |
| Phê duyệt lệnh | `(control)` | `ops:approve:read` | CONTROLLER |
| Kết nối ví | `(wallet)` | `wallet:connect` | INVESTOR, SELLER |
| Thông tin tài khoản | `(account)` | `balance:read` | cả bốn |

```
$ ls -d app/src/app/\(*\) | wc -l
7
$ grep -rl PlaceholderPage app/src/app | wc -l
11
```

Một phép kiểm riêng cho bất biến của mô hình lập–duyệt: **không vai nào giữ cả hai cổng**
`ops:draft:read` và `ops:approve:read`. Đọc từng dòng bảng quyền thì loại lỗi này rất khó thấy.

### 3.4 Ma trận quyền và ba hành động dễ thành vô chủ

Bảng đầy đủ 29 action ở `docs/tech-report.md` §3.3. Hai điểm đáng nêu riêng:

- `FE20_AREA_GATES` trong `rbac.test.ts` liệt kê vai **được phép** cho từng cổng, rồi phép kiểm
  chạy vòng qua `ROLES` nên chiều "bị chặn" được kiểm **tự động**, không phải liệt kê tay.
- Phép kiểm "ba quyền của vai tuân thủ cũ vẫn có chủ, và chủ đó là `TELLER`". Gỡ một vai mà
  không kiểm chỗ này thì quyền của nó thành **vô chủ**: bảng vẫn khai hành động, số đếm không
  giảm nên `verify-arch-rules.sh` vẫn xanh, mà không ai làm được việc đó nữa.

```
$ bash scripts/run-local-all.sh arch 2>&1 | grep "Bảng quyền"
  PASS  Bảng quyền không teo lại so với origin/dev (24 -> 29 hành động)
```

### 3.5 Ca 2, 3, 6, 7 ở tầng giao diện thật — Playwright

```
$ cd app && npx playwright test
36 passed (24.6s)
```

Ca mới hoặc viết lại đáng nêu:

| Ca | Kiểm |
|---|---|
| bộ chọn có bốn vai kèm mã tài khoản | bốn `option` đúng thứ tự: NDT001 / NB001 / GDV001 / KSV001; và `#role-switcher` có **0** phần tử |
| đổi sang INVESTOR / SELLER / CONTROLLER | về đúng trang mặc định **và** menu đổi theo (kiểm cả hai trong một ca: điều hướng đúng mà menu còn của vai cũ thì người dùng thấy mục mình bị chặn) |
| menu Kiểm soát viên | đủ ba nhóm Vận hành / Kiểm soát / Tài khoản, có "Phê duyệt lệnh", **không** có "Lập lệnh" |
| mọi mục menu bấm được | `[aria-disabled="true"]` có **0** phần tử — FE-20 bỏ mục menu mờ |
| bấm mục chỗ trống | ra `/trade`, thấy tiêu đề và nhãn "chờ FE-05" |
| số việc đang chờ | đúng **một** mục mang số ở mỗi vai vận hành, giá trị `0` |
| Nhà đầu tư vào `/mint` | màn từ chối |
| Kiểm soát viên vào `/mint` | **vào được trang** nhưng nút Phát hành bị vô hiệu kèm `title` nói vai thiếu quyền — cổng khu vực và quyền nghiệp vụ là hai lớp khác nhau |
| TELLER / CONTROLLER vào `/wallet` | bị chặn |
| SELLER vào `/wallet` | **vào được**, và menu có mục Kết nối ví |

**Ba màn đã có vẫn chạy** (ca 7): `/portfolio` bốn hộp, `/tokens/WPT-QTR3` và `/tokens/WPT` chi
tiết dự án, `/tokens/KHONG-CO-THAT` trả 404, `/wallet` đủ bốn trạng thái ví. Toàn bộ ca của
`investor-channel.spec.ts` và `wallet-connect.spec.ts` có từ trước đều xanh.

### 3.6 Điểm cắm

```
$ node scripts/scan-pending.mjs --check
Marker hợp lệ: 32 điểm cắm, 12 điểm chặn, 35 bước luồng. Không có lỗi.
```

Nền `dev` có 19 điểm cắm, nay 32 — FE-20 thêm **13**: 11 trên trang chỗ trống, 1 ở
`pendingWorkCounts` (`BE-12`), 1 ở `setDemoRole` (`AU-01`). Số điểm **chặn** không đổi (12).

```
$ git worktree add /tmp/dev-check dev && cd /tmp/dev-check && node scripts/scan-pending.mjs | tail -1
Tổng: 19 điểm cắm · 12 điểm chặn · 35 bước luồng
```

Marker trên trang chỗ trống dùng `@pending`, không `@blocked`: route, cổng và mục menu **đã chạy
được**, task sau chỉ thay phần thân. Phần sau dấu `|` nói đúng thứ người nhận task cần —
họ không phải dựng lại đường dẫn, guard, menu.

Mục điểm cắm trong `docs/tech-report.md` và `docs/flows/purchase.md` đã **sinh lại** bằng
`scan-pending.mjs --write-report` và `gen-flow-diagram.mjs purchase`, không sửa tay.

### 3.7 Build

```
$ cd app && npx next build
✓ Compiled successfully in 7.8s
Route (app)  —  29 route, tất cả ƒ (Dynamic)
```

### 3.8 Tệp còn nhắc vai cũ

```
$ grep -rln "COMPLIANCE\|AUDITOR" app/src app/test app/e2e
app/test/rbac.test.ts
$ grep -rln "BANK_ADMIN" app/src app/test app/e2e
app/src/lib/rbac/permissions.ts
app/test/rbac.test.ts
```

Trong `app/src` **không còn** `COMPLIANCE`/`AUDITOR`. Hai chỗ còn lại là có chủ ý — xem mục 4 DV-2.

### 3.9 Cổng kiểm chứng đầy đủ

```
$ bash scripts/run-local-all.sh
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 3 - ĐIỂM CẮM (marker)
    PASS  LỚP 3 - KHUÔN CHECKPOINT
    PASS  LỚP 1 - SPEC TEST CONTRACT EVM
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST
  => ĐẠT các phần đã chạy: arch markers checkpoint contracts app
exit=0
```

Ba cảnh báo ở phần `arch` là **có từ trước FE-20**, không phải nhánh này sinh ra. Đã đối chiếu
bằng cách chạy chính script đó trên nền `dev`, ra **giống hệt ba dòng**:

```
$ git worktree add /tmp/dev-check dev && cd /tmp/dev-check && bash scripts/verify-arch-rules.sh
  WARN  process.env đọc ngoài lib/config (kiểm tra xem có phải biến công khai):
  WARN  Địa chỉ EVM hardcode trong app/src (xác nhận có chủ đích):
  WARN  Chưa đặt BASE_REF nên bỏ qua so sánh contract.
  PASS: 20   FAIL: 0   WARN: 3
```

`check-checkpoint.mjs --in-progress` in "Không có task nào ở inProgress — bỏ qua" vì FE-20 đã
sang `done` trong cùng commit cuối. Đã kiểm tường minh:

```
$ node scripts/check-checkpoint.mjs docs/CHECKPOINT_FE20.md docs/fe-20-four-roles/requirements.md
ĐẠT     docs/CHECKPOINT_FE20.md
  mục 0: 29/60 dòng · bảng đối chiếu 9 dòng / 9 điều kiện · 7 ✅ 2 🔶 0 ❌ · cả tệp 43/800 dòng
```

(Con số "cả tệp 43" là lúc tệp mới có mục 0; bản nộp dài hơn, vẫn dưới ngưỡng 800.)

### 3.10 Vitest toàn bộ

```
$ cd app && npx vitest run
Test Files  21 passed (21)
     Tests  568 passed (568)
```

Nền `dev` có 526 test / 19 tệp. FE-20 thêm hai tệp và 42 test.

## 4. DEVIATION so với spec

### DV-1 — Trang chỗ trống của năm màn chưa có mã task thật (điều kiện 5 ở mức 🔶)

`requirements.md` yêu cầu mỗi trang chỗ trống "ghi rõ task nào sẽ thay thế". **11/11 trang đều
ghi**, nhưng 7 trong số đó trỏ tới mã task do FE-20 **tự đặt trước**, vì lộ trình chưa có mã:

| Trang | Task ghi trên trang | Mã có thật trước FE-20? |
|---|---|---|
| `/trade` | FE-05 | có |
| `/orders`, `/transactions` | FE-06 | có |
| `/distribution` | FE-08 | có |
| `/seller`, `/seller/transactions`, `/seller/withdraw` | FE-21 | **không** |
| `/draft`, `/approvals` | FE-22 | **không** |
| `/withdraw` | FE-23 | **không** |
| `/account` | FE-24 | **không** |

Cộng `BE-12` cho nguồn số việc chờ là **năm mã** đặt trước. Đánh 🔶 chứ không ✅ vì điều kiện
này chỉ đạt trọn khi Owner xác nhận tên (CH-1). Nếu Owner đổi tên thì sửa bằng một lần `grep`:

```
$ git grep -l "FE-21\|FE-22\|FE-23\|FE-24\|BE-12"
```

**Vì sao không DỪNG lại hỏi rồi mới làm:** đây không phải "không hiểu ý" theo `workflow.md` — yêu
cầu rõ, chỉ là dữ liệu nó tham chiếu chưa tồn tại. Chọn cách đặt trước vì nó rẻ và đảo được
(một lần `grep`), còn treo cả task để chờ một cái tên thì chặn luôn bảy task đợt 1 phía sau.

### DV-2 — Sửa chú thích ở bốn tệp mà "Không làm" nói đừng đụng

`requirements.md` ghi "Không sửa `channel-guard.tsx`, `can.ts`" và "Không đụng `lib/bank`". Nhưng
điều kiện 8 đòi "không còn tệp nào nhắc hai vai trò cũ", và bốn tệp dưới đây nêu tên vai cũ
**trong chú thích**:

| Tệp | Đã sửa gì | Thay đổi hành vi |
|---|---|---|
| `lib/rbac/can.ts` | một câu chú thích: "quy về AUDITOR" → "quy về `FALLBACK_ROLE`" | không |
| `lib/rbac/demo-payment.ts` | hai câu chú thích | không |
| `lib/bank/distribution.service.ts` | một câu chú thích | không |
| `lib/bank/mint.service.ts` | một câu chú thích | không |

`channel-guard.tsx` **không sửa một dòng nào**:

```
$ git diff --stat dev...HEAD -- app/src/components/layout/channel-guard.tsx
(rỗng)
```

Hai lệnh cấm mâu thuẫn nhau ở đúng bốn dòng chú thích. Chọn sửa chú thích vì một chú thích nêu
tên vai không còn tồn tại là chú thích **sai**, và nó sai theo cách tệ nhất: người đọc tin nó.

**Hai chỗ CÒN LẠI nêu tên vai cũ, và giữ là có chủ ý:**

- `app/test/rbac.test.ts` — ca 1 của chính spec này là "hai vai trò cũ không còn", nên test
  **buộc phải** nêu tên để phát biểu điều đó. Gỡ tên đi là gỡ luôn phép kiểm.
- `app/src/lib/rbac/permissions.ts` — hai câu chú thích nêu `BANK_ADMIN` để nói "`TELLER` là vai
  này đổi tên, giữ nguyên quyền". `BANK_ADMIN` **không** thuộc "hai vai trò cũ" mà điều kiện 8 nói
  tới (`requirements.md` xác định hai vai đó là tuân thủ và kiểm toán), và câu chú thích này là
  thứ duy nhất giải thích vì sao `TELLER` giữ trọn bộ quyền cũ.

### DV-3 — Thêm `wallet:connect`, không nằm trong 11 việc của spec

Spec liệt kê bốn cổng khu vực ứng với bốn vai. Khi dựng đến `/wallet` thì phát hiện tài liệu yêu
cầu cho mục **Kết nối ví** ở **cả** Nhà đầu tư và Người bán, nên không cổng nào trong bốn cổng đó
dùng được:

- để `/wallet` trong `(investor)` thì Người bán bị chặn khỏi ví của chính mình;
- dùng `balance:read` làm cổng thì cả bốn vai qua, tức mở trang kết nối ví cho hai vai vận hành —
  ngược thiết kế FE-02 R7.2 (thao tác đặc quyền của ngân hàng ký bằng khóa phía máy chủ qua
  `ISigner`), và làm mất một phép kiểm e2e đang có.

Thêm một quyền là cách duy nhất giữ được cả hai. Nằm trong "thêm quyền tối thiểu để dựng menu và
guard" (việc 2), không phải quyền nghiệp vụ lập/duyệt mà spec cấm.

### DV-4 — Đổi hình dạng `NavSection` và bỏ prop `nav` của `AppLayout`

Spec nói "mở rộng, không viết lại" cơ chế `nav-config`. Hai chỗ phải đổi hình dạng:

- `NavSection` từ `{ main, moduleLabel, modules }` sang danh sách nhóm. Kiểm soát viên cần **ba**
  nhóm theo tài liệu; hình dạng cũ chỉ chứa được hai.
- `AppLayout` bỏ prop `nav`, tự suy từ `currentRole()`. Bốn vai và hơn mười trang nghĩa là hơn
  mười chỗ truyền tay có thể truyền sai, mà truyền sai thì không có gì báo: trang vẫn kết xuất,
  chỉ bày menu của vai khác.

## 5. Câu hỏi mở

### CH-1 — Năm mã task đặt trước: `BE-12`, `FE-21`, `FE-22`, `FE-23`, `FE-24`

**Tình huống.** Yêu cầu 8 và 11 bắt mỗi trang chỗ trống ghi task sẽ thay, và
`.kiro/task-status.json` là nguồn duy nhất về **tập mã task hợp lệ** — marker ghi mã ngoài tập đó
thì `scan-pending.mjs --check` đỏ. Nhưng lộ trình chỉ có mã cho ba trong số các màn cần chỗ trống.
Đã kiểm hết các mã `planned` sẵn có, không mã nào khớp:

```
$ git grep -n "BE-10\|BE-11" -- docs/be-02-purchase-orders/requirements.md
77:- Đối soát toàn hệ (thuộc BE-11).
78:- Xử lý giao dịch treo dùng chung (thuộc BE-10).
```

`FE-04` là tổng quan nhà đầu tư, `FE-10` không có mô tả nào trong repo.

**Hai cách hiểu.** (a) Đặt trước mã rồi làm tiếp. (b) Dừng, chờ Owner đặt tên.

**Đã chọn (a).** Ý nghĩa từng mã ghi trong khoá `_reservedByFE20` của `.kiro/task-status.json`:

| Mã | Việc |
|---|---|
| `BE-12` | nghiệp vụ lập lệnh + phê duyệt (maker-checker) và số việc đang chờ thật |
| `FE-21` | kênh Người bán: Tổng quan, Danh sách giao dịch, Tạo lệnh rút |
| `FE-22` | màn Lập lệnh (Giao dịch viên) và Phê duyệt lệnh (Kiểm soát viên) |
| `FE-23` | màn Rút VNDB của Nhà đầu tư |
| `FE-24` | màn Thông tin tài khoản dùng chung bốn vai |

**Cần Owner:** xác nhận tên, hoặc cho tên khác. Đổi tên là một lần `grep` (mục 4 DV-1).

### CH-2 — `FALLBACK_ROLE` đổi sang `SELLER`

`requirements.md` không nói tới, nhưng vai kiểm toán cũ vốn giữ chỗ này đã bị gỡ nên buộc phải
chọn lại. Trong bốn vai mới, **hai** vai sạch quyền ghi (`SELLER` và `CONTROLLER`), nên "không có
quyền ghi" không phải tiêu chí phân biệt. Thứ phân biệt là **dữ liệu toàn hệ**:

| | quyền ghi | `audit:read` | `order:read:all` | `reconcile:read` |
|---|:--:|:--:|:--:|:--:|
| `SELLER` | không | không | không | không |
| `CONTROLLER` | không | **có** | **có** | **có** |

Chọn `CONTROLLER` là biến một cookie gõ sai thành quyền xem sổ kiểm toán. Đã chọn `SELLER`, và có
phép kiểm chốt rằng nó vẫn là vai có bộ quyền **nhỏ nhất** — nếu vai khác teo xuống nhỏ hơn thì
test đỏ và buộc phải xem lại lựa chọn này.

**Cần Owner:** xác nhận. Nếu Owner muốn "vai lạ = không quyền gì" thì đó là đổi `can()` — trái
"Không sửa `can.ts`", nên phải là task riêng.

### CH-3 — Năm màn cũ nay không có trong menu

`/mint`, `/kyc`, `/assets`, `/reconciliation`, `/audit` **vẫn còn mã và vào được bằng đường dẫn**
(đều trong `(ops)`, cổng `ops:read`), nhưng không có trong bốn menu, vì tài liệu yêu cầu không có
chúng và điều kiện 3 đòi menu khớp tài liệu. Spec cũng cấm xoá mã.

Có phép kiểm chốt **cả hai chiều** — mã còn, và menu không có — nên trạng thái này không thể trôi
đi trong im lặng. Trang `/draft` ghi lại việc này cho FE-22.

Hệ quả cần biết: **luồng mint không còn bấm tới được từ menu**, dù `product.md` đặt nó là ưu tiên
số 1. E2E vẫn kiểm luồng này qua đường dẫn trực tiếp.

**Cần Owner:** (a) chấp nhận, để FE-22 gộp chúng vào Lập lệnh; (b) thêm tạm một mục vào menu Giao
dịch viên (lệch tài liệu); hay (c) bổ sung tài liệu. Đề xuất (a).

### CH-4 — Spec chỉ có hai tệp và không nằm ở `.kiro/specs/`

Spec ở `docs/fe-20-four-roles/` với `requirements.md` + `tasks.md`, **không có `design.md`**.
`branching.md` §11 đòi "có spec trong `.kiro/specs/<tên>/` đủ 3 file" cho nhánh có thay đổi mã;
`efficiency.md` §5 thì nói `design.md` "chỉ có khi có quyết định dễ bị hiểu sai".

Không tự di chuyển hay tự thêm tệp: spec là tài liệu giao việc của Supervisor.

**Cần Owner:** xác nhận bỏ qua ô này trong danh sách tự kiểm, hoặc bảo Kiro chuyển spec sang
`.kiro/specs/fe-20-four-roles/`.

### CH-5 — Nhãn menu "Kết nối ví" nhưng tiêu đề trang là "Ví của tôi"

Tài liệu yêu cầu đặt tên mục menu là **Kết nối ví**; trang có từ FE-02 đặt tiêu đề **Ví của tôi**.
Điều kiện 7 nói giữ nguyên màn đã có nên không sửa tiêu đề. Lệch nhỏ, không sai chức năng.

**Cần Owner:** để nguyên, hay đổi một trong hai cho khớp.

### CH-6 — Không có ca kiểm thử nào cho `setDemoRole`

Hàm còn lại sau khi gỡ bộ chọn vai, hiện **không ai gọi**, đã gắn `@pending AU-01`. Giữ vì nó là
cách duy nhất đặt vai **không kèm điều hướng** — thứ AU-01 cần khi dựng phiên xong rồi trả người
dùng về trang đang mở. Nếu Owner thấy nên xoá thay vì giữ, nói để Kiro gỡ.

## 6. Tự đánh giá 3 LUẬT kiến trúc

- [x] **Mọi call chain qua `ILedgerPort`.** FE-20 không thêm lời gọi chuỗi nào. `verify-arch-rules.sh`:
      `PASS viem/ethers không xuất hiện ngoài app/src/lib`, `PASS Không có lời gọi contract trực tiếp
      trong components/ và app/`.
- [x] **Mọi ký qua `ISigner`.** Không thêm chỗ ký nào. `PASS SERVER_SIGNER_PRIVATE_KEY chỉ đọc ở
      env.ts và server.signer.ts`. Quyền `wallet:connect` chỉ mở **trang**, không tự ký gì.
- [x] **Mọi kiểm quyền qua RBAC.** Bảy layout khu vực đều đi qua `ChannelGuard` → `can()`; cổng để ở
      `AREA_GATES` chứ không `if` trong JSX. `PASS Không có so sánh role cứng ngoài lib/rbac`.
      Bảng quyền **chỉ thêm**: `PASS Bảng quyền không teo lại so với origin/dev (24 -> 29 hành động)`.
