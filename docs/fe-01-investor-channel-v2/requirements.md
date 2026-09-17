# FE-01 v2 — Tách kênh và trang tổng quan nhà đầu tư: requirements

| | |
|---|---|
| Mã task | FE-01 v2 (sửa đổi và mở rộng bản v1) |
| Nhóm | Giao diện |
| Điểm | 8 (v1 đã dùng 3, phần mở rộng thêm 5) |
| Ưu tiên | P0 |
| Phụ thuộc | FE-01 v1 có thể tham khảo ở nhánh `feat/investor-channel`, nó chưa được merge vào `dev`; Spec cũ của V1 tham khảo tại thư mục `docs/fe-01-investor-channel`|
| Nhánh | `feat/investor-channel-v2`, tạo **từ `dev`** |

## 1. Vì sao có bản v2

Bản v1 xác định kênh bằng **quyền**, nên gặp mâu thuẫn đã ghi trong `CHECKPOINT_FE01.md`: `balance:read` có ở cả bốn vai, guard không chặn được ai, phải để một test ở dạng `fixme`.

Bản v2 đổi cách tiếp cận: **kênh là một lựa chọn tường minh của người dùng**, không suy ra từ quyền. Có hai bộ chọn riêng biệt:

- **Bộ chọn kênh**: Nhà đầu tư, hoặc Admin console.
- **Bộ chọn vai** (đã có): chỉ dùng trong Admin console, để đổi vai giữa các vị trí trong ngân hàng.

Cách này làm ranh giới hai kênh rõ ràng, logic guard đơn giản hơn, và giải quyết luôn món nợ P1 của v1.

Bản v2 cũng thay trang chỗ trống `/portfolio` bằng trang tổng quan thật.

## 2. Yêu cầu chức năng

### R1 — Bộ chọn kênh

- **R1.1** Hệ thống PHẢI có bộ chọn kênh ở thanh trên với đúng hai lựa chọn: "Nhà đầu tư" và "Admin console".
- **R1.2** Lựa chọn PHẢI được lưu lại giữa các lần tải trang.
- **R1.3** KHI đổi sang kênh Nhà đầu tư, hệ thống PHẢI điều hướng về trang tổng quan nhà đầu tư.
- **R1.4** KHI đổi sang kênh Admin console, hệ thống PHẢI điều hướng về trang tổng quan ngân hàng.
- **R1.5** Bộ chọn kênh PHẢI hiển thị ở **cả hai** kênh, để người dùng luôn quay lại được.

### R2 — Bộ chọn vai chỉ dành cho Admin console

- **R2.1** Bộ chọn vai PHẢI chỉ hiển thị khi đang ở kênh Admin console.
- **R2.2** Bộ chọn vai PHẢI chỉ còn ba lựa chọn: cán bộ ngân hàng, tuân thủ, kiểm toán. **Bỏ** lựa chọn nhà đầu tư.
- **R2.3** KHI ở kênh Nhà đầu tư, hệ thống PHẢI đặt vai là nhà đầu tư và ẩn bộ chọn vai.
- **R2.4** KHI đổi kênh sang Admin console, nếu vai hiện tại là nhà đầu tư, hệ thống PHẢI đặt vai về cán bộ ngân hàng.

### R3 — Quyền vào kênh nhà đầu tư

- **R3.1** Hệ thống PHẢI thêm một hành động mới dành riêng cho việc xem vị thế nhà đầu tư.
- **R3.2** Hành động này PHẢI chỉ cấp cho vai nhà đầu tư, KHÔNG cấp cho ba vai còn lại.
- **R3.3** Guard của kênh nhà đầu tư PHẢI dùng hành động này.
- **R3.4** KHI ở vai ngân hàng, tuân thủ, hoặc kiểm toán, hệ thống PHẢI chặn truy cập kênh nhà đầu tư.
- **R3.5** Hệ thống PHẢI bỏ dạng `fixme` của test tương ứng trong `investor-channel.spec.ts` và làm cho nó xanh.
- **R3.6** Hệ thống PHẢI xóa món nợ P1 tương ứng khỏi báo cáo công nghệ.

### R4 — Trang tổng quan nhà đầu tư: tài sản đã đầu tư

- **R4.1** Trang PHẢI có phần hiển thị tổng quan tài sản của ví đang kết nối: số lượng token đang giữ, giá trị quy đổi, và số dư VNDB.
- **R4.2** Giá trị quy đổi PHẢI tính theo tỷ lệ 1 VNDB bằng 1 VND, KHÔNG gọi nguồn tỷ giá nào.
- **R4.3** Số lượng token PHẢI đọc từ chuỗi, KHÔNG lấy từ bộ nhớ đệm hay dữ liệu mẫu.
- **R4.4** KHI ví chưa kết nối, phần này PHẢI hiển thị lời mời kết nối thay vì số 0.

### R5 — Trang tổng quan: hộp trạng thái thị trường

- **R5.1** Trang PHẢI có hộp hiển thị trạng thái thị trường của token mà nhà đầu tư đang giữ.
- **R5.2** Hộp PHẢI hiển thị: giá phát hành, tổng cung, số lượng đang lưu hành, và trạng thái vận hành của dự án.
- **R5.3** Hệ thống PHẢI ghi nhãn rõ ràng cho mọi số liệu **chưa có nguồn thật**, và KHÔNG được trình bày chúng như dữ liệu on-chain.
- **R5.4** Ở giai đoạn này chưa có thị trường thứ cấp, nên hệ thống KHÔNG được hiển thị giá giao dịch, biến động giá, hay khối lượng giao dịch như số liệu thật.

### R6 — Trang tổng quan: hộp lịch sử giao dịch

- **R6.1** Trang PHẢI có hộp danh sách giao dịch gần đây của ví đang kết nối.
- **R6.2** Mỗi dòng PHẢI hiển thị: loại nghiệp vụ, loại token, số lượng, thời điểm, trạng thái, và liên kết tra cứu nếu chuỗi có trình khám phá.
- **R6.3** Hệ thống PHẢI chỉ hiển thị giao dịch của ví đang kết nối. Lọc PHẢI thực hiện ở tầng nghiệp vụ, KHÔNG dựa vào giao diện tự lọc.
- **R6.4** KHI chưa có giao dịch nào, hộp PHẢI hiển thị thông báo trạng thái rỗng, không để trống.

### R7 — Trang tổng quan: hộp danh sách token

- **R7.1** Trang PHẢI có hộp danh sách các loại token đang được token hóa trên hệ thống.
- **R7.2** Mỗi dòng PHẢI hiển thị: mã token, tên dự án, trạng thái dự án, và số lượng nhà đầu tư đang giữ.
- **R7.3** Mỗi dòng PHẢI có đường dẫn sang trang chi tiết dự án của token đó.
- **R7.4** Hệ thống PHẢI phân biệt rõ token đã triển khai trên chuỗi và token còn ở dạng dữ liệu mẫu.

### R8 — Trang chi tiết dự án token

- **R8.1** Hệ thống PHẢI có trang chi tiết cho từng token, mở từ hộp danh sách token.
- **R8.2** Trang PHẢI hiển thị: thông tin dự án, thông số kỹ thuật, tình hình vận hành, thông tin token, và vị thế của nhà đầu tư đối với token đó.
- **R8.3** Trang PHẢI tái dùng dữ liệu và cách trình bày của màn dự án hiện có, KHÔNG dựng nguồn dữ liệu thứ hai.
- **R8.4** KHI mã token không tồn tại, hệ thống PHẢI hiển thị trang không tìm thấy, không để lỗi kỹ thuật.

### R9 — Ranh giới dữ liệu

- **R9.1** Mọi số liệu on-chain PHẢI đi qua `ILedgerPort`.
- **R9.2** Mọi số liệu dạng mẫu PHẢI có nhãn nhận biết được trên giao diện.
- **R9.3** Hệ thống KHÔNG được trộn số liệu thật và số liệu mẫu trong cùng một con số.
- **R9.4** Thành phần giao diện KHÔNG được nhập `viem` hoặc `ethers`.

## 3. Ngoài phạm vi

- Đặt lệnh mua (thuộc FE-05).
- Nhận lợi nhuận (thuộc FE-09).
- Tất toán (thuộc FE-11).
- Kết nối ví và xử lý sai mạng (thuộc **FE-02**). Trang tổng quan chỉ **đọc** trạng thái kết nối.
- Xác thực bằng chữ ký ví (thuộc AU-01).
- Thị trường thứ cấp, khớp lệnh giữa các nhà đầu tư.

## 4. Điều kiện hoàn thành

- [ ] Bộ chọn kênh có hai lựa chọn, đổi kênh điều hướng đúng, lưu lại giữa các lần tải trang.
- [ ] Bộ chọn vai chỉ hiện ở Admin console và chỉ còn ba vai ngân hàng.
- [ ] Vai ngân hàng, tuân thủ, kiểm toán **đều bị chặn** khỏi kênh nhà đầu tư.
- [ ] Test `fixme` của v1 đã bỏ nhãn và xanh.
- [ ] Nợ P1 về quyền vào kênh đã xóa khỏi báo cáo công nghệ.
- [ ] Trang tổng quan có đủ bốn phần theo R4 đến R7.
- [ ] Số dư token đọc từ chuỗi, kiểm được bằng cách mint thêm rồi tải lại trang.
- [ ] Lịch sử giao dịch chỉ hiện của ví đang kết nối, có test.
- [ ] Mọi số liệu mẫu đều có nhãn.
- [ ] Trang chi tiết token mở được từ danh sách, mã không tồn tại thì hiện trang không tìm thấy.
- [ ] `bash scripts/run-local-all.sh` xanh toàn bộ.
