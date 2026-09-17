# BE-01 — Mở rộng ILedgerPort cho ba luồng: requirements

Spec giao việc: `docs/be-01-ledger-port/requirements.md`.
Tài liệu này là bản Kiro làm việc — ghi lại **hiện trạng đã đo** và **kết quả thực tế**,
để task sau không phải đọc lại mã nguồn mới biết cái gì đã có, cái gì còn nợ.

Nhánh `feat/ledger-port-3flows`, tạo từ `dev` @ `2e1daa9`.

## 1. Mục tiêu

Ba luồng mint, burn, distribute có đường đi xuống chuỗi qua `ILedgerPort` (LUẬT #1).

Đây là mắt nghẽn: bảy màn hình và sáu service chờ task này. Làm **một lần cho đúng**,
tránh sửa interface giữa sprint gây xung đột hàng loạt.

## 2. Hiện trạng đã đo (không phải theo trí nhớ)

### 2.1. `ILedgerPort` trước BE-01

11 method: 4 tuân thủ, 4 phát hành/thu hồi, 2 đọc, 1 chờ biên nhận. Ba adapter `evm`,
`mock`, `stellar`.

### 2.2. Contract có thật trên `dev`

`git grep` cho `mintInitialSupply`, `executePurchase`, `PrimarySale`, `PurchaseMatcher`,
`settlementMode`, `navRate` → **không kết quả**. Không có `docs/sc-02*` hay `docs/sc-03*`.
Kết luận: **SC-02 và SC-03 chưa merge**, phải theo lối đi tắt ở `design.md` mục 5.

| Contract | Hàm dùng được cho BE-01 |
|---|---|
| `ProjectToken` | `mint`, `agentBurn`, `transfer`, `forcedTransfer`, `setWhitelisted`, `setFrozen`, `isWhitelisted`, `isFrozen`, `paused`, `setPaused`, `snapshot`, `balanceOfAt`, `totalSupplyAt`, `getCurrentSnapshotId`, `burnFrom`, `allowance`, `approve`, event `Snapshot(uint256)` |
| `VNDToken` | `balanceOf`, `allowance`, `approve`, `mint`, `burn`, `transfer` |
| `ProfitDistributor` | `createDistribution(amount, period)`, `distributeTo(distributionId, accounts)`, `entitlementOf`, `previewClaim`, `hasClaimed`, `distributions(i)`, `payoutToken`, event `DistributionCreated` |
| `Redemption` | `rate`, `setRate`, `paused`, `setPaused`, `quote`, `redeem`, `fund`, `withdraw` |

**Ba điểm không khớp với chữ ký `ILedgerPort`** (nguồn của 4 câu hỏi mở trong checkpoint):

1. `ProfitDistributor.distributeTo` nhận **`distributionId`**, không nhận `snapshotId`.
2. Không contract nào có cờ "đang tất toán" đúng nghĩa. `ProjectToken.paused` khớp hành vi
   R6.3 (chặn chuyển nhượng, `agentBurn` vẫn chạy vì đặt `_forcedMove`) nhưng mang nghĩa
   khác; `Redemption.paused` thì **ngược hướng**.
3. `ProjectToken.mint` gọi được nhiều lần và **không** lưu cờ "đã phát hành nguồn cung ban
   đầu", nên không giữ được R1.3 ở tầng adapter.

### 2.3. Chi tiết `ERC20Snapshotable` (đã đọc mã, không đoán)

- Mã snapshot đầu tiên là **1**; `getCurrentSnapshotId()` trả `0` khi chưa chốt lần nào.
- `_valueAt` revert `"Snapshot: id la 0"` và `"Snapshot: id chua ton tai"`.
- `_snapshot()` emit `Snapshot(id)` — **nguồn duy nhất** đọc được mã sau khi gửi tx.

### 2.4. Quy ước phải giữ

Số lượng dùng `bigint`; lỗi dùng `LedgerError` với thông báo cho người dùng cuối; method
chưa hiện thực dùng `LedgerNotImplementedError`; guard dùng chung `assertPositiveAmount`;
`evm.adapter` luôn mô phỏng trước khi gửi. **Không sửa** `assertPositiveAmount`,
`LedgerError`, `DEFAULT_RECEIPT_TIMEOUT_MS`.

## 3. Yêu cầu chức năng — kết quả

Nội dung R1–R8 giữ nguyên như `docs/be-01-ledger-port/requirements.md`. Dưới đây là kết quả.

| Yêu cầu | mock | evm | stellar |
|---|---|---|---|
| R1 phát hành một lần (`mintInitialSupply`, `isInitialSupplyMinted`) | ✅ | ⏳ SC-02 | ⏳ Phase 7 |
| R2 khớp lệnh (`quotePurchase`, `paymentBalanceOf`, `paymentAllowanceOf`, `executePurchase`) | ✅ | 1/4 (`paymentBalanceOf`) | ⏳ Phase 7 |
| R3 kiểm trước (`canTransfer`) | ✅ | ✅ | ⏳ Phase 7 |
| R4 chốt quyền (`takeSnapshot`, `balanceOfAt`, `totalSupplyAt`) | ✅ | ✅ | ⏳ Phase 7 |
| R5 chia lợi nhuận (`profitPoolBalance`, `distributeBatch`) | ✅ | 1/2 (`profitPoolBalance`) | ⏳ Phase 7 |
| R6 tất toán (`setSettlementMode`, `isSettlementMode`, `setNavRate`, `navRate`) | ✅ | ⏳ chờ chốt ngữ nghĩa | ⏳ Phase 7 |

**R4.4 — KHÔNG có method liệt kê người nắm giữ.** ERC-20 chỉ lưu bảng số dư theo địa chỉ,
không lưu danh sách địa chỉ. Danh sách ví cần chia / cần tất toán lấy từ **cơ sở dữ liệu**
(lệnh mua đã hoàn tất, vị thế nhà đầu tư), về sau từ **Indexer** (IN-02). BE-05 và BE-06
dựng danh sách rồi truyền vào `distributeBatch`. Lý do đã viết vào `ledger.port.ts`,
`docs/tech-report.md` mục 1.6.A + 3.1, và `.kiro/steering/lessons.md`.

**Sai lệch đã ghi nhận:** `design.md` nói "17 method" nhưng danh sách chữ ký ở mục 2 có
**16**. Đã đếm lại và theo danh sách chữ ký. `ILedgerPort` = 11 + 16 = **27** method.

## 4. Ngoài phạm vi

Logic nghiệp vụ gọi các method này (BE-02…BE-07); chia lô và chạy lại lô lỗi (BE-06);
tiến trình hẹn giờ (BE-07); adapter Stellar hiện thực thật (Phase 7).

## 5. Điều kiện hoàn thành — đã đạt

- [x] Mọi method mới có ở cả ba adapter (TypeScript bắt buộc: thiếu là `TS2740`).
- [x] `mock.adapter` từ chối đúng mọi ca hợp đồng thật từ chối — 9/9 dòng bảng `design.md`
      mục 3 có test riêng. Đã thử 3 đột biến để chứng minh test không rỗng.
- [x] `stellar.adapter` ném lỗi rõ ràng, 0 giá trị giả.
- [x] Không kiểu `viem` nào ở biên interface.
- [x] `grep -rnE "from '(viem|ethers)'" app/src/ | grep -v "src/lib/"` rỗng.
- [x] Test mock ledger 11 → 48; toàn app 50 → 91.
- [x] `bash scripts/run-local-all.sh` xanh 6/6.
- [x] `docs/tech-report.md` mục 3.1 có bảng 27 method / 7 nhóm.

Checkpoint: `docs/CHECKPOINT_BE01.md`.
