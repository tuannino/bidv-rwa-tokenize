# Báo cáo bàn giao: FE-UX-01a Nền giao diện (màu, font, mặc định Sáng, thành phần dùng chung, thay `font-mono`)

| | |
|---|---|
| Mã task | FE-UX-01a |
| Phạm vi | **Chỉ frontend.** Không đổi backend, database, hợp đồng, cấu hình triển khai; không thêm gói npm |
| Nhánh | `feat/fe-ux-01a-nen`, tạo từ `release/ui-v2` (`9c72d75`, sau merge PR chuẩn bị #83) |
| Spec | `docs/fe-ux-01a-nen/{requirements,design,tasks}.md` (chép nguyên) |
| Commit | spec `5d4312d`; token, font, theme `6064fe0`; thành phần nền `f00a00d`; `font-mono` `45258d6`; e2e `f5937b0`; tài liệu: commit cuối trên nhánh |
| Tiến độ | Xong. PR base `release/ui-v2`, chờ Supervisor nghiệm thu; Claude Code **không** merge |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 4) | | Bằng chứng |
|---|---|---|---|
| 1 | Token Sáng, Tối đúng design mục 1; 8 cặp tương phản đạt ngưỡng | ✅ | mục 2.1, 2.2 |
| 2 | Roboto, Roboto Condensed nạp thật; `font-code` có trong CSS xuất ra | ✅ | mục 1.2 (ca 3, 4), 2.3 |
| 3 | `grep font-mono` ngoài `components/layout` trả 0 dòng; bảng 160 dòng trong checkpoint | ✅ | mục 4 |
| 4 | Mở lần đầu ra Sáng; nút đổi theme chạy, còn sau tải lại; hydrate 0 ở 28 đường dẫn | ✅ | mục 1.2 (ca 1, 2), 3 |
| 5 | `fe-ux-01a-nen.spec.ts` đủ 6 ca, xanh, ca nào cũng có phép kiểm cụ thể | ✅ | mục 1.2 |
| 6 | Diff `components/ui/*` chỉ là chuỗi class, không đổi props, biến thể, không mã màu cứng | ✅ | mục 2.4 |
| 7 | 37 tệp thay `font-mono`: diff chỉ là tên lớp; không sửa tệp màn khác | ✅ | mục 4.1, 5 |
| 8 | Số server action khi mở màn không đổi ở 28 đường dẫn | ✅ | mục 3 |
| 9 | JS gzip `/`, `/portfolio`, `/trade`, `/approvals` không tăng quá 10 KB | ✅ | mục 3 (không đổi) |
| 10 | Ảnh trước, sau 28 đường dẫn (Sáng, Tối, 1440, 390) gửi kèm | ✅ | mục 3.1 |
| 11 | Không ký tự cấm ở dòng thêm mới trong 4 nhóm tệp (tasks bước 9) | ✅ | mục 5 |
| 12 | Lệnh danh sách trắng rỗng; `run-local-all.sh` toàn bộ đạt, kèm log | ✅ | mục 1.1, 5 |
| 13 | Không mã dư thừa: khối màu cũ xoá hẳn; không biến, lớp, import thừa | ✅ | mục 2.1, 2.3 |
| 14 | Checkpoint có "Phạm vi: chỉ frontend", danh sách tệp, bảng `font-mono`, số đo, kết quả kiểm thử | ✅ | đầu tệp, mục 1, 3, 4, 5 |

**Kết luận:** 14 ✅, 0 🔶, 0 ❌. Cả 28 đường dẫn đổi sang màu xanh ngọc, vàng, font Roboto, mặc định Sáng mà
không đổi bố cục, câu chữ, số action hay dung lượng JS. Mức rủi ro: thấp (chỉ chuỗi class và giá trị token).

UserGuide: Phần 3 quy ước chung thêm mục "Giao diện chung"; "Chốt tại"; Lịch sử.

### 0.2 Việc cần Owner quyết

- **Bảo vệ nhánh `release/ui-v2` (Cổng 0, điều kiện 4):** Sếp báo đã bật. API danh sách nhánh của GitHub vẫn trả
  `protected: false` cho `release/ui-v2` (có thể do bật bằng ruleset, cờ này không phản ánh ruleset). Đề nghị Sếp
  xem lại Settings, Rules hoặc Branches. Điều kiện 5 (đóng băng task frontend nghiệp vụ): Sếp chuyển thông báo
  của Supervisor và giao task tiếp ("tiếp tục đi") ngày 03/11.
- **Bốn dòng phân loại cần Supervisor xác nhận** (mục 4.2): ô nhập ký hiệu token ở `/draft` (bỏ lớp), dòng bút
  toán ở `settlement-progress.tsx:52` (`tabular-nums`), lớp ô nhập dùng chung ở `/vault` và `/demo-payment`
  (`font-code`), prop `mono` ở `order-detail-content.tsx:87` (`font-code`, cùng quy tắc ba prop spec nêu).

---

## 1. Kiểm thử

### 1.1 Toàn bộ (tasks bước 7)

```text
$ TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa USE_LOCAL_SOLC=1 \
    bash scripts/run-local-all.sh arch markers checkpoint contracts app build e2e evm
  => PASS có cảnh báo: luật kiến trúc          # PASS 20, FAIL 0, WARN 3 (như mốc)
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)
  => PASS: LỚP 3 - KHUÔN CHECKPOINT
  => PASS: LỚP 1 - SPEC TEST CONTRACT EVM
  => PASS: APP - TYPECHECK
  => PASS: APP - LINT
      Tests  1478 passed | 74 skipped (1552)   # như mốc
  => PASS: APP - VITEST
  => PASS: APP - BUILD BẢN PHÁT HÀNH
  96 passed, 7 skipped                         # e2e mock: mốc 90 cộng 6 ca mới
  => PASS: APP - E2E (PLAYWRIGHT)
  => PASS: EVM - BUILD BẢN HARDHAT
  => PASS: EVM - DỰNG CHUỖI MỚI
  26 passed, 2 skipped                         # e2e Hardhat: như mốc
  => PASS: EVM - E2E PROJECT HARDHAT
  => ĐẠT các phần đã chạy: arch markers checkpoint contracts app build e2e evm
```

Log đầy đủ gửi kèm báo cáo: `20261103_feux01a_run_local_all.log`. Không nới bước kiểm nào; e2e cũ chỉ đổi
selector ở `fix-05-tong-quan.spec.ts:46` (`.font-mono` thành `.tabular-nums`, giữ điều kiện `^\d+$`).

### 1.2 e2e mới `app/e2e/fe-ux-01a-nen.spec.ts` (project mock)

| Ca | Kiểm | Kết quả |
|---|---|---|
| 1 | Mở `/` lần đầu (context mới): `html` không có lớp `dark`; nền body `rgb(239, 244, 244)` | ✅ |
| 2 | Bấm `button[title^="Chuyển sang"]`: có lớp `dark`, nền `rgb(8, 15, 15)`; tải lại vẫn Tối | ✅ |
| 3 | `fontFamily` của body chứa `Roboto`, không chứa `Condensed`, bắt đầu bằng tên đọc từ `--font-roboto`; `document.fonts.check('500 14px "Roboto"')` là `true` sau `document.fonts.ready` | ✅ |
| 4 | Trên `/kyc`, phần tử `.font-code` (chữ `/mint`) có `fontFamily` chứa `Condensed`; `document.styleSheets` có quy tắc `.font-code` (tìm cả trong `@layer`) | ✅ |
| 5 | `Card` có `borderRadius` 22px; nút chính `[data-slot=button].bg-primary` có bán kính lớn hơn hoặc bằng nửa chiều cao, nền `rgb(23, 110, 109)` | ✅ (chạy trên `/draft`, xem mục 6) |
| 6 | `/`, `/portfolio`, `/approvals`, `/seller`: 0 phần tử `.font-mono` ngoài `aside` (thanh bên); có ít nhất một phần tử lớp mới | ✅ |

```text
$ (cd app && npx playwright test e2e/fe-ux-01a-nen.spec.ts)
  6 passed (11.1s)
```

## 2. Thay đổi chính

### 2.1 Token (`globals.css`)

Giá trị đúng bảng design mục 1.1 (Sáng ở `:root`, Tối ở `.dark`, QĐ-1), viết hex. Khối "BIDV Brand Colors" (màu
`oklch(... 145)`, `oklch(... 82)`, chú thích cũ, biến `--bidv-green`, `--bidv-gold` không còn nơi dùng) xoá hẳn; thay
bằng chú thích ngắn về ràng buộc tương phản. `--radius` giữ nguyên (QĐ-2).

### 2.2 Tương phản (đo bằng công thức độ sáng tương đối WCAG trên đúng giá trị hex đã đặt)

| Cặp | Tỉ lệ | Ngưỡng |
|---|---|---|
| `--foreground` trên `--background` (Sáng) | 15,48 | 4,5 |
| `--muted-foreground` trên `--background` (Sáng) | 5,31 | 4,5 |
| `--primary-foreground` trên `--primary` (Sáng) | 6,02 | 4,5 |
| `--primary-foreground` trên `--primary` (Tối) | 6,55 | 4,5 |
| `--accent-foreground` trên `--accent` (Sáng) | 6,49 | 4,5 |
| `--muted-foreground` trên `--card` (Tối) | 8,22 | 4,5 |
| `--chart-4` trên `--card` (Sáng) | 7,65 | 4,5 |
| `--chart-2`, `--chart-3` trên `--card` (Sáng) | 3,85; 4,27 | 3 |

### 2.3 Font (`layout.tsx`, `globals.css`)

- `Roboto` (300, 400, 500, 700) biến `--font-roboto`, `Roboto_Condensed` (400, 500) biến `--font-roboto-condensed`,
  subsets `latin`, `vietnamese`, `display: 'swap'`. Bỏ `Geist_Mono` và biến `--font-mono` của nó.
- `@theme inline`: `--font-sans: var(--font-roboto)` (sửa UX-01: trước là `var(--font-sans)` tự tham chiếu nên
  trình duyệt rơi về font có chân), `--font-heading: var(--font-roboto)`, `--font-code: var(--font-roboto-condensed)`.
- CSS xuất ra (`.next/static/chunks/*.css`): có `.font-code{font-family:var(--font-roboto-condensed)}`,
  `.font-sans{font-family:var(--font-roboto)}`, `@font-face` Roboto, Roboto Condensed; không còn chữ `Geist`.
  `.font-sans` đứng sau `.font-code` nên ô `${FIELD} font-sans` ở `/vault` (lý do thất bại) vẫn ra Roboto.
- Bốn dòng `font-mono` ở `components/layout` (để FE-UX-01b) giờ dùng font monospace mặc định của Tailwind
  (`ui-monospace, ...`) vì `--font-mono` của Geist đã bỏ.
- `metadata.title`: `'BIDV RWA, token hoá dự án điện gió'` (bỏ gạch dài).
- Build mock và Hardhat tải font Google thành công trên máy này (mục 1.1, phần `build`, `evm`).

### 2.4 Thành phần nền (`components/ui`, chỉ chuỗi class)

| Thành phần | Đổi |
|---|---|
| `card.tsx` | `rounded-xl` thành `rounded-[22px]` (thẻ, ảnh đầu cuối, `CardHeader` `rounded-t-[22px]`, `CardFooter` `rounded-b-[22px]`); `ring-foreground/10` thành `ring-border` |
| `button.tsx` | Lớp gốc `rounded-lg` thành `rounded-full`; bỏ `rounded-[min(var(--radius-md),...)]` ở `xs`, `sm`, `icon-xs`, `icon-sm` (dùng `rounded-full` của lớp gốc); chiều cao giữ nguyên |
| `dialog.tsx` | `DialogContent` `rounded-[22px]`; `DialogFooter` `rounded-b-[22px]` cho khớp góc |
| `dropdown-menu.tsx` | Khung `DropdownMenuContent`, `DropdownMenuSubContent` `rounded-[18px]`; nền `bg-popover`, mục đang trỏ `focus:bg-accent` giữ nguyên |
| `table.tsx` | `TableHead`: thêm `bg-muted`, `text-xs`, `text-foreground` thành `text-muted-foreground`; `TableRow` `hover:bg-muted/50` thành `hover:bg-muted` |
| `badge.tsx`, `skeleton.tsx` | Không đổi: 6 biến thể badge và skeleton đã dùng token (`bg-primary`, `bg-secondary`, `bg-destructive/10`, `bg-muted`) |

Không đổi props, tên biến thể, thứ tự phần tử, `data-slot`; không mã màu cứng.

### 2.5 `providers.tsx`

`defaultTheme="light"`; `RainbowWithTheme` trước khi mount dùng `LIGHT_WALLET_THEME`, sau khi mount theo
`resolvedTheme` (`dark` thì `DARK_WALLET_THEME`). Chú thích sửa cho khớp, bỏ gạch dài. Không đổi Wagmi,
QueryClient, `LIGHT_WALLET_THEME`, `DARK_WALLET_THEME`, `BRAND`.

## 3. Đo trước và sau (design mục 6.3)

Cùng script `20261103_do_moc_measure.js`, bản build chain mock (`next start --port 3300`, biến môi trường như
máy chủ e2e), dữ liệu tạo bằng `E2E_PORT=3300 npx playwright test e2e/maker-checker.spec.ts
e2e/ops-transactions.spec.ts e2e/permit-order.spec.ts` (9 passed, 3 skipped).

| Đường dẫn | Action mốc | Action sau | Hydrate mốc | Hydrate sau |
|---|---|---|---|---|
| `/draft`, `/vault`, `/approvals` | 3 | 3 | 0 | 0 |
| `/seller/withdraw` | 2 | 2 | 0 | 0 |
| `/assets`, `/kyc`, `/audit`, `/reconciliation`, `/wallet` | 0 | 0 | 0 | 0 |
| 19 đường dẫn còn lại (gồm `/transactions/[id]`, `/approvals/[id]`, `/orders/[id]`) | 1 | 1 | 0 | 0 |

So từng dòng của hai tệp `metrics.json`: 28/28 khớp số action, 0 cảnh báo hydrate ở cả 28.

| JS gzip khi mở | Mốc | Sau | Chênh |
|---|---|---|---|
| `/` | 552,9 KB | 552,9 KB | 0 |
| `/approvals` | 451,7 KB | 451,7 KB | 0 |
| `/portfolio` | 454,5 KB | 454,5 KB | 0 |
| `/trade` | 476,9 KB | 476,9 KB | 0 |

### 3.1 Ảnh

`20261103_sau_do_giao_dien_feux01a.zip` (gửi kèm, không commit): 112 ảnh (28 đường dẫn, Sáng, Tối, 1440, 390,
chụp hết chiều cao nội dung), `metrics.json`, log chạy script. Ảnh mốc ở gói của Supervisor. Ở 390 px bố cục giữ
như trước (khung đổi ở FE-UX-01b).

## 4. Thay `font-mono` (QĐ-4)

```text
$ grep -rln "font-mono" app/src --include=*.tsx | grep -v "components/layout/" | grep -v "app/layout.tsx" | wc -l
37                                  # trước khi sửa
$ grep -rn "font-mono" app/src --include=*.tsx | grep -v "components/layout/" | wc -l
0                                   # sau khi sửa
```

Kết quả: 77 dòng `font-code`, 76 dòng `tabular-nums`, 7 dòng bỏ lớp (ký hiệu token đứng riêng). Bốn dòng trong
`components/layout` (`channel-guard.tsx:36,37`, `sidebar.tsx:272,340`) giữ nguyên cho FE-UX-01b.

### 4.1 Kiểm diff chỉ là tên lớp

Ghép từng cặp dòng bớt, thêm của 37 tệp: 160 cặp; bỏ tên lớp `font-mono` ở dòng cũ và `font-code`, `tabular-nums`
ở dòng mới thì hai dòng như nhau (trừ khoảng trắng quanh lớp bị bỏ). Hai dòng có hai lần `font-mono` cùng loại
(`vault-status.tsx:411,585`, liên kết và chữ mã băm) đổi cả hai.

### 4.2 Trường hợp cần Supervisor xem

| Tệp:dòng | Nội dung | Chọn | Lý do |
|---|---|---|---|
| `pages/draft.tsx:383` | Ô nhập ký hiệu token (chữ hoa) | bỏ lớp | Quy tắc "ký hiệu token đứng riêng"; nếu coi là ô nhập mã thì `font-code` |
| `trading/settlement-progress.tsx:52` | Dòng bút toán: bên, tài sản, số tiền | `tabular-nums` | Phần cần thẳng hàng là số tiền; chữ còn lại là tên |
| `pages/vault-status.tsx:49`, `pages/demo-payment.tsx:27` | Lớp ô nhập dùng chung (số, tỷ lệ, ví, mã giao dịch) | `font-code` | Theo quy tắc lớp dùng chung cho cả số và mã; ô lý do vẫn ghi đè `font-sans` |
| `trading/order-detail-content.tsx:87` | Prop `mono` (mã lệnh, số lượng, ví, mã giao dịch) | `font-code` | Cùng dạng ba prop spec nêu, spec không liệt kê tệp này |
| `pages/vault-status.tsx:43`, `pages/distribution-approval.tsx:93` | Ô số liệu dùng chung (số dư, địa chỉ, mã kỳ, trạng thái) | `font-code` | Quy tắc lớp dùng chung |

### 4.3 Bảng phân loại 160 dòng

| # | Tệp (`app/src/`) | Dòng | Nội dung hiển thị | Lớp mới |
|---|---|---|---|---|
| 1 | `app/(ops)/audit/page.tsx` | 61 | mã hành động sổ kiểm toán | `font-code` |
| 2 | `app/(ops)/audit/page.tsx` | 62 | mã đối tượng (rút gọn) | `font-code` |
| 3 | `app/(ops)/demo-payment/page.tsx` | 25 | mã vai hiện tại | `font-code` |
| 4 | `app/(ops)/wallet-binding/page.tsx` | 25 | mã vai hiện tại | `font-code` |
| 5 | `components/investor/asset-summary.tsx` | 126 | số WPT đang giữ | `tabular-nums` |
| 6 | `components/investor/asset-summary.tsx` | 132 | giá trị theo giá phát hành | `tabular-nums` |
| 7 | `components/investor/asset-summary.tsx` | 151 | địa chỉ ví (rút gọn) | `font-code` |
| 8 | `components/investor/asset-summary.tsx` | 162 | số dư VNDB | `tabular-nums` |
| 9 | `components/investor/issuance-status-box.tsx` | 56 | ký hiệu token | bỏ lớp |
| 10 | `components/investor/issuance-status-box.tsx` | 60 | tổng cung | `tabular-nums` |
| 11 | `components/investor/issuance-status-box.tsx` | 64 | giá phát hành | `tabular-nums` |
| 12 | `components/investor/token-list-box.tsx` | 51 | ký hiệu token | bỏ lớp |
| 13 | `components/investor/token-list-box.tsx` | 69 | số nhà đầu tư | `tabular-nums` |
| 14 | `components/investor/transaction-history-box.tsx` | 126 | số lượng giao dịch | `tabular-nums` |
| 15 | `components/investor/transaction-history-box.tsx` | 150 | mã băm giao dịch (liên kết) | `font-code` |
| 16 | `components/investor/transaction-history-box.tsx` | 157 | mã băm giao dịch | `font-code` |
| 17 | `components/investor/wallet-not-bound-notice.tsx` | 20 | địa chỉ ví (rút gọn) | `font-code` |
| 18 | `components/maker-checker/request-table.tsx` | 64 | mã yêu cầu | `font-code` |
| 19 | `components/maker-checker/request-table.tsx` | 81 | số lượng | `tabular-nums` |
| 20 | `components/maker-checker/stat-card.tsx` | 10 | số liệu thẻ thống kê | `tabular-nums` |
| 21 | `components/maker-checker/token-info-block.tsx` | 82 | prop `mono` dùng chung (hợp đồng, số lượng, ví) | `font-code` |
| 22 | `components/pages/account-info.tsx` | 95 | mã người dùng | `font-code` |
| 23 | `components/pages/account-info.tsx` | 115 | hạn mức giao dịch ngày | `tabular-nums` |
| 24 | `components/pages/account-info.tsx` | 121 | mã cán bộ | `font-code` |
| 25 | `components/pages/account-wallet.tsx` | 81 | địa chỉ ví thanh toán | `font-code` |
| 26 | `components/pages/approval-detail.tsx` | 176 | mã yêu cầu | `font-code` |
| 27 | `components/pages/approval-detail.tsx` | 316 | ngày giờ lịch sử | `tabular-nums` |
| 28 | `components/pages/approval-detail.tsx` | 339 | prop `mono` dùng chung (số lượng, ví, mã giao dịch) | `font-code` |
| 29 | `components/pages/assets.tsx` | 218 | mã dự án | `font-code` |
| 30 | `components/pages/assets.tsx` | 235 | công suất MW | `tabular-nums` |
| 31 | `components/pages/assets.tsx` | 240 | số liệu dự án | `tabular-nums` |
| 32 | `components/pages/assets.tsx` | 244 | số liệu dự án | `tabular-nums` |
| 33 | `components/pages/assets.tsx` | 260 | địa chỉ đơn vị vận hành | `font-code` |
| 34 | `components/pages/assets.tsx` | 284 | mã băm giao dịch | `font-code` |
| 35 | `components/pages/assets.tsx` | 297 | mã băm giao dịch (liên kết) | `font-code` |
| 36 | `components/pages/assets.tsx` | 330 | số liệu thẻ thống kê | `tabular-nums` |
| 37 | `components/pages/dashboard.tsx` | 118 | số TCC (chưa có) | `tabular-nums` |
| 38 | `components/pages/dashboard.tsx` | 237 | số liệu thẻ KPI | `tabular-nums` |
| 39 | `components/pages/dashboard.tsx` | 254 | tổng cung trên thanh | `tabular-nums` |
| 40 | `components/pages/demo-payment.tsx` | 27 | lớp ô nhập dùng chung (ví, số tiền) | `font-code` |
| 41 | `components/pages/demo-payment.tsx` | 148 | địa chỉ ví người bán (nút) | `font-code` |
| 42 | `components/pages/demo-payment.tsx` | 236 | ví nhận (rút gọn) | `font-code` |
| 43 | `components/pages/demo-payment.tsx` | 239 | số tiền | `tabular-nums` |
| 44 | `components/pages/distribution-approval.tsx` | 93 | ô số liệu dùng chung (mã kỳ, trạng thái, số tiền) | `font-code` |
| 45 | `components/pages/distribution-approval.tsx` | 102 | mã băm giao dịch (liên kết) | `font-code` |
| 46 | `components/pages/distribution-approval.tsx` | 107 | mã băm giao dịch | `font-code` |
| 47 | `components/pages/distribution-approval.tsx` | 232 | địa chỉ ví | `font-code` |
| 48 | `components/pages/distribution-approval.tsx` | 233 | số dư tại khối chốt | `tabular-nums` |
| 49 | `components/pages/distribution-approval.tsx` | 234 | số được chia | `tabular-nums` |
| 50 | `components/pages/distribution-approval.tsx` | 297 | mã kỳ | `font-code` |
| 51 | `components/pages/distribution-approval.tsx` | 300 | mã người duyệt | `font-code` |
| 52 | `components/pages/distribution-approval.tsx` | 302 | số đã duyệt | `tabular-nums` |
| 53 | `components/pages/distribution-approval.tsx` | 303 | tổng số | `tabular-nums` |
| 54 | `components/pages/distribution-approval.tsx` | 304 | số duyệt lại | `tabular-nums` |
| 55 | `components/pages/distribution-approval.tsx` | 337 | mã kỳ | `font-code` |
| 56 | `components/pages/distribution-approval.tsx` | 338 | số vòng | `tabular-nums` |
| 57 | `components/pages/distribution-approval.tsx` | 457 | địa chỉ ví | `font-code` |
| 58 | `components/pages/distribution-approval.tsx` | 458 | số dư | `tabular-nums` |
| 59 | `components/pages/distribution-approval.tsx` | 459 | phần được chia | `tabular-nums` |
| 60 | `components/pages/draft.tsx` | 383 | ô nhập ký hiệu token | bỏ lớp |
| 61 | `components/pages/draft.tsx` | 415 | ô nhập địa chỉ ví | `font-code` |
| 62 | `components/pages/draft.tsx` | 469 | ô nhập số lượng | `tabular-nums` |
| 63 | `components/pages/investor-orders.tsx` | 114 | địa chỉ ví | `font-code` |
| 64 | `components/pages/investor-orders.tsx` | 183 | mã lệnh | `font-code` |
| 65 | `components/pages/investor-orders.tsx` | 188 | số lượng | `tabular-nums` |
| 66 | `components/pages/investor-orders.tsx` | 189 | đơn giá | `tabular-nums` |
| 67 | `components/pages/investor-orders.tsx` | 190 | giá trị | `tabular-nums` |
| 68 | `components/pages/investor-token-detail.tsx` | 84 | ký hiệu token | bỏ lớp |
| 69 | `components/pages/investor-token-detail.tsx` | 111 | mã dự án | `font-code` |
| 70 | `components/pages/investor-token-detail.tsx` | 118 | địa chỉ đơn vị vận hành | `font-code` |
| 71 | `components/pages/investor-token-detail.tsx` | 149 | kỳ (tháng/năm) | `tabular-nums` |
| 72 | `components/pages/investor-token-detail.tsx` | 150 | sản lượng MWh | `tabular-nums` |
| 73 | `components/pages/investor-token-detail.tsx` | 175 | ký hiệu token | bỏ lớp |
| 74 | `components/pages/investor-token-detail.tsx` | 189 | tổng cung | `tabular-nums` |
| 75 | `components/pages/investor-token-detail.tsx` | 192 | giá phát hành | `tabular-nums` |
| 76 | `components/pages/investor-token-detail.tsx` | 200 | số WPT đã phát hành | `tabular-nums` |
| 77 | `components/pages/investor-token-detail.tsx` | 250 | số đang giữ | `tabular-nums` |
| 78 | `components/pages/investor-token-detail.tsx` | 258 | giá trị theo giá phát hành | `tabular-nums` |
| 79 | `components/pages/investor-trade.tsx` | 275 | địa chỉ ví | `font-code` |
| 80 | `components/pages/investor-trade.tsx` | 356 | tổng giá trị | `tabular-nums` |
| 81 | `components/pages/investor-trade.tsx` | 467 | số tiền cho phép chi kèm ký hiệu | `tabular-nums` |
| 82 | `components/pages/investor-trade.tsx` | 482 | prop `mono` dùng chung | `font-code` |
| 83 | `components/pages/investor-trade.tsx` | 585 | mã băm giao dịch | `font-code` |
| 84 | `components/pages/investor-withdraw.tsx` | 316 | ô nhập số tiền | `tabular-nums` |
| 85 | `components/pages/investor-withdraw.tsx` | 332 | ô ví nguồn | `font-code` |
| 86 | `components/pages/investor-withdraw.tsx` | 347 | ô ví nhận | `font-code` |
| 87 | `components/pages/investor-withdraw.tsx` | 394 | số dư ví thanh toán | `tabular-nums` |
| 88 | `components/pages/investor-withdraw.tsx` | 398 | số tiền rút | `tabular-nums` |
| 89 | `components/pages/investor-withdraw.tsx` | 400 | số dư sau rút | `tabular-nums` |
| 90 | `components/pages/investor-withdraw.tsx` | 437 | mã lệnh rút | `font-code` |
| 91 | `components/pages/investor-withdraw.tsx` | 441 | số tiền | `tabular-nums` |
| 92 | `components/pages/investor-withdraw.tsx` | 442 | ví nhận | `font-code` |
| 93 | `components/pages/investor-withdraw.tsx` | 448 | mã băm giao dịch | `font-code` |
| 94 | `components/pages/investor-withdraw.tsx` | 499 | ví nhận trong hộp xác nhận | `font-code` |
| 95 | `components/pages/investor-withdraw.tsx` | 509 | ô nhập mã OTP | `font-code` |
| 96 | `components/pages/kyc.tsx` | 128 | đường dẫn `/mint` | `font-code` |
| 97 | `components/pages/kyc.tsx` | 179 | số liệu thẻ thống kê | `tabular-nums` |
| 98 | `components/pages/mint.tsx` | 201 | ô nhập địa chỉ ví | `font-code` |
| 99 | `components/pages/mint.tsx` | 205 | địa chỉ ví mẫu | `font-code` |
| 100 | `components/pages/mint.tsx` | 217 | ô nhập số lượng | `tabular-nums` |
| 101 | `components/pages/mint.tsx` | 277 | số dư | `tabular-nums` |
| 102 | `components/pages/mint.tsx` | 323 | ví nhận (rút gọn) | `font-code` |
| 103 | `components/pages/mint.tsx` | 326 | số lượng | `tabular-nums` |
| 104 | `components/pages/ops-transactions.tsx` | 227 | mã lệnh (liên kết) | `font-code` |
| 105 | `components/pages/ops-transactions.tsx` | 231 | ví nhà đầu tư (rút gọn) | `font-code` |
| 106 | `components/pages/ops-transactions.tsx` | 233 | số lượng | `tabular-nums` |
| 107 | `components/pages/ops-transactions.tsx` | 234 | giá trị | `tabular-nums` |
| 108 | `components/pages/ops-transactions.tsx` | 301 | số liệu nguồn cung | `tabular-nums` |
| 109 | `components/pages/price-config.tsx` | 338 | ví SPV (rút gọn) | `font-code` |
| 110 | `components/pages/price-config.tsx` | 389 | mã băm giao dịch | `font-code` |
| 111 | `components/pages/reconciliation.tsx` | 188 | số liệu thẻ thống kê | `tabular-nums` |
| 112 | `components/pages/seller-overview.tsx` | 98 | số liệu thẻ thống kê | `tabular-nums` |
| 113 | `components/pages/seller-overview.tsx` | 172 | số liệu nguồn cung | `tabular-nums` |
| 114 | `components/pages/seller-overview.tsx` | 187 | ký hiệu token | bỏ lớp |
| 115 | `components/pages/seller-overview.tsx` | 191 | trần phát hành | `tabular-nums` |
| 116 | `components/pages/seller-overview.tsx` | 193 | giá phát hành | `tabular-nums` |
| 117 | `components/pages/seller-overview.tsx` | 230 | ký hiệu token | bỏ lớp |
| 118 | `components/pages/seller-overview.tsx` | 232 | số liệu nguồn cung | `tabular-nums` |
| 119 | `components/pages/seller-overview.tsx` | 257 | địa chỉ vault | `font-code` |
| 120 | `components/pages/seller-transactions.tsx` | 187 | mã giao dịch | `font-code` |
| 121 | `components/pages/seller-transactions.tsx` | 190 | địa chỉ ví (rút gọn) | `font-code` |
| 122 | `components/pages/seller-transactions.tsx` | 194 | số WPT | `tabular-nums` |
| 123 | `components/pages/seller-transactions.tsx` | 195 | số VNDB | `tabular-nums` |
| 124 | `components/pages/seller-withdraw.tsx` | 235 | ô nhập số tiền | `tabular-nums` |
| 125 | `components/pages/seller-withdraw.tsx` | 254 | ô ví nhận | `font-code` |
| 126 | `components/pages/seller-withdraw.tsx` | 309 | số dư | `tabular-nums` |
| 127 | `components/pages/seller-withdraw.tsx` | 311 | số đang khoá | `tabular-nums` |
| 128 | `components/pages/seller-withdraw.tsx` | 313 | phần được rút | `tabular-nums` |
| 129 | `components/pages/seller-withdraw.tsx` | 317 | số tiền nhận được | `tabular-nums` |
| 130 | `components/pages/seller-withdraw.tsx` | 356 | mã lệnh rút | `font-code` |
| 131 | `components/pages/seller-withdraw.tsx` | 359 | số tiền | `tabular-nums` |
| 132 | `components/pages/seller-withdraw.tsx` | 360 | ví nhận | `font-code` |
| 133 | `components/pages/seller-withdraw.tsx` | 369 | mã băm giao dịch | `font-code` |
| 134 | `components/pages/seller-withdraw.tsx` | 414 | ví nhận trong hộp xác nhận | `font-code` |
| 135 | `components/pages/seller-withdraw.tsx` | 424 | ô nhập mã OTP | `font-code` |
| 136 | `components/pages/vault-status.tsx` | 43 | ô số liệu dùng chung (số dư, địa chỉ vault, chế độ) | `font-code` |
| 137 | `components/pages/vault-status.tsx` | 49 | lớp ô nhập dùng chung (tỷ lệ, số khoá, mã giao dịch) | `font-code` |
| 138 | `components/pages/vault-status.tsx` | 187 | mã băm giao dịch | `font-code` |
| 139 | `components/pages/vault-status.tsx` | 277 | mã lệnh rút (8 ký tự) | `font-code` |
| 140 | `components/pages/vault-status.tsx` | 278 | ví nhận (rút gọn) | `font-code` |
| 141 | `components/pages/vault-status.tsx` | 406 | số khối | `tabular-nums` |
| 142 | `components/pages/vault-status.tsx` | 409 | giá trị cũ (tỷ lệ, số tiền) | `tabular-nums` |
| 143 | `components/pages/vault-status.tsx` | 410 | giá trị mới (tỷ lệ, số tiền) | `tabular-nums` |
| 144 | `components/pages/vault-status.tsx` | 411 | mã băm giao dịch | `font-code` |
| 145 | `components/pages/vault-status.tsx` | 579 | mã kỳ | `font-code` |
| 146 | `components/pages/vault-status.tsx` | 580 | lợi nhuận chia kỳ trước | `tabular-nums` |
| 147 | `components/pages/vault-status.tsx` | 581 | tỷ lệ | `tabular-nums` |
| 148 | `components/pages/vault-status.tsx` | 582 | số khoá | `tabular-nums` |
| 149 | `components/pages/vault-status.tsx` | 583 | ví người thao tác | `font-code` |
| 150 | `components/pages/vault-status.tsx` | 585 | mã băm giao dịch | `font-code` |
| 151 | `components/pages/wallet-binding.tsx` | 122 | ô nhập địa chỉ ví | `font-code` |
| 152 | `components/pages/wallet-binding.tsx` | 177 | địa chỉ ví | `font-code` |
| 153 | `components/recall/cases-table.tsx` | 24 | địa chỉ ví (kèm nút sao chép) | `font-code` |
| 154 | `components/recall/cases-table.tsx` | 81 | mã băm giao dịch | `font-code` |
| 155 | `components/trading/order-detail-content.tsx` | 66 | ngày giờ lịch sử | `tabular-nums` |
| 156 | `components/trading/order-detail-content.tsx` | 87 | prop `mono` dùng chung (mã lệnh, số lượng, ví, mã giao dịch) | `font-code` |
| 157 | `components/trading/settlement-progress.tsx` | 35 | ngày giờ bước | `tabular-nums` |
| 158 | `components/trading/settlement-progress.tsx` | 52 | dòng bút toán (bên, tài sản, số tiền) | `tabular-nums` |
| 159 | `components/wallet/wallet-status-card.tsx` | 52 | địa chỉ ví | `font-code` |
| 160 | `components/wallet/wallet-status-card.tsx` | 87 | số dư | `tabular-nums` |

## 5. Danh sách tệp, danh sách trắng, ký tự cấm

Tệp đổi: `app/src/app/globals.css`, `app/src/app/layout.tsx`, `app/src/components/providers.tsx`,
`app/src/components/ui/{button,card,dialog,dropdown-menu,table}.tsx`, 37 tệp ở mục 4.3,
`app/e2e/fix-05-tong-quan.spec.ts`, `app/e2e/fe-ux-01a-nen.spec.ts` (mới), `docs/fe-ux-01a-nen/*` (mới),
`docs/CHECKPOINT_FEUX01A.md` (mới), `docs/USER_GUIDE.md`, `.kiro/task-status.json`.

```text
$ git diff --name-only origin/release/ui-v2...HEAD | grep -vE '^(app/src/app/...)$' | grep -vxF -f /tmp/feux01a-files.txt
                                    # rỗng (lệnh đầy đủ ở tasks bước 8)
$ git diff origin/release/ui-v2...HEAD -U0 -- app/src/app/globals.css app/src/app/layout.tsx \
    app/src/components/providers.tsx app/src/components/ui | grep '^+[^+]' | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e'
                                    # rỗng
```

`.kiro/task-status.json`: `FE-UX-01a` chuyển từ `planned` sang `done`. Không có marker `@pending FE-UX-01a`.

## 6. DEVIATION so với spec

- **Ca 5 chạy trên `/draft` thay `/`:** design mục 8 ghi "Một `Card` trên `/`", nhưng màn `/` không dùng `Card`
  hay `Button` của `components/ui` (thẻ số liệu `KpiCard` và nút "Phát hành WPT" là phần tử riêng của
  `dashboard.tsx`; PR không sửa màn nên không đổi được). `/draft` cùng vai Giao dịch viên có `Card` và nút chính
  "Gửi yêu cầu tạo token" dùng `Button` mặc định.
- **`DialogFooter`, `DropdownMenuSubContent` đổi bo theo khung:** design chỉ ghi khung chính; đổi theo để góc chân
  hộp thoại và menu con khớp khung, vẫn chỉ là chuỗi class.

## 7. Câu hỏi mở

- Mục 0.2 (bảo vệ nhánh, bốn dòng phân loại).
- Nút "Kết nối ví" (RainbowKit, `BRAND.green`) và công tắc Lưu ký Fireblocks (`bg-green-500` trong
  `components/layout`) vẫn xanh lá cũ: đúng phạm vi (FE-UX-01b).

## 8. Tự đánh giá 3 luật kiến trúc

- [x] Mọi call chain qua ILedgerPort: không đổi mã gọi chuỗi.
- [x] Mọi ký qua ISigner: không đổi.
- [x] Mọi kiểm quyền qua RBAC: không đổi; luật kiến trúc PASS (mục 1.1, phần `arch`).
