# HF-05 (bản 2): giao dịch chưa có biên nhận không được coi là xong hay thất bại; màn chia hiện đúng số đã duyệt

> Mức kiểm chứng: **cao** (trạng thái phát hành, huỷ token, lệnh mua bán, số tiền chia). Nhánh `fix/hf-05-giao-dich-chua-xac-nhan` từ `dev` @ `4d17bc9` (PR #68).
> Nguồn: UserGuide 21/10 Phụ lục C, lệch L-13 và L-20; Supervisor rà thêm luồng mua bán, đặt mã mới L-91.

## Mục tiêu

1. Hết thời gian chờ biên nhận (hardhat 30 giây, Sepolia 90 giây) thì yêu cầu phát hành, huỷ và lệnh mua bán **giữ trạng thái đang thực hiện kèm mã giao dịch**, không thành COMPLETED, không thành FAILED.
2. Kiểm soát viên có nút **Đối soát** cho yêu cầu phát hành, huỷ đang EXECUTING có mã giao dịch, để chốt theo biên nhận thật.
3. Màn `/distribution` hiện đúng số đã duyệt.

## Hiện trạng đã đo (đọc mã tại `4d17bc9`)

Quy ước: đường dẫn tính từ `app/src/`.

**L-13: phát hành, huỷ.**
- `lib/ledger/evm.adapter.ts:1456-1475`: `waitReceipt` hết giờ trả `{ status: 'PENDING' }`, không ném lỗi. Đúng thiết kế: giao dịch vẫn có thể vào block sau.
- `lib/bank/issuance.service.ts:286` (`executeIssuance`) và `lib/bank/token-request.service.ts:577` (`executeBurn`) chỉ coi `FAILED` là thất bại. PENDING đi tiếp như thành công:
  - Mint lần đầu ghi mốc `issuedAt` vào bảng dự án (`issuance.service.ts:300-330`), dù chuỗi chưa có token.
  - Ghi sổ `token:mint` hoặc `token:burn` SUCCESS.
  - `approveTokenRequest` chuyển yêu cầu sang COMPLETED, ghi `order:approve` SUCCESS (`token-request.service.ts:505-520`).
  - Màn `/approvals/[id]` báo "Đã chấp nhận. Yêu cầu đã thực hiện xong trên chuỗi." (`components/pages/approval-detail.tsx:91`).
- Nếu sau đó giao dịch revert, database nói đã phát hành còn chuỗi thì không. Không có đường nào sửa lại.

**L-91 (mới): lệnh mua bán.**
- `lib/bank/purchase.service.ts:1585-1630`: biên nhận khác CONFIRMED (gồm PENDING) đi vào `finalizeOrderFailure`. Hàm này tra `OrderSettled` trên chuỗi; giao dịch còn nằm chờ thì tra không thấy, lệnh bị ghi **FAILED** (trạng thái kết thúc).
- Vài giây sau giao dịch vào block: VNDB và WPT đã chuyển, lệnh vẫn FAILED. Màn `/transactions` không can thiệp được lệnh FAILED.
- Cùng lỗi với nhánh `waitReceipt` ném lỗi sau khi đã gửi (`purchase.service.ts:1586-1605`) khi tra chuỗi không thấy.

**L-20: số đã duyệt ở `/distribution`.**
- `components/pages/distribution-approval.tsx:172` (ô "Số đã duyệt") và `:300` (cột "Số duyệt" của bảng Lịch sử kỳ chia) hiện `period.expectedAmount`.
- `expectedAmount` là số Kiểm soát viên gõ ở **lần duyệt đầu**. Duyệt lại chỉ ghi `approvedAmount`, không đổi `expectedAmount` (`lib/bank/distribution-approval.service.ts:442`). Hệ quả:
  - Sau duyệt lại, màn vẫn hiện số cũ là số đã duyệt.
  - Kỳ tạo trước FE-08 (`expectedAmount` rỗng) được duyệt lại thì hiện "chưa có" dù đã APPROVED.
  - Kỳ AMOUNT_CHANGED hiện số đã bị chuỗi bác như thể là số đã duyệt.
- View đã có sẵn `approvedAmount` (`lib/bank/distribution.service.ts:229`), chỉ cần màn dùng đúng.

## Việc cần làm

1. **Một luật chung cho cả ba luồng:** đã có mã giao dịch mà chưa có biên nhận (PENDING, hoặc chờ biên nhận ném lỗi) thì chưa có kết cục. Giữ nguyên EXECUTING kèm mã giao dịch, không ghi mốc nghiệp vụ, không ghi sổ SUCCESS cho thao tác token.
2. **Phát hành, huỷ:**
   - **Chốt kết quả nguyên tử (bản 2, góp ý 2):** mọi tác động database sau khi chuỗi xác nhận gom vào **một thao tác lưu trữ duy nhất** `finalizeTokenRequest`, chạy trong một transaction Postgres (`pgTransaction` sẵn có ở `lib/store/postgres.pool.ts`):
     1. `UPDATE TokenRequest SET status = 'COMPLETED' ... WHERE id = $1 AND status = 'EXECUTING'`. Không có dòng nào đổi thì dừng, không ghi gì, trả `null` (lượt khác đã chốt);
     2. Mint lần đầu: `UPDATE Project SET issuedAt = now() WHERE id = $2 AND issuedAt IS NULL`. Không đổi dòng nào thì **không phải lỗi** (mốc đã có). Mỗi chain chỉ có một yêu cầu Mint đang chờ (BE-12), nên không có hai yêu cầu khác nhau tranh mốc;
     3. ghi sổ `token:mint` hoặc `token:burn` SUCCESS và `order:approve` SUCCESS.
     - Bản bộ nhớ (`memory.*.store.ts`) làm cùng ba bước **không có `await` xen giữa** phép kiểm và các phép ghi, để có cùng tính nguyên tử.
     - Đọc tổng cung trên chuỗi (cho chi tiết sổ) làm **trước** transaction. Đọc lỗi thì dừng, giữ EXECUTING, báo "đã xác nhận trên chuỗi, chưa chốt được, bấm Đối soát lại". Không ghi gì vào database ngoài dòng giao dịch (bước dưới).
     - Transaction lỗi (mất kết nối, lỗi ghi): rollback toàn bộ, yêu cầu giữ EXECUTING, trả cùng câu trên. **Biên nhận CONFIRMED không bao giờ dẫn tới FAILED.**
     - `approveTokenRequest` (nhánh CONFIRMED) và `reconcileTokenRequest` dùng chung thao tác này. Nhánh "không ghi được mốc phát hành" cũ (`ORDER_STATE`) bỏ ở đường yêu cầu. Đường dữ liệu thử `issueInitialSupply` giữ hành vi cũ.
   - **Sổ giao dịch (góp ý 3):** sau mọi lần đọc biên nhận (duyệt và đối soát), cập nhật dòng `Txn` tìm theo `(chain, txHash)` (`findTxnByHash` rồi `updateTxnStatus`), sang CONFIRMED hoặc FAILED; PENDING thì giữ. Không có dòng thì tạo một dòng, như `reconcileExecutingOrder` đang làm. Không tạo dòng trùng. Bước này idempotent nên làm ngoài transaction, trước khi chốt.
   - `approveTokenRequest` gặp PENDING: yêu cầu giữ EXECUTING (mã giao dịch đã gắn qua `attachRequestTxHash`), ghi `order:approve` với `outcome` SUCCESS, chi tiết ghi rõ "đã gửi, chưa có biên nhận, cần đối soát". Trả `ok` với yêu cầu ở EXECUTING, để màn phân biệt được với COMPLETED.
   - Hàm mới `reconcileTokenRequest({ requestId, chain })` với quyền `order:approve`, chỉ nhận yêu cầu EXECUTING có `txHash`. Đọc biên nhận một lần, chờ tối đa 1 giây (cùng mức `RECHECK_RECEIPT_TIMEOUT_MS` của luồng chia), rồi:
     - CONFIRMED: `finalizeTokenRequest`. Trả `null` thì báo "yêu cầu đã được chốt ở lượt khác", không ghi gì thêm;
     - FAILED: chuyển FAILED kèm lý do bằng câu cập nhật có điều kiện `from: ['EXECUTING']`, cùng transaction với dòng sổ `order:approve` FAILURE;
     - PENDING hoặc đọc biên nhận ném lỗi: giữ nguyên, trả thông báo "chưa có biên nhận".
     - Kiểm `chain` của yêu cầu trùng chain đang chọn, như `approveTokenRequest`.
     - Không bao giờ gửi giao dịch mới.
   - Server action `reconcileTokenRequestAction` trong `app/actions/token-request.ts`.
3. **Màn `/approvals/[id]`:**
   - Kết quả duyệt là EXECUTING: báo màu vàng "Đã gửi lên chuỗi nhưng chưa có xác nhận sau N giây. Yêu cầu giữ trạng thái Đang thực hiện; bấm Đối soát sau ít phút." Không dùng câu "đã thực hiện xong".
   - Nút **Đối soát** chỉ hiện khi yêu cầu EXECUTING, có `txHash`, và vai có quyền duyệt.
   - Yêu cầu EXECUTING không có `txHash`: giữ câu "cần đối soát tay" như cũ. Trường hợp này để task xử lý yêu cầu kẹt (L-12, L-15).
4. **Lệnh mua bán:** biên nhận PENDING, hoặc chờ biên nhận ném lỗi sau khi đã có mã giao dịch, mà tra chuỗi chưa thấy `OrderSettled`:
   - lệnh giữ EXECUTING kèm mã giao dịch; ghi sổ FAILURE với chi tiết "chưa có biên nhận, chờ đối soát";
   - trả lỗi `LEDGER` với câu "Giao dịch đã gửi, chưa có xác nhận. Lệnh giữ trạng thái đang quyết toán, ngân hàng sẽ đối soát." (không dùng chữ "thất bại");
   - lệnh này đi vào đường can thiệp sẵn có của BE-17 ("EXECUTING có mã: chỉ đối soát") ở `/transactions`. Không thêm nút mới.
   - Tra chuỗi thấy `OrderSettled` thì giữ hành vi hiện tại (chốt COMPLETED từ chuỗi).
   - **Áp cùng luật cho `reconcileExecutingOrder` (bản 2, góp ý 1)** (`purchase.service.ts:1223`): nhánh chờ biên nhận ném lỗi và nhánh biên nhận PENDING hiện đều gọi `finalizeOrderFailure` và có thể ghi FAILED. Hai nhánh này cũng bật `receiptUnknown`. Chỉ biên nhận FAILED thật (revert) mới ghi FAILED. Đối soát nhiều lần khi giao dịch còn chờ phải giữ EXECUTING, không phát lại giao dịch.
5. **Màn `/distribution` (L-20):** ô "Số đã duyệt" và cột "Số duyệt" theo bảng sau.

   | Tình huống | Hiển thị |
   |---|---|
   | `approvedAmount` có giá trị | `approvedAmount` VNDB |
   | `approvalStatus` rỗng, `expectedAmount` có giá trị | "Đang so số: X VNDB" (X là `expectedAmount`) |
   | `approvalStatus` = AMOUNT_CHANGED | "Chưa có (lần duyệt X VNDB lệch số trên chuỗi)" |
   | Còn lại | "chưa có" ở ô, "không có" ở bảng |

   Cột "Duyệt lại từ" giữ nguyên.
6. **UserGuide vào repo:** chép `docs/USER_GUIDE.md` từ gói spec (bản Supervisor 21/10, chốt `24f3b7c`), rồi sửa theo HF-05:
   - mục 3.4.4 (`/approvals/[id]`) và 3.5.2 (`/distribution`) theo hành vi mới;
   - xoá L-13 và L-20 khỏi khối Lệch của màn và khỏi Phụ lục C; Phụ lục A.2 bỏ ghi chú L-13 ở dòng COMPLETED;
   - L-91 (lệnh mua bán) chỉ ghi vào dòng lịch sử là đã sửa ở HF-05, không thêm vào Phụ lục C;
   - dòng "Chốt tại" ghi commit HF-05; thêm một dòng vào bảng Lịch sử cập nhật.
   - Checkpoint ghi "UserGuide: đã cập nhật mục 3.4.4, 3.5.2, Phụ lục A, C".

## Ràng buộc

- **Hiệu năng (bài học 9):** không thêm server action nào khi mở màn. Đối soát chỉ chạy khi bấm nút: đúng 1 lần đọc biên nhận, chờ tối đa 1 giây. Đo lại `/approvals/[id]` và `/distribution`: số action khi mở giữ nguyên (1 và 1).
- Không đổi lược đồ database, hợp đồng, quyền, `ILedgerPort`. Được thêm phương thức vào cổng lưu trữ `ITokenRequestStore` (cả bản Postgres và bộ nhớ).
- Không thêm trạng thái mới. Dùng EXECUTING sẵn có.
- `mint.service.ts` và `demo-payment.service.ts` (đường dữ liệu thử) không thuộc phạm vi. Ghi vào báo cáo nếu thấy cùng lỗi.

## Tác động

- `lib/bank/issuance.service.ts`, `lib/bank/token-request.service.ts`, `lib/bank/purchase.service.ts`
- `lib/store/token-request.store.port.ts`, `postgres.token-request.store.ts`, `memory.token-request.store.ts`
- `app/actions/token-request.ts`
- `components/pages/approval-detail.tsx`, `components/pages/distribution-approval.tsx`
- Test: `test/token-request.test.ts`, `test/purchase-service.test.ts`, `test/fe-08-approval.test.ts`
- `docs/USER_GUIDE.md` (mới), `docs/tech-report.md`, `docs/CHECKPOINT_HF05.md`, `.kiro/task-status.json` (HF-05 vào `done`)

## Điều kiện hoàn thành

- [ ] `token-request.test.ts` có các ca mới, mỗi ca xanh với mã mới và đỏ với mã cũ:
  - HF-05 ca 1: duyệt Mint, `waitReceipt` trả PENDING. Yêu cầu EXECUTING có `txHash`; `issuedAt` vẫn rỗng; không có dòng sổ `token:mint` SUCCESS.
  - HF-05 ca 2: duyệt Burn, PENDING. Yêu cầu EXECUTING; không có `token:burn` SUCCESS.
  - HF-05 ca 3: đối soát ca 1 khi biên nhận CONFIRMED. Yêu cầu COMPLETED, `issuedAt` có giá trị, đúng một dòng `token:mint` SUCCESS, dòng `Txn` của mã giao dịch là CONFIRMED (một dòng, không trùng). Bấm đối soát lần hai trả lỗi trạng thái, không ghi thêm.
  - HF-05 ca 3b: Burn PENDING rồi đối soát CONFIRMED: COMPLETED, đúng một dòng `token:burn` SUCCESS, `Txn` CONFIRMED.
  - HF-05 ca 4: đối soát khi biên nhận FAILED cho FAILED và `Txn` FAILED; khi còn PENDING (gọi nhiều lần) thì giữ EXECUTING, `Txn` vẫn PENDING.
  - HF-05 ca 5: đối soát bị chặn khi yêu cầu không có `txHash`, vai không có quyền duyệt, hoặc sai chain đang chọn.
  - HF-05 ca 5b (đồng thời): hai lượt đối soát cùng một yêu cầu đã CONFIRMED chạy song song (`Promise.all`): đúng một lượt trả hoàn tất, đúng một dòng sổ SUCCESS cho thao tác token, đúng một dòng `order:approve` SUCCESS do lượt chốt ghi (dòng "đã gửi, chưa có biên nhận" của lần duyệt không tính), `ledger.mint`, `ledger.burn` không được gọi. Chạy trên bản bộ nhớ; bản Postgres chạy cùng ca nếu môi trường kiểm có Postgres (job D chưa có thì ghi lại).
  - HF-05 ca 5c (lỗi sau xác nhận): biên nhận CONFIRMED nhưng đọc tổng cung ném lỗi (hoặc thao tác chốt ném lỗi). Yêu cầu giữ EXECUTING, không có dòng `token:mint` SUCCESS, không có FAILED. Gỡ lỗi rồi đối soát lại thì COMPLETED.
- [ ] `purchase-service.test.ts` thêm chế độ `receipt-pending`:
  - HF-05 ca 6: lệnh mua, `waitReceipt` trả PENDING, tra chuỗi không thấy. Lệnh EXECUTING có mã giao dịch, không FAILED.
  - HF-05 ca 7: như ca 6 nhưng chờ biên nhận ném lỗi sau khi có mã giao dịch.
  - HF-05 ca 7b: lệnh ở ca 6 qua đối soát (đường can thiệp `reconcileExecutingOrder`) khi biên nhận vẫn PENDING, gọi hai lần: vẫn EXECUTING. Sau đó biên nhận CONFIRMED: COMPLETED; hoặc FAILED thật: FAILED. Đếm số lần gọi `executePurchase` hoặc `executeSale`: đúng 1 (lần gửi đầu).
  - HF-05 ca 7c: như 7b cho lệnh bán.
  - Các ca R5 cũ giữ nguyên kỳ vọng. Ca nào phải đổi kỳ vọng thì ghi lý do trong checkpoint.
- [ ] `fe-08-approval.test.ts` HF-05 ca 8 (kiểm hàm hiển thị, hoặc render): duyệt X, duyệt lại Y, ô "Số đã duyệt" hiện Y. Kỳ cũ `expectedAmount` rỗng sau duyệt lại hiện số. AMOUNT_CHANGED hiện câu lệch.
- [ ] Nút Hardhat: `evm-issuance`, `evm-order-settlement`, `fe-08-approval-evm` xanh.
- [ ] Bản dựng và e2e `maker-checker`, `ops-transactions` xanh. Đo số action khi mở `/approvals/[id]`, `/distribution` ghi vào checkpoint.
- [ ] Ít nhất 5 đột biến bị bắt: bỏ nhánh PENDING ở `approveTokenRequest`; `finalizeTokenRequest` bỏ điều kiện `status = 'EXECUTING'`; ghi sổ token trước bước chuyển trạng thái (ngoài transaction); `reconcileExecutingOrder` bỏ cờ `receiptUnknown`; màn chia đổi lại `expectedAmount`.
- [ ] Mô phỏng job A xanh.

## Không làm

- Không làm đối soát cho yêu cầu EXECUTING **không** có mã giao dịch, không làm hết hạn yêu cầu PENDING: task xử lý yêu cầu kẹt sau HF-05 (L-12, L-15, L-25).
- Không thêm hộp xác nhận trước "Chấp nhận" (L-15).
- Không sửa dữ liệu production bằng tay.
