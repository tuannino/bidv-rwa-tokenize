# order-detail.html: Chi tiết lệnh

- Màn thật: `/orders/[id]`
- Tệp đã đọc: `app/src/app/(investor)/orders/[id]/page.tsx`, `app/src/components/pages/investor-order-detail.tsx`, `app/src/components/trading/order-detail-content.tsx`, `settlement-progress.tsx`, `gates.ts` (`STEP_STATE_LABELS`), `app/src/lib/bank/settlement-steps.ts` (`SETTLEMENT_STEP_LABELS`, `SETTLEMENT_RULE`, `entriesOf`), `app/src/lib/bank/trade.service.ts` (`getOrderDetail`, `OrderAuditEntry`), `app/src/lib/bank/purchase.service.ts` (chuỗi nhật ký `order:place`, `order:auto-execute`).
- Breadcrumbs: Nhà đầu tư | Quản lý lệnh | ORD-2026-0001. Vai: investor. Menu sáng: orders.html.

## Ánh xạ

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Liên kết "Quản lý lệnh" | breadcrumb `{ label: 'Quản lý lệnh', href: '/orders' }` | |
| Tiêu đề "Lệnh mua ORD-2026-0001" + badge "Hoàn tất" | `SIDE_LABELS[order.side]`, `order.id.slice(0,8)`, `ORDER_STATUS_LABELS[order.status]` | |
| Ô xanh Giá trị 15.000.000 VNDB | `order.vndAmount` (dòng "Giá trị") | Tách khỏi lưới Thông tin lệnh thành ô KPI |
| Ô Số lượng 150 WPT | `order.wptAmount` (dòng "Số lượng") | như trên |
| Ô vàng Giá 100.000 VNDB | `unitPriceOf(order)` (dòng "Giá") | như trên |
| Thẻ "Thông tin lệnh": Mã lệnh, Chiều, Thời điểm tạo, Cập nhật, Ví, Mã giao dịch, Lý do | `order.id`, `side`, `formatDateTime(createdAt)`, `formatDateTime(updatedAt)`, `order.investorWallet`, `order.txHash ?? 'chưa có'`, `order.reason ?? 'không có'` | Địa chỉ và mã giao dịch hiện đủ, không cắt |
| Thẻ "Tiến trình quyết toán", 5 bước | `SettlementProgress` `steps`: "Bước n", `step.label`, `STEP_STATE_LABELS[state]`, `formatDateTime(step.at)` | Dùng lớp `steps` (đã xong có dấu tích) |
| Câu luật, Kết cục, 4 bút toán | `settlement.rule`, `settlement.outcome` ("cả bốn bút toán đã ghi."), `settlement.entries` (bên, tài sản, dấu +/-) | |
| Thẻ "Nhật ký kiểm toán của lệnh" | `audit`: `formatDateTime(at)`, badge `action`, `actorRole, outcome`, `detail` | Dạng dòng thời gian; câu rỗng "Chưa có dòng nhật ký nào gắn với lệnh này." giữ ở màn thật |

Kiểu cục bộ: `.entries`, `.steps li .mono`, `.audit` (timeline 1 cột), `.info-grid` (kv-grid 4 cột, ô rộng 2).

## Thay đổi chỉ là trình bày
- Ba con số chính (Giá trị, Số lượng, Giá) thành ba ô KPI; các trường còn lại ở lưới ô.
- Tiến trình 5 bước dùng thanh bước ngang có đường nối; nhật ký thành dòng thời gian đặt cạnh tiến trình.

## Có đụng backend không
Không.

## Các trạng thái không vẽ riêng
"Chưa kết nối ví", "Đang tải lệnh…", lỗi ("Không tìm thấy lệnh … trong phạm vi được xem."); trạng thái bước `current` (biểu tượng xoay), `failed` ("Dừng ở bước này"), kết cục `NONE_APPLIED`. Lớp `steps` có sẵn `now` cho bước đang xử lý.

## Lệch đã thấy
- Chuỗi nhật ký `order:auto-execute` có gạch ngang dài giữa "tự động" và "lệnh …"; bản xem thử đổi thành dấu phẩy theo brief.
- Chi tiết nhật ký in số thô không phân cách ("15000000 VNDB") trong khi phần còn lại của màn định dạng số.
- Nhật ký lọc theo chuỗi chi tiết trong 500 dòng mới nhất (`AUDIT_SCAN_LIMIT`), lệnh cũ có thể ra nhật ký rỗng (đã ghi trong mã).
- Mã lệnh thật là UUID cắt 8 ký tự ở tiêu đề và breadcrumb (xem ghi chú orders).
