# vault.html (màn `/vault`, Vault thanh toán SPV)

Màn thật (dev `67ece1e`): `app/src/app/(ops)/vault/page.tsx` (breadcrumbs "Vận hành / Vault thanh toán SPV", cổng `vault:read`), `app/src/components/pages/vault-status.tsx` (`VaultStatusPage`, `VaultStatusMetrics`, `VaultConfigCard`, `VaultConfigHistoryCard`, `WithdrawReviewCard`, `configEffectiveText`). Đã đối chiếu `lib/bank/vault.service.ts` (`getVaultOverview`: `configEffective`, `config.mode`, `config.percentApplies`, `config.fixedLock`; `saveVaultConfig`: câu lỗi một chế độ), `lib/bank/vault-config.ts` (`configEffectiveAt`, `VAULT_CONFIG_STEP_LABELS`, `describeVaultConfigStep`), `lib/bank/withdraw.service.ts` (câu lý do NEEDS_REVIEW, PAYOUT_REVIEW), `components/ui/amount-input.tsx`.
Vai: Kiểm soát viên (mặc định), Giao dịch viên (chỉ xem). Tệp menu sáng: `vault.html`.

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề, câu phụ có tên chain | `VaultStatusPage` header | |
| Thanh "Trạng thái xem thử": Khoá theo tỷ lệ, Khoá số cố định, Chain chưa có vault | không phải khối thật | FIXED dùng 1.500.000.000 VNDB như ảnh UIUX-01 |
| "Chain này chưa triển khai vault thanh toán SPV" | `data.status === null` | Tab "Chain chưa có vault" |
| Nhóm "Trạng thái hiện tại" đúng 11 trường | `VaultStatusMetrics` | Hiện 10 ô: Tỷ lệ áp và Mức khoá cố định loại trừ nhau |
| Số dư VNDB (ô vàng lớn) | `status.vndbBalance` | 41.250.000.000 |
| Số VNDB đang khoá | `status.lockedAmount` | 8.250.000.000; FIXED 1.500.000.000 |
| Số dư WPT | `status.wptBalance` | 6.587.500 |
| VNDB có thể rút (ô vàng nhạt) | `status.withdrawable` | 33.000.000.000; FIXED 39.750.000.000 |
| Lợi nhuận chia quý trước | `status.lastDistributedPrev` | 3.403.125.000 |
| Thẻ không tiêu đề trong nhóm "Trạng thái hiện tại": Chế độ khoá, Tỷ lệ áp (chỉ PERCENT) hoặc Mức khoá cố định (chỉ FIXED), Ngày cấu hình có hiệu lực, Địa chỉ vault, Trạng thái rút | `MODE_LABEL[lockMode]`, `percent(percentRateBps)`, `fixedLockAmount`, `configEffectiveText(configEffective)`, `address`, `withdrawalsPaused` | Ngày hiệu lực theo `formatDateTime`: PERCENT 31/08/2026 18:00:12 (sự kiện Tỷ lệ khoá block 18207), FIXED 23/10/2026 09:14:36. Câu thay thế "Không đọc được", "Không xác định được", "Chưa cấu hình" giữ trong mã |
| Câu "Tỷ lệ ... đã lưu, áp từ lần chốt kỳ tiếp theo." | `status.pendingPercentRateBps !== null` | Hiện sau khi lưu tỷ lệ mới ở trạng thái PERCENT |
| Thẻ "Cấu hình khoá", câu "Chọn một chế độ khoá: ... Ví nhận tiền rút do Người bán chọn khi tạo lệnh rút." | `VaultConfigCard` | |
| Câu "Chỉ Kiểm soát viên lưu được cấu hình; vai của bạn chỉ xem." | `!config.canConfigure` | Giao dịch viên |
| Câu "Vault đang có thao tác khác (...)" | `config.busy` (thêm loại RECALL) | Không dựng |
| Nhóm chọn "Chế độ khoá": Theo tỷ lệ %, Khoá số cố định | `radiogroup aria-label="Chế độ khoá"`, `CONFIG_MODES`, chọn sẵn `config.mode` | Dạng `.seg` có `role="radio"`; Giao dịch viên bị khoá |
| Ô "Tỷ lệ khoá (%)" (chỉ PERCENT), câu "Tỷ lệ mới áp từ lần chốt kỳ tiếp theo." | `form.percent`, `effectNote` (`percentApplies = NEXT_PERIOD` vì đã qua kỳ 5) | |
| Ô "Số khoá cố định (VNDB)" (chỉ FIXED), câu "Có hiệu lực ngay khi lưu." | `AmountInput`, `config.fixedLock` (điền sẵn khi số trên chuỗi lớn hơn 0) | Hiện dấu chấm khi gõ |
| Câu lỗi dưới ô | `fieldErrors.percent`, `fieldErrors.fixedLock` | Bấm Lưu với ô sai để thấy |
| Nút "Lưu cấu hình khoá"; kết quả "Chuỗi đã đúng cấu hình này, không gửi giao dịch nào." hoặc "Đã lưu cấu hình lên chuỗi." kèm danh sách bước | `saveVaultConfigAction({ mode, percent, fixedLock })`, `steps[]` (`label: detail (tx)`) | Bước: "Đặt tỷ lệ khoá: tỷ lệ khoá 20% -> 25%", "Đặt số khoá cố định: ...", "Đổi chế độ khoá: chế độ khoá PERCENT -> FIXED" |
| Thẻ "Lệnh rút cần xem xét", nút "Đối soát lệnh rút" | `WithdrawReviewCard` | |
| Lệnh NEEDS_REVIEW `e3b9f15a`: câu lý do, sự kiện Withdrawn ứng viên, ô mã giao dịch + "Xác nhận hoàn tất", ô lý do + "Đánh dấu thất bại" | `row.status !== 'PAYOUT_REVIEW'`, `canResolve` | Nút chốt chỉ Kiểm soát viên |
| Lệnh PAYOUT_REVIEW `7c1e5b90`: câu lý do "Mất mã giao dịch đặt ví nhận sau khi gửi; ...", câu "Lệnh dừng ở bước đặt ví nhận, chưa rút tiền: ...", chỉ ô lý do + "Đánh dấu thất bại" | `row.status === 'PAYOUT_REVIEW'` | Không có sự kiện ứng viên |
| Bảng "Lịch sử cấu hình" 7 cột | `VaultConfigHistoryCard`, `PARAM_LABEL`, `configValue` | Trạng thái FIXED thêm hai dòng block 18412 |
| Bảng "Lịch sử chốt kỳ (10 lần gần nhất)" | `data.history[]` | Không đổi |

## Thay đổi chỉ là trình bày
Trạng thái hiện tại thành bento: ô vàng lớn Số dư VNDB, bốn ô số, sáu trường còn lại vào một thẻ không tiêu đề cùng nhóm. Cấu hình khoá và Lệnh rút cần xem xét đứng cạnh nhau; nhóm chế độ dạng nút chuyển; ô nhập có hậu tố % và VNDB.

## Thay đổi so với bản chốt (dev mới)
- Khối trạng thái chỉ còn 11 trường đúng thứ tự nghiệp vụ: bỏ Thu ròng, Tỷ lệ chờ áp, Phần khoá theo kỳ, Kỳ gần nhất, Ví nhận tiền rút; đổi tên "Đang khoá" thành "Số VNDB đang khoá", "Có thể rút" thành "VNDB có thể rút", "Đã chia kỳ trước" thành "Lợi nhuận chia quý trước"; thêm "Ngày cấu hình có hiệu lực"; Tỷ lệ áp và Mức khoá cố định theo chế độ; câu tỷ lệ chờ áp (UIUX-01 `ea9fe5f`, D1 đến D4).
- Cấu hình khoá một chế độ: nhóm chọn chế độ, chỉ một ô, câu hiệu lực theo chế độ, nhãn ô "Tỷ lệ khoá (%)" và "Số khoá cố định (VNDB)", câu giới thiệu mới (UIUX-01 `ea9fe5f`, C1 đến C5).
- Bỏ ô "Ví nhận tiền rút" khỏi cấu hình; câu giới thiệu nói ví nhận do Người bán chọn (FIX-01 `9d87e22`).
- "Lệnh rút cần xem xét" thêm loại lệnh dừng ở bước đặt ví nhận (PAYOUT_REVIEW), chỉ đánh dấu thất bại (FIX-01 `9d87e22`, QĐ-10).
- Ô số khoá cố định hiện dấu chấm khi gõ (UIUX-01 `ea9fe5f`, A1).

## Có đụng backend: Không

## Lệch đã thấy
- Thời điểm trong hai bảng lịch sử và lệnh rút vẫn dùng `toLocaleString('vi-VN')` (giờ trước ngày), còn "Ngày cấu hình có hiệu lực" dùng `formatDateTime` (ngày trước giờ).
- Câu bước lưu cấu hình in số thô (`số khoá cố định 0 -> 1500000000 VNDB`), không định dạng nghìn.
- Màn thật không có phân trang cho "Lệnh rút cần xem xét" (máy chủ giới hạn 20 dòng).
- Địa chỉ vault, ví thanh toán SPV trên mock đổi thành `MOCK_VAULT_ADDRESS` `0xE1237075C0AB261E3FE96E55Bc8fF5eB2aba1Cc2` (`packages/shared/src/mock-vault.ts`; trên mock Mint chỉ vào vault nên ví SPV là vault). config.html, distribution.html, demo-payment.html vẫn dùng `0x0da94B…6861`.
- Ví nhận tiền rút trên mock là ví NB001 `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65`: dòng lịch sử cấu hình và lệnh rút cần xem xét đổi theo.

## Sửa sau rà soát độc lập (lượt 2)
- 11 trường nằm chung nhóm "Trạng thái hiện tại": bỏ tiêu đề thẻ riêng "Khoá và vault", thẻ sáu trường không còn tiêu đề.
- Thêm tab trạng thái: Vault mới (UNSET "Chưa cấu hình, khoá toàn bộ", ngày hiệu lực "Chưa cấu hình", câu hiệu lực "Có hiệu lực ngay khi lưu.", "Vault chưa có thay đổi cấu hình nào.", "Không có lệnh rút nào cần xem xét.", "Chưa có kỳ nào được chốt."); Tạm dừng rút, đang bận ("Đang tạm dừng", "Vault đang có thao tác khác (lệnh rút đang dở) từ 14:22:05 21/10/2026."); Lỗi đọc một phần (ngày hiệu lực "Không đọc được" có `title` câu lỗi, lỗi lịch sử cấu hình, `historyError` ở lịch sử chốt kỳ); Đang tải (`.empty` "Đang đọc trạng thái vault…"); Lỗi tải (`.alert bad`). Câu lỗi mẫu "Lỗi không xác định.".

## Trạng thái giữ theo dev, chưa vẽ
- Ngày hiệu lực "Không xác định được" khi sự kiện không có giờ block (`vault-status.tsx` `configEffectiveText`).
- Phân trang lịch sử cấu hình "Trang a/b, n thay đổi", nút Trang trước, Trang sau: chỉ khi hơn 10 dòng (`vault-status.tsx` `VaultConfigHistoryCard`).
- "Đang đọc…" của lịch sử cấu hình và lệnh rút cần xem xét; lỗi đọc danh sách lệnh rút; câu lỗi đối soát, chốt lệnh rút; "Lệnh rút xxxxxxxx đã chốt: hoàn tất/thất bại." (`vault-status.tsx` `WithdrawReviewCard`).
- `config.busy` loại "lần lưu cấu hình khác"; loại RECALL hiện cùng câu "lần lưu cấu hình khác" vì mã chỉ phân biệt WITHDRAW.
