# FE-02 — Màn kết nối ví: requirements

| | |
|---|---|
| Mã task | FE-02 |
| Nhóm | Giao diện |
| Sprint | S1 (15/09 - 26/09), due 25/09 |
| Điểm | 3 |
| Ưu tiên | P0 |
| Phụ thuộc | FE-01 |
| Nhánh | `feat/wallet-connect`, tạo **từ `dev`** sau khi FE-01 đã merge |

## 1. Mục tiêu

Nhà đầu tư kết nối ví tự quản để xem vị thế và sau này ký giao dịch mua WPT, nhận lợi nhuận, tất toán. Màn hình phải xử lý tử tế các tình huống hay gặp: chưa cài ví, sai mạng, ngắt kết nối, đổi ví giữa phiên.

Đây là **cửa vào của mọi thao tác ký** ở kênh nhà đầu tư. Làm sai chỗ này thì FE-05, FE-09, FE-11 đều vướng.

## 2. Bối cảnh mã nguồn hiện có

| Thành phần | Đường dẫn | Tình trạng |
|---|---|---|
| Cấu hình ví | `lib/wagmi.ts` | **Đã có và đã xử lý tốt**. Có dự phòng khi thiếu `NEXT_PUBLIC_WC_PROJECT_ID`: dùng connector `injected` thay vì để RainbowKit ném lỗi lúc nạp module |
| Nút kết nối | `components/layout/header.tsx` | Đã có `ConnectButton` của RainbowKit ở thanh trên |
| Chống lệch kết xuất | `lib/hooks/use-is-mounted.ts` | Dùng `useSyncExternalStore`, đã có sẵn |
| Chọn chuỗi | `components/layout/chain-selector.tsx` | Đã có |
| Cấu hình công khai | `lib/config/flags.ts`, `config-context.tsx` | Cho biết chuỗi nào chọn được và lý do nếu không |
| Chuỗi được phép | `packages/shared/src/chains.ts` | `hardhat-local` (mặc định), `evm`, `stellar`, `mock` |

**Kết luận:** hạ tầng ví đã có. Task này chủ yếu là **màn hình và xử lý tình huống lỗi**, không phải dựng lại kết nối.

## 3. Yêu cầu chức năng

### R1 — Trang kết nối ví

- **R1.1** Hệ thống PHẢI có trang kết nối ví trong kênh nhà đầu tư.
- **R1.2** KHI ví chưa kết nối, trang PHẢI hiển thị hướng dẫn và nút kết nối.
- **R1.3** KHI ví đã kết nối, trang PHẢI hiển thị: địa chỉ ví dạng rút gọn, tên chuỗi đang kết nối, số dư native, và nút ngắt kết nối.
- **R1.4** Địa chỉ ví PHẢI có nút sao chép và liên kết tra cứu trên trình khám phá chuỗi, nếu chuỗi đó có trình khám phá.

### R2 — Chưa cài ví

- **R2.1** KHI trình duyệt không có ví nào được tiêm vào, hệ thống PHẢI hiển thị thông báo rõ ràng kèm hướng dẫn cài đặt, KHÔNG được hiện lỗi kỹ thuật hoặc màn trắng.
- **R2.2** Thông báo PHẢI bằng tiếng Việt đủ dấu và không dùng thuật ngữ khó hiểu với cán bộ ngân hàng.

### R3 — Sai chuỗi

- **R3.1** KHI ví kết nối vào chuỗi KHÔNG nằm trong danh sách được phép, hệ thống PHẢI hiển thị cảnh báo nêu rõ: đang ở chuỗi nào, cần chuyển sang chuỗi nào.
- **R3.2** Hệ thống PHẢI có nút yêu cầu ví tự chuyển sang chuỗi đúng.
- **R3.3** KHI ví chưa biết chuỗi đích, hệ thống PHẢI yêu cầu ví thêm chuỗi đó, dùng thông số từ `packages/shared`, KHÔNG ghi cứng thông số chuỗi trong thành phần giao diện.
- **R3.4** KHI người dùng từ chối chuyển chuỗi, hệ thống PHẢI giữ nguyên cảnh báo và KHÔNG được coi như đã kết nối thành công.
- **R3.5** KHI đang sai chuỗi, hệ thống PHẢI chặn mọi thao tác cần ký và nêu lý do.

### R4 — Đồng bộ với chuỗi đang chọn trong ứng dụng

- **R4.1** KHI chuỗi trong ví khác chuỗi đang chọn ở bộ chọn chuỗi của ứng dụng, hệ thống PHẢI cảnh báo sự lệch này.
- **R4.2** Hệ thống KHÔNG được tự ý đổi chuỗi trong ví mà chưa có hành động của người dùng.
- **R4.3** KHI chuỗi đang chọn là `mock`, hệ thống PHẢI nêu rõ đây là chế độ mô phỏng, không cần ví thật, và KHÔNG hiển thị cảnh báo sai chuỗi.

### R5 — Đổi ví và ngắt kết nối giữa phiên

- **R5.1** KHI người dùng đổi tài khoản trong ví, hệ thống PHẢI cập nhật địa chỉ đang hiển thị mà không cần tải lại trang.
- **R5.2** KHI ví bị ngắt kết nối, hệ thống PHẢI trở về trạng thái chưa kết nối và xóa dữ liệu vị thế đang hiển thị.
- **R5.3** Hệ thống KHÔNG được lưu địa chỉ ví vào lưu trữ phía trình duyệt như nguồn sự thật. Địa chỉ luôn đọc từ ví.

### R6 — Không lệch kết xuất giữa máy chủ và trình duyệt

- **R6.1** Lần kết xuất đầu tiên PHẢI không phụ thuộc trạng thái ví, để nội dung máy chủ và trình duyệt khớp nhau.
- **R6.2** Hệ thống PHẢI dùng `useIsMounted` có sẵn cho phần phụ thuộc trạng thái ví, KHÔNG tự viết lại bằng `useEffect` cộng `useState`.
- **R6.3** KHI chưa gắn vào cây giao diện, hệ thống PHẢI hiển thị khung chờ thay vì để trống nhảy nội dung.

### R7 — Ranh giới với thao tác của ngân hàng

- **R7.1** Ví kết nối qua màn hình này CHỈ dùng cho thao tác của nhà đầu tư.
- **R7.2** Thao tác đặc quyền của ngân hàng PHẢI tiếp tục ký bằng khóa phía máy chủ qua `ISigner`, KHÔNG dùng ví trình duyệt.
- **R7.3** Thành phần giao diện KHÔNG được nhập `viem` hoặc `ethers` trực tiếp. Mọi tương tác chuỗi đi qua `ILedgerPort`, trừ các hook của wagmi phục vụ riêng việc kết nối ví.

## 4. Ngoài phạm vi

- Đọc số dư WPT và VNDB (thuộc **BE-01** và **FE-04**).
- Ký giao dịch nghiệp vụ (thuộc FE-05, FE-09, FE-11).
- Xác thực bằng chữ ký ví để đăng nhập (thuộc **AU-01**). Task này chỉ kết nối, chưa xác thực.
- Ví do ngân hàng giữ hộ và Fireblocks (thuộc IN-03, IN-04).

## 5. Điều kiện hoàn thành

- [ ] Kết nối và ngắt kết nối hoạt động ở chuỗi `hardhat-local`.
- [ ] Trình duyệt không có ví thì hiện hướng dẫn, không lỗi kỹ thuật.
- [ ] Ví ở chuỗi sai thì hiện cảnh báo và nút chuyển chuỗi hoạt động.
- [ ] Từ chối chuyển chuỗi thì vẫn ở trạng thái cảnh báo.
- [ ] Đổi tài khoản trong ví thì địa chỉ cập nhật ngay.
- [ ] Chế độ `mock` không đòi ví và không cảnh báo sai chuỗi.
- [ ] Không có lỗi lệch kết xuất trong bảng điều khiển trình duyệt.
- [ ] `grep -rnE "from '(viem|ethers)'" app/src/ | grep -v "src/lib/"` cho kết quả rỗng.
- [ ] `bash scripts/run-local-all.sh` xanh toàn bộ.
