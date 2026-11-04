# FE-UX-04c: thiết kế

Nguồn hình ảnh: `docs/prototypes/20261101_ui_ux_ban_chot/orders.html`, `order-detail.html`, `wallet.html`, `assets/c.css`. Thành phần: dùng nguyên API của FE-UX-02a đến 04a. Mốc lưới viết bằng `min-[1100px]:`, `min-[640px]:`.

## 1. Bố cục

| Màn, khối | Bố cục |
|---|---|
| `/orders` đầu màn | `h1`; dưới là `Alert info role="note"` rộng hết |
| `/orders` Bộ lọc | `Card`, tiêu đề có `CardTitleIcon` `Filter`; `form` `grid gap-3 min-[640px]:grid-cols-2 min-[1100px]:grid-cols-5`; ô Mã lệnh bọc `div relative`, biểu tượng `Search` `absolute left-3.5` và `input` thêm `pl-10` |
| `/orders` bảng | `Card` không tiêu đề; hàng tiêu đề nền `bg-muted/60`; nút tiêu đề cột chữ nhỏ đậm; số `tabular-nums` canh phải; mã lệnh `font-code`; `Badge` sắc; liên kết "Chi tiết" chữ `primary` kèm `ChevronRight` |
| `/orders/[id]` | Chỉ ba nhánh trạng thái đổi vỏ (QĐ-4); `OrderDetailContent` như cũ |
| `/wallet` đầu màn | `h1` |
| `/wallet` đã kết nối | `div grid gap-6 min-[1100px]:grid-cols-12`: `Card tone="hl"` `min-[1100px]:col-span-7` (tiêu đề và nhãn mạng một hàng; "Địa chỉ ví" chữ nhỏ; địa chỉ rút gọn `font-code text-3xl font-semibold`; hàng nút sao chép, explorer; dòng cuối kẻ trên: câu Tổng quan bên trái, nút "Ngắt kết nối" bên phải) và `Kpi tone="gold"` `min-[1100px]:col-span-5` (QĐ-5). Mọi `col-span` đều kèm `min-[1100px]:`; viết `col-span-7` trần sẽ sinh 7 cột ngầm ở 390 px |
| `/wallet` mô phỏng, mạng chưa hỗ trợ, chưa kết nối, chưa có ví | `Card` có `CardTitleIcon`; mô tả và nội dung như cũ; danh sách ba ý của chưa kết nối `list-disc pl-5 space-y-1.5` |
| `/wallet` sai mạng, lệch mạng | `Alert bad role="alert"` rộng hết; hàng nút dưới hai đoạn chữ |
| `/wallet` ghi chú phạm vi | `Alert info` không `role`, biểu tượng `ShieldCheck`, cuối màn |

390 px: một cột; bảng lệnh cuộn trong khung (`Table` đã `overflow-x-auto`); trang không cuộn ngang.

## 2. Ràng buộc chung

- Không màu cứng, không `*-destructive` trong các tệp phạm vi (tasks 6b). Thẻ `tone="hl"`: chữ phụ `text-muted-foreground`, nút `variant="outline"` đọc được trên nền xanh ở cả Sáng và Tối (kiểm ảnh).
- Không thêm `role` mới. "Đếm `role`" trong spec này là đếm `[role="status"]`, `[role="note"]`, `[role="alert"]` (thuộc tính tường minh) trong `main` như FE-UX-04a; sau khi tải bằng mốc (e2e ca 1, ca 2).

## 3. Kiểm thử mới

`app/test/fe-ux-04c.test.ts` (môi trường `node`, `renderToStaticMarkup`):

1. **Mã nguồn:** số lời gọi QĐ-2; `investor-orders.tsx` không còn `const FIELD`, có `orderStatusTone(`; `wallet-connect.tsx` có `export function UnsupportedChainNotice`, không còn U+00B7, U+2014 trên dòng nào trừ dòng (sau khoảng trắng đầu) bắt đầu bằng `*`, `//`, `/*`, `{/*` (cùng quy tắc 6e; `:126` là `/** R4.3 …` nên được bỏ qua). Trong mã test viết hai ký tự này bằng escape `\u00b7`, `\u2014`, không viết nguyên ký tự (6c, 6e quét cả tệp test). Dev xác nhận các số trên bản mốc, ghi trong checkpoint.
2. **`WrongChainBanner`** (`currentLabel` "chain ID 1", `expectedLabel` "Hardhat Local"): `role="alert"`, `data-slot="alert"`; chữ "Ví đang ở mạng khác", hai nhãn; nút "Chuyển ví sang Hardhat Local" không `disabled`; `switching: true` thì nút có `disabled` và chữ "Đang chờ ví…"; `error` thì có `role="status"` chứa câu lỗi; `children` được dựng.
3. **`WalletStatusCard`** (`vi.mock('@/lib/hooks/use-native-balance')` trả từng trạng thái; `address` 42 ký tự): có số dư thì `[data-kpi]` `data-tone="gold"` chứa số và ký hiệu; đang đọc thì "đang đọc…"; lỗi thì câu lỗi; không số dư thì "chưa có"; mọi trạng thái: `data-tone="hl"` ở thẻ, địa chỉ rút gọn có `title` bằng địa chỉ đầy đủ, đoạn `sr-only` "Địa chỉ đầy đủ: {address}", nút `aria-label="Sao chép địa chỉ ví {address}"`, nút "Ngắt kết nối", câu "Số WPT đang giữ xem ở trang Tổng quan."; chain có explorer (`evm`) có `<a` `target="_blank"`, chain `hardhat-local` không có `<a`; khung ngoài có lớp `min-[1100px]:grid-cols-12`, thẻ có `min-[1100px]:col-span-7`, `[data-kpi]` có `min-[1100px]:col-span-5`, và không phần tử nào có lớp `col-span-` không kèm tiền tố `min-[1100px]:` (trạng thái đã kết nối không dựng được trên mock nên e2e không đo được bố cục này; ảnh dựng ở 390 px phải cho thấy hai khối xếp dọc, rộng bằng nhau).
4. **`NoWalletGuide`:** heading "Chưa có ví trong trình duyệt"; hai liên kết `href` `https://metamask.io/download/`, `https://rabby.io/`, mỗi liên kết có "(mở tab mới)"; `ol` đúng 3 `li` cấp một; chữ "Tải lại trang này".
5. **`UnsupportedChainNotice`** (nhập từ `wallet-connect.tsx`; nếu nhập tệp này trong môi trường `node` lỗi vì `@rainbow-me/rainbowkit` hay hook ví thì `vi.mock` đúng các mô-đun đó, ghi trong checkpoint, không dời mã) (`chainLabel` "Stellar"): heading "Chưa hỗ trợ ví cho mạng này"; chữ "Stellar"; câu hướng dẫn đổi mạng có ba nhãn mạng của `CHAINS`.

`app/e2e/fe-ux-04c-lenh-vi.spec.ts` (chỉ project mock; KHÔNG đặt lệnh, không đổi dữ liệu; mã lệnh giả `00000000-0000-4000-8000-000000000000` không tồn tại). Chờ tải: `networkidle`, rồi chờ `main` không còn chữ khớp `/Đang (tải|kiểm tra)/` (dùng được cả bản mốc).

| Ca | Kiểm |
|---|---|
| 1 | `/orders` 1440 px, Nhà đầu tư: đúng một `h1` "Quản lý lệnh"; `main` có đúng một `[role="note"]` và đó là `[data-slot="alert"][role="note"]`, chứa "Không cần kết nối ví trình duyệt"; năm ô lọc (theo `aria-label` Mã lệnh, Chiều, Trạng thái, Từ ngày, Đến ngày) cùng hàng (lệch đỉnh dưới 4 px), ở 390 px xếp một cột; đếm `role` trong `main` sau khi tải, trước tương tác, bằng hằng số mốc; nhập mã lệnh giả vào ô Mã lệnh thì `[data-slot="empty-state"]` chứa "Không có lệnh nào khớp bộ lọc." |
| 2 | `/wallet` 1440 px, Nhà đầu tư, chain mock (trước mọi `selectOption` chờ hydrate bằng `button[title^="Chuyển sang"]` như `wallet-connect.spec.ts:33`): heading "Đang ở chế độ mô phỏng"; `main` không `[role="alert"]`; `[data-slot="alert"]` chứa "chỉ dùng cho thao tác của nhà đầu tư" và không có thuộc tính `role`; `main` không chứa U+00B7, U+2014; đếm `role` bằng mốc. Chọn `hardhat-local`: heading "Chưa có ví trong trình duyệt". Ở 390 px: thẻ mô phỏng và khung ghi chú phạm vi xếp dọc (đỉnh khung ghi chú dưới đáy thẻ), độ rộng hai khối lệch dưới 4 px |
| 3 | `/wallet` có `window.ethereum` tối giản (chép khối `wallet-connect.spec.ts:133-148`), chọn `hardhat-local`: heading "Chưa kết nối ví"; danh sách trong thẻ đó đúng 3 `li`, `li` đầu bắt đầu bằng "Bước này chỉ đọc địa chỉ ví"; nút "Kết nối ví" trong `main` |
| 4 | `/orders`, `/orders/<mã giả>`, `/wallet` ở 1440 và 390 px: `main.scrollWidth <= main.clientWidth` (khung app `h-screen overflow-hidden`, `app-layout.tsx:55`, `:68`, nên `document.documentElement.scrollWidth` không bao giờ vượt; bảng cuộn trong `[data-slot="table-container"]` là hợp lệ); không `console` loại `error`, không `pageerror`, không cảnh báo hydrate |
| 5 | Số action khi mở màn (ngữ cảnh mới mỗi trang, cách đếm như `fix-04-noi-du-lieu-that.spec.ts:23-33` cộng chờ 1 giây sau `networkidle`): `/orders` 1, `/orders/<mã giả>` 1, `/wallet` 0 (`toBe`) |

Luồng có lệnh thật, chi tiết lệnh có dữ liệu, ví đã kết nối do `ops-transactions.spec.ts`, `permit-order.spec.ts` (Hardhat) phủ.
