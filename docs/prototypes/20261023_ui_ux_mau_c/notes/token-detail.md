# token-detail.html: Chi tiết dự án token (WPT)

- Màn thật: `/tokens/[symbol]` (xem thử với `WPT`, dự án `onChain`)
- Tệp đã đọc: `app/src/app/(investor)/tokens/[symbol]/page.tsx`, `app/src/components/pages/investor-token-detail.tsx`, `app/src/components/investor/mock-badge.tsx`, `app/src/lib/mock-data.ts` (`findProjectBySymbol`, `MOCK_GENERATION_SERIES`), `app/src/lib/ledger/mock.adapter.ts` (tên token).
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
| Tên token, Tổng cung, Giá phát hành | `fresh.data.token.name`, `token.totalSupply`, `issuePriceVnd` | Chỉ khi `onChain` và có dữ liệu; dự án mẫu thay bằng "WPT dự kiến phát hành" + câu "Dự án này chưa triển khai token…" (không hiện ở bản WPT) |
| Thẻ "Tình hình vận hành" + DỮ LIỆU MẪU | Card 2 | |
| Ô vàng Sản lượng luỹ kế 214.600 MWh | `project.generationMwh` | |
| Hệ số công suất 38,4% kèm vòng đo | `project.capacityFactorPct` | Vòng đo là cách vẽ lại cùng một số |
| "Sản lượng theo kỳ": biểu đồ cột + 6 ô kỳ/giá trị | `MOCK_GENERATION_SERIES` (period, generationMwh) | Danh sách giữ nguyên dưới dạng ô; biểu đồ vẽ cùng số |
| "Sản lượng thật sẽ do EnergyOracle cấp; số ở đây là minh hoạ." | câu cuối Card 2 | |

Kiểu cục bộ: `.periods` (lưới 6 ô kỳ), `.op-grid` (2 cột trong thẻ vận hành), `.kv dt` co giãn. Đường kẻ trong thẻ hero dùng `rgba(255,255,255,.18)`.

## Thay đổi chỉ là trình bày
- Bốn thẻ 2x2 thành bento: hàng trên Vị thế (hero) + Thông tin dự án + Thông tin token; hàng dưới Tình hình vận hành rộng hết.
- Danh sách sản lượng theo kỳ thêm biểu đồ cột, giữ các con số.

## Có đụng backend không
Không.

## Các trạng thái không vẽ riêng
- Vị thế: "Chưa có token trên chuỗi nên chưa có vị thế…" (dự án mẫu), "Kết nối ví ở góc trên phải để xem số lượng WPT bạn đang giữ." (chain thật chưa kết nối), "Đang đọc số dư từ chuỗi…", lỗi. Giao diện mới đặt các câu này đúng chỗ số 150 trong thẻ hero.

## Lệch đã thấy
- Thẻ Thông tin token gắn ON-CHAIN cho cả thẻ nhưng Tuổi thọ còn lại, Lợi tức mục tiêu, Phí giao dịch lấy từ cấu hình (`readTokenTerms`), không phải từ chuỗi.
- Giá bán điện ghi "₫/kWh" trong khi nơi khác ghi đơn vị VNDB/đồng; chấp nhận được nhưng không thống nhất.
