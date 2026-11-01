# trade.html: Giao dịch token

- Màn thật: `/trade`
- Tệp đã đọc (dev `67ece1e`): `app/src/app/(investor)/trade/page.tsx`, `app/src/components/pages/investor-trade.tsx` (`OrderSummary`, `TokenInfoCard`, `TrackedOrder`, `PermitNotice`, `ConnectWalletPrompt`, `SIGN_PHASE_LABELS`), `app/src/components/trading/trade-check-block.tsx`, `gates.ts`, `settlement-progress.tsx`, `app/src/components/wallet/wrong-chain-banner.tsx`, `app/src/lib/bank/trade.service.ts` (`quantityCaps`, `LABELS`, `tokenCondition`, `riskCondition`), `app/src/lib/bank/purchase.service.ts` (`runOrderChecks`), `app/src/lib/bank/settlement-steps.ts`, `app/src/components/trading/sides.ts` (`tradeSides`), `app/src/components/recall/gates.ts` (`tradeBlockText`, `tradingStatusLabel`), `app/src/components/investor/wallet-not-bound-notice.tsx`, `app/src/lib/config/env.ts` (`enableInvestorSell`, mặc định tắt).
- Breadcrumbs: Nhà đầu tư | Giao dịch token. Vai: investor. Menu sáng: trade.html.

## Ánh xạ

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề, câu mô tả | header `InvestorTradePage`: `ctx.sellEnabled` bật thì "Mua token từ người bán hoặc bán lại cho người bán, theo giá phát hành do ngân hàng cấu hình.", tắt (mặc định) thì "Mua token từ người bán theo giá phát hành do ngân hàng cấu hình." | Đổi theo tab xem thử "Bật bán" |
| Dòng "Chế độ mô phỏng đang dùng ví trong hồ sơ Nhà đầu tư: 0x7099… Không cần kết nối ví trình duyệt." | `chain === 'mock'`, `wallet = mockWallet` | Thành `alert`; script ẩn khi đổi Chain khác mock |
| Thẻ "Đặt lệnh" | Card "Đặt lệnh" | |
| Dropdown Token "WPT: Dự án điện gió An Viên" (khoá) | `select` lặp `ctx.tokens`, `disabled={ctx.tokens.length <= 1}` | Vẫn là dropdown |
| Nút Mua / Bán (chỉ khi bật bán), không có nhãn hiện | `tradeSides(ctx.sellEnabled).length > 1`, `role="tablist" aria-label="Chiều lệnh"`, `SIDE_LABELS`, `setSide`; khoá khi `tradeBlocked` | Thành `seg` xanh; chỉ hiện ở tab "Bật bán" |
| Ô Số lượng | input `quantity` (`aria-label="Số lượng"`), không hậu tố | Ô thường, không dùng `AmountInput` |
| Câu trần dưới ô | `ctx.caps[side].reason` (mua: "Tối đa 18 token: số dư 1.893.000 VNDB chia cho giá 100.000 VNDB."; bán: "Tối đa 150 token: số token ví đang giữ.") | |
| Lỗi số lượng (đỏ) | `quantityBlockReason` ("Nhập số lượng token.", "Số lượng phải là số nguyên lớn hơn 0.", "Vượt trần được phép. …") | Script tính lại khi gõ |
| Ô Giá (VNDB / token, chỉ để xem) | input `readOnly`, `formatAmount(ctx.priceVnd)` | |
| Ô vàng "Tổng giá trị dự kiến" | `total` từ `preview.vndAmount`, "Chưa có" khi chưa có | |
| Khối "Kiểm tra trước lệnh" (chỉ tiêu đề, không có chữ đếm điều kiện) | `TradeCheckBlock`: `idle` "Nhập số lượng hợp lệ, hệ thống kiểm tra năm điều kiện.", `loading` "Đang kiểm tra điều kiện…", `error` câu lỗi đỏ (hoặc `WalletNotBoundNotice` khi `notBound`), `checked` năm dòng "Nhãn" + "Đạt/Không đạt: detail" + `howToFix` | Tab "Điều kiện chưa đạt": dòng Ví "Không đạt: Ví 0x7099… đang bị đóng băng." kèm "Liên hệ ngân hàng để xử lý trạng thái đóng băng của ví."; tab "Đang kiểm tra", "Lỗi xem trước" |
| Nút "Xác nhận lệnh mua/bán" và câu khoá dưới nút | `confirmBlockReason`: "Đang kiểm tra điều kiện trước lệnh.", câu lỗi xem trước, "Chưa đạt điều kiện: Ví.", "Giao dịch đang tạm dừng theo đợt thu hồi.", "Ví chưa được định danh" | `submitError` đỏ dưới nút giữ chỗ (ẩn) |
| Thẻ xanh "Tóm tắt lệnh" | `OrderSummary`: Loại lệnh, Số lượng, Giá, Tổng giá trị dự kiến, Token đang giữ (`balances.wpt`), Số dư VNDB (`balances.vndb`) | |
| Thẻ "Thông tin token" | `TokenInfoCard`: Dự án, Trần phát hành, Giá phát hành, Trạng thái token, Trạng thái giao dịch (badge), Số chưa phân phối, Tuổi thọ còn lại, Lợi tức mục tiêu, Phí giao dịch; `!token` thì "Chuỗi này chưa có dự án nào được token hoá." | Tab "Chưa có dự án": ô Token rỗng, trần mua "Tối đa 0 token: số chưa phân phối của người bán chỉ còn 0." |
| Hộp "Đối chiếu lệnh lần cuối" có nút X đóng | `Dialog` (nút đóng của `ui/dialog.tsx`): mô tả, Loại lệnh, Số lượng, Giá, Tổng giá trị, nút Quay lại / Gửi lệnh ("Đang gửi…" khi gửi) | Chain Hardhat Local, Sepolia: "Đang chuẩn bị nội dung chữ ký ủy quyền…" rồi câu `PermitNotice` (giờ hết hạn theo `toLocaleString('vi-VN')`: "09:44:00 23/10/2026"), nút "Ký và đặt lệnh", khi bấm lần lượt "Đang chờ ký trong ví…", "Đang gửi lệnh…" (`SIGN_PHASE_LABELS`) |
| Thẻ "Lệnh mua vừa gửi: <trạng thái>" | `TrackedOrder`: tiêu đề `ORDER_STATUS_LABELS`, liên kết "Xem chi tiết", câu "Hệ thống đang tự quyết toán; màn hình sẽ tự cập nhật kết quả." khi chưa có kết cục, "Mã giao dịch mô phỏng", `order.reason` đỏ, `SettlementProgress` (5 bước có trạng thái Xong, Đang xử lý, Chưa tới, Dừng ở bước này; kết cục; 4 bút toán) | Sau khi gửi: "Đang quyết toán" rồi tự chuyển "Hoàn tất"; tab "Lệnh bị từ chối": lý do "Số dư VNDB không đủ: cần 1000000, ví 0x7099… chỉ có 893000.", bước 2 "Dừng ở bước này", kết cục "không bút toán nào được ghi, số dư hai bên giữ nguyên." Bước chưa có mốc hiện "–" (dev in ký tự gạch dài, bị cấm) |
| Trạng thái "Chưa kết nối ví" (tab xem thử) | `ConnectWalletPrompt`, liên kết "Ví của tôi" | |
| Thanh "Trạng thái xem thử" (hàng riêng dưới tiêu đề): Có ví, Bật bán, Điều kiện chưa đạt, Đang kiểm tra, Lỗi xem trước, Lệnh bị từ chối, Ví chưa định danh, Giao dịch tạm dừng, Chưa có dự án, Đang tải, Lỗi, Chưa kết nối ví | Không phải khối của màn thật | "Có ví" là mặc định của dev (cờ `ENABLE_INVESTOR_SELL` tắt); thêm `?st=<mã>` để mở thẳng |
| Thông báo vàng "Ví chưa được định danh": "Ví 0x7099…79C8 chưa được ngân hàng định danh cho tài khoản này. Liên hệ ngân hàng hoặc kết nối ví khác." | `WalletNotBoundNotice` (`components/investor/wallet-not-bound-notice.tsx`) khi action trả `WALLET_NOT_BOUND` | Đầu thẻ Đặt lệnh (`!ctx.walletBound`); khi đó ô Số lượng khoá, câu dưới ô và câu dưới nút là "Ví chưa được định danh", Tóm tắt lệnh hiện "Không có" ở Token đang giữ, Số dư VNDB; khối kiểm tra hiện câu chờ. Khi xem trước trả `notBound`, thông báo này cũng thay câu lỗi trong khối kiểm tra; biểu tượng `shieldx` thay `ShieldAlert` |
| Khung vàng "Giao dịch tạm dừng", câu "Dự án đã đến hạn ngày 25/10/2026; giao dịch mua bán đã tạm dừng.", liên kết "Xem thông báo ở Tổng quan" | `ctx.tradeBlock`, `tradeBlockText` | Đầu thẻ Đặt lệnh; Token, Chiều lệnh, Số lượng khoá; câu dưới nút "Giao dịch đang tạm dừng theo đợt thu hồi."; liên kết sang `portfolio.html`. Các pha khác: "WPT đang bị đóng băng để thu hồi; giao dịch mua bán đã tạm dừng.", "Dự án đã đóng; giao dịch token không còn mở.", "Token đang bị đóng băng trên chuỗi; giao dịch mua bán đã tạm dừng.", "Giao dịch mua bán đang tạm dừng." |
| Nhãn "Trạng thái giao dịch" của Thông tin token | `tradingStatusLabel(phase, tradingOpen, 'trade')`: "Đang mở", "Tạm dừng (đến hạn dự án)", "Tạm dừng (đã đóng băng)", "Đã đóng", "Tạm dừng (đang đóng băng)" | Tab "Giao dịch tạm dừng" hiện "Tạm dừng (đến hạn dự án)" |
| "Đang đọc số dư và thông tin token…", câu lỗi đỏ | `freshContext === null`, `freshContext.error` (investor-trade.tsx:284-290) | Tab "Đang tải" (`.empty` có `loader`), tab "Lỗi" (`.alert bad`, câu mẫu "Lỗi không xác định khi gọi chain." của `evm.adapter.ts`) |

Kiểu cục bộ: `[hidden]`, `.field{align-content:start}`, `.total` (ô tổng vàng), `.entries` (4 bút toán), `.modal`/`.box`/`.foot` (hộp thoại; c.css không có lớp hộp thoại; nền mờ dùng `color-mix` với `--ink`), chữ `dt` trong thẻ hero dùng `rgba(255,255,255,.75)`.

## Thay đổi chỉ là trình bày
- Bố cục 7/5: form bên trái, Tóm tắt lệnh (hero xanh) và Thông tin token bên phải.
- Token rộng hết hàng (cùng hàng với cụm Mua / Bán khi bật bán); Số lượng và Giá cùng hàng.
- Tổng giá trị dự kiến thành ô vàng nổi; năm điều kiện dùng danh sách `checks` có biểu tượng.
- Thanh trạng thái xem thử nhiều tab nên đặt thành hàng riêng dưới tiêu đề.

## Lệch đã thấy
- Thông tin token in "Trạng thái token: Đã phát hành" (`TOKEN_STATUS_LABELS.ISSUED`), còn bộ dữ liệu mẫu chung gọi là "Đang phát hành". Bản xem thử giữ nhãn của mã.
- Tóm tắt lệnh hiện "Số dư VNDB" đọc được từ chuỗi, trong khi Tổng quan nói chưa đọc được số dư VNDB (xem ghi chú portfolio).
- Dropdown Token bị khoá khi chỉ có 1 token nên không thấy được các dự án mẫu (đúng ý đồ, ghi lại để biết).

## Trạng thái giữ theo dev, chưa vẽ
- `WrongChainBanner` trong hộp đối chiếu khi ví ở mạng khác (investor-trade.tsx:450), câu `walletStatus.blockedReason` (investor-trade.tsx:460): cùng dải đã vẽ ở `wallet.html` tab "Sai mạng".
- Câu huỷ ký "Bạn đã huỷ ký. Chưa có lệnh nào được gửi." và "Không ký được: …" trong hộp (investor-trade.tsx:229-230).
- `submitError` đỏ dưới nút xác nhận (investor-trade.tsx:373).

## Thay đổi so với bản chốt (dev mới)
- Nhà đầu tư không bán: cờ `ENABLE_INVESTOR_SELL` mặc định tắt nên mặc định không còn cụm nút Mua / Bán, câu mô tả chỉ nói mua; cụm nút chỉ hiện ở tab "Bật bán". Commit `90995a1` (FIX-02, `components/trading/sides.ts`).
- Ví chưa gắn hồ sơ: thông báo "Ví chưa được định danh" trong thẻ Đặt lệnh và trong khối kiểm tra, khoá ô số lượng, Tóm tắt lệnh hiện "Không có". Commit `9d87e22` (FIX-01, `gates.ts` `WALLET_NOT_BOUND_REASON`, `trade-check-block.tsx`).
- Giao dịch tạm dừng theo đợt thu hồi: khung cảnh báo, khoá các ô, câu khoá nút, nhãn trạng thái giao dịch theo pha. Commit `34623ef` (FE-10), `5e26fb1`.
- Số liệu mẫu giữ nguyên (giá 100.000, số dư 1.893.000, trần 18); định dạng số theo `formatAmount` (dấu chấm hàng nghìn), ô Số lượng ở màn này vẫn là ô thường, không dùng `AmountInput` (UIUX-01 `ea9fe5f` không đổi màn này).
- Sửa theo rà soát độc lập: thêm các tab Điều kiện chưa đạt, Đang kiểm tra, Lỗi xem trước, Lệnh bị từ chối, Chưa có dự án, Đang tải, Lỗi; thẻ Lệnh vừa gửi đi qua "Đang quyết toán" rồi "Hoàn tất"; bỏ chữ "5 điều kiện", nhãn hiện "Chiều lệnh", hậu tố "WPT" ở ô Số lượng; thêm nút X đóng hộp đối chiếu; giờ hết hạn chữ ký theo `toLocaleString('vi-VN')`; nhãn bước ký trên nút.

## Có đụng backend: Không
Không. Bản xem thử tự tính trần và tổng bằng số mẫu để minh hoạ; màn thật vẫn lấy từ `getTradeContextAction`, `previewTradeAction`, `placeOrderAction`.
