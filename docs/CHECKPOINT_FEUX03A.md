# Báo cáo bàn giao: FE-UX-03a 2 màn Kiểm soát duyệt yêu cầu

| | |
|---|---|
| Mã task | FE-UX-03a |
| Phạm vi | **Frontend thuần.** Không `lib/`, `app/actions`, `app/api`, `gates.ts`, `components/ui/**`, thành phần `maker-checker` của 02b; không gói npm mới; không đổi câu chữ (trừ QĐ-6), trường, bộ lọc, nút, điều kiện khoá, lời gọi server action |
| Nhánh | `feat/fe-ux-03a-kiem-soat`, tạo từ `release/ui-v2` (`7b3216d`, sau merge PR #88 FE-UX-02b) |
| Spec | `docs/fe-ux-03a-kiem-soat/{requirements,design,tasks}.md` (chép nguyên) |
| Commit | spec `26cdde5`; tách khối hành động, dời nguyên văn `cb4f327`; đổi kiểu, xoá `stat-card.tsx`, test `ab3c910`; nhãn trạng thái góc phải `0ebf41f`, rồi đổi sang lưới hai cột `8f23809` (mục 8); tài liệu: commit cuối trên nhánh |
| Tiến độ | Xong. Một PR, base `release/ui-v2`, chờ Supervisor nghiệm thu; Claude Code **không** merge |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 4) | | Bằng chứng |
|---|---|---|---|
| 1 | 2 màn đúng bố cục trừ "Không làm" và QĐ-7; bảng đối chiếu notes | ✅ | mục 2.2, 7 |
| 2 | Ô số liệu đúng QĐ-3; khối tự viết thay theo QĐ-4; `FEEDBACK_STYLE` không còn | ✅ | mục 1.2 (ca 1), 2.2, 6 (6f) |
| 3 | `stat-card.tsx` đã xoá; `rg -n "stat-card\|INPUT_CLASS" app/src` rỗng | ✅ | mục 6 (6a, 6e) |
| 4 | Ba tầng khoá ở chi tiết giữ tách riêng; bảng trạng thái trước và sau giống nhau | ✅ | mục 3 |
| 5 | Không đổi chữ, trường, nút, điều kiện khoá; chỉ chuỗi QĐ-6 đổi (6d) | ✅ | mục 6 (6d) |
| 6 | Diff giữ logic (QĐ-1); liệt kê đoạn đổi gần hook, handler, điều kiện khoá | ✅ | mục 2.3 |
| 7 | Action đúng QĐ-2, không đổi 28 đường dẫn; JS, CSS trong trần QĐ-9; hydrate, lỗi console 0 | ✅ | mục 4 |
| 8 | Mốc test QĐ-8 giữ nguyên; không sửa test có sẵn | ✅ | mục 1.1, 2.4 |
| 9 | Ảnh 1440, 390, Sáng, Tối, trước và sau, có dữ liệu, chi tiết 3 trạng thái, máy chủ mock riêng | ✅ | mục 5 |
| 10 | `fe-ux-03a-kiem-soat.spec.ts` đủ 3 ca, `fe-ux-03a.test.ts` đủ 4 trạng thái, xanh | ✅ | mục 1.2, 1.3 |
| 11 | Khối hành động tách theo QĐ-10, dời nguyên văn; dán đoạn trước và sau | ✅ | mục 2.1 |
| 12 | Kiểm thử mục 5 đạt, kèm log, mục "EVM - E2E PROJECT HARDHAT" xanh; ghi 2 nợ | ✅ | mục 1.1, 8 |
| 13 | Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 6) rỗng | ✅ | mục 6 |
| 14 | Không mã dư thừa trong 2 tệp | ✅ | mục 2.5 |

**Kết luận:** 14 ✅, 0 🔶, 0 ❌. JS `/approvals` +1,4 KB, chi tiết +0,8 KB (trần 3 KB), `/`, `/portfolio`, `/trade`
không đổi; CSS +10 B; action khớp 28/28 (`/approvals` 3, chi tiết 1). Mức rủi ro: thấp đến vừa (khối hành động
dời sang tệp mới; ba tầng khoá kiểm bằng unit test với dữ liệu giả, luồng thật bằng e2e mock và Hardhat).

UserGuide: Phần 3 mục 3.4.3, 3.4.4 thêm "Bố cục"; "Chốt tại"; Lịch sử.

### 0.2 Việc cần Owner quyết

- Không có. Hai nợ ghi ở mục 8.

---

## 1. Kiểm thử (requirements mục 5, phần dev)

### 1.1 Lệnh và kết quả

```text
$ TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm
  => PASS có cảnh báo: luật kiến trúc          # PASS 20, FAIL 0, WARN 3 (như mốc)
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)
BỎ QUA  FE-UX-03a: chưa có docs/CHECKPOINT_FEUX03a.md ...   # tên tệp khác hoa thường, mục 8
  => PASS: LỚP 3 - KHUÔN CHECKPOINT
  => PASS: APP - TYPECHECK
  => PASS: APP - LINT
      Tests  1506 passed | 74 skipped (1580)   # mốc 1502 + 4 ca mới của fe-ux-03a.test.ts
  => PASS: APP - VITEST
  => PASS: APP - BUILD BẢN PHÁT HÀNH
      116 passed, 7 skipped (3.1m)            # project mock đầy đủ: 114 ca cũ + 2 test mới
  => PASS: APP - E2E (PLAYWRIGHT)
  => PASS: EVM - BUILD BẢN HARDHAT
  => PASS: EVM - DỰNG CHUỖI MỚI
      26 passed, 2 skipped (41.6s)            # project Hardhat: mint (luồng Chấp nhận), chain-scope, ...
  => PASS: EVM - E2E PROJECT HARDHAT
  => ĐẠT các phần đã chạy: arch markers checkpoint app build e2e evm      # exit=0, trên commit 0ebf41f

$ node scripts/check-checkpoint.mjs docs/CHECKPOINT_FEUX03A.md docs/fe-ux-03a-kiem-soat/requirements.md
ĐẠT     docs/CHECKPOINT_FEUX03A.md          # 14 dòng / 14 điều kiện

# Commit cuối 8f23809 chỉ đổi lớp ở CardHeader của khối hành động (mục 8); chạy lại trên bản build của nó:
$ npx playwright test --project=mock         116 passed, 7 skipped (3.1m), exit=0
$ bash scripts/run-local-all.sh evm          26 passed, 2 skipped (42.3s), ĐẠT, exit=0
```

Log gửi kèm (không commit): `20261104_feux03a_run_local_all.log` và riêng đoạn từ dòng "EVM - E2E PROJECT HARDHAT"
tới hết: `20261104_feux03a_evm_e2e.log`; chạy lại trên commit cuối: `20261104_feux03a_e2e_mock_cuoi.log`,
`20261104_feux03a_evm_cuoi.log`. Không chạy `contracts` (mục 5).

Chạy thêm trước đó:
- Bước tách (commit `cb4f327`, chưa đổi kiểu), bản build riêng `.next-move`, máy chủ cổng 3500: `maker-checker`,
  `mint`, `chain-scope` 12 passed, 4 skipped.
- Bản đổi kiểu: `fe-ux-03a-kiem-soat`, `maker-checker`, `mint`, `chain-scope`, `uiux-02-dau-man`, `fe-ux-01a-nen`,
  `fe-ux-01c-chuyen-dong`, `ops-transactions`, `recall`: 35 passed, 4 skipped.

### 1.2 e2e mới `app/e2e/fe-ux-03a-kiem-soat.spec.ts` (project mock; tệp có 2 `test`)

| `test` | Kiểm |
|---|---|
| ca 1 | `/approvals` (Kiểm soát viên): `expect.poll` tới khi giá trị cả 3 ô khớp `^\d{1,3}(\.\d{3})*$` (thay mốc chờ đã mất ý nghĩa ở `maker-checker.spec.ts:142`); rồi 3 `[data-kpi]`, mỗi ô tìm bằng `getByLabel(nhãn, exact)` có `data-kpi`, `data-tone="default"` |
| ca 2 và 3 (gộp) | Giao dịch viên lập một yêu cầu tạo 3 WPT (chép bước `fe-ux-01c-chuyen-dong.spec.ts`, không import), lấy `requestId` từ `data-request-id`. Kiểm soát viên mở `/approvals` (chờ `networkidle` và dòng `[data-request-id]` trong hàng chờ tạo token), bấm mã sang chi tiết (chờ thẻ "Khối hành động"); đếm `role` status, note, alert trong `main` ở cả hai màn. Ở 1440 và 390 px, mỗi màn trên ngữ cảnh mới: `scrollWidth` không vượt bề rộng, 0 lỗi console, 0 lỗi trang, 0 cảnh báo hydrate. `finally`: Kiểm soát viên TỪ CHỐI đúng yêu cầu vừa lập |

Số `role` mốc đo trên `7b3216d` bằng chính ca này trong lượt e2e mock đầy đủ (spec chép tạm vào bản mốc): `/approvals`
`{status: 0, note: 0, alert: 0}`, chi tiết `{status: 0, note: 0, alert: 0}`; sau sửa giống hệt. Lượt mốc: ca 1 đỏ
đúng dự kiến (bản mốc chưa có `data-kpi`), ca 2 và 3 xanh, 115 passed, 7 skipped: việc lập rồi từ chối không làm
spec chạy sau đổi kết quả.

### 1.3 Unit test mới `app/test/fe-ux-03a.test.ts` (môi trường `node`, `renderToStaticMarkup`, 4 ca)

Mỗi ca gọi `actionBlocks(detail, working, rejectReason)` với dữ liệu giả (chỉ `request.status`,
`selfApprovalReason`, `approveWarning`, `canReconcile`), rồi dựng `ApprovalActions` với kết quả đó; kiểm thuộc
tính `disabled` của từng nút theo tên, có hay không có nút Đối soát, các `data-testid`.

| Trạng thái giả | Chấp nhận | Từ chối | Đối soát | Khác |
|---|---|---|---|---|
| `PENDING`, có cảnh báo, lý do đã nhập | khoá | mở | không có | có `approve-warning` `role="alert"`, không `reject-block-reason`, ô lý do mở |
| `PENDING`, có cảnh báo, lý do rỗng | khoá | khoá | không có | có `reject-block-reason` "Phải nhập lý do từ chối." |
| `EXECUTING`, `canReconcile`, không `working` | khoá | khoá | mở | có `decision-block-reason`, ô lý do khoá |
| `EXECUTING`, `canReconcile`, `working` | khoá | khoá | khoá | không `reject-block-reason` |

Tự gây lỗi 4 điểm Supervisor định thử, trên bản sao làm việc rồi hoàn lại:

| Lỗi gây ra | Kết quả |
|---|---|
| Bỏ `aria-label` "Đang chờ duyệt" ở `Kpi` (`approvals.tsx`) | build lại, e2e: `fe-ux-03a-kiem-soat` ca 1 đỏ, `maker-checker.spec.ts:138` đỏ |
| Trong `actionBlocks` đổi `approveBlockReason(detail)` thành `decisionBlockReason(detail)` | unit dòng 1 và 2 đỏ (nút Chấp nhận mở dù có cảnh báo) |
| Nút Đối soát không khoá khi `working` (`disabled={false}`) | unit dòng 4 đỏ |
| Nút Đối soát luôn khoá (`disabled`) | unit dòng 3 đỏ |
| Bỏ `role="status"` của phản hồi (`approval-actions.tsx`) | build lại, e2e: `fe-ux-03a-kiem-soat` ca 2 và 3 đỏ (bước dọn chờ `status`), `maker-checker.spec.ts:138` đỏ |

Hoàn lại xong, build lại bản đúng, `git status` mã nguồn sạch.

## 2. Thay đổi

### 2.1 Tách khối hành động (QĐ-10), dời nguyên văn

`components/maker-checker/approval-actions.tsx` (mới, không `'use server'`, không import `app/actions`; chỉ kiểu và
hàm thuần ở `lib/**`): `actionBlocks` và `ApprovalActions`. `approval-detail.tsx` gọi hai thứ đó; state, handler,
server action giữ ở `approval-detail.tsx`; kiểu `Feedback` dời theo (export).

Khối tính khoá, trước (`approval-detail.tsx:136-140` @ `7b3216d`) và sau (`actionBlocks` @ `cb4f327`), `diff` rỗng:

```ts
  const decisionBlock = detail ? decisionBlockReason(detail) : 'Đang tải yêu cầu…';
  // FIX-02 B3: cảnh báo số liệu khoá RIÊNG nút "Chấp nhận"; "Từ chối" vẫn bấm được.
  const approveBlock = working ? 'Đang xử lý…' : detail ? approveBlockReason(detail) : 'Đang tải yêu cầu…';
  const approveWarning = detail?.approveWarning ?? null;
  const rejectBlock = working ? 'Đang xử lý…' : (decisionBlock ?? rejectBlockReason(rejectReason));
```

`approval-detail.tsx` sau: `const { decisionBlock, approveBlock, rejectBlock, approveWarning } = actionBlocks(detail, working, rejectReason);`

Thẻ "Khối hành động": 82 dòng JSX trước (`approval-detail.tsx:188-269` @ `7b3216d`) so với 82 dòng sau
(`approval-actions.tsx` @ `cb4f327`), bỏ thụt lề: chỉ khác đúng 6 dòng, đều là đổi biến cục bộ thành prop:

```diff
4c4    < <StatusBadge status={detail.request.status} />            > <StatusBadge status={status} />
19c19  < onChange={(event) => setRejectReason(event.target.value)} > onChange={(event) => onRejectReasonChange(event.target.value)}
37c37  < <Button ... onClick={approve} ...>                         > <Button ... onClick={onApprove} ...>
44c44  < onClick={reject}                                          > onClick={onReject}
51c51  < {detail.canReconcile && (                                 > {canReconcile && (
55c55  < onClick={reconcile}                                       > onClick={onReconcile}
```

Đổi kiểu làm ở commit sau (`ab3c910`, `0ebf41f`), xem 2.2.

### 2.2 Màn (bố cục theo design mục 1)

| Màn | Đổi |
|---|---|
| `/approvals` | `h1` và `TokenScopeSelect` cùng hàng; 3 `Kpi` sắc `default` (`Clock`, `ShieldCheck`, `ShieldX`) giữ `aria-label`, chưa có số thì `–`; lỗi số liệu, lỗi hàng chờ, lỗi lịch sử là `Alert bad` không `role`; 2 thẻ hàng chờ (`CirclePlus`, `Flame`) và thẻ lịch sử (`History`) có `CardTitleIcon`, câu mô tả giữ; bộ lọc `fieldClass` (ô tìm `pl-10`, biểu tượng canh giữa), ô trạng thái 220 px từ 640 px; `RequestTable` nhận `loading={!fresh}` (hàng chờ) và `loading={!stats}` (lịch sử); câu chạm ngưỡng 200 giữ |
| `/approvals/[id]` | liên kết "Về danh sách" có mũi tên đứng đầu, `h1`, mã đầy đủ `font-code`; lỗi tải `Alert bad` không `role`. Thẻ "Khối hành động" (`Gavel`): `StatusBadge` trong `CardAction` góc trên phải; từ 1100 px cột trái tối đa 420 px (lý do khoá `Alert warn` biểu tượng `Lock` không `role`, ô lý do `fieldClass`, cảnh báo duyệt `Alert warn role="alert"`), cột phải 15rem 3 nút `size="lg"` cao 48 px (`h-12`) xếp dọc; dưới 1100 px nút trải ngang; dòng `reject-block-reason` giữ; phản hồi `Alert` (`success` `ok`, `warning` `warn`, `error` `bad`) giữ `role="status"` và `data-tone` cũ. Thông tin token và "Khối nội dung yêu cầu" (`FileText`) 2 cột từ 1100 px, cao bằng nhau; Số lượng `tabular-nums`; ô thiếu `–`. "Nhật ký" (`History`) dạng dòng thời gian: cột thời gian 150 px `tabular-nums`, chấm tròn `bg-primary` vòng `ok-bg`, đường nối `bg-border`, tên bước đậm, người thao tác sau dấu phẩy, chi tiết `break-all`; vẫn mỗi dòng một `li` |

### 2.3 Đoạn đổi gần hook, handler, điều kiện khoá (QĐ-1)

Không đổi state, effect, `requestKey`, lọc tìm kiếm, `outcomeFeedback`, `revision`, `loadKey`, `reload`, handler,
điều kiện khoá. Các đoạn có đụng:

- `approval-detail.tsx`: 5 dòng tính khoá thay bằng một lời gọi `actionBlocks` cùng tham số (2.1, giống hệt); thẻ
  hành động thay bằng `<ApprovalActions ...>` truyền đúng biến cũ (`setRejectReason`, `approve`, `reject`,
  `reconcile`, `detail.canReconcile`, `detail.request.status`). An toàn vì là dời mã, đã đối chiếu từng dòng.
- `approval-actions.tsx` khi đổi kiểu: nút giữ `onClick`, `disabled`, `title`, nút Đối soát giữ điều kiện hiện
  `canReconcile && (` và `disabled={working}`; ô lý do giữ `disabled={decisionBlock !== null}`; dòng
  `reject-block-reason` giữ điều kiện `!decisionBlock && rejectBlock && !working`. Chỉ đổi phần tử bọc, lớp.
- `approvals.tsx`: 2 ô lọc chỉ đổi `className`; `value`, `onChange`, `id` giữ. `RequestTable` thêm `loading` đọc
  biến đã có (`fresh`, `stats`). Hằng `kpiValue` chỉ định dạng (`null` thành `–`), đọc cùng biểu thức.

### 2.4 Mốc test QĐ-8

Không sửa tệp test có sẵn. Mốc đã kiểm qua các spec chạy ở mục 1.1 (`maker-checker`, `mint`, `chain-scope`,
`uiux-02-dau-man`, `fe-ux-01a-nen`, `fe-ux-01c-chuyen-dong`, `ops-transactions`, `recall`). `aria-label` "Hàng chờ
tạo token", "Hàng chờ huỷ token" vẫn có trên cả thẻ và bảng; `TokenScopeSelect` đúng một lần.

### 2.5 Mã dư thừa

Đã xoá: `maker-checker/stat-card.tsx` (`StatCard`, `INPUT_CLASS`); `FEEDBACK_STYLE`; import `StatCard`, `INPUT_CLASS`,
`CheckCircle2`, `XCircle`, `TriangleAlert`, `Loader2`, `RefreshCw`, `ShieldCheck`, `ShieldX`, `Button`,
`StatusBadge`, `approveBlockReason`, `approveWarningFigures`, `decisionBlockReason`, `rejectBlockReason` ở
`approval-detail.tsx` (dời sang `approval-actions.tsx` cùng mã dùng chúng).

## 3. Trạng thái khoá ở chi tiết (design mục 2, xác nhận bằng mã; trước và sau giống nhau)

| Trạng thái | Ô lý do | Chấp nhận | Từ chối | Đối soát |
|---|---|---|---|---|
| Có `decisionBlock` (không còn chờ, hoặc người xem là người lập) | khoá | khoá | khoá | ẩn, trừ khi `canReconcile` |
| Đã quyết định, `EXECUTING`, `canReconcile` | khoá | khoá | khoá | mở (khoá khi `working`) |
| Chờ duyệt, có cảnh báo duyệt | mở | khoá (`approveBlockReason`) | theo lý do | ẩn |
| Chờ duyệt, không cảnh báo, lý do rỗng | mở | mở | khoá | ẩn |
| Chờ duyệt, không cảnh báo, đã nhập lý do | mở | mở | mở | ẩn |
| Đang gửi (`working`) | như trước | khoá | khoá | khoá |

Mã khớp bảng design: `decisionBlockReason` trả lý do khi `status !== 'PENDING'` hoặc `selfApprovalReason`;
`approveBlockReason = decisionBlockReason ?? approveWarning.message`; `rejectBlock = working ? ... : decisionBlock ??
rejectBlockReason(lý do)`; ô lý do `disabled={decisionBlock !== null}`; Đối soát `canReconcile && disabled={working}`.
Dòng `reject-block-reason` hiện khi `!decisionBlock && rejectBlock && !working`. Không sửa bảng.

## 4. Đo trước và sau

Cùng máy, cùng phiên, cùng quy trình (`measure.sh` ngoài repo): máy chủ mới cổng 3300, tạo dữ liệu bằng
`maker-checker`, `ops-transactions`, `permit-order`, `recall`; đo bằng `tools/20261104_do_moc_measure.js` (sha256
khớp spec) với `JS_PAGES=/,/portfolio,/trade,/approvals`. Trang chi tiết đo JS bằng tay (cộng gzip từng script như
script đo) trên máy chủ dữ liệu riêng (mục 5), yêu cầu chờ duyệt, Sáng, 1440 px.

| Mục | Mốc `7b3216d` | Sau | Trần |
|---|---|---|---|
| Số action khi mở màn | 28 đường dẫn (`/approvals` 3, `/approvals/[id]` 1) | Khớp 28/28 | không đổi |
| Cảnh báo hydrate | 0 | 0 | 0 |
| JS gzip `/approvals` | 453,8 KB | 455,2 KB (+1,4) | +3 KB |
| JS gzip `/approvals/[id]` | 454,7 KB | 455,5 KB (+0,8) | +3 KB |
| JS gzip `/` | 558,2 KB | 558,2 KB (0) | không tăng |
| JS gzip `/portfolio` | 456,1 KB | 456,1 KB (0) | không tăng |
| JS gzip `/trade` | 479,0 KB | 479,0 KB (0) | không tăng |
| CSS gzip (`.next/static/chunks/*.css`, 1 tệp, gzip mức 9) | 19.194 B | 19.224 B (+30 B) | +2 KB |
| `role` trong `main` (mục 1.2) | 0, 0, 0 cả hai màn | giống hệt | bằng mốc |

## 5. Ảnh (gửi kèm, không commit)

- 28 đường dẫn của script đo, trước (`moc/`) và sau (`sau/`), 1440 và 390 px, Sáng và Tối.
- Dữ liệu tạo bằng tay trên máy chủ mock RIÊNG cổng **3400** (`next start`, env như `playwright.config.ts`), script
  `approvals_data.js`: Giao dịch viên lập 3 yêu cầu tạo token (1.000, 2.000, 3.000 WPT, có chứng từ); Kiểm soát
  viên chấp nhận yêu cầu 1 (có mã giao dịch), từ chối yêu cầu 2 ("Chứng từ chưa ký, lập lại"), để yêu cầu 3 chờ;
  chụp `/approvals` và chi tiết 3 trạng thái, 1440 và 390, Sáng và Tối; tắt máy chủ. Mốc: bật 06:47:03Z, tắt
  06:47:58Z. Sau: bật 07:24:43Z, tắt 07:25:40Z (bản build commit cuối) (04/11/2026, UTC). Trước và sau cùng script. `scrollWidth` không vượt bề rộng ở mọi ảnh
  sau.

## 6. Lệnh kiểm (tasks bước 6)

```text
6a $ git diff --name-only --diff-filter=d ... | grep -vE '^(...danh sách trắng...)$'      # rỗng
   $ git diff --name-only --diff-filter=D ... | grep -vx '.../stat-card.tsx'              # rỗng
6b $ rg -n '...màu cứng...' <3 tệp>                                                       # rỗng
6c $ comm -13 /tmp/del.txt /tmp/add.txt | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e' # rỗng
6d $ comm -23 <(ext /tmp/del.txt) <(ext /tmp/add.txt)
/** Kiểu ô nhập dùng chung của hai màn \u2014 cùng kiểu với màn     # chú thích của stat-card.tsx đã xoá
/** Thẻ số liệu của hai màn lập\u2013duyệt.                         # chú thích của stat-card.tsx đã xoá
Bắt buộc khi từ chối \u2014 người lập cần biết phải sửa gì.         # QĐ-6: gạch dài thành dấu phẩy
có sẵn. */                                                       # chú thích của stat-card.tsx đã xoá
là chưa đọc được, không phải 0. */                               # chú thích của stat-card.tsx đã xoá
6e $ rg -n "stat-card|INPUT_CLASS" app/src                                                # rỗng
6f $ rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e' <3 tệp> | rg -v '<dòng chú thích>'   # rỗng
```

(Ở đây viết mã `\u2014`, `\u2013` thay ký tự gạch dài, gạch nối.) Các chuỗi QĐ-6 khác (ô thiếu, dấu chấm giữa ở
nhật ký) là ký tự đứng riêng nên `ext` không in; đã đổi theo 6c, 6f. Không chuỗi nào khác mất hoặc đổi.

## 7. Đối chiếu notes (`docs/prototypes/20261101_ui_ux_ban_chot/notes/`)

Giữ: làm theo. Đã cũ: QĐ-7. Bỏ: không làm, kèm lý do.

**`approvals.md`**

| Dòng notes | | Ghi chú |
|---|---|---|
| Tiêu đề | Giữ | cùng hàng với ô chọn token |
| Câu phụ "Xem yêu cầu ... Chain đang xem" | Đã cũ | QĐ-7, test cấm |
| Thiếu ô chọn token ở bản xem thử | Đã cũ | QĐ-7: mã có `TokenScopeSelect`, giữ một lần |
| 3 ô "Đang chờ duyệt", "Đã duyệt hôm nay", "Đã từ chối hôm nay" | Giữ ô, sắc thường | QĐ-3 (bản xem thử tô `hl`, `leaf`) |
| 2 thẻ hàng chờ, câu "Bấm mã yêu cầu ..." | Giữ | `CardTitleIcon` |
| Ô "Tìm kiếm", "Trạng thái" (mặc định Chờ duyệt) | Giữ | `fieldClass`; 6 lựa chọn giữ |
| Bảng hàng chờ, bảng lịch sử, kết quả | Giữ | `RequestTable` (02b), nhãn sắc |
| Thẻ "Lịch sử phê duyệt", câu mô tả, "Hiện 50 ..." | Giữ | |
| Rỗng, lỗi | Giữ | `EmptyState` (qua `RequestTable`), `Alert bad` |
| Liên kết mã yêu cầu | Giữ | `prefetch={false}` |

**`approval-detail.md`**

| Dòng notes | | Ghi chú |
|---|---|---|
| Tiêu đề, mã đầy đủ, "Về danh sách" | Giữ | liên kết lên đầu, có mũi tên |
| Thanh "Trạng thái xem thử" | Đã cũ | chỉ có ở bản xem thử |
| Thẻ "Hành động", nhãn trạng thái | Giữ | nhãn góc trên phải |
| Khung lý do khoá (ổ khoá) | Giữ | `Alert warn` biểu tượng `Lock` |
| Ô "Lý do từ chối", gợi ý dấu phẩy | Giữ | QĐ-6 |
| Khung cảnh báo vàng khi duyệt | Giữ | `Alert warn role="alert"` |
| Nút Chấp nhận, Từ chối, dòng "Từ chối: ...", nút Đối soát | Giữ | điều kiện không đổi (mục 3) |
| Khung phản hồi sau thao tác | Giữ | `Alert` theo tone, `role="status"`, `data-tone` |
| Câu lỗi khối token | Giữ | trong `TokenInfoBlock` (02b, không sửa) |
| Thẻ "Thông tin token", "Nội dung yêu cầu" 13 dòng, "Thực hiện qua" | Giữ | 2 cột, cao bằng nhau |
| Thẻ "Nhật ký" | Giữ | dòng thời gian một sắc; không tô sắc theo trạng thái (mục 1 "Không làm") |
| Số dòng trích dẫn trong notes | Đã cũ | QĐ-7 |

## 8. Nợ và DEVIATION

- **Nợ 1:** `maker-checker.spec.ts:142` kiểm ô "Đang chờ duyệt" không chứa gạch dài, nhưng sau QĐ-3 ô hiện gạch
  ngắn cả khi đang tải, nên phép kiểm đó không còn chờ được số liệu. Ca 1 spec mới thay bằng `expect.poll` số đã
  định dạng. Không sửa test cũ (QĐ-8).
- **Nợ 2:** chú thích `request-table.tsx:21-22` ("Màn Phê duyệt không truyền") sai sau PR này (màn Phê duyệt nay
  truyền `loading`); `request-table.tsx` ngoài danh sách trắng, sửa khi tệp đó được mở lại.
- **Phần `checkpoint` của `run-local-all.sh` bỏ qua tệp này:** `scripts/check-checkpoint.mjs:471-491` suy tên tệp
  bằng cách bỏ gạch nối ở mã task, giữ nguyên hoa thường (`FE-UX-03a` thành `CHECKPOINT_FEUX03a.md`), còn spec quy
  định `CHECKPOINT_FEUX03A.md`. Script ngoài danh sách trắng nên không sửa; đã chạy lệnh hai tham số
  `node scripts/check-checkpoint.mjs docs/CHECKPOINT_FEUX03A.md docs/fe-ux-03a-kiem-soat/requirements.md`: ĐẠT
  (mục 1.1). Đề xuất sửa script (so không phân biệt hoa thường) ở một task chạm `scripts/`.
- **Nhãn trạng thái đặt bằng `CardAction`:** `CardHeader` của `components/ui/card.tsx` là lưới, lớp `flex-row` cũ
  không đẩy nhãn sang phải (ảnh mốc cũng vậy). Dùng `CardAction` có sẵn, không sửa `components/ui`.

## 9. Tự đánh giá 3 luật kiến trúc

- [x] Mọi call chain qua ILedgerPort: không đổi mã gọi chuỗi.
- [x] Mọi ký qua ISigner: không đổi.
- [x] Mọi kiểm quyền qua RBAC: không đổi; khoá nút vẫn theo hàm trong `gates.ts`.
