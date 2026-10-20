# SC-03: các bước

> Đọc trước: `.kiro/steering/efficiency.md`, `docs/sc-03-khop-lenh/requirements.md`,
> `docs/sc-07-vault-thanh-toan/requirements.md` (QĐ-C), `docs/ds-01-kien-truc-hop-dong/design.md` (bản 4),
> `packages/contracts-evm/contracts/SpvPaymentVault.sol`, `app/src/lib/ledger/ledger.port.ts`,
> `app/src/lib/ledger/evm.adapter.ts`, `app/src/lib/ledger/mock.adapter.ts`,
> `app/src/lib/bank/purchase.service.ts`, `docs/CHECKPOINT_BE17.md`.
> Nhánh `feat/sc-03-khop-lenh` từ `dev` sau khi SC-07 merge. **Chỉ bắt đầu khi spec đã chốt các CH.**

## Bước 0: Nhận task và đo lại

Chép `docs/sc-03-khop-lenh/` vào repo; `SC-03` vào `inProgress`. Chạy các lệnh ở "Hiện trạng đã đo" trên
`dev` mới, ghi số ca bộ hợp đồng, kết quả `run-local-all.sh`, số điểm `@blocked` của `scan-pending`.

Commit: `chore(sc-03): nhận task`

## Bước 1: Hợp đồng

1. Viết `test/sc-03-khop-lenh.test.js` cho ca 1 đến 9 **trước** (ca 6: `approve` đúng số rồi gửi lại), chạy cho đỏ.
2. Viết `contracts/OrderSettlement.sol` theo QĐ-A, QĐ-B, QĐ-D, QĐ-E; NatSpec ghi QĐ-H.
3. Viết ca 10 đến 15 (`permit`, tạm dừng, vai, thay phiên bản, gọi lồng qua `ReentrantModule`), bổ sung QĐ-C.
4. Chạy toàn bộ kiểm thử hợp đồng.

Commit: `feat(sc-03): hợp đồng khớp lệnh nguyên tử hai chân và permit`

## Bước 2: Đột biến

Chạy 17a đến 17g, dán đầu ra đỏ, hoàn nguyên, dán `git status` sạch. Đột biến nào không đỏ thì bổ sung ca
kiểm thử rồi chạy lại.

## Bước 3: Triển khai và dùng chung

1. `token-parameters.json` thêm `wptIssuePriceVnd`; `issue-terms.ts` đọc từ đây (R8).
2. `deploy.js`, `CONTRACT_NAMES`, ABI dùng chung, `addresses.json` (`hardhat-local`); kiểm `git diff`: địa chỉ
   cũ không đổi, khoá `evm` không đổi.
3. `verify-deployment.js`, `fund-sepolia.js` theo QĐ-G.
4. `orderRefFromOrderId`, `orderIdFromOrderRef` trong `packages/shared` kèm ca 18.

Commit: `feat(sc-03): triển khai hợp đồng khớp lệnh và mã lệnh trên chuỗi`

## Bước 4: Ứng dụng

1. R1 (chữ ký cổng, kiểu kết quả ba trạng thái), R2 (gỡ 5 điểm chặn), R3 (mock, đọc trạng thái cũ), R4.
2. R5 (một hàm chung tra chuỗi trước mọi lần ghi `FAILED`, `REJECTED`), R6 (cạnh `EXECUTING` sang `CHECKING`),
   R7 (giá hiển thị đọc từ chuỗi), R8.
3. Chạy `node scripts/gen-flow-diagram.mjs purchase` sau khi sửa `purchase.service.ts` (12 điểm cắm mang số dòng),
   commit kết quả; `run-local-all.sh markers` phải xanh.
4. Kiểm thử ca 19 đến 23. Ca 20 đến 22 chạy trên nút Hardhat thật (`bash scripts/evm-local.sh reset`), có script
   dựng dữ liệu: Mint đầu vào vault, đăng ký nhà đầu tư, nạp VNDB, `approve`.

Commit: `feat(sc-03): luồng mua bán thật trên EVM, đối soát từ chuỗi và một nguồn giá`

## Bước 5: Tài liệu và bàn giao

Cập nhật `docs/tech-report.md` (mục khớp lệnh, máy trạng thái BE-17, P2 của BE-17), runbook `docs/TESTNET_SEPOLIA.md` (bước kiểm
giá R7 cho OP-05), `packages/contracts-evm/README.md`.

```bash
cd packages/contracts-evm && npx hardhat test && cd ../..
bash scripts/run-local-all.sh

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
# và tệp kiểm thử khớp lệnh trên nút thật của bước 4
bash scripts/evm-local.sh down
node scripts/scan-pending.mjs | grep "SC-03" || echo "không còn điểm chặn SC-03"
git log -p origin/dev..HEAD | grep -nE "postgres(ql)?://[^@ ]+:[^@ ]+@[^l1d ]|PRIVATE_KEY=0x[0-9a-fA-F]{64}" \
  | grep -v ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 || echo "không có bí mật"
```

Viết `docs/CHECKPOINT_SC03.md`, mục 0 đối chiếu đủ điều kiện hoàn thành, dán nguyên văn đầu ra.

Commit: `docs(sc-03): bàn giao kiểm chứng`

## Sau merge

Không có bước Sepolia. OP-05 (sau FE-05) triển khai lại `evm` với vault và hợp đồng khớp lệnh.
