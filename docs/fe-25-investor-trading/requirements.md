# FE-25 — Màn Giao dịch token và Quản lý lệnh của Nhà đầu tư

| | |
|---|---|
| Nhánh | `feat/investor-trading`, từ `dev` sau khi BE-14 đã merge |
| Điểm | 8 |
| Mức kiểm chứng | **Vừa** |
| Lưu ý | Hai task song song **vẫn đụng ba tệp dùng chung**: tệp trạng thái task, báo cáo công nghệ, sơ đồ luồng. Task về sau phải rebase |

## Mục tiêu

Hai màn theo tài liệu yêu cầu mục IV.1.2 và IV.1.3, thay hai trang chỗ trống mà FE-20 để lại ở khu vực nhà đầu tư.

## Việc cần làm

**Màn Giao dịch token**

1. Ô chọn token, hai thẻ mua và bán.
2. Ô số lượng kèm dòng nhắc trần được phép: mua không vượt số dư chia cho giá và không vượt số chưa phân phối; bán không vượt số token đang giữ.
3. Ô giá **chỉ để xem**, lấy từ cấu hình. Nhà đầu tư không nhập giá.
4. Tổng giá trị dự kiến, cập nhật theo số lượng.
5. Khối kiểm tra trước lệnh **năm điều kiện** theo tài liệu: tài khoản, định danh, ví, token được phép giao dịch, rủi ro. Lấy kết quả từ nghiệp vụ, không tự tính.
6. Khối tóm tắt lệnh và khối thông tin token: dự án, trần phát hành, giá phát hành, trạng thái token và giao dịch, tuổi thọ còn lại, lợi tức, phí giao dịch.
7. Nút xác nhận chỉ mở khi mọi điều kiện đạt. Bấm xong hiện hộp thoại đối chiếu lần cuối loại lệnh, số lượng, giá, tổng giá trị.
8. Sau khi gửi: hiện tiến trình đang xử lý, rồi kết quả kèm mã giao dịch mô phỏng, số dư cập nhật ngay.

**Màn Quản lý lệnh**

9. Bộ lọc theo mã lệnh, chiều, trạng thái, khoảng ngày. Mọi cột sắp xếp được.
10. Bảng gồm mã lệnh, thời điểm tạo, chiều, số lượng, giá, giá trị, trạng thái, thời điểm cập nhật, nút chi tiết.
11. Màn chi tiết: thông tin lệnh, **tiến trình quyết toán năm bước kèm mốc thời gian**, nhật ký kiểm toán của lệnh.
12. Màn chi tiết nêu rõ bước quyết toán là một bước duy nhất, bốn bút toán cùng thành công hoặc cùng huỷ.

**Dùng chung**

13. Nhà đầu tư chỉ thấy lệnh của chính mình. Guard ở nghiệp vụ, giao diện không tự lọc.
14. Số lượng và số tiền hiển thị có phân cách hàng nghìn.

## Ràng buộc

- Khối kiểm tra trước lệnh **đọc kết quả từ backend**. Tính hai nơi sẽ lệch nhau.
- Năm bước quyết toán **lấy ánh xạ từ backend**, không tự suy từ trạng thái.
- Không gọi chuỗi trực tiếp từ thành phần giao diện.
- Vai khác không vào được hai màn này.

## Tác động

| | Tệp |
|---|---|
| Sửa | hai trang chỗ trống ở khu vực nhà đầu tư, `nav-config.ts` nếu cần |
| Mới | màn giao dịch token, màn quản lý lệnh, màn chi tiết lệnh, thành phần tiến trình năm bước |
| Dùng chung, sẽ đụng nếu chạy song song | `.kiro/task-status.json`, `docs/tech-report.md`, `docs/flows/` |

## Mức kiểm chứng: Vừa

Trong lúc làm: `cd app && npx vitest run` và `node scripts/scan-pending.mjs --check`.
Cuối task: `bash scripts/run-local-all.sh` một lần.

Ca kiểm thử:

| Ca | Kiểm |
|---|---|
| 1 | Nhập quá trần mua thì ô số lượng tự chặn và hiện lý do |
| 2 | Nhập quá số token đang giữ ở thẻ bán thì bị chặn |
| 3 | Một điều kiện trước lệnh không đạt thì nút xác nhận bị khoá |
| 4 | Gửi lệnh xong thì số dư và danh sách lệnh cập nhật |
| 5 | Màn chi tiết hiện đủ năm bước kèm mốc thời gian |
| 6 | Bộ lọc hoạt động theo từng tiêu chí |
| 7 | Nhà đầu tư không thấy lệnh của ví khác |
| 8 | Vai khác vào hai màn này bị chặn |

## Điều kiện hoàn thành

- [ ] Hai màn đúng bố cục tài liệu, thay hết trang chỗ trống.
- [ ] Ô số lượng tự chặn theo trần của từng chiều.
- [ ] Khối kiểm tra năm điều kiện lấy từ nghiệp vụ, khoá nút khi có điều kiện trượt.
- [ ] Giá chỉ để xem.
- [ ] Màn chi tiết hiện đủ năm bước quyết toán kèm mốc thời gian.
- [ ] Nhà đầu tư chỉ thấy lệnh của mình.
- [ ] Guard vai trò đúng.
- [ ] `run-local-all.sh` xanh.

## Không làm

- Không tự tính lại điều kiện hay tiến trình ở giao diện.
- Không cho nhập giá.
- Không gọi chuỗi trực tiếp từ thành phần giao diện.
- Không làm màn rút VNDB, thuộc FE-23.
