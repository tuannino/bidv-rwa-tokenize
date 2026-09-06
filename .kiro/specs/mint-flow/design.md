# Spec: MINT FLOW — Design

## Thành phần liên quan
- UI: `app/src/app/mint/` (trang Mint) + chain-selector (header) + toggle mock.
- Server action: `app/src/app/api/mint` (hoặc server action) — chạy phía server, dùng `serverSigner`.
- `ILedgerPort` (`lib/ledger/port.ts`) + `evm.adapter.ts` (viem, đọc ABI/địa chỉ từ `packages/shared`) + `mock.adapter.ts`.
- `getLedger(chain)` factory theo chain đã chọn.
- `IKycProvider` (mock: auto-approve → gọi `whitelist`).
- RBAC `can(role,'mint')`.

## Luồng
1. Admin tạo/chọn investor → `IKycProvider.approve()` (mock) → `ledger.whitelist(wallet)`.
2. Admin nhập amount → server action kiểm RBAC + validate → `ledger.mint(wallet, amount)` (ký `serverSigner`).
3. `ledger.waitReceipt` → lưu `Txn` (+ audit) → trả kết quả.
4. UI đọc `ledger.balanceOf(wallet)` hiển thị.

## Adapter EVM
- Dùng viem `walletClient`/`publicClient` trỏ RPC theo `chains` registry (hardhat-local: http://chain:8545).
- ABI + address lấy từ `packages/shared/addresses.json` (sinh ở P0 khi deploy).

## Mock adapter
- Lưu balance/whitelist trong bộ nhớ (hoặc DB) → mint/return receipt giả `CONFIRMED` ngay. Cho phép demo không cần chain.

## Chain-selector
- `lib/chains/registry.ts`: `hardhat-local`(default) | `evm` | `stellar`(stub). KHÔNG polygon. Lưu lựa chọn ở client state (zustand) + truyền xuống factory.
