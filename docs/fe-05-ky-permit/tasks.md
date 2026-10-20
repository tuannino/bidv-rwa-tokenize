# FE-05: các bước

> Đọc trước: `.kiro/steering/efficiency.md`, `docs/fe-05-ky-permit/requirements.md` (bản 2),
> `docs/sc-03-khop-lenh/requirements.md` (QĐ-B, QĐ-C, R5, R6), `packages/shared/src/permit.js`,
> `packages/contracts-evm/contracts/OrderSettlement.sol`, `app/src/components/pages/investor-trade.tsx`,
> `app/src/lib/bank/purchase.service.ts`, `app/src/lib/bank/trade.service.ts`, `app/src/lib/ledger/evm.adapter.ts`,
> `app/src/lib/store/postgres.pool.ts`, `app/src/app/api/purchase/route.ts`, `app/e2e/wallet-connect.spec.ts`,
> `app/playwright.config.ts`.
> Nhánh `feat/fe-05-ky-permit` từ `dev` **sau khi PR #58 (SC-06) merge**.

## Bước 0: Nhận task và đo lại

Chép `docs/fe-05-ky-permit/` vào repo; `FE-05` vào `inProgress`. Chạy các lệnh ở "Hiện trạng đã đo", ghi kết quả
`run-local-all.sh`.

Commit: `chore(fe-05): nhận task`

## Bước 1: Dùng chung và cấu hình

1. `buildPermitTypedData` nhận `version` bắt buộc; sửa `permit.d.ts`, hai test hợp đồng gọi hàm (chạy lại
   `npx hardhat test`).
2. ABI `eip712Domain` cho hai token; kiểm đồng bộ ABI.
3. `CONFIG_KEYS` và hằng mặc định cho hai khoá `order.permit_*`; method cổng `latestBlockTimestamp()`.
4. Kiểm thử ca 1b.

Commit: `feat(fe-05): domain permit đọc từ chuỗi, cấu hình thời hạn chữ ký`

## Bước 2: Máy chủ

1. `readPermitDomain`, `preparePermit` (service và action) theo QĐ-B.
2. `placeOrder` theo QĐ-C và QĐ-D (đúng thứ tự tám bước).
3. Lưu `permit` theo QĐ-E: lược đồ, `init.sql`, `npm run db:embed-sql`, `ADDED_COLUMNS`, hai cổng lưu trữ, kiểm khuôn
   khi đọc.
4. Bộ kiểm theo QĐ-F (preview) và QĐ-G (quyết toán, phục hồi); cổng `SettlementOrder.permit`, adapter EVM gọi hàm
   `WithPermit`; mock bỏ qua.
5. Chuyển test app SC-03 đặt lệnh trên nút thật sang ký bằng helper kiểm thử.
6. Kiểm thử ca 1 đến 3, 9 đến 13 (phần không cần nút thật); ca 4 đến 8, 11 trên nút Hardhat thật.

Commit: `feat(fe-05): bắt buộc chữ ký permit khi đặt lệnh trên chain thật`

## Bước 3: Giao diện và e2e

1. Hộp xác nhận ký theo QĐ-I, xử lý huỷ ký, sai mạng.
2. E2E ca 14 theo QĐ-J; thêm tệp vào `testMatch` của project `hardhat`.

Commit: `feat(fe-05): nhà đầu tư ký permit khi đặt lệnh`

## Bước 4: Đột biến

Chạy 15a đến 15f, dán đầu ra đỏ, hoàn nguyên, dán `git status` sạch.

## Bước 5: Tài liệu và bàn giao

Cập nhật `docs/tech-report.md`. Sinh lại sơ đồ luồng `purchase` nếu điểm cắm đổi dòng
(`node scripts/gen-flow-diagram.mjs purchase`).

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

bash scripts/run-local-all.sh build evm

# Kiểm thử nút thật: chạy TỪNG TỆP một lệnh, reset chuỗi trước mỗi tệp (các tệp dùng chung trạng thái chuỗi)
for f in test/evm-order-settlement.test.ts test/<tệp permit nút thật của bước 2>; do
  bash scripts/evm-local.sh reset
  (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run "$f")
done
bash scripts/evm-local.sh down

git log -p origin/dev..HEAD | grep -nE "postgres(ql)?://[^@ ]+:[^@ ]+@[^l1d ]|PRIVATE_KEY=0x[0-9a-fA-F]{64}" \
  | grep -v ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 || echo "không có bí mật"
```

Lưu ý quét bí mật: nếu dùng khoá tài khoản Hardhat khác #0, ghi rõ trong checkpoint và loại trừ đúng khoá đó.

Viết `docs/CHECKPOINT_FE05.md`, mục 0 đối chiếu đủ điều kiện hoàn thành, dán nguyên văn đầu ra.

Commit: `docs(fe-05): bàn giao kiểm chứng`
