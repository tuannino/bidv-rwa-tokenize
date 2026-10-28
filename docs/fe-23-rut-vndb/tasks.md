# FE-23: các bước

Nhánh: `feat/fe-23-rut-vndb` từ `dev` @ `a7151b8`. Một PR. Không push lên `dev`.

1. Đo nền số action khi mở `/withdraw` (trang chờ), `/portfolio`, `/trade`; ghi checkpoint.
2. Lược đồ, cổng `PaymentWithdrawRequest` hai bản, ràng buộc ở `store.errors.ts` (design mục 1). Ca 13.
3. Ledger: ba phương thức đọc mới, `mockTransferPayment` và trường `paymentTransfers` của trạng thái mock (design mục 2).
4. Service, action, quyền `payment:withdraw` (design mục 3). Ca 1 tới 12d.
5. Màn `/withdraw`, `lib/signer/wallet-transfer.ts` (design mục 4); sửa `test/pending-markers.test.ts` (sinh lại khối điểm cắm), `test/rbac.test.ts`.
6. `e2e/investor-withdraw.spec.ts` (requirements mục 7); ca 14 trên nút Hardhat.
7. Kiểm chứng:

```bash
(cd app && npm run typecheck && npm run lint && npx vitest --run)
(cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa npx vitest --run test/fe-23-payment-withdraw.test.ts)
bash scripts/evm-local.sh reset
(cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/fe-23-payment-withdraw.test.ts)
bash scripts/evm-local.sh down
( set -e; BAK="$(mktemp -d)"; mv packages/contracts-evm/artifacts "$BAK/artifacts"
  trap 'mv "$BAK/artifacts" packages/contracts-evm/artifacts && rmdir "$BAK"' EXIT
  bash scripts/run-local-all.sh arch markers checkpoint app )
bash scripts/run-local-all.sh build e2e evm
git diff a7151b8 | python3 -c "import sys,re;[print(l,end='') for l in sys.stdin if l.startswith('+') and not l.startswith('+++') and re.search('[\\u2192\\u2014\\u00b7]',l)]"
```

8. Mười bốn đột biến (requirements mục 7), ghi ca đỏ vào checkpoint.
9. Đo lại như bước 1; ảnh; `docs/USER_GUIDE.md`, `docs/CHECKPOINT_FE23.md`, `.kiro/task-status.json`.

Commit mã: `feat(fe-23): Nhà đầu tư rút VNDB ra ví nhận đã whitelist, ví trình duyệt ký, máy chủ kiểm trên chuỗi`
Commit tài liệu: `docs(fe-23): UserGuide, checkpoint, ảnh`
