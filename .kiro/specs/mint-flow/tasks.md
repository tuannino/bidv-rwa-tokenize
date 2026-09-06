# Spec: MINT FLOW — Tasks (làm tuần tự, ưu tiên ra mint)

## P0 — Nền (điều kiện)
- [ ] T0.1 Đổi cây thư mục về SPEC §3 (đổi tên contracts → packages/*, tạo `packages/shared`). Xóa docs/README gốc lỗi thời.
- [ ] T0.2 `docker-compose.yml` dựng chain+db+web; `docker compose up` chạy được.
- [ ] T0.3 Deploy `ProjectToken`+`VNDToken` lên hardhat-local; xuất ABI + `addresses.json` sang `packages/shared`.
- [ ] T0.4 `lib/ledger/port.ts` (ILedgerPort) + `evm.adapter.ts` + `mock.adapter.ts` + `getLedger()`.
- [ ] T0.5 `lib/chains/registry.ts` (hardhat-local default, evm, stellar-stub; KHÔNG polygon) + chain-selector ở header.
- [ ] T0.6 `lib/signer/` (walletSigner, serverSigner) + `lib/rbac/` (can()) + `lib/config/` (feature flags) + `lib/providers/kyc` (mock).
- [ ] DoD P0: compose chạy; đọc balance qua ILedgerPort; đổi chain trên UI không lỗi; test contracts xanh.

## P1 — DEMO MINT 🎯
- [ ] T1.1 KYC mock auto-approve → `ledger.whitelist(wallet)`. DoD: investor mới → `isWhitelisted=true`.
- [ ] T1.2 Server action `mint` theo requirements (RBAC guard, validate, waitReceipt, lưu Txn+audit). DoD: mint 100 → CONFIRMED.
- [ ] T1.3 Trang `app/src/app/mint` + hiển thị balance on-chain thật + lịch sử. DoD: mint từ UI thấy balance đổi.
- [ ] T1.4 Chọn `mock` trên selector → mint chạy KHÔNG cần chain. DoD: demo được ở cả 2 chế độ.
- [ ] T1.5 Demo runner (script/nút): whitelist → mint 100 → in balance. DoD: 1 lệnh ra kết quả.
- [ ] T1.6 1 test e2e cho mint. DoD: pass.

## Nghiệm thu Phase 1
`docker compose up` → tạo investor → mint 100 → **balance=100** (chain thật) và demo được ở chế độ mock; giao dịch lưu DB; 3 LUẬT kiến trúc được tuân thủ (Supervisor kiểm).
