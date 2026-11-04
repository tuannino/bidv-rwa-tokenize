# Báo cáo bàn giao: FE-UX-03b màn Chia lợi nhuận

| | |
|---|---|
| Mã task | FE-UX-03b |
| Phạm vi | **Frontend thuần.** Không `lib/`, `app/actions`, `app/api`, `distribution-amount-label.ts`, `components/ui/**`, `vault-status.tsx`; không gói npm mới; không đổi câu chữ, trường, nút, hộp xác nhận, điều kiện khoá, lời gọi server action |
| Nhánh | `feat/fe-ux-03b-chia-loi-nhuan`, tạo từ `release/ui-v2` (`e996915`, sau merge PR #90 FIX-07) |
| Spec | `docs/fe-ux-03b-chia-loi-nhuan/{requirements,design,tasks}.md` (chép nguyên) |
| Commit | spec `79ea728`; e2e mới và số `role` mốc `14d1879`, `121c5b7`; dời nguyên văn `c67f1df`; `status-tone.ts` và unit test `9c503ef`; đổi kiểu `f6a3d12`; bỏ biểu tượng ô số liệu cho JS trong trần `1d9f54a`; tài liệu: các commit cuối trên nhánh |
| Tiến độ | Xong. Một PR, base `release/ui-v2`, chờ Supervisor nghiệm thu; Claude Code **không** merge |

Tệp mới trong `app/src/components/distribution/`: `display.ts` (`amount`, `short`, `PERIOD_STATUS`, `APPROVAL_STATUS`,
`VAULT_STATUS`), `tx-link.tsx` (`TxLink`), `active-period-card.tsx` (`ActivePeriodCard`), `status-tone.ts`.

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 4) | | Bằng chứng |
|---|---|---|---|
| 1 | Màn đúng bố cục trừ "Không làm" và QĐ-7, cả hai vai; bảng đối chiếu notes | ✅ | mục 2.2, 7 |
| 2 | Ô số liệu đúng QĐ-3; nhãn trạng thái đúng QĐ-4 (unit test đủ giá trị) | ✅ | mục 1.2 (ca 1), 1.3 |
| 3 | Khối tự viết thay theo QĐ-5; `Metric`, link explorer viết tay không còn; thẻ đúng QĐ-6 | ✅ | mục 2.2, 2.5 |
| 4 | Không đổi chữ, trường, nút, điều kiện khoá, hộp xác nhận (6d rỗng) | ✅ | mục 6 |
| 5 | Diff giữ logic (QĐ-1); liệt kê đoạn đổi gần hook, handler, điều kiện khoá | ✅ | mục 2.3 |
| 6 | Action đúng 1 khi mở màn, không đổi 28 đường dẫn; JS, CSS trong trần; hydrate, lỗi console 0 | ✅ | mục 4 |
| 7 | Mốc test QĐ-8 giữ; không sửa test có sẵn | ✅ | mục 1.1, 2.4 |
| 8 | Ảnh 1440, 390, Sáng, Tối, trước và sau, hai vai, có dữ liệu, máy chủ mock riêng, đúng công thức | ✅ | mục 5 |
| 9 | Kỳ chưa hoàn tất: unit test đủ 5 trạng thái; ảnh 4 trạng thái dựng ngoài repo | ✅ | mục 1.3, 5 |
| 10 | `fe-ux-03b-chia-loi-nhuan.spec.ts` đủ 3 ca, `fe-ux-03b.test.ts` đủ 2 nhóm, xanh | ✅ | mục 1.2, 1.3 |
| 11 | `ActivePeriodCard` dời nguyên văn, hai callback ở trang không đổi; dán đoạn trước và sau | ✅ | mục 2.1, 6 (6f) |
| 12 | Kiểm thử mục 5 đạt, kèm log; "EVM - E2E PROJECT HARDHAT" xanh | ✅ | mục 1.1 |
| 13 | Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 6) rỗng | ✅ | mục 6 |
| 14 | Không mã dư thừa | ✅ | mục 2.5 |

**Kết luận:** 14 ✅, 0 🔶, 0 ❌. JS gzip `/distribution` +2.886 B (2,82 KB, trần 3 KB, đo theo byte vì công cụ làm
tròn 0,1 KB cho +3,0); các trang đo khác không đổi theo công cụ đo; CSS +@@CSS@@ B; action khớp 28/28
(`/distribution` 1); số `role` trong `main` bằng mốc (0 ở cả hai vai). Mức rủi ro: thấp (thẻ Kỳ hoạt động dời sang
tệp mới, các nhánh nút kiểm bằng unit test với dữ liệu giả; luồng duyệt và chia thật bằng e2e mock và Hardhat).

UserGuide: "Chốt tại"; mục 3.5.2 thêm "Bố cục"; câu ô chọn token thêm `/distribution`.

### 0.2 Việc cần Owner quyết

- Không có. Ghi chú về biểu tượng ô số liệu và trần JS ở mục 8.

---

## 1. Kiểm thử (requirements mục 5, phần dev)

### 1.1 Lệnh và kết quả

`FE-UX-03b` ở `inProgress` của `.kiro/task-status.json` khi chạy (FE-UX-03c vào `planned`).

```text
$ TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm
@@RUN@@
```

Log gửi kèm (không commit): `20261104_feux03b_run_local_all.log` và riêng đoạn từ "EVM - E2E PROJECT HARDHAT" tới
hết: `20261104_feux03b_evm_e2e.log`. Không chạy `contracts`.

### 1.2 e2e mới `app/e2e/fe-ux-03b-chia-loi-nhuan.spec.ts` (project mock, chỉ đọc)

| Ca | Kiểm | Mốc `e996915` | Sau |
|---|---|---|---|
| 1 | Hai vai: trong `getByLabel('Quỹ chia')` có 4 `[data-kpi]`; "Số dư quỹ" `au`, "Chưa phân bổ" `gold`, hai ô kia `default`; Giao dịch viên không có nút `/^Duyệt chia/` | đỏ (mốc chưa có `Kpi`) | xanh |
| 2 | Đếm `role` status, note, alert trong `main` sau `networkidle` và khi "Quỹ chia" hiện, hai vai | xanh | xanh |
| 3 | 1440 và 390 px, hai vai, mỗi lần một ngữ cảnh mới: `scrollWidth` không vượt bề rộng, 0 lỗi console, 0 lỗi trang, 0 cảnh báo hydrate | xanh | xanh |

Số `role` mốc đo trên `e996915` bằng chính ca 2 trong lượt e2e mock đầy đủ (tệp spec đặt vào bản mốc, cùng thứ tự):
`CONTROLLER` và `TELLER` đều `{ status: 0, note: 0, alert: 0 }` (log mốc: 117 ca cũ đạt, 2 ca mới đỏ là ca 1 vì
mốc chưa có `Kpi` và ca 2 vì hằng số lúc đó còn là `-1`).

### 1.3 Unit test mới `app/test/fe-ux-03b.test.ts` (môi trường `node`, 10 ca)

Nhóm 1 (5 ca): mọi giá trị của `DISTRIBUTION_PERIOD_STATUSES`, `DISTRIBUTION_APPROVAL_STATUSES`,
`DISTRIBUTION_PAYOUT_STATUSES`, `KEEPER_RUN_STATUSES`, `VAULT_CLOSE_STATUSES` trả đúng bảng QĐ-4; `KHONG_CO` và
`toString` (khoá của `Object.prototype`) trả `info`.

Nhóm 2 (5 ca, `renderToStaticMarkup` thẻ `ActivePeriodCard` với `ActivePeriodView` giả, chain `evm` để có liên kết
explorer):

| Trạng thái giả | Kỳ vọng (đạt) |
|---|---|
| `REAPPROVE`, `OPEN`, có quyền, không busy | nút "Duyệt lại số thực tế 4.812.500.000 VNDB" mở; không có "Tiếp tục chia" |
| `CONTINUE`, có quyền, không busy | "Tiếp tục chia" mở, không biểu tượng quay; không có Duyệt lại |
| `REAPPROVE`, `OPENING`, `pendingOnChain`, có `openTxHash` | không có Duyệt lại; có "Đã gửi lên chuỗi, đang đối soát", thẻ `<a>` tới `/tx/<mã>`; "Số thực tế trên chuỗi" là "chưa đọc được" |
| `busy` với `REAPPROVE` (`OPEN`) và `CONTINUE` | nút có `disabled`; "Tiếp tục chia" có `animate-spin` |
| không có quyền, `REAPPROVE` và `CONTINUE` | không có `<button>` nào |

Mọi ca: phần tử gốc có `aria-label="Kỳ hoạt động"`, ghi chú `role="status"` `aria-label="Ghi chú kỳ hoạt động"`.
10 ca xanh ngay trên thẻ vừa dời (commit `9c503ef`, trước khi đổi kiểu) và vẫn xanh sau khi đổi kiểu.

Tự gây lỗi 4 điểm Supervisor định thử, trên bản sao làm việc rồi hoàn lại:

| Lỗi gây ra | Kết quả |
|---|---|
@@MUT@@

## 2. Thay đổi

### 2.1 Dời `ActivePeriodCard` (QĐ-10), nguyên văn

Commit `c67f1df` chỉ dời mã, chưa đổi kiểu. Trang xoá 102 dòng; mọi dòng xoá có y hệt trong `display.ts`,
`tx-link.tsx`, `active-period-card.tsx` (thêm `export`), trừ 2 dòng import của trang (`ExternalLink, Loader2`,
`ActivePeriodView`) đổi theo. `Metric` cũng dời (trang và thẻ cùng dùng), rồi bị xoá ở bước đổi kiểu.

Hai nhánh nút, trước (`distribution-approval.tsx:188-198` @ `e996915`) và sau khi dời (`active-period-card.tsx:65-75` @
`c67f1df`), giống hệt từng ký tự; sau khi đổi kiểu (`f6a3d12`) vẫn giữ nguyên hai khối này:

```tsx
        {canApprove && active.nextAction === 'REAPPROVE' && period.status !== 'OPENING' && (
          <Button onClick={onReapprove} disabled={busy}>
            Duyệt lại số thực tế {amount(period.totalAmount)} VNDB
          </Button>
        )}
        {canApprove && active.nextAction === 'CONTINUE' && (
          <Button onClick={onContinue} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            Tiếp tục chia
          </Button>
        )}
```

Hai callback ở trang (6f, giống hệt mốc, chỉ khác số dòng 494, 496 thành 464, 466):

```tsx
                setConfirm({ kind: 'reapprove', amount: data.active!.period.totalAmount, periodId: data.active!.period.id })
              onContinue={() => void run(() => continueDistributionAction({ chain, periodId: data.active!.period.id }))}
```

Effect chính, `run()`, `confirmAction`, `PayoutsTable`, `HistoryCard`, `ConfirmDialog` ở lại trang.

### 2.2 Màn (bố cục theo design mục 1)

| Khối | Đổi |
|---|---|
| Đầu màn | `h1` và `TokenScopeSelect` cùng hàng (như `/approvals`); kết quả thao tác `Alert` `ok` khi `message.tone === 'ok'`, `bad` khi `error`, giữ `role` (`status`, `alert`) và `aria-label="Kết quả thao tác chia"` |
| Đang tải, lỗi tải | "Đang đọc quỹ chia…" thành `EmptyState loading` (không `role`, như mốc); lỗi tải `Alert bad role="alert"` |
| Quỹ chia | Lưới 12 cột từ 1100 px. Tiêu đề "Quỹ chia" (`Landmark`) trải 12 cột; phần tử `aria-label="Quỹ chia"` chỉ bọc 4 `Kpi`, 8 cột (Giao dịch viên 12), bên trong lưới 2 cột từ 640 px: "Số dư quỹ" `au lg` cao 2 hàng, "Chưa phân bổ" `gold`, "Tổng dự trữ các kỳ", "Ngưỡng tối thiểu" `default` (ô cuối trải 2 cột, tức phần còn lại); `value={amount(...)}`, `unit="VNDB"` |
| Duyệt chia | Thẻ 4 cột cạnh vùng Quỹ chia (kéo giãn), `ShieldCheck`; danh sách "Lý do chưa duyệt được" mỗi dòng `TriangleAlert` `text-bad-ink`, lớp tiện ích như `request-check-block.tsx`; nút trải ngang ở đáy thẻ (`mt-auto`). Chain không hỗ trợ: thẻ này đứng riêng 12 cột dưới thẻ thông báo, nút khoá và lý do như mốc |
| Chain không hỗ trợ | Thẻ 12 cột chứa `EmptyState` biểu tượng `Landmark`, chữ `approveBlockers.join(' ')` giữ |
| Dự kiến (tham khảo) | `Card tone="tint"` (`Users`), câu mô tả giữ; danh sách bị cắt `Alert warn` giữ `role="alert"`; bảng "Người nhận dự kiến" trong khung `bg-card` bo 18 px, cuộn dọc tối đa 280 px bằng `[&_[data-slot=table-container]]:max-h-[280px] [&_[data-slot=table-container]]:overflow-y-auto`, đầu bảng `sticky top-0 z-10 bg-card`; " (vault)" giữ |
| Kỳ hoạt động | Thẻ (`CalendarClock`); `Metric` thay bằng ô nền nhạt (`Field`), lưới `grid-cols-[repeat(auto-fill,minmax(190px,1fr))]`; Mã kỳ `font-code`, số `tabular-nums`; trạng thái kỳ, duyệt, chốt vault là `Badge` sắc, rỗng là chữ thường `text-muted-foreground` ("Chưa có kết luận duyệt", "Chưa chốt"); ghi chú `Alert info` giữ `role="status"`, `aria-label`; câu đối soát và `TxLink` giữ; hai nút giữ (2.1) |
| Lịch sử kỳ chia | Thẻ (`History`); "Trạng thái" `Badge` sắc kỳ, "Duyệt" `Badge` sắc duyệt hoặc "Chưa duyệt" chữ thường; rỗng `EmptyState`; lỗi `Alert bad role="alert"`; phân trang giữ; hồ sơ trả trong khung nền nhạt bo 18 px, "Trạng thái" `Badge` sắc, lỗi `Alert bad role="alert"` |
| Lịch chạy | Thẻ riêng ngay dưới (`Timer`), vẫn do `HistoryCard` trả (Fragment); "Kết quả" `Badge` sắc, chữ giữ mã thô; rỗng `EmptyState`; lỗi `Alert bad role="alert"` |
| Hộp xác nhận | Câu "Lưu ý: bấm duyệt sẽ chuyển tiền." trong `Alert bad` không `role`; hai câu, hai nút giữ |

Biểu tượng tiêu đề thẻ đúng gợi ý design (`Landmark`, `ShieldCheck`, `Users`, `CalendarClock`, `History`, `Timer`),
đều qua `CardTitleIcon` (thành phần cục bộ `CardHeading`). 4 ô số liệu không có biểu tượng (mục 8).

### 2.3 Đoạn đổi gần hook, handler, điều kiện khoá (QĐ-1)

Không đổi state, hai `useEffect` có action, `run()`, `confirmAction`, `goTo` (`if (next === 1) return;` giữ), `key`,
`reloadKey`, `HistoryCard key={key}`. Các đoạn có đụng:

- Nút "Duyệt chia": `disabled={busy || data.approveBlockers.length > 0 || !data.pool}` và `onClick` giữ từng ký tự;
  chỉ thêm `className="mt-auto w-full"` và đổi vị trí (trước thẻ Dự kiến). Điều kiện hiện thẻ `data.viewerCanApprove`
  giữ và vẫn nằm ngoài nhánh `supported`; thẻ Dự kiến vẫn chỉ hiện khi `data.supported` (tách thành
  `{data.supported && ...}` vì thẻ Duyệt chia nay đứng giữa).
- `ActivePeriodCard`: hai nút giữ (2.1); `Field` thay `Metric` đọc cùng biểu thức giá trị.
- `PayoutsTable`, `HistoryCard`: phân trang giữ `disabled={page <= 1}`, `disabled={page >= pages}`, `onClick`; nút
  "Xem hồ sơ" giữ; chỉ đổi phần tử bọc và lớp. `HistoryCard` trả Fragment hai thẻ thay một thẻ.
- `ConfirmDialog`: `open`, `onOpenChange`, `disabled={busy}` của hai nút giữ.

### 2.4 Mốc test QĐ-8

Không sửa tệp test có sẵn. Đã chạy: `zz-distribution-approval.spec.ts` (mock trong 1.1 và trước đó riêng, Hardhat
trong phần `evm`), `uiux-02-dau-man.spec.ts`, `fe-08-approval.test.ts`, `uiux-02-dau-man.test.ts`. `aria-label`
"Quỹ chia", "Duyệt chia", "Dự kiến", "Kỳ hoạt động", "Ghi chú kỳ hoạt động", "Lịch sử kỳ chia", "Kết quả thao tác
chia", "Lý do chưa duyệt được" và các bảng giữ; không thêm `aria-label` nào; `TokenScopeSelect` đúng một lần; một `h1`.

### 2.5 Mã dư thừa

Đã xoá: `Metric`; khối link explorer chỉ còn `TxLink` (dời nguyên); import `ExternalLink`, `explorerTxUrl`,
`ActivePeriodView` ở trang; ba ô biểu tượng `Coins`, `Gauge`, `Lock` thử thêm rồi bỏ (mục 8). Trang còn dùng
`Loader2` (nút trong hộp xác nhận), `short`, `amount`, `PERIOD_STATUS`, `APPROVAL_STATUS`, `TxLink`.

## 3. Thẻ Kỳ hoạt động theo trạng thái (xác nhận bằng mã; trước và sau giống nhau)

| Trạng thái | Duyệt lại | Tiếp tục chia |
|---|---|---|
| `canApprove`, `REAPPROVE`, kỳ khác `OPENING` | hiện, khoá khi `busy` | ẩn |
| `canApprove`, `REAPPROVE`, kỳ `OPENING` | ẩn | ẩn |
| `canApprove`, `CONTINUE` | ẩn | hiện, khoá và quay khi `busy` |
| không `canApprove` | ẩn | ẩn |

## 4. Đo trước và sau

Cùng máy, cùng phiên, cùng quy trình (`measure.sh` ngoài repo, như FE-UX-03a): máy chủ mới cổng 3300, tạo dữ liệu
bằng `maker-checker`, `ops-transactions`, `permit-order`, `recall`; đo bằng `tools/20261104_do_moc_measure.js`
(sha256 khớp spec) với `JS_PAGES=/,/portfolio,/trade,/approvals,/distribution`.

| Mục | Mốc `e996915` | Sau | Trần |
|---|---|---|---|
| Số action khi mở màn | 28 đường dẫn, `/distribution` 1 | Khớp 28/28 | không đổi |
| Cảnh báo hydrate | 0 | 0 | 0 |
@@DO@@

JS `/distribution` đo thêm theo byte (công cụ làm tròn 0,1 KB, bản có biểu tượng ô số liệu báo +3,0): script
`js-bytes.js` cộng gzip từng script như công cụ đo, trên bản build mốc dựng riêng (`NEXT_DIST_DIR=.next-moc`, trang
mốc) và bản build sau, cùng máy: mốc 476.672 B, sau 479.558 B, tăng 2.886 B. Các trang khác theo byte: `/` và
`/trade` bằng nhau; `/portfolio` -1 B; `/approvals` +18 B do mã định danh module, mã tham chiếu server action và thứ
tự module trong một chunk dùng chung đổi giữa hai lần build (đã so nội dung chunk: không thêm mã), công cụ đo vẫn
báo 455,2 KB cả hai.

## 5. Ảnh (gửi kèm, không commit)

- 28 đường dẫn của script đo, trước (`moc/`) và sau (`sau/`), 1440 và 390 px, Sáng và Tối.
- Có dữ liệu, máy chủ mock RIÊNG cổng **3400** (`next start`, env như `playwright.config.ts`), đúng công thức
  requirements mục 4: (1) `ops-transactions.spec.ts`; (2) `zz-distribution-approval.spec.ts -g "chuẩn bị"`
  (1.000.000 VNDB); (3) Kiểm soát viên: nút "Duyệt chia 1.000.000 VNDB" mở, 0 lý do chặn, chụp bộ "chờ duyệt"; (4)
  chạy hết `zz-distribution-approval.spec.ts` (3 ca, gồm nạp thêm lần nữa) rồi chụp bộ "đã chia" sau khi bấm "Xem hồ
  sơ" kỳ đầu (lịch sử 1 dòng, hồ sơ trả, lịch chạy 1 dòng); (5) tắt máy chủ. Hai vai, 1440 và 390, Sáng và Tối.
  @@ANH@@
- Thẻ Kỳ hoạt động 4 trạng thái (`REAPPROVE`, `CONTINUE`, `OPENING`, `busy`): HTML dựng bằng `renderToStaticMarkup`
  với dữ liệu giả như unit test (test tạm, xoá ngay, không commit), chèn CSS bản build tương ứng, `page.setContent`,
  thêm `font-family` hệ thống (bản tĩnh không nạp font của `next/font`); trước dùng thẻ @ `c67f1df` và CSS bản build
  mốc, sau dùng thẻ cuối và CSS bản build sau; Sáng và Tối, 1440 và 390.

## 6. Lệnh kiểm (tasks bước 6)

```text
6a $ git diff --name-only --diff-filter=d ... | grep -vE '^(...danh sách trắng...)$'      # rỗng
   $ git diff --name-only --diff-filter=D origin/release/ui-v2...HEAD                     # rỗng
6b $ rg -n '...màu cứng...' distribution-approval.tsx components/distribution/            # rỗng
6c $ comm -13 /tmp/del.txt /tmp/add.txt | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e' # rỗng
6d $ comm -23 <(ext /tmp/del.txt) <(ext /tmp/add.txt)                                     # rỗng
6e $ rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e' <2 nơi> | rg -v '<dòng chú thích>'   # rỗng
6f $ rg -n "setConfirm\(\{ kind: 'reapprove'|onContinue=..." distribution-approval.tsx
464:                setConfirm({ kind: 'reapprove', amount: data.active!.period.totalAmount, periodId: data.active!.period.id })
466:              onContinue={() => void run(() => continueDistributionAction({ chain, periodId: data.active!.period.id }))}
```

6d rỗng: chuỗi tiếng Việt mới (6d đảo chiều) chỉ nằm trong chú thích. `docs/tech-report.md` không đổi (marker không
nằm trong tệp đã sửa).

## 7. Đối chiếu notes (`docs/prototypes/20261101_ui_ux_ban_chot/notes/distribution.md`)

Giữ: làm theo. Đã cũ: QĐ-7 hoặc mục 1 "Không làm". Bỏ: không làm, kèm lý do.

| Dòng notes | | Ghi chú |
|---|---|---|
| Tiêu đề "Chia lợi nhuận" | Giữ | cùng hàng với ô chọn token |
| Câu phụ có tên chain | Đã cũ | QĐ-7, test cấm (`uiux-02-dau-man.test.ts`) |
| Thiếu ô chọn token ở bản xem thử | Đã cũ | QĐ-7: mã có `TokenScopeSelect`, giữ một lần |
| Tab "Trạng thái xem thử" | Đã cũ | chỉ có ở bản xem thử |
| Thông báo "Kỳ đã chia xong." sau thao tác | Giữ | `Alert`, `role`, `aria-label` giữ |
| Thẻ lý do khi chain không có vault | Giữ | `EmptyState` trong thẻ 12 cột |
| Quỹ chia: Số dư quỹ ô lớn, Chưa phân bổ ô vàng, Tổng dự trữ, Ngưỡng | Giữ | `Kpi` `au lg`, `gold`, `default`, `default` (QĐ-3) |
| Thẻ Duyệt chia cạnh Quỹ chia; Giao dịch viên ô Ngưỡng giãn | Giữ | vùng Quỹ chia 12 cột cho Giao dịch viên |
| Lý do chặn dạng danh sách có biểu tượng | Giữ | lớp tiện ích (lớp `.checks` không có trong `globals.css`) |
| Nút "Duyệt chia {số} VNDB" | Giữ | điều kiện khoá giữ, nút ở đáy thẻ |
| Hộp xác nhận | Giữ | `Dialog` sẵn có (bản xem thử dùng `<dialog>` gốc); câu lưu ý `Alert bad` |
| Thẻ Dự kiến, câu mô tả, cảnh báo bị cắt | Giữ | `tint`; cảnh báo `Alert warn` giữ `role="alert"` |
| Bảng Người nhận dự kiến cuộn dọc | Giữ | tối đa 280 px, đầu bảng dính |
| "Dự kiến" tách hai thẻ | Đã cũ | lượt 2 của notes đã bỏ thẻ riêng, bảng ở trong thẻ Dự kiến |
| Thẻ Kỳ hoạt động 8 ô, ghi chú, câu đối soát, hai nút | Giữ | ô nền nhạt, nhãn sắc, `Alert info` |
| Bảng Lịch sử, phân trang, Xem hồ sơ | Giữ | nhãn sắc |
| Thời điểm duyệt tách giờ và ngày 2 dòng | Bỏ | mục 1 "Không làm" |
| Bảng Hồ sơ trả trong khung phụ, có tiêu đề kèm mã kỳ | Giữ khung, bỏ tiêu đề | lượt 2 của notes đã bỏ tiêu đề kèm mã kỳ |
| Lịch chạy tách thẻ riêng, Kết quả nhãn màu | Giữ | `Badge` sắc, chữ giữ mã thô |
| Trạng thái rỗng, đang tải | Giữ | `EmptyState` |
| `.tbl.compact` thu đệm bảng lịch sử | Bỏ | bảng cuộn ngang trong khung sẵn có của `ui/table` |
| Lệch: Kết quả lịch chạy in mã thô; số trong câu máy chủ không có dấu nghìn; định dạng thời điểm; hai nhãn "chưa duyệt"; lý do chain không hỗ trợ hiện hai lần | Giữ như mã | không đổi chữ (QĐ-1); ghi sẵn ở UserGuide L-21 |

## 8. Nợ và DEVIATION

- **Biểu tượng 4 ô số liệu:** bản xem thử có biểu tượng trong từng ô; design không yêu cầu. Bản đầu có (`Landmark`,
  `Coins`, `Lock`, `Gauge`), công cụ đo báo JS `/distribution` +3,0 KB (theo byte khoảng 3.040 đến 3.140 B, có thể
  vượt trần 3.072 B). Đã bỏ biểu tượng ô số liệu (`1d9f54a`), còn +2.886 B. Biểu tượng tiêu đề thẻ giữ đủ.
- **Tiêu điểm sau khi tải lại** (ghi nợ UX như 03a): giữ hành vi hiện có, không quản lý lại tiêu điểm.
- **Ảnh có dữ liệu chụp lại:** lượt chụp đầu, lần bấm "Xem hồ sơ" làm vùng `main` và bảng tự cuộn nên ảnh "đã chia"
  lệch; script chụp thêm bước cuộn về đầu, chụp lại cả mốc (bản build mốc dựng riêng, cùng công thức) và sau.

## 9. Tự đánh giá 3 luật kiến trúc

- [x] Mọi call chain qua ILedgerPort: không đổi mã gọi chuỗi.
- [x] Mọi ký qua ISigner: không đổi.
- [x] Mọi kiểm quyền qua RBAC: không đổi; nút duyệt vẫn theo `viewerCanApprove` do máy chủ trả.
