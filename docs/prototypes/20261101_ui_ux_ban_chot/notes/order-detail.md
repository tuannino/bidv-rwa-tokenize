# order-detail.html: Chi tiết lệnh

- Màn thật: `/orders/[id]`
- Tệp đã đọc (dev `67ece1e`): `app/src/app/(investor)/orders/[id]/page.tsx`, `app/src/components/pages/investor-order-detail.tsx`, `app/src/components/trading/order-detail-content.tsx`, `settlement-progress.tsx`, `gates.ts` (`STEP_STATE_LABELS`), `app/src/lib/bank/settlement-steps.ts` (`SETTLEMENT_STEP_LABELS`, `SETTLEMENT_RULE`, `entriesOf`), `app/src/lib/bank/trade.service.ts` (`getOrderDetail`, `OrderAuditEntry`), `app/src/lib/bank/purchase.service.ts` (chuỗi nhật ký `order:place`, `order:auto-execute`), `app/src/components/investor/wallet-not-bound-notice.tsx`.
- Breadcrumbs (khung không vẽ, giữ liên kết quay lại): Nhà đầu tư | Quản lý lệnh | b7e3c1a4. Vai: investor. Menu sáng: orders.html.

## Ánh xạ

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Liên kết "Quản lý lệnh" | breadcrumb `{ label: 'Quản lý lệnh', href: '/orders' }` | |
| Tiêu đề "Lệnh mua b7e3c1a4" + badge trạng thái | `SIDE_LABELS[order.side]`, `order.id.slice(0,8)`, `ORDER_STATUS_LABELS[order.status]` | |
| Ô xanh Giá trị 15.000.000 VNDB | `order.vndAmount` (dòng "Giá trị") | Tách khỏi lưới Thông tin lệnh thành ô KPI |
| Ô Số lượng 150 (không đơn vị) | `formatAmount(order.wptAmount)` (dòng "Số lượng", không đơn vị) | như trên |
| Ô vàng Giá 100.000 VNDB | `unitPriceOf(order)` (dòng "Giá") | như trên |
| Thẻ "Thông tin lệnh": Mã lệnh (UUID đầy đủ), Chiều, Thời điểm tạo, Ví, Cập nhật, Lý do, Mã giao dịch | `order.id`, `side`, `formatDateTime(createdAt)`, `order.investorWallet`, `formatDateTime(updatedAt)`, `order.reason ?? 'không có'`, `order.txHash ?? 'chưa có'` | Địa chỉ và mã giao dịch hiện đủ, không cắt |
| Thẻ "Tiến trình quyết toán", 5 bước | `SettlementProgress` `steps`: "Bước n", `step.label`, `STEP_STATE_LABELS[state]` (Xong, Đang xử lý, Chưa tới, Dừng ở bước này), `formatDateTime(step.at)` | Lớp `steps`: xong có dấu tích, `now` cho bước đang xử lý, `fail` (dấu x đỏ) cho bước dừng; bước chưa có mốc hiện "–" (dev in ký tự gạch dài, bị cấm) |
| Câu luật, Kết cục, 4 bút toán | `settlement.rule`, `settlement.outcome` (APPLIED "cả bốn bút toán đã ghi.", NONE_APPLIED "không bút toán nào được ghi, số dư hai bên giữ nguyên.", PENDING "chưa có kết cục."), `settlement.entries` | |
| Thẻ "Nhật ký kiểm toán của lệnh" | `audit`: `formatDateTime(at)`, badge `action`, `actorRole, outcome`, `detail` (mã lệnh đầy đủ); rỗng thì "Chưa có dòng nhật ký nào gắn với lệnh này." | Dạng dòng thời gian; ký tự gạch dài trong câu nhật ký của dev đổi thành dấu phẩy; tab "Nhật ký rỗng" |
| Thanh "Trạng thái xem thử": Có dữ liệu, Ví chưa định danh, Chưa kết nối ví | Không phải khối của màn thật | Thêm `?st=<mã>` để mở thẳng |
| Thông báo vàng "Ví chưa được định danh": "Ví 0x7099…79C8 chưa được ngân hàng định danh cho tài khoản này. Liên hệ ngân hàng hoặc kết nối ví khác." | `WalletNotBoundNotice` (`components/investor/wallet-not-bound-notice.tsx`) khi action trả `WALLET_NOT_BOUND` | Thay toàn bộ phần thân (`fresh.notBound`), không có tiêu đề lệnh; biểu tượng `shieldx` thay `ShieldAlert` |
| "Chưa kết nối ví" | nhánh `!wallet` của `InvestorOrderDetailPage` | Chỉ một dòng chữ có biểu tượng ví |
| Hàng "Lệnh mẫu": Hoàn tất, Bị từ chối, Hết hạn, Thất bại, Đang quyết toán | Không phải khối của màn thật | Cùng 5 lệnh với `orders.html`; mở thẳng bằng `?id=<UUID>` |
| "Đang tải lệnh…" | `fresh === null` (investor-order-detail.tsx:58-64) | Tab "Đang tải" |
| Câu lỗi "Không tìm thấy lệnh <UUID> trong phạm vi được xem." | `fresh.error` (investor-order-detail.tsx:67), `trade.service.ts:484` | Tab "Không tìm thấy" (`.alert bad`) |

Kiểu cục bộ: `.entries`, `.steps li .mono`, `.audit` (timeline 1 cột), `.info-grid` (kv-grid 4 cột, ô rộng 2).

## Thay đổi chỉ là trình bày
- Ba con số chính (Giá trị, Số lượng, Giá) thành ba ô KPI; các trường còn lại ở lưới ô.
- Tiến trình 5 bước dùng thanh bước ngang có đường nối; nhật ký thành dòng thời gian đặt cạnh tiến trình.

## Lệch đã thấy
- Chuỗi nhật ký `order:auto-execute` có gạch ngang dài giữa "tự động" và "lệnh …"; bản xem thử đổi thành dấu phẩy theo brief.
- Chi tiết nhật ký in số thô không phân cách ("15000000 VNDB") trong khi phần còn lại của màn định dạng số.
- Nhật ký lọc theo chuỗi chi tiết trong 500 dòng mới nhất (`AUDIT_SCAN_LIMIT`), lệnh cũ có thể ra nhật ký rỗng (đã ghi trong mã).
- Mã lệnh là UUID: tiêu đề và breadcrumb cắt 8 ký tự, ô Mã lệnh và nhật ký in đủ.

## Thay đổi so với bản chốt (dev mới)
- Thêm trạng thái ví chưa gắn hồ sơ (thông báo thay cả màn). Commit `9d87e22` (FIX-01).
- Thêm thanh trạng thái xem thử để xem nhánh ví chưa định danh và chưa kết nối ví (bản chốt chưa có).
- Sửa theo rà soát độc lập: dữ liệu mẫu đổi sang mã UUID (tiêu đề dùng 8 ký tự, ô Mã lệnh và câu nhật ký dùng mã đầy đủ); bỏ đơn vị "WPT" ở ô Số lượng; thêm 5 lệnh mẫu có bước Đang xử lý và Dừng ở bước này, kết cục không bút toán nào được ghi; thêm tab Nhật ký rỗng, Đang tải, Không tìm thấy.

## Có đụng backend: Không
Không.
