# Báo cáo bàn giao: FE-UX-02b 3 màn Vận hành (Lập lệnh, Giá và phát hành, Thu hồi)

| | |
|---|---|
| Mã task | FE-UX-02b |
| Phạm vi | **Frontend thuần.** Không `lib/`, `app/actions`, `app/api`, `gates.ts`, `token-info-read.ts`, `components/ui/**`; không gói npm mới; không đổi câu chữ (trừ QĐ-7), trường, nút, hộp thoại, điều kiện khoá, lời gọi server action |
| Nhánh | `feat/fe-ux-02b-van-hanh`, tạo từ `release/ui-v2` (`27a52ad`, sau merge PR #87 FE-UX-02a) |
| Spec | `docs/fe-ux-02b-van-hanh/{requirements,design,tasks}.md` (chép nguyên) |
| Commit | spec `fb78d41`; mã, test `3568959`; tài liệu: commit cuối trên nhánh |
| Tiến độ | Xong. Một PR, base `release/ui-v2`, chờ Supervisor nghiệm thu; Claude Code **không** merge |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 4) | | Bằng chứng |
|---|---|---|---|
| 1 | 3 màn đúng bố cục trừ "Không làm" và QĐ-8; bảng đối chiếu notes | ✅ | mục 2.2, 6 |
| 2 | Ô số liệu đúng QĐ-3; `effective-price` vẫn có chữ đúng `X VNDB` | ✅ | mục 1.2 (ca 1), 2.2 |
| 3 | Nhãn trạng thái và bước đúng QĐ-4; `case-tone.ts` phủ đủ (unit test) | ✅ | mục 1.3, 2.1 |
| 4 | Khối tự viết thay theo QĐ-5; không còn `amber-*`, `emerald-*`, `FIELD`, `NOTICE_WARN`, `RECALL_FIELD`, `Warn`, `PartError` | ✅ | mục 2.1, 2.5, 5 (7b) |
| 5 | Không đổi chữ, trường, nút, điều kiện khoá, hộp thoại; chỉ chuỗi QĐ-7 đổi (7d) | ✅ | mục 5 (7d) |
| 6 | Diff giữ logic (QĐ-1); liệt kê đoạn đổi gần hook, handler, điều kiện khoá | ✅ | mục 2.3 |
| 7 | Action đúng QĐ-2 ở 3 màn, không đổi ở 28 đường dẫn; JS, CSS trong trần QĐ-10; hydrate, lỗi console 0 | ✅ | mục 3 |
| 8 | Mốc test QĐ-9 giữ nguyên; không sửa test có sẵn | ✅ | mục 1.1, 2.4 |
| 9 | Lỗi thao tác trong hộp thoại thu hồi: hộp thoại vẫn mở, tiêu điểm trên câu lỗi, đúng một `role="alert"` | ✅ | mục 4.2 |
| 10 | `/approvals`, `/approvals/[id]` vẫn đúng (`maker-checker.spec.ts` xanh, ảnh trước và sau) | ✅ | mục 1.1, 4.1 |
| 11 | 390 px không tràn ở 3 màn; ảnh 1440, 390, Sáng, Tối, trước và sau; `/recall` có đợt chụp trên máy chủ riêng | ✅ | mục 1.2 (ca 3), 4.1 |
| 12 | `fe-ux-02b-van-hanh.spec.ts` đủ 3 ca, `fe-ux-02b.test.ts` đủ 3 nhóm, xanh | ✅ | mục 1.2, 1.3 |
| 13 | Kiểm thử đúng mục 5, đạt, kèm log | ✅ | mục 1.1 |
| 14 | Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 7) rỗng | ✅ | mục 5 |
| 15 | Không mã dư thừa; ghi bản sao còn lại ngoài phạm vi (`stat-card.tsx`) | ✅ | mục 2.5 |

**Kết luận:** 15 ✅, 0 🔶, 0 ❌. JS tăng tối đa 2,6 KB (`/recall`, trần 3 KB), 6 trang còn lại từ -0,1 tới +1,4 KB;
CSS giảm 162 B; action khớp 28/28 (`/draft` 3, `/config` 1, `/recall` 1). Mức rủi ro: thấp đến vừa (4 thành phần
`maker-checker` dùng chung với `/approvals`; e2e mock và Hardhat đều xanh).

UserGuide: Phần 3 mục 3.0 (vị trí ô chọn token, đoạn "Thu hồi token"), 3.4.2, 3.5.3 thêm "Bố cục"; số dòng ở
L-71; "Chốt tại"; Lịch sử.

### 0.2 Việc cần Owner quyết

- Không có. Điểm Supervisor nên xem ở mục 7.

---

## 1. Kiểm thử (requirements mục 5, phần dev)

### 1.1 Lệnh và kết quả

```text
$ TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm
  => PASS có cảnh báo: luật kiến trúc          # PASS 20, FAIL 0, WARN 3 (như mốc)
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)
  => PASS: LỚP 3 - KHUÔN CHECKPOINT
  => PASS: APP - TYPECHECK
  => PASS: APP - LINT
      Tests  1502 passed | 74 skipped (1576)   # mốc 1488 + 14 ca mới của fe-ux-02b.test.ts
  => PASS: APP - VITEST
  => PASS: APP - BUILD BẢN PHÁT HÀNH
      114 passed, 7 skipped (2.8m)            # project mock đầy đủ: 111 ca cũ + 3 ca mới, 0 chập chờn
  => PASS: APP - E2E (PLAYWRIGHT)
  => PASS: EVM - BUILD BẢN HARDHAT
  => PASS: EVM - DỰNG CHUỖI MỚI
      26 passed, 2 skipped (41.1s)            # project Hardhat, gồm maker-checker, recall, permit-order
  => PASS: EVM - E2E PROJECT HARDHAT
  => ĐẠT các phần đã chạy: arch markers checkpoint app build e2e evm      # exit=0
```

Log gửi kèm (không commit): `20261104_feux02b_run_local_all.log`. Không chạy `contracts` (mục 5).

Chạy nhanh trước đó trên bản build mock (`fe-07-price-config`, `fe-ux-01a-nen`, `fe-ux-01c-chuyen-dong`,
`fe-ux-02b-van-hanh`, `maker-checker`, `mint`, `ops-transactions`, `recall`, `token-info-read`, `chain-scope`):
37 passed, 4 skipped.

### 1.2 e2e mới `app/e2e/fe-ux-02b-van-hanh.spec.ts` (project mock, chỉ đọc, không tạo dữ liệu)

| Ca | Kiểm |
|---|---|
| 1 | `/draft`: 2 `[data-kpi]`, mỗi ô tìm bằng `getByLabel(nhãn, exact)` có `data-kpi`, `data-tone="default"`. `/config`: ô có chữ "Giá áp dụng" `data-tone="au"`, ô "Tổng cung trên chuỗi" `data-tone="hl"`; `effective-price` không phải `[data-kpi]`, nằm trong ô "Giá áp dụng", chữ khớp `^[\d.]+ VNDB$` |
| 2 | Đếm `role` status, note, alert TRONG `main` sau khi tải xong: `/draft`, `/config`, `/recall` vai TELLER, `/recall` vai CONTROLLER. Mốc đo trên `27a52ad` trong lượt e2e mock đầy đủ cùng thứ tự tệp (spec chép tạm vào bản mốc): cả 4 đều `{status: 0, note: 0, alert: 0}`; sau sửa giống hệt |
| 3 | 390 px: `scrollWidth <= 390` ở 3 màn; 1440 và 390 px: 0 lỗi console, 0 lỗi trang, 0 cảnh báo hydrate |

Chờ "tải xong": nút Sáng Tối hiện (đã hydrate), trong `main` không còn chữ bắt đầu bằng "Đang tải", không còn
`EmptyState` đang tải, đúng một `h1`. Lượt mốc (log `moc/e2e_mock_moc.log`): ca 2, ca 3 xanh; ca 1 đỏ đúng dự kiến
(bản mốc chưa có `data-kpi`); 113 passed (111 ca cũ cộng ca 2, ca 3), 7 skipped.

### 1.3 Unit test mới `app/test/fe-ux-02b.test.ts` (môi trường `node`, `renderToStaticMarkup`, 14 ca)

1. `caseTone`: 7 giá trị (`SettlementCaseStatus` và `PREVIEW`) đúng bảng design mục 2 (bảng kỳ vọng kiểu `Record`,
   thiếu khoá là lỗi typecheck); giá trị lạ là `info`; `phaseTone`: 5 giai đoạn đều `info`.
2. `RequestCheckBlock` với điều kiện `cap` không đạt: có `data-check="cap"`, `data-passed="false"`; chữ hiển thị
   chứa "Không vượt trần còn lại Không đạt" đúng một dấu cách (không dính, không hai dấu cách). `StatusBadge` 5 trạng
   thái: `data-status` và `data-variant` đúng bảng (`warn`, `info`, `ok`, `bad`, `bad`).
3. `RecallSteps` với `current` 1 tới 4: đủ 4 `li`; trước `current` là `done`/`ok`, bằng `current` là
   `current`/`warn` có `aria-current="step"`, sau là `pending`/`muted`; `current` rỗng thì không có `li`.

Tự gây lỗi 3 điểm Supervisor định thử, trên bản sao làm việc rồi hoàn lại:

| Lỗi gây ra | Kết quả |
|---|---|
| Bỏ `{' '}` ở `request-check-block.tsx` | unit nhóm 2 đỏ (chữ dính "còn lạiKhông đạt") |
| Đặt `data-testid="effective-price"` lên gốc `Kpi` au (bỏ `span` trong giá trị) | build lại, e2e: `fe-07-price-config.spec.ts:54` đỏ (`toHaveText` nhận cả nhãn), `fe-ux-02b-van-hanh` ca 1 đỏ |
| Đổi sắc `BURNED` từ `ok` sang `info` trong `case-tone.ts` | unit nhóm 1 đỏ |

Hoàn lại xong, build lại bản đúng, `git status` mã nguồn sạch.

## 2. Thay đổi

### 2.1 Thành phần

| Tệp | Đổi |
|---|---|
| `recall/case-tone.ts` (mới) | `caseTone(status: string)`: thu hẹp kiểu bằng hàm kiểm (`SETTLEMENT_CASE_STATUSES` hoặc `'PREVIEW'`), tra `Record<SettlementCaseStatus \| 'PREVIEW', CaseTone>`, giá trị lạ `info`. `phaseTone(phase)`: `Record<RecallPhaseKind, CaseTone>`, mọi giá trị `info`. Không đặt trong `recall/gates.ts` |
| `maker-checker/status-badge.tsx` | biến thể theo QĐ-4 (`PENDING` `warn`, `EXECUTING` `info`, `COMPLETED` `ok`, `REJECTED`, `FAILED` `bad`); giữ `data-status` |
| `maker-checker/request-table.tsx` | prop tuỳ chọn `loading`; bảng rỗng là `EmptyState` (`loading` thì quay); ô Nguồn trống và kết quả `PENDING` đổi gạch dài thành `–` (QĐ-7); vẫn export `resultText` |
| `maker-checker/request-check-block.tsx` | ô nền nhạt bo 18 px; dòng chia bằng đường kẻ; biểu tượng đạt `text-ok-ink`, không đạt `text-bad-ink`; giữ `data-check`, `data-passed`, `{' '}` |
| `maker-checker/token-info-block.tsx` | `Card tone="tint"` bo 18 px, tiêu đề có `CardTitleIcon` (`Wind`); giữ `aria-label`, cặp `dt`/`dd`, câu lỗi trong khối |
| `recall/steps.tsx` | chấm tròn nối đường; mỗi `li` giữ `aria-current`, thêm `data-state` (`done`, `current`, `pending`), `data-tone` (`ok`, `warn`, `muted`); bỏ lớp `emerald-*` |
| `recall/round-info.tsx` | Badge giai đoạn `phaseTone` (`info`), "Đã huỷ" `bad`, "Token trên chuỗi" `warn` khi đang đóng băng (cùng điều kiện cũ), còn lại `outline`; 10 ô thông tin nền nhạt, lưới 2 cột từ 640 px, 4 cột từ 1100 px; khoá chain `Alert warn role="status"`; ví bị cắt `Alert bad role="alert"`; "Chưa thể đóng băng" `Alert warn` (không `role`, như cũ); tiến độ lô `Alert info role="status" aria-live="polite"` |
| `recall/controls.tsx` | vùng nút có đường kẻ trên; nút có biểu tượng `aria-hidden` (tên nút không đổi) |
| `recall/dialogs.tsx` | bỏ `RECALL_FIELD`; lỗi: `Alert tone="bad"` KHÔNG `role`, bên trong giữ nguyên `<p ref={errorRef} role="alert" tabIndex={-1}>`, effect `focus()` giữ nguyên |
| `recall/cases-table.tsx` | trạng thái là `Badge` theo `caseTone` (chữ giữ nguyên); rỗng `EmptyState` |

Biểu tượng tiêu đề thẻ: tạo `PlusCircle`, huỷ `Flame`, yêu cầu đã lập `History`, thông tin token `Wind`, giá `Coins`,
đổi giá `PencilLine`, phát hành `Gauge`, lịch sử đổi giá `History`, tình trạng thu hồi `Undo2`, hồ sơ `Users`. Ô số
liệu `/draft` có biểu tượng `PlusCircle`, `Flame`. Nút thu hồi: `CalendarPlus`, `CalendarClock`, `Ban`, `Snowflake`,
`RefreshCw`, `LockOpen`, `Flame`.

### 2.2 Màn (bố cục theo design mục 1)

| Màn | Đổi |
|---|---|
| `/draft` | `h1` "Lập lệnh" và `TokenScopeSelect` cùng hàng; 2 `Kpi` sắc `default` giữ `aria-label`, giá trị rỗng `–`; lỗi số liệu `Alert bad` không `role`; 2 thẻ biểu mẫu cạnh nhau từ 1100 px (`items-start`), `CardTitleIcon`; ô nhập `fieldClass`; ô Số lượng thêm `read-only:bg-muted read-only:text-muted-foreground` (bỏ `.replace`); cảnh báo huỷ toàn bộ `Alert bad role="alert"` (ô xác nhận nằm trong); phản hồi `Alert role="status"`; thẻ "Yêu cầu đã lập" `CardTitleIcon`, lỗi `Alert bad`, 2 bảng nhận `loading={!freshMine}`; câu gợi ví thanh toán bỏ gạch dài (QĐ-7) |
| `/config` | `h1` và ô chọn token cùng hàng; đang tải `EmptyState loading`; lỗi toàn màn `Alert bad role="alert"`; 2 cột từ 1100 px; `Kpi au` giá áp dụng (nhãn thật theo `onChain`; `effective-price` là `span` trong `value`, không dùng `unit`) đầu thẻ "Giá phát hành"; `Kpi hl` "Tổng cung trên chuỗi" đầu thẻ "Tình trạng phát hành" (bỏ dòng cũ cùng nhãn); 4 `h2` kèm `CardTitleIcon`; lỗi từng khối `Alert bad role="alert"`; 2 cảnh báo `Alert warn role="status"`; phản hồi đổi giá `Alert` tone theo `success`/`warning`/`error`, `role="status"`, giữ `data-tone` cũ; "Chain này chưa có dự án nào." và lịch sử rỗng là `EmptyState` |
| `/recall` | đang tải `EmptyState loading role="status"` (chữ ba dấu chấm ASCII); lỗi `EmptyState tone="bad" role="alert"` cộng nút "Thử lại" (vẫn không `h1`); có dữ liệu: `h1` và ô chọn token cùng hàng; bước trong một thẻ (chỉ khi có bước); 2 thẻ có `CardTitleIcon`; lỗi thao tác ngoài hộp thoại `Alert bad role="alert"`; dialog dùng `fieldClass` |

### 2.3 Đoạn đổi gần hook, handler, điều kiện khoá (QĐ-1)

Không đổi dòng nào khai báo hoặc thân hook, state, effect, debounce, `AbortController`, `Promise.all` và hạn 15
giây, `stage`, `useCallback`, `useMemo`, `finish`, ref, `chooseSource`, điều kiện khoá. Các đoạn có đụng:

- `draft.tsx` 2 bảng: thêm prop `loading={!freshMine}`, chỉ đọc biến đã có (`freshMine`), không đổi `emptyText`.
- `draft.tsx` ô Số lượng: chỉ đổi `className`; `readOnly={fullSupplyAmount}`, `value`, `onValueChange` giữ nguyên.
- `draft.tsx` cảnh báo huỷ toàn bộ: phần tử bọc đổi từ `div role="alert"` sang `Alert role="alert"`; ô đánh dấu
  (`checked={confirmed}`, `onChange`) giữ nguyên, vẫn nằm trong phần tử `role="alert"`.
- `draft.tsx` 2 ô số liệu: hằng `KPI_VALUE` chỉ định dạng (`null` thành `–`), đọc cùng biểu thức `freshStats?.data?...`.
- `price-config.tsx` phản hồi đổi giá: cùng điều kiện `feedback &&`, cùng `role`, `data-tone`; tone hiển thị suy từ
  `feedback.tone` (không đổi state).
- `price-config.tsx` `PartError`, `Warn`: điều kiện hiện giữ nguyên (`!result.ok`, `price.data.warning`,
  `issuance.data.overCap`), chỉ thay phần tử.
- `recall.tsx`: thêm `const step = currentStep(overview)` ngay trước `return` (cùng hàm `gates.ts`, cùng tham số,
  trước đây gọi trong JSX) để chỉ dựng thẻ bước khi có bước; `RecallSteps` vẫn nhận đúng giá trị đó.
- `recall.tsx` các ô trong 3 hộp thoại: chỉ đổi `className`; `value`, `onChange`, `min`, `max`, `maxLength` giữ.
- `dialogs.tsx`: chỉ bọc đoạn lỗi; `useRef<HTMLParagraphElement>`, effect `focus()`, `onOpenChange`, nút giữ.
- `controls.tsx`: thêm biểu tượng vào trong nút; điều kiện hiện, `disabled`, `onClick`, chữ giữ nguyên.

### 2.4 Mốc test QĐ-9

Không sửa tệp test có sẵn. Unit test đọc mã xanh (`uiux-01.test.ts` `resultText`, `uiux-02-dau-man.test.ts` 3 câu
bản xem thử không có trong mã, một `TokenScopeSelect`). e2e cũ xanh cả mock lẫn Hardhat (mục 1.1).

### 2.5 Mã dư thừa

Đã xoá trong phạm vi: `FIELD`, `NOTICE_WARN`, `Warn`, `PartError` (`price-config.tsx`); `RECALL_FIELD`
(`dialogs.tsx`); lớp `amber-*` (`price-config.tsx`, `round-info.tsx`), `emerald-*` (`steps.tsx`); import `StatCard`,
`INPUT_CLASS`, `AlertTriangle`, `CheckCircle2`, `XCircle` ở `draft.tsx`; `TriangleAlert` ở `price-config.tsx`.

Bản sao còn lại ngoài phạm vi: `maker-checker/stat-card.tsx` (`StatCard` còn gạch dài, `INPUT_CLASS`) do
`approvals.tsx:8` và `approval-detail.tsx:10` dùng (FE-UX-03).

## 3. Đo trước và sau

Cùng máy, cùng phiên, cùng quy trình (`measure.sh` ngoài repo): máy chủ mới cổng 3300, tạo dữ liệu bằng
`maker-checker`, `ops-transactions`, `permit-order`, `recall` (đợt mở rồi huỷ trong spec), đo bằng
`tools/20261104_do_moc_measure.js` (sha256 khớp spec) với `JS_PAGES=/,/portfolio,/trade,/approvals,/draft,/config,/recall`.

| Mục | Mốc `27a52ad` | Sau | Trần |
|---|---|---|---|
| Số action khi mở màn | 28 đường dẫn (`/draft` 3, `/config` 1, `/recall` 1) | Khớp từng dòng 28/28 | không đổi |
| Cảnh báo hydrate | 0 | 0 | 0 |
| JS gzip `/` | 558,3 KB | 558,2 KB (-0,1) | +3 KB |
| JS gzip `/draft` | 458,6 KB | 459,7 KB (+1,1) | +3 KB |
| JS gzip `/config` | 464,8 KB | 466,2 KB (+1,4) | +3 KB |
| JS gzip `/recall` | 468,3 KB | 470,9 KB (+2,6) | +3 KB |
| JS gzip `/approvals` | 453,3 KB | 453,8 KB (+0,5) | +3 KB |
| JS gzip `/portfolio` | 456,1 KB | 456,1 KB (0) | +3 KB |
| JS gzip `/trade` | 479,0 KB | 479,0 KB (0) | +3 KB |
| CSS gzip (`.next/static/chunks/*.css`, 1 tệp, gzip mức 9) | 19.356 B | 19.194 B (-162 B) | +2 KB |
| `role` trong `main` (mục 1.2 ca 2) | cả 4: 0, 0, 0 | giống hệt | bằng mốc |

`/recall` tăng 2,6 KB chủ yếu vì màn giờ nạp `Alert`, `EmptyState`, `Badge` sắc và 9 biểu tượng lucide mới.

## 4. Ảnh và kiểm tay

### 4.1 Ảnh (gửi kèm, không commit)

- Trước (`moc/`) và sau (`sau/`): 28 đường dẫn của script đo, 1440 và 390 px, Sáng và Tối, sau khi tạo dữ liệu (nên
  `/draft` có yêu cầu trong bảng; `/approvals`, `/approvals/[id]` có lịch sử phê duyệt). `/recall` ở đây là trạng
  thái không có đợt (đợt của `recall.spec.ts` đã huỷ).
- `/recall` CÓ đợt đang mở: máy chủ mock RIÊNG cổng **3400** (không phải máy chủ e2e hay máy chủ đo), phát hành
  bằng `maker-checker.spec.ts`, mở đợt bằng tay theo `recall.spec.ts:94-101` (script `recall_open.js`), chụp vai
  Kiểm soát viên và Giao dịch viên, 1440 và 390, Sáng và Tối, rồi tắt máy chủ. Mốc: bật 04:13:51Z, mở đợt
  04:14:01Z, tắt 04:14:24Z. Sau: bật 04:23:36Z, mở đợt 04:23:47Z, tắt 04:24:10Z (ngày 04/11/2026, UTC). Hai bên
  cùng có đợt "Đang báo trước". `scrollWidth` ở 390 px đều 390.

### 4.2 Lỗi thao tác trong hộp thoại thu hồi (điều kiện 9)

Cách tạo lỗi: máy chủ mock riêng cổng 3400 (bật 04:16:47Z, tắt 04:17:01Z), phát hành bằng `maker-checker.spec.ts`.
Hai tab cùng vai Kiểm soát viên mở `/recall` khi chưa có đợt. Tab B mở hộp "Mở đợt thu hồi", điền ngày, 0 ngày báo
trước, lý do; tab A mở đợt xong; tab B bấm "Mở đợt" với dữ liệu cũ. Máy chủ trả "Chain đã có một đợt thu hồi chưa
kết thúc." (script `dialog_error.js`, cuối cùng huỷ đợt để trả trạng thái).

Kết quả: `{"dialogOpen":true,"alertCountInDialog":1,"alertText":"Chain đã có một đợt thu hồi chưa kết thúc.",
"focusIsAlert":true,"focusedTag":"P","alertWrapperRole":null}`: hộp thoại vẫn mở, tiêu điểm nằm trên đoạn `p`
câu lỗi, trong hộp thoại đúng một `role="alert"`, khung `Alert` bao ngoài không có `role`. Ảnh
`recall_loi_hop_thoai.png`.

## 5. Lệnh kiểm (tasks bước 7)

```text
7a $ git diff --name-only origin/release/ui-v2...HEAD | grep -vE '^(...danh sách trắng...)$'
                                    # rỗng
7b $ rg -n '...màu cứng...' <13 tệp>
                                    # rỗng
7c $ comm -13 /tmp/del.txt /tmp/add.txt | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e'
                                    # rỗng
7d $ comm -23 <(ext /tmp/del.txt) <(ext /tmp/add.txt)
Đã có ví thanh toán trên chuỗi \u2014 yêu cầu tạo token chỉ vào đúng ví này.
                                    # QĐ-7: gạch dài (U+2014) thành dấu phẩy, phần chữ giữ nguyên
\u2014                         # QĐ-7: ô trống request-table (Nguồn, kết quả PENDING) thành gạch ngắn
```

(Ở đây viết mã `\u2014` thay ký tự gạch dài.) Không có chuỗi tiếng Việt nào khác mất hoặc đổi; các câu chỉ dời vị
trí (vào `Kpi label`, `Alert`, `EmptyState`) đều còn nguyên trong tập dòng thêm.

## 6. Đối chiếu notes (`docs/prototypes/20261101_ui_ux_ban_chot/notes/`)

Giữ: làm theo. Đã cũ: QĐ-8 hoặc mục 1 "Không làm". Bỏ: không làm, kèm lý do.

**`draft.md`**

| Dòng notes | | Ghi chú |
|---|---|---|
| Tiêu đề "Lập lệnh" | Giữ | cùng hàng với ô chọn token |
| Câu phụ, "Chain đang xem" | Đã cũ | mục 1 "Không làm" |
| Ô "Yêu cầu tạo token đang chờ" (xanh nổi bật) | Giữ ô, đổi sắc | QĐ-3: `Kpi default` (QĐ-8: bản xem thử tô `hl`) |
| Ô "Yêu cầu huỷ token đang chờ" | Giữ | `Kpi default` |
| Thẻ "Tạo token", "Huỷ token", biểu tượng cộng tròn và lửa | Giữ | `CardTitleIcon` |
| Ô "Mã hoặc ký hiệu token" | Giữ | `fieldClass`, chữ in hoa |
| Khối "Thông tin token" 10 dòng | Giữ | ô nền nhạt, giữ `dt`/`dd` |
| Trạng thái khối thông tin: rỗng, lỗi, nút "Thử đọc lại thông tin token" | Giữ | lỗi trong khối |
| Ô "Ví đích (ví thanh toán SPV)", gợi ý dấu phẩy | Giữ | QĐ-7 |
| Dropdown "Nguồn huỷ" | Giữ | `chooseSource` không đổi |
| Cảnh báo đỏ huỷ toàn bộ, ô xác nhận | Giữ | `Alert bad role="alert"` |
| Ô Số lượng (dấu chấm, tự điền, khoá, gợi ý) | Giữ | `read-only:bg-muted` |
| Ngày hiệu lực, Lý do, Chứng từ, Ghi chú | Giữ | `fieldClass` |
| Khối "Kiểm tra trước khi lập" Mint, Burn | Giữ | ô nền nhạt, giữ dấu cách |
| Nút gửi, "Chưa gửi được: ..." | Giữ | |
| Thông báo đã gửi | Giữ | `Alert ok role="status"` |
| Thẻ "Yêu cầu đã lập", câu mô tả | Giữ | `CardTitleIcon` `History` |
| 2 bảng (cột, Nguồn) | Giữ | nhãn trạng thái có sắc |
| Kết quả "–", câu duyệt, từ chối | Giữ | QĐ-7 `–` |
| Rỗng, lỗi bảng (notes: không dựng) | Giữ | `EmptyState`, `Alert bad` |
| Thiếu ô chọn token ở bản xem thử | Đã cũ | QĐ-8: mã có `TokenScopeSelect`, giữ một lần |

**`config.md`**

| Dòng notes | | Ghi chú |
|---|---|---|
| Tiêu đề, câu phụ | Giữ tiêu đề; Đã cũ câu phụ | mục 1 "Không làm" |
| Thanh "Trạng thái xem thử" | Đã cũ | chỉ có ở bản xem thử |
| "Đang tải…", lỗi tải toàn màn, lỗi từng khối | Giữ | `EmptyState loading`, `Alert bad role="alert"` |
| Thẻ "Giá phát hành", ô vàng giá áp dụng | Giữ | `Kpi au`, nhãn theo `onChain` |
| Giá đã cấu hình, Đặt gần nhất, Ngưỡng | Giữ | |
| Cảnh báo vàng lệch giá | Giữ | `Alert warn role="status"` |
| Thẻ "Đổi giá" (chỉ Giao dịch viên), 2 ô, dòng lý do khoá, nút | Giữ | `fieldClass` |
| 2 hộp xác nhận | Giữ | nội dung không đổi |
| Thông báo kết quả, cảnh báo chưa xác nhận, lỗi chuỗi từ chối | Giữ | `Alert` ok, warn, bad giữ `data-tone` |
| Thẻ "Tình trạng phát hành", ô xanh "Tổng cung trên chuỗi" | Giữ | `Kpi hl` |
| Trần, Còn được phát hành, Mốc, Ví SPV, nút Sao chép | Giữ | |
| Cảnh báo vượt trần, "Chain này chưa có dự án nào." | Giữ | `Alert warn`, `EmptyState` |
| Thẻ, bảng "Lịch sử đổi giá", câu rỗng | Giữ | `EmptyState` |

**`recall.md`**

| Dòng notes | | Ghi chú |
|---|---|---|
| Tiêu đề "Thu hồi token" | Giữ | |
| Câu phụ "Lập lịch, ... Thanh toán thực hiện ngoài hệ thống ..." | Đã cũ | mục 1 "Không làm"; test cấm câu này trong mã |
| Thanh "Trạng thái xem thử" | Đã cũ | |
| "Đang tải tình trạng thu hồi...", lỗi, nút "Thử lại" | Giữ | `EmptyState`, giữ `role`, không `h1` (mục 1: không hiện tiêu đề ở hai nhánh này) |
| 4 bước, `aria-current` | Giữ | thẻ bước, `data-state`, `data-tone` |
| Thẻ "Tình trạng đợt thu hồi", nhãn Đợt (xanh dương), Chế độ PoC, Đã huỷ (đỏ), Token trên chuỗi | Giữ | QĐ-4; "Token trên chuỗi" đang đóng băng là vàng (`warn`) theo QĐ-4, không đỏ như notes |
| 10 ô thông tin | Giữ | ô nền nhạt, 4 cột |
| Câu đợt đã huỷ, dự án đã đóng, Lý do | Giữ | |
| Cảnh báo khoá chain, ví bị cắt, "Chưa thể đóng băng" | Giữ | `Alert` giữ `role` cũ |
| Tiến độ lô | Giữ | `Alert info role="status"` |
| Câu "Giao dịch viên chỉ được xem ..." | Giữ | |
| Các nút và câu trạng thái nút | Giữ | thêm biểu tượng, tên không đổi |
| Lỗi thao tác ngoài hộp thoại | Giữ | `Alert bad role="alert"` |
| Hộp thoại đang chạy, dòng lỗi trong hộp thoại | Giữ | mục 4.2 |
| Thẻ hồ sơ / ví dự kiến, câu "Dự kiến N ví", câu rỗng | Giữ | `EmptyState` |
| Bảng, trạng thái thành nhãn màu | Giữ | `Badge` theo `caseTone`; không thêm nhãn mới, không cuộn 480 px (mục 1) |
| Các hộp thoại mở, sửa mốc, huỷ, đóng băng, thu hồi, mở đóng băng | Giữ | `fieldClass`, chữ không đổi |

## 7. DEVIATION so với spec

- **Lưới dùng `min-[640px]:` thay `sm:`** ở `round-info.tsx` (2 cột rồi 4 cột): Tailwind 4 không so được mốc theo
  rem (`sm`) với mốc px (`min-[1100px]`), lớp `sm:` có thể đứng sau và thắng (đã gặp ở FE-UX-02a).
- **Thẻ bước chỉ dựng khi có bước:** bọc `RecallSteps` bằng `Card` cần biết trước có bước hay không, nên tính
  `currentStep(overview)` một lần trước `return` (mục 2.3).
- **`/approvals` đổi theo:** bảng rỗng hiện `EmptyState` không quay (giữ câu `emptyText`), nhãn trạng thái có sắc;
  khối thông tin token ở `/approvals/[id]` cũng nền nhạt. Đúng phạm vi tệp dùng chung, ảnh trước và sau gửi kèm.

## 8. Câu hỏi mở

- Không có.

## 9. Tự đánh giá 3 luật kiến trúc

- [x] Mọi call chain qua ILedgerPort: không đổi mã gọi chuỗi.
- [x] Mọi ký qua ISigner: không đổi.
- [x] Mọi kiểm quyền qua RBAC: không đổi; `canManage`, `canEdit` giữ nguyên.
