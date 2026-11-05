# Báo cáo bàn giao: FIX-08 thanh bên chỉ sáng đúng một mục; bỏ ký tự cấm ở khung

| | |
|---|---|
| Mã task | FIX-08 |
| Phạm vi | **Frontend thuần, chỉ khung** (`app/src/components/layout`): `sidebar.tsx`, `channel-switcher.tsx`, `chain-selector.tsx`, `active-nav.ts` (mới); `e2e/investor-channel.spec.ts` chỉ bốn regex. Không `lib/`, `app/**`, `components/ui/*`, `nav-config.ts`; không gói npm mới; không đổi danh sách, thứ tự, nhãn, biểu tượng, phím tắt của mục menu, giao diện viên nang, số việc chờ, nhóm thu gọn |
| Nhánh | `fix/fix-08-thanh-ben`, tạo từ `release/ui-v2` @ `763cd51` (sau merge PR #101 FE-UX-06b; đã gồm 06a, 06b). **Merge-base dùng để đo mốc: `763cd51`**. Không có PR nào merge vào `release/ui-v2` trong lúc làm nên không phải rebase |
| Spec | `docs/fix-08-thanh-ben/{requirements,design,tasks}.md` (chép nguyên) |
| Commit | spec `e7f803e`; `activeNavHref` và unit nhóm 1, 2 `e76d770`; thanh bên, chữ khung, bốn regex, unit nhóm 3, e2e `882fe95`; UserGuide, task-status `dc7f11c`; chú thích e2e (mục 4, CSS) `0921351`; tài liệu: các commit cuối trên nhánh |
| Tiến độ | Xong. Một PR, base `release/ui-v2`, chờ Supervisor nghiệm thu; Claude Code **không** merge |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 4) | | Bằng chứng |
|---|---|---|---|
| 1 | `/seller/transactions`, `/seller/withdraw` chỉ mục của màn sáng; `/seller` chỉ "Tổng quan" (ảnh trước và sau) | ✅ | mục 5, 1.2 ca 1 |
| 2 | `activeNavHref` đúng QĐ-1, `sidebar.tsx` dùng đúng QĐ-2; chú thích trên hàm đã sửa | ✅ | mục 2.1, 1.3 nhóm 1, 3 |
| 3 | Mục đang sáng có `aria-current="page"`, mục khác không | ✅ | mục 1.2 ca 1, 2; 1.3 nhóm 3 |
| 4 | So với quy tắc cũ trên mọi trang có thật của bốn vai; danh sách chỗ khác | ✅ | mục 3 |
| 5 | Không còn ký tự cấm trong chữ hiển thị của khung (6e); chữ chỉ đổi đúng QĐ-4 | ✅ | mục 6 (6c, 6d, 6e), 1.2 ca 3 |
| 6 | Test có sẵn chỉ sửa đúng QĐ-5; mốc QĐ-6 giữ | ✅ | mục 6 (6a), 1.1 |
| 7 | Không đổi danh sách menu, viên nang, số việc chờ, nhóm thu gọn; từng đoạn đổi trong `sidebar.tsx` kèm lý do | ✅ | mục 2.1 |
| 8 | Action không đổi ở 28 đường dẫn; JS, CSS trong trần QĐ-7; ba số lỗi 0 | ✅ | mục 4 |
| 9 | Ảnh thanh bên 1440 Sáng, Tối, trước và sau: Người bán ba màn, Giao dịch viên `/transactions` và một chi tiết; ô chọn vai, ô chọn chain | ✅ | mục 5 |
| 10 | 390 px ngăn kéo menu cũng chỉ một mục sáng (ảnh, Người bán `/seller/withdraw`) | ✅ | mục 5, 1.2 ca 1 |
| 11 | `fix-08-thanh-ben.spec.ts` đủ 3 ca, `fix-08.test.ts` đủ 3 nhóm, xanh | ✅ | mục 1.2, 1.3 |
| 12 | Kiểm thử mục 5 đạt, kèm log; "EVM - E2E PROJECT HARDHAT" xanh | ✅ | mục 1.1 |
| 13 | Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 6) đúng kỳ vọng | ✅ | mục 6 |
| 14 | Không mã dư thừa | ✅ | mục 2.3 |

**Kết luận:** 14 ✅, 0 🔶, 0 ❌. Quy tắc cũ sáng hai mục ở đúng hai chỗ: `SELLER /seller/transactions`, `SELLER /seller/withdraw`
(khoá cứng trong unit nhóm 2); mọi chỗ khác của 28 trang, bốn vai, kết quả mới giống hệt cũ. JS gzip mọi trang +84 B (trần
200 B), so chunk: chỉ module thanh bên trong chunk khung dùng chung đổi. CSS __CSS_KET_LUAN__. Action khớp 28/28; `hydration`,
`consoleErrors`, `pageErrors` 0 ở mọi đường dẫn cả mốc lẫn sau. Bốn điểm gây lỗi của Supervisor đều làm unit đỏ (mục 1.3).
Mức rủi ro: thấp (khung dùng chung, nhưng chỉ đổi cách chọn mục sáng và chữ; menu, điều hướng, quyền không đổi).

UserGuide: "Chốt tại"; Phần 3 mục 3.0 thanh bên: chỉ một mục sáng (khớp dài nhất, `aria-current`), nhãn ô chọn vai
"{vai} ({mã})", chain chưa dùng được ": chưa dùng được". task-status: FIX-08 `done`. `docs/tech-report.md` không đổi (không
marker nào dời dòng: các tệp sửa không có `@pending`, `@blocked`, `@flow`).

### 0.2 Việc cần Owner quyết

- Không có.

---

## 1. Kiểm thử (requirements mục 5, phần dev)

### 1.1 Lệnh và kết quả

__DIEN_1_1__

Ngoài bộ trên, trên bản build `882fe95` (máy chủ mới cổng 3600): `fix-08-thanh-ben` (project mock) 3 ca đạt; rồi
`fix-08-thanh-ben`, `investor-channel`, `fe-ux-01b-khung`, `uiux-02-dau-man`, `chain-selector` (project mock) 40 ca đạt;
`fix-08`, `four-roles-shell`, `four-roles-routes`, `uiux-02-dau-man`, `hf-01-hieu-nang` (unit) 75 ca đạt.

### 1.2 e2e mới `app/e2e/fix-08-thanh-ben.spec.ts` (chỉ project mock; không đổi dữ liệu)

Mục sáng đếm bằng `aside nav a[aria-current="page"]`. Trên mã mốc `763cd51` không có `aria-current` nên cả ba ca chỉ
chạy được trên bản mới; số mục sáng trên bản mốc đọc bằng lớp `bg-primary` của script chụp ảnh (mục 5).

| Ca | Kiểm |
|---|---|
| 1 | Người bán 1440 px: `/seller` đúng 1 mục sáng, `[data-nav-label]` "Tổng quan"; `/seller/transactions` đúng 1, "Danh sách giao dịch"; `/seller/withdraw` đúng 1, "Tạo lệnh rút"; ở cả ba màn mọi liên kết có lớp `bg-primary` khi và chỉ khi có `aria-current="page"` (so tên lớp bằng `classList`). 390 px `/seller/withdraw`: bấm "Mở menu", trong ngăn kéo đúng 1 mục sáng "Tạo lệnh rút" |
| 2 | Giao dịch viên: `/` đúng 1 mục sáng `href="/"` (mục đầu menu); `/transactions` đúng 1 `href="/transactions"`; `/transactions/khong-co` đúng 1 `href="/transactions"`. Nhà đầu tư `/tokens/WPT`: menu có mục, 0 mục sáng |
| 3 | Ô chọn vai đúng 4 lựa chọn "Nhà đầu tư (NDT001)", "Người bán (NB001)", "Giao dịch viên (GDV001)", "Kiểm soát viên (KSV001)"; không lựa chọn nào của ô chọn vai, ô chọn chain có U+00B7, U+2014; `option[value="stellar"]` `disabled`, chữ kết thúc ": chưa dùng được". Lớp câu lỗi ô chọn chain khoá ở unit nhóm 3 |

### 1.3 Unit test mới `app/test/fix-08.test.ts` (môi trường `node`, 19 ca)

| Nhóm | Kiểm |
|---|---|
| 1 `activeNavHref` | Bảng design mục 1 (menu Người bán, bốn đường dẫn); `["/wallet", "/wallet-binding"]`: `/wallet-binding`, `/wallet/x` ra `/wallet`, `/walletx` ra `null`; `/` chỉ khớp `/`, `/draft` không ra `/`, `/transactions/abc` ra `/transactions`; danh sách rỗng ra `null`; `/tokens/WPT` với menu Nhà đầu tư ra `null`; `/a`, `/a/b`, `/a/b/c` với `/a/b/c/d` ra `/a/b/c`, đảo thứ tự vẫn vậy |
| 2 So với quy tắc cũ | 28 đường dẫn từ mọi `page.tsx` dưới `app/src/app` (`[id]` thành `id`); mỗi vai lấy `withHiddenOps(NAV_BY_ROLE[role], { demoPayment: true, walletBinding: true })`; mỗi vai: menu không có hai mục cùng `href`; mỗi đường dẫn: mới sáng nhiều nhất 1 mục, cũ 0 hoặc 1 thì mới giống hệt, cũ từ 2 thì mới là mục dài nhất; danh sách chỗ cũ sáng từ 2 khoá bằng `toEqual(['SELLER /seller/transactions', 'SELLER /seller/withdraw'])` |
| 3 Mã nguồn | `sidebar.tsx`: `activeNavHref(` đúng 1 lần, nguyên văn `!item.disabled && item.href === activeHref`, `aria-current={active ? "page" : undefined}` đúng 1 lần, không còn `pathname.startsWith(item.href`; ba tệp khung không U+00B7, U+2014 ngoài dòng chú thích; `channel-switcher.tsx` có `({SAMPLE_ACCOUNTS[channel]})`; `chain-selector.tsx` không còn `destructive` |

Danh sách nhóm 2 lấy đúng cách tasks bước 3: lần chạy đầu để `toEqual([])`, test đỏ và in

```text
- []
+ [
+   "SELLER /seller/transactions",
+   "SELLER /seller/withdraw",
+ ]
```

rồi chép cứng vào test (không để `console` trong test).

Tự gây lỗi (4 điểm của Supervisor, trên bản sao làm việc, hoàn lại bằng `git checkout`):

| Điểm | Ca đỏ |
|---|---|
| Trả `href` khớp NGẮN nhất (`href.length < best.length`) | 4 (nhóm 1 ba ca, nhóm 2 so với quy tắc cũ) |
| So `pathname.startsWith(href)` không thêm `/` | 1 (nhóm 1 tiền tố) |
| Bỏ `aria-current` | 1 (nhóm 3 `sidebar.tsx`); e2e ca 1, 2 cũng đỏ vì đếm theo `aria-current` |
| Bỏ `!item.disabled &&` khỏi `isActive` | 1 (nhóm 3 `sidebar.tsx`, phép đọc mã nguồn; hiện chưa có mục `disabled`) |

## 2. Thay đổi

### 2.1 Từng đoạn đổi trong `sidebar.tsx` (QĐ-2, QĐ-3, QĐ-4)

| Đoạn | Đổi | Vì sao an toàn |
|---|---|---|
| Nhập | Thêm `import { activeNavHref } from "./active-nav"` | Hàm thuần, không phụ thuộc React, cookie |
| `isActive` (cũ `:124-132`) | Chú thích viết lại; tính một lần `activeHref = activeNavHref(nav.groups.flatMap((group) => group.items.filter((item) => !item.disabled).map((item) => item.href)), pathname)`; `isActive = (item) => !item.disabled && item.href === activeHref` | Cùng quy tắc khớp cũ (QĐ-1), chỉ thêm bước chọn dài nhất. `nav` là menu đang hiển thị, đã gồm nhóm ẩn (`AppLayout` truyền `withHiddenOps`). Chữ ký `isActive(item)` giữ nên `CollapsibleGroup` (`containsActive = group.items.some(isActive)`) và hai chỗ `active={isActive(item)}` không đổi; nhóm ẩn vẫn tự mở khi chứa mục sáng. Menu không có hai mục cùng `href` (unit nhóm 2) nên so `href` không thể làm hai mục sáng |
| `NavLink` nhánh `Link` | Thêm `aria-current={active ? "page" : undefined}` | Thuộc tính mới duy nhất; lớp viên nang giữ nguyên; nhánh `disabled` (thẻ `div`) không có |
| `NavLink` nhánh `disabled` | `title` "Sắp có: chưa mở trong phiên bản này" | Chỉ chữ (QĐ-4) |

Không đổi: `useState`, `useEffect` số việc chờ (`needsFetch`, `getPendingWorkAction`), `activePendingWork`, `firstHref`, ngăn kéo,
thu gọn, tiêu điểm, Esc, `CollapsibleGroup`, phần còn lại của `NavLink` (số việc chờ, biểu tượng, ô phím tắt, `HoverHint`,
`prefetch={false}`, `onClick`).

### 2.2 Chữ khung (QĐ-4) và test có sẵn (QĐ-5)

| Tệp | Cũ | Mới |
|---|---|---|
| `channel-switcher.tsx` lựa chọn | `{LABELS[channel]} <chấm giữa> {SAMPLE_ACCOUNTS[channel]}` | `{LABELS[channel]} ({SAMPLE_ACCOUNTS[channel]})` |
| `channel-switcher.tsx` `title` nhãn Vai trò | "Chọn vai trò đang giả lập <gạch dài> chỉ dùng để demo, …" | "Chọn vai trò đang giả lập: chỉ dùng để demo, không phải xác thực thật" |
| `chain-selector.tsx` hậu tố | " <gạch dài> chưa dùng được" | ": chưa dùng được" |
| `chain-selector.tsx` câu lỗi | `text-destructive` | `text-bad-ink` (chữ giữ) |
| `sidebar.tsx` `title` mục chưa mở | "Sắp có <gạch dài> chưa mở trong phiên bản này" | "Sắp có: chưa mở trong phiên bản này" |
| `e2e/investor-channel.spec.ts:98-101` | `/Nhà đầu tư <chấm giữa> NDT001/` (bốn dòng) | `/Nhà đầu tư \(NDT001\)/`, `/Người bán \(NB001\)/`, `/Giao dịch viên \(GDV001\)/`, `/Kiểm soát viên \(KSV001\)/` |

("<chấm giữa>", "<gạch dài>" thay cho U+00B7, U+2014.) Mốc QĐ-6 (`four-roles-shell`, `four-roles-routes`, `fe-ux-01b-khung`,
`investor-channel` phần còn lại, `uiux-02-dau-man` unit `:275` và e2e `:178-204`, `hf-01-hieu-nang`, `chain-selector`) đạt.

### 2.3 Mã dư thừa

Biểu thức so tiền tố tại chỗ trong `sidebar.tsx` đã bỏ (nay ở `active-nav.ts`); không còn hàm, hằng, import thừa. Lint,
typecheck đạt.

## 3. So với quy tắc cũ trên mọi trang có thật (design mục 2 nhóm 2)

28 đường dẫn (mọi `page.tsx` dưới `app/src/app`, đoạn động thay bằng chữ), bốn vai, menu gồm nhóm ẩn (Nạp VNDB, Định danh ví).
Chỗ quy tắc cũ sáng từ 2 mục (và kết quả mới):

| Vai, đường dẫn | Cũ sáng | Mới sáng |
|---|---|---|
| `SELLER /seller/transactions` | `/seller`, `/seller/transactions` | `/seller/transactions` |
| `SELLER /seller/withdraw` | `/seller`, `/seller/withdraw` | `/seller/withdraw` |

Mọi cặp (vai, đường dẫn) khác: cũ sáng 0 hoặc 1 mục và mới giống hệt (unit nhóm 2, 112 cặp). Ảnh mốc khớp: script chụp đếm mục
có lớp `bg-primary` trên bản mốc ra hai mục ở đúng hai màn trên (cả 1440 px và ngăn kéo 390 px), một mục ở các màn khác.

## 4. Đo trước và sau

Cùng máy, cùng quy trình (script ngoài repo): máy chủ mới cổng 3300 (đủ `webServer.env`), tạo dữ liệu bằng
`E2E_BASE_URL=… npx playwright test e2e/ops-transactions.spec.ts` (2 ca đạt cả hai lượt); đo bằng
`tools/20261104_do_moc_measure.js` (sha256 `6079a0d6…` khớp spec) với
`JS_PAGES=/,/portfolio,/trade,/approvals,/seller,/seller/withdraw`; 28 dòng mỗi lượt, không dòng `khong tim thay lien ket`.
Tiến trình đo khác tiến trình chụp ảnh. JS theo byte: script riêng cộng gzip mọi script khi mở trang, máy chủ mới cổng 3500.

| Mục | Mốc `763cd51` | Sau `882fe95` | Trần |
|---|---|---|---|
| Số action khi mở màn | 28 đường dẫn | Khớp 28/28 | không đổi |
| `hydration`, `consoleErrors`, `pageErrors` | 0 ở cả 28 đường dẫn | 0 ở cả 28 đường dẫn | 0 |
| JS gzip (công cụ) `/`; `/portfolio`; `/trade`; `/approvals`; `/seller`; `/seller/withdraw` | 558,3; 456,8; 480,0; 455,2; 457,1; 467,5 KB | 558,3; 456,9; 480,1; 455,3; 457,1; 467,6 KB | +200 B |
| CSS gzip (`.next/static/chunks/*.css`, 1 tệp, gzip mức 9) | 19.237 B | __CSS_SAU__ | không tăng |

JS gzip theo byte (mốc lượt đầu; mốc build riêng build lại `763cd51` sau bản cuối, cùng phiên, `NEXT_DIST_DIR=.next-moc`, gỡ
tạm `active-nav.ts`, đã xoá thư mục; sau; chênh so mốc lượt đầu):

| Trang | Mốc | Mốc build riêng | Sau | Chênh |
|---|---|---|---|---|
| `/portfolio` | 467806 | 467804 | 467890 | +84 |
| `/tokens/WPT` | 463032 | 463030 | 463116 | +84 |
| `/trade` | 491499 | 491496 | 491583 | +84 |
| `/orders` | 549414 | 549413 | 549498 | +84 |
| `/orders/[id]` | 463361 | 463360 | 463445 | +84 |
| `/withdraw` | 485740 | 485739 | 485824 | +84 |
| `/` | 571659 | 571656 | 571743 | +84 |
| `/approvals` | 466121 | 466114 | 466205 | +84 |
| `/distribution` | 479610 | 479608 | 479694 | +84 |
| `/vault` | 469574 | 469574 | 469658 | +84 |
| `/wallet` | 466941 | 466939 | 467025 | +84 |
| `/seller` | 468034 | 468032 | 468118 | +84 |
| `/seller/transactions` | 549636 | 549634 | 549720 | +84 |
| `/seller/withdraw` | 478763 | 478767 | 478847 | +84 |
| `/account` | 457856 | 457854 | 457940 | +84 |
| `/assets` | 487512 | 487510 | 487596 | +84 |
| `/kyc` | 462493 | 462491 | 462577 | +84 |
| `/reconciliation` | 463509 | 463507 | 463593 | +84 |
| `/mint` | 465064 | – | 465148 | +84 |
| `/audit` | 456568 | – | 456652 | +84 |
| `/draft` | 470840 | 470836 | 470924 | +84 |
| `/approvals/[id]` | 466461 | 466456 | 466545 | +84 |

Mọi trang +84 B: so từng tệp script (mốc build riêng và bản cuối, 5 trang `/`, `/portfolio`, `/seller`, `/seller/withdraw`,
`/approvals`): mỗi trang cùng số tệp; chỉ chunk khung dùng chung đổi (178.700 thành 178.891 B thô, +191), chunk trang
`/approvals` khác 3 B do số hiệu module. Trong chunk khung chỉ module thanh bên đổi (18.297 thành 18.495 B thô): thân
`activeNavHref` thay biểu thức cũ, `aria-current`, chữ QĐ-4, `text-bad-ink`, đổi tên biến rút gọn; các chuỗi mã server action
trong module khác nhau giữa hai bản build (mã do build sinh), không phải mã mới.

CSS: bản build `882fe95` cho 19.241 B (+4 B). So chuỗi CSS với bản mốc: thêm đúng một bộ chọn `.bg-primary-foreground`, do
Tailwind quét cả tệp e2e và chú thích của `fix-08-thanh-ben.spec.ts` có ghi tên lớp đó. `0921351` viết lại chú thích (không đổi
phép kiểm); CSS bản build cuối ở trên. Bản mốc build riêng cho 19.289 B vì build lúc thư mục build phụ nằm trong `app/` (thêm
4 lớp `capitalize`, `contents`, `italic`, `static`), như 06a, 06b; không dùng số đó.

## 5. Ảnh (gửi kèm, không commit)

Mỗi lượt một tiến trình mock MỚI cổng 3400 (`npx next start` với đủ biến `webServer.env`), tạo dữ liệu bằng `ops-transactions`
rồi chụp; script chụp ngoài repo. Mốc (bản build `763cd51`): bật 17:30:02Z, tắt 17:30:50Z. Sau (bản build `882fe95`): bật
17:44:46Z, tắt 17:45:34Z (05/11/2026, UTC). 0 lỗi console cả hai lượt.

| Ảnh (Sáng, Tối) | Mốc: mục sáng (lớp `bg-primary`) | Sau: mục sáng, số `aria-current` |
|---|---|---|
| Người bán `/seller` 1440 | Tổng quan | Tổng quan; 1 |
| Người bán `/seller/transactions` 1440 | **Tổng quan, Danh sách giao dịch** | Danh sách giao dịch; 1 |
| Người bán `/seller/withdraw` 1440 | **Tổng quan, Tạo lệnh rút** | Tạo lệnh rút; 1 |
| Giao dịch viên `/transactions` 1440 | Giao dịch | Giao dịch; 1 |
| Giao dịch viên `/transactions/<mã>` 1440 (giao dịch đầu danh sách sau khi tạo dữ liệu) | Giao dịch | Giao dịch; 1 |
| Người bán `/seller/withdraw` 390, ngăn kéo mở | **Tổng quan, Tạo lệnh rút** | Tạo lệnh rút; 1 |

Ô chọn vai, ô chọn chain (ô `select` gốc không chụp được ở trạng thái mở: ảnh thanh bên `g_o_chon_vai_chain_light_1440` và chữ
các lựa chọn trong `notes.json`):

| | Mốc | Sau |
|---|---|---|
| Ô chọn vai | "Nhà đầu tư <chấm giữa> NDT001", … | "Nhà đầu tư (NDT001)", "Người bán (NB001)", "Giao dịch viên (GDV001)", "Kiểm soát viên (KSV001)" |
| `title` nhãn Vai trò | "Chọn vai trò đang giả lập <gạch dài> chỉ dùng …" | "Chọn vai trò đang giả lập: chỉ dùng để demo, không phải xác thực thật" |
| Ô chọn chain | "EVM Testnet (Sepolia) <gạch dài> chưa dùng được", "Stellar (Soroban) <gạch dài> chưa dùng được" (khoá) | "EVM Testnet (Sepolia): chưa dùng được", "Stellar (Soroban): chưa dùng được" (khoá); Mock, Hardhat Local chọn được |

28 đường dẫn của script đo, trước (`moc/do/`) và sau (`sau/do/`), 1440 và 390, Sáng và Tối.

## 6. Lệnh kiểm (tasks bước 6, `LC_ALL=C`)

```text
__LENH_KIEM__
```

("<chấm giữa>", "<gạch dài>" thay cho U+00B7, U+2014 lệnh in ra.) 6a: hai lệnh đầu rỗng; `investor-channel.spec.ts` đúng 1
hunk, 4 dòng xoá, 4 dòng thêm, cả tám dòng là bốn regex chữ vai của QĐ-5. 6b, 6c, 6e rỗng. 6d đúng 7 dòng: bốn regex cũ của
QĐ-5, `title` nhãn Vai trò, `title` mục chưa mở, hậu tố chain (mảnh " <gạch dài> chưa dùng được"); nhãn lựa chọn vai không
hiện vì mảnh cũ " <chấm giữa> " không có chữ có dấu (unit nhóm 3, e2e ca 3 khoá).

## 7. Nợ và DEVIATION

- Không có DEVIATION.
- `header.tsx` (ngoài phạm vi, ngoài lệnh 6e theo QĐ-4): ký tự cấm duy nhất nằm trong khối chú thích JSX (`:72`), không phải chữ hiển thị; không sửa.
- Câu lỗi ô chọn chain chỉ hiện khi chain đang chọn có `disabledReason`; e2e không dựng được trên mock, khoá bằng unit nhóm 3.

## 8. Tự đánh giá 3 luật kiến trúc

- [x] Mọi call chain qua ILedgerPort: không đổi mã gọi chuỗi.
- [x] Mọi ký qua ISigner: không đổi.
- [x] Mọi kiểm quyền qua RBAC: không đổi (menu, guard giữ nguyên).
