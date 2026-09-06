# BIDV RWA Tokenize — Token hóa tài sản ĐIỆN GIÓ (PoC)

Nền tảng token hóa dự án điện gió theo góc ngân hàng (BIDV): phát hành token quyền hưởng có kiểm soát (KYC/whitelist/freeze/clawback), chia lợi tức theo sản lượng, hoàn vốn — trên EVM (Hardhat local → EVM testnet) và Stellar (sau).

## Chạy nhanh (Docker Compose)
```bash
cp .env.example .env
docker compose up          # dựng: chain (hardhat) + db (postgres) + web (Next.js)
# web  → http://localhost:3000
# chain→ http://localhost:8545
```
Mặc định: chain `hardhat-local`, các tích hợp (KYC/Oracle/Core Bank) ở chế độ **mock** → mint chạy được ngay, không cần key ngoài.

## Chọn chain & mock trên giao diện
- Dropdown chain: **hardhat-local** (mặc định) · **evm** (testnet) · **stellar** (sau).
- Toggle mock cho từng luồng để bật/tắt tích hợp thật.

## Cấu trúc
Xem `docs/SPEC.md` (kiến trúc + cây thư mục đích) và `docs/ARCHITECTURE.md`.

## Hợp đồng
`packages/contracts-evm` — ProjectToken (SPT) · VNDToken (tVND) · ProfitDistributor · EnergyOracle · Redemption. **13/13 test pass.**
```bash
cd packages/contracts-evm && npm install && npx hardhat test
```

## Quy trình phát triển (người + 2 AI)
Owner (Sếp) điều phối; Kiro thực thi theo `.kiro/`; Claude giám sát theo `docs/WORKING_PROTOCOL.md`.

> ⚠️ **Next.js 16**: có breaking changes so với bản cũ. Đọc `app/AGENTS.md` và `node_modules/next/dist/docs/` trước khi sửa `app/`.

## Triển khai demo
Mặc định **free-tier** (Cloudflare Workers + Supabase/Neon, chain `mock`/`evm`-testnet). Đầy đủ thì `docker compose up` trên VPS. Chi tiết + ràng buộc kích thước Cloudflare: xem `docs/DEPLOYMENT.md`.
