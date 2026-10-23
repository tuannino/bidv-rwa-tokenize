# approvals.html (màn `/approvals`, Phê duyệt lệnh)

Màn thật: `app/src/app/(control)/approvals/page.tsx` (breadcrumbs "Kiểm soát / Phê duyệt lệnh", cổng `ops:approve:read`), `app/src/components/pages/approvals.tsx`, `app/src/components/maker-checker/request-table.tsx`, `stat-card.tsx`, `status-badge.tsx`, `gates.ts` (`STATUS_LABELS`, `BURN_SOURCE_LABELS`).
Vai: chỉ Kiểm soát viên. Tệp menu sáng: `approvals.html`.

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề, câu phụ "Xem yêu cầu... Chain đang xem: mock." | `ApprovalsPage` header | |
| Ô "Đang chờ duyệt" (xanh) | `StatCard`, `getApprovalStatsAction().pending` | `null` hiển thị "–" |
| Ô "Đã duyệt hôm nay" (vàng) | `getApprovalStatsAction().approvedToday` | |
| Ô "Đã từ chối hôm nay" | `getApprovalStatsAction().rejectedToday` | |
| Thẻ "Hàng chờ tạo token", câu "Bấm mã yêu cầu để xem chi tiết và quyết định." | `Queue type="MINT"` | |
| Thẻ "Hàng chờ huỷ token" | `Queue type="BURN"` | |
| Ô "Tìm kiếm" có biểu tượng, gợi ý "Mã yêu cầu, người lập, lý do, chứng từ…" (mỗi hàng chờ một ô) | `search`, lọc theo `id, makerId, reason, tokenSymbol, documentRef` | Lọc thật trên dữ liệu mẫu |
| Dropdown "Trạng thái": Tất cả trạng thái, Chờ duyệt (mặc định), Đang xử lý, Hoàn tất, Từ chối, Thất bại | `status` mặc định `PENDING`, `TOKEN_REQUEST_STATUSES`, `STATUS_LABELS` | Đổi được, lọc thật trên dữ liệu mẫu |
| Câu "Đang hiện 200 yêu cầu mới nhất..." | `rows.length >= QUEUE_LIMIT` | Không hiện vì mẫu ít dòng |
| Bảng: Mã yêu cầu (liên kết), Thời điểm lập, Token (kèm chain), Số lượng, Nguồn (chỉ khi có dòng huỷ), Người lập, Lý do, Trạng thái, Kết quả | `RequestTable`, `showSource = rows.some(type === 'BURN')`, `formatDateTime`, `formatAmount`, `StatusBadge`, `resultText` | Thời điểm tách ngày và giờ hai dòng; chain dưới ký hiệu token |
| Liên kết mã yêu cầu sang `approval-detail.html` | `detailHref = /approvals/<id>` | Phần sau `#` là 8 ký tự mã để trang chi tiết chọn đúng yêu cầu mẫu |
| Trạng thái rỗng "Không có yêu cầu nào khớp." | `emptyText` | Khung rỗng có biểu tượng |

## Thay đổi chỉ là trình bày
- Ba ô số thành KPI có biểu tượng tròn (xanh, vàng, thường).
- Nhãn trạng thái có màu theo trạng thái (chờ vàng, hoàn tất xanh, từ chối và thất bại đỏ, đang xử lý xanh dương).
- Lý do và Kết quả cắt bằng dấu ba chấm, có `title` đủ chữ như màn thật.
- Thêm `<style>` cục bộ `[hidden]{display:none!important}`.

## Có đụng backend không
Không.

## Lệch đã thấy
- `resultText` của trạng thái Hoàn tất dùng dấu chấm giữa (chuỗi "KSV001 duyệt", dấu chấm giữa, "tx ..."), bản mới đổi thành dấu phẩy; trạng thái Chờ duyệt in gạch ngang dài, bản mới dùng "–".
- Tìm kiếm chỉ lọc các dòng đã tải (tối đa 200) theo bộ lọc trạng thái, không tìm trên máy chủ (đúng như chú thích trong mã, chỉ ghi lại để chủ dự án biết).
