# demo-payment.html (màn `/demo-payment`, Nạp VNDB mô phỏng)

Màn thật: `app/src/app/(ops)/demo-payment/page.tsx` (breadcrumbs "Vận hành", "Nạp VNDB"; chặn bằng `canMintDemoPayment`), `app/src/components/pages/demo-payment.tsx` (`DemoPaymentPage`), action `app/src/app/actions/demo-payment.ts` (`demoPaymentContextAction`, `mintDemoPaymentAction`). Đã đọc thêm `app/src/app/actions/bank.ts` (chỉ đổi chú thích, không liên quan màn này), `lib/bank/demo-payment.service.ts`, `lib/config/issue-terms.ts` (`DEMO_PAYMENT_QUICK_AMOUNTS`, `DEMO_PAYMENT_MINT_MAX_VND`), `lib/rbac/demo-payment.ts` (`canMintDemoPayment`), `lib/rbac/permissions.ts`, `components/layout/nav-config.ts`, `components/layout/app-layout.tsx`, `docs/uiux-01-chinh-sua-giao-dien/requirements.md` (G1, G2), `docs/fix-01-vi-ket-noi/requirements.md` (QĐ-5, C2). Vai: Giao dịch viên (`data-roles="teller"`).

Menu: mục "Nạp VNDB" (biểu tượng `Coins`, phím tắt N) nằm trong nhóm thu gọn "Nghiệp vụ ẩn", trước "Định danh ví". Điều kiện hiện: `canMintDemoPayment(role)`, tức cờ máy chủ `ENABLE_DEMO_PAYMENT_MINT` bật VÀ vai có quyền `demo:mint-payment` (chỉ `TELLER`). Cờ tắt thì mục không hiện; nếu Giao dịch viên cũng không có mục nào khác thì nhóm không hiện, nhưng "Định danh ví" luôn có nên nhóm vẫn còn với một mục.

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề "Nạp VNDB mô phỏng" | header `DemoPaymentPage` | |
| Hộp ghi chú đỏ hai dòng gạch đầu dòng: "**VNDB (giả lập theo yêu cầu của nghiệp vụ):** Là đồng Stablecoin do bên thứ ba phát hành dùng để thanh toán mua bán WPT Token", "**Chức năng chỉ dùng cho bản PoC:** tạo VNDB không có tiền gửi thật đứng sau. Sẽ tắt khi lên môi trường thật" | `role="note"` trong header | Đúng chữ, chữ đậm như màn thật, `.alert.bad` |
| Thẻ "Nạp vào ví" | `Card` "Nạp vào ví" | |
| Ô "Ví đích" có gợi ý danh sách (Ví người bán, Đã nạp trước đó), placeholder "0x… ví nhà đầu tư đã KYC, hoặc ví người bán" | `wallet`, `datalist` = `knownWallets` (`context.spvWallet` cộng `history[].toWallet`) | |
| Câu "Chỉ nạp được cho ví có trong danh sách nhà đầu tư (đã KYC/whitelist) hoặc ví người bán 0xE1237075…1Cc2." với nút điền ví | `context.spvWallet` (trên mock là `MOCK_VAULT_ADDRESS`, `packages/shared/src/mock-vault.ts`), `short()` | Bấm nút điền ví vào ô. Nút không có khi chưa có context |
| Ô "Số VNDB" | `amount` | Không có hậu tố, như dev. Ô là chuỗi thô, UIUX-01 không đổi ô này sang `AmountInput` |
| "Gợi ý nhanh:" nút "Nhà đầu tư mẫu: 500.000.000", "Ví người bán: 1.000.000.000" | `context.quickAmounts` | Bấm để điền số. Chưa có context thì chỉ còn chữ "Gợi ý nhanh:" |
| Ô vàng "Tối đa một lần: 1.000.000.000 VNDB" | `context && context.maxAmount` (tsx:183) | Câu "Tối đa một lần" chuyển từ dòng gợi ý thành ô vàng cạnh biểu mẫu; ẩn khi chưa có context (đang tải, đọc lỗi), khi đó thẻ biểu mẫu trải cả hàng |
| Nút "Nạp VNDB" (biểu tượng đồng xu) | `submit`, khoá khi `pending` hoặc ô rỗng | Đang gửi: nút khoá, biểu tượng đổi thành vòng quay (`Loader2 animate-spin`, tsx:188), khoảng 0,9 giây |
| Thông báo xanh "Đã nạp … VNDB vào …, số dư mới … VNDB, tx … (CONFIRMED)" | `feedback` tone `success` | Chấm giữa của màn thật đổi thành dấu phẩy |
| Khung đỏ biểu tượng x với câu lỗi máy chủ | `feedback` tone `error` (tsx:58 đọc context lỗi, tsx:89 nạp lỗi, khối tsx:192 đến 208 với `XCircle`) | Nút Nạp mô phỏng: "Dữ liệu không hợp lệ.", "Số tiền vượt trần một lần nạp 1.000.000.000 VNDB (cấu hình).", "Ví … không có trong danh sách nhà đầu tư (chưa KYC/whitelist) và không phải ví người bán." |
| Trạng thái xem thử "Đang tải" | `context === null` | Không ô trần, không gợi ý nhanh, không nút ví người bán, lịch sử báo rỗng (nhánh `!context`) |
| Trạng thái xem thử "Đọc dữ liệu lỗi" | `demoPaymentContextAction` trả lỗi (tsx:58) | Như "Đang tải" cộng khung đỏ; câu mẫu "Lỗi không xác định." là câu mặc định của `toResult` |
| Trạng thái xem thử "Nạp lỗi" | `mintDemoPaymentAction` trả lỗi (tsx:89) | Câu mẫu ví chưa whitelist |
| Thẻ "Lịch sử các lần nạp (mock)": Thời điểm, Ví đích, Số VNDB, Trạng thái, Vai trò | `context.history` (`toLocaleString('vi-VN')`, `short(toWallet)`, `formatAmount(amount)`, `status`, `actorRole`) | Trạng thái giữ mã gốc CONFIRMED/FAILED, tô màu theo nhóm |
| Trạng thái xem thử "Chưa có lần nạp": "Chưa có lần nạp nào trên chuỗi này." | nhánh `!context \|\| history.length === 0` | |
| Trạng thái xem thử "Cờ tắt hoặc vai khác": "Chức năng nạp VNDB mô phỏng không khả dụng", "Chỉ mở khi máy chủ bật cờ ENABLE_DEMO_PAYMENT_MINT và vai hiện tại là Giao dịch viên. Vai hiện tại: TELLER." | `page.tsx` khi `!canMintDemoPayment(role)` | Ví dụ là Giao dịch viên khi cờ tắt; Kiểm soát viên mở thẳng đường dẫn cũng thấy màn này với vai CONTROLLER |

Lớp cục bộ: `<style>` chỉ có `[hidden]`; `style=""` nhỏ cho danh sách trong hộp ghi chú, nút ví người bán và nền đỏ nhạt của màn chặn.

## Thay đổi so với bản chốt (dev mới)
- Hộp ghi chú đổi từ một câu "Chức năng chỉ dùng cho bản trình diễn … (cờ ENABLE_DEMO_PAYMENT_MINT). Chuỗi đang dùng: mock." sang hai dòng gạch đầu dòng ở trên; bỏ phần tên cờ và "Chuỗi đang dùng" trong hộp (UIUX-01 G2, chữ "trình diễn" thành "PoC", commit `ea9fe5f`).
- Menu: nhãn "Nạp VNDB (trình diễn)" thành "Nạp VNDB" (UIUX-01 G1, `ea9fe5f`); mục chuyển từ cuối nhóm "Vận hành" vào nhóm thu gọn "Nghiệp vụ ẩn" (FIX-01 QĐ-5, C2, `9d87e22`). `assets/shell.js` đã có sẵn nhóm này.
- Thêm thanh "Trạng thái xem thử" (Có lịch sử, Chưa có lần nạp, Đang tải, Đọc dữ liệu lỗi, Nạp lỗi, Cờ tắt hoặc vai khác); bản chốt không dựng các trạng thái này.
- Thêm trạng thái đang gửi của nút Nạp (vòng quay), khung lỗi đỏ, ô trần chỉ hiện khi có context; bỏ hậu tố "VNDB" trong ô Số VNDB (dev không có).
- Ví người bán trên mock đổi từ `0x0da94B2c…6861` thành `MOCK_VAULT_ADDRESS` `0xE1237075C0AB261E3FE96E55Bc8fF5eB2aba1Cc2`: trên mock lần phát hành đầu bị ép vào vault (`issuance.service.ts`, `vaultAddressFor`), nên `ledger.spvWallet()` trả địa chỉ vault logic (BE-13). Đổi ở gợi ý danh sách, nút điền ví và lịch sử.
- Breadcrumbs vẫn "Vận hành", "Nạp VNDB" (dev không thêm "Nghiệp vụ ẩn" vào breadcrumbs của màn này, khác `/wallet-binding`).
- Vai được vào không đổi: chỉ Giao dịch viên, và cờ `ENABLE_DEMO_PAYMENT_MINT` phải bật.

## Có đụng backend: Không

## Lệch đã thấy
- Ví gợi ý được gắn nhãn "Ví người bán" là `ledger.spvWallet()` (trên mock là địa chỉ vault `0xE1237075…1Cc2`), không phải ví hồ sơ người bán NB001 (`0x15d34AAf…6A65`). Câu chữ "ví người bán" dễ gây hiểu nhầm.
- Thời điểm trong lịch sử dùng `toLocaleString('vi-VN')` (giờ trước, ngày sau, theo múi giờ máy khách), khác `formatDateTime` ở các màn khác.
- Trạng thái lịch sử và vai trò hiện mã tiếng Anh thô (CONFIRMED, TELLER).
- Breadcrumbs màn này không có "Nghiệp vụ ẩn" trong khi `/wallet-binding` có; menu đặt cả hai cùng nhóm.
- Câu thành công của dev vẫn dùng chấm giữa làm dấu nối.
