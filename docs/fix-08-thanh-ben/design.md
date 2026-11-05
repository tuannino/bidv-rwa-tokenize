# FIX-08: thiết kế

## 1. Cách làm

`activeNavHref` gom mọi `href` của menu đang hiển thị rồi chọn `href` khớp dài nhất. Ví dụ menu Người bán có `/seller`, `/seller/transactions`, `/seller/withdraw`, `/wallet`, `/account`:

| `pathname` | Khớp (quy tắc cũ) | Sáng (mới) |
|---|---|---|
| `/seller` | `/seller` | `/seller` |
| `/seller/transactions` | `/seller`, `/seller/transactions` | `/seller/transactions` |
| `/seller/withdraw` | `/seller`, `/seller/withdraw` | `/seller/withdraw` |
| `/wallet` | `/wallet` | `/wallet` |

Menu Giao dịch viên: `/transactions/abc` khớp `/transactions` (sáng như cũ); `/` chỉ khớp `/`. Quy tắc tiền tố cần dấu `/`: với danh sách giả `["/wallet", "/wallet-binding"]`, `/wallet-binding` không khớp `/wallet`. Mục nằm trong nhóm ẩn của `withHiddenOps` (`/demo-payment`, `/wallet-binding`) tham gia như mọi mục khác.

## 2. Kiểm thử mới

`app/test/fix-08.test.ts` (môi trường `node`):

1. **`activeNavHref`:** bảng ở mục 1; danh sách `["/wallet", "/wallet-binding"]`: `/wallet-binding` ra `/wallet-binding`, `/wallet/x` ra `/wallet`, `/walletx` ra `null`; thêm `/` với `pathname` `/` ra `/`, với `/draft` không ra `/`; danh sách rỗng ra `null`; `pathname` không khớp mục nào (`/tokens/WPT` ở menu Nhà đầu tư) ra `null`; hai `href` lồng ba tầng (`/a`, `/a/b`, `/a/b/c`) với `/a/b/c/d` ra `/a/b/c`; thứ tự trong danh sách không ảnh hưởng kết quả.
2. **So với quy tắc cũ trên mọi trang có thật:** dựng danh sách đường dẫn từ `app/src/app/**/page.tsx` (cách duyệt như `four-roles-routes.test.ts:36-54`, đoạn động `[x]` thay bằng `x`); với mỗi vai lấy menu `NAV_BY_ROLE[role]` qua `withHiddenOps(…, { demoPayment: true, walletBinding: true })` (để gồm cả nhóm ẩn); với mỗi đường dẫn tính tập mục sáng theo quy tắc cũ (viết lại trong test đúng biểu thức `sidebar.tsx:129-132` cũ) và mục sáng mới. Kỳ vọng: mới sáng nhiều nhất một mục; nếu cũ sáng đúng 0 hoặc 1 mục thì mới giống hệt cũ; nếu cũ sáng từ 2 mục thì mới là mục dài nhất trong số đó. Danh sách mọi chỗ cũ sáng từ 2 mục (chuỗi `"{vai} {đường dẫn}"`, sắp theo vai rồi đường dẫn) được KHOÁ bằng `expect(duplicates).toEqual([...])` với danh sách chép cứng trong test (dự kiến đúng hai dòng `SELLER /seller/transactions`, `SELLER /seller/withdraw`; dev xác nhận trên mã cũ ở tasks bước 3 rồi chép vào test và checkpoint): một đường dẫn mới sáng hai mục sau này sẽ làm test đỏ. Thêm phép kiểm: với mỗi vai, menu sau `withHiddenOps` không có hai mục cùng `href` (để `item.href === activeHref` không bao giờ cho hai mục sáng).
3. **Mã nguồn:** `sidebar.tsx` có `activeNavHref(` đúng một lần, có nguyên văn `!item.disabled && item.href === activeHref`, có `aria-current={active ? "page" : undefined}` (hoặc cách viết tương đương cho ra đúng thuộc tính khi sáng và không có khi không sáng, ghi checkpoint), không còn `pathname.startsWith(item.href` trong `sidebar.tsx`; ba tệp khung `sidebar.tsx`, `channel-switcher.tsx`, `chain-selector.tsx` không còn U+00B7, U+2014 trên dòng nào trừ dòng chú thích (cùng quy tắc 6e); `channel-switcher.tsx` có `({SAMPLE_ACCOUNTS[channel]})`; `chain-selector.tsx` không còn `destructive`. Trong mã test viết ký tự cấm bằng escape `\u00b7`, `\u2014`.

`app/e2e/fix-08-thanh-ben.spec.ts` (chỉ project mock, 1440 px trừ khi ghi khác; không đổi dữ liệu). Mục sáng đếm bằng `aside nav a[aria-current="page"]`.

| Ca | Kiểm |
|---|---|
| 1 | Người bán: `/seller` đúng 1 mục sáng, `[data-nav-label]` trong mục đó chữ "Tổng quan" (thẻ `a` còn chứa ô phím tắt nên không so chữ cả thẻ); `/seller/transactions` đúng 1, nhãn "Danh sách giao dịch"; `/seller/withdraw` đúng 1, nhãn "Tạo lệnh rút"; ở cả ba màn, mục sáng có lớp `bg-primary`, các mục còn lại không có lớp `bg-primary`. 390 px `/seller/withdraw`: bấm "Mở menu", trong ngăn kéo đúng 1 mục sáng, nhãn "Tạo lệnh rút" |
| 2 | Giao dịch viên: `/` đúng 1 mục sáng (mục đầu menu, `href="/"`); `/transactions` đúng 1, `href="/transactions"`; mở `/transactions/khong-co` (trang chi tiết luôn bọc `AppLayout`, không gọi `notFound`, nên thanh bên vẫn dựng dù mã không tồn tại; không phụ thuộc dữ liệu): đúng 1 mục sáng `href="/transactions"`. Nhà đầu tư `/tokens/WPT`: 0 mục sáng (màn không có trong menu, như cũ) |
| 3 | Ô chọn vai có 4 lựa chọn chữ đúng thứ tự "Nhà đầu tư (NDT001)", "Người bán (NB001)", "Giao dịch viên (GDV001)", "Kiểm soát viên (KSV001)"; không lựa chọn nào của ô chọn vai và ô chọn chain chứa U+00B7, U+2014; `option[value="stellar"]` của ô chọn chain có `disabled` và chữ kết thúc bằng ": chưa dùng được" (Stellar luôn chưa dùng được trên mock; EVM tuỳ `RPC_EVM` của máy nên không kiểm); câu lỗi của ô chọn chain (nếu hiện) không có lớp `text-destructive` (khoá ở unit nhóm 3) |
