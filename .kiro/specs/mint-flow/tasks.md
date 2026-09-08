# Spec: MINT FLOW — Tasks (làm tuần tự, ưu tiên ra mint)

## P0 — Nền (điều kiện)
- [x] T0.1 Đổi cây thư mục về SPEC §3 (đổi tên contracts → packages/*, tạo `packages/shared`). Xóa docs/README gốc lỗi thời.
- [x] T0.2 `docker-compose.yml` dựng chain+db+web; `docker compose up` chạy được.
- [x] T0.3 Deploy `ProjectToken`+`VNDToken` lên hardhat-local; xuất ABI + `addresses.json` sang `packages/shared`.
- [x] T0.4 `lib/ledger/port.ts` (ILedgerPort) + `evm.adapter.ts` + `mock.adapter.ts` + `getLedger()`.
- [x] T0.5 `lib/chains/registry.ts` (hardhat-local default, evm, stellar-stub; KHÔNG polygon) + chain-selector ở header.
- [x] T0.6 `lib/signer/` (walletSigner, serverSigner) + `lib/rbac/` (can()) + `lib/config/` (feature flags) + `lib/providers/kyc` (mock).
- [x] DoD P0: compose chạy; đọc balance qua ILedgerPort; đổi chain trên UI không lỗi; test contracts xanh.

## P1 — DEMO MINT 🎯
- [x] T1.1 KYC mock auto-approve → `ledger.whitelist(wallet)`. DoD: investor mới → `isWhitelisted=true`.
- [x] T1.2 Server action `mint` theo requirements (RBAC guard, validate, waitReceipt, lưu Txn+audit). DoD: mint 100 → CONFIRMED.
- [x] T1.3 Trang `app/src/app/(admin)/mint` + hiển thị balance on-chain thật + lịch sử. DoD: mint từ UI thấy balance đổi.
- [x] T1.4 Chọn `mock` trên selector → mint chạy KHÔNG cần chain. DoD: demo được ở cả 2 chế độ.
- [x] T1.5 Demo runner (`node scripts/demo-mint.mjs`): whitelist → mint 100 → in balance. DoD: 1 lệnh ra kết quả.
- [x] T1.6 Test e2e cho mint (Playwright, 5 test). DoD: pass.

## Nghiệm thu Phase 1
`docker compose up` → tạo investor → mint 100 → **balance=100** (chain thật) và demo được ở chế độ mock; giao dịch lưu DB; 3 LUẬT kiến trúc được tuân thủ (Supervisor kiểm).

→ **Đã kiểm chứng.** Bằng chứng + cách tái hiện: `docs/CHECKPOINT_P0_P1.md`.

## Còn treo (chuyển sang phase sau / cần Supervisor quyết)
- [ ] Build free-tier Cloudflare (`opennextjs-cloudflare build`) — BLOCKER, xem checkpoint §5 câu hỏi 1. Không nằm trong DoD P0/P1.
- [ ] Thay `serverSigner` → Fireblocks (Phase 5): `signer/fireblocks.signer.stub.ts` đã chừa chỗ.
- [ ] RBAC/KYC/audit thật + chuyển bảng role→permission vào Prisma (Phase 4): `prisma/schema.prisma` đã khai báo model.
- [ ] Route-group `(client)` cho nhà đầu tư — chưa tạo vì P1 không có màn hình nào cho NĐT.
