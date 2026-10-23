# dashboard.html (màn `/`, Bảng điều khiển)

Màn thật: `app/src/app/(ops)/page.tsx`, `app/src/components/pages/dashboard.tsx`; dữ liệu `app/src/lib/mock-data.ts` (`MOCK_WIND_STATS`, `MOCK_PROJECTS`, `MOCK_GENERATION_SERIES`). Vai: Giao dịch viên, Kiểm soát viên.

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề "Tổng quan điện gió", câu phụ, giờ cập nhật | `DashboardPage`, `updatedAt` (giờ máy khách) | Đổi dấu chấm giữa thành dấu phẩy |
| Nút "Phát hành WPT" | `Link href="/mint"` | Giữ nguyên đích |
| Ô WPT đã phát hành, phụ đề "3 dự án, 82 tổ máy" | `MOCK_WIND_STATS.wptIssued`, `.projects`, tổng `MOCK_PROJECTS[].turbines` | Thành ô nổi bật lớn (bento) |
| Ô Nhà đầu tư whitelisted | `MOCK_WIND_STATS.whitelistedInvestors` | |
| Ô Sản lượng luỹ kế, "Nguồn: EnergyOracle, 2/3 dự án đang phát" | `MOCK_WIND_STATS.cumulativeGenerationMwh`, đếm `status === 'OPERATING'` | Ô nền vàng |
| Ô Lợi tức đã chia, "VND, 6 kỳ qua ProfitDistributor" | `MOCK_WIND_STATS.profitDistributedVndBn`, `.distributionPeriods` | |
| Biểu đồ "Sản lượng và lợi tức theo kỳ", nhãn "6 kỳ gần nhất", 2 trục MWh và tỷ, chú thích, tooltip | `MOCK_GENERATION_SERIES` (`generationMwh`, `profitVndBn`); recharts `AreaChart` | Vẽ bằng SVG riêng hoặc giữ recharts đổi màu, đều chỉ là trình bày |
| Phân bổ WPT theo dự án, nhãn "Tổng cung", mỗi dự án: tên, WPT, %, thanh, địa điểm | `MOCK_PROJECTS[].wptIssued / MOCK_WIND_STATS.wptIssued`, `.location` | |
| 3 thẻ dự án: tên, địa điểm, Công suất đặt, Sản lượng luỹ kế, Hệ số công suất | `MOCK_PROJECTS[].capacityMw`, `.generationMwh`, `.capacityFactorPct` | Hệ số công suất hiện thêm bằng vòng đo, cùng một số |

## Thay đổi chỉ là trình bày
Bố cục bento (ô WPT lớn bên trái), ô sản lượng nền vàng, biểu tượng tua-bin quay, số đếm lên, biểu đồ vẽ dần, thanh và vòng đo chạy tới giá trị.

## Có đụng backend không
Không. Toàn bộ số liệu đọc từ `lib/mock-data.ts` như hiện tại.

## Lệch đã thấy
Số mẫu không khớp mô hình token: 86,4 tỷ lợi tức cho 335.000 WPT giá 100.000 VNDB (khoảng 258.000 VNDB mỗi WPT trong 6 kỳ). Đề xuất sửa số mẫu là việc riêng, cần chủ dự án duyệt (chạm tệp dữ liệu mẫu, không phải backend).
