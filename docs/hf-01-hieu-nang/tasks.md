# HF-01: các bước

## Bước 1: Mã và kiểm thử

Bốn việc ở `requirements.md`; thêm `app/test/hf-01-hieu-nang.test.ts`.

Commit: `fix(hf-01): bỏ lượt gọi Worker thừa khi mở trang`

## Bước 2: Kiểm chứng và bàn giao

```bash
(cd app && npx vitest --run test/hf-01-hieu-nang.test.ts test/be-13-withdraw.test.ts test/seller-vault.test.ts test/four-roles-shell.test.ts test/op07-chain-scope.test.ts)
for f in test/evm-issuance.test.ts test/be-13-vault-evm.test.ts test/evm-order-settlement.test.ts test/fe-05-permit-evm.test.ts test/sc-06-distribution-evm.test.ts test/vault.test.ts; do
  bash scripts/evm-local.sh reset
  (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run "$f")
done
bash scripts/evm-local.sh down
bash scripts/run-local-all.sh
```

Đo `/seller/withdraw` trên bản dựng của nhánh; viết `docs/CHECKPOINT_HF01.md`.

Commit: `docs(hf-01): bàn giao kiểm chứng`
