# FE-UX-02a: thành phần màn dùng chung và 5 màn Vận hành

| | |
|---|---|
| Nhánh | `feat/fe-ux-02a-van-hanh` từ `release/ui-v2` @ `2065289` (sau #86) |
| PR | Một PR, **base `release/ui-v2`**, KHÔNG vào `dev`. Không tự merge. Nếu đến bước 5 thấy PR quá lớn để tự kiểm, được tách: PR 1 (token, thành phần, `orderStatusTone`, áp vào `/wallet-binding`, `/demo-payment`), PR 2 (3 màn còn lại); báo Supervisor trước khi tách |
| Loại | Frontend thuần. Không `lib/`, `app/actions`, `app/api`, không thêm gói npm |
| Mức kiểm thử | **B**, phạm vi ở mục 5 |
| Nguồn | Kế hoạch 03/11; `docs/20261101_UI_UX_BAN_GIAO_SUPERVISOR.md` mục 4.4, 4.5, 7.1, 8; bản chốt `dashboard.html`, `transactions.html`, `transaction-detail.html`, `demo-payment.html`, `wallet-binding.html`, `assets/c.css`; `notes/<màn>.md` |
| Thứ tự ưu tiên khi nguồn xung đột | Spec này, rồi kế hoạch 03/11, rồi mã `release/ui-v2` @ `2065289`, rồi tài liệu bàn giao và notes, cuối cùng là bản xem thử. Notes viết theo dev `67ece1e`, đã cũ ở các điểm mục 2 QĐ-9 liệt kê |

## 1. Mục tiêu

FE-UX-02 (8 màn Vận hành) tách làm hai PR: **02a** (bài này) gồm thành phần màn dùng chung và 5 màn ít logic: `/`, `/transactions`, `/transactions/[id]`, `/demo-payment`, `/wallet-binding`; **02b** gồm `/draft`, `/config`, `/recall` (nhiều logic client: `maker-checker/*`, `recall/*`, `price-config.tsx`).

1. Thêm token trạng thái và token ô số liệu; thêm biến thể và thành phần dùng chung trong `components/ui` mà 5 màn này và các màn sau cần.
2. Vẽ lại 5 màn theo bản chốt bằng các thành phần đó: bố cục lưới, ô số liệu theo ngữ nghĩa, thẻ có biểu tượng tiêu đề, nhãn trạng thái có sắc, trạng thái rỗng, đang tải, lỗi.
3. Không đổi câu chữ (trừ ký tự cấm, QĐ-8), trường, bộ lọc, nút, điều kiện khoá, lời gọi server action, số action khi mở màn.

Không làm: minh hoạ SVG lớn trong ô (cảnh tua-bin, cột đồng xu, vòng đo), vệt sáng chạy liên tục trên ô vàng, thẻ dự án và khối "Phân bổ WPT theo dự án" (test FIX-05 cấm), bấm cả dòng bảng, đưa 3 dòng số của chi tiết lệnh lên thành ô, chuyển động JS (FE-UX-08).

## 2. Quyết định (QĐ)

- **QĐ-1. Không đổi logic màn.** Trong 5 tệp màn và 2 tệp nội dung chi tiết lệnh: giữ nguyên hook, state, effect, handler, `requestKey`, debounce, lời gọi action, điều kiện khoá nút, `role`, `aria-label`, `data-testid`, `data-chain`, `data-wallet`, `prefetch={false}`. Diff chỉ là vỏ JSX, `className`, thay khối lặp bằng thành phần dùng chung có cùng chữ và cùng thuộc tính.
- **QĐ-2. Token mới (`globals.css`, Sáng và Tối):**
  - Trạng thái: `--ok-bg`, `--ok-ink`, `--warn-bg`, `--warn-ink`, `--bad-bg`, `--bad-ink`, `--info-bg`, `--info-ink` theo `c.css` dòng 19, 28; khai báo `--color-*` tương ứng trong `@theme inline` để có lớp `bg-ok-bg`, `text-ok-ink`...
  - Ô số liệu: biến `--tile-{hl,au,leaf,gold}` (nền, là gradient), `--tile-{hl,au,leaf,gold}-ink` (chữ chính), `--tile-{hl,au,leaf,gold}-sub` (chữ phụ) theo `c.css` dòng 172 tới 181, 568 tới 586. Gradient là ảnh nền: dùng `bg-(image:--tile-hl)` hoặc `@utility`, KHÔNG khai báo thành `--color-*` (sẽ thành `background-color` sai). Mã màu chỉ nằm trong `globals.css`.
  - Màu chữ theo tone đặt NGAY TẠI GỐC `Card`/`Kpi` (lớp `text-(--tile-*-ink)` thay `text-card-foreground` khi tone khác `default`), đồng thời gốc ghi đè cục bộ `--card-foreground`, `--foreground`, `--muted-foreground` bằng `--tile-*-ink`, `--tile-*-sub` (và màu thanh tiến độ nếu có). Lý do: `Card` hiện dùng `text-card-foreground` lấy từ `--card-foreground`; chỉ đổi `--foreground` thì chữ chính vẫn tối trên nền xanh đậm. Phần tử con sẵn có (`UnverifiedNote`, `SupplyBar`) đổi màu theo biến mà không sửa chúng. Áp cho `hl`, `au` (nền đậm); `leaf`, `gold` nền nhạt giữ chữ mặc định nhưng vẫn đo.
  - Tương phản đo SAU KHI RENDER, TẠI VÙNG CHỮ (nhãn, giá trị, chữ phụ, chữ `unverified`, ghi chú; lấy màu chữ bằng `getComputedStyle` và màu nền gradient tại toạ độ chữ) cho 4 ô và 4 nền trạng thái, Sáng và Tối: chữ thường đạt 4,5:1, giá trị 28 px trở lên đạt 3:1. Supervisor đã tính sơ bộ: điểm sáng nhất ô `hl` (`#1e8886`) với chữ trắng chỉ 4,27, ô `au` Tối chữ `#2a1c00` trên `#8a6406` chỉ 3,09; nếu chữ rơi vào vùng đó thì dev chỉnh điểm dừng gradient hoặc màu chữ, ghi bảng số trong checkpoint.
- **QĐ-3. Thành phần dùng chung** (chỉ thêm biến thể, không đổi API props đang có):

  | Thành phần | Tệp | Nội dung |
  |---|---|---|
  | `Card` `tone` | `ui/card.tsx` | `cva` với `default`, `tint`, `hl`, `au`, `leaf`, `gold`; mặc định giữ nguyên lớp hiện tại (bo 22 px, `fe-ux-01a-nen.spec.ts:105-107` kiểm); thêm `CardTitleIcon` (biểu tượng lucide trong vòng tròn 32 px cạnh tiêu đề thẻ) |
  | `Kpi` | `ui/kpi.tsx` (mới) | Ô số liệu: `label`, `value`, `unit?`, `sub?`, `icon?`, `tone` (`default` `hl` `au` `leaf` `gold`), `size` (`md` `lg`), `children` (chỗ cho thanh tiến độ, ghi chú), nhận và chuyển mọi thuộc tính còn lại (`data-testid`, `aria-*`). Gốc có `data-kpi` và `data-tone`; bo 22 px như `Card`; phần tử `tabular-nums` ĐẦU TIÊN là giá trị và chỉ chứa giá trị (đơn vị nằm ngoài, `fix-05-tong-quan.spec.ts:46`); `sub` bọc bằng `div` (có thể chứa khối); dùng utility `lift` của FE-UX-01c |
  | `Badge` sắc | `ui/badge.tsx` | Thêm biến thể `ok`, `warn`, `bad`, `info` (thuộc tính `data-variant` sẵn có cho biết sắc) |
  | `Alert` | `ui/alert.tsx` (mới) | Khối thông báo `tone` (`ok` `warn` `bad` `info`) có biểu tượng; KHÔNG tự đặt `role`; chuyển tiếp mọi thuộc tính (`role`, `aria-*`, `data-*`); nơi dùng truyền đúng `role` đang có (có `role` thì giữ, không có thì không thêm) |
  | `EmptyState` | `ui/empty-state.tsx` (mới) | Rỗng, đang tải (`loading`: `Loader2` quay), lỗi (`tone="bad"`); không tự đặt `role`, chuyển tiếp mọi thuộc tính (lỗi danh sách ở `wallet-binding.tsx:158` giữ `role="alert"`) |
  | `fieldClass` | `ui/field.ts` (mới) | Chuỗi lớp chung cho `input`, `select`, `textarea` |
  | `BlockedNotice` | `ui/blocked-notice.tsx` (mới) | Khối "chức năng không khả dụng" của 2 trang chặn, nhận `title` (vẫn là `h1`) và `children`, chuyển tiếp thuộc tính; chữ giữ nguyên từng ký tự (`investor-withdraw.spec.ts:24` khớp chính xác) |
  | `orderStatusTone` | `components/trading/order-status-tone.ts` (mới) | Hàm thuần `OrderStatus` sang sắc: `COMPLETED` `ok`; `PLACED`, `CHECKING`, `EXECUTING` `warn`; `REJECTED`, `FAILED` `bad`; `EXPIRED` `info`. Thay hàm chọn biến thể trong `StatusBadge` (`ops-transactions.tsx:307`) và Badge trạng thái ở `order-detail-content.tsx:22`. Cùng tệp có `settlementStepTone`: `done` `ok`, `current` `warn`, `failed` `bad`, `pending` `muted` |

  Bản sao cũ NGOÀI 5 màn (`KpiCard` ở `reconciliation.tsx`, `kyc.tsx`; `StatCard` ở `assets.tsx`, `maker-checker/stat-card.tsx`; các hằng `INPUT`/`FIELD` ở tệp khác) KHÔNG sửa ở PR này; chuyển dần ở 02b, 03, 06. Checkpoint liệt kê các bản sao còn lại.
- **QĐ-4. Gán sắc ô số liệu:** `/`: Tổng cung token `hl` cỡ `lg`, Lợi tức đã chia `au`, Sản lượng luỹ kế `leaf`, Dự án đang triển khai và Nhà đầu tư đã định danh `default`. `/transactions`: Tổng cung `hl`, Chưa phân phối `leaf`, Đang lưu hành `default`. Màn khác không có ô.
- **QĐ-5. Chi tiết lệnh dùng chung với Nhà đầu tư:** `trading/order-detail-content.tsx`, `trading/settlement-progress.tsx` cũng hiện ở `/orders/[id]` và kết quả đặt lệnh của `/trade`. Chỉ đổi kiểu (thẻ, nhãn sắc, tiến trình dạng bước, nhật ký dạng dòng thời gian theo `c.css` `.steps`, `.timeline`); giữ nguyên thứ tự, chữ, cấu trúc phần tử mà test dựa vào (QĐ-7). Mỗi bước giữ `data-step`, `data-state`, nhãn `STEP_STATE_LABELS`, và thêm `data-tone` theo `settlementStepTone`; màu bước lấy từ `data-tone`. Đổi này áp cho cả kênh Nhà đầu tư, coi là phần việc trước của FE-UX-04.
- **QĐ-6. Biểu đồ `/`:** giữ hai biểu đồ recharts tách riêng, các nhánh Đang đọc, Chưa đọc được, rỗng; chỉ đổi màu (token `--chart-*`), lưới, tooltip, bo góc cột, độ dày đường. Ô cha của `ResponsiveContainer` có `min-w-0`. Giữ id gradient cố định.
- **QĐ-7. Mốc test phải giữ** (không sửa `app/test/**`; e2e cũ chỉ sửa selector khi bắt buộc):
  - `/`: `h1` đúng chữ "Tổng quan", không bọc gì trong `h1` (`uiux-02-dau-man.test.ts:256`); 5 nhãn ô đúng chữ; chữ "unverified"; không chữ "whitelisted"; ít nhất 3 `<UnverifiedNote`; có `getOpsOverviewAction`; không `MOCK_PROJECTS` và các khoá mẫu cũ (`fix-05-tong-quan.test.ts:206-211`); `fix-05-tong-quan.spec.ts:45` tìm ô bằng `div.rounded-lg`: ĐƯỢC sửa đúng selector này thành `[data-kpi]`, giữ nguyên điều kiện (giá trị đầu là toàn chữ số).
  - `/transactions`: một heading chứa "Giao dịch toàn hệ thống"; `data-chain={chain}`; ô `supply-undistributed` không chứa chữ số nào ngoài con số (nhãn, đơn vị, phụ đề không có số); đúng một `role="note"` khi chỉ xem; liên kết mã lệnh 8 ký tự giữ nguyên.
  - Chi tiết lệnh: heading "Lệnh mua xxxxxxxx" ở cả hai kênh; chữ "Tiến trình quyết toán" xuất hiện đúng một lần; ví nằm riêng một phần tử và chỉ hiện MỘT lần trên `/orders/[id]` (`ops-transactions.spec.ts:130` strict); "Kết cục: cả bốn bút toán đã ghi." nằm trọn một phần tử.
  - `/demo-payment`: nhãn "Ví đích", "Số VNDB" khớp chính xác; nút "Nạp VNDB"; toàn trang đúng một `role="status"` khi có phản hồi; `page.tsx` giữ biểu thức `canMintDemoPayment(role) ? <DemoPaymentPage` (`demo-payment.test.ts:234`).
  - `/wallet-binding`: `form` tên cũ, nhãn "Hồ sơ", "Địa chỉ ví", `aria-label="Kết quả định danh ví"`, bảng tên "Ví đã định danh" (`vault-withdraw.spec.ts:35`), `tr[data-wallet]`, lỗi danh sách `role="alert"`; KHÔNG có chuỗi `data-chain` trong tệp (`uiux-02-dau-man.test.ts:271`).
  - Mọi màn: đúng một `h1`; không `.font-mono`; mọi `Link` `prefetch={false}`.
- **QĐ-8. Ký tự cấm trong chuỗi do frontend dựng:** `demo-payment.tsx:87` hai dấu chấm giữa thành dấu phẩy; ô trống dùng gạch dài U+2014 (`demo-payment.tsx:29`, `ops-transactions.tsx:258`) thành gạch ngắn `–` (U+2013) theo quy ước ô trống Sếp đã chốt. Chuỗi do máy chủ trả giữ nguyên. Không đổi câu nào khác.
- **QĐ-9. Bản xem thử, notes đã cũ, KHÔNG làm theo:** tiêu đề "Tổng quan điện gió" và câu phụ; 4 ô cũ của `/`; biểu đồ hai trục gộp; câu phụ và "Chain đang xem" ở `/transactions`, `/wallet-binding`; ô "Tối đa một lần" tách riêng ở `/demo-payment` (đổi câu chữ: giữ câu "Tối đa một lần: … VNDB." trong biểu mẫu); thanh "Trạng thái xem thử".
- **QĐ-10. Hiệu năng:** số server action khi mở màn không đổi ở 28 đường dẫn; JS gzip 4 trang đo không tăng quá 5 KB; CSS gzip không tăng quá 4 KB; cảnh báo hydrate, lỗi console 0.

## 3. Phạm vi tệp (danh sách trắng)

| Được sửa | Ghi chú |
|---|---|
| `app/src/app/globals.css` | QĐ-2 |
| `app/src/components/ui/{card,badge}.tsx` | Thêm biến thể |
| `app/src/components/ui/{kpi,alert,empty-state,blocked-notice}.tsx`, `app/src/components/ui/field.ts` (mới) | QĐ-3 |
| `app/src/components/trading/order-status-tone.ts` (mới) | QĐ-3 |
| `app/src/components/pages/{dashboard,ops-transactions,ops-order-detail,demo-payment,wallet-binding}.tsx` | QĐ-1 |
| `app/src/components/trading/{order-detail-content,settlement-progress}.tsx` | QĐ-5 |
| `app/src/app/(ops)/{demo-payment,wallet-binding}/page.tsx` | Chỉ thay khối chặn bằng `BlockedNotice`, giữ biểu thức điều kiện |
| `app/e2e/fe-ux-02a-van-hanh.spec.ts`, `app/test/fe-ux-02a.test.ts` (mới) | Mục 4 design |
| `app/e2e/fix-05-tong-quan.spec.ts` | Chỉ dòng 45, selector (QĐ-7) |
| `docs/fe-ux-02a-van-hanh/*`, `docs/CHECKPOINT_FEUX02A.md`, `docs/USER_GUIDE.md`, `.kiro/task-status.json` | Theo quy ước repo |

Mọi tệp khác là cấm, gồm `lib/**`, `app/actions`, `app/api`, mọi `gates.ts`, `sides.ts`, `labels.ts`, `app/test/**` có sẵn, `components/layout/**`, `package*.json`.

## 4. Điều kiện hoàn thành

- [ ] Token QĐ-2 có ở Sáng và Tối; bảng tương phản 8 nền đạt 4,5:1 trong checkpoint.
- [ ] Thành phần QĐ-3 đúng API, không tự đặt `role`; `Kpi` có `data-kpi`, `data-tone`, chuyển tiếp `data-testid`, `aria-*`.
- [ ] `orderStatusTone` phủ đủ 7 trạng thái, `settlementStepTone` đủ 4 trạng thái bước (unit test mới), dùng ở bảng giao dịch và chi tiết lệnh; `Alert`, `EmptyState` không tự đặt `role` (unit test mới).
- [ ] 5 màn đúng bố cục bản chốt trừ các điểm QĐ-9 và mục "Không làm"; sắc ô đúng QĐ-4; đối chiếu từng màn với `notes/<màn>.md` (bảng trong checkpoint: mỗi dòng notes là Giữ, Đã cũ theo QĐ-9, hay Bỏ kèm lý do).
- [ ] Không đổi chữ, trường, bộ lọc, nút, điều kiện khoá; chuỗi QĐ-8 đã sửa, không chuỗi nào khác đổi (kiểm bằng lệnh tasks bước 8d).
- [ ] Diff 7 tệp màn và nội dung chỉ là JSX, lớp, thay khối bằng thành phần chung (QĐ-1); checkpoint liệt kê từng đoạn đổi có đụng gần hook hoặc handler.
- [ ] Chi tiết lệnh hiện đúng ở `/transactions/[id]`, `/orders/[id]` và kết quả đặt lệnh `/trade` (QĐ-5): `ops-transactions.spec.ts` (phủ cả hai kênh) và `permit-order.spec.ts` xanh; ảnh chụp sau khi chạy các spec đó (có dữ liệu).
- [ ] Mốc test QĐ-7 giữ nguyên; chỉ `fix-05-tong-quan.spec.ts:45` đổi selector.
- [ ] Số action khi mở màn không đổi ở 28 đường dẫn; JS, CSS trong trần QĐ-10; hydrate, lỗi console 0.
- [ ] 390 px không tràn ngang ở 5 màn và `/orders/[id]`; ảnh 1440 và 390, Sáng và Tối, trước và sau cho 5 màn và `/orders/[id]`; ảnh chi tiết lệnh chụp khi ĐÃ CÓ dữ liệu (sau khi chạy `ops-transactions.spec.ts`), không chấp nhận ảnh màn đang tải.
- [ ] `fe-ux-02a-van-hanh.spec.ts` đủ 4 ca và `fe-ux-02a.test.ts` đủ 3 nhóm (design mục 4), xanh.
- [ ] Kiểm thử đúng mục 5, đạt, kèm log.
- [ ] Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 8) rỗng.
- [ ] Không mã dư thừa: `KpiCard` (dashboard), `SupplyMetric`, `StatusBadge` chọn biến thể cũ, hằng `INPUT` của 5 màn và khối chặn cũ xoá hẳn; checkpoint liệt kê bản sao còn lại ngoài phạm vi (QĐ-3).

## 5. Phạm vi kiểm thử

PR không đổi logic, nhưng đổi tệp dùng chung với kênh Nhà đầu tư (QĐ-5, `SettlementProgress` hiện cả ở `/trade`) và đây là mốc chạy e2e đầy đủ sau ba PR khung. Trong `scripts/run-local-all.sh`, phần `e2e` chỉ chạy project mock; e2e trên chuỗi Hardhat là phần `evm` (dựng bản build riêng `.next-hardhat`, reset chuỗi, chạy `E2E_CHAIN=hardhat-local`, cần mạng như `build`). Vì vậy dev chạy cả `evm`; kết quả mock không thay được kết quả Hardhat.

| Ai | Chạy | Không chạy |
|---|---|---|
| Dev | `bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm` một lần, lưu log (log phải có cả mục "EVM - E2E PROJECT HARDHAT", trong đó `permit-order.spec.ts` xanh); đo action, JS bằng `tools/20261103_do_moc_measure.js` (gửi kèm trong gói spec này, sha256 `ca67480e9e837446fc18ed0c2c63a2ea363d52be020acfc4c1b8cc56d19555b5`), CSS theo cách 01c. Log, ảnh, số đo để ngoài repo, gửi kèm báo cáo | `contracts` |
| Supervisor | Đọc diff 7 tệp màn và nội dung; build; chạy `fe-ux-02a-van-hanh`, `fix-05-tong-quan`, `ops-transactions`, `vault-withdraw`, `investor-channel` và unit test mới; gây lỗi có chủ đích 3 điểm (bỏ một trạng thái khỏi `orderStatusTone`, thêm `role="status"` mặc định vào `Alert`, đảo sắc `current` và `failed` trong `settlementStepTone`); đọc log mục EVM của dev; xem ảnh | Full suite |
