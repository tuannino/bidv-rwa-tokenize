# Runbook: đưa luồng mint lên Ethereum testnet Sepolia (P4)

Tài liệu cho **Owner** thực hiện. Ba bước đầu cần thứ chỉ Owner có (ví, khóa, API key) nên
Kiro không làm được; từ bước 4 trở đi là lệnh chạy sẵn.

Kiểm tiến độ bất cứ lúc nào bằng preflight — nó chỉ ra đúng thứ còn thiếu:

```bash
cd packages/contracts-evm
npx hardhat run scripts/preflight-sepolia.js --network sepolia
```

Preflight thoát mã 1 khi chưa sẵn sàng, nên dùng được làm cổng trong CI.

---

## Bước 1 — Ví ngân hàng + ETH test  (T0.1)

Ví này vừa là **deployer** vừa là **server signer** của app. Constructor `ProjectToken` cấp
cho deployer toàn bộ role (`DEFAULT_ADMIN` / `MINTER` / `AGENT` / `SNAPSHOT` / `PAUSER`), nên
dùng chung một ví là đủ cho P4 và không phải cấp role thủ công.

1. Tạo ví mới **chỉ dùng cho testnet** (MetaMask → thêm account). Đừng dùng ví có tài sản thật.
2. Xin ETH test (cần ~0.05 ETH cho 4 contract + vài tx nghiệp vụ):
   - https://www.alchemy.com/faucets/ethereum-sepolia
   - https://sepoliafaucet.com
   - https://cloud.google.com/application/web3/faucet/ethereum/sepolia
3. Xuất private key (MetaMask → Account details → Show private key).

⚠️ Khóa này là bí mật. Chỉ dán vào `.env` (đã `.gitignore`). Không dán vào chat, không commit.

## Bước 2 — RPC + Etherscan API key  (T0.2)

| Biến | Lấy ở đâu | Bắt buộc? |
|---|---|---|
| `SEPOLIA_RPC_URL` | Infura / Alchemy (tạo app Sepolia, copy HTTPS endpoint) | Không — bỏ trống thì dùng endpoint công khai, nhưng bị rate-limit |
| `PRIVATE_KEY` | Bước 1 | **Có** |
| `ETHERSCAN_API_KEY` | https://etherscan.io/myapikey | Chỉ cần để verify source |

```bash
cd packages/contracts-evm
cp .env.example .env
# rồi mở .env và điền
```

## Bước 3 — Xác nhận sẵn sàng

```bash
npx hardhat run scripts/preflight-sepolia.js --network sepolia
```

Phải thấy `SẴN SÀNG`. Nếu báo thiếu ETH, quay lại faucet ở bước 1.

## Bước 4 — Deploy  (T0.4)

```bash
cd packages/contracts-evm
npx hardhat compile
npx hardhat run scripts/deploy.js --network sepolia
```

Script tự nhận chainId 11155111 là chainKey `evm` và ghi khối `"evm"` vào
`packages/shared/src/addresses.json`. **Chép lại 4 địa chỉ nó in ra.**

## Bước 5 — Nạp địa chỉ cho app  (T0.5)

Hai cách, chọn một (env **thắng** file nếu đặt cả hai):

**Cách A — env** (khuyến nghị; free-tier không đọc được filesystem lúc chạy). Thêm vào
`app/.env.local`:

```
NEXT_PUBLIC_DEFAULT_CHAIN=evm
NEXT_PUBLIC_ADDR_EVM_PROJECT_TOKEN=0x...
NEXT_PUBLIC_ADDR_EVM_VND_TOKEN=0x...
NEXT_PUBLIC_ADDR_EVM_PROFIT_DISTRIBUTOR=0x...
NEXT_PUBLIC_ADDR_EVM_REDEMPTION=0x...
SERVER_SIGNER_PRIVATE_KEY=0x...      # ví ngân hàng ở bước 1, PHẢI có ETH test
```

**Cách B — commit file**: `addresses.json` đã được deploy script ghi sẵn, chỉ cần commit.
Vẫn phải đặt `SERVER_SIGNER_PRIVATE_KEY`.

Tên biến được test khoá lại ở `app/test/evm-address-env.test.ts` — sai một ký tự là test đỏ,
không phải đi truy trên testnet.

## Bước 6 — Verify trên Etherscan  (T0.6)

Tham số phải trùng **đúng thứ tự** lúc deploy:

```bash
cd packages/contracts-evm
npx hardhat verify --network sepolia <ProjectToken> "Wind Power Token" "WPT" 0 <VÍ_NGÂN_HÀNG>
npx hardhat verify --network sepolia <VNDToken> <VÍ_NGÂN_HÀNG>
npx hardhat verify --network sepolia <ProfitDistributor> <ProjectToken> <VNDToken> <VÍ_NGÂN_HÀNG>
npx hardhat verify --network sepolia <Redemption> <ProjectToken> <VNDToken> 1000000 <VÍ_NGÂN_HÀNG>
```

## Bước 7 — Chạy luồng mint trên Sepolia  (T1.2, T1.3, T1.6)

```bash
cd app && npm run dev          # cửa sổ 1
node scripts/demo-mint.mjs --chain evm --wallet 0x<VÍ_NHÀ_ĐẦU_TƯ>   # cửa sổ 2
```

Runner in link `https://sepolia.etherscan.io/tx/<hash>` cho từng giao dịch và tự kiểm:
tx CONFIRMED, số dư tăng đúng, hai lần đọc khớp.

Hoặc làm từ UI: mở http://localhost:3000/mint, chọn **EVM Testnet (Sepolia)** ở dropdown
chain, dán ví nhà đầu tư → `1 · KYC + Whitelist` → `2 · Phát hành`.

Trên Sepolia mỗi bước chờ block ~12s; timeout receipt của chain `evm` là **90s**
(`EVM_RECEIPT_TIMEOUT_MS`), không phải 30s như hardhat-local.

## Những chỗ hay sai

| Triệu chứng | Nguyên nhân |
|---|---|
| `Chưa có địa chỉ ProjectToken cho chain "evm"` | Chưa làm bước 5, hoặc sai tên biến env |
| `insufficient funds for gas` | Ví ngân hàng hết ETH test → faucet lại |
| Tx mãi PENDING | RPC công khai bị rate-limit → đặt `SEPOLIA_RPC_URL` có API key |
| `Contract từ chối: phat hanh cho vi chua KYC` | Chưa whitelist ví nhà đầu tư (bước `1 · KYC + Whitelist`) |
| Verify báo sai bytecode | Tham số constructor không trùng lúc deploy |
| Mint chạy nhưng ví lạ | `SERVER_SIGNER_PRIVATE_KEY` không phải ví deployer → thiếu `MINTER_ROLE` |

## Sau khi P4 xong

Bước 1–6 là **bring-up dùng chung**: P7 (chia lợi tức) và P12 (tất toán) dùng lại, không
deploy lại. P7 nếu bật nhánh oracle thì chạy thêm `scripts/deploy-oracle.js` và cần mở rộng
`CONTRACT_NAMES` trong `packages/shared/src/types.ts` (thuộc spec p7).
