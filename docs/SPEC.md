# SPEC — BIDV RWA TOKENIZE (Token hóa tài sản ĐIỆN GIÓ)

| | |
|---|---|
| Phiên bản | 2.0 (bám repo thực tế `tuannino/bidv-rwa-tokenize`) |
| Ngày | 2026-09-06 |
| Owner | Sếp (BIDV) · Executor | Kiro · Supervisor | Claude |
| **Ưu tiên tuyệt đối** | Ra được **demo luồng MINT** sớm nhất, trên codebase hiện có |

> Tài liệu này thay thế mọi spec giấy trước đó và **bám đúng repo hiện tại**. Kiro PHẢI tuân thủ. Sai khác so với spec → ghi `DEVIATION:` + lý do, chờ Supervisor duyệt.

## 1. Quyết định đã chốt (locked)
1. **Chủ đề tài sản = RWA ĐIỆN GIÓ**, đồng bộ toàn repo theo bộ contract đã có (`ProjectToken`/WPT, `VNDToken`/tVND, `ProfitDistributor`, `EnergyOracle`, `Redemption`). Bỏ khung vàng/BĐS/carbon ở frontend cũ.
2. **Chọn chain trên giao diện** (dropdown), thứ tự ưu tiên: **`hardhat-local` (mặc định) → `evm` (testnet EVM, vd Sepolia) → `stellar` (sau)**. **BỎ Polygon** hoàn toàn.
3. **Mọi tích hợp có toggle mock|real** (KYC, Oracle, Core Bank, thậm chí cả ledger có `mock`), mặc định bật mock để **không phải setup kỹ thuật nhiều ở lần đầu** → mục tiêu mint sớm.
4. **Token cho demo = `ProjectToken`** (bản rút gọn, đã pass test). Kit **T-REX** để dành cho bản production sau.
5. **Backend = Next.js full-stack** (API routes / server actions), KHÔNG dựng NestJS riêng. Triển khai bằng **Docker Compose**.
6. **Hosting: default FREE-TIER**, nhưng một codebase chạy được **cả** free-tier serverless **lẫn** docker-compose VPS (chỉ đổi feature-flag). Web giữ **bundle nhỏ** cho Cloudflare (giới hạn hiện tại 64 MiB không nén — mới đổi 2026-09-04; vẫn build gọn). Demo public mặc định `mock`/`evm`-testnet, KHÔNG hardhat node. Chi tiết: `docs/DEPLOYMENT.md`.

## 2. Hiện trạng repo (đã kiểm chứng)
- `packages/contracts-evm` (đổi tên từ `contracts/evm_contracts`): **13/13 test PASS**, 23 file Solidity compile sạch. `ProjectToken` đã có `mint` + `whitelist` + `freeze` + `clawback` + snapshot; `VNDToken` có mint/burn; ProfitDistributor/EnergyOracle/Redemption hoạt động.
- `packages/contracts-evm/trex`: kit **ERC-3643 thật** (toolchain tách: solc 0.8.17 + OZ v4) — để production.
- `packages/contracts-stellar`: Soroban/Rust — để phase Stellar.
- `app/`: Next.js 16 + wagmi/viem/RainbowKit, "Phase 1 shell", **toàn mock-data, chưa nối contract**. ⚠️ `app/AGENTS.md`: **Next.js 16 có breaking changes — đọc `node_modules/next/dist/docs/` trước khi code.**
- Docs gốc (README/URD) **đã lỗi thời** (mô tả Polygon + `AssetRegistry.sol` không tồn tại) → sẽ thay bằng bộ docs này.

## 3. Kiến trúc & cây thư mục ĐÍCH (Kiro tổ chức lại repo về đây)

```
bidv-rwa-tokenize/
├─ docker-compose.yml        # chain (hardhat node) + db (postgres) + web (next.js)
├─ .env.example
├─ README.md
├─ .kiro/{steering,specs}/   # steering rules + spec theo feature
├─ docs/                     # SPEC, ARCHITECTURE, WORKING_PROTOCOL, templates
├─ app/                      # Next.js 16 full-stack (retheme ĐIỆN GIÓ)
│  ├─ Dockerfile
│  └─ src/
│     ├─ app/                # routes: dashboard, assets, kyc, reconciliation, mint + api/ (server actions ngân hàng)
│     ├─ lib/
│     │  ├─ ledger/          # ILedgerPort + factory getLedger(chain)
│     │  │  ├─ port.ts       #   interface (whitelist/mint/burn/transfer/freeze/forcedTransfer/balanceOf/waitReceipt)
│     │  │  ├─ evm.adapter.ts#   hardhat-local + evm testnet (viem)
│     │  │  ├─ mock.adapter.ts#  chạy KHÔNG cần chain
│     │  │  └─ stellar.adapter.ts # stub, để sau
│     │  ├─ signer/          # ISigner: wallet (client) | server | fireblocks.stub
│     │  ├─ chains/          # registry: hardhat-local(default), evm, stellar  (KHÔNG polygon)
│     │  ├─ providers/       # IKycProvider/IOracleProvider/ICoreBankProvider + mock|real
│     │  ├─ rbac/            # roles→permissions + can(role,action)
│     │  └─ config/          # env + feature flags (USE_MOCK_*)
│     └─ components/
└─ packages/
   ├─ contracts-evm/         # ProjectToken, VNDToken, ProfitDistributor, EnergyOracle, Redemption (+ Dockerfile chạy hardhat node)
   │  └─ trex/               # ERC-3643 thật — production sau
   ├─ contracts-stellar/     # Soroban — phase Stellar
   └─ shared/                # ABI (generated), addresses.json, chain config, TS types — MỘT nguồn sự thật
```

## 4. Ba trục abstraction (BẮT BUỘC — để kế thừa/mở rộng linh hoạt)

### 4.1 `ILedgerPort` (đa chain)
Nghiệp vụ chỉ gọi interface, không gọi thẳng viem/chain. Thêm chain = thêm adapter + đăng ký vào factory. Thêm luồng = thêm method + hiện thực ở adapter.
```ts
export type Chain = 'hardhat-local' | 'evm' | 'stellar' | 'mock';
export interface TxResult { txHash: string; status: 'PENDING'|'CONFIRMED'|'FAILED'; }
export interface ILedgerPort {
  whitelist(wallet: string): Promise<TxResult>;
  isWhitelisted(wallet: string): Promise<boolean>;
  mint(to: string, amount: bigint): Promise<TxResult>;
  burn(from: string, amount: bigint): Promise<TxResult>;
  transfer(from: string, to: string, amount: bigint): Promise<TxResult>;
  freeze(wallet: string, frozen: boolean): Promise<TxResult>;
  forcedTransfer(from: string, to: string, amount: bigint): Promise<TxResult>; // clawback
  balanceOf(wallet: string): Promise<bigint>;
  waitReceipt(txHash: string, timeoutMs?: number): Promise<TxResult>;
}
export function getLedger(chain: Chain): ILedgerPort; // factory theo chain đã chọn
```

### 4.2 `ISigner` (đổi custody không sửa nghiệp vụ)
- `walletSigner` (client, RainbowKit) cho thao tác NĐT.
- `serverSigner` (server key trong `.env`) cho thao tác đặc quyền ngân hàng (mint) ở PoC.
- `fireblocksSigner` (stub) — cắm sau, vì Fireblocks là EIP-1193 provider nên chỉ đổi factory.

### 4.3 Providers có toggle mock|real + RBAC
- `IKycProvider`, `IOracleProvider`, `ICoreBankProvider`: mỗi cái có bản `mock` (mặc định) và `real`, chọn bằng feature flag `USE_MOCK_*`. → dựng luồng bằng mock trước, thay real sau.
- RBAC: bảng `role→permission` (Prisma) + `can(role, action)` dùng trong server actions. PoC 2 role `BANK_ADMIN`/`INVESTOR`; thêm role về sau = thêm dữ liệu, không sửa code.

## 5. Kế hoạch phase (ưu tiên MINT)
- **P0 — Hợp nhất & nền:** đổi cây thư mục về §3; `docker compose up` dựng chain+db+web; deploy `ProjectToken`+`VNDToken` lên hardhat-local; sinh ABI+`addresses.json` sang `packages/shared`; dựng `ILedgerPort`+`evm.adapter`+`mock.adapter`; chain-selector + feature-flag khung. **DoD:** compose chạy, đọc balance được, đổi chain trên UI không lỗi.
- **P1 — DEMO MINT 🎯:** trang **Mint** (Admin): whitelist NĐT (KYC mock auto-approve) → `mint(NĐT, amount)` qua `ILedgerPort` → chờ receipt → hiện **balance on-chain thật** (bỏ mock ở chỗ này). **DoD:** từ UI hoặc demo runner: mint 100 → balance = 100; đổi selector sang `mock` vẫn demo được không cần chain.
- **P2** Redeem/Burn (dùng `Redemption`) → **P3** Chia lợi tức (`ProfitDistributor`+`EnergyOracle`, oracle mock) → **P4** KYC/audit/RBAC thật + Postgres → **P5** thay `serverSigner`→**Fireblocks**, freeze/clawback UI → **P6** thêm **EVM testnet** → **P7** **Stellar** (adapter Soroban đã có).

## 6. Non-goals (giai đoạn đầu)
Fireblocks/HSM thật, T-REX onboarding, Stellar, EVM testnet, KYC/Core Bank thật, maker-checker đầy đủ, báo cáo cơ quan QL. **Nhưng kiến trúc phải chừa sẵn chỗ cắm** (§4).

## 7. Cách làm việc & nghiệm thu
Theo `docs/WORKING_PROTOCOL.md`. Mỗi phase Kiro nộp `docs/CHECKPOINT_TEMPLATE.md`; Supervisor trả review theo `docs/REVIEW_TEMPLATE.md`. **Cổng P1 Supervisor soi 3 điểm:** (a) mọi lời gọi chain qua `ILedgerPort`; (b) ký qua `ISigner`; (c) quyền qua RBAC. Lỗi lặp lại → nâng thành rule trong `.kiro/steering/lessons.md` và báo Owner.
