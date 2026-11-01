# seller-transactions.html: Danh sách giao dịch (Người bán)

- Màn thật: `/seller/transactions`
- Tệp đã đọc (dev `67ece1e`): `app/src/app/(seller)/seller/transactions/page.tsx`, `app/src/components/pages/seller-transactions.tsx`, `app/src/lib/bank/seller.service.ts` (`listSellerTransactions`, `SellerTxnRow`, `SELLER_TXN_STATUSES`), `app/src/lib/store/order.store.port.ts` (`ORDER_STATUSES`), `app/src/lib/store/vault.store.port.ts` (`WITHDRAW_STATUSES`), `nf` trong `seller-overview.tsx`.
- Breadcrumbs: Người bán | Danh sách giao dịch. Vai: seller. Menu sáng: seller-transactions.html.

## Ánh xạ

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề và câu mô tả "... Màn chỉ đọc." | header của `SellerTransactionsPage` | |
| Ô tìm "Mã lệnh hoặc ví nhà đầu tư" | `filters.q`, aria-label "Mã lệnh hoặc nhà đầu tư"; máy chủ khớp mã lệnh, ví nhà đầu tư, và với lệnh rút thêm ví nhận, mã giao dịch | Không nhãn hiện như màn thật, chỉ placeholder và biểu tượng kính lúp. Gõ `0x9e2b04` để thấy khớp theo mã giao dịch |
| Dropdown Loại: Mọi loại, Mua, Bán, Rút | `filters.type`, chỉ aria-label | |
| Dropdown Trạng thái, tập lựa chọn đổi theo Loại; Mọi loại thì thêm 7 trạng thái rút có hậu tố "(rút)" (bỏ Hoàn tất, Thất bại trùng mã lệnh mua bán) | `statusOptions(type)`, `STATUS_LABELS`, `WITHDRAW_STATUS_LABELS`; đổi loại thì bỏ trạng thái không hợp lệ | Có làm thật bằng script nhỏ. Loại Rút có 9 trạng thái theo thứ tự `WITHDRAW_STATUSES`: Đang đặt ví nhận (PAYOUT_SENDING), Đang đặt ví nhận (PAYOUT_SENT), Đã đặt ví nhận, chờ gửi rút, Cần xem xét (đặt ví nhận), Đang gửi, Đã gửi, chờ biên nhận, Hoàn tất, Thất bại, Cần Kiểm soát viên xem |
| Ô Từ ngày, Đến ngày (date) | `filters.from`, `filters.to`, chỉ aria-label | |
| Bảng 9 cột: Mã lệnh, Nhà đầu tư / ví nhận, Loại, Số token, Số VNDB, Bước hiện tại, Trạng thái, Tạo lúc, Cập nhật | `data.rows`; ví = `payoutWallet` nếu WITHDRAW, ngược lại `investorWallet` (`shortWallet` 6…4); Số token rỗng với lệnh rút; Bước hiện tại = `purpose` với lệnh rút, `STEP_LABELS[status]` với lệnh mua bán; Trạng thái = `WITHDRAW_STATUS_LABELS` hoặc `STATUS_LABELS`; `fmtTime(createdAt/updatedAt)` | Badge tô màu theo nhóm trạng thái; giờ và ngày tách hai dòng; Loại có biểu tượng |
| Trạng thái rỗng "Không có giao dịch khớp bộ lọc." | nhánh `data.rows.length === 0` | Hiện thật khi lọc (ví dụ Loại = Bán) |
| Dòng phân trang "27 giao dịch, trang 1/2", nút Trang trước, Trang sau | `data.total`, `data.page`, `pages`; `PAGE_SIZE = 20` | Chuyển trang thật 1/2, 2/2; đổi bộ lọc về trang 1. Dấu chấm giữa đổi thành dấu phẩy |
| Thẻ "Các trạng thái khác của màn" (Xem thử): Đang tải…, lỗi | nhánh `fresh === null`, `fresh.error` | Chỉ để xem trước |

Dữ liệu mẫu: 27 dòng (23 lệnh mua, 4 lệnh rút), 20 dòng trang 1. Mã lệnh là UUID, bảng hiện 8 ký tự đầu như `row.id.slice(0, 8)`, `title` giữ mã đầy đủ. Ví nhận của lệnh rút là ví NB001 `0x15d34AAf…2C6A65` (ví nhận mặc định trên mock); ví đó không còn dùng làm ví nhà đầu tư. Lệnh mua COMPLETED ngày 23/10/2026 cộng lại 1.250 WPT, 4 lệnh, 125.000.000 VNDB, khớp ô "khớp lệnh trong ngày" ở seller.html. 4 lệnh rút trùng bảng "Yêu cầu rút của tôi" ở seller-withdraw.html.

Lớp cục bộ: `.tx-filters` (lưới 5 ô lọc), `.pager`, `.typ`, `td.purpose`; dưới 700px bảng chuyển thành thẻ từng dòng (thead ẩn, nhãn cột lấy từ `data-l`). Chỉ dùng biến CSS.

## Thay đổi chỉ là trình bày
- Bộ lọc không có nhãn hiện (chỉ aria-label và placeholder như dev); bảng có badge màu; trên điện thoại mỗi giao dịch thành một thẻ 2 cột thay vì bảng cuộn ngang.
- Phân trang tách bằng đường kẻ, nút nhỏ.

## Thay đổi so với bản chốt (dev mới)
- Thêm bốn nhãn trạng thái lệnh rút của bước đặt ví nhận: "Đang đặt ví nhận" (hai mã PAYOUT_SENDING, PAYOUT_SENT), "Đã đặt ví nhận, chờ gửi rút", "Cần xem xét (đặt ví nhận)"; dropdown Trạng thái có thêm các lựa chọn này, badge tô màu theo nhóm (FIX-01 `9d87e22`, G4).
- Dữ liệu mẫu không thêm dòng mới để giữ tổng 27 giao dịch khớp các màn khác; dòng ví dụ trạng thái "Đã đặt ví nhận, chờ gửi rút" xem ở seller-withdraw.html.

## Có đụng backend: Không. Lọc trong bản xem thử chạy trên 27 dòng mẫu; màn thật gửi bộ lọc tới `listSellerTransactionsAction`.

## Lệch đã thấy
- Mọi trang có mã lệnh (transactions.html, transaction-detail.html, orders.html, order-detail.html, trang này) đều dùng UUID và hiện 8 ký tự đầu như dev. Dữ liệu mẫu của từng trang lập riêng nên cùng một lệnh mua không nhất thiết trùng mã giữa các trang.
- Cột "Bước hiện tại" chứa Mục đích với lệnh rút: tên cột không đúng nghĩa cho dòng rút.
- Ô tìm ghi "ví nhà đầu tư" nhưng backend còn khớp ví nhận và txHash của lệnh rút, trong khi bảng không có cột mã giao dịch.
- Giờ hiện theo múi giờ trình duyệt (`toLocaleString`), còn lọc Từ ngày, Đến ngày theo ngày Việt Nam (`vnDate`); trình duyệt khác múi giờ có thể thấy dòng lệch ngày so với bộ lọc.
- Chuỗi "x giao dịch, trang a/b" của màn thật dùng dấu chấm giữa U+00B7 (ký tự cấm); bản xem thử đổi thành dấu phẩy.
- Hai mã PAYOUT_SENDING và PAYOUT_SENT cùng nhãn "Đang đặt ví nhận", nên dropdown Trạng thái có hai lựa chọn trùng chữ.

## Sửa sau rà soát độc lập
- Mã lệnh mẫu đổi sang UUID, hiện 8 ký tự; thêm 7 lệnh tháng 9 cho trang 2/2, nút trang chạy thật; bỏ nhãn hiện của ô lọc; ô tìm khớp cả mã giao dịch của lệnh rút.
