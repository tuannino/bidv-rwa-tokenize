# approval-detail.html (màn `/approvals/[id]`, Chi tiết yêu cầu)

Màn thật: `app/src/app/(control)/approvals/[id]/page.tsx` (breadcrumbs "Kiểm soát / Phê duyệt lệnh / <8 ký tự mã>"), `app/src/components/pages/approval-detail.tsx`, `app/src/components/maker-checker/token-info-block.tsx`, `token-info-read.ts`, `gates.ts` (`decisionBlockReason`, `rejectBlockReason`, `BURN_SOURCE_LABELS`), `status-badge.tsx`. Đã đối chiếu `lib/bank/token-request.service.ts` (`getTokenRequestDetail`: `selfApprovalReason`, `canReconcile`, `timelineOf`; `TokenInfoView`).
Vai: chỉ Kiểm soát viên. Tệp menu sáng: `approvals.html`.

Trang đọc mã yêu cầu sau dấu `#` (do `approvals.html` gắn) để hiện một trong năm yêu cầu mẫu: `7f3a21c0` (mặc định), `91bd0e44`, `c02f9a17` chờ duyệt; `5e0c7b92` hoàn tất; `a4471f3d` từ chối. Crumb cuối đổi theo mã.

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề "Chi tiết yêu cầu", mã đầy đủ | header, `requestId` | |
| Liên kết "Về danh sách" | `Link href="/approvals"` | `data-go="approvals.html"` |
| Thẻ "Hành động", nhãn trạng thái | `StatusBadge status={detail.request.status}` | |
| Khung lý do khoá (biểu tượng ổ khoá) | `decisionBlockReason(detail)`: không còn chờ duyệt, hoặc `selfApprovalReason` | Mở `#5e0c7b92` hoặc `#a4471f3d` để thấy |
| Ô "Lý do từ chối" | `textarea#reject-reason`, khoá khi có lý do khoá | Gợi ý đổi gạch dài thành dấu phẩy |
| Nút "Chấp nhận" | `approveTokenRequestAction`, khoá khi `approveBlock` | |
| Nút "Từ chối" | `rejectTokenRequestAction`, khoá khi `rejectBlock` (chưa nhập lý do) | Gõ lý do thì mở khoá |
| Nút "Đối soát" | `detail.canReconcile` (EXECUTING, có `txHash`, có `order:approve`) | Giữ trong mã trang; không hiện vì bộ mẫu chung không có yêu cầu Đang xử lý |
| Dòng "Từ chối: Phải nhập lý do từ chối." | `!decisionBlock and rejectBlock` | |
| Khung phản hồi sau thao tác | `outcomeFeedback`, `FEEDBACK_STYLE` (success, warning, error) | Bấm nút hiện câu thành công tương ứng |
| Thẻ "Nội dung yêu cầu" đủ 12 trường: Loại, Token, Số lượng, Nguồn (chỉ yêu cầu huỷ), Ví tác động, Lý do, Chứng từ, Ngày hiệu lực, Ghi chú, Người lập, Thời điểm lập, Mã giao dịch | `detail.request.type/.tokenSymbol/.chain/.amount/.burnSource/.wallet/.reason/.documentRef/.effectiveDate/.note/.makerId/.createdAt/.txHash` | Giá trị thiếu là "–" |
| Thẻ "Thông tin token": Dự án, Hợp đồng, Trần phát hành, Số còn được phát hành, Tổng cung hiện tại, Số chưa phân phối, Số đang lưu hành, Mã người bán, Ví thanh toán, Phát hành lần đầu | `TokenInfoBlock`, `TokenInfoView` | Nền nhạt như màn thật (`bg-muted/30`) |
| Câu lỗi đọc thông tin token | `detail.tokenError`, `tokenInfoReadErrorMessage` | Không dựng (trạng thái lỗi) |
| Thẻ "Nhật ký": thời điểm, nhãn, người, chi tiết | `detail.timeline[]` (`timelineOf`) | Dạng dòng thời gian có chấm màu (chờ vàng, từ chối đỏ) |

## Thay đổi chỉ là trình bày
- Khối Hành động: ô lý do bên trái, ba nút lớn bên phải trên cùng hàng.
- Nội dung yêu cầu và Thông tin token đứng cạnh nhau, mỗi bên một nửa (màn thật chia hai cột ở `xl`).
- Nhật ký nối người thao tác bằng dấu phẩy thay cho dấu chấm giữa.
- Thêm `<style>` cục bộ `[hidden]{display:none!important}`.

## Có đụng backend không
Không.

## Lệch đã thấy
- "Ngày hiệu lực" in nguyên chuỗi ISO (`2026-10-24`), không theo định dạng ngày tiếng Việt như các ô thời điểm khác.
- Câu nhật ký của yêu cầu Đang xử lý có gạch dài ("chưa biết kết cục", gạch ngang dài, "cần đối soát"), và gợi ý ô lý do từ chối cũng có gạch dài; bản mới đổi thành dấu phẩy.
- Bộ dữ liệu mẫu chung không có địa chỉ hợp đồng WPT; trang dùng `0x5FbDB2315678afecb367f032d93F642f64180aa3` (địa chỉ triển khai đầu tiên của Hardhat) làm chỗ giữ.
- Crumb ba cấp cộng thanh trên nhiều nút làm dòng crumb xuống hai dòng ở 1440 (khung dùng chung, không sửa ở trang này).
