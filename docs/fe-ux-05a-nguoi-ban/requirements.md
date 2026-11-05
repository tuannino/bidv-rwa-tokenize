# FE-UX-05a: Tổng quan Người bán (`/seller`) và Danh sách giao dịch (`/seller/transactions`)

| | |
|---|---|
| Nhánh | `feat/fe-ux-05a-nguoi-ban` từ `release/ui-v2` mới nhất (@ `e6604d0` hoặc sau, sau khi PR #95 FE-UX-04c merge thì từ head đó). Nếu PR khác (FE-UX-04c, 04d) merge vào `release/ui-v2` trong lúc làm: rebase lên head mới, chạy lại TOÀN BỘ kiểm thử mục 5 trên nhánh đã rebase và đo lại TOÀN BỘ mốc (JS, CSS, action, lỗi, `role`, ảnh trước) từ merge-base mới; checkpoint ghi merge-base đã dùng và log của lần chạy sau rebase |
| PR | Một PR, **base `release/ui-v2`**, KHÔNG vào `dev`. Không tự merge |
| Loại | Frontend thuần. Không `lib/`, `app/actions`, `app/api`, route `app/src/app/**`; không thêm gói npm; không sửa `components/ui/*`, `components/trading/*`, `components/recall/*`, `components/token/*`, `components/layout/*`, `seller-withdraw.tsx` (thiếu gì thì báo) |
| Mức kiểm thử | **B**, phạm vi ở mục 5. Lệnh `evm` chạy TOÀN BỘ project Hardhat; bộ liên quan trực tiếp là `vault-withdraw.spec.ts` (chạy cả mock lẫn Hardhat, mở `/seller/transactions`) |
| Tách task | FE-UX-05 tách 2 phần: **05a** Tổng quan và Danh sách giao dịch của Người bán; 05b Tạo lệnh rút của Người bán (`/seller/withdraw`) và Thông tin tài khoản (`/account`) |
| Song song | Song song được với FE-UX-04d (khác tệp mã). Các PR cùng sửa `docs/USER_GUIDE.md`, `.kiro/task-status.json`: PR merge sau tự gộp, mỗi mã ở đúng một danh sách. Tệp tạm của lệnh kiểm dùng tên riêng (tasks bước 6) |
| Nguồn | Kế hoạch 03/11; `docs/20261101_UI_UX_BAN_GIAO_SUPERVISOR.md` mục 4.4, 6, 7.1, 8; bản chốt `seller.html`, `seller-transactions.html`, `assets/c.css`; `notes/seller.md`, `notes/seller-transactions.md` (đã cũ ở câu "Hệ thống chưa có lệnh bán lại": FIX-04 đã bỏ, ô bán nay là số) |
| Thứ tự ưu tiên khi nguồn xung đột | Spec này, rồi kế hoạch 03/11, rồi mã `release/ui-v2` @ merge-base, rồi tài liệu bàn giao, `docs/USER_GUIDE.md` và notes, cuối cùng là bản xem thử |

## 1. Mục tiêu

Vẽ lại hai màn theo bản chốt bằng thành phần dùng chung (`Kpi`, `Card`, `CardTitleIcon`, `Alert`, `EmptyState`, `Badge` sắc, `fieldClass`). Không đổi câu chữ (trừ QĐ-7), trường, thứ tự trường, cột, liên kết, nút, điều kiện hiện, lời gọi server action, số action khi mở màn.

Không làm: câu phụ dưới tiêu đề (test cấm: `uiux-02-dau-man.test.ts:210`, `:211`, `:261-264`); biểu tượng đầu mỗi dòng nguồn cung và biểu tượng trong ô số liệu (bản chốt có; trần JS, như 03b); ảnh tua-bin nền ô; hiệu ứng (FE-UX-08); màn `/seller/withdraw` (05b).

## 2. Quyết định (QĐ)

- **QĐ-1. Không đổi logic.** Giữ nguyên `useSellerOverview` (export, state, effect, `reload`), `SellerOverviewPage` (nhánh đang tải, lỗi, có dữ liệu; `data-chain={chain}` ở phần tử gốc, test `uiux-02-dau-man.test.ts:268` khoá), `SellerTransactionsPage` (state `filters`, `page`, `loaded`; `query`, `key`, effect, `fresh`, `pages`, `set` cùng quy tắc bỏ trạng thái khi đổi loại; `statusOptions`; `STATUS_LABELS`, `STEP_LABELS`, `WITHDRAW_STATUS_LABELS` (export), `TYPE_LABELS`; `disabled={page <= 1}`, `disabled={!data || page >= pages}`). Diff chỉ là vỏ JSX, `className`, thay khối tự viết bằng thành phần dùng chung có cùng chữ và thuộc tính, và việc dời ở QĐ-4.
- **QĐ-2. Số action khi mở màn giữ nguyên:** `/seller` 1 (`getSellerOverviewAction`), `/seller/transactions` 1 (`listSellerTransactionsAction`). Trong mã: `seller-overview.tsx` 1 `getSellerOverviewAction(`, 1 `useEffect(`; `seller-transactions.tsx` 1 `listSellerTransactionsAction(`, 1 `useEffect(`; tệp mới ở QĐ-4 không có `Action(`, `useEffect(`, `useState(` (unit nhóm 1). Hai số khi mở đo lúc chạy bằng e2e ca 4.
- **QĐ-3. Tổng quan (`/seller`), phần trang:** đầu màn `h1` "Tổng quan" đổi lớp sang `text-2xl font-semibold tracking-tight` (hiện `text-xl font-semibold text-foreground`) bên trái, `nav aria-label="Lối tắt"` với hai liên kết (giữ `prefetch={false}`, `href`, chữ, `buttonVariants`, `ArrowRight`) bên phải, một hàng, căn giữa theo chiều dọc (`items-center`, hiện `items-end`); `TokenScopeSelect` hàng riêng như hiện tại. Đang tải "Đang đọc số liệu…" thành `EmptyState loading`; lỗi thành `Alert bad` KHÔNG `role`.
- **QĐ-4. Tách phần có số liệu (commit riêng, dời NGUYÊN VĂN).** Cảnh báo đối soát, chưa có dự án, chưa có ví thanh toán, các luật khoá không dựng được trên mock. Tạo thư mục `components/seller/`:
  - `format.ts`: `nf` (`seller-overview.tsx:23-30`) và `describePolicy` (`:32-42`) dời nguyên văn (giữ `export`). `seller-overview.tsx` export lại hai tên này (`export { describePolicy, nf } from '@/components/seller/format';`) để `seller-withdraw.tsx` (05b) không phải sửa; `seller-transactions.tsx` đổi import sang `@/components/seller/format`.
  - `seller-overview-body.tsx`: `SellerOverviewBody({ data }: { data: SellerOverviewView })`, gồm `TOKEN_STATUS_LABELS` (`:79-83`), `SUPPLY_METRICS` cùng chú thích ngay trên (`:85-92`, chú thích dời nguyên văn), `Stat` (`:94-105`), `Box` (`:107-118`), hai dòng `token`, `wallet` (`:123-124`) và toàn bộ khối trong `<>…</>` của nhánh có dữ liệu (`:152-281`). Phép sửa được phép, ngoài ra không gì khác: `data?.tokens[0]` thành `data.tokens[0]`, `data?.wallet` thành `data.wallet`; vỏ hàm, import; `chain` không còn dùng trong thân nên không truyền. Trang gọi `) : (<SellerOverviewBody data={data} />)` và bỏ `token`, `wallet`, import không còn dùng.
  - Checkpoint dán đoạn trước và sau. Commit sau mới đổi kiểu. Chỉ nhập KIỂU từ `lib/bank/seller.service` (`import type`), như trang đang làm.
- **QĐ-5. Đổi kiểu trong `seller-overview-body.tsx`:**
  - "Token khớp lệnh trong ngày": `Box` thành `section` có tiêu đề `h2` (giữ chữ; biểu tượng `ArrowLeftRight` `aria-hidden`) và lưới 4 `Kpi` một hàng từ 1100 px (2 cột từ 640 px, 1 cột dưới đó), đúng thứ tự: Số lượng mua `hl` (`sub` "{n} lệnh"), Tổng giá trị mua `gold`, Số lượng bán `default` (`sub` "{n} lệnh"), Tổng giá trị bán `default`; `value` là `nf(…)`, `unit` như hiện tại. MỖI ô bọc trong `<div className="rounded-lg">` (không lớp nào khác): `fix-04-noi-du-lieu-that.spec.ts:64` tìm `div.rounded-lg` có chữ "Số lượng bán" rồi đòi có chữ số và "WPT"; ghi chú một dòng trong mã nêu lý do.
  - `Box` nhận thêm prop `icon` (đặt `CardTitleIcon` TRONG `CardTitle`, giữ `role="heading" aria-level={2}`): Thông tin nguồn cung `Boxes`, Thông tin token `Wind`, Tồn kho token `Package`, Tài sản trong ví thanh toán `Wallet`, Số dư ví `Landmark`. Lưới hai cột đổi mốc từ `lg:` (1024 px) sang `min-[1100px]:` cho thống nhất đợt; `sm:` đổi sang `min-[640px]:` (cùng giá trị).
  - Nguồn cung: giữ `dl`, cặp `dt` và định nghĩa, `dd` có `data-metric`; dòng kẻ ngăn `divide-y divide-border`, số canh phải.
  - Thông tin token: giữ 9 cặp `dt`, `dd` đúng thứ tự; dòng kẻ ngăn; Trạng thái token là `Badge variant="info"`, Trạng thái giao dịch là `Badge` `ok` khi `token.tradingOpen`, `warn` khi không (chữ giữ).
  - `Stat` (hai thẻ ví): ô `rounded-[14px] bg-muted/60 p-3.5` (bỏ viền); prop mới `highlight` cho ô "VNDB còn rút được" và "Hạn mức còn rút được" dùng lớp `relative isolate overflow-hidden tile-gold` thay nền nhạt (`tile-gold` vẽ `::before` tuyệt đối, `globals.css:306-325`, cần ô có định vị và cắt tràn như `Kpi`).
  - Hai câu `wallet.warning` thành `Alert bad` GIỮ `role="alert"` (vẫn hiện ở cả hai thẻ); câu "Chưa có dự án…", "Chưa phát hành lần nào…" giữ chữ; địa chỉ vault giữ `font-code break-all`.
- **QĐ-6. Danh sách giao dịch (`/seller/transactions`):** đầu màn `h1` "Danh sách giao dịch" đổi lớp sang `text-2xl font-semibold tracking-tight`. Thẻ duy nhất giữ: `form role="search"` lưới 5 cột từ 1100 px, 2 cột từ 640 px; 5 ô giữ `aria-label`, `placeholder`, `value`, `onChange`, `type`, thứ tự; lớp `fieldClass` (ô tìm có biểu tượng `Search` trang trí `aria-hidden` trong khung ô); `FIELD` xoá. Đang tải thành `EmptyState loading`; lỗi `Alert bad` không `role`; rỗng `EmptyState` giữ chữ. Bảng giữ 9 cột, `key`, `data-type`, `title`, chữ. Nhãn trạng thái: lệnh mua bán `Badge variant={orderStatusTone(row.status)}` (`components/trading/order-status-tone.ts`); lệnh rút `Badge variant={WITHDRAW_STATUS_TONES[row.status]}` với bảng sắc MỚI export cạnh `WITHDRAW_STATUS_LABELS` (`Record<WithdrawStatus, StatusTone>`, `StatusTone` nhập kiểu từ `components/trading/order-status-tone.ts`: `COMPLETED` `ok`; `FAILED` `bad`; các trạng thái còn lại `warn`); chữ giữ. Phân trang giữ `nav aria-label="Phân trang"`, hai nút, điều kiện khoá.
- **QĐ-7. Chữ được đổi (chỉ để bỏ ký tự cấm):** `nf` trả "–" (U+2013) thay gạch dài (U+2014) khi giá trị rỗng (ảnh hưởng cả `/seller/withdraw` đang nhập `nf`, chủ ý); câu gợi ý ô Token chưa phân phối (`seller-overview.tsx:249`) thành "Không rút qua kênh này, lệnh rút chỉ áp cho VNDB." (như notes); dòng phân trang (`seller-transactions.tsx:214`) thay chấm giữa (U+00B7) bằng dấu phẩy ("{n} giao dịch, trang {p}/{q}"). Không đổi chữ nào khác.
- **QĐ-8. Mốc test phải giữ** (không sửa `app/test/**`, e2e có sẵn):
  - `fix-04-noi-du-lieu-that.spec.ts:55-67` (`/seller` tối đa 1 action; `div.rounded-lg` có "Số lượng bán" exact chứa chữ số và "WPT"; không câu "Hệ thống chưa có lệnh bán lại."); `fix-04-noi-du-lieu-that.test.ts:263-287` (đọc mã `seller-overview.tsx`: không `MockBadge`, không câu cũ).
  - `vault-withdraw.spec.ts:88-90` (`tbody tr[data-type="WITHDRAW"]` chứa "Rút"; mock và Hardhat).
  - `uiux-02-dau-man.test.ts:86-95` (đúng một `<TokenScopeSelect` ở `seller-overview.tsx`), `:210`, `:211`, `:261-264`, `:269` (`data-chain={chain}`); `uiux-02-dau-man.spec.ts:36` (`/seller` có ô `#token-scope`), `:168-169`, `:226-233` (đúng một `h1` trong `main`); `seller-channel.test.ts` (tầng nghiệp vụ, không đổi); `chain-scope.spec.ts:13-21`, `:36` (Hardhat: `getByRole('heading', { name: 'Tổng quan' })` không exact, chế độ strict, rồi `[data-chain="…"]` đúng một phần tử: không heading mới nào được chứa chữ "Tổng quan", không thêm `data-chain` ở chỗ khác).
- **QĐ-9. Hiệu năng:** JS gzip `/seller`, `/seller/transactions` mỗi trang không tăng quá 3 KB (theo byte so bản build mốc riêng); `/seller/withdraw` (vẫn nhập `describePolicy`, `nf`, `useSellerOverview` từ `seller-overview.tsx`) không tăng quá 1 KB; nếu vượt vì bản build kéo `SellerOverviewBody` vào chunk của màn rút, được phép sửa đúng MỘT dòng import ở `seller-withdraw.tsx:24` để nhập `describePolicy`, `nf` từ `@/components/seller/format` (giữ `useSellerOverview` từ `./seller-overview`), ghi trong checkpoint, và thêm `seller-withdraw.tsx` vào lệnh 6a. Màn rút còn nhập `WITHDRAW_STATUS_LABELS` từ `seller-transactions.tsx` (`:25`), nên đổi dòng import trên chưa chắc đủ: vẫn vượt thì DỪNG và báo, không tự mở rộng phạm vi; các trang đo khác không tăng; CSS gzip không tăng quá 2 KB. `metrics.json` của hai màn ba số lỗi bằng 0; đường dẫn khác không tăng so với mốc.

## 3. Phạm vi tệp (danh sách trắng)

| Được sửa | Ghi chú |
|---|---|
| `app/src/components/pages/seller-overview.tsx`, `seller-transactions.tsx` | QĐ-1 đến QĐ-7 |
| `app/src/components/seller/format.ts`, `seller-overview-body.tsx` (mới) | QĐ-4, QĐ-5 |
| `app/e2e/fe-ux-05a-nguoi-ban.spec.ts`, `app/test/fe-ux-05a.test.ts` (mới) | Design mục 3 |
| `docs/tech-report.md` | CHỈ khi số dòng marker dời, chỉ đổi khối tự sinh bằng `node scripts/scan-pending.mjs --write-report` |
| `docs/fe-ux-05a-nguoi-ban/{requirements,design,tasks}.md`, `docs/CHECKPOINT_FEUX05A.md` (và `_DETAIL.md` nếu quá 800 dòng), `docs/USER_GUIDE.md`, `.kiro/task-status.json` | Theo quy ước repo |

Cấm mọi tệp khác (xem dòng Loại), gồm `globals.css`, `app/src/app/**`, `lib/**`, `app/test/**` có sẵn, e2e có sẵn, `package*.json`.

## 4. Điều kiện hoàn thành

- [ ] Hai màn đúng bố cục bản chốt trừ mục 1 "Không làm"; bảng đối chiếu từng dòng `notes/seller.md`, `notes/seller-transactions.md` trong checkpoint (dòng nào bỏ thì ghi lý do).
- [ ] Bố cục, thành phần đúng QĐ-3, QĐ-5, QĐ-6; 4 ô số liệu đúng thứ tự và sắc, mỗi ô bọc `div.rounded-lg`.
- [ ] `format.ts`, `SellerOverviewBody` dời đúng QĐ-4 (chỉ các phép sửa được phép), commit riêng; checkpoint dán đoạn trước và sau.
- [ ] Không còn `amber-*`, `*-destructive`, `FIELD` trong các tệp phạm vi.
- [ ] Chữ chỉ đổi đúng QĐ-7 (tasks bước 6d đúng kỳ vọng); không đổi trường, cột, liên kết, nút, điều kiện hiện.
- [ ] Diff giữ logic (QĐ-1, QĐ-2); checkpoint liệt kê từng đoạn đổi nằm gần hook, effect, handler, điều kiện khoá, kèm lý do an toàn.
- [ ] Số action khi mở màn đúng QĐ-2 (e2e ca 4) và không đổi ở 28 đường dẫn; JS, CSS trong trần QĐ-9 (bảng byte ba trang); ba số lỗi của hai màn bằng 0.
- [ ] Mốc test QĐ-8 giữ nguyên; không sửa test có sẵn.
- [ ] Ảnh 1440 và 390, Sáng và Tối, trước và sau, vai Người bán, mỗi lượt một tiến trình mock MỚI khởi động: `npx next start --port <cổng>` với ĐỦ biến của `webServer.env` trong `playwright.config.ts:93-110` (trước từ bản build mốc, sau từ bản build nhánh; không dùng lại máy chủ đã chạy test, script đo hay chụp lượt trước). Công thức: `E2E_BASE_URL=http://localhost:<cổng> npx playwright test e2e/ops-transactions.spec.ts e2e/vault-withdraw.spec.ts` (có lệnh mua, bán, rút), rồi chụp `/seller`, `/seller/transactions`. Script chụp ngoài repo, không commit.
- [ ] Trạng thái không dựng được trên mock (cảnh báo đối soát ở hai thẻ ví; chưa có dự án; chưa có ví thanh toán; giao dịch tạm dừng): unit test (design mục 3) và ảnh dựng ngoài repo bằng `renderToStaticMarkup` cộng CSS bản build, `page.setContent`, như 03b (Sáng, Tối, 1440, 390).
- [ ] `fe-ux-05a-nguoi-ban.spec.ts` (project mock) đủ 4 ca và `fe-ux-05a.test.ts` đủ 4 nhóm (design mục 3), xanh.
- [ ] Kiểm thử đúng mục 5, đạt, kèm log; log có mục "EVM - E2E PROJECT HARDHAT" xanh (toàn bộ project Hardhat, gồm `vault-withdraw`).
- [ ] Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 6) đúng kỳ vọng.
- [ ] Không mã dư thừa: hằng, hàm, import, lớp không còn dùng xoá hẳn.

## 5. Phạm vi kiểm thử

| Ai | Chạy | Không chạy |
|---|---|---|
| Dev | `bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm` một lần, khi cổng e2e trống, lưu log; đo bằng `tools/20261104_do_moc_measure.js` (gửi kèm, sha256 `6079a0d679000d4c2bbe559d5a3eb90d362bb018243d45c0888f2fad26cdae1c`; `JS_PAGES=/,/portfolio,/trade,/approvals,/seller,/seller/transactions,/seller/withdraw`), JS ba trang theo byte so bản mốc build riêng, CSS theo cách 01c. Gửi riêng đoạn log từ "EVM - E2E PROJECT HARDHAT" tới hết | `contracts` |
| Supervisor | Đọc diff, đối chiếu commit dời; build; chạy `fe-ux-05a-nguoi-ban`, `fix-04-noi-du-lieu-that` (e2e và unit), `vault-withdraw` (sau `ops-transactions`), `uiux-02-dau-man` (e2e và unit), unit test mới; gây lỗi có chủ đích 4 điểm (bỏ `div.rounded-lg` bọc ô "Số lượng bán"; trong `SellerOverviewBody` bỏ câu cảnh báo ở thẻ Số dư ví; đổi `disabled={page <= 1}` thành `disabled={page < 1}`; thêm một lời gọi `listSellerTransactionsAction(` vào trang); xem ảnh | Full suite |
