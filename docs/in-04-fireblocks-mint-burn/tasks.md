# IN-04: các bước

Nhánh: `feat/in-04-fireblocks-mint-burn` từ `dev` @ `8f75d38`. Một PR. Không push lên `dev`. Không cần và KHÔNG được dùng khoá Fireblocks thật; mọi ca chạy với khách giả.

1. Đo nền số action khi mở `/`, `/draft`, `/approvals/[id]`, `/seller`, `/portfolio` và thời gian trả `/` (Giao dịch viên) trên bản build; ghi checkpoint.
2. Cấu hình, `fireblocks-config.ts` (A1, A2). Ca 3.
3. Khách REST và JWT, khách giả `test/helpers/fake-fireblocks.ts` (B1 tới B4). Ca 1, 2.
4. Lưu trữ: lược đồ, `ADDED_COLUMNS`, cổng hai bản (E1, E2), `cd app && npm run db:sql`. Ca 11.
5. Công tắc: quyền, service, action, `CustodyToggle`, `AppLayout` (A3 tới A5). Ca 4, 5.
6. Ledger D1, D2, D2b; `fireblocks-execution.ts`; nối vào `approveTokenRequest`, `executeIssuance`, `executeBurn`, `reconcileTokenRequest`, chi tiết (C1 tới C7, E3). Ca 5b, 6 tới 10 (gồm 7b), 18, 18b.
7. Nút Hardhat: `in-04-fireblocks-evm.test.ts`. Ca 12 tới 14. Ca 16 tới 19 trong `in-04-fireblocks.test.ts` (19 với Postgres).
8. `ChannelGuard`, `role-home.ts` (F1). Ca 15. Kịch bản `fireblocks-roles.js` (G1): chạy thử `status` và `grant` trên nút Hardhat cục bộ, ghi kết quả vào checkpoint.
9. Kiểm chứng:

```bash
(cd app && npm run typecheck && npm run lint && npx vitest --run)
(cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa npx vitest --run test/in-04-fireblocks.test.ts)
bash scripts/evm-local.sh reset
(cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/in-04-fireblocks-evm.test.ts)
bash scripts/evm-local.sh reset
(cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/fe-08-approval-evm.test.ts)
bash scripts/evm-local.sh down
( set -e; BAK="$(mktemp -d)"; mv packages/contracts-evm/artifacts "$BAK/artifacts"
  trap 'mv "$BAK/artifacts" packages/contracts-evm/artifacts && rmdir "$BAK"' EXIT
  bash scripts/run-local-all.sh arch markers checkpoint app )
# dừng mọi máy chủ đang chạy ở cổng 3100, 3200 trước, hoặc chạy với CI=1
bash scripts/run-local-all.sh build e2e evm
# JWT: phải rỗng; khoá: chỉ còn dòng hằng đầu, cuối PEM (khoá RSA của ca 1 sinh lúc chạy, không ghi ra tệp)
git diff 8f75d38 -- . ':(exclude)*.md' | grep -nE '^\+.*(BEGIN (RSA )?PRIVATE KEY|eyJhbGciOi)' || true
git diff 8f75d38 | python3 -c "import sys,re;[print(l,end='') for l in sys.stdin if l.startswith('+') and not l.startswith('+++') and re.search('[\\u2192\\u2014\\u00b7]',l)]"
```

   Lệnh quét khoá: chuỗi `BEGIN PRIVATE KEY` chỉ được xuất hiện trong mã như hằng để tách PEM và trong tài liệu hướng dẫn; ghi rõ từng dòng còn lại vào checkpoint.

10. Ba mươi mốt đột biến (requirements mục 7), ghi ca đỏ vào checkpoint.
11. Đo lại như bước 1; ảnh; `docs/USER_GUIDE.md`, `docs/CHECKPOINT_IN04.md` (có mục "Việc của chủ dự án"), `.kiro/task-status.json`.

Commit mã: `feat(in-04): ký Mint, Burn qua Fireblocks Vault Account, công tắc Lưu ký Fireblocks, nút về trang của vai`
Commit tài liệu: `docs(in-04): UserGuide, checkpoint, ảnh`
