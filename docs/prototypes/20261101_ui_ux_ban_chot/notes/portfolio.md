# portfolio.html: Tổng quan nhà đầu tư

- Màn thật: `/portfolio`
- Tệp đã đọc (dev `67ece1e`): `app/src/app/(investor)/layout.tsx`, `app/src/app/(investor)/portfolio/page.tsx`, `app/src/components/pages/investor-portfolio.tsx`, `app/src/components/investor/asset-summary.tsx`, `issuance-status-box.tsx`, `transaction-history-box.tsx`, `token-list-box.tsx`, `mock-badge.tsx`, `app/src/lib/mock-data.ts` (`MOCK_PROJECTS`, `MOCK_WIND_STATS`, `PROJECT_STATUS_LABELS`, `REGION_LABELS`), `app/src/lib/bank/portfolio.service.ts` (`getWalletTransactions`), các nơi ghi `operation` (`purchase`, `payment-mint`, `whitelist`), `app/src/components/investor/wallet-not-bound-notice.tsx`, `app/src/components/recall/gates.ts` (`recallNoticeText`), `app/src/lib/txn-labels.ts` (`operationLabel`), `app/src/lib/bank/portfolio.service.ts` (`recall`).
- Breadcrumbs: Nhà đầu tư | Tổng quan. Vai: investor. Menu sáng: portfolio.html.

## Ánh xạ

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề "Tổng quan nhà đầu tư" và câu mô tả | `InvestorPortfolioPage` header | Giữ nguyên chữ |
| Thẻ xanh "Tài sản đã đầu tư" + nhãn ON-CHAIN | `AssetSummary`, `CardTitle`, `OnChainBadge` | Đổi thành thẻ hero |
| "WPT đang giữ", số 150 | `${data.token.symbol} đang giữ`, `nf(data.balance)` | |
| Ô "Giá trị theo giá phát hành" 15.000.000 ₫ | `nf(data.valueVnd)` | |
| Câu "Quy đổi theo giá phát hành 100.000 ₫/WPT. Chưa có thị trường thứ cấp…" | `data.issuePriceVnd`, `data.token.symbol` | |
| Badge "đã KYC" | `data.whitelisted` ("đã KYC"/"chưa KYC") | Badge "đang đóng băng" (`data.frozen`) không hiện vì ví mẫu không đóng băng |
| Ví rút gọn `0x70997970…79C8` | `data.wallet.slice(0,10)…slice(-4)` | Địa chỉ đầy đủ ở `title` |
| Câu "Số dư VNDB chưa hiển thị được…(chờ BE-01)" | đoạn R5.4 trong `AssetSummary` | |
| Trạng thái "Chưa kết nối ví" (tab xem thử) | nhánh `!isConnected` của `AssetSummary`, có liên kết "Ví của tôi" | `data-go="wallet.html"` |
| Thẻ "Trạng thái phát hành" | `IssuanceStatusBox` | |
| Ký hiệu token WPT + ON-CHAIN | `data.symbol`, `OnChainBadge` | |
| Tổng cung đã phát hành 10.000.000 + ON-CHAIN | `nf(data.totalSupply)` | |
| Giá phát hành 100.000 ₫ | `nf(data.issuePriceVnd)` | |
| Dự án + DỮ LIỆU MẪU | `ON_CHAIN_PROJECT.name`, `MockBadge` | "Điện gió An Viên" |
| Trạng thái vận hành + DỮ LIỆU MẪU | `PROJECT_STATUS_LABELS[ON_CHAIN_PROJECT.status]` | Hiện dạng badge |
| Khung thông tin "Chưa có thị trường thứ cấp…" | đoạn `p` cuối `IssuanceStatusBox` | Đổi thành `alert` |
| Thẻ "Giao dịch gần đây" + ON-CHAIN | `TransactionHistoryBox` | |
| Bảng 5 cột: Thời điểm, Nghiệp vụ, Số lượng, Trạng thái, Tra cứu | `txn.createdAt` (`toLocaleString('vi-VN')`), `operationLabel(txn.operation)` ("Mua", "Cấp VNDB thử", "Định danh ví", "Thu hồi"), `txn.amount`, `txn.status`, `txn.txHash.slice(0,10)…` | Chain mock không có trình khám phá nên mã hiện dạng chữ, `title` ghi lý do |
| Trạng thái rỗng "Kết nối ví để xem giao dịch của bạn." | nhánh `!isConnected` | tab "Chưa kết nối ví" |
| Trạng thái rỗng "Chưa có giao dịch nào…" | nhánh `rows.length === 0` | tab "Chưa có giao dịch" |
| Thẻ "Token dự án điện gió", 3 dòng | `TokenListBox`, lặp `MOCK_PROJECTS` | |
| Ký hiệu + ON-CHAIN hoặc DỮ LIỆU MẪU | `project.tokenSymbol`, `project.onChain` | |
| Tên dự án; dòng vùng và trạng thái | `project.name`, `REGION_LABELS[project.region]`, `PROJECT_STATUS_LABELS[project.status]` | Chấm giữa đổi thành dấu phẩy |
| 128 + DỮ LIỆU MẪU "nhà đầu tư nắm giữ", dự án khác "–" | `MOCK_WIND_STATS.whitelistedInvestors` khi `onChain`, ngược lại gạch dài | Gạch dài đổi thành "–" |
| Cả dòng bấm sang chi tiết | `Link href=/tokens/${tokenSymbol}` | WPT mở `token-detail.html`, WPT-PQY và WPT-NTH mở `token-detail.html?p=PQY`, `?p=NTH` (biến thể chưa lên chuỗi) |
| Thanh "Trạng thái xem thử" (Có ví, Thông báo thu hồi, Đang đóng băng, Dự án đã đóng, Đang tải, Lỗi, Ví chưa định danh, Chưa kết nối ví, Chưa có giao dịch) | Không phải khối của màn thật | Hàng riêng dưới tiêu đề; thêm `?st=<mã>` để mở thẳng. Tab "Có ví" giả định có ví trình duyệt: ở chain Mock dev đọc ví qua `useAccount` (không lùi về ví hồ sơ) nên khi chưa kết nối ví trình duyệt màn thật rơi vào nhánh "Chưa kết nối ví" |
| Khung vàng thông báo thu hồi đầu thẻ Tài sản | `data.recall`, `recallNoticeText` | NOTICE: "Thông báo thu hồi token", "Dự án hết hạn ngày 25/10/2026. Từ ngày 05/11/2026 ngân hàng sẽ thu hồi 150 WPT trong ví này (còn 4 ngày). Giao dịch mua bán đã tạm dừng. Thanh toán thực hiện ngoài hệ thống."; FROZEN: "Thu hồi token", "WPT đang bị đóng băng để thu hồi. Số WPT sẽ hoặc đã bị thu hồi: 150."; CLOSED: "Dự án đã đóng", "Dự án đã đóng. Đã thu hồi 150 WPT của ví này." Tab Dự án đã đóng: WPT đang giữ 0, giá trị 0 ₫, thêm dòng "Thu hồi" 150 trong Giao dịch gần đây |
| Thông báo vàng "Ví chưa được định danh": "Ví 0x7099…79C8 chưa được ngân hàng định danh cho tài khoản này. Liên hệ ngân hàng hoặc kết nối ví khác." | `WalletNotBoundNotice` (`components/investor/wallet-not-bound-notice.tsx`) khi action trả `WALLET_NOT_BOUND` | Trong thẻ Tài sản đã đầu tư và thẻ Giao dịch gần đây (`fresh.notBound`), thay số liệu; biểu tượng `shieldx` thay `ShieldAlert` |
| Đang tải: "Đang đọc số dư từ chuỗi…", "Đang đọc thông số token…", "Đang tải…"; lỗi: câu lỗi đỏ ở cả ba hộp | asset-summary.tsx:102-110, issuance-status-box.tsx:74-80, transaction-history-box.tsx:88-96 | Tab "Đang tải" (biểu tượng `loader`), tab "Lỗi" (`.alert bad`, câu mẫu "Lỗi không xác định khi gọi chain.") |
| Tab "Chưa có giao dịch": WPT đang giữ 0, giá trị 0 ₫, nhãn "chưa KYC" | `data.balance`, `data.whitelisted` | Cho khớp với bảng rỗng (ví mới, chưa định danh, chưa có WPT) |

Lớp, kiểu cục bộ: `[hidden]{display:none!important}` (để ẩn `.empty`), `.kv dt` cho co giãn để nhãn và tag xuống dòng trên điện thoại, `.tk-row` (hover dòng token, xếp cột số nhà đầu tư xuống dưới ở ≤560px). Ô trong thẻ hero dùng lớp `.tile`: nền xanh đậm `rgba(2,36,34,.62)` có làm mờ phía sau, để hình tua-bin không đè chữ nhỏ ở cả Sáng và Tối.

## Thay đổi chỉ là trình bày
- Bố cục bento 7/5: Tài sản (hero xanh, số lớn đếm lên) cạnh Trạng thái phát hành; Giao dịch gần đây cạnh Danh sách token.
- Badge trạng thái giao dịch tô màu theo trạng thái; Trạng thái vận hành hiện dạng badge.
- Số lượng trong bảng định dạng dấu chấm nghìn (màn thật in thô `txn.amount`).
- Dòng token có biểu tượng tua-bin.

## Lệch đã thấy
- Thông báo thu hồi nói "Giao dịch mua bán đã tạm dừng" trong khi Nhà đầu tư mặc định chỉ được mua (FIX-02); câu này đúng khi cờ bán bật, còn mặc định thì chỉ có giao dịch mua bị dừng.
- Hộp Tài sản nói "Số dư VNDB chưa hiển thị được… chờ BE-01" trong khi màn Giao dịch token đã đọc được số dư VNDB qua `ledger.paymentBalanceOf` (`getTradeContext`). Hai màn mâu thuẫn; câu ở Tổng quan có vẻ đã cũ.
- `AssetSummary` và `TransactionHistoryBox` chỉ dùng ví `useAccount()`, không lùi về ví hồ sơ ở chain mock như Giao dịch, Quản lý lệnh, Chi tiết token (`ownMockWallet`). Ở chain mock không có ví trình duyệt thì Tổng quan báo "Chưa kết nối ví" dù các màn khác vẫn chạy.
- Cột Số lượng in `txn.amount` thô, lẫn đơn vị (WPT cho `purchase`, VNDB cho `payment-mint`) mà không ghi đơn vị; cột Trạng thái vẫn in `CONFIRMED` tiếng Anh (cột Nghiệp vụ đã có nhãn tiếng Việt từ FE-10).
- Thời điểm dùng `toLocaleString('vi-VN')` (giờ trước ngày, không ghim múi giờ), khác `formatDateTime` ở các màn lệnh.

## Thay đổi so với bản chốt (dev mới)
- Cột Nghiệp vụ in nhãn tiếng Việt qua `operationLabel` thay mã kỹ thuật (`purchase` thành "Mua", `payment-mint` thành "Cấp VNDB thử", `whitelist` thành "Định danh ví", thêm `recall` "Thu hồi"). Commit `34623ef` (FE-10, `lib/txn-labels.ts`).
- Thông báo thu hồi cho Nhà đầu tư trong thẻ Tài sản theo ba pha (NOTICE, FROZEN, CLOSED). Commit `34623ef` (FE-10), `5e26fb1`.
- Trạng thái ví chưa gắn hồ sơ trong thẻ Tài sản và Giao dịch gần đây. Commit `9d87e22` (FIX-01).
- Giá phát hành theo `readEffectiveIssuePrice`. Commit `61cdbae` (FE-07); số mẫu không đổi.
- Giữ dải video "Đề xuất bổ sung" có sẵn của bản chốt.
- Cột Số lượng vẫn hiện dấu chấm hàng nghìn như bản chốt (dev vẫn in `txn.amount` thô; UIUX-01 `ea9fe5f` không đổi hộp này).
- Sửa theo rà soát độc lập: thêm tab Đang tải, Lỗi cho ba hộp; ô trong thẻ hero có nền đặc hơn để tua-bin không đè chữ; tab "Chưa có giao dịch" đổi số đang giữ về 0 và "chưa KYC" cho khớp; dòng WPT-PQY, WPT-NTH mở đúng trang dự án mẫu; ghi rõ tab mặc định giả định có ví trình duyệt.

## Có đụng backend: Không
Không.
