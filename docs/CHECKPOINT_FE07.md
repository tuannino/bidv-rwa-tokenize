# Báo cáo bàn giao: FE-07 màn giá phát hành và nguồn cung; một nguồn giá cho mọi màn

| | |
|---|---|
| Mã task | FE-07 (mức kiểm chứng cao) |
| Nhánh | `feat/fe-07-cau-hinh-gia`, tạo từ `dev` (`f11f1ae`) |
| Spec | `docs/fe-07-cau-hinh-gia/{requirements,design,tasks}.md` (Supervisor soạn, thay spec FE-07 cũ trong gói đợt 5) |
| Commit | mã `61cdbae`, tài liệu là commit kế tiếp trên nhánh |
| Tiến độ | Xong. Chờ Owner merge; Claude Code **không** merge vào `dev` |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md`) | | Bằng chứng |
|---|---|---|---|
| 1 | `config-service.test.ts` FE-07 ca 1 tới 6, xanh với mã mới, đỏ với mã cũ | 🔶 | mục 1.1, 1.2 |
| 2 | `fe-07-price-config.test.ts` ca 7 (bốn khối, `canEdit`, không thêm AuditLog), ca 8 (một nguồn giá) | ✅ | mục 1.1, 1.2 |
| 3 | Nút Hardhat: đổi giá thật, `OrderSettlement.price` bằng giá mới, lệnh mua sau đổi giá đúng giá mới; `evm-order-settlement`, `evm-issuance` xanh | ✅ | mục 2 |
| 4 | E2E mock `fe-07-price-config.spec.ts`: hộp xác nhận, vượt ngưỡng cần đánh dấu, Kiểm soát viên không thấy "Đổi giá", Nhà đầu tư thấy giá mới | ✅ | mục 3.1 |
| 5 | Số action khi mở: `/config` = 1; bốn màn khách hàng không đổi | ✅ | mục 3.2 |
| 6 | Ít nhất 4 đột biến bị bắt (đủ 4 đột biến spec nêu) | ✅ | mục 4 |
| 7 | `issue-price-single-source` xanh; mô phỏng job A xanh; bản dựng và toàn bộ e2e mock xanh | ✅ | mục 1.1, 3.1, 5 |

**Kết luận:** 6 ✅, 1 🔶, 0 ❌. Dòng 1 là 🔶 vì ca 6 (Kiểm soát viên bị chặn) theo chính spec là "giữ hành vi cũ"
nên xanh cả với mã cũ; năm ca còn lại đỏ với mã cũ (mục 1.2). Không đổi hợp đồng, lược đồ database,
`ILedgerPort`, quyền; không thêm trạng thái.

UserGuide: đã cập nhật Phần 1 mục 1.4, 1.6; Phần 2; Phần 3 mục 3.1, 3.2, 3.5.3 (mới); Phụ lục B, C; Lịch sử cập nhật.

### 0.2 Việc cần Owner quyết

- Không có. Hai điểm Sếp đã chốt trước khi làm và các chỗ làm khác chữ spec ở mục 6.2.

---

## 1. Kiểm thử mock và đối chứng mã cũ

### 1.1 Mã mới

```text
$ (cd app && npx vitest --run test/config-service.test.ts test/fe-07-price-config.test.ts test/issue-price-single-source.test.ts)
 ✓ test/issue-price-single-source.test.ts (16 tests) 47ms
 ✓ test/config-service.test.ts (37 tests) 440ms
 ✓ test/fe-07-price-config.test.ts (3 tests) 472ms
 Test Files  3 passed (3)
      Tests  56 passed (56)
exit=0
```

Toàn bộ vitest (gồm các ca cũ phải sửa ở mục 6.3) chạy trong job A, mục 5.

### 1.2 Đối chứng mã cũ

Cất phần sửa trong `app/src` (giữ test mới), chạy các ca FE-07 trên mã `dev` @ `f11f1ae`, rồi trả lại.

```text
$ git stash push -u -- app/src
$ (cd app && npx vitest --run test/config-service.test.ts test/fe-07-price-config.test.ts -t "FE-07") > old-code-red.txt 2>&1
$ grep -E "^ +(×|✓) " old-code-red.txt | sed -E 's/^ +(×|✓) .*(FE-07.*)/\1 \2/; s/ [0-9]+ms$//'; grep -E "Test Files|Tests |exit=" old-code-red.txt
× FE-07: đổi giá chỉ ghi database sau khi chuỗi xác nhận > ca 1: biên nhận PENDING: database và lịch sử không đổi, sổ FAILURE, lỗi không nói "thành công"
× FE-07: đổi giá chỉ ghi database sau khi chuỗi xác nhận > ca 2: biên nhận FAILED: database không đổi, trả LEDGER kèm lý do của chuỗi
× FE-07: đổi giá chỉ ghi database sau khi chuỗi xác nhận > ca 3: CONFIRMED: database đổi, đúng một dòng lịch sử mang mã giao dịch
× FE-07: đổi giá chỉ ghi database sau khi chuỗi xác nhận > ca 4: còn lệnh PLACED, CHECKING hoặc EXECUTING trên chain thì chặn TRƯỚC khi gửi; lệnh chain khác không chặn
× FE-07: đổi giá chỉ ghi database sau khi chuỗi xác nhận > ca 5: thiếu lý do hoặc lý do dưới 5 ký tự: VALIDATION, không gửi gì
✓ FE-07: đổi giá chỉ ghi database sau khi chuỗi xác nhận > ca 6: Kiểm soát viên gọi đổi giá: bị chặn, sổ ghi DENIED, không gửi gì (giữ hành vi cũ)
× FE-07 ca 7: getPriceConfigOverviewAction > trả đủ bốn khối, canEdit đúng theo vai, không thêm dòng AuditLog nào
× FE-07 ca 7: getPriceConfigOverviewAction > lịch sử đổi giá tách mã giao dịch khỏi lý do; vai khách hàng không mở được màn
× FE-07 ca 8: giá trên chuỗi khác database thì mọi màn khách hàng hiện giá trên chuỗi > readEffectiveIssuePrice, getPortfolio, getTokenSummary, getSellerOverview, /trade cùng một con số
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 8 ⎯⎯⎯⎯⎯⎯⎯
 Test Files  2 failed (2)
      Tests  8 failed | 1 passed | 31 skipped (40)
exit=1
$ git stash pop
```

Lý do đỏ trên mã cũ: ca 1, 2 vì mã cũ ghi database ngay sau khi gửi; ca 3 vì lịch sử không có mã giao dịch; ca 4 vì
không chặn lệnh đang xử lý; ca 5 vì lý do còn tuỳ chọn; ca 7, 8 vì chưa có action tổng quan và
`readEffectiveIssuePrice`. Ca 6 xanh trên mã cũ đúng như spec ghi ("giữ hành vi cũ"): nó là chốt chống thoái lui.

## 2. Nút Hardhat thật

Tệp mới `test/fe-07-price-evm.test.ts` (spec không nêu tên tệp; đặt theo cách đặt tên các test nút Hardhat khác).
Mỗi tệp một lần reset chuỗi (`USE_LOCAL_SOLC=1`). Ca bỏ qua ở `evm-issuance` là ca tương thích bộ contract cũ, cần
`OLD_HARDHAT_RPC` (có từ trước).

```text
$ bash scripts/evm-local.sh reset; (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/fe-07-price-evm.test.ts)
 Test Files  1 passed (1)
      Tests  1 passed (1)
exit=0
$ bash scripts/evm-local.sh reset; (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/evm-order-settlement.test.ts)
 Test Files  1 passed (1)
      Tests  10 passed (10)
exit=0
$ bash scripts/evm-local.sh reset; (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/evm-issuance.test.ts)
 Test Files  1 passed (1)
      Tests  13 passed | 1 skipped (14)
exit=0
[evm-local] đã dừng nút (pid 8626)
```

Ca FE-07 kiểm: giá trên nút vừa reset bằng giá triển khai; `setIssuePrice` (Giao dịch viên, có lý do) trả `ok` sau
biên nhận; `quotePurchase(1n)` (tức `OrderSettlement.price`) bằng giá mới; `getIssuePrice` khớp, không cảnh báo,
`onChain: true`; lịch sử có mã giao dịch; lệnh mua 10 WPT ký permit đặt sau đó `COMPLETED`, `vndAmount` bằng 10
nhân giá mới, số dư VNDB của nhà đầu tư giảm đúng số đó.

## 3. Bản dựng, e2e, số action khi mở màn

### 3.1 Bản dựng và toàn bộ e2e mock

`run-measure-fe07.sh` (mục 3.2) dựng bản bằng `npm run build` trước khi đo; e2e dùng lại bản đó. Tệp e2e mới đặt
lại giá ban đầu ở bước cuối vì các tệp chạy sau dùng chung máy chủ.

```text
$ bash scripts/run-local-all.sh e2e > e2e.txt 2>&1; echo "exit=$?" >> e2e.txt
$ grep -oE '✓ +[0-9]+ \[mock\] › e2e/fe-07-price-config\.spec\.ts:[0-9:]+' e2e.txt | sed -E 's/ +[0-9]+ \[mock\] › / /'
✓ e2e/fe-07-price-config.spec.ts:54:7
✓ e2e/fe-07-price-config.spec.ts:74:7
✓ e2e/fe-07-price-config.spec.ts:86:7
✓ e2e/fe-07-price-config.spec.ts:95:7
✓ e2e/fe-07-price-config.spec.ts:106:7
$ grep -E 'passed|failed|skipped|flaky|exit=' e2e.txt
  7 skipped
  74 passed (1.1m)
exit=0
```

### 3.2 Số server action khi mở

Cách đo của HF-01: Playwright đếm yêu cầu có header `next-action` và yêu cầu `_rsc` từ lúc mở trang tới khi mạng yên
thêm 2,5 giây; máy chủ `next start` cổng 3300, chain `mock`, bộ nhớ, không kết nối ví. "Trước" là bản dựng mã
`dev` @ `f11f1ae` (đo trước khi sửa mã), "sau" là bản dựng FE-07.

```text
# trước (dev @ f11f1ae)
/portfolio INVESTOR http=200 {"ACTION":1,"RSC":0}
/trade INVESTOR http=200 {"ACTION":1,"RSC":0}
/tokens/WPT INVESTOR http=200 {"ACTION":1,"RSC":0}
/seller SELLER http=200 {"ACTION":1,"RSC":0}
/seller/withdraw SELLER http=200 {"ACTION":2,"RSC":0}
measure exit=0
# sau (FE-07)
/portfolio INVESTOR http=200 {"ACTION":1,"RSC":0}
/trade INVESTOR http=200 {"ACTION":1,"RSC":0}
/tokens/WPT INVESTOR http=200 {"ACTION":1,"RSC":0}
/seller SELLER http=200 {"ACTION":1,"RSC":0}
/seller/withdraw SELLER http=200 {"ACTION":2,"RSC":0}
/config TELLER http=200 {"ACTION":1,"RSC":0}
/config CONTROLLER http=200 {"ACTION":1,"RSC":0}
measure exit=0
```

Bốn màn khách hàng có giá phát hành giữ nguyên số action (`/seller/withdraw` vốn là 2 trước FE-07). Trên chain có
OrderSettlement, mỗi màn thêm đúng một lời đọc chuỗi `quotePurchase(1n)` nằm trong `Promise.all` có sẵn; `/trade`
không đọc thêm (dùng lại lời đọc của ô "Giá").

## 4. Đột biến

Script `mutate_fe07.py` (thư mục nháp, không commit): mỗi đột biến sửa đúng chuỗi trong mã, chạy tệp test, in ca
FE-07 đỏ và dòng tổng, rồi trả mã gốc. Sau bốn lượt `git diff --stat -- app/src` khớp trước khi chạy.

| Đột biến | Sửa gì |
|---|---|
| M1 | `setIssuePrice` gọi `setConfig` ngay sau khi gửi, trước `settle` (chờ biên nhận) |
| M2 | `if (inFlightTotal > 0)` thành `if (false)` |
| M3 | `getSellerOverview` đọc lại `readIssuePriceVnd(chain)` |
| M4 | `getPriceConfigOverview` dùng `authorize('ops:read', ...)` thay `assertCan` |

```text
## M1 ghi database trước khi chờ biên nhận
lệnh: npx vitest --run test/config-service.test.ts
exit=1
   × FE-07: đổi giá chỉ ghi database sau khi chuỗi xác nhận > ca 1: biên nhận PENDING: database và lịch sử không đổi, sổ FAILURE, lỗi không nói "thành công"
   × FE-07: đổi giá chỉ ghi database sau khi chuỗi xác nhận > ca 2: biên nhận FAILED: database không đổi, trả LEDGER kèm lý do của chuỗi
   × FE-07: đổi giá chỉ ghi database sau khi chuỗi xác nhận > ca 3: CONFIRMED: database đổi, đúng một dòng lịch sử mang mã giao dịch
      Tests  5 failed | 32 passed (37)

## M2 bỏ kiểm lệnh đang xử lý
lệnh: npx vitest --run test/config-service.test.ts
exit=1
   × FE-07: đổi giá chỉ ghi database sau khi chuỗi xác nhận > ca 4: còn lệnh PLACED, CHECKING hoặc EXECUTING trên chain thì chặn TRƯỚC khi gửi; lệnh chain khác không chặn
      Tests  1 failed | 36 passed (37)

## M3 getSellerOverview đọc lại readIssuePriceVnd
lệnh: npx vitest --run test/fe-07-price-config.test.ts
exit=1
   × FE-07 ca 8: giá trên chuỗi khác database thì mọi màn khách hàng hiện giá trên chuỗi > readEffectiveIssuePrice, getPortfolio, getTokenSummary, getSellerOverview, /trade cùng một con số
      Tests  1 failed | 2 passed (3)

## M4 action tổng quan dùng authorize thay assertCan
lệnh: npx vitest --run test/fe-07-price-config.test.ts
exit=1
   × FE-07 ca 7: getPriceConfigOverviewAction > trả đủ bốn khối, canEdit đúng theo vai, không thêm dòng AuditLog nào
      Tests  1 failed | 2 passed (3)
```

## 5. Mô phỏng job A, sơ đồ luồng, ký tự cấm

Gỡ bốn marker `@pending FE-07` (hai ở `app/actions/config.ts`, hai ở `app/actions/bank.ts`, thay bằng chú thích
thường), nên `docs/flows/issue.md` và mục điểm cắm của `docs/tech-report.md` được sinh lại: mục điểm cắm từ 10 xuống
6 (`git show origin/dev:docs/tech-report.md | grep "điểm cắm"` so với tệp hiện tại).

```text
$ node scripts/check-checkpoint.mjs docs/CHECKPOINT_FE07.md docs/fe-07-cau-hinh-gia/requirements.md | grep -c ĐẠT
1
$ node scripts/gen-flow-diagram.mjs issue --check && node scripts/gen-flow-diagram.mjs purchase --check && node scripts/scan-pending.mjs --check-report
Khớp marker: docs/flows/issue.md
Khớp marker: docs/flows/purchase.md
Khớp marker: mục điểm cắm trong docs/tech-report.md
$ ( set -e; BAK="$(mktemp -d)"; mv packages/contracts-evm/artifacts "$BAK/artifacts"; trap 'mv "$BAK/artifacts" packages/contracts-evm/artifacts && rmdir "$BAK"' EXIT; bash scripts/run-local-all.sh arch markers checkpoint app ) 2>&1 | grep -E "PASS  |FAIL  |ĐẠT|Tests  " | sed 's/\x1b\[[0-9;]*m//g'
  PASS  viem/ethers không xuất hiện ngoài app/src/lib
  PASS  Không có lời gọi contract trực tiếp trong components/ và app/
  PASS  SERVER_SIGNER_PRIVATE_KEY chỉ đọc ở env.ts và server.signer.ts
  PASS  Không có app/.env trong cây làm việc
  PASS  Không có private key dạng hex 64 ký tự nhúng trong mã nguồn
  PASS  Không có so sánh role cứng ngoài lib/rbac
  PASS  actions/bank.ts có 7 server action (guard nằm ở tầng service, xem lớp 1)
  PASS  Bảng quyền không teo lại so với origin/dev (37 -> 37 hành động)
  PASS  Không có ABI nhúng trong app/src (chỉ dùng từ packages/shared)
  PASS  Không có contract ID Stellar hardcode trong app/src
  PASS  Contract chính không import từ trex/ (toolchain tách biệt)
  PASS  Không còn tham chiếu Polygon/Amoy/Mumbai (ngoài comment)
  PASS  Không còn ký hiệu cũ SPT / tVND
  PASS  Có .kiro/steering
  PASS  Có .kiro/specs
  PASS  Có docs
  PASS  spec p4-mint-testnet đủ 3 file
  PASS  spec p7-profit-distribution đủ 3 file
  PASS  spec p12-redemption đủ 3 file
  PASS  app/package-lock.json đã được commit (npm ci trong Docker chạy được)
  => ĐẠT nhưng có 3 cảnh báo cần xác nhận có chủ đích.
      Tests  1130 passed | 86 skipped (1216)
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 3 - ĐIỂM CẮM (marker)
    PASS  LỚP 3 - KHUÔN CHECKPOINT
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST
  => ĐẠT các phần đã chạy: arch markers checkpoint app
jobA exit=0
$ git diff origin/dev...HEAD -U0 | LC_ALL=C.UTF-8 grep -nP '^\+.*[\x{00B7}\x{2014}\x{2192}]' | grep -v '^[0-9]*:+++ ' | grep -vc 'điểm cắm'
0
```

Lệnh cuối loại đúng một dòng: dòng tổng do `scan-pending.mjs --write-report` sinh trong khối tự động của
`docs/tech-report.md` ("**6 điểm cắm, ... 4 điểm chặn**" có dấu chấm giữa dòng của script). Dòng đó đổi vì số marker
giảm; sửa tay khối này bị máy kiểm `pending-markers.test.ts` chặn.

## 6. Thiết kế đã làm và ghi chú

### 6.1 Đã làm

- **Đổi giá (`setIssuePrice`).** Lý do bắt buộc 5 tới 200 ký tự. Sau kiểm quyền (giữ hai lớp và sổ DENIED), đếm lệnh
  PLACED, CHECKING, EXECUTING trên chain (`countInFlightOrders`, đếm ở database) rồi mới kiểm ngưỡng và gửi
  `setPurchasePrice`. Chờ biên nhận theo chain (`settle`; chờ ném lỗi coi như chưa có biên nhận). CONFIRMED mới ghi
  database, lý do lịch sử dạng "lý do; tx 0x..."; FAILED và chưa có biên nhận trả `LEDGER`, sổ FAILURE, đúng câu
  spec. Nhánh hoàn nguyên chờ biên nhận của giao dịch hoàn nguyên và báo rõ khi hoàn nguyên chưa xác nhận.
- **Một nguồn giá.** `lib/bank/issue-price.ts`: `settlesAtOnChainPrice(chain)` (quy tắc duy nhất, `getIssuePrice`
  dùng chung) và `readEffectiveIssuePrice(chain, quoted?)`. Đổi `getPortfolio`, `getTokenSummary`,
  `getSellerOverview` (dùng cho `/seller` và `/seller/withdraw`), `getTradeContext`. `/trade` truyền chính `Promise`
  của `quotePurchase(1n)` vào nên chỉ đọc chuỗi một lần.
- **Màn `/config`.** `getPriceConfigOverview` (`assertCan('ops:read')`, không ghi sổ), bốn khối có kết quả riêng,
  `canEdit`, `inFlightOrders`; `splitHistoryReason` tách mã giao dịch. Màn `price-config.tsx`: hai cột trên màn
  rộng, một nút chính "Đổi giá", số căn phải `tabular-nums`, tiêu đề khối `h2`, ví SPV rút gọn có nút sao chép,
  hai hộp xác nhận. Menu "Giá và phát hành" (phím H, icon `Coins`) sau "Vault thanh toán SPV" cho cả hai vai.
- **Marker.** Gỡ `@pending FE-07` ở `app/actions/config.ts` và `app/actions/bank.ts`; chú thích `issueInitialSupplyAction`
  ghi rõ là đường dữ liệu thử.
- **Tài liệu.** UserGuide (mục 0.1), `tech-report.md` mục 3.12 (đổi giá chờ biên nhận, một nguồn giá, màn `/config`),
  mục 3.13 (nợ kỹ thuật "màn tham số hệ thống"), mục 3.29 Fireblocks (chép nguyên văn `design.md` mục 5), dòng BE-18
  ở mục 4.5; `.kiro/task-status.json` FE-07 và BE-18 vào `done` (`git grep -c BE-18 -- app/src scripts` không có kết quả, mã thoát 1).

### 6.2 Làm khác chữ spec (để Supervisor xem)

1. **Sếp chốt 23/10:** `readEffectiveIssuePrice` đặt ở `lib/bank/issue-price.ts`, không ở `lib/store/config-values.ts`.
   Lý do: hàm gọi `getLedger`, mà `lib/ledger/index.ts` đã nhập `config-values.ts`; đặt ở đó là vòng nhập và tầng lưu
   trữ phụ thuộc tầng chuỗi.
2. **Sếp chốt 23/10:** chain mock giữ quy tắc spec (không có địa chỉ OrderSettlement nên màn khách hàng hiện giá đã
   cấu hình). Trường hợp lệch trên mock: trạng thái mock lưu bền trong Postgres và giá trong database bị đặt lại ngoài
   màn đổi giá.
3. Lỗi vượt ngưỡng trả thêm `fieldErrors.confirmLargeChange` để màn mở hộp thứ hai theo dấu hiệu có cấu trúc, không dò
   chữ. `IssuePriceView` thêm `onChain` để màn ghi rõ nguồn của giá áp dụng.
4. `inFlightOrders` dùng khoá `PLACED`, `CHECKING`, `EXECUTING` (design ghi chữ thường), cùng tên trạng thái lệnh.
5. Action nhận `{ chain }` như design; `getIssuePriceAction` và `issuanceStatusAction` giữ nguyên, màn không gọi.
6. Spec ghi "Phần 1 mục 1.6 (dòng quyết định về giá)"; dòng giá có sẵn nằm ở mục 1.4. Em sửa dòng ở 1.4 và thêm hai
   dòng quyết định ở 1.6. Dòng L-45 (`/tokens/[symbol]`) bỏ phần "Giá phát hành" vì nay đã đọc theo giá áp dụng.

### 6.3 Ca cũ phải đổi (lý do)

- `config-service.test.ts`: thêm `reason` vào 15 lời gọi `setIssuePrice` (lý do nay bắt buộc); ca "ghi cả dòng lịch
  sử" kỳ vọng lý do có đuôi "; tx 0x..." (FE-07 việc 3).
- `seller-vault.test.ts`: ledger giả thêm `quotePurchase`, vì `hardhat-local` có OrderSettlement nên tổng quan Người
  bán nay đọc giá trên hợp đồng (đúng L-02).
- `four-roles-shell.test.ts`: danh sách menu hai vai vận hành thêm "Giá và phát hành"; `/config` vào danh sách mục
  khách hàng không được thấy.

### 6.4 Ghi chú, kẽ hở đã biết

- Lệnh đặt đúng lúc giữa bước đếm lệnh đang xử lý và lúc chuỗi xác nhận giá mới sẽ bị hợp đồng từ chối
  (`PriceMismatch`) và về Thất bại thật theo luật HF-05; không mất tiền. Với quyết toán tự động ngay sau khi đặt, cửa
  sổ này ngắn. Không sửa trong FE-07.
- E2E lần đầu bắt được một lỗi màn: đổi giá xong, tải lại tổng quan làm gỡ cả khối "Đổi giá" nên mất thông báo kết
  quả. Đã sửa: giữ số cũ trên màn trong lúc tải lại cùng chain, đổi chain thì bỏ ngay.
