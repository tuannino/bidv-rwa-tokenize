# FE-24 — Màn Thông tin tài khoản bốn vai và ba chỉ tiêu token

| | |
|---|---|
| Nhánh | `feat/account-info`, từ `dev` sau khi FE-06 đã merge |
| Điểm | 5 |
| Mức kiểm chứng | **Vừa** |
| Thứ tự | task cuối của đợt 4 và của bản trình diễn |

## Mục tiêu

Màn thông tin tài khoản dùng chung bốn vai, theo tài liệu yêu cầu mục IV.1.5, IV.2.4, IV.3.5, IV.4.5. Thay trang chỗ trống cuối cùng.

Kèm theo: bổ sung **ba chỉ tiêu token** mà FE-25 đang hiện "Chưa có dữ liệu", theo chốt của chủ dự án.

## Việc cần làm

**Màn thông tin tài khoản**

1. Bố cục dùng chung, nội dung khác theo vai.
2. Nhà đầu tư: thông tin cá nhân gồm tên, số điện thoại, thư điện tử, trạng thái định danh, địa chỉ ví; khối tài khoản gồm mã người dùng, vai trò, trạng thái, ngày tạo, hoạt động gần nhất; khối hồ sơ định danh và rủi ro gồm loại khách hàng, trạng thái định danh, xếp hạng rủi ro, trạng thái phòng chống rửa tiền, hạn mức giao dịch mỗi ngày.
3. Người bán: cùng bố cục, nhưng loại khách hàng là tổ chức, có thông tin liên hệ của pháp nhân và địa chỉ ví thanh toán.
4. Hai vai ngân hàng: chỉ có thông tin cán bộ gồm mã, vai trò, trạng thái, liên hệ, hoạt động gần nhất. **Không có** hồ sơ định danh đầu tư và **không có** ví.
5. Màn chỉ đọc với cả bốn vai.

**Ba chỉ tiêu token**

6. Bổ sung ba khoá cấu hình cho token: tuổi thọ còn lại, lợi tức năm, phí giao dịch.
7. Giá trị khởi tạo theo tài liệu: tuổi thọ còn lại 15 năm, lợi tức khoảng 5,8 phần trăm mỗi năm, phí giao dịch không tính.
8. Màn giao dịch token của FE-25 đọc ba giá trị này thay cho dòng "Chưa có dữ liệu".
9. Màn tổng quan của Người bán và màn chi tiết token cũng dùng cùng nguồn, **không khai lại ở từng màn**.

**Hồ sơ định danh và rủi ro**

10. Bổ sung các trường hồ sơ vào dữ liệu nhà đầu tư và người bán, nạp giá trị mẫu theo tài liệu.
11. Khối kiểm tra trước lệnh của FE-25 đọc trạng thái định danh và rủi ro từ nguồn này, thay cho giá trị cố định nếu đang có.

## Ràng buộc

- Ba chỉ tiêu token là **cấu hình**, không viết cứng ở màn.
- Mỗi vai chỉ xem hồ sơ của chính mình.
- Màn chỉ đọc, không có nút sửa.
- **Rà các ca kiểm thử đầu cuối còn bám vào nội dung trang chỗ trống này.**

## Tác động

| | Tệp |
|---|---|
| Sửa | trang chỗ trống thông tin tài khoản, màn giao dịch token của FE-25, màn tổng quan Người bán, dữ liệu khởi tạo cấu hình và hồ sơ |
| Mới | màn thông tin tài khoản dùng chung |

## Mức kiểm chứng: Vừa

| Ca | Kiểm |
|---|---|
| 1 | Bốn vai thấy đúng nội dung của vai mình |
| 2 | Hai vai ngân hàng không có hồ sơ định danh đầu tư và không có ví |
| 3 | Ba chỉ tiêu token hiện số thật, không còn dòng chưa có dữ liệu |
| 4 | Đổi giá trị cấu hình thì cả ba màn dùng chúng đổi theo |
| 5 | Mỗi vai chỉ xem hồ sơ của chính mình |
| 6 | Kiểm thử đầu cuối cũ đã sửa và xanh |

## Điều kiện hoàn thành

- [ ] Màn thông tin tài khoản đúng nội dung cho cả bốn vai, thay trang chỗ trống cuối cùng.
- [ ] Ba chỉ tiêu token lấy từ cấu hình, hiện ở cả ba nơi dùng chúng.
- [ ] Không còn dòng "Chưa có dữ liệu" ở màn giao dịch token.
- [ ] Khối kiểm tra trước lệnh đọc trạng thái định danh và rủi ro từ hồ sơ.
- [ ] Mỗi vai chỉ xem hồ sơ của mình.
- [ ] Kiểm thử đầu cuối cũ đã sửa và xanh.
- [ ] **Không còn trang chỗ trống nào trong ứng dụng.**
- [ ] `run-local-all.sh` xanh.

## Không làm

- Không viết cứng ba chỉ tiêu token.
- Không cho sửa hồ sơ ở màn này.
- Không để vai này xem hồ sơ vai khác.
