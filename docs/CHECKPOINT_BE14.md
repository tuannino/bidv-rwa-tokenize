# Báo cáo bàn giao — Task BE-14: Chiều bán token và năm bước quyết toán

| | |
|---|---|
| Mã task | BE-14 |
| Nhánh | `feat/sell-side`, tạo từ `dev` `6f32d0a`, **rebase lên `dev` `8af5bb7`** (sau FE-21 PR #31 và FE-22 PR #32) — mục 8 |
| Spec | `docs/be-14-sell-side/{requirements,tasks}.md` — không có `design.md` |
| Tiến độ | Bước 5/5 xong. Chờ Supervisor nghiệm thu — Kiro **không** merge vào `dev` |

> Quy tắc viết checkpoint: `.kiro/steering/checkpoint.md`.
> Máy kiểm: `node scripts/check-checkpoint.mjs docs/CHECKPOINT_BE14.md docs/be-14-sell-side/requirements.md`

---

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md`) | | Bằng chứng |
|---|---|---|---|
| 1 | Lệnh có chiều mua và bán, chung một bảng và một bộ trạng thái | ✅ | mục 3.1 |
| 2 | Bán thành công thì token và VNDB đổi đúng hai chiều | ✅ | mục 3.2 ca 1 |
| 3 | Thiếu token hoặc thiếu VNDB thì từ chối trước khi gửi giao dịch | ✅ | mục 3.2 ca 2, ca 3 |
| 4 | Số chưa phân phối và số đang lưu hành đổi đúng sau khi bán | ✅ | mục 3.2 ca 4 |
| 5 | Năm bước quyết toán có mốc thời gian, ánh xạ ở tầng nghiệp vụ | ✅ | mục 3.2 ca 5 |
| 6 | Nhà đầu tư chỉ xem được lệnh của mình | ✅ | mục 3.2 ca 6 · 3.3 đột biến 2 |
| 7 | Số liệu khớp lệnh trong ngày đủ bốn ô | ✅ | mục 3.2 ca 7 · mục 8 |
| 8 | Kiểm thử chiều mua xanh nguyên | ✅ | mục 3.4 |
| 9 | `run-local-all.sh` xanh | 🔶 | mục 7 (6 PASS, 1 FAIL do mạng chặn tải trình biên dịch Solidity) |

**Kết luận:** 8 ✅ · 1 🔶 · 0 ❌

### 0.2 Việc cần Owner quyết

- **CH-0 — Mở mạng cho `binaries.soliditylang.org` rồi chạy lại phần hợp đồng.** Phần
  `contracts` đỏ vì Hardhat không tải được solc 0.8.28 (403, host ngoài danh sách cho phép của môi
  trường). BE-14 không sửa tệp nào trong `packages/`. Sau khi mở: `bash scripts/run-local-all.sh contracts`.
- **CH-1 — ĐÃ QUYẾT trong phiên, ghi lại để Supervisor biết.** Việc 12 cấp `order:read:all` cho
  `SELLER`, mà `SELLER` là `FALLBACK_ROLE`. Owner chọn: cấp, **giữ** fallback `SELLER`. Hệ quả:
  vai lạ đọc được sổ lệnh toàn hệ (vẫn không có quyền ghi nào). Xem lại khi có AU-01. Mục 5.
- **CH-2 — Uỷ quyền WPT cho chiều bán.** Hợp đồng khớp lệnh thật (SC-03) sẽ cần nhà đầu tư cấp
  quyền chuyển WPT; cổng chưa có hàm đọc, spec không yêu cầu, nên chưa kiểm. Đề xuất: SC-03 thêm
  `wptAllowanceOf` và một phép kiểm vào `runSaleBalanceChecks`. Mục 5.
- **CH-3 — Nhánh làm việc.** Phiên được cấu hình làm trên `dev`; Owner chọn `feat/sell-side`
  theo spec và `branching.md`. Không commit nào lên `dev`.
- **CH-4 — Sửa chạm sang màn của FE-21 (2 dòng hiển thị).** Spec ghi "Không làm giao diện", nhưng
  `seller-transactions.tsx` gán cứng chữ "Mua" cho mọi dòng; giữ nguyên thì lệnh bán hiện là "Mua".
  Em sửa nhãn theo dữ liệu và thêm lựa chọn lọc "Bán". Owner không đồng ý thì revert 2 dòng đó. Mục 8.

---

## 1. Đã làm

| Commit | Mục tiêu |
|---|---|
| `d840d4d` | Spec vào repo; BE-14 sang `inProgress`; đặt mã FE-25 vào `planned` (DV-4) |
| `25cbe94` | Cột `side` + bốn mốc bước, `init.sql` sinh bằng `npm run db:sql`; nâng bảng cũ; lọc theo chiều/mã/ngày; `summarizeCompleted` |
| `727dd44` | `ILedgerPort.executeSale`: mock nguyên khối, evm/stellar `@blocked SC-03` |
| `1ae9986` | `runOrderChecks` dùng chung hai chiều; `settlement-steps.ts`; `orderDailyStats`; `SELLER` nhận `order:read:all` |
| `7f89ddc` | Báo cáo công nghệ (nay 3.0 sau rebase), sơ đồ `purchase`, bảng điểm cắm, checkpoint này |
| `227d188` | Kết quả `run-local-all.sh` lần 1 (trước rebase) vào checkpoint |
| `979090f` | Khớp với FE-21 sau rebase — mục 8 |
| (cuối) | Kết quả `run-local-all.sh` sau rebase vào mục 7, BE-14 sang `done` |

```
$ git diff --stat origin/dev...HEAD | tail -1     # đo trước commit cuối, sau rebase
 30 files changed, 2108 insertions(+), 197 deletions(-)
```

## 2. Đối chiếu DoD theo `tasks.md`

| Bước | DoD | Đạt? | Ghi chú |
|---|---|---|---|
| 0 | BE-14 đang làm, `scan-pending --check` xanh | ✅ | `b8d23b2` |
| 1 | Việc 1, 2; sinh lại tệp khởi tạo bằng công cụ; lệnh cũ là mua | ✅ | mục 3.1 |
| 2 | Việc 3–7; ca 1–4; đột biến khớp lệnh thất bại | ✅ | mục 3.2, 3.3 |
| 3 | Việc 8–10; ca 5 | ✅ | mục 3.2 ca 5 |
| 4 | Việc 11–13; ca 6, 7; đột biến bỏ lọc theo ví; `npx vitest run` | ✅ | mục 3.2, 3.3, 3.4 |
| 5 | Ca 8; báo cáo, sơ đồ, trạng thái, checkpoint, `run-local-all.sh` | ✅ | mục 6, 7 |

## 3. Cách chạy / kiểm thử

Chạy từ `app/`. Mức kiểm chứng **Cao**: đủ tám ca, đột biến **chỉ** hai chỗ spec chỉ định.

### 3.1 Dữ liệu, cả hai bản lưu trữ

```
$ npx vitest run test/store-constraints.test.ts
 Tests  113 passed (113)                      # bộ nhớ; 10 ca mới (lớp 1d, lớp 2 "lệnh mua và bán", lớp 3)
$ TEST_DATABASE_URL=postgresql://bidv@127.0.0.1:55432/bidv_test npx vitest run test/store-constraints.test.ts
 Tests  176 passed (176)                      # + bản Postgres thật, chạy lại sau rebase
```

Postgres 16 dựng một lần ở cổng 55432 (không có docker daemon nên dùng `initdb` của gói hệ
thống), **không** đụng cơ sở dữ liệu demo. Đường nâng bảng cũ kiểm riêng: dựng DB bằng
`git show dev:app/prisma/init.sql`, chèn một lệnh, rồi cho `ensureSchema` chạy → lệnh cũ đọc ra
`side: "BUY"`, có đủ bốn cột mốc và chỉ mục `PurchaseOrder_side_status_completedAt_idx`.

### 3.2 Tám ca — `test/purchase-service.test.ts` (23 test mới, tổng 68) và `test/mock-ledger.test.ts`

```
$ npx vitest run test/purchase-service.test.ts test/mock-ledger.test.ts
 Tests  125 passed (125)
```

| Ca | `describe` | Kiểm cả "không đổi"? |
|---|---|---|
| 1 | `BE-14 ca 1` (3): bốn số dư đổi đúng, `vndAmount` chốt theo giá cấu hình, sổ `Txn` ghi `sale`; xem trước chạy ba phép bán | — |
| 2 | `BE-14 ca 2` (2): vượt số đang giữ bị chặn trước khi tạo bản ghi; token tụt sau khi đặt → `REJECTED` | Có: `sendCount = 0`, số dư bốn ô giữ |
| 3 | `BE-14 ca 3` (2): xem trước/đặt lệnh nêu `sellerLiquidity`; VNDB người bán tụt → `REJECTED` | Có: `sendCount = 0`, số dư bốn ô giữ |
| 4 | `BE-14 ca 4`: phần chưa phân phối +4, phần lưu hành −4 | Tổng cung giữ |
| 5 | `BE-14 ca 5` (8): lệnh bán hoàn tất có đủ năm mốc, mốc không lùi, bốn bút toán `APPLIED`; bảy trạng thái ánh xạ đúng bảng ở `settlement-steps.ts` | — |
| 6 | `BE-14 ca 6` (3): ALICE không thấy lệnh BOB **kể cả dò đúng mã lệnh**; SELLER/TELLER/CONTROLLER thấy toàn bộ; lọc chiều, trạng thái, ngày, mã | — |
| 7 | `BE-14 ca 7` (3): hai lệnh mua + một lệnh bán khớp → bốn ô đúng; lệnh `PLACED` không đếm; INVESTOR bị chặn; ngày khác ra bốn số 0 | — |
| 8 | xem 3.4 | |

Cổng chuỗi: `describe('BE-14 — executeSale ...')` (3 test) ở `mock-ledger.test.ts` — bốn bút toán
đúng; thiếu WPT và SPV thiếu VNDB đều **không** đổi bất kỳ số dư nào.

### 3.3 Hai đột biến — ĐÃ CHẠY THẬT, cả hai đỏ

| Đột biến | Sửa tạm | Kết quả |
|---|---|---|
| 1. Khớp lệnh bán thất bại giữa chừng: ghi hai bút toán WPT **trước** phép kiểm VNDB của ví SPV | `mock.adapter.ts :: executeSale` | **1 failed / 124 passed** — `CHẶN khi ví SPV thiếu VNDB, KHÔNG bên nào đổi số dư` |
| 2. Bỏ lọc theo ví ở tầng nghiệp vụ (bỏ `investorWallet` khỏi lời gọi `listOrders` của cổng) | `purchase.service.ts :: listOrders` | **3 failed / 65 passed** — gồm `BE-14 ca 6 > ... kể cả khi dò đúng mã lệnh của BOB` và hai ca 7.8 cũ |

Chạy lại cả hai **sau rebase**, kết quả giống hệt. Trả mã về (chép lại từ bản sao) rồi chạy lại: 125/125. Ca `BE-14 đột biến 1` ở mức service (lỗi
khi gửi → `FAILED`, số dư và phần lưu hành giữ, bước 4 `failed`, `NONE_APPLIED`) là ca chức năng
luôn chạy, không phải đột biến thứ ba.

### 3.4 Ca 8 — chiều mua xanh nguyên

45 test chiều mua có từ trước trong `purchase-service.test.ts` **không sửa một dòng**; chỉ thêm
nhánh `executeSale` vào vỏ bọc lỗi đầu tệp. Lần chạy đầu có **1 đỏ** (`7.5 > ... audit ghi
SUCCESS`) vì câu chữ sổ kiểm toán bị đổi thành "khớp mua ..."; đã sửa **mã** cho câu chữ chiều
mua giữ nguyên từng chữ, không sửa test.

```
$ npx vitest run                              # sau rebase và commit 979090f
 Test Files  24 passed (24)
      Tests  694 passed (694)
```

### 3.5 Quyền

```
$ npx vitest run test/rbac.test.ts
 Tests  51 passed (51)
```

Ba ca chốt quyền cũ đã sửa theo CH-1: ma trận `order:read:all` thêm `SELLER`; ca "order:read:all
phân biệt R5.1/R5.2" chỉ còn `INVESTOR` bị buộc lọc ví; `SYSTEM_WIDE_READS` của fallback bỏ
`order:read:all` (vẫn chốt `audit:read`, `reconcile:read`, và ca "vai lạ không có quyền ghi nào").

## 4. DEVIATION so với spec

- **DV-1 — Đổi tên `runPurchaseChecks` → `runOrderChecks`, `PURCHASE_CHECK_IDS` → `ORDER_CHECK_IDS`.**
  Một hàm cho hai chiều theo việc 3; tên cũ nói sai phạm vi. Không chỗ nào ngoài
  `purchase.service.ts` dùng hai tên đó (`grep` trong `src`, `test`, `e2e`: 0 kết quả).
- **DV-2 — Không thêm hàm báo giá bán.** Số VNDB nhận khi bán dùng `quotePurchase`: cùng giá cấu
  hình như chiều mua (ràng buộc "Giá lấy từ cấu hình, như chiều mua"). Thêm `quoteSale` là nguồn
  giá thứ hai.
- **DV-3 — Bốn ô số liệu trong ngày.** Trước rebase em đo được 0 ô (màn `/seller` còn là trang
  chỗ trống); sau rebase FE-21 đã có đúng **hai** ô mua, khớp chữ "hai ô như hiện nay" của spec.
  `orderDailyStats` trả bốn ô và `getSellerOverview().today` nay mang đủ hai chiều. Server action
  `orderDailyStatsAction` đã **gỡ** vì marker của nó chờ FE-21 (đã xong); bảng điều khiển vận hành
  chưa có mã task nên chưa mở action. Mục 8.
- **DV-4 — Đặt mã FE-25 vào `planned`.** Spec FE-25 nằm cùng gói; mã có trong tập hợp lệ thì task
  sau dùng được ngay. Chưa có marker nào chờ FE-25.
- **DV-5 — Nền nhánh.** Làm trên `dev` `6f32d0a` (lúc đó FE-22 chưa merge), rồi rebase lên
  `8af5bb7` đã có FE-21 và FE-22 — nay đúng điều kiện "sau khi FE-22 đã merge" của spec.
- **DV-8 — `createOrder` tạo thẳng ở trạng thái có mốc thì ghi mốc đó** (hai bản lưu trữ). Test FE-21
  dựng lệnh `COMPLETED` bằng `createOrder({ status })`; không ghi `completedAt` thì số liệu theo ngày
  bỏ sót chúng.
- **DV-6 — Thêm bước nâng bảng cũ ở `ensureSchema`** (`addMissingColumns`). Không có thì volume
  Postgres dựng trước BE-14 nổ `undefined_column` ngay ở câu `CREATE INDEX` mới của `init.sql`, và
  việc 1 "lệnh cũ coi là mua" không thành sự thật trên dữ liệu đang chạy.
- **DV-7 — Mốc bước quyết toán do cổng lưu trữ ghi** theo `ORDER_STATUS_STAMPS`, cùng câu lệnh đổi
  trạng thái. Ánh xạ hiển thị vẫn ở `lib/bank/settlement-steps.ts` đúng việc 9.

## 5. Câu hỏi mở

- **CH-1.** Fallback `SELLER` nay đọc được sổ lệnh toàn hệ. Phương án đổi fallback sang `INVESTOR`
  đã bị loại vì `INVESTOR` có quyền ghi (`order:place`), trái ca `rbac.test.ts` "vai lạ không có
  quyền ghi nào". Chấp nhận được tới AU-01 vì bộ đổi vai chưa phải xác thực.
- **CH-2.** Uỷ quyền WPT ở chiều bán — xem 0.2.
- **CH-5 — Lệnh bán chiếm chỗ trong giới hạn quét của chia lợi nhuận.** `collectRecipients` lấy ví
  từ lệnh `COMPLETED` với `MAX_RECIPIENT_SCAN`; lệnh bán nay cũng nằm trong đó. Số chia vẫn đúng
  (đọc `balanceOfAt` từ chuỗi), chỉ là chạm ngưỡng sớm hơn. Đề xuất: thêm `side: 'BUY'` ở task
  chia lợi nhuận kế tiếp; BE-14 không sửa vì ngoài phạm vi.
- **CH-6 — `GET /api/purchase` chưa nhận bốn bộ lọc mới.** Spec không liệt kê route này; server
  action đã đủ cho FE-25.
- **CH-8 — `STEP_LABELS` ở `seller-transactions.tsx` tự suy bước từ trạng thái** (có từ FE-21). Nên
  chuyển sang đọc `steps` từ nghiệp vụ ở task giao diện kế tiếp. Mục 8.
- **CH-7 — Lệnh hoàn tất trước BE-14 không có `completedAt`** nên không vào số liệu theo ngày.
  Không suy mốc từ `updatedAt` để khỏi ghi một dữ kiện không chắc chắn.

## 6. Tự đánh giá 3 LUẬT kiến trúc

- [x] Mọi call chain qua `ILedgerPort` — `executeSale` khai ở cổng, hiện thực ở cả ba adapter
- [x] Mọi ký qua `ISigner` — không thêm đường ký nào
- [x] Mọi kiểm quyền qua RBAC — `authorize()` / `assertCan()`; không `role ===` nào. Người bán xem
  toàn bộ vì có `order:read:all`, không vì tên vai

Báo cáo công nghệ 3.0 đã cập nhật (sau rebase; 2.8, 2.9 do FE-21, FE-22 dùng): metadata, đoạn "2.9 → 3.0", 3.16 (kênh Người bán hai chiều), 3.1 (30 method, bảng adapter, số
dòng), 3.3 (ma trận + ghi chú fallback), 3.4 (`settlement-steps.ts`, `purchase.service.ts`,
`schemas.ts`), 3.5 (`order.store.port.ts`, `postgres.pool.ts`), 3.10 (sinh bằng
`scan-pending.mjs --write-report`), 4.2 (chiều bán, năm bước). Sơ đồ `docs/flows/purchase.md`
sinh lại bằng `gen-flow-diagram.mjs purchase`.

## 7. Kết quả `run-local-all.sh`

Chạy **hai** lần, nói rõ lý do: lần 1 trước rebase; lần 2 sau khi rebase lên `8af5bb7`, vì nền mã đã
đổi (FE-21, FE-22) nên kết quả lần 1 không còn là bằng chứng cho mã đang nộp. Cả hai lần cùng một
kết cục: **mã thoát 1 — 6 PASS / 1 FAIL**, FAIL duy nhất là phần hợp đồng vì mạng.

```
$ bash scripts/run-local-all.sh        # lần 2, sau rebase
  => PASS có cảnh báo: luật kiến trúc   (3 cảnh báo có từ trước: SIGNER_KIND, địa chỉ mẫu ở mint.tsx, thiếu BASE_REF)
                                        Bảng quyền không teo lại so với origin/dev (32 -> 32 hành động)
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)    27 điểm cắm, 13 điểm chặn, 35 bước luồng
  => PASS: LỚP 3 - KHUÔN CHECKPOINT     mục 0: 34/60 dòng · 9 dòng / 9 điều kiện
  => FAIL: LỚP 1 - SPEC TEST CONTRACT EVM
  => PASS: APP - TYPECHECK
  => PASS: APP - LINT
  => PASS: APP - VITEST                 Test Files 24 passed · Tests 694 passed
```

Lỗi duy nhất, nguyên văn dòng gốc:

```
Caused by: Error: Failed to download https://binaries.soliditylang.org/linux-amd64/list.json - 403 received.
Host not in allowlist: binaries.soliditylang.org.
```

Đây là chính sách mạng của môi trường chạy, không phải lỗi mã: `git diff --name-only origin/dev...HEAD
-- packages/ | wc -l` → `0`, và `packages/contracts-evm/node_modules` đã cài bằng `npm ci` trước khi chạy.

## 8. Rebase lên `dev` `8af5bb7` và khớp với FE-21

`dev` nhận FE-21 (PR #31) và FE-22 (PR #32) sau khi nhánh này được đẩy lên, nên GitHub báo
"Can't automatically merge". Rebase theo `branching.md` §7 (nhánh chỉ một người dùng):

| Tệp | Xung đột | Cách giải |
|---|---|---|
| `docs/tech-report.md` | metadata + đoạn đổi phiên bản (FE-22 đã lấy 2.9) | lấy bản `dev`, áp lại phần BE-14 thành **2.9 → 3.0**; mục 3.10 **sinh lại** bằng `scan-pending.mjs --write-report` |
| `.kiro/task-status.json` | danh sách `done`/`planned` | lấy bản `dev` (FE-21, FE-22 `done`, BE-13 `planned`), thêm BE-14 và FE-25 |

Mã nguồn tự gộp được nhưng có ba chỗ **sai về nghĩa** nếu để nguyên, đã sửa ở `979090f`:

1. `getSellerOverview().today` đếm **mọi** lệnh `COMPLETED` là lệnh mua (`sell: null`) — lệnh bán sẽ
   bị cộng vào ô mua. Nay lấy từ `orderDailyStats`: ô mua chỉ lệnh mua, `sell` có `{count, wpt, vnd}`,
   mốc "trong ngày" là `completedAt`. Test FE-21 chốt `sell: null` đổi thành ba số 0.
2. `listSellerTransactions` gán cứng `type: 'BUY'`. Nay `type = side`, `SELLER_TXN_TYPES` thêm `SELL`,
   lọc loại đẩy xuống cổng. Màn `seller-transactions.tsx` sửa 2 dòng nhãn (CH-4).
3. `@pending FE-21` trên `orderDailyStatsAction` thành marker lạc hậu (`scan-pending --check` báo
   `STALE_TASK`) — gỡ action, xem DV-3.

Ca mới `test/seller-channel.test.ts > BE-14 — lệnh bán tách khỏi lệnh mua ở kênh Người bán` (2 test).
FE-21 có bảng tên bước riêng ở giao diện (`STEP_LABELS` trong `seller-transactions.tsx`), tự suy từ
trạng thái — trái nguyên tắc việc 9; để nguyên vì là giao diện, đề xuất màn đó đọc `steps` của
`listOrders` ở task giao diện kế tiếp (CH-8).
