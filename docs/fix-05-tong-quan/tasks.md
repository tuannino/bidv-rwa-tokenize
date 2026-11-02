# FIX-05: các bước

1. Tạo nhánh từ `dev` mới nhất (sau khi merge FIX-04). Chép thư mục spec. Số dòng trong spec theo `dev` @ `34bf33a`; lệch thì tìm theo nội dung và ghi số dòng mới vào checkpoint.
2. Đo trước: số server action khi mở `/`, `/assets`, `/kyc`, `/reconciliation` (cách đếm ở requirements mục 6). Ghi checkpoint.
3. Backend B3 trước (chạy lại `test/fix-04-noi-du-lieu-that.test.ts`, phải xanh), rồi B1, B2 (design mục 1). Ca 1 tới 5.
4. Frontend F1 tới F3 (design mục 2, 3). Ca 6. Viết e2e mới.
5. Đo sau: số lời gọi như bước 2; thời gian trả lời `getOpsOverviewAction` trên hardhat cục bộ (10 lần, trung vị).
6. Kiểm chứng theo **mức B** (chạy đúng các lệnh dưới, KHÔNG chạy toàn bộ e2e, KHÔNG chạy `e2e evm`):

```bash
(cd app && npm run typecheck && npm run lint && npx vitest --run)
(cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa npx vitest --run)   # ca 3b chạy với Postgres
bash scripts/run-local-all.sh arch markers checkpoint build
(cd app && npx playwright test e2e/fix-05-tong-quan.spec.ts e2e/uiux-02-dau-man.spec.ts e2e/fix-04-noi-du-lieu-that.spec.ts)
# tệp cấm: phải rỗng
git diff --name-only dev... | grep -E '^app/src/lib/' | grep -vE '^app/src/lib/bank/(overview\.service|read-or-null|portfolio\.service)\.ts$' || true
git diff --name-only dev... | grep -E '^app/src/app/actions/' | grep -vE '^app/src/app/actions/overview\.ts$' || true
git diff --name-only dev... | grep -E '^app/src/app/api/|^app/prisma/|^packages/|^scripts/|wrangler\.json|\.env' || true
# ký tự cấm trong dòng thêm mới (trừ thư mục spec): phải rỗng
git diff dev... -- . ':!docs/fix-05-tong-quan' | python3 -c "import sys,re;[print(l,end='') for l in sys.stdin if l.startswith('+') and not l.startswith('+++') and re.search(r'[\u2192\u2014\u00b7\u00d7]|-[>]',l)]"
```

Bài e2e khác đang có mà đỏ vì chữ đổi: grep chữ đã đổi trong `app/e2e`, thêm tệp chứa chữ đó vào lệnh trên. Supervisor chạy e2e đầy đủ một lần sau khi gom PR.

7. Mười đột biến (requirements mục 8), ghi ca đỏ.
8. Ảnh, checkpoint, UserGuide, task-status.

Commit mã: `fix(fix-05): màn Tổng quan dùng dữ liệu thật, ghi chú dữ liệu mẫu ở 3 màn vận hành`
Commit tài liệu: `docs(fix-05): checkpoint, UserGuide, ảnh`
