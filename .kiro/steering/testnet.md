---
inclusion: manual
---

# Steering: Ethereum Testnet (Sepolia)

Nạp file này khi làm bất kỳ spec nào trong nhóm testnet: `#steering-testnet`, hoặc trỏ
`#File .kiro/steering/testnet.md`. Đây là bối cảnh dùng chung cho ba spec P4, P7, P12.

## 1. Mục tiêu chung

Đưa bộ hợp đồng RWA điện gió (đã pass 13/13 test trên hardhat-local) lên chạy thật trên
Ethereum testnet Sepolia, cho ba luồng:

- P4 Mint: phát hành WPT cho nhà đầu tư đã KYC (`ProjectToken.mint`).
- P7 Chia lợi tức: chốt snapshot, nạp quỹ VND, nhà đầu tư nhận theo tỷ lệ; có nhánh lấy
  số liệu từ oracle sản lượng (`ProfitDistributor` / `ProfitDistributorOracle` + `EnergyOracle`).
- P12 Tất toán: nhà đầu tư đổi WPT lấy VND rồi đốt WPT (`Redemption`).

## 2. Ràng buộc bất di (không được vi phạm)

1. KHÔNG sửa logic Solidity của các contract đã pass test. Nếu buộc phải đổi contract, dừng
   lại và báo trong checkpoint (2 cách hiểu + đề xuất), không tự ý sửa.
2. LUẬT 1: mọi tương tác chain đi qua `ILedgerPort`. Cấm import viem/ethers ngoài `app/src/lib`.
3. LUẬT 2: mọi ký giao dịch đi qua `ISigner`. Khóa bí mật chỉ đọc ở `config/env.ts` và
   `signer/server.signer.ts`, không rải rác.
4. LUẬT 3: mọi kiểm quyền đi qua `can(role, action)` trong `app/src/lib/rbac`. Cấm so sánh
   `role === '...'` cứng. Thêm quyền = sửa BẢNG `ROLE_PERMISSIONS`, không sửa logic nghiệp vụ.
5. MỘT nguồn sự thật: ABI và địa chỉ contract chỉ đặt ở `packages/shared`. Cấm copy rải rác.
6. Giữ toolchain `trex/` tách biệt (Solidity 0.8.17 / OZ v4), không trộn vào contract chính.

## 3. Sự thật về Sepolia (đã có sẵn trong repo)

- ChainKey của app cho testnet là `evm` (KHÔNG phải tên riêng). Đã khai ở
  `packages/shared/src/chains.ts`: `chainId 11155111`, explorer `https://sepolia.etherscan.io`,
  `implemented: true`, `requiresNode: false`.
- `packages/contracts-evm/hardhat.config.js` đã có network `sepolia` (đọc `SEPOLIA_RPC_URL`,
  `PRIVATE_KEY`, `ETHERSCAN_API_KEY`) và cấu hình `etherscan`.
- `scripts/deploy.js` tự map chainId khác local sang chainKey `evm` và ghi
  `packages/shared/src/addresses.json`.
- Adapter `app/src/lib/ledger/evm.adapter.ts` đã tham số hóa theo chain (dùng
  `rpcUrlFor(chain)` + `viemChainFor(chain)`), nên chạy được cả `hardhat-local` lẫn `evm`.

## 4. Khác biệt testnet so với hardhat-local (bắt buộc lưu ý)

- Sepolia CÓ gas thật. Ví deployer và ví ngân hàng (server signer) phải có ETH test.
  Lấy qua faucet Sepolia trước khi deploy và trước khi chạy bất kỳ giao dịch ghi nào.
- Block time Sepolia khoảng 12 giây. Timeout receipt mặc định 30s (AC mint cũ) có thể chưa
  đủ. Với chain `evm`, dùng timeout dài hơn (đề xuất 90s) và luôn ghi PENDING vào sổ TRƯỚC
  khi chờ receipt, để mất kết nối vẫn đối soát được.
- Không có tài khoản tất định như hardhat. Địa chỉ contract sau deploy là mới, phải nạp lại
  vào nguồn sự thật (mục 5).

## 5. Nạp địa chỉ contract cho chain evm

Cơ chế đã có ở `packages/shared/src/addresses.ts`: env THẮNG file.

- Cách A (khuyến nghị cho free-tier, không đọc được filesystem): đặt biến môi trường
  `NEXT_PUBLIC_ADDR_EVM_<CONTRACT>` cho từng contract. Ví dụ:
  `NEXT_PUBLIC_ADDR_EVM_PROJECT_TOKEN`, `NEXT_PUBLIC_ADDR_EVM_VND_TOKEN`,
  `NEXT_PUBLIC_ADDR_EVM_PROFIT_DISTRIBUTOR`, `NEXT_PUBLIC_ADDR_EVM_REDEMPTION`.
- Cách B: để `deploy.js` ghi khối `"evm"` vào `addresses.json` rồi commit.

Nếu P7 dùng nhánh oracle, phải mở rộng `CONTRACT_NAMES` trong
`packages/shared/src/types.ts` để có `EnergyOracle` và `ProfitDistributorOracle`, thì
`getContractAddress` mới cấp địa chỉ cho hai contract này (xem spec p7).

## 6. Biến môi trường cần cho testnet

Bổ sung vào `.env.example` và tài liệu, KHÔNG commit giá trị thật:

```
# Deploy (packages/contracts-evm/.env)
SEPOLIA_RPC_URL=          # RPC Sepolia (Infura/Alchemy/hoặc public rpc.sepolia.org)
PRIVATE_KEY=              # khóa ví deployer = ngân hàng (phải có ETH test)
ETHERSCAN_API_KEY=        # để verify contract

# App (app/.env)
SERVER_SIGNER_PRIVATE_KEY=   # khóa ví ngân hàng cho server signer (nên trùng deployer, có ETH)
NEXT_PUBLIC_ADDR_EVM_PROJECT_TOKEN=
NEXT_PUBLIC_ADDR_EVM_VND_TOKEN=
NEXT_PUBLIC_ADDR_EVM_PROFIT_DISTRIBUTOR=
NEXT_PUBLIC_ADDR_EVM_REDEMPTION=
# (khi bật oracle cho P7)
NEXT_PUBLIC_ADDR_EVM_ENERGY_ORACLE=
NEXT_PUBLIC_ADDR_EVM_PROFIT_DISTRIBUTOR_ORACLE=
```

## 7. Bring-up dùng chung (Phase 0) cho cả ba luồng

Đây là điều kiện gate của cả P4, P7, P12. Spec P4 SỞ HỮU các task này (T0.x); P7 và P12
coi là tiền đề, không lặp lại. Chỉ làm một lần cho mỗi lần deploy.

- BU1. Chuẩn bị ví ngân hàng, nạp ETH test qua faucet Sepolia.
- BU2. Điền `.env` deploy (RPC, PRIVATE_KEY, ETHERSCAN_API_KEY).
- BU3. `npx hardhat compile` sạch (Solidity 0.8.28, evmVersion paris).
- BU4. Deploy bộ contract lên Sepolia:
  `npx hardhat run scripts/deploy.js --network sepolia`
  (P7 oracle: chạy thêm `scripts/deploy-oracle.js` để có EnergyOracle + ProfitDistributorOracle).
- BU5. Ghi địa chỉ vào nguồn sự thật (env `NEXT_PUBLIC_ADDR_EVM_*` hoặc addresses.json "evm").
- BU6. Verify contract trên Etherscan: `npx hardhat verify --network sepolia <address> <args...>`.
- BU7. App chọn chain `evm` trên chain-selector đọc đúng địa chỉ, `tokenInfo()` trả về
  name/symbol/decimals của WPT trên Sepolia.

## 8. Nghiệm thu chung một luồng trên testnet

Một luồng chỉ coi là PASS testnet khi: giao dịch lên block Sepolia với trạng thái
CONFIRMED, xem được trên `https://sepolia.etherscan.io/tx/<hash>`, số dư trên chain khớp
kỳ vọng, và ba luật kiến trúc được giữ (Supervisor grep kiểm).
