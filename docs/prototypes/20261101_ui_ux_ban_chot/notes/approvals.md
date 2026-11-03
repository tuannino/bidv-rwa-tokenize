# approvals.html (màn `/approvals`, Phê duyệt lệnh)

Màn thật (dev `67ece1e`): `app/src/app/(control)/approvals/page.tsx` (breadcrumbs "Kiểm soát / Phê duyệt lệnh", cổng `ops:approve:read`), `app/src/components/pages/approvals.tsx` (`ApprovalsPage`, `Queue`, `ApprovalHistory`), `app/src/components/maker-checker/request-table.tsx` (`RequestTable` hai biến thể `queue`, `history`; `resultText`), `stat-card.tsx`, `status-badge.tsx`, `gates.ts`. Đã đối chiếu `lib/bank/token-request.service.ts` (`getApprovalStats`: `APPROVED_STATUSES`, `history`), `lib/store/token-request.store.port.ts` (`APPROVAL_HISTORY_LIMIT = 50`, `listRequests({ decided })`), `lib/role-labels.ts`, `packages/shared/src/chains.ts`.
Vai: chỉ Kiểm soát viên. Tệp menu sáng: `approvals.html`.

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề, câu phụ "Xem yêu cầu... Chain đang xem: mock." | `ApprovalsPage` header | |
| Ô "Đang chờ duyệt" | `getApprovalStatsAction().pending` (`countPendingWork`, không đếm yêu cầu của chính người xem) | 2 (`7f3a21c0`, `c02f9a17`) |
| Ô "Đã duyệt hôm nay" | `approvedToday` = số yêu cầu EXECUTING, COMPLETED, FAILED có `decidedAt` từ 0 giờ hôm nay | 2 (`91bd0e44`, `5e0c7b92`) |
| Ô "Đã từ chối hôm nay" | `rejectedToday` | 1 (`a4471f3d`) |
| Thẻ "Hàng chờ tạo token", "Hàng chờ huỷ token", câu "Bấm mã yêu cầu để xem chi tiết và quyết định." | `Queue type="MINT"/"BURN"` | |
| Ô "Tìm kiếm", dropdown "Trạng thái" (mặc định Chờ duyệt) | `search`, `status`, `TOKEN_REQUEST_STATUSES`, `STATUS_LABELS` | Lọc thật trên dữ liệu mẫu |
| Bảng hàng chờ: Mã yêu cầu (liên kết), Thời điểm lập, Token, Số lượng, Nguồn (khi có dòng huỷ), Người lập, Lý do, Trạng thái, Chain, Kết quả | `RequestTable` biến thể `queue` | Token chỉ ký hiệu; Chain là `CHAINS[chain].label` |
| Thẻ "Lịch sử phê duyệt", câu "Các yêu cầu đã được duyệt hoặc từ chối trên chain này, mới quyết định trước." | `ApprovalHistory`, `stats.data.history` (đi kèm action thẻ số liệu, không gọi thêm) | Đứng dưới hai hàng chờ |
| Bảng lịch sử: Mã yêu cầu (liên kết), Loại, Token, Số lượng, Nguồn, Người lập, Người duyệt, Thời điểm duyệt, Trạng thái, Chain, Kết quả | `RequestTable variant="history"`, `TYPE_LABELS`, `checkerId ?? 'Không có'`, `formatDateTime(decidedAt)` | 3 dòng mới quyết định trước: `91bd0e44` 08:31, `a4471f3d` 08:20, `5e0c7b92` 07:58 |
| Kết quả: "Đã gửi 0x3b7e91c4d2…, chờ kết cục", "KSV001 duyệt, tx 0x8c41e2d0a7…", "Kiểm soát viên KSV001 từ chối do: Chứng từ chưa ký" | `resultText` | Có `title` đủ chữ |
| Câu "Hiện 50 quyết định gần nhất." | `rows.length >= APPROVAL_HISTORY_LIMIT` | Không hiện vì mẫu 3 dòng |
| Trạng thái rỗng "Không có yêu cầu nào khớp." (hàng chờ), "Chưa có quyết định nào." (lịch sử); lỗi đọc số liệu | `emptyText`, `stats.error` | Lịch sử lỗi dùng chung câu lỗi của thẻ số liệu |
| Liên kết mã yêu cầu sang `approval-detail.html#<8 ký tự>` | `detailHref = /approvals/<id>` | Cả hàng chờ và lịch sử |

Lớp cục bộ: `[hidden]` ép ẩn, thu đệm ô bảng 8px để bảng lịch sử 11 cột vừa khung 1440.

## Thay đổi chỉ là trình bày
Ba ô số thành KPI có biểu tượng; nhãn trạng thái tô màu; thời điểm tách ngày và giờ hai dòng; Lý do, Kết quả cắt bằng dấu ba chấm có `title`.

## Thay đổi so với bản chốt (dev mới)
- Thêm thẻ "Lịch sử phê duyệt" (UIUX-01 `ea9fe5f`, A3).
- Bảng: thêm cột Chain sau Trạng thái, Token chỉ còn ký hiệu, câu từ chối có vai "Kiểm soát viên KSV001 từ chối do: ...", câu hoàn tất "KSV001 duyệt, tx ..." (UIUX-01 `ea9fe5f`, A4, B1 đến B3).
- Hàng chờ tạo token có thể có nhiều yêu cầu cùng token cùng lúc (FIX-02 `90995a1`, QĐ-3); mẫu chỉ có một dòng Chờ duyệt nên không đổi số liệu.
- Sửa số liệu mẫu: "Đã duyệt hôm nay" từ 1 thành 2 vì `approvedToday` đếm cả yêu cầu Đang xử lý; câu Kết quả của dòng Đang xử lý cắt mã giao dịch 12 ký tự như `resultText`; người lập `a4471f3d` là GDV001 để khớp draft.html.

## Có đụng backend: Không

## Lệch đã thấy
- `resultText` của trạng thái Chờ duyệt trả gạch dài (ký tự cấm); trang dùng "–".
- Tìm kiếm chỉ lọc các dòng đã tải (tối đa 200), không tìm trên máy chủ (đúng chú thích trong mã).
- Lịch sử dùng cùng biến thể bảng nên cột Nguồn hiện khi có một dòng huỷ; dòng tạo token in gạch dài trong mã, trang dùng "–".

## Sửa sau rà soát độc lập (lượt 2)
- Thêm thanh "Trạng thái xem thử": Đang tải (ba ô "–", hai hàng chờ và lịch sử là `.empty` có biểu tượng tải "Đang tải…", hàng chờ `approvals.tsx:219`, lịch sử `:110`); Lỗi máy chủ (lỗi số liệu dưới ba ô `approvals.tsx:75`, lỗi hàng chờ trên bảng `:209` kèm "Không có yêu cầu nào khớp.", thẻ Lịch sử phê duyệt hiện câu lỗi dùng chung của thẻ số liệu `:102`). Câu lỗi mẫu "Lỗi không xác định.".

## Trạng thái giữ theo dev, chưa vẽ
- Câu "Đang hiện 200 yêu cầu mới nhất. Lọc theo trạng thái để thu hẹp." (`approvals.tsx:210-214`) và "Hiện 50 quyết định gần nhất." (`approvals.tsx:113-115`): mẫu ít dòng.
