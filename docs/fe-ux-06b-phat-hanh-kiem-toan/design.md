# FE-UX-06b: thiết kế

Không có bản chốt cho `/mint`, `/audit` (kế hoạch 03/11: "chỉ áp hệ thiết kế"). Mẫu trình bày lấy từ các màn đã làm: thẻ biểu mẫu và thẻ trạng thái như `/withdraw` (04d), bảng như `/seller/transactions` (05a), khối thông báo như `/seller/withdraw` (05c). Thành phần: dùng nguyên API của FE-UX-02a đến 05c. Mốc lưới viết bằng `min-[1100px]:`, `min-[640px]:`; mọi `col-span` kèm tiền tố mốc.

## 1. Bố cục (1440 px)

| Màn, khối | Bố cục |
|---|---|
| `/mint` đầu màn | `h1` (trong `HoverHint`); dưới là `Alert info` giới thiệu |
| `/mint` lưới | Nhà đầu tư 8 cột, Trạng thái on-chain 4 cột, cao bằng nhau; Lịch sử giao dịch rộng hết |
| Nhà đầu tư | Ô xếp dọc `space-y-4`, nhãn trên ô, câu gợi ý chữ nhỏ dưới ô; hàng hai nút `flex flex-wrap gap-3`; `Alert` kết quả dưới hàng nút |
| Trạng thái on-chain | 3 dòng kẻ ngăn (Số dư WPT số lớn, Whitelist nhãn, Đóng băng nhãn), hoặc câu chưa có ví |
| Lịch sử giao dịch | Bảng 6 cột, số lượng canh phải; rỗng `EmptyState` |
| `/audit` | `h1` (trong `HoverHint`); một `Card` "Bản ghi gần nhất": bảng 6 cột, cột Chi tiết cắt một dòng có `title` hiện đủ (giữ `truncate` ở bảng, chỉ khối thông tin token bỏ cắt chữ); rỗng `EmptyState`; lỗi `Alert bad` |
| Khối thông tin token | Một cột 10 dòng, nhãn trái, giá trị phải, giá trị dài (hợp đồng, ví) xuống dòng thay vì bị cắt |

390 px: một cột; Trạng thái on-chain dưới Nhà đầu tư; bảng cuộn trong `[data-slot="table-container"]`; `main` không cuộn ngang.

Ghi chú `/audit` cột Chi tiết: thêm `title={entry.detail ?? undefined}` trên ô (hiện chỉ cắt mà không có cách xem đủ); đây là thuộc tính mới duy nhất ngoài lớp, không đổi chữ.

## 2. Ràng buộc chung

- Không màu cứng, không `*-destructive` (tasks 6b).
- Không thêm `role` ngoài `role="heading"` ở các `CardTitle` theo QĐ-3, QĐ-4. "Đếm `role`" là đếm `[role="status"]`, `[role="note"]`, `[role="alert"]` trong `main` (như FE-UX-04a), sau khi tải, trước tương tác, bằng mốc (e2e ca 1).
- `/mint` có đúng một `role="status"` khi có kết quả, không có khi chưa có.

## 3. Kiểm thử mới

`app/test/fe-ux-06b.test.ts` (môi trường `node`, `renderToStaticMarkup`, `createElement`; viết ký tự cấm bằng escape `\u00b7`, `\u2014`; so mã nguồn sau khi gộp khoảng trắng `replace(/\s+/g, ' ')`):

1. **Mã nguồn:**
   - `mint.tsx`: đúng 1 `listTransactionsAction(`, 1 `readBalanceAction(`, 1 `onboardInvestorAction(`, 1 `mintAction(`, 2 `useEffect(`; có nguyên văn `listTransactionsAction({ chain: activeChain, limit: 20 })`, `variant={status.frozen ? 'bad' : 'outline'}`, `variant={status.whitelisted ? 'ok' : 'warn'}` (khoá biểu thức, không thay cho việc dựng trạng thái: ví đóng băng nghiệm thu bằng ảnh và đọc diff), `1. KYC + Whitelist`, `2. Phát hành dữ liệu thử`, `disabled={pending || !wallet || !mayWhitelist}`, `disabled={pending || !wallet || !mayMint}`, `role="status"`, `<TxnHistoryTable txns={txns} />`; không còn `-destructive`, `'destructive'`, chuỗi `rounded-md border border-border bg-background`; không U+00B7, U+2014 trên dòng nào trừ dòng chú thích (cùng quy tắc 6e).
   - `audit/page.tsx`: đúng 1 `listAuditLog(`, không `'use client'`, không `Action(`; có `<AuditTable entries={result.data} />`; không `-destructive`, `'destructive'`, U+2014 (trừ chú thích).
   - `account/page.tsx`: có `role="alert" className="text-sm text-bad-ink"`, không `text-destructive`.
   - `txn-history-table.tsx`, `audit-table.tsx`: không `Action(`, `useEffect(`, `useState(`; mọi câu `import` từ `@/lib/bank/` hoặc `@/lib/store/` là `import type` (kiểm theo câu lệnh, kể cả nhiều dòng).
   - `token-info-block.tsx`: không còn `truncate`, không `sm:grid-cols-2`; có `[overflow-wrap:anywhere]`.
   - Không lớp `col-span-` nào trong các tệp phạm vi thiếu tiền tố mốc. Dev xác nhận trên bản mốc các số có sẵn, ghi checkpoint.
2. **`TxnHistoryTable`** (dữ liệu giả đủ kiểu `TxnView`): ba dòng `CONFIRMED`, `FAILED`, `PENDING` cho nhãn lớp `bg-ok-bg`, `bg-bad-bg`, `bg-warn-bg`, chữ nhãn đúng mã trạng thái; dòng `toWallet: null`, `amount: null` có hai ô "–" (U+2013), không U+2014; dòng có ví in `slice(0, 10)…slice(-4)`; 6 ô `data-slot="table-head"` đúng thứ tự chữ; số lượng canh phải.
3. **`AuditTable`:** bốn dòng `ALLOWED`, `SUCCESS`, `DENIED`, `FAILURE` cho `bg-ok-bg`, `bg-ok-bg`, `bg-bad-bg`, `bg-bad-bg`; dòng `target: null`, `detail: null` có "–" ở hai ô, không U+2014; dòng có `target` in 10 ký tự đầu rồi "…"; ô Chi tiết có `title` bằng `detail` khi có; 6 ô tiêu đề đúng thứ tự.
4. **`TokenInfoBlock`:** với `info` đủ trường (hợp đồng và ví 42 ký tự): 10 cặp `dt`/`dd` đúng thứ tự nhãn, mỗi `dt` liền kề `dd` của nó; `dd` không lớp `truncate`; `dd` của Ví thanh toán chứa đủ 42 ký tự; `aria-label="Khối thông tin token"`; ba trạng thái `loading`, `error`, `info: null` ra đúng ba câu hiện có.

5. **Trang `/audit` dựng thật với dữ liệu giả:** `vi.mock('@/lib/bank/audit.service', () => ({ listAuditLog: vi.fn() }))`, `vi.mock('@/components/layout/app-layout', () => ({ AppLayout: ({ children }) => children }))` (khung đọc cookie, không thuộc phép kiểm), nếu `HoverHint` không dựng được thì `vi.mock` thêm và ghi checkpoint; dựng `renderToStaticMarkup(await AuditPage())`. Ba ca: `listAuditLog` trả `{ ok: false, code: 'UNKNOWN', error: 'Lỗi đọc sổ thử' }` thì có `[data-slot="alert"]` `data-tone="bad"` chứa câu lỗi, không `role=`, không bảng; trả `{ ok: true, data: [] }` thì `[data-slot="empty-state"]` chứa "Chưa có bản ghi."; trả một bản ghi `DENIED` thì có bảng và nhãn lớp `bg-bad-bg`. Mọi ca: đúng một `<h1` "Sổ kiểm toán"; `listAuditLog` được gọi đúng một lần với `100`.

`app/e2e/fe-ux-06b-phat-hanh-kiem-toan.spec.ts` (chỉ project mock; tệp chạy trước `maker-checker.spec.ts`, `mint.spec.ts`; KHÔNG bấm nút phát hành với ví đã whitelist (chỉ bấm với ví chưa whitelist ở ca 2: máy chủ từ chối, không gửi giao dịch); bước KYC chỉ ở ca 2 với ví NDT001 của `sample-wallets.json`: ví này có thể đã hoặc chưa whitelist (chạy riêng tệp trên máy chủ mới thì chưa; trong bộ đầy đủ `chain-selector.spec.ts` chạy trước đã whitelist), test chấp nhận cả hai trạng thái trước khi bấm, kết quả sau khi bấm phải là `whitelist=true`; trên mock mới khối thông tin token ở `/draft` có Ví thanh toán "chưa có (chưa phát hành lần nào)" nên việc xuống dòng của chuỗi hex 42 ký tự do unit nhóm 4 khoá). Phần đếm (`role` của ca 1, action của ca 4) viết thành các `test` riêng tên bắt đầu "mốc:" chỉ dựa vào chữ `h1` và cách đếm, không dựa vào bố cục mới, để chạy được trên bản build mốc bằng `--grep mốc:` (tasks bước 2). Chờ tải: `networkidle` cộng 1 giây (debounce 300 ms của `/mint`).

| Ca | Kiểm |
|---|---|
| 1 | Giao dịch viên 1440 px. `/mint`: đúng một `h1`; 3 heading cấp 2 "Nhà đầu tư", "Trạng thái on-chain", "Lịch sử giao dịch (mock)"; thẻ Nhà đầu tư bên trái thẻ Trạng thái on-chain (lệch đỉnh dưới 4 px, thẻ trái rộng hơn); không `role="status"`; đếm `role` bằng mốc. `/audit`: đúng một `h1` "Sổ kiểm toán"; heading cấp 2 "Bản ghi gần nhất"; bảng hoặc `[data-slot="empty-state"]` hiện; đếm `role` bằng mốc. 390 px: thẻ Trạng thái on-chain dưới thẻ Nhà đầu tư, rộng bằng nhau (lệch dưới 4 px) |
| 2 | `/mint`: điền "Ví nhà đầu tư" bằng ví NDT001, chờ thẻ Trạng thái on-chain có chữ "Số dư WPT"; bấm nút `/KYC \+ Whitelist/`: đúng một `[role="status"]` chứa `whitelist=true` và không chứa U+00B7; nhãn "đã KYC" có lớp `bg-ok-bg`; nút `/Phát hành/` đúng một (strict). `/draft` (Giao dịch viên): nhập "WPT" vào "Mã hoặc ký hiệu token" của Thẻ tạo token, chờ khối thông tin token có "Trần phát hành"; mọi `dd` trong khối có `scrollWidth <= clientWidth + 1` và không lớp `truncate`; nếu `dd` sau `dt` "Ví thanh toán" khớp `/^0x[0-9a-f]{40}$/i` thì nó hiện đủ 42 ký tự (không có thì bỏ qua phép này). Ở 390 px (ngữ cảnh mới): điền ví chưa whitelist `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` vào "Ví nhà đầu tư", bấm nút `/Phát hành/` (máy chủ từ chối vì chưa whitelist, không gửi giao dịch, chỉ ghi một dòng kiểm toán `FAILURE`, như `mint.spec.ts:91-99`): `[role="status"]` chứa "chưa được whitelist", và `scrollWidth <= clientWidth + 1` cho cả phần tử đó lẫn thẻ Nhà đầu tư |
| 3 | `/mint`, `/audit`, `/draft` ở 1440 và 390 px: `main.scrollWidth <= main.clientWidth`; không `console` loại `error`, không `pageerror`, không cảnh báo hydrate |
| 4 | Số action khi mở (ngữ cảnh mới mỗi trang, cách đếm như `fix-04-noi-du-lieu-that.spec.ts:23-33` cộng chờ 1 giây sau `networkidle`): `/mint` bằng mốc (dự kiến 1: `listTransactionsAction`; thanh bên không gọi action ở chain mặc định), `/audit` 0 (`toBe`); role trong `main` dự kiến 0 ở cả hai màn; mốc lấy bằng các `test` "mốc:" chạy trên bản build mốc |
