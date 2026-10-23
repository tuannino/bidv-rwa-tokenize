# seller.html: Tổng quan Người bán

- Màn thật: `/seller`
- Tệp đã đọc: `app/src/app/(seller)/seller/page.tsx`, `app/src/app/(seller)/layout.tsx`, `app/src/components/pages/seller-overview.tsx` (gồm `nf`, `describePolicy`, `useSellerOverview`, `Stat`, `Box`, `SUPPLY_METRICS`, `TOKEN_STATUS_LABELS`), `app/src/lib/bank/seller.service.ts` (`getSellerOverview`, `SellerOverviewView`), `app/src/lib/bank/purchase.service.ts` (`orderDailyStats`, chỉ đếm lệnh COMPLETED).
- Breadcrumbs: Người bán | Tổng quan. Vai: seller. Menu sáng: seller.html.

## Ánh xạ

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề "Tổng quan" và câu mô tả, chain đang xem | `SellerOverviewPage` header, `useSelectedChain().chain` | Chain lấy theo dropdown Chain (`data-chain-label`) |
| Nút "Danh sách giao dịch" (viền) | `Link href="/seller/transactions"` variant outline | `data-go="seller-transactions.html"`, trong `nav aria-label="Lối tắt"` |
| Nút "Tạo lệnh rút" (chính) | `Link href="/seller/withdraw"` | `data-go="seller-withdraw.html"` |
| Nhóm "Token khớp lệnh trong ngày" | `Box title="Token khớp lệnh trong ngày"` | Đổi từ một thẻ có 4 ô thành tiêu đề nhóm + 4 ô KPI |
| Ô xanh Số lượng mua, 1.250 WPT, "4 lệnh" | `data.today.buyWpt`, hint `data.today.buyCount` | |
| Ô vàng Tổng giá trị mua, 125.000.000 VNDB | `data.today.buyVnd` | |
| Ô Số lượng bán "–" + "Hệ thống chưa có lệnh bán lại." | `Stat` cố định, giá trị là gạch dài | Gạch dài đổi thành "–" theo brief |
| Ô Tổng giá trị bán "–" + câu trên | `Stat` cố định | như trên |
| Thẻ Thông tin nguồn cung, 5 dòng: Trần phát hành, Số còn được phát hành, Tổng cung hiện tại, Chưa phân phối, Đang lưu hành, mỗi dòng có câu định nghĩa và số | `SUPPLY_METRICS` + `token[key]` (`token = data.tokens[0]`) | Thêm biểu tượng tròn ở đầu dòng (trình bày) |
| Thẻ Thông tin token: Mã token, Dự án, Trần phát hành, Giá phát hành, Tuổi thọ còn lại, Lợi tức mục tiêu, Phí giao dịch, Trạng thái token, Trạng thái giao dịch | `token.tokenSymbol`, `projectName`, `cap`, `issuePriceVnd`, `terms.remainingLifetimeYears`, `terms.annualYieldPercent`, `terms.tradingFeePercent` (0 thì "Không tính"), `TOKEN_STATUS_LABELS[token.tokenStatus]`, `token.tradingOpen` ("Đang mở bán" / "Ngừng bán (đang tất toán)") | Hai trạng thái hiện dạng badge |
| Thẻ Tồn kho token: bảng Mã token + 5 cột chỉ tiêu | `Table` lặp `data.tokens` x `SUPPLY_METRICS` | Giữ nguyên cột |
| Thẻ Tài sản trong ví thanh toán: Token chưa phân phối (WPT, kèm câu "Không rút qua kênh này, lệnh rút chỉ áp cho VNDB."), VNDB, VNDB đã khoá, VNDB còn rút được | `token.undistributed`, `wallet.paymentVnd`, `wallet.lockedVnd`, `wallet.withdrawableVnd` | Ô "còn rút được" tô vàng nhạt |
| Dòng "Ví thanh toán: 0x0da9..." | `wallet.paymentWallet` | |
| Thẻ Số dư ví: VNDB ví thanh toán, VNDB ví chia lợi nhuận, Phần khoá, Hạn mức còn rút được | `wallet.paymentVnd`, `wallet.profitPoolVnd`, `wallet.lockedVnd`, `wallet.withdrawableVnd` | |
| Câu luật khoá "Nguồn on-chain: khoá 20% theo kỳ..." | `describePolicy(wallet.policy)` (PERCENT: `percentRateBps`, `netProceeds`, `percentLocked`) | |
| Thẻ "Các trạng thái khác của màn" (nhãn Xem thử), tab Cảnh báo đối soát | `wallet.warning` (role alert, hiện ở cả hai thẻ ví) | Chỉ để xem trước, không phải khối mới |
| tab Chưa có ví thanh toán | `wallet.paymentWallet === null` | |
| tab Chưa có dự án | `token` rỗng: "Chưa có dự án trên chuỗi này." | |
| tab Luật khoá khác | `describePolicy`: UNSET, FIXED, `policy === null` | |
| tab Đang tải, lỗi | `loading` "Đang đọc số liệu…", `error` | |

Lớp cục bộ (không có trong c.css): `.grp-h` (tiêu đề nhóm KPI), `.tiles2` (kv-grid 2 cột, ô `.hi` vàng), `.note` (dòng chú thích có biểu tượng), `.sup .val`, `.today .val` (cỡ chữ để 125.000.000 VNDB không xuống dòng), màu avatar ở Dark. Chỉ dùng biến CSS.

## Thay đổi chỉ là trình bày
- 4 ô "khớp lệnh trong ngày" tách thành 4 ô KPI bento (ô mua xanh có tua-bin, ô giá trị mua vàng).
- Nguồn cung đổi từ danh sách chữ sang danh sách có biểu tượng; Thông tin token đổi từ lưới 2 cột sang hàng khoá giá trị, trạng thái dạng badge.
- Hai thẻ ví dùng ô nền nhạt 2 cột, ô "còn rút được" nổi vàng; câu luật khoá có biểu tượng.
- Các trạng thái phụ (cảnh báo, rỗng, đang tải, lỗi) gom vào một thẻ có tab để xem.

## Có đụng backend không
Không.

## Lệch đã thấy
- `getSellerOverview` đã trả `today.sell` (count, wpt, vnd) từ BE-14 nhưng màn vẫn cứng gạch dài và "Hệ thống chưa có lệnh bán lại.". Sửa được ở frontend, không cần backend. Bản xem thử giữ đúng màn thật.
- Hai thẻ "Tài sản trong ví thanh toán" và "Số dư ví" lặp ba trường (`paymentVnd`, `lockedVnd`, `withdrawableVnd`) dưới nhãn khác nhau ("VNDB đã khoá" và "Phần khoá", "VNDB còn rút được" và "Hạn mức còn rút được"); `wallet.warning` cũng hiện hai lần.
- Bộ dữ liệu chung ghi "Trạng thái token: Đang phát hành", "giao dịch: Đang mở", nhưng nhãn thật là `TOKEN_STATUS_LABELS.ISSUED = "Đã phát hành"` và "Đang mở bán". Trang dùng nhãn thật.
- `nf(null)` trả gạch dài U+2014 (ký tự cấm); câu hint "Không rút qua kênh này ... lệnh rút chỉ áp cho VNDB." cũng dùng gạch dài. Trang đổi thành "–" và dấu phẩy.
