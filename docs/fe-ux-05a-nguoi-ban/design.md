# FE-UX-05a: thiết kế

Nguồn hình ảnh: `docs/prototypes/20261101_ui_ux_ban_chot/seller.html`, `seller-transactions.html`, `assets/c.css`. Thành phần: dùng nguyên API của FE-UX-02a đến 04c. Mốc lưới viết bằng `min-[1100px]:`, `min-[640px]:`; mọi `col-span` kèm tiền tố mốc.

## 1. Bố cục

| Màn, khối | Bố cục |
|---|---|
| `/seller` đầu màn | `header` `flex flex-wrap items-center justify-between gap-4`: `h1` trái, `nav` Lối tắt phải; dưới là `TokenScopeSelect` |
| Token khớp lệnh trong ngày | `section`: `h2` chữ `text-base font-medium` kèm biểu tượng; `grid gap-4 min-[640px]:grid-cols-2 min-[1100px]:grid-cols-4`, mỗi ô `div.rounded-lg` bọc một `Kpi` (QĐ-5) |
| Nguồn cung, Thông tin token | `grid gap-6 min-[1100px]:grid-cols-2`; `Card` có `CardTitleIcon`; dòng `py-3` kẻ ngăn; số đậm canh phải; nhãn trạng thái là `Badge` |
| Tồn kho token | `Card` rộng hết; bảng như cũ, số `tabular-nums` canh phải |
| Hai thẻ ví | `grid gap-6 min-[1100px]:grid-cols-2`; trong mỗi thẻ lưới `grid gap-3 min-[640px]:grid-cols-2` các ô `Stat`, ô còn rút được nền vàng; dòng địa chỉ vault, câu luật khoá chữ nhỏ; cảnh báo `Alert bad` |
| `/seller/transactions` | `h1`; `Card` chứa `form` lọc (5 cột từ 1100 px), bảng, phân trang (chữ trái, hai nút phải) |

390 px: một cột; bảng cuộn trong `[data-slot="table-container"]`; `main` không cuộn ngang.

## 2. Ràng buộc chung

- Không màu cứng, không `*-destructive` (tasks 6b). Ô `tile-gold`, `Kpi` `hl`, `gold` đọc được ở Sáng và Tối (kiểm ảnh).
- Không thêm `role` mới. "Đếm `role`" là đếm `[role="status"]`, `[role="note"]`, `[role="alert"]` trong `main` (như FE-UX-04a), sau khi tải, trước tương tác.
- `Kpi` giữ hiệu ứng `lift` như các màn đã làm (02a đến 04c); không tắt riêng ở màn này.

## 3. Kiểm thử mới

`app/test/fe-ux-05a.test.ts` (môi trường `node`, `renderToStaticMarkup`, `createElement`; viết ký tự cấm bằng escape `\u00b7`, `\u2014`):

1. **Mã nguồn:** số lời gọi QĐ-2; `seller-overview-body.tsx`, `format.ts` không có `Action(`, `useEffect(`, `useState(`; `seller-overview.tsx` có `data-chain={chain}` và dòng export lại `nf`, `describePolicy`; `seller-transactions.tsx` có nguyên văn `disabled={page <= 1}`, `disabled={!data || page >= pages}`, nhập `nf` từ `@/components/seller/format`, không còn `const FIELD`; mọi dòng nhập từ `@/lib/bank/seller.service` trong tệp mới bắt đầu bằng `import type`; `seller-overview-body.tsx` không chứa `MockBadge` và câu "Hệ thống chưa có lệnh bán lại" (lặp phép kiểm của `fix-04-noi-du-lieu-that.test.ts:272`, `:287`, vốn chỉ đọc `seller-overview.tsx`). Dev xác nhận các số trên bản mốc, ghi trong checkpoint.
2. **`format.ts`:** `nf(null)` và `nf(undefined)` là "–" (U+2013); `nf('1250')` là "1.250"; `nf('abc')` là "abc"; `describePolicy` với `null`, `UNSET`, `FIXED`, `PERCENT` trả đúng bốn câu hiện có (chép nguyên văn từ mã mốc vào test).
3. **`SellerOverviewBody`** (dữ liệu giả đủ kiểu `SellerOverviewView`):

| Dữ liệu giả | Kỳ vọng |
|---|---|
| Đủ số, có token, có ví thanh toán, không cảnh báo | 4 `[data-kpi]` theo thứ tự `data-tone` `hl`, `gold`, `default`, `default`, nhãn Số lượng mua, Tổng giá trị mua, Số lượng bán, Tổng giá trị bán; mỗi ô có cha trực tiếp là `div` có đúng lớp `rounded-lg`; 5 `[data-metric]` đúng thứ tự `cap`, `remaining`, `totalSupply`, `undistributed`, `circulating`; chữ "Địa chỉ vault:"; không `role="alert"`; ô "VNDB còn rút được", "Hạn mức còn rút được" có lớp `tile-gold` |
| `wallet.warning` có chữ | đúng 2 `role="alert"` chứa chữ cảnh báo |
| `tokens: []` | "Chưa có dự án trên chuỗi này." đúng 2 lần |
| `wallet.paymentWallet: null` | "Chưa phát hành lần nào nên chưa có ví thanh toán." |
| `today.sell` là `{ count: 0, wpt: '0', vnd: '0' }` | ô Số lượng bán có giá trị "0", `sub` "0 lệnh" (kiểu `sell` không rỗng được, `seller.service.ts:87`) |
| `token.tradingOpen: false` | nhãn Trạng thái giao dịch là `Badge` sắc `warn` |

4. **Bảng sắc:** `WITHDRAW_STATUS_TONES` có đúng các khoá của `WITHDRAW_STATUS_LABELS`, giá trị đúng QĐ-6.

`app/e2e/fe-ux-05a-nguoi-ban.spec.ts` (chỉ project mock, vai Người bán; không đổi dữ liệu; không giả định có lệnh). Chờ tải: `networkidle`, rồi chờ `main` không còn chữ "Đang đọc số liệu" (ở `/seller`) hoặc không còn `[data-loading]` và không còn chữ "Đang tải…" trong vùng ngoài `select` (ở `/seller/transactions`; bản mốc chưa có `data-loading`).

| Ca | Kiểm |
|---|---|
| 1 | `/seller` 1440 px: đúng một `h1` "Tổng quan"; `nav[aria-label="Lối tắt"]` có 2 liên kết `href` `/seller/transactions`, `/seller/withdraw`; `#token-scope` hiện; 4 `[data-kpi]` cùng hàng (lệch đỉnh dưới 4 px), `data-tone` đúng thứ tự `hl`, `gold`, `default`, `default`; 5 `[data-metric]`; đếm `role` bằng mốc. 390 px: 4 ô xếp một cột |
| 2 | `/seller/transactions` 1440 px: đúng một `h1` "Danh sách giao dịch"; 5 ô lọc (theo `aria-label`) cùng hàng; chọn Loại "Rút" thì danh sách lựa chọn của ô Trạng thái đúng thứ tự (kể cả trùng): "Mọi trạng thái" rồi 9 nhãn của `WITHDRAW_STATUS_LABELS` theo thứ tự `WITHDRAW_STATUSES` (hai nhãn "Đang đặt ví nhận" trùng nhau; chép cứng danh sách vào test, không nhập từ tệp `'use client'`), và không có "Đang khớp", "Bị từ chối" (hai nhãn chỉ lệnh mua bán có); dòng phân trang không chứa U+00B7; đếm `role` (trước khi chọn) bằng mốc |
| 3 | Hai màn ở 1440 và 390 px: `main.scrollWidth <= main.clientWidth`; không `console` loại `error`, không `pageerror`, không cảnh báo hydrate |
| 4 | Số action khi mở màn (ngữ cảnh mới mỗi trang, cách đếm như `fix-04-noi-du-lieu-that.spec.ts:23-33` cộng chờ 1 giây sau `networkidle`): `/seller` 1, `/seller/transactions` 1 (`toBe`) |

Luồng có lệnh mua, bán, rút do `ops-transactions.spec.ts`, `vault-withdraw.spec.ts` phủ.
