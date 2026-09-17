# BE-02 — Quản lý lệnh mua WPT: tasks

Spec giao việc: `docs/be-02-purchase-orders/tasks.md`. Bản này đánh dấu **đã làm gì** và
**commit nào**.

Nhánh `feat/purchase-orders`, tạo từ `dev` @ `fdb7b55`.

## Bước 1: Mô hình trạng thái — `2098763`

- [x] 1.1 `lib/bank/purchase.state.ts`, 7 trạng thái đúng bảng design mục 1.
- [x] 1.2 `canTransitionOrder` / `assertTransitionOrder` dựa trên `ORDER_TRANSITIONS`.
- [x] 1.3 Xác nhận không có trạng thái "đã trả tiền chưa nhận token" — chốt bằng
      `findPaidPendingDeliveryStatuses()`, không chỉ bằng ghi chú.
- [x] 1.4 `test/purchase-state.test.ts`: 19 test, 6 cặp hợp lệ + 43 cặp bị chặn + 9 cặp sai
      điển hình được nêu tên lý do.
- [x] 1.5 Mô hình đã chốt, BE-09 dựng bảng theo `ORDER_STATUSES` + `ORDER_TRANSITIONS`.
      Bảng Postgres tương ứng đã có sẵn ở `prisma/schema.prisma` (enum `OrderStatus`).

## Bước 2: Schema và mã lỗi — `377ed2f`

- [x] 2.1 4 schema mới; `wptAmount` dùng lại `amountSchema` nên quy tắc "số nguyên dương" chỉ
      có một chỗ.
- [x] 2.2 5 mã lỗi mới đúng bảng design mục 5.
- [x] 2.3 `httpStatusFor`: cả 5 → **409**. Không 400 (dữ liệu vào hợp lệ, vấn đề ở trạng thái
      hệ thống) và không 502 (chain không hỏng, chưa hề được gọi để ghi).
- [x] 2.4 Giữ nguyên 7 mã cũ.

Kèm trong commit này: 5 quyền `order:*` — **nợ BE-08**, xem checkpoint.

## Bước 2b (ngoài spec giao việc): tầng lưu trữ — `f3e06aa`

**Nợ BE-09.** BE-02 khai trước vì không có bảng thì không hiện thực được nghiệp vụ nào.
`IOrderStore` + bản bộ nhớ + bản Postgres + `prisma/schema.prisma` + `init.sql` +
`ensurePurchaseOrderTable()` cho volume dựng trước BE-02.

## Bước 2c (ngoài spec giao việc): `spvWallet()` — `8d28c9d`

**Nợ BE-01.** Không có nó thì không làm được phép kiểm thứ 3 của QĐ-2. Xem `design.md` QĐ-A.

## Bước 3: Đặt lệnh — `ab09c9d`

- [x] 3.1 `placeOrder` trong `lib/bank/purchase.service.ts`.
- [x] 3.2 Quyền `order:place`; audit cả hai kết cục.
- [x] 3.3 Số VNDB tính qua `ledger.quotePurchase` rồi **lưu** vào lệnh.
- [x] 3.4 `Result<OrderView>`, mọi con số dạng chuỗi.

## Bước 4: Khớp lệnh — `55850e0`

- [x] 4.1 `executeOrder` theo đúng 11 bước design mục 6.
- [x] 4.2 Bốn phép kiểm đúng thứ tự QĐ-2, dừng ở lần trượt đầu tiên. Mỗi phép mang sẵn mã lỗi
      thay vì để `executeOrder` suy ra mã từ chuỗi lý do.
- [x] 4.3 `transitionOrder(CHECKING → EXECUTING)` có điều kiện; `null` → `ORDER_STATE`.
- [x] 4.4 `attachOrderTxHash()` lưu mã giao dịch ngay khi có (QĐ-B).
- [x] 4.5 Đọc lại `balanceOf` từ chuỗi sau khi hoàn tất.
- [x] 4.6 Audit cả thành công và thất bại, ghi vai **đang khớp**.

## Bước 5: Truy vấn và hết hạn — `50fbdb1`

- [x] 5.1 `listOrders` lọc theo ví ở tầng nghiệp vụ.
- [x] 5.2 Vai không có `order:read:all` thì `investorWallet` là **bắt buộc**; thiếu là lỗi
      validate, không phải trả toàn bộ sổ lệnh.
- [x] 5.3 `expireStaleOrders` chỉ cung cấp hàm, không dựng lịch.

## Bước 6: Tầng vận chuyển — `a1887b3`

- [x] 6.1 `app/actions/purchase.ts` — 4 action, chỉ chuyển tiếp.
- [x] 6.2 `app/api/purchase/route.ts` — POST đặt/khớp (phân nhánh bằng `orderId`), GET sổ lệnh.
- [x] 6.3 Map mã lỗi qua `httpStatusFor`.
- [x] 6.4 `git grep authorize` trong hai tệp này → **0 kết quả**.

`expireStaleOrders` cố ý không có điểm vào HTTP: thao tác dọn dẹp theo lịch của BE-07, mở
đường gọi tay là mời gọi gọi giữa lúc có lệnh đang xử lý.

## Bước 7: Kiểm thử — `8f42f69` (sửa lỗi cũ) + `59ad280` (test)

- [x] 7.1 `test/purchase-service.test.ts`, 32 test, chạy với adapter mock thật.
- [x] 7.2 Thiếu số dư VNDB → `REJECTED`, `sendCount === 0`, số dư không đổi.
- [x] 7.3 Thiếu ủy quyền → `REJECTED`.
- [x] 7.4 Ví SPV thiếu WPT → `REJECTED`.
- [x] 7.5 Khớp thành công → kiểm cả **bốn** số dư (WPT/VNDB của hai bên).
- [x] 7.6 Khớp thất bại → không bên nào đổi số dư. **Hai** ca: lỗi khi gửi, và biên nhận FAILED.
- [x] 7.7 Gọi hai lần chỉ gửi một giao dịch. **Hai** ca: tuần tự và `Promise.all` đồng thời.
- [x] 7.8 Nhà đầu tư không xem được lệnh ví khác.
- [x] 7.9 Vai không có `order:execute` bị chặn, có bản ghi kiểm toán.
- [x] 7.10 `bash scripts/run-local-all.sh` → ĐẠT 6/6, 176 test.

Ghi chú kỹ thuật: ca 7.6 cần thất bại **sau** khi bốn phép kiểm đã đạt. Trên mock không dựng
được bằng cách nạp trạng thái, vì bốn phép kiểm đọc đúng những điều kiện mà `executePurchase`
kiểm lại — đó là tính chất tốt của thiết kế nhưng khiến nhánh `FAILED` không có đường vào. Đã
bọc `@/lib/ledger` bằng một vỏ mặc định **chuyển tiếp nguyên vẹn**, chỉ hỏng khi test bật cờ;
30 ca còn lại vẫn chạy trên adapter thật.

## Bước 8: Tài liệu — commit cuối

- [x] 8.1 `tech-report.md` mục 3.4 (thêm `purchase.service` + `purchase.state`, bảng trạng
      thái), mục 3.1 (27 → 28 method), mục 3.5 (`IOrderStore`/`IBankStore`).
- [x] 8.2 Mục 4.2 mới — bản đồ luồng mua: từng bước ghi rõ file, hàm, thứ tự, và **ai ký**
      (ví ngân hàng/SPV, khác luồng REDEEM).
- [x] 8.3 Metadata → phiên bản 1.6, nhánh `feat/purchase-orders`, lộ trình phase.

## Việc KHÔNG được làm — đã tự kiểm

| Điều cấm | Kiểm bằng | Kết quả |
|---|---|---|
| Thêm trạng thái trả tiền chưa nhận token | `findPaidPendingDeliveryStatuses()` + test | ✅ rỗng |
| Gọi `viem` trực tiếp | `verify-arch-rules.sh` luật #1 | ✅ PASS |
| Guard quyền ở transport | `git grep authorize app/src/app/{actions/purchase.ts,api/purchase}` | ✅ 0 |
| Tính lại số VNDB khi khớp | `runPurchaseChecks` chỉ **so sánh**, `sendAndSettle` đọc `order.vndAmount` | ✅ |
| Ghi số dư WPT vào bảng lệnh | `PurchaseOrder` không có cột số dư | ✅ |
| Dựng lịch tự động | `git grep setInterval\|cron` trong `lib/bank` | ✅ 0 |
| Làm giao diện | `git diff --stat` không có `components/` | ✅ |
