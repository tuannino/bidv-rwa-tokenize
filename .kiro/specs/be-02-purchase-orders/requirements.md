# BE-02 — Quản lý lệnh mua WPT: requirements

Spec giao việc: `docs/be-02-purchase-orders/requirements.md`.
Tài liệu này là bản Kiro làm việc — ghi **hiện trạng đã đo** và **kết quả thực tế**, để task
sau không phải đọc lại mã nguồn mới biết cái gì đã có, cái gì còn nợ.

Nhánh `feat/purchase-orders`, tạo từ `dev` @ `fdb7b55`.

## 1. Mục tiêu

Nghiệp vụ lệnh mua WPT: nhà đầu tư đặt lệnh, hệ thống kiểm số dư VNDB / ủy quyền / tồn WPT,
nếu đạt thì chuyển VNDB và chuyển WPT trong **cùng một** giao dịch.

Hệ quả phải giữ: **không tồn tại trạng thái "đã trả tiền nhưng chưa nhận token"**.

## 2. Hiện trạng đã đo (không phải theo trí nhớ)

Đo bằng `git grep` trên `dev` @ `fdb7b55` trước khi viết dòng mã nào.

### 2.1. Ba phụ thuộc mà spec giao việc nêu

| Phụ thuộc | Trạng thái đo được | Hệ quả |
|---|---|---|
| BE-01 — `ILedgerPort` | ✅ Có `ILedgerPurchase` với `quotePurchase`, `paymentBalanceOf`, `paymentAllowanceOf`, `executePurchase` | Dùng được ngay |
| BE-08 — quyền `order:*` | ❌ `git grep "order:place\|order:execute"` → **0 kết quả** | BE-02 phải khai trước |
| BE-09 — bảng lệnh mua | ❌ `git grep "PurchaseOrder\|purchase_order"` → **0 kết quả**; `store.port.ts` chỉ có `ITxnStore` | BE-02 phải khai trước |

Không có `.kiro/specs/be-08-*` hay `be-09-*` nên cũng không có hình dạng nào để tuân theo.

### 2.2. Khoảng trống trong `ILedgerPort` mà spec giao việc không lường

QĐ-2 của `design.md` buộc kiểm "ví thanh toán SPV còn đủ WPT" bằng `balanceOf`. Nhưng
`ILedgerPort` **không có** đường lấy địa chỉ ví SPV: `mintInitialSupply(to, …)` nhận địa chỉ
vào, `executePurchase(investor, …)` biết ví đó nhưng không trả ra, và không có getter nào.

Hai lối duy nhất: thêm một method đọc, hoặc bỏ hẳn một trong bốn phép kiểm. Đã chọn lối thứ
nhất — xem `design.md` mục 2.

### 2.3. Adapter nào chạy được luồng mua

| Method | mock | evm | stellar |
|---|---|---|---|
| `quotePurchase` | ✅ | ⏳ SC-03 | ⏳ |
| `paymentBalanceOf` | ✅ | ✅ | ⏳ |
| `paymentAllowanceOf` | ✅ | ⏳ SC-03 | ⏳ |
| `executePurchase` | ✅ | ⏳ SC-03 | ⏳ |
| `spvWallet` (thêm ở BE-02) | ✅ | ⏳ SC-02 | ⏳ |

**Kết luận:** luồng mua chạy đủ trên chain `mock`, chưa chạy được trên `evm`/`hardhat-local`.
Đây là nợ của SC-02/SC-03, không phải của BE-02: service không phải sửa khi contract có.

### 2.4. Mẫu đã có, phải theo

- `mint.service.ts`: hai lối vào (server action + route handler), một điểm hội tụ; guard và
  audit ở tầng service; lưu tx PENDING **trước** khi chờ biên nhận; đọc lại số dư từ chuỗi.
- `authorize.ts`: `authorize(action, target, chain)` ghi audit ALLOWED/DENIED rồi mới ném;
  `toResult(error)` quy lỗi thành mã.
- `portfolio.service.ts`: lọc theo ví ở tầng nghiệp vụ, và **ghi rõ giới hạn** chưa có SIWE.

## 3. Kết quả thực tế theo từng yêu cầu

| Yêu cầu | Kết quả | Bằng chứng |
|---|---|---|
| R1.1 quyền `order:place` | ✅ | `permissions.ts`; test "vai không có order:place bị chặn" |
| R1.2 validate ví + số nguyên dương | ✅ | `placeOrderSchema`; test 5 đầu vào sai |
| R1.3 tính và **lưu** số VNDB lúc đặt | ✅ | `placeOrder` → `quotePurchase` → `createOrder` |
| R1.4 audit cả hai kết cục | ✅ | `authorize()` + bản ghi SUCCESS; test đếm 3 bản ghi DENIED |
| R2.1 kiểm ba điều kiện trước khi gửi | ✅ | `runPurchaseChecks` |
| R2.2 nêu rõ điều kiện nào, không gửi tx | ✅ | 5 mã lỗi riêng; test kiểm `sendCount === 0` |
| R2.3 kiểm `canTransfer` trước khi gửi | ✅ | phép kiểm thứ 4 |
| R3.1 quyền `order:execute` | ✅ | test 7.9, 3 vai bị chặn |
| R3.2 lưu tx trước khi chờ biên nhận | ✅ | `attachOrderTxHash` + `saveTxn`; test biên nhận FAILED vẫn còn `txHash` |
| R3.3 chờ biên nhận, cập nhật theo kết quả | ✅ | `waitReceipt(receiptTimeoutFor(chain))` |
| R3.4 đọc lại số dư từ chuỗi | ✅ | test so `balanceAfter` với `balanceOf` gọi trực tiếp |
| R3.5 chỉ gửi đúng một lần | ✅ | test tuần tự **và** test `Promise.all`, đếm `sendCount === 1` |
| R4.1 một chiều | ✅ | `ORDER_RANK`; test mọi chuyển tiếp đều tăng hạng |
| R4.2 không có trạng thái trả tiền chưa nhận token | ✅ | `findPaidPendingDeliveryStatuses()` + 3 test |
| R4.3 chuyển sai bị từ chối | ✅ | test 6 cặp hợp lệ / 43 cặp bị chặn |
| R4.4 lệnh quá hạn về trạng thái kết thúc | ✅ | `expireStaleOrders` |
| R5.1 nhà đầu tư chỉ xem lệnh ví mình | ⚠️ Một phần | Đạt "không lẫn ví khác"; **không** ràng buộc được ví ↔ phiên vì chưa có SIWE — xem câu hỏi mở |
| R5.2 vai ngân hàng xem toàn bộ, lọc trạng thái | ✅ | `can(role, 'order:read:all')` |
| R5.3 trả số dạng chuỗi | ✅ | `OrderView`; test kiểm `typeof === 'string'` |
| R6.1 chain qua `ILedgerPort` | ✅ | `verify-arch-rules.sh` luật #1 PASS |
| R6.2 transport là vỏ mỏng | ✅ | hai tệp chỉ chuyển tiếp |
| R6.3 guard trong service | ✅ | `git grep authorize` trong `actions/purchase.ts` và `api/purchase/` → 0 |

## 4. Điều kiện hoàn thành

| Mục | Kết quả |
|---|---|
| Đặt lệnh, tính đúng số VNDB | ✅ |
| Thiếu số dư / ủy quyền / tồn WPT → từ chối **trước** khi gửi tx | ✅ (3 test, mỗi test kiểm cả `sendCount === 0`) |
| Khớp thành công: WPT tăng đúng, VNDB giảm đúng | ✅ (kiểm cả 4 số dư hai bên) |
| Khớp thất bại: **không bên nào** đổi số dư | ✅ (2 test: lỗi khi gửi, và biên nhận FAILED) |
| Gọi khớp hai lần chỉ gửi một giao dịch | ✅ (tuần tự + đồng thời) |
| Chuyển trạng thái sai bị từ chối, có test | ✅ |
| Nhà đầu tư không xem lệnh ví khác, có test | ⚠️ Đạt mức "không lẫn ví khác" |
| Sổ kiểm toán có bản ghi cho cả lần bị chặn | ✅ |
| `bash scripts/run-local-all.sh` xanh toàn bộ | ✅ 6/6, 176 test |
