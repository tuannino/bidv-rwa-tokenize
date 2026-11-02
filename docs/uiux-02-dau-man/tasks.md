# UIUX-02: các bước

1. Tạo nhánh từ `dev`. Chép thư mục spec và tệp `docs/20261102_NO_KY_THUAT_DA_TOKEN.md` từ gói Supervisor.
2. Đo số server action khi mở 10 màn ở requirements mục 3 và 23 màn ở QĐ-7 (bản build, chain mock); ghi checkpoint.
3. Viết `components/token/token-scope-select.tsx` (design mục 1). Ca 1, 2, 3, 5.
4. Gắn vào 10 màn (design mục 2). Ca 4.
4b. Bỏ dòng mô tả 23 chỗ (QĐ-7), `hint` cho menu (QĐ-8), `HoverHint` (design mục 4), đổi tiêu đề màn Tổng quan (QĐ-10), `data-chain` và sửa `chain-scope.spec.ts` (QĐ-11). Ca 6 tới 10. Viết e2e.
5. Tài liệu D2, D3, D4.
6. Kiểm chứng:

```bash
(cd app && npm run typecheck && npm run lint && npx vitest --run)
(cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa npx vitest --run)
bash scripts/run-local-all.sh arch markers checkpoint app
bash scripts/run-local-all.sh build e2e evm
# tệp cấm: phải rỗng
git diff --name-only dev... | grep -E '^app/src/(lib|app/actions|app/api)/|gates\.ts$|sides\.ts$|^app/prisma/|^packages/|^scripts/|wrangler\.json|\.env' || true
# ký tự cấm trong dòng thêm mới: phải rỗng
git diff dev... -- . ':!docs/uiux-02-dau-man' | python3 -c "import sys,re;[print(l,end='') for l in sys.stdin if l.startswith('+') and not l.startswith('+++') and re.search(r'[\u2192\u2014\u00b7]',l)]"
```

7. Mười tám đột biến (requirements mục 7), ghi ca đỏ.
8. Đo lại như bước 2; ảnh; checkpoint, task-status.

Commit mã: `feat(uiux-02): đầu màn: ô chọn token có gõ lọc, bỏ dòng mô tả, gợi ý trên menu, tiêu đề Tổng quan`
Commit tài liệu: `docs(uiux-02): nợ kỹ thuật đa token, tech-report, UserGuide, checkpoint, ảnh`
