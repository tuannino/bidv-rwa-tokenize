# FE-UX-07b: Thanh đầu theo bản chốt, nhãn chain "Private Chain"

| | |
|---|---|
| Nhánh | `feat/fe-ux-07b-thanh-dau` từ `release/ui-v2` SAU KHI FE-UX-07a đã merge (dùng biến thể `BidvLogo variant="inline"` của 07a cho logo nhỏ dưới 1100 px). Được đọc mã, đo mốc trước; nếu PR khác merge trong lúc làm: rebase lên head mới, chạy lại TOÀN BỘ kiểm thử mục 5 và đo lại TOÀN BỘ mốc từ merge-base mới; checkpoint ghi merge-base đã dùng |
| PR | Một PR, **base `release/ui-v2`**, KHÔNG vào `dev`. Không tự merge |
| Loại | Frontend. Không `lib/**`, `app/actions/**`, `app/api/**`; không thêm gói npm; không sửa `components/ui/*`. Được sửa đúng các tệp ở mục 3, gồm MỘT dòng nhãn trong `packages/shared/src/chains.ts` (QĐ-8, chỉ chữ hiển thị) |
| Mức kiểm thử | **B**, phạm vi ở mục 5. Thanh đầu có ở mọi trang có khung; nhãn chain đi qua ví và thông báo máy chủ nên chạy đủ e2e project mock và toàn bộ project Hardhat |
| Song song | Sau 07a (dòng Nhánh). Các PR cùng sửa `docs/USER_GUIDE.md`, `.kiro/task-status.json`: PR merge sau tự gộp, mỗi mã ở đúng một danh sách. Tệp tạm của lệnh kiểm dùng tên riêng (tasks bước 6) |
| Nguồn | Sếp góp ý 06/11 (lần hai): "header ở các màn bản chốt rất đẹp, màu sắc, kích thước chuẩn, `release/ui-v2` đang khác, kiểm tra lại kỹ bản chốt"; "ô chọn chain dùng chữ Private Chain thay Hardhat Local, chỉ thay chữ hiển thị, không đổi logic". Bản chốt `docs/prototypes/20261101_ui_ux_ban_chot/assets/shell.css:120-135`, `:164-201`, `:280-304`, `:338-358`, `shell.js:186-196`, `:302-310`; số đo bản chốt bằng `tools/20261106_do_thanh_dau_ban_chot.js` (gửi kèm, bảng ở design mục 1) |
| Thứ tự ưu tiên khi nguồn xung đột | Spec này, rồi góp ý Sếp 06/11, rồi bản chốt, rồi mã `release/ui-v2` @ merge-base |

## 1. Mục tiêu

Thanh đầu của mọi màn có khung nhìn và cư xử như bản chốt: ở đầu trang trong suốt, chỉ có nút ví và nút Sáng Tối nhỏ; cuộn qua tiêu đề màn thì thanh chuyển dần sang nền xanh tối, hiện tên màn chữ trắng có vạch màu, đường chân trời hiện theo; kích thước, vị trí, lề trùng khung nội dung. Sửa luôn lỗi lệch lề hiện có (từ 1100 px thanh rộng hơn nội dung 12 px mỗi bên, khi cuộn dính sát mép trên). Đổi nhãn chain `hardhat-local` thành "Private Chain".

Không làm: làm mờ, thu nhỏ hàng tiêu đề trong nội dung khi cuộn (bản chốt `shell.css:357`; phần đó đụng 28 màn, để FE-UX-08); đổi tên màn trên thanh (giữ phần tử cuối của `breadcrumbs`, QĐ-5); đổi logic ví, đổi chain, đổi khoá `hardhat-local` hay `chainId`.

## 2. Quyết định (QĐ)

- **QĐ-1. Kích thước, vị trí (số đo bản chốt, design mục 1).**
  - Từ 1100 px: cao 44 px; dính cách đỉnh 10 px (`sticky top-2.5`, `mt-2.5`); lề trái, phải 24 px (`mx-6`, trùng `px-6` của `main`); bo 18 px; đệm `0 8px 0 20px`.
  - Dưới 1100 px: cao 46 px; dính cách đỉnh 8 px (`top-2`, `mt-2`); lề 12 px (`mx-3`, trùng `px-3` của `main`; bản chốt dùng 24 px từ 760 đến 1100 px (`shell.css:342` đè `:301`) vì nội dung bản chốt lề 24 px; app lề nội dung 12 px nên canh theo nội dung app, cố ý); bo 16 px; mốc: bản chốt coi đúng 1100 px là màn hẹp (`max-width: 1100px`), app coi 1100 px là màn rộng (`min-[1100px]`), giữ mốc của app; đệm `0 8px 0 12px`.
  - Mép trái, phải của thanh trùng mép nội dung của `main` ở 1440, 1100, 1099, 390 px (lệch tối đa 1 px).
- **QĐ-2. Tiến độ cuộn `--hp` (0 đến 1).**
  - Vùng cuộn là cha của `header` (`app-layout.tsx`, `div` có `overflow-y-auto`). `range = max(60, đáy của h1 đầu tiên trong main tính theo toạ độ nội dung vùng cuộn - 30)`; không có h1 thì 100. Đích `pT = clamp(scrollTop / range, 0, 1)`.
  - Làm mượt như bản chốt (`shell.js:308`): mỗi khung hình `pC += (pT - pC) * 0.2`, dừng khi lệch dưới 0,002; người dùng chọn giảm chuyển động thì `pC = pT` ngay.
  - Ghi `--hp` (3 chữ số thập phân) và `data-on` (khi `pC > 0.5`) thẳng lên phần tử `header` qua `ref`; KHÔNG `setState` mỗi khung hình. Một trình nghe `scroll` thụ động trên vùng cuộn và một trình nghe `resize` trên `window`, gỡ khi unmount, huỷ `requestAnimationFrame` đang chờ. Đổi trang (`usePathname`) thì tính lại `range` và `pT`.
  - Hàm thuần `headerProgress({ scrollTop, range })` và `stepProgress({ current, target, reduce })` xuất từ `components/layout/header-progress.ts` để unit test.
  - Trước khi hydrate (máy chủ dựng) `--hp` là 0: không lệch hydrate.
- **QĐ-3. Nền, bóng, đường chân trời theo `--hp`.**
  - Nền: lớp `::before` phủ đầy thanh, màu token `--hdr-on`, `opacity: var(--hp)`; dưới 1100 px ở Sáng `opacity: calc((0.04 + var(--hp) * 0.86) / 0.9)` (bản chốt `shell.css:199`: nền 4% ở đầu trang trên điện thoại, 90% khi cuộn), Tối giữ `var(--hp)`. Mờ nền: từ 1100 px `backdrop-filter: blur(calc(var(--hp) * 18px)) saturate(calc(1 + var(--hp) * .35))` như bản chốt (`shell.css:122`, không bị đè); dưới 1100 px `blur(14px)` cố định (`shell.css:165`).
  - Bóng: Sáng `0 10px 28px -18px` màu `--hdr-shadow` độ đậm `--hp * 90%` (`shell.css:181`); Tối thay bằng viền tóc `0 1px 0` màu `--hdr-shadow` độ đậm `--hp * 6%` (`shell.css:124` đè `:181` ở Tối). Cách làm: `color-mix(in oklab, var(--hdr-shadow) calc(var(--hp) * N%), transparent)` hoặc lớp riêng có `opacity`; dev chọn, ghi checkpoint.
  - Bỏ `bg-card/80`, `ring-1 ring-border`, `backdrop-blur` hiện có ở trạng thái đầu trang.
  - Đường chân trời `[data-horizon]` GIỮ phần tử, `animation-name: horizon` và hành vi giảm chuyển động (`fe-ux-01c-chuyen-dong.spec.ts:174-191`); đổi thành cao 2 px, cách mép 20 px (`inset-x-5`), `opacity: var(--hp)` thay cho `opacity-70` cố định (`shell.css:281` đè `:183`). Hoạt ảnh nằm ở `::after` như hiện tại (`header.tsx:48`).
- **QĐ-4. Tên màn trên thanh.** Phần tử `p` có sẵn (`header.tsx:62`), chữ GIỮ là phần tử cuối của `breadcrumbs` (`fe-ux-01b-khung.spec.ts:94` khoá). Kiểu theo bản chốt (`shell.css:126`, `:185-186`, `:283`): chữ trắng (`--tile-hl-ink`) 14 px đậm 700, `tracking-[.01em]`, cắt chữ một dòng; trước chữ vạch 3 x 16 px bo 3 px gradient dọc `--hdr-accent-from` sang `BRAND.gold` (dùng token `--hdr-accent-to`); `opacity: var(--hp)`, `transform: translateY(calc((1 - var(--hp)) * 14px)) scale(calc(.94 + var(--hp) * .06))`, `transform-origin: left center`. Không `filter: blur` (tốn vẽ lại khi cuộn; khác bản chốt, cố ý). Không thêm `aria-hidden` (giữ như hiện tại).
- **QĐ-5. Tên màn GIỮ là `breadcrumbs`, không lấy chữ `h1`.** Bản chốt lấy chữ `h1` ("Tổng quan nhà đầu tư"), app đang dùng phần tử cuối của `breadcrumbs` ("Tổng quan") và test khung khoá điều này. Giữ như app; nếu Sếp muốn đúng chữ `h1` thì làm task riêng (đổi `breadcrumbs` của các trang).
- **QĐ-6. Nút ví (`ConnectButton.Custom`, như `wallet-connect.tsx:217`).** Thay `<ConnectButton … />` bằng `HeaderWalletButton` (tệp mới `components/layout/header-wallet-button.tsx`) dùng `ConnectButton.Custom` của RainbowKit; hộp thoại vẫn của RainbowKit. Phần trình bày tách thành `HeaderWalletButtonView` thuần (props: `state: 'loading' | 'disconnected' | 'wrong-network' | 'connected'`, `label?: string`, `onClick`) để unit test.
  - Chưa kết nối: viên nang cao 30 px, đệm ngang 12 px, chữ 13 px `font-medium`, biểu tượng `Wallet` 15 px, nền gradient 135 độ `--hdr-gold-from` sang `--hdr-gold-to`, chữ `--hdr-gold-ink`, bóng `0 8px 20px -10px` vàng (đổi theo `data-on`: `0 6px 16px -10px` tối, `shell.css:191`); chữ "Kết nối ví"; dưới 640 px chỉ còn biểu tượng, rộng 38 px, `aria-label="Kết nối ví"`. Bấm: `openConnectModal`.
  - Sai mạng (`chain.unsupported`): `button` cùng cỡ 30 px (không dùng `Badge`, `Badge` là `span` cao 20 px, `badge.tsx:8`), lớp `bg-bad-bg text-bad-ink`, chữ "Sai mạng", bấm `openChainModal`.
  - Đã kết nối: cùng cỡ, nền `bg-card/90` (khi `data-on`: nền kính `--tile-hl-chip`, chữ `--tile-hl-ink`), chữ `account.displayName` của RainbowKit (địa chỉ rút gọn), bấm `openAccountModal`.
  - Chưa sẵn sàng (`!mounted`): giữ chỗ cùng cỡ, `aria-hidden`, `opacity-0`, `pointer-events-none` (theo mẫu tài liệu RainbowKit), không lệch hydrate.
  - Không đổi `providers.tsx`; giao diện hộp thoại RainbowKit giữ như cũ. Nút ví và logo không chứa phần tử `<p>` (`fe-ux-01b-khung.spec.ts:94` đọc `header.locator('p').first()` là tên màn).
- **QĐ-7. Nút Sáng Tối.** 30 x 30 px tròn (`size-[30px]`), biểu tượng 15 px; ở đầu trang nền `bg-card/70`, viền trong suốt, chữ `text-foreground`; khi `data-on` nền `color-mix(in oklab, var(--tile-hl-ink) 12%, transparent)` (bản chốt 12%, `--tile-hl-chip` là 15% nên không dùng), viền `color-mix(in oklab, var(--tile-hl-ink) 20%, transparent)`, chữ `--tile-hl-ink` (`shell.css:190`). Giữ `title` "Chuyển sang Light mode" / "Chuyển sang Dark mode" (`wallet-connect.spec.ts:33`, `fe-ux-01b-khung.spec.ts:27` đọc), giữ chỉ dựng sau hydrate. Nút menu (dưới 1100 px) khi `data-on` chữ `--tile-hl-ink` (`shell.css:201`).
- **QĐ-8. Logo nhỏ dưới 1100 px.** Bản chốt hiện logo nhỏ (`BidvLogo` cao 16 px kèm "RWA Tokenize Platform" 10 px) bên phải nút menu ở đầu trang, mờ dần khi cuộn (`opacity: calc(1 - var(--hp) * 1.4)`, `shell.css:167`). Dùng `BidvLogo variant="compact"` của FE-UX-07a (cao 16 px, một dòng chữ 10 px, không khai báo lại `<symbol>` vì bản `full` của thanh bên đã có trong DOM), dựng ở máy chủ trong `app-layout.tsx` và truyền vào `Header` qua prop `logo` (như `Sidebar`). Không hiện từ 1100 px (đã có thanh bên). Logo nằm cùng chỗ với tên màn; tên màn hiện dần, logo mờ dần, không chồng chữ (tên màn `absolute` hoặc logo `absolute`, dev chọn, ảnh chứng minh ở `--hp` 0, 0,5, 1).
- **QĐ-9. Token màu mới** (thêm vào `globals.css`, `:root` và `.dark` như ghi; không mã màu trong `.tsx`):

  | Token | Sáng | Tối | Nguồn bản chốt |
  |---|---|---|---|
  | `--hdr-on` | `rgb(3 46 45 / 0.9)` | `rgb(2 30 29 / 0.92)` | `shell.css:180`, `:182` |
  | `--hdr-shadow` | `rgb(1 40 39)` | `rgb(255 255 255)` | `shell.css:181` (Sáng), `:124` (Tối, viền tóc trắng) |
  | `--hdr-accent-from` | `#6fd8d0` | như Sáng | `shell.css:283` |
  | `--hdr-accent-to` | `#fec629` | như Sáng | `shell.css:283` |
  | `--hdr-gold-from` | `#e0b44a` | như Sáng | `c.css:110` (`--au400`) |
  | `--hdr-gold-to` | `#c9971c` | như Sáng | `c.css:110` (`--au500`) |
  | `--hdr-gold-ink` | `#1d1300` | như Sáng | `c.css:110` |

- **QĐ-10. Nhãn chain.** `packages/shared/src/chains.ts:38` đổi `label: 'Hardhat Local'` thành `label: 'Private Chain'`. Không đổi khoá `hardhat-local`, `chainId: 31337`, `defaultRpcUrl`, `hint`, thứ tự, hay bất kỳ dòng nào khác. Ảnh hưởng hiển thị (đều là chữ, checkpoint liệt kê đủ, dev grep lại `CHAINS[` và `.label` để bổ sung nếu thiếu): ô chọn chain ở thanh bên (`chain-selector.tsx:61`, qua `lib/config/flags.ts:94`); thông báo sai mạng của `wallet-status.ts` (`:36`, `:114`, `:145`, `:153`); câu hướng dẫn `wallet-connect.tsx:155`, `:183`; tên mạng trong hộp thoại chọn mạng của RainbowKit (`lib/wagmi.ts:28`); tên mạng khi app xin ví thêm mạng 31337 (`lib/hooks/use-wallet-status.ts:129`, `:144`, `chainName` của `wallet_addEthereumChain`: MetaMask hiện "Private Chain"); tên chain trong bảng yêu cầu (`components/maker-checker/request-table.tsx:109`); `defineChain` của viem (`lib/chains/registry.ts:75`). Không thông báo máy chủ nào dùng nhãn này. `README.md:49`, `docs/guide.md` còn chữ "Hardhat Local" khi mô tả công cụ: ngoài phạm vi (không phải giao diện), không sửa. Không sửa tệp nào trong danh sách đó (chúng đọc `label`). Test có sẵn truyền chữ "Hardhat Local" làm tham số (`fe-ux-04c.test.ts:67-83`, `wallet-status.test.ts:278-302`) không phụ thuộc nhãn, giữ nguyên.
- **QĐ-11. Không đổi logic.** `header.tsx` giữ `useDrawerOpen`, `inert={open}`, nút menu (`id`, `aria-*`, `openDrawer`), `toggleTheme`, `useIsMounted`, `ShellMain` (chỉ đổi khoảng cách trên nếu cần để giữ vị trí nội dung, ghi checkpoint). Diff ngoài vỏ JSX, lớp, phần tiến độ cuộn, nút ví mới, prop `logo` thì liệt kê và giải thích.
- **QĐ-12. Hiệu năng.** JS mọi trang có khung theo byte so bản build mốc riêng tăng không quá 1,5 KB gzip (nút ví tự dựng, tiến độ cuộn); CSS gzip tăng không quá 1 KB. Cuộn không gây `setState` (unit nhóm 1 khoá: không `useState` cho `--hp`). `metrics.json` ba số lỗi không tăng ở 28 đường dẫn.

## 3. Phạm vi tệp (danh sách trắng)

| Được sửa | Ghi chú |
|---|---|
| `app/src/components/layout/header.tsx` | QĐ-1 đến QĐ-8, QĐ-11 |
| `app/src/components/layout/header-progress.ts`, `header-wallet-button.tsx` (mới) | QĐ-2, QĐ-6 |
| `app/src/components/layout/app-layout.tsx` | CHỈ truyền prop `logo` vào `Header` (QĐ-8) |
| `app/src/app/globals.css` | CHỈ khối token QĐ-9 |
| `packages/shared/src/chains.ts` | CHỈ dòng 38, QĐ-10 |
| `app/e2e/fe-ux-07b-thanh-dau.spec.ts`, `app/test/fe-ux-07b.test.ts` (mới) | Design mục 3 |
| `docs/tech-report.md` | CHỈ khi số dòng marker dời, chỉ đổi khối tự sinh bằng `node scripts/scan-pending.mjs --write-report` |
| `docs/fe-ux-07b-thanh-dau/{requirements,design,tasks}.md`, `docs/CHECKPOINT_FEUX07B.md` (và `_DETAIL.md` nếu quá 800 dòng), `docs/USER_GUIDE.md`, `.kiro/task-status.json` | Theo quy ước repo; `USER_GUIDE.md` hiện không có chữ "Hardhat Local"; thêm một câu ở phần ô chọn chain: "Private Chain" là chain nội bộ (Hardhat) cho demo đầy đủ |

Cấm mọi tệp khác, gồm `lib/**`, các tệp khác của `packages/shared/**`, `components/ui/*`, `sidebar.tsx`, `chain-selector.tsx`, `providers.tsx`, test và e2e có sẵn, `package*.json`, `docs/prototypes/**`.

## 4. Điều kiện hoàn thành

- [ ] Kích thước, vị trí, lề đúng QĐ-1 ở 1440, 1100, 1099, 390 px (bảng số đo bản chốt và app trong checkpoint, lệch tối đa 1 px trừ chỗ QĐ-1 ghi khác).
- [ ] Tiến độ cuộn đúng QĐ-2: ghi `--hp` qua `ref`, không `setState` mỗi khung hình, làm mượt, giảm chuyển động thì nhảy thẳng, đổi trang thì tính lại; hàm thuần có unit test.
- [ ] Nền, bóng, đường chân trời đúng QĐ-3: đầu trang trong suốt (dưới 1100 px Sáng 4%), cuộn qua tiêu đề thì nền xanh tối 90% (Tối 92%); `[data-horizon]` giữ animation và hành vi giảm chuyển động.
- [ ] Tên màn đúng QĐ-4, QĐ-5: chữ breadcrumbs, trắng 14 px đậm, vạch màu, hiện theo `--hp`.
- [ ] Nút ví đúng QĐ-6 ở bốn trạng thái (unit dựng View), mở đúng hộp thoại RainbowKit; dưới 640 px chỉ biểu tượng có `aria-label`.
- [ ] Nút Sáng Tối, nút menu đúng QĐ-7; `title` giữ.
- [ ] Logo nhỏ dưới 1100 px đúng QĐ-8, không chồng chữ với tên màn ở mọi `--hp`.
- [ ] Token đúng QĐ-9; không mã màu trong `.tsx` phạm vi.
- [ ] Nhãn chain "Private Chain" đúng QĐ-10: một dòng đổi, khoá và `chainId` giữ; ô chọn chain, thông báo sai mạng hiện chữ mới; checkpoint liệt kê mọi chỗ hiển thị bị ảnh hưởng.
- [ ] Logic giữ (QĐ-11); mốc test có sẵn giữ nguyên, không sửa test có sẵn.
- [ ] JS, CSS trong trần QĐ-12 (bảng byte); 28 đường dẫn không tăng lỗi console, `pageerror`, hydrate.
- [ ] Ảnh `/portfolio` (Nhà đầu tư), `/transactions` (Giao dịch viên) ở 1440 và 390 px, Sáng và Tối, `--hp` 0 (đầu trang) và 1 (cuộn 500 px), đặt cạnh ảnh bản chốt cùng màn cùng trạng thái (script gửi kèm); thêm 390 px ở `--hp` khoảng 0,5; ô chọn chain mở danh sách có "Private Chain". Chụp trên tiến trình mock MỚI khởi động từ bản build nhánh với ĐỦ biến `webServer.env`. Script ngoài repo, không commit.
- [ ] `fe-ux-07b-thanh-dau.spec.ts` (project mock) đủ 5 ca và `fe-ux-07b.test.ts` đủ 4 nhóm (design mục 3), xanh; kiểm thử đúng mục 5 kèm log, có mục "EVM - E2E PROJECT HARDHAT" xanh; lệnh tasks bước 6 đúng kỳ vọng.
- [ ] Không mã dư thừa: hằng, hàm, import, lớp không dùng xoá hẳn; không thêm gói npm.

## 5. Phạm vi kiểm thử

| Ai | Chạy | Không chạy |
|---|---|---|
| Dev | `bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm` một lần, khi cổng e2e trống, lưu log; đo bằng `tools/20261104_do_moc_measure.js` (sha256 `6079a0d679000d4c2bbe559d5a3eb90d362bb018243d45c0888f2fad26cdae1c`; `JS_PAGES=/,/portfolio,/seller,/approvals,/account`), JS theo byte so bản mốc build riêng, CSS theo cách 01c; số đo bản chốt bằng `tools/20261106_do_thanh_dau_ban_chot.js` (chạy với Playwright có sẵn, mở tệp bản chốt qua `file://`). Gửi riêng đoạn log từ "EVM - E2E PROJECT HARDHAT" tới hết | `contracts` |
| Supervisor | Đọc diff; build; chạy `fe-ux-07b-thanh-dau`, `fe-ux-01b-khung`, `fe-ux-01c-chuyen-dong`, `wallet-connect`, `fe-ux-04c-lenh-vi`, `uiux-02-dau-man` (e2e), `fe-ux-04c`, `wallet-status`, `fix-08`, unit mới; gây lỗi có chủ đích 4 điểm (bỏ `min-[1100px]:mx-6`; đổi `stepProgress` để giảm chuyển động vẫn nội suy; bỏ `aria-label` của nút ví dưới 640 px; đổi `--hp` sang `useState`); so ảnh với bản chốt | Full suite |
