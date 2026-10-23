# portfolio.html: Tổng quan nhà đầu tư

- Màn thật: `/portfolio`
- Tệp đã đọc: `app/src/app/(investor)/layout.tsx`, `app/src/app/(investor)/portfolio/page.tsx`, `app/src/components/pages/investor-portfolio.tsx`, `app/src/components/investor/asset-summary.tsx`, `issuance-status-box.tsx`, `transaction-history-box.tsx`, `token-list-box.tsx`, `mock-badge.tsx`, `app/src/lib/mock-data.ts` (`MOCK_PROJECTS`, `MOCK_WIND_STATS`, `PROJECT_STATUS_LABELS`, `REGION_LABELS`), `app/src/lib/bank/portfolio.service.ts` (`getWalletTransactions`), các nơi ghi `operation` (`purchase`, `payment-mint`, `whitelist`).
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
| Bảng 5 cột: Thời điểm, Nghiệp vụ, Số lượng, Trạng thái, Tra cứu | `txn.createdAt` (`toLocaleString('vi-VN')`), `txn.operation`, `txn.amount`, `txn.status`, `txn.txHash.slice(0,10)…` | Chain mock không có trình khám phá nên mã hiện dạng chữ, `title` ghi lý do |
| Trạng thái rỗng "Kết nối ví để xem giao dịch của bạn." | nhánh `!isConnected` | tab "Chưa kết nối ví" |
| Trạng thái rỗng "Chưa có giao dịch nào…" | nhánh `rows.length === 0` | tab "Chưa có giao dịch" |
| Thẻ "Token dự án điện gió", 3 dòng | `TokenListBox`, lặp `MOCK_PROJECTS` | |
| Ký hiệu + ON-CHAIN hoặc DỮ LIỆU MẪU | `project.tokenSymbol`, `project.onChain` | |
| Tên dự án; dòng vùng và trạng thái | `project.name`, `REGION_LABELS[project.region]`, `PROJECT_STATUS_LABELS[project.status]` | Chấm giữa đổi thành dấu phẩy |
| 128 + DỮ LIỆU MẪU "nhà đầu tư nắm giữ", dự án khác "–" | `MOCK_WIND_STATS.whitelistedInvestors` khi `onChain`, ngược lại gạch dài | Gạch dài đổi thành "–" |
| Cả dòng bấm sang chi tiết | `Link href=/tokens/${tokenSymbol}` | Cả ba dòng trỏ `token-detail.html` (bản xem thử chỉ dựng trang WPT) |
| Thanh "Trạng thái xem thử" (Có ví, Chưa kết nối ví, Chưa có giao dịch) | Không phải khối của màn thật | Chỉ để xem các nhánh trạng thái |

Lớp, kiểu cục bộ: `[hidden]{display:none!important}` (để ẩn `.empty`), `.kv dt` cho co giãn để nhãn và tag xuống dòng trên điện thoại, `.tk-row` (hover dòng token, xếp cột số nhà đầu tư xuống dưới ở ≤560px). Nền ô trong thẻ hero dùng `rgba(255,255,255,.1)` (thẻ hero luôn xanh đậm ở cả hai chế độ, cùng cách c.css làm cho `.kpi.hl .ic`).

## Thay đổi chỉ là trình bày
- Bố cục bento 7/5: Tài sản (hero xanh, số lớn đếm lên) cạnh Trạng thái phát hành; Giao dịch gần đây cạnh Danh sách token.
- Badge trạng thái giao dịch tô màu theo trạng thái; Trạng thái vận hành hiện dạng badge.
- Số lượng trong bảng định dạng dấu chấm nghìn (màn thật in thô `txn.amount`).
- Dòng token có biểu tượng tua-bin.

## Có đụng backend không
Không.

## Lệch đã thấy
- Hộp Tài sản nói "Số dư VNDB chưa hiển thị được… chờ BE-01" trong khi màn Giao dịch token đã đọc được số dư VNDB qua `ledger.paymentBalanceOf` (`getTradeContext`). Hai màn mâu thuẫn; câu ở Tổng quan có vẻ đã cũ.
- `AssetSummary` và `TransactionHistoryBox` chỉ dùng ví `useAccount()`, không lùi về ví hồ sơ ở chain mock như Giao dịch, Quản lý lệnh, Chi tiết token (`ownMockWallet`). Ở chain mock không có ví trình duyệt thì Tổng quan báo "Chưa kết nối ví" dù các màn khác vẫn chạy.
- Cột Số lượng in `txn.amount` thô, lẫn đơn vị (WPT cho `purchase`, VNDB cho `payment-mint`) mà không ghi đơn vị; cột Nghiệp vụ in mã kỹ thuật (`purchase`, `whitelist`) và Trạng thái in `CONFIRMED` tiếng Anh.
- Thời điểm dùng `toLocaleString('vi-VN')` (giờ trước ngày, không ghim múi giờ), khác `formatDateTime` ở các màn lệnh.
- Breadcrumb "Tổng quan" của trang chi tiết token có `href`, nhưng dòng WPT-PQY, WPT-NTH dẫn tới trang dự án mẫu; bản xem thử dẫn cả ba dòng về trang WPT.
