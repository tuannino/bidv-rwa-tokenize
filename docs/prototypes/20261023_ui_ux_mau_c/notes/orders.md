# orders.html: Quản lý lệnh

- Màn thật: `/orders`
- Tệp đã đọc: `app/src/app/(investor)/orders/page.tsx`, `app/src/components/pages/investor-orders.tsx`, `app/src/components/trading/gates.ts` (`ORDER_STATUS_LABELS`, `SIDE_LABELS`, `EMPTY_FILTERS`, `orderQueryOf`, `sortOrders`, `unitPriceOf`), `app/src/lib/format.ts`.
- Breadcrumbs: Nhà đầu tư | Quản lý lệnh. Vai: investor. Menu sáng: orders.html.

## Ánh xạ

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề "Quản lý lệnh", "Lệnh mua và bán của ví đang kết nối." | header | |
| Dòng "Chế độ mô phỏng đang lọc theo ví trong hồ sơ Nhà đầu tư: 0x7099… Không cần kết nối ví trình duyệt." | `chain === 'mock'` | Thành `alert` |
| Thẻ "Bộ lọc" | Card "Bộ lọc", `form role="search"` | |
| Ô Mã lệnh (placeholder "Mã lệnh (UUID)") | `filters.orderId` | Thêm biểu tượng kính lúp |
| Dropdown Chiều: Mọi chiều, Mua, Bán | `filters.side`, `ORDER_SIDES` | |
| Dropdown Trạng thái: Mọi trạng thái + 7 trạng thái | `filters.status`, `ORDER_STATUSES` | |
| Từ ngày, Đến ngày (date) | `filters.fromDate`, `filters.toDate` | |
| Thẻ bảng (tiêu đề "Danh sách lệnh") | Card thứ hai (màn thật không có tiêu đề) | Tiêu đề thẻ chỉ là nhãn trình bày |
| 8 cột sắp xếp được: Mã lệnh, Thời điểm tạo, Chiều, Số lượng, Giá, Giá trị, Trạng thái, Cập nhật | `COLUMNS`, `toggleSort`, `SortIcon` (mặc định `createdAt` giảm dần) | Bấm tiêu đề cột để đổi chiều |
| Giá trị từng ô | `order.id.slice(0,8)`, `formatDateTime(createdAt)`, `SIDE_LABELS`, `formatAmount(wptAmount)`, `unitPriceOf(order)`, `formatAmount(vndAmount)`, `ORDER_STATUS_LABELS`, `formatDateTime(updatedAt)` | Chiều và Trạng thái dạng badge màu |
| Liên kết "Chi tiết" cuối dòng; cả dòng bấm được | `Link href=/orders/${id}` | Sang `order-detail.html` |
| "Không có lệnh nào khớp bộ lọc." | nhánh `rows.length === 0` | Gõ bộ lọc để thấy (lọc thử ở trình duyệt) |
| Trạng thái "Chưa kết nối ví", "Kết nối ví để xem lệnh của chính mình." | nhánh `!wallet` | tab xem thử |

Kiểu cục bộ: `[hidden]`, `.sortbtn` (nút tiêu đề cột + biểu tượng), `#flt` lưới 5 cột (2 cột ở ≤1180px).

## Thay đổi chỉ là trình bày
- Mã lệnh thành liên kết màu nhấn; Chiều và Trạng thái có màu theo nghĩa (màn thật dùng badge viền cho mọi trạng thái).
- Bộ lọc xếp lưới 5 cột cân trên máy tính, 2 cột trên điện thoại.

## Có đụng backend không
Không. Lọc ở bản xem thử chạy trên 4 dòng mẫu; màn thật lọc ở máy chủ qua `listOrdersAction`.

## Lệch đã thấy
- Mã lệnh thật là UUID, bảng chỉ hiện 8 ký tự đầu (`id.slice(0,8)`) và breadcrumb chi tiết cũng vậy. Bản xem thử dùng mã mẫu dạng `ORD-2026-0001` theo bộ dữ liệu chung nên hiện đủ mã.
- Ô lọc Mã lệnh ghi "(UUID)" nhưng người dùng chỉ thấy 8 ký tự trên bảng, khó gõ đủ UUID để lọc.
- Chưa có trạng thái "Đang tải lệnh…" và lỗi trong bản xem thử (màn thật có).
