# SC-06: Vault chia lợi nhuận và nối luồng chia lên EVM (gộp SC-05)

| | |
|---|---|
| Nhánh | `feat/sc-06-chia-loi-nhuan`, từ `dev` **sau khi SC-03 merge** (đo lại nền trước khi làm) |
| Điểm | 14 (SC-06 8 + SC-05 3, thêm 3 cho phục hồi giao dịch, vòng đời kỳ hết hạn, chuyển đổi mock cũ) |
| Mức kiểm chứng | **Cao** (hợp đồng giữ tiền lợi nhuận của nhà đầu tư) |
| Trạng thái spec | **Bản 2.1, ngày 20/10/2026**: đã xử lý review của Codex; chủ dự án chốt CH-1 đến CH-6 theo đề xuất. Giao làm sau khi SC-03 merge |
| Thứ tự | Sau SC-03. Trước FE-05 và OP-05, để Sepolia triển khai lại một lần với đủ hợp đồng |
| Căn cứ | DS-01 bản 5 (kèm spec này): QĐ-11, QĐ-12, QĐ-13 (cập nhật), QĐ-14, QĐ-19, QĐ-21, QĐ-27 đến QĐ-31; kế hoạch v6.1 dòng SC-05, SC-06 |

## Mục tiêu

1. `ProfitDistributor` thành **vault chia lợi nhuận một chiều**: tiền vào bằng chuyển VNDB thường, chỉ ra cho
   người được chia; không có đường rút về cho SPV hay địa chỉ tuỳ chọn.
2. Mở kỳ chia trên EVM tạo đúng **một** kỳ trong hợp đồng cho mỗi mã kỳ, số tiền do chuỗi chốt; ứng dụng
   **phục hồi được** khi giao dịch đã lên chuỗi mà database chưa ghi.
3. Chia theo lô trên EVM chạy được (gỡ `@blocked SC-05`); phần của SPV vào vault (QĐ-12).
4. Số tiền kỳ chia được đẩy vào `closePeriod` của vault thanh toán **đúng một lần** cho mỗi kỳ (QĐ-13, QĐ-19).
5. "Đã trả" xác định bằng trạng thái trên chuỗi (QĐ-14); kỳ hết hạn hoặc đã đóng có trạng thái kết thúc riêng,
   không chặn tiến trình tự động.

**Phạm vi:** giữ luồng BE-06 (Giao dịch viên mở kỳ, chia lô) và BE-07 (tiến trình tự động). Thiết kế lại nghiệp
vụ là BE-18; màn quản trị là FE-08.

## Hiện trạng đã đo (Supervisor, `dev` @ `725f2c1`; đo lại sau khi SC-03 merge)

```bash
grep -n "function createDistribution\|safeTransferFrom(msg.sender" packages/contracts-evm/contracts/ProfitDistributor.sol
# createDistribution(amount, period) KÉO tiền từ người gọi; nhãn kỳ `period` không chống trùng
grep -n "function sweepDust" packages/contracts-evm/contracts/ProfitDistributor.sol
# sweepDust(id, to): chuyển phần còn lại tới địa chỉ TUỲ CHỌN
grep -rn "sweepDust\|DustSwept" packages/contracts-evm/test app/test app/src | cut -d: -f1 | sort | uniq -c
# sc-10 (8), full-cycle (2), spec-p7 (2: P7-22, P7-23), distribution-service.test (2), mock-ledger.test (1),
# distribution.service.ts (1), mock.adapter.ts (1)
grep -n "@blocked SC-05" app/src/lib/ledger/evm.adapter.ts
grep -n "takeSnapshot()\|poolAfter !== poolBefore" app/src/lib/bank/distribution.service.ts
grep -n "distributable: s.profitPool" app/src/lib/ledger/mock.adapter.ts
# mock: kỳ mới lấy TOÀN BỘ quỹ, kể cả phần kỳ trước còn nợ (tính trùng)
grep -n "settleBalanceMark\|detectNewFunds" app/src/lib/bank/distribution-trigger.service.ts
# BE-07: tiền mới = số dư quỹ - mốc (totalAmount - đã chi)
grep -n "DISTRIBUTION_PERIOD_STATUSES\|DISTRIBUTION_PAYOUT_STATUSES" app/src/lib/store/distribution.store.port.ts
# kỳ: OPEN, DISTRIBUTING, COMPLETED; hồ sơ: PENDING, SENT, PAID, FAILED. Không có trạng thái hết hạn
grep -n "periodKey     String               @unique" app/prisma/schema.prisma
# periodKey duy nhất TOÀN HỆ, không theo chain
```

## Quyết định thiết kế

### QĐ-A. Sổ dự trữ trong `ProfitDistributor`

- `uint256 public totalReserved`: tổng phần còn phải trả của các kỳ chưa đóng. Tạo kỳ cộng `amount`; `_claim`
  trừ số vừa trả; đóng kỳ trừ `amount - claimed`.
- `unallocatedBalance()` = số dư VNDB của hợp đồng trừ `totalReserved` nếu dương, ngược lại 0.
- Bất biến kiểm thử: `totalReserved == tổng(amount - claimed)` của kỳ chưa đóng, và `totalReserved <= số dư`
  (trừ khi `BURNER_ROLE` đốt tiền trong quỹ: giả định tin cậy).

### QĐ-B. Tạo kỳ từ quỹ, mã kỳ chống trùng trên chuỗi

```solidity
function createDistributionFromPool(string calldata period)
  external onlyRole(DISTRIBUTOR_ROLE) nonReentrant returns (uint256 id);
function distributionIdOfPeriod(string calldata period) external view returns (bool exists, uint256 id);
```

- `period` khác rỗng và **chưa từng dùng** (lưu `mapping(bytes32 => uint256)` theo `keccak256(bytes(period))`,
  lưu `id + 1` để phân biệt chưa có), sai thì revert `EmptyPeriod` hoặc `DuplicatePeriod(period)`.
- `amount = unallocatedBalance()`, phải lớn hơn 0 (`NothingToDistribute`). Chụp ảnh, tổng cung tại ảnh chụp lớn
  hơn 0, tạo kỳ (hạn nhận cố định theo SC-10), `totalReserved += amount`, phát `DistributionCreated`.
- Không kéo tiền từ người gọi: tiền đã nằm sẵn trong hợp đồng.
- Nhờ chống trùng trên chuỗi, gửi lại cùng mã kỳ **không thể** tạo kỳ thứ hai, và ứng dụng tra được mã kỳ chuỗi
  từ `periodKey` khi mất biên nhận (QĐ-F).
- `createDistribution(amount, period)` (kéo tiền) giữ cho `ProfitDistributorOracle` và bộ cũ, chỉ thêm
  `totalReserved += amount`; không ghi vào bảng chống trùng.

### QĐ-C. Đóng kỳ trả phần còn lại về quỹ (CH-1)

- Thay `sweepDust(id, to)` bằng `closeDistribution(uint256 id)`, vai `DEFAULT_ADMIN_ROLE`: chỉ sau
  `claimDeadline`; gọi lần hai revert `DistributionClosed`; `released = amount - claimed`; `totalReserved -=
  released`; **không chuyển tiền**; phát `DistributionClosed(id, released)`; bỏ `DustSwept`. `claimed` giữ nghĩa
  "đã trả".
- Sau thay đổi, chỉ `_claim` chuyển VNDB ra khỏi hợp đồng.
- **Ngoại lệ sửa bộ kiểm cũ** (được duyệt, checkpoint liệt kê từng ca): mọi ca dùng `sweepDust` hoặc kiểm tiền được
  quét ra ngoài, gồm `sc-10-va-hop-dong.test.js`, `full-cycle.test.js` (kiểm treasury nhận tiền sau quét),
  `spec-p7-profit-distribution.test.js` (P7-22, P7-23), và các tệp kiểm thử app liệt kê ở "Hiện trạng". Thay khẳng
  định "tiền tới ví X" bằng: số dư hợp đồng không đổi, `totalReserved` giảm đúng `released`, `unallocatedBalance`
  tăng đúng `released`. Các ý nghĩa còn lại (kỳ đóng không trả được, đóng trước hạn revert, đóng hai lần revert)
  giữ nguyên.

### QĐ-D. Cổng chuỗi (gộp SC-05)

```ts
profitPoolBalance(): Promise<bigint>;     // GIỮ: tổng số dư quỹ, để hiển thị và đối soát
unallocatedProfit(): Promise<bigint>;     // MỚI: căn cứ mở kỳ và ngưỡng tiền mới (BE-07)
reservedProfit(): Promise<bigint>;        // MỚI: tổng dự trữ, để phát hiện quỹ bị hụt
openDistribution(periodKey: string): Promise<TxResult>; // MỚI: gửi createDistributionFromPool, trả mã giao dịch ngay
findDistribution(periodKey: string): Promise<ChainDistribution | null>; // MỚI: tra theo nhãn, kể cả khi mất biên nhận
distributionState(distributionId: number): Promise<ChainDistribution>;  // MỚI
distributeBatch(distributionId: number, wallets: readonly string[]): Promise<TxResult>; // ĐỔI
isDistributionPaid(distributionId: number, wallet: string): Promise<boolean>;            // MỚI
closeDistribution(distributionId: number): Promise<TxResult>;                            // MỚI
type ChainDistribution = {
  distributor: string; distributionId: number; snapshotId: number; amount: bigint; claimed: bigint;
  totalSupplyAt: bigint; claimDeadline: Date; closed: boolean;
};
```

- `openDistribution` tách khỏi việc chờ biên nhận để service lưu mã giao dịch **trước** khi chờ (như BE-17).
- `findDistribution` dùng `distributionIdOfPeriod` rồi `distributions(id)`, không quét sự kiện.
- `distributor` là địa chỉ `ProfitDistributor` hiện hành, để gắn kỳ với đúng hợp đồng (QĐ-E).
- `takeSnapshot`, `balanceOfAt`, `totalSupplyAt` giữ nguyên.
- Gỡ `@blocked SC-05`. Stellar: các hàm mới trả lỗi "chưa hỗ trợ".

**Mock ngang hàng** (Codex đề xuất, Supervisor đồng ý): sổ dự trữ, chống trùng nhãn, hạn nhận, đóng kỳ trả về quỹ, `hasClaimed`;
sửa lỗi tính trùng hiện tại.

**Chuyển đổi trạng thái mock cũ (không mặc định "sổ rỗng"):** khi đọc trạng thái mock cũ có ảnh chụp chia lợi nhuận
mà chưa có sổ dự trữ, chuyển đổi **chính xác**:
- Mỗi ảnh chụp có `distributable > 0` thành một kỳ với `distributionId = snapshotId`, `amount = distributable`,
  `claimed = tổng phần (distributable * số dư tại ảnh chụp / tổng cung)` của các ví trong tập đã trả,
  `claimDeadline = thời điểm chuyển đổi + claimWindow`, `closed = false`.
- `totalReserved = tổng(amount - claimed)`; bộ đếm kỳ mới bắt đầu từ `max(snapshotId) + 1` để không va chạm.
- Trạng thái thiếu dữ liệu để tính (thiếu số dư tại ảnh chụp hoặc tổng cung) thì **báo lỗi cần reset có kiểm
  soát**, không tự đoán.

### QĐ-E. Lưu trữ

- `DistributionPeriod` thêm: `distributorAddress String?`, `distributionId Int?`, `openTxHash String?`,
  `vaultPeriodRef Int?`, `vaultCloseStatus String?` (`PENDING`, `SENT`, `DONE`, `CONFLICT`),
  `vaultCloseTxHash String?`.
- Trạng thái kỳ thêm `OPENING` (đã giữ chỗ, đang mở trên chuỗi), `EXPIRED` (quá hạn nhận, còn hồ sơ chưa trả),
  `CLOSED` (đã đóng trên chuỗi, phần chưa trả đã về quỹ). Trạng thái hồ sơ thêm `EXPIRED` (không nhận kịp; **không**
  bao giờ ghi thành `PAID`).
- Đọc kỳ bằng hợp đồng: nếu `distributorAddress` của kỳ khác địa chỉ `ProfitDistributor` hiện hành thì báo lỗi rõ
  "kỳ thuộc hợp đồng cũ"; không đọc nhầm sang hợp đồng mới (sau OP-05).
- `periodKey` (CH-6): bắt buộc tiền tố chain (`<chain>:`), mã tự động của BE-07 sinh kèm tiền tố, để khoá chạy
  của tiến trình tự động và nhãn trên chuỗi tự phân biệt chain. Kỳ cũ không tiền tố giữ nguyên.
- Cập nhật `schema.prisma`, `init.sql`, `npm run db:embed-sql`, cổng lưu trữ bộ nhớ và Postgres.

### QĐ-F. Mở kỳ có giữ chỗ và phục hồi

`openPeriod` (dùng cho cả đường tay và BE-07):

1. Kiểm quyền; kiểm `unallocatedProfit() > 0`.
2. **Giữ chỗ:** tạo bản ghi kỳ `OPENING` với `periodKey` (ràng buộc duy nhất của database chặn hai tiến trình
   cùng mở một mã). Thất bại vì trùng thì trả lỗi mã kỳ đã có.
3. Gửi `openDistribution(periodKey)`; lưu `openTxHash` **ngay khi có**, trước khi chờ biên nhận.
4. Chờ biên nhận; dù kết quả thế nào, gọi `findDistribution(periodKey)`:
   - Có: ghi `distributionId`, `distributorAddress`, `snapshotId`, `totalAmount = amount`, `totalSupplyAt`,
     chuyển `OPEN`. Rồi chạy QĐ-G.
   - Không có và giao dịch chắc chắn revert: xoá bản ghi giữ chỗ hoặc chuyển trạng thái lỗi (chọn một, ghi rõ),
     trả lỗi.
   - Không có và chưa xác định (hết thời gian chờ, lỗi RPC): **giữ** `OPENING`, trả lỗi "đang mở trên chuỗi".
5. **Phục hồi:** hàm `recoverOpeningPeriod(periodKey)` (và BE-07 gọi ở đầu mỗi vòng cho mọi kỳ `OPENING` của
   chain): tra `findDistribution`; có thì hoàn tất như bước 4; không có thì gửi lại `openDistribution` (hợp đồng
   chặn trùng nhãn nên không thể tạo kỳ thứ hai).
- Bỏ phép kiểm `poolAfter !== poolBefore`.

### QĐ-G. Đẩy số đã chia vào vault đúng một lần (CH-2)

- Sau khi kỳ chuyển `OPEN` trên chain có vault thanh toán:
  1. **Giữ chỗ mã kỳ vault** bằng cập nhật có điều kiện: `vaultPeriodRef = vault.lastPeriodRef() + 1`,
     `vaultCloseStatus = PENDING`, chỉ khi `vaultCloseStatus` đang rỗng và **mọi kỳ chia trước đó của chain** đã
     `DONE` (giữ thứ tự).
  2. Chuyển `SENT` có điều kiện (chỉ một tiến trình thắng), gửi `closeVaultPeriod(vaultPeriodRef, amount)`, lưu
     `vaultCloseTxHash` trước khi chờ.
  3. Kết thúc: đối soát như mục phục hồi bên dưới, rồi `DONE`.
- **Phục hồi và retry dùng lại đúng `vaultPeriodRef` đã lưu**, không đọc `lastPeriodRef + 1` lần nữa. Trước khi gửi
  lại, tra sự kiện `PeriodClosed` có `periodRef` (indexed) bằng mã đã lưu, từ `deployBlock`:
  - Có và `distributedPrev == amount`: `DONE` (giao dịch trước đã lên chuỗi).
  - Có nhưng `distributedPrev` khác (ví dụ Kiểm soát viên chạy script chen vào): `CONFLICT`, dừng, báo cần xử lý
    tay; không gửi gì thêm.
  - Không có và `vault.lastPeriodRef() == vaultPeriodRef - 1`: gửi lại với đúng mã đó.
  - Không có và `lastPeriodRef() >= vaultPeriodRef`: `CONFLICT`.
- Thêm vào nhóm `ILedgerVault`: `closeVaultPeriod(periodRef, distributedPrev)`, `findVaultPeriodClose(periodRef)`.
  Mock, stellar: không áp dụng.
- Lỗi ở bước này **không** huỷ kỳ chia; kỳ vẫn chia được, BE-07 thử lại phần vault ở vòng sau.
- **Ghi chú QĐ-13 (cập nhật DS-01 bản 5):** số đẩy vào vault là tiền **đã dành cho kỳ** (đã nạp quỹ, gồm phần
  SPV), không phải tiền đã tới tay người nhận. Chốt tự động thay cho Kiểm soát viên chạy script; Kiểm soát viên
  vẫn đặt tỷ lệ và chế độ khoá, và thấy lịch sử trên `/vault`. Script `vault-admin.js close-period` vẫn còn nhưng
  runbook ghi "không dùng khi luồng tự động đang chạy".

### QĐ-H. Chia, đối soát "đã trả" và vòng đời kỳ

- `distributePeriod` gọi `distributeBatch(distributionId, wallets)`.
- **Người nhận** thêm ví SPV từ `spvWallet()` (CH-3). **Giới hạn ghi rõ:** danh sách lấy từ lệnh mua đã hoàn tất,
  hồ sơ kỳ trước và ví SPV; ví nhận WPT bằng chuyển trực tiếp mà chưa từng mua hay nhận chia có thể bị bỏ sót.
  Phần của ví bị bỏ sót nằm trong dự trữ đến khi kỳ đóng rồi về quỹ. Indexer (IN-01) sẽ đóng giới hạn này.
- **Đối soát từ chuỗi:** trước mỗi lô và trước khi ghi lỗi, với hồ sơ `PENDING`, `SENT` **và `FAILED`**, đọc
  `isDistributionPaid`; đã nhận thì `PAID` "đối soát từ chuỗi", không đưa vào lô.
- **Hồ sơ phần bằng 0:** giữ cách hiện tại (ghi `PAID` không gọi chuỗi), đánh dấu rõ là "phần 0, không gọi chuỗi";
  đối soát bỏ qua các hồ sơ này.
- **Vòng đời:** trước khi chạy một kỳ, đọc `distributionState`:
  - `closed = true`: kỳ `CLOSED`, hồ sơ chưa trả `EXPIRED`.
  - Quá `claimDeadline`, chưa đóng: kỳ `EXPIRED`, hồ sơ chưa trả `EXPIRED`, **không** gửi lô.
  - Kỳ `COMPLETED` khi mọi hồ sơ là `PAID`; kỳ `EXPIRED`/`CLOSED` khi còn hồ sơ `EXPIRED`.
- **BE-07** chỉ tìm kỳ dở dang trong `OPENING`, `OPEN`, `DISTRIBUTING`; kỳ `EXPIRED`, `CLOSED` không chặn kỳ mới.
- **Đóng kỳ:** script `distribution-admin.js close <periodKey>` (vai admin, mặc định chỉ in, cần xác nhận mới
  gửi) gọi `closeDistribution`; lần đọc sau của ứng dụng chuyển kỳ sang `CLOSED`. Không tự động đóng ở SC-06.

### QĐ-I. BE-07 lấy phần chưa phân bổ làm căn cứ

- Quyết định mở kỳ và kiểm ngưỡng dựa trên `unallocatedProfit()`: mở khi `unallocatedProfit() >=
  distribution.min_new_balance` và không còn kỳ dở dang.
- Phát hiện bất thường: `profitPoolBalance() < reservedProfit()` (quỹ hụt so với nghĩa vụ) thì dừng, ghi lỗi.
- Mốc `distribution.last_settled_balance` không còn dùng để quyết định; giữ khoá cấu hình để hiển thị lịch sử,
  ghi chú trong mã. Không chuyển sang phát hiện bằng sự kiện (IN-02 ngoài phạm vi).

### QĐ-J. Triển khai

- `ProfitDistributor` đổi bytecode; thứ tự triển khai không đổi nên địa chỉ hardhat-local không đổi; khoá `evm` không
  đổi (OP-05 triển khai lại).
- `verify-deployment.js`: `totalReserved() == 0`, `unallocatedBalance()` đọc được.
- `ProfitDistributorOracle` biên dịch được, `oracle-cycle.test.js` xanh.
- `task-status.json`: `SC-06` vào `inProgress`; `SC-05` ghi gộp vào SC-06 (CH-4).

## Ràng buộc

- Không sửa `ProjectToken`, `VNDToken`, `SpvPaymentVault`, `OrderSettlement`, `IdentityRegistry`,
  `ModularCompliance`. Nếu buộc phải sửa, dừng lại hỏi Supervisor.
- Không đổi luồng BE-06, BE-07 ngoài QĐ-F đến QĐ-I. Không làm FE-08, FE-09, BE-18.
- Không thêm thư viện. Không triển khai Sepolia. Không commit khoá riêng hay URL RPC có khoá.
- Luật kiến trúc giữ nguyên. Checkpoint dán nguyên văn đầu ra lệnh đã chạy.

## Mức kiểm chứng: Cao

| Ca | Kiểm |
|---|---|
| 1 | **Tạo kỳ từ quỹ:** chuyển thẳng 1.000.000 VNDB; `createDistributionFromPool("mock:2026-Q1")` tạo kỳ 1.000.000; `totalReserved = 1.000.000`, `unallocatedBalance = 0`; `distributionIdOfPeriod` trả đúng |
| 2 | Nhãn rỗng revert `EmptyPeriod`; nhãn đã dùng revert `DuplicatePeriod` kể cả khi đã có tiền mới; quỹ chưa phân bổ 0 revert `NothingToDistribute`; tổng cung 0 revert |
| 3 | **Không tính trùng:** kỳ A 1.000.000 trả 600.000; nạp 500.000; kỳ B lấy đúng 500.000; trả hết cả hai không thiếu tiền |
| 4 | **Đóng kỳ trả về quỹ:** sau hạn, đóng A: số dư không đổi, `totalReserved` giảm 400.000, `unallocatedBalance` tăng 400.000; kỳ C lấy cả 400.000 |
| 5 | Đóng trước hạn revert; đóng hai lần revert; kỳ đã trả hết đóng với `released = 0`; ví không có vai admin revert |
| 6 | **Không đường rút:** không còn `sweepDust` trong ABI; mọi sự kiện `Transfer` của VNDB ra khỏi hợp đồng trong toàn bộ bộ kiểm chỉ tới ví được chia |
| 7 | **Bất biến sổ dự trữ** sau mỗi bước của ca 1, 3, 4 và một chuỗi ngẫu nhiên có hạt giống cố định (tạo, trả, nạp, đóng, tự `claim`) |
| 8 | `createDistribution` kéo tiền cũng cộng dự trữ; trộn hai cách tạo kỳ vẫn đúng ca 3 |
| 9 | **Phần SPV vào vault:** vault giữ 400 trên 1.000 WPT; `distributeTo(id, [vault, nhà đầu tư])` trả vault 40%; `netProceeds` không đổi |
| 10 | Bộ cũ xanh; các ca đổi theo ngoại lệ QĐ-C được liệt kê và khẳng định mới đúng mô hình không rút |
| 11 | **Đột biến**, dán đầu ra đỏ rồi hoàn nguyên: (a) `_claim` không trừ dự trữ, ca 3 đỏ; (b) tạo kỳ lấy toàn bộ số dư, ca 3 đỏ; (c) đóng kỳ không trừ dự trữ, ca 4 đỏ; (d) đóng kỳ chuyển tiền cho người gọi, ca 6 đỏ; (e) bỏ kiểm hạn của đóng kỳ, ca 5 đỏ; (f) `createDistribution` không cộng dự trữ, ca 8 đỏ; (g) bỏ kiểm trùng nhãn, ca 2 đỏ |
| 12 | **Adapter EVM trên nút thật:** `openDistribution`, `findDistribution`, `distributionState`, `distributeBatch`, `isDistributionPaid`, `closeDistribution`, `unallocatedProfit`, `reservedProfit` khớp hợp đồng; kỳ thuộc địa chỉ `ProfitDistributor` khác bị từ chối |
| 13 | **Mock ngang hàng:** ca 3, 4, 5 cho cùng số với EVM; **chuyển đổi mock cũ:** nạp JSON cũ có một kỳ đã trả **một phần** (ví dụ 1.000.000, đã trả 600.000): sau chuyển đổi `reserved = 400.000`, kỳ mới chỉ lấy tiền nạp thêm; `distributionId` mới bắt đầu từ `max(snapshotId) + 1`; JSON thiếu dữ liệu báo lỗi cần reset |
| 14 | **BE-06 trên nút thật:** nhà đầu tư và vault giữ WPT; nạp quỹ; `openPeriod` ghi `distributionId`, `distributorAddress`, `totalAmount` bằng số trên chuỗi; `distributePeriod` trả đủ, vault nhận phần SPV |
| 15 | **Phục hồi mở kỳ:** (a) giao dịch lên chuỗi, lỗi trước khi ghi database (giả lập): `recoverOpeningPeriod` hoàn tất kỳ đúng `distributionId`, không tạo kỳ thứ hai; (b) gửi lại cùng mã khi kỳ đã có: hợp đồng chặn, ứng dụng hoàn tất từ `findDistribution`; (c) hai tiến trình cùng mở một mã: database chặn, chỉ một giao dịch; (d) có tiền mới đúng lúc phục hồi: không tạo kỳ trùng nhãn |
| 16 | **Đẩy vault đúng một lần:** (a) `closePeriod` thành công nhưng mất ghi database: retry tra `PeriodClosed`, chốt `DONE`, `vault.lastPeriodRef` **không** tăng thêm; (b) hai retry đồng thời: chỉ một giao dịch; (c) Kiểm soát viên chạy script chốt mã đó với số khác: `CONFLICT`, không gửi thêm; (d) kỳ sau không chốt vault khi kỳ trước chưa `DONE` |
| 17 | **Đối soát "đã trả":** nhà đầu tư tự `claim` giữa hai vòng; lô đã lên chuỗi nhưng chưa ghi; hồ sơ `FAILED` mà giao dịch lên chuỗi muộn. Cả ba chốt `PAID` "đối soát từ chuỗi", không trả hai lần; hồ sơ phần 0 không bị đối soát sai |
| 18 | **Vòng đời:** kỳ quá hạn còn hồ sơ chưa trả: kỳ `EXPIRED`, hồ sơ `EXPIRED`, không gửi lô, BE-07 chuyển sang mở kỳ mới; đóng kỳ bằng script: kỳ `CLOSED`; không hồ sơ chưa trả nào thành `PAID` |
| 19 | **BE-07 theo phần chưa phân bổ:** ba kỳ liên tiếp đều để lại phần lẻ, không chia trùng, không bỏ sót; đóng kỳ cũ khi không nạp thêm: phần được giải phóng được mở thành kỳ mới khi vượt ngưỡng; quỹ hụt so với dự trữ: dừng, ghi lỗi; hai phản ví dụ trong review (mục cuối) đều cho kết quả đúng |
| 20 | **Mã kỳ theo chain:** mã thiếu tiền tố bị từ chối ở kỳ mới; mã tự động có tiền tố; kỳ cũ không tiền tố vẫn đọc được |
| 21 | Đồng bộ ABI xanh; `run-local-all.sh` xanh; job A có `trap` xanh; **`run-local-all.sh build evm` (job C) xanh**; kiểm thử trên nút thật xanh; quét bí mật sạch; `scan-pending` không còn `@blocked SC-05`; sơ đồ luồng `distribute` sinh lại nếu điểm cắm đổi dòng |

## Điều kiện hoàn thành

- [ ] Hợp đồng theo QĐ-A đến QĐ-C (ca 1 đến 9); bộ cũ theo ngoại lệ (ca 10); đột biến (ca 11).
- [ ] Cổng, adapter, mock và chuyển đổi mock cũ theo QĐ-D (ca 12, 13); lưu trữ theo QĐ-E.
- [ ] Mở kỳ có giữ chỗ và phục hồi (ca 15); đẩy vault đúng một lần (ca 16); chia, đối soát, vòng đời (ca 14, 17, 18);
      BE-07 theo phần chưa phân bổ (ca 19); mã kỳ theo chain (ca 20).
- [ ] Triển khai theo QĐ-J; kiểm chứng chung (ca 21).
- [ ] `tech-report.md` mục chia lợi nhuận; DS-01 bản 5 ghi QĐ-13 cập nhật (chốt vault tự động).

## Câu hỏi cho chủ dự án (đã chốt 20/10/2026: cả sáu theo đề xuất)

| Mã | Câu hỏi | Đề xuất |
|---|---|---|
| CH-1 | Phần còn lại sau hạn nhận trở về quỹ chia kỳ sau (hợp đồng không còn đường rút), thay vì chuyển tới địa chỉ admin chọn? Hệ quả: ví không nhận kịp trong hạn mất phần kỳ đó | **Có** |
| CH-2 | Tự động đẩy số tiền kỳ chia vào `closePeriod` của vault khi mở kỳ (QĐ-G), thay Kiểm soát viên chạy script? | **Có**; Codex đồng ý thời điểm "lúc mở" |
| CH-3 | Thêm ví SPV vào danh sách người nhận ở mọi chain (QĐ-12)? | **Có** |
| CH-4 | Gộp SC-05 vào SC-06? | **Có** |
| CH-5 | Giữ luồng BE-06/BE-07, thiết kế lại nghiệp vụ ở BE-18? | **Có** |
| CH-6 | Mã kỳ bắt buộc tiền tố chain (`mock:2026-Q1`), thay vì đổi ràng buộc duy nhất sang cặp (chain, mã kỳ)? | **Tiền tố chain**: không phải đổi khoá của tiến trình tự động và bảng chạy; nhãn trên chuỗi tự phân biệt chain |

## Đã xử lý review (Codex, 20/10/2026)

| # | Góp ý | Xử lý |
|---|---|---|
| 1 | Giữ mốc BE-07 sai: bỏ sót tiền được giải phóng; nhận nhầm tiền còn nợ thành tiền mới (hai phản ví dụ) | **Đồng ý.** BE-07 lấy `unallocatedProfit()` làm căn cứ, thêm `reservedProfit()` phát hiện quỹ hụt (QĐ-I); ca 19 gồm hai phản ví dụ, ba kỳ có phần lẻ, đóng kỳ khi không nạp, tự `claim` giữa hai vòng (ca 17) |
| 2 | Retry chốt vault có thể chốt hai lần một kỳ | **Đồng ý.** Giữ chỗ mã kỳ vault trước khi gửi, retry dùng lại mã, đối soát `PeriodClosed`, xử lý retry đồng thời và script chen vào (QĐ-G, ca 16) |
| 3 | Mở kỳ thiếu phục hồi khi chuỗi thành công mà database chưa lưu; nhãn kỳ không chống trùng | **Đồng ý, và làm mạnh hơn:** vì đằng nào cũng sửa `ProfitDistributor`, thêm **chống trùng nhãn ngay trên chuỗi** và `distributionIdOfPeriod`; cộng giữ chỗ `OPENING`, lưu mã giao dịch trước khi chờ, `recoverOpeningPeriod` (QĐ-B, QĐ-F, ca 15) |
| 4 | Thiếu vòng đời kỳ hết hạn hoặc đóng | **Đồng ý.** Trạng thái `EXPIRED`, `CLOSED` cho kỳ, `EXPIRED` cho hồ sơ; `distributionState`; BE-07 không bị chặn; script đóng kỳ (QĐ-E, QĐ-H, ca 18) |
| 5 | Mock cũ coi là "sổ rỗng" sẽ tính trùng | **Đồng ý.** Chuyển đổi chính xác từ ảnh chụp và tập đã trả; thiếu dữ liệu thì báo reset; bộ đếm mới tránh va chạm (QĐ-D, ca 13) |
| 6 | Ngoại lệ sửa bộ kiểm cũ thiếu `full-cycle`, `spec-p7` | **Đồng ý.** Mở rộng ngoại lệ cho mọi ca liệt kê ở "Hiện trạng", kèm khẳng định thay thế (QĐ-C) |
| 7 | Đối soát cả `FAILED`; quy ước hồ sơ phần 0; định danh kỳ theo địa chỉ hợp đồng; giới hạn danh sách người nhận | **Đồng ý cả bốn** (QĐ-H, QĐ-E) |
| 8 | `periodKey` duy nhất toàn hệ ảnh hưởng nhiều chain; mock nên mô phỏng đóng kỳ | **Đồng ý.** CH-6 (đề xuất tiền tố chain); mock mô phỏng đóng kỳ (QĐ-D) |

## Không làm

- Thiết kế lại nghiệp vụ chia (BE-18), FE-08, FE-09. Giao diện "nhà đầu tư tự nhận".
- Tự động đóng kỳ hết hạn (dùng script). Đổi phát hiện tiền sang sự kiện (IN-02). Indexer (IN-01).
- Triển khai Sepolia (OP-05). Fireblocks (IN-03, IN-04: nợ kỹ thuật).
