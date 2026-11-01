# token-detail.html: Chi tiết dự án token (WPT)

- Màn thật: `/tokens/[symbol]` (mặc định `WPT`, dự án `onChain`; `?p=PQY`, `?p=NTH` hoặc tab "Dự án chưa lên chuỗi" mở dự án mẫu chưa lên chuỗi)
- Tệp đã đọc (dev `67ece1e`): `app/src/app/(investor)/tokens/[symbol]/page.tsx`, `app/src/components/pages/investor-token-detail.tsx`, `app/src/components/investor/mock-badge.tsx`, `app/src/lib/mock-data.ts` (`findProjectBySymbol`, `MOCK_GENERATION_SERIES`), `app/src/lib/ledger/mock.adapter.ts` (tên token), `app/src/components/investor/wallet-not-bound-notice.tsx`.
- Breadcrumbs: Nhà đầu tư | Tổng quan | WPT. Vai: investor. Menu sáng: portfolio.html.

## Ánh xạ

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Liên kết "Tổng quan" phía trên tiêu đề | breadcrumb `{ label: 'Tổng quan', href: '/portfolio' }` | Khung xem thử không có breadcrumb bấm được nên đặt liên kết ở đây |
| Tiêu đề "Điện gió An Viên", "WPT", ON-CHAIN | `project.name`, `project.tokenSymbol`, `OnChainBadge` (dự án chưa lên chuỗi: badge "chưa triển khai trên chuỗi") | |
| Dòng "Gần bờ, An Viên, Đang phát điện" | `REGION_LABELS[region]`, `location`, `PROJECT_STATUS_LABELS[status]` | Chấm giữa đổi thành dấu phẩy |
| Thẻ xanh "Vị thế của bạn" + ON-CHAIN | Card 4 | |
| Đang giữ 150 | `nfBig(fresh.data.balance)` | |
| Giá trị theo giá phát hành 15.000.000 ₫ | `nfBig(fresh.data.valueVnd)` | |
| "Không phải giá thị trường, hệ thống chưa có thị trường thứ cấp." | câu cuối Card 4 | Gạch dài đổi thành dấu phẩy |
| Thẻ "Thông tin dự án" + DỮ LIỆU MẪU | Card 1 | |
| Mã dự án, Công suất đặt, Số tổ máy, Giá bán điện (PPA), Vận hành từ, Đơn vị vận hành | `project.code`, `capacityMw`, `turbines`, `ppaPricePerKwh`, `commissionedAt`, `operatorAddress` | |
| Thẻ "Thông tin token" + ON-CHAIN | Card 3 (`project.onChain ? OnChainBadge : MockBadge`) | |
| Ký hiệu, Tuổi thọ còn lại, Lợi tức mục tiêu, Phí giao dịch | `project.tokenSymbol`, `terms.remainingLifetimeYears`, `terms.annualYieldPercent`, `terms.tradingFeePercent` (0 thì "Không tính") | Lợi tức hiện dạng nhãn vàng |
| Tên token, Tổng cung, Giá phát hành | `fresh.data.token.name`, `token.totalSupply`, `issuePriceVnd` | Chỉ khi `project.onChain && fresh?.data` (tab "Có ví"); mọi tab khác thay bằng dòng "WPT dự kiến phát hành" `nfNum(project.wptIssued)` (185.000 với WPT) như dev (investor-token-detail.tsx:183-199) |
| Thẻ "Tình hình vận hành" + DỮ LIỆU MẪU | Card 2 | |
| Ô vàng Sản lượng luỹ kế 214.600 MWh | `project.generationMwh` | |
| Hệ số công suất 38,4% kèm vòng đo | `project.capacityFactorPct` | Vòng đo là cách vẽ lại cùng một số |
| "Sản lượng theo kỳ": biểu đồ cột + 6 ô kỳ/giá trị | `MOCK_GENERATION_SERIES` (period, generationMwh) | Danh sách giữ nguyên dưới dạng ô; biểu đồ vẽ cùng số |
| "Sản lượng thật sẽ do EnergyOracle cấp; số ở đây là minh hoạ." | câu cuối Card 2 | |
| Thanh "Trạng thái xem thử": Có ví, Đang tải, Lỗi, Ví chưa định danh, Chưa kết nối ví, Dự án chưa lên chuỗi | Không phải khối của màn thật | Đổi tab là mở lại trang với `?st=<mã>` để số đếm và vòng đo nhận đúng số |
| Thông báo vàng "Ví chưa được định danh": "Ví 0x7099…79C8 chưa được ngân hàng định danh cho tài khoản này. Liên hệ ngân hàng hoặc kết nối ví khác." | `WalletNotBoundNotice` (`components/investor/wallet-not-bound-notice.tsx`) khi action trả `WALLET_NOT_BOUND` | Trong thẻ Vị thế của bạn, thay số đang giữ và giá trị (`fresh.notBound`); biểu tượng `shieldx` thay `ShieldAlert` |
| "Kết nối ví ở góc trên phải để xem số lượng WPT bạn đang giữ." | nhánh chưa kết nối ví | Trong thẻ Vị thế |
| "Đang đọc số dư từ chuỗi…", câu lỗi đỏ trong thẻ Vị thế | `fresh === null`, `fresh.error` (investor-token-detail.tsx:230-238) | Tab "Đang tải", "Lỗi" (`.alert bad`, câu mẫu "Lỗi không xác định khi gọi chain.") |
| Biến thể dự án chưa lên chuỗi (WPT-PQY, WPT-NTH): nhãn "chưa triển khai trên chuỗi" cạnh tiêu đề, thẻ Thông tin token gắn DỮ LIỆU MẪU, dòng "WPT dự kiến phát hành" (100.000, 50.000), câu "Dự án này chưa triển khai token trên chuỗi, nên tổng cung và số dư chưa có số liệu thật.", thẻ Vị thế không gắn ON-CHAIN và hiện "Chưa có token trên chuỗi nên chưa có vị thế. Phần này sẽ có số liệu khi dự án được phát hành." | `!project.onChain` (investor-token-detail.tsx:84-88, 168, 195-207, 221-225); số dự án lấy từ `MOCK_PROJECTS` | Dòng WPT-PQY, WPT-NTH ở `portfolio.html` mở đúng biến thể này |

Kiểu cục bộ: `.periods` (lưới 6 ô kỳ), `.op-grid` (2 cột trong thẻ vận hành), `.kv dt` co giãn. Đường kẻ trong thẻ hero dùng `rgba(255,255,255,.18)`.

## Thay đổi chỉ là trình bày
- Bốn thẻ 2x2 thành bento: hàng trên Vị thế (hero) + Thông tin dự án + Thông tin token; hàng dưới Tình hình vận hành rộng hết.
- Danh sách sản lượng theo kỳ thêm biểu đồ cột, giữ các con số.

## Lệch đã thấy
- Thẻ Thông tin token gắn ON-CHAIN cho cả thẻ nhưng Tuổi thọ còn lại, Lợi tức mục tiêu, Phí giao dịch lấy từ cấu hình (`readTokenTerms`), không phải từ chuỗi.
- Giá bán điện ghi "₫/kWh" trong khi nơi khác ghi đơn vị VNDB/đồng; chấp nhận được nhưng không thống nhất.

## Thay đổi so với bản chốt (dev mới)
- Thêm trạng thái ví chưa gắn hồ sơ trong thẻ Vị thế của bạn. Commit `9d87e22` (FIX-01).
- Giá phát hành nay lấy theo `readEffectiveIssuePrice` (giá trên hợp đồng khi chain có OrderSettlement). Commit `61cdbae` (FE-07); số mẫu không đổi.
- Thêm thanh trạng thái xem thử (bản chốt chưa có).
- Sửa theo rà soát độc lập: ba dòng Tên token, Tổng cung, Giá phát hành chỉ hiện khi có dữ liệu chuỗi, các tab khác hiện "WPT dự kiến phát hành"; thêm tab Đang tải, Lỗi; thêm biến thể dự án chưa lên chuỗi (tab "Dự án chưa lên chuỗi", `?p=PQY`, `?p=NTH`).

## Có đụng backend: Không
Không.
