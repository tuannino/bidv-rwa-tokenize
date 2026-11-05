# FE-UX-06b: các bước

1. Tạo nhánh `feat/fe-ux-06b-phat-hanh-kiem-toan` từ `release/ui-v2` mới nhất. Nếu PR khác merge trong lúc làm: rebase lên head mới, làm lại bước 2 từ merge-base mới và chạy lại toàn bộ kiểm thử requirements mục 5 trên nhánh đã rebase (requirements, dòng Nhánh).
2. Đo mốc (script `tools/20261104_do_moc_measure.js`, chạy ngoài repo, trên tiến trình mock KHÁC tiến trình chụp ảnh, mới khởi động với đủ `webServer.env`). Chuẩn bị dữ liệu TRƯỚC khi chạy script, cùng công thức cho bản mốc và bản nhánh: `E2E_BASE_URL=http://localhost:<cổng> npx playwright test e2e/ops-transactions.spec.ts`; rồi xác nhận `metrics.json` không có dòng `khong tim thay lien ket` cho `DYN:/transactions`, `DYN:/approvals`, `DYN:/orders`; thiếu thì dừng và báo, không đo tiếp. Số đo: số action 28 đường dẫn, JS gzip từ `metrics.json`, JS các trang ở QĐ-10 theo byte so bản build mốc riêng, CSS gzip theo cách 01c; `hydration`, `consoleErrors`, `pageErrors` từ `metrics.json` (đường dẫn động thiếu liên kết thì chạy lại, hai lần đo phải cùng đủ dòng); số `role` và số action khi mở: viết TRƯỚC các `test` "mốc:" của `app/e2e/fe-ux-06b-phat-hanh-kiem-toan.spec.ts` (design mục 3) rồi chạy trên bản build mốc bằng `E2E_BASE_URL=http://localhost:<cổng> npx playwright test e2e/fe-ux-06b-phat-hanh-kiem-toan.spec.ts --grep "mốc:"` (máy chủ mới), ghi số vào test; số lời gọi theo design mục 3 nhóm 1; ảnh trước theo requirements mục 4.
3. Commit riêng: tạo `components/mint/txn-history-table.tsx`, `components/audit/audit-table.tsx` bằng dời nguyên văn (requirements QĐ-2; nhãn giữ `variant` cũ, ô trống giữ `'\u2014'` trong commit này, chỉ nhập tên đang dùng); chạy `mint`, `uiux-02-dau-man` (e2e), `op07-chain-scope`; viết `app/test/fe-ux-06b.test.ts` nhóm 1 phần số lời gọi và dòng gọi hai bảng, nhóm 2, 3 trừ phép kiểm lớp sắc, "–" và `title` của ô Chi tiết (ba phép này kiểm thứ commit đổi kiểu thêm, viết sau bước 4; test của commit dời phải xanh trên mã dời nguyên văn).
4. Hai màn theo design mục 1, 2 và QĐ-3 đến QĐ-8; viết phần còn lại của nhóm 1, 2, 3 và nhóm 4, 5; chạy `mint`, `maker-checker`, `chain-selector`, `token-info-read`, `uiux-02-dau-man`, `account-info`, unit test mới.
5. Lập bảng khối cũ, khối mới. Viết `app/e2e/fe-ux-06b-phat-hanh-kiem-toan.spec.ts`. Chạy kiểm thử đúng requirements mục 5, lưu log.
6. Các lệnh kiểm (chạy được trên macOS và Linux, bash và zsh; tệp tạm tên riêng để không đè tệp của nhánh khác). Kỳ vọng: 6a, 6b, 6c, 6e, 6f rỗng; 6d chỉ in các câu cũ của QĐ-7 (nhãn nút "2 \u00b7 Phát hành dữ liệu thử", hai câu kết quả, câu gợi ý số nguyên; nhãn "1 \u00b7 KYC + Whitelist" không có chữ có dấu nên 6d không in, đã khoá bằng 6e và unit nhóm 1; mảnh in ra có thể bị cắt ở `${…}`) hoặc mảnh do tách phần tử, xuống dòng khác chỗ (ghép lại đúng câu cũ); checkpoint giải thích từng dòng, dòng khác là lỗi.

   a. Danh sách trắng:

   ```bash
   git diff --name-only --diff-filter=d origin/release/ui-v2...HEAD \
     | grep -vE '^(app/src/components/pages/mint\.tsx|app/src/app/\(ops\)/audit/page\.tsx|app/src/app/\(account\)/account/page\.tsx|app/src/components/maker-checker/token-info-block\.tsx|app/src/components/mint/txn-history-table\.tsx|app/src/components/audit/audit-table\.tsx|app/e2e/fe-ux-06b-phat-hanh-kiem-toan\.spec\.ts|app/test/fe-ux-06b\.test\.ts|docs/fe-ux-06b-phat-hanh-kiem-toan/(requirements|design|tasks)\.md|docs/CHECKPOINT_FEUX06B(_DETAIL)?\.md|docs/USER_GUIDE\.md|docs/tech-report\.md|\.kiro/task-status\.json)$'
   git diff --name-only --diff-filter=D origin/release/ui-v2...HEAD
   ```

   b. Màu cứng và `*-destructive`:

   ```bash
   rg -n '\b(bg|text|border|ring|fill|stroke|from|to|via)-(white|black|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3})\b|#[0-9a-fA-F]{3,8}\b|rgba?\(|-destructive\b|\x27destructive\x27|"destructive"' \
     app/src/components/pages/mint.tsx 'app/src/app/(ops)/audit/page.tsx' 'app/src/app/(account)/account/page.tsx' app/src/components/maker-checker/token-info-block.tsx app/src/components/mint/ app/src/components/audit/
   ```

   c. Ký tự cấm ở dòng thêm mới (chạy cùng `LC_ALL=C` với 6d để `sort`, `comm` nhất quán theo byte; `D` là hàm, không phải biến):

   ```bash
   export LC_ALL=C
   D() { git diff origin/release/ui-v2...HEAD -U0 -- app/src app/test/fe-ux-06b.test.ts app/e2e/fe-ux-06b-phat-hanh-kiem-toan.spec.ts; }
   D | grep '^-[^-]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/feux06b-del.txt
   D | grep '^+[^+]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/feux06b-add.txt
   comm -13 /tmp/feux06b-del.txt /tmp/feux06b-add.txt | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e'
   ```

   d. Chuỗi tiếng Việt bị đổi hoặc mất (đọc; bỏ dòng chú thích để việc xoá chú thích cũ không bị tính):

   ```bash
   export LC_ALL=C
   ext() { rg -v '^(\*|//|/\*|\{/\*)' "$1" | rg -oN --no-filename "[^<>'\"\`{}]*[À-ỹ][^<>'\"\`{}]*" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | sort -u; }
   comm -23 <(ext /tmp/feux06b-del.txt) <(ext /tmp/feux06b-add.txt)
   ```

   e. Ký tự cấm còn trong tệp cuối (bỏ dòng mà nội dung bắt đầu bằng `*`, `//`, `/*`, `{/*`; trong mã test viết ký tự cấm bằng escape `\u00b7`, `\u2014`):

   ```bash
   rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e' app/src/components/pages/mint.tsx 'app/src/app/(ops)/audit/page.tsx' 'app/src/app/(account)/account/page.tsx' app/src/components/maker-checker/token-info-block.tsx app/src/components/mint/ app/src/components/audit/ app/test/fe-ux-06b.test.ts app/e2e/fe-ux-06b-phat-hanh-kiem-toan.spec.ts | rg -v '^[^:]+:[0-9]+:\s*(\*|//|/\*|\{/\*)'
   ```

   f. Không còn `destructive` trong tệp route (QĐ-6):

   ```bash
   rg -n -g '*.tsx' -- '-destructive\b|\x27destructive\x27|"destructive"' app/src/app
   ```

7. Đo lại (cùng cách bước 2); chụp ảnh sau trên tiến trình mock mới khởi động từ bản build nhánh, cùng công thức. Ảnh trạng thái khó tạo theo requirements mục 4.
8. Viết `docs/CHECKPOINT_FEUX06B.md` theo `docs/CHECKPOINT_TEMPLATE.md` (mục 0 đủ 14 điều kiện của requirements mục 4; `node scripts/check-checkpoint.mjs docs/CHECKPOINT_FEUX06B.md docs/fe-ux-06b-phat-hanh-kiem-toan/requirements.md`), cập nhật `docs/USER_GUIDE.md` phần `/mint`, `/audit`, khối thông tin token, `.kiro/task-status.json` (FE-UX-06b `inProgress` khi chạy kiểm rồi hoàn thành; PR merge sau gộp sao cho mỗi mã ở đúng một danh sách).
9. Mở PR base `release/ui-v2`, tiêu đề `FE-UX-06b: Phát hành dữ liệu thử, Sổ kiểm toán, khối thông tin token`, gửi Supervisor báo cáo kèm log, đoạn log EVM riêng, số đo, ảnh, bảng khối cũ và mới, kết quả bước 6. Không tự merge.
