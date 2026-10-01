# Báo cáo bàn giao — Task BE-12: Lập lệnh và phê duyệt Mint, Burn

| | |
|---|---|
| Mã task | BE-12 |
| Nhánh | `feat/maker-checker`, tạo **từ `dev`** (`ae7e248`, sau khi FE-20 merge — PR #29) |
| Spec | `docs/be-12-maker-checker/{requirements,tasks}.md` — không có `design.md` |
| Tiến độ | Bước 5/5 xong. Chờ Supervisor nghiệm thu — Kiro **không** merge vào `dev` |

> Quy tắc viết checkpoint: `.kiro/steering/checkpoint.md`.
> Máy kiểm: `node scripts/check-checkpoint.mjs docs/CHECKPOINT_BE12.md docs/be-12-maker-checker/requirements.md`

---

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md`) | | Bằng chứng |
|---|---|---|---|
| 1 | Bảng yêu cầu và cổng lưu trữ hoạt động ở cả hai bản | ✅ | mục 3.1 (bộ nhớ + Postgres thật) |
| 2 | Giao dịch viên lập, Kiểm soát viên duyệt, không vai nào có cả hai | ✅ | mục 3.2 · 3.3 ca 3 |
| 3 | Yêu cầu chờ duyệt không tác động token; duyệt mới tác động | ✅ | mục 3.3 ca 2 · ca 3 |
| 4 | Người lập không duyệt được yêu cầu của chính mình | ✅ | mục 3.3 ca 5 |
| 5 | Duyệt kiểm lại điều kiện tại thời điểm duyệt | ✅ | mục 3.4 đột biến 2 |
| 6 | Hai lần duyệt đồng thời chỉ tác động một lần | ✅ | mục 3.4 đột biến 1 · 3.1 |
| 7 | Phát hành nhiều lần theo trần còn lại; không còn chốt một lần | ✅ | mục 3.5 ca 7 |
| 8 | Số việc đang chờ đếm đúng, điểm cắm FE-20 đã gỡ | ✅ | mục 3.3 ca 8 · 3.6 |
| 9 | `run-local-all.sh` xanh | ✅ | mục 7 (lần 2; lần 1 đỏ vì bộ đệm `.next` cũ) |

**Kết luận:** 9 ✅ · 0 🔶 · 0 ❌

### 0.2 Việc cần Owner quyết

- **CH-1 — Giao dịch viên vẫn Mint/Burn TRỰC TIẾP được** (`token:mint`, `token:burn` giữ nguyên),
  tức có đường đi vòng qua lập–duyệt. Spec không yêu cầu gỡ; gỡ sẽ đổi màn `/mint` và luồng FE-07.
  Đề xuất: một task sau FE-22 gỡ hai quyền đó khỏi `TELLER`. Chi tiết mục 5.
- **CH-2 — Duyệt bị chặn vì điều kiện đổi thì yêu cầu GIỮ `PENDING`**, không tự chuyển `REJECTED`.
  Hai cách hiểu chữ "từ chối" trong ràng buộc; đã chọn cách không tự đóng thay Kiểm soát viên. Mục 5.
- **CH-3 — Hai trạng thái thêm** (`EXECUTING`, `FAILED`) ngoài ba trạng thái tài liệu nêu. Bắt buộc
  để giữ "hai lần duyệt chỉ tác động một lần". Mục 4 DV-1.
- **CH-4 — Nghiệp vụ rút của Người bán chưa có mã task.** Trang `/seller/withdraw` từng ghi "thuộc
  BE-12"; spec BE-12 ghi "không đụng rút tiền". Đã sửa chữ trang đó. Mục 5.

---

## 1. Đã làm

| Commit | Mục tiêu |
|---|---|
| `82af82b` | Spec vào repo; BE-12 sang `inProgress` |
| `4905acf` | Bảng `TokenRequest` + `init.sql` sinh bằng `npm run db:sql`; cổng `ITokenRequestStore` hai bản; quyền `order:draft` / `order:approve` |
| `ff15ebd` | Phát hành nhiều lần theo trần còn lại; tách lõi `executeIssuance` + `trackTxn` |
| `1fe36d4` | `token-request.service.ts`, năm server action, schema Zod, mã người thực hiện `currentActorId` |
| `d9b7146` | `pendingWorkCounts()` đếm thật, gỡ `@pending BE-12`; sửa chữ ba trang chỗ trống; sinh lại sơ đồ + bảng điểm cắm |
| (cuối) | Báo cáo công nghệ 2.7, BE-12 sang `done`, checkpoint này |

```
$ git diff --stat dev...HEAD | tail -1     # đo trước commit cuối
 33 files changed, 2764 insertions(+), 236 deletions(-)
```

## 2. Đối chiếu DoD theo `tasks.md`

| Bước | DoD | Đạt? | Ghi chú |
|---|---|---|---|
| 0 | BE-12 đang làm, `scan-pending --check` xanh | ✅ | `82af82b` |
| 1 | Việc 1–4, sinh lại tệp khởi tạo | ✅ | mục 3.1 · 3.2 |
| 2 | Việc 5–7, ca 1, 2, 6 | ✅ | mục 3.3 |
| 3 | Việc 8–11, ca 3, 4, 5, hai đột biến | ✅ | mục 3.3 · 3.4 |
| 4 | Việc 12–13, ca 7 | ✅ | mục 3.5 · làm **trước** bước 2–3, DV-2 |
| 5 | Việc 14, ca 8, báo cáo, trạng thái, `run-local-all.sh` | ✅ | mục 3.6 · 3.7 |

## 3. Cách chạy / kiểm thử

Chạy từ `app/` trừ khi ghi khác. Mức kiểm chứng **Cao**: test chức năng đủ tám ca, đột biến
**chỉ** hai chỗ spec chỉ định.

### 3.1 Cổng lưu trữ, cả hai bản

```
$ npx vitest run test/store-constraints.test.ts
 Tests  103 passed (103)                       # bộ nhớ; 12 ca mới cho TokenRequest (lớp 1c, 2, 3)
$ TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:55432/bidv_test npx vitest run test/store-constraints.test.ts
 Tests  160 passed (160)                       # + bản Postgres thật, container dùng một lần
```

Postgres chạy trên container `postgres:16-alpine` dựng riêng ở cổng 55432 rồi xoá — **không**
đụng cơ sở dữ liệu demo. Bảy ca `lớp 2 — hành vi bản Postgres > yêu cầu Mint / Burn` đều xanh, kể
cả "hai lần chiếm quyền duyệt cùng lúc: đúng một lần thành công" — tức câu `UPDATE ... WHERE
"status" = ANY(...)` làm trọng tài thật ở Postgres, không chỉ ở bản bộ nhớ.

### 3.2 Quyền

```
$ npx vitest run test/rbac.test.ts
 Tests  51 passed (51)
```

Ca `BE-12 việc 4 — không vai nào có cả quyền lập lẫn quyền duyệt` chạy vòng qua `ROLES`, và chốt
mỗi quyền đúng một chủ (`order:draft` → TELLER, `order:approve` → CONTROLLER). Ca cũ "hai vai
chỉ-đọc không có quyền ghi" đổi thành: SELLER không quyền ghi nào, CONTROLLER **đúng một** là
`order:approve`.

### 3.3 Tám ca — `test/token-request.test.ts` (22 test) và `test/issuance-service.test.ts`

```
$ npx vitest run test/token-request.test.ts
 Tests  22 passed (22)
```

| Ca | Test | Kiểm cả "trạng thái không đổi"? |
|---|---|---|
| 1 | `ca 1 — …` (5 test): vượt trần → `REQUEST_CHECK`, `fieldErrors` **chỉ** `cap`; khối kiểm tra trả đủ 5 điều kiện | Có: không yêu cầu nào được ghi |
| 2 | `ca 2 — …` (2 test): Mint và Burn đang chờ | Có: tổng cung, số dư SPV, số dòng sổ giao dịch |
| 3 | `ca 3 — …` (4 test): duyệt Mint, Mint đầu tiên, duyệt Burn, Giao dịch viên không duyệt được | Có |
| 4 | `ca 4 — …` (2 test): thiếu lý do (3 dạng) bị chặn và vào sổ; từ chối hợp lệ không đổi tổng cung | Có |
| 5 | `ca 5 — …`: cùng mã `GDV001` mang vai CONTROLLER → `SELF_APPROVAL` cho cả duyệt lẫn từ chối | Có: vẫn `PENDING`, tổng cung giữ |
| 6 | `ca 6 — …` (4 test): `TOTAL_SUPPLY` bị chặn khi còn 1 token lưu hành, nêu `circulation` | Có |
| 7 | xem 3.5 | |
| 8 | `ca 8 — …` (2 test): đếm theo quyền + `pendingWorkCounts()` đọc đúng phiên | — |

### 3.4 Hai đột biến — ĐÃ CHẠY THẬT, cả hai đỏ

| Đột biến | Sửa tạm | Kết quả |
|---|---|---|
| 1. Bỏ điều kiện trạng thái trong `transitionRequest` (bản bộ nhớ: `if (!found \|\| !from.includes(...))` → `if (!found)`) | `memory.token-request.store.ts` | **1 failed / 21 passed** — `đột biến 1`: hai lần duyệt cùng thành công (`length 2`, cần 1) |
| 2. Bỏ kiểm lại điều kiện lúc duyệt (`failedOf(checks).length > 0 \|\|` bị xoá) | `token-request.service.ts` | **1 failed / 21 passed** — `đột biến 2`: nhận `ISSUANCE_CAP` thay vì `REQUEST_CHECK` |

Trả mã về rồi chạy lại: 22/22. Ghi chú đột biến 2: dù bỏ kiểm lại, token **vẫn không** vượt trần —
`executeIssuance` tự kiểm trần ngay trước khi gửi. Nhưng yêu cầu rơi vào `FAILED` (một chiều) và
không nêu được điều kiện nào trượt; test bắt đúng khác biệt đó.

### 3.5 Ca 7 — phát hành nhiều lần

```
$ npx vitest run test/issuance-service.test.ts
 Tests  25 passed (25)
```

`describe('ca 7 — …')` (4 test): bốn lần ¼ trần chạm đúng trần, lần thứ năm 1 token bị
`ISSUANCE_CAP`; lần vượt trần không gửi giao dịch; lần đầu qua `mintInitialSupply`, lần sau qua
`mint`; lần sau vào ví khác ví SPV bị chặn. Trần lấy từ `WPT_TOTAL_SUPPLY` (giá trị khởi tạo dòng
`Project`), không gõ số. Ca BE-04 "amount truyền vào bị BỎ QUA" đổi thành "totalSupply truyền vào bị
bỏ qua, amount vượt trần bị chặn" — xem DV-4.

### 3.6 Điểm cắm

```
$ node scripts/scan-pending.mjs --check
Marker hợp lệ: 36 điểm cắm, 12 điểm chặn, 35 bước luồng. Không có lỗi.
$ git grep -n "@pending BE-12\|@blocked BE-12" -- app/src | wc -l
0
```

`@pending BE-12` ở `lib/nav/pending-work.ts` đã gỡ. Năm `@pending FE-22` mới ở
`app/actions/token-request.ts` (32 → 36 điểm cắm; trừ 1 của BE-12).

### 3.7 `run-local-all.sh` — cuối task

Xem mục 7: lần 2 mã thoát 0, 7 PASS / 0 FAIL, 611 test vitest.

## 4. DEVIATION so với spec

- **DV-1 — Năm trạng thái thay vì ba.** Thêm `EXECUTING` (đích của lần chiếm quyền duyệt) và
  `FAILED` (chuỗi từ chối). Không có `EXECUTING` thì câu `UPDATE` có điều kiện chỉ còn đích
  `COMPLETED`, nghĩa là đánh dấu hoàn tất **trước** khi gửi giao dịch. Lỗi **sau** khi đã gửi thì
  yêu cầu ở nguyên `EXECUTING` kèm mã giao dịch để đối soát (bài học `PENDING → SENT → PAID`).
- **DV-2 — Bước 4 làm trước bước 2–3.** Lần duyệt gọi lõi phát hành, nên lõi phải có trước.
- **DV-3 — Thêm mã người thực hiện.** Ca 5 so **người**, mà hệ thống chỉ có vai. Thêm
  `currentActorId(role)` (`DEMO_ACTOR` hoặc mã mẫu của vai) và chuyển `SAMPLE_ACCOUNTS` từ
  `channel-switcher.tsx` sang `lib/session/channel.ts` làm một nguồn — giao diện không đổi chữ nào.
- **DV-4 — `issueInitialSupplySchema` có `amount` tuỳ chọn.** Phát hành nhiều lần cần số lượng mỗi
  lần; trần vẫn chỉ đọc từ bảng dự án. Tên hàm giữ để không đổi điểm cắm FE-07.
- **DV-5 — Chặn tự từ chối**, không chỉ tự duyệt: người lập từ chối yêu cầu của mình thì cột người
  duyệt mang chính mã người lập, mất ý nghĩa bốn mắt.
- **DV-6 — Thêm `listTokenRequests`** (quyền `ops:read`) — hai màn FE-22 cần danh sách.
- **DV-7 — Nghĩa khoá `draft`.** FE-20 ghi "lệnh đã lập chưa gửi đi duyệt" — trạng thái đó không có.
  Nay là "yêu cầu mình đã lập, đang chờ duyệt".
- **DV-8 — Sửa chữ ba trang chỗ trống** (`/draft`, `/approvals`, `/seller/withdraw`) vì chúng khẳng
  định "chưa có quyền order:draft, chưa có service" — sau BE-12 là sai.

## 5. Câu hỏi mở

- **CH-1.** Giữ `token:mint` / `token:burn` ở TELLER là để không đổi hành vi `/mint` và FE-07 ngoài
  phạm vi. Hệ quả: lập–duyệt chưa phải đường **duy nhất**. Thêm: hai lần phát hành trực tiếp đồng
  thời (không qua lập–duyệt) cùng qua phép kiểm trần rồi cùng gửi thì có thể vượt trần — lõi kiểm lại
  trước khi gửi nhưng không nguyên tử. Lập–duyệt không có lỗ này (một Mint chờ mỗi token + chiếm
  quyền có điều kiện). Đề xuất: gỡ hai quyền trực tiếp sau FE-22, hoặc giữ chỗ trần trong cơ sở dữ liệu.
- **CH-2.** "Duyệt mà điều kiện đã đổi thì từ chối": (a) chặn lần duyệt, yêu cầu giữ `PENDING` — đã
  chọn; (b) tự chuyển `REJECTED`. (a) để Kiểm soát viên ghi lý do của mình; nhưng yêu cầu Mint treo
  sẽ chặn Mint mới cùng token tới khi có người từ chối.
- **CH-3.** "Không có yêu cầu đang chờ cho cùng token" spec đặt ở mục Mint, nên **chỉ** áp cho Mint.
- **CH-4.** Rút VNDB của Người bán: chưa có mã task.

## 6. Tự đánh giá 3 LUẬT kiến trúc

- [x] Mọi call chain qua `ILedgerPort` — `token-request.service.ts` chỉ gọi `getLedger()`
- [x] Mọi ký qua `ISigner` — không thêm đường ký nào; `trackTxn` đọc địa chỉ qua `getBankSigner`
- [x] Mọi kiểm quyền qua RBAC — `authorize()` / `can()`; không `role ===` nào. Tự duyệt so **mã
  tài khoản**, không so vai

## 7. Kết quả `run-local-all.sh`

Chạy **hai** lần, không phải một — nói rõ lý do:

| Lần | Kết quả | Nguyên nhân |
|---|---|---|
| 1 | mã thoát 1 — 6 PASS / **1 FAIL** (`APP - TYPECHECK`) | 24 lỗi, **cả 24** nằm trong `app/.next/` — bộ đệm build gitignored ngày 19/09, còn trỏ tới route-group FE-20 đã xoá (`(admin)`, `(audit)`, `(client)`). Lỗi trong mã nguồn: 0 (`npx tsc --noEmit \| grep "error TS" \| grep -vc "^\.next/"` → `0`) |
| 2 | **mã thoát 0 — 7 PASS / 0 FAIL** | Đã **chuyển** (không xoá) `app/.next` sang thư mục nháp của phiên; `next dev` / `next build` tự sinh lại |

```
$ bash scripts/run-local-all.sh        # lần 2
  => PASS có cảnh báo: luật kiến trúc   (3 cảnh báo có từ trước, không cái nào do BE-12)
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)
  => PASS: LỚP 3 - KHUÔN CHECKPOINT     (mục 0: 29/60 dòng · 9 ✅)
  => PASS: LỚP 1 - SPEC TEST CONTRACT EVM   67 passing
  => PASS: APP - TYPECHECK
  => PASS: APP - LINT
  => PASS: APP - VITEST                 Test Files 22 passed · Tests 611 passed
  => ĐẠT các phần đã chạy: arch markers checkpoint contracts app
```

Máy khác còn `app/.next` cũ từ trước FE-20 sẽ gặp đúng lỗi lần 1; CI dựng từ bản sạch nên không gặp.
