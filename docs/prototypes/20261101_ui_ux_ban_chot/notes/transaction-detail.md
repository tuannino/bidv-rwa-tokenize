# transaction-detail.html (màn `/transactions/[id]`, Chi tiết lệnh vận hành)

Màn thật: `app/src/app/(ops)/transactions/[id]/page.tsx`, `app/src/components/pages/ops-order-detail.tsx` (`OpsOrderDetailPage`, `getOpsOrderDetailAction`), `app/src/components/trading/order-detail-content.tsx` (`OrderDetailContent`, `Row`), `app/src/components/trading/settlement-progress.tsx` (`SettlementProgress`, `StepIcon`). Đã đọc thêm `lib/bank/settlement-steps.ts`, `lib/bank/trade.service.ts` (`getOrderDetail`, câu "Không tìm thấy lệnh ... trong phạm vi được xem.", `AUDIT_SCAN_LIMIT`), `lib/bank/purchase.service.ts` (câu nhật ký `order:place`, `order:auto-execute`). Vai: Giao dịch viên, Kiểm soát viên (giống nhau).

Trang đọc `?id=<UUID>` từ `transactions.html` và dựng từ cùng bộ 28 lệnh mẫu; không có `id` thì mở lệnh `9a1de644` (Hoàn tất).

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Liên kết "Về danh sách giao dịch" | `Link href="/transactions"` | `data-go="transactions.html"`; thay cho breadcrumb "Giao dịch" có liên kết |
| Thanh "Trạng thái xem thử": Có dữ liệu, Chưa có nhật ký, Đang tải, Lỗi tải | Không có trên màn thật | |
| Tiêu đề "Lệnh mua xxxxxxxx" hoặc "Lệnh bán xxxxxxxx" + nhãn trạng thái | `SIDE_LABELS[side].toLowerCase()`, `order.id.slice(0, 8)`, `ORDER_STATUS_LABELS[status]` | Đổi theo lệnh được mở; tên trang và tiêu đề thanh trên đổi theo |
| Ô Giá trị, Số lượng, Giá | `Row` "Giá trị" (`vndAmount`), "Số lượng" (`wptAmount`), "Giá" (`unitPriceOf`) | Ba dòng số của "Thông tin lệnh" đưa lên thành ô |
| Thẻ "Thông tin lệnh": Mã lệnh (UUID đầy đủ), Chiều, Ví, Thời điểm tạo, Cập nhật, Mã giao dịch (`chưa có`), Lý do (`không có`) | `Row` còn lại | |
| Thẻ "Tiến trình quyết toán": 5 bước "Bước n", nhãn, trạng thái (Xong, Đang xử lý, Chưa tới, Dừng ở bước này), mốc giờ | `SettlementProgress`, `order.steps`, `STEP_STATE_LABELS` | `.steps`: xong có dấu tích, đang làm vàng, dừng có dấu x đỏ; mốc thiếu hiện "–" |
| Câu quy tắc, "Kết cục: ..." (ba câu), bốn bút toán | `settlement.rule`, `settlement.outcome`, `settlement.entries` | Ghi giảm đỏ, ghi tăng xanh |
| Thẻ "Nhật ký kiểm toán của lệnh": thời điểm, hành động, "vai, kết quả", chi tiết | `detail.audit` | Câu theo `purchase.service.ts` cho từng trạng thái: đặt lệnh (:374-376), khớp CONFIRMED (:1717), từ chối trước khi gửi tx (:1234), "tx … FAILED, lý do" (:1699, không có phần "khớp"), "tx … PENDING, lý do; chưa có biên nhận, chờ đối soát" (:1699 nối :1431, lý do dự phòng "Giao dịch khớp lệnh kết thúc ở trạng thái PENDING." ở :1685) |
| Rỗng "Chưa có dòng nhật ký nào gắn với lệnh này." | `audit.length === 0` (order-detail-content.tsx:59) | `.empty`; tab "Chưa có nhật ký", và các lệnh mẫu trước 01/10/2026 (ngoài 500 dòng nhật ký mới nhất) |
| "Đang tải lệnh…" | `fresh === null` (ops-order-detail.tsx:43-47) | `.empty` có biểu tượng loader |
| Lỗi | `fresh.error` (ops-order-detail.tsx:48-49) | `.alert bad`: tab "Lỗi tải" in "Lỗi không xác định."; `id` không có trong sổ thì in "Không tìm thấy lệnh <id> trong phạm vi được xem." |

## Thay đổi so với bản chốt (dev mới)
Đã rà `git diff f164939 67ece1e` cho `app/src/app/(ops)/transactions/[id]/page.tsx`, `components/pages/ops-order-detail.tsx`, `components/trading/order-detail-content.tsx`, `components/trading/settlement-progress.tsx`, `lib/bank/settlement-steps.ts`: không tệp nào đổi. Các sửa sau là theo rà soát độc lập (khớp lại dev, không do commit mới):
- Mã lệnh là UUID: tiêu đề dùng 8 ký tự đầu, ô Mã lệnh dùng UUID đầy đủ.
- Trang dựng theo `?id=`: tiêu đề, trạng thái, bước, bút toán, nhật ký đổi theo đúng lệnh được bấm.
- Thêm trạng thái tải, lỗi, rỗng nhật ký, chữ đúng như dev.

Breadcrumb ("Vận hành / Giao dịch / 8 ký tự mã") không vẽ: chủ dự án đã bỏ dòng phụ trên tiêu đề; khung trang là `assets/shell.js`; màn có liên kết "Về danh sách giao dịch" để quay lại.

## Trạng thái giữ theo dev, chưa vẽ
Không còn nhánh nào chưa vẽ (tải, lỗi, không tìm thấy, rỗng nhật ký đều có).

## Có đụng backend: Không

## Lệch đã thấy
- Câu nhật ký ở máy chủ có gạch dài giữa "tự động" và "lệnh …" và số thô không định dạng; bản xem thử đổi gạch dài thành dấu phẩy, giữ số thô như máy chủ ghi.
- Mốc bước chưa có: dev in gạch dài (`formatDateTime(null)`), bản xem thử in gạch ngắn "–".
- Nhật ký tìm theo chuỗi mã lệnh trong 500 dòng mới nhất (`AUDIT_SCAN_LIMIT`), lệnh cũ có thể hiện "Chưa có dòng nhật ký" dù đã có.
- Nhãn trạng thái ở dev luôn là kiểu viền; bản xem thử tô màu theo nhóm (trình bày).
