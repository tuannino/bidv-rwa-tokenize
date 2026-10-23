# seller-transactions.html: Danh sách giao dịch (Người bán)

- Màn thật: `/seller/transactions`
- Tệp đã đọc: `app/src/app/(seller)/seller/transactions/page.tsx`, `app/src/components/pages/seller-transactions.tsx`, `app/src/lib/bank/seller.service.ts` (`listSellerTransactions`, `SellerTxnRow`, `SELLER_TXN_STATUSES`), `app/src/lib/store/order.store.port.ts` (`ORDER_STATUSES`), `app/src/lib/store/vault.store.port.ts` (`WITHDRAW_STATUSES`), `nf` trong `seller-overview.tsx`.
- Breadcrumbs: Người bán | Danh sách giao dịch. Vai: seller. Menu sáng: seller-transactions.html.

## Ánh xạ

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề và câu mô tả "... Màn chỉ đọc." | header của `SellerTransactionsPage` | |
| Ô tìm "Mã lệnh hoặc ví nhà đầu tư" | `filters.q`, aria-label "Mã lệnh hoặc nhà đầu tư" | Thêm nhãn hiện và biểu tượng kính lúp (trình bày) |
| Dropdown Loại: Mọi loại, Mua, Bán, Rút | `filters.type` | |
| Dropdown Trạng thái, tập lựa chọn đổi theo Loại; Mọi loại thì thêm 3 trạng thái rút có hậu tố "(rút)" | `statusOptions(type)`, `STATUS_LABELS`, `WITHDRAW_STATUS_LABELS`; đổi loại thì bỏ trạng thái không hợp lệ | Có làm thật bằng script nhỏ |
| Ô Từ ngày, Đến ngày (date) | `filters.from`, `filters.to` | |
| Bảng 9 cột: Mã lệnh, Nhà đầu tư / ví nhận, Loại, Số token, Số VNDB, Bước hiện tại, Trạng thái, Tạo lúc, Cập nhật | `data.rows`; ví = `payoutWallet` nếu WITHDRAW, ngược lại `investorWallet` (`shortWallet` 6…4); Số token rỗng với lệnh rút; Bước hiện tại = `purpose` với lệnh rút, `STEP_LABELS[status]` với lệnh mua bán; Trạng thái = `WITHDRAW_STATUS_LABELS` hoặc `STATUS_LABELS`; `fmtTime(createdAt/updatedAt)` | Badge tô màu theo nhóm trạng thái; giờ và ngày tách hai dòng; Loại có biểu tượng |
| Trạng thái rỗng "Không có giao dịch khớp bộ lọc." | nhánh `data.rows.length === 0` | Hiện thật khi lọc (ví dụ Loại = Bán) |
| Dòng phân trang "27 giao dịch, trang 1/2", nút Trang trước, Trang sau | `data.total`, `data.page`, `pages`; `PAGE_SIZE = 20` | Dấu chấm giữa đổi thành dấu phẩy |
| Thẻ "Các trạng thái khác của màn" (Xem thử): Đang tải…, lỗi | nhánh `fresh === null`, `fresh.error` | Chỉ để xem trước |

Dữ liệu mẫu: 20 dòng trang 1 (16 lệnh mua, 4 lệnh rút). Lệnh mua COMPLETED ngày 23/10/2026 cộng lại 1.250 WPT, 4 lệnh, 125.000.000 VNDB, khớp ô "khớp lệnh trong ngày" ở seller.html. 4 lệnh rút trùng bảng "Yêu cầu rút của tôi" ở seller-withdraw.html.

Lớp cục bộ: `.tx-filters` (lưới 5 ô lọc), `.pager`, `.typ`, `td.purpose`; dưới 700px bảng chuyển thành thẻ từng dòng (thead ẩn, nhãn cột lấy từ `data-l`). Chỉ dùng biến CSS.

## Thay đổi chỉ là trình bày
- Bộ lọc có nhãn hiện phía trên mỗi ô; bảng có badge màu; trên điện thoại mỗi giao dịch thành một thẻ 2 cột thay vì bảng cuộn ngang.
- Phân trang tách bằng đường kẻ, nút nhỏ.

## Có đụng backend không
Không. Lọc trong bản xem thử chạy trên 20 dòng mẫu cho thấy hành vi; màn thật gửi bộ lọc tới `listSellerTransactionsAction`.

## Lệch đã thấy
- Mã lệnh hiện `row.id.slice(0, 8)`. Mã thật là UUID nên ổn; nhưng nếu dùng mã dạng `ORD-2026-0187` như bộ dữ liệu chung thì mọi dòng sẽ ra "ORD-2026". Bản xem thử hiện đủ mã ORD cho lệnh mua (để khớp các trang khác) và 8 ký tự đầu cho lệnh rút.
- Cột "Bước hiện tại" chứa Mục đích với lệnh rút: tên cột không đúng nghĩa cho dòng rút.
- Ô tìm ghi "ví nhà đầu tư" nhưng backend còn khớp ví nhận và txHash của lệnh rút, trong khi bảng không có cột mã giao dịch.
- Giờ hiện theo múi giờ trình duyệt (`toLocaleString`), còn lọc Từ ngày, Đến ngày theo ngày Việt Nam (`vnDate`); trình duyệt khác múi giờ có thể thấy dòng lệch ngày so với bộ lọc.
- Chuỗi "x giao dịch, trang a/b" của màn thật dùng dấu chấm giữa U+00B7 (ký tự cấm); bản xem thử đổi thành dấu phẩy.
