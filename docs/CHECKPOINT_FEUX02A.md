# Báo cáo bàn giao: FE-UX-02a Thành phần màn dùng chung và 5 màn Vận hành

| | |
|---|---|
| Mã task | FE-UX-02a |
| Phạm vi | **Frontend thuần.** Không `lib/`, `app/actions`, `app/api`, không gói npm mới; không đổi câu chữ (trừ QĐ-8), trường, bộ lọc, nút, điều kiện khoá, lời gọi server action |
| Nhánh | `feat/fe-ux-02a-van-hanh`, tạo từ `release/ui-v2` (`2065289`, sau merge PR #86 FE-UX-01c) |
| Spec | `docs/fe-ux-02a-van-hanh/{requirements,design,tasks}.md` (chép nguyên) |
| Commit | spec `91c932b`; mã, test `6720836`, sửa lệnh kiểm 8b `259b219`; tài liệu: commit cuối trên nhánh |
| Tiến độ | Xong. Một PR (không tách), base `release/ui-v2`, chờ Supervisor nghiệm thu; Claude Code **không** merge |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 4) | | Bằng chứng |
|---|---|---|---|
| 1 | Token QĐ-2 có ở Sáng và Tối; bảng tương phản 8 nền đạt 4,5:1 | ✅ | mục 2.1, 3 |
| 2 | Thành phần QĐ-3 đúng API, không tự đặt `role`; `Kpi` có `data-kpi`, `data-tone`, chuyển tiếp `data-testid`, `aria-*` | ✅ | mục 2.2, 1.3 (nhóm 2) |
| 3 | `orderStatusTone` đủ 7, `settlementStepTone` đủ 4 (unit test), dùng ở bảng và chi tiết lệnh; `Alert`, `EmptyState` không tự đặt `role` (unit test) | ✅ | mục 1.3, 2.2, 2.3 |
| 4 | 5 màn đúng bố cục trừ QĐ-9 và "Không làm"; sắc ô đúng QĐ-4; bảng đối chiếu notes | ✅ | mục 2.3, 1.2 (ca 1, 2), 6 |
| 5 | Không đổi chữ, trường, bộ lọc, nút, điều kiện khoá; chỉ chuỗi QĐ-8 đổi (8d) | ✅ | mục 5 (8d) |
| 6 | Diff 7 tệp chỉ là JSX, lớp, thay khối bằng thành phần chung; liệt kê đoạn đổi gần hook, handler | ✅ | mục 2.4 |
| 7 | Chi tiết lệnh đúng ở `/transactions/[id]`, `/orders/[id]`, `/trade`; `ops-transactions`, `permit-order` xanh; ảnh có dữ liệu | ✅ | mục 1.1, 4 |
| 8 | Mốc test QĐ-7 giữ nguyên; chỉ `fix-05-tong-quan.spec.ts:45` đổi selector | ✅ | mục 2.5 |
| 9 | Action không đổi 28 đường dẫn; JS, CSS trong trần QĐ-10; hydrate, lỗi console 0 | ✅ | mục 3 |
| 10 | 390 px không tràn ở 5 màn và `/orders/[id]`; ảnh 1440, 390, Sáng, Tối, trước và sau | ✅ | mục 1.2 (ca 4), 4 |
| 11 | `fe-ux-02a-van-hanh.spec.ts` đủ 4 ca, `fe-ux-02a.test.ts` đủ 3 nhóm, xanh | ✅ | mục 1.2, 1.3 |
| 12 | Kiểm thử đúng mục 5, đạt, kèm log | ✅ | mục 1.1 |
| 13 | Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 8) rỗng | ✅ | mục 5 |
| 14 | Không mã dư thừa: `KpiCard`, `SupplyMetric`, `StatusBadge`, hằng `INPUT` 5 màn, khối chặn cũ xoá hẳn; liệt kê bản sao còn lại | ✅ | mục 2.6 |

**Kết luận:** 14 ✅, 0 🔶, 0 ❌. Tương phản đo sau render tại 60 vùng chữ: thấp nhất 4,69 (chữ phụ ô vàng `au`).
JS tăng 4,0 KB ở `/` (trần 5 KB), dưới 0,6 KB ở 3 trang còn lại; CSS tăng 1.588 B (trần 4 KB); action khớp
28/28. Mức rủi ro: thấp đến vừa (đổi `SettlementProgress`, `OrderDetailContent` dùng chung với kênh Nhà đầu tư;
e2e mock và Hardhat đều xanh).

UserGuide: Phần 3 mục 3.0 thêm đoạn "Thành phần màn dùng chung"; mục 3.4.1, 3.4.5, 3.4.6, 3.4.7, 3.4.9 thêm dòng
"Bố cục"; sửa số dòng mã ở L-14, L-26, L-42, L-69; "Chốt tại"; Lịch sử.

### 0.2 Việc cần Owner quyết

- Không có. Hai điểm Supervisor nên xem ở mục 7 (gạch dài do `lib/format.ts` dựng; ca 3 tách tooltip recharts).

---

## 1. Kiểm thử (requirements mục 5, phần dev)

### 1.1 Lệnh và kết quả

```text
$ TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm
  => PASS có cảnh báo: luật kiến trúc          # PASS 20, FAIL 0, WARN 3 (như mốc)
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)
  => PASS: LỚP 3 - KHUÔN CHECKPOINT
  => PASS: APP - TYPECHECK
  => PASS: APP - LINT
      Tests  1488 passed | 74 skipped (1562)   # mốc 1478 + 10 ca mới của fe-ux-02a.test.ts
  => PASS: APP - VITEST
  => PASS: APP - BUILD BẢN PHÁT HÀNH
@@E2E@@
@@EVM@@
```

Log gửi kèm (không commit): `20261104_feux02a_run_local_all.log`. Không chạy `contracts` (mục 5).

Chạy nhanh trước đó trên bản build mock (`fe-ux-02a-van-hanh`, `fix-05-tong-quan`, `ops-transactions`,
`vault-withdraw`, `investor-channel`, `investor-withdraw`, `permit-order`): 36 passed, 3 skipped (`permit-order`
chỉ chạy trên Hardhat).

### 1.2 e2e mới `app/e2e/fe-ux-02a-van-hanh.spec.ts` (project mock, chỉ đọc, không tạo dữ liệu)

| Ca | Kiểm |
|---|---|
| 1 | `/` (teller, 1440 px): 5 `[data-kpi]`; `data-tone` Tổng cung token `hl`, Lợi tức đã chia `au`, Sản lượng luỹ kế `leaf`, Dự án, Nhà đầu tư `default`; `backgroundImage` ô `hl` khác `none` và khác ô `default`. Thêm: ô `hl` nằm trái ô Dự án, cùng hàng đầu, cao hơn 1,5 lần (lưới 12 cột, mục 7) |
| 2 | `/transactions`: 3 `[data-kpi]`; `supply-total` `hl`, `supply-undistributed` `leaf`, `supply-circulating` `default`; chữ số trong ô Chưa phân phối đúng bằng chữ số của con số hiển thị |
| 3 | Đếm `role` status, note, alert TRONG `main` sau khi tải xong (`/`, `/demo-payment`, `/wallet-binding` vai TELLER; `/transactions` vai CONTROLLER), so hằng số đo ở mốc `2065289` (mục 3) |
| 4 | 390 px: `scrollWidth <= 390` ở 4 màn ca 3; 1440 và 390 px: 0 lỗi console, 0 lỗi trang, 0 cảnh báo hydrate |

Chờ "tải xong": nút Sáng Tối hiện (đã hydrate), không còn chữ "Đang đọc" trong `main`, không còn `EmptyState`
đang tải (`data-loading`), `/demo-payment` đã hiện câu "Tối đa một lần:".

### 1.3 Unit test mới `app/test/fe-ux-02a.test.ts` (môi trường `node`, `renderToStaticMarkup`, 10 ca)

1. `orderStatusTone` với mọi giá trị `ORDER_STATUSES` (7) đúng bảng QĐ-3; bảng kỳ vọng là `Record<OrderStatus, ...>`
   nên thiếu trạng thái là lỗi typecheck. `settlementStepTone` đủ 4 trạng thái bước.
2. `Alert` (ok, warn, bad, info) và `EmptyState` (thường, `loading`, `tone="bad"`): không truyền thì HTML không có
   `role`; truyền `role="status"`, `aria-label`, `data-x` thì có đủ trên phần tử gốc (7 ca).
3. `SettlementProgress` với 5 bước giả (`done`, `done`, `current`, `failed`, `pending`) và `settlement` giả: 5 `li`
   đúng thứ tự `data-step`; mỗi `li` giữ `data-state`, có `step.label`, nhãn `STEP_STATE_LABELS[state]`, `data-tone`
   đúng `settlementStepTone` (`ok, ok, warn, bad, muted`); "Kết cục: cả bốn bút toán đã ghi." nằm trọn một `p`.

Tự gây lỗi 3 điểm Supervisor định thử (mục 5 bảng Supervisor), trên bản sao làm việc rồi hoàn lại:
@@MUT@@

## 2. Thay đổi

### 2.1 `app/src/app/globals.css` (QĐ-2)

- `@theme inline`: `--color-{ok,warn,bad,info}-{bg,ink}` (lớp `bg-ok-bg`, `text-ok-ink`...).
- `:root`, `.dark`: 8 biến trạng thái; `--tile-{hl,au,leaf,gold}` (gradient), `-ink`, `-sub`; thêm `--tile-hl-bar`
  (màu thanh WPT trong ô `hl`), `--tile-hl-chip`, `--tile-au-chip` (nền vòng biểu tượng), `--tile-leaf-ring`,
  `--tile-gold-ring`, `--tile-*-deco` (vân trang trí nhạt).
- `@utility tile-hl`, `tile-au`, `tile-leaf`, `tile-gold`: `background-image`, `color`, ghi đè cục bộ
  `--card-foreground`, `--foreground`, `--muted-foreground` (ô `hl` thêm `--muted`, `--chart-1` cho `SupplyBar`,
  `--primary`); ô nhạt có viền trong và vân `::before` (`z-index: -1`, gốc `isolate`).
- Chỉnh so với `c.css` để đạt tương phản: ô `hl` điểm sáng `#1e8886` đổi `#176e6d` (chữ trắng 4,27 lên 6,02); ô `au`
  Tối điểm cuối `#8a6406` đổi `#b98510` (chữ `#2a1c00` 3,09 lên trên 4,5); chữ phụ ô `au` `#4d3500` đổi `#332200`.

### 2.2 Thành phần (`components/ui`, `components/trading/order-status-tone.ts`)

| Thành phần | Nội dung |
|---|---|
| `Card` | thêm `tone` (`default`, `tint`, `hl`, `au`, `leaf`, `gold`), gốc có `data-tone`; `CardTitleIcon` vòng 32 px `bg-muted`, biểu tượng 16 px `text-primary`. API cũ giữ nguyên |
| `Badge` | thêm biến thể `ok`, `warn`, `bad`, `info` |
| `Kpi` (mới) | `label`, `value` (ReactNode), `unit`, `sub`, `icon`, `tone`, `size` (`lg`: cao 300 px, số 40 px); gốc `data-kpi`, `data-tone`, chuyển tiếp mọi thuộc tính; phần tử `tabular-nums` đầu tiên chỉ chứa giá trị |
| `Alert` (mới) | `tone` ok, warn, bad, info; biểu tượng mặc định theo tone, cho truyền `icon`; KHÔNG `role` mặc định |
| `EmptyState` (mới) | thường, `loading` (`Loader2`), `tone="bad"`; KHÔNG `role` mặc định; `data-loading` khi đang tải (mốc chờ của e2e) |
| `BlockedNotice` (mới) | thẻ `bad`, `ShieldX`, `h1` 18 px, chữ của trang truyền qua `children` |
| `fieldClass` (mới, `field.ts`) | đúng chuỗi design mục 2 |
| `orderStatusTone`, `settlementStepTone` | `Record<OrderStatus, StatusTone>`: PLACED, CHECKING, EXECUTING `warn`; COMPLETED `ok`; REJECTED, FAILED `bad`; EXPIRED `info`. Bước: done `ok`, current `warn`, failed `bad`, pending `muted` |

### 2.3 Màn (bố cục theo design mục 3)

| Màn | Đổi |
|---|---|
| `/` | `Kpi` thay `KpiCard`; lưới 12 cột từ 1100 px, ô Tổng cung `hl lg` cột 1 đến 4 hai hàng (giữ `SupplyBar`, dòng TCC), 4 ô còn lại 4 cột; 2 cột từ 640 px; nút "Phát hành WPT" là `Link` mang lớp `buttonVariants()`; lỗi `Alert bad` không `role`; thẻ biểu đồ 12 cột, 2 biểu đồ cạnh nhau từ 1100 px, mỗi biểu đồ có `CardTitleIcon`, ô cha `min-w-0`; biểu đồ chỉ đổi lưới (bỏ vạch dọc), bo cột 6 px, độ dày đường 2,5, bo tooltip; giữ id `generationGradient`, 3 nhánh Đang đọc, Chưa đọc được, rỗng |
| `/transactions` | ghi chú chỉ xem `Alert info role="note"`; 3 `Kpi` (giữ `data-testid`); MỘT `Card`: bộ lọc `fieldClass`, phản hồi `Alert role="status"`, `EmptyState` tải, lỗi, rỗng, bảng (`Badge` theo `orderStatusTone`, ô trống `–`), phân trang |
| `/transactions/[id]` | liên kết quay lại có `ArrowLeft`; `EmptyState` tải, lỗi; nội dung chung (`OrderDetailContent`): `Badge` theo `orderStatusTone`; lưới 12 cột: Thông tin lệnh 5, Tiến trình 7, Nhật ký 12 dạng dòng thời gian; `SettlementProgress` dạng chấm tròn nối đường theo `data-tone`, khối quy tắc, Kết cục, bút toán trong `Card tint` |
| `/demo-payment` | ghi chú `Alert info role="note"`; thẻ "Nạp vào ví" 8 cột từ 1100 px, `CardTitleIcon`; ô `fieldClass`; câu "Tối đa một lần" giữ trong dòng gợi ý; phản hồi `Alert role="status"`; lịch sử `EmptyState`, `Badge` theo trạng thái |
| `/wallet-binding` | 2 thẻ có `CardTitleIcon`; lưới biểu mẫu giữ `16rem` cộng phần còn lại; ô `fieldClass`; phản hồi `Alert` giữ `role`, `aria-label`; danh sách `EmptyState` (lỗi giữ `role="alert"`) |
| 2 trang chặn | `BlockedNotice` thay khối cũ, giữ nguyên `p` và biểu thức điều kiện `canMintDemoPayment(role) ? <DemoPaymentPage` |

### 2.4 Đoạn đổi gần hook, handler (QĐ-1)

Không đổi dòng nào khai báo hoặc thân hook, state, effect, handler, `requestKey`, debounce, lời gọi action, điều
kiện `disabled`. Các đoạn JSX chứa handler bị dời hoặc bọc lại (chỉ đổi lớp, phần tử bọc):

- `ops-transactions.tsx`: `form role="search"` (giữ `onSubmit` chặn mặc định), 5 ô lọc (giữ `value`, `onChange`,
  `aria-label`), 2 nút phân trang (giữ `disabled`, `onClick`) dời vào trong `Card`; cột Hành động giữ nguyên nút
  can thiệp (`onClick`, `disabled`), chỉ đổi gạch dài thành `–`.
- `demo-payment.tsx`: ô Ví đích, ô Số VNDB đổi `className` (`fieldClass`), giữ `value`, `onChange`; khối phản hồi
  thay bằng `Alert` cùng `role="status"`. Hàm `short()` và câu thành công đổi ký tự theo QĐ-8.
- `wallet-binding.tsx`: 2 ô của biểu mẫu đổi `className`; khối phản hồi thay bằng `Alert` cùng `role`, `aria-label`.
- `dashboard.tsx`: `Link href="/mint" prefetch={false}` đổi lớp; `KpiCard` thay bằng `Kpi`, cùng biểu thức giá trị.
- `ops-order-detail.tsx`: nhánh tải, lỗi thay bằng `EmptyState`.

### 2.5 Mốc test QĐ-7

Unit test cũ đọc mã nguồn chạy xanh không sửa: `uiux-02-dau-man.test.ts` (h1 "Tổng quan", không `data-chain` ở
`wallet-binding.tsx`, `data-chain={chain}` ở `ops-transactions.tsx`), `fix-05-tong-quan.test.ts` (3
`<UnverifiedNote`, `getOpsOverviewAction`, không `MOCK_PROJECTS`), `demo-payment.test.ts:234`. e2e cũ: chỉ
`fix-05-tong-quan.spec.ts:45` đổi `div.rounded-lg` thành `[data-kpi]`, điều kiện giữ nguyên.

### 2.6 Mã dư thừa

Đã xoá: `KpiCard` (dashboard), `SupplyMetric`, `StatusBadge`, hằng `FIELD` (`ops-transactions.tsx`), `INPUT`
(`demo-payment.tsx`, `wallet-binding.tsx`), khối chặn cũ ở 2 `page.tsx`, hàm `StepIcon` của `settlement-progress.tsx`.

Bản sao còn lại ngoài phạm vi (để các PR màn sau thay): `KpiCard` ở `pages/kyc.tsx:156`, `pages/reconciliation.tsx:172`;
`StatCard` ở `pages/assets.tsx:305`, `maker-checker/stat-card.tsx:5`; `StatusBadge` (yêu cầu token) ở
`maker-checker/status-badge.tsx:20`; hằng `FIELD` ở `investor-trade.tsx:475`, `investor-withdraw.tsx:39`,
`vault-status.tsx:48`, `seller-transactions.tsx:73`, `seller-withdraw.tsx:37`, `price-config.tsx:51`,
`investor-orders.tsx:47`.

## 3. Đo trước và sau

Cùng máy, cùng phiên. Mốc `release/ui-v2` @ `2065289`. Số action, JS đo sau khi tạo dữ liệu bằng 3 tệp e2e
(maker-checker, ops-transactions, permit-order) trên máy chủ mới; script `tools/20261103_do_moc_measure.js` ngoài
repo, sha256 khớp spec.

| Mục | Mốc | Sau | Trần |
|---|---|---|---|
| Số action khi mở màn | 28 đường dẫn | Khớp từng dòng 28/28 | không đổi |
| Cảnh báo hydrate | 0 | 0 | 0 |
| JS gzip `/` | 554,3 KB | 558,3 KB (+4,0) | +5 KB |
| JS gzip `/approvals` | 453,1 KB | 453,3 KB (+0,2) | +5 KB |
| JS gzip `/portfolio` | 455,9 KB | 456,1 KB (+0,2) | +5 KB |
| JS gzip `/trade` | 478,4 KB | 479,0 KB (+0,6) | +5 KB |
| CSS gzip (`.next/static/chunks/*.css`, 1 tệp, gzip mức 9) | 17.766 B | 19.354 B (+1.588 B) | +4 KB |
| `role` trong `main` (status, note, alert) | `/` 1, 0, 0; `/demo-payment` 0, 1, 0; `/wallet-binding` 0, 0, 0; `/transactions` (CONTROLLER) 0, 1, 0 | giống hệt, cả máy chủ mới lẫn sau khi tạo dữ liệu | bằng mốc |

`/` tăng 4,0 KB chủ yếu vì màn giờ nạp `Kpi`, `Card`, `Alert`, `buttonVariants` (trước dùng `KpiCard` nội bộ).
`status` ở `/` là khung tooltip của biểu đồ recharts (`DefaultTooltipContent` có `role="status"`).

**Tương phản sau render** (script ngoài repo `contrast.js`): với mỗi phần tử có chữ trong ô hoặc nền trạng thái, lấy
màu chữ bằng `getComputedStyle`, ẩn chữ, chụp đúng hộp chữ (1440 px, tỉ lệ điểm ảnh 1), trộn alpha của màu chữ lên
từng điểm ảnh nền rồi lấy tỉ lệ XẤU NHẤT. Ô `hl`, `au`, `leaf` đo trên `/` và `/transactions`; ô `gold` chưa màn
nào dùng nên chép ô `leaf` của `/` rồi đổi lớp sang `tile-gold`; 4 nền trạng thái chèn mẫu chữ 13 px và 12 px.
60 vùng chữ, 0 vùng dưới ngưỡng (chữ thường 4,5; số 24 px trở lên 3).

| Nền | Sáng | Tối |
|---|---|---|
| `hl` | 10 vùng; chữ thường thấp nhất 4,97 ("–" dòng TCC, 13 px); số lớn 8,33 | như Sáng (ô `hl` không đổi theo giao diện) |
| `au` | 3 vùng; chữ thường 4,69 (chữ phụ "0 kỳ đã hoàn tất", 13 px); số lớn 5,70 | 3 vùng; 4,69; số lớn 5,21 |
| `leaf` | 6 vùng; 5,76 ("unverified", 12 px); số lớn 13,58 | 6 vùng; 7,33 (nhãn, 13 px); số lớn 12,56 |
| `gold` | 3 vùng; 8,00 ("unverified", 12 px); số lớn 15,79 | 3 vùng; 8,19 (nhãn, 13 px); số lớn 14,53 |
| `ok` | 9,08 | 9,04 |
| `warn` | 7,00 | 9,22 |
| `bad` | 7,92 | 8,41 |
| `info` | 9,09 | 8,79 |

## 4. Ảnh (gửi kèm, không commit)

Trước (mốc) và sau, 1440 và 390 px, Sáng và Tối, đủ 28 đường dẫn của script đo (gồm 5 màn,
`/transactions/[id]`, `/orders/[id]`); ảnh chi tiết lệnh chụp SAU khi chạy `ops-transactions.spec.ts`,
`maker-checker.spec.ts`, `permit-order.spec.ts` (có dữ liệu, 5 bước Xong, nhật ký 2 dòng). Thư mục `moc/`, `sau/`.

## 5. Lệnh kiểm (tasks bước 8)

```text
8a $ git diff --name-only origin/release/ui-v2...HEAD | grep -vE '^(...danh sách trắng...)$'
                                    # rỗng
8b $ rg -n '...màu cứng...' <15 tệp>
                                    # rỗng (lần đầu bắt 2 lớp bg-white/15, bg-white/40 ở vòng biểu tượng Kpi;
                                    #  đã chuyển thành biến --tile-hl-chip, --tile-au-chip trong globals.css)
8c $ comm -13 /tmp/del.txt /tmp/add.txt | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e'
                                    # rỗng
8d $ comm -23 <(ext /tmp/del.txt) <(ext /tmp/add.txt)
VNDB \u00B7 tx $                    # QĐ-8 (in ra ký tự chấm giữa; ở đây viết mã U+00B7): câu thành công demo-payment, chấm giữa thành dấu phẩy
\u00B7 số dư mới $                  # QĐ-8: như trên
\u2014                              # QĐ-8 (gạch dài U+2014): ô trống demo-payment short(), ops-transactions cột Hành động
```

Không có chuỗi tiếng Việt nào khác mất hoặc đổi; các dòng chữ chỉ dời vị trí (vào `Kpi label`, `Alert`,
`EmptyState`, `BlockedNotice children`) đều còn nguyên trong tập dòng thêm. Biểu đồ recharts không cần ngoại lệ màu
(mọi màu là `var(--...)`).

## 6. Đối chiếu notes (`docs/prototypes/20261101_ui_ux_ban_chot/notes/`)

Giữ: làm theo. Đã cũ: notes viết theo dev cũ, QĐ-9 bỏ. Bỏ: không làm, kèm lý do.

**`dashboard.md`**

| Dòng notes | | Ghi chú |
|---|---|---|
| Tiêu đề "Tổng quan điện gió", câu phụ "Cập nhật ..." | Đã cũ | QĐ-9; `h1` "Tổng quan" (QĐ-7) |
| Nút "Phát hành WPT" | Giữ | `Link` lớp nút chính, `href="/mint"`, `prefetch={false}` |
| Ô WPT đã phát hành "3 dự án, 82 tổ máy" (bento lớn) | Giữ bố cục, đã cũ số | Ô lớn trái là "Tổng cung token" `hl lg` (QĐ-4); 4 ô cũ là QĐ-9 |
| Ô Nhà đầu tư whitelisted | Đã cũ | Nay "Nhà đầu tư đã định danh"; test cấm chữ "whitelisted" |
| Ô Sản lượng luỹ kế "Nguồn: EnergyOracle..." nền vàng | Giữ ô, đổi sắc | QĐ-4 chốt `leaf`; phụ đề là `UnverifiedNote` (FIX-05) |
| Ô Lợi tức đã chia "VND, 6 kỳ ..." | Giữ ô | Sắc `au`; số thật VNDB và "N kỳ đã hoàn tất" (FIX-05) |
| Biểu đồ 2 trục gộp | Đã cũ | QĐ-9, QĐ-6: hai biểu đồ riêng |
| Phân bổ WPT theo dự án; 3 thẻ dự án | Bỏ | requirements "Không làm" (test FIX-05 cấm `MOCK_PROJECTS`) |
| Tua-bin quay, số đếm lên, biểu đồ vẽ dần, vòng đo | Bỏ | "Không làm": minh hoạ SVG lớn, chuyển động JS (FE-UX-08) |

**`transactions.md`**

| Dòng notes | | Ghi chú |
|---|---|---|
| Tiêu đề "Giao dịch toàn hệ thống" | Giữ | |
| Câu phụ, "Chain đang xem" | Đã cũ | QĐ-9 |
| Thanh "Trạng thái xem thử" | Đã cũ | QĐ-9 |
| Ghi chú Kiểm soát viên chỉ xem | Giữ | `Alert info role="note"` |
| Ba ô Tổng cung, Chưa phân phối, Đang lưu hành | Giữ | `Kpi` `hl`, `leaf`, `default`, giữ `data-testid` |
| Ô tìm, 5 ô lọc (chỉ `aria-label`) | Giữ | `fieldClass`, lưới tự gập |
| Thông báo can thiệp thành công, lỗi | Giữ | `Alert ok`, `bad`, giữ `role="status"` |
| "Đang tải giao dịch…", lỗi tải, "Không có lệnh nào khớp bộ lọc." | Giữ | `EmptyState` (lỗi dùng `EmptyState bad` theo design mục 3, notes ghi `.alert bad`) |
| Bảng; cả dòng bấm được | Giữ bảng; Bỏ bấm cả dòng | "Không làm": bấm cả dòng bảng |
| Ô Hành động, "–" | Giữ | QĐ-8 gạch ngắn |
| Phân trang | Giữ | |

**`transaction-detail.md`** (cũng là `order-detail.md` phía Nhà đầu tư, QĐ-5)

| Dòng notes | | Ghi chú |
|---|---|---|
| Liên kết "Về danh sách giao dịch" | Giữ | thêm `ArrowLeft` |
| Thanh "Trạng thái xem thử" | Đã cũ | QĐ-9 |
| Tiêu đề "Lệnh mua/bán xxxxxxxx" + nhãn trạng thái | Giữ | `Badge` theo `orderStatusTone` |
| Ô Giá trị, Số lượng, Giá đưa lên thành ô | Bỏ | "Không làm": đưa 3 dòng số lên thành ô |
| Thẻ Thông tin lệnh | Giữ | 5 cột, nhãn trái, giá trị phải |
| Thẻ Tiến trình quyết toán (`.steps`) | Giữ | 7 cột, `data-tone` |
| Quy tắc, Kết cục, 4 bút toán | Giữ | `Card tint`; "Kết cục: ..." trọn một `p` |
| Nhật ký kiểm toán | Giữ | dòng thời gian, 12 cột |
| Rỗng nhật ký | Giữ | giữ đoạn chữ trong thẻ nhật ký (không đổi phần tử) |
| "Đang tải lệnh…", lỗi | Giữ | `EmptyState` (lỗi `bad`) |

**`demo-payment.md`**

| Dòng notes | | Ghi chú |
|---|---|---|
| Tiêu đề | Giữ | |
| Hộp ghi chú hai dòng (notes `.alert.bad`) | Giữ chữ, sắc `info` | design mục 3 chốt `Alert info`, giữ `role="note"` |
| Thẻ "Nạp vào ví", ô Ví đích, gợi ý danh sách, câu ví người bán, ô Số VNDB, gợi ý nhanh, nút Nạp | Giữ | `CardTitleIcon`, 8 cột từ 1100 px, `fieldClass`, nút viền tròn |
| Ô vàng "Tối đa một lần" tách riêng | Đã cũ | QĐ-9: giữ câu trong dòng gợi ý |
| Thông báo thành công, khung lỗi | Giữ | `Alert ok`, `bad`, một `role="status"`; dấu phẩy QĐ-8 |
| Trạng thái xem thử (Đang tải, Đọc lỗi, Nạp lỗi) | Đã cũ thanh, Giữ nhánh | QĐ-9 bỏ thanh; nhánh mã giữ nguyên |
| Lịch sử, "Chưa có lần nạp nào trên chuỗi này." | Giữ | `Badge` theo trạng thái, `EmptyState` |
| Cờ tắt hoặc vai khác | Giữ | `BlockedNotice`, chữ giữ nguyên |

**`wallet-binding.md`**

| Dòng notes | | Ghi chú |
|---|---|---|
| Tiêu đề "Định danh ví" | Giữ | |
| Câu phụ, "Chain đang xem" | Đã cũ | QĐ-9 (test cấm `data-chain` trong tệp) |
| Thẻ "Gắn ví cho hồ sơ", lưới 16rem, ô Hồ sơ, ô Địa chỉ ví, nút | Giữ | `CardTitleIcon`, `fieldClass` |
| Biểu tượng ví trong ô Địa chỉ ví | Bỏ | design mục 3 không có; tránh bọc lại ô nhập |
| Thông báo thành công, lỗi | Giữ | `Alert`, giữ `role`, `aria-label="Kết quả định danh ví"` |
| Thẻ "Ví đã định danh", bảng, câu dưới bảng, "Hiện 200 ví gần nhất" | Giữ | `tr[data-wallet]` giữ |
| Chưa có ví, Đang tải, Lỗi | Giữ | `EmptyState` (lỗi giữ `role="alert"`) |
| Vai khác mở đường dẫn | Giữ | `BlockedNotice` |

## 7. DEVIATION so với spec

- **Ca 3 tách tooltip recharts:** số `role="status"` ở `/` phụ thuộc số biểu đồ đang vẽ (mỗi biểu đồ recharts có một
  khung tooltip `role="status"`). Ở mốc, `/` vẽ một biểu đồ (chưa có kỳ chia hoàn tất); nếu spec chạy trước đã hoàn
  tất kỳ chia thì vẽ thêm biểu đồ cột. Ca 3 kiểm số `status` của tooltip bằng đúng số biểu đồ, và phần ngoài biểu đồ
  bằng mốc (mốc `/` là 1 status = 1 tooltip, nên phần ngoài là 0). Các `role` khác so thẳng với mốc.
- **Ca 1 thêm kiểm vị trí ô:** lần chạy đầu ảnh 1440 px cho thấy lưới một cột: `sm:grid-cols-2` (mốc theo rem) đứng
  sau `min-[1100px]:grid-cols-12` (mốc px) trong CSS Tailwind 4 nên thắng. Đổi sang `min-[640px]:` (cùng đơn vị) và
  thêm phép kiểm vị trí để bắt lỗi này.
- **`EmptyState` có `data-loading`:** thuộc tính dữ liệu (không phải `role`, `aria`) để e2e chờ hết trạng thái tải.

## 8. Câu hỏi mở

- Mốc bước chưa có ở Tiến trình vẫn in gạch dài: chuỗi do `formatDateTime(null)` trong `lib/format.ts` dựng, `lib/`
  nằm ngoài danh sách trắng nên không sửa (QĐ-8 chỉ nêu hai chỗ). Đề xuất đưa vào một task chạm `lib/format.ts`.

## 9. Tự đánh giá 3 luật kiến trúc

- [x] Mọi call chain qua ILedgerPort: không đổi mã gọi chuỗi.
- [x] Mọi ký qua ISigner: không đổi.
- [x] Mọi kiểm quyền qua RBAC: không đổi; 2 trang chặn giữ nguyên biểu thức điều kiện.
