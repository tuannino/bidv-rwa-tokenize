# FE-UX-01b: thiết kế

Nguồn hình ảnh: `docs/prototypes/20261101_ui_ux_ban_chot/assets/shell.css`, `shell.js` (khung), `logo.js` (logo); tài liệu bàn giao mục 5.1, 5.2. Chỉ lấy hình dáng tĩnh; hiệu ứng JS của bản xem thử (lớp `.glide`, co theo cuộn) KHÔNG làm ở PR này.

## 0. Cấu trúc

```
div.flex.h-screen.overflow-hidden            (gốc khung, AppLayout, server)
  aside#app-sidebar                          (Sidebar, client; nhận logo, logoMark từ server)
  div.lop-phu  (chỉ dưới 1100 px, khi mở)
  div.flex-1.overflow-y-auto                 (cột cuộn)
    header.sticky.top-0                      (Header, client)
    main                                     (không overflow riêng)
```

`shell-state.ts`: store module với `subscribe`, `getSnapshot`, `getServerSnapshot`; hai giá trị `rail` (đọc ghi `localStorage['bidv-rail']`) và `drawer` (chỉ bộ nhớ); hàm `setRail`, `openDrawer`, `closeDrawer`. Hook `useRail()`, `useDrawer()` dùng `useSyncExternalStore`.

## 1. Thanh bên (`sidebar.tsx`)

| Phần | Làm | Giữ nguyên |
|---|---|---|
| Khung | `<aside id="app-sidebar">` thẻ nổi trong lề 12 px, `rounded-[28px]`, `bg-sidebar`, `ring-1 ring-border`; rộng 270 px, thu gọn 88 px; `transition-[width]` chỉ gắn sau mount, có `motion-reduce:transition-none` | `aside` |
| Đầu | Logo (prop `logo` hoặc `logoMark` khi thu gọn) là liên kết tới `firstHref` như hiện tại; dưới logo là ô chọn vai (`ChannelSwitcher` chuyển từ thanh đầu), nhãn hai dòng: "Vai trò" và giá trị đang chọn | `ChannelSwitcher`: `select#channel-switcher`, `option`, `onChange` |
| Menu | Biểu tượng lucide trong vòng tròn 32 px; nhãn 14 px; mục đang mở: `bg-primary`, chữ, biểu tượng và ô phím tắt đều `text-primary-foreground`; rê chuột: `bg-sidebar-accent` | `NAV_BY_ROLE`, `withHiddenOps`, `CollapsibleGroup`, `NavLink` (`prefetch={false}`, `needsFetch`), `HoverHint` bọc ngoài `Link`, phím tắt |
| Số việc chờ | Viên tròn trong thẻ `a`, bên phải nhãn: 0 là `bg-muted text-muted-foreground`; khác 0 là `bg-accent text-accent-foreground` | `aria-label`, cách đọc số |
| Ô phím tắt | `font-mono` thành `font-code` | nội dung |
| Lưu ký | Biểu tượng, nhãn, công tắc; dưới là `custodyNotes`; công tắc bật `bg-primary` | toàn bộ logic `CustodyToggle` |
| Đáy | Ô chọn chain (`ChainSelector` chuyển từ thanh đầu), dưới là dòng `{chain}, vai trò {ROLE}` bằng `font-code` (thay `NetworkStatus`, bỏ `animate-ping`); bên phải là nút thu gọn chỉ biểu tượng, `aria-label` "Thu gọn thanh bên" hoặc "Mở rộng thanh bên" (chỉ dùng nhãn, không `aria-pressed`); nút này ẩn dưới 1100 px | `select#chain-selector`, `option`, Stellar hiện nhưng không chọn được |
| Thu gọn | Ẩn chữ, biểu tượng canh giữa; nhãn mục thành `sr-only` (vẫn là tên truy cập), rê chuột hiện tên bằng `HoverHint`; số việc chờ thành viên nhỏ ở góc biểu tượng, vẫn là chữ số; ô vai và chain thành `button` biểu tượng có `title` là giá trị đang chọn, bấm thì mở rộng thanh bên; `select` gốc vẫn trong DOM với `sr-only` | |

## 2. Logo (`bidv-logo.tsx`)

- Dùng đường `word`, `flower` và hộp nhìn trong `assets/logo.js`, viết thành component SVG thuần dựng ở server (không `"use client"`), không chép hàm JS. `flower` khai báo một lần trong `<symbol id="bidv-flower">` (đặt trong bản đầy đủ), bản thu gọn dùng `<use href="#bidv-flower">`. Làm tròn toạ độ hoặc SVGO; ghi cỡ gzip vào checkpoint (không quá 6 KB).
- Bản đầy đủ: chữ BIDV `fill` là `BRAND.green` ở Sáng; ở Tối dùng `fill="currentColor"` với lớp `text-[...] dark:text-white` (không đọc theme bằng JS); bông mai `BRAND.gold`; dòng dưới "**RWA** Tokenize Platform" 12 px.
- Bản thu gọn: bông mai trên ô vuông bo 12 px nền `BRAND.green`.
- `role="img"`, `aria-label="BIDV"`. `AppLayout` truyền `<BidvLogo variant="full" />` và `<BidvLogo variant="icon" />` vào `Sidebar`.

## 3. Thanh đầu (`header.tsx`)

- `sticky top-0` trong cột cuộn, `rounded-[22px]`, `bg-card/80` có `backdrop-blur`, cao 56 px ở 1100 px trở lên, 48 px dưới 1100 px.
- Trái: nút menu (chỉ dưới 1100 px), tên màn `<p className="truncate text-base font-medium">` là phần tử cuối của `breadcrumbs`. Không crumb, xoá `ChevronRight`.
- Phải: `ConnectButton` giữ nguyên props hiện tại, màu vàng qua `BRAND.walletAccent*` trong `providers.tsx`; nút Sáng Tối giữ `title` và hàm cũ, hiện mọi cỡ màn.

## 4. Ngăn kéo dưới 1100 px

- Breakpoint dùng giá trị tuỳ ý Tailwind 4 (`max-[1099px]:`, `min-[1100px]:`); không thêm tệp cấu hình.
- Ngăn kéo là chính `aside` (không nhân bản menu): dưới 1100 px `fixed inset-y-0 left-0 z-50`; đóng: `-translate-x-full invisible` cộng thuộc tính `inert`; mở: `translate-x-0 visible`, không `inert`. Lớp phủ `fixed inset-0 bg-foreground/30 min-[1100px]:hidden`, bấm để đóng.
- Khi mở: `header` và `main` có `inert`; tiêu điểm vào nút X đầu ngăn kéo; Esc đóng; đóng thì tiêu điểm về nút menu. Không thư viện khoá cuộn; chỉ `overflow-hidden` trên gốc khung.
- Bấm một mục menu thì `closeDrawer()`; đổi đường dẫn bằng cách khác (nút trình duyệt) thì đóng theo state suy ra: store lưu đường dẫn lúc mở, `Sidebar` coi là đóng nếu `usePathname()` khác đường dẫn đó.
- `inert` chỉ gắn khi màn dưới 1100 px (đọc `matchMedia('(max-width: 1099px)')` qua cùng store, phía máy chủ coi là màn rộng).

## 5. Cách đo và so menu

- Script mốc của FE-UX-01a (`scripts` ngoài repo: `20261103_do_moc_measure.js` trong zip mốc giai đoạn 0) cho số action, JS gzip ở `/`, `/approvals`, `/portfolio`, `/trade`, hydrate, ảnh 28 đường dẫn.
- So menu: mỗi vai, lấy danh sách `{nhóm, nhãn, href}` của mọi `a` trong `aside` trên `release/ui-v2` sau #84 và trên nhánh PR; hai danh sách và số lượng phải giống hệt (dán vào checkpoint).

## 6. Kiểm thử mới `app/e2e/fe-ux-01b-khung.spec.ts`

| Ca | Kiểm |
|---|---|
| 1 | 1440 px: `aside` rộng 270 px (sai số 2 px); bấm "Thu gọn thanh bên": 88 px, `localStorage.getItem('bidv-rail')` là `'1'`; tải lại: vẫn 88 px ngay ở lần đo đầu, không có cảnh báo hydrate trong console |
| 2 | Khi thu gọn: `getByRole('link', { name: /Lập lệnh/ })` vẫn tìm được; `getByLabel(/việc đang chờ/)` hiện và nằm trong một `a`; `#channel-switcher` vẫn có trong DOM; số `a` trong `aside` bằng khi mở rộng |
| 3 | Ở `/`, `/draft`, `/portfolio` và một màn chi tiết: tên trên thanh đầu khớp phần tử cuối `breadcrumbs`; `header` không chứa heading; `main` không chứa `header`; `page.locator('h1')` đúng 1 |
| 4 | 390 px: `aside` `toBeHidden()`; nút theme hiện; bấm "Mở menu": `aside` hiện, `aria-expanded="true"`, tiêu điểm ở nút đóng, `main` có thuộc tính `inert`; Esc: đóng, tiêu điểm về "Mở menu"; mở rồi bấm lớp phủ: đóng; mở rồi bấm một mục menu: chuyển trang và `aside` ẩn; `document.documentElement.scrollWidth <= 390` ở `/`, `/draft`, `/approvals`, `/portfolio`, `/seller` |
| 5 | `#channel-switcher`, `#chain-selector` nằm trong `aside`, là `select`; đổi kênh sang `investor` chạy như cũ (menu đổi sang menu Nhà đầu tư) |
| 6 | Công tắc Lưu ký: Giao dịch viên có công tắc và đủ câu ghi chú; Nhà đầu tư không có |
