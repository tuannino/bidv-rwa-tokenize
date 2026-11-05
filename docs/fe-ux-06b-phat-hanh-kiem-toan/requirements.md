# FE-UX-06b: Phát hành dữ liệu thử (`/mint`), Sổ kiểm toán (`/audit`), khối thông tin token, nhánh lỗi còn lại

| | |
|---|---|
| Nhánh | `feat/fe-ux-06b-phat-hanh-kiem-toan` từ `release/ui-v2` mới nhất (@ `9eac384` hoặc sau: đã gồm 05b, 05c). Nếu PR khác (06a) merge vào `release/ui-v2` trong lúc làm: rebase lên head mới, chạy lại TOÀN BỘ kiểm thử mục 5 trên nhánh đã rebase và đo lại TOÀN BỘ mốc (JS, CSS, action, lỗi, `role`, ảnh trước) từ merge-base mới; checkpoint ghi merge-base đã dùng và log của lần chạy sau rebase |
| PR | Một PR, **base `release/ui-v2`**, KHÔNG vào `dev`. Không tự merge |
| Loại | Frontend thuần. Không `lib/`, `app/actions`, `app/api`; không thêm gói npm; không sửa `components/ui/*`, `components/layout/*`. Tệp route chỉ được sửa đúng hai tệp ở mục 3 (thiếu gì thì báo) |
| Mức kiểm thử | **B**, phạm vi ở mục 5. Lệnh `evm` chạy TOÀN BỘ project Hardhat; trong project Hardhat có `mint.spec.ts`, `zz-distribution-approval.spec.ts` mở `/mint`; các bộ chỉ chạy project mock mở `/mint` hoặc khối thông tin token: `maker-checker`, `chain-selector`, `recall`, `fe-ux-03a-kiem-soat`, `fe-ux-01c-chuyen-dong`, `token-info-read`, `ops-transactions` |
| Tách task | Phần sau của FE-UX-06 (06a ba màn dữ liệu mẫu đang làm) |
| Song song | Song song được với FE-UX-06a (khác tệp mã). Các PR cùng sửa `docs/USER_GUIDE.md`, `.kiro/task-status.json`: PR merge sau tự gộp, mỗi mã ở đúng một danh sách. Tệp tạm của lệnh kiểm dùng tên riêng (tasks bước 6) |
| Nguồn | Kế hoạch 03/11 (FE-UX-06: "chỉ áp hệ thiết kế", không có bản chốt cho `/mint`, `/audit`); ghi nhận 04/11 từ FE-UX-03a mục 3 (khối thông tin token trong thẻ hẹp cắt chữ ví và ngày phát hành ở 1440 px); nợ ghi ở nghiệm thu 05b (`/account` nhánh lỗi còn `text-destructive`) |
| Thứ tự ưu tiên khi nguồn xung đột | Spec này, rồi kế hoạch 03/11, rồi mã `release/ui-v2` @ merge-base, rồi `docs/USER_GUIDE.md` |

## 1. Mục tiêu

Vẽ lại `/mint` và `/audit` bằng hệ thiết kế của đợt (`Card`, `CardTitleIcon`, `Alert`, `EmptyState`, `Badge` sắc, `fieldClass`), sửa khối thông tin token không còn cắt chữ, và dọn hai nhánh lỗi cuối cùng còn màu `destructive` trong tệp route. Không đổi logic, nút, điều kiện khoá, `title` lý do khoá, lời gọi server action, số action khi mở màn, câu chữ (trừ QĐ-7).

Không làm: câu phụ dưới tiêu đề (test cấm: `uiux-02-dau-man.test.ts:205`, `:216`); hiệu ứng (FE-UX-08); nối dữ liệu thật hay đổi nguồn của sổ kiểm toán; đổi chữ của mã trạng thái máy (`CONFIRMED`, `ALLOWED`…) hiện đang in thẳng.

## 2. Quyết định (QĐ)

- **QĐ-1. Không đổi logic.**
  - `mint.tsx`: giữ mọi `useState`, `useRef`, `useTransition`, `useCallback`, cả hai effect (debounce 300 ms, `cancelled`, mảng phụ thuộc), `loadKey`, `activeLoadKey`, `load` (nguyên văn `listTransactionsAction({ chain: activeChain, limit: 20 })`, `op07-chain-scope.test.ts:53` khoá), `apply`, `fresh`, `status`, `txns`, `run`, `handleOnboard`, `handleMint`, `mayMint`, `mayWhitelist`; hai nút giữ `type`, `variant`, `onClick`, `disabled` (`pending || !wallet || !mayWhitelist`, `pending || !wallet || !mayMint`), `title` (chữ lý do khoá giữ nguyên, `mint.spec.ts:156` đọc), biểu tượng `Loader2` khi `pending`.
  - `app/(ops)/audit/page.tsx`: vẫn là Server Component gọi `listAuditLog(100)` một lần, không action; giữ `AppLayout`, breadcrumbs, `HoverHint` bọc `h1` (`uiux-02-dau-man.test.ts:273`), thứ tự nhánh lỗi, rỗng, có dữ liệu.
  - `app/(account)/account/page.tsx`: chỉ đổi một lớp (QĐ-6).
  - Diff chỉ là vỏ JSX, `className`, thay khối tự viết bằng thành phần dùng chung có cùng chữ và thuộc tính, việc dời ở QĐ-2, chữ ở QĐ-7, và đúng các thuộc tính mới sau (đều ở commit đổi kiểu, sau commit dời): `role="heading" aria-level={2}` trên bốn `CardTitle` (QĐ-3, QĐ-4); `title={entry.detail ?? undefined}` trên ô Chi tiết của `AuditTable` (design mục 1).
- **QĐ-2. Tách hai bảng để unit test (commit riêng, dời NGUYÊN VĂN).** Trạng thái giao dịch `FAILED`, `PENDING` và kết quả kiểm toán `DENIED`, `FAILURE` khó dựng ổn định trên mock; trang `/audit` là hàm async máy chủ nên không dựng được trong unit.
  - `components/mint/txn-history-table.tsx`: `TxnHistoryTable({ txns }: { txns: TxnView[] })` mang nguyên khối `<Table>…</Table>` của `mint.tsx:305-344` (nhánh có giao dịch). Trang gọi `<TxnHistoryTable txns={txns} />` trong nhánh cũ, điều kiện `txns.length === 0` giữ ở trang.
  - `components/audit/audit-table.tsx`: `AuditTable({ entries }: { entries: AuditRecord[] })` mang nguyên khối `<Table>…</Table>` của `audit/page.tsx:43-82`, `result.data.map` thành `entries.map`. Trang gọi `<AuditTable entries={result.data} />`.
  - Phép sửa được phép, ngoài ra không gì khác: vỏ hàm, import, tên biến dữ liệu như trên. Chỉ nhập KIỂU: `import type { TxnView } from '@/lib/bank/mint.service'` (tệp có `server-only`, trang đang nhập kiểu như vậy), `import type { AuditRecord } from '@/lib/store/store.port'`. Checkpoint dán đoạn trước và sau. Commit sau mới đổi kiểu.
- **QĐ-3. `/mint` bố cục và thành phần:**
  - Đầu màn: `h1` đổi lớp sang `text-2xl font-semibold tracking-tight`, giữ chữ và `HoverHint`. Đoạn giới thiệu (liên kết "Lập lệnh" `prefetch={false}`, câu về quyền và cờ) thành `Alert tone="info"` KHÔNG `role`, giữ nguyên chữ và liên kết.
  - Lưới `grid gap-6 min-[1100px]:grid-cols-12` (thay `lg:grid-cols-[minmax(0,1fr)_320px]`): thẻ Nhà đầu tư `min-[1100px]:col-span-8`, thẻ Trạng thái on-chain `min-[1100px]:col-span-4`; thẻ Lịch sử giao dịch rộng hết dưới lưới.
  - Ba `CardTitle` thêm `role="heading" aria-level={2}`, lớp `flex items-center gap-2.5 text-base`, `CardTitleIcon` trước chữ: Nhà đầu tư `UserCheck`, Trạng thái on-chain `Link2`, Lịch sử giao dịch `ListChecks`; chữ tiêu đề giữ nguyên (gồm "Lịch sử giao dịch ({chain})", `chain-selector.spec.ts:55` đọc). Nếu biểu tượng nào làm chunk dùng chung tăng thì đổi biểu tượng cùng nghĩa, ghi DEVIATION (như 05a, 05c).
  - Hai ô nhập: lớp `fieldClass` (`import { fieldClass } from '@/components/ui/field'`) cộng `font-code` (ô ví) hoặc `tabular-nums` (ô số lượng); giữ `id`, `label htmlFor`, `value`, `onChange`/`onValueChange`, `placeholder`, `spellCheck`, câu gợi ý dưới ô.
  - Kết quả `feedback` thành `Alert` (`ok` khi `success`, `bad` khi `error`), GIỮ `role="status"` cho CẢ HAI sắc (các e2e đọc câu lỗi "chưa được whitelist" qua `getByRole('status')`, `mint.spec.ts:98`); bỏ hai biểu tượng `CheckCircle2`, `XCircle` tự viết, dùng biểu tượng mặc định của `Alert` theo sắc (`alert.tsx` tự gắn, không tự gắn `role`); chữ kết quả bọc `<span className="[overflow-wrap:anywhere]">` (câu lỗi có ví 42 ký tự, ở 390 px không xuống dòng thì bị thẻ cắt). Trang có đúng một phần tử `role="status"` khi có kết quả (e2e gọi `page.getByRole('status')` chế độ strict).
  - Thẻ Trạng thái on-chain: giữ `Row` (nhãn và giá trị là hai con trực tiếp của `Row`: `mint.spec.ts:73` lấy cha của chữ "Số dư WPT" để đọc số); `CardContent className="divide-y divide-border text-sm"` (bỏ `space-y-3`), mỗi `Row` thêm `py-2.5`; nhãn sắc theo QĐ-5; câu khi chưa có ví giữ chữ.
  - Thẻ Lịch sử: rỗng thành `EmptyState` giữ chữ; bảng là `TxnHistoryTable` (QĐ-2), vẫn là bảng CUỐI trang (`mint.spec.ts:84` dùng `getByRole('table').last()`).
- **QĐ-4. `/audit` bố cục và thành phần:** `h1` đổi lớp sang `text-2xl font-semibold tracking-tight`; `CardTitle` "Bản ghi gần nhất" thêm `role="heading" aria-level={2}`, lớp `flex items-center gap-2.5 text-base`, `CardTitleIcon` `ScrollText`; lỗi `result.error` thành `Alert tone="bad"` KHÔNG `role` (hiện không có); rỗng thành `EmptyState` giữ chữ (gồm "/mint"); bảng là `AuditTable`.
- **QĐ-5. Sắc nhãn (chữ giữ):**
  - `AuditTable`: `outcome` `ALLOWED`, `SUCCESS` `ok`; `DENIED`, `FAILURE` `bad`; viết `Record<AuditRecord['outcome'], BadgeVariant>`.
  - `TxnHistoryTable`: `CONFIRMED` `ok`, `FAILED` `bad`, `PENDING` `warn`; `Record<TxnView['status'], BadgeVariant>`.
  - Thẻ Trạng thái on-chain: Whitelist `ok` khi `whitelisted`, `warn` khi không (chữ "đã KYC", "chưa KYC" giữ); Đóng băng `bad` khi `frozen`, `outline` khi không (chữ giữ).
  - `BadgeVariant` khai báo cục bộ `NonNullable<React.ComponentProps<typeof Badge>['variant']>` như 05b. Nhãn khoá boolean viết toán tử ba ngôi một tầng.
- **QĐ-6. Hai nhánh lỗi trong tệp route:** `app/(account)/account/page.tsx:27` đổi `text-destructive` thành `text-bad-ink`, GIỮ `role="alert"` và mọi thứ khác của tệp; `/audit` theo QĐ-4. Sau task, các tệp `.tsx` trong `app/src/app` không còn `destructive` (tasks bước 6f; `globals.css` định nghĩa biến `--destructive` nên không thuộc phép kiểm).
- **QĐ-7. Chữ được đổi (chỉ để bỏ ký tự cấm, U+00B7 và U+2014):**
  - `mint.tsx` nút "1 \u00b7 KYC + Whitelist" thành "1. KYC + Whitelist", "2 \u00b7 Phát hành dữ liệu thử" thành "2. Phát hành dữ liệu thử" (e2e tìm theo regex `/KYC \+ Whitelist/`, `/Phát hành/`, vẫn khớp; không thêm nút nào khác có chữ "Phát hành").
  - Câu kết quả KYC "KYC {ref} đã duyệt, whitelist={…}, tx {…}… ({status})" và phát hành "Đã phát hành {n} WPT, số dư mới {…}, tx {…}… ({status})": chấm giữa thành dấu phẩy (giữ nguyên chuỗi con `whitelist=true`, "Đã phát hành 100 WPT" mà e2e đọc).
  - Câu gợi ý "WPT có 0 chữ số thập phân: nhập số nguyên." (gạch dài thành dấu hai chấm).
  - Ô trống trong hai bảng (`'\u2014'` ở ví nhận, số lượng, đối tượng, chi tiết) thành `'–'` (U+2013), theo quy ước ô trống của đợt.
  - Không đổi chữ nào khác.
- **QĐ-8. Khối thông tin token không cắt chữ (`components/maker-checker/token-info-block.tsx`):** `dl` một cột (`grid gap-y-2 text-sm`, bỏ `sm:grid-cols-2`: khối nằm trong thẻ nửa bề rộng ở `/draft` và `/approvals/[id]`, hai cột làm ô giá trị quá hẹp); `dd` bỏ `truncate`, thành `min-w-0 text-right [overflow-wrap:anywhere]` (giữ `font-code` cho ô `mono`, giữ `title`); giữ `aria-label="Khối thông tin token"`, thứ tự 10 cặp `dt`/`dd` liền kề (e2e đọc `dd` ngay sau `dt`), ba câu đang tải, lỗi, chưa nhập.
- **QĐ-9. Mốc test phải giữ** (không sửa `app/test/**`, e2e có sẵn):
  - `mint.spec.ts` toàn bộ (mock và Hardhat): heading `/Phát hành token dự án điện gió/`, nhãn "Ví nhà đầu tư", "Số lượng WPT", nút `/KYC \+ Whitelist/`, `/Phát hành/` (strict), `getByRole('status')` (strict) chứa `whitelist=true`, "Đã phát hành 100 WPT", "chưa được whitelist"; chữ "đã KYC"; cha của "Số dư WPT" chứa số; bảng cuối chứa "Phát hành", "CONFIRMED"; nút khoá có `title` `/CONTROLLER không có quyền/`; `/audit` heading `/Sổ kiểm toán/`.
  - `maker-checker.spec.ts`, `chain-selector.spec.ts`, `recall.spec.ts`, `fe-ux-03a-kiem-soat.spec.ts:90-97`, `fe-ux-01c-chuyen-dong.spec.ts:35-38`, `zz-distribution-approval.spec.ts`, `ops-transactions.spec.ts`, `token-info-read.spec.ts` (khối thông tin token, `infoNumber` đọc `dd` sau `dt`).
  - `op07-chain-scope.test.ts:51-54`; `uiux-02-dau-man.test.ts:205`, `:216`, `:221`, `:222`, `:273`; `uiux-02-dau-man.spec.ts:163`, `:174`, `:217-224`, `:226-233`; `account-info.spec.ts`, `fe-ux-05b` (không đổi gì ngoài một lớp).
- **QĐ-10. Hiệu năng:** JS gzip `/mint` không tăng quá 3 KB; `/audit` (Server Component) không tăng quá 1 KB; `/draft`, `/approvals/[id]` (dùng khối thông tin token) không tăng quá 512 B; các trang đo khác không tăng (lệch do thứ tự module dưới 100 B gzip mà không thêm mã thì ghi giải thích); CSS gzip không tăng quá 2 KB. Theo byte so bản build mốc riêng. `metrics.json` của `/mint`, `/audit`, `/draft` ba số lỗi bằng 0; đường dẫn khác không tăng so với mốc.

## 3. Phạm vi tệp (danh sách trắng)

| Được sửa | Ghi chú |
|---|---|
| `app/src/components/pages/mint.tsx` | QĐ-1, QĐ-3, QĐ-5, QĐ-7 |
| `app/src/app/(ops)/audit/page.tsx` | QĐ-1, QĐ-4, QĐ-6 |
| `app/src/app/(account)/account/page.tsx` | CHỈ một lớp, QĐ-6 |
| `app/src/components/maker-checker/token-info-block.tsx` | QĐ-8 |
| `app/src/components/mint/txn-history-table.tsx`, `app/src/components/audit/audit-table.tsx` (mới) | QĐ-2, QĐ-5, QĐ-7 |
| `app/e2e/fe-ux-06b-phat-hanh-kiem-toan.spec.ts`, `app/test/fe-ux-06b.test.ts` (mới) | Design mục 3 |
| `docs/tech-report.md` | CHỈ khi số dòng marker dời, chỉ đổi khối tự sinh bằng `node scripts/scan-pending.mjs --write-report` |
| `docs/fe-ux-06b-phat-hanh-kiem-toan/{requirements,design,tasks}.md`, `docs/CHECKPOINT_FEUX06B.md` (và `_DETAIL.md` nếu quá 800 dòng), `docs/USER_GUIDE.md`, `.kiro/task-status.json` | Theo quy ước repo |

Cấm mọi tệp khác (xem dòng Loại), gồm `globals.css`, các tệp khác trong `app/src/app/**`, `lib/**`, `app/test/**` có sẵn, e2e có sẵn, `package*.json`.

## 4. Điều kiện hoàn thành

- [ ] `/mint`, `/audit` đúng bố cục design mục 1 (không có bản chốt; checkpoint có bảng từng khối cũ và khối mới thay thế); khối thông tin token không cắt chữ ở `/draft`, `/approvals/[id]` (1440 và 390 px).
- [ ] Thành phần đúng QĐ-3, QĐ-4, QĐ-8.
- [ ] `TxnHistoryTable`, `AuditTable` dời đúng QĐ-2 (chỉ các phép sửa được phép), commit riêng; checkpoint dán đoạn trước và sau.
- [ ] Không còn `*-destructive`, màu cứng, ký tự cấm trong các tệp phạm vi; các tệp `.tsx` trong `app/src/app` không còn `destructive` (QĐ-6); sắc nhãn đúng QĐ-5.
- [ ] Chữ chỉ đổi đúng QĐ-7 (tasks bước 6d đúng kỳ vọng); không đổi nút, điều kiện khoá, `title`, điều kiện hiện.
- [ ] Diff giữ logic (QĐ-1); checkpoint liệt kê từng đoạn đổi nằm gần hook, effect, `run`, handler, điều kiện khoá, kèm lý do an toàn.
- [ ] Số action khi mở `/mint` (Giao dịch viên), `/audit` bằng mốc (e2e ca 4) và không đổi ở 28 đường dẫn; JS, CSS trong trần QĐ-10 (bảng byte); ba số lỗi của `/mint`, `/audit`, `/draft` bằng 0.
- [ ] Mốc test QĐ-9 giữ nguyên; không sửa test có sẵn.
- [ ] Ảnh 1440 và 390, Sáng và Tối, trước và sau, mỗi lượt một tiến trình mock MỚI khởi động: `npx next start --port <cổng>` với ĐỦ biến của `webServer.env` trong `playwright.config.ts:93-110` (trước từ bản build mốc, sau từ bản build nhánh; không dùng lại máy chủ đã chạy test, script đo hay chụp lượt trước). Công thức: `E2E_BASE_URL=http://localhost:<cổng> npx playwright test e2e/ops-transactions.spec.ts` (có giao dịch, bản ghi kiểm toán, yêu cầu phát hành), rồi chụp vai Giao dịch viên (a) `/mint` sau khi nhập ví NDT001 và bấm "1. KYC + Whitelist" (có kết quả, trạng thái, lịch sử); (b) `/audit`; (c) `/draft` sau khi nhập "WPT" vào ô "Mã hoặc ký hiệu token" của Thẻ tạo token (khối thông tin token có đủ ví, ngày); vai Kiểm soát viên (d) `/approvals/[id]` của một yêu cầu. Script chụp ngoài repo, không commit.
- [ ] Trạng thái khó tạo trên mock, nghiệm thu đúng cách ghi cho từng trường hợp (checkpoint ghi đúng cách đã dùng, không ghi "unit đã phủ" cho phép kiểm chỉ đọc mã nguồn): giao dịch `FAILED`, `PENDING` và kiểm toán `DENIED`, `FAILURE` bằng unit dựng thành phần (design mục 3 nhóm 2, 3); `/audit` lỗi đọc, rỗng, có dữ liệu bằng unit dựng trang với `listAuditLog` giả (nhóm 5); kết quả `/mint` lỗi bằng e2e thật (ca 2, máy chủ từ chối ví chưa whitelist); ví đang đóng băng (trạng thái chỉ đọc sau effect, không dựng được bằng `renderToStaticMarkup`, mock không đóng băng ví) bằng khoá biểu thức sắc trong mã nguồn (nhóm 1) cộng ảnh dựng ngoài repo và đọc diff. Mọi trạng thái trên có ảnh dựng ngoài repo bằng `renderToStaticMarkup` cộng CSS bản build, `page.setContent` (Sáng, Tối, 1440, 390); với ví đóng băng, ảnh dựng thẻ Trạng thái on-chain bằng đoạn JSX chép từ trang (ghi rõ trong checkpoint).
- [ ] `fe-ux-06b-phat-hanh-kiem-toan.spec.ts` (project mock) đủ 4 ca và `fe-ux-06b.test.ts` đủ 5 nhóm (design mục 3), xanh.
- [ ] Kiểm thử đúng mục 5, đạt, kèm log; log có mục "EVM - E2E PROJECT HARDHAT" xanh (toàn bộ project Hardhat, gồm `mint`).
- [ ] Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 6) đúng kỳ vọng.
- [ ] Không mã dư thừa: hằng, hàm, import, lớp không còn dùng xoá hẳn.

## 5. Phạm vi kiểm thử

| Ai | Chạy | Không chạy |
|---|---|---|
| Dev | `bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm` một lần, khi cổng e2e trống, lưu log; đo bằng `tools/20261104_do_moc_measure.js` (gửi kèm, sha256 `6079a0d679000d4c2bbe559d5a3eb90d362bb018243d45c0888f2fad26cdae1c`; `JS_PAGES=/,/portfolio,/trade,/approvals,/mint,/audit,/draft,DYN:/approvals`), JS theo byte so bản mốc build riêng, CSS theo cách 01c. Gửi riêng đoạn log từ "EVM - E2E PROJECT HARDHAT" tới hết | `contracts` |
| Supervisor | Đọc diff, đối chiếu commit dời; build; chạy `fe-ux-06b-phat-hanh-kiem-toan`, `mint`, `maker-checker`, `chain-selector`, `token-info-read`, `uiux-02-dau-man` (e2e và unit), `account-info`, `op07-chain-scope`, unit test mới; gây lỗi có chủ đích 4 điểm (đổi `role="status"` của kết quả thành `role` khác khi `tone` là `error`; thêm lại `truncate` vào `dd` của khối thông tin token; đổi sắc `DENIED` về `ok` trong `AuditTable`; bỏ `pending ||` khỏi `disabled` của nút KYC); xem ảnh | Full suite |
