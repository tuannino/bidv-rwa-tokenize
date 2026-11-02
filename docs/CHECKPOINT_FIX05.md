# Báo cáo bàn giao: FIX-05 Màn Tổng quan dùng dữ liệu thật; ghi chú dữ liệu mẫu ở 3 màn vận hành

| | |
|---|---|
| Mã task | FIX-05 |
| Phạm vi | Backend chỉ đọc (B1 tới B3) và frontend. Không ghi dữ liệu, không đổi lược đồ, không thêm quyền |
| Nhánh | `fix/fix-05-tong-quan`, tạo từ `dev` (`4d2f9e3`, sau merge FIX-04) |
| Spec | `docs/fix-05-tong-quan/{requirements,design,tasks}.md` (chép nguyên) |
| Commit | mã `07b5255`, sửa luật kiến trúc `16d60ad`; tài liệu `1ccd0b4` (bản nháp) và commit tài liệu cuối trên nhánh |
| Tiến độ | Xong. Chờ Owner merge; Claude Code **không** merge vào `dev` |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 9) | | Bằng chứng |
|---|---|---|---|
| 1 | B1 tới B3 đúng mục 3; F1 tới F3 đúng mục 4; `lib/indexer`, `lib/ledger`, `lib/store`, `lib/rbac` không đổi | ✅ | mục 5; một chỗ khác design (mục 8.1) |
| 2 | Số lời gọi khi mở `/` bằng `dev` cộng 1; `/assets`, `/kyc`, `/reconciliation` không đổi | ✅ | mục 3.2 |
| 3 | Thời gian trả lời action; không quá 1 giây | ✅ | mục 3.1 (9,15 ms) |
| 4 | `git diff --name-only` chỉ có tệp mục 5 spec; lệnh kiểm tệp cấm rỗng | ✅ | mục 6 |
| 5 | Lệnh mức B xanh; test FIX-04 vẫn xanh; 10 đột biến bị bắt | ✅ | mục 1, 4 |
| 6 | Ảnh `/` (Sáng, Tối), `/assets`, `/kyc`, `/reconciliation` (Sáng) | ✅ | mục 7 |
| 7 | Không ký tự cấm trong chữ mới thêm | ✅ | mục 6 |

**Kết luận:** 7 ✅, 0 🔶, 0 ❌. Màn Tổng quan đọc thật theo chain đang chọn qua một action chỉ đọc (`assertCan`, không ghi
sổ kiểm toán); mỗi nguồn lỗi thì đúng ô đó "Chưa đọc được". Sản lượng và token TCC giữ số mẫu kèm "unverified". Ba màn
vận hành chỉ thêm ghi chú "(đang hiển thị dữ liệu mẫu)" sau tiêu đề. Mức rủi ro: thấp.

UserGuide: đã cập nhật Phần 2 (`/`, `/kyc`, `/assets`, `/reconciliation`); Phần 3 quy ước chung (ý nghĩa "(đang hiển
thị dữ liệu mẫu)"), mục 3.4.1 (viết lại: 5 thẻ số liệu theo QĐ-4), 3.6.1, 3.6.2, 3.6.4; Phụ lục C (bỏ L-70); "Chốt
tại"; Lịch sử.

### 0.2 Việc cần Owner quyết

- **Lọc hồ sơ Nhà đầu tư (mục 8.1):** bản design so `findCustomerProfile(...)?.role === 'INVESTOR'`, bị luật kiến trúc 3
  (`scripts/verify-arch-rules.sh`: không so vai cứng ngoài `lib/rbac`) báo FAIL; spec không cho sửa `lib/rbac`. Đã đổi
  thành `can(profile.role, 'portfolio:read')` (quyền này CHỈ vai Nhà đầu tư có, `permissions.ts` ghi rõ), kết quả đếm
  không đổi. Supervisor xác nhận cách này hoặc chọn cách khác.

---

## 1. Kiểm thử

### 1.1 Vitest mới `app/test/fix-05-tong-quan.test.ts`

```text
$ (cd app && npx vitest --run test/fix-05-tong-quan.test.ts)
      Tests  6 passed | 1 skipped (7)            # ca 3b bỏ qua khi thiếu TEST_DATABASE_URL
$ (cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa npx vitest --run test/fix-05-tong-quan.test.ts -t 3b)
      Tests  1 passed | 6 skipped (7)
```

| Ca | Nội dung đã kiểm |
|---|---|
| 1 | Giao dịch viên, mock bộ nhớ: dự án mẫu `markIssued`; gắn 2 ví `NDT001`, 1 ví `NB001`, 1 ví `NDT999`; 7 kỳ `COMPLETED` (1.000 tới 7.000) và 1 kỳ `OPEN`, cách nhau 1 giây bằng đồng hồ giả: `issuedProjects` 1; `supply` bằng `tokenInfo()`; `investors` `{ count: 1, truncated: false }`; `profit.totalAmount` 28.000, `periods` 7; `series` đúng 6 kỳ mới nhất, kỳ cũ trước, không có kỳ `OPEN` |
| 2 | Từng nguồn ném lỗi (spy `listProjects`, `getLedger` trả ledger có `tokenInfo` ném, `list`, `listPeriods`), lỗi chứa `https://rpc.example/KEY123`: vẫn `ok`, đúng trường đó `null`, ba trường khác bằng lần đọc chuẩn; không tham số `console.error` nào chứa `KEY123` |
| 3 | Giao dịch viên, Kiểm soát viên đọc được; Nhà đầu tư, Người bán `FORBIDDEN`; chain sai `VALIDATION`; số dòng sổ kiểm toán trước và sau bằng nhau |
| 3b | Postgres thật (database riêng `bidv_fix05_<pid>`): 1 dự án `ISSUED`, 2 kỳ `COMPLETED`, 1 kỳ `OPEN`, 2 ví `NDT001`: `issuedProjects` 1, `periods` 2, `investors.count` 1 |
| 4 | `list` trả đủ 200 ví thì `investors.truncated` true; `listPeriods` trả đủ 100 kỳ thì `profit.truncated` true |
| 5 | `portfolio.service.ts`, `overview.service.ts` import `readOrNull` từ `./read-or-null`, không còn `function orNull` |
| 6 | `dashboard.tsx` có `getOpsOverviewAction`, không còn `MOCK_PROJECTS`, `whitelistedInvestors`, `wptIssued`, `profitDistributedVndBn`, `distributionPeriods`, có 3 lần `<UnverifiedNote`; ba màn có `<SampleDataNote />`, khối `<h1>...</h1>` không chứa `SampleDataNote` |

Test FIX-04 (`fix-04-noi-du-lieu-that.test.ts`, gồm ca 2, 4, 8) vẫn 11/11 xanh sau B3. Không test cũ nào phải đổi (grep chữ
cũ của màn Tổng quan trong `app/e2e`, `app/test`: không có).

### 1.2 Kiểm chứng mức B (tasks bước 6, chạy lại sau commit `16d60ad`)

```text
$ (cd app && npm run typecheck && npm run lint && npx vitest --run)
  1 problem (0 errors, 1 warning)                     # có từ trước: test/helpers/fake-fireblocks.ts:86 (IN-04)
      Tests  1367 passed | 102 skipped (1469)
$ (cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa npx vitest --run)
      Tests  1478 passed | 74 skipped (1552)
$ bash scripts/run-local-all.sh arch markers build    # checkpoint kiểm riêng bằng check-checkpoint.mjs
  PASS: 20   FAIL: 0   WARN: 3                        # 3 cảnh báo có từ trước
  => ĐẠT các phần đã chạy: arch markers build
$ (cd app && npx playwright test e2e/fix-05-tong-quan.spec.ts e2e/uiux-02-dau-man.spec.ts e2e/fix-04-noi-du-lieu-that.spec.ts)
  13 passed (30.5s)
```

Lần chạy đầu (trước `16d60ad`) luật kiến trúc 3 FAIL ở `overview.service.ts:61`; xem mục 8.1.

## 2. E2E mới `app/e2e/fix-05-tong-quan.spec.ts` (chain mock, bản build)

| Bài | Nội dung |
|---|---|
| Tổng quan | Giao dịch viên mở `/`: đúng 1 lời gọi; `h1` "Tổng quan"; đủ 5 nhãn thẻ; có "unverified"; không còn "whitelisted"; ô "Dự án đang triển khai" là số |
| Ba màn vận hành | `/assets`, `/kyc`, `/reconciliation`: 0 lời gọi; `h1` khớp chính xác chữ cũ; thấy "(đang hiển thị dữ liệu mẫu)" |

## 3. Đo

### 3.1 Thời gian trả lời `getOpsOverviewAction` (hardhat cục bộ, sau `evm-local.sh reset`)

Gọi thẳng action trong tệp vitest tạm (không commit), store bộ nhớ, vai Giao dịch viên; 2 lần làm nóng, 10 lần đo:
trung vị **9,15 ms** (5,8 tới 16,8 ms). Dưới xa ngưỡng 1 giây.

### 3.2 Số server action khi mở (mock, `next start`, đếm header `next-action`)

| Màn | Vai | Trước (`dev` @ `4d2f9e3`) | Sau |
|---|---|---|---|
| `/` | Giao dịch viên, Kiểm soát viên | 0, 0 | 1, 1 (QĐ-2, đã duyệt) |
| `/assets` | Giao dịch viên | 0 | 0 |
| `/kyc` | Giao dịch viên | 0 | 0 |
| `/reconciliation` | Giao dịch viên | 0 | 0 |

## 4. Đột biến (10/10 bị bắt)

| # | Đột biến | Ca đỏ |
|---|---|---|
| 1 | Đếm cả hồ sơ Người bán (bỏ điều kiện `can(..., 'portfolio:read')`) | vitest 1 |
| 2 | Đếm ví thay vì hồ sơ | vitest 1, 4 |
| 3 | Bỏ bộ lọc `COMPLETED` | vitest 1 |
| 4 | `series` kỳ mới trước (bỏ `reverse`) | vitest 1 |
| 5 | `tokenInfo` không bọc `readOrNull` | vitest 2 |
| 6 | `readOrNull` ghi `error.message` | vitest 2 |
| 7 | Quyền đổi thành `balance:read` | vitest 3 |
| 8 | `dashboard.tsx` dùng lại `MOCK_WIND_STATS.wptIssued` | vitest 6 |
| 9 | `<SampleDataNote />` vào trong `h1` ở `kyc.tsx` | vitest 6; e2e "Ba màn vận hành" |
| 10 | `assertCan` đổi thành `authorize` | vitest 3 (có dòng sổ kiểm toán mới) |

Đột biến 1, 2 chạy lại sau `16d60ad` (dòng lọc mới); 8 cái còn lại chạy trên `07b5255`, phần đột biến không đổi.

## 5. Yêu cầu và nơi làm

- **B1** `lib/bank/overview.service.ts` (mới): `getOpsOverview` theo design mục 1; khác ở mục 8.1.
- **B2** `app/actions/overview.ts` (mới): `getOpsOverviewAction`, vỏ mỏng.
- **B3** `lib/bank/read-or-null.ts` (mới); `portfolio.service.ts` bỏ `orNull`, gọi `readOrNull('portfolio', ...)`; câu log giữ
  `[portfolio] Không đọc được ...`.
- **F1** `dashboard.tsx` viết lại: một lời gọi theo chain (khoá chain, bắt reject, bỏ kết quả chain cũ); 5 thẻ (lưới
  `sm:grid-cols-2 xl:grid-cols-5`); thẻ tổng cung có hai thanh WPT và TCC ("–", "unverified"); khung "Sản lượng và lợi tức
  theo kỳ" hai biểu đồ ("Lợi tức theo kỳ" `BarChart` thật, "Sản lượng theo tháng" `AreaChart` mẫu kèm "unverified"). Bỏ
  ô nhà đầu tư whitelisted, phân bổ WPT theo dự án, ba thẻ dự án mẫu, chữ "EnergyOracle", "ProfitDistributor".
- **F2** `components/ui/sample-data-note.tsx` (mới, chép design mục 3).
- **F3** `assets.tsx`, `kyc.tsx`, `reconciliation.tsx`: `div` bọc tiêu đề thành `flex flex-wrap items-baseline gap-2`,
  `<SampleDataNote />` ngay sau `HoverHint` (ngoài `h1`).

## 6. Quét

```text
$ git diff --name-only dev... | grep -E '^app/src/lib/' | grep -vE '^app/src/lib/bank/(overview\.service|read-or-null|portfolio\.service)\.ts$' || true
(rỗng)
$ git diff --name-only dev... | grep -E '^app/src/app/actions/' | grep -vE '^app/src/app/actions/overview\.ts$' || true
(rỗng)
$ git diff --name-only dev... | grep -E '^app/src/app/api/|^app/prisma/|^packages/|^scripts/|wrangler\.json|\.env' || true
(rỗng)
$ git diff dev... -- . ':!docs/fix-05-tong-quan' | python3 -c ...     # lệnh quét ký tự cấm ở tasks bước 6
(rỗng)
```

## 7. Ảnh (`docs/screenshots/fix-05/`, mock, Giao dịch viên, 1440 px)

- `20261102_tong_quan_sang.png`, `20261102_tong_quan_toi.png`: chain mock mới dựng nên bốn số thật đều 0 (dự án mẫu còn
  `DRAFT`, chưa phát hành, chưa có kỳ chia); "Chưa có kỳ chia nào hoàn tất."; sản lượng mẫu kèm "unverified".
- `20261102_du_an_dien_gio_sang.png`, `20261102_nha_dau_tu_kyc_sang.png`, `20261102_doi_soat_doanh_thu_sang.png`.

## 8. Chỗ làm khác chữ spec hoặc spec để ngỏ

1. **Lọc hồ sơ Nhà đầu tư** (xem mục 0.2): `can(profile.role, 'portfolio:read')` thay `?.role === 'INVESTOR'` để qua luật
   kiến trúc 3; cùng kết quả đếm.
2. **Thẻ "Lợi tức đã chia"** khi chưa đọc xong hoặc đọc lỗi để trống dòng phụ (không có số kỳ để hiện).
3. **Thẻ "Tổng cung token"**: thanh WPT dùng nhãn `supply.symbol`; chưa đọc được thì nhãn tạm "WPT" và số "–".
4. Số dòng spec theo `dev` @ `34bf33a`; `dashboard.tsx`, ba màn vận hành không đổi giữa `34bf33a` và `4d2f9e3`.
