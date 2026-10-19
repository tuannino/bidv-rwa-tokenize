# RWA Năng lượng tái tạo trên EVM — Bộ hợp đồng Solidity

Workspace token hóa dự án điện gió có chia lợi nhuận định kỳ (góc ngân hàng), hiện kiểm chứng trên Hardhat và Ethereum Sepolia.

| Hợp đồng | Vai trò | Quy trình bao gồm |
|---|---|---|
| `ProjectToken` (WPT) | Token quyền hưởng theo ERC-3643 PoC | mint/burn, forced transfer, đóng băng toàn phần/một phần, snapshot, ERC-2612 permit |
| `IdentityRegistry` | Sổ danh tính ERC-3643 PoC | đăng ký/xóa ví và mã quốc gia; `isVerified` |
| `ModularCompliance` + `AllowAllModule` | Bộ luật chuyển nhượng ERC-3643 PoC | module hóa kiểm tra và action sau chuyển/mint/burn |
| `VNDToken` (VNDB) | Token thanh toán VND | mint, burn, ERC-2612 permit |
| `ProfitDistributor` | Tính & chia lợi nhuận định kỳ | createDistribution (chốt kỳ), previewClaim (tính), claim/claimMany/distributeTo (chia), sweepDust |
| `EnergyOracle` | Oracle sản lượng điện → công thức lợi nhuận | submitReading (đa reporter xác nhận), distributableProfitVnd |
| `ProfitDistributorOracle` | Chia lợi nhuận lấy số từ oracle | createDistributionFromOracle, previewDistributableFromOracle |
| `Redemption` | Mua lại / hoàn vốn | redeem (đốt WPT đổi VND), setRate, pause, fund/withdraw |

`ProjectToken` hiện thực tập selector ERC-3643/T-REX v4.1.6 đã chốt cho PoC, nhưng cố ý chưa đưa ONCHAINID/claim registry vào phạm vi. Thư mục **`trex/`** là project tham khảo độc lập, không trộn toolchain với bộ hợp đồng chính.

## Chạy nhanh

```bash
npm install
npx hardhat compile     # biên dịch
npx hardhat test        # hiện có 96 ca
npx hardhat run scripts/demo-cycle.js    # demo chia lợi nhuận nhập tay
npx hardhat run scripts/demo-oracle.js   # demo chia lợi nhuận lấy số từ oracle
```

## Triển khai

```bash
cp .env.example .env    # điền PRIVATE_KEY, RPC
npx hardhat run scripts/deploy.js --network sepolia
```

Triển khai local dùng `bash scripts/evm-local.sh reset` từ gốc repo; script sẽ triển khai, nối registry/compliance và seed ví mẫu. Runbook Sepolia: `docs/TESTNET_SEPOLIA.md`.

## Lưu ý phiên bản
- Solidity 0.8.28, OpenZeppelin Contracts **5.6.1**, Hardhat v2; bytecode hiện nhắm **Cancun** vì ERC20Permit của OZ 5.6.1 dùng opcode MCOPY.
- Tương thích Hyperledger Besu được để ngỏ sau SC-09. Không coi cấu hình `besu` còn lại là bằng chứng bộ bytecode hiện tại chạy được; cần task riêng đo phiên bản Besu hỗ trợ Cancun hoặc chốt phương án compiler/OZ khác.
- `hardhat.config.js` có một đoạn override để dùng `solc` cục bộ (do môi trường dựng bộ này chặn máy chủ tải solc). Trên máy có internet bình thường, đoạn này vô hại và Hardhat vẫn hoạt động chuẩn.
- WPT và VNDB để 0 số thập phân cho số học minh bạch; đổi qua constructor nếu cần.


SC-10: ProjectToken nhận thêm `cap` ở cuối constructor, đơn vị nhỏ nhất, không có setter.
Deployment hiện dùng decimals 0 và cap 20.000.000 WPT từ `shared/src/token-parameters.json`,
cùng nguồn với giá trị seed ứng dụng. `ProfitDistributor` lưu deadline/closed riêng từng kỳ;
đường cưỡng chế WPT báo action compliance. Bytecode đổi: reset local; sau merge triển khai lại
Sepolia một lần theo `docs/TESTNET_SEPOLIA.md`, không đổi thứ tự bảy hợp đồng.
