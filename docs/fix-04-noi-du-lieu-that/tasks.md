# FIX-04: các bước

1. Tạo nhánh từ `dev` mới nhất (sau khi merge FIX-03 (chuẩn hoá chuỗi hiển thị trong `lib/`)). Chép thư mục spec. Số dòng trong spec theo `dev` @ `34bf33a`; lệch thì tìm theo nội dung và ghi số dòng mới vào checkpoint.
2. Đo trước: thời gian trả lời `getPortfolioAction`, `getTokenSummaryAction` trên hardhat cục bộ (10 lần, lấy trung vị); số server action khi mở `/portfolio`, `/tokens/WPT`, `/seller`, `/account` (cách đếm ở requirements mục 6). Ghi checkpoint.
3. Backend B1, B2 (design mục 1). Ca 1 tới 5, 8. Sửa ca cũ `test/portfolio-service.test.ts:118` theo requirements mục 6.
4. Frontend F1 tới F8 (design mục 2 tới 4). Ca 6, 6b, 7. Sửa bài e2e cũ `investor-channel.spec.ts:302-308`. Viết e2e mới.
5. Đo lại như bước 2; thêm một lần đo `getPortfolio` khi `paymentBalanceOf` chậm 2 giây (requirements mục 3.1).
6. Kiểm chứng theo **mức B** (chạy đúng các lệnh dưới, KHÔNG chạy toàn bộ e2e, KHÔNG chạy `e2e evm`):

```bash
(cd app && npm run typecheck && npm run lint && npx vitest --run)
(cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa npx vitest --run)   # B2 đọc bảng dự án
bash scripts/run-local-all.sh arch markers checkpoint build
(cd app && npx playwright test e2e/fix-04-noi-du-lieu-that.spec.ts e2e/investor-channel.spec.ts e2e/account-info.spec.ts e2e/uiux-02-dau-man.spec.ts e2e/chain-scope.spec.ts)
# tệp cấm: phải rỗng
git diff --name-only dev... | grep -E '^app/src/lib/' | grep -vE '^app/src/lib/bank/portfolio\.service\.ts$' || true
git diff --name-only dev... | grep -E '^app/src/app/(actions|api)/|^app/prisma/|^packages/|^scripts/|wrangler\.json|\.env' || true
# ký tự cấm trong dòng thêm mới (trừ thư mục spec): phải rỗng
git diff dev... -- . ':!docs/fix-04-noi-du-lieu-that' | python3 -c "import sys,re;[print(l,end='') for l in sys.stdin if l.startswith('+') and not l.startswith('+++') and re.search(r'[\u2192\u2014\u00b7\u00d7]|-[>]',l)]"
```

Hardhat chỉ bật để chụp ảnh `/portfolio` có Số dư VNDB (requirements mục 9), không chạy bộ e2e hardhat. Bài e2e khác đang có mà đỏ vì chữ đổi thì Supervisor bắt ở lần chạy đầy đủ sau khi gom PR; dev chỉ cần grep chữ đã đổi trong `app/e2e` và thêm tệp chứa chữ đó vào lệnh trên.

Bảng mức kiểm thử (áp cho mọi task):

| Mức | Loại thay đổi | Dev chạy |
|---|---|---|
| A | Chỉ chuỗi, tài liệu, không đổi logic | typecheck, lint, vitest, markers; e2e chỉ các tệp chứa chuỗi đã đổi |
| B | Frontend, hoặc backend chỉ đọc | Mức A, cộng build và e2e các màn bị đụng; vitest Postgres nếu đọc database |
| C | Logic backend, database, chuỗi khối | Toàn bộ: vitest cả Postgres, `build e2e evm` |

7. Mười đột biến (requirements mục 8), ghi ca đỏ.
8. Ảnh, checkpoint, UserGuide, task-status.

Commit mã: `fix(fix-04): nối dữ liệu thật cho Tổng quan Nhà đầu tư, Người bán, ghi chú unverified`
Commit tài liệu: `docs(fix-04): checkpoint, UserGuide, ảnh`
