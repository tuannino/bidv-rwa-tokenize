---
inclusion: fileMatch
fileMatchPattern: "packages/contracts-evm/**/*.sol"
---
# Quy tắc hợp đồng EVM (điện gió)

- Bộ contract chính **đã có và đã pass 13 test** — ĐỪNG viết lại từ đầu. Ưu tiên tái dùng: `ProjectToken` (mint/whitelist/freeze/clawback/snapshot), `VNDToken`, `ProfitDistributor`, `EnergyOracle`, `Redemption`.
- Demo dùng **ProjectToken** (bản rút gọn). **KHÔNG** kéo T-REX vào toolchain chính (T-REX pin solc 0.8.17 + OZ v4, sẽ xung đột với 0.8.28 + OZ v5). Giữ `trex/` tách biệt.
- Giữ mô hình role sẵn có: `MINTER_ROLE`, `AGENT_ROLE`, `SNAPSHOT_ROLE`, `PAUSER_ROLE`.
- Khi sửa/thêm: luôn thêm test tương ứng; chạy `npx hardhat test` phải xanh trước khi mở PR.
- Sau khi deploy, xuất ABI + địa chỉ sang `packages/shared` (một nguồn sự thật cho frontend).
- Số thập phân WPT/tVND = 0 theo thiết kế (số học minh bạch) — đừng đổi trừ khi có yêu cầu.
