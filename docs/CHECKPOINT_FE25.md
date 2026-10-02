# Báo cáo bàn giao: Task FE-25, màn Giao dịch token và Quản lý lệnh của Nhà đầu tư

| | |
|---|---|
| Mã task | FE-25 |
| Nhánh | `feat/investor-trading`, tạo **từ `dev`** (`6d876ca`, sau khi BE-14 merge, PR #33) |
| Spec | `docs/fe-25-investor-trading/{requirements,tasks}.md`, không có `design.md` |
| Tiến độ | Bước 4/4 xong. Chờ Supervisor nghiệm thu, Kiro **không** merge vào `dev` |

> Quy tắc viết checkpoint: `.kiro/steering/checkpoint.md`.
> Máy kiểm: `node scripts/check-checkpoint.mjs docs/CHECKPOINT_FE25.md docs/fe-25-investor-trading/requirements.md`

---

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md`) | | Bằng chứng |
|---|---|---|---|
| 1 | Hai màn đúng bố cục tài liệu, thay hết trang chỗ trống | 🔶 | mục 3.3, mục 4 DV-1 (ba chỉ tiêu token hiện "Chưa có dữ liệu") |
| 2 | Ô số lượng tự chặn theo trần của từng chiều | ✅ | mục 3.2 ca 1, ca 2 |
| 3 | Khối kiểm tra năm điều kiện lấy từ nghiệp vụ, khoá nút khi có điều kiện trượt | ✅ | mục 3.2 ca 3, mục 4 DV-2 |
| 4 | Giá chỉ để xem | ✅ | mục 3.3 |
| 5 | Màn chi tiết hiện đủ năm bước quyết toán kèm mốc thời gian | ✅ | mục 3.2 ca 5 |
| 6 | Nhà đầu tư chỉ thấy lệnh của mình | ✅ | mục 3.2 ca 7 |
| 7 | Guard vai trò đúng | ✅ | mục 3.2 ca 8, mục 3.3 |
| 8 | `run-local-all.sh` xanh | 🔶 | mục 7 (phần hợp đồng đỏ vì mạng chặn tải trình biên dịch) |

**Kết luận:** 6 ✅, 2 🔶, 0 ❌

### 0.2 Việc cần Owner quyết

- **CH-0. Mở mạng cho `binaries.soliditylang.org`** rồi chạy `bash scripts/run-local-all.sh contracts`.
  FE-25 không sửa tệp nào trong `packages/`. Mục 7.
- **CH-1. ĐÃ QUYẾT trong phiên, ghi lại cho Supervisor.** (a) Tuổi thọ còn lại, lợi tức, phí giao dịch:
  hiện "Chưa có dữ liệu", không bịa số, không thêm tham số. (b) Điều kiện "rủi ro" đọc từ bộ kiểm số dư
  BE-14. (c) Khớp lệnh vẫn do ngân hàng: gửi lệnh xong màn theo dõi tới khi Giao dịch viên khớp. Mục 4.
- **CH-2. FE-05 và FE-06 còn trong `planned`.** FE-25 đã thay hai trang chỗ trống từng chờ hai mã đó và
  gọi xong `previewPurchaseAction`, `placeOrderAction`, `listOrdersAction`. Phần còn lại: FE-06 là màn
  khớp lệnh của ngân hàng (`/transactions`, `executeOrderAction`). Đề xuất: bỏ FE-05 khỏi lộ trình, giữ
  FE-06 cho màn ngân hàng. Mục 5.
- **CH-3. Cần nguồn dữ liệu cho ba chỉ tiêu token và hồ sơ rủi ro** để điều kiện 1 lên ✅. Đề xuất một
  task backend. Mục 5.

---

## 1. Đã làm

| Commit | Mục tiêu |
|---|---|
| `2dae426` | Spec vào repo; FE-25 sang `inProgress` |
| `661961e` | `lib/bank/trade.service.ts` + `app/actions/trade.ts`: bối cảnh giao dịch, năm điều kiện, chi tiết lệnh |
| `e96bbf8` | Ba màn, `components/trading/*`, thay hai trang chỗ trống, thêm `/orders/[id]`, gỡ điểm cắm đã được gọi, `test/investor-trading.test.ts` |
| `5447d82` | Báo cáo công nghệ 3.1 (mục 3.18), sinh lại bảng điểm cắm và sơ đồ `purchase` |
| `8e319cc` | Gỡ `@pending FE-05` trên `previewPurchase` (đã được `previewTrade` gọi) |
| (cuối) | Kết quả `run-local-all.sh` vào mục 7, FE-25 sang `done` |

```
$ git diff --stat origin/dev...HEAD | tail -1     # đo trước commit cuối
 19 files changed, 2100 insertions(+), 78 deletions(-)
```

## 2. Đối chiếu DoD theo `tasks.md`

| Bước | DoD | Đạt? | Ghi chú |
|---|---|---|---|
| 0 | FE-25 đang làm; `dev` đã có BE-14 | ✅ | `2dae426`; `git merge-base --is-ancestor` BE-14 trong `origin/dev` |
| 1 | Việc 1 đến 8; ca 1, 2, 3, 4 | ✅ | mục 3.2; việc 8 theo CH-1 (c) |
| 2 | Việc 9 đến 12; ca 5, 6 | ✅ | mục 3.2 |
| 3 | Việc 13, 14; ca 7, 8 | ✅ | mục 3.2 |
| 4 | Báo cáo, trạng thái, checkpoint; sinh lại sơ đồ | ✅ | mục 6, 7. Không cần rebase: `dev` không đổi từ lúc tạo nhánh |

## 3. Cách chạy / kiểm thử

Chạy từ `app/`. Mức kiểm chứng **Vừa**: kiểm chức năng cho phần đã sửa, không đột biến.

### 3.1 Bộ kiểm toàn bộ

```
$ npx vitest run
 Test Files  25 passed (25)
      Tests  713 passed (713)
```

### 3.2 Tám ca: `test/investor-trading.test.ts` (19 test)

Vitest chạy môi trường `node`, nên mỗi ca kiểm hai tầng như FE-22: phép đọc / ghi của máy chủ màn hình
gọi, và hàm thuần ở `components/trading/gates.ts` quyết định ô nào chặn, nút nào khoá.

| Ca | `describe` | Kiểm gì |
|---|---|---|
| 1 | `ca 1` (2) | Trần mua do số dư chia giá (vượt 1 bị chặn, bằng trần qua) và do số chưa phân phối; câu lý do đúng giới hạn |
| 2 | `ca 2` | Sau khi mua và ngân hàng khớp, trần bán bằng số đang giữ đọc từ chuỗi; vượt bị chặn |
| 3 | `ca 3` (5) | Đủ năm điều kiện thì nút mở; ví đóng băng, ví chưa KYC, thiếu uỷ quyền (rủi ro) thì nút khoá và nêu đúng điều kiện; kết quả của số lượng cũ không mở nút cho số lượng mới |
| 4 | `ca 4` (2) | Danh sách có lệnh ngay sau khi gửi; ngân hàng khớp xong thì có mã giao dịch và số dư WPT/VNDB đổi đúng; chiều bán cũng vậy |
| 5 | `ca 5` | Chi tiết lệnh đã khớp: năm bước đều xong và có mốc, nêu quyết toán một bước, bốn bút toán, nhật ký có `order:place` và `order:execute` |
| 6 | `ca 6` (3) | Lọc theo chiều, trạng thái, mã lệnh, khoảng ngày; tám cột sắp xếp đúng hai chiều (số so theo giá trị); bộ lọc trạng thái đủ bảy trạng thái |
| 7 | `ca 7` | Danh sách và chi tiết không lộ lệnh của BOB cho ALICE, kể cả dò đúng mã lệnh (`ORDER_STATE`) |
| 8 | `ca 8` (3) | Ba trang nằm trong khu vực Nhà đầu tư, chỉ INVESTOR qua cổng; SELLER/TELLER/CONTROLLER gọi thẳng hai phép đọc nhận `FORBIDDEN`; hai trang không còn `PlaceholderPage` hay `@pending` |
| việc 14 | `việc 14` | `formatAmount` phân cách hàng nghìn |

Lần chạy đầu **6 đỏ**: 5 ca vì `previewTrade` truyền dữ liệu đã parse (số lượng đã thành `bigint`) vào
`previewPurchase` và bị parse lần hai, đã sửa **mã**; 1 ca vì chính ca kiểm sắp xếp giả định giá ba lệnh
khác nhau (thực tế bằng nhau), đã sửa **ca kiểm** thành kiểm thứ tự từng cột.

### 3.3 Chạy thử ứng dụng thật

`next dev` chuỗi `mock`, trình duyệt Chromium của môi trường, một `window.ethereum` giả trả địa chỉ ví
để wagmi coi là đã kết nối (chỉ dùng cho lần chạy thử này, không thêm vào repo):

- `/trade`: đủ ô chọn token, hai thẻ Mua/Bán, ô số lượng kèm dòng nhắc trần, ô giá `readOnly`, tổng giá
  trị, khối kiểm tra, tóm tắt lệnh, thông tin token (ba chỉ tiêu hiện "Chưa có dữ liệu"). Không lỗi console.
- `/orders`: bộ lọc năm ô, bảng rỗng có thông báo. Không lỗi console.
- Chưa kết nối ví: ba trang trả 200 và mời kết nối. Vai TELLER mở `/trade` bị cổng khu vực chặn.
- Phát hiện khi chạy thử: dòng nhắc trần hiện "100000" chưa có phân cách, trái việc 14; đã sửa ở máy chủ.

Giá chỉ để xem: ô giá là `readOnly`, và `placeOrderSchema` không có trường giá nên máy chủ cũng không
nhận giá từ người dùng.

Chưa chạy được luồng gửi lệnh đầu cuối trên trình duyệt (cần nạp KYC, nguồn cung, VNDB vào chuỗi mock của
máy chủ thử); luồng đó đã có ở mục 3.2 ca 4 ở tầng máy chủ.

## 4. DEVIATION so với spec

- **DV-1. Ba chỉ tiêu token chưa có dữ liệu** (việc 6): tuổi thọ còn lại, lợi tức, phí giao dịch không có
  nguồn nào trong hệ thống (`grep -rn "lifetime\|yield\|tradingFee\|maturity" app/src` không ra nguồn dữ
  liệu). Owner chọn hiện "Chưa có dữ liệu"; service trả `null` kèm lý do (`MissingTerm`).
- **DV-2. Điều kiện "rủi ro"** (việc 5) đọc từ bộ kiểm `runOrderChecks` của BE-14 qua `previewPurchase`,
  không có hồ sơ khẩu vị rủi ro. Owner chọn. Bốn điều kiện còn lại đọc thật: quyền đặt lệnh, KYC
  (`isWhitelisted`), đóng băng (`isFrozen`), dự án đã phát hành và không ở giai đoạn tất toán.
- **DV-3. Việc 8 "kết quả kèm mã giao dịch, số dư cập nhật ngay"**: gửi lệnh chỉ tạo `PLACED` vì khớp
  lệnh là quyền `order:execute` của ngân hàng. Owner chọn giữ tách quyền: màn theo dõi lệnh mỗi 3 giây,
  khi ngân hàng khớp thì hiện mã giao dịch (chuỗi `mock` ghi "mô phỏng") và đọc lại số dư.
- **DV-4. Thêm phép đọc phía máy chủ** (`trade.service.ts`) dù FE-25 là task giao diện: trần số lượng,
  năm điều kiện và nhật ký lệnh phải tính ở máy chủ theo ràng buộc "không tự tính ở giao diện". Cùng
  tiền lệ FE-22 thêm phép đọc vào `token-request.service`.
- **DV-5. Ô chọn token chỉ có một lựa chọn**: sổ lệnh và `ILedgerPort` mới có một token mỗi chuỗi, nên
  `getTradeContext` lấy dự án đầu tiên và ô chọn bị khoá khi chỉ có một token.

## 5. Câu hỏi mở

- **CH-2.** FE-05, FE-06: xem 0.2.
- **CH-3.** Nguồn dữ liệu cho tuổi thọ, lợi tức, phí giao dịch, và hồ sơ khẩu vị rủi ro.
- **CH-4. Nhật ký kiểm toán của lệnh lọc theo chuỗi chi tiết** trong 500 dòng mới nhất, vì `AuditLog`
  chưa có cột mã lệnh. Lệnh cũ hơn sẽ có nhật ký rỗng. Đề xuất thêm cột `orderId` khi sổ lớn.
- **CH-5. Mở `/orders/[id]` gọi `listOrders`, mà `listOrders` dùng `authorize`** nên mỗi lần xem ghi một
  dòng `order:read` vào sổ kiểm toán (hành vi có từ BE-02, không đổi ở FE-25).

## 6. Tự đánh giá 3 LUẬT kiến trúc

- [x] Mọi call chain qua `ILedgerPort`: `trade.service.ts` chỉ gọi `getLedger()`; component không nhập
  `viem`, chỉ gọi server action
- [x] Mọi ký qua `ISigner`: không thêm đường ký nào; đặt lệnh không ký, khớp lệnh vẫn ở ngân hàng
- [x] Mọi kiểm quyền qua RBAC: `assertCan` / `can`; vào màn qua cổng `portfolio:read` của khu vực

Báo cáo công nghệ 3.1 đã cập nhật: metadata, đoạn "3.0 sang 3.1", cây thư mục 1.4 (`trading/`, ba trang,
còn 4 trang chỗ trống), 3.4 (`trade.service.ts`), mục mới 3.18, 4.2 (sơ đồ lối vào), 3.10 sinh bằng
`scan-pending.mjs --write-report`. Sơ đồ `docs/flows/purchase.md` sinh lại bằng `gen-flow-diagram.mjs`.
Điểm cắm 27 còn 22 rồi 21 (`node scripts/scan-pending.mjs --check`): gỡ `@pending FE-05` ở `/trade`,
`previewPurchaseAction`, `placeOrderAction`, `previewPurchase`; gỡ `@pending FE-06` ở `/orders`,
`listOrdersAction`. Giữ `@pending FE-06` ở `/transactions` và `executeOrderAction`.

## 7. Kết quả `run-local-all.sh`

Chạy **đúng một** lần, cuối task: **mã thoát 1, 6 PASS / 1 FAIL**.

```
$ bash scripts/run-local-all.sh
  => PASS có cảnh báo: luật kiến trúc   (3 cảnh báo có từ trước: SIGNER_KIND, địa chỉ mẫu ở mint.tsx, thiếu BASE_REF)
                                        Bảng quyền không teo lại so với origin/dev (32 -> 32 hành động)
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)    21 điểm cắm, 13 điểm chặn, 35 bước luồng
  => PASS: LỚP 3 - KHUÔN CHECKPOINT     mục 0: 30/60 dòng, 8 dòng / 8 điều kiện
  => FAIL: LỚP 1 - SPEC TEST CONTRACT EVM
  => PASS: APP - TYPECHECK
  => PASS: APP - LINT
  => PASS: APP - VITEST                 Test Files 25 passed, Tests 713 passed
```

Lỗi duy nhất, nguyên văn:

```
Caused by: Error: Failed to download https://binaries.soliditylang.org/linux-amd64/list.json - 403 received.
Host not in allowlist: binaries.soliditylang.org.
```

Chính sách mạng của môi trường chạy, không phải lỗi mã: `git diff --name-only origin/dev...HEAD --
packages/ | wc -l` cho `0`.
