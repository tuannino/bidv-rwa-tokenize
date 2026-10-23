# transaction-detail.html (màn `/transactions/[id]`, Chi tiết lệnh vận hành)

Màn thật: `app/src/app/(ops)/transactions/[id]/page.tsx` (breadcrumbs "Vận hành", "Giao dịch" có liên kết, `id.slice(0, 8)`), `app/src/components/pages/ops-order-detail.tsx` (`OpsOrderDetailPage`, `getOpsOrderDetailAction`), `app/src/components/trading/order-detail-content.tsx` (`OrderDetailContent`, `Row`), `app/src/components/trading/settlement-progress.tsx` (`SettlementProgress`, `StepIcon`). Đã đọc thêm `lib/bank/settlement-steps.ts`, `lib/bank/trade.service.ts` (`OrderDetailView`, nhật ký), `lib/bank/purchase.service.ts` (câu nhật ký `order:place`, `order:auto-execute`). Vai: Giao dịch viên, Kiểm soát viên (giống nhau).

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Liên kết "Về danh sách giao dịch" | `Link href="/transactions"` | `data-go="transactions.html"` |
| Tiêu đề "Lệnh mua ORD-2026-0023" + nhãn trạng thái "Hoàn tất" | `SIDE_LABELS[side].toLowerCase()`, `order.id`, `ORDER_STATUS_LABELS[status]` | |
| Ô Giá trị (xanh nổi bật), Số lượng (vàng), Giá | `Row` "Giá trị" (`vndAmount`), "Số lượng" (`wptAmount`), "Giá" (`unitPriceOf(order)`) | Ba dòng của "Thông tin lệnh" đưa lên thành ô, không lặp lại trong danh sách |
| Thẻ "Thông tin lệnh": Mã lệnh, Chiều, Ví, Thời điểm tạo, Cập nhật, Mã giao dịch, Lý do | `Row` còn lại (`id`, `side`, `investorWallet`, `createdAt`, `updatedAt`, `txHash ?? 'chưa có'`, `reason ?? 'không có'`) | |
| Thẻ "Tiến trình quyết toán": 5 bước, mỗi bước "Bước n", nhãn, trạng thái, mốc giờ | `SettlementProgress`, `order.steps` (`label`, `state`, `at`), `STEP_STATE_LABELS` | Dạng `.steps`: bước xong có dấu tích, bước đang làm vàng; mốc thiếu hiện "–" |
| Câu quy tắc "Quyết toán là một bước duy nhất…", "Kết cục: cả bốn bút toán đã ghi." | `settlement.rule`, `settlement.outcome` | Ba câu kết cục giữ nguyên trong mã |
| Bốn bút toán: Nhà đầu tư/Người bán, tài sản, số có dấu - hoặc + | `settlement.entries` (`account`, `asset`, `direction`, `amount`) | Đỏ cho ghi giảm, xanh cho ghi tăng như màn thật |
| Thẻ "Nhật ký kiểm toán của lệnh": thời điểm, hành động, "vai, kết quả", chi tiết | `detail.audit` (`at`, `action`, `actorRole`, `outcome`, `detail`) | Dạng dòng thời gian |
| Rỗng "Chưa có dòng nhật ký nào gắn với lệnh này.", tải "Đang tải lệnh…", lỗi | nhánh `audit.length === 0`, `fresh === null`, `fresh.error` | Không dựng ở trạng thái có dữ liệu |

Lớp cục bộ: không có `<style>`; chỉ `style=""` căn chỉnh nhỏ (lưới 2 cột cho bốn bút toán, ngắt dòng mềm cho chi tiết nhật ký).

## Thay đổi chỉ là trình bày
Ba con số chính thành ô bento; thông tin lệnh và tiến trình đặt cạnh nhau; năm bước vẽ thành thanh bước có đường nối; nhật ký thành dòng thời gian.

## Có đụng backend không
Không.

## Lệch đã thấy
- Breadcrumbs và tiêu đề dùng `id.slice(0, 8)`; với mã dạng `ORD-2026-0023` sẽ chỉ còn "ORD-2026". Trang mẫu hiện đủ mã (xem ghi chú `transactions.md`). Breadcrumb "Giao dịch" ở màn thật là liên kết; khung `ui.js` dùng chung chưa hỗ trợ liên kết trong breadcrumbs.
- Câu nhật ký ở máy chủ có gạch ngang dài giữa "tự động" và "lệnh …" và số thô không định dạng; trang mẫu đổi gạch dài thành dấu phẩy, giữ số thô như máy chủ ghi.
- Nhật ký tìm theo chuỗi mã lệnh trong 500 dòng mới nhất (`AUDIT_SCAN_LIMIT`), lệnh cũ có thể hiện "Chưa có dòng nhật ký" dù đã có (đã ghi chú trong mã).
