# Bàn giao Kiro: P4, P7, P12 trên Ethereum testnet (Sepolia)

## Mục tiêu

Đưa ba luồng lõi của dự án RWA điện gió chạy thật trên Ethereum testnet Sepolia:

- P4 Mint: phát hành WPT cho nhà đầu tư đã KYC (`ProjectToken`).
- P7 Chia lợi tức: snapshot + nạp quỹ VND + nhà đầu tư nhận theo tỷ lệ; có nhánh oracle sản
  lượng (`ProfitDistributor` / `ProfitDistributorOracle` + `EnergyOracle`).
- P12 Tất toán: nhà đầu tư đổi WPT lấy VND, WPT bị đốt (`Redemption`).

Số hiệu P4/P7/P12 theo hệ đánh số cũ (khớp spec Kiro, slide) đã chốt với chủ dự án.

## Bối cảnh quan trọng

Bộ contract đã có sẵn trong repo và đã pass 13/13 test trên hardhat-local. Vì vậy phần lớn
việc KHÔNG phải viết lại contract, mà là:

- Deploy + verify bộ contract lên Sepolia, nạp địa chỉ vào nguồn sự thật `packages/shared`.
- P4: adapter EVM đã tham số hóa theo chain nên gần như chỉ cấu hình + kiểm chứng.
- P7 và P12: `ILedgerPort` hiện chỉ có nghiệp vụ token, CHƯA có method cho ProfitDistributor,
  EnergyOracle, Redemption. Đây là phần Kiro viết thêm: mở rộng port + adapter EVM + mock +
  bổ sung ABI/địa chỉ ở shared + thêm ACTIONS trong RBAC + UI.

Contract giữ nguyên (đã pass test). Nếu buộc phải đổi contract, Kiro DỪNG và báo trong
checkpoint, không tự sửa.

## Ánh xạ luồng sang contract và hàm chính

- P4: `ProjectToken.setWhitelisted`, `mint`, `isWhitelisted`, `balanceOf`.
- P7: `ProfitDistributor.createDistribution/entitlementOf/previewClaim/claim/distributeTo`;
  `ProfitDistributorOracle.createDistributionFromOracle`;
  `EnergyOracle.submitReading/isFinalized/distributableProfitVnd`;
  `ProjectToken.snapshot` (distributor cần SNAPSHOT_ROLE).
- P12: `Redemption.setRate/fund/setPaused/quote/redeem/withdraw`; `ProjectToken.burnFrom`.

## Thứ tự thực hiện (có phụ thuộc)

1. P4 (spec `p4-mint-testnet`) trước: nó sở hữu Phase 0 bring-up dùng chung (deploy 4 contract
   lên Sepolia, nạp địa chỉ, verify). P7 và P12 phụ thuộc bước này.
2. Sau khi P4 xong, làm P7 và P12 song song (hai spec độc lập nhau).

## Cấu trúc gói (giải nén vào gốc repo bidv-rwa-tokenize)

```
.kiro/
  steering/
    testnet.md                       # bối cảnh Sepolia + bring-up dùng chung (inclusion: manual)
  specs/
    p4-mint-testnet/{requirements,design,tasks}.md
    p7-profit-distribution/{requirements,design,tasks}.md
    p12-redemption/{requirements,design,tasks}.md
HANDOFF_P4_P7_P12.md                 # file này
```

Trộn thẳng `.kiro/` vào repo hiện có. Steering `testnet.md` để chế độ `manual` nên không tự
nạp; trỏ bằng `#steering-testnet` khi làm ba spec này.

## Cách giao cho Kiro

Câu mở đầu gợi ý cho từng spec, ví dụ P4:

> Đọc `#steering-testnet` và spec `#spec p4-mint-testnet`. Tuân thủ steering trong
> `.kiro/steering`. Làm Phase 0 rồi Phase 1 theo `tasks.md`, báo cáo theo
> `docs/CHECKPOINT_TEMPLATE.md`. Contract giữ nguyên; nếu cần đổi contract thì dừng và hỏi.

Tương tự cho `#spec p7-profit-distribution` và `#spec p12-redemption` sau khi P4 xong.

## Nghiệm thu tổng

Mỗi luồng PASS khi: giao dịch CONFIRMED trên Sepolia, tra được trên
`https://sepolia.etherscan.io`, số dư on-chain khớp kỳ vọng (mint tăng WPT; chia lợi tức nhà
đầu tư nhận đúng tỷ lệ VND; tất toán WPT giảm và VND tăng đúng quote), và ba luật kiến trúc
giữ nguyên.

## Điểm Supervisor sẽ kiểm khi review

- Grep 3 luật: viem/ethers không xuất hiện ngoài `app/src/lib`; khóa bí mật chỉ ở
  `config/env.ts` và `signer/server.signer.ts`; không có `role === '...'` cứng ngoài
  `app/src/lib/rbac`.
- ABI và địa chỉ chỉ nằm trong `packages/shared` (không copy rải rác).
- Contract Solidity không bị sửa logic (so với bản đã pass test).
- Bằng chứng số dư trước/sau trên Sepolia + link tx cho từng DoD Phase kiểm chứng.
