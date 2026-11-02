# Báo cáo bàn giao: FIX-04 Nối dữ liệu thật cho màn Nhà đầu tư, Người bán, Tài khoản; ghi chú "unverified"

| | |
|---|---|
| Mã task | FIX-04 |
| Phạm vi | Backend chỉ đọc (B1, B2) và frontend. Không ghi dữ liệu, không đổi lược đồ, không đổi quyền, không thêm action |
| Nhánh | `fix/fix-04-noi-du-lieu-that`, tạo từ `dev` (`2199915`, sau merge FIX-03) |
| Spec | `docs/fix-04-noi-du-lieu-that/{requirements,design,tasks}.md` (chép nguyên) |
| Commit | mã `9a05b09`; tài liệu `2f83949` (bản nháp) và commit tài liệu cuối trên nhánh |
| Tiến độ | Xong. Chờ Owner merge; Claude Code **không** merge vào `dev` |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 9) | | Bằng chứng |
|---|---|---|---|
| 1 | B1, B2 đúng mục 3; F1 tới F8 đúng mục 4; `recall.service.ts`, `lib/indexer/**`, `lib/ledger/**` không đổi | ✅ | mục 5; vitest ca 1 tới 8 |
| 2 | Không tăng số lời gọi khi mở `/portfolio`, `/tokens/[symbol]`, `/seller`, `/account` | ✅ | mục 3.2 |
| 3 | Số đo hiệu năng hai action; không tăng quá 300 ms | ✅ | mục 3.1 (tăng 0,2 ms và giảm 0,7 ms) |
| 4 | `git diff --name-only` chỉ có tệp mục 5 spec; lệnh kiểm tệp cấm rỗng | ✅ | mục 6 |
| 5 | Typecheck, lint, vitest (cả Postgres), 5 tệp e2e mức B trên mock xanh; 10 đột biến bị bắt | ✅ | mục 1, 2, 4 |
| 6 | Ảnh `/portfolio` (hardhat, có ví, thấy Số dư VNDB), `/tokens/WPT`, `/seller`, `/account` (Sáng) | ✅ | mục 7 |
| 7 | Không ký tự cấm trong chữ mới thêm | ✅ | mục 6 |

**Kết luận:** 7 ✅, 0 🔶, 0 ❌. Backend chỉ THÊM hai lần đọc (số dư VNDB trong lô `Promise.all` đang có, tên dự án
sau `tokenInfo`); đọc thêm lỗi thì trường mới là `null`, lời gọi cũ không đổ. Không chạm Indexer. Mức rủi ro: thấp.

UserGuide: đã cập nhật Phần 2 (`/portfolio`, `/tokens/[symbol]`, `/seller`, `/account`); Phần 3 quy ước chung (ý nghĩa
"unverified"), mục 3.1.1, 3.1.5, 3.2.1, 3.3.2; Phụ lục C (bỏ L-07, L-29 đã sửa); "Chốt tại"; Lịch sử.

### 0.2 Việc cần Owner quyết

- Không có việc chặn. **Tên dự án hai nơi có thể khác (QĐ-5, đã chấp nhận):** Tổng quan Nhà đầu tư hiện tên trong bảng
  dự án ("Dự án điện gió An Viên"); trang chi tiết `/tokens/WPT` vẫn hiện tên mẫu ở `lib/mock-data.ts` ("Điện gió An
  Viên") vì trang này không gọi `getTokenSummaryAction`.
- Số nhà đầu tư nắm giữ thật vẫn chờ duyệt riêng (spec mục 1: nguồn duy nhất kéo Indexer ghi bộ đệm).

---

## 1. Kiểm thử

### 1.1 Vitest mới `app/test/fix-04-noi-du-lieu-that.test.ts`

```text
$ (cd app && npx vitest --run test/fix-04-noi-du-lieu-that.test.ts)
      Tests  11 passed (11)
```

| Ca | Nội dung đã kiểm |
|---|---|
| 1 | Ví mock có 7 WPT, 2.500.000 VNDB: `paymentBalance` bằng `paymentBalanceOf` (`'2500000'`); `wallet`, `chain`, `balance`, `valueVnd`, `issuePriceVnd`, `whitelisted`, `frozen`, `token`, `recall` đúng như đọc trực tiếp |
| 2 | Bọc ledger (`vi.mock`, Proxy) cho `paymentBalanceOf` ném: lời gọi `ok`, `paymentBalance === null`, `balance` vẫn `'7'` |
| 3 | `projectName` bằng `ProjectStore.findProject({ tokenSymbol, chain }).name` (khác rỗng); `name`, `symbol`, `decimals`, `totalSupply`, `chain`, `issuePriceVnd` không đổi |
| 4 | Bọc store cho `findProject` ném, rồi trả `null`: cả hai lần `ok`, `projectName === null`, `symbol`, `totalSupply` đúng |
| 5 | `getTokenSummary` dưới vai Người bán, Giao dịch viên, Kiểm soát viên: `FORBIDDEN` như trước |
| 6a | `shareInflight`: hai lần gọi cùng khoá lúc đang chạy thì `run` chạy một lần, cùng kết quả; khoá khác chạy riêng |
| 6b, 6c | `loadTokenSummary`: `call` reject thì cả hai lần chờ nhận `{ data: null, error: LOAD_FAILED }`, không reject, `call` chạy một lần; gọi lại sau đó chạy lần mới, trả kết quả mới |
| 6d | `freshFor('hardhat-local', kết quả khoá 'mock')` là `null`; cùng khoá thì trả nguyên kết quả |
| 6b (`projectNameView`) | Có tên thật: `{ text: tên thật, unverified: false }`; đang tải (`null`), lỗi (`data` `null`), `projectName` `null`: `{ text: tên mẫu, unverified: true }` |
| 7 | Quét mã: không còn `MockBadge`; `UnverifiedNote` ở bốn tệp; khối `<Row label="WPT dự kiến phát hành">` chứa `<UnverifiedNote`; `account-info.tsx` có đúng 4 lần `note={<UnverifiedNote`; hai hộp không import và không gọi `getTokenSummaryAction`, có dùng `useTokenSummary(`; không còn "chờ BE-01", "Hệ thống chưa có lệnh bán lại" |
| 8 | `paymentBalanceOf` ném lỗi chứa `https://rpc.example/KEY123`: không tham số `console.error` nào chứa `KEY123` |

### 1.2 Test cũ đã đổi (hành vi đổi có chủ đích)

| Tệp:dòng | Cũ | Mới | Lý do |
|---|---|---|---|
| `test/portfolio-service.test.ts:118` | "KHÔNG có trường số dư VNDB (chờ BE-01)": `not.toHaveProperty('paymentBalance')` | Nạp 1.234.567 VNDB cho ví, kiểm `paymentBalance` bằng `paymentBalanceOf` và bằng `'1234567'` (thêm import `seedMockLedger`) | B1 thêm trường (spec mục 6) |
| `e2e/investor-channel.spec.ts:308` | `getByText('dữ liệu mẫu')` | `getByText('unverified', { exact: true })` | QĐ-4 thay nhãn (spec mục 6) |

Không test nào khác đỏ vì đổi chữ (grep "dữ liệu mẫu", "chờ BE-01", "Hệ thống chưa có lệnh bán lại", `MockBadge` trong
`app/e2e`, `app/test`).

### 1.3 Kiểm chứng mức B (tasks bước 6)

```text
$ (cd app && npm run typecheck && npm run lint && npx vitest --run)
  1 problem (0 errors, 1 warning)                     # cảnh báo có từ trước: test/helpers/fake-fireblocks.ts:86 (IN-04)
 Test Files  68 passed | 15 skipped (83)
      Tests  1361 passed | 101 skipped (1462)
$ (cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa npx vitest --run)
 Test Files  72 passed | 11 skipped (83)
      Tests  1471 passed | 74 skipped (1545)
$ bash scripts/run-local-all.sh arch markers checkpoint build
  => ĐẠT các phần đã chạy: arch markers checkpoint build      # 3 cảnh báo arch có từ trước
$ (cd app && npx playwright test e2e/fix-04-noi-du-lieu-that.spec.ts e2e/investor-channel.spec.ts \
     e2e/account-info.spec.ts e2e/uiux-02-dau-man.spec.ts e2e/chain-scope.spec.ts)
  46 passed (47.7s)
```

Không chạy toàn bộ e2e, không chạy `e2e evm` (đúng mức B).

## 2. E2E mới `app/e2e/fix-04-noi-du-lieu-that.spec.ts` (chain mock)

| Bài | Nội dung |
|---|---|
| Tổng quan Nhà đầu tư | Số action khi mở không quá 1; không còn "chờ BE-01"; hộp Trạng thái phát hành hiện "Dự án điện gió An Viên" (từ bảng dự án), không có "Chưa đọc được"; có chữ "unverified"; hộp Danh sách token cũng hiện tên thật |
| Tổng quan Người bán | Số action không quá 1; không còn "Hệ thống chưa có lệnh bán lại."; ô "Số lượng bán" có số và đơn vị WPT |
| Tài khoản | Số action không quá 1; tiêu đề "Thông tin cá nhân" chứa "unverified" |
| Lời gọi bị reject | Chặn mọi POST có `next-action` bằng `page.route` rồi abort: hộp Trạng thái phát hành hết "Đang đọc thông số token" và hiện `LOAD_FAILED` trong 10 giây; dòng WPT ở Danh sách token hiện tên mẫu "Điện gió An Viên" kèm ghi chú `title` "Tên mẫu, chưa đọc được tên dự án trong hệ thống"; bỏ chặn, tải lại thì cả hai hộp hiện tên thật |

## 3. Đo

### 3.1 Thời gian trả lời hai action (hardhat cục bộ, trung vị 10 lần sau 2 lần làm nóng)

Gọi thẳng server action trong một tệp vitest tạm (không commit), bỏ qua HTTP; chuỗi `hardhat-local` vừa `evm-local.sh
reset`, store bộ nhớ, ví NDT001 đã gắn.

| Action | Trước (`dev` @ `2199915`) | Sau | Chênh |
|---|---|---|---|
| `getPortfolioAction` | 11,55 ms | 11,75 ms | +0,2 ms |
| `getTokenSummaryAction` | 8,5 ms | 7,8 ms | -0,7 ms (dao động đo) |

**Giới hạn đã chấp nhận (spec mục 3.1):** `orNull` chỉ bắt lỗi, không giới hạn thời gian chờ. Cho `paymentBalanceOf`
chậm 2 giây trên chain mock (bọc ledger trong tệp vitest tạm): `getPortfolio` mất **2.011 ms**, `ok`. Đúng kỳ vọng
khoảng 2 giây; RPC treo thì `balanceOf` có sẵn trong cùng lô cũng treo như trước.

### 3.2 Số server action khi mở (mock, `next start`, đếm header `next-action`)

| Màn | Vai | Trước (`dev`) | Sau |
|---|---|---|---|
| `/portfolio` | Nhà đầu tư | 1 | 1 |
| `/tokens/WPT` | Nhà đầu tư | 1 | 1 |
| `/seller` | Người bán | 1 | 1 |
| `/account` | Nhà đầu tư, Người bán, Giao dịch viên | 1, 1, 0 | 1, 1, 0 |

Hai hộp ở `/portfolio` cùng cần thông tin token nhưng chỉ tạo một lời gọi (`shareInflight`).

## 4. Đột biến (10/10 bị bắt)

| # | Đột biến | Ca đỏ |
|---|---|---|
| 1 | Bỏ `orNull` ở lần đọc `paymentBalanceOf` | vitest 2, 8 |
| 2 | `findProject` không bọc `orNull` | vitest 4 |
| 3 | `orNull` ghi `error.message` | vitest 8 |
| 4 | `shareInflight` không gộp | vitest 6a, 6b |
| 5 | `issuance-status-box.tsx` import và gọi thẳng `getTokenSummaryAction` | vitest 7 |
| 6 | Bỏ `UnverifiedNote` ở dòng "WPT dự kiến phát hành" | vitest 7 |
| 7 | `seller-overview.tsx` vẫn hiện "Hệ thống chưa có lệnh bán lại." | vitest 7; e2e "Tổng quan Người bán" |
| 8 | Bỏ `note` ở khối "Thông tin tài khoản" của `account-info.tsx` | vitest 7 |
| 9 | `loadTokenSummary` bỏ `try/catch` | vitest 6b; e2e "Lời gọi bị reject" |
| 10 | `projectNameView` trả `unverified: false` khi dùng tên mẫu | vitest 6b (`projectNameView`) |

## 5. Yêu cầu và nơi làm

- **B1, B2** `lib/bank/portfolio.service.ts`: `PortfolioView.paymentBalance` (đọc trong lô `Promise.all` đang có, qua
  `orNull`), xoá khối chú thích cũ "KHÔNG có trường số dư VNDB"; `TokenSummary.projectName` (`getProjectStore().findProject`
  sau `tokenInfo`, qua `orNull`); hàm `orNull` log chỉ tên lỗi. Cổng `authorize`, `assertSessionWallet` giữ nguyên.
- **F1** `asset-summary.tsx`: dòng "Số dư VNDB" (`nf`, đơn vị VNDB), `null` thì "Chưa đọc được số dư VNDB"; bỏ đoạn
  "chờ BE-01" và import `Coins`.
- **F2** `token-summary-state.ts`, `use-token-summary.ts`: chép nguyên design mục 2.
- **F3** `issuance-status-box.tsx`: dùng `useTokenSummary`; "Dự án" hiện `projectName` (`null` thì "Chưa đọc được");
  "Trạng thái vận hành" kèm `UnverifiedNote`.
- **F4** `token-list-box.tsx`: dùng `useTokenSummary`, `projectNameView` cho dòng đã lên chuỗi; số nắm giữ, dòng vùng
  và trạng thái kèm `UnverifiedNote`; hai dòng mẫu đổi nhãn; viết lại chú thích đầu tệp.
- **F5** `investor-token-detail.tsx`: ghi chú cuối dòng phụ dưới tiêu đề, ba chỗ thay `MockBadge`, dòng "WPT dự kiến phát hành".
- **F6** `seller-overview.tsx`: hai ô bán theo mẫu hai ô mua.
- **F7** `account-info.tsx`: `Section` thêm `note`; 4 khối kèm `UnverifiedNote` đúng `title`.
- **F8** `components/ui/unverified-note.tsx` (chép design mục 3); xoá `MockBadge` và import `FlaskConical`.

## 6. Quét

```text
$ git diff --name-only dev... | grep -E '^app/src/lib/' | grep -vE '^app/src/lib/bank/portfolio\.service\.ts$' || true
(rỗng)
$ git diff --name-only dev... | grep -E '^app/src/app/(actions|api)/|^app/prisma/|^packages/|^scripts/|wrangler\.json|\.env' || true
(rỗng)
$ git diff dev... -- . ':!docs/fix-04-noi-du-lieu-that' | python3 -c ...     # lệnh quét ký tự cấm ở tasks bước 6
(rỗng)
```

## 7. Ảnh (`docs/screenshots/fix-04/`, Sáng, hardhat cục bộ, 1440 px)

Chuẩn bị qua màn: Giao dịch viên whitelist ví NDT001 ở `/mint`, nạp 5.000.000 VNDB ở `/demo-payment`; ví trình duyệt
giả lập trả đúng ví NDT001.

- `20261102_tong_quan_nha_dau_tu_so_du_vndb_sang.png`: Số dư VNDB 5.000.000 VNDB, tên dự án thật, ghi chú "unverified".
- `20261102_chi_tiet_token_wpt_sang.png`, `20261102_tong_quan_nguoi_ban_sang.png`, `20261102_thong_tin_tai_khoan_sang.png`.

## 8. Chỗ làm khác chữ spec hoặc spec để ngỏ

1. **Dòng "Dự án" ở hộp Trạng thái phát hành** trước nằm trong khối chỉ hiện khi có dự án mẫu đã lên chuỗi; nay đọc
   `projectName` thật nên đặt ra ngoài khối đó (luôn hiện). "Trạng thái vận hành" vẫn trong khối vì cần số mẫu.
2. **F4, dòng vùng và trạng thái:** spec ghi "MỌI dòng thêm `UnverifiedNote`" và với hai dòng mẫu "các ô bên trong không
   thêm ghi chú nữa". Em hiểu là dòng vùng, trạng thái của cả ba dòng đều có ghi chú, còn các ô khác của hai dòng mẫu
   (tên, số nắm giữ) không thêm. Dòng chữ vùng và trạng thái giữ nguyên dòng cũ (không đổi dấu ngăn cách).
3. **Ca 7** kiểm hai hộp "không import và không gọi" `getTokenSummaryAction` (theo đúng chữ spec "KHÔNG import") thay vì
   cấm cả tên trong chú thích: chú thích ở hai hộp có nhắc tên action để giải thích việc dùng chung.
4. **E2E lời gọi bị reject:** hộp Danh sách token không có chữ "Đang tải" riêng (khi đang tải đã hiện tên mẫu kèm
   "unverified"), nên bài kiểm thẳng tên mẫu và ghi chú đã hiện.
5. **Đo thời gian action** gọi thẳng server action trong tiến trình (không qua HTTP) để so phần máy chủ; cùng cách cho
   trước và sau.
6. Số dòng spec theo `dev` @ `34bf33a`; FIX-03 không đụng các tệp này nên số dòng trùng.
