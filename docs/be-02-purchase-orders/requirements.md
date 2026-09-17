# BE-02 — Quản lý lệnh mua WPT: requirements

| | |
|---|---|
| Mã task | BE-02 |
| Nhóm | Backend |
| Sprint | S1, due 26/09 |
| Điểm | 5 |
| Ưu tiên | P0 |
| Phụ thuộc | BE-08 (quyền), BE-09 (bảng dữ liệu), BE-01 (interface) |
| Nhánh | `feat/purchase-orders`, tạo **từ `dev`** |

## 1. Mục tiêu

Xây dựng nghiệp vụ lệnh mua WPT của nhà đầu tư, theo luồng đã chốt: nhà đầu tư đặt lệnh, hệ thống kiểm số dư VNDB, nếu đủ thì chuyển VNDB vào ví thanh toán SPV và chuyển WPT từ ví thanh toán SPV sang nhà đầu tư trong **cùng một giao dịch**.

Đây là phần **mới hoàn toàn**, chưa có gì trong repo phục vụ việc này.

## 2. Bối cảnh

Luồng chốt (mục 1.4 tài liệu nghiệp vụ) đơn giản hơn diagram P4 ban đầu: không còn bước ngân hàng đối soát thanh toán thủ công. Hệ thống tự kiểm số dư rồi thực hiện cả hai chiều chuyển trong một giao dịch.

Hệ quả quan trọng: **không tồn tại trạng thái "đã trả tiền nhưng chưa nhận token"**. Đây là điểm an toàn phải giữ, và mô hình trạng thái phải phản ánh đúng điều đó.

Quy ước đã có, phải giữ:
- `Result<T>` thay vì ném lỗi, vì thông báo lỗi bị che ở môi trường thật và kết quả phải qua được biên máy chủ sang trình duyệt
- Số lượng truyền dạng chuỗi, không dùng `bigint` hay số thực
- Guard quyền và ghi sổ kiểm toán đặt ở tầng nghiệp vụ, không đặt ở tầng vận chuyển
- Lưu giao dịch trạng thái chờ **trước khi** đợi biên nhận

## 3. Yêu cầu chức năng

### R1 — Đặt lệnh

- **R1.1** Nhà đầu tư PHẢI có quyền `order:place` mới đặt được lệnh.
- **R1.2** Hệ thống PHẢI kiểm tra dữ liệu vào: ví đúng định dạng, số lượng WPT là chuỗi số nguyên dương.
- **R1.3** Hệ thống PHẢI tính số VNDB phải trả và lưu vào lệnh tại thời điểm đặt.
- **R1.4** Hệ thống PHẢI ghi sổ kiểm toán cho cả hai kết cục được phép và bị chặn.

### R2 — Kiểm tra trước khi gửi giao dịch

- **R2.1** Hệ thống PHẢI kiểm **ba** điều kiện trước khi gửi giao dịch: số dư VNDB của nhà đầu tư, mức ủy quyền VNDB đã cấp, và số WPT còn lại trong ví thanh toán SPV.
- **R2.2** KHI một điều kiện không đạt, hệ thống PHẢI từ chối và nêu rõ điều kiện nào, KHÔNG gửi giao dịch để tránh tốn phí.
- **R2.3** Hệ thống PHẢI kiểm tra khả năng chuyển nhượng qua hàm đọc của `ILedgerPort` trước khi gửi.

### R3 — Khớp lệnh

- **R3.1** Người khớp lệnh PHẢI có quyền `order:execute`.
- **R3.2** Hệ thống PHẢI lưu lệnh ở trạng thái đang xử lý **trước khi** gửi giao dịch, để tiến trình chết giữa chừng vẫn còn dấu vết đối soát.
- **R3.3** Hệ thống PHẢI chờ biên nhận và cập nhật trạng thái theo kết quả.
- **R3.4** Sau khi hoàn tất, hệ thống PHẢI đọc lại số dư WPT của nhà đầu tư từ chuỗi, KHÔNG tin biên nhận.
- **R3.5** Hệ thống PHẢI bảo đảm một lệnh chỉ gửi giao dịch **đúng một lần**, kể cả khi bị gọi đồng thời nhiều lần.

### R4 — Mô hình trạng thái

- **R4.1** Hệ thống PHẢI định nghĩa mô hình trạng thái một chiều, không cho quay lui.
- **R4.2** Hệ thống KHÔNG được có trạng thái nào mô tả việc đã trả tiền mà chưa nhận token, vì giao dịch là nguyên khối.
- **R4.3** Mọi lần chuyển trạng thái PHẢI kiểm tra trạng thái nguồn có hợp lệ hay không, chuyển sai PHẢI bị từ chối.
- **R4.4** Lệnh quá hạn PHẢI chuyển sang trạng thái kết thúc, không treo vô hạn.

### R5 — Truy vấn

- **R5.1** Nhà đầu tư PHẢI chỉ xem được lệnh của chính ví mình.
- **R5.2** Vai ngân hàng PHẢI xem được toàn bộ lệnh, lọc theo trạng thái.
- **R5.3** Hệ thống PHẢI trả số lượng và số tiền dạng chuỗi.

### R6 — Ranh giới

- **R6.1** Service PHẢI gọi chuỗi qua `ILedgerPort`, KHÔNG gọi trực tiếp.
- **R6.2** Server action và route handler PHẢI là vỏ mỏng, chuyển tiếp sang service.
- **R6.3** Guard quyền PHẢI nằm trong service, vì server action gọi được trực tiếp bằng yêu cầu HTTP mà không đi qua giao diện.

## 4. Ngoài phạm vi

- Giao diện đặt lệnh và theo dõi (thuộc FE-05, FE-06).
- Chức năng phát hành VNDB demo (task riêng).
- Đối soát toàn hệ (thuộc BE-11).
- Xử lý giao dịch treo dùng chung (thuộc BE-10).

## 5. Điều kiện hoàn thành

- [ ] Nhà đầu tư đặt được lệnh, hệ thống tính đúng số VNDB phải trả.
- [ ] Thiếu số dư, thiếu ủy quyền, hoặc ví SPV thiếu WPT thì từ chối **trước khi** gửi giao dịch.
- [ ] Khớp lệnh thành công thì số dư WPT của nhà đầu tư tăng đúng, số dư VNDB giảm đúng.
- [ ] Khớp lệnh thất bại thì **không bên nào** bị thay đổi số dư.
- [ ] Gọi khớp lệnh hai lần cho cùng một lệnh chỉ gửi một giao dịch.
- [ ] Chuyển trạng thái sai bị từ chối, có test.
- [ ] Nhà đầu tư không xem được lệnh của ví khác, có test.
- [ ] Sổ kiểm toán có bản ghi cho cả lần bị chặn.
- [ ] `bash scripts/run-local-all.sh` xanh toàn bộ.
