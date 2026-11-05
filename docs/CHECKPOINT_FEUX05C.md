# Báo cáo bàn giao: FE-UX-05c Tạo lệnh rút của Người bán

| | |
|---|---|
| Mã task | FE-UX-05c |
| Phạm vi | **Frontend thuần.** Không `lib/`, `app/actions`, `app/api`, `app/src/app/**`, `components/ui/*`, `components/layout/*`, `components/token/*`, `components/withdraw/*`, `seller-overview.tsx`, `seller-transactions.tsx`, `components/seller/{format.ts,labels.ts,use-seller-overview.ts,seller-overview-body.tsx}`; không gói npm mới; không đổi câu chữ, trường, thứ tự trường, cột, nút, điều kiện khoá, luồng tạo lệnh, đổi ví nhận, mã một lần, gửi tiếp, huỷ, lời gọi server action, số action khi mở màn |
| Nhánh | `feat/fe-ux-05c-rut-nguoi-ban`, tạo từ `release/ui-v2` @ `d035407` (sau merge PR #98 FE-UX-05b; đã gồm 05a). **Merge-base dùng để đo mốc: `d035407`**. Không có PR nào merge vào `release/ui-v2` trong lúc làm nên không phải rebase; mọi mốc và cả bộ kiểm thử mục 5 chạy trên merge-base này |
| Spec | `docs/fe-ux-05c-rut-nguoi-ban/{requirements,design,tasks}.md` (chép nguyên) |
| Commit | spec `a4b92be`; e2e nháp `f5f24c4`; số `role`, action mốc `6503e01`; **dời** (QĐ-5) `57d407b`; màn `1e9cba9`; biểu tượng (mục 8) `51d557a`; UserGuide, task-status `e7b649e`; tài liệu: các commit cuối trên nhánh |
| Tiến độ | Xong. Một PR, base `release/ui-v2`, chờ Supervisor nghiệm thu; Claude Code **không** merge |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 4) | | Bằng chứng |
|---|---|---|---|
| 1 | Màn đúng bố cục bản chốt trừ "Không làm"; bảng đối chiếu từng dòng `notes/seller-withdraw.md` | ✅ | mục 2.1, 7 |
| 2 | Bố cục, thành phần đúng QĐ-3, QĐ-4, QĐ-6, QĐ-7 | 🔶 | mục 2.1; DEVIATION biểu tượng câu phí `ReceiptText` thay `Receipt` (mục 8) |
| 3 | `SellerWithdrawRow` dời đúng QĐ-5, `short` từ `components/withdraw/format.ts`, commit riêng; đoạn trước và sau | ✅ | mục 3 |
| 4 | Không `*-destructive`, màu cứng, `FIELD`, `const short` trong tệp phạm vi | ✅ | mục 6 (6b), 1.3 nhóm 1 |
| 5 | Không đổi chữ (6d rỗng hoặc chỉ mảnh do tách phần tử) | ✅ | mục 6 (6d rỗng) |
| 6 | Diff giữ logic (QĐ-1, QĐ-2); liệt kê đoạn đổi gần hook, effect, handler, điều kiện khoá | ✅ | mục 2.2 |
| 7 | Action bằng mốc (ca 4), 28 đường dẫn không đổi; JS, CSS trong trần QĐ-9; lỗi `/seller/withdraw` 0 | ✅ | mục 4: `/seller/withdraw` +1.875 B (trần 3 KB); trang khác so chunk không thêm mã; CSS -10 B |
| 8 | Mốc test QĐ-8 giữ; không sửa test có sẵn | ✅ | mục 1.1, 2.3 |
| 9 | Ảnh 1440, 390, Sáng, Tối, trước và sau, vai Người bán, tiến trình mock mới, đủ env, công thức (a) (b) (c) | ✅ | mục 5 |
| 10 | Trạng thái không dựng được trên mock: unit test và ảnh dựng ngoài repo | ✅ | mục 1.3, 5 |
| 11 | `fe-ux-05c-rut-nguoi-ban.spec.ts` đủ 4 ca, `fe-ux-05c.test.ts` đủ 3 nhóm, xanh | ✅ | mục 1.2, 1.3 |
| 12 | Kiểm thử mục 5 đạt, kèm log; "EVM - E2E PROJECT HARDHAT" xanh (gồm `vault-withdraw`) | ✅ | mục 1.1 |
| 13 | Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 6) đúng kỳ vọng | ✅ | mục 6 |
| 14 | Không mã dư thừa | ✅ | mục 2.4 |

**Kết luận:** 13 ✅, 1 🔶, 0 ❌. 🔶 là DEVIATION biểu tượng theo đúng cách QĐ-9 cho phép: `Receipt` (QĐ-4) có ở
thanh bên, dùng lại làm chunk dùng chung mọi trang tăng (+4 đến +67 B gzip so bản mốc build riêng, lượt đo `1e9cba9`);
đổi sang `ReceiptText` cùng nghĩa (`51d557a`), so chunk 5 trang: tổng kích thước thô bằng mốc từng byte (mục 4, 8).
JS gzip `/seller/withdraw` 478.867 B, so bản mốc build riêng 476.992 B là +1.875 B (trần 3 KB). CSS 19.483 B, -10 B so
mốc 19.493 B. Action khớp 28/28; `hydration`, `consoleErrors`, `pageErrors` 0 ở mọi đường dẫn cả mốc lẫn sau; số `role`
trong `main` (0, 0, 0) và số action khi mở màn (2) bằng mốc. Mức rủi ro: thấp.

UserGuide: "Chốt tại"; 3.2.3 thêm "Bố cục (FE-UX-05c)"; dòng Trạng thái có sắc; dòng mã L-58, L-60 trỏ đúng dòng mới
(cả Phụ lục C). task-status: `FE-UX-05c` xong.

### 0.2 Việc cần Owner quyết

- Không có.

---

## 1. Kiểm thử (requirements mục 5, phần dev)

### 1.1 Lệnh và kết quả

KẾT_QUẢ_BỘ_KIỂM

### 1.2 e2e mới `app/e2e/fe-ux-05c-rut-nguoi-ban.spec.ts` (project mock, vai Người bán; không tạo lệnh, không đổi dữ liệu)

Chờ tải như nhau ở mốc và sau: `networkidle`, rồi `main` hết chữ "Đang đọc số dư". Tệp chạy trước `ops-transactions`,
`vault-withdraw` nên không giả định số dư, ví nhận đang đặt hay có lệnh.

| Ca | Kiểm | Mốc `d035407` | Sau |
|---|---|---|---|
| 1 | 1440 px: đếm `role` trước; một `h1` "Tạo lệnh rút"; `#token-scope` hiện; thẻ heading "Thông tin lệnh rút" bên trái thẻ chứa `withdrawable`, lệch đỉnh dưới 4 px, rộng hơn; thẻ phải đúng 4 `dt` theo thứ tự; chữ "Phí ngân hàng ngoài chuỗi: chưa áp dụng (POC)."; bảng "Yêu cầu rút của tôi" hoặc `[data-slot="empty-state"]` "Chưa có yêu cầu rút nào trên chain này."; `role` bằng hằng số | đỏ (chưa có `EmptyState`) | xanh |
| 2 | Điền Mục đích, Ví nhận (exact) bằng ví NDT001: `[role="note"]` câu đổi ví nhận hiện; không câu chặn; số tiền 999999999999999: đúng 1 `[role="alert"]` "Vượt phần được rút: chỉ rút được tối đa"; nút "Tạo lệnh rút" `disabled`; 390 px thẻ `withdrawable` dưới nút, hai thẻ rộng bằng nhau | xanh | xanh |
| 3 | 1440 và 390 px, ngữ cảnh mới: `main.scrollWidth <= main.clientWidth`; 0 lỗi console, `pageerror`, cảnh báo hydrate | xanh | xanh |
| 4 | Số action khi mở (ngữ cảnh mới, `networkidle` cộng 1 giây) bằng hằng số | đỏ (hằng số chưa điền) | xanh |

Hằng số đo trên bản build mốc `d035407` bằng chính tệp này qua `E2E_BASE_URL`, máy chủ MỚI chưa chạy spec nào (tasks bước
2): `role` `{ status: 0, note: 0, alert: 0 }`, số action khi mở 2 (`getSellerOverviewAction`,
`reconcileAndListMyWithdrawRequestsAction`). Lượt sau (máy chủ mới) cho đúng các số đó; 4 ca đạt.

### 1.3 Unit test mới `app/test/fe-ux-05c.test.ts` (môi trường `node`, 31 ca)

| Nhóm | Kiểm |
|---|---|
| 1 Mã nguồn | `seller-withdraw.tsx`: đúng 1 mỗi lời gọi `reconcileAndListMyWithdrawRequestsAction(`, `checkPayoutWalletAction(`, `createWithdrawRequestAction(`, `continueWithdrawRequestAction(`, `cancelWithdrawRequestAction(`, `useEffect(`, `useSellerOverview(`; nguyên văn (sau khi gộp khoảng trắng) `reconcileAndListMyWithdrawRequestsAction({ chain })`, ba `disabled`, `aria-label="Kết quả lệnh rút"`, hai `data-testid`, `aria-label="Yêu cầu rút của tôi"`, `<SellerWithdrawRow key={r.id}`, `role={feedback.tone === 'error' ? 'alert' : 'status'}`, `<Alert tone="warn" role="note"`; không `const FIELD`, `const short`, `-destructive`, `explorerTxUrl`; mọi `col-span-` có tiền tố mốc. `seller-withdraw-row.tsx`: không `Action(`, `useEffect(`, `useState(`; nhập `short` từ `@/components/withdraw/format`, `nf` từ `@/components/seller/format`; `WITHDRAW_STATUS_TONES[row.status]`, `row.status === 'PAYOUT_SET'` đúng 1. Hai tệp: nhập từ `withdraw.service` chỉ bằng `import type` (regex nhiều dòng của design) |
| 2 `SellerWithdrawRow` | `COMPLETED` mock: không `<a`, `span title` mã đầy đủ, "Hoàn tất" `bg-ok-bg`, không nút; `COMPLETED` evm: `<a target="_blank" rel="noreferrer">`, `href` bằng `explorerTxUrl`; `PAYOUT_SET`: đúng 2 nút "Gửi lệnh rút", "Huỷ", nhãn `bg-warn-bg`, ô giao dịch rỗng; `NEEDS_REVIEW` có lý do: `title` bằng lý do, không nút; `FAILED` không lý do: `bg-bad-bg`, không `title`; mọi dòng: mã 8 ký tự có `title`, ví rút gọn có `title`, số tiền theo `nf` của Người bán |
| 3 Nối callback | Gọi thẳng `SellerWithdrawRow(...)`, duyệt cây phần tử tìm `Button`: "Gửi lệnh rút" gọi `onContinue` đúng 1 lần, `onCancel` 0; "Huỷ" gọi `onCancel` đúng 1 lần, `onContinue` 0; dòng `COMPLETED` không `Button` |

Số có sẵn xác nhận trên bản mốc `d035407` (`orig_seller_withdraw.tsx`): mỗi lời gọi QĐ-2 đúng 1.

Tự gây lỗi (5 điểm của Supervisor; mức unit trên bản sao làm việc, hoàn lại bằng `git checkout`):
1. Bỏ `role="alert"` của câu "Vượt phần được rút": unit không bắt (không thuộc nhóm 1 của design); **e2e ca 2 đỏ** ở phép
   đếm `[role="alert"]` (bản build riêng có đột biến, máy chủ mới).
2. Đổi `aria-label="Kết quả lệnh rút"`: 1 ca đỏ (nhóm 1).
3. Bỏ điều kiện `row.status === 'PAYOUT_SET'`: 4 ca đỏ (nhóm 1, nhóm 2 `COMPLETED`, `NEEDS_REVIEW`, nhóm 3 `COMPLETED`).
4. Thêm một lời gọi `reconcileAndListMyWithdrawRequestsAction(`: 1 ca đỏ (nhóm 1 đếm lời gọi).
5. Đổi chéo `onContinue`, `onCancel` của hai nút: 1 ca đỏ (nhóm 3).

## 2. Thay đổi

### 2.1 Màn (bố cục theo design mục 1)

| Khối | Đổi |
|---|---|
| Đầu màn | `h1` `text-2xl font-semibold tracking-tight`; `TokenScopeSelect` giữ nguyên prop, lớp, vị trí |
| Nhánh tải | "Đang đọc số dư…" thành `EmptyState loading`; lỗi đọc số dư `Alert tone="bad"` không `role`; giữ thứ tự `loading`, `error \|\| !data`, có dữ liệu |
| Lưới | `grid gap-6 min-[1100px]:grid-cols-12`; Thông tin lệnh rút `min-[1100px]:col-span-7`, Hệ thống tính `min-[1100px]:col-span-5`; Yêu cầu rút của tôi rộng hết |
| Tiêu đề thẻ | `CardTitle` giữ `role="heading" aria-level={2}`, lớp `flex items-center gap-2.5 text-base`, `CardTitleIcon` trước chữ: `Send`, `Gauge`, `ListChecks` |
| Thông tin lệnh rút | `fieldClass` thay `FIELD` (ô số tiền thêm `tabular-nums`; Mạng `read-only:bg-muted`; Ví nhận `font-code`; mã một lần `text-center font-code text-lg tracking-[0.5em]`); ô Mạng `Link2`, ô Ví nhận `Wallet` trang trí bên trái (`div relative`, `aria-hidden`, `pointer-events-none`, ô `pl-10`); "Dùng ví đang kết nối" `size="sm"`; câu vượt, lỗi ví nhận `text-bad-ink` giữ `p role="alert"`; câu đổi ví nhận giữ `p role="note"`; câu chặn `Alert tone="warn" role="note"`; hàng cuối `flex flex-wrap items-center gap-3`: nút `size="lg"` và `Alert` kết quả (`ok`/`bad`, giữ `role` theo `tone`, `aria-label="Kết quả lệnh rút"`, `break-all`) |
| Hệ thống tính | `dl` `divide-y divide-border`, 4 cặp mỗi cặp một `div` `flex items-center justify-between gap-4 py-2.5`; `data-testid="withdrawable"` giữ ở `dd`; Số tiền nhận được `dt` `font-medium text-foreground`, `dd` `font-bold`; hai câu có `Info`, `ReceiptText` đầu dòng (mục 8) |
| Yêu cầu rút của tôi | Lỗi `Alert tone="bad"` không `role`; rỗng `EmptyState`; bảng giữ `aria-label`, 8 cột |
| `SellerWithdrawRow` | Nhãn `Badge variant={WITHDRAW_STATUS_TONES[row.status]}` (bảng 05a, không sửa; `PAYOUT_SET` là `warn`, bản chốt `info`); liên kết thêm `text-primary underline-offset-3` |
| Hộp mã một lần | Câu sáu chữ số `text-bad-ink` giữ `p role="alert"`; lỗi `feedback` trong hộp `Alert tone="bad" role="alert"` |

### 2.2 Đoạn đổi gần hook, effect, handler, điều kiện khoá (QĐ-1, QĐ-2)

Không đổi ký tự: mọi `useState`; effect (điều kiện, `[chain, requestsVersion]`, `cancelled`); `useSellerOverview`,
`useAccount`, `chainLabel`; `wallet`, `withdrawable`, `vaultPayoutWallet`, `payoutInput`, `changesPayout`, `quote`,
`blocker`, `canSubmit`; `setPayout`, `set`, `openConfirm`, `openContinue`, `settledMessage`, `confirm`, `cancel`, `rows`.
Các đoạn có đụng:

- Mọi điều kiện hiện (`quote?.exceedsLimit`, `chain !== 'mock'`, `changesPayout`, `payoutError`, `blocker`,
  `feedback && !otpOpen`, `feedback?.tone === 'error' && otpOpen`, câu sáu chữ số) giữ ký tự; chỉ đổi phần tử bên trong.
- Ba `disabled` giữ ký tự (unit nhóm 1). Nút "Dùng ví đang kết nối" chỉ thêm `size="sm"` và xuống dòng thuộc tính.
- `rows.map`: thân dời sang `SellerWithdrawRow` (mục 3); `onContinue={() => openContinue(r)}`,
  `onCancel={() => cancel(r.id)}` gọi đúng hai handler cũ với cùng đối số; nút trong dòng không thêm khoá.
- Kết quả: `role={feedback.tone === 'error' ? 'alert' : 'status'}` giữ ký tự; thêm `tone` cùng điều kiện (chỉ chọn sắc).

### 2.3 Mốc test QĐ-8

Không sửa tệp test có sẵn. `vault-withdraw` (mock trong lượt liên quan và bước 3, Hardhat trong 1.1), `uiux-02-dau-man`
(e2e, unit), `hf-01-hieu-nang.test.ts:34-38`, `fe-ux-05a.test.ts` (ba dòng nhập từ `components/seller/` giữ; trang thêm
dòng nhập thứ tư `seller-withdraw-row`, không nhập `./seller-overview`, `./seller-transactions`) đạt. Trang trí trong
khung ô không là `label`, không `aria-label`, nên `getByLabel('Ví nhận', { exact: true })` vẫn chế độ strict.

### 2.4 Mã dư thừa

Đã xoá: `FIELD`; `const short` (nay nhập từ `components/withdraw/format.ts` trong tệp dòng); import `explorerTxUrl`,
`ExternalLink`, `Badge`, `TableCell` ở trang (hết chỗ dùng sau khi dời); khối `Loader2` tự viết của nhánh đang tải (nay
`EmptyState loading`; `Loader2` còn dùng ở hai nút). Lint, typecheck đạt.

## 3. Dời nguyên văn (`57d407b`, QĐ-5)

Trước (`seller-withdraw.tsx` @ `d035407`, `:353-397`):

```tsx
                {rows.map((r) => {
                  const url = r.txHash ? explorerTxUrl(chain, r.txHash) : null;
                  return (
                    <TableRow key={r.id} data-status={r.status}>
                      …(các ô Mã, Số tiền, Ví nhận, Mục đích, Trạng thái, Giao dịch, Thời điểm)…
                      <TableCell>
                        {r.status === 'PAYOUT_SET' ? (
                          <div className="flex gap-2">
                            <Button type="button" size="sm" onClick={() => openContinue(r)}>
                              Gửi lệnh rút
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => void cancel(r.id)}>
                              Huỷ
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
```

Sau (`components/seller/seller-withdraw-row.tsx` @ `57d407b`):

```tsx
export function SellerWithdrawRow({ row, chain, onContinue, onCancel }: {
  row: WithdrawRequestView; chain: ChainKey; onContinue: () => void; onCancel: () => void | Promise<void>;
}) {
  const url = row.txHash ? explorerTxUrl(chain, row.txHash) : null;
  return (
    <TableRow data-status={row.status}>
      …(43 dòng `:354-396` lùi lề 16 cột)…
            <Button type="button" size="sm" onClick={() => onContinue()}>
            …
            <Button type="button" size="sm" variant="outline" onClick={() => void onCancel()}>
```

và trang:

```tsx
                {rows.map((r) => (
                  <SellerWithdrawRow
                    key={r.id}
                    row={r}
                    chain={chain}
                    onContinue={() => openContinue(r)}
                    onCancel={() => cancel(r.id)}
                  />
                ))}
```

`diff` (script ngoài repo) giữa `:354-396` đã bỏ 16 cột lề và thân tệp mới: đúng 17 dòng khác, mỗi dòng chỉ là `r.` thành
`row.`, `key={r.id} ` bị xoá, `openContinue(r)` thành `onContinue()`, `void cancel(r.id)` thành `void onCancel()`. Tệp dòng
nhập đúng khối import QĐ-5 (`WITHDRAW_STATUS_LABELS` chỉ tên đang dùng; `WITHDRAW_STATUS_TONES` thêm ở `1e9cba9`). Lint
sạch ở commit dời. Hai thân `short` cạnh nhau:

```ts
// seller-withdraw.tsx:41 @ d035407
const short = (value: string) => `${value.slice(0, 10)}…${value.slice(-6)}`;
// components/withdraw/format.ts:3
export const short = (value: string) => `${value.slice(0, 10)}…${value.slice(-6)}`;
```

Giống từng ký tự sau chữ `export`. Commit dời chưa đổi kiểu: `ops-transactions`, `vault-withdraw` trên bản build riêng của
`57d407b` (máy chủ mới) đạt 6 ca; `fe-ux-05a`, `hf-01-hieu-nang` (unit) đạt.

## 4. Đo trước và sau

Cùng máy, cùng quy trình (script ngoài repo): máy chủ mới cổng 3300 (đủ `webServer.env`), tạo dữ liệu bằng
`E2E_BASE_URL=… npx playwright test e2e/ops-transactions.spec.ts` (tasks bước 2); đo bằng
`tools/20261104_do_moc_measure.js` (sha256 `6079a0d6…` khớp spec) với
`JS_PAGES=/,/portfolio,/trade,/approvals,/seller,/seller/withdraw`; 28 dòng mỗi lượt, không dòng
`khong tim thay lien ket` (đủ `DYN:/transactions`, `DYN:/approvals`, `DYN:/orders`). Tiến trình đo khác tiến trình chụp
ảnh. JS theo byte: script riêng cộng gzip mọi script khi mở trang, máy chủ mới cổng 3500 sau `ops-transactions`.

| Mục | Mốc `d035407` | Sau `51d557a` | Trần |
|---|---|---|---|
| Số action khi mở màn | 28 đường dẫn; `/seller/withdraw` 2 | Khớp 28/28 | không đổi |
| Số action khi mở `/seller/withdraw` (e2e ca 4, máy chủ mới) | 2 | 2 | bằng mốc |
| `hydration`, `consoleErrors`, `pageErrors` | 0 ở cả 28 đường dẫn | 0 ở cả 28 đường dẫn | `/seller/withdraw` 0, khác không tăng |
| JS gzip (công cụ) `/seller/withdraw` | 465,8 KB | 467,6 KB | |
| JS gzip (công cụ) `/`; `/portfolio`; `/trade`; `/approvals`; `/seller` | 558,3; 456,9; 480,0; 455,2; 457,1 KB | 558,2; 456,8; 480,0; 455,2; 457,1 KB | không tăng |
| CSS gzip (`.next/static/chunks/*.css`, 1 tệp, gzip mức 9) | 19.493 B | 19.483 B (-10 B) | +2 KB |
| `role` trong `main` (ca 1) | 0, 0, 0 | 0, 0, 0 | bằng mốc |

JS gzip theo byte. Bản mốc của lượt đầu build đúng mã `d035407`; bản mốc build riêng build lại `d035407` sau bản cuối,
cùng phiên (`NEXT_DIST_DIR=.next-moc`, gỡ tạm `seller-withdraw-row.tsx` khi build, đã xoá thư mục):

| Trang | Mốc (lượt đầu) | Mốc build riêng | Sau `51d557a` | Chênh so build riêng | Trần |
|---|---|---|---|---|---|
| `/portfolio` | 467824 | 467821 | 467812 | -9 | bằng mốc |
| `/tokens/WPT` | 463029 | 463028 | 463036 | +8 | bằng mốc |
| `/trade` | 491515 | 491509 | 491530 | +21 | bằng mốc |
| `/orders` | 549475 | 549474 | 549406 | -68 | bằng mốc |
| `/orders/[id]` | 463365 | 463365 | 463367 | +2 | bằng mốc |
| `/withdraw` | 485768 | 485763 | 485750 | -13 | bằng mốc |
| `/` | 571656 | 571652 | 571626 | -26 | bằng mốc |
| `/approvals` | 466112 | 466111 | 466127 | +16 | bằng mốc |
| `/distribution` | 479620 | 479621 | 479602 | -19 | bằng mốc |
| `/vault` | 469567 | 469568 | 469530 | -38 | bằng mốc |
| `/wallet` | 466913 | 466911 | 466936 | +25 | bằng mốc |
| `/seller` | 468070 | 468067 | 468032 | -35 | bằng mốc |
| `/seller/transactions` | 549631 | 549625 | 549621 | -4 | bằng mốc |
| `/seller/withdraw` | 476994 | 476992 | 478867 | +1875 | +3.072 |
| `/account` | 457856 | 457854 | 457856 | +2 | bằng mốc |

Hai bản mốc cùng mã lệch nhau -6 đến +1 B (nhiễu build). Đã lưu và so từng tệp script giữa bản mốc build riêng và bản
`51d557a` cho 5 trang ngoài phạm vi có số dương hoặc lớn (`/trade`, `/wallet`, `/approvals`, `/tokens/WPT`, `/portfolio`):
cùng số tệp, **tổng kích thước thô bằng nhau từng byte** (1.623.474; 1.550.147; 1.545.559; 1.538.040; 1.552.820 B); chỉ
hai tệp đổi tên băm, kích thước giữ (chunk chung 178.700 B và một chunk của trang). Lệch gzip là do chuỗi băm đổi trong
mã, không có mã mới. `/orders/[id]`, `/account` +2 B nằm trong nhiễu. `/seller/withdraw`: chunk trang 43.923 B thành
49.972 B thô (+6.049 B: `SellerWithdrawRow`, `Alert`, `EmptyState`, `fieldClass`, biểu tượng mới).

Lượt đo đầu (`1e9cba9`, còn `Receipt`) cho mười ba trang +4 đến +67 B so mốc build riêng (`/wallet` +67, `/trade` +63,
`/approvals` +58); bảng và cách xử lý ở mục 8. Số trong mục 4, 5 là lượt hai trên `51d557a`, tiến trình mới.

CSS mốc lấy từ bản build mốc sạch (19.493 B). Bản mốc build riêng cho 19.533 B vì build lúc thư mục build phụ nằm trong
`app/`; không dùng số đó.

## 5. Ảnh (gửi kèm, không commit)

- `/seller/withdraw` vai Người bán, 1440 và 390, Sáng và Tối, ba bước: (a) vừa mở; (b) ví nhận NDT001 (khác ví đang đặt
  NB001) và số tiền 999999999999999 (câu đổi ví nhận, câu vượt phần được rút, nút khoá); (c) số tiền 1, ví NB001, mục
  đích, bấm "Tạo lệnh rút", hộp mã một lần (không bấm Xác nhận). Trước (`moc/anh/`), sau (`sau/anh/`), 12 ảnh mỗi lượt.
  Mỗi lượt một tiến trình mock MỚI cổng 3400: `npx next start --port 3400` với đủ biến của `webServer.env`
  (`NEXT_PUBLIC_DEFAULT_CHAIN`, `USE_MOCK_KYC`, `USE_MOCK_DB`, `DEMO_ROLE`, `ENABLE_DEMO_TOKEN_MINT`,
  `ENABLE_DEMO_PAYMENT_MINT`, `ENABLE_INVESTOR_SELL`, khoá ký mẫu Hardhat, `RPC_HARDHAT`);
  `E2E_BASE_URL=http://localhost:3400 npx playwright test e2e/ops-transactions.spec.ts e2e/vault-withdraw.spec.ts` (6 ca
  đạt: có số dư vault, khoá cố định 1 VNDB và một lệnh "Hoàn tất"); chụp; tắt. Mốc (bản build `d035407`): bật 07:32:28Z,
  tắt 07:33:14Z. Sau (bản build `51d557a`): bật 08:05:46Z, tắt 08:06:31Z (05/11/2026, UTC). `main` không tràn ngang,
  0 lỗi console ở cả 12 ảnh mỗi lượt. Lượt sau đầu (`1e9cba9`) giữ ở `sau_lan1_receipt/` (gửi kèm).
- 28 đường dẫn của script đo, trước (`moc/do/`) và sau (`sau/do/`), 1440 và 390, Sáng và Tối.
- Trạng thái không dựng được trên mock (7 ảnh mỗi biến thể): bảng 4 dòng trong `table` như trang (`PAYOUT_SET` hai nút,
  `NEEDS_REVIEW` có lý do, `FAILED`, `COMPLETED` có liên kết explorer chain `evm`); câu chặn "Chain này chưa có vault
  thanh toán: chưa rút được.", "Vault đang tạm dừng rút."; kết quả thành công, chờ biên nhận, lỗi; lỗi ví nhận. HTML dựng
  bằng `renderToStaticMarkup` (test tạm, xoá ngay, không commit): bảng dùng `SellerWithdrawRow` (trước: bản của commit
  dời `57d407b`, đúng mã mốc; sau: mã cuối); các câu dựng lại đúng phần tử của trang (trước: `p` cũ; sau: `Alert`, hàng
  nút). CSS bản build tương ứng, `page.setContent`, Sáng và Tối, 1440 (khung 1200 px) và 390 (`static_moc/`,
  `static_sau/`).
- Kiểm đọc được (Sáng và Tối): nhãn `ok`, `warn`, `bad`; liên kết mã giao dịch màu chủ đạo; khối thông báo vàng, xanh lá,
  đỏ; ô trang trí trong khung ô Mạng, Ví nhận; hàng "Tạo lệnh rút" và kết quả.

## 6. Lệnh kiểm (tasks bước 6, `LC_ALL=C`)

```text
FE-UX-05c tasks bước 6, HEAD 51d557a, base origin/release/ui-v2 d035407
== 6a      # tệp ngoài danh sách trắng; tệp bị xoá: rỗng
== 6b      # màu cứng, *-destructive trong hai tệp mã phạm vi: rỗng
== 6c      # ký tự cấm ở dòng thêm mới: rỗng
== 6d      # chữ bị bỏ không có lại ở dòng thêm mới: rỗng (11 chuỗi bị xoá đều có lại trong 93 chuỗi thêm)
== 6e      # ký tự cấm trong tệp phạm vi, test, e2e: rỗng
== hết
```

Cả năm lệnh rỗng, đúng kỳ vọng. `docs/tech-report.md` không đổi (không marker trong các tệp đã sửa).

## 7. Đối chiếu notes `notes/seller-withdraw.md`

Cột "Kết quả": **Làm** (đúng bản chốt), **Giữ** (màn thật đã như vậy hoặc chỉ giữ chữ), **Không làm** (kèm lý do).

| Dòng notes | Kết quả |
|---|---|
| Tiêu đề, câu phụ | Làm tiêu đề; Không làm câu phụ (requirements mục 1, test `uiux-02` cấm) |
| Số tiền rút (VNDB), dấu chấm khi gõ | Giữ `AmountInput`; không hậu tố trong ô (notes đã bỏ) |
| Câu "Vượt phần được rút…" | Làm `text-bad-ink`, giữ `role="alert"` |
| Mạng (chỉ đọc) | Làm biểu tượng `Link2` trong khung ô |
| Ví nhận (điền sẵn ví đang đặt) | Làm biểu tượng `Wallet` trong khung ô. Lệch: notes ghi "Trên mock là ví NB001" chỉ đúng sau `vault-withdraw`; máy chủ mock mới có ví đang đặt `null`, ô rỗng (e2e không giả định) |
| Nút "Dùng ví đang kết nối" | Làm `size="sm"`; giữ chỉ khi chain khác mock, khoá khi chưa kết nối |
| Câu đổi ví nhận | Giữ `role="note"` chữ nhỏ |
| Câu lỗi dưới ô Ví nhận | Làm `text-bad-ink`, giữ `role="alert"` |
| Mục đích, Ghi chú | Làm `fieldClass` |
| Nút Tạo lệnh rút | Làm `size="lg"` cùng hàng kết quả (`.form-foot`) |
| Câu kết quả dưới nút | Làm `Alert` ok/bad giữ `role`, `aria-label` |
| Thẻ Hệ thống tính, 4 dòng, câu luật khoá, câu phí | Làm dòng kẻ ngăn, dòng 4 đậm, hai câu có biểu tượng (`Info`, `ReceiptText`, mục 8) |
| Bảng 8 cột, `title` badge là `reason` | Giữ cột, `title`; nhãn có sắc theo `WITHDRAW_STATUS_TONES` |
| Hộp "Xác nhận mã một lần" | Giữ chữ, `data-testid`; ô mã lớn canh giữa; lỗi `Alert bad` |
| Tab "Chặn tạo lệnh" | Làm `Alert warn` giữ `role="note"`; ảnh tĩnh hai câu |
| Tab "Kết quả lệnh rút" | Ảnh tĩnh ba câu kết quả và lỗi ví nhận |
| Tab "Danh sách yêu cầu": dòng `PAYOUT_SET` hai nút; rỗng; liên kết explorer | Unit nhóm 2, 3; ảnh tĩnh; rỗng `EmptyState`. `PAYOUT_SET` sắc `warn` (bản chốt `info`) theo bảng 05a để cùng sắc với Danh sách giao dịch |
| Tab "Đang tải, lỗi" | Làm `EmptyState loading`, `Alert bad` không `role` |
| Dưới 700 px bảng thành thẻ | Không làm: giữ bảng cuộn ngang như 04d (requirements mục 1) |
| Thẻ "Các trạng thái khác của màn" | Không làm (chỉ có ở bản xem thử) |
| Bố cục 7/5; biểu tượng đầu dòng Hệ thống tính | Làm 7/5; biểu tượng đầu dòng của `dl` không làm (như 04d), hai câu ghi chú có biểu tượng |
| Thay đổi so với bản chốt (FIX-01, UIUX-01) | Giữ (logic, chữ của dev) |
| Lệch: kết quả không phải Hoàn tất hay PAYOUT_SENT hiện tông lỗi (L-58) | Không làm: logic `settledMessage` (QĐ-1) |
| Lệch: lý do chỉ trong `title` | Không làm: đổi chữ, cây trợ năng |
| Lệch: ví rút gọn 10…6 ở đây, 6…4 ở Danh sách giao dịch; "POC" và "PoC" | Không làm: đổi chữ cấm |
| Lệch: ví mẫu bị từ chối trên chain thật | Không làm: logic máy chủ |

## 8. Nợ và DEVIATION

- **DEVIATION: biểu tượng câu "Phí ngân hàng ngoài chuỗi" dùng `ReceiptText` thay `Receipt` (QĐ-4), theo QĐ-9.**
  `Receipt` có ở thanh bên (`components/layout/sidebar.tsx`) và chưa trang nào dùng lại; dùng ở màn này làm chunk dùng
  chung mọi trang đổi. Lượt đo `1e9cba9` so bản mốc build riêng:

  | Trang | `Receipt` (`1e9cba9`) | `ReceiptText` (`51d557a`) |
  |---|---|---|
  | `/portfolio` | +33 | -9 |
  | `/tokens/WPT` | +50 | +8 |
  | `/trade` | +63 | +21 |
  | `/orders` | -26 | -68 |
  | `/orders/[id]` | +44 | +2 |
  | `/withdraw` | +29 | -13 |
  | `/` | +16 | -26 |
  | `/approvals` | +58 | +16 |
  | `/distribution` | +23 | -19 |
  | `/vault` | +4 | -38 |
  | `/wallet` | +67 | +25 |
  | `/seller` | +7 | -35 |
  | `/seller/transactions` | +38 | -4 |
  | `/account` | +44 | +2 |
  | `/seller/withdraw` | +1630 | +1875 |

  Với `ReceiptText`, so chunk cho thấy không còn mã mới ở trang khác (mục 4). Năm biểu tượng còn lại (`Send`, `Gauge`,
  `ListChecks`, `Link2`, `Wallet`) đã có ở trang 04d, `Info` ở `Alert`: không tách module mới. Cùng cách 05a đổi
  `ArrowRightLeft`.
- **Dòng mã L-58, L-60 trong UserGuide** trỏ `seller-withdraw.tsx:114`, `:76` đã lệch từ trước (đúng chỗ ở mốc là
  `:147-152`, `:101`); nay sửa thành `:144-149`, `:98` (cả Phụ lục C).
- **Ảnh lượt sau chạy hai lần:** lượt 1 (`1e9cba9`) phát hiện vấn đề trên; lượt 2 (`51d557a`) trên tiến trình mới cho
  số trong mục 4, 5.
- **Chưa làm theo requirements mục 1 "Không làm":** câu phụ; thẻ trạng thái của bản xem thử; bảng thành thẻ; biểu tượng
  trên nút, đầu dòng `dl`; hậu tố ô số tiền; biểu tượng lịch sử (dùng `ListChecks`, `EmptyState` mặc định); hiệu ứng
  (FE-UX-08); lỗi thanh bên sáng hai mục ở màn Người bán (thấy trên ảnh; `components/layout`, task riêng); `aria-live`.

## 9. Tự đánh giá 3 luật kiến trúc

- [x] Mọi call chain qua ILedgerPort: không đổi mã gọi chuỗi.
- [x] Mọi ký qua ISigner: không đổi.
- [x] Mọi kiểm quyền qua RBAC: không đổi.
