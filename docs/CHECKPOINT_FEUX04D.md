# Báo cáo bàn giao: FE-UX-04d Rút VNDB của Nhà đầu tư

| | |
|---|---|
| Mã task | FE-UX-04d |
| Phạm vi | **Frontend thuần.** Không `lib/`, `app/actions`, `app/api`, `app/src/app/**`, `components/ui/*`, `components/investor/*`, `components/trading/*`, `components/wallet/*`, `components/layout/*`; không gói npm mới; không đổi câu chữ (trừ hai chữ "VNDB" của QĐ-4), trường, thứ tự trường, cột, nút, điều kiện khoá, luồng, lời gọi server action, số action khi mở màn |
| Nhánh | `feat/fe-ux-04d-rut-vndb`, tạo từ `release/ui-v2` @ `400ffcc` (sau merge PR #95 FE-UX-04c; đã gồm 04a, 04b). **Merge-base dùng để đo mốc: `400ffcc`**. Nhánh tạo sau khi 04b, 04c merge nên không phải rebase; mọi mốc (JS, CSS, action, lỗi, `role`, ảnh trước) và cả bộ kiểm thử mục 5 chạy trên merge-base này |
| Spec | `docs/fe-ux-04d-rut-vndb/{requirements,design,tasks}.md` (chép nguyên) |
| Commit | spec `e089b94`; e2e nháp `1fa9d07`; **dời nguyên văn** `e45cbf1`; màn, unit nhóm 2, 3, số `role` mốc `ca805ed`; UserGuide, task-status `39870cd`; ca 1 kiểm bóng `7c0f1f6`; tài liệu: các commit cuối trên nhánh |
| Tiến độ | Xong. Một PR, base `release/ui-v2`, chờ Supervisor nghiệm thu; Claude Code **không** merge |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 4) | | Bằng chứng |
|---|---|---|---|
| 1 | Màn đúng bố cục bản chốt trừ "Không làm"; bảng đối chiếu từng dòng `notes/withdraw.md` | ✅ | mục 2.2, 7 |
| 2 | Bố cục, thành phần đúng QĐ-3, QĐ-4, QĐ-6, QĐ-7 | ✅ | mục 1.2 (ca 1, 2), 2.2 |
| 3 | `WithdrawRequestRow`, `short`, `nf` dời đúng QĐ-5, commit riêng; đoạn trước và sau | ✅ | mục 3 |
| 4 | Không còn `amber-*`, `*-destructive`, `FIELD` trong tệp phạm vi | ✅ | mục 6 (6b), 1.3 nhóm 1 |
| 5 | Không đổi chữ ngoài hai chữ "VNDB" (6d rỗng hoặc chỉ mảnh do tách phần tử) | ✅ | mục 6 (6d rỗng) |
| 6 | Diff giữ logic (QĐ-1, QĐ-2); liệt kê đoạn đổi gần hook, handler, điều kiện khoá | ✅ | mục 2.3 |
| 7 | Mở `/withdraw` đúng 1 action (ca 4), 28 đường dẫn không đổi; JS, CSS trong trần; ba số lỗi `/withdraw` 0 | ✅ | mục 1.2, 4 |
| 8 | Mốc test QĐ-8 giữ; không sửa test có sẵn | ✅ | mục 1.1, 2.4 |
| 9 | Ảnh 1440, 390, Sáng, Tối, trước và sau, ba bước (a), (b), (c), tiến trình mock mới mỗi lượt, đủ env | ✅ | mục 5 |
| 10 | Trạng thái không dựng được trên mock: unit test và ảnh dựng ngoài repo | ✅ | mục 1.3, 5 |
| 11 | `fe-ux-04d-rut-vndb.spec.ts` đủ 4 ca, `fe-ux-04d.test.ts` đủ 3 nhóm, xanh | ✅ | mục 1.2, 1.3 |
| 12 | Kiểm thử mục 5 đạt, kèm log; "EVM - E2E PROJECT HARDHAT" xanh | ✅ | mục 1.1 |
| 13 | Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 6) đúng kỳ vọng | ✅ | mục 6 |
| 14 | Không mã dư thừa | ✅ | mục 2.5 |

**Kết luận:** 14 ✅, 0 🔶, 0 ❌. JS gzip `/withdraw` so bản mốc build riêng +1.762 B (trần 3 KB); bốn trang đo khác của
`JS_PAGES`: `/` +38, `/portfolio` +14 (cả hai cùng kích thước thô, nhiễu nén), `/trade` +27 (thô +2 B: mã module,
mã tham chiếu server action), `/approvals` -2; công cụ đo báo `/`, `/portfolio`, `/trade`, `/approvals` bằng mốc trong
0,1 KB (mục 4). CSS +45 B. Action khớp 28/28; `hydration`, `consoleErrors`, `pageErrors` 0 ở mọi đường dẫn cả mốc lẫn
sau; số `role` trong `main` bằng mốc (0, 0, 0). Mức rủi ro: thấp (chỉ đổi vỏ JSX từ dòng `header` trở xuống; hook,
effect, handler, điều kiện khoá không đổi ký tự; các dòng lệnh chain thật khoá bằng unit test vì mock không dựng được).

UserGuide: "Chốt tại"; 3.1.6 thêm "Bố cục (FE-UX-04d)", dòng "Khối Hệ thống tính" theo thứ tự mới.

### 0.2 Việc cần Owner quyết

- Không có. Một chỗ em kiểm khác chữ của design mục 3 (ca 1 so `boxShadow` theo lớp bóng trong suốt thay vì chữ
  `none`, vì lớp `hover:shadow-none!` QĐ-4 chỉ định tính ra như vậy trong Tailwind 4) ghi ở mục 8.

---

## 1. Kiểm thử (requirements mục 5, phần dev)

### 1.1 Lệnh và kết quả

`FE-UX-04d` ở `inProgress` của `.kiro/task-status.json` khi chạy. Chạy khi cổng e2e trống (máy chủ mới), Postgres
bật, trên HEAD `7c0f1f6` cộng checkpoint chưa commit. Nhánh tạo từ `400ffcc` (đã có FE-UX-04c), nên lượt này là lượt
trên merge-base cuối, không cần chạy lại sau rebase.

```text
$ TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm
  => PASS có cảnh báo: luật kiến trúc          # PASS 20, FAIL 0, WARN 3 (như mốc)
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)
ĐẠT     FE-UX-04d, docs/CHECKPOINT_FEUX04D.md
  => PASS: LỚP 3 - KHUÔN CHECKPOINT
  => PASS: APP - TYPECHECK
  => PASS: APP - LINT
      Tests  1625 passed | 74 skipped (1699)   # mốc 1594 + 31 ca mới của fe-ux-04d.test.ts
  => PASS: APP - VITEST
  => PASS: APP - BUILD BẢN PHÁT HÀNH
FE-UX-04d role counts /withdraw: {"status":0,"note":0,"alert":0}
      139 passed, 7 skipped (4.3m)            # project mock đầy đủ: 135 ca cũ + 4 ca mới
  => PASS: APP - E2E (PLAYWRIGHT)
  => PASS: EVM - BUILD BẢN HARDHAT
  => PASS: EVM - DỰNG CHUỖI MỚI
      26 passed, 2 skipped (43.9s)            # toàn bộ project Hardhat
  => PASS: EVM - E2E PROJECT HARDHAT
  => ĐẠT các phần đã chạy: arch markers checkpoint app build e2e evm
EXIT=0
```

Log gửi kèm (không commit): `20261105_feux04d_run_local_all.log` (dòng khoá ký Hardhat #0 trong env máy chủ cục bộ đã
che) và riêng đoạn từ "EVM - E2E PROJECT HARDHAT" tới hết: `20261105_feux04d_evm_e2e.log`. Không chạy `contracts`.

### 1.2 e2e mới `app/e2e/fe-ux-04d-rut-vndb.spec.ts` (project mock, vai Nhà đầu tư; không tạo lệnh)

Chờ tải như nhau ở mốc và sau: `networkidle`, rồi `main` không còn chữ "Đang đọc số dư". Tệp chạy trước
`investor-withdraw.spec.ts` nên không giả định số dư.

| Ca | Kiểm | Mốc `400ffcc` | Sau |
|---|---|---|---|
| 1 | 1440 px: đếm `role` trước; một `h1` "Rút VNDB"; ô "Ví gửi" trong form có ví hồ sơ; thẻ chứa form bên trái thẻ chứa `payment-balance`, lệch đỉnh dưới 24 px; `[data-kpi][data-tone="au"]` trong thẻ đó chứa "Số dư sau rút", đáy ô cách đáy thẻ không quá 40 px, thẻ form cao hơn, đỉnh ô cách đáy `dl` hơn 24 px; rê chuột 500 ms: `transform` `none`, mọi lớp `boxShadow` trong suốt (mục 8); `[data-wallet-bound="true"]` hiện; bảng hoặc `EmptyState` hiện; `role` bằng hằng số | đỏ (không có ô `Kpi`) | xanh |
| 2 | Điền Ví nhận NB001, Mục đích, số tiền 999999999999999: đúng một `[role="alert"]` trong `main` chứa "Vượt số dư: chỉ rút được tối đa"; nút "Tạo lệnh rút" `disabled`; 390 px: thẻ `payment-balance` dưới nút, hai thẻ rộng lệch dưới 4 px | xanh (mốc đã một cột dưới `lg`) | xanh |
| 3 | 1440 và 390 px, ngữ cảnh mới: `main.scrollWidth <= main.clientWidth`; 0 lỗi console, 0 `pageerror`, 0 cảnh báo hydrate | xanh | xanh |
| 4 | Mở `/withdraw` (ngữ cảnh mới, chờ `networkidle` cộng 1 giây): đúng 1 action | xanh | xanh |

Hằng số `role` đo trên bản build mốc `400ffcc` bằng chính ca 1 trong lượt e2e mock đầy đủ trên máy chủ mới:
`{ status: 0, note: 0, alert: 0 }` (lượt đó 138 ca đạt, 1 ca đỏ đúng cột Mốc). Lượt sau cho đúng số đó.

### 1.3 Unit test mới `app/test/fe-ux-04d.test.ts` (môi trường `node`, 31 ca)

Nhóm 1 (mã nguồn): `investor-withdraw.tsx` 1 `getPaymentWithdrawPageAction(`, 1 `checkPaymentWithdrawTargetAction(`,
1 `createPaymentWithdrawAction(`, 1 `beginPaymentSendAction(`, 1 `submitPaymentWithdrawTxAction(`, 2
`cancelPaymentWithdrawAction(`, 1 `useEffect(` (số mốc xác nhận trên `400ffcc` trước khi viết: 1, 1, 1, 1, 1, 2, 1; nút
trong dòng mốc có `disabled={busy !== null}` đúng 3 lần); `withdraw-request-row.tsx`, `format.ts` không `Action(`,
`useEffect(`, `useState(`; trang không `const FIELD`, `const short`, `const nf`; sau khi gộp khoảng trắng trang có đúng
một `disabled={!canSubmit}`, `disabled={!/^\d{6}$/.test(otp) || busy !== null}`, `busy={busy !== null}`; dòng có
`disabled={busy}` đúng 3 lần; mọi dòng nhập từ `@/lib/bank/payment-withdraw.service` ở ba tệp bắt đầu bằng
`import type`.

Nhóm 2 (`WithdrawRequestRow` trong `<table><tbody>`, dữ liệu giả đủ kiểu `PaymentWithdrawView`): `CREATED` không bận:
`data-status="CREATED"`, hai nút không thuộc tính `disabled`, ô mã giao dịch rỗng; `CREATED` bận: hai nút `disabled`;
`SENDING`: câu chờ ví, nút "Huỷ", không "Gửi từ ví"; `SUBMITTED` trên `evm`: `<a target="_blank">`, `href` bằng
`explorerTxUrl('evm', hash)`, chữ `short(hash)`, không nút; `COMPLETED` trên `mock`: không `<a`,
`<span title="<mã đủ>">short(mã)</span>`, "Hoàn tất", không nút; `CANCELLED` có lý do: "Đã huỷ" và lý do ở cột Lý do.
Cả 7 trạng thái: mã 8 ký tự có `title` bằng `id`, ví nhận `short(toWallet)` có `title`, nhãn có đủ lớp của
`badgeVariants({ variant: PAYMENT_WITHDRAW_STATUS_TONES[status] })` và đúng chữ nhãn.

Nhóm 3: `PAYMENT_WITHDRAW_STATUS_TONES` đúng 7 khoá trùng khoá nhãn, giá trị đúng QĐ-6.

Tự gây lỗi 4 điểm Supervisor định thử (cộng một điểm em thêm), trên bản sao làm việc rồi hoàn lại:

| Lỗi gây ra | Kết quả |
|---|---|
| `WithdrawRequestRow` bỏ `disabled={busy}` của nút "Gửi từ ví" | nhóm 1 "`disabled={busy}` đúng 3 lần" đỏ; nhóm 2 "CREATED, busy true: hai nút disabled" đỏ |
| Bỏ `role="alert"` của câu "Vượt số dư" (bản build riêng `.next-mut`, e2e trên máy chủ mới) | `fe-ux-04d-rut-vndb` ca 2 đỏ (`toHaveCount(1)` thấy 0) |
| Đổi `aria-label="Kết quả rút VNDB"` thành "Kết quả giao dịch" (bản build riêng, máy chủ mới) | `investor-withdraw` "Nhà đầu tư rút 1 VNDB tới ví NB001…" đỏ (`getByLabel('Kết quả rút VNDB')` không thấy) |
| Thêm một lời gọi `getPaymentWithdrawPageAction(` vào trang | nhóm 1 ca `getPaymentWithdrawPageAction(` đỏ (2 thay vì 1) |
| (thêm) Bỏ `hover:shadow-none!` khỏi ô `Kpi` (bản build riêng, máy chủ mới) | `fe-ux-04d-rut-vndb` ca 1 đỏ: lớp bóng nổi của `lift` (`0px 18px 40px -24px`) không trong suốt |

## 2. Thay đổi

### 2.2 Màn (bố cục theo design mục 1)

| Khối | Đổi |
|---|---|
| Đầu màn | `h1` `text-2xl font-semibold tracking-tight`, cả nhánh chưa kết nối ví |
| Lưới | `grid gap-6 min-[1100px]:grid-cols-12` thay `lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]`; Thông tin lệnh rút `min-[1100px]:col-span-7`, Hệ thống tính `min-[1100px]:col-span-5`; Lệnh rút của tôi rộng hết dưới lưới |
| Thông tin lệnh rút | `CardTitle role="heading" aria-level={2}` giữ, `CardTitleIcon` `Send`; `form` giữ `aria-label`, `onSubmit`; mọi ô `fieldClass` (chỉ đọc thêm `read-only:bg-muted`, ô ví thêm `font-code`), giữ `id`, nhãn, `value`, `onChange`, `readOnly`, `placeholder`, `spellCheck`, `aria-invalid`, thứ tự; ô Số tiền rút bọc `div relative`, hậu tố `span` "VNDB" `absolute right-3.5` `aria-hidden` `pointer-events-none`, ô `pr-16`; ô Mạng `Link2`, ô Ví gửi `LockKeyhole` `absolute left-3.5` `aria-hidden` `pointer-events-none`, ô `pl-10`; "Đã định danh" `Badge variant="ok"` giữ `data-wallet-bound="true"`, `BadgeCheck`; "Vượt số dư", lỗi ví nhận giữ `role="alert"`, màu `text-bad-ink`; dòng `busy` giữ `role="status"`; kết quả ngoài hộp `Alert` (`bad` khi lỗi, `ok` khi thành công) giữ `role` theo `tone`, `aria-label="Kết quả rút VNDB"`, `break-all` |
| Hệ thống tính | `CardTitleIcon` `Gauge`; `CardContent className="flex flex-1 flex-col"`; `dl` hai dòng `divide-y divide-border` (Số dư VNDB giữ `data-testid="payment-balance"`, Số rút); câu phí gas giữ chữ và `!onMock`, thêm `Flame` `aria-hidden`, đặt sau `dl`; `Kpi tone="au"` `label` "Số dư sau rút", `value` `nf(after)`, `unit` "VNDB", lớp `mt-auto hover:transform-none! hover:shadow-none!` |
| Lệnh rút của tôi | `CardTitleIcon` `ListChecks`; bảng giữ `aria-label`, 8 cột; rỗng `EmptyState` giữ chữ |
| `WithdrawRequestRow` | `Badge variant={PAYMENT_WITHDRAW_STATUS_TONES[row.status]}` thay `variant="outline"`; liên kết mã giao dịch thêm `text-primary` |
| Nhánh | Chưa kết nối ví: `h1` rồi `EmptyState` `Wallet`, giữ "Chưa kết nối ví", câu, liên kết "Kết nối ví" `prefetch={false}`; `WalletNotBoundNotice` giữ; lỗi tải `Alert bad` không `role`; "Đang đọc số dư…" `EmptyState loading` |
| Hộp mã một lần | Giữ `DialogTitle`, `DialogDescription`, `otp-payment-target`, câu ký ví; ô mã `fieldClass` cộng `text-center font-code text-lg tracking-[0.5em]`; "Mã một lần phải đúng sáu chữ số." `p role="alert"` `text-bad-ink`; lỗi `feedback` trong hộp `Alert bad role="alert"`; nút Xác nhận giữ |
| `labels.ts` | Thêm `PAYMENT_WITHDRAW_STATUS_TONES: Record<PaymentWithdrawStatus, 'ok' \| 'warn' \| 'bad' \| 'info'>` theo QĐ-6 |

### 2.3 Đoạn đổi gần hook, effect, handler, điều kiện khoá (QĐ-1, QĐ-2)

Diff của `investor-withdraw.tsx` ở commit màn (`e45cbf1..ca805ed`) chỉ có khối nhập ở đầu tệp, xoá `FIELD`, và từ
dòng `const header` (dòng 244 cũ) trở xuống; mọi `useState`, effect (điều kiện, mảng phụ thuộc, `cancelled`),
`requestKey`, `fresh`, `sameScope`, `data`, `reload`, `balance`, `amount`, `exceeds`, `after`, `canSubmit`, `set`,
`provider`, `openConfirm`, `sendFromWallet`, `confirm`, `sendRow`, `cancelRow`, `settledMessage` không đổi ký tự. Các
đoạn có đụng:

- Bốn nhánh `!wallet`, `fresh?.notBound`, `data === null && fresh?.error`, `data === null` giữ điều kiện và thứ tự;
  chỉ đổi phần tử trả về (`Card` thành `EmptyState`, `p` thành `Alert`, khối quay thành `EmptyState loading`).
- `exceeds &&`, `toError &&`, `busy &&`, `feedback && !dialogOpen`, `!onMock &&` (hai chỗ), điều kiện lỗi mã một lần,
  `feedback?.tone === 'error' && dialogOpen`: giữ ký tự; đổi lớp hoặc phần tử bên trong.
- Ba biểu thức khoá giữ ký tự (unit nhóm 1 kiểm): `disabled={!canSubmit}`,
  `disabled={!/^\d{6}$/.test(otp) || busy !== null}`, và `busy={busy !== null}` truyền vào dòng (trong dòng
  `disabled={busy}` ba lần, đúng ba chỗ `busy !== null` cũ).
- `rows.map`: thân dời sang `WithdrawRequestRow` (mục 3); `key`, `sendRow(r)`, `cancelRow(r)` ở chỗ gọi.
- Dòng "Số dư sau rút" rời khỏi `dl` thành ô `Kpi` sau câu phí gas (QĐ-4, chủ ý); giá trị `nf(after)` giữ.

### 2.4 Mốc test QĐ-8

Không sửa tệp test có sẵn. Đã chạy riêng trên bản sau (máy chủ mới): `fe-ux-04d-rut-vndb`, `investor-withdraw`,
`uiux-02-dau-man` (13 ca đạt); unit `fe-ux-04d.test.ts`, `uiux-02-dau-man.test.ts`. `getByLabel` cấp trang chế độ
strict (`Số tiền rút (VNDB)`, `Ví nhận`, `Mục đích`) vẫn khớp đúng một phần tử: hậu tố, biểu tượng không phải `label`,
không có `aria-label`. Cả bộ trong 1.1.

### 2.5 Mã dư thừa

Đã xoá: `FIELD`; `short`, `nf` ở trang (dời); import `explorerTxUrl`, `ExternalLink`, `TableCell` ở trang (hết chỗ
dùng sau khi dời); lớp `*-destructive`; `Badge variant="outline"` của dòng. `Loader2` còn dùng (nút Tạo lệnh rút khi
kiểm ví nhận, dòng `busy`, nút Xác nhận); `Wallet` còn dùng (`EmptyState` chưa kết nối). Lint đạt, không import thừa.

## 3. Dời nguyên văn (QĐ-5, commit `e45cbf1`)

Kiểm bằng máy: bỏ khoảng trắng đầu dòng và dòng trống của đoạn cũ (`investor-withdraw.tsx:433-480` tại `400ffcc`) và
thân hàm mới, so `diff`: 48 dòng mỗi bên, 15 dòng khác và mỗi dòng chỉ do các phép được phép (`r` thành `row`; 3 chỗ `busy !== null`
thành `busy`; `void sendRow(r)` thành `void onSend()`; 2 chỗ `void cancelRow(r)` thành `void onCancel()`; bỏ
`key={r.id}`). `short`, `nf` khác đúng chữ `export`. Trang nhập `nf` (cho `settledMessage`, số dư, hộp mã) và
`WithdrawRequestRow`; dòng nhập `nf`, `short`. Commit này còn `FIELD`, `variant="outline"`; commit sau mới đổi kiểu.

Trước (`investor-withdraw.tsx:433-480` tại `400ffcc`, bỏ thụt lề chung 16 dấu cách):

```tsx
  const txHash = r.completedTxHash ?? r.submittedTxHash;
  const url = txHash ? explorerTxUrl(chain, txHash) : null;
  return (
    <TableRow key={r.id} data-status={r.status}>
      <TableCell className="font-code text-xs" title={r.id}>
        {r.id.slice(0, 8)}
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs">{new Date(r.createdAt).toLocaleString('vi-VN')}</TableCell>
      <TableCell className="text-right tabular-nums">{nf(r.amount)}</TableCell>
      <TableCell className="font-code text-xs" title={r.toWallet}>
        {short(r.toWallet)}
      </TableCell>
      <TableCell>
        <Badge variant="outline">{PAYMENT_WITHDRAW_STATUS_LABELS[r.status]}</Badge>
      </TableCell>
      <TableCell className="font-code text-xs">
        {txHash === null ? (
          ''
        ) : url ? (
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
            {short(txHash)}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        ) : (
          <span title={txHash}>{short(txHash)}</span>
        )}
      </TableCell>
      <TableCell className="max-w-56 text-xs text-muted-foreground">{r.reason ?? ''}</TableCell>
      <TableCell>
        {r.status === 'CREATED' ? (
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={busy !== null} onClick={() => void sendRow(r)}>
              Gửi từ ví
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void cancelRow(r)}>
              Huỷ
            </Button>
          </div>
        ) : r.status === 'SENDING' ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Đang chờ ví ký hoặc kết quả trên chuỗi</p>
            <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void cancelRow(r)}>
              Huỷ
            </Button>
          </div>
        ) : null}
      </TableCell>
    </TableRow>
```

Sau (`components/withdraw/withdraw-request-row.tsx` tại `e45cbf1`):

```tsx
import { explorerTxUrl, type ChainKey } from '@bidv/shared';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { nf, short } from '@/components/withdraw/format';
import { PAYMENT_WITHDRAW_STATUS_LABELS } from '@/components/withdraw/labels';
import type { PaymentWithdrawView } from '@/lib/bank/payment-withdraw.service';

/** Một dòng của bảng "Lệnh rút của tôi" (`/withdraw`), dời nguyên văn từ `investor-withdraw.tsx` (FE-UX-04d QĐ-5). */
export function WithdrawRequestRow({
  row,
  chain,
  busy,
  onSend,
  onCancel,
}: {
  row: PaymentWithdrawView;
  chain: ChainKey;
  busy: boolean;
  onSend: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
}) {
  const txHash = row.completedTxHash ?? row.submittedTxHash;
  const url = txHash ? explorerTxUrl(chain, txHash) : null;
  return (
    <TableRow data-status={row.status}>
      <TableCell className="font-code text-xs" title={row.id}>
        {row.id.slice(0, 8)}
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs">{new Date(row.createdAt).toLocaleString('vi-VN')}</TableCell>
      <TableCell className="text-right tabular-nums">{nf(row.amount)}</TableCell>
      <TableCell className="font-code text-xs" title={row.toWallet}>
        {short(row.toWallet)}
      </TableCell>
      <TableCell>
        <Badge variant="outline">{PAYMENT_WITHDRAW_STATUS_LABELS[row.status]}</Badge>
      </TableCell>
      <TableCell className="font-code text-xs">
        {txHash === null ? (
          ''
        ) : url ? (
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
            {short(txHash)}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        ) : (
          <span title={txHash}>{short(txHash)}</span>
        )}
      </TableCell>
      <TableCell className="max-w-56 text-xs text-muted-foreground">{row.reason ?? ''}</TableCell>
      <TableCell>
        {row.status === 'CREATED' ? (
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={() => void onSend()}>
              Gửi từ ví
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void onCancel()}>
              Huỷ
            </Button>
          </div>
        ) : row.status === 'SENDING' ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Đang chờ ví ký hoặc kết quả trên chuỗi</p>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void onCancel()}>
              Huỷ
            </Button>
          </div>
        ) : null}
      </TableCell>
    </TableRow>
  );
}
```

Chỗ gọi trong trang (tại `e45cbf1`):

```tsx
{rows.map((r) => (
  <WithdrawRequestRow
    key={r.id}
    row={r}
    chain={chain}
    busy={busy !== null}
    onSend={() => sendRow(r)}
    onCancel={() => cancelRow(r)}
  />
))}
```

`short` (`:42`), `nf` (`:44-51`) tại `400ffcc`:

```ts
const short = (value: string) => `${value.slice(0, 10)}…${value.slice(-6)}`;

const nf = (value: string | bigint | null | undefined) => {
  if (value === null || value === undefined || value === '') return '-';
  try {
    return BigInt(value).toLocaleString('vi-VN');
  } catch {
    return String(value);
  }
};
```

`components/withdraw/format.ts` tại `e45cbf1`:

```ts
/** Định dạng dùng chung của màn Rút VNDB (`/withdraw`), dời nguyên văn từ `investor-withdraw.tsx` (FE-UX-04d QĐ-5). */

export const short = (value: string) => `${value.slice(0, 10)}…${value.slice(-6)}`;

export const nf = (value: string | bigint | null | undefined) => {
  if (value === null || value === undefined || value === '') return '-';
  try {
    return BigInt(value).toLocaleString('vi-VN');
  } catch {
    return String(value);
  }
};
```

## 4. Đo trước và sau

Cùng máy, cùng quy trình (script ngoài repo): máy chủ mới cổng 3300 (đủ `webServer.env`), tạo dữ liệu bằng
`maker-checker`, `ops-transactions`, `permit-order`, `recall`; đo bằng `tools/20261104_do_moc_measure.js` (sha256
`6079a0d6…` khớp spec) với `JS_PAGES=/,/portfolio,/trade,/approvals,/withdraw`; 28 dòng mỗi lượt. Tiến trình đo khác
tiến trình chụp ảnh. JS theo byte: script riêng cộng gzip mọi script khi mở trang (cùng cách cộng của công cụ), máy chủ
mới cổng 3500 sau `ops-transactions`.

| Mục | Mốc `400ffcc` | Sau `ca805ed` | Trần |
|---|---|---|---|
| Số action khi mở màn | 28 đường dẫn; `/withdraw` 1 | Khớp 28/28 | không đổi |
| `hydration`, `consoleErrors`, `pageErrors` | 0 ở cả 28 đường dẫn | 0 ở cả 28 đường dẫn | `/withdraw` 0, khác không tăng |
| JS gzip (công cụ) `/`; `/portfolio`; `/trade`; `/approvals`; `/withdraw` | 558,2; 456,9; 480,0; 455,2; 472,7 KB | 558,3; 456,9; 480,0; 455,2; 474,4 KB | |
| CSS gzip (`.next/static/chunks/*.css`, 1 tệp, gzip mức 9) | 19.403 B | 19.448 B (+45 B) | +2 KB |
| `role` trong `main` (ca 1) | status 0, note 0, alert 0 | giống hệt | bằng mốc |

JS gzip theo byte. Bản mốc của lượt e2e đầy đủ build đúng mã `400ffcc` (nhánh lúc đó chỉ thêm spec và e2e); bản mốc
build riêng build lại `400ffcc` sau bản cuối, cùng phiên (`NEXT_DIST_DIR=.next-moc`, hai tệp mới của nhánh tạm gỡ khi
build, đã xoá thư mục):

| Trang | Mốc (lượt e2e) | Mốc build riêng | Sau `ca805ed` | Chênh so build riêng |
|---|---|---|---|---|
| `/portfolio` | 467817 | 467813 | 467827 | +14 |
| `/tokens/WPT` | 463059 | 463056 | 463067 | +11 |
| `/trade` | 491533 | 491532 | 491559 | +27 |
| `/orders` | 549415 | 549411 | 549407 | -4 |
| `/orders/[id]` | 463381 | 463381 | 463379 | -2 |
| `/withdraw` | 484028 | 484025 | 485787 | +1762 |
| `/` | 571628 | 571624 | 571662 | +38 |
| `/approvals` | 466103 | 466099 | 466097 | -2 |
| `/distribution` | 479647 | 479648 | 479562 | -86 |
| `/vault` | 469544 | 469541 | 469579 | +38 |
| `/wallet` | 466907 | 466905 | 466924 | +19 |

Trần: `/withdraw` +3.072 B; trang khác không tăng. Đã lưu và so từng chunk của `/`, `/portfolio`, `/trade`, `/vault`
giữa bản mốc build riêng và bản sau:

- `/`, `/portfolio`: cùng số tệp, tổng kích thước thô bằng nhau (1.916.040 B; 1.552.820 B), chunk khác tên cùng kích
  thước thô; lệch gzip (+38, +14 B) là nhiễu nén.
- `/trade`: chunk trang 89.218 B thành 89.220 B thô; khác ở mã module và mã tham chiếu server action, không thêm mã.
- `/vault` (+38 B gzip, ngoài `JS_PAGES`): chunk trang 43.653 B thành 43.738 B thô. `/vault` dùng biểu tượng
  `LockKeyhole` từ trước; bản mốc định nghĩa biểu tượng ngay trong chunk của trang, bản sau tách thành module dùng
  chung (vì `/withdraw` cũng dùng theo QĐ-4) nên thêm vỏ module khoảng 85 B thô. Không có mã mới của `/vault`.
- `/tokens/WPT` +11, `/wallet` +19 B: cùng lớp nhiễu (công cụ không đo; không đổi tệp liên quan).

CSS mốc lấy từ bản build mốc sạch (19.403 B). Bản mốc build riêng cho 19.473 B vì build lúc `.next-moc` nằm trong
`app/` (Tailwind quét thư mục chưa ignore); không dùng số đó.

## 5. Ảnh (gửi kèm, không commit)

- Ba bước vai Nhà đầu tư, 1440 và 390, Sáng và Tối, trước (`moc/anh/`) và sau (`sau/anh/`): (a) `/withdraw` vừa mở;
  (b) nhập 999999999999999 vào Số tiền rút; (c) số tiền 1, Ví nhận NB001, Mục đích, bấm "Tạo lệnh rút", chụp hộp mã
  một lần. Mỗi lượt một tiến trình mock MỚI cổng 3400: `npx next start --port 3400` với đủ biến của `webServer.env`
  (`NEXT_PUBLIC_DEFAULT_CHAIN`, `USE_MOCK_KYC`, `USE_MOCK_DB`, `DEMO_ROLE`, `ENABLE_DEMO_TOKEN_MINT`,
  `ENABLE_DEMO_PAYMENT_MINT`, `ENABLE_INVESTOR_SELL`, khoá ký mẫu Hardhat, `RPC_HARDHAT`); `E2E_BASE_URL=…
  npx playwright test e2e/investor-withdraw.spec.ts` (2 ca đạt: định danh ví, nạp VNDB, rút 1 VNDB tới "Hoàn tất");
  chụp; tắt. Mốc (bản build `400ffcc`): bật 01:37:52Z, tắt 01:38:21Z. Sau (bản build `ca805ed`): bật 01:48:08Z, tắt
  01:48:37Z (05/11/2026, UTC). `main` không tràn ngang, 0 lỗi console ở cả 12 ảnh mỗi lượt.
- 28 đường dẫn của script đo, trước (`moc/do/`) và sau (`sau/do/`), 1440 và 390, Sáng và Tối.
- Trạng thái không dựng được trên mock (7 trạng thái): dòng "Chờ gửi"; "Chờ gửi" đang bận (hai nút khoá); "Chờ ký
  trong ví" (Hardhat); "Đã gửi, chờ xác nhận" trên Sepolia (có explorer, liên kết); "Đã gửi, chờ xác nhận" trên
  Hardhat (không explorer, chữ); "Hoàn tất" trên mock; "Đã huỷ" có lý do. HTML dựng bằng `renderToStaticMarkup` (bảng
  `Table` có hàng tiêu đề 8 cột như trang, test tạm xoá ngay, không commit), CSS bản build tương ứng,
  `page.setContent`, Sáng và Tối, 1440 (khung 1200 px) và 390 (`anh_tinh_moc/`, `anh_tinh_sau/`). Trước dùng mã
  `e45cbf1` (đúng mã `400ffcc` sau khi dời, chưa đổi kiểu) và CSS bản mốc; sau dùng mã cuối và CSS bản sau. Ở 390 px
  bảng cuộn ngang trong khung bảng.
- Kiểm đọc được (Sáng và Tối): ô vàng "Số dư sau rút" chữ tối trên nền vàng; nhãn "Đã định danh" xanh lá; câu vượt số
  dư đỏ; nhãn trạng thái dòng có sắc (Chờ gửi vàng, Hoàn tất xanh lá, Đã huỷ xanh dương).

## 6. Lệnh kiểm (tasks bước 6, `LC_ALL=C`)

```text
6a $ git diff --name-only --diff-filter=d ... | grep -vE '^(...danh sách trắng...)$'      # rỗng
   $ git diff --name-only --diff-filter=D origin/release/ui-v2...HEAD                     # rỗng
6b $ rg -n '...màu cứng...|-destructive\b' app/src/components/pages/investor-withdraw.tsx app/src/components/withdraw/   # rỗng
6c $ comm -13 /tmp/feux04d-del.txt /tmp/feux04d-add.txt | rg -n '...ký tự cấm...'        # rỗng
6d $ comm -23 <(ext /tmp/feux04d-del.txt) <(ext /tmp/feux04d-add.txt)                    # rỗng
6e $ rg -n '...ký tự cấm...' <trang> app/src/components/withdraw/ <test> <e2e> | rg -v '<dòng chú thích>'   # rỗng
```

Chạy trên HEAD `7c0f1f6`, `LC_ALL=C`. 6d rỗng: không câu tiếng Việt nào mất hay đổi (hai chữ "VNDB" thêm không có dấu
nên không vào 6d). `docs/tech-report.md` không đổi (không marker trong các tệp đã sửa).

## 7. Đối chiếu notes (`notes/withdraw.md`)

Cột "Kết quả": **Làm** (đúng bản chốt), **Giữ** (màn thật đã như vậy hoặc chỉ giữ chữ), **Không làm** (kèm lý do).

| Dòng notes | Kết quả |
|---|---|
| Tiêu đề "Rút VNDB" và câu mô tả | Làm tiêu đề; không câu mô tả (requirements mục 1, test cấm câu phụ) |
| Thanh "Trạng thái xem thử" | Không làm: không phải khối màn thật; trạng thái kiểm bằng unit test, e2e và ảnh dựng tĩnh |
| Thẻ "Thông tin lệnh rút", form `aria-label` | Làm: `CardTitleIcon` `Send`, form giữ |
| Ô "Số tiền rút (VNDB)" dấu chấm hàng nghìn | Giữ `AmountInput`; thêm hậu tố "VNDB" trong khung ô (QĐ-4) |
| Câu đỏ "Vượt số dư…" | Giữ chữ, `role="alert"`; màu `text-bad-ink` |
| Ô "Mạng" chỉ đọc | Giữ; thêm biểu tượng `Link2` |
| Ô "Ví gửi" + "Đã định danh" | Làm: biểu tượng khoá `LockKeyhole`, `Badge variant="ok"` có `BadgeCheck`, `data-wallet-bound` |
| Ô "Ví nhận", lỗi dưới ô, câu whitelist | Giữ chữ, điều kiện; lỗi `text-bad-ink` |
| Ô "Mục đích", "Ghi chú" | Giữ; `fieldClass` |
| Nút "Tạo lệnh rút" | Giữ `disabled={!canSubmit}`; không thêm biểu tượng trên nút (requirements mục 1) |
| Dòng chờ (`busy`) có biểu tượng quay | Giữ `role="status"`, `Loader2` |
| Câu kết quả (`aria-label="Kết quả rút VNDB"`), lỗi tô đỏ | Làm: `Alert` `ok`/`bad`, giữ `role` theo tone, `aria-label`, `break-all` |
| Thẻ "Hệ thống tính": Số dư VNDB, Số rút | Làm: `CardTitleIcon` `Gauge`, `dl` hai dòng kẻ ngăn; không biểu tượng đầu dòng (requirements mục 1) |
| Ô vàng đậm "Số dư sau rút" | Làm: `Kpi tone="au"` dính đáy thẻ, đơn vị "VNDB"; không biểu tượng trong ô, không hiệu ứng nổi (requirements mục 1) |
| Câu "Phí gas…" (ẩn trên Mock) | Giữ chữ, `!onMock`; thêm `Flame`, đặt sau `dl` |
| Thẻ "Lệnh rút của tôi", bảng 8 cột | Làm: `CardTitleIcon` `ListChecks` (không biểu tượng lịch sử, requirements mục 1); 8 cột giữ |
| Trạng thái tô màu theo nghĩa | Làm: `PAYMENT_WITHDRAW_STATUS_TONES` |
| Trên điện thoại mỗi dòng thành ô thẻ | Không làm: giữ bảng cuộn ngang (requirements mục 1) |
| Mã giao dịch là liên kết explorer | Giữ điều kiện; chữ `text-primary` |
| Dòng "Chờ gửi" (Gửi từ ví, Huỷ), "Chờ ký trong ví" (câu, Huỷ) | Giữ trong `WithdrawRequestRow` (unit nhóm 2, ảnh tĩnh) |
| Câu rỗng "Chưa có lệnh rút VNDB nào…" | Làm: `EmptyState` |
| Hộp "Xác nhận mã một lần" | Giữ nội dung; ô mã `fieldClass` canh giữa; lỗi `feedback` trong hộp `Alert bad role="alert"` |
| Thông báo "Ví chưa được định danh" | Giữ `WalletNotBoundNotice` (không sửa `components/investor/*`) |
| "Chưa kết nối ví" + liên kết "Kết nối ví" | Làm: `h1` rồi `EmptyState` `Wallet` |
| "Đang đọc số dư…" | Làm: `EmptyState loading` |
| Câu lỗi đỏ (`fresh.error`) | Làm: `Alert bad` không `role` |
| Kiểu cục bộ `.calc`, `.gas`, `.from-row`, `.row-act`, `.tx-link`, `dialog.otp` | Làm bằng lớp Tailwind tương ứng (thẻ `flex-col`, `mt-auto`; hàng ví gửi; nút `sm`); `dialog.otp` giữ `Dialog` dùng chung |
| Mục "Trạng thái giữ theo dev, chưa vẽ" (lỗi mã trong hộp, câu lỗi ví chain thật) | Giữ chỗ hiện và chữ |
| Mục "Lệch đã thấy" (thời điểm `toLocaleString`, `nf` trả "-", dòng huỷ chỉ có trên chain thật) | Không làm: logic hoặc chữ (requirements mục 1) |

## 8. Nợ và DEVIATION

- **Ca 1 so bóng (lệch chữ design mục 3).** Design ghi "`boxShadow` là `none`". QĐ-4 chỉ định lớp
  `hover:shadow-none!`; trong Tailwind 4 lớp này đặt `box-shadow` bằng chuỗi năm lớp bóng trong suốt cỡ 0 (các biến
  `--tw-*-shadow`), nên `getComputedStyle` trả `rgba(0, 0, 0, 0) 0px 0px 0px 0px, …` chứ không phải chữ `none`. Em giữ
  đúng lớp QĐ-4 và cho ca 1 coi là không bóng khi mọi lớp trong suốt (`7c0f1f6`); `transform` vẫn so đúng `none`. Bỏ
  lớp đó thì ca 1 đỏ (mục 1.3, điểm thêm). Lượt e2e liên quan đầu tiên trên bản sau đỏ ca 1 vì đúng lý do này, đã chạy
  lại sau khi sửa (13 ca đạt).
- **Bản mốc build riêng lần đầu hỏng:** `git checkout 400ffcc -- app/src` không xoá hai tệp mới của nhánh nên build
  lỗi kiểu; lần sau gỡ tạm hai tệp đó khi build rồi hoàn, số trong mục 4 lấy từ lần sau.
- **`/vault` +38 B gzip** do `LockKeyhole` thành module dùng chung (mục 4); không đổi được nếu giữ biểu tượng QĐ-4.
- **Chưa làm theo requirements mục 1 "Không làm":** câu phụ dưới tiêu đề; ô chọn token; bảng thành thẻ ở màn nhỏ;
  biểu tượng trên nút; biểu tượng đầu dòng `dl`, trong ô `Kpi`; hiệu ứng nổi `Kpi` (FE-UX-08); màn Người bán.

## 9. Tự đánh giá 3 luật kiến trúc

- [x] Mọi call chain qua ILedgerPort: không đổi mã gọi chuỗi.
- [x] Mọi ký qua ISigner: không đổi (`sendPaymentTransferWithWallet` giữ nguyên chỗ gọi).
- [x] Mọi kiểm quyền qua RBAC: không đổi.
