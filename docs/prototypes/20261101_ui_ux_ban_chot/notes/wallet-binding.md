# wallet-binding.html (màn `/wallet-binding`, Định danh ví)

Màn thật: `app/src/app/(ops)/wallet-binding/page.tsx` (breadcrumbs "Vận hành", "Nghiệp vụ ẩn", "Định danh ví"; chặn bằng `can(role, 'investor:whitelist')`), `app/src/components/pages/wallet-binding.tsx` (`WalletBindingPage`), `app/src/app/actions/wallet-binding.ts` (`bindProfileWalletAction`, `listWalletBindingsAction`). Đã đọc thêm `lib/bank/wallet-binding.service.ts` (`bindProfileWallet`, `listWalletBindings`, `WALLET_BINDING_LIST_LIMIT = 200`), `lib/bank/account-profile.service.ts` (`listCustomerProfiles`), `lib/role-labels.ts`, `lib/ledger/address.ts` (câu lỗi địa chỉ), `components/layout/nav-config.ts` (`WALLET_BINDING_NAV_ITEM`, `withHiddenOps`), `components/layout/app-layout.tsx`, `lib/rbac/permissions.ts`, `docs/fix-01-vi-ket-noi/requirements.md` (B1 tới B4, C1 tới C3, QĐ-4, QĐ-5). Vai: Giao dịch viên (`data-roles="teller"`).

Menu: nhóm thu gọn "Nghiệp vụ ẩn" (đặt sau nhóm "Vận hành", trước "Tài khoản"), mục "Định danh ví", biểu tượng `BadgeCheck` (bản xem thử: `badgecheck`), phím tắt I. Điều kiện hiện: `can(role, 'investor:whitelist')`, quyền này chỉ vai `TELLER` có; không phụ thuộc cờ cấu hình nào. Nhóm mặc định thu gọn, tự mở khi đang ở màn này.

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề "Định danh ví", câu phụ "Ngân hàng định danh ví trên chuỗi và gắn ví cho hồ sơ khách hàng. Chỉ ví đã gắn mới xem được dữ liệu tài khoản và đặt lệnh. Chain đang xem: mock." | header `WalletBindingPage`, `useSelectedChain()` | Tên chain theo ô chọn chain (`data-chain-label`) |
| Thẻ "Gắn ví cho hồ sơ" | `Card` "Gắn ví cho hồ sơ", form `aria-label="Biểu mẫu định danh ví"` | Ô Hồ sơ rộng 16rem, ô ví giãn, như màn thật |
| Ô chọn "Hồ sơ": "NDT001, Nguyễn Văn An, Nhà đầu tư", "NB001, Công ty Cổ phần Điện gió An Viên, Người bán" | `data.profiles` (`listCustomerProfiles`), `ROLE_LABELS` | Mặc định hồ sơ đầu. Khoá và rỗng khi chưa có danh sách (đang tải, lỗi) |
| Ô "Địa chỉ ví" (placeholder `0x…`) | `wallet` | Thêm biểu tượng ví trong ô (trình bày) |
| Nút "Định danh và gắn ví" (biểu tượng huy hiệu) | `submit`, khoá khi ô ví rỗng hoặc chưa có hồ sơ | Màn thật hiện vòng quay khi đang gửi; bản xem thử trả kết quả ngay |
| Thông báo thành công "Đã định danh và gắn ví … cho hồ sơ … (…). Mã giao dịch định danh: 0x…." hoặc "… Ví đã whitelist từ trước, không gửi giao dịch."; "Ví đã được gắn từ trước cho ví … cho hồ sơ …" | `feedback` từ `bindProfileWalletAction` (`created`, `txHash`) | Giữ đúng câu ghép của màn thật. Thành công thì thêm dòng mới lên đầu bảng và xoá ô ví |
| Thông báo lỗi: "Địa chỉ ví không hợp lệ: "…". Cần dạng 0x + 40 ký tự hex.", "Ví đã được định danh cho hồ sơ khác." | `result.error` (`InvalidAddressError`, `TAKEN_MESSAGE`) | Các lỗi máy chủ khác (KYC từ chối, giao dịch định danh chưa có biên nhận, ví mẫu công khai trên chain thật) không mô phỏng |
| Thẻ "Ví đã định danh": bảng Ví, Hồ sơ, Vai, Người gắn, Lúc gắn | `data.rows` (`wallet`, `actorId`, `profileName`, `ROLE_LABELS[role]`, `boundBy`, `formatDateTime(boundAt)`) | Mới nhất trước (`boundAt DESC`) như store. Ví hiện đủ địa chỉ |
| Câu dưới bảng "Trên mock và hardhat-local, ví mẫu của hồ sơ được coi là đã định danh dù không có trong bảng." | đoạn cuối `CardContent` | |
| "Hiện 200 ví gần nhất" | `data.truncated` | Không dựng (dữ liệu mẫu ít hơn 200 dòng) |
| Trạng thái xem thử "Chưa có ví": "Chưa có ví nào được gắn trên chain này." | nhánh `data.rows.length === 0` | |
| Trạng thái xem thử "Đang tải": "Đang tải…" | nhánh `data === null` | Ô chọn hồ sơ khoá |
| Trạng thái xem thử "Lỗi": câu lỗi máy chủ | nhánh `fresh.error` | Câu mẫu "Lỗi không xác định." là câu mặc định của `toResult` |
| Trạng thái xem thử "Vai khác mở đường dẫn": "Chức năng định danh ví không khả dụng", "Chỉ Giao dịch viên định danh và gắn ví cho hồ sơ khách hàng. Vai hiện tại: CONTROLLER." | `page.tsx` khi thiếu `investor:whitelist` | Khu vực `(ops)` đã chặn Nhà đầu tư và Người bán, nên chỉ Kiểm soát viên gặp màn này |

Dữ liệu mẫu: hồ sơ đúng `SAMPLE_ACCOUNT_PROFILES` của dev (NDT001 Nguyễn Văn An, NB001 Công ty Cổ phần Điện gió An Viên), khớp `account.html`; ví mẫu theo `packages/shared/src/sample-wallets.json` (NDT001 `0x70997970…79C8`, NB001 `0x15d34AAf…6A65`). Ba dòng gắn mẫu: `0x9965507D…A4dc` và `0x976EA740…0aa9` cho NDT001, `0x15d34AAf…6A65` cho NB001, người gắn GDV001.

Lớp cục bộ: `<style>` có `[hidden]` và lưới `#bind-grid` (16rem cộng phần còn lại, một cột dưới 640px). `style=""` nhỏ cho nền đỏ nhạt của màn chặn và lề câu dưới bảng.

## Thay đổi so với bản chốt (dev mới)
- Màn mới, chưa có trong bản chốt. Dựng theo FIX-01 B1 tới B4, commit `9d87e22`.
- Mục menu "Định danh ví" trong nhóm thu gọn "Nghiệp vụ ẩn" (FIX-01 C1, C2, commit `9d87e22`); `assets/shell.js` đã có sẵn mục này với biểu tượng `badgecheck`.

## Có đụng backend: Không
Màn chỉ đọc hai action có sẵn ở dev.

## Lệch đã thấy
- Câu "Ví đã được gắn từ trước cho ví … cho hồ sơ …" của màn thật lặp chữ "cho" (ghép chuỗi `created ? 'Đã định danh và gắn' : 'Ví đã được gắn từ trước cho'`); bản xem thử giữ đúng câu.
- Tên hồ sơ theo dev nên khác bộ dữ liệu chung mà các trang khác của bản xem thử còn dùng (Trần Minh Khoa, Công ty TNHH Điện gió An Viên (SPV)); xem ghi chú `account.md`.
