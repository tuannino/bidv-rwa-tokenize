# FE-UX-02a: thiết kế

Nguồn hình ảnh: `docs/prototypes/20261101_ui_ux_ban_chot/` các trang `dashboard.html`, `transactions.html`, `transaction-detail.html`, `demo-payment.html`, `wallet-binding.html` và `assets/c.css` (`.card` 144 tới 158, `.kpi` 162 tới 181 và 551 tới 586, `.badge` 218 tới 221, `.alert` 269 tới 274, `.empty` 277 tới 280, `.steps`, `.timeline` 284 tới 293). Lấy hình dáng, khoảng cách, màu; không chép mã, không thanh "Trạng thái xem thử".

## 1. Token (`globals.css`)

| Nhóm | Sáng | Tối |
|---|---|---|
| ok | bg `#e2f2f2`, ink `#0c4746` | bg `#142928`, ink `#7dd6d5` |
| warn | bg `#fdf1d3`, ink `#6e4b00` | bg `#2a2212`, ink `#ecc06a` |
| bad | bg `#fde8e6`, ink `#8a1c13` | bg `#2c1716`, ink `#f5a199` |
| info | bg `#e6eef8`, ink `#1d3f6b` | bg `#142133`, ink `#9cc2f0` |
| tile hl | `radial-gradient(120% 130% at 100% 100%, #1e8886 0%, #115d5c 45%, #093f3e 100%)` (theo `c.css:568`), ink trắng, chữ phụ trắng 78% | giữ như Sáng |
| tile au | `radial-gradient(120% 140% at 100% 0%, #fbe39a 0%, #eec158 38%, #d9a22c 75%, #b98510 100%)`, ink `#2a1c00`, chữ phụ `#4d3500` | `radial-gradient(120% 140% at 100% 0%, #e9c463 0%, #c9971c 50%, #8a6406 100%)`, ink `#2a1c00`, chữ phụ `#4d3500`; kiểm tương phản tại vùng chữ, vùng `#8a6406` không đạt thì chỉnh (QĐ-2) |
| tile leaf | `linear-gradient(150deg, #f1fafa 0%, #dcf0f0 100%)`, viền trong `rgba(23,110,109,.12)` | `linear-gradient(150deg, #102726 0%, #0c1e1d 100%)`, viền trong `rgba(55,167,165,.18)` |
| tile gold | `linear-gradient(150deg, #fff9e9 0%, #fbedc4 100%)`, viền trong `rgba(201,151,28,.22)` | `linear-gradient(150deg, #2a210c 0%, #1d170a 100%)`, viền trong `rgba(224,180,74,.2)` |

Trang trí tĩnh bằng `::before` (không phần tử rỗng, không animation): `leaf` sọc chéo mảnh ở góc dưới phải, `gold` vân tròn ở góc dưới phải (theo `c.css` 582, 575). `hl` và `au` không có minh hoạ ở PR này.

## 2. Thành phần

```tsx
// ui/kpi.tsx (hình dạng)
<div data-kpi data-tone={tone} className={cn(kpiVariants({ tone, size }), 'lift', className)} {...rest}>
  <div className="flex items-center justify-between gap-3">
    <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
    {icon && <span className="grid size-10 place-items-center rounded-full ...">{icon}</span>}
  </div>
  <p className="mt-3 text-[28px] font-bold leading-tight"><span className="tabular-nums">{value}</span>{unit && <small className="ml-1 text-sm font-medium">{unit}</small>}</p>
  {sub && <div className="mt-1.5 text-[13px] text-muted-foreground">{sub}</div>}
  {children}
</div>
```

- Gốc `Kpi` và `Card` (tone khác `default`) đặt màu chữ chính bằng lớp `text-(--tile-*-ink)` và ghi đè `--card-foreground`, `--foreground`, `--muted-foreground` (QĐ-2); không dựa vào kế thừa từ biến của phần tử cha.
- `value` là `ReactNode` (nơi dùng truyền chuỗi đã định dạng như hiện tại). Bo 22 px, đệm 20 px; `lg` dùng cho ô `hl` của `/`: chiếm 2 hàng lưới, chữ số 40 px. 
- `Card`: giữ bo và đệm hiện tại; `tint` nền `bg-muted/60`. `CardTitleIcon`: vòng tròn 32 px nền `bg-muted`, biểu tượng 16 px `text-primary`, nét 1,7. Không dùng biến `--chip`, `--surface-2`, `--r-card` (chưa có trong `globals.css`).
- `Alert`: `flex gap-3 rounded-[18px] px-4 py-3.5 text-[13px]`, nền và chữ theo `tone`, biểu tượng 18 px mặc định theo tone (`CheckCircle2`, `TriangleAlert`, `XCircle`, `Info`), cho phép truyền `icon`.
- `EmptyState`: `grid place-items-center gap-2.5 rounded-[18px] bg-muted px-4 py-8 text-center text-muted-foreground`, vòng biểu tượng 52 px; `loading` dùng `Loader2` `animate-spin`.
- `BlockedNotice`: thẻ `bad` nền `--bad-bg`, biểu tượng `ShieldX`, `h1` 18 px, đoạn chữ; giữ nguyên chữ hai trang hiện có.
- `fieldClass`: `min-h-11 w-full rounded-[14px] border border-border bg-muted/40 px-3.5 py-2.5 text-sm transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`. Ô địa chỉ, mã thêm `font-code` tại chỗ như hiện tại.

## 3. Bố cục từng màn

| Màn | Bố cục (1440 px; dưới 1100 px một cột, ô số liệu 2 cột từ 640 px) |
|---|---|
| `/` | Hàng đầu: `h1` và nút "Phát hành WPT" (`Button` mặc định) hai đầu. Lưới 12 cột: Tổng cung token `hl lg` 4 cột 2 hàng (giữ SupplyBar, dòng TCC); Dự án, Nhà đầu tư 4 cột mỗi ô; Sản lượng `leaf` 4 cột, Lợi tức `au` 4 cột. Thẻ biểu đồ trải 12 cột, hai biểu đồ cạnh nhau từ 1100 px (mỗi biểu đồ có tiêu đề, `CardTitleIcon`), xếp dọc dưới 1100 px. Lỗi dùng `Alert bad`, không `role` (như hiện tại) |
| `/transactions` | `h1`; `Alert info` cho ghi chú chỉ xem (giữ `role="note"`); 3 ô số liệu 4 cột mỗi ô; MỘT thẻ chứa: hàng bộ lọc (ô tìm rộng, 5 ô chọn và ngày dùng `fieldClass`, lưới tự gập), phản hồi (`Alert`, giữ `role="status"`), bảng (nhãn trạng thái `Badge` theo `orderStatusTone`; ô trống `–`), phân trang. Đang tải, lỗi, rỗng dùng `EmptyState` |
| `/transactions/[id]` | Liên kết quay lại có biểu tượng mũi tên trái; `h1` và nhãn trạng thái có sắc. Lưới 12 cột: Thông tin lệnh 5 cột (danh sách nhãn trái, giá trị phải, số `tabular-nums`, ví `font-code`), Tiến trình 7 cột (5 bước dạng `.steps`: chấm tròn nối đường, bước xong `ok`, đang chạy `warn`, dừng `bad`, chưa tới mờ; khối quy tắc, Kết cục, bút toán dạng `Card tint`), Nhật ký 12 cột dạng `.timeline` |
| `/demo-payment` | `h1`; ghi chú dùng `Alert info` (giữ `role="note"`); thẻ "Nạp vào ví" có `CardTitleIcon` (8 cột từ 1100 px), ô ví và số dùng `fieldClass`, nút gợi ý nhanh dạng nút viền tròn, câu "Tối đa một lần: … VNDB." giữ nguyên; phản hồi `Alert` (đúng một `role="status"`); thẻ lịch sử 12 cột, rỗng dùng `EmptyState` |
| `/wallet-binding` | `h1`; thẻ "Gắn ví cho hồ sơ" có `CardTitleIcon`, lưới biểu mẫu giữ `16rem` cộng phần còn lại, gập một cột dưới 640 px; phản hồi `Alert` (giữ `role` và `aria-label`); thẻ "Ví đã định danh" bảng giữ `data-wallet`, đang tải, lỗi, rỗng dùng `EmptyState` |
| 2 trang chặn | `BlockedNotice` thay khối cũ, chữ giữ nguyên |

## 4. Kiểm thử mới

`app/test/fe-ux-02a.test.ts` (môi trường `node`, dựng bằng `react-dom/server` `renderToStaticMarkup`):

1. Với mọi giá trị `ORDER_STATUSES`, `orderStatusTone` trả đúng bảng QĐ-3; dùng `Record<OrderStatus, Tone>` để quên ánh xạ thì typecheck fail.
2. `Alert` (mỗi tone) và `EmptyState` (thường, `loading`, `tone="bad"`) dựng không truyền `role`: HTML không có thuộc tính `role`; truyền `role="status"`, `aria-label`, `data-x` thì có đủ trên phần tử gốc.
3. `SettlementProgress` dựng với dữ liệu giả qua props (5 bước gồm đủ `done`, `current`, `failed`, `pending`; `settlement` giả): đủ 5 `li` theo đúng thứ tự `data-step`; mỗi `li` giữ `data-state` đã truyền, có nhãn `STEP_STATE_LABELS[state]`, có `data-tone` đúng `settlementStepTone` (`ok`, `warn`, `bad`, `muted`). Không tạo lệnh, không gọi backend.

`app/e2e/fe-ux-02a-van-hanh.spec.ts`:

| Ca | Kiểm |
|---|---|
| 1 | `/` (teller): 5 phần tử `[data-kpi]`; `data-tone` của ô có nhãn "Tổng cung token", "Lợi tức đã chia", "Sản lượng luỹ kế" lần lượt là `hl`, `au`, `leaf`; hai ô còn lại `default`; nền ô `hl` khác nền ô `default` (`backgroundImage` khác `none`) |
| 2 | `/transactions`: 3 `[data-kpi]`, Tổng cung `hl`, Chưa phân phối `leaf` (`data-testid` giữ nguyên); ô `supply-undistributed` sau khi bỏ ký tự không phải số chỉ còn đúng con số hiển thị |
| 3 | Đếm `[role="status"]`, `[role="note"]`, `[role="alert"]` TRONG `main` (không đếm thông báo chuyển trang của Next ngoài `main`), sau khi màn tải xong (chờ bảng hoặc `EmptyState` không còn ở trạng thái đang tải): `/`, `/demo-payment`, `/wallet-binding` với vai TELLER; `/transactions` với vai CONTROLLER (có ghi chú chỉ xem). Số đếm bằng hằng số dev đo trên `release/ui-v2` @ `2065289` trước khi sửa, ghi vào test và checkpoint |
| 4 | 390 px: `document.documentElement.scrollWidth <= 390` ở 4 màn ca 3; 1440 px và 390 px không có lỗi console, không cảnh báo hydrate |

Chi tiết lệnh không có ca mới: mock mới khởi động không có lệnh, tạo lệnh trong spec mới làm đổi dữ liệu của các spec chạy sau. `ops-transactions.spec.ts:105-131` đã phủ chi tiết ở cả hai kênh và `permit-order.spec.ts` phủ kết quả đặt lệnh; hai spec này phải xanh, cộng `orderStatusTone` có unit test.
