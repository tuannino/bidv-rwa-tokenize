# Báo cáo bàn giao: HF-05 giao dịch chưa có biên nhận giữ đang thực hiện; màn chia hiện đúng số đã duyệt

| | |
|---|---|
| Mã task | HF-05 (bản 2, mức kiểm chứng cao) |
| Nhánh | `fix/hf-05-giao-dich-chua-xac-nhan`, tạo từ `dev` (`4d17bc9`, PR #68 đã merge) |
| Spec | `docs/hf-05-giao-dich-chua-xac-nhan/{requirements,design,tasks}.md` (Supervisor soạn) |
| Commit | mã `8359009`, tài liệu là commit kế tiếp trên nhánh |
| Tiến độ | Xong. Chờ Owner merge; Claude Code **không** merge vào `dev` |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md`) | | Bằng chứng |
|---|---|---|---|
| 1 | `token-request.test.ts` HF-05 ca 1, 2, 3, 3b, 4, 5, 5b, 5c xanh với mã mới, đỏ với mã cũ | ✅ | mục 1.1, 1.2 |
| 2 | `purchase-service.test.ts` chế độ `receipt-pending`: ca 6, 7, 7b, 7c; ca R5 cũ giữ kỳ vọng | ✅ | mục 1.1, 1.2, 6.1 |
| 3 | `fe-08-approval.test.ts` HF-05 ca 8 (hàm hiển thị) | ✅ | mục 1.1, 1.2 |
| 4 | Nút Hardhat: `evm-issuance`, `evm-order-settlement`, `fe-08-approval-evm` xanh | ✅ | mục 2 |
| 5 | Bản dựng, e2e `maker-checker`, `ops-transactions` xanh; đo số action khi mở hai màn | ✅ | mục 3 |
| 6 | Ít nhất 5 đột biến bị bắt (đủ 5 đột biến spec nêu) | ✅ | mục 4 |
| 7 | Mô phỏng job A xanh | ✅ | mục 5 |

**Kết luận:** 7 ✅, 0 🔶, 0 ❌. Không đổi lược đồ database, hợp đồng, quyền, `ILedgerPort`; không thêm
trạng thái; không thêm server action khi mở màn (đo: 1 và 1, như trước).

UserGuide: đã cập nhật mục 3.4.4, 3.5.2, Phụ lục A, C (kèm dòng Phần 2 của `/approvals/[id]`, dòng "Chốt tại"
và một dòng Lịch sử cập nhật ghi L-13, L-20, L-91).

### 0.2 Việc cần Owner quyết

- Không có. Các chỗ em làm khác chữ spec (đều nhỏ, có lý do) liệt kê ở mục 6.2 để Supervisor xem.

---

## 1. Kiểm thử mock và đối chứng mã cũ

### 1.1 Mã mới

Ca 5b ở tầng nghiệp vụ chạy trên bản bộ nhớ (`Promise.all` hai lượt đối soát, Mint và Burn). Cùng ca ở tầng
lưu trữ (`finalizeTokenRequest` gọi song song) chạy trên **cả bộ nhớ và Postgres 16** trong
`store-constraints.test.ts` (môi trường có Postgres, `TEST_DATABASE_URL`), kèm ca 5c bản Postgres: một câu
trong transaction lỗi thì lùi hết, yêu cầu còn `EXECUTING`, không có dòng sổ.

```text
$ (cd app && npx vitest --run test/token-request.test.ts test/purchase-service.test.ts test/fe-08-approval.test.ts)
 ✓ test/token-request.test.ts (33 tests) 348ms
 ✓ test/purchase-service.test.ts (94 tests) 152ms
 ✓ test/fe-08-approval.test.ts (42 tests) 148ms
 Test Files  3 passed (3)
      Tests  169 passed (169)
exit=0
$ (cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@localhost:5432/bidv_rwa npx vitest --run test/store-constraints.test.ts)
 ✓ test/store-constraints.test.ts (212 tests | 1 skipped) 2064ms
 Test Files  1 passed (1)
      Tests  211 passed | 1 skipped (212)
exit=0
```

Ca bỏ qua ở `store-constraints`: ca 5c Postgres (`it.runIf`) khi chạy dưới bản bộ nhớ.

### 1.2 Đối chứng mã cũ

Cất phần sửa trong `app/src` (giữ nguyên test mới), chạy các ca HF-05 trên mã của `dev` @ `4d17bc9`, rồi trả lại.
Cả 28 ca đỏ. Lệnh in tên ca từ chữ "HF-05" trở đi (bỏ tiền tố tên khối cũ của `store-constraints`).

```text
$ git stash push -u -- app/src
$ (cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@localhost:5432/bidv_rwa npx vitest --run test/token-request.test.ts test/purchase-service.test.ts test/fe-08-approval.test.ts test/store-constraints.test.ts -t "HF-05") > old-code-red.txt 2>&1
$ grep -E "^ +× " old-code-red.txt | grep -oE "HF-05.*" | sed -E 's/ [0-9]+ms$//'; grep -E "Test Files|Tests |exit=" old-code-red.txt
HF-05 ca 5b: hai lượt chốt song song, đúng một lượt đổi và đúng một bộ dòng sổ
HF-05: chốt yêu cầu không còn EXECUTING trả null và không ghi dòng sổ nào
HF-05: chốt FAILED ghi lý do cùng dòng sổ thất bại
HF-05: Mint ghi mốc phát hành khi dự án chưa có; đã có thì giữ nguyên, không lỗi
HF-05 ca 5b: hai lượt chốt song song, đúng một lượt đổi và đúng một bộ dòng sổ
HF-05: chốt yêu cầu không còn EXECUTING trả null và không ghi dòng sổ nào
HF-05: chốt FAILED ghi lý do cùng dòng sổ thất bại
HF-05: Mint ghi mốc phát hành khi dự án chưa có; đã có thì giữ nguyên, không lỗi
HF-05 ca 5c (Postgres): một câu trong transaction lỗi thì lùi hết, yêu cầu còn EXECUTING
HF-05: duyệt khi biên nhận còn PENDING > ca 1: Mint lần đầu PENDING: EXECUTING có mã, mốc phát hành vẫn rỗng, không có token:mint SUCCESS
HF-05: duyệt khi biên nhận còn PENDING > ca 2: Burn PENDING: EXECUTING, không có token:burn SUCCESS
HF-05: đối soát yêu cầu đang thực hiện > ca 3: đối soát Mint ca 1 khi CONFIRMED: COMPLETED, có mốc, đúng một token:mint, Txn CONFIRMED; lần hai bị chặn
HF-05: đối soát yêu cầu đang thực hiện > ca 3b: Burn PENDING rồi đối soát CONFIRMED: COMPLETED, đúng một token:burn, Txn CONFIRMED
HF-05: đối soát yêu cầu đang thực hiện > ca 4: còn PENDING (gọi nhiều lần, kể cả đọc biên nhận lỗi) giữ EXECUTING; biên nhận FAILED thì FAILED
HF-05: đối soát yêu cầu đang thực hiện > ca 4b: dòng Txn bị mất thì đối soát tạo đúng một dòng, không tạo trùng
HF-05: đối soát yêu cầu đang thực hiện > ca 5: bị chặn khi không có mã giao dịch, vai không có quyền duyệt, hoặc sai chain đang chọn
HF-05: đối soát yêu cầu đang thực hiện > ca 5b (MINT): hai lượt đối soát song song: một lượt hoàn tất, đúng một dòng sổ token và một order:approve, không gửi gì
HF-05: đối soát yêu cầu đang thực hiện > ca 5b (BURN): hai lượt đối soát song song: một lượt hoàn tất, đúng một dòng sổ token và một order:approve, không gửi gì
HF-05: đối soát yêu cầu đang thực hiện > ca 5c: CONFIRMED mà đọc tổng cung lỗi: giữ EXECUTING, không ghi SUCCESS, không FAILED; gỡ lỗi rồi đối soát lại thì COMPLETED
HF-05: đối soát yêu cầu đang thực hiện > ca 5c: CONFIRMED mà thao tác chốt ném lỗi: giữ EXECUTING, không ghi gì; đối soát lại thì COMPLETED
HF-05 ca 8: ô "Số đã duyệt" và cột "Số duyệt" hiện approvedAmount > duyệt X bị lệch, duyệt lại Y: ô và bảng hiện Y; AMOUNT_CHANGED hiện câu lệch
HF-05 ca 8: ô "Số đã duyệt" và cột "Số duyệt" hiện approvedAmount > kỳ cũ (expectedAmount rỗng) sau duyệt lại hiện số; chưa có kết luận thì "Đang so số"
HF-05: lệnh mua bán chưa có biên nhận giữ EXECUTING > ca 6: biên nhận PENDING, tra chuỗi chưa thấy: EXECUTING có mã, không FAILED
HF-05: lệnh mua bán chưa có biên nhận giữ EXECUTING > ca 7: chờ biên nhận ném lỗi sau khi có mã, tra chuỗi chưa thấy: EXECUTING có mã, không FAILED
HF-05: lệnh mua bán chưa có biên nhận giữ EXECUTING > ca 7b: lệnh mua, đối soát hai lần khi còn PENDING vẫn EXECUTING; sau đó biên nhận CONFIRMED
HF-05: lệnh mua bán chưa có biên nhận giữ EXECUTING > ca 7b: lệnh mua, đối soát hai lần khi còn PENDING vẫn EXECUTING; sau đó biên nhận FAILED thật
HF-05: lệnh mua bán chưa có biên nhận giữ EXECUTING > ca 7c: lệnh bán, đối soát hai lần khi còn PENDING vẫn EXECUTING; sau đó biên nhận CONFIRMED
HF-05: lệnh mua bán chưa có biên nhận giữ EXECUTING > ca 7c: lệnh bán, đối soát hai lần khi còn PENDING vẫn EXECUTING; sau đó biên nhận FAILED thật
⎯⎯⎯⎯⎯⎯ Failed Tests 28 ⎯⎯⎯⎯⎯⎯⎯
 Test Files  4 failed (4)
      Tests  28 failed | 353 skipped (381)
exit=1
$ git stash pop
```

Lý do đỏ trên mã cũ (đọc trong `old-code-red.txt`): ca 1 đến 5c dừng ở `approvePending` vì lần duyệt PENDING trả
`COMPLETED`; ca 5 vì chưa có `reconcileTokenRequest`; tầng lưu trữ vì chưa có `finalizeTokenRequest`; ca 6, 7b, 7c
nhận "Giao dịch khớp lệnh kết thúc ở trạng thái PENDING." và lệnh `FAILED`; ca 7 nhận mã `UNKNOWN`; ca 8 vì chưa
có hàm `approvedAmountLabel`.

## 2. Nút Hardhat thật

Mỗi tệp một lần reset chuỗi (`USE_LOCAL_SOLC=1`). Ca bỏ qua ở `evm-issuance` là ca tương thích bộ contract cũ, chỉ
chạy khi có `OLD_HARDHAT_RPC` (có sẵn từ trước, không liên quan HF-05).

```text
$ bash scripts/evm-local.sh reset; (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/evm-issuance.test.ts)
 Test Files  1 passed (1)
      Tests  13 passed | 1 skipped (14)
exit=0
$ bash scripts/evm-local.sh reset; (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/evm-order-settlement.test.ts)
 Test Files  1 passed (1)
      Tests  10 passed (10)
exit=0
$ bash scripts/evm-local.sh reset; (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/fe-08-approval-evm.test.ts)
 Test Files  1 passed (1)
      Tests  8 passed (8)
exit=0
[evm-local] đã dừng nút (pid 11776)
```

## 3. Bản dựng, e2e, số action khi mở màn

### 3.1 Bản dựng và e2e

Chạy **toàn bộ** e2e chuỗi mock trên bản dựng mới (bài học OP-05 PR A: không chỉ chạy hai tệp spec nêu).
`run-measure.sh` (mục 3.2) dựng bản bằng `npm run build` trước khi đo; e2e dùng lại bản đó.

```text
$ bash scripts/run-local-all.sh e2e > e2e.txt 2>&1; echo "exit=$?" >> e2e.txt
$ grep -oE '✓ +[0-9]+ \[mock\] › e2e/(maker-checker|ops-transactions)\.spec\.ts:[0-9:]+' e2e.txt | sed -E 's/ +[0-9]+ \[mock\] › / /'
✓ e2e/maker-checker.spec.ts:39:7
✓ e2e/maker-checker.spec.ts:46:7
✓ e2e/maker-checker.spec.ts:105:7
✓ e2e/maker-checker.spec.ts:122:7
✓ e2e/maker-checker.spec.ts:130:7
✓ e2e/maker-checker.spec.ts:136:7
✓ e2e/maker-checker.spec.ts:177:7
✓ e2e/ops-transactions.spec.ts:26:5
✓ e2e/ops-transactions.spec.ts:212:5
$ grep -E 'passed|failed|skipped|flaky|exit=' e2e.txt
  7 skipped
  69 passed (52.9s)
exit=0
```

### 3.2 Số server action khi mở

Cách đo của HF-01: trình duyệt Playwright đếm yêu cầu có header `next-action` (server action) và yêu cầu `_rsc`,
từ lúc mở trang tới khi mạng yên thêm 1,5 giây. Máy chủ `next start` cổng 3300, chain `mock`, lưu trong bộ nhớ.
Trước khi đo, script lập một yêu cầu Mint thật bằng giao diện (Giao dịch viên, màn `/draft`) để `/approvals/[id]`
có dữ liệu. "Trước" là bản dựng từ mã `dev` (cất `app/src` như mục 1.2), "sau" là bản dựng HF-05.

```text
# trước (mã dev @ 4d17bc9)
yêu cầu đo: dad0f7ab-3d94-4dbf-b9d1-483d817fee32
/approvals/[id] CONTROLLER {"ACTION":1,"RSC":0}
/distribution CONTROLLER {"ACTION":1,"RSC":0}
/approvals/[id] TELLER {"ACTION":0,"RSC":0} (màn chặn quyền)
/distribution TELLER {"ACTION":1,"RSC":0}
measure exit=0
# sau (HF-05)
yêu cầu đo: e59ea8d5-0988-49a8-9a1b-cf6148443532
/approvals/[id] CONTROLLER {"ACTION":1,"RSC":0}
/distribution CONTROLLER {"ACTION":1,"RSC":0}
/approvals/[id] TELLER {"ACTION":0,"RSC":0} (màn chặn quyền)
/distribution TELLER {"ACTION":1,"RSC":0}
measure exit=0
```

Giao dịch viên mở `/approvals/[id]` gặp màn chặn quyền của kênh Kiểm soát viên (như trước HF-05), nên 0 action ở
cả hai lần đo. Nút "Đối soát" không gọi gì khi mở: cờ `canReconcile` đi cùng `getTokenRequestDetailAction`.

## 4. Đột biến

Script `mutate_hf05.py` (thư mục nháp, không commit): mỗi đột biến sửa đúng chuỗi trong mã, chạy tệp test, in các
ca HF-05 đỏ (từ chữ "HF-05" trở đi) và dòng tổng, rồi trả mã gốc. Sau cả năm lượt, `git diff --stat -- app/src`
khớp trước khi chạy (13 tệp, 594 dòng thêm, 58 dòng bớt).

| Đột biến | Sửa gì |
|---|---|
| M1 | `approveTokenRequest`: `if (outcome.data.status !== 'CONFIRMED')` thành `if (false)` (PENDING lại thành COMPLETED) |
| M2 | `finalizeTokenRequest`: bản bộ nhớ bỏ `found.status !== 'EXECUTING'`; bản Postgres bỏ `AND "status" = $3` |
| M3 | `finalizeConfirmed`: ghi `appendAudit(tokenAudit)` trước, ngoài transaction, bỏ dòng sổ token khỏi `audits` |
| M4 | `reconcileExecutingOrder`: bỏ `receiptUnknown` ở nhánh ném lỗi và nhánh biên nhận khác CONFIRMED |
| M5 | `approvedAmountLabel`: dùng `expectedAmount` thay `approvedAmount` |

```text
## M1 bỏ nhánh PENDING trong approveTokenRequest
lệnh: npx vitest --run test/token-request.test.ts
exit=1
   × HF-05: duyệt khi biên nhận còn PENDING > ca 1: Mint lần đầu PENDING: EXECUTING có mã, mốc phát hành vẫn rỗng, không có token:mint SUCCESS
   × HF-05: duyệt khi biên nhận còn PENDING > ca 2: Burn PENDING: EXECUTING, không có token:burn SUCCESS
   × HF-05: đối soát yêu cầu đang thực hiện > ca 3: đối soát Mint ca 1 khi CONFIRMED: COMPLETED, có mốc, đúng một token:mint, Txn CONFIRMED; lần hai bị chặn
   × HF-05: đối soát yêu cầu đang thực hiện > ca 3b: Burn PENDING rồi đối soát CONFIRMED: COMPLETED, đúng một token:burn, Txn CONFIRMED
   × HF-05: đối soát yêu cầu đang thực hiện > ca 4: còn PENDING (gọi nhiều lần, kể cả đọc biên nhận lỗi) giữ EXECUTING; biên nhận FAILED thì FAILED
   × HF-05: đối soát yêu cầu đang thực hiện > ca 4b: dòng Txn bị mất thì đối soát tạo đúng một dòng, không tạo trùng
   × HF-05: đối soát yêu cầu đang thực hiện > ca 5: bị chặn khi không có mã giao dịch, vai không có quyền duyệt, hoặc sai chain đang chọn
   × HF-05: đối soát yêu cầu đang thực hiện > ca 5b (MINT): hai lượt đối soát song song: một lượt hoàn tất, đúng một dòng sổ token và một order:approve, không gửi gì
   × HF-05: đối soát yêu cầu đang thực hiện > ca 5b (BURN): hai lượt đối soát song song: một lượt hoàn tất, đúng một dòng sổ token và một order:approve, không gửi gì
   × HF-05: đối soát yêu cầu đang thực hiện > ca 5c: CONFIRMED mà đọc tổng cung lỗi: giữ EXECUTING, không ghi SUCCESS, không FAILED; gỡ lỗi rồi đối soát lại thì COMPLETED
   × HF-05: đối soát yêu cầu đang thực hiện > ca 5c: CONFIRMED mà thao tác chốt ném lỗi: giữ EXECUTING, không ghi gì; đối soát lại thì COMPLETED
      Tests  11 failed | 22 passed (33)

## M2 finalizeTokenRequest bỏ điều kiện status = EXECUTING (bộ nhớ + Postgres)
lệnh: npx vitest --run test/token-request.test.ts test/store-constraints.test.ts
exit=1
   × HF-05: đối soát yêu cầu đang thực hiện > ca 5b (MINT): hai lượt đối soát song song: một lượt hoàn tất, đúng một dòng sổ token và một order:approve, không gửi gì
   × HF-05: đối soát yêu cầu đang thực hiện > ca 5b (BURN): hai lượt đối soát song song: một lượt hoàn tất, đúng một dòng sổ token và một order:approve, không gửi gì
   × HF-05 ca 5b: hai lượt chốt song song, đúng một lượt đổi và đúng một bộ dòng sổ
   × HF-05: chốt yêu cầu không còn EXECUTING trả null và không ghi dòng sổ nào
   × HF-05 ca 5b: hai lượt chốt song song, đúng một lượt đổi và đúng một bộ dòng sổ
   × HF-05: chốt yêu cầu không còn EXECUTING trả null và không ghi dòng sổ nào
      Tests  6 failed | 238 passed | 1 skipped (245)

## M3 ghi sổ token trước, ngoài transaction, rồi mới chuyển trạng thái
lệnh: npx vitest --run test/token-request.test.ts
exit=1
   × HF-05: đối soát yêu cầu đang thực hiện > ca 5b (MINT): hai lượt đối soát song song: một lượt hoàn tất, đúng một dòng sổ token và một order:approve, không gửi gì
   × HF-05: đối soát yêu cầu đang thực hiện > ca 5b (BURN): hai lượt đối soát song song: một lượt hoàn tất, đúng một dòng sổ token và một order:approve, không gửi gì
   × HF-05: đối soát yêu cầu đang thực hiện > ca 5c: CONFIRMED mà thao tác chốt ném lỗi: giữ EXECUTING, không ghi gì; đối soát lại thì COMPLETED
      Tests  3 failed | 30 passed (33)

## M4 reconcileExecutingOrder bỏ cờ receiptUnknown
lệnh: npx vitest --run test/purchase-service.test.ts
exit=1
   × HF-05: lệnh mua bán chưa có biên nhận giữ EXECUTING > ca 7b: lệnh mua, đối soát hai lần khi còn PENDING vẫn EXECUTING; sau đó biên nhận CONFIRMED
   × HF-05: lệnh mua bán chưa có biên nhận giữ EXECUTING > ca 7b: lệnh mua, đối soát hai lần khi còn PENDING vẫn EXECUTING; sau đó biên nhận FAILED thật
   × HF-05: lệnh mua bán chưa có biên nhận giữ EXECUTING > ca 7c: lệnh bán, đối soát hai lần khi còn PENDING vẫn EXECUTING; sau đó biên nhận CONFIRMED
   × HF-05: lệnh mua bán chưa có biên nhận giữ EXECUTING > ca 7c: lệnh bán, đối soát hai lần khi còn PENDING vẫn EXECUTING; sau đó biên nhận FAILED thật
      Tests  4 failed | 90 passed (94)

## M5 approvedAmountLabel đổi lại dùng expectedAmount
lệnh: npx vitest --run test/fe-08-approval.test.ts
exit=1
   × HF-05 ca 8: ô "Số đã duyệt" và cột "Số duyệt" hiện approvedAmount > duyệt X bị lệch, duyệt lại Y: ô và bảng hiện Y; AMOUNT_CHANGED hiện câu lệch
   × HF-05 ca 8: ô "Số đã duyệt" và cột "Số duyệt" hiện approvedAmount > kỳ cũ (expectedAmount rỗng) sau duyệt lại hiện số; chưa có kết luận thì "Đang so số"
      Tests  2 failed | 40 passed (42)
```

## 5. Mô phỏng job A, sơ đồ luồng, ký tự cấm

Marker `@flow` giữ nguyên số bước và câu chữ; chỉ số dòng đổi, nên `docs/flows/issue.md`, `docs/flows/purchase.md`
và mục điểm cắm của `docs/tech-report.md` được sinh lại. Bước `issue:6`, `issue:7` nay nằm trong
`completeDirectIssuance` (đường dữ liệu thử).

```text
$ node scripts/check-checkpoint.mjs docs/CHECKPOINT_HF05.md docs/hf-05-giao-dich-chua-xac-nhan/requirements.md | grep -c ĐẠT
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
      Tests  1121 passed | 85 skipped (1206)
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 3 - ĐIỂM CẮM (marker)
    PASS  LỚP 3 - KHUÔN CHECKPOINT
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST
  => ĐẠT các phần đã chạy: arch markers checkpoint app
jobA exit=0
$ git diff origin/dev...HEAD -U0 | LC_ALL=C.UTF-8 grep -nP '^\+.*[\x{00B7}\x{2014}\x{2192}]' | grep -v '^[0-9]*:+++ ' | wc -l
0
```

## 6. Thiết kế đã làm và ghi chú

### 6.1 Đã làm

- **Phát hành, huỷ.** `executeIssuance` (tên giữ nguyên để ca quét mã nguồn ở `maker-checker-ui.test.ts` vẫn đúng)
  và `executeBurn` dừng ở biên nhận: `FAILED` ghi sổ thất bại và trả lỗi như cũ; còn lại trả `{ txHash, status }`.
  `approveTokenRequest`: `CONFIRMED` thì `finalizeConfirmed`; PENDING thì giữ `EXECUTING`, sổ `order:approve`
  SUCCESS "đã gửi, chưa có biên nhận, cần đối soát", trả `ok` với yêu cầu `EXECUTING`. Nhánh `ORDER_STATE` "không
  ghi được mốc phát hành" bỏ ở đường yêu cầu.
- **Chốt nguyên tử.** `ITokenRequestStore.finalizeTokenRequest({ id, to, txHash?, failureReason?,
  markIssuedProjectId?, audits })`. Postgres: `pgTransaction`, câu `UPDATE ... WHERE status = 'EXECUTING'` (0 dòng
  thì trả `null`, không ghi gì), `UPDATE "Project" ... WHERE "issuedAt" IS NULL`, `INSERT INTO "AuditLog"` ngay
  trong transaction. Bộ nhớ: kiểm rồi ghi ba vùng state trong một đoạn đồng bộ, không `await` (helper
  `stampIssuedInMemory`, `appendAuditInMemory`). Tổng cung đọc trước transaction; lỗi đọc hoặc lỗi transaction thì
  giữ `EXECUTING`, trả "đã xác nhận trên chuỗi, chưa chốt được (...). ...; bấm Đối soát lại."
- **Đối soát.** `reconcileTokenRequest` + `reconcileTokenRequestAction`: đúng spec mục 2. Đồng bộ `Txn` qua
  `syncTxnFromReceipt` (tạo nếu thiếu; PENDING giữ dòng). Ca 4b thêm: xoá sổ giao dịch rồi đối soát hai lần, chỉ
  một dòng `Txn`.
- **Lệnh mua bán.** `OrderFailure.receiptUnknown`; `finalizeOrderFailure` gặp cờ mà tra chuỗi `NOT_SETTLED` (hoặc
  chain không tra được) thì không chuyển `FAILED`, ghi sổ FAILURE "...; chưa có biên nhận, chờ đối soát", trả
  `LEDGER` đúng câu spec. Bật ở hai nhánh của `sendAndSettle` và hai nhánh của `reconcileExecutingOrder`.
- **Màn.** `/approvals/[id]`: `outcomeFeedback` chọn xanh, vàng, đỏ theo `status` trả về; N giây lấy
  `receiptTimeoutFor(chain)`; nút "Đối soát" theo `canReconcile`, khoá trong lúc chạy như hai nút kia.
  `/distribution`: ô và cột dùng `approvedAmountLabel`.
- **Ca R5 cũ:** giữ nguyên kỳ vọng, không ca nào phải sửa (chạy cả tệp ở mục 1.1: 94/94).

### 6.2 Làm khác chữ spec (để Supervisor xem)

1. `approvedAmountLabel` đặt ở tệp riêng `components/pages/distribution-amount-label.ts`, màn import vào. Lý do:
   test nạp được hàm thuần mà không phải nạp tệp `'use client'` có server action.
2. Cột "Số duyệt" của bảng hiện số **không kèm** "VNDB", như cột "Số thực tế" bên cạnh; ô "Số đã duyệt" có "VNDB".
   Hai câu "Đang so số: X VNDB" và "Chưa có (lần duyệt X VNDB lệch số trên chuỗi)" giữ nguyên ở cả hai.
3. Câu ghi mốc trong transaction đổi thêm `status` `DRAFT` sang `ISSUED` (cùng việc `markIssued` cũ vẫn làm), điều
   kiện vẫn là `"issuedAt" IS NULL` như spec. Không làm thì dự án có mốc phát hành mà còn `DRAFT`.
4. Đối soát gặp PENDING trả `ok` với yêu cầu `EXECUTING` (màn báo vàng "Chưa có biên nhận cho giao dịch...");
   gặp FAILED trả `ok` với yêu cầu `FAILED` (màn báo đỏ). Spec chỉ nói "trả thông báo".
5. Màn `/approvals/[id]` ở mã cũ **không có** câu "cần đối soát tay"; câu gần nhất là nhật ký "Đã gửi giao dịch
   ..., chưa biết kết cục, cần đối soát" (chỉ khi có mã). Yêu cầu `EXECUTING` không có mã: không nút, không đổi gì.
6. Ca 5b bản Postgres chạy ở tầng lưu trữ (mục 1.1), tầng nghiệp vụ chạy bộ nhớ: `token-request.test.ts` dựng
   trên bộ nhớ và chuỗi mock; chuyển cả tệp sang Postgres là đổi phạm vi.

### 6.3 Ngoài phạm vi, đã rà

- `mint.service.ts` (`mintToInvestor`, `whitelistInvestor`) và `demo-payment.service.ts`: **không** cùng lỗi. Gặp
  PENDING thì ghi sổ FAILURE và trả `ok` kèm `status: 'PENDING'`; không ghi mốc nghiệp vụ, không có trạng thái kết
  thúc sai. Chỗ lệch nhỏ: sổ ghi FAILURE cho giao dịch có thể vẫn thành công. Không sửa.
- Đường dữ liệu thử `issueInitialSupply` giữ hành vi cũ theo spec: PENDING vẫn ghi mốc và sổ SUCCESS
  (`completeDirectIssuance`). Đường này chỉ chạy trên mock, sau hai lớp chặn.

### 6.4 Bài học trong task

- Em viết chú thích mới theo thói quen của mã sẵn có, có dấu gạch ngang dài và mũi tên; lệnh kiểm ký tự cấm (mục 5)
  bắt được trước khi commit, đã thay hết. Câu marker bước 9 luồng mua em định sửa cho đủ ý, nhưng dòng sơ đồ
  sinh ra có dấu chấm giữa dòng của script sinh sơ đồ, nên em giữ câu cũ để phần thêm mới sạch.
- `git add -N` (đánh dấu tệp mới) làm `git stash push -- app/src` từ chối; đã gỡ đánh dấu rồi đối chứng lại.
