# FE-UX-04a: Tổng quan nhà đầu tư (`/portfolio`) và Chi tiết token dự án (`/tokens/[symbol]`)

| | |
|---|---|
| Nhánh | `feat/fe-ux-04a-tong-quan-ndt` từ `release/ui-v2` @ `1238a54` hoặc sau. Nếu PR #92 (FE-UX-03c) merge trong lúc làm: rebase lên `release/ui-v2` mới, rồi đo lại TOÀN BỘ mốc (JS, CSS, action, lỗi, `role`, ảnh trước) từ merge-base mới; không dùng số đo của `1238a54` để nghiệm thu PR đặt trên head sau 03c. Checkpoint ghi rõ merge-base đã dùng |
| PR | Một PR, **base `release/ui-v2`**, KHÔNG vào `dev`. Không tự merge |
| Loại | Frontend thuần. Không `lib/`, `app/actions`, `app/api`, route `app/src/app/**`; không thêm gói npm; không sửa `components/ui/*` (thiếu gì thì báo) |
| Mức kiểm thử | **B**, phạm vi ở mục 5 (có Hardhat: `wallet-connect.spec.ts` mở `/portfolio` trên project Hardhat) |
| Song song | Chạy song song được với FE-UX-03c (khác tệp mã). Hai PR cùng sửa `docs/USER_GUIDE.md`, `.kiro/task-status.json`: PR merge sau tự gộp xung đột, chỉ ở phần của mình |
| Nguồn | Kế hoạch 03/11; `docs/20261101_UI_UX_BAN_GIAO_SUPERVISOR.md` mục 4.4, 6, 7.1, 8; bản chốt `portfolio.html`, `token-detail.html`, `assets/c.css`; `notes/portfolio.md`, `notes/token-detail.md` (đã cũ một phần: FIX-04 đã bỏ câu "chờ BE-01", thay `MockBadge` bằng `UnverifiedNote`, thêm dòng Số dư VNDB) |
| Thứ tự ưu tiên khi nguồn xung đột | Spec này, rồi kế hoạch 03/11, rồi mã `release/ui-v2` @ `1238a54`, rồi tài liệu bàn giao, `docs/USER_GUIDE.md` và notes, cuối cùng là bản xem thử |

## 1. Mục tiêu

Vẽ lại hai màn theo bản chốt bằng thành phần dùng chung (`Card` sắc, `CardTitleIcon`, `Kpi`, `Alert`, `EmptyState`, `Badge` sắc). Không đổi câu chữ (trừ QĐ-6), trường, thứ tự trường trong từng thẻ, liên kết, điều kiện hiện, lời gọi server action, số action khi mở màn.

Không làm (ghi lại để làm sau nếu Sếp duyệt):

- Dải video "Đề xuất bổ sung" (câu hỏi Q4 bàn giao chưa chốt).
- Ảnh tua-bin nền thẻ (chờ minh hoạ chính thức).
- Hiệu ứng đếm số (FE-UX-08), vòng đo Hệ số công suất.
- Liên kết "Tổng quan" phía trên tiêu đề chi tiết token (bản chốt thêm vì khung xem thử không có breadcrumb; app đã có breadcrumb ở thanh đầu).
- Câu phụ dưới tiêu đề (test cấm: `uiux-02-dau-man.test.ts:201`, `:261-264`, câu cũ "Vị thế WPT của ví đang").
- Sửa lệch nghiệp vụ trong notes: Tổng quan trên mock vẫn đòi ví trình duyệt (USER_GUIDE L-03); cột Trạng thái giữ mã `CONFIRMED`; Số lượng in thô `txn.amount`; Thời điểm giữ `toLocaleString('vi-VN')`. Đây là logic hoặc chữ, không thuộc task giao diện.
- Sửa `UnverifiedNote`, `OnChainBadge`: giữ nguyên tệp. `OnChainBadge` dùng màu `primary`; trong thẻ nền xanh tự đổi sang chữ trắng.

## 2. Quyết định (QĐ)

- **QĐ-1. Không đổi logic.** Giữ nguyên trong `asset-summary.tsx`, `transaction-history-box.tsx`, `investor-token-detail.tsx`: `useAccount`, `useSelectedChain`, `requestKey`, state `loaded`, effect (điều kiện thoát sớm, `cancelled`, mảng phụ thuộc), `fresh`, `loading`, thứ tự và điều kiện mọi nhánh hiện (chưa kết nối, đang tải, `notBound`, lỗi, có dữ liệu, rỗng). `issuance-status-box.tsx`, `token-list-box.tsx` giữ `useTokenSummary(chain)`, `ON_CHAIN_PROJECT`, `projectNameView`. `investor-portfolio.tsx` vẫn là Server Component (không `'use client'`, không state). Mọi `CardTitle` giữ `role="heading" aria-level={2}` và đúng chữ tiêu đề (e2e tìm thẻ bằng heading).
- **QĐ-2. Số action khi mở màn giữ nguyên:** `/portfolio` 1 khi chưa có ví (`getTokenSummaryAction` gộp cho hai hộp), 3 khi có ví; `/tokens/WPT` 1 (`getPortfolioAction`, chain mock dùng ví hồ sơ); `/tokens/WPT-PQY`, `/tokens/WPT-NTH` 0. Bốn số trên mock (`/portfolio` chưa có ví, ba trang chi tiết) đo lúc chạy bằng e2e ca 4 (design mục 4). Số 3 của `/portfolio` khi có ví KHÔNG đo lúc chạy được (Playwright không có ví trình duyệt): đây là bất biến giữ bằng kiểm mã nguồn (unit nhóm 1) và bằng việc không đổi effect (QĐ-1); checkpoint ghi đúng như vậy, không ghi là đã đo. Lời gọi trong mã giữ đúng: `asset-summary.tsx` 1 `getPortfolioAction(` và 1 `useEffect(`; `transaction-history-box.tsx` 1 `getWalletTransactionsAction(` và 1 `useEffect(`; `investor-token-detail.tsx` 1 `getPortfolioAction(` và 1 `useEffect(`; hai tệp mới ở QĐ-5 không có `Action(`, `useEffect(`, `useState(` (unit test khoá, design mục 4).
- **QĐ-3. Tổng quan (`/portfolio`):** đầu màn `h1` và `TokenScopeSelect` một hàng như 03b. Lưới 12 cột từ 1100 px (dưới đó một cột), giữ thứ tự DOM: Tài sản đã đầu tư (7 cột) cạnh Trạng thái phát hành (5 cột); Giao dịch gần đây (7 cột) cạnh Token dự án điện gió (5 cột).
  - Thẻ `tone="hl"` (ở đây và Vị thế của bạn) thêm lớp `[--card:var(--tile-hl-chip)] [--border:var(--tile-hl-chip)]`: `tile-hl` không đổi `--card`, `--border`, nên thiếu lớp này thì ô biểu tượng `EmptyState` (nền `bg-card`, biểu tượng thành trắng) trắng trên trắng ở chế độ Sáng và đường kẻ gần như mất ở chế độ Tối. Không sửa `components/ui/*`, `globals.css`.
  - Tài sản đã đầu tư là thẻ `tone="hl"` (nền xanh). Bên trong giữ đúng thứ tự: thông báo thu hồi; "{symbol} đang giữ" và số lớn; ô Giá trị theo giá phát hành kèm câu quy đổi; ô nhãn KYC, nhãn đóng băng, ví rút gọn; dòng Số dư VNDB. Hai ô giữa đặt cạnh nhau từ 640 px (nền `bg-muted` của thẻ, bo 18 px).
  - Trạng thái phát hành: giữ `dl` 5 dòng đúng thứ tự (Ký hiệu token, Tổng cung đã phát hành, Giá phát hành, Dự án, Trạng thái vận hành), dòng có kẻ ngăn; giá trị Trạng thái vận hành thành `Badge info` (giữ chữ); câu "Chưa có thị trường thứ cấp…" thành `Alert info` không `role`, đặt NGAY SAU `</dl>` (hiện nằm trong `dl`, sai HTML).
  - Giao dịch gần đây: bảng 5 cột giữ thứ tự, `Badge` trạng thái có sắc theo QĐ-5; chữ trong nhãn giữ `txn.status`.
  - Token dự án điện gió: giữ 3 liên kết đúng thứ tự `MOCK_PROJECTS`, cả dòng bấm được; mỗi dòng thêm ô biểu tượng `Wind` 40 px (`aria-hidden`) đầu dòng.
- **QĐ-4. Chi tiết token (`/tokens/[symbol]`):** ĐỔI thứ tự DOM của bốn thẻ cho đúng bản chốt: Vị thế của bạn, Thông tin dự án, Thông tin token, Tình hình vận hành (chỉ dời khối JSX nguyên vẹn, không đổi nội dung thẻ; XOÁ bốn chú thích đánh số ở `:99`, `:124`, `:163`, `:216` (dạng `{/* 1 <gạch dài> Thông tin dự án */}`) vì thứ tự số không còn đúng, heading đã nêu tên thẻ; cập nhật `docs/USER_GUIDE.md` mục 3.1.5 theo thứ tự mới). Lưới 12 cột từ 1100 px: ba thẻ đầu mỗi thẻ 4 cột, Tình hình vận hành 12 cột; dưới 1100 px một cột.
  - Đầu màn: `h1` tên dự án, ký hiệu, nhãn trên chuỗi một hàng; dòng vùng, vị trí, trạng thái giữ dưới `h1` (đây là dữ liệu, không phải câu phụ bị cấm).
  - Vị thế của bạn là thẻ `tone="hl"`. Giữ nhãn "Đang giữ" đúng chữ (e2e `ops-transactions.spec.ts:136` tìm `exact`), số lớn, dòng Giá trị theo giá phát hành, câu cuối; mọi nhánh trạng thái giữ như cũ.
  - Thông tin dự án, Thông tin token: giữ `Row` và thứ tự dòng; dòng có kẻ ngăn. KHÔNG đổi khối `<Row label="WPT dự kiến phát hành">` (test `fix-04-noi-du-lieu-that.test.ts:278` đọc nó bằng regex).
  - Tình hình vận hành: Sản lượng luỹ kế thành `Kpi tone="leaf"` (`value` là số, `unit` "MWh"); Hệ số công suất thành `Kpi` sắc thường, `value` `nfNum(…, 1)`, `unit` "%" (đúng hợp đồng `Kpi`: phần tử số chỉ chứa số). Sản lượng theo kỳ: thêm biểu đồ cột bằng `div` (`aria-hidden`, cao theo `generationMwh / max`, màu `bg-primary`, không thư viện), dưới là `ul` giữ nguyên `li` và chữ, xếp lưới 3 cột (6 cột từ 640 px); câu EnergyOracle giữ cuối thẻ.
- **QĐ-5. Tách phần trình bày để kiểm trạng thái khó tạo.** Trên mock, Tổng quan đòi ví trình duyệt nên không dựng được nhánh có số liệu của Tài sản và Giao dịch gần đây. Dời NGUYÊN VĂN (commit riêng) ra hai tệp mới trong `components/investor/`:
  - `asset-holdings.tsx`: `AssetHoldings({ data }: { data: PortfolioView })`, thân là nhánh `data` của `asset-summary.tsx:112-165`, kèm `nf` (sau khi dời, `asset-summary.tsx` không còn dùng `nf`, `Badge`, `recallNoticeText` thì bỏ import).
  - `transaction-table.tsx`: `TransactionTable({ rows }: { rows: TxnView[] })`, thân là bảng `transaction-history-box.tsx:107-168` kèm import cần cho nó.
  - Nơi gọi: `) : data ? (<AssetHoldings data={data} />) : null}` và `) : (<TransactionTable rows={rows} />)`. Ngoài đổi biến lấy từ props, không phép thay nào khác trong commit dời. Commit sau mới đổi kiểu. Checkpoint dán đoạn trước và sau.
  - Đổi kiểu trong hai tệp này: thông báo thu hồi thành `Alert warn` giữ `role="status"`, giữ hai đoạn `title`, `body`; nhãn KYC `ok` khi `whitelisted`, `bad` khi không; nhãn "đang đóng băng" `bad`; nhãn trạng thái giao dịch `CONFIRMED` `ok`, `FAILED` `bad`, còn lại `info`.
- **QĐ-6. Chữ được đổi (chỉ để bỏ ký tự cấm, theo notes):** ", " thay chấm giữa (U+00B7) ở `token-list-box.tsx:62` và `investor-token-detail.tsx:92`; "–" (U+2013) thay gạch dài (U+2014) ở giá trị trống (`token-list-box.tsx:72`, `txn.amount ?? …`); câu `investor-token-detail.tsx:263` thành "Không phải giá thị trường, hệ thống chưa có thị trường thứ cấp."; `title` mã giao dịch thành `` `${txn.txHash}, chain ${txn.chain} không có trình khám phá` ``; chú thích JSX `transaction-history-box.tsx:142` (sau khi dời nằm ở `transaction-table.tsx`) thay mũi tên ASCII (`-` liền `>`) bằng "nên". Không sửa chú thích nào khác (kể cả chú thích có gạch dài, mũi tên ASCII ở dòng bắt đầu bằng `*`, bước 6e đã lọc). Không đổi chữ nào khác; tasks bước 6d chỉ được in đúng 6 dòng liệt kê ở đó.
- **QĐ-7. Thành phần dùng chung thay khối tự viết:** các khối "Đang đọc số dư từ chuỗi…", "Đang đọc thông số token…", "Đang tải…" thành `EmptyState loading` (giữ chữ); câu lỗi đỏ (`text-destructive`) thành `Alert bad` KHÔNG thêm `role` (hiện không có); "Chưa kết nối ví" (có liên kết "Ví của tôi", giữ `prefetch={false}`), "Kết nối ví để xem giao dịch của bạn.", "Chưa có giao dịch nào" thành `EmptyState` có biểu tượng cũ, giữ chữ và cấu trúc đoạn; các câu chưa có vị thế, mời kết nối ví ở chi tiết token giữ là đoạn chữ. `WalletNotBoundNotice` thành `Alert warn` giữ `role="alert"`, `data-wallet-not-bound`, chữ và `font-code` (tệp này dùng chung với `/trade`, `/orders`, `/orders/[id]`, `/withdraw`: chỉ đổi vỏ, các màn đó đổi theo là chủ ý; trần JS riêng ở QĐ-9; ảnh `WalletNotBoundNotice` dựng ngoài repo theo mục 4 là đủ, không chụp bốn màn đó). Thẻ có `CardTitleIcon` (đặt trong `CardTitle`, biểu tượng hiện có của thẻ; thẻ chưa có thì: Tài sản đã đầu tư `Wallet`, Trạng thái phát hành `Gauge`).
- **QĐ-8. Mốc test phải giữ** (không sửa `app/test/**`, e2e có sẵn):
  - `investor-channel.spec.ts:52-55` (4 heading), `:271-276` (`WPT-PQY` mở chi tiết, heading tên dự án, chữ "chưa triển khai trên chuỗi"), `:288-289` ("Vị thế của bạn", chữ `on-chain`), `:308-326` ("unverified", "Chưa có thị trường thứ cấp", không "khối lượng giao dịch").
  - `fix-04-noi-du-lieu-that.spec.ts:35-38` (`[data-slot="card"]` lọc theo heading), `:47`, `:88-103` (chữ `LOAD_FAILED`, `title` tên mẫu); `fix-04-noi-du-lieu-that.test.ts:263-287`.
  - `ops-transactions.spec.ts:135-138`, `:214-223` ("Đang giữ", "Giá trị theo giá phát hành" exact; "Kết nối ví ở góc trên phải").
  - `fe-07-price-config.spec.ts:101-103` (`main` chứa `"{giá} ₫"`); `fe-ux-01a-nen.spec.ts:127` (không `font-mono` trong main); `fe-ux-01b-khung.spec.ts:84-85` (một `h1`, thanh đầu); `wallet-connect.spec.ts:40-46`.
  - `uiux-02-dau-man.spec.ts:35` (ô `#token-scope`); `uiux-02-dau-man.test.ts:88` (đúng một `<TokenScopeSelect`), `:201`, `:261-264`.
- **QĐ-9. Hiệu năng:** JS gzip `/portfolio`, `/tokens/WPT` mỗi trang không tăng quá 3 KB (đo theo byte so bản build mốc riêng), các trang đo khác không tăng, TRỪ bốn trang dùng chung `WalletNotBoundNotice` (QĐ-7): `/trade`, `/orders`, `/orders/[id]`, `/withdraw` được tăng, mỗi trang không quá 1 KB (đổi sang `Alert` kéo theo thành phần và biểu tượng của nó); bốn trang này đo theo byte so bản build mốc và ghi số từng trang trong checkpoint, vượt thì dừng và báo; CSS gzip không tăng quá 2 KB. Script đo ghi `hydration`, `consoleErrors`, `pageErrors` (cộng dồn 4 biến thể); `/portfolio`, `/tokens/WPT` cả ba số bằng 0, đường dẫn khác không tăng so với mốc.

## 3. Phạm vi tệp (danh sách trắng)

| Được sửa | Ghi chú |
|---|---|
| `app/src/components/pages/investor-portfolio.tsx`, `investor-token-detail.tsx` | QĐ-3, QĐ-4 |
| `app/src/components/investor/asset-summary.tsx`, `issuance-status-box.tsx`, `transaction-history-box.tsx`, `token-list-box.tsx`, `wallet-not-bound-notice.tsx` | |
| `app/src/components/investor/asset-holdings.tsx`, `transaction-table.tsx` (mới) | QĐ-5 |
| `app/e2e/fe-ux-04a-tong-quan-ndt.spec.ts`, `app/test/fe-ux-04a.test.ts` (mới) | Design mục 4 |
| `docs/tech-report.md` | CHỈ khi số dòng marker dời, chỉ đổi khối tự sinh bằng `node scripts/scan-pending.mjs --write-report` |
| `docs/fe-ux-04a-tong-quan-ndt/{requirements,design,tasks}.md`, `docs/CHECKPOINT_FEUX04A.md`, `docs/USER_GUIDE.md`, `.kiro/task-status.json` | Theo quy ước repo |

Cấm mọi tệp khác, gồm `components/investor/mock-badge.tsx`, `use-token-summary.ts`, `token-summary-state.ts`, `components/ui/**`, `components/layout/**`, `components/trading/**`, `globals.css`, `app/src/app/**`, `lib/**`, `app/test/**` có sẵn, e2e có sẵn, `package*.json`.

## 4. Điều kiện hoàn thành

- [ ] Hai màn đúng bố cục bản chốt trừ mục 1 "Không làm"; bảng đối chiếu từng dòng `notes/portfolio.md`, `notes/token-detail.md` trong checkpoint (dòng nào bỏ thì ghi lý do).
- [ ] Bố cục, thứ tự đúng QĐ-3, QĐ-4; thứ tự thẻ chi tiết token đã đổi và `docs/USER_GUIDE.md` mục 3.1.5 đã cập nhật.
- [ ] `AssetHoldings`, `TransactionTable` dời đúng QĐ-5, commit riêng; checkpoint dán đoạn trước và sau.
- [ ] Khối tự viết thay theo QĐ-7; không còn màu cứng (`amber-*`), `text-destructive` tự viết trong các tệp phạm vi.
- [ ] Chữ chỉ đổi đúng QĐ-6, QĐ-4 (tasks bước 6d in đúng 6 dòng đã liệt kê); không đổi trường, liên kết, điều kiện hiện.
- [ ] Diff giữ logic (QĐ-1, QĐ-2); checkpoint liệt kê từng đoạn đổi nằm gần hook, effect, điều kiện nhánh, kèm lý do an toàn.
- [ ] Số action khi mở màn đúng QĐ-2 (e2e ca 4 đo bốn số trên mock; số khi có ví ghi là bất biến kiểm bằng mã nguồn) và không đổi ở 28 đường dẫn; JS, CSS trong trần QĐ-9 (bảng byte sáu trang); `metrics.json` của `/portfolio`, `/tokens/WPT` có `hydration`, `consoleErrors`, `pageErrors` đều 0.
- [ ] Mốc test QĐ-8 giữ nguyên; không sửa test có sẵn.
- [ ] Ảnh 1440 và 390, Sáng và Tối, trước và sau: `/portfolio`, `/tokens/WPT`, `/tokens/WPT-PQY`, vai Nhà đầu tư. Mỗi lượt dùng một tiến trình mock MỚI khởi động (`next start` cổng khác, env như `playwright.config.ts`; trước từ bản build mốc, sau từ bản build nhánh; không dùng lại máy chủ đã chạy test, script đo hay chụp lượt trước), cùng công thức: `E2E_BASE_URL=http://localhost:<cổng> npx playwright test e2e/ops-transactions.spec.ts` (ví hồ sơ có WPT), rồi chụp.
- [ ] Trạng thái không dựng được trên mock (Tài sản có số liệu: bình thường, thu hồi NOTICE, FROZEN, CLOSED, đóng băng và chưa KYC, Số dư VNDB `null`; bảng Giao dịch 3 trạng thái, có và không có trình khám phá; `WalletNotBoundNotice`): unit test (design mục 4) và ảnh dựng ngoài repo bằng `renderToStaticMarkup` cộng CSS bản build, `page.setContent`, như 03b (Sáng, Tối, 1440, 390; Tài sản đặt trong vỏ thẻ `tone="hl"` như trên màn). Không commit script.
- [ ] `fe-ux-04a-tong-quan-ndt.spec.ts` (project mock) đủ 4 ca và `fe-ux-04a.test.ts` đủ 4 nhóm (design mục 4), xanh.
- [ ] Kiểm thử đúng mục 5, đạt, kèm log; log có mục "EVM - E2E PROJECT HARDHAT" xanh.
- [ ] Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 6) đúng kỳ vọng.
- [ ] Không mã dư thừa: hằng, hàm, import, lớp không còn dùng xoá hẳn.

## 5. Phạm vi kiểm thử

| Ai | Chạy | Không chạy |
|---|---|---|
| Dev | `bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm` một lần, lưu log; đo bằng `tools/20261104_do_moc_measure.js` (gửi kèm, sha256 `6079a0d679000d4c2bbe559d5a3eb90d362bb018243d45c0888f2fad26cdae1c`, bản này nhận đường dẫn động trong `JS_PAGES`; `JS_PAGES=/,/portfolio,/trade,/approvals,/tokens/WPT,/orders,DYN:/orders,/withdraw`), JS sáu trang `/portfolio`, `/tokens/WPT`, `/trade`, `/orders`, `/orders/[id]`, `/withdraw` theo byte so bản mốc build riêng, CSS theo cách 01c. Gửi riêng đoạn log từ "EVM - E2E PROJECT HARDHAT" tới hết | `contracts` |
| Supervisor | Đọc diff, đối chiếu commit dời; build; chạy `fe-ux-04a-tong-quan-ndt`, `investor-channel`, `fix-04-noi-du-lieu-that` (e2e và unit), `ops-transactions`, `uiux-02-dau-man` (e2e và unit), unit test mới; gây lỗi có chủ đích 4 điểm (trong `AssetHoldings` bỏ nhãn "đang đóng băng"; trong `TransactionTable` dựng liên kết cả khi `url` rỗng; ở chi tiết token cho dự án chưa lên chuỗi hiện khối "Đang giữ"; thêm một lời gọi `getPortfolioAction(` vào `asset-summary.tsx`); xem ảnh | Full suite |
