# Spec P4 - Tasks

## Phase 0 - Bring-up dùng chung (P7, P12 phụ thuộc)

- [ ] T0.1 Chuẩn bị ví ngân hàng + nạp ETH test Sepolia qua faucet.
      DoD: `eth_getBalance` của ví > 0 trên Sepolia.
- [ ] T0.2 Điền `packages/contracts-evm/.env` (SEPOLIA_RPC_URL, PRIVATE_KEY, ETHERSCAN_API_KEY);
      cập nhật `.env.example`.
      DoD: `.env.example` liệt kê đủ biến, KHÔNG commit giá trị thật.
- [ ] T0.3 `npx hardhat compile` sạch.
      DoD: compile pass, không cảnh báo chặn.
- [ ] T0.4 Deploy lên Sepolia: `npx hardhat run scripts/deploy.js --network sepolia`.
      DoD: in ra 4 địa chỉ, addresses.json có khối `"evm"` (hoặc log để nạp env).
- [ ] T0.5 Nạp địa chỉ vào nguồn sự thật: đặt env `NEXT_PUBLIC_ADDR_EVM_*` cho 4 contract
      (và/hoặc commit addresses.json "evm").
      DoD: `getContractAddress('evm','ProjectToken')` trả đúng địa chỉ vừa deploy.
- [ ] T0.6 Verify 4 contract trên Etherscan (`hardhat verify --network sepolia ...`).
      DoD: mỗi contract hiển thị source "Verified" trên sepolia.etherscan.io.

## Phase 1 - Mint trên testnet

- [ ] T1.1 Thêm timeout receipt riêng cho chain `evm` (đề xuất `EVM_RECEIPT_TIMEOUT_MS=90_000`),
      không đổi hành vi hardhat-local.
      DoD: mint trên Sepolia không bị báo PENDING oan trước ~90s.
- [ ] T1.2 Kiểm chứng whitelist trên Sepolia: whitelist một ví nhà đầu tư, chờ CONFIRMED.
      DoD: `isWhitelisted(investor)` = true, tx xem được trên Etherscan.
- [ ] T1.3 Mint từ UI (chain-selector = evm): mint 100 WPT cho ví đã whitelist.
      DoD: sau CONFIRMED, `balanceOf(investor)` = 100 on-chain, UI hiện link Etherscan.
- [ ] T1.4 Chặn hai lỗi trước khi tốn gas: mint cho ví CHƯA whitelist trả lỗi đọc được và
      KHÔNG sinh tx; amount <= 0 trả lỗi validation.
      DoD: hai trường hợp đều không tạo tx trên Sepolia.
- [ ] T1.5 Guard quyền: tài khoản role khác BANK_ADMIN bị chặn qua `assertCan`.
      DoD: role INVESTOR/AUDITOR gọi mint bị ForbiddenError, không chạm chain.
- [ ] T1.6 Demo runner cho testnet (script hoặc nút): whitelist rồi mint 100 rồi in balance
      + link tx.
      DoD: một lệnh ra kết quả trên Sepolia.

## Nghiệm thu Phase 1 (P4)

Chọn chain `evm`, tạo/whitelist nhà đầu tư, mint 100 WPT, thấy CONFIRMED trên Sepolia,
`balanceOf` = 100, giao dịch tra được trên Etherscan. Ba luật kiến trúc giữ nguyên
(Supervisor grep kiểm: viem không ngoài lib, khóa chỉ ở env/server.signer, không role=== cứng).

## Checkpoint

Điền theo `docs/CHECKPOINT_TEMPLATE.md`: task/DoD đạt hay chưa, DEVIATION nếu có, địa chỉ 4
contract trên Sepolia + link Etherscan, và ghi rõ Phase 0 đã xong để P7/P12 dùng lại.
