# BE-01 — Mở rộng ILedgerPort cho ba luồng: requirements

| | |
|---|---|
| Mã task | BE-01 |
| Nhóm | Backend |
| Sprint | S1, due 26/09 |
| Điểm | 8 |
| Ưu tiên | P0 |
| Phụ thuộc | SC-02, SC-03 (hợp đồng phát hành và khớp lệnh) |
| Nhánh | `feat/ledger-port-3flows`, tạo **từ `dev`** |

## 1. Mục tiêu

Mở rộng `ILedgerPort` để ba luồng mint, burn, distribute có đường đi xuống chuỗi, theo đúng **Luật #1**: mọi tương tác chuỗi đi qua interface này.

**Đây là mắt nghẽn lớn nhất của cả sprint.** Bảy màn hình và sáu service đều chờ task này. Vì vậy phải làm **một lần cho đúng**, tránh sửa interface giữa sprint gây xung đột hàng loạt.

Khuyến nghị: Kiro làm task này **một mình**, merge vào `dev` trước khi mở các nhánh khác.

## 2. Hiện trạng

`ILedgerPort` có 11 method: 4 tuân thủ, 4 phát hành và thu hồi, 2 đọc, 1 chờ biên nhận. Ba adapter: `evm`, `mock`, `stellar`.

Các quy ước đã có, phải giữ:
- Số lượng dùng `bigint` trong interface
- Lỗi dùng `LedgerError` với thông báo đọc được cho người dùng cuối
- Method chưa hiện thực dùng `LedgerNotImplementedError`
- Guard dùng chung `assertPositiveAmount`
- `evm.adapter` luôn mô phỏng giao dịch trước khi gửi

## 3. Yêu cầu chức năng

### R1 — Phát hành một lần vào ví thanh toán SPV

- **R1.1** Interface PHẢI có method phát hành toàn bộ nguồn cung vào một ví chỉ định.
- **R1.2** Interface PHẢI có method đọc trạng thái đã phát hành hay chưa.
- **R1.3** KHI nguồn cung đã được phát hành, method phát hành PHẢI thất bại với thông báo đọc được.

### R2 — Khớp lệnh mua

- **R2.1** Interface PHẢI có method báo giá: từ số lượng WPT ra số VNDB phải trả.
- **R2.2** Interface PHẢI có method đọc số dư VNDB của một ví.
- **R2.3** Interface PHẢI có method đọc mức ủy quyền VNDB mà nhà đầu tư đã cấp cho hợp đồng khớp lệnh.
- **R2.4** Interface PHẢI có method khớp lệnh, thực hiện chuyển VNDB và chuyển WPT trong **cùng một giao dịch**.
- **R2.5** KHI nhà đầu tư thiếu số dư VNDB, thiếu ủy quyền, hoặc ví thanh toán SPV thiếu WPT, method khớp lệnh PHẢI thất bại và KHÔNG được để lại trạng thái nửa vời.
- **R2.6** Vì VNDB quy đổi 1:1 với VND, method báo giá KHÔNG được gọi bất kỳ nguồn tỷ giá nào.

### R3 — Kiểm tra trước khi gửi giao dịch

- **R3.1** Interface PHẢI có method đọc trả về việc một lần chuyển có được phép hay không, kèm **lý do** nếu bị từ chối.
- **R3.2** Method này PHẢI là hàm đọc, không tốn phí giao dịch.
- **R3.3** Lý do từ chối PHẢI là câu tiếng Việt đọc được, không phải mã lỗi thô của hợp đồng.

### R4 — Chốt quyền và đọc số dư theo thời điểm

- **R4.1** Interface PHẢI có method chốt quyền, trả về mã snapshot.
- **R4.2** Interface PHẢI có method đọc số dư WPT của một ví tại một mã snapshot.
- **R4.3** Interface PHẢI có method đọc tổng cung WPT tại một mã snapshot.
- **R4.4** Interface KHÔNG được có method liệt kê danh sách người nắm giữ. Chuỗi không cung cấp được danh sách này. Danh sách lấy từ cơ sở dữ liệu hoặc Indexer, và spec này PHẢI ghi rõ điều đó để BE-06 không đi sai đường.

### R5 — Chia lợi nhuận

- **R5.1** Interface PHẢI có method đọc số dư VNDB trong ví chia lợi nhuận.
- **R5.2** Interface PHẢI có method chia cho **một lô** người nhận, nhận vào danh sách ví và mã snapshot.
- **R5.3** Method chia PHẢI nhận kích thước lô do tầng gọi quyết định, KHÔNG tự chia lô bên trong.
- **R5.4** KHI ví chia lợi nhuận không đủ tiền, method PHẢI thất bại trước khi chuyển cho bất kỳ ai.

### R6 — Tất toán

- **R6.1** Interface PHẢI có method bật và tắt giai đoạn tất toán, và method đọc trạng thái đó.
- **R6.2** Interface PHẢI có method đặt giá NAV và method đọc giá NAV hiện tại.
- **R6.3** KHI giai đoạn tất toán đang bật, method chuyển nhượng thông thường PHẢI thất bại, còn method đốt PHẢI hoạt động.
- **R6.4** Việc đốt token dùng method `burn` **đã có**, không thêm method mới.

### R7 — Hiện thực ở cả ba adapter

- **R7.1** Mọi method mới PHẢI có hiện thực ở `evm.adapter`, `mock.adapter`, `stellar.adapter`.
- **R7.2** `mock.adapter` PHẢI giữ **đủ** ràng buộc như hợp đồng thật: đã phát hành thì không phát hành lại, thiếu số dư hoặc thiếu ủy quyền thì từ chối, đang tất toán thì chặn chuyển nhượng, ví lợi nhuận thiếu tiền thì từ chối chia.
- **R7.3** `stellar.adapter` PHẢI ném `LedgerNotImplementedError` với gợi ý rõ ràng, KHÔNG trả giá trị giả.
- **R7.4** `evm.adapter` PHẢI mô phỏng giao dịch trước khi gửi, giữ đúng thói quen hiện có.

### R8 — Ranh giới kiến trúc

- **R8.1** Mọi thay đổi PHẢI giữ `viem` bên trong `lib/`.
- **R8.2** Địa chỉ hợp đồng và mô tả giao diện hợp đồng PHẢI lấy từ `packages/shared`, KHÔNG ghi cứng trong adapter.
- **R8.3** Interface KHÔNG được để lộ kiểu dữ liệu riêng của `viem` ra ngoài, để tầng nghiệp vụ không phụ thuộc thư viện chuỗi.

## 4. Ngoài phạm vi

- Logic nghiệp vụ gọi các method này (thuộc BE-02 đến BE-07).
- Chia lô và chạy lại lô lỗi (thuộc BE-06).
- Tiến trình hẹn giờ (thuộc BE-07).
- Adapter Stellar hiện thực thật (thuộc phase 7).

## 5. Điều kiện hoàn thành

- [ ] Mọi method mới có ở cả ba adapter.
- [ ] `mock.adapter` từ chối đúng mọi ca mà hợp đồng thật từ chối, có test cho từng ca.
- [ ] `stellar.adapter` ném lỗi rõ ràng, không trả giá trị giả.
- [ ] Không có kiểu dữ liệu của `viem` lọt ra ngoài interface.
- [ ] `grep -rnE "from '(viem|ethers)'" app/src/ | grep -v "src/lib/"` cho kết quả rỗng.
- [ ] Test mock ledger mở rộng, phủ toàn bộ method mới.
- [ ] `bash scripts/run-local-all.sh` xanh toàn bộ.
- [ ] `tech-report.md` mục 3.1 cập nhật bảng method.
