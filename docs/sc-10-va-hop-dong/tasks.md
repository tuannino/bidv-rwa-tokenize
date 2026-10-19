# SC-10: các bước

> Đọc trước: `.kiro/steering/efficiency.md`, `docs/sc-10-va-hop-dong/requirements.md`,
> `docs/ds-01-kien-truc-hop-dong/design.md` (bản 3, mục 8),
> `packages/contracts-evm/contracts/ProfitDistributor.sol`, `ProfitDistributorOracle.sol`,
> `packages/contracts-evm/contracts/tokens/ProjectToken.sol`, `test/helpers/spec-fixture.js`.
> Nhánh `fix/sc-10-va-hop-dong` từ `dev` @ `ecc3450`. Commit đầu thêm `SC-10` vào `.kiro/task-status.json`
> ở `inProgress` và chép `docs/ds-01-kien-truc-hop-dong/design.md` bản 3 vào repo.

## Bước 0: Đo lại và tái hiện lỗi

Chạy các lệnh ở "Hiện trạng đã đo". Viết ca 1 **trước khi sửa**, chạy cho đỏ, dán đầu ra (phải thấy kỳ A
chi vượt quỹ). Ghi số ca bộ hợp đồng và `run-local-all.sh` trước khi sửa.

## Bước 1: `ProfitDistributor`

Viết ca 2 đến 6 trước, rồi sửa theo QĐ-1. Chạy toàn bộ kiểm thử hợp đồng, bộ cũ phải xanh không nới điều
kiện. Nếu một ca cũ buộc phải đổi ý nghĩa, dừng lại hỏi Supervisor.

Commit: `fix(sc-10): đóng kỳ và chặn chi vượt quỹ ở ProfitDistributor`

## Bước 2: Đường cưỡng chế của `ProjectToken`

Thêm `HolderCountModule`, viết ca 7 đến 9 trước, rồi sửa theo QĐ-2.

Commit: `fix(sc-10): đường cưỡng chế báo lại bộ luật giao dịch`

## Bước 3: Đột biến

Chạy đột biến 11a đến 11f, dán đầu ra đỏ, hoàn nguyên, dán `git status` sạch.

## Bước 4: ABI, tài liệu, CH-1

Đồng bộ ABI dùng chung. Cập nhật `tech-report.md`. Nếu chủ dự án đã duyệt CH-1 thì làm trần nguồn cung
kèm kiểm thử; nếu chưa thì ghi "không làm" vào checkpoint.

Commit: `chore(sc-10): đồng bộ ABI và tài liệu`

## Bước 5: Bàn giao

```bash
bash scripts/run-local-all.sh
mv packages/contracts-evm/artifacts /tmp/artifacts_bak
bash scripts/run-local-all.sh arch markers checkpoint app
mv /tmp/artifacts_bak packages/contracts-evm/artifacts
bash scripts/evm-local.sh reset
cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/evm-issuance.test.ts && cd ..
bash scripts/evm-local.sh down
git log -p origin/dev..HEAD | grep -nE "postgres(ql)?://[^@ ]+:[^@ ]+@[^l1d ]|PRIVATE_KEY=0x[0-9a-fA-F]{64}" || echo "không có bí mật"
```

Viết `docs/CHECKPOINT_SC10.md`, mục 0 đối chiếu đủ **7** điều kiện; điều kiện của chủ dự án đánh 🔶 lúc mở PR.

## Bước 6: Sau merge **[Chủ dự án]**

Chạy runbook Sepolia trong `docs/TESTNET_SEPOLIA.md` (bản SC-09): cấp phí, kiểm trước, triển khai, kiểm sau,
đăng ký ví SPV, commit địa chỉ `evm`, deploy lại Worker, duyệt Mint đầu. Gửi mã giao dịch để chuyển 🔶 thành ✅
cho cả SC-09 và SC-10.
