# HF-04: các bước

```bash
(cd app && npx vitest --run test/fe-08-approval.test.ts test/hf-03-doc-log-evm.test.ts)
for f in test/hf-04-chot-ky-evm.test.ts test/sc-06-distribution-evm.test.ts test/fe-08-approval-evm.test.ts test/be-13-vault-evm.test.ts; do
  bash scripts/evm-local.sh reset
  (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run "$f")
done
bash scripts/evm-local.sh down
( set -e; BAK="$(mktemp -d)"; mv packages/contracts-evm/artifacts "$BAK/artifacts"
  trap 'mv "$BAK/artifacts" packages/contracts-evm/artifacts && rmdir "$BAK"' EXIT
  bash scripts/run-local-all.sh arch markers checkpoint app )
```

Commit: `fix(hf-04): đối soát chốt kỳ vault qua biên nhận khi RPC đọc log đi sau`
