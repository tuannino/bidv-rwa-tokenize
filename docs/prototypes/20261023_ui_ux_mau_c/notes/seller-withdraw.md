# seller-withdraw.html: Tạo lệnh rút (Người bán)

- Màn thật: `/seller/withdraw`
- Tệp đã đọc: `app/src/app/(seller)/seller/withdraw/page.tsx`, `app/src/components/pages/seller-withdraw.tsx`, `app/src/lib/bank/withdraw-limit.ts` (`quoteWithdraw`), `seller-overview.tsx` (`useSellerOverview`, `describePolicy`, `nf`), `seller-transactions.tsx` (`WITHDRAW_STATUS_LABELS`), `app/src/components/ui/dialog.tsx` (có nút đóng mặc định), `packages/shared/src/chains.ts` (`explorerTxUrl`, mock không có explorer).
- Breadcrumbs: Người bán | Tạo lệnh rút. Vai: seller. Menu sáng: seller-withdraw.html.

## Ánh xạ

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề và câu mô tả | header `SellerWithdrawPage` | |
| Thẻ Thông tin lệnh rút | `Card` "Thông tin lệnh rút" | |
| Số tiền rút (VNDB) | `form.amount` (`w-amount`, inputMode numeric) | Hậu tố "VNDB" trong ô (trình bày) |
| Câu lỗi "Vượt phần được rút: chỉ rút được tối đa 33.000.000.000 VNDB." | `quote.exceedsLimit`, `nf(withdrawable)` | Hiện thật khi nhập quá |
| Mạng (chỉ đọc) | `chainLabel` từ `usePublicConfig().chains` | Đọc nhãn chain đang chọn trên thanh trên |
| Ví nhận (đặt bởi Kiểm soát viên) (chỉ đọc) | `wallet.payoutWallet ?? 'Chưa đặt'` | |
| Mục đích | `form.purpose` | |
| Ghi chú (textarea 2 dòng) | `form.note` | |
| Nút Tạo lệnh rút, khoá khi chưa hợp lệ | `canSubmit` (không có blocker, số hợp lệ, không vượt, có mục đích) | Logic chạy thật bằng script |
| Câu kết quả dưới nút | `feedback` (ok: "Đã rút … VNDB về ví …") | |
| Thẻ Hệ thống tính: Số dư VNDB của vault, Phần khoá, Phần được rút | `wallet.paymentVnd`, `wallet.lockedVnd`, `wallet.withdrawableVnd` | |
| Ô xanh Số tiền nhận được | `quote.receivedVnd` (bằng số rút, "–" khi số không hợp lệ) | Đưa xuống đáy thẻ thành ô nổi bật |
| Câu luật khoá | `describePolicy(wallet.policy)` | |
| "Phí ngân hàng ngoài chuỗi: chưa áp dụng (POC)." | dòng chữ cố định | |
| Thẻ Yêu cầu rút của tôi, bảng 7 cột: Mã, Số tiền, Ví nhận, Mục đích, Trạng thái, Giao dịch, Thời điểm | `reconcileAndListMyWithdrawRequestsAction` rows: `id.slice(0,8)`, `amount`, `short(payoutWallet)` 10…6, `purpose`, `WITHDRAW_STATUS_LABELS[status]` (title = `reason`), `short(txHash)` (liên kết explorer nếu chain có), `createdAt` | Badge màu theo trạng thái; trên điện thoại thành thẻ |
| Hộp Xác nhận mã một lần: tiêu đề, mô tả có số tiền, ô mã 6 số, lỗi "Mã một lần phải đúng sáu chữ số.", nút Xác nhận, nút đóng | `Dialog otpOpen`, `otp`, `confirm()` | Dùng `<dialog>`; xác nhận xong thêm một dòng Hoàn tất vào bảng và hiện câu kết quả (mô phỏng `reload()`) |
| Thẻ "Các trạng thái khác của màn" (Xem thử): tab Chặn tạo lệnh | `blocker`: chưa có vault, chưa có ví nhận, đang tạm dừng rút | Chỉ để xem trước |
| tab Kết quả lệnh rút | `feedback` ok, trạng thái khác COMPLETED, lỗi máy chủ (lỗi OTP giữ hộp mở) | |
| tab Danh sách yêu cầu | "Chưa có yêu cầu rút nào trên chain này.", liên kết explorer khi chain có explorer | |
| tab Đang tải, lỗi | "Đang đọc số dư…", `error`, `requests.error` | |

Lớp cục bộ: `dialog.otp` (c.css chưa có hộp thoại), `.calc` (thẻ cột phải dạng flex để ô nhận được nằm đáy), `.notes`, `.form-foot`, `.fb`, `.tx-link`; dưới 700px bảng thành thẻ (`data-l`). Chỉ dùng biến CSS.

## Thay đổi chỉ là trình bày
- Bố cục 7/5: biểu mẫu bên trái, Hệ thống tính bên phải; "Số tiền nhận được" thành ô xanh nổi bật có tua-bin.
- Mạng và Ví nhận có biểu tượng khoá, liên kết trong ô chỉ đọc.
- Các câu chặn, kết quả, rỗng, đang tải gom vào thẻ có tab để xem.

## Có đụng backend không
Không.

## Lệch đã thấy
- Kết quả không phải COMPLETED (ví dụ "Đã gửi, chờ biên nhận") hiện cùng tông lỗi (`tone: 'error'`, màu đỏ) dù chưa chắc là lỗi.
- Lý do trạng thái (`reason`) chỉ có trong `title` của badge, không thấy trên điện thoại.
- Ví nhận rút gọn 10…6 ở màn này nhưng 6…4 ở Danh sách giao dịch.
- Viết "POC" ở màn này, chỗ khác trong mã viết "PoC".
