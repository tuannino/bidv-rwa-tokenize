# RWA Năng lượng tái tạo trên EVM — Bộ hợp đồng Solidity

Workspace token hóa dự án điện mặt trời có chia lợi nhuận định kỳ (góc ngân hàng), chạy trên Ethereum hoặc mọi mạng tương thích EVM (kể cả Hyperledger Besu permissioned).

| Hợp đồng | Vai trò | Quy trình bao gồm |
|---|---|---|
| `ProjectToken` (SPT) | Token quyền hưởng có kiểm soát | mint, burn, clawback (forced transfer), freeze, whitelist/KYC, snapshot |
| `VNDToken` (tVND) | Token thanh toán VND | mint, burn |
| `ProfitDistributor` | Tính & chia lợi nhuận định kỳ | createDistribution (chốt kỳ), previewClaim (tính), claim/claimMany/distributeTo (chia), sweepDust |
| `EnergyOracle` | Oracle sản lượng điện → công thức lợi nhuận | submitReading (đa reporter xác nhận), distributableProfitVnd |
| `ProfitDistributorOracle` | Chia lợi nhuận lấy số từ oracle | createDistributionFromOracle, previewDistributableFromOracle |
| `Redemption` | Mua lại / hoàn vốn | redeem (đốt SPT đổi VND), setRate, pause, fund/withdraw |

Ngoài ra thư mục **`trex/`** là kit **ERC-3643 thật** (thư viện T-REX của Tokeny) — bản token chứng khoán tuân thủ chuẩn, đã kiểm toán, để dùng khi lên sản xuất. Xem mục 7 tài liệu hướng dẫn.

## Chạy nhanh

```bash
npm install
npx hardhat compile     # biên dịch
npx hardhat test        # 13 test (8 gốc + 5 oracle)
npx hardhat run scripts/demo-cycle.js    # demo chia lợi nhuận nhập tay
npx hardhat run scripts/demo-oracle.js   # demo chia lợi nhuận lấy số từ oracle
```

## Triển khai

```bash
cp .env.example .env    # điền PRIVATE_KEY, RPC
npx hardhat run scripts/deploy.js --network sepolia   # hoặc --network besu
```

Hướng dẫn cài đặt và triển khai chi tiết (giải thích từng hợp đồng, dựng Besu, chạy một chu kỳ trên testnet): xem `20260810_huong_dan_smart_contract_evm_rwa.md`.

## Lưu ý phiên bản
- Solidity 0.8.28, OpenZeppelin Contracts v5, Hardhat v2.
- `hardhat.config.js` có một đoạn override để dùng `solc` cục bộ (do môi trường dựng bộ này chặn máy chủ tải solc). Trên máy có internet bình thường, đoạn này vô hại và Hardhat vẫn hoạt động chuẩn.
- SPT và tVND để 0 số thập phân cho số học minh bạch; đổi qua constructor nếu cần.
