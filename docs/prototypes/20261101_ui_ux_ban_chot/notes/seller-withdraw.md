# seller-withdraw.html: Tạo lệnh rút (Người bán)

- Màn thật: `/seller/withdraw`
- Tệp đã đọc (dev `67ece1e`): `app/src/app/(seller)/seller/withdraw/page.tsx`, `app/src/components/pages/seller-withdraw.tsx` (`SellerWithdrawPage`: `payoutDraft`, `openConfirm`, `openContinue`, `settledMessage`, `cancel`, hộp mã một lần dùng chung), `app/src/components/ui/amount-input.tsx`, `app/src/lib/bank/payout-wallet.ts` (`payoutWalletFormatError`, `payoutWalletVaultError`, `PAYOUT_NOT_WHITELISTED`, `checkPayoutWallet`), `app/src/lib/bank/withdraw.service.ts` (trạng thái PAYOUT_*), `app/src/lib/bank/withdraw-limit.ts` (`quoteWithdraw`), `seller-overview.tsx` (`useSellerOverview`, `describePolicy`, `nf`), `seller-transactions.tsx` (`WITHDRAW_STATUS_LABELS`), `packages/shared/src/chains.ts`, `packages/shared/src/mock-vault.ts` (`MOCK_VAULT_ADDRESS`, ví NB001 là ví nhận mặc định trên mock).
- Breadcrumbs: Người bán | Tạo lệnh rút. Vai: seller. Menu sáng: seller-withdraw.html.

## Ánh xạ

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề, câu "Rút VNDB từ vault thanh toán về ví nhận bạn chọn. ..." | header `SellerWithdrawPage` | |
| Số tiền rút (VNDB) | `AmountInput` (`form.amount` là chuỗi chữ số thô, mở màn rỗng) | Hiện dấu chấm khi gõ |
| Câu lỗi "Vượt phần được rút: chỉ rút được tối đa 33.000.000.000 VNDB." | `quote.exceedsLimit` | Hiện thật khi nhập quá |
| Mạng (chỉ đọc) | `chainLabel` | Theo chain đang chọn trên thanh bên |
| Ví nhận (sửa được, điền sẵn ví đang đặt trên vault, placeholder "0x…") | `payoutInput = payoutDraft ?? wallet.payoutWallet` | Trên mock là ví NB001 `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65`. Vault chưa có ví nhận thì ô rỗng, vẫn rút được |
| Nút "Dùng ví đang kết nối" | `chain !== 'mock'`, khoá khi chưa kết nối ví (`useAccount().address`) | Đổi chain sang Hardhat Local hoặc EVM Testnet để thấy; bản xem thử không kết nối ví nên nút khoá, không có `title` như màn thật |
| Câu "Đổi ví nhận: hệ thống gửi thêm một giao dịch đặt ví nhận trước khi rút." | `changesPayout` | Hiện khi ô khác ví đang đặt |
| Câu lỗi dưới ô Ví nhận | `payoutError` từ `checkPayoutWalletAction` | Kiểm khi bấm Tạo lệnh rút, không đạt thì không mở hộp mã: sai dạng, địa chỉ 0, ví mẫu Hardhat trên chain thật, trùng địa chỉ vault, chưa whitelist. Thử `0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec` (chưa whitelist) hoặc địa chỉ vault `0xE1237075C0AB261E3FE96E55Bc8fF5eB2aba1Cc2` |
| Mục đích, Ghi chú | `form.purpose`, `form.note` | Mở màn rỗng, nút Tạo lệnh rút khoá |
| Nút Tạo lệnh rút, khoá khi chưa hợp lệ | `canSubmit` (thêm điều kiện ô Ví nhận không rỗng) | |
| Câu kết quả dưới nút | `feedback`, `settledMessage` | "Đã rút ... VNDB về ví ..."; kết quả của Gửi lệnh rút và Huỷ cũng hiện ở đây |
| Thẻ Hệ thống tính: Số dư VNDB của vault, Phần khoá, Phần được rút, Số tiền nhận được (dòng thứ tư, chữ đậm), rồi câu luật khoá, "Phí ngân hàng ngoài chuỗi: chưa áp dụng (POC)." | `wallet.*`, `quote.receivedVnd`, `describePolicy` | Số tiền nhận được hiện "–" khi ô số tiền rỗng |
| Bảng Yêu cầu rút của tôi, 8 cột: Mã, Số tiền, Ví nhận, Mục đích, Trạng thái, Giao dịch, Thời điểm, Thao tác | `reconcileAndListMyWithdrawRequestsAction`, `title` badge = `reason` | Thao tác rỗng với lệnh không ở PAYOUT_SET. Lý do của `6a0f4c58` (Cần Kiểm soát viên xem) đúng câu máy chủ: "Biên nhận <tx> thành công nhưng không có sự kiện Withdrawn tới <ví> đúng 500000000 VNDB." |
| Hộp "Xác nhận mã một lần": mô tả có số tiền, dòng "Ví nhận: <ví> (đã whitelist)", ô mã, lỗi sáu chữ số, nút Xác nhận | `Dialog`, `dialog.wallet` (ví máy chủ đã chuẩn hoá checksum), `data-testid="otp-payout-wallet"` | Dùng chung cho tạo lệnh và gửi rút lệnh đã đặt ví nhận |
| Tab "Chặn tạo lệnh" | `blocker`: chưa có vault, đang tạm dừng rút | Chỉ hai câu chặn; câu dẫn trong tab nói rõ vault chưa đặt ví nhận không bị chặn |
| Tab "Kết quả lệnh rút" | `settledMessage`: Hoàn tất (ok), PAYOUT_SENT "Đang chờ biên nhận đặt ví nhận; mở lại màn sau ít phút để gửi rút." (ok), trạng thái khác (lỗi); lỗi máy chủ; câu lỗi ví nhận | |
| Tab "Danh sách yêu cầu": dòng mẫu "Đã đặt ví nhận, chờ gửi rút" với nút "Gửi lệnh rút" và "Huỷ"; rỗng; liên kết explorer | `r.status === 'PAYOUT_SET'`, `openContinue`, `cancelWithdrawRequestAction` ("Đã huỷ lệnh rút 9d2e47b1.") | Gửi lệnh rút mở hộp mã với 800.000.000 VNDB và ví `0x71bE…5788`; câu kết quả hiện dưới nút Tạo lệnh rút |
| Tab "Đang tải, lỗi" | "Đang đọc số dư…", `error`, `requests.error` | |

Lớp cục bộ: `dialog.otp`, `.calc`, `.notes`, `.form-foot`, `.fb`, `.tx-link`; dưới 700px hai bảng (`#req-box`, `#ps-box`) thành thẻ theo `data-l`, cột Thao tác rỗng thì ẩn.

## Thay đổi chỉ là trình bày
Bố cục 7/5; danh sách Hệ thống tính có biểu tượng đầu dòng; các câu chặn, kết quả, rỗng gom vào thẻ có tab.

## Thay đổi so với bản chốt (dev mới)
- Ví nhận do Người bán chọn ngay ở lệnh: ô sửa được (bỏ "đặt bởi Kiểm soát viên", bỏ khoá), câu đổi ví nhận, nút "Dùng ví đang kết nối" ở chain khác mock, máy chủ kiểm ví trước khi mở hộp mã, hộp mã hiện ví nhận (FIX-01 `9d87e22`, G1, G2, G5).
- Vault chưa có ví nhận không còn chặn tạo lệnh (FIX-01 `9d87e22`, G2b).
- Bảng thêm cột "Thao tác" với "Gửi lệnh rút" và "Huỷ" cho lệnh đã đặt ví nhận; câu kết quả mới khi chờ biên nhận đặt ví nhận; bốn nhãn trạng thái mới (FIX-01 `9d87e22`, G4, G6).
- Câu phụ đổi thành "... về ví nhận bạn chọn" (FIX-01 `9d87e22`).
- Ô Số tiền rút hiện dấu chấm khi gõ (UIUX-01 `ea9fe5f`, A1).

## Có đụng backend: Không

## Lệch đã thấy
- Kết quả không phải Hoàn tất hay PAYOUT_SENT hiện tông lỗi dù chưa chắc là lỗi.
- Lý do trạng thái (`reason`) chỉ có trong `title` của badge, không thấy trên điện thoại.
- Ví nhận rút gọn 10…6 ở màn này nhưng 6…4 ở Danh sách giao dịch.
- Viết "POC" ở màn này, chỗ khác viết "PoC".
- Ví mẫu Hardhat (kể cả ví NB001) sẽ bị máy chủ từ chối làm ví nhận trên mọi chain khác mock và hardhat-local (`SAMPLE_WALLET_CHAINS`, gồm EVM Testnet và Stellar); bản xem thử kiểm đúng như vậy.

## Sửa sau rà soát độc lập
- Địa chỉ vault trên mock là `MOCK_VAULT_ADDRESS` `0xE1237075C0AB261E3FE96E55Bc8fF5eB2aba1Cc2`; ví nhận mặc định là ví NB001, các lệnh rút mẫu đổi ví nhận theo.
- Biểu mẫu mở rỗng, nút khoá; bỏ hậu tố trong ô số tiền và `title` của nút Dùng ví đang kết nối; Số tiền nhận được về dòng thứ tư; câu lý do badge theo đúng câu máy chủ; kết quả Gửi lệnh rút, Huỷ hiện dưới nút Tạo lệnh rút; hộp mã hiện ví dạng checksum.
