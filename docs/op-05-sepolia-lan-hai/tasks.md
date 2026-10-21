# OP-05: các bước (PR A)

> Đọc trước: `.kiro/steering/efficiency.md`, `docs/op-05-sepolia-lan-hai/requirements.md` (bản 3), `docs/TESTNET_SEPOLIA.md`,
> `docs/DEPLOYMENT.md` (mục Hyperdrive), `packages/contracts-evm/scripts/{deploy,verify-deployment,preflight-sepolia,fund-sepolia,vault-admin,dod-verify-sepolia}.js`,
> `packages/contracts-evm/contracts/SpvPaymentVault.sol`, `app/src/lib/store/postgres.pool.ts`,
> `app/src/lib/bank/{account-profile,trade,distribution,distribution-trigger,issuance,demo-payment}.service.ts`,
> `app/src/app/api/keeper/distribution/route.ts`, `docs/CHECKPOINT_OP04.md`.
> Nhánh `feat/op-05-runbook` từ `dev` **sau khi BE-13 và FE-08 merge**. **Chỉ bắt đầu khi spec đã chốt các CH.**

## Bước 0: Nhận task và đo lại

Chép `docs/op-05-sepolia-lan-hai/` vào repo; `OP-05` vào `inProgress`. Chạy các lệnh ở "Hiện trạng đã đo", ghi kết
quả `run-local-all.sh`.

Commit: `chore(op-05): nhận task`

## Bước 1: Liên kết ví trong hồ sơ (QĐ-I)

Bảng lưu ví liên kết, server action, mục "Ví liên kết" trên trang tài khoản, tra hồ sơ theo chain, mục nợ kỹ thuật
trong `tech-report.md`. Kiểm thử ca 3, ca 8.

Commit: `feat(op-05): người dùng liên kết ví vào hồ sơ theo chain`

## Bước 2: Script

1. `fund-sepolia.js`, `preflight-sepolia.js` theo QĐ-E (ca 2).
2. `dod-verify-sepolia.js` theo QĐ-J (ca 5).

Commit: `feat(op-05): ước phí vòng trình diễn theo thao tác, chặn script DoD cũ`

## Bước 3: Kiểm thử vòng nghiệp vụ

Tệp kiểm thử mới trên nút Hardhat cho ca 4, khẳng định từng ô bảng số dư kỳ vọng. Lệch thì dừng, báo
Supervisor kèm số đo, không tự sửa bảng.

Commit: `test(op-05): vòng trình diễn trên nút Hardhat khớp số dư kỳ vọng`

## Bước 4: Runbook

1. Viết lại `docs/TESTNET_SEPOLIA.md` theo QĐ-A đến QĐ-H.
2. Truy vấn chỉ đọc QĐ-F; chạy trên Postgres cục bộ (ca 6).
3. Bổ sung `docs/DEPLOYMENT.md`: `KEEPER_SECRET`, Hyperdrive mới cho thế hệ hợp đồng mới.

Commit: `docs(op-05): runbook Sepolia một mạch, cutover database và Hyperdrive`

## Bước 5: Diễn tập và bàn giao

```bash
# Diễn tập QĐ-K (ca 7): luôn phục hồi address book và ABI sinh ra, kể cả khi lỗi
(
  set -e
  SNAP="$(mktemp -d)"
  cp packages/shared/src/addresses.json "$SNAP/addresses.json"
  cp -r packages/shared/generated "$SNAP/generated"
  trap 'cp "$SNAP/addresses.json" packages/shared/src/addresses.json; rm -rf packages/shared/generated; cp -r "$SNAP/generated" packages/shared/generated; rm -rf "$SNAP"; bash scripts/evm-local.sh down' EXIT
  bash scripts/evm-local.sh reset
  # chạy đúng các lệnh bước 6, 7, lệnh console 13.6 và dod-verify-sepolia.js của runbook với --network localhost
)
git status --short   # phải rỗng

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
for f in test/<tệp ca 3 nếu cần nút thật> test/<tệp ca 4>; do
  bash scripts/evm-local.sh reset
  (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run "$f")
done
bash scripts/evm-local.sh down

git log -p origin/dev..HEAD | grep -nE "postgres(ql)?://[^@ ]+:[^@ ]+@[^l1d ]|PRIVATE_KEY=0x[0-9a-fA-F]{64}" \
  | grep -v ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 || echo "không có bí mật"
```

Viết `docs/CHECKPOINT_OP05.md`: mục 0 đối chiếu điều kiện hoàn thành của PR A, dán nguyên văn đầu ra; để sẵn mục
"Kết quả chạy Sepolia" trống.

Commit: `docs(op-05): bàn giao diễn tập`

## Sau PR A (chủ dự án, Supervisor)

Runbook bước 0 đến 14: PR B (địa chỉ, ABI, ID Hyperdrive), vòng nghiệp vụ, Supervisor nghiệm thu trên chuỗi, PR C.
