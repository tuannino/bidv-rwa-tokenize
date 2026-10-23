# trade.html: Giao dịch token

- Màn thật: `/trade`
- Tệp đã đọc: `app/src/app/(investor)/trade/page.tsx`, `app/src/components/pages/investor-trade.tsx` (`OrderSummary`, `TokenInfoCard`, `TrackedOrder`, `PermitNotice`, `ConnectWalletPrompt`, `SIGN_PHASE_LABELS`), `app/src/components/trading/trade-check-block.tsx`, `gates.ts`, `settlement-progress.tsx`, `app/src/components/wallet/wrong-chain-banner.tsx`, `app/src/lib/bank/trade.service.ts` (`quantityCaps`, `LABELS`, `tokenCondition`, `riskCondition`), `app/src/lib/bank/purchase.service.ts` (`runOrderChecks`), `app/src/lib/bank/settlement-steps.ts`.
- Breadcrumbs: Nhà đầu tư | Giao dịch token. Vai: investor. Menu sáng: trade.html.

## Ánh xạ

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề, câu mô tả | header `InvestorTradePage` | |
| Dòng "Chế độ mô phỏng đang dùng ví trong hồ sơ Nhà đầu tư: 0x7099… Không cần kết nối ví trình duyệt." | `chain === 'mock'`, `wallet = mockWallet` | Thành `alert`; script ẩn khi đổi Chain khác mock |
| Thẻ "Đặt lệnh" | Card "Đặt lệnh" | |
| Dropdown Token "WPT: Dự án điện gió An Viên" (khoá) | `select` lặp `ctx.tokens`, `disabled={ctx.tokens.length <= 1}` | Vẫn là dropdown |
| Nút Mua / Bán | `role="tablist"`, `SIDE_LABELS`, `setSide` | Thành `seg` xanh; bấm đổi trần, nhãn nút, tóm tắt |
| Ô Số lượng (đơn vị WPT) | input `quantity` | Hậu tố "WPT" là trình bày |
| Câu trần dưới ô | `ctx.caps[side].reason` (mua: "Tối đa 18 token: số dư 1.893.000 VNDB chia cho giá 100.000 VNDB."; bán: "Tối đa 150 token: số token ví đang giữ.") | |
| Lỗi số lượng (đỏ) | `quantityBlockReason` ("Nhập số lượng token.", "Số lượng phải là số nguyên lớn hơn 0.", "Vượt trần được phép. …") | Script tính lại khi gõ |
| Ô Giá (VNDB / token, chỉ để xem) | input `readOnly`, `formatAmount(ctx.priceVnd)` | |
| Ô vàng "Tổng giá trị dự kiến" | `total` từ `preview.vndAmount`, "Chưa có" khi chưa có | |
| Khối "Kiểm tra trước lệnh", 5 điều kiện | `TradeCheckBlock`, `preview.conditions` (`account`, `identity`, `wallet`, `token`, `risk`), mỗi dòng "Nhãn" + "Đạt/Không đạt: detail" + `howToFix` | Câu chờ "Nhập số lượng hợp lệ, hệ thống kiểm tra năm điều kiện." khi số lượng chưa hợp lệ |
| Nút "Xác nhận lệnh mua/bán" | `Button onClick={openConfirm}`, khoá khi `blockReason` | Câu `blockReason` hiện dưới nút khi khoá; chỗ `submitError` có sẵn (ẩn) |
| Thẻ xanh "Tóm tắt lệnh" | `OrderSummary`: Loại lệnh, Số lượng, Giá, Tổng giá trị dự kiến, Token đang giữ (`balances.wpt`), Số dư VNDB (`balances.vndb`) | |
| Thẻ "Thông tin token" | `TokenInfoCard`: Dự án, Trần phát hành, Giá phát hành, Trạng thái token, Trạng thái giao dịch (badge), Số chưa phân phối, Tuổi thọ còn lại, Lợi tức mục tiêu, Phí giao dịch | Đủ 9 trường |
| Hộp "Đối chiếu lệnh lần cuối" | `Dialog`: mô tả, Loại lệnh, Số lượng, Giá, Tổng giá trị, nút Quay lại / Gửi lệnh | Chain EVM (hardhat-local, evm): hiện câu `PermitNotice` và nút "Ký và đặt lệnh" |
| Thẻ "Lệnh mua vừa gửi: Hoàn tất" (sau khi bấm Gửi lệnh) | `TrackedOrder`: tiêu đề `ORDER_STATUS_LABELS`, liên kết "Xem chi tiết", "Mã giao dịch mô phỏng", `SettlementProgress` (5 bước, mốc thời gian, câu luật, kết cục, 4 bút toán) | Liên kết sang `order-detail.html` |
| Trạng thái "Chưa kết nối ví" (tab xem thử) | `ConnectWalletPrompt`, liên kết "Ví của tôi" | |

Kiểu cục bộ: `[hidden]`, `.field{align-content:start}`, `.total` (ô tổng vàng), `.entries` (4 bút toán), `.modal`/`.box`/`.foot` (hộp thoại; c.css không có lớp hộp thoại; nền mờ dùng `color-mix` với `--ink`), chữ `dt` trong thẻ hero dùng `rgba(255,255,255,.75)`.

## Thay đổi chỉ là trình bày
- Bố cục 7/5: form bên trái, Tóm tắt lệnh (hero xanh) và Thông tin token bên phải.
- Token và chiều lệnh đứng cùng hàng; Số lượng và Giá cùng hàng.
- Tổng giá trị dự kiến thành ô vàng nổi; 5 điều kiện dùng danh sách `checks` có biểu tượng.

## Có đụng backend không
Không. Bản xem thử tự tính trần và tổng bằng số mẫu để minh hoạ; màn thật vẫn lấy từ `getTradeContextAction`, `previewTradeAction`, `placeOrderAction`.

## Các trạng thái không vẽ riêng
"Đang đọc số dư và thông tin token…", lỗi `freshContext.error`, "Đang kiểm tra điều kiện…", lỗi preview, câu "Chuỗi này chưa có dự án nào được token hoá." của Thông tin token, các nhãn bước ký (`Đang chuẩn bị…`, `Đang chờ ký trong ví…`, `Đang gửi lệnh…`), `WrongChainBanner` trong hộp thoại, câu huỷ ký. Vị trí của chúng giữ như màn thật.

## Lệch đã thấy
- Thông tin token in "Trạng thái token: Đã phát hành" (`TOKEN_STATUS_LABELS.ISSUED`), còn bộ dữ liệu mẫu chung gọi là "Đang phát hành". Bản xem thử giữ nhãn của mã.
- Tóm tắt lệnh hiện "Số dư VNDB" đọc được từ chuỗi, trong khi Tổng quan nói chưa đọc được số dư VNDB (xem ghi chú portfolio).
- Dropdown Token bị khoá khi chỉ có 1 token nên không thấy được các dự án mẫu (đúng ý đồ, ghi lại để biết).
