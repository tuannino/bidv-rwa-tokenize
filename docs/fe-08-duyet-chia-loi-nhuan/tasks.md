# FE-08: các bước

> Đọc trước: `.kiro/steering/efficiency.md`, `docs/fe-08-duyet-chia-loi-nhuan/requirements.md`,
> `docs/sc-06-chia-loi-nhuan/requirements.md` (QĐ-F đến QĐ-I), `app/src/app/actions/distribution.ts`,
> `app/src/lib/bank/{distribution,distribution-trigger}.service.ts`, `app/src/app/api/keeper/distribution/route.ts`,
> `app/src/lib/rbac/permissions.ts`, `app/src/app/(ops)/distribution/page.tsx`, `docs/CHECKPOINT_SC06.md`,
> `docs/CHECKPOINT_BE13.md`, `app/test/be-13-postgres-upgrade.test.ts`, `app/test/sc-06-distribution-evm.test.ts`.
> Nhánh `feat/fe-08-duyet-chia` từ `dev` **sau khi BE-13 merge**. 

## Bước 0: Nhận task và đo lại

Chép `docs/fe-08-duyet-chia-loi-nhuan/` vào repo; `FE-08` vào `inProgress`. Chạy các lệnh ở "Hiện trạng đã đo", ghi
kết quả `run-local-all.sh`.

Commit: `chore(fe-08): nhận task`

## Bước 1: Quyền và service

1. Cột duyệt và `activeChain` trên `DistributionPeriod`, `triggerSource` trên `KeeperRun` (lược đồ, `init.sql`,
   `ADDED_COLUMNS`, `schemaObjectsReady`, hai cổng lưu trữ, ánh xạ lỗi).
2. Quyền `distribution:approve`; tách vai và người thao tác khỏi lõi vòng chia.
3. Duyệt, duyệt lại, tiếp tục (QĐ-C); chốt cứng vault trước khi trả (QĐ-D); keeper chỉ tiếp tục kỳ đã duyệt (QĐ-E).
4. API đọc (QĐ-F); action mới; gỡ bốn action cũ.
5. Kiểm thử ca 1 đến 11 (ca 2, 4, 5, 7, 8 trên nút Hardhat thật); ngưỡng riêng cho SC-06 ca 18 (mục "Việc kèm").

Commit: `feat(fe-08): chỉ chia khi Kiểm soát viên duyệt đúng số, vault chốt xong trước khi trả`

## Bước 2: Màn hình

Màn `/distribution` theo QĐ-F; e2e ca 13; ca 12 trên mock.

Commit: `feat(fe-08): màn chia lợi nhuận`

## Bước 3: Đột biến

Chạy 14a đến 14f, dán đầu ra đỏ, hoàn nguyên, dán `git status` sạch.

## Bước 4: Tài liệu và bàn giao

Cập nhật `docs/tech-report.md` (bảng nợ QĐ-H), `docs/guide.md`. Sinh lại sơ đồ `distribute` nếu điểm cắm đổi dòng.

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

for f in test/sc-06-distribution-evm.test.ts test/vault.test.ts test/<tệp duyệt chia trên nút thật>; do
  bash scripts/evm-local.sh reset
  (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run "$f")   # không thêm --testTimeout
done
bash scripts/evm-local.sh down

# Nâng lược đồ trên database có sẵn: dựng theo init.sql của dev, rồi chạy kiểm thử Postgres của nhánh trên đó
(cd app && TEST_DATABASE_URL=<database Postgres cục bộ> npx vitest --run test/<tệp kiểm thử Postgres của FE-08> test/store-constraints.test.ts)

git log -p origin/dev..HEAD | grep -nE "postgres(ql)?://[^@ ]+:[^@ ]+@[^l1d ]|PRIVATE_KEY=0x[0-9a-fA-F]{64}" \
  | grep -v ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 || echo "không có bí mật"
node scripts/scan-pending.mjs | grep "FE-08" || echo "không còn điểm chờ FE-08"
```

Viết `docs/CHECKPOINT_FE08.md`, mục 0 đối chiếu đủ điều kiện hoàn thành, dán nguyên văn đầu ra.

Commit: `docs(fe-08): bàn giao kiểm chứng`
