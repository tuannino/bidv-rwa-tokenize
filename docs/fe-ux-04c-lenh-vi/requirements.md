# FE-UX-04c: Quản lý lệnh (`/orders`), Chi tiết lệnh (`/orders/[id]`), Ví của tôi (`/wallet`)

| | |
|---|---|
| Nhánh | `feat/fe-ux-04c-lenh-vi` từ `release/ui-v2` @ `e914807` (sau FE-UX-04a) hoặc sau. Nếu PR khác (FE-UX-04b) merge vào `release/ui-v2` trong lúc làm: rebase lên head mới, chạy lại TOÀN BỘ kiểm thử mục 5 (`arch markers checkpoint app build e2e evm`), không chỉ đo hiệu năng và chụp ảnh (`WrongChainBanner` sửa ở đây được `/trade` của 04b dùng), và đo lại TOÀN BỘ mốc (JS, CSS, action, lỗi, `role`, ảnh trước) từ merge-base mới; checkpoint ghi merge-base đã dùng và log của lần chạy sau rebase |
| PR | Một PR, **base `release/ui-v2`**, KHÔNG vào `dev`. Không tự merge |
| Loại | Frontend thuần. Không `lib/`, `app/actions`, `app/api`, route `app/src/app/**`; không thêm gói npm; không sửa `components/ui/*`, `components/investor/*`, `components/trading/*`, `components/layout/*` (thiếu gì thì báo) |
| Mức kiểm thử | **B**, phạm vi ở mục 5 (có Hardhat: lệnh `evm` chạy TOÀN BỘ project Hardhat; trong đó hai bộ liên quan trực tiếp là `wallet-connect.spec.ts` và `permit-order.spec.ts`, mở `/wallet` và `permit-order` kết nối ví thật) |
| Song song | Song song được với FE-UX-04b (khác tệp mã). `WrongChainBanner` sửa ở đây cũng được `/trade` dùng trong hộp ký (04b dời nguyên văn, không sửa tệp này): đổi vỏ là chủ ý, trần JS ở QĐ-9. Hai PR cùng sửa `docs/USER_GUIDE.md`, `.kiro/task-status.json`: PR merge sau tự gộp, mỗi mã ở đúng một danh sách |
| Nguồn | Kế hoạch 03/11; `docs/20261101_UI_UX_BAN_GIAO_SUPERVISOR.md` mục 4.4, 6, 7.1, 8; bản chốt `orders.html`, `order-detail.html`, `wallet.html`, `assets/c.css`; `notes/orders.md`, `notes/order-detail.md`, `notes/wallet.md` |
| Thứ tự ưu tiên khi nguồn xung đột | Spec này, rồi kế hoạch 03/11, rồi mã `release/ui-v2` @ `e914807`, rồi tài liệu bàn giao, `docs/USER_GUIDE.md` và notes, cuối cùng là bản xem thử |

## 1. Mục tiêu

Vẽ lại ba màn theo bản chốt bằng thành phần dùng chung (`Card` sắc, `CardTitleIcon`, `Kpi`, `Alert`, `EmptyState`, `Badge` sắc, `fieldClass`). Không đổi câu chữ (trừ QĐ-7), trường, thứ tự trường, cột, nút, liên kết, điều kiện hiện, lời gọi server action, số action khi mở màn.

Không làm: câu phụ dưới tiêu đề (test cấm: `uiux-02-dau-man.test.ts:200`, `:215`, `:261-264`); thêm `aria-label` cho bảng lệnh; thêm tiêu đề màn vào nhánh "Chưa kết nối ví" của `/orders` (trả về sớm như hiện tại); nhãn hiện cho 5 ô lọc (giữ `aria-label`, placeholder); `OrderDetailContent`, `SettlementProgress` (đã làm ở FE-UX-02a); minh hoạ tua-bin, hiệu ứng (FE-UX-08); sửa lệch trong notes (ô lọc UUID đủ 36 ký tự, nhãn ngày).

## 2. Quyết định (QĐ)

- **QĐ-1. Không đổi logic.** Giữ nguyên: `investor-orders.tsx` (state `filters`, `sort`, `loaded`; `query`, `requestKey`; effect; điều kiện trả về sớm; `fresh`, `rows`, `set`, `toggleSort`; `COLUMNS`; `SortIcon`); `investor-order-detail.tsx` (state, `requestKey`, effect, bốn nhánh trả về và thứ tự của chúng); `wallet-connect.tsx` (`useWalletStatus`, `switch` trong `renderStatus` và props truyền xuống, `UseWalletChainButton`); `wallet-status-card.tsx` (`useNativeBalance`, `explorerAddressUrl`, `CopyAddressButton` và state của nó); `wrong-chain-banner.tsx` (props, điều kiện `switching`, `error`, `children`). Diff chỉ là vỏ JSX, `className`, thay khối tự viết bằng thành phần dùng chung có cùng chữ và thuộc tính, thêm `export` ở QĐ-6.
- **QĐ-2. Số action khi mở màn giữ nguyên:** `/orders` 1 (`listOrdersAction`); `/orders/[id]` 1 (`getOrderDetailAction`, kể cả mã lệnh không tồn tại); `/wallet` 0. Trong mã: `investor-orders.tsx` 1 `listOrdersAction(`, 1 `useEffect(`; `investor-order-detail.tsx` 1 `getOrderDetailAction(`, 1 `useEffect(`; `wallet-connect.tsx`, `components/wallet/*` không có `Action(` (unit nhóm 1). Ba số trên mock đo lúc chạy bằng e2e ca 5.
- **QĐ-3. Quản lý lệnh (`/orders`):**
  - Đầu màn `h1` "Quản lý lệnh" (`text-2xl font-semibold tracking-tight`). Dòng chế độ mô phỏng thành `Alert info` GIỮ `role="note"`, chữ và ví `font-code` (`investor-channel.spec.ts:237` gọi `main.getByRole('note')` strict: trong `main` đúng MỘT `role="note"`).
  - Thẻ Bộ lọc: `CardTitleIcon` `Filter` trong `CardTitle`; `form role="search"` lưới 5 cột từ 1100 px, 2 cột từ 640 px, 1 cột dưới đó; 5 ô giữ `aria-label`, `placeholder`, `value`, `onChange`, `type`, thứ tự; lớp `fieldClass`; ô Mã lệnh có biểu tượng `Search` trang trí (`aria-hidden`, `pointer-events-none`) trong khung ô; `FIELD` xoá.
  - Thẻ bảng: không tiêu đề như hiện tại. Nút tiêu đề cột giữ `type`, `onClick`, `aria-label`, chữ, `SortIcon`. Nhãn trạng thái `Badge variant={orderStatusTone(order.status)}` (`components/trading/order-status-tone.ts`, đã dùng ở màn Giao dịch của vận hành), chữ giữ `ORDER_STATUS_LABELS`. Liên kết "Chi tiết" giữ `prefetch={false}`, `href`, chữ; thêm `ChevronRight` `aria-hidden`.
  - Nhánh trạng thái: "Đang tải lệnh…" thành `EmptyState loading`; lỗi thành `Alert bad` KHÔNG `role`; "Không có lệnh nào khớp bộ lọc." thành `EmptyState`; `WalletNotBoundNotice` giữ. Trả về sớm "Chưa kết nối ví" thành `EmptyState` biểu tượng `Wallet`, giữ hai câu.
- **QĐ-4. Chi tiết lệnh (`/orders/[id]`):** chỉ đổi vỏ các nhánh của trang (giữ nguyên điều kiện `fresh.error || !fresh.data`; khi `error` rỗng thì `Alert` rỗng, như `p` rỗng hiện tại): "Chưa kết nối ví" thành `EmptyState` biểu tượng `Wallet` (giữ chữ đúng, `ops-transactions.spec.ts:220` tìm `exact`); "Đang tải lệnh…" thành `EmptyState loading`; lỗi thành `Alert bad` không `role`. `OrderDetailContent` giữ nguyên.
- **QĐ-5. Ví của tôi (`/wallet`):**
  - Đầu màn `h1` "Ví của tôi" (`text-2xl font-semibold tracking-tight`).
  - `MockNotice`, `UnsupportedChainNotice`, `DisconnectedCard`, `NoWalletGuide`: giữ `CardTitle role="heading" aria-level={2}` và chữ; biểu tượng tiêu đề thành `CardTitleIcon` trong `CardTitle` (giữ biểu tượng hiện có). `DisconnectedCard` giữ `ConnectButton.Custom` và nút "Kết nối ví". `NoWalletGuide` giữ `ol` 3 bước, `Step`, hai liên kết tải ví (`target`, `rel`, chữ "(mở tab mới)").
  - `WalletScopeNote` thành `Alert info` KHÔNG `role` (e2e `wallet-connect.spec.ts:81` đòi `main` không có `role="alert"` ở chế độ mô phỏng), biểu tượng `ShieldCheck` qua prop `icon`.
  - `WrongChainBanner` thành `Alert bad` GIỮ `role="alert"`, biểu tượng `TriangleAlert` qua prop `icon`; giữ hai đoạn chữ, nút chuyển (chữ theo `switching`, `disabled`, `Loader2`), `children`, câu lỗi `role="status"` (màu `text-bad-ink` thay `text-destructive`).
  - `WalletStatusCard` (trạng thái đã kết nối) thành khung `grid gap-6 min-[1100px]:grid-cols-12` (dưới 1100 px một cột): thẻ `Card tone="hl"` lớp `min-[1100px]:col-span-7` (thêm lớp `[--card:var(--tile-hl-chip)] [--border:var(--tile-hl-chip)]` như FE-UX-04a) giữ tiêu đề "Ví đã kết nối" (`CardTitleIcon` `Wallet` trong `CardTitle`), nhãn mạng, Địa chỉ ví (rút gọn `font-code` cỡ lớn, `title`, đoạn `sr-only` địa chỉ đầy đủ: `permit-order.spec.ts:123` kiểm `main` chứa địa chỉ đầy đủ), nút sao chép, nút xem trên explorer, dòng cuối "Số WPT đang giữ xem ở trang Tổng quan." và nút "Ngắt kết nối"; ba nút (sao chép, explorer, ngắt kết nối) giữ `variant="outline"` và thêm lớp `border-transparent bg-(--tile-hl-chip) text-(--tile-hl-ink) hover:bg-(--tile-hl-chip) hover:opacity-90` (`tile-hl` đổi chữ thành trắng còn nút viền nền sáng, thiếu lớp này thì chữ trắng trên nền gần trắng); khối số dư đồng bản địa thành `Kpi tone="gold"` lớp `min-[1100px]:col-span-5`, đặt SAU thẻ trong DOM: `label={<>Số dư {info.nativeCurrency?.symbol ?? 'đồng bản địa'}</>}` (giữ dạng JSX như hiện tại, không đổi sang chuỗi mẫu, để 6d không đổi mảnh chữ); `value` là `balance.amount` (có thì `unit` là `balance.symbol`), đang đọc thì một `span` nội dòng (`inline-flex items-center gap-1.5 text-base`) chứa `Loader2` và chữ "đang đọc…" (KHÔNG dùng `p` hay `div`: `Kpi` đặt `value` trong `p`), không có thì "chưa có"; câu lỗi (`text-bad-ink`) và câu "Đây là đồng của …" đặt trong `children` của `Kpi`. Chữ giữ nguyên; giữ mọi chú thích có sẵn của tệp (`:43`, `:75`, `:97-110`) trừ dòng `:98` sửa theo QĐ-7.
  - `WalletSkeleton` giữ `aria-busy`, chữ `sr-only`; được đổi kích thước khối khung cho gần bố cục mới (cùng khung lưới: một khối `min-[1100px]:col-span-7`, một khối `min-[1100px]:col-span-5`).
- **QĐ-6. Thêm `export` cho `UnsupportedChainNotice`** trong `wallet-connect.tsx` (trạng thái mạng không thuộc EVM không chọn được trên giao diện vì Stellar đang khoá, `wallet-connect.spec.ts:169-179`): chỉ thêm từ khoá `export`, không dời tệp, để unit test dựng được.
- **QĐ-7. Chữ được đổi (chỉ để bỏ ký tự cấm):** `wallet-connect.tsx:143` gạch dài (U+2014) thành dấu phẩy ("…ở chế độ này, kết quả là số liệu mô phỏng…"); `:196-198` bỏ chấm giữa (U+00B7) và khoảng trắng đầu mỗi `li`, danh sách dùng `list-disc pl-5`; `:246` gạch dài thành dấu phẩy ("…chưa phải đăng nhập, vai trò hiện tại…"). Chú thích JSX không bắt đầu bằng `*` chứa gạch dài (`wallet-connect.tsx:87`, `:203`, `wallet-status-card.tsx:98`) viết lại bằng dấu hai chấm hoặc dấu phẩy. Không đổi chữ nào khác (tasks bước 6d chỉ in các dòng cũ ở đúng các vị trí này).
- **QĐ-8. Mốc test phải giữ** (không sửa `app/test/**`, e2e có sẵn):
  - `wallet-connect.spec.ts:40-50` (menu và `h1` "Ví của tôi" level 1), `:64-84` (heading "Đang ở chế độ mô phỏng", chữ "không cần ví thật", `main` không `role="alert"`, không "Ví đang ở mạng khác", không heading "Chưa có ví…", "Chưa kết nối ví"), `:91-116` (heading "Chưa có ví trong trình duyệt", liên kết MetaMask, "Tải lại trang này", không thuật ngữ kỹ thuật trong `main`), `:127-162` (heading "Chưa kết nối ví", nút "Kết nối ví" trong `main`), `:182-203` (không lỗi lệch kết xuất), `:230-240` (Người bán vào được, `h1`).
  - `permit-order.spec.ts:119-124` (`main` chứa địa chỉ ví đầy đủ sau khi kết nối, Hardhat).
  - `investor-channel.spec.ts:233-238` (heading "Quản lý lệnh", note strict, không "Chưa kết nối ví"); `ops-transactions.spec.ts:123-128` (dòng chứa 8 ký tự mã lệnh, chữ "Hoàn tất", liên kết "Chi tiết"), `:214-221` ("Chưa kết nối ví" exact ở `/orders/[id]` khi đổi sang Hardhat).
  - `uiux-02-dau-man.test.ts:200`, `:215`, `:261-264`; `four-roles-shell.test.ts:127`.
- **QĐ-9. Hiệu năng:** JS gzip `/orders`, `/orders/[id]`, `/wallet` mỗi trang không tăng quá 3 KB (theo byte so bản build mốc riêng); `/trade` (dùng `WrongChainBanner`) không tăng quá 1 KB; các trang đo khác không tăng; CSS gzip không tăng quá 2 KB. `metrics.json` của `/orders`, `/orders/[id]`, `/wallet` ba số lỗi bằng 0; đường dẫn khác không tăng so với mốc.

## 3. Phạm vi tệp (danh sách trắng)

| Được sửa | Ghi chú |
|---|---|
| `app/src/components/pages/investor-orders.tsx`, `investor-order-detail.tsx`, `wallet-connect.tsx` | QĐ-3 đến QĐ-7 |
| `app/src/components/wallet/wallet-status-card.tsx`, `no-wallet-guide.tsx`, `wrong-chain-banner.tsx` | QĐ-5, QĐ-7 |
| `app/e2e/fe-ux-04c-lenh-vi.spec.ts`, `app/test/fe-ux-04c.test.ts` (mới) | Design mục 3 |
| `docs/tech-report.md` | CHỈ khi số dòng marker dời, chỉ đổi khối tự sinh bằng `node scripts/scan-pending.mjs --write-report` |
| `docs/fe-ux-04c-lenh-vi/{requirements,design,tasks}.md`, `docs/CHECKPOINT_FEUX04C.md` (và `_DETAIL.md` nếu quá 800 dòng), `docs/USER_GUIDE.md`, `.kiro/task-status.json` | Theo quy ước repo |

Cấm mọi tệp khác (xem dòng Loại), gồm `globals.css`, `app/src/app/**`, `lib/**`, `app/test/**` có sẵn, e2e có sẵn, `package*.json`.

## 4. Điều kiện hoàn thành

- [ ] Ba màn đúng bố cục bản chốt trừ mục 1 "Không làm"; bảng đối chiếu từng dòng `notes/orders.md`, `notes/order-detail.md`, `notes/wallet.md` trong checkpoint (dòng nào bỏ thì ghi lý do).
- [ ] Bố cục, thành phần đúng QĐ-3 đến QĐ-5; `/orders` đúng một `role="note"` trong `main`; `/wallet` chế độ mô phỏng không `role="alert"` trong `main`.
- [ ] Không còn `amber-*`, `text-destructive`, `border-destructive`, `bg-destructive`, `FIELD` trong các tệp phạm vi.
- [ ] Chữ chỉ đổi đúng QĐ-7 (tasks bước 6d đúng kỳ vọng); không đổi trường, cột, nút, liên kết, điều kiện hiện.
- [ ] Diff giữ logic (QĐ-1, QĐ-2); checkpoint liệt kê từng đoạn đổi nằm gần hook, effect, `switch`, điều kiện nhánh, kèm lý do an toàn.
- [ ] Số action khi mở màn đúng QĐ-2 (e2e ca 5) và không đổi ở 28 đường dẫn; JS, CSS trong trần QĐ-9 (bảng byte bốn trang); ba số lỗi của ba màn bằng 0.
- [ ] Mốc test QĐ-8 giữ nguyên; không sửa test có sẵn.
- [ ] Ảnh 1440 và 390, Sáng và Tối, trước và sau, mỗi lượt một tiến trình mock MỚI khởi động: `npx next start --port <cổng>` với ĐỦ biến của `webServer.env` trong `playwright.config.ts:93-110` (trước từ bản build mốc, sau từ bản build nhánh; không dùng lại máy chủ đã chạy test, script đo hay chụp lượt trước). Công thức: `E2E_BASE_URL=http://localhost:<cổng> npx playwright test e2e/ops-transactions.spec.ts`, rồi chụp vai Nhà đầu tư: `/orders` (có dòng); `/orders/<mã lệnh của dòng đầu>`; `/wallet` chế độ mô phỏng; `/wallet` sau khi chọn `hardhat-local` (chưa có ví); `/wallet` có `window.ethereum` tối giản như `wallet-connect.spec.ts:133-148` rồi chọn `hardhat-local` (chưa kết nối). Script chụp ngoài repo, không commit.
- [ ] Trạng thái không dựng được trên mock (`WalletStatusCard` có số dư, đang đọc, lỗi, có và không có explorer; `WrongChainBanner` thường, đang chuyển, có lỗi, có `children`; `UnsupportedChainNotice`): unit test (design mục 3) và ảnh dựng ngoài repo bằng `renderToStaticMarkup` cộng CSS bản build, `page.setContent`, như 03b (Sáng, Tối, 1440, 390).
- [ ] `fe-ux-04c-lenh-vi.spec.ts` (project mock) đủ 5 ca và `fe-ux-04c.test.ts` đủ 5 nhóm (design mục 3), xanh.
- [ ] Kiểm thử đúng mục 5, đạt, kèm log; log có mục "EVM - E2E PROJECT HARDHAT" xanh (toàn bộ project Hardhat, gồm `wallet-connect`, `permit-order`).
- [ ] Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 6) đúng kỳ vọng.
- [ ] Ảnh Sáng và Tối xác nhận đọc được: ba nút trên thẻ xanh `/wallet` (QĐ-5), ô vàng số dư, `Alert bad` sai mạng (ảnh dựng), bảng lệnh.
- [ ] Không mã dư thừa: hằng, hàm, import, lớp không còn dùng xoá hẳn.

## 5. Phạm vi kiểm thử

| Ai | Chạy | Không chạy |
|---|---|---|
| Dev | `bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm` một lần, khi cổng e2e trống, lưu log; đo bằng `tools/20261104_do_moc_measure.js` (gửi kèm, sha256 `6079a0d679000d4c2bbe559d5a3eb90d362bb018243d45c0888f2fad26cdae1c`; `JS_PAGES=/,/portfolio,/trade,/approvals,/orders,DYN:/orders,/wallet`), JS bốn trang `/orders`, `/orders/[id]`, `/wallet`, `/trade` theo byte so bản mốc build riêng, CSS theo cách 01c. Gửi riêng đoạn log từ "EVM - E2E PROJECT HARDHAT" tới hết | `contracts` |
| Supervisor | Đọc diff; build; chạy `fe-ux-04c-lenh-vi`, `wallet-connect`, `investor-channel`, `ops-transactions`, `uiux-02-dau-man` (e2e và unit), unit test mới; gây lỗi có chủ đích 4 điểm (bỏ `role="note"` của dòng mô phỏng ở `/orders`; thêm `role="alert"` cho `WalletScopeNote`; trong `WalletStatusCard` bỏ đoạn `sr-only` địa chỉ đầy đủ; thêm một lời gọi `listOrdersAction(` vào trang); xem ảnh | Full suite |
