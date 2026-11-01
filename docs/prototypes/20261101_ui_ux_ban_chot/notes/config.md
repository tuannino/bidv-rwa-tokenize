# config.html (màn `/config`, Giá và phát hành)

Màn thật đã đọc (dev `67ece1e`): `app/src/app/(ops)/config/page.tsx` (breadcrumbs "Vận hành / Giá và phát hành", cổng `ops:read`), `app/src/components/pages/price-config.tsx`, `app/src/app/actions/config.ts`. Đối chiếu thêm `lib/bank/config.service.ts` (`getPriceConfigOverview`, `getIssuePrice`, `setIssuePrice`, câu lỗi vượt ngưỡng và lệnh đang xử lý), `lib/config/issue-terms.ts` (ngưỡng mặc định 2), `packages/shared/src/token-parameters.json` (giá 100.000, trần 20.000.000), `e2e/fe-07-price-config.spec.ts`, `docs/USER_GUIDE.md` mục 3.5.3, `docs/CHECKPOINT_FE07.md`. Đã xem `components/ui/amount-input.tsx` nhưng màn này KHÔNG dùng nó (xem mục Lệch).
Vai: Giao dịch viên (mặc định, có khối Đổi giá), Kiểm soát viên (chỉ xem). Tệp menu sáng: `config.html` (mục "Giá và phát hành" có sẵn trong `assets/shell.js` cho cả hai vai).

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề "Giá và phát hành", câu phụ | `PriceConfigPage` header | Giữ nguyên câu |
| Thanh "Trạng thái xem thử": Giao dịch viên 11 tab, Kiểm soát viên 8 tab (bỏ "Còn lệnh đang xử lý", "Đổi giá chưa có xác nhận", "Đổi giá bị chuỗi từ chối" vì vai này không có khối Đổi giá) | Không có trên màn thật | Mặc định "Có dữ liệu". Tab "Giá trên hợp đồng lệch (hardhat-local, evm)" ghi rõ chỉ có ở chain có OrderSettlement; trên mock `warning` luôn null |
| Câu "Đang tải…" | `!result` (price-config.tsx:440-444) | `.empty` có biểu tượng loader; tab "Đang tải" |
| Lỗi tải toàn màn | `result && !result.ok` (price-config.tsx:445) | `.alert bad` với câu dự phòng của `toResult`: "Lỗi không xác định."; tab "Lỗi tải" |
| Lỗi từng khối | `PartError` cho khối Giá phát hành và Tình trạng phát hành (price-config.tsx:82-84, dùng ở :112 và :317) | `.alert bad` "Lỗi không xác định." trong từng thẻ, các khối khác vẫn hiện; khối giá lỗi thì ô giá mới không có gợi ý và hộp xác nhận nói "từ giá hiện tại"; tab "Lỗi từng khối" |
| Thẻ "Giá phát hành" | `PriceCard`, `price` (`getIssuePrice`) | |
| Ô vàng "Giá áp dụng cho lệnh mới" hoặc "Giá áp dụng cho lệnh mới (trên hợp đồng)" | `price.data.onChain ? ... : ...`, `price.data.priceVnd`, `data-testid="effective-price"` | Nhãn có "(trên hợp đồng)" khi chain đang chọn là hardhat-local hoặc evm (có OrderSettlement), giống `settlesAtOnChainPrice`; ô `kpi au` vì là con số tiền chính |
| Giá đã cấu hình | `price.data.configuredPriceVnd`, `data-testid="configured-price"` | |
| Đặt gần nhất | `ROLE_LABEL[updatedBy]`, `when(updatedAt)`; chưa có thì "Chưa ai đặt, đang dùng giá mặc định của dự án" | Tab "Chưa đổi giá lần nào" hiện câu mặc định |
| Ngưỡng cảnh báo đổi giá | `thresholdTimes` + " lần" | Mặc định 2 |
| Cảnh báo vàng "Giá trên hợp đồng khác giá đã cấu hình. Giao dịch viên đặt lại đúng giá mong muốn để hai nơi khớp." | `price.data.warning` | Tab "Giá trên hợp đồng lệch": hợp đồng 120.000, cấu hình 100.000 |
| Thẻ "Đổi giá" | `ChangePriceCard`, chỉ khi `canEdit` (`treasury:manage` và cờ cấu hình của vai) | Chỉ Giao dịch viên; Kiểm soát viên không có thẻ này (như e2e kiểm), không phải ô bị khoá |
| Ô "Giá mới (VNDB cho 1 WPT)", căn phải, gợi ý là giá hiện tại dạng thô | `#new-price`, `placeholder={currentPrice}` | Ô chữ thường, cắt khoảng trắng, không chèn dấu chấm |
| Ô "Lý do", gợi ý "Bắt buộc: căn cứ đổi giá, ví dụ số quyết định.", tối đa 200 ký tự | `#price-reason` | |
| Dòng lý do khoá nút | `blockReason`: còn lệnh đang xử lý (đếm theo Đã đặt, Đang kiểm tra, Đang quyết toán), giá không phải số nguyên dương, lý do ngoài 5 tới 200 ký tự | Tab "Còn lệnh đang xử lý": Đã đặt 1, Đang kiểm tra 0, Đang quyết toán 1 |
| Nút "Đổi giá" | mở hộp xác nhận, khoá khi `blockReason` | |
| Hộp "Xác nhận đổi giá": "Đổi giá phát hành từ X sang Y VNDB. Áp dụng ngay cho mọi lệnh mới.", "Lý do: ...", nút "Huỷ", "Xác nhận đổi giá" | `Dialog stage.kind === 'confirm'` | Hộp nổi `<dialog>` |
| Hộp "Giá mới lệch lớn so với giá hiện tại", câu của máy chủ, ô "Tôi đã kiểm số chữ số", nút "Huỷ", "Vẫn đổi giá" (khoá tới khi đánh dấu) | `Dialog stage.kind === 'confirm-large'`, `fieldErrors.confirmLargeChange` | Trang tự kiểm ngưỡng theo `exceedsThreshold` (hai chiều, so với giá đã cấu hình) để mở hộp thứ hai |
| Thông báo kết quả "Đã đổi giá phát hành từ X sang Y VNDB; chuỗi đã xác nhận (tx ...)." | `feedback` tone success; X là `previousPriceVnd` | Đổi xong: giá, Đặt gần nhất và dòng lịch sử mới cập nhật tại chỗ |
| Cảnh báo "Giao dịch đổi giá đã gửi nhưng chưa có xác nhận. Nếu chuỗi xác nhận sau, màn sẽ hiện cảnh báo lệch giá; khi đó đặt lại cùng giá để ghi nhận." | `feedback` tone warning (LEDGER và câu "chưa có xác nhận"), config.service.ts | `.alert warn`; tab "Đổi giá chưa có xác nhận" (chỉ Giao dịch viên) |
| Lỗi "Chuỗi từ chối giao dịch đổi giá (tx ...). Giá chưa đổi." | `feedback` tone error | `.alert bad`; tab "Đổi giá bị chuỗi từ chối" (chỉ Giao dịch viên) |
| Thẻ "Tình trạng phát hành" | `IssuanceCard`, `issuance` | |
| Ô xanh "Tổng cung trên chuỗi" | `issuance.data.supply` + `tokenSymbol` | Ô `kpi hl` vì là con số token chính |
| Trần phát hành (bảng dự án), Còn được phát hành, Mốc phát hành lần đầu | `cap`, `remaining`, `when(issuedAt)` | |
| Ví thanh toán SPV, nút "Sao chép" (đổi "Đã sao chép", trình duyệt chặn thì "Chưa sao chép được", 2 giây sau trở lại) | `spvWallet` rút gọn 10 và 6 ký tự, `CopyButton`; null thì "chưa có (chưa phát hành lần đầu)" | Trên mock, `spvWallet()` là ví nhận lần phát hành đầu, tức vault logic `MOCK_VAULT_ADDRESS` `0xE1237075C0AB261E3FE96E55Bc8fF5eB2aba1Cc2` (packages/shared/src/mock-vault.ts:11; e2e phát hành đầu vào địa chỉ này) |
| Cảnh báo vàng "Tổng cung trên chuỗi vượt trần trong bảng dự án. Cần đối soát trước khi phát hành thêm." | `issuance.data.overCap` | Tab "Tổng cung vượt trần": tổng cung 20.500.000 |
| Câu "Chain này chưa có dự án nào." | `issuance.ok && !issuance.data` | Tab "Chain chưa có dự án" |
| Thẻ "Lịch sử đổi giá", bảng "Bảng lịch sử đổi giá": Thời điểm, Vai, Giá cũ, Giá mới, Lý do, Mã giao dịch | `HistoryCard`, `history` (20 dòng mới nhất) | Giá cũ rỗng thì "không có"; mã giao dịch là liên kết trình duyệt khối chỉ khi chain evm, chain khác là mã rút gọn |
| Câu rỗng "Chưa có lần đổi giá nào. Giá đang dùng là giá mặc định của dự án." | `rows.length === 0` | Tab "Chưa đổi giá lần nào" |

Dữ liệu mẫu: giá 100.000 VNDB (giá mặc định `token-parameters.json`, khớp `trade.html`, `portfolio.html`), trần 20.000.000 WPT, tổng cung 10.000.000 WPT, còn được phát hành 10.000.000 (khớp `draft.html`), ví SPV là `MOCK_VAULT_ADDRESS` `0xE1237075…ba1Cc2` (dev mock). Hai dòng lịch sử ngày 28/2/2026 (đặt 120.000 rồi chỉnh về 100.000), thời điểm theo `toLocaleString('vi-VN')` như màn thật.

## Thay đổi so với bản chốt (dev mới)
- Màn mới hoàn toàn, chưa có trong bản chốt (bản chốt dựng trên dev `f164939`, trước FE-07). Nguồn: commit `61cdbae` (FE-07: màn giá phát hành và nguồn cung; đổi giá chờ xác nhận chuỗi; một nguồn giá cho màn khách hàng), tài liệu `d82c873`.
- Mục menu "Giá và phát hành" cho Giao dịch viên và Kiểm soát viên (FE-07) đã có sẵn trong `assets/shell.js`, trang này chỉ khai `data-nav="config.html"`, `data-roles="teller,controller"`.
- Trình bày theo phong cách bản chốt: bố cục hai cột như màn thật (trái: Giá phát hành, Đổi giá; phải: Tình trạng phát hành), Lịch sử đổi giá rộng cả hàng; con số chính đưa vào ô `kpi au` (giá) và `kpi hl` (tổng cung); các dòng còn lại là `.kv`. Trong thẻ Tình trạng phát hành, "Tổng cung trên chuỗi" đứng đầu thành ô lớn, các dòng khác giữ thứ tự của màn thật.

- Theo rà soát độc lập: thêm lỗi tải toàn màn, lỗi từng khối, cảnh báo và lỗi khi đổi giá, câu "Chưa sao chép được"; ô tải dùng `.empty`; ví SPV đổi sang `MOCK_VAULT_ADDRESS` của dev.
- Ghi chú về điểm rà soát "ngưỡng phải so với giá đang có hiệu lực": máy chủ so với `readIssuePriceVnd` (config.service.ts:223-232), mà hàm này đọc giá ĐÃ CẤU HÌNH trong database (lib/store/config-values.ts:41-52, chú thích "Giá phát hành một WPT ĐÃ CẤU HÌNH"), không phải giá trên hợp đồng. Trang đã so với giá đã cấu hình (`S.configured`) nên giữ nguyên; câu "từ X" trong thông báo thành công là `previousPriceVnd` cũng là giá đó. Chỉ hộp xác nhận thứ nhất dùng giá áp dụng (`price.data.priceVnd`), trang đã làm đúng.

Breadcrumb ("Vận hành / Giá và phát hành") không vẽ: chủ dự án đã bỏ dòng phụ trên tiêu đề; khung trang là `assets/shell.js`.

## Trạng thái giữ theo dev, chưa vẽ
- Đang gửi đổi giá: nút có biểu tượng quay và mọi nút khoá (`busy`), price-config.tsx:242-245, 274-279, 296-301; bản xem thử trả kết quả ngay.
- Ghi database lỗi sau khi chuỗi xác nhận (hoàn nguyên giá), câu dài có số cần đặt lại: config.service.ts:266-319; hiện như một phản hồi lỗi.
- Lịch sử có lý do rỗng ("không ghi") và dòng không có mã giao dịch ("không có"): price-config.tsx:385-390; logic có trong trang, dữ liệu mẫu không có dòng như vậy.

## Có đụng backend: Không
Mọi trường có sẵn trong `getPriceConfigOverviewAction` (một action khi mở màn) và `setIssuePriceAction`.

## Lệch đã thấy (để chủ dự án quyết)
- Brief giao có nêu `components/ui/amount-input.tsx`, nhưng màn `/config` ở dev mới vẫn dùng ô chữ thường (`<input inputMode="numeric">`), không hiện dấu chấm hàng nghìn khi gõ như các ô số UIUX-01 (`/draft`, `/mint`, `/vault`, `/seller/withdraw`). Bản xem thử theo đúng dev: gõ "120.000" sẽ bị chặn bằng câu "Nhập giá mới là số nguyên dương, đơn vị VNDB.". Nếu muốn thống nhất, cần sửa `price-config.tsx` dùng `AmountInput`.
- Câu vượt ngưỡng của máy chủ in số thô và đơn vị "VND" ("Giá mới 2400000 VND lệch quá 2 lần ... 120000 VND"), trong khi màn dùng "VNDB" và số có dấu chấm.
- Thời điểm dùng `toLocaleString('vi-VN')` (giờ trước ngày), khác `formatDateTime` (ngày trước giờ) ở màn Thu hồi token.
- Màn thật dùng biểu tượng `…` khi rút gọn mã, màn Thu hồi token dùng ba dấu chấm.
