# Báo cáo bàn giao: FE-UX-06b Phát hành dữ liệu thử, Sổ kiểm toán, khối thông tin token

| | |
|---|---|
| Mã task | FE-UX-06b |
| Phạm vi | **Frontend thuần.** Bốn tệp có sẵn (`components/pages/mint.tsx`, `app/(ops)/audit/page.tsx`, `app/(account)/account/page.tsx` một lớp, `components/maker-checker/token-info-block.tsx`), hai tệp mới (`components/mint/txn-history-table.tsx`, `components/audit/audit-table.tsx`); không `lib/`, `app/actions`, `components/ui/*`, `components/layout/*`; không gói npm mới; không đổi hook, effect, action, điều kiện khoá, `title`. Chữ chỉ đổi đúng QĐ-7 |
| Nhánh | `feat/fe-ux-06b-phat-hanh-kiem-toan`, tạo từ `release/ui-v2` @ `d2a5bca` (sau merge PR #100 FE-UX-06a; đã gồm 05b, 05c). **Merge-base dùng để đo mốc: `d2a5bca`**. Không có PR nào merge vào `release/ui-v2` trong lúc làm nên không phải rebase |
| Spec | `docs/fe-ux-06b-phat-hanh-kiem-toan/{requirements,design,tasks}.md` (chép nguyên) |
| Commit | spec `d8d0fe5`; e2e nháp `5710a63`; số `role`, action mốc `b3e27d3`; **dời** (QĐ-2) `9b94001`; đổi kiểu `bcc36e8`; biểu tượng thẻ Lịch sử (DEVIATION, mục 8) `eb7d37d`; UserGuide, task-status `d08efba`; tài liệu: các commit cuối trên nhánh |
| Tiến độ | Xong. Một PR, base `release/ui-v2`, chờ Supervisor nghiệm thu; Claude Code **không** merge |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 4) | | Bằng chứng |
|---|---|---|---|
| 1 | `/mint`, `/audit` đúng bố cục design mục 1; bảng khối cũ và mới; khối thông tin token không cắt chữ ở `/draft`, `/approvals/[id]` (1440, 390) | ✅ | mục 2.1, 5, 7 |
| 2 | Thành phần đúng QĐ-3, QĐ-4, QĐ-8 | ✅ | mục 2.1, 1.3 nhóm 1, 4, 5 |
| 3 | `TxnHistoryTable`, `AuditTable` dời đúng QĐ-2, commit riêng; đoạn trước và sau | ✅ | mục 3 |
| 4 | Không `*-destructive`, màu cứng, ký tự cấm trong tệp phạm vi; `.tsx` trong `app/src/app` không còn `destructive`; sắc nhãn QĐ-5 | ✅ | mục 6 (6b, 6c, 6e, 6f), 1.3 nhóm 1 đến 3 |
| 5 | Chữ chỉ đổi đúng QĐ-7 (6d đúng kỳ vọng); không đổi nút, điều kiện khoá, `title`, điều kiện hiện | ✅ | mục 6 (6d), 2.2 |
| 6 | Diff giữ logic (QĐ-1); liệt kê đoạn đổi gần hook, effect, `run`, handler, điều kiện khoá | ✅ | mục 2.2 |
| 7 | Action khi mở `/mint`, `/audit` bằng mốc, 28 đường dẫn không đổi; JS, CSS trong trần QĐ-10; lỗi ba màn 0 | ✅ | mục 4 |
| 8 | Mốc test QĐ-9 giữ; không sửa test có sẵn | ✅ | mục 1.1, 2.3 |
| 9 | Ảnh 1440, 390, Sáng, Tối, trước và sau, tiến trình mock mới, đủ (a) đến (d) | ✅ | mục 5 |
| 10 | Trạng thái khó tạo nghiệm thu đúng cách từng trường hợp, có ảnh dựng ngoài repo | ✅ | mục 5.2 |
| 11 | `fe-ux-06b-phat-hanh-kiem-toan.spec.ts` đủ 4 ca, `fe-ux-06b.test.ts` đủ 5 nhóm, xanh | ✅ | mục 1.2, 1.3 |
| 12 | Kiểm thử mục 5 đạt, kèm log; "EVM - E2E PROJECT HARDHAT" xanh (gồm `mint`) | ✅ | mục 1.1 |
| 13 | Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 6) đúng kỳ vọng | ✅ | mục 6 |
| 14 | Không mã dư thừa | ✅ | mục 2.4 |

**Kết luận:** 14 ✅, 0 🔶, 0 ❌. JS gzip theo byte so bản mốc build riêng: `/mint` +949 B (trần 3.072), `/audit` +1 B
(trần 1.024), `/draft` +24 B, `/approvals/[id]` -6 B (trần 512); mười tám trang khác lệch -54 đến +40 B, so từng tệp script
20 trang: tổng thô bằng mốc từng byte trừ `/mint`, `/draft` (khối thông tin token) và đổi số hiệu module (mục 4). Một
DEVIATION nhỏ: biểu tượng thẻ Lịch sử giao dịch `FileClock` thay `ListChecks` để không làm chunk trang khác tăng (mục 8). CSS 19.237 B, -40 B so mốc 19.277 B. Action khớp 28/28
(`/mint` 1, `/audit` 0); `hydration`, `consoleErrors`, `pageErrors` 0 ở mọi đường dẫn cả mốc lẫn sau; `role` trong `main`
(0, 0, 0) cả hai màn bằng mốc. Bốn điểm gây lỗi của Supervisor đều làm unit đỏ (mục 1.3). Mức rủi ro: thấp (không đổi logic;
trang phát hành thử tắt mặc định).

UserGuide: "Chốt tại"; 3.4.2 khối thông tin token; 3.4.8 `/mint` thêm "Bố cục (FE-UX-06b)", dòng kết quả, nhãn nút, sắc nhãn,
L-78 trỏ `txn-history-table.tsx:29`; 3.6.3 `/audit` thêm "Bố cục (FE-UX-06b)", sắc, ô trống, `title` ô Chi tiết, dòng mã
`page.tsx:15`. task-status: FE-UX-06b `done`.

### 0.2 Việc cần Owner quyết

- Không có.

---

## 1. Kiểm thử (requirements mục 5, phần dev)

### 1.1 Lệnh và kết quả

__DIEN_1_1__

Ngoài bộ trên: bước 3 (tasks) chạy `mint`, `uiux-02-dau-man` (e2e, project mock) trên bản build riêng của commit dời
`9b94001` (máy chủ mới): 11 ca đạt, 4 bỏ qua (ca chỉ chạy trên Hardhat); `op07-chain-scope`, `fe-ux-06b` (phần dời) đạt.
Bước 4, 7 chạy `fe-ux-06b-phat-hanh-kiem-toan`, `maker-checker`, `mint`, `chain-selector`, `token-info-read`,
`uiux-02-dau-man`, `account-info` (project mock) trên bản build `eb7d37d`: 40 ca đạt, 4 bỏ qua (chỉ Hardhat); riêng tệp
`fe-ux-06b-phat-hanh-kiem-toan` trên máy chủ mới (ví NDT001 chưa whitelist trước ca 2): 5 ca đạt;
`fe-ux-06b`, `op07-chain-scope`, `uiux-02-dau-man`, `fe-ux-05b` (unit) đạt.

### 1.2 e2e mới `app/e2e/fe-ux-06b-phat-hanh-kiem-toan.spec.ts` (project mock, vai Giao dịch viên)

Chờ tải: `networkidle` cộng 1 giây. Không bấm phát hành với ví đã whitelist; KYC chỉ ở ca 2 với ví NDT001.

| Ca | Kiểm | Mốc `d2a5bca` | Sau |
|---|---|---|---|
| mốc: role | `/mint`, `/audit` 1440 px: `h1` đúng chữ; đếm `[role="status"]`, `[role="note"]`, `[role="alert"]` trong `main` bằng hằng số | đo ra (0, 0, 0) cả hai | xanh |
| mốc: action (ca 4) | Ngữ cảnh mới mỗi trang: `/mint` 1, `/audit` 0 action | đo ra 1, 0 | xanh |
| 1 | `/mint`: một `h1`; 3 heading cấp 2; Nhà đầu tư trái Trạng thái on-chain, cùng đỉnh, rộng hơn; không `role="status"`; 390 px Trạng thái on-chain dưới, rộng bằng. `/audit`: `h1` "Sổ kiểm toán", heading cấp 2 "Bản ghi gần nhất", bảng hoặc `[data-slot="empty-state"]` | đỏ (không heading cấp 2) | xanh |
| 2 | KYC NDT001: đúng một `[role="status"]` chứa `whitelist=true`, không U+00B7; "đã KYC" lớp `bg-ok-bg`; một nút `/Phát hành/`. `/draft` nhập "WPT": mọi `dd` không tràn, không `truncate`; ví 42 ký tự nếu có. 390 px ví chưa whitelist: `[role="status"]` chứa "chưa được whitelist", phần tử đó và thẻ Nhà đầu tư không tràn | đỏ (không tìm được thẻ theo heading) | xanh |
| 3 | `/mint`, `/audit`, `/draft` 1440 và 390 px: `main` không tràn; 0 lỗi console, `pageerror`, cảnh báo hydrate | xanh | xanh |

Hằng số đo trên bản build mốc `d2a5bca` bằng chính tệp này (`--grep "mốc:"`, máy chủ MỚI cổng 3600): `/mint`, `/audit`
`{ status: 0, note: 0, alert: 0 }`; action `/mint` 1 (`listTransactionsAction`), `/audit` 0. Lượt đầu chạy với hằng `-1`
chỉ đo được `/mint` (vòng lặp dừng ở trang đầu); lượt hai điền `/mint` để đo `/audit`, cũng máy chủ mới.

### 1.3 Unit test mới `app/test/fe-ux-06b.test.ts` (môi trường `node`, 24 ca)

Giả `@/lib/bank/audit.service` (`listAuditLog: vi.fn()`) và `@/components/layout/app-layout` (chỉ trả `children`);
`HoverHint` dựng được, không cần giả.

| Nhóm | Kiểm |
|---|---|
| 1 Mã nguồn | `mint.tsx`: đúng 1 mỗi `listTransactionsAction(`, `readBalanceAction(`, `onboardInvestorAction(`, `mintAction(`; 2 `useEffect(`; nguyên văn `listTransactionsAction({ chain: activeChain, limit: 20 })`, hai biểu thức `variant` của thẻ on-chain, hai nhãn nút, hai `disabled`, `role="status"`, `<TxnHistoryTable txns={txns} />`; không `-destructive`, `'destructive'`, `rounded-md border border-border bg-background`, U+00B7, U+2014 ngoài chú thích. `audit/page.tsx`: 1 `listAuditLog(`, không `'use client'`, `Action(`; `<AuditTable entries={result.data} />`; không `destructive`, U+2014. `account/page.tsx`: `role="alert" className="text-sm text-bad-ink"`. Hai bảng: không `Action(`, `useEffect(`, `useState(`; nhập từ `lib/bank`, `lib/store` là `import type`. `token-info-block.tsx`: không `truncate`, `sm:grid-cols-2`; có `[overflow-wrap:anywhere]`. Mọi `col-span-` trong 6 tệp có tiền tố mốc |
| 2 `TxnHistoryTable` | 6 cột đúng thứ tự, 3 dòng; nhãn đúng mã trạng thái, sắc `bg-ok-bg`, `bg-bad-bg`, `bg-warn-bg`; ví `slice(0, 10)…slice(-4)`; số lượng canh phải; ví, số lượng rỗng là U+2013, không U+2014 |
| 3 `AuditTable` | 6 cột, 4 dòng; sắc `ALLOWED`, `SUCCESS` ok, `DENIED`, `FAILURE` bad; đối tượng 10 ký tự rồi "…"; đối tượng, chi tiết rỗng U+2013; ô Chi tiết có `title` bằng `detail`, không `title` khi rỗng |
| 4 `TokenInfoBlock` | 10 cặp `dt`/`dd` liền kề đúng thứ tự nhãn; `dd` không `truncate`; ví thanh toán 42 ký tự đủ; hợp đồng đủ; `aria-label`; ba câu đang tải, lỗi, chưa nhập |
| 5 Trang `/audit` | `renderToStaticMarkup(await AuditPage())`: lỗi thì `[data-slot="alert"]` `data-tone="bad"`, không `role=`, không bảng; rỗng thì `EmptyState` "Chưa có bản ghi."; một bản ghi `DENIED` thì có bảng, nhãn `bg-bad-bg`. Mọi ca: một `h1` "Sổ kiểm toán"; `listAuditLog` gọi đúng 1 lần với `100` |

Commit dời `9b94001` có nhóm 1 phần lời gọi, nhóm 2, 3 phần cột và chữ (8 ca, xanh trên mã dời nguyên văn); phép kiểm sắc,
U+2013, `title` thêm ở commit đổi kiểu.

Tự gây lỗi (4 điểm của Supervisor, trên bản sao làm việc, hoàn lại bằng `git checkout`):

| Điểm | Ca đỏ |
|---|---|
| `role` kết quả thành `alert` khi `tone` là `error` | 1 (nhóm 1 `mint.tsx`) |
| Thêm `truncate` vào `dd` khối thông tin token | 2 (nhóm 1 `token-info-block.tsx`, nhóm 4) |
| Sắc `DENIED` về `ok` trong `AuditTable` | 2 (nhóm 3, nhóm 5 ca `DENIED`) |
| Bỏ `pending ||` khỏi `disabled` nút KYC | 1 (nhóm 1 `mint.tsx`) |

## 2. Thay đổi

### 2.1 Hai màn và khối thông tin token

| Khối | Đổi |
|---|---|
| `/mint` đầu màn | `h1` lớp `text-2xl font-semibold tracking-tight`, giữ chữ và `HoverHint`; đoạn giới thiệu thành `Alert tone="info"` không `role`, giữ chữ và liên kết "Lập lệnh" `prefetch={false}` |
| `/mint` lưới | `grid gap-6 min-[1100px]:grid-cols-12`; Nhà đầu tư `min-[1100px]:col-span-8`, Trạng thái on-chain `min-[1100px]:col-span-4`; Lịch sử rộng hết dưới lưới |
| Ba `CardTitle` của `/mint` | `role="heading" aria-level={2}`, lớp `flex items-center gap-2.5 text-base`, `CardTitleIcon` `UserCheck`, `Link2`, `FileClock` (DEVIATION, mục 8); chữ giữ (gồm "Lịch sử giao dịch ({chain})") |
| Ô nhập | `fieldClass` cộng `font-code` (ví) hoặc `tabular-nums` (số lượng); `id`, `label`, `value`, `onChange`/`onValueChange`, `placeholder`, `spellCheck`, câu gợi ý giữ |
| Kết quả | `Alert role="status"` sắc `ok`/`bad` theo `feedback.tone`; bỏ `CheckCircle2`, `XCircle` tự viết (dùng biểu tượng của `Alert`); chữ trong `span.[overflow-wrap:anywhere]` |
| Trạng thái on-chain | `CardContent className="divide-y divide-border text-sm"`; `Row` giữ cấu trúc (nhãn, giá trị là hai con trực tiếp), thêm `py-2.5`; Whitelist `ok`/`warn`, Đóng băng `bad`/`outline` |
| Lịch sử | Rỗng `EmptyState icon={<FileClock />}` giữ câu; bảng `TxnHistoryTable` (vẫn là bảng cuối trang) |
| `/audit` | `h1` cùng lớp; `CardTitle` heading cấp 2, `ScrollText`; lỗi `Alert tone="bad"` không `role`; rỗng `EmptyState icon={<ScrollText />}` giữ câu (gồm "/mint"); bảng `AuditTable` |
| Hai bảng (QĐ-5) | Bảng tra `TXN_STATUS_TONES: Record<TxnView['status'], BadgeVariant>`, `OUTCOME_TONES: Record<AuditRecord['outcome'], BadgeVariant>`, `BadgeVariant` khai báo cục bộ; ô trống U+2013; ô Chi tiết thêm `title={entry.detail ?? undefined}`, giữ `max-w-[28rem] truncate` |
| Khối thông tin token (QĐ-8) | `dl` `grid gap-y-2 text-sm` (bỏ `gap-x-6`, `sm:grid-cols-2`); `dd` `min-w-0 text-right [overflow-wrap:anywhere]` (cộng `font-code` khi `mono`), giữ `title`, `aria-label`, 10 cặp, ba câu |
| `/account` (QĐ-6) | Câu lỗi `text-destructive` thành `text-bad-ink`, giữ `role="alert"` |

### 2.2 Đoạn đổi gần hook, effect, `run`, handler, điều kiện khoá (QĐ-1)

Không đổi ký tự: `useState`, `useRef`, `useTransition`, hai `useEffect`, `load` (gồm
`listTransactionsAction({ chain: activeChain, limit: 20 })` và `readBalanceAction`), `apply`, `run`, `fresh`, `status`, `txns`,
`mayMint`, `mayWhitelist`, hai `onClick`, hai `disabled` (`pending || !wallet || !mayWhitelist`,
`pending || !wallet || !mayMint`), hai `title`, điều kiện `feedback &&`, `status ?`, `txns.length === 0`. Các đoạn có đụng:

- `handleOnboard`, `handleMint`: chỉ chuỗi `message` (chấm giữa thành dấu phẩy, QĐ-7); `tone`, nhánh `result.ok`, lời gọi action
  giữ. Chuỗi con `whitelist=true`, "Đã phát hành 100 WPT" còn nguyên (e2e đọc).
- Hai nút: chỉ chữ nhãn ("1. KYC + Whitelist", "2. Phát hành dữ liệu thử"); biểu tượng `Loader2`/`ShieldCheck`/`Coins` theo
  `pending` giữ.
- Kết quả: vỏ `div role="status"` thành `Alert role="status"`; điều kiện hiện và nội dung `feedback.message` giữ; vẫn đúng một
  phần tử `role="status"` khi có kết quả (e2e ca 1, ca 2).
- Badge thẻ on-chain: đổi giá trị `variant`, giữ điều kiện `status.whitelisted`, `status.frozen` và chữ.
- `/audit` vẫn Server Component gọi `listAuditLog(100)` một lần (unit nhóm 5).

### 2.3 Mốc test QĐ-9

Không sửa tệp test có sẵn. `mint.spec.ts` (heading, nhãn ô, nút `/KYC \+ Whitelist/`, `/Phát hành/` strict,
`getByRole('status')` strict, "đã KYC", cha của "Số dư WPT", bảng cuối, `title` khoá), `maker-checker`, `chain-selector`
(":55" heading Lịch sử), `token-info-read`, `uiux-02-dau-man` (e2e, unit), `account-info`, `op07-chain-scope` đạt (mục 1.1).

### 2.4 Mã dư thừa

Đã xoá: import `Table*`, `operationLabel` khỏi `mint.tsx` (dời sang bảng), `Badge`, `Table*` khỏi `audit/page.tsx`;
`CheckCircle2`, `XCircle` khỏi `mint.tsx`; ba biểu thức ba ngôi `variant` cũ; lớp ô nhập tự viết. Lint, typecheck đạt.

## 3. Dời nguyên văn (`9b94001`, QĐ-2)

So bằng script (bỏ thụt lề chung): khối `<Table>…</Table>` của `mint.tsx:305-344` @ `d2a5bca` và của
`txn-history-table.tsx` @ `9b94001` giống hệt; khối của `audit/page.tsx:43-82` @ `d2a5bca` và của `audit-table.tsx` giống
hệt sau khi thay `result.data.map` bằng `entries.map`. Trước (`mint.tsx`, rút gọn):

```tsx
          ) : (
            <Table>
              <TableHeader>
              …(36 dòng: hàng tiêu đề 6 cột, txns.map với Badge ba ngôi 'default'/'destructive'/'secondary', ô U+2014)…
            </Table>
          )}
```

Sau (`components/mint/txn-history-table.tsx` @ `9b94001`):

```tsx
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { TxnView } from '@/lib/bank/mint.service';
import { operationLabel } from '@/lib/txn-labels';

/** Bảng lịch sử giao dịch của `/mint` (FE-UX-06b QĐ-2: dời nguyên văn từ `components/pages/mint.tsx`). */
export function TxnHistoryTable({ txns }: { txns: TxnView[] }) {
  return (
    <Table>
      …(38 dòng giống hệt đoạn trước, thụt lề theo hàm mới)…
    </Table>
  );
}
```

Trang gọi `<TxnHistoryTable txns={txns} />` trong nhánh cũ, điều kiện `txns.length === 0` giữ ở trang; bỏ import `Table*`,
`operationLabel`, thêm import bảng. `audit-table.tsx` tương tự: `AuditTable({ entries }: { entries: AuditRecord[] })`, chỉ
nhập kiểu `import type { AuditRecord } from '@/lib/store/store.port'`; trang gọi `<AuditTable entries={result.data} />`, bỏ
import `Badge`, `Table*`. Commit dời giữ `variant` cũ và ô U+2014; e2e `mint`, `uiux-02-dau-man` trên bản build riêng của
`9b94001` đạt (mục 1.1).

## 4. Đo trước và sau

Cùng máy, cùng quy trình (script ngoài repo): máy chủ mới cổng 3300 (đủ `webServer.env`), tạo dữ liệu bằng
`E2E_BASE_URL=… npx playwright test e2e/ops-transactions.spec.ts` (2 ca đạt cả hai lượt); đo bằng
`tools/20261104_do_moc_measure.js` (sha256 `6079a0d6…` khớp spec) với
`JS_PAGES=/,/portfolio,/trade,/approvals,/mint,/audit,/draft,DYN:/approvals`; 28 dòng mỗi lượt, không dòng
`khong tim thay lien ket`. Tiến trình đo khác tiến trình chụp ảnh. JS theo byte: script riêng cộng gzip mọi script khi mở
trang, máy chủ mới cổng 3500 (đã tạo dữ liệu cùng công thức).

| Mục | Mốc `d2a5bca` | Sau `eb7d37d` | Trần |
|---|---|---|---|
| Số action khi mở màn | 28 đường dẫn; `/mint` 1, `/audit` 0 | Khớp 28/28 | không đổi |
| `hydration`, `consoleErrors`, `pageErrors` | 0 ở cả 28 đường dẫn | 0 ở cả 28 đường dẫn | ba màn 0 |
| JS gzip (công cụ) `/mint`; `/audit`; `/draft`; `/approvals/[id]` | 453,2; 445,9; 459,8; 455,5 KB | 454,2; 445,9; 459,8; 455,5 KB | |
| JS gzip (công cụ) `/`; `/portfolio`; `/trade`; `/approvals` | 558,2; 456,8; 480,0; 455,2 KB | 558,3; 456,8; 480,0; 455,2 KB | không tăng |
| CSS gzip (`.next/static/chunks/*.css`, 1 tệp, gzip mức 9) | 19.277 B | 19.237 B (-40 B) | +2 KB |
| `role` trong `main` (`/mint`, `/audit`) | (0, 0, 0), (0, 0, 0) | giống hệt | bằng mốc |

JS gzip theo byte. Bản mốc lượt đầu build đúng mã `d2a5bca`; bản mốc build riêng build lại `d2a5bca` sau bản cuối, cùng
phiên (`NEXT_DIST_DIR=.next-moc`, gỡ tạm `components/mint/`, `components/audit/` khi build, đã xoá thư mục):

| Trang | Mốc (lượt đầu) | Mốc build riêng | Sau | Chênh so build riêng | Trần |
|---|---|---|---|---|---|
| `/portfolio` | 467810 | 467810 | 467806 | -4 | bằng mốc |
| `/tokens/WPT` | 463036 | 463034 | 463032 | -2 | bằng mốc |
| `/trade` | 491551 | 491553 | 491499 | -54 | bằng mốc |
| `/orders` | 549421 | 549421 | 549414 | -7 | bằng mốc |
| `/orders/[id]` | 463362 | 463360 | 463361 | +1 | bằng mốc |
| `/withdraw` | 485745 | 485748 | 485740 | -8 | bằng mốc |
| `/` | 571622 | 571619 | 571659 | +40 | bằng mốc |
| `/approvals` | 466138 | 466132 | 466121 | -11 | bằng mốc |
| `/distribution` | 479577 | 479575 | 479610 | +35 | bằng mốc |
| `/vault` | 469550 | 469551 | 469574 | +23 | bằng mốc |
| `/wallet` | 466953 | 466952 | 466941 | -11 | bằng mốc |
| `/seller` | 468036 | 468037 | 468034 | -3 | bằng mốc |
| `/seller/transactions` | 549642 | 549638 | 549636 | -2 | bằng mốc |
| `/seller/withdraw` | 478727 | 478732 | 478763 | +31 | bằng mốc |
| `/account` | 457856 | 457855 | 457856 | +1 | bằng mốc |
| `/assets` | 487512 | 487511 | 487512 | +1 | bằng mốc |
| `/kyc` | 462493 | 462492 | 462493 | +1 | bằng mốc |
| `/reconciliation` | 463509 | 463508 | 463509 | +1 | bằng mốc |
| `/mint` | 464114 | 464115 | 465064 | +949 | +3.072 |
| `/audit` | 456568 | 456567 | 456568 | +1 | +1.024 |
| `/draft` | 470820 | 470816 | 470840 | +24 | +512 |
| `/approvals/[id]` | 466471 | 466467 | 466461 | -6 | +512 |

So từng tệp script (bản mốc build riêng và bản cuối, cùng trang, cùng vai, máy chủ mới cổng 3500), 20 trang: mỗi trang cùng số
tệp; chunk dùng chung 178.700 B và chunk trang khác tên băm, cùng kích thước, trừ:

| Trang | Tổng thô mốc | Tổng thô sau | Chênh thô | Tệp, module khác |
|---|---|---|---|---|
| `/mint` | 1.539.836 | 1.542.579 | +2.743 | chunk trang 23.914 thành 26.657 B: `Alert`, `EmptyState`, `fieldClass`, `CardTitleIcon`, `FileClock`, hai bảng tra |
| `/draft` | 1.561.453 | 1.561.475 | +22 | module `TokenInfoBlock` 2.124 thành 2.149 B (lớp `[overflow-wrap:anywhere]`); số hiệu module biểu tượng `circle-plus` đổi (-2), một tham chiếu ngắn đi (-1) |
| `/approvals` | 1.545.559 | 1.545.556 | -3 | chỉ đổi số hiệu module `circle-plus` và tham chiếu |
| `/portfolio`, `/tokens/WPT` | | | +2 mỗi trang | số hiệu module tham chiếu server action đổi (5 thành 6 chữ số), cùng nội dung |

Mười lăm trang còn lại (`/`, `/trade`, `/orders`, `/withdraw`, `/distribution`, `/vault`, `/wallet`, `/seller`,
`/seller/transactions`, `/seller/withdraw`, `/account`, `/assets`, `/kyc`, `/reconciliation`, `/audit`): tổng thô bằng mốc
từng byte. Lệch gzip -54 đến +40 B của các trang ngoài phạm vi là do chuỗi băm tên chunk trong mã thay đổi, không có mã mới.
`/audit` là Server Component, JS khách bằng mốc.

CSS mốc lấy từ bản build mốc sạch (19.277 B). Bản mốc build riêng cho 19.316 B vì build lúc thư mục build phụ nằm trong
`app/` (như 06a); không dùng số đó.

## 5. Ảnh (gửi kèm, không commit)

### 5.1 Bốn màn

Vai Giao dịch viên (a) `/mint` sau khi nhập ví NDT001 và bấm "1. KYC + Whitelist" (mốc: nút có chấm giữa, cùng regex);
(b) `/audit`; (c) `/draft` sau khi nhập "WPT" vào "Mã hoặc ký hiệu token" của Thẻ tạo token; vai Kiểm soát viên (d)
`/approvals/[id]` của yêu cầu đầu danh sách. 1440 và 390, Sáng và Tối, 16 ảnh mỗi lượt: trước (`moc/anh/`), sau
(`sau/anh/`). Mỗi lượt một tiến trình mock MỚI cổng 3400: `npx next start --port 3400` với đủ biến của `webServer.env`
(`NEXT_PUBLIC_DEFAULT_CHAIN`, `USE_MOCK_KYC`, `USE_MOCK_DB`, `DEMO_ROLE`, `ENABLE_DEMO_TOKEN_MINT`,
`ENABLE_DEMO_PAYMENT_MINT`, `ENABLE_INVESTOR_SELL`, khoá ký mẫu Hardhat, `RPC_HARDHAT`), tạo dữ liệu bằng
`ops-transactions` rồi chụp. Mốc (bản build `d2a5bca`): bật 10:35:58Z, tắt 10:37:16Z. Sau (bản build `eb7d37d`): bật
11:42:48Z, tắt 11:44:06Z (05/11/2026, UTC). Cả hai lượt: 0 lỗi console, `main` không tràn ngang ở cả 16 ảnh.

- `/mint` 1440: Nhà đầu tư 8 cột, Trạng thái on-chain 4 cột cùng chiều cao; kết quả KYC hộp xanh lá dưới hàng nút; nhãn
  "đã KYC" xanh lá; Lịch sử 6 cột, "–" ở ô trống. 390: một cột, on-chain dưới Nhà đầu tư; bảng cuộn trong khung.
- `/draft` 390: khối thông tin token một cột, ví thanh toán 42 ký tự xuống hai dòng, không bị cắt (mốc: hai cột, hợp đồng và
  ví bị cắt bằng "…").
- 28 đường dẫn của script đo, trước (`moc/do/`) và sau (`sau/do/`), 1440 và 390, Sáng và Tối.

### 5.2 Trạng thái khó tạo

| Trạng thái | Nghiệm thu | Ảnh dựng ngoài repo |
|---|---|---|
| Giao dịch `FAILED`, `PENDING` | unit dựng `TxnHistoryTable` (nhóm 2) | `a_lich_su_bon_trang_thai` |
| Kiểm toán `DENIED`, `FAILURE` | unit dựng `AuditTable` (nhóm 3) | `b_kiem_toan_bon_ket_qua` |
| `/audit` lỗi đọc, rỗng, có dữ liệu | unit dựng trang với `listAuditLog` giả (nhóm 5) | `e_audit_loi`, `f_audit_rong`, `g_audit_co_du_lieu` |
| Kết quả `/mint` lỗi | e2e thật ca 2 (máy chủ từ chối ví chưa whitelist, 390 px không tràn) | `c_mint_ket_qua_loi` (thẻ hẹp 358 px) |
| Ví đang đóng băng | khoá biểu thức sắc trong mã nguồn (nhóm 1) cộng ảnh, đọc diff | `d_vi_dong_bang`: thẻ Trạng thái on-chain dựng bằng **đoạn JSX chép từ `mint.tsx`** (`Card`, `CardTitle`, `Row`, hai `Badge`) với `status` giả: đóng băng (`đang băng` đỏ, `đã KYC` xanh lá) và chưa KYC (`chưa KYC` vàng, `bình thường` viền) |

Dựng bằng `renderToStaticMarkup` (test tạm trong `app/test`, chạy xong xoá, không commit) cộng CSS bản build `eb7d37d`,
`page.setContent`, Sáng và Tối, 1440 và 390: 28 ảnh (`sau/anh_tinh/`), không tràn, 0 lỗi console.

## 6. Lệnh kiểm (tasks bước 6, `LC_ALL=C`)

```text
FE-UX-06b tasks bước 6, HEAD d08efba, base origin/release/ui-v2 d2a5bca
== 6a      # rỗng
== 6b      # rỗng
== 6c      # rỗng
== 6d
2 <chấm giữa> Phát hành dữ liệu thử
WPT có 0 chữ số thập phân <gạch dài> nhập số nguyên.
WPT <chấm giữa> số dư mới $
đã duyệt <chấm giữa> whitelist=$
== 6e      # rỗng
== 6f      # rỗng
== hết
```

("<chấm giữa>", "<gạch dài>" thay cho U+00B7, U+2014 lệnh in ra.) 6d đúng các câu cũ của QĐ-7: nhãn nút "2 <chấm giữa> Phát
hành dữ liệu thử" (nay "2. Phát hành dữ liệu thử"), câu gợi ý số nguyên (nay dấu hai chấm), và hai mảnh của hai câu kết quả bị
cắt ở `${…}` ("Đã phát hành {n} WPT <chấm giữa> số dư mới …", "KYC {ref} đã duyệt <chấm giữa> whitelist=…"; nay dấu phẩy).
Nhãn "1 <chấm giữa> KYC + Whitelist" không có chữ có dấu nên 6d không in; 6e và unit nhóm 1 khoá. Dòng chú thích có từ
trước còn ký tự cấm (`mint.tsx:28`, `:34`, `:114`, `audit/page.tsx:11`, `token-info-block.tsx:7`), 6e bỏ qua dòng chú thích.
`docs/tech-report.md` không đổi (không marker `@pending`, `@blocked`, `@flow` trong diff).

## 7. Bảng khối cũ và khối mới

Không có bản chốt riêng; đối chiếu với các màn đã làm cùng thành phần.

| Màn | Khối cũ | Khối mới | Mẫu đã làm |
|---|---|---|---|
| `/mint`, `/audit` | `h1 text-xl font-semibold` | `h1 text-2xl font-semibold tracking-tight` | 04a đến 06a |
| `/mint` | Đoạn giới thiệu `p.rounded-md.border.bg-muted/40` | `Alert tone="info"` không `role` | `/withdraw` (04d) |
| `/mint` | Lưới `lg:grid-cols-[minmax(0,1fr)_320px]` | Lưới 12 cột từ 1100 px, 8 và 4 | `/trade` (04b), `/seller/withdraw` (05c) |
| `/mint`, `/audit` | `CardTitle text-base` không biểu tượng | Heading cấp 2 cùng `CardTitleIcon` | thẻ có biểu tượng 03b đến 06a |
| `/mint` | Ô nhập tự viết `rounded-md border border-border bg-background` | `fieldClass` | 04d, 05c, 06a |
| `/mint` | Kết quả `div` tự viết viền `primary`/`destructive`, biểu tượng tự gắn | `Alert role="status"` sắc `ok`/`bad` | 05c |
| `/mint` | Thẻ on-chain `space-y-3`, Badge `default`/`destructive`/`outline` | Dòng kẻ ngăn `divide-y`, Badge `ok`/`warn`, `bad`/`outline` | `/seller` (05a) |
| `/mint`, `/audit` | Câu rỗng `p.text-muted-foreground` | `EmptyState` có biểu tượng | 04d, 06a |
| `/audit` | Câu lỗi `p.text-destructive` | `Alert tone="bad"` | 05b |
| Hai bảng | Badge ba ngôi `default`/`destructive`/`secondary`; ô trống U+2014 | Bảng tra sắc; ô trống U+2013 | 02b, 05a |
| Khối thông tin token | Hai cột từ 640 px, `dd truncate` | Một cột, `dd [overflow-wrap:anywhere]` | |
| `/account` | Câu lỗi `text-destructive` | `text-bad-ink` | |

## 8. Nợ và DEVIATION

- **DEVIATION QĐ-3: biểu tượng thẻ "Lịch sử giao dịch" là `FileClock`, không phải `ListChecks`** (QĐ-3 cho phép đổi biểu
  tượng cùng nghĩa khi chunk dùng chung tăng, ghi DEVIATION như 05a, 05c). Bản `bcc36e8` dùng `ListChecks`: biểu tượng này đang
  nằm gộp trong chunk trang `/seller/withdraw`, `/withdraw`; `/mint` nhập thêm làm Turbopack tách thành module riêng, chunk trang
  `/seller/withdraw` tăng 11 B thô (+37 B gzip). Thử `ArrowLeftRight` (biểu tượng mục menu "Giao dịch"): đang gộp trong module
  thanh bên, nhập thêm làm chunk dùng chung tăng 95 B thô ở MỌI trang. `FileClock` (tệp có đồng hồ, nghĩa lịch sử) chưa nơi
  nào dùng nên chỉ vào chunk `/mint`; so chunk bản cuối: 15 trang tổng thô bằng mốc từng byte (mục 4).
- **Biểu tượng của hai `EmptyState`:** spec chỉ ghi "rỗng thành `EmptyState` giữ chữ"; dùng lại biểu tượng tiêu đề thẻ
  (`FileClock`, `ScrollText`) để không nhập thêm biểu tượng.
- **e2e "mốc:" chạy riêng trên bản mốc:** ca 1, ca 2 đỏ trên bản mốc là đúng (chưa có heading cấp 2); ca 3 xanh cả hai bản.
- **Chưa làm theo requirements mục 1 "Không làm":** đổi luồng KYC, thêm cột chain ở `/audit` (L-90), lọc, phân trang; ngày ở
  cột Thời điểm `/mint` (L-78); câu trống `/audit` trỏ `/mint` (L-26) giữ chữ.

## 9. Tự đánh giá 3 luật kiến trúc

- [x] Mọi call chain qua ILedgerPort: không đổi mã gọi chuỗi.
- [x] Mọi ký qua ISigner: không đổi.
- [x] Mọi kiểm quyền qua RBAC: không đổi.
