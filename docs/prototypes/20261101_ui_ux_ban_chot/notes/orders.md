# orders.html: Quản lý lệnh

- Màn thật: `/orders`
- Tệp đã đọc (dev `67ece1e`): `app/src/app/(investor)/orders/page.tsx`, `app/src/components/pages/investor-orders.tsx`, `app/src/components/trading/gates.ts` (`ORDER_STATUS_LABELS`, `SIDE_LABELS`, `EMPTY_FILTERS`, `orderQueryOf`, `sortOrders`, `unitPriceOf`), `app/src/lib/format.ts`, `app/src/components/investor/wallet-not-bound-notice.tsx`.
- Breadcrumbs: Nhà đầu tư | Quản lý lệnh. Vai: investor. Menu sáng: orders.html.

## Ánh xạ

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề "Quản lý lệnh", "Lệnh mua và bán của ví đang kết nối." | header | |
| Dòng "Chế độ mô phỏng đang lọc theo ví trong hồ sơ Nhà đầu tư: 0x7099… Không cần kết nối ví trình duyệt." | `chain === 'mock'` | Thành `alert` |
| Thẻ "Bộ lọc" | Card "Bộ lọc", `form role="search"` | |
| Ô Mã lệnh (placeholder "Mã lệnh (UUID)", không nhãn hiện) | `filters.orderId`, `aria-label="Mã lệnh"` | Có biểu tượng kính lúp. Máy chủ kiểm UUID: gõ sai dạng hiện "Dữ liệu không hợp lệ." (`listOrders`), đúng dạng thì lọc khớp đúng mã |
| Dropdown Chiều: Mọi chiều, Mua, Bán (không nhãn hiện) | `filters.side`, `ORDER_SIDES`, `aria-label="Chiều"` | |
| Dropdown Trạng thái: Mọi trạng thái + 7 trạng thái (không nhãn hiện) | `filters.status`, `ORDER_STATUSES`, `aria-label="Trạng thái"` | |
| Hai ô ngày (không nhãn hiện) | `filters.fromDate`, `filters.toDate`, `aria-label="Từ ngày"`, `"Đến ngày"` | |
| Thẻ bảng, không tiêu đề | Card thứ hai (`CardContent` không có `CardTitle`) | `aria-label="Danh sách lệnh"` chỉ cho trình đọc màn hình |
| 8 cột sắp xếp được: Mã lệnh, Thời điểm tạo, Chiều, Số lượng, Giá, Giá trị, Trạng thái, Cập nhật | `COLUMNS`, `toggleSort`, `SortIcon` (mặc định `createdAt` giảm dần) | Bấm tiêu đề cột để đổi chiều |
| Giá trị từng ô | `order.id.slice(0,8)` (title là UUID đầy đủ), `formatDateTime(createdAt)`, `SIDE_LABELS` (chữ thường), `formatAmount(wptAmount)`, `unitPriceOf(order)`, `formatAmount(vndAmount)`, `ORDER_STATUS_LABELS`, `formatDateTime(updatedAt)` | Trạng thái dạng badge màu; 5 lệnh mẫu mã UUID, thêm một lệnh "Đang quyết toán" |
| Liên kết "Chi tiết" cuối dòng | `Link href=/orders/${id}` | Sang `order-detail.html?id=<UUID>`; mã lệnh là chữ, dòng không bấm được như dev |
| "Không có lệnh nào khớp bộ lọc." | nhánh `rows.length === 0` | Gõ bộ lọc để thấy (lọc thử ở trình duyệt) |
| Trạng thái "Chưa kết nối ví", "Kết nối ví để xem lệnh của chính mình." | nhánh `!wallet` | tab xem thử |
| Thanh "Trạng thái xem thử": thêm "Ví chưa định danh" | Không phải khối của màn thật | |
| Thông báo vàng "Ví chưa được định danh": "Ví 0x7099…79C8 chưa được ngân hàng định danh cho tài khoản này. Liên hệ ngân hàng hoặc kết nối ví khác." | `WalletNotBoundNotice` (`components/investor/wallet-not-bound-notice.tsx`) khi action trả `WALLET_NOT_BOUND` | Thay bảng trong thẻ Danh sách lệnh (`fresh.notBound`); thẻ Bộ lọc vẫn hiện; biểu tượng `shieldx` thay `ShieldAlert` |
| "Đang tải lệnh…", câu lỗi đỏ | `fresh === null`, `fresh.error` (investor-orders.tsx:150-158) | Tab "Đang tải" (`.empty` có `loader`), tab "Lỗi" (`.alert bad`, câu mẫu "Lỗi không xác định khi gọi chain.") |

Kiểu cục bộ: `[hidden]`, `.sortbtn` (nút tiêu đề cột + biểu tượng), `#flt` lưới 5 cột (2 cột ở ≤1180px).

## Thay đổi chỉ là trình bày
- Trạng thái có màu theo nghĩa (màn thật dùng badge viền cho mọi trạng thái); Chiều để chữ thường như dev.
- Bộ lọc xếp lưới 5 cột cân trên máy tính, 2 cột trên điện thoại.

## Lệch đã thấy
- Ô lọc Mã lệnh ghi "(UUID)" và máy chủ chỉ nhận UUID đủ 36 ký tự, nhưng bảng chỉ hiện 8 ký tự đầu (đủ mã ở title): khó gõ đủ để lọc.
- Ba ô lọc ngày và hai dropdown không có nhãn hiện, chỉ có `aria-label`; ô ngày rỗng không cho biết đâu là "Từ ngày", đâu là "Đến ngày".
- Nhánh "Chưa kết nối ví" ở dev trả về sớm, không có tiêu đề màn; bản xem thử vẫn giữ tiêu đề để có chỗ đặt thanh trạng thái.

## Thay đổi so với bản chốt (dev mới)
- Thêm trạng thái ví chưa gắn hồ sơ: bảng lệnh thay bằng thông báo "Ví chưa được định danh". Commit `9d87e22` (FIX-01). Máy chủ `listOrders` nay bắt buộc có chain và chốt ví của phiên.
- Bộ lọc Chiều vẫn có "Bán": dev không đổi màn này theo FIX-02, lệnh bán cũ (khi cờ còn bật) vẫn hiện.
- Sửa theo rà soát độc lập: mã lệnh mẫu đổi sang UUID, bảng hiện 8 ký tự đầu (title đủ mã), ô lọc kiểm UUID như máy chủ; bỏ tiêu đề thẻ bảng và nhãn hiện của 5 ô lọc (giữ `aria-label`, placeholder); Chiều là chữ thường; mã lệnh không còn là liên kết, dòng không bấm được; thêm tab Đang tải, Lỗi.

## Có đụng backend: Không
Không. Lọc ở bản xem thử chạy trên 4 dòng mẫu; màn thật lọc ở máy chủ qua `listOrdersAction`.
