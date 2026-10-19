# SC-07: các bước

> Đọc trước: `.kiro/steering/efficiency.md`, `docs/sc-07-vault-thanh-toan/requirements.md` (bản 2),
> `docs/ds-01-kien-truc-hop-dong/design.md` (bản 3, mục 3, 7, 8),
> `packages/contracts-evm/contracts/tokens/ProjectToken.sol`, `ProfitDistributor.sol`,
> `packages/contracts-evm/scripts/deploy.js`, `app/src/lib/ledger/ledger.port.ts`,
> `app/src/lib/bank/seller.service.ts`, `app/src/lib/bank/issuance.service.ts`,
> `app/src/components/layout/nav-config.ts`.
> Nhánh `feat/sc-07-vault-thanh-toan` từ `dev` @ `3342c2e`.

## Bước 0: Nhận task và đo lại

1. Chép `docs/sc-07-vault-thanh-toan/` và `docs/ds-01-kien-truc-hop-dong/design.md` (bản 4) vào repo. Thêm
   `SC-07` vào `inProgress`.
2. K1: thêm bằng chứng Phụ lục A vào `CHECKPOINT_SC09.md` (điều kiện 11), `CHECKPOINT_SC10.md` (điều kiện 7),
   `CHECKPOINT_OP06.md` (điều kiện 7). Đổi ✅ và chuyển `SC-09`, `SC-10` sang `done`. `OP-06` chỉ chuyển
   khi requirements ghi chủ dự án đã xác nhận mục "lịch sử bền"; nếu chưa thì giữ 🔶 và `inProgress`.
3. Chạy các lệnh ở "Hiện trạng đã đo", ghi số ca bộ hợp đồng và kết quả `run-local-all.sh` trước khi sửa.

Commit: `chore(sc-07): nhận task, cập nhật bằng chứng Sepolia SC-09 SC-10`

## Bước 1: Hợp đồng vault

1. Viết `test/sc-07-vault.test.js` cho ca 1 đến 15 **trước**, chạy cho đỏ (hợp đồng chưa có).
2. Viết `contracts/SpvPaymentVault.sol` theo QĐ-A đến QĐ-E và QĐ-H; NatSpec ghi QĐ-G, luật làm tròn và giới
   hạn bảo vệ của `payoutWallet`.
3. Chạy toàn bộ kiểm thử hợp đồng.

Commit: `feat(sc-07): hợp đồng vault thanh toán SPV và luật khoá`

## Bước 2: Nguyên tử hai chân, gọi lồng và tương tác với hợp đồng có sẵn

1. `contracts/test/TestMatcher.sol` (chỉ kiểm thử, không triển khai): giữ `MATCHER_ROLE`; hàm mua kéo VNDB
   từ nhà đầu tư vào vault bằng `transferFrom` rồi gọi `settleBuy`; hàm bán kéo WPT từ nhà đầu tư vào vault
   rồi gọi `settleSell`. Hình mẫu cho SC-03, không phải thiết kế cuối của SC-03.
2. `contracts/test/ReentrantModule.sol` (chỉ kiểm thử): module compliance, trong `moduleTransferAction` gọi
   lại `vault.settleBuy` với cùng `orderRef`.
3. Viết ca 16 đến 20.

Commit: `test(sc-07): nguyên tử hai chân, gọi lồng, đăng ký danh tính, lợi nhuận và đường agent`

## Bước 3: Đột biến

Chạy đột biến 22a đến 22l, dán đầu ra đỏ, hoàn nguyên, dán `git status` sạch. Không có đột biến nào được
phép "không đỏ"; nếu một đột biến không đỏ thì bổ sung ca kiểm thử rồi chạy lại.

## Bước 4: Triển khai, address book và script

1. `deploy.js` theo QĐ-F, ghi `deployBlock`; `DeploymentRecord.deployBlock?`; `CONTRACT_NAMES`; ABI dùng
   chung; `addresses.json` cho `hardhat-local`. Kiểm `git diff packages/shared/src/addresses.json`: 7 địa chỉ
   hardhat-local cũ không đổi, khoá `evm` không đổi.
2. `verify-deployment.js`, `fund-sepolia.js` theo R8.
3. `vault-admin.js` theo R7. Chạy thử trên nút Hardhat cục bộ: `status`, `set-rate`, `set-mode`,
   `close-period`, `set-payout`; một lần không có `VAULT_ADMIN_CONFIRM` (chỉ in) và một lần có.
4. K2, K3.

Commit: `feat(sc-07): triển khai vault, deployBlock, script cấu hình và công cụ Sepolia`

## Bước 5: Ứng dụng

1. R1 (cổng và ba adapter, đọc sự kiện từ `deployBlock`), R5 (dịch lỗi).
2. R2 (quyền), R3 (màn `/vault` và menu), R4 (kiểu phân biệt nguồn, ví thanh toán là vault), R6 (liệt kê mọi
   đường gọi `mintInitialSupply` bằng `grep`, chặn từng đường).
3. Kiểm thử ca 23.

Commit: `feat(sc-07): đọc vault, màn công khai và chặn Mint đầu sai đích`

## Bước 6: Tài liệu và bàn giao

Cập nhật `docs/tech-report.md` (mục vault và mục điểm khôi phục K4), `packages/contracts-evm/README.md`.

```bash
cd packages/contracts-evm && npx hardhat test && cd ../..
bash scripts/run-local-all.sh

# Mô phỏng job A: dời artifacts sang thư mục tạm, LUÔN phục hồi kể cả khi lệnh giữa thất bại
(
  set -e
  BAK="$(mktemp -d)"
  mv packages/contracts-evm/artifacts "$BAK/artifacts"
  trap 'mv "$BAK/artifacts" packages/contracts-evm/artifacts && rmdir "$BAK"' EXIT
  bash scripts/run-local-all.sh arch markers checkpoint app
)
test -d packages/contracts-evm/artifacts && echo "artifacts đã phục hồi"

bash scripts/evm-local.sh reset
(cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/evm-issuance.test.ts)
# và tệp kiểm thử vault trên nút thật của bước 5
bash scripts/evm-local.sh down
git log -p origin/dev..HEAD | grep -nE "postgres(ql)?://[^@ ]+:[^@ ]+@[^l1d ]|PRIVATE_KEY=0x[0-9a-fA-F]{64}" \
  | grep -v ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 || echo "không có bí mật"
```

Viết `docs/CHECKPOINT_SC07.md`, mục 0 đối chiếu đủ điều kiện hoàn thành, dán nguyên văn đầu ra.

Commit: `docs(sc-07): bàn giao kiểm chứng`

## Sau merge **[Chủ dự án]**

- Tạo và push tag `poc-spv-vi-thuong-20261019` tại `3342c2e` (K4).
- Không có bước Sepolia. OP-05 (sau SC-03) triển khai lại `evm`: Mint đầu vào vault (R6 chặn sai đích), đăng
  ký và đặt `payoutWallet`, cấu hình khoá bằng `vault-admin.js`.
