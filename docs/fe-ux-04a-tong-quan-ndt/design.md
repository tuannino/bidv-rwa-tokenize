# FE-UX-04a: thiết kế

Nguồn hình ảnh: `docs/prototypes/20261101_ui_ux_ban_chot/portfolio.html`, `token-detail.html`, `assets/c.css`. Thành phần: dùng nguyên API của FE-UX-02a đến 03b. Mốc lưới 1100 px và 640 px viết bằng `min-[1100px]:`, `min-[640px]:` như `dashboard.tsx:101`.

## 1. Tổng quan (`/portfolio`, 1440 px)

| Khối | Bố cục |
|---|---|
| Đầu màn | `header` `flex flex-wrap items-center justify-between gap-4`: `h1` "Tổng quan nhà đầu tư" (`text-2xl font-semibold tracking-tight`) và `TokenScopeSelect` (giữ `id`, `className`) |
| Lưới | `grid gap-6 min-[1100px]:grid-cols-12`; hai thẻ hàng trên `col-span-7`, `col-span-5`; hàng dưới như vậy |
| Tài sản đã đầu tư | `Card tone="hl"`, `CardTitleIcon` `Wallet`, `OnChainBadge` bên phải. Nhãn "{symbol} đang giữ" chữ nhỏ, số `text-5xl font-semibold tabular-nums`. Hai ô `rounded-[18px] bg-muted p-4` cạnh nhau từ 640 px: ô 1 Giá trị theo giá phát hành (số `text-2xl`) và câu quy đổi; ô 2 nhãn KYC, nhãn đóng băng, ví rút gọn `font-code`. Dòng Số dư VNDB dưới cùng, kẻ trên `border-t border-border` |
| Trạng thái phát hành | `Card`, `CardTitleIcon` `Gauge` (bỏ biểu tượng rời bên phải). `dl` dòng `py-3` kẻ ngăn `divide-y divide-border`; nhãn trái, giá trị phải đậm; `Alert info` sau `dl` |
| Giao dịch gần đây | `Card`, `CardTitleIcon` `History`, `OnChainBadge` bên phải; bảng như cũ, nhãn trạng thái `Badge` sắc; mã giao dịch `font-code` |
| Token dự án điện gió | `Card`, `CardTitleIcon` `Wind`. Mỗi liên kết là dòng `rounded-[18px] px-4 py-3 hover:bg-muted/60`: ô biểu tượng `Wind` 40 px `bg-muted text-primary rounded-full` (`aria-hidden`), khối tên, khối số nhà đầu tư, `ChevronRight`. Dưới 640 px khối số xuống dưới tên (`flex-wrap`, `min-[640px]:flex-nowrap`) |

## 2. Chi tiết token (`/tokens/[symbol]`, 1440 px)

| Khối | Bố cục |
|---|---|
| Đầu màn | Hàng 1: `h1` tên dự án (`text-2xl font-semibold tracking-tight`), ký hiệu `text-muted-foreground`, `OnChainBadge` hoặc `Badge info` "chưa triển khai trên chuỗi". Hàng 2: "{vùng}, {vị trí}, {trạng thái}" kèm `UnverifiedNote` |
| Lưới | `grid gap-6 min-[1100px]:grid-cols-12`; ba thẻ đầu `col-span-4`, Tình hình vận hành `col-span-12` |
| Vị thế của bạn | `Card tone="hl"`, `CardTitleIcon` `Wallet`. "Đang giữ" chữ nhỏ, số `text-5xl font-semibold tabular-nums`; dòng giá trị kẻ trên, số `text-2xl`; câu cuối chữ nhỏ |
| Thông tin dự án, Thông tin token | `Card`, `CardTitleIcon` `Wind`, `Gauge`; `Row` dòng `py-3`, `dl` `divide-y divide-border` |
| Tình hình vận hành | `Card`, `CardTitleIcon` `Zap`. Nội dung `grid gap-6 min-[1100px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]`: cột trái hai `Kpi` xếp dọc (QĐ-4); cột phải tiêu đề nhỏ "Sản lượng theo kỳ", biểu đồ cột, `ul` lưới ô, câu EnergyOracle |

Biểu đồ cột (không thư viện, mục 3):

```tsx
const maxMwh = Math.max(...MOCK_GENERATION_SERIES.map((p) => p.generationMwh));
<div aria-hidden="true" className="flex h-40 items-end gap-3 border-b border-border">
  {MOCK_GENERATION_SERIES.map((p) => (
    <div key={p.period} className="flex-1 rounded-t-[10px] bg-primary"
      style={{ height: `${Math.round((p.generationMwh / maxMwh) * 100)}%` }} />
  ))}
</div>
```

`maxMwh` đặt ở cấp tệp (dữ liệu mẫu tĩnh). `ul` giữ `key`, hai `span`, chữ; mỗi `li` thành ô `rounded-[14px] bg-muted px-3 py-2`, kỳ trên, giá trị dưới.

## 3. Ràng buộc chung

- Không màu cứng (tasks 6b), không `style` ngoài chiều cao cột biểu đồ.
- 390 px: không cuộn ngang trang; bảng Giao dịch gần đây cuộn trong khung bảng (`Table` đã có `overflow-x-auto`).
- Thẻ `tone="hl"`: chữ phụ dùng `text-muted-foreground`, nền ô `bg-muted` (utility `tile-hl` tự đổi); `--card`, `--border` ghi đè trên thẻ theo QĐ-3. Kiểm ảnh cả Sáng và Tối: ô biểu tượng `EmptyState`, đường kẻ, nhãn `Badge` đọc được.

## 4. Kiểm thử mới

`app/test/fe-ux-04a.test.ts` (môi trường `node`, `renderToStaticMarkup`):

1. **Mã nguồn:** đúng số lời gọi QĐ-2 trong ba tệp; `asset-holdings.tsx`, `transaction-table.tsx` không chứa `Action(`, `useEffect(`, `useState(`, `'use client'` không bắt buộc; `investor-portfolio.tsx` không chứa `'use client'`. Dev xác nhận các số trên bản mốc trước khi viết, ghi trong checkpoint.
2. **`AssetHoldings`** với `PortfolioView` giả đủ trường:

| Dữ liệu giả | Kỳ vọng |
|---|---|
| `balance: '150'`, `valueVnd: '15000000'`, `issuePriceVnd: '100000'`, `whitelisted: true`, `frozen: false`, `recall: null`, `paymentBalance: '2500000'` | chữ "WPT đang giữ", "150", "15.000.000 ₫", "Quy đổi theo giá phát hành 100.000 ₫/WPT", "đã KYC", "2.500.000 VNDB"; không có "đang đóng băng", không `role="status"`; thứ tự xuất hiện: đang giữ, Giá trị theo giá phát hành, đã KYC, Số dư VNDB |
| `whitelisted: false`, `frozen: true` | "chưa KYC" và "đang đóng băng" |
| `paymentBalance: null` | "Chưa đọc được số dư VNDB" |
| `recall` ba pha NOTICE, FROZEN, CLOSED (dữ liệu theo `recallNoticeText`) | đúng một `role="status"`, chứa `title` và `body` mà `recallNoticeText` trả cho pha đó, đứng trước "đang giữ" |

3. **`TransactionTable`** với 3 dòng `CONFIRMED`, `PENDING`, `FAILED` (một dòng `amount: null`), chain `mock`: tiêu đề cột đúng thứ tự Thời điểm, Nghiệp vụ, Số lượng, Trạng thái, Tra cứu; chữ trạng thái giữ mã; `amount: null` hiện "–"; không có `<a`, mã giao dịch có `title` kết thúc "không có trình khám phá" và không chứa U+2014. Thêm 1 dòng chain có `explorerBaseUrl` trong `CHAINS`: có `<a` `target="_blank"` `rel="noopener noreferrer"`, `href` bằng `explorerTxUrl(...)`.
4. **`WalletNotBoundNotice`** `wallet` 42 ký tự: `role="alert"`, `data-wallet-not-bound`, chữ "Ví chưa được định danh", ví rút gọn 6 đầu, "…", 4 cuối trong phần tử `font-code`.

`app/e2e/fe-ux-04a-tong-quan-ndt.spec.ts` (chỉ chạy trên project mock, vai Nhà đầu tư; không đặt lệnh, không đổi dữ liệu). Hằng số `role` đo trên máy chủ MỚI của bản mốc; ca 1, ca 2 đếm `[role="status"]`, `[role="note"]`, `[role="alert"]` trong `main` ngay sau khi tải xong, trước mọi tương tác. Cách chờ dùng được cả trên bản mốc (bản mốc chưa có `data-loading`): chờ `networkidle`, rồi chờ `main` không còn chữ khớp `/Đang (đọc|tải)/`:

| Ca | Kiểm |
|---|---|
| 1 | `/portfolio` 1440 px: `h1` và `#token-scope` cùng hàng (lệch đỉnh dưới 24 px); 4 heading cấp 2 đúng thứ tự Tài sản đã đầu tư, Trạng thái phát hành, Giao dịch gần đây, Token dự án điện gió; thẻ chứa heading đầu có `data-tone="hl"`; `dt` của Trạng thái phát hành đúng thứ tự 5 nhãn (lấy chữ của `dt`, bỏ "on-chain", "unverified"); `[data-slot="alert"]` chứa "Chưa có thị trường thứ cấp" nằm ngoài `dl`; 3 liên kết danh sách token đúng thứ tự `href` `/tokens/WPT`, `/tokens/WPT-PQY`, `/tokens/WPT-NTH`; `main` không chứa U+00B7, U+2014; số `role` bằng hằng số mốc |
| 2 | `/tokens/WPT` 1440 px: 4 heading cấp 2 đúng thứ tự Vị thế của bạn, Thông tin dự án, Thông tin token, Tình hình vận hành; thẻ đầu `data-tone="hl"`; "Đang giữ" hiện; 2 `[data-kpi]` nhãn Sản lượng luỹ kế (`leaf`), Hệ số công suất (`default`); 6 `li` trong thẻ lọc theo heading "Tình hình vận hành" (`[data-slot="card"]` có heading đó, `locator('li')`). `/tokens/WPT-PQY`: thẻ đầu vẫn là Vị thế của bạn, có câu "Chưa có token trên chuỗi nên chưa có vị thế", không có "Đang giữ". Số `role` cả hai trang bằng hằng số mốc |
| 3 | `/portfolio`, `/tokens/WPT`, `/tokens/WPT-PQY` ở 1440 và 390 px: `scrollWidth` không vượt bề rộng; không `console` loại `error`, không `pageerror`, không cảnh báo hydrate |
| 4 | Số action khi mở màn (vai Nhà đầu tư, chain mock, ngữ cảnh mới mỗi trang): đếm request `POST` có header `next-action` từ trước `goto` tới khi `networkidle` cộng chờ thêm 1 giây (cách đếm như `fix-04-noi-du-lieu-that.spec.ts:23-33`). Đúng bằng: `/portfolio` 1, `/tokens/WPT` 1, `/tokens/WPT-PQY` 0, `/tokens/WPT-NTH` 0 (so `toBe`, không `toBeLessThanOrEqual`). Chú thích trong test: `/portfolio` có ví (3) không dựng được, xem QĐ-2 |

Trên mock, Tổng quan không có ví trình duyệt (Tài sản, Giao dịch ở nhánh chưa kết nối) và chi tiết token không có khối `role` phụ thuộc số dư, nên số `role` không đổi theo dữ liệu các tệp e2e chạy trước; không cần nhánh bỏ đếm. Nếu đo thấy số `role` đổi theo dữ liệu thì dừng và báo, không tự thêm điều kiện.

Luồng mua, số dư thay đổi, giá mới do `ops-transactions.spec.ts`, `fe-07-price-config.spec.ts` phủ.
