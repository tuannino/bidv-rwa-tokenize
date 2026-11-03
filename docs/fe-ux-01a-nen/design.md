# FE-UX-01a: thiết kế

Mốc mã: `dev` @ `2308509`. Nguồn màu: `docs/prototypes/20261101_ui_ux_ban_chot/assets/c.css` (khối `:root, :root[data-theme="light"]` và `:root[data-theme="dark"]`).

## 1. Token màu

### 1.1. Ánh xạ (`globals.css`)

Giá trị Sáng trong `:root`, giá trị Tối trong `.dark` (QĐ-1). Viết hex như bảng.

| Token | Sáng | Tối | Nguồn |
|---|---|---|---|
| `--background` | `#eff4f4` | `#080f0f` | `--bg` |
| `--foreground` | `#0e1e1d` | `#edf5f5` | `--ink` |
| `--card`, `--popover` | `#ffffff` | `#0f1a1a` | `--surface` |
| `--card-foreground`, `--popover-foreground` | `#0e1e1d` | `#edf5f5` | `--ink` |
| `--primary` | `#176e6d` | `#37a7a5` | `--g600` / `--g400` |
| `--primary-foreground` | `#ffffff` | `#071212` | mục 1.3 |
| `--secondary`, `--muted` | `#f3f7f7` | `#132322` | `--surface-2` |
| `--secondary-foreground` | `#324443` | `#c9d6d6` | `--ink-2` |
| `--muted-foreground` | `#556867` | `#a2b4b4` | `--muted` |
| `--accent` | `#c9971c` | `#e0b44a` | `--au500` / `--au400` |
| `--accent-foreground` | `#0e1e1d` | `#1d1300` | mục 1.3 |
| `--destructive` | `#b42318` | `#f07068` | `--bad` |
| `--border` | `#e1e8e8` | `#1e3332` | `--line` |
| `--input` | `#e1e8e8` | `#1e3332` | `--line` (cố ý khác bảng bàn giao `#f3f7f7`: trong shadcn `--input` là màu viền ô nhập) |
| `--ring` | `#37a7a5` | `#7cc7c6` | `--g400` / `--g300` |
| `--chart-1` | `#176e6d` | `#37a7a5` | `--p1` |
| `--chart-2` | `#a87a09` | `#e0b44a` | Sáng dùng `--au600` thay `--p2` `#c9971c` (2,65:1 trên trắng, dưới 3:1 cho đồ hoạ) |
| `--chart-3` | `#1e8886` | `#7cc7c6` | Sáng dùng `--g500` thay `--p3` `#37a7a5` (2,9:1) |
| `--chart-4` | `#115d5c` | `#1e8886` | đề xuất (bản chốt chỉ có 3 màu biểu đồ) |
| `--chart-5` | `#8a6406` | `#efd28a` | đề xuất |
| `--sidebar`, `--sidebar-foreground` | như `--card`, `--foreground` | như cột Tối | tạm tới 01b |
| `--sidebar-accent`, `--sidebar-accent-foreground` | `#dff1f1`, `#0e1e1d` | `#162b2a`, `#edf5f5` | `--g100` / `--chip` (Tối), nền rê chuột thấy được |
| `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-border`, `--sidebar-ring` | như `--primary`, `--primary-foreground`, `--border`, `--ring` | như cột Tối | giữ đủ biến đang khai báo trong `@theme inline` |

Ghi chú:

- `--chart-*` đang dùng làm màu chữ ở `ops-transactions.tsx:232` (`text-chart-4`) và `assets.tsx:37,227` (`--chart-3`, `--chart-5`); các giá trị trên đã tính để chữ đọc được (mục 1.3).
- `--accent` được dùng làm nền mục đang trỏ trong `dropdown-menu.tsx:91`, `select.tsx:120`; nút `ghost` dùng `hover:bg-muted`, không dùng `--accent`. Kiểm ảnh menu thả xuống sau khi đổi.
- Chữ vàng `text-accent` ở `kyc.tsx:180`, `reconciliation.tsx:189` (2,65:1) là lỗi có từ trước, sửa ở FE-UX-06 khi làm hai màn đó.

### 1.2. Xoá

Toàn bộ khối "BIDV Brand Colors" (xanh lá `oklch(... 145)`, vàng `oklch(... 82)`) trong `:root` và `.dark`, kể cả chú thích ràng buộc cũ; không giữ song song. Ràng buộc tương phản mới ghi lại thành chú thích ngắn ở đầu khối token.

### 1.3. Tương phản (WCAG; chữ cần 4,5, đồ hoạ cần 3)

| Cặp | Tỉ lệ | Ngưỡng |
|---|---|---|
| `--foreground` trên `--background` (Sáng) | 15,48 | 4,5 |
| `--muted-foreground` trên `--background` (Sáng) | 5,31 | 4,5 |
| `--primary-foreground` trên `--primary` (Sáng) | 6,02 | 4,5 |
| `--primary-foreground` trên `--primary` (Tối) | 6,55 | 4,5 |
| `--accent-foreground` trên `--accent` (Sáng) | 6,49 | 4,5 |
| `--muted-foreground` trên `--card` (Tối) | 8,22 | 4,5 |
| `--chart-4` trên `--card` (Sáng, đang làm chữ) | 7,65 | 4,5 |
| `--chart-2`, `--chart-3` trên `--card` (Sáng, cột biểu đồ) | 3,85; 4,27 | 3 |

## 2. Font

### 2.1. `layout.tsx`

```ts
import { Roboto, Roboto_Condensed } from 'next/font/google';
const roboto = Roboto({ variable: '--font-roboto', subsets: ['latin', 'vietnamese'], weight: ['300', '400', '500', '700'], display: 'swap' });
const robotoCondensed = Roboto_Condensed({ variable: '--font-roboto-condensed', subsets: ['latin', 'vietnamese'], weight: ['400', '500'], display: 'swap' });
// <html lang="vi" className={`${roboto.variable} ${robotoCondensed.variable}`} suppressHydrationWarning>
```

`metadata.title`: thay gạch dài bằng dấu phẩy, ví dụ `'BIDV RWA, token hoá dự án điện gió'`.

### 2.2. `globals.css`

Trong `@theme inline`: `--font-sans: var(--font-roboto);` (sửa UX-01), `--font-heading: var(--font-roboto);`, bỏ `--font-mono: var(--font-geist-mono)`, thêm `--font-code: var(--font-roboto-condensed);`. Tailwind 4 tự sinh lớp `font-code`; không viết thêm CSS. `font-code` dùng độ đậm của chữ xung quanh (thường 400); không thêm `font-medium` ở PR này.

## 3. Thành phần nền

Chỉ đổi chuỗi class; mọi màu qua token, không mã màu cứng.

| Thành phần | Đổi |
|---|---|
| `card.tsx` | Bo `rounded-[22px]` (bản chốt cho phép 22 đến 28 px; 22 px để nội dung lề 16 px không bị cắt góc vì thẻ có `overflow-hidden`); `rounded-t-xl`, `rounded-b-xl` ở dòng 28 và 87 đổi theo `rounded-t-[22px]`, `rounded-b-[22px]`; giữ `ring-1`, đổi màu sang `ring-border`; không thêm bóng |
| `button.tsx` | Bo tròn hoàn toàn mọi size: thay `rounded-lg` ở lớp gốc và bỏ phần `rounded-[min(var(--radius-md),...)]` của các size `xs`, `sm`, `icon-xs`, `icon-sm` (dòng 25 đến 32) bằng `rounded-full`; không đổi chiều cao |
| `badge.tsx` | Giữ 6 biến thể; màu theo token (không thêm `ok`, `warn`, `bad`, `info` ở PR này) |
| `dropdown-menu.tsx` | Khung danh sách bo `rounded-[18px]` (`--r-inner`), nền `--popover`; mục đang trỏ giữ `--accent` |
| `table.tsx` | Tiêu đề bảng nền `--muted`, chữ `--muted-foreground`, cỡ 12 px; hàng rê chuột nền `--muted` |
| `dialog.tsx` | Bo `rounded-[22px]` |
| `skeleton.tsx` | Màu theo `--muted` |

## 4. Thay `font-mono` (QĐ-4)

Dev lập bảng trong checkpoint: tệp, dòng, nội dung hiển thị, lớp mới. Trường hợp chưa chắc ghi lý do, Supervisor quyết khi nghiệm thu. Bốn dòng trong `components/layout` (`channel-guard.tsx:36,37`, `sidebar.tsx:272,340`) giữ nguyên, FE-UX-01b xử lý.

## 5. `providers.tsx`

- `ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}`.
- `RainbowWithTheme`: trước khi mount dùng `LIGHT_WALLET_THEME`; sau khi mount theo `resolvedTheme`. Sửa chú thích dòng 21 đến 29 cho khớp.
- Không đổi `LIGHT_WALLET_THEME`, `DARK_WALLET_THEME`, `BRAND`.

Người dùng đã từng bấm đổi theme giữ lựa chọn cũ (lưu trong trình duyệt); người chưa từng bấm thấy Sáng.

## 6. Đường dẫn, mốc đo và cách đo

### 6.1. 28 đường dẫn

| Vai | Đường dẫn |
|---|---|
| Giao dịch viên (14 + 1 chi tiết) | `/`, `/draft`, `/transactions`, `/transactions/[id]`, `/distribution`, `/vault`, `/recall`, `/config`, `/wallet-binding`, `/demo-payment`; ngoài menu: `/mint`, `/assets`, `/kyc`, `/audit`, `/reconciliation` |
| Kiểm soát viên (1 + 1 chi tiết) | `/approvals`, `/approvals/[id]` |
| Nhà đầu tư (7 + 1 chi tiết) | `/portfolio`, `/trade`, `/orders`, `/orders/[id]`, `/withdraw`, `/tokens/WPT`, `/wallet`, `/account` |
| Người bán (3) | `/seller`, `/seller/transactions`, `/seller/withdraw` |

### 6.2. Mốc (Supervisor đo 03/11 trên `dev` @ `2308509`)

Bản build chain mock (`next start`, biến môi trường như máy chủ e2e). Trước khi đo, chạy 3 tệp e2e để có dữ liệu cho màn danh sách và 3 màn chi tiết: `E2E_PORT=3300 npx playwright test e2e/maker-checker.spec.ts e2e/ops-transactions.spec.ts e2e/permit-order.spec.ts` trên cùng máy chủ. Gói `20261103_moc_do_giao_dien_dev_2308509.zip` có ảnh Sáng, Tối, 1440, 390 của 28 đường dẫn (chụp hết chiều cao nội dung: nội dung cuộn trong `<main>` nên script nới khung bằng chiều cao nội dung rồi mới chụp), `metrics.json`, log chạy đầy đủ và script `20261103_do_moc_measure.js` (chạy ngoài repo: `node 20261103_do_moc_measure.js <baseURL> <thư mục ảnh>`; đường dẫn chi tiết lấy từ liên kết đầu tiên trên màn danh sách).

| Mốc | Giá trị |
|---|---|
| `run-local-all.sh` toàn bộ | Đạt: vitest 1.478 xanh, 74 bỏ qua; e2e mock 90; e2e Hardhat 26 |
| Action khi mở màn | 3: `/draft`, `/vault`, `/approvals`; 2: `/seller/withdraw`; 0: `/assets`, `/kyc`, `/audit`, `/reconciliation`, `/wallet`; 1: 19 đường dẫn còn lại (gồm 3 màn chi tiết) |
| JS gzip khi mở | `/` 552,9 KB; `/approvals` 451,7 KB; `/portfolio` 454,5 KB; `/trade` 476,9 KB |
| Cảnh báo hydrate | 0 ở cả 28 đường dẫn |

### 6.3. Dev đo lại

Dùng cùng script và cùng cách tạo dữ liệu, ghi cả hai cột (mốc, sau khi sửa) trong checkpoint: số action khi mở màn, JS gzip 4 trang, số cảnh báo hydrate; gửi zip ảnh sau khi sửa.

## 7. Lưu ý e2e

- `e2e/fix-04-...:64` và `e2e/fix-05-tong-quan.spec.ts:45` tìm theo `div.rounded-lg` ở `dashboard.tsx:227`, `seller-overview.tsx:96`: không đổi lớp `rounded-lg` ở hai chỗ này (PR không sửa màn nên không đụng).
- `e2e/maker-checker.spec.ts:142` dựa vào chữ thay thế gạch dài của `stat-card.tsx`: không đổi chữ (QĐ-7).
- Năm e2e dùng `button[title^="Chuyển sang"]` (so tiền tố) nên vẫn chạy khi mặc định Sáng.

## 8. Kiểm thử mới `app/e2e/fe-ux-01a-nen.spec.ts`

Chạy trong project mock. Mỗi ca dùng context mới (không dữ liệu trang cũ) trừ khi ghi khác.

| Ca | Kiểm |
|---|---|
| 1 | Mở `/` lần đầu: thẻ `html` không có lớp `dark`; `getComputedStyle(document.body).backgroundColor` là `rgb(239, 244, 244)` |
| 2 | Bấm nút đổi theme (`button[title^="Chuyển sang"]`): `html` có lớp `dark`, nền body `rgb(8, 15, 15)`; tải lại trang: vẫn Tối |
| 3 | `getComputedStyle(document.body).fontFamily` chứa `Roboto` và không chứa `Condensed`; `document.fonts.check('500 14px <tên font Roboto do next/font sinh, đọc từ biến --font-roboto>')` trả `true` sau `document.fonts.ready` |
| 4 | Trên màn có địa chỉ hoặc mã (ví dụ `/transactions` sau khi có dữ liệu, hoặc phần tử dùng `font-code` có sẵn trên màn), phần tử có lớp `font-code` có `fontFamily` chứa `Condensed`; trong `document.styleSheets` có quy tắc cho `.font-code` |
| 5 | Một `Card` trên `/`: `borderRadius` là `22px`; một `Button` mặc định: `borderRadius` lớn hơn hoặc bằng nửa chiều cao (bo tròn hoàn toàn); nền nút chính là `rgb(23, 110, 109)` |
| 6 | Không còn phần tử nào có lớp `font-mono` trên 4 màn `/`, `/portfolio`, `/approvals`, `/seller` ngoài thanh bên và chặn kênh (do FE-UX-01b xử lý) |
