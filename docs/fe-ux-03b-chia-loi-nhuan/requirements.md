# FE-UX-03b: màn Chia lợi nhuận (`/distribution`)

| | |
|---|---|
| Nhánh | `feat/fe-ux-03b-chia-loi-nhuan` từ `release/ui-v2` @ `baf0fd4` (sau #89) |
| PR | Một PR, **base `release/ui-v2`**, KHÔNG vào `dev`. Không tự merge |
| Loại | Frontend thuần. Không `lib/`, `app/actions`, `app/api`, `distribution-amount-label.ts`; không thêm gói npm; không sửa `components/ui/*` (thiếu gì thì báo) |
| Mức kiểm thử | **B**, phạm vi ở mục 5 (có Hardhat: `zz-distribution-approval.spec.ts` chạy cả project Hardhat) |
| Nguồn | Kế hoạch 03/11; `docs/20261101_UI_UX_BAN_GIAO_SUPERVISOR.md` mục 4.4, 7.1, 8; bản chốt `distribution.html`, `assets/c.css`; `notes/distribution.md` (lượt 2 thắng lượt 1 khi mâu thuẫn) |
| Thứ tự ưu tiên khi nguồn xung đột | Spec này, rồi kế hoạch 03/11, rồi mã `release/ui-v2` @ `baf0fd4`, rồi tài liệu bàn giao và notes, cuối cùng là bản xem thử |

## 1. Mục tiêu

FE-UX-03b ban đầu gồm `/distribution` và `/vault`; tách tiếp: **03b** (bài này) chỉ `/distribution`, **03c** là `/vault` (mỗi màn trên 500 dòng, đều có luồng tiền, đều chạy trên Hardhat).

Vẽ lại `/distribution` theo bản chốt bằng thành phần dùng chung (`Kpi`, `Alert`, `EmptyState`, `Card` `tone`, `CardTitleIcon`, `Badge` sắc). Không đổi câu chữ, trường, nút, hộp xác nhận, điều kiện khoá, lời gọi server action, số action khi mở màn.

Không làm: câu phụ dưới tiêu đề (test cấm), đổi " (vault)" thành nhãn (test bắt chữ "(vault)"), tách giờ và ngày thành 2 dòng, đổi tông kết quả PARTIAL, AMOUNT_CHANGED sang cảnh báo (đang là lỗi; đổi là thêm logic), thêm hộp xác nhận cho "Tiếp tục chia", quản lý lại tiêu điểm sau khi tải lại (hành vi hiện có, ghi nợ UX như 03a), thêm `aria-label` mới cho bảng, chuyển động JS.

## 2. Quyết định (QĐ)

- **QĐ-1. Không đổi logic.** Giữ nguyên trong `distribution-approval.tsx`: effect chính gọi `getDistributionPageAction({chain,page:1,pageSize:10,runLimit:20})` theo `[chain,key]` có cờ `cancelled`; `run()` (đặt `busy`, gọi action, đóng hộp, đặt `message`, tông `ok` chỉ khi `DISTRIBUTED`, còn lại `error`; tăng `reloadKey`); điều kiện khoá Duyệt chia (`busy || approveBlockers.length>0 || !pool`); điều kiện hiện Duyệt lại (`canApprove && nextAction==='REAPPROVE' && status!=='OPENING'`) và Tiếp tục chia (`canApprove && nextAction==='CONTINUE'`, gọi thẳng, có biểu tượng quay); thẻ Duyệt chia hiện cho người có quyền duyệt ở MỌI trường hợp, kể cả chain không hỗ trợ (hiện nằm ngoài nhánh `supported`, `distribution-approval.tsx:468`); hộp xác nhận khoá khi `busy`; phân trang (trước khoá khi `page<=1`, sau khoá khi `page>=pages`); `HistoryCard key={key}`; `PayoutsTable`, `HistoryCard` và hai `useEffect` có lời gọi action ở LẠI tệp này (`fe-08-approval.test.ts:886-896` đọc mã nguồn: đúng 1 `getDistributionPageAction(`, regex `if \(next === 1\) return;\s*void listDistributionPeriodsAction\(`, đúng 2 `useEffect` có `Action(`). Diff chỉ là vỏ JSX, `className`, thay khối lặp bằng thành phần dùng chung có cùng chữ và thuộc tính.
- **QĐ-2. Số action khi mở màn giữ đúng 1.** Thao tác vẫn gọi đúng như cũ (duyệt: 1 action cộng 1 lần tải lại).
- **QĐ-3. Ô số liệu "Quỹ chia":** 4 ô thay `Metric` bằng `Kpi`, đặt trong phần tử có `aria-label="Quỹ chia"` (giữ đúng chuỗi): "Số dư quỹ" `au` cỡ `lg`, "Chưa phân bổ" `gold`, "Tổng dự trữ các kỳ" và "Ngưỡng tối thiểu" `default`. Chữ nhãn giữ nguyên; giá trị truyền `value={amount(...)}` và `unit="VNDB"` (phần tử `tabular-nums` đầu tiên chỉ chứa số, `kpi.tsx:7-8`), không truyền cả chuỗi kèm đơn vị như `Metric` đang làm. Không `aria-label` nào khác chứa "Quỹ chia", "Duyệt chia" hay "kỳ hoạt động" ngoài các phần tử đang có (`zz-distribution-approval.spec.ts:50-51`, `:79` so khớp chuỗi con).
- **QĐ-4. Nhãn trạng thái có sắc:** hàm thuần mới `components/distribution/status-tone.ts`, khoá kiểu từ `lib/store` (import type): trạng thái kỳ (`DistributionPeriodStatus`: `OPENING` `warn`, `OPEN` `info`, `DISTRIBUTING` `warn`, `COMPLETED` `ok`, `EXPIRED` `bad`, `CLOSED` `info`); trạng thái duyệt (`APPROVED` `ok`, `AMOUNT_CHANGED` `warn`); hồ sơ trả (`PENDING` `warn`, `SENT` `info`, `PAID` `ok`, `FAILED` `bad`, `EXPIRED` `bad`); kết quả lịch chạy (`KeeperRunStatus`: `RUNNING` `warn`, `SUCCESS` `ok`, `FAILED` `bad`); trạng thái chốt vault (`PENDING` `warn`, `SENT` `info`, `DONE` `ok`, `CONFLICT` `bad`). Dùng `Record<..., Tone>`; nơi nhận `string` thu hẹp bằng hàm kiểm, giá trị lạ trả `info`. Giá trị rỗng hiện chữ như hiện tại ("Chưa có kết luận duyệt" `:172`, "Chưa chốt" `:176`, "Chưa duyệt" `:299`) dạng chữ thường `text-muted-foreground`, KHÔNG dựng `Badge`. Chữ nhãn giữ nguyên các bảng nhãn trong tệp màn.
- **QĐ-5. Thành phần dùng chung thay khối tự viết:** thông báo kết quả `aria-label="Kết quả thao tác chia"` thành `Alert` (`ok` hoặc `bad` theo `message.tone`), giữ `role` hiện tại (`alert` khi lỗi, `status` khi thành công) và `aria-label`; "Đang đọc quỹ chia…" thành `EmptyState loading` (giữ chữ, giữ `role` nếu đang có); bốn khối lỗi `role="alert"` (lỗi tải `:421`, lỗi hồ sơ trả `:221`, lỗi lịch sử `:283`, lỗi lịch chạy `:326`) thành `Alert bad` giữ `role="alert"`; thẻ chain không hỗ trợ dùng `EmptyState` hoặc `Alert info`, giữ chữ; cảnh báo cắt danh sách thành `Alert warn` (giữ `role` nếu có); ghi chú trong `ActivePeriodCard` (`role="status"`) thành `Alert info` giữ `role`; danh sách lý do chặn duyệt dạng danh sách có biểu tượng cảnh báo mỗi dòng, viết bằng lớp tiện ích như `maker-checker/request-check-block.tsx` (lớp `.checks` của bản xem thử không có trong `globals.css`), giữ chữ; trong hộp xác nhận, câu lưu ý chuyển tiền đặt trong `Alert bad` không `role`. Xoá `Metric`; giữ `TxLink` hiện có (`:98`).
- **QĐ-6. Thẻ:** "Lịch chạy" tách thành thẻ riêng ngay dưới "Lịch sử kỳ chia" nhưng vẫn do `HistoryCard` trả về (Fragment), không đổi dữ liệu hay lời gọi. Thẻ "Dự kiến (tham khảo)" `tone="tint"`, bảng cuộn dọc tối đa 280 px bằng lớp đặt lên phần tử cha nhắm vào khung bảng sẵn có: `[&_[data-slot=table-container]]:max-h-[280px] [&_[data-slot=table-container]]:overflow-y-auto` (`ui/table.tsx:9-12` tự bọc bảng, không nhận className cho khung), đầu bảng `sticky top-0` trong khung đó. Mọi thẻ có `CardTitleIcon`.
- **QĐ-7. Bản xem thử, notes đã cũ, KHÔNG làm theo:** các mục ở mục 1 "Không làm"; câu phụ "…" (`uiux-02-dau-man.test.ts:198`, `:262`); thiếu ô chọn token ở bản xem thử (mã có `TokenScopeSelect`, giữ đúng một lần kể cả chú thích: `uiux-02-dau-man.test.ts:88`).
- **QĐ-8. Mốc test phải giữ** (không sửa `app/test/**`, không sửa e2e cũ):
  - Unit: QĐ-1 (`fe-08-approval.test.ts:886-896`), QĐ-7.
  - `zz-distribution-approval.spec.ts` (mock và Hardhat): `getByLabel('Quỹ chia')` chứa "Chưa phân bổ" (:48); bảng "Người nhận dự kiến" chứa "(vault)" (:49); Giao dịch viên không có nút `/^Duyệt chia/` và `getByLabel('Duyệt chia')` đếm 0 (:50-51); nút tên đúng `/^Duyệt chia [\d.]+ VNDB$/` nằm trong vùng nhãn "Duyệt chia" (:61); hộp thoại `getByRole('dialog')` chứa đúng hai câu xác nhận và nút "Duyệt và chia" (:65-70); vùng "Kết quả thao tác chia" (:72); bảng "Danh sách kỳ chia" và `tbody tr` đầu (:73-78); `getByLabel('Kỳ hoạt động')` đếm 0 sau khi chia xong (:79); nút "Xem hồ sơ", bảng "Hồ sơ trả từng ví" (:81-82).
  - `uiux-02-dau-man.spec.ts:32`, `:156`; đúng một `h1`; không `.font-mono`; 390 px không tràn ngang; mọi `Link` `prefetch={false}`.
- **QĐ-10. Tách `ActivePeriodCard` để kiểm các trạng thái cần thao tác tiếp.** `zz-distribution-approval.spec.ts` chia xong ngay nên không kiểm thẻ "Kỳ hoạt động"; mock khó tạo kỳ `OPENING`, `REAPPROVE`, `CONTINUE`. Vì vậy:
  - Dời NGUYÊN VĂN `ActivePeriodCard` (`distribution-approval.tsx:147-202`, chỉ nhận dữ liệu và callback, không gọi action, không có `useEffect`) sang tệp mới `components/distribution/active-period-card.tsx`, cùng các thứ nó dùng mà trang cũng dùng (`TxLink`, bảng nhãn `PERIOD_STATUS`, `APPROVAL_STATUS`, `VAULT_STATUS`, hàm `amount` nếu cần) sang `components/distribution/` để trang import lại; không đổi chữ, điều kiện hiện, `disabled`, `aria-label`, `role`. Commit dời riêng, trước khi đổi kiểu; checkpoint dán đoạn trước và sau.
  - Hai callback ở trang giữ nguyên từng ký tự: `onReapprove` gọi `setConfirm({ kind: 'reapprove', ... })` (mở hộp xác nhận), `onContinue` gọi thẳng `run(() => continueDistributionAction(...))` (`distribution-approval.tsx:493-496`). Không có DOM giả lập trong bộ test (không có `jsdom`), nên phần nối này kiểm bằng đọc diff: hai dòng này phải không đổi (lệnh tasks bước 6f).
  - Effect, `PayoutsTable`, `HistoryCard` ở lại trang (QĐ-1, test fe-08).
- **QĐ-9. Hiệu năng:** JS gzip `/distribution` không tăng quá 3 KB, các trang đo khác không tăng; CSS gzip không tăng quá 2 KB; cảnh báo hydrate, lỗi console 0.

## 3. Phạm vi tệp (danh sách trắng)

| Được sửa | Ghi chú |
|---|---|
| `app/src/components/pages/distribution-approval.tsx` | QĐ-1 |
| `app/src/components/distribution/status-tone.ts` (mới) | QĐ-4 |
| `app/src/components/distribution/*.tsx`, `*.ts` (mới: `active-period-card.tsx` và tệp chứa `TxLink`, bảng nhãn dời từ trang) | QĐ-10, liệt kê tên tệp trong checkpoint |
| `app/e2e/fe-ux-03b-chia-loi-nhuan.spec.ts`, `app/test/fe-ux-03b.test.ts` (mới) | Design mục 3 |
| `docs/tech-report.md` | CHỈ khi số dòng marker dời, và chỉ đổi khối tự sinh bằng `node scripts/scan-pending.mjs --write-report` (quy ước từ FIX-07); ghi trong checkpoint |
| `docs/fe-ux-03b-chia-loi-nhuan/{requirements,design,tasks}.md`, `docs/CHECKPOINT_FEUX03B.md`, `docs/USER_GUIDE.md`, `.kiro/task-status.json` | Theo quy ước repo |

Cấm mọi tệp khác, gồm `vault-status.tsx` (FE-UX-03c), `distribution-amount-label.ts`, `components/ui/**`, `components/layout/**`, `globals.css`, route `app/src/app/**`, `lib/**`, `app/test/**` có sẵn, e2e có sẵn, `package*.json`.

## 4. Điều kiện hoàn thành

- [ ] Màn đúng bố cục bản chốt trừ mục 1 "Không làm" và QĐ-7, cho cả hai vai (Kiểm soát viên có thẻ Duyệt chia; Giao dịch viên không có, ô Ngưỡng giãn rộng); bảng đối chiếu notes trong checkpoint.
- [ ] Ô số liệu đúng QĐ-3; nhãn trạng thái đúng QĐ-4 (unit test phủ đủ giá trị).
- [ ] Khối tự viết thay theo QĐ-5; `Metric`, link explorer viết tay không còn; thẻ đúng QĐ-6.
- [ ] Không đổi chữ, trường, nút, điều kiện khoá, hộp xác nhận (tasks bước 6d rỗng).
- [ ] Diff giữ logic (QĐ-1); checkpoint liệt kê từng đoạn đổi nằm gần hook, handler, điều kiện khoá, kèm lý do an toàn.
- [ ] Số action khi mở màn đúng 1 và không đổi ở 28 đường dẫn; JS, CSS trong trần QĐ-9; hydrate, lỗi console 0.
- [ ] Mốc test QĐ-8 giữ nguyên; không sửa test có sẵn.
- [ ] Ảnh 1440 và 390, Sáng và Tối, trước và sau, hai vai, khi CÓ dữ liệu, tạo trên một máy chủ mock RIÊNG (`next start` cổng khác, env như `playwright.config.ts`), đúng công thức sau, trước và sau dùng cùng công thức và số tiền:
  1. Phát hành WPT và tạo người nắm giữ: `E2E_BASE_URL=http://localhost:<cổng> npx playwright test e2e/ops-transactions.spec.ts` (tệp này dựng nguồn cung, nạp VNDB, đặt lệnh mua; `zz-distribution-approval.spec.ts:9` ghi rõ phụ thuộc nó).
  2. Nạp quỹ chia: `E2E_BASE_URL=... npx playwright test e2e/zz-distribution-approval.spec.ts -g "chuẩn bị"` (1.000.000 VNDB).
  3. Xác nhận ở `/distribution` vai Kiểm soát viên: nút `/^Duyệt chia [\d.]+ VNDB$/` đang MỞ, không còn lý do chặn; chụp bộ ảnh "chờ duyệt".
  4. Chạy hết `zz-distribution-approval.spec.ts` (duyệt và chia) rồi chụp bộ ảnh "đã chia" (lịch sử, hồ sơ trả, lịch chạy có dòng).
  5. Tắt máy chủ.
- [ ] Kỳ chưa hoàn tất: unit test QĐ-10 đủ 5 trạng thái (design mục 3); ảnh 4 trạng thái `REAPPROVE`, `CONTINUE`, `OPENING`, `busy` dựng ngoài repo: script tạm dựng `ActivePeriodCard` bằng `renderToStaticMarkup` với dữ liệu giả của unit test, chèn CSS bản build (`.next/static/chunks/*.css`) vào trang, `page.setContent` rồi chụp (Sáng và Tối, 1440 và 390); không commit script.
- [ ] `fe-ux-03b-chia-loi-nhuan.spec.ts` (chạy trên project mock) đủ 3 ca và `fe-ux-03b.test.ts` đủ 2 nhóm (design mục 3), xanh.
- [ ] `ActivePeriodCard` dời nguyên văn (QĐ-10), hai callback ở trang không đổi; checkpoint dán đoạn trước và sau.
- [ ] Kiểm thử đúng mục 5, đạt, kèm log; log có mục "EVM - E2E PROJECT HARDHAT" xanh.
- [ ] Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 6) rỗng.
- [ ] Không mã dư thừa: hằng, hàm, import, lớp không còn dùng xoá hẳn.

## 5. Phạm vi kiểm thử

| Ai | Chạy | Không chạy |
|---|---|---|
| Dev | `bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm` một lần, lưu log; đo action, JS bằng `tools/20261104_do_moc_measure.js` (gửi kèm, sha256 `eefeb720730e3ef4f1d1655e033d91863f994612343cc0ad89d243da83657238`; `JS_PAGES=/,/portfolio,/trade,/approvals,/distribution`), CSS theo cách 01c. Gửi riêng đoạn log từ "EVM - E2E PROJECT HARDHAT" tới hết | `contracts` |
| Supervisor | Đọc diff; build; chạy `fe-ux-03b-chia-loi-nhuan`, `zz-distribution-approval`, `uiux-02-dau-man` (e2e và unit), `fe-08-approval.test.ts` và unit test mới; đọc đoạn log EVM; gây lỗi có chủ đích 4 điểm (bỏ `aria-label="Quỹ chia"`; xoá dòng `if (next === 1) return;`; đổi sắc `FAILED` của hồ sơ trả; bỏ điều kiện `period.status !== 'OPENING'` của nút Duyệt lại); xem ảnh | Full suite |
