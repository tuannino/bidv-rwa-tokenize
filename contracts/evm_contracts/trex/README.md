# Kit ERC-3643 (T-REX) — token dự án RWA phiên bản sản xuất

Đây là bộ triển khai **ERC-3643 thật** dùng thư viện chính chủ của Tokeny
(`@tokenysolutions/t-rex` + `@onchain-id/solidity`). Nó chạy **độc lập** với
project chính (thư mục cha) vì T-REX pin đúng toolchain riêng: **solc 0.8.17 +
OpenZeppelin v4**, trong khi project chính dùng solc 0.8.28 + OpenZeppelin v5.
Trộn hai hệ vào một project sẽ xung đột import OpenZeppelin — nên tách ra là cố ý.

## Vì sao có kit này
Token `ProjectToken` ở project chính là bản **rút gọn dễ đọc** theo tinh thần
ERC-3643. Khi lên sản xuất, ngân hàng nên dùng bộ T-REX đã được kiểm toán ở đây:
token gắn **ONCHAINID** (danh tính on-chain), **IdentityRegistry** (sổ nhà đầu tư
đã KYC), **Trusted Issuers / Claim Topics** (ai được cấp claim gì) và
**ModularCompliance** (module luật giao dịch).

## Thành phần được deploy
| Thành phần | Vai trò |
|---|---|
| `Token` (ERC-3643) | Token chứng khoán, ERC-20 tương thích + kiểm soát chuyển nhượng |
| `IdentityRegistry` | Sổ danh tính nhà đầu tư đủ điều kiện nắm giữ |
| `IdentityRegistryStorage` | Kho lưu trữ danh tính (dùng chung được nhiều token) |
| `TrustedIssuersRegistry` | Danh sách tổ chức được tin cậy cấp claim (KYC/AML) |
| `ClaimTopicsRegistry` | Danh sách loại claim bắt buộc để nắm token |
| `ModularCompliance` | Bộ module thực thi luật giao dịch (trần sở hữu, hạn chế quốc gia...) |
| `TREXFactory` + `ImplementationAuthority` | Nhà máy triển khai chuẩn + quản lý phiên bản/upgrade |
| `ClaimIssuer` (ONCHAINID) | Tổ chức KYC ký claim cho nhà đầu tư |

## Cài đặt & chạy
```bash
cd trex
npm install
npx hardhat test           # deploy + onboard + mint + compliance end-to-end
```

> Ghi chú offline: `hardhat.config.js` có đoạn trỏ solc 0.8.17 về gói WASM cài qua
> npm (alias `solc-0817`), phục vụ môi trường chặn máy chủ tải solc. Trên máy
> internet bình thường KHÔNG cần đoạn này.

## Deploy lên mạng thật
```bash
cp .env.example .env       # điền PRIVATE_KEY, RPC
npx hardhat run scripts/deploy-trex.js --network sepolia
# hoặc: --network besu
```
Địa chỉ triển khai được lưu ở `deployments/trex-<network>.json`.

## Onboard nhà đầu tư (bắt buộc trước khi mint)
Xem hàm `onboardInvestor(...)` trong `scripts/deploy-lib.js`. Quy trình:
1. Tạo **ONCHAINID** cho ví nhà đầu tư (`IdFactory.createIdentity`).
2. **ClaimIssuer ký claim KYC** cho ONCHAINID đó.
3. Ví nhà đầu tư **thêm claim** vào ONCHAINID của mình (`addClaim`).
4. Agent **đăng ký** vào `IdentityRegistry` (`registerIdentity`).
→ Sau đó `identityRegistry.isVerified(investor) == true`, token agent mới `mint` được.

## Ghép với module lợi nhuận / hoàn vốn
Token T-REX là ERC-20 tương thích nên `ProfitDistributor`/`Redemption` ở project
chính vẫn dùng được ở **chế độ push** (ngân hàng tính suất chia off-chain từ ảnh
chụp số dư theo block rồi đẩy VND). Xem mục 8–9 tài liệu hướng dẫn để biết khác
biệt giữa "snapshot on-chain" (token pilot) và "snapshot theo indexer" (token T-REX).
