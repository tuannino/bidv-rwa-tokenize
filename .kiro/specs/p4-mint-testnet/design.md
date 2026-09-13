# Spec P4 - Design

## Thành phần liên quan (đã có, cần cấu hình/kiểm chứng)

- Contract: `packages/contracts-evm/contracts/tokens/ProjectToken.sol` (WPT). Hàm dùng:
  `setWhitelisted(account, status)` [AGENT_ROLE], `mint(to, amount)` [MINTER_ROLE],
  `isWhitelisted`, `balanceOf`, `name/symbol/decimals/totalSupply`. Constructor đã cấp cho
  ví deployer cả DEFAULT_ADMIN/MINTER/AGENT/SNAPSHOT/PAUSER, nên ngân hàng = deployer làm
  được mọi thao tác P4 không cần cấp thêm role.
- Deploy: `packages/contracts-evm/scripts/deploy.js` (đã map chainId khác local sang `evm`),
  `hardhat.config.js` network `sepolia`.
- App: `app/src/lib/ledger/evm.adapter.ts` (đã có whitelist/mint/balanceOf/waitReceipt),
  factory `getLedger('evm', signer)`, `ISigner` server (`signer/server.signer.ts`).
- Địa chỉ/ABI: `packages/shared` (`getContractAddress`, `projectTokenAbi`).
- RBAC: action `token:mint`, `investor:whitelist` đã có trong `ROLE_PERMISSIONS` cho BANK_ADMIN.

## Điểm phải làm mới hoặc chỉnh

1. Nạp địa chỉ chain `evm`: dùng env `NEXT_PUBLIC_ADDR_EVM_*` (env thắng file). Đây là cơ chế
   đã thiết kế sẵn trong `addresses.ts`, chỉ cần điền giá trị sau deploy.
2. Timeout receipt cho chain `evm`: hiện `DEFAULT_RECEIPT_TIMEOUT_MS = 30_000`. Cho Sepolia
   nên cho phép truyền timeout dài hơn (đề xuất hằng riêng `EVM_RECEIPT_TIMEOUT_MS = 90_000`
   hoặc tham số theo chain), tránh báo PENDING sớm. Không đổi hành vi hardhat-local.
3. Chain-selector: bảo đảm chọn `evm` trên UI thì server action gọi `getLedger('evm')`, và
   link explorer dùng `explorerTxUrl('evm', hash)` (đã trả về sepolia.etherscan.io).
4. Server signer trên Sepolia: `server.signer.ts` đọc `SERVER_SIGNER_PRIVATE_KEY`. Ví này
   phải là ngân hàng (có role) và phải có ETH test để trả gas.

## Luồng mint trên testnet

1. UI (trang mint, chain-selector = evm) gửi yêu cầu tới server action.
2. Server action: `assertCan(role, 'token:mint')` (LUẬT 3).
3. `getLedger('evm', bankSigner)` (LUẬT 1 + 2).
4. `ledger.whitelist(wallet)` nếu chưa whitelist, `waitReceipt` tới CONFIRMED.
5. `ledger.mint(to, amount)`: adapter `simulateContract` trước (chặn lỗi tuân thủ không tốn
   gas, AC#6), rồi `writeContract`, trả PENDING kèm txHash.
6. Ghi giao dịch PENDING vào sổ TRƯỚC khi chờ (ghi sổ trước, xác nhận sau).
7. `ledger.waitReceipt(txHash, EVM_RECEIPT_TIMEOUT_MS)` tới CONFIRMED/FAILED/PENDING(timeout).
8. Cập nhật số dư từ `balanceOf` on-chain, trả UI kèm link explorer.

## Mô hình phân tầng (giữ nguyên)

UI (không gọi chain, không kiểm quyền) -> Server Action (vỏ mỏng) -> Nghiệp vụ (RBAC + audit
+ điều phối, đặt guard ở đây) -> `ILedgerPort` + adapter -> chain Sepolia.

## Rủi ro

- Ví ngân hàng hết ETH test giữa chừng: giao dịch ghi sẽ fail vì thiếu gas. Kiểm số dư ETH
  trước demo; ghi hướng dẫn faucet.
- RPC public rate-limit: nếu `rpc.sepolia.org` chập chờn, chuyển sang RPC có API key.
- Địa chỉ lệch giữa env và addresses.json: env thắng, nên nếu đặt cả hai phải trùng nhau.
