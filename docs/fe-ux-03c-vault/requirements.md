# FE-UX-03c: màn Vault thanh toán SPV (`/vault`)

| | |
|---|---|
| Nhánh | `feat/fe-ux-03c-vault` từ `release/ui-v2` @ `1238a54` hoặc sau (PR #91 FE-UX-03b đã merge) |
| PR | Một PR, **base `release/ui-v2`**, KHÔNG vào `dev`. Không tự merge |
| Loại | Frontend thuần. Không `lib/`, `app/actions`, `app/api`; không thêm gói npm; không sửa `components/ui/*`, `components/distribution/*` (thiếu gì thì báo) |
| Mức kiểm thử | **B**, phạm vi ở mục 5 (có Hardhat: `vault-withdraw.spec.ts` chạy cả project Hardhat) |
| Nguồn | Kế hoạch 03/11; `docs/20261101_UI_UX_BAN_GIAO_SUPERVISOR.md` mục 4.4, 7.1, 8; bản chốt `vault.html`, `assets/c.css`; `notes/vault.md` (đã cũ ở câu bước lưu: nay là "thành" và có dấu nghìn) |
| Thứ tự ưu tiên khi nguồn xung đột | Spec này, rồi kế hoạch 03/11, rồi mã `release/ui-v2` sau #91, rồi tài liệu bàn giao (gồm `docs/USER_GUIDE.md:1253-1268`) và notes, cuối cùng là bản xem thử |

## 1. Mục tiêu

Vẽ lại `/vault` theo bản chốt bằng thành phần dùng chung (`Kpi`, `Alert`, `EmptyState`, `Card`, `CardTitleIcon`, `Badge` sắc, `fieldClass`). Không đổi câu chữ, trường, thứ tự trường, nút, điều kiện khoá, lời gọi server action, số action khi mở màn.

Không làm: câu phụ dưới tiêu đề (test cấm: `uiux-02-dau-man.test.ts:213`, `:261-264`); đưa "Lợi nhuận chia quý trước" lên hàng ô số liệu (giữ thứ tự 11 trường theo mã và USER_GUIDE); đổi thứ tự thẻ trong DOM (giữ Cấu hình khoá, Lịch sử cấu hình, Lệnh rút cần xem xét, Lịch sử chốt kỳ); nút chuyển `role="radio"` thay radio gốc; thêm `aria-label` mới cho bảng; biểu tượng trong ô số liệu (trần JS, bài học 03b); hiệu ứng đếm số, đồng xu (FE-UX-08); quản lý lại tiêu điểm sau khi tải lại.

## 2. Quyết định (QĐ)

- **QĐ-1. Không đổi logic.** Giữ nguyên trong `vault-status.tsx`: effect `getVaultOverviewAction({ chain })` của trang; `VaultConfigCard key={chain}` và `save()` (chỉ gửi ô của chế độ đang chọn; lỗi `LEDGER` vẫn tải lại); `VaultConfigHistoryCard` (effect, `key`, phân trang chỉ hiện khi `total > pageSize`); `WithdrawReviewCard` (`load`, effect, đối soát, chốt, `busy` dùng chung, ô chốt chỉ hiện khi `canResolve`); điều kiện khoá (`!canConfigure || saving` cho radio và ô; nút Lưu chỉ hiện khi `canConfigure`, khoá khi `saving`; nút lệnh rút khoá khi `busy`; Trang trước khoá khi `page<=1`, Trang sau khi `page>=pages`); `configEffectiveText`, `configValue`. Diff chỉ là vỏ JSX, `className`, thay khối lặp bằng thành phần dùng chung có cùng chữ và thuộc tính.
- **QĐ-2. Số action khi mở màn giữ nguyên:** 1 (`getVaultOverviewAction`) khi lỗi hoặc chain chưa có vault; 3 khi có vault (thêm `getVaultConfigHistoryAction` trang 1 và `listWithdrawReviewsAction`). Lời gọi trong mã nguồn `vault-status.tsx` giữ đúng: 1 `getVaultOverviewAction(`, 1 `getVaultConfigHistoryAction(`, 2 `listWithdrawReviewsAction(`, 3 `useEffect(` (unit test mới khoá các con số này, design mục 3).
- **QĐ-3. Ô số liệu:** 4 trường đầu (Số dư VNDB, Số VNDB đang khoá, Số dư WPT, VNDB có thể rút) thành `Kpi`, đúng thứ tự: Số dư VNDB `au` cỡ `lg`, VNDB có thể rút `gold`, hai ô còn lại `default`; `value={...}` và `unit` tách riêng (phần tử `tabular-nums` đầu tiên chỉ chứa số); không biểu tượng trong ô. 7 trường còn lại (Chế độ khoá, Tỷ lệ áp, Mức khoá cố định, Lợi nhuận chia quý trước, Ngày cấu hình có hiệu lực giữ `title`, Địa chỉ vault, Trạng thái rút; Tỷ lệ áp chỉ hiện khi `PERCENT`, Mức khoá cố định chỉ khi `FIXED`, khi `UNSET` không ô nào trong hai ô này hiện, nên thẻ hiện 5 hoặc 6 ô) ở một thẻ ngay dưới, lưới tự chia cột tối thiểu 190 px, GIỮ thứ tự và điều kiện hiện như hiện tại (`vault-status.tsx:460-475`); địa chỉ vault giữ ĐỦ, `font-code break-all` như hiện tại (không cắt giữa); câu tỷ lệ chờ áp giữ `role="note"` trong thẻ này. Chế độ khoá để chữ thường, không `Badge`. Trạng thái rút là `Badge` đặt trong ô giá trị của trường đó, giữ chữ "Đang hoạt động", "Đang tạm dừng" (`:475`): `withdrawalsPaused` sai thì `ok`, đúng thì `warn`.
- **QĐ-4. Nhóm chế độ khoá:** GIỮ `<input type="radio">` gốc có `<label>` (e2e `vault-withdraw.spec.ts:44` gọi `.getByLabel('Khoá số cố định').check()`), nhóm giữ `role="radiogroup"` `aria-label="Chế độ khoá"`. Vẽ dạng nút chuyển: mỗi `label` là ô `relative` bo tròn có `cursor-pointer`, `input` phủ toàn ô bằng `absolute inset-0 m-0 size-full appearance-none opacity-0` (radio là phần tử thay thế, thiếu `size-full appearance-none` thì chỉ chiếm 13 px ở góc; vẫn là đích nhận bấm, KHÔNG dùng `sr-only` hay kích thước 0); ô đang chọn đổi nền `bg-primary text-primary-foreground` qua `has-[:checked]:`; tiêu điểm bàn phím hiện vòng qua `has-[:focus-visible]:`; khoá thì mờ qua `has-[:disabled]:`.
- **QĐ-5. Tách dòng lệnh rút để kiểm trạng thái khó tạo trên mock.** Mock không tạo được lệnh `NEEDS_REVIEW`, `PAYOUT_REVIEW`. Dời phần dựng một dòng (`vault-status.tsx:275-330`, thân `rows.map`) thành thành phần trình bày `WithdrawReviewItem` ở tệp mới `components/vault/withdraw-review-item.tsx`, nhận `row`, `canResolve`, `busy`, `txHash`, `reason` và callback `onChange(key, value)`, `onResolve('COMPLETED' | 'FAILED')`; không gọi action, không `useEffect`. Dời nguyên văn TRỪ đúng các phép thay được phép: `field(row.id).txHash` thành `txHash`, `field(row.id).reason` thành `reason`, `setField(row.id, k, v)` thành `onChange(k, v)`, `resolve(row.id, s)` thành `onResolve(s)`; `key={row.id}` ở lại chỗ gọi trong `rows.map`. Hàm `amount`, `short` (8 ký tự đầu, dấu ba chấm, 6 ký tự cuối) dời sang `components/vault/` nguyên văn để trang và tệp mới cùng dùng (trang còn dùng ở `:187`, `:357`, `:411`, `:460-469`, `:580-585`). `FIELD` trong commit dời được dời theo, rồi XOÁ ở commit đổi kiểu (thay bằng `fieldClass`, kể cả `:147`, `:159`). Trong trang, `field`, `setField`, `resolve` giữ nguyên, chỉ truyền xuống. Commit dời riêng; checkpoint dán đoạn trước và sau. Hai link explorer tự viết trong trang (`:411`, `:585`) gộp thành một hàm cục bộ (cùng cách cắt 8 ký tự), không dùng `TxLink` của `components/distribution/` (cắt 10 ký tự, đổi chữ hiển thị).
- **QĐ-6. Thành phần dùng chung thay khối tự viết:** đang tải "Đang đọc trạng thái vault…" và "Đang đọc…" thành `EmptyState loading` (giữ chữ, không thêm `role`); lỗi tải thành `Alert bad` giữ `role="alert"`; chain chưa có vault thành `EmptyState` giữ chữ; câu chỉ xem thành `Alert info` không `role`; câu đang bận giữ `role="status"` trong `Alert info`; lỗi chéo, lỗi ô giữ `role="alert"`; lỗi Lịch sử cấu hình (`:391`) và lỗi Lịch sử chốt kỳ (`:566`) thành `Alert bad` giữ `role="alert"`; hai câu hiệu lực `role="note"` (`:149`, `:162`) giữ `role`; kết quả lưu thành `Alert` (`ok` hay `bad` theo `role` hiện tại) giữ `aria-label="Kết quả lưu cấu hình"` và danh sách bước `<ol>` bên trong; thông báo lệnh rút thành `Alert` giữ `role` hiện có; các danh sách rỗng thành `EmptyState`. Ô % và ô số cố định dùng `fieldClass` cộng `font-code`, hậu tố "%" và "VNDB" là chữ trang trí ngoài `input` (`aria-hidden`, nhãn giữ "Tỷ lệ khoá (%)", "Số khoá cố định (VNDB)"); ô lý do dùng `fieldClass`. Xoá `Metric`, `FIELD` (sau khi dời) và hai link explorer trùng.
- **QĐ-7. Thẻ:** "Trạng thái hiện tại" giữ là thẻ có tiêu đề `CardTitle` (là `div`, không phải heading) kèm `CardTitleIcon`; "Cấu hình khoá", "Lịch sử cấu hình", "Lệnh rút cần xem xét", "Lịch sử chốt kỳ" có `CardTitleIcon`; thẻ Lệnh rút `tone="default"` (không `gold`, tránh đè màu chữ ô nhập và nút ở chế độ Tối). Không heading nào khác chứa "Vault thanh toán SPV" (`uiux-02-dau-man.spec.ts:110`, `:202` so chuỗi con không phân biệt hoa thường, strict): câu "Chain này chưa triển khai vault thanh toán SPV" KHÔNG được thành heading.
- **QĐ-8. Mốc test phải giữ** (không sửa `app/test/**`, không sửa e2e cũ):
  - `vault-withdraw.spec.ts` (mock và Hardhat): `form` "Biểu mẫu cấu hình khoá" (:41); `radiogroup` "Chế độ khoá" và `getByLabel('Khoá số cố định').check()` (:44); `getByLabel('Tỷ lệ khoá (%)')` đếm 0 khi chọn cố định (:45); `getByLabel('Số khoá cố định (VNDB)')` (:46); `getByLabel('Ví nhận tiền rút')` đếm 0 (:48); nút "Lưu cấu hình khoá" (:49); vùng "Kết quả lưu cấu hình" (:50-52); `getByText('Khoá số tiền cố định', {exact})` phần tử đầu đang hiện (:53); bảng "Lịch sử cấu hình" và `tbody tr[data-param="LOCK_MODE"]` (:55-56); Giao dịch viên thấy câu chỉ xem, không có nút Lưu (:62-63).
  - `uiux-02-dau-man.spec.ts:31`, `:48-51` (`#token-scope`), `:110`, `:202` (heading), `:128-144` (390 px), `:230` (một `h1`); `uiux-02-dau-man.test.ts:33`, `:88` (đúng một `<TokenScopeSelect`), `:213`, `:261-264`; `hf-01-hieu-nang.test.ts` nếu dùng `Link`.
  - `data-request`, `data-param` giữ nguyên.
- **QĐ-9. Hiệu năng:** JS gzip `/vault` không tăng quá 3 KB (đo theo byte so với bản mốc build riêng như 03b), các trang đo khác không tăng; CSS gzip không tăng quá 2 KB. Lỗi: script đo ghi cho mỗi đường dẫn ba số `hydration`, `consoleErrors` (`console` loại `error`), `pageErrors` (sự kiện `pageerror`), cộng dồn 4 biến thể Sáng, Tối, 1440, 390; `/vault` cả ba số bằng 0, các đường dẫn khác không tăng so với mốc (đo bằng cùng script). Lỗi hydrate React đi qua `console.error` nên được tính ở cả `hydration` lẫn `consoleErrors`. Script chỉ đo `/vault` với vai Giao dịch viên; vai Kiểm soát viên do e2e ca 3 phủ.

## 3. Phạm vi tệp (danh sách trắng)

| Được sửa | Ghi chú |
|---|---|
| `app/src/components/pages/vault-status.tsx` | QĐ-1 |
| `app/src/components/vault/*.tsx`, `*.ts` (mới: `withdraw-review-item.tsx` và tệp chứa phần dời chung) | QĐ-5, liệt kê tên tệp trong checkpoint |
| `app/e2e/fe-ux-03c-vault.spec.ts`, `app/test/fe-ux-03c.test.ts` (mới) | Design mục 3 |
| `docs/tech-report.md` | CHỈ khi số dòng marker dời, và chỉ đổi khối tự sinh bằng `node scripts/scan-pending.mjs --write-report` |
| `docs/fe-ux-03c-vault/{requirements,design,tasks}.md`, `docs/CHECKPOINT_FEUX03C.md`, `docs/USER_GUIDE.md`, `.kiro/task-status.json` | Theo quy ước repo |

Cấm mọi tệp khác, gồm `components/distribution/**`, `components/ui/**`, `components/layout/**`, `globals.css`, route `app/src/app/**`, `lib/**`, `app/test/**` có sẵn, e2e có sẵn, `package*.json`.

## 4. Điều kiện hoàn thành

- [ ] Màn đúng bố cục bản chốt trừ mục 1 "Không làm", cho cả Kiểm soát viên (cấu hình được) và Giao dịch viên (chỉ xem); bảng đối chiếu notes trong checkpoint.
- [ ] Ô số liệu, thẻ trạng thái đúng QĐ-3, giữ thứ tự 11 trường; nhóm chế độ khoá đúng QĐ-4 (bấm chuột, phím mũi tên, vòng tiêu điểm do e2e ca 2 kiểm tự động; vai chỉ xem kiểm tay, ghi trong checkpoint).
- [ ] `WithdrawReviewItem` và phần dùng chung dời đúng QĐ-5 (chỉ các phép thay được phép), commit riêng; checkpoint dán đoạn trước và sau.
- [ ] Khối tự viết thay theo QĐ-6; `Metric`, `FIELD`, link explorer trùng không còn trong trang.
- [ ] Không đổi chữ, trường, nút, điều kiện khoá (tasks bước 6d rỗng).
- [ ] Diff giữ logic (QĐ-1, QĐ-2); checkpoint liệt kê từng đoạn đổi nằm gần hook, handler, điều kiện khoá, kèm lý do an toàn.
- [ ] Số action khi mở màn đúng QĐ-2 và không đổi ở 28 đường dẫn; JS, CSS trong trần QĐ-9 (đo theo byte); `metrics.json` của `/vault` có `hydration`, `consoleErrors`, `pageErrors` đều 0, đường dẫn khác không tăng so với mốc.
- [ ] Mốc test QĐ-8 giữ nguyên; không sửa test có sẵn.
- [ ] Ảnh 1440 và 390, Sáng và Tối, trước và sau, hai vai, khi CÓ dữ liệu, tạo trên máy chủ mock RIÊNG (`next start` cổng khác, env như `playwright.config.ts`). Ảnh trước và ảnh sau mỗi lần dùng một tiến trình MỚI khởi động (dữ liệu mock nằm trong bộ nhớ nên tiến trình mới là dữ liệu sạch): trước từ bản build mốc, sau từ bản build nhánh; KHÔNG dùng lại máy chủ đã chạy test, đã chạy script đo hay đã chụp lượt trước. Hai lần chạy đúng công thức, cùng thứ tự:
  1. `E2E_BASE_URL=http://localhost:<cổng> npx playwright test e2e/ops-transactions.spec.ts` (VNDB vào vault).
  2. `E2E_BASE_URL=... npx playwright test e2e/vault-withdraw.spec.ts` (định danh NB001, lưu khoá cố định 1 VNDB, Người bán rút 1 VNDB tới COMPLETED; lịch sử cấu hình có dòng).
  3. `E2E_BASE_URL=... npx playwright test e2e/zz-distribution-approval.spec.ts` (tạo một dòng Lịch sử chốt kỳ).
  4. Kiểm soát viên lưu tay chế độ tỷ lệ 20%: vì đã có kỳ chia nên tỷ lệ thành tỷ lệ chờ, câu tỷ lệ chờ áp hiện, ô "Tỷ lệ áp" hiện 0% (đúng, chưa từng áp tỷ lệ); chụp; tắt máy chủ.
- [ ] Trạng thái khó tạo trên mock (lệnh rút `NEEDS_REVIEW`, `PAYOUT_REVIEW`, có và không có `canResolve`, `busy`): unit test QĐ-5 (design mục 3) và ảnh dựng ngoài repo bằng `renderToStaticMarkup` cộng CSS bản build, `page.setContent`, như cách 03b (Sáng, Tối, 1440, 390); không commit script.
- [ ] `fe-ux-03c-vault.spec.ts` (project mock) đủ 3 ca và `fe-ux-03c.test.ts` đủ 2 nhóm (design mục 3), xanh.
- [ ] Kiểm thử đúng mục 5, đạt, kèm log (chạy khi cổng e2e trống để máy chủ mới; log không có dòng `BO-DEM-ROLE`); log có mục "EVM - E2E PROJECT HARDHAT" xanh.
- [ ] Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 6) rỗng.
- [ ] Không mã dư thừa: hằng, hàm, import, lớp không còn dùng xoá hẳn.

## 5. Phạm vi kiểm thử

| Ai | Chạy | Không chạy |
|---|---|---|
| Dev | `bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm` một lần, lưu log; đo action, JS bằng `tools/20261104_do_moc_measure.js` (gửi kèm, sha256 `05ec70bf9e4b391ea41dcd83a26582adaa9e29251af42577db57e9b50f4c787a`; bản này thêm đếm `consoleErrors`, `pageErrors`, nên đo mốc cũng phải chạy lại bằng bản này; `JS_PAGES=/,/portfolio,/trade,/approvals,/distribution,/vault`), đo JS `/vault` theo byte so với bản mốc build riêng, CSS theo cách 01c. Gửi riêng đoạn log từ "EVM - E2E PROJECT HARDHAT" tới hết | `contracts` |
| Supervisor | Đọc diff, đối chiếu commit dời; build; chạy `fe-ux-03c-vault`, `vault-withdraw`, `uiux-02-dau-man` (e2e và unit), unit test mới; gây lỗi có chủ đích 4 điểm (bỏ `aria-label="Chế độ khoá"`; cho nút Lưu hiện với mọi vai; trong `WithdrawReviewItem` cho dòng `PAYOUT_REVIEW` hiện nút "Xác nhận hoàn tất"; thêm một lời gọi `listWithdrawReviewsAction(` vào trang); xem ảnh | Full suite |
