# FE-UX-04b: Giao dịch token (`/trade`)

| | |
|---|---|
| Nhánh | `feat/fe-ux-04b-giao-dich` từ `release/ui-v2` @ `ad133aa` hoặc sau. Nếu PR khác (FE-UX-04a) merge vào `release/ui-v2` trong lúc làm: rebase lên head mới, đo lại TOÀN BỘ mốc (JS, CSS, action, lỗi, `role`, ảnh trước) từ merge-base mới; checkpoint ghi merge-base đã dùng |
| PR | Một PR, **base `release/ui-v2`**, KHÔNG vào `dev`. Không tự merge |
| Loại | Frontend thuần. Không `lib/`, `app/actions`, `app/api`, route `app/src/app/**`; không thêm gói npm; không sửa `components/ui/*`, `components/investor/*`, `components/wallet/*`, `components/recall/*`, `components/token/*`, `components/trading/{gates,sides,settlement-progress,order-detail-content,order-status-tone}.*` (thiếu gì thì báo) |
| Mức kiểm thử | **B**, phạm vi ở mục 5 (có Hardhat: `permit-order.spec.ts` đặt lệnh có chữ ký trên `/trade`) |
| Song song | Song song được với FE-UX-04a (khác tệp mã; 04a đổi vỏ `WalletNotBoundNotice` mà màn này dùng, không ảnh hưởng mã 04b). Hai PR cùng sửa `docs/USER_GUIDE.md`, `.kiro/task-status.json`: PR merge sau tự gộp, chỉ ở phần của mình |
| Tách task | FE-UX-04 tách 4 phần: 04a Tổng quan và chi tiết token; **04b Giao dịch token** (màn nhiều trạng thái nhất, đi riêng); 04c Quản lý lệnh, Chi tiết lệnh, Kết nối ví; 04d Rút VNDB |
| Nguồn | Kế hoạch 03/11; `docs/20261101_UI_UX_BAN_GIAO_SUPERVISOR.md` mục 4.4, 6, 7.1, 8; bản chốt `trade.html`, `assets/c.css`; `notes/trade.md` (đã cũ ở ô Token: nay là `TokenScopeSelect` của UIUX-02, không còn `select`) |
| Thứ tự ưu tiên khi nguồn xung đột | Spec này, rồi kế hoạch 03/11, rồi mã `release/ui-v2` @ `ad133aa`, rồi tài liệu bàn giao, `docs/USER_GUIDE.md` và notes, cuối cùng là bản xem thử |

## 1. Mục tiêu

Vẽ lại `/trade` theo bản chốt bằng thành phần dùng chung (`Card` sắc, `CardTitleIcon`, `Alert`, `EmptyState`, `Badge` sắc, `fieldClass`). Không đổi câu chữ, trường, thứ tự trường, nút, nhãn nút theo bước ký, điều kiện khoá, lời gọi server action, số action khi mở màn, hộp đối chiếu.

Không làm: câu phụ dưới tiêu đề (test cấm: `uiux-02-dau-man.test.ts:202`, `:261-264`, câu cũ "Mua token từ người bán theo giá phát hành"); hậu tố "WPT" trong ô Số lượng (bản chốt thêm, đổi ô); đổi ô Số lượng sang `AmountInput`; nút X riêng cho hộp đối chiếu (giữ `Dialog` như hiện có); đổi `SettlementProgress` (đã làm ở FE-UX-02a); biểu tượng trang trí trên nút; hiệu ứng (FE-UX-08); sửa lệch trong notes (nhãn "Đã phát hành", số dư VNDB).

## 2. Quyết định (QĐ)

- **QĐ-1. Không đổi logic.** Giữ nguyên trong `investor-trade.tsx`: mọi `useState`, `useRef`, ba effect (bối cảnh, xem trước có hoãn, theo dõi lệnh) với điều kiện, mảng phụ thuộc, `cancelled`, `clearTimeout`, `clearInterval`; `contextKey`, `previewKey`, `intent`, `freshPrepared`; `preparePermit`, `openConfirm`, `submit` (gồm `requestRef`, thứ tự `setSignPhase`, câu huỷ ký); `walletBlocked`; điều kiện `return <ConnectWalletPrompt />`; mọi `disabled` (Token theo `tradeBlocked`; tab chiều lệnh theo `tradeBlocked`; Số lượng theo `tradeBlocked || !ctx.walletBound`; nút xác nhận theo `blockReason`; nút gửi theo `submitting || blockReason !== null || walletBlocked || signPhase === 'preparing'`; Quay lại theo `submitting`); nhãn nút gửi theo `signPhase`, `needsPermit`, `submitting`. Diff chỉ là vỏ JSX, `className`, thay khối tự viết bằng thành phần dùng chung có cùng chữ và thuộc tính, và việc dời ở QĐ-5.
- **QĐ-2. Số action khi mở màn giữ nguyên: 1** (`getTradeContextAction`; chain mock dùng ví hồ sơ). Lời gọi trong mã `investor-trade.tsx` giữ đúng: 1 `getTradeContextAction(`, 1 `previewTradeAction(`, 1 `listOrdersAction(`, 1 `placeOrderAction(`, 1 `preparePermitAction(`, 3 `useEffect(`; `trade-panels.tsx`, `trade-check-block.tsx` không có `Action(`, `useEffect(`, `useState(` (unit nhóm 1). Số 1 khi mở đo lúc chạy bằng e2e ca 4.
- **QĐ-3. Bố cục.** Đầu màn chỉ `h1` "Giao dịch token" (Token giữ trong thẻ Đặt lệnh như hiện tại và như bản chốt; test không khoá vị trí này, nhưng không dời). Dòng chế độ mô phỏng thành `Alert info` GIỮ `role="note"`, giữ chữ và ví `font-code` (e2e `investor-channel.spec.ts:223`, `ops-transactions.spec.ts:89` gọi `getByRole('note')` chế độ strict, `ops-transactions` gọi trên cả trang: trên toàn trang `/trade` chỉ được có đúng MỘT `role="note"`). Lưới 12 cột từ 1100 px (dưới đó một cột), giữ thứ tự DOM: thẻ Đặt lệnh 7 cột; cột phải 5 cột gồm Tóm tắt lệnh rồi Thông tin token; thẻ Lệnh vừa gửi rộng hết hàng dưới lưới.
- **QĐ-4. Thẻ Đặt lệnh**, giữ thứ tự khối: thông báo ví chưa định danh; khung giao dịch tạm dừng; Token; tab chiều lệnh (khi có); Số lượng; Giá; Tổng giá trị dự kiến; khối kiểm tra; nút xác nhận và hai câu dưới nút.
  - Khung giao dịch tạm dừng (hiện màu cứng `amber-*`) thành `Alert warn` GIỮ `role="alert"`, giữ ba phần: "Giao dịch tạm dừng" (đậm), `tradeBlockText`, liên kết "Xem thông báo ở Tổng quan" (`prefetch={false}`).
  - Tab chiều lệnh giữ `role="tablist" aria-label="Chiều lệnh"`, mỗi nút giữ `role="tab"`, `aria-selected`, `variant` theo `side`, `disabled`; vỏ là cụm bo tròn `bg-muted p-1`, hai nút chia đều rộng hết thẻ (design mục 1).
  - Số lượng và Giá cùng hàng từ 640 px. Hai `input` giữ `aria-label`, `inputMode`, `value`, `aria-invalid`, `disabled`, `readOnly`, `onChange`; lớp `fieldClass` (cộng `aria-invalid:border-destructive` cho ô Số lượng); `FIELD` xoá. Giữ `data-testid="quantity-cap"`, câu lỗi `role="alert"` (màu chữ đổi `text-destructive` thành `text-bad-ink`).
  - Tổng giá trị dự kiến thành ô `tile-gold rounded-[18px] px-4 py-3` (nhãn trái, số phải), giữ chữ "Chưa có".
  - Nút xác nhận giữ chữ `Xác nhận lệnh {mua|bán}`, rộng hết thẻ.
- **QĐ-5. Tách phần trình bày (commit riêng, dời NGUYÊN VĂN).** Dời từ `investor-trade.tsx` sang tệp mới `components/trading/trade-panels.tsx`: `PermitNotice` (`:427-473`), `Row` (`:478-485`), `OrderSummary` (`:487-518`), `TOKEN_STATUS_LABELS` và `TokenInfoCard` (`:520-562`), `TrackedOrder` (`:564-593`), `ConnectWalletPrompt` (`:595-609`), kèm import chúng cần. Phép thay duy nhất: thêm `export` trước các hàm trang còn dùng (`PermitNotice`, `Row`, `OrderSummary`, `TokenInfoCard`, `TrackedOrder`, `ConnectWalletPrompt`); trang nhập lại các tên đó; import không còn dùng trong trang thì bỏ. `FIELD`, `SIGN_PHASE_LABELS`, `PREVIEW_DEBOUNCE_MS`, `TRACK_INTERVAL_MS` ở lại trang. Checkpoint dán đoạn trước và sau. Commit sau mới đổi kiểu.
- **QĐ-6. Đổi kiểu trong `trade-panels.tsx`, `trade-check-block.tsx`:**
  - `OrderSummary` thành `Card tone="hl"`, giữ `aria-label="Tóm tắt lệnh"`, thêm lớp `[--card:var(--tile-hl-chip)] [--border:var(--tile-hl-chip)]` (như FE-UX-04a QĐ-3); giữ 6 dòng đúng thứ tự, "Không có" khi `balances` rỗng; số Tổng giá trị dự kiến màu `text-(--tile-hl-bar)`.
  - `TokenInfoCard` giữ `aria-label="Thông tin token"`, bỏ `bg-muted/30`, `CardTitleIcon` `Wind` (thay biểu tượng rời bên phải); 9 dòng đúng thứ tự; nhãn Trạng thái giao dịch `Badge` `ok` khi `tradingOpen`, `warn` khi không (chữ giữ `tradingStatusLabel`).
  - `Row`: dòng kẻ ngăn `py-2.5`; giữ cặp `dt`, `dd` anh em trong một `div`; thêm prop tuỳ chọn `valueClassName` nối vào lớp của `dd` (dùng cho số Tổng giá trị dự kiến của `OrderSummary`); prop `mono` đổi nghĩa thành số (`tabular-nums font-semibold`), không `font-code` (chữ số theo bản chốt; mã, ví vẫn `font-code` ở chỗ khác).
  - `TrackedOrder` giữ `aria-label="Lệnh vừa gửi"`, tiêu đề, liên kết "Xem chi tiết" (`prefetch={false}`), câu đang quyết toán, mã giao dịch `font-code break-all`; `order.reason` thành `Alert bad` KHÔNG `role`; `SettlementProgress` giữ nguyên.
  - `PermitNotice`: giữ `data-testid="permit-notice"` và chữ; khung thành `rounded-[14px] bg-muted p-3`; câu `blockedReason` thành `Alert bad` không `role`; `WrongChainBanner` giữ nguyên.
  - `ConnectWalletPrompt` thành `EmptyState` biểu tượng `Wallet`, giữ hai câu và liên kết "Ví của tôi" (`prefetch={false}`).
  - `TradeCheckBlock`: giữ `section aria-label="Khối kiểm tra trước lệnh"`, `h3` "Kiểm tra trước lệnh" (thêm biểu tượng `ShieldCheck` `aria-hidden`), mỗi `li` giữ `key`, `data-check`, `data-passed`, biểu tượng có `aria-label` "đạt"/"không đạt", chữ "Đạt"/"Không đạt: {detail}", `howToFix`; màu `text-destructive` của biểu tượng `XCircle` và câu không đạt đổi thành `text-bad-ink` (`text-primary` của `CheckCircle2` giữ); `li` thành ô `rounded-[14px] bg-muted/60 px-3 py-2.5`; lỗi xem trước (hiện `text-destructive`) thành `Alert bad` không `role`; `WalletNotBoundNotice` giữ.
- **QĐ-7. Trang (`investor-trade.tsx`) sau khi dời:** đang tải "Đang đọc số dư và thông tin token…" thành `EmptyState loading`; lỗi bối cảnh thành `Alert bad` không `role`; câu dưới nút: `blockReason` giữ chữ phụ, `submitError` thành `Alert bad` không `role`. Hộp đối chiếu: giữ `DialogTitle`, `DialogDescription`, 4 `Row`, `PermitNotice`, nút; `dialogNote` thành `Alert bad` GIỮ `role="alert"` và `data-testid="sign-note"`. Thẻ có `CardTitleIcon` đặt TRONG `CardTitle` như FE-UX-04a: Đặt lệnh `ShoppingCart`, Tóm tắt lệnh `ReceiptText`, Thông tin token `Wind`. Không thêm `role="heading"` cho `CardTitle` của màn này (e2e tìm "Đặt lệnh" bằng `getByText` exact, giữ được khi biểu tượng `aria-hidden`).
- **QĐ-8. Mốc test phải giữ** (không sửa `app/test/**`, e2e có sẵn):
  - `ops-transactions.spec.ts:89-98`, `:142-154` (note strict; `getByLabel('Số lượng')`; nút "Xác nhận lệnh mua", "Xác nhận lệnh bán"; tab "Bán"; `dialog` nút "Gửi lệnh"; `getByLabel('Lệnh vừa gửi')`, liên kết "Xem chi tiết", chữ "Hoàn tất", "Mã giao dịch").
  - `permit-order.spec.ts:130-187` (Hardhat: `permit-notice`, "Ký và đặt lệnh", `sign-note` "Bạn đã huỷ ký", "Lệnh vừa gửi" đếm 0).
  - `recall.spec.ts:106-108`, `:147-148` ("Giao dịch tạm dừng" exact; Số lượng, nút xác nhận khoá).
  - `investor-channel.spec.ts:222-223` ("Đặt lệnh" exact trong `main`; note); `fe-07-price-config.spec.ts:98-99` (`input[aria-label="Giá"]`; `dt` "Giá phát hành" và `dd` ngay sau là anh em: `Row` giữ cặp `dt`, `dd` cùng cha); `permit-order.spec.ts:128` (heading "Giao dịch token").
  - `uiux-02-dau-man.test.ts:86-95` (`<TokenScopeSelect` một lần, `disabled={tradeBlocked}`, không `<select aria-label="Token"`, không `ctx.tokens.length <= 1`), `:202`, `:261-264` (câu cũ); `uiux-02-dau-man.spec.ts:34`, `:47-58` (`#token-scope` hiện, bật), `:160`, `:226-233` (đúng một `h1` trong `main`, không câu cũ); `four-roles-shell.test.ts:127`.
- **QĐ-9. Hiệu năng:** JS gzip `/trade` không tăng quá 3 KB (theo byte so bản build mốc riêng); các trang đo khác không tăng; CSS gzip không tăng quá 2 KB. `metrics.json` của `/trade` có `hydration`, `consoleErrors`, `pageErrors` bằng 0; đường dẫn khác không tăng so với mốc.

## 3. Phạm vi tệp (danh sách trắng)

| Được sửa | Ghi chú |
|---|---|
| `app/src/components/pages/investor-trade.tsx` | QĐ-1, QĐ-3, QĐ-4, QĐ-7 |
| `app/src/components/trading/trade-panels.tsx` (mới), `trade-check-block.tsx` | QĐ-5, QĐ-6 |
| `app/e2e/fe-ux-04b-giao-dich.spec.ts`, `app/test/fe-ux-04b.test.ts` (mới) | Design mục 3 |
| `docs/tech-report.md` | CHỈ khi số dòng marker dời, chỉ đổi khối tự sinh bằng `node scripts/scan-pending.mjs --write-report`. Không sửa bảng tệp viết tay (thiếu `trade-panels.tsx` là nợ tài liệu, ghi trong checkpoint) |
| `docs/fe-ux-04b-giao-dich/{requirements,design,tasks}.md`, `docs/CHECKPOINT_FEUX04B.md` (và `docs/CHECKPOINT_FEUX04B_DETAIL.md` nếu checkpoint quá 800 dòng, `check-checkpoint.mjs:69`), `docs/USER_GUIDE.md`, `.kiro/task-status.json` | Theo quy ước repo |

Cấm mọi tệp khác (xem dòng Loại), gồm `globals.css`, `app/src/app/**`, `lib/**`, `app/test/**` có sẵn, e2e có sẵn, `package*.json`.

## 4. Điều kiện hoàn thành

- [ ] Màn đúng bố cục bản chốt trừ mục 1 "Không làm"; bảng đối chiếu từng dòng `notes/trade.md` trong checkpoint (dòng nào bỏ thì ghi lý do).
- [ ] Bố cục, thứ tự đúng QĐ-3, QĐ-4; trong `main` đúng một `role="note"`.
- [ ] Sáu phần dời đúng QĐ-5 (chỉ thêm `export`), commit riêng; checkpoint dán đoạn trước và sau.
- [ ] Đổi kiểu đúng QĐ-6, QĐ-7; không còn `amber-*`, `text-destructive`, `FIELD` trong các tệp phạm vi (`aria-invalid:border-destructive` của ô Số lượng được giữ).
- [ ] Không đổi chữ, trường, nút, điều kiện khoá (tasks bước 6d rỗng hoặc chỉ mảnh chữ do tách phần tử, giải thích từng dòng).
- [ ] Diff giữ logic (QĐ-1, QĐ-2); checkpoint liệt kê từng đoạn đổi nằm gần hook, effect, handler, điều kiện khoá, kèm lý do an toàn.
- [ ] Số action khi mở `/trade` đúng 1 (e2e ca 4) và không đổi ở 28 đường dẫn; JS, CSS trong trần QĐ-9; `metrics.json` của `/trade` ba số lỗi bằng 0.
- [ ] Mốc test QĐ-8 giữ nguyên; không sửa test có sẵn.
- [ ] Ảnh 1440 và 390, Sáng và Tối, trước và sau, vai Nhà đầu tư, mỗi lượt một tiến trình mock MỚI khởi động (trước từ bản build mốc, sau từ bản build nhánh; không dùng lại máy chủ đã chạy test, script đo hay chụp lượt trước), cùng công thức. Tiến trình: `npx next start --port <cổng>` với ĐỦ biến môi trường của `webServer.env` trong `playwright.config.ts:93-108` (`E2E_BASE_URL` tắt `webServer` nên không tự có: thiếu `USE_MOCK_DB`, `ENABLE_DEMO_PAYMENT_MINT`, `ENABLE_INVESTOR_SELL` là `ops-transactions` hỏng). Rồi `E2E_BASE_URL=http://localhost:<cổng> npx playwright test e2e/ops-transactions.spec.ts` (có nguồn cung, ví hồ sơ có VNDB); rồi chụp (a) `/trade` vừa mở; (b) nhập "1" chờ đủ 5 `li[data-check]`; (c) bấm xác nhận, chụp hộp đối chiếu; (d) gửi, chờ "Hoàn tất", chụp thẻ Lệnh vừa gửi. Script chụp ngoài repo, không commit.
- [ ] Trạng thái không dựng được trên mock (khối kiểm tra có điều kiện "Không đạt", lỗi xem trước, ví chưa định danh; khung giao dịch tạm dừng; lệnh bị từ chối có lý do; `PermitNotice` đang chuẩn bị, đã chuẩn bị, không ký được; Thông tin token khi chưa có dự án; Tóm tắt lệnh khi `balances` rỗng): unit test (design mục 3) và ảnh dựng ngoài repo bằng `renderToStaticMarkup` cộng CSS bản build, `page.setContent`, như 03b (Sáng, Tối, 1440, 390; Tóm tắt lệnh trong vỏ thẻ của nó). Khung giao dịch tạm dừng là khối trong trang: dựng ảnh bằng `Alert warn` với đúng ba phần tử như trang, hoặc chụp sau khi chạy `recall.spec.ts` tới bước đến hạn, ghi cách đã dùng.
- [ ] `fe-ux-04b-giao-dich.spec.ts` (project mock) đủ 4 ca và `fe-ux-04b.test.ts` đủ 7 nhóm (design mục 3), xanh.
- [ ] Kiểm thử đúng mục 5, đạt, kèm log; log có mục "EVM - E2E PROJECT HARDHAT" xanh (có `permit-order`).
- [ ] Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 6) đúng kỳ vọng.
- [ ] Không mã dư thừa: hằng, hàm, import, lớp không còn dùng xoá hẳn.

## 5. Phạm vi kiểm thử

| Ai | Chạy | Không chạy |
|---|---|---|
| Dev | `bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm` một lần, khi cổng e2e trống, lưu log; đo bằng `tools/20261104_do_moc_measure.js` (gửi kèm, sha256 `6079a0d679000d4c2bbe559d5a3eb90d362bb018243d45c0888f2fad26cdae1c`; `JS_PAGES=/,/portfolio,/trade,/approvals`), JS `/trade` theo byte so bản mốc build riêng, CSS theo cách 01c. Gửi riêng đoạn log từ "EVM - E2E PROJECT HARDHAT" tới hết | `contracts` |
| Supervisor | Đọc diff, đối chiếu commit dời; build; chạy `fe-ux-04b-giao-dich`, `investor-channel`, `ops-transactions`, `recall`, `uiux-02-dau-man` (e2e và unit), unit test mới; gây lỗi có chủ đích 4 điểm (bỏ riêng `|| !ctx.walletBound` khỏi `disabled` của ô Số lượng, unit nhóm 1 phải bắt; thêm `role="note"` vào câu `blockReason`; trong `TradeCheckBlock` đổi `aria-label="không đạt"` thành "đạt"; thêm một lời gọi `getTradeContextAction(` vào trang); xem ảnh | Full suite |
