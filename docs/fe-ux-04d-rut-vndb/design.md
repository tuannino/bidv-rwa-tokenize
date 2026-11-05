# FE-UX-04d: thiết kế

Nguồn hình ảnh: `docs/prototypes/20261101_ui_ux_ban_chot/withdraw.html`, `assets/c.css`. Thành phần: dùng nguyên API của FE-UX-02a đến 04a. Mốc lưới viết bằng `min-[1100px]:`, `min-[640px]:`.

## 1. Bố cục (`/withdraw`, 1440 px)

| Khối | Bố cục |
|---|---|
| Đầu màn | `h1` "Rút VNDB" |
| Lưới | `grid gap-6 min-[1100px]:grid-cols-12`; Thông tin lệnh rút `min-[1100px]:col-span-7`; Hệ thống tính `min-[1100px]:col-span-5`, nội dung `flex flex-col`, ô `Kpi` dính đáy thẻ (`mt-auto`) như bản chốt |
| Thông tin lệnh rút | Ô xếp dọc `space-y-4`, nhãn trên ô; ô có trang trí bọc `div relative`, biểu tượng trái `absolute left-3.5` và ô thêm `pl-10`, hậu tố phải `absolute right-3.5` và ô thêm `pr-16`; Ví gửi và nhãn "Đã định danh" một hàng; câu gợi ý ví nhận chữ nhỏ; nút "Tạo lệnh rút"; dòng `busy`; khung kết quả |
| Hệ thống tính | `dl` hai dòng, nhãn trái số phải; câu phí gas (chỉ chain thật); `Kpi tone="au"` `mt-auto` dính đáy thẻ; `CardContent` của thẻ này là `flex flex-1 flex-col` |
| Lệnh rút của tôi | `Card` rộng hết; bảng 8 cột; nút trong dòng cỡ `sm` |
| Hộp mã một lần | Giữ `Dialog`; ô mã lớn canh giữa |
| Chưa kết nối ví | `h1` rồi `EmptyState` |

390 px: một cột; Hệ thống tính dưới Thông tin lệnh rút; bảng cuộn trong `[data-slot="table-container"]`; `main` không cuộn ngang.

## 2. Ràng buộc chung

- Không màu cứng, không `*-destructive` (tasks 6b).
- Không thêm `role` mới. "Đếm `role`" là đếm `[role="status"]`, `[role="note"]`, `[role="alert"]` trong `main` (như FE-UX-04a), sau khi tải, trước tương tác, bằng mốc (e2e ca 1).
- Trang trí trong khung ô không phải `label`, không có `aria-label` (e2e gọi `getByLabel` cấp trang chế độ strict).

## 3. Kiểm thử mới

`app/test/fe-ux-04d.test.ts` (môi trường `node`, `renderToStaticMarkup`, `createElement`; vitest chỉ nhận `test/**/*.test.ts`):

1. **Mã nguồn:** số lời gọi QĐ-2 trong `investor-withdraw.tsx`; `withdraw-request-row.tsx`, `format.ts` không có `Action(`, `useEffect(`, `useState(`; `investor-withdraw.tsx` không còn `const FIELD`, `const short`, `const nf`; các biểu thức khoá có nguyên văn (so sau khi gộp khoảng trắng `replace(/\s+/g, ' ')`): `disabled={!canSubmit}`, `disabled={!/^\d{6}$/.test(otp) || busy !== null}`, `busy={busy !== null}`; `withdraw-request-row.tsx` có `disabled={busy}` đúng 3 lần; mọi dòng nhập từ `@/lib/bank/payment-withdraw.service` trong `withdraw-request-row.tsx`, `format.ts`, `investor-withdraw.tsx` đều bắt đầu bằng `import type`. Dev xác nhận các số trên bản mốc, ghi trong checkpoint.
2. **`WithdrawRequestRow`** (dựng trong `<table><tbody>…</tbody></table>`; dữ liệu giả đủ kiểu `PaymentWithdrawView`):

| Dữ liệu giả | Kỳ vọng |
|---|---|
| `CREATED`, `busy: false`, chưa có mã giao dịch | `data-status="CREATED"`; nút "Gửi từ ví" và "Huỷ" không `disabled`; ô mã giao dịch rỗng |
| `CREATED`, `busy: true` | hai nút có `disabled` |
| `SENDING`, `busy: false` | câu "Đang chờ ví ký hoặc kết quả trên chuỗi", nút "Huỷ", không nút "Gửi từ ví" |
| `SUBMITTED`, `submittedTxHash`, chain có `explorerBaseUrl` (`evm`) | `<a` `target="_blank"`, `href` bằng `explorerTxUrl('evm', hash)`, chữ `short(hash)`; không nút |
| `COMPLETED`, `completedTxHash`, chain `mock` | không `<a`; `span` có `title` bằng mã đầy đủ; chữ "Hoàn tất"; không nút |
| `CANCELLED`, `reason` | chữ "Đã huỷ" và chữ lý do |

Mọi dòng: mã 8 ký tự có `title` bằng `id`; ví nhận `short(toWallet)` có `title`; `Badge` có lớp của sắc theo `PAYMENT_WITHDRAW_STATUS_TONES`.

3. **Bảng sắc:** `PAYMENT_WITHDRAW_STATUS_TONES` có đúng 7 khoá trùng khoá của `PAYMENT_WITHDRAW_STATUS_LABELS`, giá trị đúng QĐ-6.

`app/e2e/fe-ux-04d-rut-vndb.spec.ts` (chỉ project mock, vai Nhà đầu tư; KHÔNG tạo lệnh, không đổi dữ liệu; tệp chạy trước `investor-withdraw.spec.ts` nên số dư có thể là 0, không giả định số dư). Chờ tải: `networkidle`, rồi chờ `main` không còn chữ "Đang đọc số dư" (dùng được cả bản mốc).

| Ca | Kiểm |
|---|---|
| 1 | 1440 px: đúng một `h1` "Rút VNDB"; `form` "Biểu mẫu rút VNDB" có ô "Ví gửi" giá trị ví hồ sơ; thẻ chứa form nằm bên trái thẻ chứa `[data-testid="payment-balance"]` (x nhỏ hơn, lệch đỉnh dưới 24 px); `[data-kpi][data-tone="au"]` chứa "Số dư sau rút"; ô này nằm trong thẻ Hệ thống tính và đáy ô cách đáy thẻ không quá 40 px (`getBoundingClientRect().bottom`; thẻ là `[data-slot="card"]` chứa `payment-balance`), đồng thời đỉnh ô cách đáy `dl` hơn 24 px khi thẻ Thông tin lệnh rút cao hơn (khẳng định ô dính đáy chứ không nằm ngay sau `dl`); rê chuột lên ô rồi chờ 500 ms: `getComputedStyle` có `transform` là `none` và `boxShadow` là `none`; `[data-wallet-bound="true"]` hiện; bảng "Lệnh rút của tôi" hoặc `[data-slot="empty-state"]` chứa "Chưa có lệnh rút VNDB nào" hiện; đếm `role` bằng mốc |
| 2 | Điền "Ví nhận" (ví NB001 của `sample-wallets.json`) và "Mục đích" (không bấm nút, không đổi dữ liệu), rồi nhập "999999999999999" vào "Số tiền rút (VNDB)": `[role="alert"]` trong `main` chứa "Vượt số dư: chỉ rút được tối đa"; nút "Tạo lệnh rút" `disabled` (chỉ vì vượt số dư: hai ô còn lại đã có chữ). Ở 390 px: thẻ chứa `payment-balance` nằm dưới nút "Tạo lệnh rút", hai thẻ trên rộng bằng nhau (lệch dưới 4 px) |
| 3 | 1440 và 390 px: `main.scrollWidth <= main.clientWidth`; không `console` loại `error`, không `pageerror`, không cảnh báo hydrate |
| 4 | Số action khi mở `/withdraw` (ngữ cảnh mới, cách đếm như `fix-04-noi-du-lieu-that.spec.ts:23-33` cộng chờ 1 giây sau `networkidle`): đúng 1 (`toBe`) |

Luồng tạo lệnh, mã một lần, kết quả, dòng "Hoàn tất" do `investor-withdraw.spec.ts` phủ.
