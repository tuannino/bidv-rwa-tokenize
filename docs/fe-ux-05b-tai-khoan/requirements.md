# FE-UX-05b: Thông tin tài khoản (`/account`)

| | |
|---|---|
| Nhánh | `feat/fe-ux-05b-tai-khoan` từ `release/ui-v2` mới nhất (@ `11160f1` hoặc sau: đã gồm PR #96 FE-UX-04d; nếu PR #97 FE-UX-05a đã merge thì từ head đó). Nếu PR khác (05a) merge vào `release/ui-v2` trong lúc làm: rebase lên head mới, chạy lại TOÀN BỘ kiểm thử mục 5 trên nhánh đã rebase và đo lại TOÀN BỘ mốc (JS, CSS, action, lỗi, `role`, ảnh trước) từ merge-base mới; checkpoint ghi merge-base đã dùng và log của lần chạy sau rebase |
| PR | Một PR, **base `release/ui-v2`**, KHÔNG vào `dev`. Không tự merge |
| Loại | Frontend thuần. Không `lib/`, `app/actions`, `app/api`, route `app/src/app/**` (gồm `app/(account)/account/page.tsx`); không thêm gói npm; không sửa `components/ui/*`, `components/layout/*`, `globals.css` (thiếu gì thì báo) |
| Mức kiểm thử | **B**, phạm vi ở mục 5 |
| Tách task | FE-UX-05 tách lại thành 3 phần (thay cách chia ở spec 05a): **05a** Tổng quan và Danh sách giao dịch của Người bán (đang làm); **05b** Thông tin tài khoản (spec này); **05c** Tạo lệnh rút của Người bán (`/seller/withdraw`), viết sau khi 05a merge vì cần `WITHDRAW_STATUS_TONES`, `components/seller/format.ts` của 05a |
| Song song | Song song được với FE-UX-05a (khác tệp mã). Các PR cùng sửa `docs/USER_GUIDE.md`, `.kiro/task-status.json`: PR merge sau tự gộp, mỗi mã ở đúng một danh sách. Tệp tạm của lệnh kiểm dùng tên riêng (tasks bước 6) |
| Nguồn | Kế hoạch 03/11; `docs/20261101_UI_UX_BAN_GIAO_SUPERVISOR.md` mục 4.4, 6, 7.1, 8; bản chốt `account.html`, `assets/c.css`; `notes/account.md` |
| Thứ tự ưu tiên khi nguồn xung đột | Spec này, rồi kế hoạch 03/11, rồi mã `release/ui-v2` @ merge-base, rồi tài liệu bàn giao, `docs/USER_GUIDE.md` và notes, cuối cùng là bản xem thử |

## 1. Mục tiêu

Vẽ lại màn Thông tin tài khoản theo bản chốt cho cả bốn vai: một ô xanh đầu màn (chữ viết tắt, tên, mã, vai trò) và các thẻ thông tin dạng ô, bằng thành phần dùng chung (`Card` sắc `hl`, `CardTitleIcon`, `Badge` sắc). Không đổi câu chữ, giá trị, nhãn trạng thái, điều kiện hiện, lời gọi server action, số action khi mở màn. Trường chỉ được DỜI chỗ đúng QĐ-4 (bản chốt đã duyệt, không bớt trường).

Không làm: câu phụ dưới tiêu đề (test cấm: `uiux-02-dau-man.test.ts:194`, `uiux-02-dau-man.spec.ts:152`); thanh "Trạng thái xem thử" (chỉ có ở bản xem thử); ảnh tua-bin nền ô xanh (`scene-wrap`) và hiệu ứng (FE-UX-08); nhánh lỗi đọc hồ sơ ở `page.tsx` (tệp route, còn `text-destructive`: ghi nợ cho FE-UX-06); thẻ `<wbr>` sau `@` của thư điện tử (bản chốt có; ở đây ô dùng `[overflow-wrap:anywhere]`).

## 2. Quyết định (QĐ)

- **QĐ-1. Không đổi logic.** Giữ nguyên `AccountWalletProvider` (state, effect, khoá `chain|ví`, `useAccount`, `useSelectedChain`), `IDENTITY_LABELS`, `RISK_LABELS`, `AML_LABELS`, `formatAmount`, `formatDateTime`, `ROLE_LABELS`, mọi chữ. `AccountInfoPage` vẫn là thành phần máy chủ (không `'use client'`), nhận `{ profile }`, phần tử gốc giữ `data-account-role={profile.role}`. Diff chỉ là vỏ JSX, `className`, việc dời ở QĐ-3, QĐ-4.
- **QĐ-2. Số action khi mở màn giữ nguyên:** Nhà đầu tư, Người bán 1 (`getAccountWalletAction`); Giao dịch viên, Kiểm soát viên 0. Trong mã: `account-wallet.tsx` 1 `getAccountWalletAction(`, 1 `useEffect(`; `account-info.tsx` và tệp mới ở QĐ-3 không có `Action(`, `useEffect(`, `useState(` (unit nhóm 1). Số khi mở đo lúc chạy bằng e2e ca 4.
- **QĐ-3. Tách phần dựng ô ví (commit riêng, dời NGUYÊN VĂN).** Các nhánh "Chưa kết nối ví." kèm liên kết, "Đang đọc…", lỗi, "Ví chưa được định danh" không dựng được trên mock, nên tách phần dựng để unit test được. Tạo thư mục `components/account/`:
  - `payment-wallet-content.tsx`: `interface AccountWalletState` (`account-wallet.tsx:21-27`, đổi thành `export interface`, chú thích giữ nguyên) và `export function PaymentWalletContent({ state }: { state: AccountWalletState | null })` mang NGUYÊN thân `PaymentWalletValue` (`:64-86`, tức toàn bộ thân trừ dòng `:63` `const state = useContext(AccountWalletContext);`). Không cần `'use client'` (không dùng hook), nhưng vì được `account-wallet.tsx` (`'use client'`) nhập nên tệp vẫn nằm trong cây mã máy khách và vào gói JS của `/account`: không suy ra tệp chỉ chạy ở máy chủ, vẫn đo gói `/account` sau khi tách (QĐ-10). Chỉ nhập `Link`, `Badge`, `import type` `ChainKey`, `AccountWalletView`, `Result`.
  - `account-wallet.tsx`: `PaymentWalletValue()` còn đúng `return <PaymentWalletContent state={useContext(AccountWalletContext)} />;`, giữ export và chú thích; nhập `AccountWalletState` (kiểu) và `PaymentWalletContent` từ tệp mới; bỏ import không còn dùng (`Link`, `Badge`, `ChainKey`; giữ `AccountWalletView`, `Result` vì `useState` còn dùng).
  - Phép sửa được phép, ngoài ra không gì khác: vỏ hàm, import, `export`. Checkpoint dán đoạn trước và sau. Commit sau mới đổi kiểu.
- **QĐ-4. Bố cục và trường (theo bản chốt, `notes/account.md`).** Lưới `grid gap-6 min-[1100px]:grid-cols-12`. Mọi chữ, giá trị, điều kiện hiện giữ; trường chỉ đổi chỗ như sau:
  - **Ô xanh**: MỘT hàm cục bộ `ProfileHero({ profile }: { profile: AccountProfileView })` định nghĩa một lần trong `account-info.tsx`, gọi ở cả hai nhánh. Dựng `Card tone="hl"`, thuộc tính `data-account-hero`, `min-[1100px]:col-span-4`; chữ viết tắt (QĐ-6) trong vòng tròn 64 px nền vàng, `aria-hidden="true"`; rồi `dl` `flex flex-wrap gap-x-7 gap-y-4`, mỗi cặp là một `div` con TRỰC TIẾP của `dl` (`dt` rồi `dd`), cặp tên có `basis-full`:
    - Khách hàng: "Họ và tên" hoặc "Tên pháp nhân" (theo `customerType` như hiện tại), giá trị `fullName` chữ lớn; "Mã người dùng" (`font-code`); "Vai trò".
    - Cán bộ: "Họ và tên"; "Vai trò".
    - `UnverifiedNote` (QĐ-7) nằm TRONG `dt` của cặp tên, sau chữ nhãn (`dt` là `flex items-center gap-1.5`).
    - Tên KHÔNG là heading (giữ danh sách heading như cũ, `account-info.spec.ts` dùng `getByRole('heading')` chế độ strict).
  - **Khách hàng**, theo thứ tự DOM sau ô xanh:
    - Thẻ "Thông tin cá nhân" hoặc "Thông tin pháp nhân" (`min-[1100px]:col-span-8`, biểu tượng `User`): Người liên hệ (chỉ khi có), Số điện thoại, Thư điện tử, Trạng thái định danh (`Badge`), Ví thanh toán (cá nhân: hết hàng `full`; tổ chức: rộng 2 cột `wide`, vì có thêm ô Người liên hệ, như bản chốt `account.html:130`). Bỏ "Họ và tên"/"Tên pháp nhân" (đã lên ô xanh).
    - Thẻ "Thông tin tài khoản" (`min-[1100px]:col-span-4`, biểu tượng `UserCog`), dạng dòng (QĐ-5): Trạng thái, Ngày tạo, Hoạt động gần nhất. Bỏ "Mã người dùng", "Vai trò" (đã lên ô xanh).
    - Thẻ "Hồ sơ định danh và rủi ro" (`min-[1100px]:col-span-8`, biểu tượng `ShieldCheck`): Loại khách hàng, Trạng thái định danh (chữ), Xếp hạng rủi ro (`Badge`), Phòng chống rửa tiền, Hạn mức giao dịch mỗi ngày (ô rộng 2 cột, nền vàng QĐ-5).
  - **Cán bộ:** thẻ "Thông tin cán bộ" (`min-[1100px]:col-span-8`, biểu tượng `UserCog`): Mã cán bộ, Trạng thái, Số điện thoại, Thư điện tử (ô rộng 2 cột), Hoạt động gần nhất (ô thường; hiện là ô rộng). Bỏ "Họ và tên", "Vai trò" (đã lên ô xanh).
  - Đầu màn: `h1` "Thông tin tài khoản" đổi lớp sang `text-2xl font-semibold tracking-tight`; nhãn "Chỉ đọc" giữ `Badge variant="outline"`.
- **QĐ-5. `Section`, `Field`:**
  - `Section` nhận thêm `icon` (đặt `CardTitleIcon` TRONG `CardTitle`, trước chữ; giữ `role="heading" aria-level={2}`, chữ tiêu đề rồi `note` như hiện tại) và `layout: 'tiles' | 'rows'` (mặc định `tiles`). Bỏ `border-b` ở `CardHeader`.
  - `layout` chỉ quyết định lớp của `dl`; `Field` nhận prop riêng `variant?: 'tile' | 'row'` (mặc định `tile`), ba `Field` của thẻ Thông tin tài khoản truyền `variant="row"` (không dùng context: `AccountInfoPage` là thành phần máy chủ).
  - `tiles`: `dl` lưới `grid gap-3 min-[640px]:grid-cols-2 min-[1180px]:grid-cols-3` (bản chốt đổi 3 cột ở 1180 px); `Field` `tile` là ô `min-w-0 rounded-[14px] bg-muted/60 px-4 py-3.5` (bản chốt bo 18 px; giữ 14 px như các ô đã làm từ 04a, lệch có chủ đích), `dt` `text-xs text-muted-foreground`, `dd` `mt-1 text-base font-medium [overflow-wrap:anywhere]`.
  - `rows`: `dl` `divide-y divide-border`; `Field` `row` là `div` `flex items-baseline justify-between gap-4 py-2.5`, `dt` `shrink-0 text-sm text-muted-foreground`, `dd` `min-w-0 text-right font-medium [overflow-wrap:anywhere]`.
  - `Field` thay `wide?: boolean` bằng `span?: 'wide' | 'full'`: `wide` là `min-[640px]:col-span-2`, `full` là `min-[640px]:col-span-full`; thêm `highlight?: boolean` dùng lớp `relative isolate overflow-hidden tile-gold` thay nền nhạt, `dd` chữ `text-[22px] tabular-nums` (`tile-gold` vẽ `::before` tuyệt đối, cần ô định vị và cắt tràn như 05a QĐ-5).
  - Mọi `col-span` kèm tiền tố mốc.
- **QĐ-6. Chữ viết tắt (hàm mới, thuần):** `components/account/initials.ts` export `initialsOf(name: string, organization: boolean): string`: tách từ theo khoảng trắng (bỏ rỗng); tổ chức lấy chữ đầu của HAI TỪ CUỐI, cá nhân lấy chữ đầu của TỪ ĐẦU và TỪ CUỐI; một từ thì một chữ; rỗng thì chuỗi rỗng; viết hoa bằng `toLocaleUpperCase('vi-VN')`; chữ đầu lấy bằng `Array.from(word)[0]`. Kết quả với hồ sơ mẫu: NA, AV, LC, PD (khớp bản chốt). `organization` là `customerType === 'ORGANIZATION'`; cán bộ là `false`.
- **QĐ-7. Ghi chú `unverified`:** dữ liệu ô xanh là hồ sơ mẫu, nên ô xanh có một `UnverifiedNote` cạnh nhãn tên (`title` "Hồ sơ mẫu, chưa có kho người dùng"; viết `<UnverifiedNote` trực tiếp, KHÔNG qua `note=`). Bốn `note={<UnverifiedNote` ở bốn thẻ giữ nguyên (`fix-04-noi-du-lieu-that.test.ts:281` đếm đúng 4).
- **QĐ-8. Sắc nhãn (chữ giữ):** Trạng thái tài khoản `ACTIVE` `ok`, `LOCKED` `bad`; Trạng thái định danh (thẻ thứ nhất) `APPROVED` `ok`, `PENDING` `warn`, `REJECTED` `bad`; Xếp hạng rủi ro `LOW` `secondary`, `MEDIUM` `warn`, `HIGH` `bad`; ví `bound` `ok`, không `bad`; lỗi đọc ví `text-bad-ink` thay `text-destructive` (vẫn không `role`). Ba ánh xạ đầu là BA bảng riêng, mỗi bảng đúng các khoá của loại mình: `ACCOUNT_STATUS_TONES: Record<AccountStatus, BadgeVariant>`, `IDENTITY_TONES: Record<IdentityStatus, BadgeVariant>`, `RISK_TONES: Record<RiskRating, BadgeVariant>`, đặt cạnh các bảng nhãn, với kiểu khai báo cục bộ `type BadgeVariant = NonNullable<React.ComponentProps<typeof Badge>['variant']>` (không sửa `badge.tsx`); `AccountStatusBadge` đổi prop `active: boolean` thành `status: AccountStatus` (nơi gọi truyền `customer.status`, `profile.status`; chữ giữ). Nhãn ví khoá boolean nên giữ toán tử ba ngôi một tầng `bound ? 'ok' : 'bad'`.
- **QĐ-9. Mốc test phải giữ** (không sửa `app/test/**`, e2e có sẵn):
  - `account-info.spec.ts` toàn bộ: khối `[data-account-role]` chứa h1 cấp 1 "Thông tin tài khoản", tên, mã, "Chỉ đọc", không `button, input, textarea, select`; ví mock `[data-payment-wallet]` dạng `0x…40`, `[data-wallet-bound="true"]` chữ "Đã định danh"; heading "Thông tin cá nhân", "Thông tin pháp nhân", "Thông tin cán bộ", "Hồ sơ định danh và rủi ro" (không exact, strict); cán bộ không chữ "Địa chỉ ví", "Ví thanh toán".
  - `account-info.test.ts` (chữ "Nhà đầu tư", "Đang đọc…", không thẻ điều khiển); `fix-04-noi-du-lieu-that.test.ts:269`, `:281`; `fix-04-noi-du-lieu-that.spec.ts:69-75` (tối đa 1 action; heading `/^Thông tin cá nhân/` chứa "unverified" exact: biểu tượng `aria-hidden` đứng trước chữ không làm đổi tên); `uiux-02-dau-man.test.ts:194`, `uiux-02-dau-man.spec.ts:152` (không câu phụ cũ), các ca đúng một `h1` trong `main`; `four-roles-*.test.ts`.
- **QĐ-10. Hiệu năng:** JS gzip `/account` (đo vai Nhà đầu tư) không tăng quá 1 KB (theo byte so bản build mốc riêng, đo SAU khi tách `PaymentWalletContent` vì tệp này thuộc gói máy khách, QĐ-3; `AccountInfoPage` giữ là thành phần máy chủ nên biểu tượng của nó không vào gói máy khách); các trang đo khác không tăng; CSS gzip không tăng quá 2 KB. `metrics.json` của `/account` ba số lỗi bằng 0; đường dẫn khác không tăng so với mốc.

## 3. Phạm vi tệp (danh sách trắng)

| Được sửa | Ghi chú |
|---|---|
| `app/src/components/pages/account-info.tsx`, `account-wallet.tsx` | QĐ-1 đến QĐ-8 |
| `app/src/components/account/payment-wallet-content.tsx`, `initials.ts` (mới) | QĐ-3, QĐ-6, QĐ-8 |
| `app/e2e/fe-ux-05b-tai-khoan.spec.ts`, `app/test/fe-ux-05b.test.ts` (mới) | Design mục 3 |
| `docs/tech-report.md` | CHỈ khi số dòng marker dời, chỉ đổi khối tự sinh bằng `node scripts/scan-pending.mjs --write-report` |
| `docs/fe-ux-05b-tai-khoan/{requirements,design,tasks}.md`, `docs/CHECKPOINT_FEUX05B.md` (và `_DETAIL.md` nếu quá 800 dòng), `docs/USER_GUIDE.md`, `.kiro/task-status.json` | Theo quy ước repo |

Cấm mọi tệp khác (xem dòng Loại), gồm `globals.css`, `app/src/app/**`, `lib/**`, `app/test/**` có sẵn, e2e có sẵn, `package*.json`.

## 4. Điều kiện hoàn thành

- [ ] Màn đúng bố cục bản chốt cho bốn vai trừ mục 1 "Không làm"; bảng đối chiếu từng dòng `notes/account.md` trong checkpoint (dòng nào bỏ thì ghi lý do).
- [ ] Bố cục, trường, thành phần đúng QĐ-4, QĐ-5; trường chỉ dời đúng QĐ-4, không mất trường nào.
- [ ] `PaymentWalletContent` dời đúng QĐ-3 (chỉ các phép sửa được phép), commit riêng; checkpoint dán đoạn trước và sau.
- [ ] Không còn `*-destructive`, màu cứng trong các tệp phạm vi; sắc nhãn đúng QĐ-8.
- [ ] Không đổi chữ (tasks bước 6d đúng kỳ vọng); không đổi giá trị, nhãn, liên kết, điều kiện hiện.
- [ ] Diff giữ logic (QĐ-1, QĐ-2); checkpoint liệt kê từng đoạn đổi nằm gần hook, effect, điều kiện hiện, kèm lý do an toàn.
- [ ] Số action khi mở màn đúng QĐ-2 cho bốn vai (e2e ca 4) và không đổi ở 28 đường dẫn; JS, CSS trong trần QĐ-10 (bảng byte); ba số lỗi của `/account` bằng 0.
- [ ] Mốc test QĐ-9 giữ nguyên; không sửa test có sẵn.
- [ ] Ảnh 1440 và 390, Sáng và Tối, trước và sau, bốn vai, mỗi lượt một tiến trình mock MỚI khởi động: `npx next start --port <cổng>` với ĐỦ biến của `webServer.env` trong `playwright.config.ts:93-110` (trước từ bản build mốc, sau từ bản build nhánh; không dùng lại máy chủ đã chạy test, script đo hay chụp lượt trước). Màn chỉ đọc hồ sơ mẫu nên không cần chuẩn bị dữ liệu. Script chụp ngoài repo, không commit.
- [ ] Trạng thái không dựng được trên mock (ô ví: chưa kết nối ví kèm liên kết, đang đọc, lỗi đọc ví, ví chưa được định danh; tài khoản `LOCKED`; định danh `PENDING`, `REJECTED`; rủi ro `MEDIUM`, `HIGH`): unit test (design mục 3) và ảnh dựng ngoài repo bằng `renderToStaticMarkup` cộng CSS bản build, `page.setContent`, như 03b (Sáng, Tối, 1440, 390).
- [ ] `fe-ux-05b-tai-khoan.spec.ts` (project mock) đủ 4 ca và `fe-ux-05b.test.ts` đủ 4 nhóm (design mục 3), xanh.
- [ ] Kiểm thử đúng mục 5, đạt, kèm log; log có mục "EVM - E2E PROJECT HARDHAT" xanh.
- [ ] Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 6) đúng kỳ vọng.
- [ ] Không mã dư thừa: hằng, hàm, import, lớp không còn dùng xoá hẳn.

## 5. Phạm vi kiểm thử

| Ai | Chạy | Không chạy |
|---|---|---|
| Dev | `bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm` một lần, khi cổng e2e trống, lưu log; đo bằng `tools/20261104_do_moc_measure.js` (gửi kèm, sha256 `6079a0d679000d4c2bbe559d5a3eb90d362bb018243d45c0888f2fad26cdae1c`; `JS_PAGES=/,/portfolio,/trade,/approvals,/account`), JS `/account` theo byte so bản mốc build riêng, CSS theo cách 01c. Gửi riêng đoạn log từ "EVM - E2E PROJECT HARDHAT" tới hết | `contracts` |
| Supervisor | Đọc diff, đối chiếu commit dời; build; chạy `fe-ux-05b-tai-khoan`, `account-info` (e2e và unit), `fix-04-noi-du-lieu-that` (e2e và unit), `uiux-02-dau-man` (e2e và unit), unit test mới; gây lỗi có chủ đích 4 điểm (bỏ `tile-gold` ở ô Hạn mức; đảo sắc nhãn ví thành `bound ? 'bad' : 'ok'`; đổi `min-[1100px]:col-span-4` của ô xanh thành `col-span-4`; thêm một lời gọi `getAccountWalletAction(` trong effect); xem ảnh | Full suite |
