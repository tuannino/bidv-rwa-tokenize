# dashboard.html (màn `/`, Bảng điều khiển)

Màn thật: `app/src/app/(ops)/page.tsx`, `app/src/components/pages/dashboard.tsx`; dữ liệu `app/src/lib/mock-data.ts` (`MOCK_WIND_STATS`, `MOCK_PROJECTS`, `MOCK_GENERATION_SERIES`). Vai: Giao dịch viên, Kiểm soát viên.

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề "Tổng quan điện gió", câu phụ "Token hoá quyền hưởng lợi tức dự án điện gió, PoC, Cập nhật 09:14 23/10/2026" | `DashboardPage` (dashboard.tsx:54-60), `updatedAt` (giờ máy khách, `toLocaleTimeString` giờ:phút + `toLocaleDateString`) | Dấu chấm giữa của dev đổi thành dấu phẩy; "Cập nhật" viết hoa như dev |
| Nút "Phát hành WPT" | `Link href="/mint"` (dashboard.tsx:62-68) | `/mint` là màn riêng ở dev (`app/(ops)/mint/page.tsx`, `components/pages/mint.tsx`: "Phát hành token dự án điện gió (dữ liệu thử)", KYC, whitelist và phát hành dữ liệu thử) và chưa có bản xem thử. Nút giữ `href="#"`, ghi đích bằng `data-href="/mint"` và `title="Dẫn tới /mint (màn Phát hành WPT, chưa có bản xem thử)"`; không dẫn sang `draft.html` |
| Ô WPT đã phát hành, phụ đề "3 dự án, 82 tổ máy" | `MOCK_WIND_STATS.wptIssued`, `.projects`, tổng `MOCK_PROJECTS[].turbines` | Thành ô nổi bật lớn (bento) |
| Ô Nhà đầu tư whitelisted | `MOCK_WIND_STATS.whitelistedInvestors` | |
| Ô Sản lượng luỹ kế, "Nguồn: EnergyOracle, 2/3 dự án đang phát" | `MOCK_WIND_STATS.cumulativeGenerationMwh`, đếm `status === 'OPERATING'` | Ô nền vàng |
| Ô Lợi tức đã chia, "VND, 6 kỳ qua ProfitDistributor" | `MOCK_WIND_STATS.profitDistributedVndBn`, `.distributionPeriods` | |
| Biểu đồ "Sản lượng và lợi tức theo kỳ", nhãn "6 kỳ gần nhất", 2 trục MWh và tỷ, chú thích, tooltip | `MOCK_GENERATION_SERIES` (`period`, `generationMwh`, `profitVndBn`); recharts `AreaChart`, `Tooltip` | Tiêu đề tooltip là đúng nhãn kỳ (`period`, ví dụ "07/2026") như recharts, không thêm chữ "Kỳ"; giá trị "N MWh" và "N tỷ VND" theo `formatter` |
| Phân bổ WPT theo dự án, nhãn "Tổng cung", mỗi dự án: tên, WPT, %, thanh, địa điểm | `MOCK_PROJECTS[].wptIssued / MOCK_WIND_STATS.wptIssued`, `.location` | |
| 3 thẻ dự án: tên, địa điểm, Công suất đặt, Sản lượng luỹ kế, Hệ số công suất | `MOCK_PROJECTS[].capacityMw`, `.generationMwh`, `.capacityFactorPct` | Hệ số công suất hiện thêm bằng vòng đo, cùng một số |

## Thay đổi chỉ là trình bày
Bố cục bento (ô WPT lớn bên trái), ô sản lượng nền vàng, biểu tượng tua-bin quay, số đếm lên, biểu đồ vẽ dần, thanh và vòng đo chạy tới giá trị.

## Thay đổi so với bản chốt (dev mới)
Đã rà `git diff f164939 67ece1e` cho `app/src/app/(ops)/page.tsx`, `components/pages/dashboard.tsx`, `lib/mock-data.ts`: không tệp nào đổi. Các sửa sau là theo rà soát độc lập (khớp lại dev, không do commit mới):
- Nút "Phát hành WPT": ghi đích `/mint` bằng `data-href` và `title` (trước đây chỉ `href="#"` không nói đi đâu).
- Tooltip biểu đồ bỏ chữ "Kỳ " trước nhãn kỳ (dev không có).
- Câu phụ: "Cập nhật" viết hoa như dev.

Breadcrumb ("Tổng quan điện gió" ở `app/(ops)/page.tsx`) không vẽ: chủ dự án đã bỏ dòng phụ trên tiêu đề; khung trang là `assets/shell.js`.

## Trạng thái giữ theo dev, chưa vẽ
Không có. Màn chỉ đọc dữ liệu mẫu tĩnh (`lib/mock-data.ts`), không có nhánh tải, lỗi hay rỗng; mốc "Cập nhật" chỉ ẩn trước khi hydrate (dashboard.tsx:47-50).

## Có đụng backend: Không

## Lệch đã thấy
- Đồng xu trang trí trên ô "Lợi tức đã chia" in chữ "VNDB" trong khi đơn vị của ô là "tỷ" kèm "VND" (dữ liệu dev). Chữ này do `assets/ui.js` vẽ cố định (hàm `coins`, `data-coins`), không sửa `assets/`; giữ nguyên, để người điều phối quyết (bỏ `data-coins` ở ô này hoặc sửa `ui.js`).
Số mẫu không khớp mô hình token: 86,4 tỷ lợi tức cho 335.000 WPT giá 100.000 VNDB (khoảng 258.000 VNDB mỗi WPT trong 6 kỳ). Đề xuất sửa số mẫu là việc riêng, cần chủ dự án duyệt (chạm tệp dữ liệu mẫu, không phải backend).
