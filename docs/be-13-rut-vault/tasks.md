# BE-13: các bước

> Đọc trước: `.kiro/steering/efficiency.md`, `docs/be-13-rut-vault/requirements.md` (bản 2),
> `docs/ds-01-kien-truc-hop-dong/design.md` (QĐ-5, QĐ-13, QĐ-25, QĐ-26), `packages/contracts-evm/contracts/SpvPaymentVault.sol`,
> `app/src/lib/rbac/{can,permissions,config-role,demo-payment}.ts`, `app/src/lib/ledger/{ledger.port,evm.adapter,mock.adapter,mock-state.store}.ts`,
> `app/src/lib/bank/{vault,seller,distribution,issuance}.service.ts`, `app/src/lib/bank/withdraw-limit.ts`,
> `app/src/components/pages/{vault-status,seller-withdraw,seller-transactions}.tsx`, `app/src/lib/store/{postgres.pool,store.errors}.ts`,
> `docs/CHECKPOINT_FE21.md`, `docs/CHECKPOINT_SC07.md`, `docs/be-17-auto-settle/requirements.md` (khoá chống trùng).
> Nhánh `feat/be-13-rut-vault` từ `dev` mới nhất.

## Bước 0: Nhận task và đo lại

Chép `docs/be-13-rut-vault/` vào repo; `BE-13` vào `inProgress`. Chạy các lệnh ở "Hiện trạng đã đo", ghi kết quả
`run-local-all.sh` và số ca bộ mặc định trước khi sửa.

Commit: `chore(be-13): nhận task`

## Bước 1: RBAC đóng (QĐ-A, QĐ-B)

Vai lạ không có quyền nào; ba quyền mới. Kiểm thử ca 1 (phần RBAC). Chạy lại toàn bộ kiểm thử RBAC hiện có.

Commit: `fix(be-13): vai lạ không còn mượn quyền của Người bán`

## Bước 2: Cổng chuỗi, adapter, vault mock (QĐ-G)

1. Bảy method mới nhóm `ILedgerVault` và `latestBlockNumber()`; adapter EVM; stellar từ chối rõ ràng.
2. Hàm thuần tính khoá theo hợp đồng; ca so với hợp đồng.
3. Vault mock: địa chỉ logic riêng, trạng thái trong `MockLedgerState`, bộ giải mã tương thích dòng cũ, sự kiện bền,
   mua bán qua vault mock, chốt kỳ, cấu hình, rút. Sửa các ca kiểm thử bị ảnh hưởng, liệt kê từng ca.

Commit: `feat(be-13): cổng cấu hình và rút vault, mô phỏng vault trên mock`

## Bước 3: Khoá vận hành và cấu hình (QĐ-C, QĐ-D)

Bảng `VaultOperationLock`, service cấu hình theo bảng chuyển tiếp, khoá `vault.default_percent_bps`, mục "Cấu hình
khoá" trên `/vault`. Kiểm thử ca 2 đến 6.

Commit: `feat(be-13): Kiểm soát viên cấu hình khoá vault, FIXED ưu tiên PERCENT`

## Bước 4: Lệnh rút và xử lý (QĐ-E, QĐ-F)

Bảng `WithdrawRequest` (lược đồ, `init.sql`, `npm run db:embed-sql`, `schemaObjectsReady`, hai cổng lưu trữ,
`activeChain`, ánh xạ lỗi trong `store.errors.ts`; bộ ràng buộc chạy cả trên Postgres thật ngay ở bước này), service tạo,
đối soát, xử lý `NEEDS_REVIEW`. Kiểm thử ca 7 đến 11.

Commit: `feat(be-13): Người bán rút VNDB từ vault, chống trùng, không tự gửi lại, đối soát`

## Bước 5: Gỡ FE-21 và màn hình (QĐ-H, QĐ-I)

Gỡ hạn mức và phí FE-21; màn rút, bảng yêu cầu, danh sách giao dịch union; `docs/guide.md`; e2e ca 15. Kiểm thử ca 12
đến 14.

Commit: `feat(be-13): màn rút của Người bán dùng nghiệp vụ thật, gỡ hạn mức và phí FE-21`

## Bước 6: Đột biến

Chạy 16a đến 16g, dán đầu ra đỏ, hoàn nguyên, dán `git status` sạch.

## Bước 7: Tài liệu và bàn giao

Cập nhật `docs/tech-report.md` (gồm bảng nợ QĐ-J), `packages/contracts-evm/README.md`. Sinh lại sơ đồ luồng liên quan
nếu điểm cắm đổi dòng.

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

# Kiểm thử nút thật: từng tệp một lệnh, reset chuỗi trước mỗi tệp
for f in test/vault.test.ts test/sc-06-distribution-evm.test.ts test/evm-order-settlement.test.ts test/fe-05-permit-evm.test.ts test/<tệp rút và cấu hình trên nút thật>; do
  bash scripts/evm-local.sh reset
  (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run "$f")
done
bash scripts/evm-local.sh down

# Nâng lược đồ trên database có sẵn: dựng database theo init.sql của dev, rồi chạy kiểm thử Postgres của nhánh trên đó
(cd app && TEST_DATABASE_URL=<database Postgres cục bộ> npx vitest --run test/<tệp kiểm thử Postgres của BE-13> test/store-constraints.test.ts)

git log -p origin/dev..HEAD | grep -nE "postgres(ql)?://[^@ ]+:[^@ ]+@[^l1d ]|PRIVATE_KEY=0x[0-9a-fA-F]{64}" \
  | grep -v ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 || echo "không có bí mật"
node scripts/scan-pending.mjs | grep "BE-13" || echo "không còn điểm chờ BE-13"
```

Viết `docs/CHECKPOINT_BE13.md`, mục 0 đối chiếu đủ điều kiện hoàn thành, dán nguyên văn đầu ra.

Commit: `docs(be-13): bàn giao kiểm chứng`
