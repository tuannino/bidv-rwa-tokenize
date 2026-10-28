# FIX-02: các bước

Nhánh: `fix/fix-02-sua-nho` từ `dev` @ `a1ff3aa`. Một PR. Không push lên `dev`.

1. Đo nền số action khi mở `/trade`, `/draft`, `/approvals/[id]`; ghi checkpoint.
2. Cờ bán và chặn ở máy chủ, `sellEnabled`, cấu hình vitest, Playwright, `wrangler.json`, `.env.example` (design mục 1). Ca 1, 1b, 2.
3. Bỏ `noPending`, thêm `fullSupply`, `approveWarning` (design mục 2). Ca 3 tới 7; sửa `test/token-request.test.ts`.
4. Giao diện (design mục 3). Ca 8, 9.
5. Kiểm chứng:

```bash
(cd app && npm run typecheck && npm run lint && npx vitest --run)
grep -rn "noPending" app/src app/test   # phải rỗng
( set -e; BAK="$(mktemp -d)"; mv packages/contracts-evm/artifacts "$BAK/artifacts"
  trap 'mv "$BAK/artifacts" packages/contracts-evm/artifacts && rmdir "$BAK"' EXIT
  bash scripts/run-local-all.sh arch markers checkpoint app )
# dừng mọi máy chủ đang chạy ở cổng 3100 trước (reuseExistingServer), hoặc chạy với CI=1
bash scripts/run-local-all.sh build e2e
git diff a1ff3aa | python3 -c "import sys,re;[print(l,end='') for l in sys.stdin if l.startswith('+') and not l.startswith('+++') and re.search('[\\u2192\\u2014\\u00b7]',l)]"
```

6. Mười hai đột biến (requirements mục 7), ghi ca đỏ vào checkpoint.
7. Đo lại như bước 1; ảnh; `docs/USER_GUIDE.md` (sửa cả đoạn L-12 quanh dòng 890 và 900 đang nói điều kiện không có yêu cầu Mint đang chờ), `docs/CHECKPOINT_FIX02.md`, `.kiro/task-status.json`.

Commit mã: `fix(fix-02): Nhà đầu tư không bán, nhiều yêu cầu Mint, cảnh báo khi duyệt, Burn toàn bộ nguồn cung tự điền`
Commit tài liệu: `docs(fix-02): UserGuide, checkpoint, ảnh`
