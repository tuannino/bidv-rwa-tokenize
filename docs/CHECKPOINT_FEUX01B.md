# Báo cáo bàn giao: FE-UX-01b Khung giao diện (thanh bên, thanh đầu, ngăn kéo điện thoại, logo)

| | |
|---|---|
| Mã task | FE-UX-01b |
| Phạm vi | **Frontend.** Một thay đổi trong `lib/` chỉ là hằng số màu thương hiệu (`lib/brand.ts`, QĐ-7, Sếp duyệt 03/11). Không đổi backend, database, hợp đồng, cấu hình triển khai; không thêm gói npm |
| Nhánh | `feat/fe-ux-01b-khung`, tạo từ `release/ui-v2` (`44a4d7c`, sau merge PR #84 FE-UX-01a kèm font cục bộ) |
| Spec | `docs/fe-ux-01b-khung/{requirements,design,tasks}.md` (chép nguyên) |
| Commit | spec `b48801e`; brand, logo, `--chart-4` `6cd5911`; khung `c55f180`; e2e `cb18303`; vùng cuộn không nhận Tab `77651b0`; tài liệu: commit cuối trên nhánh |
| Tiến độ | Xong. PR base `release/ui-v2`, chờ Supervisor nghiệm thu; Claude Code **không** merge |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 4) | | Bằng chứng |
|---|---|---|---|
| 1 | `aside` 270 px, thu gọn 88 px, nhớ khi tải lại; không lệch hydrate, không trượt khi tải lại | ✅ | mục 1.2 (ca 1), 2.2 |
| 2 | Menu 4 vai đúng mục, nhãn, thứ tự, nhóm, số liên kết như mốc | ✅ | mục 3.2 |
| 3 | "Nghiệp vụ ẩn" gập được, tự mở; "Nạp VNDB", "Định danh ví" đúng điều kiện cũ | ✅ | mục 3.2, 2.1 |
| 4 | Số việc chờ hiện cả 0 (xám), khác 0 (vàng), hiện khi thu gọn, trong thẻ `a`, `aria-label` giữ | ✅ | mục 1.2 (ca 2), 2.1 |
| 5 | Công tắc Lưu ký đủ câu ghi chú, khoá khi chưa cấu hình, dòng lỗi; chỉ vai có `custody:toggle` | ✅ | mục 1.2 (ca 6), 2.1 |
| 6 | Vai ở đầu, chain và trạng thái mạng ở đáy; `select` gốc, chữ `option` không đổi, đổi chạy như cũ | ✅ | mục 1.2 (ca 5), 1.1 |
| 7 | Thanh đầu: tên màn đúng phần tử cuối `breadcrumbs` ở 28 đường dẫn; không crumb; `header` ngoài `main`; một `h1`; ví vàng; Sáng Tối ở 390 px | ✅ | mục 1.2 (ca 3, 4), 3.3 |
| 8 | 390 px: không tràn ngang; ngăn kéo đóng ẩn, không Tab vào; mở, đóng 5 cách; `inert`; tiêu điểm | ✅ | mục 1.2 (ca 4), 3.4 |
| 9 | `rg font-mono` 0 dòng; không màu cứng trong `components/layout` (bước 10b) | ✅ | mục 4 |
| 10 | Số action không đổi 28 đường dẫn; JS gzip 4 trang tăng dưới 10 KB; hydrate 0; logo dưới 6 KB gzip | ✅ | mục 3.1, 2.3 |
| 11 | `fe-ux-01b-khung.spec.ts` đủ ca design mục 6, xanh, mỗi ca có phép kiểm cụ thể | ✅ | mục 1.2 |
| 12 | Danh sách trắng rỗng; quét ký tự cấm rỗng; `run-local-all.sh` toàn bộ đạt, kèm log | ✅ | mục 1.1, 4 |
| 13 | Không mã dư thừa: `NetworkStatus`, `ChevronRight` của crumb, lớp, biến, import không dùng xoá hẳn | ✅ | mục 2.1, 2.4 |
| 14 | Checkpoint ghi phạm vi, tệp, `lib/brand.ts`, selector e2e đã sửa, 4 màn chi tiết, số đo, ảnh | ✅ | đầu tệp, mục 2, 3, 5 |

**Kết luận:** 14 ✅, 0 🔶, 0 ❌. Khung mới chạy ở 28 đường dẫn, không đổi menu, quyền, lời gọi dữ liệu; không phải
sửa selector e2e cũ nào. Mức rủi ro: thấp tới vừa (khung có trên mọi màn, nhưng e2e đầy đủ mock 102 và Hardhat 26
xanh).

UserGuide: Phần 3 quy ước chung (mục "Giao diện chung"), mục 3.0 viết thêm khung (thanh bên, thanh đầu, màn hẹp),
công tắc Lưu ký, màn chặn vai; "Chốt tại"; Lịch sử.

### 0.2 Việc cần Owner quyết

- **Cổng bắt đầu:** PR #84 đã merge (`44a4d7c`); QĐ-7 (`lib/brand.ts`) Sếp duyệt trong hội thoại ngày 03/11 ("QĐ-7
  tao đồng ý").
- **Tên mục khi thu gọn** (mục 6): hiện bằng `title` gốc của liên kết thay vì `HoverHint`, vì unit test UIUX-02 khoá
  đúng chuỗi `<HoverHint hint={item.hint}>` (không được sửa `app/test`). Supervisor xác nhận hoặc chọn cách khác.

---

## 1. Kiểm thử

### 1.1 Toàn bộ (tasks bước 9)

```text
$ TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa USE_LOCAL_SOLC=1 \
    bash scripts/run-local-all.sh arch markers checkpoint contracts app build e2e evm
  => PASS có cảnh báo: luật kiến trúc          # PASS 20, FAIL 0, WARN 3 (như mốc)
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)
  => PASS: LỚP 3 - KHUÔN CHECKPOINT
  => PASS: LỚP 1 - SPEC TEST CONTRACT EVM
  => PASS: APP - TYPECHECK
  => PASS: APP - LINT
      Tests  1478 passed | 74 skipped (1552)   # như mốc
  => PASS: APP - VITEST
  => PASS: APP - BUILD BẢN PHÁT HÀNH
  102 passed (2.1m)                            # e2e mock: 96 sau #84 cộng 6 ca mới
  => PASS: APP - E2E (PLAYWRIGHT)
  => PASS: EVM - BUILD BẢN HARDHAT
  => PASS: EVM - DỰNG CHUỖI MỚI
  26 passed (37.5s)                            # e2e Hardhat, như mốc
  => PASS: EVM - E2E PROJECT HARDHAT
  => ĐẠT các phần đã chạy: arch markers checkpoint contracts app build e2e evm   # trên 77651b0
```

Log đầy đủ gửi kèm: `20261103_feux01b_run_local_all.log`. **Không sửa selector e2e cũ nào** (`/tmp/feux01b-e2e.txt`
rỗng): mọi mốc ở QĐ-2 giữ nguyên nên các bộ cũ chạy như trước.

### 1.2 e2e mới `app/e2e/fe-ux-01b-khung.spec.ts` (project mock, chạy 3 lần liên tiếp đều 6/6)

| Ca | Kiểm | Kết quả |
|---|---|---|
| 1 | 1440 px: `aside` rộng 270 (sai số 2); bấm "Thu gọn thanh bên": 88, `localStorage['bidv-rail']` là `'1'`; tải lại: lần đo đầu sau khi chạy JS đã là 88 (không đo dần), có nút "Mở rộng thanh bên", không có cảnh báo hydrate trong console | ✅ |
| 2 | Thu gọn: liên kết tên `/Lập lệnh/` còn; `getByLabel(/việc đang chờ/)` hiện, là chữ số, nằm trong `a`; `#channel-switcher` còn trong DOM, là `SELECT`; số `a` trong `aside` bằng lúc mở rộng | ✅ |
| 3 | `/`, `/draft`, `/portfolio`, `/tokens/WPT` (màn chi tiết): tên trên thanh đầu đúng phần tử cuối `breadcrumbs`; thanh đầu không có heading, không nằm trong `main`; đúng một `h1`, nằm trong `main` | ✅ |
| 4 | 390 px: `aside` ẩn và có `inert`; nút theme hiện; "Mở menu": `aside` hiện, `aria-expanded="true"`, tiêu điểm ở "Đóng menu", `main` và `header` có `inert`; Esc: đóng, tiêu điểm về "Mở menu"; lớp phủ: đóng; bấm "Lập lệnh": sang `/draft`, `aside` ẩn; `scrollWidth <= 390` ở `/`, `/draft`, `/approvals`, `/portfolio`, `/seller` | ✅ |
| 5 | `#channel-switcher`, `#chain-selector` nằm trong `aside`, là `SELECT`; chọn `investor`: sang `/portfolio`, thanh bên có "vai trò INVESTOR", "Giao dịch token" | ✅ |
| 6 | Giao dịch viên: công tắc `switch` "Lưu ký Fireblocks" hiện, `aria-checked=false`, khoá, `title` "Chưa cấu hình Fireblocks", ghi chú đúng `['Không áp dụng cho chain này']` (máy chủ e2e không đặt bảng chain); Nhà đầu tư: không có công tắc | ✅ |

## 2. Thay đổi chính

### 2.1 Khung (`components/layout`)

- `app-layout.tsx` (server): gốc `flex h-screen overflow-hidden`; `Sidebar` nhận `logo`, `logoMark` dựng ở server;
  cột phải là một vùng cuộn (`overflow-y-auto`, `tabIndex={-1}`) chứa `Header` dính đỉnh rồi `ShellMain`. `main` bỏ
  `overflow-y-auto`.
- `shell-state.ts` (mới): store mức module đọc bằng `useSyncExternalStore`: `rail` (`localStorage['bidv-rail']`, máy
  chủ coi là mở, đọc ghi bọc `try/catch`, ghi thì tự phát cho cùng tab, sự kiện `storage` cho tab khác), `drawer`
  (đường dẫn lúc mở, chỉ bộ nhớ), `narrow` (`matchMedia('(max-width: 1099px)')`, máy chủ coi là màn rộng), cờ
  `railAnimated` (hiệu ứng đổi rộng chỉ bật sau lần bấm đầu).
- `sidebar.tsx`: `aside#app-sidebar` thẻ nổi lề 12 px, `rounded-[28px]`, `bg-sidebar`, `ring-1 ring-border`; 270 px,
  thu gọn 88 px (`motion-reduce:transition-none`). Đầu: logo là MỘT liên kết tới `firstHref` (hai bản logo cùng
  trong liên kết, bản không dùng `hidden`), nút "Đóng menu" (chỉ dưới 1100 px), `ChannelSwitcher`. Menu: biểu tượng
  trong vòng 32 px, nhãn 14 px (`data-nav-label`), mục đang mở `bg-primary text-primary-foreground`, rê chuột
  `bg-sidebar-accent`; số việc chờ 0 `bg-muted text-muted-foreground`, khác 0 `bg-accent text-accent-foreground`,
  thu gọn thì thành viên ở góc biểu tượng (vẫn trong `a`); ô phím tắt `font-code`. Đáy: `CustodyToggle`,
  `ChainSelector`, dòng `{chain}, vai trò {ROLE}` `font-code`, nút "Thu gọn thanh bên" / "Mở rộng thanh bên" (ẩn
  dưới 1100 px). Dưới 1100 px: `fixed`, đóng thì `invisible`, dịch ra ngoài, có `inert`; mở thì có lớp phủ
  `bg-foreground/30` (`data-shell-overlay`). Esc, nút X, lớp phủ, bấm mục menu hoặc logo gọi `closeDrawer()`; đổi
  đường dẫn: coi là đóng vì khác đường dẫn lúc mở (state suy ra), effect chỉ dọn store ngoài React, không `setState`.
  Tiêu điểm vào nút X khi mở, về nút "Mở menu" khi đóng. Giữ nguyên: `NAV_ICONS`, đọc số việc chờ (`needsFetch`,
  `getPendingWorkAction`), `isActive`, `CollapsibleGroup` (thêm `collapsed` cho kiểu dáng), `NavLink` có
  `prefetch={false}`, `HoverHint hint={item.hint}` bọc ngoài `Link`. Xoá `NetworkStatus` (chấm `animate-ping`),
  import `BidvLogo`.
- `header.tsx`: thanh `sticky top-0`, `rounded-[22px]`, `bg-card/80 backdrop-blur`, cao 56 px (48 px dưới 1100 px);
  trái: nút "Mở menu" (`aria-expanded`, `aria-controls="app-sidebar"`, chỉ dưới 1100 px) và `<p>` tên màn (phần tử
  cuối `breadcrumbs`); phải: `ConnectButton` giữ nguyên props (`accountStatus="avatar"`, `chainStatus="icon"`,
  `showBalance={false}`, `label`) rồi nút Sáng Tối (giữ `title`, hàm). Xoá dòng crumb và `ChevronRight`; chuyển
  `ChainSelector`, `ChannelSwitcher` sang thanh bên. Thêm `ShellMain` (client) để gắn `inert` cho `main`.
- `channel-switcher.tsx`, `chain-selector.tsx`: thêm prop `collapsed`, `onExpand` (kiểu dáng): nhãn "Vai trò",
  "Chain" hiện thành dòng trên, `select` rộng hết thẻ; thu gọn thì nút biểu tượng có `title` là giá trị đang chọn, bấm
  thì mở rộng thanh bên; khối `select` thành `sr-only` (vẫn trong DOM). Logic `onChange`, chữ `option` giữ nguyên.
- `custody-toggle.tsx`: thêm biểu tượng chìa khoá; bật `bg-primary`, núm `bg-background` (QĐ-8); thu gọn thì nhãn và
  ghi chú `sr-only`. `custodyNotes`, `toggle`, `locked`, `aria-*` giữ nguyên.
- `channel-guard.tsx`: hai dòng `font-mono` thành `font-code`; câu "Đổi vai trò ở góc trên phải" thành "Bấm 'Về trang
  của vai hiện tại' rồi đổi vai ở đầu thanh bên" (QĐ-6).
- `hover-hint.tsx`: không đổi.

### 2.2 Không lệch hydrate, không trượt khi tải lại

Máy chủ dựng thanh bên ở trạng thái mở (`getServerSnapshot`), client đọc `localStorage` ngay sau hydrate. Ban đầu
dùng `useIsMounted` để bật hiệu ứng thì ca 1 bắt được thanh bên đang trượt (129 px ở lần đo đầu, vì hiệu ứng bật
cùng lượt với lần đọc thu gọn). Sửa: hiệu ứng chỉ bật sau lần người dùng bấm thu gọn, mở rộng (`railAnimated`).

### 2.3 Logo (`components/bidv-logo.tsx`), màu thương hiệu (`lib/brand.ts`), `providers.tsx`

- Logo dựng ở server (không `"use client"`), truyền vào `Sidebar` qua prop nên không vào bundle JS. Đường `word`,
  `flower`, hộp nhìn lấy từ `assets/logo.js`, đổi sang lệnh tương đối và làm tròn 1 chữ số thập phân (ảnh so cạnh
  bản gốc trùng khớp). `flower` khai báo một lần trong `<symbol id="bidv-flower">` ở bản đầy đủ; bản thu gọn (bông mai
  trên ô vuông bo 12 px nền `BRAND.green`) dùng `<use href="#bidv-flower">`. Chữ BIDV `fill="currentColor"` với lớp
  `text-(--bidv-word) dark:text-white` (biến CSS lấy `BRAND.green`), bông mai `BRAND.gold`; dòng dưới "**RWA**
  Tokenize Platform" 12 px; `role="img"`, `aria-label="BIDV"`.
- Cỡ: hai đường vẽ gzip 4.938 B; SVG logo đầy đủ trong HTML trả về (`curl` trang `/`) 16.331 B, gzip **5.280 B**
  (giới hạn 6 KB). Logo là prop `ReactNode` của Client Component nên còn có trong dữ liệu RSC của trang (HTML), không
  trong tệp JS.
- `lib/brand.ts` (QĐ-7): `green` `#016B69`, `gold` `#FEC629`; thêm `walletAccent` `#c9971c`, `walletAccentForeground`
  `#0e1e1d`, `walletAccentDark` `#e0b44a`, `walletAccentForegroundDark` `#1d1300`; xoá `greenLight`, `goldLight` (không
  còn nơi dùng). Không tệp `lib/` nào khác.
- `providers.tsx`: chỉ hai hằng `LIGHT_WALLET_THEME`, `DARK_WALLET_THEME` dùng `BRAND.walletAccent*` (nút "Kết nối ví"
  vàng, chữ đậm).

### 2.4 `globals.css`

QĐ-9: `--chart-4` Tối `#1e8886` thành `#5bbab8` (7,74:1 trên `--card` Tối `#0f1a1a`). Không thêm biến độ rộng (dùng
giá trị Tailwind tuỳ ý `w-[270px]`, `w-[88px]`, `max-[1099px]:`, `min-[1100px]:`).

## 3. Đo trước và sau

### 3.1 Số đo (script `20261103_do_moc_measure.js`, bản build mock, dữ liệu tạo bằng 3 tệp e2e)

Mốc đo trên `release/ui-v2` @ `44a4d7c` (sau #84), cùng máy, cùng cách.

| Mục | Mốc | Sau |
|---|---|---|
| Số action khi mở màn | 3: `/draft`, `/vault`, `/approvals`; 2: `/seller/withdraw`; 0: `/assets`, `/kyc`, `/audit`, `/reconciliation`, `/wallet`; 1: 19 còn lại | Khớp từng dòng 28/28 |
| Cảnh báo hydrate | 0 ở 28 | 0 ở 28 |
| JS gzip `/` | 552,9 KB | 554,0 KB (+1,1) |
| JS gzip `/approvals` | 451,7 KB | 452,8 KB (+1,1) |
| JS gzip `/portfolio` | 454,5 KB | 455,6 KB (+1,1) |
| JS gzip `/trade` | 476,9 KB | 478,0 KB (+1,1) |

Ảnh: `20261103_anh_do_feux01b.zip` (gửi kèm, không commit): thư mục `moc/` và `sau/`, mỗi thư mục 112 ảnh (28 đường
dẫn, Sáng, Tối, 1440, 390), `metrics.json`, log đo, `menu_4_vai.json`; `sau/ten_man_thanh_dau.txt`.

### 3.2 Menu 4 vai (design mục 5)

Lấy `{nhóm, nhãn, href}` của mọi `a` trong `aside` (mở hết nhóm thu gọn) trên mốc và trên nhánh: **hai danh sách
giống hệt** ở cả 4 vai; số `a` (kể cả logo) như nhau.

| Vai | Số `a` mốc | Số `a` sau | Mục (nhóm) |
|---|---|---|---|
| TELLER | 11 | 11 | Bảng điều khiển `/` (Vận hành); Lập lệnh `/draft` (Vận hành); Giao dịch `/transactions` (Vận hành); Chia lợi nhuận (chỉ xem) `/distribution` (Vận hành); Vault thanh toán SPV `/vault` (Vận hành); Giá và phát hành `/config` (Vận hành); Thu hồi token (chỉ xem) `/recall` (Vận hành); Nạp VNDB `/demo-payment` (Nghiệp vụ ẩn); Định danh ví `/wallet-binding` (Nghiệp vụ ẩn); Thông tin tài khoản `/account` (Tài khoản) |
| CONTROLLER | 9 | 9 | Bảng điều khiển `/` (Vận hành); Giao dịch `/transactions` (Vận hành); Chia lợi nhuận `/distribution` (Vận hành); Vault thanh toán SPV `/vault` (Vận hành); Giá và phát hành `/config` (Vận hành); Thu hồi token `/recall` (Vận hành); Phê duyệt lệnh `/approvals` (Kiểm soát); Thông tin tài khoản `/account` (Tài khoản) |
| INVESTOR | 7 | 7 | Tổng quan `/portfolio`; Giao dịch token `/trade`; Quản lý lệnh `/orders`; Rút VNDB `/withdraw`; Kết nối ví `/wallet`; Thông tin tài khoản `/account` |
| SELLER | 6 | 6 | Tổng quan `/seller`; Danh sách giao dịch `/seller/transactions`; Tạo lệnh rút `/seller/withdraw`; Kết nối ví `/wallet`; Thông tin tài khoản `/account` |

### 3.3 Tên màn trên thanh đầu ở 28 đường dẫn (HTML trả về, bản sau)

| Đường dẫn | Vai | Tên màn |
|---|---|---|
| `/` | TELLER | Tổng quan |
| `/draft` | TELLER | Lập lệnh |
| `/transactions` | TELLER | Giao dịch |
| `/distribution` | TELLER | Chia lợi nhuận |
| `/vault` | TELLER | Vault thanh toán SPV |
| `/recall` | TELLER | Thu hồi token |
| `/config` | TELLER | Giá và phát hành |
| `/wallet-binding` | TELLER | Định danh ví |
| `/demo-payment` | TELLER | Nạp VNDB |
| `/mint` | TELLER | Phát hành WPT |
| `/assets` | TELLER | Dự án điện gió |
| `/kyc` | TELLER | Nhà đầu tư & KYC |
| `/audit` | TELLER | Sổ kiểm toán |
| `/reconciliation` | TELLER | Đối soát doanh thu điện |
| `/transactions/f1cfc024-3942-4a24-bd76-e71146334fde` | TELLER | f1cfc024 |
| `/approvals` | CONTROLLER | Phê duyệt lệnh |
| `/approvals/f9fec518-61fb-4f55-8367-8301b378bf1c` | CONTROLLER | f9fec518 |
| `/portfolio` | INVESTOR | Tổng quan |
| `/trade` | INVESTOR | Giao dịch token |
| `/orders` | INVESTOR | Quản lý lệnh |
| `/orders/f1cfc024-3942-4a24-bd76-e71146334fde` | INVESTOR | f1cfc024 |
| `/withdraw` | INVESTOR | Rút VNDB |
| `/tokens/WPT` | INVESTOR | WPT |
| `/wallet` | INVESTOR | Ví của tôi |
| `/account` | INVESTOR | Thông tin tài khoản |
| `/seller` | SELLER | Tổng quan |
| `/seller/transactions` | SELLER | Danh sách giao dịch |
| `/seller/withdraw` | SELLER | Tạo lệnh rút |

Bốn màn chi tiết: `/approvals/[id]`, `/transactions/[id]`, `/orders/[id]` hiện 8 ký tự đầu của mã; `/tokens/[symbol]`
hiện ký hiệu token (đúng phần tử cuối `breadcrumbs` các trang đang truyền).

### 3.4 Bàn phím (tasks bước 11)

Script Playwright ở 390 px, `/` Giao dịch viên: ngăn kéo đóng, bấm Tab 40 lần: 0 lần tiêu điểm vào `aside`. Mở
ngăn kéo, bấm Tab 60 lần: lần đầu 4 lần ra vùng cuộn bên phải (Chrome cho Tab vào vùng cuộn khi mọi phần tử con có
`inert`); thêm `tabIndex={-1}` cho vùng cuộn, đo lại: 0 lần ra khỏi `aside`.

## 4. Lệnh kiểm (tasks bước 10)

```text
$ rg -n "font-mono" app/src -g '*.tsx'
                                    # rỗng
$ git diff --name-only origin/release/ui-v2...HEAD | grep -vE '^(...danh sách trắng...)$' | grep -vxF -f /tmp/feux01b-e2e.txt
                                    # rỗng (/tmp/feux01b-e2e.txt rỗng: không sửa e2e cũ)
$ rg -n '\b(bg|text|border|ring|fill|stroke|from|to)-(white|black|(slate|...|rose)-[0-9]{2,3})\b|#[0-9a-fA-F]{3,8}\b|rgba?\(' app/src/components/layout
                                    # rỗng
$ comm -13 /tmp/del.txt /tmp/add.txt | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e'
                                    # rỗng
```

## 5. Danh sách tệp

`app/src/components/layout/{app-layout,sidebar,header,custody-toggle,chain-selector,channel-switcher,channel-guard}.tsx`,
`app/src/components/layout/shell-state.ts` (mới), `app/src/components/bidv-logo.tsx`, `app/src/components/providers.tsx`,
`app/src/lib/brand.ts`, `app/src/app/globals.css`, `app/e2e/fe-ux-01b-khung.spec.ts` (mới), `docs/fe-ux-01b-khung/*`
(mới), `docs/CHECKPOINT_FEUX01B.md` (mới), `docs/USER_GUIDE.md`, `.kiro/task-status.json` (`FE-UX-01b` từ `planned`
sang `done`). E2E cũ đã sửa selector: **không có**.

## 6. DEVIATION so với spec

- **Tên mục khi thu gọn:** design mục 1 ghi "rê chuột hiện tên bằng `HoverHint`". `HoverHint` chỉ có prop `hint`, và
  unit test `uiux-02` khoá chuỗi `<HoverHint hint={item.hint}>` ngay trước `<Link`; thêm prop hay đổi chuỗi đều làm đỏ
  test không được sửa. Làm: khi thu gọn, `Link` có `title={item.label}` (hiện tên ngay khi rê chuột), nhãn vẫn là chữ
  `sr-only` (tên truy cập); `HoverHint` vẫn hiện câu mô tả sau 3 giây.
- **Hiệu ứng đổi rộng:** QĐ-3 ghi "chỉ bật sau khi đã mount"; làm như vậy vẫn trượt khi tải lại (mục 2.2), nên bật
  sau lần bấm đầu, đạt đúng mục đích "không trượt khi tải lại".
- **`ShellMain` trong `header.tsx`:** `main` cần `inert` theo trạng thái ngăn kéo (client) mà `app-layout.tsx` là
  server; danh sách trắng không có tệp mới ngoài `shell-state.ts` (không chứa JSX), nên đặt component nhỏ này cạnh
  `Header`.
- **Vùng cuộn `tabIndex={-1}`:** thêm để Tab không ra khỏi ngăn kéo (mục 3.4).
- **Giữ nguyên chữ** `title` "Sắp có ... chưa mở trong phiên bản này" (có gạch dài) ở mục menu chưa khả dụng (QĐ-6 không cho đổi câu
  khác; dòng giữ nguyên nên lệnh quét bước 10c không tính), và phần "(chỉ khả dụng trong PoC)" sau câu mới ở màn chặn
  vai.

## 7. Câu hỏi mở

- Mục 0.2.
- Ba màn `/recall`, `/transactions/[id]`, `/orders/[id]` dựng `h1` ở client nên HTML trả về chưa có `h1` (có từ trước,
  không do PR này); e2e `uiux-02` kiểm đúng một `h1` lúc chạy vẫn xanh.

## 8. Tự đánh giá 3 luật kiến trúc

- [x] Mọi call chain qua ILedgerPort: không đổi mã gọi chuỗi.
- [x] Mọi ký qua ISigner: không đổi.
- [x] Mọi kiểm quyền qua RBAC: không đổi (`can(role, ...)` ở `app-layout.tsx` giữ nguyên); luật kiến trúc PASS.
