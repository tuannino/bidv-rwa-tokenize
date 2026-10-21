# HF-03: các bước

```bash
(cd app && npx vitest --run test/hf-03-doc-log-evm.test.ts)
for c in 3 10000; do for f in test/sc-06-distribution-evm.test.ts test/be-13-vault-evm.test.ts test/fe-08-approval-evm.test.ts; do
  bash scripts/evm-local.sh reset
  (cd app && EVM_LOG_BLOCK_CHUNK=$c TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run "$f")
done; done
bash scripts/evm-local.sh down
( set -e; BAK="$(mktemp -d)"; mv packages/contracts-evm/artifacts "$BAK/artifacts"
  trap 'mv "$BAK/artifacts" packages/contracts-evm/artifacts && rmdir "$BAK"' EXIT
  bash scripts/run-local-all.sh arch markers checkpoint app )
```

Commit: `fix(hf-03): đọc sự kiện EVM qua RPC riêng, theo từng đoạn block`
