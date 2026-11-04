# FE-UX-02b: 3 màn Vận hành có nhiều logic (`/draft`, `/config`, `/recall`)

| | |
|---|---|
| Nhánh | `feat/fe-ux-02b-van-hanh` từ `release/ui-v2` @ `27a52ad` (sau #87) |
| PR | Một PR, **base `release/ui-v2`**, KHÔNG vào `dev`. Không tự merge |
| Loại | Frontend thuần. Không `lib/`, `app/actions`, `app/api`, mọi `gates.ts`, `token-info-read.ts`; không thêm gói npm; không sửa `components/ui/*` (dùng thành phần của FE-UX-02a như đang có; thiếu gì thì báo, không tự thêm) |
| Mức kiểm thử | **B**, phạm vi ở mục 5 |
| Nguồn | Kế hoạch 03/11; `docs/20261101_UI_UX_BAN_GIAO_SUPERVISOR.md` mục 4.4, 7.1, 8; bản chốt `draft.html`, `config.html`, `recall.html`, `assets/c.css`; `notes/{draft,config,recall}.md` |
| Thứ tự ưu tiên khi nguồn xung đột | Spec này, rồi kế hoạch 03/11, rồi mã `release/ui-v2` @ `27a52ad`, rồi tài liệu bàn giao và notes, cuối cùng là bản xem thử. Notes viết theo dev `67ece1e`, đã cũ ở các điểm QĐ-8 |

## 1. Mục tiêu

Vẽ lại 3 màn theo bản chốt bằng thành phần dùng chung của FE-UX-02a (`Kpi`, `Alert`, `EmptyState`, `fieldClass`, `Card` `tone`, `CardTitleIcon`, `Badge` sắc). Không đổi câu chữ (trừ QĐ-7), trường, nút, hộp thoại, điều kiện khoá, lời gọi server action, số action khi mở màn.

Không làm: câu phụ dưới tiêu đề và "Chain đang xem" (test cấm), tách ngày giờ thành 2 dòng, nhãn mới cho bảng hồ sơ thu hồi, hiện tiêu đề trong nhánh đang tải và lỗi của `/recall` (đổi luồng render), cuộn bảng hồ sơ trong 480 px, minh hoạ SVG, chuyển động JS.

## 2. Quyết định (QĐ)

- **QĐ-1. Không đổi logic màn.** Trong mọi tệp ở danh sách trắng: giữ nguyên hook, state, effect, debounce, `AbortController`, handler, `Promise.all` và hạn 15 giây ở `/draft`, `stage` hộp thoại ở `/config`, `useCallback`, `useMemo`, `finish`, ref và focus của `RecallDialog`, điều kiện khoá (`blockReason`, `busy`, `checked`, `submitDisabled`, `datesValid`, `reasonValid`, `symbolMatches`), `chooseSource`. Diff chỉ là vỏ JSX, `className`, thay khối lặp bằng thành phần dùng chung có cùng chữ và thuộc tính, thêm thuộc tính `data-tone` mới.
- **QĐ-2. Số action khi mở màn giữ nguyên:** `/draft` 3 (một `Promise.all`), `/config` 1, `/recall` 1. Tra token vẫn qua route `/api/token-info`.
- **QĐ-3. Ô số liệu:**
  - `/draft`: 2 ô "Yêu cầu tạo token đang chờ", "Yêu cầu huỷ token đang chờ" là `Kpi` sắc `default` (số đếm, theo mục 4.4; bản xem thử tô `hl` nhưng mục 4.4 ưu tiên). Giữ `aria-label` đang có; giá trị rỗng hiện `–` (trước đây `StatCard` hiện gạch dài, xem QĐ-7).
  - `/config`: ô giá áp dụng (nhãn thật "Giá áp dụng cho lệnh mới" hoặc "... (trên hợp đồng)", `price-config.tsx:117`) là `Kpi` `au` đầu thẻ "Giá phát hành"; ô "Tổng cung trên chuỗi" là `Kpi` `hl` đầu thẻ "Tình trạng phát hành" (dời vị trí, giữ nhãn và chữ). `data-testid="effective-price"` đặt trên phần tử bên trong `value` chứa đúng chuỗi `X VNDB` (`fe-07-price-config.spec.ts:22` dùng `toHaveText`), KHÔNG đặt lên gốc `Kpi`, không dùng prop `unit` cho ô này.
  - `/recall`: không có ô số liệu.
- **QĐ-4. Nhãn trạng thái có sắc:**
  - Yêu cầu tạo, huỷ token (`maker-checker/status-badge.tsx`): `PENDING` `warn`, `EXECUTING` `info`, `COMPLETED` `ok`, `REJECTED` `bad`, `FAILED` `bad`. Giữ `data-status`. Đổi này hiện cả ở `/approvals`, `/approvals/[id]` (FE-UX-03), chấp nhận.
  - Thu hồi: hàm thuần mới `components/recall/case-tone.ts`, khoá kiểu `SettlementCaseStatus | 'PREVIEW'` (import type từ `settlement.store.port.ts:35`; `'PREVIEW'` là dòng "Dự kiến" ở `cases-table.tsx:44`): `NOTIFIED` `warn`, `CONFIRMED` `info`, `PAID` `info`, `BURNING` `info`, `BURNED` `ok`, `FAILED` `bad`, `PREVIEW` `info`; dùng `Record<..., Tone>` để thiếu ánh xạ thì typecheck fail. Nơi dùng nhận `string` từ máy chủ thì thu hẹp kiểu bằng hàm kiểm, giá trị lạ trả `info`. Giai đoạn đợt (`RecallPhaseKind`): mọi giá trị `info`. Không đặt trong `recall/gates.ts`.
  - Badge khác trong `round-info.tsx:34-37`: "Chế độ PoC" giữ `outline`; "Đã huỷ" `bad`; "Token trên chuỗi" khi đã đóng băng `warn`, khi chưa giữ `outline`. Chữ giữ nguyên.
  - Bước thu hồi (`recall/steps.tsx`): mỗi `li` giữ `aria-current`, thêm `data-state` (`done` `current` `pending`) và `data-tone` (`ok` `warn` `muted`); bỏ lớp `emerald-*` tự viết. Ở giai đoạn `CLOSED`, bước 4 "Hoàn tất" là `current` theo `recall/gates.ts`, nên hiện viền vàng: cố ý, không đổi logic.
- **QĐ-5. Thành phần dùng chung thay khối tự viết:** `Alert` cho cảnh báo huỷ toàn bộ (`role="alert"`), phản hồi gửi ở `/draft` và `/config` (`role="status"`), `Warn`, `PartError` của `/config` (giữ `role="status"` của `Warn`, `price-config.tsx:76`, và `role="alert"` của `PartError`), khối khoá chain, chặn đóng băng, tiến độ, lỗi thao tác ở `/recall` (giữ đúng `role` đang có, không thêm `role` mới, bỏ lớp `amber-*` tự viết). Phản hồi đổi giá ở `/config` đang có `data-tone="success|warning|error"`: giữ nguyên giá trị đó (truyền ghi đè `data-tone` của `Alert`). Lỗi thao tác trong `RecallDialog` (`dialogs.tsx:42-54`: `useRef<HTMLParagraphElement>`, `<p ref={errorRef} role="alert" tabIndex={-1}>`, effect gọi `focus()` khi có lỗi): bọc bằng `Alert tone="bad"` KHÔNG truyền `role`, giữ nguyên phần tử `<p ref={errorRef} role="alert" tabIndex={-1}>` bên trong; không chuyển ref sang `Alert`, không đổi kiểu ref, không bỏ `focus()`. `EmptyState` cho "Đang tải…" của `/config`, nhánh đang tải và lỗi của `/recall` (giữ `role="status"` và chữ `Đang tải tình trạng thu hồi...` ba dấu chấm ASCII; giữ `role="alert"` và nút "Thử lại"), câu rỗng của bảng lịch sử, bảng hồ sơ, `RequestTable`. `RequestTable` thêm prop tuỳ chọn `loading?: boolean`; chỉ `/draft` truyền (khi đang tải), `/approvals` không truyền nên giữ hiện câu `emptyText` như cũ trong `EmptyState` không quay. `fieldClass` cho mọi ô nhập; ô chỉ đọc ở `/draft` (`draft.tsx:469` đang dùng `INPUT_CLASS.replace(...)`) dùng `fieldClass` cộng `read-only:bg-muted read-only:text-muted-foreground` (nền đậm hơn `bg-muted/40` của ô thường), không dùng `.replace`.
- **QĐ-6. Tiêu đề thẻ:** `CardTitleIcon` và tiêu đề; ở `/config` 4 tiêu đề thẻ giữ là `h2` (`fe-07-price-config.spec.ts:57-59` tìm `level: 2, exact`), vai Kiểm soát viên vẫn không có `h2` "Đổi giá" và nút "Đổi giá" (:91-92).
- **QĐ-7. Ký tự cấm trong chuỗi do frontend dựng:** `draft.tsx:404` câu gợi ý "Đã có ví thanh toán trên chuỗi" bỏ gạch dài U+2014, thay bằng dấu phẩy (không test nào khớp câu này); `request-table.tsx:84`, `:126` ô trống gạch dài thành gạch ngắn `–` (U+2013); giá trị rỗng của 2 ô số liệu `/draft` hiện `–` (trước là gạch dài trong `StatCard`). `maker-checker/stat-card.tsx:10` KHÔNG sửa ở PR này (còn `/approvals` dùng, FE-UX-03 xử lý). Chuỗi do máy chủ trả giữ nguyên.
- **QĐ-8. Bản xem thử, notes đã cũ, KHÔNG làm theo:** các mục ở mục 1 "Không làm"; ô "tạo đang chờ" tô `hl` (QĐ-3); thiếu ô chọn token ở bản xem thử (mã có `TokenScopeSelect`, giữ đúng một lần, kể cả chú thích: `uiux-02-dau-man.test.ts:88`); kết quả rỗng dùng gạch dài U+2014 của bản xem thử.
- **QĐ-9. Mốc test phải giữ** (không sửa `app/test/**`, không sửa e2e cũ):
  - `/draft`: `getByLabel('Thẻ tạo token'|'Thẻ huỷ token')`; cặp `dt`/`dd` liền kề trong khối thông tin token (`maker-checker.spec.ts:32`, `:172-175` ở `/approvals/[id]`); `[data-check="cap"]` với `data-passed`, chữ "Không vượt trần còn lại Không đạt" CÓ dấu cách giữa nhãn và kết quả (`request-check-block.tsx:47` `{' '}`); `data-testid` `{mint|burn}-block-reason`; mỗi thẻ biểu mẫu đúng một `role="status"` và thẻ Huỷ đúng một `role="alert"` (strict); tên bảng và `data-request-id`; lỗi tra token nằm TRONG "Khối thông tin token", nút "Thử đọc lại thông tin token" giữ tên (`token-info-read.spec.ts:32-35`); `data-chain={chain}`; không thêm nhãn nào chứa "Lý do", "Số lượng" trong thẻ (getByLabel khớp chuỗi con, strict); `[data-slot=card]` đầu tiên giữ bo 22 px (`fe-ux-01a-nen.spec.ts:105-120`).
  - `/config`: các mốc QĐ-3, QĐ-6; `getByLabel('Đổi giá', {exact})`, nhãn hai ô, câu hộp thoại nguyên văn, nút và ô đánh dấu (`fe-07-price-config.spec.ts:27-44`); thẻ Đổi giá đúng một `role="status"`; tên bảng lịch sử.
  - `/recall`: nút "Mở đợt thu hồi"; nhãn "Ngày hết hạn", "Số ngày báo trước", "Lý do" trong hộp thoại; nút khớp chính xác; `getByRole('listitem').filter({hasText: 'Đến hạn'|'Đã đóng băng'})` strict trên cả trang, nên KHÔNG dựng Badge, ô dữ liệu hay phần tử nào khác thành `li` có các chữ đó (`recall.spec.ts:102`, `:128`); câu "chỉ xem", câu hộp thoại huỷ, "Đợt gần nhất đã huỷ".
  - Bổ sung: `request-table.tsx` vẫn export `resultText` (`uiux-01.test.ts:42`); KHÔNG đưa vào mã các câu bản xem thử "Lập yêu cầu tạo hoặc huỷ", "Giá phát hành WPT áp dụng", "Thanh toán thực hiện ngoài hệ thống" (`uiux-02-dau-man.test.ts:199-208` đọc mã nguồn); ô xác nhận "Tôi xác nhận huỷ toàn bộ nguồn cung" nằm trong phần tử `role="alert"` (`maker-checker.spec.ts:115-116`); nhãn "Mã hoặc ký hiệu token", "Ví đích", "Nguồn huỷ", nút "Gửi yêu cầu tạo token", "Gửi yêu cầu huỷ token" (`fe-ux-01c-chuyen-dong.spec.ts:44-52`, `mint.spec.ts:170-177`); dòng bảng yêu cầu chứa chữ lý do (`ops-transactions.spec.ts:64-67`); heading chứa "Lập lệnh" (`chain-scope.spec.ts:16`); `[data-slot="button"].bg-primary` đầu tiên trong `main` vẫn là nút mặc định (`fe-ux-01a-nen.spec.ts:108`).
  - Mọi màn: đúng một `h1` khi đã tải; không `.font-mono`; mọi `Link` `prefetch={false}`.
- **QĐ-10. Hiệu năng:** JS gzip 4 trang đo (`/`, `/approvals`, `/portfolio`, `/trade`) và trang `/draft`, `/config`, `/recall` không tăng quá 3 KB mỗi trang; CSS gzip không tăng quá 2 KB; cảnh báo hydrate, lỗi console 0.

## 3. Phạm vi tệp (danh sách trắng)

| Được sửa | Ghi chú |
|---|---|
| `app/src/components/pages/{draft,price-config,recall}.tsx` | QĐ-1 |
| `app/src/components/maker-checker/{request-check-block,request-table,status-badge,token-info-block}.tsx` | Dùng chung với `/approvals`, `/approvals/[id]` |
| `app/src/components/recall/{cases-table,controls,dialogs,round-info,steps}.tsx` | Chỉ `/recall` dùng |
| `app/src/components/recall/case-tone.ts` (mới) | QĐ-4 |
| `app/e2e/fe-ux-02b-van-hanh.spec.ts`, `app/test/fe-ux-02b.test.ts` (mới) | Design mục 3 |
| `docs/fe-ux-02b-van-hanh/{requirements,design,tasks}.md`, `docs/CHECKPOINT_FEUX02B.md`, `docs/USER_GUIDE.md`, `.kiro/task-status.json` | Theo quy ước repo |

Cấm: `maker-checker/{stat-card.tsx,gates.ts,token-info-read.ts}`, `recall/gates.ts`, `components/ui/**`, `components/layout/**`, `globals.css`, route `app/src/app/**`, `lib/**`, `app/test/**` có sẵn, e2e có sẵn, `package*.json`. `/draft` thôi import `StatCard`, `INPUT_CLASS`; tệp `stat-card.tsx` còn lại cho `/approvals` (FE-UX-03 xoá).

## 4. Điều kiện hoàn thành

- [ ] 3 màn đúng bố cục bản chốt trừ mục 1 "Không làm" và QĐ-8; bảng đối chiếu notes từng màn (Giữ, Đã cũ theo QĐ-8, Bỏ kèm lý do) trong checkpoint.
- [ ] Ô số liệu đúng QĐ-3; `effective-price` vẫn có chữ đúng `X VNDB`.
- [ ] Nhãn trạng thái và bước đúng QĐ-4; `case-tone.ts` phủ đủ trạng thái (unit test).
- [ ] Khối tự viết đã thay theo QĐ-5; không còn lớp `amber-*`, `emerald-*`, hằng `FIELD`, `NOTICE_WARN`, `RECALL_FIELD`, hàm `Warn`, `PartError` tự viết trong phạm vi.
- [ ] Không đổi chữ, trường, nút, điều kiện khoá, hộp thoại; chỉ chuỗi QĐ-7 đổi (tasks bước 7d).
- [ ] Diff giữ logic (QĐ-1); checkpoint liệt kê từng đoạn đổi nằm gần hook, handler, điều kiện khoá, kèm lý do an toàn.
- [ ] Số action khi mở màn đúng QĐ-2 ở 3 màn và không đổi ở 28 đường dẫn; JS, CSS trong trần QĐ-10; hydrate, lỗi console 0.
- [ ] Mốc test QĐ-9 giữ nguyên; không sửa test có sẵn.
- [ ] Lỗi thao tác trong hộp thoại thu hồi: hộp thoại vẫn mở, tiêu điểm nằm trên thông báo lỗi, và trong hộp thoại chỉ có đúng một `role="alert"` cho lỗi đó (kiểm thủ công, ghi cách tạo lỗi và kết quả trong checkpoint; Supervisor kiểm lại khi nghiệm thu).
- [ ] `/approvals`, `/approvals/[id]` vẫn đúng sau khi đổi `status-badge`, `request-table`, `token-info-block` (`maker-checker.spec.ts` xanh, ảnh trước và sau 2 màn này).
- [ ] 390 px không tràn ngang ở 3 màn; ảnh 1440 và 390, Sáng và Tối, trước và sau cho 3 màn; `/recall` chụp cả lúc có đợt đang mở: dùng một máy chủ mock RIÊNG cổng khác (không phải máy chủ của lần chạy e2e hay lần đo), mở đợt bằng tay theo các bước `recall.spec.ts:94-101`, chụp, rồi tắt máy chủ đó (dữ liệu mock nằm trong bộ nhớ nên mất theo); ghi cổng và thời điểm trong checkpoint. Ảnh và số đo trước, sau phải lấy trên dữ liệu tương đương (cùng không có đợt, hoặc cùng có đợt), không so một bên có đợt mở với một bên không, `/draft` chụp cả lúc có yêu cầu trong bảng (sau `maker-checker.spec.ts`).
- [ ] `fe-ux-02b-van-hanh.spec.ts` đủ 3 ca và `fe-ux-02b.test.ts` đủ 3 nhóm (design mục 3), xanh.
- [ ] Kiểm thử đúng mục 5, đạt, kèm log.
- [ ] Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 7) rỗng.
- [ ] Không mã dư thừa: hằng, hàm, import, lớp không còn dùng trong phạm vi xoá hẳn; checkpoint ghi bản sao còn lại ngoài phạm vi (`stat-card.tsx`).

## 5. Phạm vi kiểm thử

Không đổi logic, backend, chuỗi. Rủi ro chính là vỡ biểu mẫu, hộp thoại (R1) và mất chữ (R2). Kế hoạch quy định nhóm lập duyệt phải kiểm trên Hardhat; PR này sửa `/draft` và 4 thành phần dùng chung với `/approvals`, kết quả Hardhat của 02a chỉ xác nhận mã trước thay đổi, nên chạy lại phần `evm` (e2e project Hardhat) ngay trong PR này.

| Ai | Chạy | Không chạy |
|---|---|---|
| Dev | `bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm` một lần (`e2e` là project mock đầy đủ, `evm` là project Hardhat), lưu log; log phải có mục "EVM - E2E PROJECT HARDHAT" xanh; đo action, JS bằng `tools/20261104_do_moc_measure.js` (gửi kèm, sha256 `eefeb720730e3ef4f1d1655e033d91863f994612343cc0ad89d243da83657238`; khác bản 03/11 đúng một dòng: nhận danh sách trang đo JS qua biến môi trường, chạy `JS_PAGES=/,/portfolio,/trade,/approvals,/draft,/config,/recall node 20261104_do_moc_measure.js <baseURL> <thư mục ra>`), CSS theo cách 01c. Log, ảnh, số đo để ngoài repo, gửi kèm | `contracts` |
| Supervisor | Đọc diff 3 tệp màn, 4 tệp `maker-checker`, 5 tệp `recall`; build; đọc mục EVM trong log của dev; thử tay lỗi thao tác trong hộp thoại thu hồi (focus, một `role="alert"`); chạy `fe-ux-02b-van-hanh`, `maker-checker`, `fe-07-price-config`, `recall`, `token-info-read`, `mint` và unit test mới; gây lỗi có chủ đích 3 điểm (bỏ `{' '}` ở `request-check-block.tsx`, đặt `effective-price` lên gốc `Kpi`, đổi sắc `BURNED` trong `case-tone.ts`); xem ảnh | Full suite |
