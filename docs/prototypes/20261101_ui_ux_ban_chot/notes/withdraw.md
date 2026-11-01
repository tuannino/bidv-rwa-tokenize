# withdraw.html: Rút VNDB (Nhà đầu tư)

- Màn thật: `/withdraw`
- Tệp đã đọc (dev `67ece1e`): `app/src/app/(investor)/withdraw/page.tsx`, `app/src/components/pages/investor-withdraw.tsx` (`InvestorWithdrawPage`, `settledMessage`), `app/src/components/withdraw/labels.ts` (`PAYMENT_WITHDRAW_STATUS_LABELS`), `app/src/components/investor/wallet-not-bound-notice.tsx`, `app/src/components/ui/amount-input.tsx`, `app/src/app/actions/payment-withdraw.ts`, `app/src/lib/bank/payment-withdraw.service.ts` (câu lỗi, lý do trạng thái), `app/src/lib/bank/payout-wallet.ts` (câu kiểm ví nhận), `app/e2e/investor-withdraw.spec.ts`, `docs/fe-23-rut-vndb/requirements.md`.
- Breadcrumbs: Nhà đầu tư | Rút VNDB. Vai: investor. Menu sáng: withdraw.html.

## Ánh xạ

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề "Rút VNDB" và câu "Chuyển VNDB từ ví đã định danh của bạn sang một ví nhận đã whitelist. Ví của bạn ký giao dịch; xác nhận bằng mã một lần sáu chữ số." | `header` | Giữ nguyên chữ |
| Thanh "Trạng thái xem thử" (Có dữ liệu, Lệnh đang dở, Chưa có lệnh, Ví chưa định danh, Chưa kết nối ví, Đang tải, Lỗi) | Không phải khối của màn thật | Chỉ để xem các nhánh; thêm `?st=<mã>` vào đường dẫn để mở thẳng một trạng thái |
| Thẻ "Thông tin lệnh rút", biểu mẫu `aria-label="Biểu mẫu rút VNDB"` | Card "Thông tin lệnh rút", `form` | |
| Ô "Số tiền rút (VNDB)" có dấu chấm hàng nghìn khi gõ | `AmountInput` (`formatAmount` khi hiện, `digitsOnly` khi lưu) | Biểu mẫu mở ra rỗng, nút "Tạo lệnh rút" khoá tới khi đủ số tiền, ví nhận, mục đích (investor-withdraw.tsx:93,130-138) |
| Câu đỏ "Vượt số dư: chỉ rút được tối đa 1.893.000 VNDB." | nhánh `exceeds` | Script tính lại khi gõ |
| Ô "Mạng" (chỉ đọc) | `chainLabel` của chain đang chọn | Script đọc nhãn chain của ô chọn chain ở thanh bên (chữ của option là nhãn dev, giá trị là mã chain) |
| Ô "Ví gửi" (chỉ đọc) + nhãn "Đã định danh" | input `pw-from` = ví mẫu của hồ sơ (mock) hoặc ví đang kết nối; `Badge` có `BadgeCheck`, `data-wallet-bound` | Biểu tượng `badgecheck` |
| Ô "Ví nhận" (placeholder "0x…"), câu lỗi dưới ô, câu "Ví nhận phải đã whitelist trên chuỗi và khác ví gửi." | input `pw-to`, `toError` từ `checkPaymentWithdrawTargetAction` | Kiểm trước khi mở hộp mã: dạng địa chỉ, địa chỉ 0, trùng ví gửi, địa chỉ hệ thống, chưa whitelist (chỉ ví NB001 coi là đã whitelist). Câu "Ví đang có lệnh rút chưa xong; chờ hoặc huỷ lệnh đó." chỉ hiện SAU khi nhập mã, lúc máy chủ tạo lệnh (payment-withdraw.service.ts:415-416); thử ở tab "Lệnh đang dở" |
| Ô "Mục đích", "Ghi chú" | `pw-purpose`, `pw-note` | |
| Nút "Tạo lệnh rút" | `Button type=submit`, khoá theo `canSubmit` | |
| Dòng chờ ("Đang tạo lệnh…", "Đang chờ ký trong ví…", "Đang báo mã giao dịch…", "Đang gửi tới ví…", "Đang huỷ…") | `busy` | Có biểu tượng quay |
| Câu kết quả (`aria-label="Kết quả rút VNDB"`) | `feedback`, `settledMessage`: "Đã rút <số> VNDB tới ví <ví>.", "Đã gửi, chờ xác nhận trên chuỗi; mở lại màn sau ít phút.", "Lệnh rút đã huỷ: <lý do>", "Lệnh rút đang ở trạng thái: <nhãn>." | Lỗi tô đỏ |
| Thẻ "Hệ thống tính": Số dư VNDB, Số rút | `dl` (`payment-balance`, số rút) | |
| Ô vàng đậm "Số dư sau rút" | dòng thứ ba "Số dư sau rút" của `dl` | Con số tiền chính của màn nên đặt ở ô `kpi au`; không thêm trường |
| Câu "Phí gas do ví của bạn trả bằng ETH của mạng." | `!onMock` | Script ẩn trên Mock, hiện khi đổi Chain sang Hardhat Local hoặc Sepolia |
| Thẻ "Lệnh rút của tôi", bảng 8 cột: Mã, Thời điểm, Số tiền, Ví nhận, Trạng thái, Mã giao dịch, Lý do, Thao tác | `Table aria-label="Lệnh rút của tôi"`; `r.id.slice(0,8)`, `toLocaleString('vi-VN')`, `nf(amount)`, `short(toWallet)`, `PAYMENT_WITHDRAW_STATUS_LABELS`, `completedTxHash ?? submittedTxHash`, `reason` | Trạng thái tô màu theo nghĩa (màn thật dùng badge viền); trên điện thoại mỗi dòng thành một ô thẻ |
| Mã giao dịch là liên kết mở explorer | `explorerTxUrl(chain, txHash)` | Chỉ khi Chain là Sepolia; Mock, Hardhat Local hiện chữ |
| Dòng "Chờ gửi": nút "Gửi từ ví", "Huỷ" | `r.status === 'CREATED'` | Tab "Lệnh đang dở"; bấm "Gửi từ ví" trên chain khác Mock chuyển sang "Chờ ký trong ví" rồi "Đã gửi, chờ xác nhận" |
| Dòng "Chờ ký trong ví": câu "Đang chờ ví ký hoặc kết quả trên chuỗi" và nút "Huỷ" | `r.status === 'SENDING'` | Không có nút gửi lại (QĐ-13) |
| Câu rỗng "Chưa có lệnh rút VNDB nào của ví này trên chain này." | `rows.length === 0` | Tab "Chưa có lệnh"; cũng hiện ở các tab Ví chưa định danh, Đang tải, Lỗi vì màn thật vẫn dựng thẻ bảng khi chưa có dữ liệu |
| Hộp "Xác nhận mã một lần": mô tả, "Ví nhận: <ví> (đã whitelist)", "Sau khi xác nhận, ví của bạn sẽ hỏi ký giao dịch.", ô mã, lỗi "Mã một lần phải đúng sáu chữ số.", nút "Xác nhận" | `Dialog` (`otp-payment-target`, `!onMock`) | Hộp giữ mở trong lúc tạo lệnh (nút quay); lỗi có `fieldErrors.otp` hiện trong hộp, hộp vẫn mở; lỗi khác đóng hộp, hiện dưới biểu mẫu, biểu mẫu giữ nguyên (investor-withdraw.tsx:220-228, 520-524). Kiểu hộp chép từ `seller-withdraw.html` |
| Thông báo vàng "Ví chưa được định danh" (ví rút gọn `0x7099…79C8`) | `WalletNotBoundNotice` khi `notBound` | Thay hai thẻ biểu mẫu; biểu tượng `shieldx` thay `ShieldAlert` |
| "Chưa kết nối ví", "Kết nối ví đã định danh để rút VNDB." + liên kết "Kết nối ví" | nhánh `!wallet` | Liên kết sang `wallet.html`; nhánh này không dựng thẻ bảng |
| "Đang đọc số dư…" | `data === null` | tab Đang tải |
| Câu lỗi đỏ | `fresh.error` | tab Lỗi; chữ là câu mô tả vị trí, màn thật in câu lỗi của máy chủ |

Dữ liệu mẫu: ví gửi NDT001 `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`, ví nhận NB001 `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` (`packages/shared/src/sample-wallets.json`, đúng cặp ví của `e2e/investor-withdraw.spec.ts`); số dư VNDB 1.893.000 như màn Giao dịch token.

Kiểu cục bộ: `[hidden]`, `.calc` (ô vàng dính đáy thẻ), `.gas`, `.busy` (biểu tượng quay), `.from-row` (ô ví gửi + nhãn), `.row-act`, `.why`, `.tx-link`, `dialog.otp`, bảng thành thẻ ở ≤700px.

## Trạng thái giữ theo dev, chưa vẽ
- Lỗi mã một lần trong hộp (`fieldErrors.otp`, investor-withdraw.tsx:223, 520-524): máy chủ chỉ trả khi mã không đủ sáu chữ số, mà nút "Xác nhận" đã khoá trong trường hợp đó nên không gặp trong luồng thường; chỗ hiện câu có sẵn trong hộp.
- Câu lỗi ví khi gửi trên chain thật: "Ví chưa sẵn sàng." (investor-withdraw.tsx:173), "Bạn đã từ chối ký trong ví; lệnh rút đã huỷ." (dòng 193), "Ví không gửi được giao dịch: …" (dòng 197).

## Thay đổi so với bản chốt (dev mới)
- Bỏ toàn bộ màn chờ "chờ FE-23" (thẻ "Màn hình chưa dựng", "Đã sẵn", "Lưu ý"); dựng màn rút VNDB thật theo `investor-withdraw.tsx`. Commit `017ec56` (FE-23).
- Câu mô tả đổi từ "chuyển VNDB về tài khoản ngân hàng" sang "chuyển sang một ví nhận đã whitelist" (FE-23 QĐ-1, QĐ-2; rút về ngân hàng nằm ngoài phạm vi). Commit `017ec56`.
- Thêm trạng thái "Ví chưa được định danh" dùng chung (`WalletNotBoundNotice`). Commit `9d87e22` (FIX-01), dùng ở màn này từ `017ec56`.
- Ô số tiền hiện dấu chấm hàng nghìn khi gõ (`AmountInput`). Commit `ea9fe5f` (UIUX-01).
- Thêm biểu tượng `badgecheck` cho nhãn "Đã định danh", `shieldx` cho thông báo ví chưa định danh, `flame` cho câu phí gas.
- Sửa theo rà soát độc lập: biểu mẫu mở ra rỗng và nút "Tạo lệnh rút" khoá; kiểm "Ví đang có lệnh rút chưa xong" chuyển sang lúc tạo lệnh sau khi nhập mã; hộp mã giữ mở trong lúc tạo lệnh, có chỗ hiện lỗi mã trong hộp.

## Có đụng backend: Không
Bản xem thử tự kiểm ví nhận, tự trừ số dư và tự sinh mã giao dịch để minh hoạ. Màn thật đã có đủ backend ở dev (`payment-withdraw.service.ts`, quyền `payment:withdraw`, bảng `PaymentWithdrawRequest`).

## Lệch đã thấy
- Cột Thời điểm dùng `toLocaleString('vi-VN')` (giờ trước ngày, không ghim múi giờ), khác `formatDateTime` của các màn lệnh.
- Hàm `nf` của màn trả "-" khi chưa có số (ô Số rút, Số dư sau rút), trong khi `formatAmount` dùng chung trả ký tự gạch dài.
- Trên Mock không có ví trình duyệt nên dòng "Đã huỷ" với lý do "Trình duyệt báo người dùng từ chối ký" chỉ gặp trên chain thật; tab "Lệnh đang dở" gộp dữ liệu kiểu chain thật để xem đủ nhãn.
