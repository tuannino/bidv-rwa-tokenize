# FE-UX-04d: các bước

1. Tạo nhánh `feat/fe-ux-04d-rut-vndb` từ `release/ui-v2` mới nhất (@ `e914807` hoặc sau). Nếu PR khác merge trong lúc làm: rebase lên head mới, làm lại bước 2 từ merge-base mới và chạy lại toàn bộ kiểm thử requirements mục 5 trên nhánh đã rebase (requirements, dòng Nhánh).
2. Đo mốc (script `tools/20261104_do_moc_measure.js`, chạy ngoài repo, trên tiến trình mock KHÁC tiến trình chụp ảnh, mới khởi động với đủ `webServer.env`): số action 28 đường dẫn, JS gzip từ `metrics.json`, JS `/withdraw` theo byte so bản build mốc riêng, CSS gzip theo cách 01c; `hydration`, `consoleErrors`, `pageErrors` từ `metrics.json` (đường dẫn động thiếu liên kết thì chạy lại, hai lần đo phải cùng đủ dòng); số `role` theo design mục 3 ca 1 (máy chủ mới); số lời gọi action, `useEffect` theo QĐ-2; ảnh trước theo requirements mục 4.
3. Commit riêng: dời `WithdrawRequestRow`, `short`, `nf` nguyên văn (requirements QĐ-5); chạy `investor-withdraw`; viết `app/test/fe-ux-04d.test.ts` nhóm 1 (phần số lời gọi và biểu thức khoá).
4. Màn theo design mục 1, 2 và QĐ-3, QĐ-4, QĐ-6, QĐ-7; viết nhóm 2, 3 và phần còn lại của nhóm 1; chạy `investor-withdraw`, `uiux-02-dau-man`, unit test mới.
5. Đối chiếu notes, lập bảng. Viết `app/e2e/fe-ux-04d-rut-vndb.spec.ts`. Chạy kiểm thử đúng requirements mục 5, lưu log.
6. Các lệnh kiểm (chạy được trên macOS và Linux, bash và zsh; tệp tạm tên riêng để không đè tệp của nhánh khác). Kỳ vọng: 6a, 6b, 6c, 6e rỗng; 6d rỗng, hoặc chỉ mảnh chữ do tách phần tử, xuống dòng khác chỗ (ghép lại đúng câu cũ), checkpoint giải thích từng dòng.

   a. Danh sách trắng:

   ```bash
   git diff --name-only --diff-filter=d origin/release/ui-v2...HEAD \
     | grep -vE '^(app/src/components/pages/investor-withdraw\.tsx|app/src/components/withdraw/(withdraw-request-row\.tsx|format\.ts|labels\.ts)|app/e2e/fe-ux-04d-rut-vndb\.spec\.ts|app/test/fe-ux-04d\.test\.ts|docs/fe-ux-04d-rut-vndb/(requirements|design|tasks)\.md|docs/CHECKPOINT_FEUX04D(_DETAIL)?\.md|docs/USER_GUIDE\.md|docs/tech-report\.md|\.kiro/task-status\.json)$'
   git diff --name-only --diff-filter=D origin/release/ui-v2...HEAD
   ```

   b. Màu cứng và `*-destructive`:

   ```bash
   rg -n '\b(bg|text|border|ring|fill|stroke|from|to|via)-(white|black|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3})\b|#[0-9a-fA-F]{3,8}\b|rgba?\(|-destructive\b' \
     app/src/components/pages/investor-withdraw.tsx app/src/components/withdraw/
   ```

   c. Ký tự cấm ở dòng thêm mới (chạy cùng `LC_ALL=C` với 6d để `sort`, `comm` nhất quán theo byte; `D` là hàm, không phải biến):

   ```bash
   export LC_ALL=C
   D() { git diff origin/release/ui-v2...HEAD -U0 -- app/src app/test/fe-ux-04d.test.ts app/e2e/fe-ux-04d-rut-vndb.spec.ts; }
   D | grep '^-[^-]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/feux04d-del.txt
   D | grep '^+[^+]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/feux04d-add.txt
   comm -13 /tmp/feux04d-del.txt /tmp/feux04d-add.txt | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e'
   ```

   d. Chuỗi tiếng Việt bị đổi hoặc mất (đọc):

   ```bash
   export LC_ALL=C
   ext() { rg -oN --no-filename "[^<>'\"\`{}]*[À-ỹ][^<>'\"\`{}]*" "$1" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | sort -u; }
   comm -23 <(ext /tmp/feux04d-del.txt) <(ext /tmp/feux04d-add.txt)
   ```

   e. Ký tự cấm còn trong tệp cuối (bỏ dòng mà nội dung bắt đầu bằng `*`, `//`, `/*`, `{/*`; trong mã test viết ký tự cấm bằng escape `\u00b7`, `\u2014`):

   ```bash
   rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e' app/src/components/pages/investor-withdraw.tsx app/src/components/withdraw/ app/test/fe-ux-04d.test.ts app/e2e/fe-ux-04d-rut-vndb.spec.ts | rg -v '^[^:]+:[0-9]+:\s*(\*|//|/\*|\{/\*)'
   ```

7. Đo lại (cùng cách bước 2); chụp ảnh sau trên tiến trình mock mới khởi động từ bản build nhánh, cùng công thức. Ảnh trạng thái khó tạo theo requirements mục 4.
8. Viết `docs/CHECKPOINT_FEUX04D.md` theo `docs/CHECKPOINT_TEMPLATE.md` (mục 0 đủ 14 điều kiện của requirements mục 4; `node scripts/check-checkpoint.mjs docs/CHECKPOINT_FEUX04D.md docs/fe-ux-04d-rut-vndb/requirements.md`), cập nhật `docs/USER_GUIDE.md` phần màn Rút VNDB, `.kiro/task-status.json` (FE-UX-04d `inProgress` khi chạy kiểm rồi hoàn thành; FE-UX-05 giữ `planned`; PR merge sau gộp sao cho mỗi mã ở đúng một danh sách).
9. Mở PR base `release/ui-v2`, tiêu đề `FE-UX-04d: màn Rút VNDB của Nhà đầu tư`, gửi Supervisor báo cáo kèm log, đoạn log EVM riêng, số đo, ảnh, bảng đối chiếu notes, kết quả bước 6. Không tự merge.
