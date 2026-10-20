# SC-06: các bước

> Đọc trước: `.kiro/steering/efficiency.md`, `docs/sc-06-chia-loi-nhuan/requirements.md`,
> `docs/ds-01-kien-truc-hop-dong/design.md` (bản 4), `packages/contracts-evm/contracts/ProfitDistributor.sol`,
> `ProfitDistributorOracle.sol`, `app/src/lib/ledger/ledger.port.ts`, `app/src/lib/ledger/evm.adapter.ts`,
> `app/src/lib/ledger/mock.adapter.ts`, `app/src/lib/bank/distribution.service.ts`,
> `app/src/lib/bank/distribution-trigger.service.ts`, `app/prisma/schema.prisma`, `docs/CHECKPOINT_BE06.md`,
> `docs/CHECKPOINT_BE07.md`.
> Nhánh `feat/sc-06-chia-loi-nhuan` từ `dev` sau khi SC-03 merge (CH-1 đến CH-6 đã chốt).

## Bước 0: Nhận task và đo lại

Chép `docs/sc-06-chia-loi-nhuan/` và `docs/ds-01-kien-truc-hop-dong/design.md` (bản 5) vào repo; `SC-06` vào `inProgress`. Chạy các lệnh ở "Hiện trạng đã đo" trên
`dev` mới, ghi số ca bộ hợp đồng, kết quả `run-local-all.sh`, số điểm `@blocked SC-05`.

Commit: `chore(sc-06): nhận task, gộp SC-05`

## Bước 1: Hợp đồng

1. Viết `test/sc-06-chia-loi-nhuan.test.js` cho ca 1 đến 9 **trước**, chạy cho đỏ.
2. Sửa `ProfitDistributor.sol` theo QĐ-A, QĐ-B (gồm chống trùng nhãn), QĐ-C. Đổi các ca theo ngoại lệ QĐ-C
   (`sc-10`, `full-cycle`, `spec-p7` P7-22 P7-23 và tệp kiểm thử app liệt kê); ghi danh sách ca đã đổi.
3. Chạy toàn bộ kiểm thử hợp đồng (gồm `oracle-cycle`).

Commit: `feat(sc-06): quỹ chia lợi nhuận một chiều, tạo kỳ từ quỹ, đóng kỳ trả về quỹ`

## Bước 2: Đột biến

Chạy 11a đến 11g, dán đầu ra đỏ, hoàn nguyên, dán `git status` sạch. Đột biến nào không đỏ thì bổ sung ca kiểm
thử rồi chạy lại.

## Bước 3: Cổng chuỗi, adapter, lưu trữ

1. QĐ-D: cổng mới; adapter EVM; mock (sổ dự trữ, chống trùng nhãn, hạn nhận, đóng kỳ, chuyển đổi trạng thái
   cũ), stellar; gỡ `@blocked SC-05`. QĐ-G: `closeVaultPeriod`, `findVaultPeriodClose` trong nhóm vault.
2. QĐ-E: cột và trạng thái mới, `init.sql`, `npm run db:embed-sql`, cổng lưu trữ bộ nhớ và Postgres.
3. ABI dùng chung, `verify-deployment.js` (QĐ-J).
4. Kiểm thử ca 12, 13.

Commit: `feat(sc-06): cổng chia lợi nhuận mang mã kỳ trên chuỗi`

## Bước 4: Nối luồng

1. QĐ-F: mở kỳ có giữ chỗ `OPENING`, lưu mã giao dịch trước khi chờ, `recoverOpeningPeriod`.
2. QĐ-G: đẩy vault đúng một lần (giữ chỗ mã, đối soát `PeriodClosed`, `CONFLICT`).
3. QĐ-H: chia theo `distributionId`, người nhận có ví SPV, đối soát cả `FAILED`, vòng đời `EXPIRED`/`CLOSED`,
   script `distribution-admin.js close`. QĐ-I: BE-07 theo `unallocatedProfit`. QĐ-E: tiền tố chain cho mã kỳ.
4. Sinh lại sơ đồ luồng `distribute` nếu điểm cắm đổi dòng (`node scripts/gen-flow-diagram.mjs distribute`).
5. Kiểm thử ca 14 đến 20 (ca 14 đến 19 phần EVM trên nút Hardhat thật, `bash scripts/evm-local.sh reset`).

Commit: `feat(sc-06): mở kỳ và chia trên EVM, phần SPV vào vault, đẩy số đã chia vào vault`

## Bước 5: Tài liệu và bàn giao

Cập nhật `docs/tech-report.md` (mục chia lợi nhuận), `packages/contracts-evm/README.md`.

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

bash scripts/evm-local.sh reset
(cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/evm-issuance.test.ts)
# và tệp kiểm thử chia lợi nhuận trên nút thật của bước 4
bash scripts/evm-local.sh down
node scripts/scan-pending.mjs | grep "SC-05" || echo "không còn điểm chặn SC-05"
git log -p origin/dev..HEAD | grep -nE "postgres(ql)?://[^@ ]+:[^@ ]+@[^l1d ]|PRIVATE_KEY=0x[0-9a-fA-F]{64}" \
  | grep -v ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 || echo "không có bí mật"
```

Viết `docs/CHECKPOINT_SC06.md`, mục 0 đối chiếu đủ điều kiện hoàn thành, dán nguyên văn đầu ra.

Commit: `docs(sc-06): bàn giao kiểm chứng`

## Sau merge

Không có bước Sepolia. OP-05 (sau FE-05) triển khai lại `evm` với `ProfitDistributor` mới, vault và hợp đồng khớp
lệnh.
