# Spec P7 - Design

## Contract dùng (giữ nguyên, đã pass test)

- `ProfitDistributor.sol` (mô hình pull theo snapshot):
  - `createDistribution(amount, period)` [DISTRIBUTOR_ROLE] chốt `projectToken.snapshot()`,
    kéo VND (`payoutToken.safeTransferFrom(msg.sender, ...)`) nên ngân hàng phải approve VND
    cho hợp đồng TRƯỚC khi gọi.
  - `entitlementOf(id, account)`, `previewClaim(id, account)` (view).
  - `claim(id)`, `claimMany(ids)` (nhà đầu tư), `distributeTo(id, accounts)` [DISTRIBUTOR_ROLE].
  - `sweepDust(id, to)` [DISTRIBUTOR_ROLE] sau `claimWindow`.
  - `distributionsCount()`, `distributions(id)` public.
- `ProfitDistributorOracle.sol` extends ProfitDistributor:
  - `createDistributionFromOracle(periodId)` [DISTRIBUTOR_ROLE] đọc EnergyOracle rồi tạo kỳ.
  - `previewDistributableFromOracle(periodId)` (view).
- `EnergyOracle.sol`:
  - `submitReading(periodId, kWh, tariffVndPerKwh, opexVnd, bankShareBps)` [REPORTER_ROLE].
  - `isFinalized(periodId)`, `distributableProfitVnd/grossRevenueVnd/netRevenueVnd`,
    `setRequiredConfirmations(n)` [MANAGER_ROLE].
- `ProjectToken.snapshot()` cần SNAPSHOT_ROLE; `ProfitDistributor` gọi
  `projectToken.snapshot()` NÊN contract phân phối phải được cấp SNAPSHOT_ROLE trên WPT
  (xem wiring bên dưới). `VNDToken` mint VND để ngân hàng có quỹ chi trả.

## Quyết định deploy cho testnet

Dùng `ProfitDistributorOracle` làm hợp đồng phân phối trên Sepolia (nó KẾ THỪA
ProfitDistributor nên có đủ cả đường nhập tay lẫn đường oracle). Chạy `scripts/deploy-oracle.js`
để có `EnergyOracle` + `ProfitDistributorOracle`. Lưu ý: `deploy.js` gốc deploy bản
ProfitDistributor thường; với P7 testnet ưu tiên bản oracle để có luồng minh bạch.

## Wiring role bắt buộc (một lần, sau deploy)

- Cấp `SNAPSHOT_ROLE` của `ProjectToken` cho địa chỉ hợp đồng phân phối (để nó gọi được
  `snapshot()` trong `createDistribution`).
- Cấp `DISTRIBUTOR_ROLE` của hợp đồng phân phối cho ví ngân hàng (constructor đã cấp cho admin).
- Cấp `REPORTER_ROLE` của `EnergyOracle` cho ví reporter (pilot: ví ngân hàng, để 1 xác nhận).
- Ngân hàng cần đủ VND: `VNDToken.mint(bank, quỹ)` rồi `approve(distributor, amount)` trước
  mỗi kỳ chia.
Ghi các bước wiring này thành script (`scripts/wire-roles.js` hoặc mở rộng deploy-oracle.js),
không thao tác tay rời rạc.

## Mở rộng nguồn sự thật (packages/shared)

- `types.ts`: thêm `EnergyOracle`, `ProfitDistributorOracle` vào `CONTRACT_NAMES` (và giữ
  `ProfitDistributor`), để `getContractAddress('evm', ...)` cấp được địa chỉ cho ba contract.
- `abi/`: thêm ABI tối giản `profit-distributor.ts` (createDistribution, createDistributionFromOracle,
  entitlementOf, previewClaim, claim, claimMany, distributeTo, distributionsCount, sự kiện
  DistributionCreated/Claimed) và `energy-oracle.ts` (submitReading, isFinalized,
  distributableProfitVnd, getReading). Export ở `abi/index.ts`. Không copy ABI ra ngoài shared.
- Địa chỉ chain `evm`: env `NEXT_PUBLIC_ADDR_EVM_PROFIT_DISTRIBUTOR_ORACLE`,
  `NEXT_PUBLIC_ADDR_EVM_ENERGY_ORACLE`, `NEXT_PUBLIC_ADDR_EVM_VND_TOKEN`.

## Mở rộng ILedgerPort (LUẬT 1)

`ILedgerPort` hiện chỉ có nghiệp vụ token. Bổ sung một cụm phương thức lợi tức (đặt trong
port hiện có hoặc tách interface `IProfitPort` mà factory `getLedger` trả cùng đối tượng,
miễn không gọi viem ngoài lib). Đề xuất chữ ký:

```ts
// approve VND rồi tạo kỳ; trả TxResult + distributionId (đọc từ event/distributionsCount)
createDistribution(amountVnd: bigint, period: string): Promise<{ tx: TxResult; id: number }>;
createDistributionFromOracle(periodId: number): Promise<{ tx: TxResult; id: number }>;
submitEnergyReading(periodId: number, kWh: bigint, tariffVndPerKwh: bigint, opexVnd: bigint, bankShareBps: number): Promise<TxResult>;
isPeriodFinalized(periodId: number): Promise<boolean>;
previewDistributableFromOracle(periodId: number): Promise<bigint>;
previewClaim(distributionId: number, account: string): Promise<bigint>;
claim(distributionId: number): Promise<TxResult>;
distributeTo(distributionId: number, accounts: string[]): Promise<TxResult>;
distributionsCount(): Promise<number>;
```

Adapter EVM hiện thực: contract phân phối/oracle KHÁC ProjectToken nên adapter cần đọc địa
chỉ + ABI riêng cho chúng (không tái dùng biến `tokenAddress()` cứng cho ProjectToken).
Trước khi `createDistribution`, adapter phải thực hiện `VNDToken.approve(distributor, amount)`
(một tx approve rồi mới tới createDistribution), hoặc yêu cầu ngân hàng approve trước và
kiểm allowance đủ. Giữ mẫu `simulateContract` trước khi `writeContract` như adapter cũ.

Mock adapter: bổ sung bản mock cho các phương thức trên để demo được ở chế độ không cần chain.

## RBAC (LUẬT 3)

Thêm ACTIONS vào `app/src/lib/rbac/permissions.ts` (chỉ sửa BẢNG, không sửa logic `can`):
- `profit:distribute` (tạo kỳ, chia hộ, quét dư, đẩy số liệu oracle) cho BANK_ADMIN.
- `profit:claim` (nhận lợi tức) cho INVESTOR.
Server action gọi `assertCan(role, 'profit:distribute')` hoặc `'profit:claim'` đầu mỗi hàm.

## Luồng end-to-end trên testnet

Đường nhập tay:
1. Có sẵn WPT đã mint cho >= 2 nhà đầu tư (từ P4).
2. Ngân hàng mint VND quỹ, approve cho distributor.
3. Ngân hàng tạo kỳ: `createDistribution(1_000_000, "2026-Q1")` (chốt snapshot + kéo VND).
4. Mỗi nhà đầu tư `previewClaim` rồi `claim(id)`, nhận VND theo tỷ lệ.

Đường oracle:
1. Reporter `submitEnergyReading(202601, kWh, tariff, opex, bankShareBps)` tới đủ xác nhận.
2. Ngân hàng approve VND đúng `distributableProfitVnd(202601)`.
3. Ngân hàng `createDistributionFromOracle(202601)`; nhà đầu tư claim như trên.

## Ghi sổ và audit

Ghi PENDING trước khi chờ receipt. Sự kiện `DistributionCreated`, `Claimed`,
`DistributionFromOracle` dùng để dựng read-model/lịch sử và đối soát.

## Rủi ro

- Quên cấp SNAPSHOT_ROLE cho distributor: `createDistribution` revert. Bắt buộc wiring T-role.
- Approve VND thiếu hoặc sai đơn vị (VND decimals 0): kéo quỹ fail. Kiểm allowance trước.
- Số nhà đầu tư lớn khi `distributeTo`: chi phí gas cao, nên chia lô hoặc ưu tiên pull-claim.
