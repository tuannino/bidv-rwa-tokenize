# FE-UX-05b: thiết kế

Nguồn hình ảnh: `docs/prototypes/20261101_ui_ux_ban_chot/account.html`, `assets/c.css`. Thành phần: dùng nguyên API của FE-UX-02a đến 04d. Mốc lưới viết bằng `min-[1100px]:`, `min-[640px]:` (riêng lưới ô 3 cột `min-[1180px]:`, QĐ-5); mọi `col-span` kèm tiền tố mốc.

## 1. Bố cục (1440 px)

| Khối | Bố cục |
|---|---|
| Đầu màn | `header`: `h1` "Thông tin tài khoản" và `Badge` "Chỉ đọc" một hàng, `flex flex-wrap items-center gap-2.5` |
| Lưới | `grid gap-6 min-[1100px]:grid-cols-12`; khách hàng 4 thẻ (ô xanh 4, thông tin cá nhân hoặc pháp nhân 8; thông tin tài khoản 4, hồ sơ rủi ro 8); cán bộ 2 thẻ (ô xanh 4, thông tin cán bộ 8); thẻ cùng hàng cao bằng nhau (lưới kéo giãn mặc định) |
| Ô xanh | `Card tone="hl"` có `[--card:var(--tile-hl-chip)] [--border:var(--tile-hl-chip)]` như 04a QĐ-3; `CardContent` `flex flex-col gap-5`: vòng tròn `size-16 rounded-full` có `relative isolate overflow-hidden tile-gold`, chữ `text-xl font-bold`, `aria-hidden="true"`; `dl` `flex flex-wrap gap-x-7 gap-y-4` (cặp tên `basis-full`, nên Mã người dùng và Vai trò chung một hàng), `dt` `text-xs text-muted-foreground` (tile-hl tự đổi màu), tên `dd` `text-2xl font-semibold tracking-tight` |
| Thẻ ô (`tiles`) | `CardTitle` có `CardTitleIcon`; lưới ô `gap-3`, 1 cột, 2 cột từ 640 px, 3 cột từ 1180 px; ô nền nhạt bo 14 px |
| Thẻ dòng (`rows`) | Thông tin tài khoản: dòng kẻ ngăn, nhãn trái, giá trị phải |
| Ô Hạn mức | Rộng 2 cột từ 640 px, `tile-gold`, số `text-[22px]` |
| Ô Ví thanh toán | Cá nhân hết rộng hàng, tổ chức rộng 2 cột (QĐ-4); địa chỉ `font-code break-all` rồi `Badge` |

390 px: một cột theo thứ tự DOM (ô xanh trước); ô trong thẻ một cột; `main` không cuộn ngang.

## 2. Ràng buộc chung

- Không màu cứng, không `*-destructive` (tasks 6b). Vòng tròn chữ viết tắt, ô Hạn mức, chữ phụ và `UnverifiedNote` trong ô xanh đọc được ở Sáng và Tối (kiểm ảnh).
- Không thêm `role` mới, không `aria-label` mới, không heading mới. "Đếm `role`" là đếm `[role="status"]`, `[role="note"]`, `[role="alert"]` trong `main` (như FE-UX-04a), sau khi tải, trước tương tác, bằng mốc (e2e ca 1, ca 2).
- Biểu tượng (`User`, `UserCog`, `ShieldCheck`) chỉ đặt trong `CardTitleIcon` (đã `aria-hidden`).

## 3. Kiểm thử mới

`app/test/fe-ux-05b.test.ts` (môi trường `node`, `renderToStaticMarkup`, `createElement`; hồ sơ lấy bằng `findOwnAccountProfile` như `account-info.test.ts`, biến thể bằng `{ ...profile, field: value }`; viết ký tự cấm bằng escape `\u00b7`, `\u2014`). Nếu `next/link` không dựng được trong môi trường `node` thì `vi.mock('next/link')` thành thẻ `a` giữ `href`, ghi trong checkpoint:

1. **Mã nguồn:** số lời gọi QĐ-2; `account-info.tsx` không có `'use client'`, `Action(`, `useEffect(`, `useState(`, `-destructive`, `'destructive'`, đúng 4 `note={<UnverifiedNote` và đúng 1 `<UnverifiedNote` ngoài `note=` (trong `ProfileHero`), đúng 1 `function ProfileHero` và 2 `<ProfileHero`; `payment-wallet-content.tsx`, `initials.ts` không có `Action(`, `useEffect(`, `useState(`, `wagmi`; `account-wallet.tsx` có `export function PaymentWalletValue`, chứa nguyên văn `<PaymentWalletContent state={useContext(AccountWalletContext)} />`, không còn `text-destructive`; mọi câu `import` từ `@/lib/bank/` trong hai tệp mới là `import type` (kiểm theo câu lệnh, kể cả nhiều dòng: regex `/^import\s+(?!type\b)[^;]*from '@\/lib\/bank\//m` không khớp); không lớp `col-span-` nào trong `account-info.tsx` thiếu tiền tố mốc. Dev xác nhận trên bản mốc các số có sẵn (`getAccountWalletAction(` 1, `useEffect(` 1, `note={<UnverifiedNote` 4), ghi trong checkpoint.
2. **`initialsOf`:** "Nguyễn Văn An" (cá nhân) là "NA"; "Công ty Cổ phần Điện gió An Viên" (tổ chức) là "AV"; "Lê Minh Cường" là "LC"; "Phạm Thu Dung" là "PD"; "đỗ hùng" là "ĐH"; "  An  " là "A"; "" là "".
3. **`AccountInfoPage`:**

| Dữ liệu | Kỳ vọng |
|---|---|
| Bốn hồ sơ mẫu | đúng 1 `data-account-hero`, đúng 1 `<h1`, không `<button`, `<input`, `<textarea`, `<select`, không lớp `bg-destructive`, `text-destructive` (lớp nền của `Badge` có sẵn `aria-invalid:border-destructive` nên không cấm chuỗi `-destructive` trong HTML); ô xanh chứa tên, vai trò (`ROLE_LABELS`), chữ viết tắt QĐ-6 trong phần tử `aria-hidden="true"`, không chứa `role="heading"` |
| Nhà đầu tư | thứ tự `dt` (so chữ sau khi bỏ thẻ con và chữ "unverified") trong ô xanh: Họ và tên, Mã người dùng, Vai trò; các thẻ theo thứ tự tiêu đề Thông tin cá nhân, Thông tin tài khoản, Hồ sơ định danh và rủi ro; `dt` từng thẻ đúng thứ tự: (Số điện thoại, Thư điện tử, Trạng thái định danh, Ví thanh toán), (Trạng thái, Ngày tạo, Hoạt động gần nhất), (Loại khách hàng, Trạng thái định danh, Xếp hạng rủi ro, Phòng chống rửa tiền, Hạn mức giao dịch mỗi ngày); "unverified" đúng 4 lần; ô Hạn mức có lớp `tile-gold`, ô Ví thanh toán có lớp `min-[640px]:col-span-full`; 3 `role="heading"`; ba ô thẻ Thông tin tài khoản có lớp `justify-between`, không lớp `bg-muted/60` |
| Người bán | nhãn "Tên pháp nhân" trong ô xanh; thẻ đầu có "Người liên hệ" đứng trước "Số điện thoại"; ô Ví thanh toán có lớp `min-[640px]:col-span-2`, không `col-span-full`; "Họ và tên" không xuất hiện |
| Giao dịch viên, Kiểm soát viên | `dt` ô xanh: Họ và tên, Vai trò; `dt` thẻ Thông tin cán bộ: Mã cán bộ, Trạng thái, Số điện thoại, Thư điện tử, Hoạt động gần nhất; "unverified" đúng 2 lần; 1 `role="heading"`; không "Ví thanh toán" |
| `status: 'LOCKED'` (một khách hàng, một cán bộ) | "Đã khoá" trong `Badge` lớp `bg-bad-bg` |
| `identityStatus` `APPROVED`, `PENDING`, `REJECTED` | khớp regex `<span[^>]*class="[^"]*bg-ok-bg[^"]*"[^>]*>Đã xác minh</span>` (tương tự `bg-warn-bg` "Đang xác minh", `bg-bad-bg` "Không đạt"); ở thẻ rủi ro cùng chữ là chữ trơn (đúng 1 `Badge` chứa chữ đó) |
| `riskRating` `LOW`, `MEDIUM`, `HIGH` | `span` lớp `bg-secondary` chữ "Thấp", `bg-warn-bg` "Trung bình", `bg-bad-bg` "Cao" (cùng cách regex trên) |

4. **`PaymentWalletContent`:**

| `state` | Kỳ vọng |
|---|---|
| `null` | "Đang đọc…" |
| `{ chain: 'evm', connected: undefined, result: null }` | "Chưa kết nối ví." và `<a` `href="/wallet"` chữ "Kết nối ví" |
| `{ chain: 'mock', connected: undefined, result: null }` | "Đang đọc…" |
| `chain: 'mock'`, `result` lỗi `{ ok: false, code: 'VALIDATION', error: 'Dữ liệu không hợp lệ.' }` | câu lỗi trong phần tử lớp `text-bad-ink`, không `role` |
| `chain: 'mock'`, `result` ok, `wallet: null` | "Chưa kết nối ví.", không `<a` |
| `chain: 'mock'`, `result` ok, ví 42 ký tự, `bound: true` | `data-payment-wallet` chứa ví; `data-wallet-bound="true"` chữ "Đã định danh", lớp `bg-ok-bg` |
| như trên, `bound: false` | `data-wallet-bound="false"` chữ "Ví chưa được định danh", lớp `bg-bad-bg` |

`app/e2e/fe-ux-05b-tai-khoan.spec.ts` (chỉ project mock; không đổi dữ liệu; vai đặt bằng cookie như `account-info.spec.ts`). Chờ tải: `networkidle`; vai khách hàng chờ thêm `[data-payment-wallet]` hiện (dùng được cả bản mốc).

| Ca | Kiểm |
|---|---|
| 1 | Nhà đầu tư 1440 px: đúng một `h1` "Thông tin tài khoản" trong `main`; `[data-account-hero]` chứa "Nguyễn Văn An", "NDT001", "Nhà đầu tư", "NA"; ô xanh và thẻ có heading "Thông tin cá nhân" cùng hàng (lệch đỉnh dưới 4 px, ô xanh bên trái, chiều cao lệch dưới 2 px); thẻ "Thông tin tài khoản" (heading cấp 2) và thẻ "Hồ sơ định danh và rủi ro" cùng hàng, cùng quy tắc; ba ô đầu của thẻ rủi ro cùng hàng (3 cột); ô chứa "Hạn mức giao dịch mỗi ngày" có lớp `tile-gold`; `[data-wallet-bound="true"]` hiện; đếm `role` bằng mốc. 390 px: bốn thẻ một cột, cùng `x`, rộng lệch dưới 2 px, ô xanh trên cùng |
| 2 | Người bán 1440 px: ô xanh chứa "Tên pháp nhân", "Công ty Cổ phần Điện gió An Viên", "NB001", "AV"; thẻ "Thông tin pháp nhân" chứa "Người liên hệ", "Trần Thị Bình". Giao dịch viên 1440 px: ô xanh chứa "Lê Minh Cường", "Giao dịch viên", "LC"; thẻ "Thông tin cán bộ" chứa "GDV001", nằm bên phải ô xanh cùng hàng; không `[data-payment-wallet]`. Đếm `role` hai vai bằng mốc |
| 3 | Bốn vai ở 1440 và 390 px: `main.scrollWidth <= main.clientWidth`; không `console` loại `error`, không `pageerror`, không cảnh báo hydrate |
| 4 | Số action khi mở `/account` (ngữ cảnh mới mỗi vai, cách đếm như `fix-04-noi-du-lieu-that.spec.ts:23-33` cộng chờ 1 giây sau `networkidle`): Nhà đầu tư 1, Người bán 1, Giao dịch viên 0, Kiểm soát viên 0 (`toBe`) |

Nội dung từng vai, ví mock "Đã định danh", màn chỉ đọc do `account-info.spec.ts` phủ.
