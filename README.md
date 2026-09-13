# BIDV RWA Tokenize — Token hóa tài sản ĐIỆN GIÓ (PoC)

Nền tảng token hóa dự án điện gió theo góc ngân hàng (BIDV): phát hành token quyền hưởng có kiểm soát (KYC/whitelist/freeze/clawback), chia lợi tức theo sản lượng, hoàn vốn — trên EVM (Hardhat local → EVM testnet) và Stellar (sau).

**Trạng thái:** Phase 0 (nền) + Phase 1 (demo MINT) đã xong. Xem `docs/CHECKPOINT_P0_P1.md`.

## Chạy nhanh — cách 1: Docker Compose (đầy đủ)

```bash
docker compose up            # chain (hardhat) + db (postgres) + web (Next.js)
# web   → http://localhost:3000/mint
# chain → http://localhost:8545
```

Chain container tự deploy `ProjectToken`/`VNDToken` rồi ghi địa chỉ + ABI sang `packages/shared`.
Mặc định: chain `hardhat-local`, KYC/Oracle/Core Bank ở chế độ **mock**, Txn/audit lưu **Postgres**.

## Chạy nhanh — cách 2: local, không Docker

```bash
cp .env.example app/.env.local

# T1: chain
cd packages/contracts-evm && npm install && npx hardhat node
# T2: deploy (một lần cho mỗi lần khởi động lại node)
cd packages/contracts-evm && npx hardhat run scripts/deploy.js --network localhost
# T3: web
cd app && npm install && npm run dev
```

Muốn khỏi dựng chain: chọn **Mock** ở dropdown chain trên header (hoặc `NEXT_PUBLIC_DEFAULT_CHAIN=mock`).

## Demo MINT bằng một lệnh

```bash
node scripts/demo-mint.mjs                       # chain hardhat-local
node scripts/demo-mint.mjs --chain mock          # KHÔNG cần chain
node scripts/demo-mint.mjs --chain mock --amount 250 --wallet 0x...
```

In ra: KYC → whitelist → mint → **BALANCE**, rồi tự kiểm nghiệm thu (tx CONFIRMED, số dư tăng đúng).

## Kiểm thử

```bash
cd packages/contracts-evm && npx hardhat test    # 13 test contract
cd app && npm run typecheck                      # kiểm kiểu
cd app && npm test                               # Vitest: RBAC, mock ledger, đối chiếu ABI
cd app && npm run test:e2e                       # Playwright: luồng mint qua UI (chế độ mock)
cd app && E2E_CHAIN=hardhat-local npm run test:e2e   # e2e trên chain thật (cần hardhat node)
```

## Chọn chain & chế độ mock

Dropdown chain ở header: **Hardhat Local** (mặc định) · **Mock** · **EVM Testnet** · **Stellar** (stub, disable).
**Không có Polygon** — đã loại khỏi dự án.

Bên cạnh là bộ đổi **vai trò** (BANK_ADMIN / COMPLIANCE / INVESTOR / AUDITOR) để thử RBAC.
⚠️ Bộ đổi vai trò KHÔNG phải xác thực — chỉ để demo, Phase 4 thay bằng SIWE.

## Ba trục abstraction (LUẬT bất di)

| Luật | Vị trí | Ý nghĩa |
|---|---|---|
| 1 | `app/src/lib/ledger` | Mọi tương tác chain qua `ILedgerPort` + `getLedger(chain)` |
| 2 | `app/src/lib/signer` | Mọi thao tác ký qua `ISigner` |
| 3 | `app/src/lib/rbac` | Mọi kiểm quyền qua `can(role, action)` |

Chi tiết: `docs/SPEC.md` (kiến trúc + cây thư mục), `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`.
