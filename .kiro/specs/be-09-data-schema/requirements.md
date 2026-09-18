# BE-09 — Mở rộng lược đồ dữ liệu: requirements

| | |
|---|---|
| Mã task | BE-09 |
| Nhóm | Backend |
| Sprint | S1, due 24/09 |
| Điểm | 5 |
| Ưu tiên | P0 |
| Phụ thuộc | BE-02 (mô hình trạng thái lệnh mua đã chốt) |
| Nhánh | `feat/data-schema`, tạo **từ `dev`** |

## 1. Mục tiêu

Bổ sung các bảng cần cho ba luồng: lệnh mua WPT, kỳ chia lợi nhuận, hồ sơ tất toán từng nhà đầu tư, và mốc chạy của tiến trình hẹn giờ.

## 2. Hiện trạng

`app/prisma/schema.prisma` có: `Txn`, `AuditLog`, `Investor`, `Role`, `Permission`, `RolePermission`.

Quy ước đã dùng, phải giữ:
- Khóa chính `String @id @default(uuid())`
- Số tiền `Decimal? @db.Decimal(78, 0)` vì bigint không qua được biên tuần tự hóa
- Thời gian `DateTime @db.Timestamptz(3)`
- Prisma **chỉ dùng để sinh lược đồ** ra `init.sql`. Runtime dùng `pg` thuần, không dùng Prisma Client

## 3. Yêu cầu chức năng

### R1 — Bảng lệnh mua WPT

- **R1.1** Hệ thống PHẢI có bảng lưu lệnh mua với: ví nhà đầu tư, số lượng WPT, số VNDB phải trả, trạng thái, mã giao dịch, lý do thất bại, chuỗi, thời điểm tạo và cập nhật.
- **R1.2** Trạng thái PHẢI theo mô hình chốt ở BE-02, không tự định nghĩa khác.
- **R1.3** Bảng PHẢI có chỉ mục theo ví nhà đầu tư và theo trạng thái, vì hai truy vấn này dùng nhiều nhất.
- **R1.4** Hệ thống PHẢI có ràng buộc chống gửi giao dịch hai lần cho cùng một lệnh.

### R2 — Bảng kỳ chia lợi nhuận

- **R2.1** Hệ thống PHẢI có bảng kỳ chia với: mã kỳ, mã snapshot, tổng VNDB của kỳ, tổng cung WPT tại snapshot, trạng thái, thời điểm chốt quyền và hoàn tất.
- **R2.2** Mã kỳ PHẢI là duy nhất, để một kỳ không bị mở hai lần.
- **R2.3** Hệ thống PHẢI có bảng chi tiết từng lần chia: kỳ nào, ví nào, số dư tại snapshot, số tiền được chia, trạng thái, mã giao dịch, số thứ tự lô.
- **R2.4** Cặp kỳ và ví PHẢI là duy nhất, để một nhà đầu tư không bị chia trùng trong cùng kỳ.

### R3 — Bảng tất toán

- **R3.1** Hệ thống PHẢI có bảng đợt tất toán với: mã snapshot, giá NAV, trạng thái, thời điểm khởi tạo và hoàn tất.
- **R3.2** Hệ thống PHẢI có bảng hồ sơ từng người nắm giữ với bốn trạng thái: đã thông báo, đã xác nhận, đã chi trả, đã đốt.
- **R3.3** Mỗi trạng thái PHẢI lưu được thời điểm chuyển và mã giao dịch tương ứng nếu có.
- **R3.4** Cặp đợt tất toán và ví PHẢI là duy nhất.

### R4 — Bảng mốc chạy tiến trình hẹn giờ

- **R4.1** Hệ thống PHẢI có bảng ghi mỗi lần tiến trình hẹn giờ chạy: tên công việc, kỳ liên quan, thời điểm bắt đầu và kết thúc, kết quả, thông báo lỗi.
- **R4.2** Bảng PHẢI có ràng buộc chống chạy trùng cho cùng một công việc và cùng một kỳ.

### R5 — Tính toàn vẹn và tương thích

- **R5.1** Hệ thống KHÔNG được sửa hay xóa cột nào của các bảng đang có.
- **R5.2** Hệ thống PHẢI sinh lại `init.sql` từ `schema.prisma` sau khi sửa, không viết SQL bằng tay.
- **R5.3** Mọi số tiền PHẢI dùng `Decimal(78, 0)`, mọi thời gian PHẢI dùng `Timestamptz(3)`.
- **R5.4** Hệ thống PHẢI bổ sung tương ứng vào `ITxnStore` hoặc tạo cổng lưu trữ mới, và hiện thực ở **cả hai** bản bộ nhớ và Postgres.
- **R5.5** Bản bộ nhớ PHẢI giữ đủ ràng buộc duy nhất như bản Postgres. Nếu bản bộ nhớ dễ tính hơn thì sẽ sinh lỗi chỉ xuất hiện khi chạy Postgres.

## 4. Ngoài phạm vi

- Logic nghiệp vụ đọc ghi các bảng này (thuộc BE-02 đến BE-07).
- Bảng cho Indexer (thuộc IN-01).
- Chuyển bảng quyền sang cơ sở dữ liệu (thuộc AU-02).

## 5. Điều kiện hoàn thành

- [ ] `npx prisma validate` không lỗi.
- [ ] `init.sql` sinh lại từ lược đồ, không sửa tay.
- [ ] `docker compose up` khởi tạo cơ sở dữ liệu thành công từ đầu.
- [ ] Cổng lưu trữ có đủ hàm cho 4 nhóm bảng, hiện thực ở cả hai bản.
- [ ] Test: bản bộ nhớ và bản Postgres cùng từ chối khi vi phạm ràng buộc duy nhất.
- [ ] `bash scripts/run-local-all.sh` xanh toàn bộ.
