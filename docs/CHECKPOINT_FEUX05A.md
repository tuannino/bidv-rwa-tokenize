# Báo cáo bàn giao: FE-UX-05a Tổng quan và Danh sách giao dịch của Người bán

| | |
|---|---|
| Mã task | FE-UX-05a |
| Phạm vi | **Frontend thuần.** Không `lib/`, `app/actions`, `app/api`, `app/src/app/**`, `components/ui/*`, `components/trading/*`, `components/recall/*`, `components/token/*`, `components/layout/*`; không gói npm mới; không đổi câu chữ (trừ QĐ-7), trường, thứ tự trường, cột, liên kết, nút, điều kiện hiện, lời gọi server action, số action khi mở màn. `seller-withdraw.tsx` chỉ đổi dòng nhập (QĐ-9, mục 8) |
| Nhánh | `feat/fe-ux-05a-nguoi-ban`, tạo từ `release/ui-v2` @ `11160f1` (sau merge PR #96 FE-UX-04d; đã gồm 04a đến 04d). **Merge-base dùng để đo mốc: `11160f1`**. Không có PR nào merge vào `release/ui-v2` trong lúc làm nên không phải rebase; mọi mốc và cả bộ kiểm thử mục 5 chạy trên merge-base này |
| Spec | `docs/fe-ux-05a-nguoi-ban/{requirements,design,tasks}.md` (chép nguyên) |
| Commit | spec `84c14f0`; e2e nháp `6879a63`, `52361db`; **dời 1** `b746d6f`; hai màn, unit 3, 4, số `role` mốc `7414967`; UserGuide, task-status `bbb3e04`; **dời 2** (QĐ-9) `16f4c5e`; biểu tượng `862ffa5`; UserGuide dòng mã `c1a16ab`; tài liệu: các commit cuối trên nhánh |
| Tiến độ | Xong. Một PR, base `release/ui-v2`, chờ Supervisor nghiệm thu; Claude Code **không** merge |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 4) | | Bằng chứng |
|---|---|---|---|
| 1 | Hai màn đúng bố cục bản chốt trừ "Không làm"; bảng đối chiếu từng dòng hai notes | ✅ | mục 2.2, 7 |
| 2 | Bố cục, thành phần đúng QĐ-3, QĐ-5, QĐ-6; 4 ô số liệu đúng thứ tự, sắc, mỗi ô bọc `div.rounded-lg` | 🔶 | mục 1.2, 1.3, 2.2; biểu tượng nhóm đổi (mục 8) |
| 3 | `format.ts`, `SellerOverviewBody` dời đúng QĐ-4, commit riêng; đoạn trước và sau | ✅ | mục 3, `CHECKPOINT_FEUX05A_DETAIL.md` |
| 4 | Không còn `amber-*`, `*-destructive`, `FIELD` trong tệp phạm vi | ✅ | mục 6 (6b), 1.3 nhóm 1 |
| 5 | Chữ chỉ đổi đúng QĐ-7 (6d đúng kỳ vọng) | ✅ | mục 6 |
| 6 | Diff giữ logic (QĐ-1, QĐ-2); liệt kê đoạn đổi gần hook, effect, handler, điều kiện khoá | ✅ | mục 2.3 |
| 7 | Action đúng QĐ-2 (ca 4), 28 đường dẫn không đổi; JS, CSS trong trần QĐ-9; lỗi hai màn 0 | 🔶 | mục 4; đạt trần sau khi tách thêm hai tệp ngoài danh sách trắng (mục 8) |
| 8 | Mốc test QĐ-8 giữ; không sửa test có sẵn | ✅ | mục 1.1, 2.4 |
| 9 | Ảnh 1440, 390, Sáng, Tối, trước và sau, vai Người bán, tiến trình mock mới, đủ env | ✅ | mục 5 |
| 10 | Trạng thái không dựng được trên mock: unit test và ảnh dựng ngoài repo | ✅ | mục 1.3, 5 |
| 11 | `fe-ux-05a-nguoi-ban.spec.ts` đủ 4 ca, `fe-ux-05a.test.ts` đủ 4 nhóm, xanh | ✅ | mục 1.2, 1.3 |
| 12 | Kiểm thử mục 5 đạt, kèm log; "EVM - E2E PROJECT HARDHAT" xanh (gồm `vault-withdraw`) | ✅ | mục 1.1 |
| 13 | Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 6) đúng kỳ vọng | 🔶 | mục 6: 6a in đúng ba tệp ngoài danh sách đã được duyệt |
| 14 | Không mã dư thừa | ✅ | mục 2.5 |

**Kết luận:** 11 ✅, 3 🔶, 0 ❌. Ba 🔶 cùng một gốc: trần JS `/seller/withdraw` (QĐ-9). Đổi đúng một dòng nhập như QĐ-9
cho phép chỉ bớt 40 B, màn rút vẫn +2,8 KB; em DỪNG và báo Owner. Owner (Sếp) duyệt tách nguyên văn `useSellerOverview`,
`WITHDRAW_STATUS_LABELS` sang `components/seller/use-seller-overview.ts`, `components/seller/labels.ts` (hai trang export
lại tên cũ) và đổi các dòng nhập của `seller-withdraw.tsx`; cùng lúc duyệt đổi biểu tượng nhóm "Token khớp lệnh trong
ngày" từ `ArrowLeftRight` (có ở thanh bên, làm chunk chung mọi trang +95 B thô) sang `ArrowRightLeft`. Kết quả JS gzip
so bản mốc build riêng: `/seller` +2.576 B (trần 3 KB), `/seller/transactions` -3.742 B, `/seller/withdraw` -90.121 B;
trang khác lệch -44 đến +71 B, đã so chunk: không thêm mã (mục 4). CSS -12 B. Action khớp 28/28; `hydration`,
`consoleErrors`, `pageErrors` 0 ở mọi đường dẫn cả mốc lẫn sau; số `role` hai màn bằng mốc (0, 0, 0). Mức rủi ro: thấp.

UserGuide: "Chốt tại"; 3.2.1, 3.2.2 thêm "Bố cục"; dòng phân trang; dòng mã L-08, L-09, L-53, L-54, L-55 theo tệp mới
(cả Phụ lục C). task-status: `FE-UX-05` tách `FE-UX-05a` (xong), `FE-UX-05b` (planned).

### 0.2 Việc cần Owner quyết

- Đã quyết trong lúc làm (mục 8): tách hai tệp ngoài danh sách trắng để `/seller/withdraw` đạt trần; đổi biểu tượng
  sang `ArrowRightLeft`. Supervisor xem lại hai lệch này khi nghiệm thu.

---

## 1. Kiểm thử (requirements mục 5, phần dev)

### 1.1 Lệnh và kết quả

`FE-UX-05a` ở `inProgress` của `.kiro/task-status.json` khi chạy. Chạy khi cổng e2e trống (máy chủ mới), Postgres
bật, trên HEAD `c1a16ab` cộng checkpoint chưa commit.

```text
$ TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm
  => PASS có cảnh báo: luật kiến trúc          # PASS 20, FAIL 0, WARN 3 (như mốc)
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)
ĐẠT     FE-UX-05a, docs/CHECKPOINT_FEUX05A.md
  => PASS: LỚP 3 - KHUÔN CHECKPOINT
  => PASS: APP - TYPECHECK
  => PASS: APP - LINT
      Tests  1649 passed | 74 skipped (1723)   # mốc 1625 + 24 ca mới của fe-ux-05a.test.ts
  => PASS: APP - VITEST
  => PASS: APP - BUILD BẢN PHÁT HÀNH
FE-UX-05a role counts /seller: {"status":0,"note":0,"alert":0}
FE-UX-05a role counts /seller/transactions: {"status":0,"note":0,"alert":0}
      143 passed, 7 skipped (4.4m)            # project mock đầy đủ: 139 ca cũ + 4 ca mới
  => PASS: APP - E2E (PLAYWRIGHT)
  => PASS: EVM - BUILD BẢN HARDHAT
  => PASS: EVM - DỰNG CHUỖI MỚI
      26 passed, 2 skipped (44.1s)            # toàn bộ project Hardhat, có vault-withdraw, chain-scope
  => PASS: EVM - E2E PROJECT HARDHAT
  => ĐẠT các phần đã chạy: arch markers checkpoint app build e2e evm
EXIT=0
```

Log gửi kèm (không commit): `20261105_feux05a_run_local_all.log` (dòng khoá ký Hardhat #0 trong env máy chủ cục bộ đã
che) và riêng đoạn từ "EVM - E2E PROJECT HARDHAT" tới hết: `20261105_feux05a_evm_e2e.log`. Không chạy `contracts`.

Ngoài bộ trên: bước 3 (tasks) chạy `fix-04-noi-du-lieu-that`, `ops-transactions`, `vault-withdraw` trên bản build
riêng của commit dời `b746d6f` (máy chủ mới): 10 ca đạt. Bước 4, 7 chạy `fe-ux-05a-nguoi-ban`,
`fix-04-noi-du-lieu-that`, `ops-transactions`, `vault-withdraw`, `uiux-02-dau-man` trên bản build cuối: 21 ca đạt.

### 1.2 e2e mới `app/e2e/fe-ux-05a-nguoi-ban.spec.ts` (project mock, vai Người bán; không đổi dữ liệu)

Chờ tải như nhau ở mốc và sau: `networkidle`, rồi `/seller` hết chữ "Đang đọc số liệu"; `/seller/transactions` hết
`[data-loading]` và hết chữ "Đang tải…" khi đọc chữ của `main` đã bỏ các `select`.

| Ca | Kiểm | Mốc `11160f1` | Sau |
|---|---|---|---|
| 1 | `/seller` 1440 px: đếm `role` trước; một `h1` "Tổng quan"; `nav[aria-label="Lối tắt"]` 2 liên kết `/seller/transactions`, `/seller/withdraw`; `#token-scope` hiện; 4 `[data-kpi]` lệch đỉnh dưới 4 px, `data-tone` `hl`, `gold`, `default`, `default`; 5 `[data-metric]`; 390 px một cột; `role` bằng hằng số | đỏ (không có `[data-kpi]`) | xanh |
| 2 | `/seller/transactions` 1440 px: đếm `role` trước; một `h1` "Danh sách giao dịch"; 5 ô lọc cùng hàng; dòng phân trang không U+00B7; chọn Loại "Rút": ô Trạng thái đúng 10 lựa chọn ("Mọi trạng thái" rồi 9 nhãn theo `WITHDRAW_STATUSES`, chép cứng), không "Đang khớp", "Bị từ chối"; `role` bằng hằng số | đỏ (phân trang có chấm giữa) | xanh |
| 3 | Hai màn, 1440 và 390 px, ngữ cảnh mới: `main.scrollWidth <= main.clientWidth`; 0 lỗi console, `pageerror`, cảnh báo hydrate | xanh | xanh |
| 4 | Mở `/seller`, `/seller/transactions` (ngữ cảnh mới, chờ `networkidle` cộng 1 giây): mỗi màn đúng 1 action | xanh | xanh |

Hằng số `role` đo trên bản build mốc `11160f1` bằng chính ca 1, ca 2 trong lượt e2e mock đầy đủ trên máy chủ mới: cả hai
màn `{ status: 0, note: 0, alert: 0 }` (lượt đó 141 ca đạt, 2 ca đỏ đúng cột Mốc). Lượt sau cho đúng số đó.

### 1.3 Unit test mới `app/test/fe-ux-05a.test.ts` (môi trường `node`, 24 ca)

Nhóm 1 (mã nguồn): `use-seller-overview.ts` 1 `getSellerOverviewAction(`, 1 `useEffect(` và `seller-overview.tsx` 0, 0
(trên mốc hai số 1, 1 nằm ở `seller-overview.tsx`; tách hook ở mục 8); `seller-transactions.tsx` 1
`listSellerTransactionsAction(`, 1 `useEffect(` (mốc 1, 1); `seller-overview-body.tsx`, `format.ts`, `labels.ts` không
`Action(`, `useEffect(`, `useState(`; `seller-overview.tsx` đúng một `data-chain={chain}` và dòng export lại `nf`,
`describePolicy`, `useSellerOverview`; `seller-transactions.tsx` đúng một `disabled={page <= 1}`,
`disabled={!data || page >= pages}` (mốc 1, 1), nhập `nf` từ `@/components/seller/format`, export lại
`WITHDRAW_STATUS_LABELS`, không `const FIELD`; mọi dòng nhập từ `@/lib/bank/seller.service` ở `seller-overview-body.tsx`,
`format.ts`, `use-seller-overview.ts` bắt đầu bằng `import type`; `seller-overview-body.tsx` không `MockBadge`, không câu
"Hệ thống chưa có lệnh bán lại".

Nhóm 2 (`format.ts`): `nf(null)`, `nf(undefined)` là U+2013; `nf('1250')` là "1.250"; `nf('abc')` là "abc";
`describePolicy` với `null`, `UNSET`, `FIXED`, `PERCENT` ra đúng bốn câu chép từ mã mốc.

Nhóm 3 (`SellerOverviewBody`, dữ liệu giả đủ kiểu `SellerOverviewView`): đủ số thì 4 `[data-kpi]` `hl`, `gold`,
`default`, `default` theo đúng bốn nhãn, cha trực tiếp mỗi ô là `<div class="rounded-lg">`, 5 `[data-metric]` đúng thứ tự,
"Địa chỉ vault:", không `role="alert"`, ô "VNDB còn rút được", "Hạn mức còn rút được" có `tile-gold` (ô "Phần khoá"
không); `wallet.warning` thì đúng 2 `role="alert"` chứa câu; `tokens: []` thì "Chưa có dự án trên chuỗi này." đúng 2
lần; `paymentWallet: null` thì câu chưa có ví thanh toán; `today.sell` toàn 0 thì ô Số lượng bán giá trị "0", phụ
"0 lệnh"; `tradingOpen: false`, `recallPhase: 'FROZEN'` thì nhãn Trạng thái giao dịch là `Badge` sắc `warn`, chữ
"Tạm dừng (đã đóng băng)".

Nhóm 4: `WITHDRAW_STATUS_TONES` đúng các khoá của `WITHDRAW_STATUS_LABELS`; `COMPLETED` `ok`, `FAILED` `bad`, còn lại `warn`.

Tự gây lỗi 4 điểm Supervisor định thử, trên bản sao làm việc rồi hoàn lại:

| Lỗi gây ra | Kết quả |
|---|---|
| Bỏ `div.rounded-lg` bọc ô "Số lượng bán" | unit nhóm 3 ca đủ số đỏ (cha không phải `div.rounded-lg`); bản build riêng `.next-mut`, máy chủ mới: `fix-04-noi-du-lieu-that` "Tổng quan Người bán…" đỏ (`toContainText` không thấy phần tử) |
| Trong `SellerOverviewBody` bỏ câu cảnh báo ở thẻ Số dư ví | unit nhóm 3 ca `wallet.warning` đỏ (1 `role="alert"` thay vì 2) |
| `disabled={page <= 1}` thành `disabled={page < 1}` | unit nhóm 1 ca điều kiện khoá phân trang đỏ |
| Thêm một lời gọi `listSellerTransactionsAction(` vào trang | unit nhóm 1 ca `listSellerTransactionsAction(` đỏ (2 thay vì 1) |

## 2. Thay đổi

### 2.2 Màn (bố cục theo design mục 1)

| Khối | Đổi |
|---|---|
| `/seller` đầu màn | `header` `flex flex-wrap items-center justify-between gap-4`; `h1` `text-2xl font-semibold tracking-tight`; `nav` Lối tắt giữ hai liên kết, `prefetch={false}`, `buttonVariants`, `ArrowRight`; `TokenScopeSelect` hàng riêng giữ |
| `/seller` nhánh | Đang tải `EmptyState loading` "Đang đọc số liệu…"; lỗi `Alert bad` không `role`; có dữ liệu `<SellerOverviewBody data={data} />` |
| Token khớp lệnh trong ngày | `section`: `h2` `text-base font-medium` có `CardTitleIcon` `ArrowRightLeft` (mục 8); `grid gap-4 min-[640px]:grid-cols-2 min-[1100px]:grid-cols-4`; 4 `Kpi` (Số lượng mua `hl` `sub` "{n} lệnh", Tổng giá trị mua `gold`, Số lượng bán `default` `sub` "{n} lệnh", Tổng giá trị bán `default`), mỗi ô bọc `<div className="rounded-lg">` kèm chú thích lý do |
| `Box` | Thêm prop `icon` đặt `CardTitleIcon` trong `CardTitle` (giữ `role="heading" aria-level={2}`): Nguồn cung `Boxes`, Thông tin token `Wind`, Tồn kho `Package`, Tài sản trong ví thanh toán `Wallet`, Số dư ví `Landmark` |
| Lưới hai cột | `lg:grid-cols-2` thành `min-[1100px]:grid-cols-2`; `sm:grid-cols-2` thành `min-[640px]:grid-cols-2` |
| Nguồn cung | Giữ `dl`, `dt`, định nghĩa, `dd data-metric`; `divide-y divide-border`, dòng `py-3`, số canh phải |
| Thông tin token | 9 cặp `dt`, `dd` đúng thứ tự, mỗi cặp bọc dòng kẻ ngăn; Trạng thái token `Badge variant="info"`; Trạng thái giao dịch `Badge` `ok` khi `token.tradingOpen`, `warn` khi không |
| `Stat` | `rounded-[14px] bg-muted/60 p-3.5`, bỏ viền; prop `highlight` (ô "VNDB còn rút được", "Hạn mức còn rút được") dùng `relative isolate overflow-hidden tile-gold` |
| Cảnh báo | Hai câu `wallet.warning` thành `Alert bad role="alert"` |
| `/seller/transactions` | `h1` lớp mới; `form role="search"` `grid gap-3 min-[640px]:grid-cols-2 min-[1100px]:grid-cols-5`; 5 ô `fieldClass`, ô tìm bọc `div relative` có `Search` `aria-hidden` `pointer-events-none`, ô `pl-10`; `FIELD` xoá; đang tải `EmptyState loading`, lỗi `Alert bad`, rỗng `EmptyState`; nhãn trạng thái `Badge variant` theo `WITHDRAW_STATUS_TONES` hoặc `orderStatusTone` |

### 2.3 Đoạn đổi gần hook, effect, handler, điều kiện khoá (QĐ-1, QĐ-2)

Không đổi ký tự: `useSellerOverview` (state, effect, mảng phụ thuộc, `cancelled`, `fresh`, `reload`; dời nguyên văn sang
tệp riêng ở `16f4c5e`), `SellerTransactionsPage` (state `filters`, `page`, `loaded`; `query`, `key`, effect, `fresh`,
`pages`, `set`; `statusOptions`; `STATUS_LABELS`, `STEP_LABELS`, `WITHDRAW_STATUS_LABELS` (dời nguyên văn, export lại),
`TYPE_LABELS`). Các đoạn có đụng:

- `/seller`: chuỗi nhánh `loading`, `error || !data`, có dữ liệu giữ điều kiện và thứ tự; đổi phần tử. `data-chain={chain}`
  giữ ở phần tử gốc.
- `SellerOverviewBody`: `token ? … : …`, `wallet?.paymentWallet &&`, `wallet?.warning &&` (hai chỗ),
  `wallet?.paymentWallet === null &&`, `tradingFeePercent === 0` giữ ký tự; thêm biểu thức sắc
  `token.tradingOpen ? 'ok' : 'warn'` (chỉ chọn sắc, cùng điều kiện với `tradingStatusLabel`).
- `/seller/transactions`: chuỗi `fresh === null`, `fresh.error`, `data && data.rows.length === 0`, `data &&` giữ; đổi phần
  tử. Hai `disabled` phân trang giữ ký tự (unit nhóm 1). `row.type === 'WITHDRAW' ? … : …` của nhãn giữ, thêm cùng
  điều kiện cho sắc.
- `nf`: nhánh rỗng trả U+2013 thay U+2014 (QĐ-7, chủ ý).

### 2.4 Mốc test QĐ-8

Không sửa tệp test có sẵn. `fix-04-noi-du-lieu-that` (e2e, unit), `vault-withdraw` (mock trong lượt liên quan, Hardhat
trong 1.1), `uiux-02-dau-man` (e2e, unit), `seller-channel.test.ts`, `chain-scope.spec.ts` (Hardhat, trong 1.1) đạt.
`fix-04-noi-du-lieu-that.test.ts:263-287` vẫn đọc `seller-overview.tsx` (không `MockBadge`, không câu cũ); unit nhóm 1
lặp phép kiểm đó cho `seller-overview-body.tsx`. Không heading mới chứa chữ "Tổng quan" (`chain-scope.spec.ts:36`); không
thêm `data-chain`.

### 2.5 Mã dư thừa

Đã xoá: `FIELD`; `Loader2` ở hai trang (đang tải thành `EmptyState`); lớp `*-destructive`; `lg:col-span-1` vô tác dụng
của ô tìm; import `Card`, `Table`, `tradingStatusLabel`, `ProjectStatus`, `SellerWithdrawPolicy`, `useEffect`,
`useState`, `getSellerOverviewAction` ở `seller-overview.tsx` (hết chỗ dùng sau khi dời). Lint đạt, không import thừa.

## 3. Dời nguyên văn

Đoạn trước và sau dán đủ ở `docs/CHECKPOINT_FEUX05A_DETAIL.md`.

- **Dời 1** (`b746d6f`, QĐ-4): `nf`, `describePolicy` (`seller-overview.tsx:23-42`) sang `components/seller/format.ts`,
  `diff` rỗng; `TOKEN_STATUS_LABELS`, `SUPPLY_METRICS` cùng chú thích, `Stat`, `Box`, hai dòng `token`, `wallet`, khối
  `<>…</>` (`:79-124`, `:152-281`) sang `SellerOverviewBody`: 164 dòng mỗi bên sau khi bỏ khoảng trắng đầu dòng, dòng
  trống và vỏ hàm, chỉ khác `data?.tokens[0]` thành `data.tokens[0]`, `data?.wallet` thành `data.wallet`. Trang export
  lại `nf`, `describePolicy`; `seller-transactions.tsx` nhập `nf` từ `format.ts`. Commit này chưa đổi kiểu; e2e bước 3
  trên bản build riêng của commit này đạt 10 ca.
- **Dời 2** (`16f4c5e`, QĐ-9, Sếp duyệt): `useSellerOverview` (34 dòng) sang `components/seller/use-seller-overview.ts`,
  `WITHDRAW_STATUS_LABELS` (12 dòng) sang `components/seller/labels.ts`, nguyên văn (đoạn trước nằm nguyên trong tệp
  mới); hai trang export lại tên cũ; `seller-withdraw.tsx` đổi hai dòng nhập thành ba dòng nhập từ `components/seller/`.

## 4. Đo trước và sau

Cùng máy, cùng quy trình (script ngoài repo): máy chủ mới cổng 3300 (đủ `webServer.env`), tạo dữ liệu bằng
`maker-checker`, `ops-transactions`, `permit-order`, `recall` (gồm `ops-transactions` như tasks bước 2); đo bằng
`tools/20261104_do_moc_measure.js` (sha256 `6079a0d6…` khớp spec) với
`JS_PAGES=/,/portfolio,/trade,/approvals,/seller,/seller/transactions,/seller/withdraw`; 28 dòng mỗi lượt, không dòng
`khong tim thay lien ket` (đủ `/transactions/[id]`, `/approvals/[id]`, `/orders/[id]`). Tiến trình đo khác tiến trình
chụp ảnh. JS theo byte: script riêng cộng gzip mọi script khi mở trang, máy chủ mới cổng 3500 sau `ops-transactions`.

| Mục | Mốc `11160f1` | Sau `862ffa5` | Trần |
|---|---|---|---|
| Số action khi mở màn | 28 đường dẫn; `/seller` 1, `/seller/transactions` 1, `/seller/withdraw` 2 | Khớp 28/28 | không đổi |
| `hydration`, `consoleErrors`, `pageErrors` | 0 ở cả 28 đường dẫn | 0 ở cả 28 đường dẫn | hai màn 0, khác không tăng |
| JS gzip (công cụ) `/seller`; `/seller/transactions`; `/seller/withdraw` | 454,6; 540,4; 553,8 KB | 457,1; 536,8; 465,8 KB | |
| JS gzip (công cụ) `/`; `/portfolio`; `/trade`; `/approvals` | 558,3; 456,9; 480,0; 455,2 KB | 558,3; 456,9; 480,0; 455,2 KB | không tăng |
| CSS gzip (`.next/static/chunks/*.css`, 1 tệp, gzip mức 9) | 19.458 B | 19.446 B (-12 B) | +2 KB |
| `role` trong `main` (ca 1, ca 2) | 0, 0, 0 cả hai màn | giống hệt | bằng mốc |

JS gzip theo byte. Bản mốc của lượt e2e đầy đủ build đúng mã `11160f1`; bản mốc build riêng build lại `11160f1` sau bản
cuối, cùng phiên (`NEXT_DIST_DIR=.next-moc`, gỡ tạm `components/seller/` khi build, đã xoá thư mục):

| Trang | Mốc (lượt e2e) | Mốc build riêng | Sau `862ffa5` | Chênh so build riêng | Trần |
|---|---|---|---|---|---|
| `/portfolio` | 467827 | 467827 | 467824 | -3 | không tăng |
| `/tokens/WPT` | 463067 | 463069 | 463029 | -40 | không tăng |
| `/trade` | 491559 | 491559 | 491515 | -44 | không tăng |
| `/orders` | 549407 | 549404 | 549475 | +71 | không tăng |
| `/orders/[id]` | 463379 | 463377 | 463365 | -12 | không tăng |
| `/withdraw` | 485787 | 485786 | 485768 | -18 | không tăng |
| `/` | 571662 | 571659 | 571656 | -3 | không tăng |
| `/approvals` | 466097 | 466094 | 466112 | +18 | không tăng |
| `/distribution` | 479562 | 479561 | 479620 | +59 | không tăng |
| `/vault` | 469579 | 469576 | 469567 | -9 | không tăng |
| `/wallet` | 466924 | 466922 | 466913 | -9 | không tăng |
| `/seller` | 465537 | 465535 | 468111 | +2576 | +3.072 |
| `/seller/transactions` | 553411 | 553408 | 549666 | -3742 | +3.072 |
| `/seller/withdraw` | 567077 | 567075 | 476954 | -90121 | +1.024 |

Đã lưu và so từng chunk giữa bản mốc build riêng và bản sau cho các trang tăng:

- `/distribution` (+59), `/portfolio` (-3): cùng số tệp, tổng kích thước thô bằng nhau; lệch gzip là nhiễu nén.
- `/orders` (+71): chunk khác 21.536 B thành 21.540 B thô; khác ở thứ tự module (hai module `loader-circle`,
  `shield-alert` đổi chỗ), mã module, mã tham chiếu server action; không thêm mã.
- `/approvals` (+18): chunk khác 29.637 B thành 29.634 B thô; chỉ đổi thứ tự module.
- Lượt đo đầu (trước khi đổi biểu tượng) mọi trang có chunk chung 178.700 B thành 178.795 B: `ArrowLeftRight` (có ở
  thanh bên) thành module dùng chung khi `SellerOverviewBody` dùng lại. Đổi sang `ArrowRightLeft` (`862ffa5`) thì chunk
  chung về 178.700 B.
- `/seller/withdraw` lượt đo đầu +2.811 B; đổi một dòng nhập như QĐ-9 cho phép (thử trên bản build riêng, đã hoàn
  nguyên) còn +2.771 B; sau dời 2: -90.121 B (màn rút không còn kéo trang Tổng quan và Danh sách giao dịch vào chunk).

CSS mốc lấy từ bản build mốc sạch (19.458 B). Bản mốc build riêng cho 19.497 B vì build lúc `.next-moc` nằm trong `app/`;
không dùng số đó.

## 5. Ảnh (gửi kèm, không commit)

- Hai màn vai Người bán, 1440 và 390, Sáng và Tối, trước (`moc/anh/`) và sau (`sau/anh/`). Mỗi lượt một tiến trình mock
  MỚI cổng 3400: `npx next start --port 3400` với đủ biến của `webServer.env` (`NEXT_PUBLIC_DEFAULT_CHAIN`,
  `USE_MOCK_KYC`, `USE_MOCK_DB`, `DEMO_ROLE`, `ENABLE_DEMO_TOKEN_MINT`, `ENABLE_DEMO_PAYMENT_MINT`,
  `ENABLE_INVESTOR_SELL`, khoá ký mẫu Hardhat, `RPC_HARDHAT`); `E2E_BASE_URL=… npx playwright test e2e/ops-transactions.spec.ts
  e2e/vault-withdraw.spec.ts` (6 ca đạt: có lệnh mua, bán, rút); chụp `/seller`, `/seller/transactions`; tắt. Mốc (bản
  build `11160f1`): bật 04:04:55Z, tắt 04:05:38Z. Sau (bản build `862ffa5`): bật 04:51:59Z, tắt 04:52:46Z (05/11/2026,
  UTC). `main` không tràn ngang, 0 lỗi console ở cả 8 ảnh mỗi lượt.
- 28 đường dẫn của script đo, trước (`moc/do/`) và sau (`sau/do/`), 1440 và 390, Sáng và Tối.
- Trạng thái không dựng được trên mock (6 trạng thái): đủ số; cảnh báo đối soát ở hai thẻ ví; chưa có dự án; chưa có ví
  thanh toán; giao dịch tạm dừng (`FROZEN`); không lệnh trong ngày. HTML dựng `SellerOverviewBody` bằng
  `renderToStaticMarkup` (test tạm, xoá ngay, không commit), CSS bản build tương ứng, `page.setContent`, Sáng và Tối, 1440
  (khung 1200 px) và 390 (`anh_tinh_moc/`, `anh_tinh_sau/`). Trước dùng mã `b746d6f` (đúng mã `11160f1` sau khi dời) và
  CSS bản mốc; sau dùng mã cuối và CSS bản sau.
- Kiểm đọc được (Sáng và Tối): ô `Kpi` `hl` chữ sáng trên nền xanh, `gold` chữ tối trên nền vàng nhạt; ô `tile-gold` còn
  rút được; nhãn Badge trạng thái; khối cảnh báo đỏ.

## 6. Lệnh kiểm (tasks bước 6, `LC_ALL=C`)

```text
6a $ git diff --name-only --diff-filter=d ... | grep -vE '^(...danh sách trắng tasks.md...)$'
app/src/components/pages/seller-withdraw.tsx
app/src/components/seller/labels.ts
app/src/components/seller/use-seller-overview.ts
   $ (thêm ba tệp trên vào danh sách)                                                   # rỗng
   $ git diff --name-only --diff-filter=D origin/release/ui-v2...HEAD                     # rỗng
6b $ rg -n '...màu cứng...|-destructive\b' <hai trang> app/src/components/seller/        # rỗng
6c $ comm -13 /tmp/feux05a-del.txt /tmp/feux05a-add.txt | rg -n '...ký tự cấm...'        # rỗng
6d $ comm -23 <(ext /tmp/feux05a-del.txt) <(ext /tmp/feux05a-add.txt)
Không rút qua kênh này <gạch dài> lệnh rút chỉ áp cho VNDB.
giao dịch <chấm giữa> trang $
6e $ rg -n '...ký tự cấm...' <hai trang> app/src/components/seller/ <test> <e2e> | rg -v '<dòng chú thích>'   # rỗng
```

("<gạch dài>", "<chấm giữa>" thay cho U+2014, U+00B7 lệnh in ra.) Chạy trên HEAD `c1a16ab`. 6a: `seller-withdraw.tsx`
được QĐ-9 cho thêm vào 6a; `labels.ts`, `use-seller-overview.ts` là hai tệp Owner duyệt (mục 8). 6d đúng hai dòng QĐ-7:
câu gợi ý `seller-overview.tsx:249` (nay ở `seller-overview-body.tsx`, gạch dài thành dấu phẩy) và dòng phân trang
`seller-transactions.tsx:214` (chấm giữa thành dấu phẩy; `$` cuối vì `${…}` tách chuỗi). `nf` đổi U+2014 thành U+2013
nằm trong dấu nháy đơn nên `ext` không bắt. `docs/tech-report.md` không đổi (không marker trong các tệp đã sửa).

## 7. Đối chiếu notes

Cột "Kết quả": **Làm** (đúng bản chốt), **Giữ** (màn thật đã như vậy hoặc chỉ giữ chữ), **Không làm** (kèm lý do).

### 7.1 `notes/seller.md`

| Dòng notes | Kết quả |
|---|---|
| Tiêu đề "Tổng quan" và câu mô tả, chain đang xem | Làm tiêu đề; không câu mô tả (requirements mục 1, test cấm câu phụ); chain đọc từ ô Chain của thanh bên như cũ |
| Nút "Danh sách giao dịch" (viền), "Tạo lệnh rút" (chính) trong `nav` Lối tắt | Giữ; cùng hàng tiêu đề, căn giữa dọc |
| Nhóm "Token khớp lệnh trong ngày" thành tiêu đề nhóm + 4 ô KPI | Làm: `section` `h2` + 4 `Kpi`; biểu tượng `ArrowRightLeft` (mục 8) |
| Ô xanh Số lượng mua, ô vàng Tổng giá trị mua | Làm: `hl`, `gold`; không ảnh tua-bin nền ô (requirements mục 1) |
| Ô Số lượng bán, Tổng giá trị bán "–" + "Hệ thống chưa có lệnh bán lại." | Không làm: notes đã cũ, FIX-04 đã đổi hai ô thành số (`today.sell`); giữ số, ô `default` |
| Thẻ Thông tin nguồn cung 5 dòng có định nghĩa, biểu tượng tròn đầu dòng | Làm danh sách kẻ ngăn; không biểu tượng đầu dòng (requirements mục 1) |
| Thẻ Thông tin token 9 trường, hai trạng thái dạng badge | Làm: dòng kẻ ngăn, `Badge` `info` và `ok`/`warn` |
| Thẻ Tồn kho token | Giữ bảng; thêm `CardTitleIcon` `Package` |
| Thẻ Tài sản trong ví thanh toán, ô "còn rút được" tô vàng, câu hint | Làm: ô nền nhạt, ô `tile-gold`; câu hint dấu phẩy (QĐ-7) |
| Dòng "Địa chỉ vault:" | Giữ `font-code break-all` |
| Thẻ Số dư ví, câu luật khoá | Làm ô nền nhạt, "Hạn mức còn rút được" `tile-gold`; câu luật khoá giữ chữ nhỏ, không biểu tượng (trần JS) |
| Thẻ "Các trạng thái khác của màn": Cảnh báo đối soát | Không làm thẻ xem thử; cảnh báo thật là `Alert bad role="alert"` ở hai thẻ ví (unit nhóm 3, ảnh tĩnh) |
| tab Chưa có ví thanh toán, Chưa có dự án, Luật khoá khác, Trạng thái giao dịch | Không làm thẻ xem thử; trạng thái kiểm bằng unit nhóm 2, 3 và ảnh tĩnh |
| tab Đang tải, lỗi | Làm: `EmptyState loading`; `Alert bad` không `role` |
| Thay đổi trình bày: các trạng thái phụ gom vào một thẻ tab | Không làm: không phải khối màn thật |
| Lệch: hai ô bán cứng | Đã hết từ FIX-04 (màn mốc đã hiện số) |
| Lệch: hai thẻ ví lặp ba trường, cảnh báo hai lần | Giữ (requirements mục 1, QĐ-5 giữ cảnh báo ở cả hai thẻ) |
| Lệch: `nf(null)` gạch dài, câu hint gạch dài | Làm (QĐ-7): U+2013, dấu phẩy |

### 7.2 `notes/seller-transactions.md`

| Dòng notes | Kết quả |
|---|---|
| Tiêu đề và câu mô tả | Làm tiêu đề; không câu mô tả |
| Ô tìm có biểu tượng kính lúp, không nhãn hiện | Làm: `Search` trang trí trong khung ô; giữ `aria-label`, `placeholder` |
| Dropdown Loại, Trạng thái (đổi theo Loại), Từ ngày, Đến ngày | Giữ `statusOptions`, `set`, quy tắc bỏ trạng thái; ca 2 khoá danh sách loại Rút |
| Bảng 9 cột | Giữ cột, `key`, `data-type`, `title`, chữ |
| Badge tô màu theo nhóm trạng thái | Làm: `orderStatusTone`, `WITHDRAW_STATUS_TONES` |
| Giờ và ngày tách hai dòng; Loại có biểu tượng | Không làm: đổi cách hiện chữ (requirements mục 1, không đổi chữ) |
| Trạng thái rỗng | Làm: `EmptyState` |
| Dòng phân trang, hai nút | Làm: chữ trái, nút phải; chấm giữa thành dấu phẩy (QĐ-7) |
| Trên điện thoại bảng thành thẻ | Không làm: giữ bảng cuộn ngang (design mục 1) |
| Thẻ "Các trạng thái khác của màn" | Không làm thẻ xem thử; đang tải `EmptyState loading`, lỗi `Alert bad` |
| Lệch: cột Bước hiện tại chứa Mục đích; ô tìm khớp cả txHash; múi giờ; hai nhãn "Đang đặt ví nhận" trùng | Không làm: logic hoặc chữ (requirements mục 1); ca 2 khoá đúng hai nhãn trùng |
| Lệch: chấm giữa | Làm (QĐ-7) |

## 8. Nợ và DEVIATION

- **Trần JS `/seller/withdraw` (QĐ-9), Owner duyệt.** Sau khi đổi kiểu, màn rút +2.811 B (trần 1 KB) vì nhập
  `useSellerOverview` từ `seller-overview.tsx` và `WITHDRAW_STATUS_LABELS` từ `seller-transactions.tsx`, kéo cả hai trang
  (gồm `SellerOverviewBody`, `Kpi`, `EmptyState`, `fieldClass`…) vào chunk. Đổi đúng một dòng nhập như QĐ-9 cho phép chỉ
  bớt 40 B. Em dừng và báo; Owner chọn tách nguyên văn hai thứ đó sang `components/seller/use-seller-overview.ts`,
  `components/seller/labels.ts` (ngoài danh sách trắng), hai trang export lại tên cũ, `seller-withdraw.tsx` chỉ đổi các
  dòng nhập (`16f4c5e`). Hệ quả: số lời gọi `getSellerOverviewAction(`, `useEffect(` của QĐ-2 nay nằm ở tệp hook (unit
  nhóm 1 đếm ở đó và đòi `seller-overview.tsx` là 0); 6a in ba tệp.
- **Biểu tượng nhóm "Token khớp lệnh trong ngày", Owner duyệt.** QĐ-5 ghi `ArrowLeftRight`; biểu tượng này có ở thanh
  bên, dùng lại làm chunk chung mọi trang +95 B thô (lượt đo đầu `/portfolio` +69, `/approvals` +52 B gzip). Đổi sang
  `ArrowRightLeft` cùng nghĩa (`862ffa5`), như FE-UX-04b đổi `ShoppingCart`.
- **Lượt đo bản sau chạy hai lần:** lượt đầu (HEAD `7414967`) cho ra hai vấn đề trên; số trong mục 4, 5 là lượt hai
  (HEAD `862ffa5`) trên tiến trình mới. Lượt đầu giữ ở `sau_lan1/` (gửi kèm, không dùng số nào).
- **Chưa làm theo requirements mục 1 "Không làm":** câu phụ dưới tiêu đề; biểu tượng đầu dòng nguồn cung và trong ô số
  liệu; ảnh tua-bin nền ô; hiệu ứng (FE-UX-08); `/seller/withdraw` (05b, chỉ đổi dòng nhập).

## 9. Tự đánh giá 3 luật kiến trúc

- [x] Mọi call chain qua ILedgerPort: không đổi mã gọi chuỗi.
- [x] Mọi ký qua ISigner: không đổi.
- [x] Mọi kiểm quyền qua RBAC: không đổi.
