# HF-02: các bước

## Bước 1: Sửa kiểm thử, kiểm chứng

```bash
(cd app && npx vitest --run test/fe-05-permit-order.test.ts)
# bỏ điều kiện ghi đè, chạy lại phải đỏ đúng ca, rồi hoàn nguyên
( set -e; BAK="$(mktemp -d)"; mv packages/contracts-evm/artifacts "$BAK/artifacts"
  trap 'mv "$BAK/artifacts" packages/contracts-evm/artifacts && rmdir "$BAK"' EXIT
  bash scripts/run-local-all.sh arch markers checkpoint app )
```

Commit: `fix(hf-02): kiểm thử FE-05 không dựa vào address book thật của evm`
