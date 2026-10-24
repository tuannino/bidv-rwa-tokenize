# BE-05 và FE-10: thiết kế

## 1. Dữ liệu

```sql
-- ADDED_COLUMNS (khuôn ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS; chạy trước init.sql nên chỉ mục mới dựng được)
ALTER TABLE IF EXISTS "SettlementRound" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE IF EXISTS "SettlementRound" ADD COLUMN IF NOT EXISTS "maturityDate" TEXT;
ALTER TABLE IF EXISTS "SettlementRound" ADD COLUMN IF NOT EXISTS "recallFrom" TEXT;
ALTER TABLE IF EXISTS "SettlementRound" ADD COLUMN IF NOT EXISTS "noticeDays" INTEGER;
ALTER TABLE IF EXISTS "SettlementRound" ADD COLUMN IF NOT EXISTS "openedBy" TEXT;
ALTER TABLE IF EXISTS "SettlementRound" ADD COLUMN IF NOT EXISTS "reason" TEXT;
ALTER TABLE IF EXISTS "SettlementRound" ADD COLUMN IF NOT EXISTS "freezeRequestedAt" TIMESTAMPTZ(3);
ALTER TABLE IF EXISTS "SettlementRound" ADD COLUMN IF NOT EXISTS "freezeTxHash" TEXT;
ALTER TABLE IF EXISTS "SettlementRound" ADD COLUMN IF NOT EXISTS "frozenAt" TIMESTAMPTZ(3);
ALTER TABLE IF EXISTS "SettlementRound" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMPTZ(3);
ALTER TABLE IF EXISTS "SettlementRound" ADD COLUMN IF NOT EXISTS "unfreezeRequestedAt" TIMESTAMPTZ(3);
ALTER TABLE IF EXISTS "SettlementRound" ADD COLUMN IF NOT EXISTS "unfreezeTxHash" TEXT;
ALTER TABLE IF EXISTS "SettlementRound" ADD COLUMN IF NOT EXISTS "activeChain" TEXT;
ALTER TABLE IF EXISTS "SettlementCase"  ADD COLUMN IF NOT EXISTS "burnSentAt" TIMESTAMPTZ(3);
ALTER TABLE IF EXISTS "SettlementCase"  ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMPTZ(3);
ALTER TABLE IF EXISTS "SettlementCase"  ADD COLUMN IF NOT EXISTS "reason" TEXT;
-- schema.prisma: @@unique([activeChain]) trên SettlementRound; thêm vào UNIQUE_CONSTRAINTS ở store.errors.ts
```

- Cột trạng thái là TEXT nên thêm giá trị không cần nâng kiểu. Cột mới cho phép rỗng: dòng cũ của BE-09 vẫn đọc được.
- Hồ sơ: `holderWallet` lưu chữ thường (Indexer trả chữ thường; Postgres so khớp chính xác).
- Bảng trạng thái sang cột của hồ sơ thu hồi:

| Trạng thái | Cột thời điểm | Cột mã giao dịch |
|---|---|---|
| `BURNING` (chiếm) | `burnSentAt` | `burnTxHash` đặt RỖNG khi chiếm; gắn sau bằng `attachBurnTx` |
| `BURNED` | `burnedAt` | giữ mã đang có |
| `FAILED` | `failedAt` | giữ mã đang có (để tra); ghi `reason` |

## 2. Cổng kho, thêm mới

```ts
interface ISettlementStore {
  // có sẵn, giữ nguyên cho bản đầy đủ: openRound, findRound, listRounds, setRoundStatus, createCases, markCase, listCases
  openRecallRound(input: { chain, projectId, maturityDate, recallFrom, noticeDays, openedBy, reason }): Promise<SettlementRoundRecord>;
      // snapshotId = 0, navRate = '0', status INITIATED, activeChain = chain; trùng thì UniqueConstraintError
  findActiveRound(chain): Promise<SettlementRoundRecord | null>;
  latestRecallRound(chain): Promise<SettlementRoundRecord | null>;            // projectId khác rỗng, mới nhất
  requestFreeze(input: { id, at }): Promise<boolean>;                         // WHERE status='INITIATED' AND freezeRequestedAt IS NULL
  setFreezeTx(input: { id, txHash: string | null; clearRequest?: boolean }): Promise<void>;
  completeFreeze(input: { id, frozenAt, cases: NewSettlementCase[], audit: NewAudit }): Promise<SettlementRoundRecord | null>;
      // một transaction; chỉ khi INITIATED; cases có thể rỗng; chèn theo lô không quá MAX_BULK_ROWS
  cancelRound(input: { id, cancelledAt, audit }): Promise<SettlementRoundRecord | null>;
      // chỉ khi INITIATED và freezeRequestedAt IS NULL; dịch vụ kiểm thêm isSettlementMode() là false; activeChain = null
  rescheduleRound(input: { id, maturityDate, recallFrom, noticeDays, audit }): Promise<SettlementRoundRecord | null>;
      // chỉ khi INITIATED và freezeRequestedAt IS NULL
  requestUnfreeze(input: { id, at }): Promise<boolean>;
      // WHERE status='IN_PROGRESS' AND unfreezeRequestedAt IS NULL
      //   AND NOT EXISTS (hồ sơ BURNING, hoặc BURNED có burnTxHash)
  setUnfreezeTx(input: { id, txHash: string | null; clearRequest?: boolean }): Promise<void>;
  completeUnfreeze(input: { id, audit }): Promise<SettlementRoundRecord | null>;
      // một transaction: kiểm lại điều kiện chưa đốt; status INITIATED; xoá freeze* và unfreeze*;
      // xoá hồ sơ NOTIFIED, FAILED, BURNED không mã của đợt
  addMissingCases(input: { roundId, rows: NewSettlementCase[] }): Promise<number>;   // ON CONFLICT DO NOTHING, có thể rỗng
  claimCase(input: { roundId, holderWallet, at }): Promise<SettlementCaseRecord | null>;
      // NOTIFIED|FAILED sang BURNING, burnTxHash = NULL, burnSentAt = at
  attachBurnTx(input: { roundId, holderWallet, txHash }): Promise<boolean>;          // WHERE status='BURNING' AND burnTxHash IS NULL
  settleCase(input: { roundId, holderWallet, to: 'BURNED' | 'FAILED', at, reason? }): Promise<SettlementCaseRecord | null>;  // chỉ từ BURNING
  listRoundCases(input: { roundId, statuses?: SettlementCaseStatus[] }): Promise<SettlementCaseRecord[]>;  // không giới hạn 50, sắp theo ví
  completeRound(input: { id, projectId, completedAt, audit }): Promise<SettlementRoundRecord | null>;
      // một transaction: COMPLETED, completedAt, activeChain = null, Project.status = 'CLOSED', sổ kiểm toán
}
```

- Sổ kiểm toán đi cùng transaction như mẫu `finalizeTokenRequest` (HF-05).
- `openRound` cũ vẫn gọi `assertSnapshotId`; `openRecallRound` không gọi (giá trị đánh dấu 0, QĐ-R1). Test ở `store-constraints.test.ts` giữ nguyên.

## 3. Pha thu hồi dùng chung

```ts
// lib/bank/recall-phase.ts: hàm thuần, không server-only
type RecallPhaseKind = 'NONE' | 'SCHEDULED' | 'NOTICE' | 'FROZEN' | 'CLOSED';
// NONE: không có đợt hoặc đợt CANCELLED
// SCHEDULED: INITIATED, chưa tới maturityDate (giao dịch mở, Nhà đầu tư chưa thấy)
// NOTICE: INITIATED, đã tới maturityDate
// FROZEN: IN_PROGRESS
// CLOSED: COMPLETED, hoặc Project.status = 'CLOSED'
function recallPhaseOf(round | null, project | null, todayVn: string): RecallPhase;
function tradingBlocked(phase: RecallPhase, settlementMode: boolean | null): { blocked: boolean; message: string | null };
function todayVn(now = new Date()): string;            // Intl en-CA, Asia/Ho_Chi_Minh
function addDays(date: string, days: number): string;  // tính trên ngày UTC, không lệch múi giờ

// lib/bank/recall.service.ts
async function readRecallPhase(chain): Promise<RecallPhase>;   // findActiveRound, không có thì latestRecallRound, cộng dự án
```

- Gọi từ: `placeOrder`, `previewTrade`, `getTradeContext`, `getSellerOverview`, `getPortfolio`, `evaluate` (Mint) của `token-request.service.ts`, mở kỳ chia và duyệt chia (`distribution*.service.ts`).
- `settlementModeOrUnknown` giữ nguyên cách bắt `LedgerNotImplementedError` (Stellar).

## 4. Khoá chain

- `VAULT_OPERATION_KINDS` thêm `RECALL`. Phần tiếp quản hiện viết cứng cho `CONFIG` ở cả hai kho (`postgres.vault.store.ts` điều kiện `kind = 'CONFIG'`, `memory.vault.store.ts`): đổi thành nhận cả `CONFIG` và `RECALL`, mỗi loại một mốc riêng (`takeOverConfigBefore` giữ nguyên, thêm `takeOverRecallBefore`).
- Ngân sách một thao tác thu hồi: `RECALL_BUDGET = receiptTimeoutFor(chain) + 60 giây`, tính từ lúc lấy khoá. Lô ngừng gửi hồ sơ mới khi đã dùng quá nửa ngân sách, và hạn chờ biên nhận chung không vượt phần còn lại. Khoá `RECALL` chỉ bị tiếp quản khi đã giữ lâu hơn `RECALL_BUDGET + 120 giây`, nên không lượt nào bị tiếp quản giữa chừng. Nhả trong `finally`.
- Khoá `WITHDRAW` giữ tới khi lệnh rút kết thúc (kể cả `NEEDS_REVIEW`): đóng băng và thu hồi phải chờ. Tổng quan trả `chainLock: { kind, acquiredAt } | null` để màn nói rõ đang vướng gì (lệnh rút cần Kiểm soát viên xử lý ở `/vault`). Sửa câu báo bận ở `withdraw.service.ts` và `vault.service.ts` cho đúng khi khoá là `RECALL`.
- Ba thao tác ghi (đóng băng, thu hồi lô, huỷ) lấy khoá trước khi đọc trạng thái. Vì cùng bảng khoá với vault, đóng băng hay thu hồi không chạy chồng với lưu cấu hình vault hay lệnh rút trên cùng chain; đó là chủ đích (cùng một ví ký).

## 5. Đóng băng

```
freezeToken({ chain, roundId, confirmSymbol })
  authorize('settlement:recall'); confirmSymbol phải bằng ký hiệu token dự án
  lấy khoá RECALL
  round = findActiveRound(chain), đúng roundId, INITIATED
  if ledger.isSettlementMode(): chốt (C)
  if round.freezeRequestedAt:                                   // đã từng bắt đầu gửi
     hash = round.freezeTxHash ?? mã của dòng Txn 'freeze' PENDING tạo sau freezeRequestedAt (nhận thì setFreezeTx)
     if hash:
        r = waitReceipt(hash, 1 giây)
        CONFIRMED: chốt (C)
        FAILED: setFreezeTx(null, clearRequest), Txn FAILED, sổ thất bại; báo được bấm lại     // kết cục chắc chắn
        PENDING: chưa quá RECALL_STUCK_MINUTES: báo đang chờ; quá hạn: gửi lại (bước S), KHÔNG xoá dấu
     else:
        chưa quá RECALL_STUCK_MINUTES kể từ freezeRequestedAt: báo đang chờ
        quá hạn: gửi lại (bước S), KHÔNG xoá dấu
     return
  kiểm điều kiện: today >= recallFrom; countInFlightOrders = 0; không có kỳ chia hoạt động; listTokenWallets().truncated = false
  requestFreeze(id) phải true
  S. try pending = ledger.setSettlementMode(true)
     catch LedgerError có cờ reverted (revert lúc mô phỏng, chắc chắn chưa phát): setFreezeTx(null, clearRequest); ném
     catch lỗi khác (hết giờ, mất kết nối: có thể đã phát): GIỮ dấu; ném, lần bấm sau đi nhánh trên
     submitTxn(operation 'freeze', fromWallet null, onSubmitted: setFreezeTx(hash))
     r = waitReceipt(hash, phần còn lại của ngân sách); cập nhật Txn
     CONFIRMED: chốt (C); FAILED: như trên; PENDING: báo đang chờ
C. wallets = listTokenWallets() lọc balance > 0, bỏ spvWallet() (so chữ thường)
   completeFreeze({ cases: wallets thành NOTIFIED, wptAmount = balance, payoutAmount = '0' })
```
- Gửi lại `pause` là vô hại: nếu lệnh trước đã vào khối thì lệnh sau revert lúc mô phỏng (`TokenAlreadyPaused`), và bước đầu (`isSettlementMode`) sẽ chốt. Vì vậy quy tắc treo chọn GỬI LẠI chứ không xoá dấu: xoá dấu mở đường cho huỷ đợt trong khi lệnh tạm dừng cũ vẫn có thể vào khối.
- `isTransactionKnown` không dùng cho đóng băng và mở đóng băng (nút công cộng cân bằng tải có thể trả sai); chỉ dùng như một tín hiệu phụ cho đốt (mục 6), nơi gửi lại cũng vô hại.

- `submitTxn` là hàm mới tách từ `trackTxn` (`issuance.service.ts`): ghi `Txn` PENDING, gọi `onSubmitted`, KHÔNG chờ. `trackTxn` viết lại bằng `submitTxn` cộng `waitReceipt`, hành vi cũ giữ nguyên.
- Adapter EVM: `setSettlementMode(true)` là `pause`, `false` là `unpause`, qua `write` của ProjectToken; `isSettlementMode` đọc `paused`; `isTransactionKnown` dùng `getTransaction` (không tìm thấy trả false). Thiếu mục ABI thì thêm vào `project-token.ts` từ artifact.

## 5b. Mở đóng băng

```
unfreezeToken({ chain, roundId, confirmSymbol, reason })
  authorize('settlement:recall'); confirmSymbol đúng; lấy khoá RECALL
  round IN_PROGRESS, đúng roundId
  if !ledger.isSettlementMode(): completeUnfreeze (chuỗi đã mở)
  if round.unfreezeRequestedAt: xử lý mã như đóng băng (lấy mã từ unfreezeTxHash hoặc Txn 'unfreeze' PENDING;
       CONFIRMED: completeUnfreeze; FAILED: setUnfreezeTx(null, clearRequest); treo: gửi lại, giữ dấu)
  requestUnfreeze(id) phải true (false: đã đốt ví hoặc lượt khác đang mở)
  S. try pending = ledger.setSettlementMode(false)
     catch revert lúc mô phỏng: setUnfreezeTx(null, clearRequest); ném
     catch lỗi khác: giữ dấu; ném
     submitTxn(operation 'unfreeze', onSubmitted: setUnfreezeTx(hash)); waitReceipt; cập nhật Txn
     CONFIRMED: completeUnfreeze; FAILED: xoá dấu; PENDING: báo đang chờ
```

- `recallBatch` bước đầu thêm điều kiện `unfreezeRequestedAt` rỗng.
- Thứ tự chặn đốt và mở: `requestUnfreeze` kiểm "chưa đốt" bằng câu ghi có điều kiện; `recallBatch` kiểm `unfreezeRequestedAt` rỗng dưới cùng khoá chain. Khoá chain bảo đảm hai việc không chạy chồng.
- Adapter EVM: `setSettlementMode(false)` gọi `unpause`. Mock: lỗi khi chưa bật (khớp lỗi của hợp đồng khi `unpause` lúc chưa tạm dừng; người làm đọc tên lỗi trong `ProjectToken.sol`).

## 5c. Sửa mốc và cờ trình diễn

- `env.ts` thêm `enableDemoRecall` (mặc định false) đọc `ENABLE_DEMO_RECALL`; thêm vào `.env.example` và wrangler (giá trị `false`).
- Hàm thuần `validateRecallDates({ chain, maturityDate, noticeDays, today, demo })` dùng chung cho mở đợt và sửa mốc: ngày có thật; `maturityDate >= today` (không ngoại lệ); `0 <= noticeDays <= 365`; `noticeDays >= 1` trừ khi chain là `mock`, `hardhat-local`, hoặc `demo` true.
- Tổng quan trả thêm `demoMode: boolean` và `canUnfreeze: boolean` (đã đóng băng và chưa đốt ví nào).

## 6. Thu hồi một lô

```
recallBatch({ chain, roundId })
  authorize('settlement:recall'); lấy khoá RECALL
  round IN_PROGRESS; ledger.isSettlementMode() phải true
  1. đối soát: listRoundCases(statuses ['BURNING'])
       có mã: r = waitReceipt(hash, 1 giây)
              CONFIRMED: settleCase BURNED; FAILED: settleCase FAILED (reason)
              PENDING: quá hạn treo: balanceOf = 0 thì BURNED; isTransactionKnown false thì FAILED; còn lại giữ
       không mã: tìm Txn recall PENDING của ví tạo sau burnSentAt: có thì attachBurnTx rồi xử lý như có mã
                 không có: balanceOf = 0 thì BURNED, còn lại FAILED ("gửi không thành")
  2. bổ sung: listTokenWallets() (truncated thì dừng, báo); balance > 0, bỏ spv: addMissingCases
  3. chọn: listRoundCases(statuses ['NOTIFIED','FAILED']) lấy 10 đầu
  4. tuần tự từng hồ sơ:
       claimCase (null thì bỏ qua)
       amount = balanceOf(ví)                                   // đọc SAU khi chiếm
       amount = 0: settleCase BURNED; tiếp
       try pending = ledger.burn(ví, amount)
       catch revert lúc mô phỏng: settleCase FAILED (reason); tiếp
       submitTxn(operation 'recall', fromWallet ví, amount, onSubmitted: attachBurnTx)
  5. Promise.all(waitReceipt(hash, phần còn lại của hạn chung receiptTimeoutFor(chain))) cho các mã vừa gửi
       CONFIRMED: settleCase BURNED; FAILED: settleCase FAILED; PENDING: giữ BURNING; cập nhật từng Txn
  6. còn hồ sơ khác BURNED: trả tiến độ { burned, pending, failed, remaining }
     không còn: outside = tokenInfo().totalSupply - balanceOf(spv)
       0: completeRound; khác 0: trả { outsideRemaining }
```

- Vì sao đốt trùng không làm mất token: số đốt là `balanceOf` đọc ngay trước khi gửi và hợp đồng không cho đốt quá số dư; lệnh thừa sẽ revert. Khoá chain là chốt chặn chính; chiếm hồ sơ có điều kiện là lớp thứ hai.
- Số đốt có thể khác `wptAmount` lúc lập (chỉ khi ngân hàng tự `forcedTransfer` khi đóng băng). Sổ giao dịch ghi số đốt thật; màn hiện số đốt từ sổ khi khác.

## 7. Actions và màn

| Action | Quyền | Ghi chú |
|---|---|---|
| `getRecallOverviewAction({ chain })` | `ops:read` (`assertCan`) | Một action duy nhất khi mở `/recall`; lời đọc chuỗi chạy song song |
| `openRecallAction({ chain, maturityDate, noticeDays, reason })` | `settlement:initiate` | |
| `cancelRecallAction({ chain, roundId, reason })` | `settlement:initiate` | |
| `freezeTokenAction({ chain, roundId, confirmSymbol })` | `settlement:recall` | |
| `recallBatchAction({ chain, roundId })` | `settlement:recall` | |
| `unfreezeTokenAction({ chain, roundId, confirmSymbol, reason })` | `settlement:recall` | |
| `rescheduleRecallAction({ chain, roundId, maturityDate, noticeDays, reason })` | `settlement:initiate` | |

```ts
RecallOverview = {
  chain,
  project: { id, tokenSymbol, name, status } | null,
  round: (RecallRoundView & { phase: RecallPhaseKind; daysToMaturity: number; daysToRecall: number }) | null,
  settlementMode: boolean | null,
  inFlightOrders: { placed, checking, executing },
  activeDistribution: boolean,
  chainLock: { kind: string; acquiredAt: string } | null,
  cases: Array<{ wallet, wptAmount, burnedAmount: string | null, status, txHash, reason }>,
  preview: { wallets: Array<{ wallet, balance }>, truncated: boolean } | null,   // chỉ khi chưa đóng băng
  supplyOutsideVault: string,
  canManage: boolean,                                                             // can(role, 'settlement:recall')
}
```

- Màn `/recall` trong nhóm route `(ops)` như `/config`. Nav: "Thu hồi token" cho Kiểm soát viên, "Thu hồi token (chỉ xem)" cho Giao dịch viên.
- Bố cục: hai cột trên màn rộng (trái: đợt và nút; phải: tổng cung ngoài vault, điều kiện đóng băng), bảng ví toàn bề ngang; một cột trên điện thoại. Mỗi lúc một nút chính: "Mở đợt", "Đóng băng trên toàn hệ thống" hoặc "Thu hồi toàn bộ".
- Hộp xác nhận đóng băng: "Tạm dừng {tên token} ({ký hiệu}) trên chuỗi {chain}. Mọi chuyển nhượng, mua bán {ký hiệu} dừng và không mở lại được trong bản PoC. Token khác không bị ảnh hưởng. Gõ {ký hiệu} để xác nhận."
- `/portfolio`: hộp thông báo trên cùng, màu cảnh báo có sẵn (không phải màu lỗi).
- Nhãn lịch sử giao dịch: bảng `OPERATION_LABELS` dùng chung, dùng ở `transaction-history-box.tsx`.

## 8. Quyền (sửa `permissions.ts` và test)

- `ACTIONS` thêm `settlement:recall`. `TELLER` bỏ `settlement:initiate`; `CONTROLLER` thêm `settlement:initiate`, `settlement:recall`. Sửa chú thích "Kiểm soát viên chỉ có một quyền ghi", nêu Sếp chốt 24/10.
- Test phải sửa (đã dò): `test/rbac.test.ts` dòng khoảng 304 (TELLER có `settlement:initiate`), 440 (thêm TELLER mất `settlement:initiate` vào `INTENTIONALLY_REMOVED`), 454 (`ALL_WRITE_ACTIONS` thêm `settlement:recall`), 483 (mỗi hành động có một dòng test), 550 (số quyền ghi của Kiểm soát viên). Người làm dò lại toàn bộ test quyền.

## 9. Mock

- `mint`, `mintInitialSupply` lỗi khi `settlementMode` (khớp EVM revert khi tạm dừng).
- `setSettlementMode(true)` khi đã bật: lỗi (khớp `TokenAlreadyPaused`); `setSettlementMode(false)` khi chưa bật: lỗi như hợp đồng.
- `isTransactionKnown`: true khi mã có trong trạng thái mock.

## 10. Lưu ý vận hành

- Thu hồi trên Sepolia là **không đảo ngược sau lần đốt đầu tiên**: từ đó không mở đóng băng được, toàn bộ WPT của Nhà đầu tư bị đốt, dự án `CLOSED`. Trước lần đốt đầu tiên mở đóng băng được. Diễn tập trên `mock` hoặc `hardhat-local`. Ghi vào UserGuide và runbook.
