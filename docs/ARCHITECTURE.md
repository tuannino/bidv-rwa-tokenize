# Kiến trúc hệ thống

Sơ đồ tổng thể: **#3.2** (file `20260902_kien_truc_he_thong_3_2.html` — 3 kênh, lõi off-chain, on-chain, dữ liệu). Tài liệu này tóm tắt phần hiện thực trong repo.

## Nguyên tắc
- Nghiệp vụ tách khỏi hạ tầng qua **3 port**: `ILedgerPort` (chain), `ISigner` (custody), providers `mock|real` (KYC/Oracle/CoreBank).
- **Next.js full-stack**: UI + server actions/API cùng một app; DB Postgres cho KYC/audit/RBAC.
- **Chain chọn được** ở UI: hardhat-local (default) → evm → stellar. Mỗi chain một adapter; `mock` để chạy không cần chain.

## Luồng dữ liệu (mint)
UI(Mint) → server action (RBAC + validate) → `getLedger(chain)` → adapter (viem, ABI/addr từ `packages/shared`) → ký bằng `ISigner` → `waitReceipt` → lưu Txn/audit → UI đọc `balanceOf`.

## Mở rộng (kế thừa)
- +Chain: thêm `*.adapter.ts`, đăng ký factory.
- +Custody: thêm `ISigner` (vd Fireblocks EIP-1193), đổi factory.
- +Luồng: thêm method `ILedgerPort` + hiện thực; contract phần lớn đã có (ProfitDistributor/Redemption/EnergyOracle).
- +Role: thêm dữ liệu RBAC.
