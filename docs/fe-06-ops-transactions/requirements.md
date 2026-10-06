# FE-06 — Màn Giao dịch của hai vai vận hành

| | |
|---|---|
| Nhánh | `feat/ops-transactions`, từ `dev` sau khi BE-16 đã merge |
| Điểm | 5 |
| Mức kiểm chứng | **Vừa** |
| Thứ tự | task thứ hai của đợt 4 |

## Mục tiêu

Màn tra cứu mọi lệnh mua bán của toàn hệ thống, theo tài liệu yêu cầu mục IV.3.3 cho Giao dịch viên và mục IV.4.3 cho Kiểm soát viên. Thay trang chỗ trống ở khu vực vận hành.

Hai vai dùng **chung một màn**, chỉ đọc. Khác biệt duy nhất là Giao dịch viên có thể khớp lệnh, Kiểm soát viên thì không.

## Việc cần làm

1. Bộ lọc: tìm theo mã lệnh hoặc nhà đầu tư, chọn nhà đầu tư, chiều lệnh, trạng thái, khoảng ngày.
2. Bảng gồm mã lệnh, nhà đầu tư, chiều, số token, số VNDB, **bước nghiệp vụ hiện tại**, trạng thái, thời điểm tạo và cập nhật. Có phân trang.
3. Bước nghiệp vụ hiện tại lấy từ ánh xạ năm bước mà BE-14 đã làm, **không tự suy ở giao diện**.
4. Mỗi dòng mở được màn chi tiết lệnh, dùng lại thành phần đã làm ở FE-25.
5. Giao dịch viên có nút khớp lệnh cho lệnh đang chờ; Kiểm soát viên **không có nút nào**.
6. Khớp lệnh xong thì bảng cập nhật, số liệu nguồn cung đổi theo.
7. Màn của Kiểm soát viên nêu rõ vai trò hiện tại chỉ có quyền xem.

## Ràng buộc

- Hai vai dùng chung một màn, phân biệt bằng quyền, không dựng hai màn riêng.
- Nhà đầu tư và Người bán không vào được màn này. Người bán đã có màn danh sách giao dịch riêng ở FE-21.
- Không gọi chuỗi trực tiếp từ thành phần giao diện.
- **Rà các ca kiểm thử đầu cuối còn bám vào nội dung trang chỗ trống này**, sửa cho khớp màn mới.

## Tác động

| | Tệp |
|---|---|
| Sửa | trang chỗ trống ở khu vực vận hành, các ca kiểm thử đầu cuối liên quan |
| Mới | màn giao dịch toàn hệ thống |
| Dùng lại | thành phần bảng lệnh và màn chi tiết của FE-25 |

## Mức kiểm chứng: Vừa

| Ca | Kiểm |
|---|---|
| 1 | Bộ lọc hoạt động theo từng tiêu chí, có phân trang |
| 2 | Bước nghiệp vụ hiện tại khớp với màn chi tiết của nhà đầu tư |
| 3 | Giao dịch viên khớp được lệnh đang chờ, bảng cập nhật |
| 4 | Kiểm soát viên không thấy nút khớp lệnh |
| 5 | Nhà đầu tư và Người bán vào màn này bị chặn |
| 6 | Kiểm thử đầu cuối cũ đã sửa, toàn bộ xanh |

## Điều kiện hoàn thành

- [ ] Màn đúng bố cục tài liệu, thay trang chỗ trống.
- [ ] Bước nghiệp vụ lấy từ nghiệp vụ, không tự suy.
- [ ] Giao dịch viên khớp được lệnh, Kiểm soát viên chỉ xem.
- [ ] Guard vai trò đúng cho cả bốn vai.
- [ ] Kiểm thử đầu cuối cũ đã sửa và xanh.
- [ ] `run-local-all.sh` xanh.

## Không làm

- Không dựng hai màn riêng cho hai vai.
- Không tự suy bước nghiệp vụ ở giao diện.
- Không cho hai vai ngoài ngân hàng vào màn này.
