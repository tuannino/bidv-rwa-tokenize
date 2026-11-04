# Báo cáo bàn giao: FE-UX-04a Tổng quan nhà đầu tư và chi tiết token

| | |
|---|---|
| Mã task | FE-UX-04a |
| Phạm vi | **Frontend thuần.** Không `lib/`, `app/**`, `components/ui/**`, `mock-badge.tsx`, `use-token-summary.ts`; không gói npm mới; không đổi câu chữ (trừ QĐ-6), trường, thứ tự trường trong thẻ, liên kết, điều kiện hiện, lời gọi server action, số action khi mở màn |
| Nhánh | `feat/fe-ux-04a-tong-quan-ndt`, tạo từ `release/ui-v2` @ `ad133aa` (sau merge PR #92 FE-UX-03c). **Merge-base dùng để đo mốc: `ad133aa`** (không dùng số của `1238a54`) |
| Spec | `docs/fe-ux-04a-tong-quan-ndt/{requirements,design,tasks}.md` (chép nguyên) |
| Commit | spec `29d79d8`; e2e nháp `46c272f`; dời nguyên văn `26ba748`; unit nhóm 1, 2 `7ce97a1`; đổi kiểu hai màn, unit nhóm 3, 4, số `role` mốc `1295611`; giữ chú thích cũ `4758114`; UserGuide, task-status `ebf69d3`; dòng token dưới 640 px `e527dba`; unit nhóm 3, 4 sát design `fc0e50c`; tài liệu: các commit cuối trên nhánh |
| Tiến độ | Xong. Một PR, base `release/ui-v2`, chờ Supervisor nghiệm thu; Claude Code **không** merge |

Tệp mới trong `app/src/components/investor/`: `asset-holdings.tsx` (`AssetHoldings`), `transaction-table.tsx`
(`TransactionTable`).

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 4) | | Bằng chứng |
|---|---|---|---|
| 1 | Hai màn đúng bố cục bản chốt trừ "Không làm"; bảng đối chiếu từng dòng hai notes | ✅ | mục 2.2, 7 |
| 2 | Bố cục, thứ tự đúng QĐ-3, QĐ-4; thứ tự thẻ chi tiết token đổi; UserGuide 3.1.5 cập nhật | ✅ | mục 1.2 (ca 1, 2), 2.2, 8 |
| 3 | `AssetHoldings`, `TransactionTable` dời đúng QĐ-5, commit riêng; dán đoạn trước và sau | ✅ | mục 2.1 |
| 4 | Khối tự viết thay theo QĐ-7; không còn `amber-*`, `text-destructive` trong tệp phạm vi | ✅ | mục 2.2, 6 (6b) |
| 5 | Chữ chỉ đổi đúng QĐ-6, QĐ-4 (6d in đúng 6 dòng); không đổi trường, liên kết, điều kiện hiện | ✅ | mục 6 |
| 6 | Diff giữ logic (QĐ-1, QĐ-2); liệt kê đoạn đổi gần hook, effect, điều kiện nhánh | ✅ | mục 2.3 |
| 7 | Action đúng QĐ-2 (ca 4 đo bốn số; số có ví là bất biến mã nguồn), 28 đường dẫn không đổi; JS, CSS trong trần (byte sáu trang); `/portfolio`, `/tokens/WPT` lỗi 0 | ✅ | mục 4 |
| 8 | Mốc test QĐ-8 giữ; không sửa test có sẵn | ✅ | mục 1.1, 2.4 |
| 9 | Ảnh 1440, 390, Sáng, Tối, trước và sau, ba trang, tiến trình mock mới mỗi lượt, đúng công thức | ✅ | mục 5 |
| 10 | Trạng thái không dựng được trên mock: unit test và ảnh dựng ngoài repo (thẻ `hl`) | ✅ | mục 1.3, 5 |
| 11 | `fe-ux-04a-tong-quan-ndt.spec.ts` đủ 4 ca, `fe-ux-04a.test.ts` đủ 4 nhóm, xanh | ✅ | mục 1.2, 1.3 |
| 12 | Kiểm thử mục 5 đạt, kèm log; "EVM - E2E PROJECT HARDHAT" xanh | ✅ | mục 1.1 |
| 13 | Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 6) đúng kỳ vọng | ✅ | mục 6 |
| 14 | Không mã dư thừa | ✅ | mục 2.5 |

**Kết luận:** 14 ✅, 0 🔶, 0 ❌. JS gzip so bản mốc build riêng: `/portfolio` +767 B, `/tokens/WPT`
+1.369 B (trần 3 KB); `/trade` +201 B, `/orders` +435 B, `/orders/[id]` +441 B, `/withdraw`
+451 B (trần 1 KB mỗi trang); trang khác lệch trong nhiễu build, đã so chunk (mục 4); CSS +158 B (trần 2 KB);
action khớp 28/28; `hydration`, `consoleErrors`, `pageErrors` 0 ở mọi đường dẫn cả mốc lẫn sau; số `role` trong
`main` bằng mốc (0 ở cả ba trang). Mức rủi ro: thấp (hai khối dời sang tệp mới đã khoá bằng unit test trước khi đổi
kiểu; logic, effect, điều kiện nhánh không đổi).

UserGuide: "Chốt tại"; 3.1.1 thêm "Bố cục"; 3.1.5 thêm "Thứ tự thẻ", bảng xếp theo thứ tự mới; số dòng mã của
L-03, L-30, L-31, L-32, L-33, L-45, L-47 theo tệp mới (cả Phụ lục C).

### 0.2 Việc cần Owner quyết

- Không có. Ghi chú về bản build mốc của lượt e2e đầy đủ và ảnh trước ở mục 8.

---

## 1. Kiểm thử (requirements mục 5, phần dev)

### 1.1 Lệnh và kết quả

`FE-UX-04a` ở `inProgress` của `.kiro/task-status.json` khi chạy. Chạy khi cổng e2e trống (máy chủ mới), trên HEAD
`fc0e50c` cộng checkpoint chưa commit.

```text
$ TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm
  => PASS có cảnh báo: luật kiến trúc          # PASS 20, FAIL 0, WARN 3 (như mốc)
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)
ĐẠT     FE-UX-04a, docs/CHECKPOINT_FEUX04A.md
  => PASS: LỚP 3 - KHUÔN CHECKPOINT
  => PASS: APP - TYPECHECK
  => PASS: APP - LINT
      Tests  1551 passed | 74 skipped (1625)   # mốc 1533 + 18 ca mới của fe-ux-04a.test.ts
  => PASS: APP - VITEST
  => PASS: APP - BUILD BẢN PHÁT HÀNH
FE-UX-04a role counts /portfolio: {"status":0,"note":0,"alert":0}
FE-UX-04a role counts /tokens/WPT: {"status":0,"note":0,"alert":0}
FE-UX-04a role counts /tokens/WPT-PQY: {"status":0,"note":0,"alert":0}
      126 passed, 7 skipped (4.0m)            # project mock đầy đủ: 122 ca cũ + 4 ca mới
  => PASS: APP - E2E (PLAYWRIGHT)
  => PASS: EVM - BUILD BẢN HARDHAT
  => PASS: EVM - DỰNG CHUỖI MỚI
      26 passed, 2 skipped (45.8s)
  => PASS: EVM - E2E PROJECT HARDHAT
  => ĐẠT các phần đã chạy: arch markers checkpoint app build e2e evm
EXIT=0
```

Log gửi kèm (không commit): `20261104_feux04a_run_local_all.log` (dòng khoá ký Hardhat #0 trong env máy chủ cục bộ đã
che) và riêng đoạn từ "EVM - E2E PROJECT HARDHAT" tới hết: `20261104_feux04a_evm_e2e.log`. Không chạy `contracts`.
Dòng `RpcRequestError` trong phần vitest là stderr của `hf-03-doc-log-evm.test.ts` ca 3 (cố ý giả RPC báo quá giới
hạn khoảng block; ca đạt), có y hệt ở log FE-UX-03c.

### 1.2 e2e mới `app/e2e/fe-ux-04a-tong-quan-ndt.spec.ts` (project mock, vai Nhà đầu tư; không đặt lệnh)

Chờ tải như nhau ở mốc và sau: `networkidle`, rồi `main` không còn chữ khớp `/Đang (đọc|tải)/`.

| Ca | Kiểm | Mốc | Sau |
|---|---|---|---|
| 1 | `/portfolio` 1440 px: đếm `role` trước; `h1` và `#token-scope` lệch đỉnh dưới 24 px; 4 heading cấp 2 đúng thứ tự; thẻ Tài sản `data-tone="hl"`; 5 nhãn `dt` Trạng thái phát hành đúng thứ tự; `[data-slot="alert"]` "Chưa có thị trường thứ cấp" ngoài `dl`; 3 `href` token đúng thứ tự; `main` không U+00B7, U+2014; `role` bằng hằng số | đỏ (lệch đỉnh 76 px; câu thị trường thứ cấp trong `dl`) | xanh |
| 2 | Đếm `role` hai trang trước; `/tokens/WPT`: 4 heading Vị thế của bạn, Thông tin dự án, Thông tin token, Tình hình vận hành; Vị thế `data-tone="hl"`; "Đang giữ" (exact); 2 `[data-kpi]` `leaf`, `default`; 6 `li`. `/tokens/WPT-PQY`: thẻ đầu Vị thế của bạn, câu "Chưa có token trên chuỗi nên chưa có vị thế", không "Đang giữ" | đỏ (thứ tự heading cũ) | xanh |
| 3 | Ba trang, 1440 và 390, ngữ cảnh mới: `scrollWidth` không vượt bề rộng; 0 lỗi console, 0 `pageerror`, 0 cảnh báo hydrate | xanh | xanh |
| 4 | Số action khi mở màn (POST có `next-action`, `networkidle` cộng 1 giây, ngữ cảnh mới): `/portfolio` 1, `/tokens/WPT` 1, `/tokens/WPT-PQY` 0, `/tokens/WPT-NTH` 0 (`toBe`) | xanh | xanh |

Hằng số `role` đo trên bản build mốc bằng chính ca 1, ca 2 trong lượt e2e mock đầy đủ trên máy chủ mới:
`/portfolio`, `/tokens/WPT`, `/tokens/WPT-PQY` đều `{ status: 0, note: 0, alert: 0 }` (lượt đó 124 ca đạt, 2 ca đỏ
đúng như cột Mốc). Số không đổi theo dữ liệu: trên mock Tổng quan ở nhánh chưa kết nối, chi tiết token không có khối
`role` phụ thuộc số dư. Lượt sau cho đúng số đó.

`/portfolio` khi CÓ ví (3 action: `getPortfolioAction`, `getWalletTransactionsAction`, `getTokenSummaryAction`)
**không đo lúc chạy** (Playwright không có ví trình duyệt). Đây là bất biến giữ bằng unit nhóm 1 (đếm lời gọi trong mã
nguồn) và bằng việc không đổi effect (mục 2.3), không phải số đã đo.

### 1.3 Unit test mới `app/test/fe-ux-04a.test.ts` (môi trường `node`, 18 ca)

Nhóm 1 (mã nguồn): `asset-summary.tsx` 1 `getPortfolioAction(` và 1 `useEffect(`; `transaction-history-box.tsx` 1
`getWalletTransactionsAction(` và 1 `useEffect(`; `investor-token-detail.tsx` 1 `getPortfolioAction(` và 1
`useEffect(`; `asset-holdings.tsx`, `transaction-table.tsx` không `Action(`, `useEffect(`, `useState(`;
`investor-portfolio.tsx` không `'use client'`. Số mốc xác nhận trên `ad133aa` trước khi viết: 1, 1; 1, 1; 1, 1.

Nhóm 2 (`AssetHoldings`, `PortfolioView` giả đủ trường): bình thường (chữ "WPT đang giữ", "150", "15.000.000 ₫",
"Quy đổi theo giá phát hành 100.000 ₫/WPT", "đã KYC", "2.500.000 VNDB"; không "đang đóng băng", không
`role="status"`; thứ tự đang giữ, Giá trị theo giá phát hành, đã KYC, Số dư VNDB); chưa KYC và đóng băng;
`paymentBalance: null`; thu hồi NOTICE, FROZEN, CLOSED (đúng một `role="status"`, chứa `title`, `body` của
`recallNoticeText`, đứng trước "đang giữ").

Nhóm 3 (`TransactionTable`): một bảng 3 dòng `CONFIRMED`, `PENDING` (`amount: null`), `FAILED` chain `mock`: cột
Thời điểm, Nghiệp vụ, Số lượng, Trạng thái, Tra cứu; chữ trạng thái giữ mã; "–"; không `<a`; 3 `title` kết thúc
"không có trình khám phá", không U+2014. Sắc nhãn `ok`, `bad`, `info`. Chain đầu tiên có `explorerBaseUrl` (`evm`):
một `<a`, `href` bằng `explorerTxUrl(...)`, `target="_blank"`, `rel="noopener noreferrer"`.

Nhóm 4 (`WalletNotBoundNotice`, ví 42 ký tự): một `role="alert"`, `data-wallet-not-bound`, "Ví chưa được định
danh", `<span class="font-code">0x7099…79C8</span>`.

Nhóm 1, 2 viết và xanh ngay trên mã vừa dời (`7ce97a1`, trước khi đổi kiểu), vẫn xanh sau khi đổi kiểu.

Tự gây lỗi 4 điểm Supervisor định thử, trên bản sao làm việc rồi hoàn lại:

| Lỗi gây ra | Kết quả |
|---|---|
| `AssetHoldings` bỏ nhãn "đang đóng băng" | nhóm 2 "chưa KYC và đang đóng băng" đỏ |
| `TransactionTable` dựng liên kết cả khi `url` rỗng (`{url ? (` thành `{true ? (`) | nhóm 3 ca chain mock đỏ (có `<a`) |
| Chi tiết token, dự án chưa lên chuỗi hiện khối "Đang giữ" (bản build riêng `.next-mut`, e2e trên máy chủ mới) | `fe-ux-04a-tong-quan-ndt` ca 2 đỏ ("Đang giữ" ở `/tokens/WPT-PQY`: kỳ vọng 0, nhận 1); `investor-channel` 25 ca đạt |
| Thêm một lời gọi `getPortfolioAction(` vào `asset-summary.tsx` | nhóm 1 ca `asset-summary.tsx` đỏ |

## 2. Thay đổi

### 2.1 Dời `AssetHoldings`, `TransactionTable` (QĐ-5)

Commit `26ba748` chỉ dời mã. Thân nhánh `data` của `asset-summary.tsx:112-165` @ `ad133aa` kèm `nf` thành
`asset-holdings.tsx`; bảng `transaction-history-box.tsx:107-168` kèm import thành `transaction-table.tsx`.
`asset-summary.tsx` bỏ `nf`, import `Badge`, `recallNoticeText`; `transaction-history-box.tsx` bỏ import `Table*`,
`Badge`, `ExternalLink`, `explorerTxUrl`, `operationLabel`.

So sánh thân trước (bỏ 10 dấu cách thụt) và sau (bỏ 4 dấu cách thụt), `diff` rỗng ở cả hai: 54 dòng và 62 dòng giống
hệt. Đầu và cuối đoạn trước, @ `ad133aa`:

```tsx
        ) : data ? (
          <div className="space-y-4">
            {data.recall && (() => {
          ...
          </div>
        ) : null}
```

Sau (`asset-holdings.tsx` @ `26ba748`):

```tsx
export function AssetHoldings({ data }: { data: PortfolioView }) {
  return (
    <div className="space-y-4">
      {data.recall && (() => {
      ...
    </div>
  );
}
```

Chỗ gọi:

```tsx
        ) : data ? (
          <AssetHoldings data={data} />
        ) : null}
```

```tsx
        ) : (
          <TransactionTable rows={rows} />
        )}
```

Commit sau (`1295611`) mới đổi kiểu: thông báo thu hồi `Alert tone="warn" role="status"` (giữ hai đoạn `title`,
`body`); "đã KYC" `ok`, "chưa KYC" `bad`; "đang đóng băng" `bad`; trạng thái giao dịch `CONFIRMED` `ok`, `FAILED`
`bad`, còn lại `info`.

### 2.2 Màn (bố cục theo design mục 1, 2)

| Khối | Đổi |
|---|---|
| `/portfolio` đầu màn | `header` `flex flex-wrap items-center justify-between gap-4`: `h1` `text-2xl font-semibold tracking-tight`, `TokenScopeSelect` giữ `id`, `className` |
| `/portfolio` lưới | `grid gap-6 min-[1100px]:grid-cols-12`, bọc `col-span-7`, `col-span-5`; thứ tự DOM giữ |
| Tài sản đã đầu tư | `Card tone="hl"` cộng `[--card:var(--tile-hl-chip)] [--border:var(--tile-hl-chip)]`; `CardTitleIcon` `Wallet`; chưa kết nối `EmptyState` (biểu tượng `Wallet`, hai đoạn, liên kết "Ví của tôi" `prefetch={false}`); đang tải `EmptyState loading`; lỗi `Alert bad`; số liệu: nhãn 13 px, số `text-5xl`, hai ô `rounded-[18px] bg-muted p-4` cạnh nhau từ 640 px, dòng Số dư VNDB kẻ trên |
| Trạng thái phát hành | `CardTitleIcon` `Gauge` (bỏ biểu tượng rời bên phải); `dl` `divide-y`, dòng `py-3`, giá trị đậm; Trạng thái vận hành `Badge info`; câu thị trường thứ cấp `Alert info` (không `role`) ngay sau `</dl>`; đang tải `EmptyState loading`; lỗi `Alert bad` |
| Giao dịch gần đây | `CardTitleIcon` `History`; chưa kết nối, rỗng `EmptyState` (biểu tượng `Wallet`, `History` như cũ, giữ đoạn); đang tải `EmptyState loading`; lỗi `Alert bad`; bảng qua `TransactionTable` |
| Token dự án điện gió | `CardTitleIcon` `Wind`; mỗi dòng `rounded-[18px] px-4 py-3 hover:bg-muted/60`, ô `Wind` 40 px `aria-hidden`; dưới 640 px khối tên chiếm hàng, khối số nhà đầu tư xuống dưới (`flex-wrap`, `min-[640px]:flex-nowrap`) |
| `WalletNotBoundNotice` | `Alert tone="warn"` giữ `role="alert"`, `data-wallet-not-bound`, chữ, `font-code`; biểu tượng `ShieldAlert` |
| `/tokens/[symbol]` đầu màn | `h1` `text-2xl font-semibold tracking-tight`, ký hiệu, `OnChainBadge` hoặc `Badge info` "chưa triển khai trên chuỗi"; dòng vùng, vị trí, trạng thái dùng ", " |
| `/tokens/[symbol]` lưới | `grid gap-6 min-[1100px]:grid-cols-12`; Vị thế, Thông tin dự án, Thông tin token `col-span-4`; Tình hình vận hành `col-span-12`; bốn chú thích đánh số xoá |
| Vị thế của bạn | `Card tone="hl"` cộng lớp `--card`, `--border`; `CardTitleIcon` `Wallet`; "Đang giữ" 13 px, số `text-5xl`; dòng giá trị kẻ trên, số `text-2xl`; đang tải `EmptyState loading`; lỗi `Alert bad`; hai câu chặn giữ là đoạn chữ |
| Thông tin dự án, Thông tin token | `CardTitleIcon` `Wind`, `Gauge`; `dl` `divide-y`, `Row` `py-3`; khối `<Row label="WPT dự kiến phát hành">` không đổi |
| Tình hình vận hành | `CardTitleIcon` `Zap`; lưới `minmax(0,5fr)_minmax(0,7fr)` từ 1100 px; `Kpi tone="leaf"` Sản lượng luỹ kế (MWh), `Kpi` Hệ số công suất (`nfNum(…, 1)`, "%"); biểu đồ cột `div` `aria-hidden` (`MAX_GENERATION_MWH` cấp tệp); `ul` lưới 3 cột, 6 cột từ 640 px, `li` `rounded-[14px] bg-muted px-3 py-2` |

### 2.3 Đoạn đổi gần hook, effect, điều kiện nhánh (QĐ-1, QĐ-2)

Không đổi `useAccount`, `useSelectedChain`, `requestKey`, state `loaded`, effect (thoát sớm, `cancelled`, mảng phụ
thuộc), `fresh`, `data`, `error`, `loading` ở `asset-summary.tsx`, `transaction-history-box.tsx`,
`investor-token-detail.tsx`; `useTokenSummary(chain)`, `ON_CHAIN_PROJECT`, `projectNameView` ở hai hộp còn lại.
`investor-portfolio.tsx` vẫn Server Component. Các đoạn có đụng:

- Chuỗi điều kiện ba hộp Tổng quan và thẻ Vị thế: mỗi nhánh (`!isConnected || !address`, `loading`/`fresh ===
  null`, `notBound`, `error`, `data`, `rows.length === 0`) giữ đúng thứ tự và biểu thức; chỉ thay phần tử hiển thị
  của nhánh (đoạn chữ thành `EmptyState`, `Alert`). An toàn vì không biểu thức điều kiện nào đổi ký tự.
- `issuance-status-box.tsx`: nhánh `data` bọc `<>…</>` để đặt `Alert` sau `</dl>`; điều kiện `ON_CHAIN_PROJECT &&`
  của dòng Trạng thái vận hành giữ.
- `investor-token-detail.tsx`: bốn khối `Card` đổi chỗ nguyên khối; điều kiện `project.onChain && fresh?.data` của
  ba dòng token giữ; `MAX_GENERATION_MWH` là hằng cấp tệp từ dữ liệu mẫu tĩnh, không phải state.
- `CardTitle` giữ `role="heading" aria-level={2}` và chữ tiêu đề ở cả 8 thẻ.

### 2.4 Mốc test QĐ-8

Không sửa tệp test có sẵn. Đã chạy riêng trên bản sau (máy chủ mới): `fe-ux-04a-tong-quan-ndt`, `investor-channel`,
`fix-04-noi-du-lieu-that`, `ops-transactions`, `uiux-02-dau-man` (39 ca đạt); unit `fix-04-noi-du-lieu-that.test.ts`,
`uiux-02-dau-man.test.ts`, `fe-ux-04a.test.ts`. Cả bộ trong 1.1 (gồm `fe-07-price-config`, `fe-ux-01a-nen`,
`fe-ux-01b-khung`, `wallet-connect`).

### 2.5 Mã dư thừa

Đã xoá: `Loader2` (bốn khối đang tải tự viết), biểu tượng rời bên phải ở Trạng thái phát hành, các lớp
`text-destructive`, `amber-*`; trong `transaction-history-box.tsx` các import bảng (dời theo bảng); `nf`, `Badge`,
`recallNoticeText` ở `asset-summary.tsx` (dời theo khối). Lint đạt, không import thừa.

## 4. Đo trước và sau

Cùng máy, cùng quy trình (script ngoài repo): máy chủ mới cổng 3300, tạo dữ liệu bằng `maker-checker`,
`ops-transactions`, `permit-order`, `recall`; đo bằng `tools/20261104_do_moc_measure.js` (sha256 `6079a0d6…` khớp
spec) với `JS_PAGES=/,/portfolio,/trade,/approvals,/tokens/WPT,/orders,DYN:/orders,/withdraw`. Tiến trình đo khác
tiến trình chụp ảnh. JS theo byte: script riêng cộng gzip mọi script khi mở trang (cùng cách cộng của công cụ), máy
chủ mới cổng 3500 sau khi chạy `ops-transactions` (để có `/orders/[id]`), mỗi trang đo hai lần, hai lần bằng nhau.

| Mục | Mốc | Sau `e527dba` | Trần |
|---|---|---|---|
| Số action khi mở màn | 28 đường dẫn; `/portfolio` 1, `/tokens/WPT` 1 | Khớp 28/28 | không đổi |
| `hydration`, `consoleErrors`, `pageErrors` (cộng 4 biến thể) | 0 ở cả 28 đường dẫn | 0 ở cả 28 đường dẫn | hai trang 0, khác không tăng |
| CSS gzip (`.next/static/chunks/*.css`, 1 tệp, gzip mức 9) | 19.467 B | 19.625 B (+158 B) | +2 KB |
| `role` trong `main` (ca 1, ca 2) | 0, 0, 0 ở ba trang | giống hệt | bằng mốc |

JS gzip theo byte, so bản mốc build riêng (`ad133aa`, `NEXT_DIST_DIR=.next-moc`, build sau bản cuối, cùng phiên,
đã xoá):

| Trang | Mốc build riêng `ad133aa` | Sau `e527dba` | Chênh | Trần | Công cụ (KB, mốc; sau) |
|---|---|---|---|---|---|
| `/portfolio` | 467.050 | 467.817 | +767 | +3.072 | 456,1; 456,9 |
| `/tokens/WPT` | 461.704 | 463.073 | +1.369 | +3.072 | 450,9; 452,2 |
| `/trade` | 490.442 | 490.643 | +201 | +1.024 | 478,9; 479,1 |
| `/orders` | 548.219 | 548.654 | +435 | +1.024 | 535,4; 535,8 |
| `/orders/[id]` | 462.692 | 463.133 | +441 | +1.024 | 451,8; 452,3 |
| `/withdraw` | 483.582 | 484.033 | +451 | +1.024 | 472,3; 472,7 |
| `/` | 571.625 | 571.628 | +3 | không tăng | 558,2; 558,2 |
| `/approvals` | 466.085 | 466.109 | +24 | không tăng | bằng nhau |
| `/distribution` | 479.565 | 479.585 | +20 | không tăng | bằng nhau |
| `/vault` | 469.541 | 469.634 | +93 | không tăng | bằng nhau |

Ba trang không thuộc phạm vi tăng 20 đến 93 B và `/` +3 B: đã lưu và so từng chunk của `/vault`, `/approvals`,
`/distribution`, `/trade` giữa bản mốc build riêng và bản sau. Chunk khác nhau ở `/vault`, `/approvals`,
`/distribution` có cùng kích thước thô (43.653 B và 43.653 B; 178.700 B và 178.700 B; 29.637 B và 29.634 B; 55.043 B
và 55.043 B), khác ở mã số module, thứ tự module và mã tham chiếu server action theo bản build; không thêm mã. Phần
gzip lệch là nhiễu nén. Ở `/trade` chunk của trang tăng 888 B thô (`WalletNotBoundNotice` dùng `Alert`, QĐ-7), đúng
phần trần cho phép. Công cụ đo báo ba trang này bằng nhau. Lượt mốc trước (bản build mốc của lượt e2e đầy đủ, mục 8)
cho `/portfolio` 467.053, `/tokens/WPT` 461.705, `/vault` 469.540: chênh so lượt đó cùng cỡ (+764, +1.368, +94).

CSS mốc lấy từ bản build mốc sạch (19.467 B); bản mốc build riêng cho 19.510 B vì build lúc thư mục `.next-moc` nằm
trong `app/` (Tailwind quét thư mục chưa ignore). Hai cách so đều dưới trần (+158 B và +115 B).

## 5. Ảnh (gửi kèm, không commit)

- Ba trang `/portfolio`, `/tokens/WPT`, `/tokens/WPT-PQY`, vai Nhà đầu tư, 1440 và 390, Sáng và Tối, trước
  (`moc/anh/`) và sau (`sau/anh/`). Mỗi lượt một tiến trình mock MỚI cổng 3400 (`next start`, env như
  `playwright.config.ts`), không dùng lại máy chủ nào: `E2E_BASE_URL=http://localhost:3400 npx playwright test
  e2e/ops-transactions.spec.ts` (2 ca đạt), rồi chụp, rồi tắt. Mốc: bật 16:16:01Z, tắt 16:16:55Z. Sau (bản build
  `e527dba`): bật 16:45:31Z, tắt 16:46:25Z (04/11/2026, UTC). Chụp đặt lại cuộn về đầu mọi phần tử trước khi đo chiều
  cao; `scrollWidth` không vượt bề rộng, 0 lỗi console ở mọi ảnh.
- 28 đường dẫn của script đo, trước (`moc/do/`) và sau (`sau/do/`), 1440 và 390, Sáng và Tối.
- Trạng thái không dựng được trên mock (8 trạng thái): Tài sản bình thường, thu hồi NOTICE, FROZEN (kèm đóng băng),
  CLOSED, đóng băng và chưa KYC, Số dư VNDB `null`; bảng Giao dịch 4 dòng (`CONFIRMED`, `PENDING` không số lượng,
  `FAILED` trên mock, `CONFIRMED` trên `evm` có liên kết); `WalletNotBoundNotice`. HTML dựng bằng
  `renderToStaticMarkup` với dữ liệu giả như unit test (test tạm, xoá ngay, không commit), Tài sản đặt trong vỏ
  `Card tone="hl"` cộng lớp `--card`, `--border` như trên màn (ảnh trước: vỏ thẻ thường như màn mốc). CSS bản build
  tương ứng, `page.setContent`, font hệ thống; trước dùng mã @ `26ba748` (đã dời, chưa đổi kiểu) và CSS bản mốc, sau
  dùng mã cuối và CSS bản sau; Sáng và Tối, 1440 (thẻ rộng 760 px như cột 7/12) và 390 (`anh_tinh_moc/`,
  `anh_tinh_sau/`). Bảng Giao dịch ở 390 cuộn ngang trong khung bảng (design mục 3).

## 6. Lệnh kiểm (tasks bước 6, `LC_ALL=C`)

```text
6a $ git diff --name-only --diff-filter=d ... | grep -vE '^(...danh sách trắng...)$'      # rỗng
   $ git diff --name-only --diff-filter=D origin/release/ui-v2...HEAD                     # rỗng
6b $ rg -n '...màu cứng...|text-destructive' <hai trang> app/src/components/investor/        # rỗng
6c $ comm -13 /tmp/del.txt /tmp/add.txt | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e' # rỗng
6d $ comm -23 <(ext /tmp/del.txt) <(ext /tmp/add.txt)
/* 1 <gạch dài> Thông tin dự án */
/* 2 <gạch dài> Tình hình vận hành */
/* 3 <gạch dài> Thông tin token */
/* 4 <gạch dài> Vị thế của nhà đầu tư */
Chain cục bộ và mock không có trình khám phá -
Không phải giá thị trường <gạch dài> hệ thống chưa có thị trường thứ cấp.
6e $ rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e' <hai trang> app/src/components/investor/ | rg -v '<dòng chú thích>'   # rỗng
```

(Trong khối trên, "<gạch dài>" thay cho ký tự U+2014 lệnh in ra, vì tài liệu không dùng ký tự đó.) Chạy trên HEAD
`fc0e50c`, `LC_ALL=C`. 6d đúng 6 dòng tasks bước 6 liệt kê: bốn chú thích đánh số xoá theo QĐ-4
(`investor-token-detail.tsx:99`, `:124`, `:163`, `:216` @ `ad133aa`); mảnh chú thích `transaction-history-box.tsx:142`
(nay ở `transaction-table.tsx`, mũi tên ASCII thay bằng "nên", QĐ-6); câu `investor-token-detail.tsx:263` (thành
"Không phải giá thị trường, hệ thống chưa có thị trường thứ cấp.", QĐ-6). Không mảnh câu nào khác. Lượt chạy đầu
có thêm dòng "là giá đang giao dịch." do em nối thêm một câu vào cuối dòng chú thích cũ ở Trạng thái phát hành; đã
tách câu thêm sang dòng riêng (`4758114`) để dòng cũ giữ nguyên. `docs/tech-report.md` không đổi (marker không nằm
trong tệp đã sửa).

## 7. Đối chiếu notes

Cột "Kết quả": **Làm** (đúng bản chốt), **Giữ** (màn thật đã như vậy hoặc chỉ giữ chữ), **Không làm** (kèm lý do).

### 7.1 `notes/portfolio.md` (Ánh xạ)

| Dòng notes | Kết quả |
|---|---|
| Tiêu đề "Tổng quan nhà đầu tư" và câu mô tả | Làm phần tiêu đề (cùng hàng ô chọn token); không câu mô tả (requirements mục 1, test cấm câu phụ) |
| Thẻ xanh "Tài sản đã đầu tư" + ON-CHAIN | Làm: `Card tone="hl"`, `CardTitleIcon` `Wallet`, `OnChainBadge` bên phải |
| "WPT đang giữ", số 150 | Làm: nhãn 13 px, số `text-5xl` |
| Ô "Giá trị theo giá phát hành" | Làm: ô 1 `bg-muted` bo 18 px, số `text-2xl` |
| Câu "Quy đổi theo giá phát hành …" | Giữ chữ, trong ô 1 |
| Badge "đã KYC" (và "đang đóng băng") | Làm: `ok`/`bad`, đóng băng `bad`, ô 2 |
| Ví rút gọn, `title` đầy đủ | Giữ (`font-code`, `title`), ô 2 |
| Câu "Số dư VNDB chưa hiển thị được… (chờ BE-01)" | Không làm: màn thật đã đọc số dư VNDB (FIX-04), dòng Số dư VNDB giữ như dev, kẻ trên |
| Trạng thái "Chưa kết nối ví", liên kết "Ví của tôi" | Làm: `EmptyState` biểu tượng `Wallet`, giữ hai đoạn, `prefetch={false}` |
| Thẻ "Trạng thái phát hành" | Làm: `CardTitleIcon` `Gauge`, bỏ biểu tượng rời |
| Ký hiệu token + ON-CHAIN; Tổng cung + ON-CHAIN; Giá phát hành | Giữ chữ, dòng `py-3` kẻ ngăn, giá trị đậm |
| Dự án + DỮ LIỆU MẪU | Giữ như dev: tên từ bảng dự án (FIX-04), không gắn nhãn mẫu |
| Trạng thái vận hành dạng badge | Làm: `Badge info`, giữ "unverified" |
| Khung "Chưa có thị trường thứ cấp…" thành alert | Làm: `Alert info` không `role`, sau `</dl>` |
| Thẻ "Giao dịch gần đây" + ON-CHAIN | Làm: `CardTitleIcon` `History`, `OnChainBadge` |
| Bảng 5 cột | Giữ cột và chữ; trạng thái `Badge` có sắc |
| Mã giao dịch dạng chữ trên mock, `title` | Giữ; `title` đổi ", chain" (QĐ-6) |
| Rỗng "Kết nối ví để xem giao dịch của bạn." | Làm: `EmptyState` biểu tượng `Wallet` |
| Rỗng "Chưa có giao dịch nào…" | Làm: `EmptyState` biểu tượng `History`, hai đoạn |
| Thẻ "Token dự án điện gió", 3 dòng | Làm: `CardTitleIcon` `Wind`, dòng bo 18 px, ô `Wind` 40 px |
| Ký hiệu + ON-CHAIN hoặc nhãn mẫu | Giữ (`OnChainBadge`, `UnverifiedNote`) |
| Tên dự án; vùng và trạng thái, chấm giữa thành phẩy | Làm (QĐ-6) |
| 128 nhà đầu tư nắm giữ; dự án khác gạch dài thành "–" | Làm (QĐ-6) |
| Cả dòng bấm sang chi tiết | Giữ `Link` và `href` |
| Thanh "Trạng thái xem thử" | Không làm: không phải khối của màn thật; các trạng thái kiểm bằng unit test và ảnh dựng tĩnh (mục 1.3, 5) |
| Khung vàng thông báo thu hồi | Làm: `Alert warn role="status"`, chữ `recallNoticeText` |
| Thông báo "Ví chưa được định danh" | Làm: `Alert warn` giữ `role="alert"`; biểu tượng giữ `ShieldAlert` (bản chốt dùng `shieldx` của bộ biểu tượng prototype) |
| Đang tải ba hộp; lỗi đỏ | Làm: `EmptyState loading` giữ chữ; `Alert bad` không `role` |
| Tab "Chưa có giao dịch": số 0, "chưa KYC" | Không làm: là dữ liệu xem thử của prototype |
| Kiểu cục bộ `.kv dt` co giãn, `.tk-row`, ô `.tile` nền đặc | Làm phần bố cục (`dt` `flex-wrap`, dòng token xuống hàng dưới 640 px); ô trong thẻ `hl` dùng `bg-muted` (utility `tile-hl` tự đổi) thay `rgba` cứng vì không có ảnh tua-bin |
| Thay đổi trình bày: bento 7/5 | Làm (QĐ-3) |
| Badge giao dịch theo trạng thái; Trạng thái vận hành badge | Làm |
| Số lượng định dạng dấu chấm nghìn | Không làm: logic hiển thị, requirements mục 1 giữ `txn.amount` thô |
| Dòng token có biểu tượng tua-bin | Làm (`Wind`) |
| Hiệu ứng số đếm lên | Không làm (FE-UX-08) |
| Dải video "Đề xuất bổ sung" | Không làm (Q4 chưa chốt) |
| Mục "Lệch đã thấy" (5 dòng) | Không làm: logic hoặc chữ, ngoài task giao diện (requirements mục 1); câu "chờ BE-01" đã không còn ở dev |

### 7.2 `notes/token-detail.md` (Ánh xạ)

| Dòng notes | Kết quả |
|---|---|
| Liên kết "Tổng quan" trên tiêu đề | Không làm: app đã có breadcrumb ở thanh đầu (requirements mục 1) |
| Tiêu đề, ký hiệu, ON-CHAIN hoặc "chưa triển khai trên chuỗi" | Làm: `h1` `text-2xl`, `Badge info` cho dự án chưa lên chuỗi |
| Dòng vùng, vị trí, trạng thái; chấm giữa thành phẩy | Làm (QĐ-6), giữ "unverified" |
| Thẻ xanh "Vị thế của bạn" + ON-CHAIN, đứng đầu | Làm: `Card tone="hl"`, thẻ đầu (QĐ-4) |
| Đang giữ, Giá trị theo giá phát hành | Làm: số `text-5xl`, `text-2xl`, dòng giá trị kẻ trên |
| Câu "Không phải giá thị trường, hệ thống chưa có thị trường thứ cấp." | Làm (QĐ-6) |
| Thẻ "Thông tin dự án" + nhãn mẫu, 6 dòng | Làm: `CardTitleIcon` `Wind`, dòng kẻ ngăn; giữ `UnverifiedNote` |
| Thẻ "Thông tin token", 4 dòng điều khoản | Làm phần dòng kẻ ngăn; Lợi tức giữ chữ thường (bản chốt dùng nhãn vàng, requirements không giao đổi trường thành nhãn) |
| Tên token, Tổng cung, Giá phát hành chỉ khi có dữ liệu chuỗi; "WPT dự kiến phát hành" | Giữ nguyên khối (test `fix-04` đọc bằng regex) |
| Thẻ "Tình hình vận hành" rộng hết hàng dưới | Làm (`col-span-12`) |
| Ô vàng Sản lượng luỹ kế | Làm: `Kpi tone="leaf"` (sắc thương hiệu, design QĐ-4) |
| Hệ số công suất kèm vòng đo | Làm `Kpi`; không vòng đo (requirements mục 1) |
| Sản lượng theo kỳ: biểu đồ cột và 6 ô | Làm: cột `div` `aria-hidden`, `ul` lưới 3 hoặc 6 cột |
| Câu EnergyOracle cuối thẻ | Giữ |
| Thanh "Trạng thái xem thử" | Không làm: không phải khối màn thật |
| Thông báo "Ví chưa được định danh" trong Vị thế | Làm (dùng chung `WalletNotBoundNotice`) |
| "Kết nối ví ở góc trên phải…" | Giữ là đoạn chữ (QĐ-7) |
| Đang đọc số dư; câu lỗi đỏ | Làm: `EmptyState loading`; `Alert bad` |
| Biến thể dự án chưa lên chuỗi | Giữ mọi câu và điều kiện; kiểm bằng e2e ca 2 (`/tokens/WPT-PQY`) và ảnh |
| Kiểu cục bộ `.periods`, `.op-grid`, `.kv dt`; kẻ trong thẻ hero `rgba` | Làm bằng lưới Tailwind; kẻ trong thẻ `hl` dùng `--border` ghi đè (QĐ-3) thay `rgba` |
| Thay đổi trình bày: bento, biểu đồ cột | Làm |
| Mục "Lệch đã thấy" (2 dòng) | Không làm: logic hoặc chữ (L-45 vẫn ghi ở UserGuide) |

## 8. Nợ và DEVIATION

- **Bản build mốc của lượt e2e đầy đủ và ảnh trước.** Lượt mốc (`moc/`: e2e mock đầy đủ để lấy số `role`, JS theo
  byte lượt 1, công cụ đo, ảnh ba trang) build từ HEAD lúc đó `46c272f` = `ad133aa` cộng spec, commit dời nguyên văn
  `26ba748` (diff thân rỗng, mục 2.1) và tệp test mới; không có thay đổi giao diện. Để so byte đúng mốc, em build
  riêng `ad133aa` (mục 4); hai bản mốc lệch nhau 1 đến 6 B mỗi trang.
- **Dòng token dưới 640 px** (`e527dba`): bản đầu đặt `flex-wrap` nhưng khối tên `flex-1` co lại thay vì đẩy khối
  số xuống dòng, ảnh 390 thấy tên dự án bị cắt và dòng vùng gãy từng chữ. Đã thêm `basis-[calc(100%-3.5rem)]` (khối
  tên chiếm hàng, trừ ô biểu tượng) dưới 640 px, khối số thụt `ml-14` dưới tên; dòng vùng thêm `flex-wrap` để chữ
  "unverified" xuống dòng thay vì ép chữ. Đo và chụp lại toàn bộ trên bản này.
- **Chưa làm theo requirements mục 1 "Không làm":** dải video "Đề xuất bổ sung", ảnh tua-bin nền thẻ, hiệu ứng đếm số
  (FE-UX-08), vòng đo Hệ số công suất, liên kết "Tổng quan" trên tiêu đề chi tiết token, câu phụ dưới tiêu đề; các lệch
  nghiệp vụ trong notes (Tổng quan trên mock đòi ví trình duyệt L-03, cột Trạng thái giữ mã, Số lượng in thô, Thời
  điểm `toLocaleString`); `UnverifiedNote`, `OnChainBadge` giữ nguyên tệp.
- **Phạm vi trần JS:** `/vault` không thuộc QĐ-9 nhưng có trong `bytes` (đo cùng lượt); lệch +93 B là nhiễu nén, mục 4.

## 9. Tự đánh giá 3 luật kiến trúc

- [x] Mọi call chain qua ILedgerPort: không đổi mã gọi chuỗi.
- [x] Mọi ký qua ISigner: không đổi.
- [x] Mọi kiểm quyền qua RBAC: không đổi; action giữ nguyên `authorize('portfolio:read')`.
