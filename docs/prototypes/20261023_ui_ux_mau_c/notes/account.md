# account.html (màn `/account`, Thông tin tài khoản)

Màn thật: `app/src/app/(account)/account/page.tsx` (breadcrumbs "Thông tin tài khoản"; `ProfileWalletCard` chỉ khi `profile.kind === 'CUSTOMER'`), `app/src/app/(account)/layout.tsx`, `app/src/components/pages/account-info.tsx` (`AccountInfoPage`, `Section`, `Field`, `AccountStatusBadge`), `app/src/components/pages/profile-wallet-card.tsx` (`ProfileWalletCard`). Dữ liệu: `lib/bank/account-profile.service.ts` (`SAMPLE_ACCOUNT_PROFILES`, `getProfileWallet`). Vai: cả bốn; nội dung đổi theo `UI.role`.

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề "Thông tin tài khoản", nhãn "Chỉ đọc", câu phụ | header `AccountInfoPage` | |
| **Vai nhân viên** (Giao dịch viên, Kiểm soát viên) | `Section "Thông tin cán bộ"` | |
| Ô xanh: chữ viết tắt tên, Họ và tên, Vai trò | `profile.fullName`, `ROLE_LABELS[profile.role]` | Chữ viết tắt chỉ là hình đại diện suy từ tên, không phải trường |
| Thẻ "Thông tin cán bộ": Mã cán bộ, Trạng thái, Số điện thoại, Thư điện tử, Hoạt động gần nhất | `actorId`, `AccountStatusBadge(status)`, `phone`, `email`, `formatDateTime(lastActiveAt)` | |
| **Vai khách hàng** (Nhà đầu tư, Người bán) | | |
| Ô xanh: chữ viết tắt, Họ và tên / Tên pháp nhân, Mã người dùng, Vai trò | `customer.fullName` (nhãn theo `customerType`), `actorId`, `ROLE_LABELS[role]` | Mã người dùng và Vai trò chuyển từ mục "Thông tin tài khoản" lên ô đầu |
| Thẻ "Thông tin cá nhân" / "Thông tin pháp nhân": Người liên hệ (chỉ tổ chức), Số điện thoại, Thư điện tử, Trạng thái định danh (nhãn), Địa chỉ ví / Ví thanh toán | `Section` thứ nhất: `contactPerson`, `phone`, `email`, `IDENTITY_LABELS[identityStatus]`, `wallet` | Người bán dùng nhãn "Tên pháp nhân", "Ví thanh toán" |
| Thẻ "Thông tin tài khoản": Trạng thái, Ngày tạo, Hoạt động gần nhất | `Section "Thông tin tài khoản"`: `status`, `createdAt`, `lastActiveAt` | |
| Thẻ "Hồ sơ định danh và rủi ro": Loại khách hàng, Trạng thái định danh, Xếp hạng rủi ro (nhãn), Phòng chống rửa tiền, Hạn mức giao dịch mỗi ngày (ô vàng) | `customerType`, `IDENTITY_LABELS`, `RISK_LABELS[riskRating]`, `AML_LABELS[amlStatus]`, `dailyTransactionLimitVnd` | Hạn mức nhấn bằng ô vàng |
| Thẻ "Ví liên kết trên chain Mock (không cần chain)": Ví đang liên kết, Cập nhật lúc | `ProfileWalletCard`, `getProfileWalletAction({ chain })` (`linked`, `effective`, `updatedAt`), `CHAINS[chain].label` | Chỉ vai khách hàng. Trạng thái chưa liên kết hiện "chưa liên kết (đang dùng ví mẫu …)" và không có "Cập nhật lúc" |
| Ô "Địa chỉ ví" (placeholder 0x…), nút "Dùng ví đang kết nối", nút "Lưu", câu giải thích liên kết | `value`/`draft`, `useAccount().address`, `linkProfileWalletAction` | "Dùng ví đang kết nối" khoá vì chain mock không có ví trình duyệt; "Lưu" khoá khi ô rỗng |
| Thông báo "Đã liên kết ví … trên chain mock." / lỗi | `message` | Bấm Lưu để xem |
| Lỗi đọc hồ sơ, "Đang đọc ví liên kết…" | nhánh `!result.ok` ở `page.tsx`, `!result` ở `ProfileWalletCard` | Không dựng |

Lớp cục bộ: `<style>` trong trang: `[hidden]`; `.kv-grid.c3` (3 cột, 2 cột dưới 1180px, 1 cột dưới 520px), `.wide`, `.full` (ô chiếm 2 cột hoặc cả hàng), `.goldtile` (ô hạn mức nền `--gold-tile`), `.who` (bố cục ô xanh). Chỉ dùng biến CSS.

## Thay đổi chỉ là trình bày
Ô xanh nổi bật đầu trang gom tên, mã và vai; các mục còn lại thành thẻ có ô thông tin bo tròn; hạn mức nhấn bằng ô vàng; thẻ ví liên kết trải cả hàng, ô nhập và hai nút cùng một dòng.

## Có đụng backend không
Không.

## Lệch đã thấy
- Hồ sơ mẫu trong `SAMPLE_ACCOUNT_PROFILES` không khớp bộ dữ liệu chung: NDT001 là "Nguyễn Văn An" (bộ chung: Trần Minh Khoa, còn "Nguyễn Văn An" là GDV001), GDV001 là "Lê Minh Cường", KSV001 là "Phạm Thu Dung" (bộ chung: Phạm Thu Hà), NB001 là "Công ty Cổ phần Điện gió An Viên" (bộ chung: Công ty TNHH Điện gió An Viên (SPV)). Trang mẫu theo bộ chung và đổi thư điện tử cho khớp tên (ví dụ `khoa.tran@example.com`, `an.nguyen@bidv.com.vn`); số điện thoại giữ của hồ sơ mẫu.
- Thư điện tử người bán trong hồ sơ mẫu là `contact@diengiobaclieu.vn` (Bạc Liêu) cho dự án An Viên; trang mẫu dùng `contact@diengioanvien.vn`.
- Hai cán bộ GDV001 và KSV001 cùng số điện thoại 024 2220 0588 (tổng đài), giữ nguyên.
- "Hoạt động gần nhất" trong hồ sơ mẫu là 06/10/2026, trước các thao tác hôm nay 23/10/2026 của cùng tài khoản; trang mẫu đặt ngày 23/10/2026. Đây là dữ liệu mẫu tĩnh, chưa đọc từ phiên (AU-01).
- Mục "Trạng thái định danh" xuất hiện hai lần ở màn thật (thẻ thông tin cá nhân và thẻ hồ sơ rủi ro); trang mẫu giữ cả hai.
