# account.html (màn `/account`, Thông tin tài khoản)

Màn thật: `app/src/app/(account)/account/page.tsx` (breadcrumbs "Thông tin tài khoản"; vai khách hàng bọc `AccountWalletProvider`), `app/src/app/(account)/layout.tsx`, `app/src/components/pages/account-info.tsx` (`AccountInfoPage`, `Section`, `Field`, `AccountStatusBadge`), `app/src/components/pages/account-wallet.tsx` (`AccountWalletProvider`, `PaymentWalletValue`), `app/src/app/actions/account.ts` (`getAccountWalletAction`). `profile-wallet-card.tsx` đã bị xoá ở dev. Dữ liệu: `lib/bank/account-profile.service.ts` (`SAMPLE_ACCOUNT_PROFILES`, `getAccountWallet`), `lib/bank/wallet-owner.ts` (`resolveWalletOwner`), `lib/role-labels.ts`, `packages/shared/src/sample-wallets.json`. Đã đọc `docs/fix-01-vi-ket-noi/requirements.md` (F1 tới F4, QĐ-2, QĐ-9) và `docs/uiux-01-chinh-sua-giao-dien/requirements.md` (mục F). Vai: cả bốn; nội dung đổi theo `UI.role`.

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề "Thông tin tài khoản", nhãn "Chỉ đọc", câu phụ | header `AccountInfoPage` | |
| **Vai nhân viên** (Giao dịch viên, Kiểm soát viên) | `Section "Thông tin cán bộ"` | Không có ví thanh toán; thanh trạng thái xem thử có hai tab: Có hồ sơ, Lỗi đọc hồ sơ |
| Ô xanh: chữ viết tắt tên, Họ và tên, Vai trò | `profile.fullName`, `ROLE_LABELS[profile.role]` | Họ và tên, Vai trò dời từ thẻ "Thông tin cán bộ" lên ô đầu (trình bày đã duyệt ở bản chốt). Chữ viết tắt chỉ là hình đại diện suy từ tên |
| Thẻ "Thông tin cán bộ": Mã cán bộ, Trạng thái, Số điện thoại, Thư điện tử, Hoạt động gần nhất | `actorId`, `AccountStatusBadge(status)`, `phone`, `email`, `formatDateTime(lastActiveAt)` | |
| **Vai khách hàng** (Nhà đầu tư, Người bán) | | |
| Ô xanh: chữ viết tắt, Họ và tên / Tên pháp nhân, Mã người dùng, Vai trò | `customer.fullName` (nhãn theo `customerType`), `actorId`, `ROLE_LABELS[role]` | Họ tên, Mã người dùng và Vai trò dời từ hai mục "Thông tin cá nhân/pháp nhân" và "Thông tin tài khoản" lên ô đầu: cách trình bày đã duyệt ở bản chốt, giữ nguyên, không bớt trường |
| Thẻ "Thông tin cá nhân" / "Thông tin pháp nhân": Người liên hệ (chỉ tổ chức), Số điện thoại, Thư điện tử, Trạng thái định danh (nhãn) | `Section` thứ nhất: `contactPerson`, `phone`, `email`, `IDENTITY_LABELS[identityStatus]` | |
| Ô "Ví thanh toán" (cả hai vai khách hàng): địa chỉ ví kèm nhãn "Đã định danh" (xanh) hoặc "Ví chưa được định danh" (đỏ) | `PaymentWalletValue`: `getAccountWalletAction({ chain, wallet })` trả `{ wallet, bound }` | Chain `mock`: ví mẫu của hồ sơ, luôn "Đã định danh". Chain khác: ví đang kết nối (wagmi), nhãn theo `resolveWalletOwner` |
| Trạng thái xem thử "Ví chưa được định danh" | `bound === false` | Ví mẫu `0x23618e81…1E8f` là ví đang kết nối chưa được gắn cho hồ sơ |
| Trạng thái xem thử "Chưa kết nối ví": "Chưa kết nối ví. Kết nối ví" (liên kết tới `wallet.html`) | nhánh `chain !== 'mock' && !connected` | Liên kết là thẻ `<a>`, không phải nút (F4) |
| Trạng thái xem thử "Đang đọc": "Đang đọc…" | nhánh `!state.result` | |
| Trạng thái xem thử "Lỗi đọc ví": câu lỗi đỏ, ví dụ "Dữ liệu không hợp lệ." | nhánh `!state.result.ok` (`account-wallet.tsx:76`) | Câu mẫu là câu `VALIDATION` của `getAccountWallet` |
| Nhánh "Chưa kết nối ví." không kèm liên kết | `!wallet` sau khi action trả `ok` (`account-wallet.tsx:78`) | Không dựng: máy chủ chỉ trả `wallet: null` khi không nhận ví, mà trường hợp chain khác `mock` chưa kết nối đã rơi vào nhánh có liên kết ở trên; khoá `chain\|ví` loại kết quả cũ, nên nhánh này không xảy ra trong luồng thường |
| Thẻ "Thông tin tài khoản": Trạng thái, Ngày tạo, Hoạt động gần nhất | `Section "Thông tin tài khoản"` | |
| Thẻ "Hồ sơ định danh và rủi ro": Loại khách hàng, Trạng thái định danh, Xếp hạng rủi ro (nhãn), Phòng chống rửa tiền, Hạn mức giao dịch mỗi ngày (ô vàng) | `customerType`, `IDENTITY_LABELS`, `RISK_LABELS`, `AML_LABELS`, `formatAmount(dailyTransactionLimitVnd)` | |
| Trạng thái xem thử "Lỗi đọc hồ sơ" (mọi vai): chỉ tiêu đề "Thông tin tài khoản" và câu lỗi đỏ "Không tìm thấy hồ sơ NDT001 cho vai INVESTOR." | nhánh `!result.ok` ở `page.tsx` (dòng 24 đến 29), câu từ `getOwnAccountProfile` | Ẩn nhãn "Chỉ đọc", câu phụ và mọi thẻ như màn thật. Vai nhân viên có thanh xem thử hai tab: Có hồ sơ, Lỗi đọc hồ sơ |

Lớp cục bộ: `<style>` trong trang: `[hidden]`; `.kv-grid.c3`, `.wide`, `.full`, `.goldtile`, `.who`. `style=""` nhỏ cho hàng ví và nhãn.

## Thay đổi so với bản chốt (dev mới)
- Bỏ hẳn thẻ "Ví liên kết trên chain …" (ô "Địa chỉ ví", nút "Dùng ví đang kết nối", nút "Lưu", "Cập nhật lúc", câu giải thích liên kết): FIX-01 F1, commit `9d87e22` (xoá `profile-wallet-card.tsx`, bỏ `linkProfileWalletAction`). Khách hàng không tự khai ví nữa; Giao dịch viên gắn ví ở màn Định danh ví.
- Ô ví trong thẻ thông tin cá nhân/pháp nhân đổi nhãn thành "Ví thanh toán" cho cả Nhà đầu tư và Người bán (trước: Nhà đầu tư là "Địa chỉ ví"), không hiện thẳng ví mẫu tĩnh nữa mà hiện ví theo chain và ví đang kết nối kèm nhãn định danh: UIUX-01 (commit `ea9fe5f`, `account-wallet.tsx` ra đời) rồi FIX-01 F2, F3 (commit `9d87e22`).
- Thanh "Trạng thái xem thử" của vai khách hàng có 6 tab (gồm Ví đã định danh, Ví chưa được định danh, Chưa kết nối ví, Đang đọc, Lỗi đọc ví, Lỗi đọc hồ sơ); vai nhân viên có 2 tab: Có hồ sơ, Lỗi đọc hồ sơ.
- Ví mẫu Người bán sửa thành `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` theo `sample-wallets.json` (bản chốt ghi `0x3C44…93BC`, không phải ví mẫu NB001), để khớp màn Định danh ví và nhãn "Đã định danh" trên mock.
- Nhãn vai dùng chung `ROLE_LABELS` (`lib/role-labels.ts`), chữ không đổi.
- Thêm trạng thái lỗi: "Lỗi đọc ví" (khách hàng) và "Lỗi đọc hồ sơ" (mọi vai).
- Hồ sơ mẫu lấy đúng `SAMPLE_ACCOUNT_PROFILES` của dev cho cả bốn vai (trước đây theo bộ dữ liệu chung): NDT001 Nguyễn Văn An, an.nguyen@example.com; NB001 Công ty Cổ phần Điện gió An Viên, contact@diengiobaclieu.vn; GDV001 Lê Minh Cường, cuong.lm@bidv.com.vn; KSV001 Phạm Thu Dung, dung.pt@bidv.com.vn; "Hoạt động gần nhất" 06/10/2026 08:30:00, 08:15:00, 08:45:00, 08:40:00 (giờ Việt Nam của giá trị UTC trong dev). `wallet-binding.html` dùng cùng tên.

## Có đụng backend: Không

## Lệch đã thấy
- Tên hồ sơ của dev khác bộ dữ liệu chung mà nhiều trang khác của bản xem thử đang dùng (ví dụ Trần Minh Khoa cho NDT001, Phạm Thu Hà cho KSV001, Công ty TNHH Điện gió An Viên (SPV) cho NB001); màn này và `wallet-binding.html` nay theo dev, các trang khác chưa đổi.
- Thư điện tử người bán trong hồ sơ mẫu là `contact@diengiobaclieu.vn` (Bạc Liêu) cho dự án An Viên; giữ đúng dev.
- Hai cán bộ GDV001 và KSV001 cùng số điện thoại 024 2220 0588 (tổng đài), giữ nguyên.
- "Hoạt động gần nhất" là dữ liệu tĩnh 06/10/2026, cũ hơn các thao tác mẫu ở những màn khác; chưa đọc từ phiên (AU-01).
- "Trạng thái định danh" (hồ sơ KYC) xuất hiện hai lần, và nay đứng cạnh nhãn "Đã định danh" của ví (định danh ví trên chuỗi): hai khái niệm khác nhau dùng chữ gần giống, dễ nhầm.
- Trên `mock`, ô ví luôn "Đã định danh" vì máy chủ trả `bound: true` cho ví mẫu mà không đọc bảng gắn.
