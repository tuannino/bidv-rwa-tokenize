# FE-UX-06a: ba màn dữ liệu mẫu (`/assets`, `/kyc`, `/reconciliation`)

| | |
|---|---|
| Nhánh | `feat/fe-ux-06a-man-mau` từ `release/ui-v2` mới nhất (@ `d035407` hoặc sau: đã gồm FE-UX-05b). Nếu PR khác (05c) merge vào `release/ui-v2` trong lúc làm: rebase lên head mới, chạy lại TOÀN BỘ kiểm thử mục 5 trên nhánh đã rebase và đo lại TOÀN BỘ mốc (JS, CSS, action, lỗi, `role`, ảnh trước) từ merge-base mới; checkpoint ghi merge-base đã dùng và log của lần chạy sau rebase |
| PR | Một PR, **base `release/ui-v2`**, KHÔNG vào `dev`. Không tự merge |
| Loại | Frontend thuần. Không `lib/` (gồm `lib/mock-data.ts`), `app/actions`, `app/api`, route `app/src/app/**`; không thêm gói npm; không sửa `components/ui/*`, `components/layout/*` (gồm `hover-hint.tsx`) (thiếu gì thì báo) |
| Mức kiểm thử | **B**, phạm vi ở mục 5 |
| Tách task | FE-UX-06 (màn ngoài menu chính) tách 2 phần: **06a** ba màn đang hiển thị toàn dữ liệu mẫu (spec này); **06b** `/mint`, `/audit` (trang máy chủ trong `app/`), `TokenInfoBlock` cắt chữ, nhánh lỗi còn `text-destructive` ở các tệp route (gồm `/account`) |
| Song song | Song song được với FE-UX-05c (khác tệp mã). Các PR cùng sửa `docs/USER_GUIDE.md`, `.kiro/task-status.json`: PR merge sau tự gộp, mỗi mã ở đúng một danh sách. Tệp tạm của lệnh kiểm dùng tên riêng (tasks bước 6) |
| Nguồn | Kế hoạch 03/11 (FE-UX-06: "chỉ áp hệ thiết kế", không có bản chốt riêng cho ba màn); quyết định Sếp 02/11 (`20261102_man_du_lieu_mau.md` mục 6, điểm 3 và 4); thành phần dùng chung FE-UX-02a đến 05a |
| Thứ tự ưu tiên khi nguồn xung đột | Spec này, rồi quyết định Sếp 02/11, rồi kế hoạch 03/11, rồi mã `release/ui-v2` @ merge-base, rồi `docs/USER_GUIDE.md` |

## 1. Mục tiêu

Ba màn chưa có nguồn dữ liệu thật (hiện số mẫu `MOCK_*` hoặc bảng rỗng, có ghi chú "(đang hiển thị dữ liệu mẫu)") được vẽ lại bằng hệ thiết kế của đợt (`Kpi`, `Card`, `Table`, `EmptyState`, `Button`, `Badge` nếu cần), thống nhất với các màn đã làm. Đồng thời làm hai việc Sếp đã chốt 02/11 cho đúng ba màn này: khoá nút không làm gì kèm chú thích (QĐ-5), bỏ ký tự cấm trong chữ hiển thị (QĐ-6). Không đổi số liệu mẫu, nguồn dữ liệu, bộ lọc và cách lọc, cột, thứ tự, ghi chú dữ liệu mẫu, số action khi mở màn (0).

Không làm: nối dữ liệu thật (task riêng sau đợt giao diện, chờ Sếp quyết phạm vi); câu phụ dưới tiêu đề (test cấm: `uiux-02-dau-man.test.ts:196`, `:204`, `:209`); thêm ghi chú `unverified` từng khối (cả màn đã có ghi chú dữ liệu mẫu của FIX-05, test khoá); bảng thành thẻ ở màn nhỏ (giữ bảng cuộn ngang); hiệu ứng (FE-UX-08).

## 2. Quyết định (QĐ)

- **QĐ-1. Không đổi logic.** Giữ nguyên trong ba trang: mọi `useState` và bộ lọc (`regionFilter`, `statusFilter`, `filtered` ở `/assets`; `search`, `level`, `status` ở `/kyc`; `projectFilter`, `periods` ở `/reconciliation`), các bảng nhãn (`REGION_CHART_VAR`, `STATUS_DOT`, `LEVEL_LABELS`, `STATUS_LABELS`, `SOURCES`), `nf`, `TxLink` (cách chọn liên kết hay chữ theo `explorerTxUrl`, `title`, `target`, `rel`), nội dung menu "Thêm dự án" (trừ chữ `REGION_HINTS` đổi theo QĐ-6), điều kiện hiện rỗng, dòng đếm kết quả và dòng "Hiển thị …". Ba trang vẫn là `'use client'`, không gọi server action, không `useEffect`. Diff chỉ là vỏ JSX, `className`, thay khối tự viết bằng thành phần dùng chung có cùng chữ, việc dời ở QĐ-2 và các việc QĐ-5, QĐ-6.
- **QĐ-2. Gộp `FilterBtn` (commit riêng, dời NGUYÊN VĂN).** Ba bản `FilterBtn` ở `assets.tsx:339-363`, `kyc.tsx:190-214`, `reconciliation.tsx:199-223` (mỗi bản từ `function FilterBtn` tới hết tệp) giống hệt nhau (dev xác nhận bằng so tệp, ghi checkpoint). Dời một bản sang tệp mới `components/ops/filter-button.tsx`, chỉ thêm `export` và import `cn`; xoá ba bản cũ, ba trang nhập `FilterBtn` từ tệp mới. Commit sau mới đổi kiểu (QĐ-4). Checkpoint dán đoạn trước và sau.
- **QĐ-3. Thay khối tự viết bằng thành phần dùng chung:**
  - Đầu màn: giữ `HoverHint` bọc `h1` đúng như hiện tại (`uiux-02-dau-man.test.ts:273` khoá chuỗi `<HoverHint hint="…" side="bottom">` liền trước `<h1`), `h1` đổi lớp sang `text-2xl font-semibold tracking-tight`; `<SampleDataNote />` giữ, đặt NGOÀI `h1`, cùng hàng (`fix-05-tong-quan.test.ts:212-217`). Hàng đầu `flex flex-wrap items-start justify-between gap-4`: trái là tiêu đề và ghi chú, phải là nút và chú thích của QĐ-5.
  - Ô số liệu: `StatCard` (`assets.tsx:305-337`), `KpiCard` (`kyc.tsx:156-188`, `reconciliation.tsx:172-197`) XOÁ, thay bằng `Kpi` (`components/ui/kpi.tsx`) cùng `label`, cùng `sub`, cùng giá trị; giá trị có đơn vị đứng sau số (" MW", " MWh") tách thành `value` (số) và `unit` (đơn vị, không còn khoảng trắng đầu). Biểu tượng của `StatCard` chuyển sang prop `icon` của `Kpi`. Sắc: `/assets` theo thứ tự Dự án điện gió `default`, Tổng công suất đặt `default`, WPT đã phát hành `hl` (thay `accent`), Sản lượng luỹ kế `leaf` (cùng sắc ô sản lượng ở màn Tổng quan); `/kyc` Tổng nhà đầu tư `hl`, Đã whitelist `default`, Chờ duyệt KYC `gold` (thay `warn`), Đang đóng băng `default` (bỏ viền và chữ đỏ của `danger`: số là mẫu 0, ô đỏ gây hiểu nhầm là đang có ví bị đóng băng); `/reconciliation` Kỳ đã đối soát khớp `hl`, Sản lượng đã đối soát `default`, Kỳ lệch chờ xử lý `tone={MOCK_WIND_STATS.pendingReconciliations > 0 ? 'gold' : 'default'}` (giữ đúng điều kiện `warn` cũ; số mẫu là hằng 0 nên nhánh `gold` không chạy được, khoá bằng đọc mã nguồn, unit nhóm 1). `Kpi` giữ hiệu ứng `lift` như các màn đã làm.
  - Khung danh sách `div.rounded-lg.border.bg-card` thành `Card className="gap-0 py-0"` (bỏ khe và đệm mặc định để đường kẻ sát mép); con trực tiếp theo thứ tự: thanh lọc `border-b border-border px-4 py-3` (ở `/kyc` khối tìm và lọc `space-y-3 border-b border-border p-4`), bảng, `EmptyState` (nếu hiện) bọc `div className="p-4"`, dòng cuối `border-t border-border px-4 py-2.5 text-xs text-muted-foreground`. Mỗi nhóm lọc (Vùng, Trạng thái, Cấp KYC, Dự án) là `flex flex-wrap items-center gap-2` (hiện thiếu `flex-wrap`: ở 390 px viên nang bị bóp); danh sách dạng lưới `div` (`GRID` và các `grid-cols-[…]`) thành `Table` (`components/ui/table.tsx`) cùng cột, cùng thứ tự, cùng chữ tiêu đề, cùng canh phải; `GRID` xoá. `/assets`: `ProjectRow` thành một `TableRow` với các `TableCell` giữ nguyên nội dung từng ô; mọi ô `align-top` (giữ canh đỉnh như cũ); riêng ô Mã & Tên dự án thêm `whitespace-normal min-w-56` (tên và địa điểm được xuống dòng), các ô khác giữ `whitespace-nowrap` mặc định, bảng rộng hơn khung thì cuộn trong `[data-slot="table-container"]`. Khi lọc không ra dự án: vẫn hiện `Table` (đầu bảng, `tbody` rỗng) rồi `EmptyState` ngay dưới, giống `/kyc`, `/reconciliation`. `/kyc`, `/reconciliation`: bảng chỉ có `TableHeader` (không thêm dòng giả), trạng thái rỗng ngay dưới bảng.
  - Trạng thái rỗng (ba chỗ: `/assets` khi lọc không ra dự án, `/kyc`, `/reconciliation`) thành `EmptyState` giữ biểu tượng (`Wind`, `UserCheck`, `Scale`, truyền qua prop `icon`, BỎ lớp cỡ và màu cũ trên biểu tượng để `EmptyState` tự tô) và giữ nguyên các câu, câu phụ chữ nhỏ trong cùng `EmptyState`. Ở `/kyc` giữ `<span className="font-code">/mint</span>` và KHÔNG thêm phần tử `font-code` nào đứng trước nó trong `main` (`fe-ux-01a-nen.spec.ts:77-79` đòi phần tử `.font-code` đầu tiên trong `main` có chữ "/mint").
  - Ô tìm kiếm `/kyc`: lớp `fieldClass` (`components/ui/field`) cộng `pl-10`, biểu tượng `Search` `absolute left-3.5`, giữ `label` `sr-only`, `id`, `placeholder`, `value`, `onChange`. Hai nút phân trang đang khoá thành `Button variant="outline" size="sm" disabled`, giữ chữ.
  - `/reconciliation` ba thẻ nguồn (`SourceCard`): `Card` (giữ hàm, đổi vỏ), biểu tượng đặt trong `CardTitleIcon` (vòng tròn có sẵn, `aria-hidden`), chỗ gọi BỎ lớp `text-muted-foreground` trên biểu tượng (`reconciliation.tsx:64`) để vòng tự tô màu; giữ ba dòng chữ và biểu tượng `Clock`.
  - Lưới: ô số liệu `/assets`, `/kyc` `grid gap-4 min-[640px]:grid-cols-2 min-[1100px]:grid-cols-4`; `/reconciliation` thẻ nguồn và ô số liệu mỗi nhóm `grid gap-4 min-[640px]:grid-cols-3`. Thay mọi `sm:`, `md:`, `xl:` của lưới bằng mốc px như trên. Mọi `col-span` (nếu có) kèm tiền tố mốc.
- **QĐ-4. `FilterBtn` đổi kiểu (trong tệp mới, sau commit dời):** giữ `type="button"`, `onClick`, `aria-pressed={active}`, chữ; lớp viên nang `rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors`, chọn `bg-primary text-primary-foreground`, chưa chọn `bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground`, có `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring` (bộ lọc dùng bàn phím được).
- **QĐ-5. Nút không làm gì: khoá kèm chú thích (Sếp chốt 02/11 điểm 4).** Bốn điều khiển hiện không có hành động: nút "Làm mới" (`assets.tsx:75`), nút mở menu "Thêm dự án" (`assets.tsx:79`), nút "Làm mới" (`kyc.tsx:50-56`), nút "Làm mới dữ liệu" (`reconciliation.tsx:51-54`). Mỗi màn:
  - Nút thành `Button` có `disabled` (nút chỉ biểu tượng `variant="ghost" size="icon"` giữ `title="Làm mới"` và thêm `aria-label="Làm mới"`; nút "Làm mới dữ liệu" giữ chữ, `variant="outline"`); nút mở menu "Thêm dự án" giữ `DropdownMenuTrigger` (lớp `buttonVariants()`) với `disabled`, menu và nội dung giữ nguyên (không mở được khi khoá). Nếu `DropdownMenuTrigger` không nhận `disabled` thì DỪNG và báo, không tự sửa `components/ui`.
  - Một chú thích chữ nhỏ đứng SAU nhóm nút, đúng chữ "Chưa hỗ trợ trong PoC" (`span` `text-xs text-muted-foreground`, `id` lần lượt `assets-poc-note`, `kyc-poc-note`, `reconciliation-poc-note`), mỗi nút khoá có `aria-describedby` trỏ tới `id` đó. Đây là câu chữ mới duy nhất của task.
- **QĐ-6. Chữ được đổi (chỉ để bỏ ký tự cấm):** `REGION_HINTS` (`assets.tsx:203-207`) thay chấm giữa (U+00B7) bằng dấu phẩy và gạch dài (U+2014) bằng dấu hai chấm: "Gia Lai, Quảng Trị, Đắk Lắk: gió mùa ổn định", "Ninh Thuận, Bình Thuận: hệ số công suất cao", "Bạc Liêu, Trà Vinh: móng trụ trong bãi bồi"; dòng công suất trong bảng (`assets.tsx:247`) "CF {x}%, {y} đ/kWh" (chấm giữa thành dấu phẩy). Không đổi chữ nào khác (trừ QĐ-5).
- **QĐ-7. Mốc test phải giữ** (không sửa `app/test/**`, e2e có sẵn):
  - `fix-05-tong-quan.spec.ts:49-61` (ba màn: 0 action khi mở theo cách đếm của tệp đó, `h1` đúng chữ "Dự án điện gió đã token hoá", "Nhà đầu tư & KYC", "Đối soát doanh thu điện", chữ "(đang hiển thị dữ liệu mẫu)" hiện); `fix-05-tong-quan.test.ts:212-217`.
  - `uiux-02-dau-man.test.ts:196`, `:204`, `:209` (không câu phụ cũ), `:223-225`, `:273` (gợi ý trên tiêu đề); `uiux-02-dau-man.spec.ts:154`, `:162`, `:167`, `:226-233` (đúng một `h1` trong `main`).
  - `fe-ux-01a-nen.spec.ts:75-80` (`/kyc`: `.font-code` đầu tiên trong `main` chữ "/mint", phông Condensed).
  - `four-roles-*.test.ts` (ba đường dẫn trong menu theo vai, không đổi).
- **QĐ-8. Hiệu năng:** JS gzip mỗi trang `/assets`, `/kyc`, `/reconciliation` không tăng quá 3 KB (theo byte so bản build mốc riêng); các trang đo khác không tăng (lệch do thứ tự module dưới 100 B gzip mà không thêm mã thì ghi giải thích, như 05a); CSS gzip không tăng quá 2 KB. `metrics.json` của ba màn ba số lỗi bằng 0; đường dẫn khác không tăng so với mốc.

## 3. Phạm vi tệp (danh sách trắng)

| Được sửa | Ghi chú |
|---|---|
| `app/src/components/pages/assets.tsx`, `kyc.tsx`, `reconciliation.tsx` | QĐ-1 đến QĐ-6 |
| `app/src/components/ops/filter-button.tsx` (mới) | QĐ-2, QĐ-4 |
| `app/e2e/fe-ux-06a-man-mau.spec.ts`, `app/test/fe-ux-06a.test.ts` (mới) | Design mục 3 |
| `docs/tech-report.md` | CHỈ khi số dòng marker dời, chỉ đổi khối tự sinh bằng `node scripts/scan-pending.mjs --write-report` |
| `docs/fe-ux-06a-man-mau/{requirements,design,tasks}.md`, `docs/CHECKPOINT_FEUX06A.md` (và `_DETAIL.md` nếu quá 800 dòng), `docs/USER_GUIDE.md`, `.kiro/task-status.json` | Theo quy ước repo |

Cấm mọi tệp khác (xem dòng Loại), gồm `globals.css`, `app/src/app/**`, `lib/**`, `app/test/**` có sẵn, e2e có sẵn, `package*.json`.

## 4. Điều kiện hoàn thành

- [ ] Ba màn đúng bố cục design mục 1 (không có bản chốt riêng; đối chiếu với các màn đã làm cùng thành phần), checkpoint có bảng từng khối cũ và khối mới thay thế.
- [ ] Thành phần đúng QĐ-3, QĐ-4; không còn `StatCard`, `KpiCard`, `GRID`, bản `FilterBtn` cục bộ trong ba trang.
- [ ] `FilterBtn` dời đúng QĐ-2 (ba bản giống hệt, chỉ thêm `export` và import), commit riêng; checkpoint dán đoạn trước và sau.
- [ ] Không còn `*-destructive`, màu cứng, ký tự cấm trong chữ hiển thị của các tệp phạm vi.
- [ ] Chữ chỉ đổi đúng QĐ-5, QĐ-6 (tasks bước 6d đúng kỳ vọng); không đổi số liệu mẫu, cột, bộ lọc, điều kiện hiện.
- [ ] Diff giữ logic (QĐ-1); checkpoint liệt kê từng đoạn đổi nằm gần `useState`, bộ lọc, `filtered`, `TxLink`, kèm lý do an toàn.
- [ ] Bốn điều khiển của QĐ-5 khoá, có chú thích "Chưa hỗ trợ trong PoC" và `aria-describedby` đúng; menu "Thêm dự án" không mở được.
- [ ] Số action khi mở ba màn bằng 0 (e2e ca 4) và không đổi ở 28 đường dẫn; JS, CSS trong trần QĐ-8 (bảng byte ba trang); ba số lỗi của ba màn bằng 0.
- [ ] Mốc test QĐ-7 giữ nguyên; không sửa test có sẵn.
- [ ] Ảnh 1440 và 390, Sáng và Tối, trước và sau, vai Giao dịch viên, ba màn, mỗi lượt một tiến trình mock MỚI khởi động: `npx next start --port <cổng>` với ĐỦ biến của `webServer.env` trong `playwright.config.ts:93-110` (trước từ bản build mốc, sau từ bản build nhánh; không dùng lại máy chủ đã chạy test, script đo hay chụp lượt trước). Màn chỉ đọc số mẫu nên không cần chuẩn bị dữ liệu. Thêm ảnh `/assets` sau khi chọn lọc "Trên bờ, Cao nguyên" (bảng rỗng, `EmptyState`), và ảnh ba màn ở 1100 px (mốc 4 cột có thanh bên: kiểm từng ô số liệu cả nhãn, giá trị, đơn vị và chữ phụ `sub` không vỡ xấu, không chỉ kiểm trang không tràn ngang; nếu vỡ thì báo, không tự đổi mốc). Script chụp ngoài repo, không commit.
- [ ] `fe-ux-06a-man-mau.spec.ts` (project mock) đủ 4 ca và `fe-ux-06a.test.ts` đủ 3 nhóm (design mục 3), xanh.
- [ ] Kiểm thử đúng mục 5, đạt, kèm log; log có mục "EVM - E2E PROJECT HARDHAT" xanh.
- [ ] Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 6) đúng kỳ vọng.
- [ ] Không mã dư thừa: hằng, hàm, import, lớp không còn dùng xoá hẳn.

## 5. Phạm vi kiểm thử

| Ai | Chạy | Không chạy |
|---|---|---|
| Dev | `bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm` một lần, khi cổng e2e trống, lưu log; đo bằng `tools/20261104_do_moc_measure.js` (gửi kèm, sha256 `6079a0d679000d4c2bbe559d5a3eb90d362bb018243d45c0888f2fad26cdae1c`; `JS_PAGES=/,/portfolio,/trade,/approvals,/assets,/kyc,/reconciliation`), JS ba trang theo byte so bản mốc build riêng, CSS theo cách 01c. Gửi riêng đoạn log từ "EVM - E2E PROJECT HARDHAT" tới hết | `contracts` |
| Supervisor | Đọc diff, đối chiếu commit dời; build; chạy `fe-ux-06a-man-mau`, `fix-05-tong-quan` (e2e và unit), `uiux-02-dau-man` (e2e và unit), `fe-ux-01a-nen`, unit test mới; gây lỗi có chủ đích 4 điểm (bỏ `aria-pressed` trong `FilterBtn`; bỏ `disabled` của nút "Làm mới" ở `/kyc`; đổi sắc ô "WPT đã phát hành" về `default`; thêm một phần tử `font-code` trước bảng ở `/kyc`); xem ảnh | Full suite |
