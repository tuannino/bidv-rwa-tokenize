# FE-01 — Kênh nhà đầu tư: requirements

| | |
|---|---|
| Mã task | FE-01 |
| Nhóm | Giao diện |
| Sprint | S1 (15/09 - 26/09), due 22/09 |
| Điểm | 3 |
| Ưu tiên | P0 |
| Phụ thuộc | không |
| Nhánh | `feat/investor-channel`, tạo **từ `dev`** |

## 1. Mục tiêu

Dựng kênh thứ ba của hệ thống: khu vực dành riêng cho **nhà đầu tư**, tách khỏi kênh ngân hàng và kênh kiểm toán. Kênh này là nền để các task sau đặt màn hình lên: tổng quan nhà đầu tư (FE-04), đặt lệnh mua (FE-05), lợi nhuận (FE-09), tất toán (FE-11).

Task này **chỉ dựng khung**: route group, layout, điều hướng, guard quyền, và một trang chỗ trống. **Không** làm nghiệp vụ.

## 2. Bối cảnh mã nguồn hiện có

Đọc kỹ trước khi code, vì phần lớn việc là **tái dùng chứ không viết mới**:

| Thành phần | Đường dẫn | Dùng thế nào |
|---|---|---|
| Guard kênh | `components/layout/channel-guard.tsx` | **Tái dùng nguyên**, chỉ truyền `channel` và `requireAny` khác |
| Layout khung | `components/layout/app-layout.tsx` | Tái dùng, nhưng cần cho phép truyền cấu hình điều hướng |
| Điều hướng | `components/layout/sidebar.tsx` | **Đang ghi cứng menu của kênh ngân hàng.** Phải sửa để nhận danh sách menu từ ngoài |
| Bảng quyền | `lib/rbac/permissions.ts` | `INVESTOR` hiện có `token:transfer`, `balance:read`, `txn:read` |
| Mẫu layout kênh | `app/(admin)/layout.tsx`, `app/(audit)/layout.tsx` | Làm mẫu, giữ đúng cách viết |

## 3. Yêu cầu chức năng

### R1 — Route group riêng cho nhà đầu tư

- **R1.1** Hệ thống PHẢI có route group `app/(client)/` cho kênh nhà đầu tư.
- **R1.2** Route group PHẢI có `layout.tsx` bọc guard quyền, theo đúng mẫu của `(admin)` và `(audit)`.
- **R1.3** Hệ thống PHẢI có một trang chỗ trống tại `/portfolio` để xác nhận kênh hoạt động. Trang này sẽ bị FE-04 thay thế, nên KHÔNG đầu tư nội dung.

### R2 — Guard quyền vào kênh

- **R2.1** KHI vai trò hiện tại có quyền `balance:read`, hệ thống PHẢI cho vào kênh nhà đầu tư.
- **R2.2** KHI vai trò hiện tại KHÔNG có quyền `balance:read`, hệ thống PHẢI hiển thị màn từ chối của `ChannelGuard`, nêu rõ tên kênh và vai trò hiện tại.
- **R2.3** Guard PHẢI đặt ở `layout.tsx` của route group, KHÔNG đặt ở từng trang, để trang thêm sau này tự động được bảo vệ.
- **R2.4** Hệ thống KHÔNG được thêm quyền mới vào `permissions.ts` trong task này. Nếu thấy `INVESTOR` thiếu quyền cần thiết, ghi vào mục "Câu hỏi mở" của checkpoint thay vì tự thêm.

### R3 — Điều hướng theo kênh

- **R3.1** `Sidebar` PHẢI nhận danh sách menu qua tham số, thay vì ghi cứng như hiện nay.
- **R3.2** Kênh ngân hàng PHẢI giữ nguyên menu hiện tại, không thay đổi nhãn, thứ tự hay phím tắt.
- **R3.3** Kênh nhà đầu tư PHẢI có các mục: Tổng quan, Mua WPT, Lợi nhuận, Tất toán. Các mục chưa có trang thì trỏ tới trang chỗ trống hoặc vô hiệu hóa kèm chú thích "sắp có".
- **R3.4** Nhãn điều hướng PHẢI là tiếng Việt đủ dấu và dùng đúng ký hiệu **WPT** và **VNDB**.

### R4 — Phân tách giữa các kênh

- **R4.1** KHI vai trò là INVESTOR, hệ thống KHÔNG được hiển thị menu của kênh ngân hàng.
- **R4.2** KHI vai trò là ngân hàng, hệ thống KHÔNG được hiển thị menu của kênh nhà đầu tư.
- **R4.3** Kênh nhà đầu tư KHÔNG được gọi bất kỳ hàm đặc quyền nào (phát hành, đóng băng, thu hồi cưỡng chế, đặt giá NAV).

### R5 — Chuyển vai trò trong môi trường thử

- **R5.1** Bộ chuyển vai trò hiện có PHẢI bổ sung vai INVESTOR nếu chưa có, để thử kênh mà không cần xác thực thật.
- **R5.2** KHI đổi sang vai INVESTOR, hệ thống PHẢI điều hướng về trang mặc định của kênh nhà đầu tư thay vì để người dùng ở trang bị từ chối.

## 4. Ngoài phạm vi

- Nghiệp vụ của bất kỳ màn hình nào (thuộc FE-04, FE-05, FE-09, FE-11).
- Kết nối ví và xử lý sai mạng (thuộc **FE-02**).
- Xác thực thật bằng chữ ký ví (thuộc **AU-01**).
- Đọc số dư hay gọi chuỗi (thuộc BE-01).

## 5. Điều kiện hoàn thành

- [ ] Vai INVESTOR vào được `/portfolio`, thấy menu của kênh nhà đầu tư.
- [ ] Vai ngân hàng vào `/portfolio` thì bị chặn, hiện đúng màn từ chối.
- [ ] Vai INVESTOR vào `/mint` thì bị chặn.
- [ ] Menu kênh ngân hàng **không đổi một ký tự** so với `dev`.
- [ ] `permissions.ts` không bị thêm quyền mới.
- [ ] `bash scripts/run-local-all.sh` xanh toàn bộ.
- [ ] Có kiểm thử đầu cuối cho cả hai chiều chặn ở R4.1 và R4.2.
