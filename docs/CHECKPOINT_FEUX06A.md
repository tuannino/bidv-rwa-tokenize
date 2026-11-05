# Báo cáo bàn giao: FE-UX-06a ba màn dữ liệu mẫu (Dự án, KYC, Đối soát)

| | |
|---|---|
| Mã task | FE-UX-06a |
| Phạm vi | **Frontend thuần.** Không `lib/` (gồm `lib/mock-data.ts`), `app/actions`, `app/api`, `app/src/app/**`, `components/ui/*`, `components/layout/*`; không gói npm mới; không đổi số liệu mẫu, nguồn dữ liệu, bộ lọc và cách lọc, cột, thứ tự, ghi chú dữ liệu mẫu, số action khi mở màn (0). Chữ chỉ đổi đúng QĐ-5, QĐ-6 |
| Nhánh | `feat/fe-ux-06a-man-mau`, tạo từ `release/ui-v2` @ `9eac384` (sau merge PR #99 FE-UX-05c; đã gồm 05b). **Merge-base dùng để đo mốc: `9eac384`**. Không có PR nào merge vào `release/ui-v2` trong lúc làm nên không phải rebase; mọi mốc và cả bộ kiểm thử mục 5 chạy trên merge-base này |
| Spec | `docs/fe-ux-06a-man-mau/{requirements,design,tasks}.md` (chép nguyên) |
| Commit | spec `3513b60`; e2e nháp `5a584fa`; **dời** (QĐ-2) `767352a`; số `role` mốc `f85777b`; ba màn và `FilterBtn` đổi kiểu `cd7a43b`; UserGuide, task-status `f595692`; e2e ca 2 bàn phím `538c2d8`; tài liệu: các commit cuối trên nhánh |
| Tiến độ | Xong. Một PR, base `release/ui-v2`, chờ Supervisor nghiệm thu; Claude Code **không** merge |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 4) | | Bằng chứng |
|---|---|---|---|
| 1 | Ba màn đúng bố cục design mục 1; bảng từng khối cũ và khối mới | ✅ | mục 2.1, 7 |
| 2 | Thành phần đúng QĐ-3, QĐ-4; không còn `StatCard`, `KpiCard`, `GRID`, `FilterBtn` cục bộ | ✅ | mục 2.1, 1.3 nhóm 1 |
| 3 | `FilterBtn` dời đúng QĐ-2 (ba bản giống hệt), commit riêng; đoạn trước và sau | ✅ | mục 3 |
| 4 | Không `*-destructive`, màu cứng, ký tự cấm trong chữ hiển thị tệp phạm vi | ✅ | mục 6 (6b, 6c, 6e), 1.3 nhóm 1 |
| 5 | Chữ chỉ đổi đúng QĐ-5, QĐ-6 (6d đúng kỳ vọng); không đổi số liệu, cột, bộ lọc, điều kiện hiện | ✅ | mục 6 (6d đúng ba câu cũ `REGION_HINTS`), 2.2 |
| 6 | Diff giữ logic (QĐ-1); liệt kê đoạn đổi gần `useState`, bộ lọc, `filtered`, `TxLink` | ✅ | mục 2.2 |
| 7 | Bốn điều khiển QĐ-5 khoá, chú thích "Chưa hỗ trợ trong PoC", `aria-describedby` đúng; menu không mở | ✅ | mục 1.2 ca 2, 1.3 nhóm 3 |
| 8 | Action 0 (ca 4), 28 đường dẫn không đổi; JS, CSS trong trần QĐ-8; lỗi ba màn 0 | 🔶 | mục 4: `/kyc` +4.236 B vượt trần 3 KB, DEVIATION Supervisor duyệt (mục 8); `/assets` +1.834, `/reconciliation` +1.729 B; CSS -206 B |
| 9 | Mốc test QĐ-7 giữ; không sửa test có sẵn | ✅ | mục 1.1, 2.3 |
| 10 | Ảnh 1440, 390, Sáng, Tối, trước và sau, vai Giao dịch viên, tiến trình mới; lọc rỗng; 1100 px | ✅ | mục 5 |
| 11 | `fe-ux-06a-man-mau.spec.ts` đủ 4 ca, `fe-ux-06a.test.ts` đủ 3 nhóm, xanh | ✅ | mục 1.2, 1.3 |
| 12 | Kiểm thử mục 5 đạt, kèm log; "EVM - E2E PROJECT HARDHAT" xanh | ✅ | mục 1.1 |
| 13 | Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 6) đúng kỳ vọng | ✅ | mục 6 |
| 14 | Không mã dư thừa | ✅ | mục 2.4 |

**Kết luận:** 13 ✅, 1 🔶, 0 ❌. 🔶 là **DEVIATION vượt trần QĐ-8 cho `/kyc`, Supervisor duyệt**: giữ `Button` chung theo QĐ-3;
JS gzip `/kyc` 462.493 B so bản mốc build riêng 458.257 B là +4.236 B (trần 3.072 B). So chunk: chỉ đúng một chunk của trang
đổi (2.281 thành 6.474 B gzip), phần tăng là module nút của Base UI (khoảng 2,3 KB gzip) và các thành phần chung lần đầu
vào `/kyc` (`Kpi`, `Card`, `Table`, `EmptyState`, `fieldClass`, `cva`), không có mã thừa (mục 4, 8). `/assets` +1.834 B,
`/reconciliation` +1.729 B (trần 3 KB). Mười lăm trang khác lệch -142 đến +25 B; so chunk: tổng kích thước thô bằng mốc từng
byte. CSS 19.277 B, -206 B so mốc 19.483 B. Action khớp 28/28 (ba màn 0); `hydration`, `consoleErrors`, `pageErrors` 0 ở
mọi đường dẫn cả mốc lẫn sau; số `role` ba màn (0, 0, 0) bằng mốc. Bản mốc `/assets` ở 390 px tràn ngang 163 px (bảng lưới
không cuộn); bản mới cuộn trong khung bảng, `main` không tràn. Mức rủi ro: thấp (ba màn chỉ đọc số mẫu).

UserGuide: "Chốt tại"; 3.6.1, 3.6.2, 3.6.4 thêm "Bố cục (FE-UX-06a)" và nút khoá; dòng mã `kyc.tsx:18`, L-27
`reconciliation.tsx:45,81-104`. task-status: `FE-UX-06` tách `FE-UX-06a` (xong, `done`), `FE-UX-06b` (planned).

### 0.2 Việc cần Owner quyết

- Không có. Trần JS `/kyc` đã được Supervisor quyết (mục 8).

---

## 1. Kiểm thử (requirements mục 5, phần dev)

### 1.1 Lệnh và kết quả

`FE-UX-06a` ở `inProgress` của `.kiro/task-status.json` khi chạy. Chạy khi cổng e2e trống (máy chủ mới), Postgres
bật, trên HEAD `f5d9170` (mã `app/src` bằng `cd7a43b`), 10:00:26Z đến 10:10:11Z (05/11/2026, UTC).

```text
$ TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm
  => PASS có cảnh báo: luật kiến trúc          # PASS 20, FAIL 0, WARN 3 (như mốc)
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)
ĐẠT     FE-UX-06a, docs/CHECKPOINT_FEUX06A.md
  => PASS: LỚP 3 - KHUÔN CHECKPOINT
  => PASS: APP - TYPECHECK
  => PASS: APP - LINT
      Tests  1741 passed | 74 skipped (1815)   # mốc 1724 + 17 ca mới của fe-ux-06a.test.ts
  => PASS: APP - VITEST
  => PASS: APP - BUILD BẢN PHÁT HÀNH
FE-UX-06a role counts /assets: {"status":0,"note":0,"alert":0}
FE-UX-06a role counts /kyc: {"status":0,"note":0,"alert":0}
FE-UX-06a role counts /reconciliation: {"status":0,"note":0,"alert":0}
      155 passed, 7 skipped (5.6m)            # project mock đầy đủ: 151 ca cũ + 4 ca mới
  => PASS: APP - E2E (PLAYWRIGHT)
  => PASS: EVM - BUILD BẢN HARDHAT
  => PASS: EVM - DỰNG CHUỖI MỚI
      26 passed, 2 skipped (47.1s)            # toàn bộ project Hardhat
  => PASS: EVM - E2E PROJECT HARDHAT
  => ĐẠT các phần đã chạy: arch markers checkpoint app build e2e evm
EXIT=0
```

Log gửi kèm (không commit): `20261105_feux06a_run_local_all.log` (dòng khoá ký Hardhat #0 trong env máy chủ cục bộ đã
che) và riêng đoạn từ "EVM - E2E PROJECT HARDHAT" tới hết: `20261105_feux06a_evm_e2e.log`. Không chạy `contracts`.
Dòng `RpcRequestError` trong phần vitest là log của ca kiểm đường đọc dự phòng của indexer (có từ trước), ca đó đạt.

Ngoài bộ trên: bước 3 (tasks) chạy `fix-05-tong-quan` (e2e) trên bản build riêng của commit dời `767352a` (máy chủ mới):
2 ca đạt. Bước 4, 7 chạy `fe-ux-06a-man-mau`, `fix-05-tong-quan`, `uiux-02-dau-man`, `fe-ux-01a-nen` (project mock) trên bản
build `cd7a43b` cộng tệp e2e `538c2d8`: 19 ca đạt; `fe-ux-06a`, `fix-05-tong-quan`, `uiux-02-dau-man` (unit) đạt.

### 1.2 e2e mới `app/e2e/fe-ux-06a-man-mau.spec.ts` (project mock, vai Giao dịch viên; không đổi dữ liệu)

Chờ tải: `networkidle`.

| Ca | Kiểm | Mốc `9eac384` | Sau |
|---|---|---|---|
| 1 | Đếm `role` ba màn trước; mỗi màn 1440 px: một `h1` đúng chữ, "(đang hiển thị dữ liệu mẫu)" hiện, `[data-kpi]` 4, 4, 3 cùng hàng (lệch đỉnh dưới 4 px), `/reconciliation` 3 thẻ nguồn cùng hàng, bảng trong `[data-slot="table-container"]`, chữ "Chưa hỗ trợ trong PoC"; 390 px ô số liệu một cột, mọi `[aria-pressed]` cao không quá 32 px; `role` bằng hằng số | đỏ (không `[data-kpi]`) | xanh |
| 2 | `/assets`: "Làm mới", "Thêm dự án" `disabled`, bấm `force` không ra `[role="menu"]`; lọc "Trên bờ, Ven biển" `aria-pressed`, 2 dòng; "Trên bờ, Cao nguyên" 0 dòng và `EmptyState`; "Tất cả" 3 dòng. `/kyc`: ô "Tìm nhà đầu tư" nhận chữ; "VIP" `aria-pressed="true"`; "Làm mới" `disabled`. `/reconciliation`: "Làm mới dữ liệu" `disabled`; lọc dự án đầu `aria-pressed="true"`. Bàn phím `/assets`: Tab tới "Trên bờ, Ven biển", Enter (2 dòng); Shift+Tab sang "Trên bờ, Cao nguyên", Space (0 dòng, `EmptyState`); nút "Thêm dự án" `focus()` rồi Enter, Space, ArrowDown: không `[role="menu"]` | đỏ (nút chưa khoá) | xanh |
| 3 | Ba màn 1440 và 390 px: `main` không tràn ngang; 0 lỗi console, `pageerror`, cảnh báo hydrate | đỏ (`/assets` 390 px tràn ngang) | xanh |
| 4 | Mở mỗi màn (ngữ cảnh mới, `networkidle` cộng 1 giây): 0 action | xanh | xanh |

Hằng số `role` đo trên bản build mốc `9eac384` bằng chính tệp này qua `E2E_BASE_URL`, máy chủ MỚI: cả ba màn
`{ status: 0, note: 0, alert: 0 }`. Ca 2 bàn phím: design ghi "Tab sang Trên bờ, Cao nguyên", nhưng nút này đứng TRƯỚC
"Trên bờ, Ven biển" theo thứ tự `REGION_LABELS`, nên test dùng Shift+Tab (`538c2d8`; lượt đầu trên bản sau đỏ đúng chỗ
này, lượt sau sửa xanh 4/4).

### 1.3 Unit test mới `app/test/fe-ux-06a.test.ts` (môi trường `node`, 17 ca)

Chỉ giả `useSelectedChain` (chain `mock`, `TxLink` ra `span`); `HoverHint`, `DropdownMenu` dựng được bằng
`renderToStaticMarkup`, không cần giả (xác nhận ở tasks bước 2 bằng test tạm, đã xoá).

| Nhóm | Kiểm |
|---|---|
| 1 Mã nguồn | Ba trang: đúng 1 dòng `import { FilterBtn } from "@/components/ops/filter-button"`; không `function FilterBtn`, `Action(`, `useEffect(`, `function StatCard`, `function KpiCard`, `const GRID`, `rounded-lg border`, `-destructive`, `'destructive'`; mọi `col-span-` có tiền tố mốc. `reconciliation.tsx`: `MOCK_WIND_STATS.pendingReconciliations > 0 ? "gold" : "default"`. `assets.tsx`: ba câu `REGION_HINTS` mới; không U+00B7, U+2014 ngoài dòng chú thích. `filter-button.tsx`: `export function FilterBtn`, `aria-pressed={active}` |
| 2 `FilterBtn` | `active` true: `type="button"`, `aria-pressed="true"`, lớp `bg-primary`, chữ đúng `label`; false: `aria-pressed="false"`, không `bg-primary` |
| 3 Ba trang | `AssetsPage`: 4 `[data-kpi]` đúng nhãn, sắc `default`, `default`, `hl`, `leaf`; 8 `data-slot="table-head"` đúng thứ tự; số dòng `tbody` bằng `MOCK_PROJECTS.length`; mỗi dòng "CF " và "%, ", không U+00B7; nút "Làm mới" và "Thêm dự án" `disabled`, `aria-describedby="assets-poc-note"` trỏ đúng phần tử chữ "Chưa hỗ trợ trong PoC" (đúng 1 lần); ghi chú dữ liệu mẫu ngoài `h1`. `KycPage`: 4 ô sắc `hl`, `default`, `gold`, `default`, giá trị "0"; 8 cột; `EmptyState` hai câu; phần tử `font-code` đầu tiên chữ "/mint"; "Trang trước", "Trang sau", "Làm mới" `disabled`, `aria-describedby="kyc-poc-note"`. `ReconciliationPage`: 3 thẻ nguồn, "Chờ nối ở Phase 3" 3 lần; 3 ô sắc `hl`, `default`, (`gold` nếu có kỳ lệch, không thì `default`); "MWh" là `small` tách khỏi số; 7 cột; `EmptyState`; "Làm mới dữ liệu" `disabled`, `aria-describedby="reconciliation-poc-note"` |

Tự gây lỗi (4 điểm của Supervisor, trên bản sao làm việc, hoàn lại bằng `git checkout`): bỏ `aria-pressed` trong
`FilterBtn`: 3 ca đỏ (nhóm 1, nhóm 2 hai ca); bỏ `disabled` nút "Làm mới" ở `/kyc`: 1 ca đỏ (nhóm 3 `KycPage`); đổi sắc
ô "WPT đã phát hành" về `default`: 1 ca đỏ (nhóm 3 `AssetsPage`); thêm một phần tử `font-code` trước bảng ở `/kyc`: 1 ca
đỏ (nhóm 3 `KycPage`).

## 2. Thay đổi

### 2.1 Ba màn (bố cục theo design mục 1)

| Khối | Đổi |
|---|---|
| Đầu màn (ba màn) | Hàng `flex flex-wrap items-start justify-between gap-4`; trái `HoverHint` bọc `h1` (`text-2xl font-semibold tracking-tight`) rồi `SampleDataNote` ngoài `h1`; phải nhóm nút khoá và `span` "Chưa hỗ trợ trong PoC" (`id` `assets-poc-note`, `kyc-poc-note`, `reconciliation-poc-note`) |
| Nút khoá (QĐ-5) | `/assets`: `Button ghost icon` "Làm mới" (`title`, `aria-label`) và `DropdownMenuTrigger` lớp `buttonVariants()` "Thêm dự án", cả hai `disabled`, `aria-describedby`; menu và nội dung giữ. `/kyc`: `Button ghost icon` "Làm mới". `/reconciliation`: `Button outline` "Làm mới dữ liệu" |
| Ô số liệu | `Kpi` thay `StatCard`, `KpiCard`; cùng `label`, `sub`, giá trị; " MW", " MWh" thành `unit`. `/assets` có `icon` (`Wind`, `Zap`, `Gauge`, `Zap`), sắc `default`, `default`, `hl`, `leaf`; `/kyc` `hl`, `default`, `gold`, `default`; `/reconciliation` `hl`, `default`, `pendingReconciliations > 0 ? "gold" : "default"` |
| Lưới | `/assets`, `/kyc` `grid gap-4 min-[640px]:grid-cols-2 min-[1100px]:grid-cols-4`; `/reconciliation` thẻ nguồn và ô số liệu `grid gap-4 min-[640px]:grid-cols-3` |
| Khung danh sách | `Card className="gap-0 py-0"`; thanh lọc `border-b border-border px-4 py-3` (`/kyc` `space-y-3 border-b border-border p-4`), mỗi nhóm lọc `flex flex-wrap items-center gap-2`; `Table` cùng cột, thứ tự, chữ, canh phải (thêm lớp `TABLE_EDGE` để ô đầu và cuối cách mép 16 px như thanh lọc); `EmptyState` bọc `div.p-4`; dòng cuối `border-t border-border px-4 py-2.5 text-xs` |
| `/assets` dòng dự án | `ProjectRow` thành `TableRow`; mỗi ô `TableCell align-top` giữ nội dung; ô Mã & Tên `min-w-56 whitespace-normal`; lọc rỗng vẫn hiện đầu bảng rồi `EmptyState` (`Wind`) |
| `/kyc` | Ô tìm `fieldClass pl-10`, `Search` `absolute left-3.5`, `label sr-only` giữ; bảng chỉ `TableHeader`; `EmptyState` (`UserCheck`) hai câu, `/mint` giữ `font-code`; hai nút phân trang `Button outline sm disabled` |
| `/reconciliation` | `SourceCard` thành `Card` (`flex-row items-start gap-3 px-4`), biểu tượng trong `CardTitleIcon`, bỏ `text-muted-foreground` ở chỗ gọi; bảng chỉ `TableHeader`; `EmptyState` (`Scale`) |
| `FilterBtn` (QĐ-4) | Viên nang `rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors` cộng vòng focus; chọn `bg-primary text-primary-foreground`, chưa chọn `bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground`; giữ `type`, `onClick`, `aria-pressed`, chữ |

### 2.2 Đoạn đổi gần `useState`, bộ lọc, `filtered`, `TxLink` (QĐ-1)

Không đổi ký tự: mọi `useState` (`regionFilter`, `statusFilter`, `search`, `level`, `status`, `projectFilter`), `filtered`,
`periods`, `REGION_CHART_VAR`, `STATUS_DOT`, `LEVEL_LABELS`, `STATUS_LABELS`, `SOURCES`, `nf`, `TxLink` (cả hàm), nội dung menu
"Thêm dự án" (trừ chữ `REGION_HINTS`), mọi `onClick` của `FilterBtn`, điều kiện `filtered.length === 0`, dòng "{n} kết quả",
"{n} kỳ", dòng "Hiển thị …". Các đoạn có đụng:

- `ProjectRow`: đổi vỏ `div` lưới thành `TableRow`, `TableCell`; nội dung từng ô và `TxLink txHash={project.txHash}` giữ; dòng
  CF chấm giữa thành dấu phẩy (QĐ-6).
- Sắc ô "Kỳ lệch chờ xử lý": `warn={… > 0}` cũ thành `tone={… > 0 ? "gold" : "default"}`, cùng điều kiện.
- Nút: thêm `disabled`, `aria-describedby`, `aria-label` (QĐ-5); không có `onClick` nào trước đó nên không mất hành động.
- Ba trang vẫn `'use client'`, không server action, không `useEffect` (unit nhóm 1).

### 2.3 Mốc test QĐ-7

Không sửa tệp test có sẵn. `fix-05-tong-quan` (e2e: 0 action, `h1`, ghi chú dữ liệu mẫu; unit), `uiux-02-dau-man` (e2e,
unit: không câu phụ, `HoverHint` liền trước `<h1`, một `h1`), `fe-ux-01a-nen.spec.ts:75-80` (`.font-code` đầu tiên trong
`main` của `/kyc` chữ "/mint"), `four-roles-*.test.ts` đạt (mục 1.1; lượt liên quan sau: 19 ca e2e đạt).

### 2.4 Mã dư thừa

Đã xoá: `StatCard`, hai `KpiCard`, hai `GRID`, ba bản `FilterBtn` cục bộ (nay một tệp chung); lớp cỡ, màu cũ trên biểu tượng
trạng thái rỗng; import `cn` ở `kyc.tsx`, `reconciliation.tsx` (hết chỗ dùng). Lint, typecheck đạt.

## 3. Dời nguyên văn (`767352a`, QĐ-2)

So ba bản bằng `diff` (`assets.tsx:339-363`, `kyc.tsx:190-214`, `reconciliation.tsx:199-223` @ `9eac384`): giống hệt từng ký
tự. Trước (một bản, cả ba như nhau):

```tsx
function FilterBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md px-3 py-1 text-xs transition-colors",
        active
          ? "bg-secondary font-medium text-secondary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
```

Sau (`components/ops/filter-button.tsx` @ `767352a`):

```tsx
import { cn } from "@/lib/utils";

/** Nút lọc viên nang dùng chung của ba màn dữ liệu mẫu, dời nguyên văn từ `assets.tsx`, `kyc.tsx`, `reconciliation.tsx` (FE-UX-06a QĐ-2). */
export function FilterBtn({
  …(24 dòng còn lại giống hệt đoạn trước)…
}
```

Ba trang xoá bản cục bộ (cùng dòng trống trước nó) và thêm một dòng
`import { FilterBtn } from "@/components/ops/filter-button";` sau dòng nhập `SampleDataNote`. Commit dời chưa đổi kiểu;
`fix-05-tong-quan` (e2e) trên bản build riêng của `767352a` (máy chủ mới) đạt 2 ca; `fe-ux-06a` nhóm 1, 2 (phần dời),
`fix-05-tong-quan`, `uiux-02-dau-man` (unit) đạt 23 ca.

## 4. Đo trước và sau

Cùng máy, cùng quy trình (script ngoài repo): máy chủ mới cổng 3300 (đủ `webServer.env`), tạo dữ liệu bằng
`E2E_BASE_URL=… npx playwright test e2e/ops-transactions.spec.ts`; đo bằng `tools/20261104_do_moc_measure.js` (sha256
`6079a0d6…` khớp spec) với `JS_PAGES=/,/portfolio,/trade,/approvals,/assets,/kyc,/reconciliation`; 28 dòng mỗi lượt, không
dòng `khong tim thay lien ket`. Tiến trình đo khác tiến trình chụp ảnh. JS theo byte: script riêng cộng gzip mọi script khi
mở trang, máy chủ mới cổng 3500.

| Mục | Mốc `9eac384` | Sau `cd7a43b` (mã `app/src` bằng HEAD) | Trần |
|---|---|---|---|
| Số action khi mở màn | 28 đường dẫn; ba màn 0 | Khớp 28/28 | không đổi |
| `hydration`, `consoleErrors`, `pageErrors` | 0 ở cả 28 đường dẫn | 0 ở cả 28 đường dẫn | ba màn 0, khác không tăng |
| JS gzip (công cụ) `/assets`; `/kyc`; `/reconciliation` | 474,3; 447,5; 451,0 KB | 476,1; 451,7; 452,6 KB | |
| JS gzip (công cụ) `/`; `/portfolio`; `/trade`; `/approvals` | 558,2; 456,8; 480,0; 455,2 KB | giống hệt | không tăng |
| CSS gzip (`.next/static/chunks/*.css`, 1 tệp, gzip mức 9) | 19.483 B | 19.277 B (-206 B) | +2 KB |
| `role` trong `main` (ca 1) | 0, 0, 0 ba màn | giống hệt | bằng mốc |

JS gzip theo byte. Bản mốc của lượt đầu build đúng mã `9eac384`; bản mốc build riêng build lại `9eac384` sau bản cuối, cùng
phiên (`NEXT_DIST_DIR=.next-moc`, gỡ tạm `components/ops/` khi build, đã xoá thư mục):

| Trang | Mốc (lượt đầu) | Mốc build riêng | Sau | Chênh so build riêng | Trần |
|---|---|---|---|---|---|
| `/portfolio` | 467812 | 467810 | 467810 | +0 | bằng mốc |
| `/tokens/WPT` | 463036 | 463034 | 463036 | +2 | bằng mốc |
| `/trade` | 491530 | 491530 | 491551 | +21 | bằng mốc |
| `/orders` | 549406 | 549403 | 549421 | +18 | bằng mốc |
| `/orders/[id]` | 463367 | 463368 | 463362 | -6 | bằng mốc |
| `/withdraw` | 485750 | 485745 | 485745 | +0 | bằng mốc |
| `/` | 571626 | 571622 | 571622 | +0 | bằng mốc |
| `/approvals` | 466127 | 466122 | 466138 | +16 | bằng mốc |
| `/distribution` | 479602 | 479598 | 479577 | -21 | bằng mốc |
| `/vault` | 469530 | 469532 | 469550 | +18 | bằng mốc |
| `/wallet` | 466936 | 466935 | 466953 | +18 | bằng mốc |
| `/seller` | 468032 | 468031 | 468036 | +5 | bằng mốc |
| `/seller/transactions` | 549621 | 549617 | 549642 | +25 | bằng mốc |
| `/seller/withdraw` | 478867 | 478869 | 478727 | -142 | bằng mốc |
| `/account` | 457856 | 457855 | 457856 | +1 | bằng mốc |
| `/assets` | 485679 | 485678 | 487512 | +1834 | +3.072 |
| `/kyc` | 458258 | 458257 | 462493 | **+4236** | +3.072 (DEVIATION, mục 8) |
| `/reconciliation` | 461781 | 461780 | 463509 | +1729 | +3.072 |

So từng tệp script (bản mốc build riêng dựng lại cùng mã và bản cuối, cùng trang, cùng vai) cho 7 trang:

| Trang | Số tệp | Tổng thô mốc | Tổng thô sau | Chênh thô | Tệp khác |
|---|---|---|---|---|---|
| `/trade` | 20 | 1.623.474 | 1.623.474 | 0 | chunk chung 178.700 B và chunk trang 89.224 B đổi tên băm, cùng kích thước |
| `/wallet` | 19 | 1.550.147 | 1.550.147 | 0 | như trên (chunk trang 34.225 B) |
| `/seller/transactions` | 20 | 1.914.448 | 1.914.448 | 0 | như trên (23.337 B) |
| `/seller/withdraw` | 20 | 1.584.222 | 1.584.222 | 0 | như trên (49.972 B) |
| `/assets` | 21 | 1.603.878 | 1.610.194 | +6.316 | chunk trang 59.225 thành 58.362 B, chunk 10.403 thành 17.582 B |
| `/reconciliation` | 19 | 1.531.765 | 1.538.276 | +6.511 | chunk trang 15.843 thành 22.354 B |
| `/kyc` | 19 | 1.522.277 | 1.535.579 | +13.302 | chunk trang 6.355 thành 19.657 B (2.281 thành 6.474 B gzip) |

Trang ngoài phạm vi: tổng thô bằng nhau từng byte; lệch gzip là do chuỗi băm tên chunk đổi trong mã, không có mã mới.

Chunk trang `/kyc` tách theo module (gzip từng module riêng lẻ; gzip cả chunk nén chung nên tổng nhỏ hơn):

| Module (id Turbopack) | Nhận diện (chuỗi trong module) | Thô | Gzip | Có ở mốc `/kyc` |
|---|---|---|---|---|
| 990500 | `Button` cùng nút Base UI (`useCompositeRootContext`) | 5.925 | 2.343 | không |
| 606072 | `Card`, `CardTitleIcon` | 2.059 | 766 | không |
| 238897 | `Kpi` (`data-kpi`) | 1.611 | 752 | không |
| 172990 | `EmptyState` cùng biểu tượng `Inbox` | 1.040 | 615 | không |
| 899200 | `Table` (`table-container`) | 1.626 | 544 | không |
| 280587 | thư viện `cva` | 779 | 424 | không |
| 438015 | `fieldClass` | 289 | 222 | không |
| 291051, 752797 | biểu tượng `XCircle`, `Loader2` của `EmptyState` | 379 | 339 | không |
| 538198 | `SampleDataNote` cùng `FilterBtn` (dời từ trang) | 657 | 425 | có (199 thô, 210 gzip, chỉ `SampleDataNote`) |
| 545457 | `KycPage` | 4.432 | 1.801 | có (5.310 thô, 1.934 gzip) |
| 416191, 32457 | biểu tượng `Search`, `RefreshCw` | 528 | 402 | có, giống |

Mọi module mới là thành phần dùng chung QĐ-3 bắt buộc; trang `KycPage` nhỏ đi (5.310 thành 4.432 B thô) vì bỏ `KpiCard`,
khung lưới, `FilterBtn` cục bộ. Ở `/assets`, `/reconciliation` module nút Base UI đã có từ mốc (hai màn vốn dùng `Button`),
nên chỉ tăng phần `Kpi`, `Card`, `Table`, `EmptyState`. Thử dùng thẻ `button` gốc với lớp `buttonVariants()` ở `/kyc` (bản
build riêng, không commit): 462.499 B, không bớt được byte (nhập `buttonVariants` vẫn kéo cả `button.tsx`).

CSS mốc lấy từ bản build mốc sạch (19.483 B). Bản mốc build riêng cho 19.524 B vì build lúc thư mục build phụ nằm trong
`app/`; không dùng số đó.

## 5. Ảnh (gửi kèm, không commit)

- Ba màn vai Giao dịch viên, 1440 và 390, Sáng và Tối; `/assets` sau khi chọn lọc "Trên bờ, Cao nguyên" (bảng rỗng,
  `EmptyState`), 1440 và 390, Sáng và Tối; ba màn ở 1100 px Sáng. Trước (`moc/anh/`), sau (`sau/anh/`), 19 ảnh mỗi lượt.
  Mỗi lượt một tiến trình mock MỚI cổng 3400: `npx next start --port 3400` với đủ biến của `webServer.env`
  (`NEXT_PUBLIC_DEFAULT_CHAIN`, `USE_MOCK_KYC`, `USE_MOCK_DB`, `DEMO_ROLE`, `ENABLE_DEMO_TOKEN_MINT`,
  `ENABLE_DEMO_PAYMENT_MINT`, `ENABLE_INVESTOR_SELL`, khoá ký mẫu Hardhat, `RPC_HARDHAT`); không chuẩn bị dữ liệu. Mốc (bản
  build `9eac384`): bật 09:31:26Z, tắt 09:32:15Z. Sau (bản build `cd7a43b`, mã `app/src` bằng HEAD): bật 09:45:04Z, tắt
  09:45:53Z (05/11/2026, UTC). 0 lỗi console cả hai lượt. Mốc: `/assets` 390 px `main` tràn ngang 163 px (lọc rỗng 28 px);
  sau: 0 ở cả 19 ảnh.
- 1100 px (mốc 4 cột có thanh bên): `/assets` nhãn "Tổng công suất đặt", "WPT đã phát hành", "Sản lượng luỹ kế" và chữ phụ
  xuống hai dòng; giá trị và đơn vị (148,2 MW, 335.000, 412.680 MWh) một dòng, không cắt; bảng cuộn trong khung. `/kyc`,
  `/reconciliation` không xuống dòng xấu. Không đổi mốc.
- 28 đường dẫn của script đo, trước (`moc/do/`) và sau (`sau/do/`), 1440 và 390, Sáng và Tối.
- Kiểm đọc được (Sáng và Tối): ô `hl` chữ sáng trên nền xanh, `gold` chữ tối trên nền vàng, `leaf`; viên nang lọc chọn và
  chưa chọn; nút khoá mờ; khối trống.

## 6. Lệnh kiểm (tasks bước 6, `LC_ALL=C`)

```text
FE-UX-06a tasks bước 6, HEAD 538c2d8, base origin/release/ui-v2 9eac384
== 6a      # rỗng
== 6b      # rỗng
== 6c      # rỗng
== 6d
Bạc Liêu <chấm giữa> Trà Vinh <gạch dài> móng trụ trong bãi bồi
Gia Lai <chấm giữa> Quảng Trị <chấm giữa> Đắk Lắk <gạch dài> gió mùa ổn định
Ninh Thuận <chấm giữa> Bình Thuận <gạch dài> hệ số công suất cao
== 6e      # rỗng
== hết
```

("<chấm giữa>", "<gạch dài>" thay cho U+00B7, U+2014 lệnh in ra.) 6d đúng ba câu cũ của `REGION_HINTS` (QĐ-6), nay là
"Gia Lai, Quảng Trị, Đắk Lắk: gió mùa ổn định", "Ninh Thuận, Bình Thuận: hệ số công suất cao", "Bạc Liêu, Trà Vinh: móng trụ
trong bãi bồi". Dòng CF (`{…}% <chấm giữa> {…} đ/kWh`) nằm giữa ngoặc nhọn nên `ext` không bắt; unit nhóm 3 khoá dấu phẩy. Bốn dòng chú
thích có từ trước còn ký tự cấm (`assets.tsx:36`, `:39`, `kyc.tsx:19`, `reconciliation.tsx:26`), 6e bỏ qua dòng chú thích.
`docs/tech-report.md` không đổi (không marker trong các tệp đã sửa).

## 7. Bảng khối cũ và khối mới

Không có bản chốt riêng (kế hoạch 03/11: "chỉ áp hệ thiết kế"); đối chiếu với các màn đã làm cùng thành phần.

| Màn | Khối cũ | Khối mới | Mẫu đã làm |
|---|---|---|---|
| Cả ba | `h1 text-2xl font-semibold text-foreground` | `h1 text-2xl font-semibold tracking-tight` | các màn 04a đến 05c |
| Cả ba | Nút không hành động (bấm được) | `Button`/`DropdownMenuTrigger` `disabled` cùng chú thích "Chưa hỗ trợ trong PoC" | QĐ-5 (Sếp 02/11) |
| `/assets` | `StatCard` (`rounded-lg border`, `accent` viền xanh) | `Kpi` có `icon`, `unit`, sắc `default`, `default`, `hl`, `leaf` | `/seller` (05a), Tổng quan |
| `/kyc` | `KpiCard` (`warn` viền vàng, `danger` viền và chữ đỏ) | `Kpi` `hl`, `default`, `gold`, `default` | `/seller` (05a) |
| `/reconciliation` | `KpiCard` (`warn` khi có kỳ lệch) | `Kpi` `hl`, `default`, `gold`/`default` cùng điều kiện | `/seller` (05a) |
| `/reconciliation` | `SourceCard` `div.rounded-lg.border` biểu tượng trong ô vuông `bg-muted` | `Card` biểu tượng trong `CardTitleIcon` | thẻ có biểu tượng 03b đến 05c |
| Cả ba | Khung `div.rounded-lg.border.bg-card` | `Card gap-0 py-0` | `/seller/transactions` (05a) |
| Cả ba | Danh sách lưới `div` (`GRID`, `grid-cols-[…]`), tiêu đề chữ hoa | `Table` cùng cột, chữ tiêu đề kiểu `Table` chung | `/seller/transactions`, `/withdraw` |
| Cả ba | `FilterBtn` vuông, chọn `bg-secondary` | Viên nang, chọn `bg-primary`, có vòng focus | QĐ-4 |
| Cả ba | Trạng thái rỗng tự viết (`py-16`, `py-20`, biểu tượng xám) | `EmptyState` giữ biểu tượng, câu | `/withdraw` (04d) |
| `/kyc` | Ô tìm tự viết (`rounded-md border`) | `fieldClass pl-10`, biểu tượng `left-3.5` | ô có trang trí 04d, 05c |
| `/kyc` | Nút phân trang tự viết `opacity-50` | `Button outline sm disabled` | |
| `/assets` | Lưới 8 cột không cuộn (390 px tràn `main`) | `Table` cuộn trong `[data-slot="table-container"]` | |

## 8. Nợ và DEVIATION

- **DEVIATION: JS `/kyc` +4.236 B, vượt trần 3 KB của QĐ-8. Supervisor duyệt (05/11/2026).** Quyết định: giữ `Button` chung
  theo QĐ-3; không tự viết lớp nút, không nhập `buttonVariants` riêng. Nguyên nhân (mục 4, bảng module): màn `/kyc` cũ không
  dùng thành phần chung nào ngoài biểu tượng và `HoverHint`; nay nhập `Button` (kéo module nút Base UI, khoảng 2,3 KB gzip),
  `Kpi`, `Card`, `Table`, `EmptyState`, `fieldClass`, `cva` lần đầu. Không có mã thừa: chunk trang chỉ có các module đó và
  `KycPage` (nhỏ đi so mốc). `/assets` +1.834 B, `/reconciliation` +1.729 B trong trần; các trang khác bằng mốc (so chunk).
  Thử thay bằng `button` gốc cộng `buttonVariants()` không bớt được byte (462.499 B).
- **e2e ca 2 bàn phím:** design ghi "Tab sang Trên bờ, Cao nguyên"; theo thứ tự `REGION_LABELS` nút này đứng trước nên test dùng
  Shift+Tab (`538c2d8`). Lượt e2e đầu trên bản sau đỏ đúng chỗ này; số đo, ảnh lấy từ bản build `cd7a43b` (commit `538c2d8`
  chỉ sửa tệp e2e).
- **Lớp `TABLE_EDGE`** (ba trang): ô đầu và cuối bảng cách mép thẻ 16 px như thanh lọc, vì `Card gap-0 py-0` và `TableHead`,
  `TableCell` mặc định `px-2`. Không có trong spec; chỉ là lớp trình bày.
- **Chưa làm theo requirements mục 1 "Không làm":** nối dữ liệu thật; câu phụ dưới tiêu đề; ghi chú `unverified` từng khối; bảng
  thành thẻ ở màn nhỏ; hiệu ứng (FE-UX-08). L-27 (6 kỳ khớp trong khi bảng 0 kỳ) giữ nguyên (số mẫu).

## 9. Tự đánh giá 3 luật kiến trúc

- [x] Mọi call chain qua ILedgerPort: không đổi mã gọi chuỗi.
- [x] Mọi ký qua ISigner: không đổi.
- [x] Mọi kiểm quyền qua RBAC: không đổi.
