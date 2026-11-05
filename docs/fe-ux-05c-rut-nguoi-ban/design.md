# FE-UX-05c: thiết kế

Nguồn hình ảnh: `docs/prototypes/20261101_ui_ux_ban_chot/seller-withdraw.html`, `assets/c.css`. Thành phần: dùng nguyên API của FE-UX-02a đến 05a; màn mẫu `investor-withdraw.tsx` (04d) cho ô có trang trí, `Alert` kết quả, hộp mã. Mốc lưới viết bằng `min-[1100px]:`, `min-[640px]:`; mọi `col-span` kèm tiền tố mốc.

## 1. Bố cục (1440 px)

| Khối | Bố cục |
|---|---|
| Đầu màn | `h1` "Tạo lệnh rút"; dưới là `TokenScopeSelect` như hiện tại |
| Lưới | `grid gap-6 min-[1100px]:grid-cols-12`; Thông tin lệnh rút `min-[1100px]:col-span-7`; Hệ thống tính `min-[1100px]:col-span-5`; hai thẻ cao bằng nhau (lưới kéo giãn mặc định) |
| Thông tin lệnh rút | Ô xếp dọc `space-y-4`, nhãn trên ô; ô Mạng, Ví nhận có biểu tượng trái (`absolute left-3.5`, ô `pl-10`); nút "Dùng ví đang kết nối" cỡ `sm` dưới ô Ví nhận (chỉ chain khác mock); câu đổi ví nhận chữ nhỏ; câu lỗi; câu chặn `Alert warn`; hàng cuối nút "Tạo lệnh rút" và `Alert` kết quả |
| Hệ thống tính | 4 dòng kẻ ngăn, nhãn trái số phải, dòng Số tiền nhận được đậm; hai câu ghi chú có biểu tượng đầu dòng |
| Yêu cầu rút của tôi | `Card` rộng hết; bảng 8 cột; nút trong dòng cỡ `sm`; rỗng `EmptyState` |
| Hộp mã một lần | Giữ `Dialog`; ô mã lớn canh giữa |

390 px: một cột; Hệ thống tính dưới Thông tin lệnh rút; bảng cuộn trong `[data-slot="table-container"]`; `main` không cuộn ngang.

## 2. Ràng buộc chung

- Không màu cứng, không `*-destructive` (tasks 6b).
- Không thêm `role` mới. "Đếm `role`" là đếm `[role="status"]`, `[role="note"]`, `[role="alert"]` trong `main` (như FE-UX-04a), sau khi tải, trước tương tác, bằng mốc (e2e ca 1).
- Trang trí trong khung ô không phải `label`, không có `aria-label` (`vault-withdraw.spec.ts` gọi `getByLabel` cấp trang chế độ strict).

## 3. Kiểm thử mới

`app/test/fe-ux-05c.test.ts` (môi trường `node`, `renderToStaticMarkup`, `createElement`; vitest chỉ nhận `test/**/*.test.ts`; viết ký tự cấm bằng escape `\u00b7`, `\u2014`):

1. **Mã nguồn** (so sau khi gộp khoảng trắng `replace(/\s+/g, ' ')`): số lời gọi QĐ-2 trong `seller-withdraw.tsx`; trang chứa nguyên văn `reconcileAndListMyWithdrawRequestsAction({ chain })`, `disabled={!canSubmit}`, `disabled={!address}`, `disabled={!/^\d{6}$/.test(otp) || submitting}`, `aria-label="Kết quả lệnh rút"`, `data-testid="withdrawable"`, `data-testid="otp-payout-wallet"`, `aria-label="Yêu cầu rút của tôi"`, `<SellerWithdrawRow key={r.id}`, `<Alert tone="warn" role="note"`, `role={feedback.tone === 'error' ? 'alert' : 'status'}`; trang không còn `const FIELD`, `const short`, `-destructive`, `explorerTxUrl`; `seller-withdraw-row.tsx` không có `Action(`, `useEffect(`, `useState(`, có `import { short } from '@/components/withdraw/format'` và `import { nf } from '@/components/seller/format'`, `WITHDRAW_STATUS_TONES[row.status]`, `row.status === 'PAYOUT_SET'`; mọi câu `import` từ `@/lib/bank/withdraw.service` trong tệp dòng và trang là `import type` (trang vẫn nhập giá trị `quoteWithdraw` từ `@/lib/bank/withdraw-limit`, hợp lệ) (kiểm theo câu lệnh, kể cả nhiều dòng: regex `/^import\s+(?!type\b)[^;]*from '@\/lib\/bank\/withdraw\.service'/m` không khớp); không lớp `col-span-` nào trong trang thiếu tiền tố mốc. Dev xác nhận trên bản mốc các số có sẵn của QĐ-2, ghi trong checkpoint.
2. **`SellerWithdrawRow`** (dựng trong `<table><tbody>…</tbody></table>`; dữ liệu giả đủ kiểu `WithdrawRequestView`; `onContinue`, `onCancel` là hàm rỗng):

| Dữ liệu giả | Kỳ vọng |
|---|---|
| `COMPLETED`, `txHash` 66 ký tự, chain `mock` | `data-status="COMPLETED"`; không `<a`; `span` có `title` bằng mã đầy đủ, chữ `short(txHash)`; nhãn "Hoàn tất" lớp `bg-ok-bg`; không `<button` |
| `COMPLETED`, `txHash`, chain `evm` (có explorer) | `<a` `target="_blank"` `rel="noreferrer"`, `href` bằng `explorerTxUrl('evm', txHash)`, chữ `short(txHash)` |
| `PAYOUT_SET`, `txHash: null` | đúng 2 `<button`, chữ "Gửi lệnh rút", "Huỷ"; nhãn "Đã đặt ví nhận, chờ gửi rút" lớp `bg-warn-bg`; ô giao dịch rỗng |
| `NEEDS_REVIEW`, `reason` có chữ | nhãn "Cần Kiểm soát viên xem" có `title` bằng `reason`; không `<button` |
| `FAILED`, `reason: null` | nhãn "Thất bại" lớp `bg-bad-bg`, không thuộc tính `title` trên nhãn |

3. **Nối callback của dòng `PAYOUT_SET`** (không cần DOM, không gửi giao dịch): `SellerWithdrawRow` là hàm thuần không dùng hook, nên gọi thẳng `SellerWithdrawRow({ row, chain: 'mock', onContinue, onCancel })` với `onContinue`, `onCancel` là `vi.fn()`, rồi duyệt cây phần tử React trả về (đệ quy theo `props.children`, mảng và phần tử lồng) để tìm hai phần tử có `type === Button` và chữ con là "Gửi lệnh rút", "Huỷ" (đúng một phần tử mỗi chữ). Gọi `props.onClick()` của nút "Gửi lệnh rút": `onContinue` được gọi đúng 1 lần, `onCancel` 0 lần. Đặt lại hai `vi.fn()`, gọi `props.onClick()` của nút "Huỷ": `onCancel` đúng 1 lần, `onContinue` 0 lần. Dòng `COMPLETED` không có phần tử `Button` nào. Phép kiểm phải bắt đột biến đổi chéo hai handler (Supervisor thử, requirements mục 5); dev tự thử đột biến này và ghi kết quả trong checkpoint.

Mọi dòng (nhóm 2): ô mã chữ `id.slice(0, 8)` có `title` bằng `id`; ô ví nhận chữ `short(payoutWallet)` có `title`; số tiền `nf(amount)` với `nf` nhập từ `@/components/seller/format`.

`app/e2e/fe-ux-05c-rut-nguoi-ban.spec.ts` (chỉ project mock, vai Người bán; KHÔNG tạo lệnh, không đổi dữ liệu; tệp chạy trước `ops-transactions.spec.ts`, `vault-withdraw.spec.ts`. Trạng thái mock trên máy chủ mới: luôn có vault (`MOCK_VAULT_ADDRESS`), khoá `UNSET`, số dư 0 nên Phần được rút "0", không câu chặn, ví đang đặt `null` nên ô Ví nhận rỗng (notes ghi "Trên mock là ví NB001" chỉ đúng sau khi chạy `vault-withdraw`; ghi lệch này vào bảng đối chiếu). Test không giả định có lệnh). Chờ tải: `networkidle`, rồi chờ `main` không còn chữ "Đang đọc số dư" (dùng được cả bản mốc).

| Ca | Kiểm |
|---|---|
| 1 | 1440 px: đúng một `h1` "Tạo lệnh rút"; `#token-scope` hiện; thẻ chứa heading "Thông tin lệnh rút" nằm bên trái thẻ chứa `[data-testid="withdrawable"]` (x nhỏ hơn, lệch đỉnh dưới 4 px, thẻ trái rộng hơn thẻ phải); thẻ phải có đúng 4 `dt` theo thứ tự Số dư VNDB của vault, Phần khoá, Phần được rút, Số tiền nhận được; chữ "Phí ngân hàng ngoài chuỗi: chưa áp dụng (POC)." hiện; bảng "Yêu cầu rút của tôi" hoặc `[data-slot="empty-state"]` chứa "Chưa có yêu cầu rút nào trên chain này." hiện; đếm `role` bằng mốc (dự kiến 0) |
| 2 | Điền "Mục đích", rồi điền "Ví nhận" (exact) bằng ví NDT001 của `sample-wallets.json` (khác ví đang đặt): `[role="note"]` chứa "Đổi ví nhận: hệ thống gửi thêm một giao dịch đặt ví nhận trước khi rút." hiện; `main` không chứa "Chain này chưa có vault", "Vault đang tạm dừng rút"; nhập "999999999999999" vào "Số tiền rút (VNDB)": `[role="alert"]` trong `main` chứa "Vượt phần được rút: chỉ rút được tối đa"; nút "Tạo lệnh rút" `disabled`. Không bấm nút. Ở 390 px: thẻ chứa `withdrawable` nằm dưới nút "Tạo lệnh rút", hai thẻ rộng bằng nhau (lệch dưới 4 px) |
| 3 | 1440 và 390 px: `main.scrollWidth <= main.clientWidth`; không `console` loại `error`, không `pageerror`, không cảnh báo hydrate |
| 4 | Số action khi mở `/seller/withdraw` (ngữ cảnh mới, cách đếm như `fix-04-noi-du-lieu-that.spec.ts:23-33` cộng chờ 1 giây sau `networkidle`): bằng mốc, dự kiến 2 (`toBe`); mốc lấy bằng chạy chính tệp này trên bản build mốc qua `E2E_BASE_URL` |

Luồng tạo lệnh, mã một lần, kết quả, dòng "Hoàn tất" do `vault-withdraw.spec.ts` phủ (mock và Hardhat).
