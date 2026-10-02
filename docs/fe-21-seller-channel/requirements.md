# FE-21 — Kênh Người bán

| | |
|---|---|
| Nhánh | `feat/seller-channel`, từ `dev` sau khi BE-12 đã merge |
| Điểm | 8 |
| Mức kiểm chứng | **Vừa** |
| Làm | song song được với FE-22, vì không đụng cùng tệp |
| Lưu ý | Nghiệp vụ rút là **BE-13**, chưa làm. Trang chỗ trống hiện trỏ sang BE-13 sau khi BE-12 sửa lại |

## Mục tiêu

Ba màn của vai Người bán theo tài liệu yêu cầu mục IV.2: Tổng quan, Danh sách giao dịch, Tạo lệnh rút. FE-20 đã dựng khung và ba trang chỗ trống.

Màn Tạo lệnh rút **phụ thuộc BE-13** chưa làm, nên task này dựng giao diện và để điểm cắm; phần gọi nghiệp vụ nối khi BE-13 xong.

## Việc cần làm

**Màn Tổng quan**

1. Khối token khớp lệnh trong ngày: số lượng mua, tổng giá trị mua, số lượng bán, tổng giá trị bán.
2. Khối thông tin nguồn cung kèm **định nghĩa từng chỉ tiêu**: trần phát hành, số còn được phát hành, tổng cung hiện tại, số chưa phân phối, số đang lưu hành.
3. Khối thông tin token: mã, dự án, trần phát hành, giá phát hành, trạng thái token và trạng thái giao dịch.
4. Bảng tồn kho token: một dòng mỗi token với đủ các chỉ tiêu.
5. Khối tài sản trong ví thanh toán: số token chưa phân phối và số VNDB, ghi rõ phần đã khoá và phần còn rút được.
6. Khối số dư ví: tổng VNDB ví thanh toán, ví chia lợi nhuận, phần khoá, hạn mức còn rút được.
7. Hai nút tắt sang Danh sách giao dịch và Tạo lệnh rút. Màn chỉ đọc.

**Màn Danh sách giao dịch**

8. Bộ lọc theo mã lệnh hoặc nhà đầu tư, loại, trạng thái, khoảng ngày.
9. Bảng gồm mã lệnh, nhà đầu tư, loại, số token, số VNDB, bước nghiệp vụ hiện tại, trạng thái, thời điểm tạo và cập nhật. Có phân trang. Màn chỉ đọc.

**Màn Tạo lệnh rút**

10. Biểu mẫu: số tiền rút, mạng, địa chỉ ví nhận, mục đích, ghi chú.
11. Khối hệ thống hiển thị: số dư VNDB ví thanh toán, phần khoá, hạn mức còn rút được, phí rút, số tiền nhận được.
12. Nhập quá hạn mức thì **khoá nút và hiện cảnh báo vượt hạn mức**.
13. Xác nhận bằng mã một lần sáu chữ số, rồi hoàn tất ngay, không qua phê duyệt.
14. Bảng yêu cầu rút của mình.
15. Phần gọi nghiệp vụ gắn điểm cắm **chờ BE-13**; giai đoạn này dùng dữ liệu tạm và ghi rõ trên màn.
16. Số liệu nguồn cung và tồn kho lấy từ nghiệp vụ đã có, **không tự tính lại ở giao diện**. Các chỉ tiêu phải khớp với màn của Giao dịch viên khi cùng thời điểm.

## Ràng buộc

- Hạn mức có **hai chế độ** theo chốt của chủ dự án: khoá một số tiền cố định, hoặc theo phần trăm tính trên số dư tại thời điểm rút. Giao diện đọc chế độ và tham số từ cấu hình, **không viết cứng**.
- Người bán chỉ thấy dữ liệu của mình. Ba màn này không được lộ dữ liệu vai khác.
- Màn Tổng quan và Danh sách giao dịch chỉ đọc, không có nút thay đổi dữ liệu.

## Tác động

| | Tệp |
|---|---|
| Mới | ba màn của vai Người bán và các thành phần hiển thị |
| Sửa | ba trang chỗ trống do FE-20 tạo |
| Bị ảnh hưởng | kiểm thử đầu cuối phần điều hướng |

## Mức kiểm chứng: Vừa

Trong lúc làm: `cd app && npx vitest run` và `node scripts/scan-pending.mjs --check`.
Cuối task: `bash scripts/run-local-all.sh` một lần.

Ca kiểm thử:

| Ca | Kiểm |
|---|---|
| 1 | Tổng quan hiện đủ sáu khối, số liệu lấy từ nghiệp vụ |
| 2 | Danh sách giao dịch lọc được theo từng tiêu chí và có phân trang |
| 3 | Nhập số tiền vượt hạn mức thì nút bị khoá và có cảnh báo |
| 4 | Đổi chế độ hạn mức trong cấu hình thì hạn mức hiển thị đổi theo |
| 5 | Vai khác vào ba màn này đều bị chặn |

## Điều kiện hoàn thành

- [ ] Ba màn đúng bố cục tài liệu yêu cầu, thay hết trang chỗ trống.
- [ ] Hạn mức đọc từ cấu hình, hỗ trợ cả hai chế độ, không viết cứng.
- [ ] Vượt hạn mức thì khoá nút kèm cảnh báo.
- [ ] Phần gọi nghiệp vụ rút có điểm cắm chờ BE-13, ghi rõ trên màn.
- [ ] Guard vai trò vẫn đúng.
- [ ] `run-local-all.sh` xanh.

## Không làm

- Không viết cứng hạn mức hay phần trăm.
- Không làm nghiệp vụ rút. Thuộc BE-13.
- Không cho sửa dữ liệu ở hai màn chỉ đọc.
- Không nới guard vai trò.
