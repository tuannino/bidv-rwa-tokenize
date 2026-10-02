# BE-14 — Chiều bán token và năm bước quyết toán

| | |
|---|---|
| Nhánh | `feat/sell-side`, từ `dev` sau khi FE-22 đã merge |
| Điểm | 8 |
| Mức kiểm chứng | **Cao** (chuyển tiền và token của nhà đầu tư) |
| Làm | trước FE-25; màn giao dịch của nhà đầu tư dựa vào task này |

## Mục tiêu

Tài liệu yêu cầu mục III.3 có **hai chiều**: nhà đầu tư mua token từ người bán, và bán lại cho người bán. Backend hiện **chỉ có chiều mua**.

Kèm theo: đổi tên các bước quyết toán cho khớp năm bước trong tài liệu, vì màn chi tiết lệnh của nhà đầu tư sẽ hiện đúng năm bước đó.

## Hiện trạng đã đo

```
$ python3 -c "... đọc purchase.service.ts ..."
hàm: previewPurchase, placeOrder, executeOrder, listOrders, expireStaleOrders
trạng thái lệnh: PLACED, CHECKING, EXECUTING, COMPLETED, REJECTED, FAILED, EXPIRED
chiều lệnh: KHÔNG có khái niệm mua hoặc bán
quyền order: order:place, order:execute, order:expire, order:read, order:read:all, order:draft, order:approve
```

Bảng lệnh và nghiệp vụ hiện **mặc định là mua**, không có trường phân biệt chiều.

## Việc cần làm

**Dữ liệu**

1. Thêm trường chiều lệnh vào bảng lệnh: mua hoặc bán. Lệnh cũ coi là mua.
2. Giữ nguyên bảy trạng thái hiện có. **Không** đổi tên trạng thái trong cơ sở dữ liệu.

**Nghiệp vụ bán**

3. Xem trước điều kiện bán: kiểm số token nhà đầu tư đang giữ, kiểm thanh khoản VNDB của ví thanh toán người bán, kiểm khả năng chuyển nhượng. Tái dùng hàm kiểm dùng chung, **không viết bản thứ hai**.
4. Đặt lệnh bán: tính số VNDB nhận được theo giá hiện hành, chốt tại thời điểm đặt.
5. Khớp lệnh bán: chuyển token từ nhà đầu tư về ví thanh toán người bán, và chuyển VNDB ngược lại, **trong cùng một giao dịch**.
6. Thiếu token hoặc ví người bán thiếu VNDB thì từ chối **trước khi** gửi giao dịch, không để lại trạng thái nửa vời.
7. Lệnh bán làm **tăng** số token chưa phân phối và **giảm** số đang lưu hành.

**Năm bước quyết toán**

8. Tài liệu mô tả tiến trình năm bước: tạo lệnh, kiểm tra, đối chiếu số dư, quyết toán, hoàn tất. Bổ sung **mốc thời gian từng bước** vào bản ghi lệnh để màn chi tiết hiện được tiến trình.
9. Ánh xạ bảy trạng thái hiện có sang năm bước hiển thị. Ánh xạ nằm ở tầng nghiệp vụ, **không để giao diện tự suy**.
10. Bước quyết toán là **một bước duy nhất**: bốn bút toán cùng thành công hoặc cùng huỷ. Ghi rõ điều này trong kết quả trả về, vì tài liệu nhấn mạnh nguyên tắc tất cả hoặc không gì.

**Truy vấn**

11. Danh sách lệnh lọc theo chiều, trạng thái, khoảng ngày, và mã lệnh.
12. Nhà đầu tư chỉ xem lệnh của chính mình; người bán và hai vai vận hành xem toàn bộ. Lọc ở tầng nghiệp vụ.
13. Bổ sung số liệu khớp lệnh trong ngày theo **cả hai chiều**, để màn tổng quan của người bán và bảng điều khiển vận hành hiện đủ bốn ô thay vì hai ô như hiện nay.

## Ràng buộc

- Lệnh bán và lệnh mua dùng **chung một bảng và chung một bộ trạng thái**. Tách hai bảng sẽ làm truy vấn và đối soát phức tạp gấp đôi.
- Giá lấy từ cấu hình, như chiều mua. Nhà đầu tư không nhập giá.
- Không đổi hành vi hiện có của chiều mua. Toàn bộ kiểm thử chiều mua phải xanh nguyên.
- Mọi số lượng và số tiền truyền dạng chuỗi.

## Tác động

| | Tệp |
|---|---|
| Sửa | `prisma/schema.prisma` và tệp khởi tạo, `lib/store/order.store.port.ts` và hai bản hiện thực, `lib/bank/purchase.service.ts`, `lib/ledger/ledger.port.ts` nếu thiếu phương thức, ba adapter, `app/actions/purchase.ts` |
| Bị ảnh hưởng | kiểm thử lệnh mua, kiểm thử ràng buộc lưu trữ, kiểm thử tầng cổng chuỗi |

## Mức kiểm chứng: Cao

Trong lúc làm:

```
cd app && npx vitest run test/purchase-service.test.ts test/store-constraints.test.ts
cd app && npx vitest run test/mock-ledger.test.ts
```

Cuối task: `bash scripts/run-local-all.sh` một lần.

Ca kiểm thử:

| Ca | Kiểm |
|---|---|
| 1 | Bán thành công: token về ví người bán, VNDB về nhà đầu tư, số đúng |
| 2 | Bán khi thiếu token thì từ chối, **không** gửi giao dịch |
| 3 | Ví người bán thiếu VNDB thì từ chối, không bên nào đổi số dư |
| 4 | Lệnh bán làm tăng số chưa phân phối và giảm số đang lưu hành |
| 5 | Năm bước quyết toán có mốc thời gian, ánh xạ đúng từ bảy trạng thái |
| 6 | Nhà đầu tư không xem được lệnh của ví khác |
| 7 | Số liệu khớp lệnh trong ngày đủ bốn ô, đúng cả hai chiều |
| 8 | Toàn bộ kiểm thử chiều mua vẫn xanh |

Đột biến, **chỉ hai chỗ**:

- Khớp lệnh bán thất bại giữa chừng: **không bên nào** bị đổi số dư.
- Bỏ lọc theo ví ở tầng nghiệp vụ: ca 6 phải đỏ.

## Điều kiện hoàn thành

- [ ] Lệnh có chiều mua và bán, dùng chung một bảng và một bộ trạng thái.
- [ ] Bán thành công thì token và VNDB đổi đúng hai chiều.
- [ ] Thiếu token hoặc thiếu VNDB thì từ chối trước khi gửi giao dịch.
- [ ] Số chưa phân phối và số đang lưu hành đổi đúng sau khi bán.
- [ ] Năm bước quyết toán có mốc thời gian, ánh xạ ở tầng nghiệp vụ.
- [ ] Nhà đầu tư chỉ xem được lệnh của mình.
- [ ] Số liệu khớp lệnh trong ngày đủ bốn ô.
- [ ] Kiểm thử chiều mua xanh nguyên.
- [ ] `run-local-all.sh` xanh.

## Không làm

- Không tách bảng riêng cho lệnh bán.
- Không viết bản logic kiểm thứ hai cho chiều bán.
- Không đổi tên trạng thái trong cơ sở dữ liệu; chỉ ánh xạ khi hiển thị.
- Không cho nhà đầu tư nhập giá.
- Không làm giao diện. Thuộc FE-25.
