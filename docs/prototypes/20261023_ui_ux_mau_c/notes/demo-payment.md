# demo-payment.html (màn `/demo-payment`, Nạp VNDB mô phỏng)

Màn thật: `app/src/app/(ops)/demo-payment/page.tsx` (breadcrumbs "Vận hành", "Nạp VNDB"; chặn bằng `canMintDemoPayment`), `app/src/components/pages/demo-payment.tsx` (`DemoPaymentPage`). Đã đọc thêm `lib/bank/demo-payment.service.ts` (`demoPaymentContext`, `mintDemoPayment`), `lib/config/issue-terms.ts` (`DEMO_PAYMENT_QUICK_AMOUNTS`, `DEMO_PAYMENT_MINT_MAX_VND`). Vai: Giao dịch viên.

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề "Nạp VNDB mô phỏng" | header `DemoPaymentPage` | |
| Cảnh báo đỏ "Chức năng chỉ dùng cho bản trình diễn… (cờ ENABLE_DEMO_PAYMENT_MINT). Chuỗi đang dùng: mock." | `role="note"` trong header | Giữ nguyên câu, `.alert.bad` |
| Thẻ "Nạp vào ví" | `Card` "Nạp vào ví" | |
| Ô "Ví đích" có gợi ý danh sách (Ví người bán, Đã nạp trước đó), placeholder "0x… ví nhà đầu tư đã KYC, hoặc ví người bán" | `wallet`, `datalist` = `knownWallets` (`context.spvWallet` + `history[].toWallet`) | Vẫn là `input list` + `datalist` |
| Câu "Chỉ nạp được cho ví có trong danh sách nhà đầu tư (đã KYC/whitelist) hoặc ví người bán 0x0da94B2c…6861." với nút điền ví | `context.spvWallet`, `short()` | Bấm nút điền ví vào ô |
| Ô "Số VNDB" | `amount` | Thêm hậu tố "VNDB" trong ô (trình bày) |
| "Gợi ý nhanh:" nút "Nhà đầu tư mẫu: 500.000.000", "Ví người bán: 1.000.000.000" | `context.quickAmounts` (lọc theo trần) | Bấm để điền số |
| Ô vàng "Tối đa một lần: 1.000.000.000 VNDB" | `context.maxAmount` (`readDemoPaymentMintMax`) | Câu "Tối đa một lần" chuyển từ dòng gợi ý thành ô vàng cạnh biểu mẫu |
| Nút "Nạp VNDB" (biểu tượng đồng xu) | `submit`, khoá khi `pending` hoặc ô rỗng | Khoá khi xoá trống một ô |
| Thông báo "Đã nạp … VNDB vào …, số dư mới … VNDB, tx … (CONFIRMED)" và thông báo lỗi | `feedback` từ `mintDemoPaymentAction` | Bấm nút để xem; chấm giữa đổi thành dấu phẩy |
| Thẻ "Lịch sử các lần nạp (mock)": Thời điểm, Ví đích, Số VNDB, Trạng thái, Vai trò | `context.history` (`createdAt` qua `toLocaleString('vi-VN')`, `toWallet`, `amount`, `status`, `actorRole`) | Trạng thái giữ mã gốc CONFIRMED/FAILED như màn thật, tô màu theo nhóm |
| Rỗng "Chưa có lần nạp nào trên chuỗi này." | nhánh `history.length === 0` | Không dựng ở trạng thái có dữ liệu |
| Màn chặn "Chức năng nạp VNDB mô phỏng không khả dụng" | `page.tsx` khi `!canMintDemoPayment(role)` | Trang chỉ mở cho vai Giao dịch viên (`data-roles="teller"`) nên không dựng màn chặn |

Lớp cục bộ: `<style>` chỉ có `[hidden]`; `style=""` nhỏ cho cỡ chữ con số trần (để 13 chữ số không tràn ô).

## Thay đổi chỉ là trình bày
Cảnh báo trình diễn kéo dài cả hàng; biểu mẫu chiếm 8 cột, trần một lần nạp thành ô vàng lớn 4 cột; nút ví người bán và gợi ý nhanh là nút nhỏ bo tròn; bảng lịch sử dùng nhãn màu.

## Có đụng backend không
Không.

## Lệch đã thấy
- Ví gợi ý được gắn nhãn "Ví người bán" là `ledger.spvWallet()` (ví thanh toán SPV, `0x0da94B…6861`), không phải ví tài khoản người bán NB001 (`0x3C44…93BC`). Câu chữ "ví người bán" dễ gây hiểu nhầm với ví hồ sơ người bán.
- Thời điểm trong lịch sử dùng `toLocaleString('vi-VN')` (giờ trước, ngày sau, theo múi giờ máy khách), khác `formatDateTime` (ngày trước, giờ sau, múi giờ cố định) ở các màn khác.
- Trạng thái lịch sử và vai trò hiện mã tiếng Anh thô (CONFIRMED, TELLER).
