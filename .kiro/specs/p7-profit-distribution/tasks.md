# Spec P7 - Tasks

Tiền đề: Phase 0 của P4 đã xong (contract deploy + địa chỉ chain `evm`). Nếu chưa, dừng và
báo, không tự deploy lại theo kiểu khác.

## Phase 0 - Bổ sung deploy oracle + wiring

- [ ] T0.1 Deploy `EnergyOracle` + `ProfitDistributorOracle` lên Sepolia
      (`scripts/deploy-oracle.js --network sepolia`).
      DoD: in ra 2 địa chỉ, verify được trên Etherscan.
- [ ] T0.2 Script wiring role một lần: cấp `SNAPSHOT_ROLE` (ProjectToken) cho địa chỉ
      distributor-oracle; cấp `REPORTER_ROLE` (EnergyOracle) cho ví reporter (pilot = ngân hàng);
      đặt `requiredConfirmations = 1` cho pilot.
      DoD: đọc role trên chain xác nhận đã cấp; ghi thành script, không thao tác tay.
- [ ] T0.3 Nạp địa chỉ chain `evm`: env `NEXT_PUBLIC_ADDR_EVM_PROFIT_DISTRIBUTOR_ORACLE`,
      `NEXT_PUBLIC_ADDR_EVM_ENERGY_ORACLE`, `NEXT_PUBLIC_ADDR_EVM_VND_TOKEN`.
      DoD: `getContractAddress('evm', ...)` trả đúng cho ba tên này.

## Phase 1 - Nguồn sự thật + port + adapter

- [ ] T1.1 `packages/shared/types.ts`: thêm `EnergyOracle`, `ProfitDistributorOracle` vào
      `CONTRACT_NAMES`.
      DoD: build shared pass, `getContractAddress` chấp nhận tên mới.
- [ ] T1.2 Thêm ABI tối giản `abi/profit-distributor.ts` + `abi/energy-oracle.ts`, export ở
      `abi/index.ts`. Đối chiếu với `generated/*.abi.json`.
      DoD: ABI khớp chữ ký hàm thật; không có ABI copy ngoài shared.
- [ ] T1.3 Mở rộng `ILedgerPort` với cụm phương thức lợi tức (theo design), giữ ở
      `app/src/lib/ledger`.
      DoD: type check pass; không có import viem/ethers ngoài lib.
- [ ] T1.4 Hiện thực trong `evm.adapter.ts`: đọc địa chỉ+ABI distributor/oracle riêng; luồng
      approve VND trước `createDistribution`; `simulateContract` trước mỗi tx ghi.
      DoD: các method trả TxResult đúng; lỗi tuân thủ ra message đọc được, không tốn tx.
- [ ] T1.5 Bổ sung `mock.adapter.ts` cho cụm lợi tức để demo không cần chain.
      DoD: luồng chạy được ở chế độ mock.

## Phase 2 - RBAC + server action + UI

- [ ] T2.1 Thêm ACTIONS `profit:distribute`, `profit:claim` vào bảng `ROLE_PERMISSIONS`
      (BANK_ADMIN, INVESTOR). Chỉ sửa bảng.
      DoD: `can('BANK_ADMIN','profit:distribute')` true; `can('INVESTOR','profit:claim')` true;
      INVESTOR không có `profit:distribute`.
- [ ] T2.2 Server action tạo kỳ (nhập tay + từ oracle), chia hộ, claim; guard `assertCan` đầu
      mỗi hàm; ghi PENDING trước khi chờ receipt.
      DoD: guard chặn đúng role; giao dịch ghi vào sổ trước khi chờ.
- [ ] T2.3 UI ngân hàng: tạo kỳ chia (nhập amount+period, hoặc chọn periodId oracle đã chốt),
      xem danh sách kỳ. UI nhà đầu tư: xem preview + nút claim.
      DoD: thao tác được từ giao diện, hiện link Etherscan cho tx.

## Phase 3 - Kiểm chứng trên Sepolia

- [ ] T3.1 Đường nhập tay: mint WPT cho 2 nhà đầu tư (tỷ lệ ví dụ 70/30) -> ngân hàng mint +
      approve 1.000.000 VND -> `createDistribution(1_000_000,"2026-Q1")` -> 2 nhà đầu tư claim.
      DoD: nhà đầu tư nhận đúng 700.000 và 300.000 VND on-chain, tx CONFIRMED trên Sepolia.
- [ ] T3.2 Đường oracle: `submitEnergyReading(202601, ...)` tới finalized ->
      `createDistributionFromOracle(202601)` -> claim.
      DoD: số chia khớp `distributableProfitVnd(202601)`; không tạo trùng được kỳ đã dùng.
- [ ] T3.3 (Tùy chọn) `sweepDust` sau khi rút ngắn claimWindow để test.
      DoD: phần chưa nhận thu về ví ngân hàng.

## Nghiệm thu P7

Trên chain `evm`: tạo được kỳ chia (cả hai đường), nhà đầu tư nhận đúng tỷ lệ bằng VND
on-chain, mọi tx CONFIRMED và tra được trên Etherscan. Ba luật kiến trúc giữ nguyên
(Supervisor kiểm). Không sửa logic contract.

## Checkpoint

Theo `docs/CHECKPOINT_TEMPLATE.md`: DoD từng task, DEVIATION, địa chỉ distributor-oracle +
energy-oracle trên Sepolia, và bằng chứng số claim khớp tỷ lệ (kèm link tx).
