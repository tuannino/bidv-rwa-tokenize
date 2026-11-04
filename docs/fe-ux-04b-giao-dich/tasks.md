# FE-UX-04b: các bước

1. Tạo nhánh `feat/fe-ux-04b-giao-dich` từ `release/ui-v2` mới nhất (@ `ad133aa` hoặc sau). Nếu PR khác merge trong lúc làm: rebase lên head mới, làm lại bước 2 từ merge-base mới (requirements, dòng Nhánh).
2. Đo mốc (script `tools/20261104_do_moc_measure.js`, chạy ngoài repo, trên tiến trình mock KHÁC tiến trình chụp ảnh): số action 28 đường dẫn, JS gzip từ `metrics.json` (`jsGzipKB`), JS `/trade` theo byte so bản build mốc riêng, CSS gzip theo cách 01c; `hydration`, `consoleErrors`, `pageErrors` từ `metrics.json` (đường dẫn động thiếu liên kết thì chạy lại, hai lần đo phải cùng đủ dòng); số `role` theo design mục 3 ca 1 (máy chủ mới); số lời gọi action và `useEffect` theo QĐ-2; ảnh trước theo requirements mục 4.
3. Commit riêng: dời sáu phần sang `components/trading/trade-panels.tsx` nguyên văn (requirements QĐ-5); chạy `ops-transactions`, `recall`, `investor-channel`; viết `app/test/fe-ux-04b.test.ts` nhóm 1 (phần số lời gọi), 2, 5 (nhóm kiểm chữ, vỏ của bước 4 viết sau bước 4).
4. Màn theo design mục 1, 2 và QĐ-3, QĐ-4, QĐ-6, QĐ-7; viết nhóm 3, 4, 6, 7 và phần vỏ của nhóm 1; rồi chạy `ops-transactions`, `recall`, `investor-channel`, `fe-07-price-config`, `uiux-02-dau-man`, unit test mới.
5. Đối chiếu notes, lập bảng. Viết `app/e2e/fe-ux-04b-giao-dich.spec.ts`. Chạy kiểm thử đúng requirements mục 5, lưu log.
6. Các lệnh kiểm (chạy được trên macOS và Linux, bash và zsh). Kỳ vọng: 6a, 6b, 6c, 6e rỗng; 6d rỗng, hoặc chỉ mảnh chữ do tách phần tử, xuống dòng khác chỗ (ghép lại đúng câu cũ), checkpoint giải thích từng dòng.

   a. Danh sách trắng:

   ```bash
   git diff --name-only --diff-filter=d origin/release/ui-v2...HEAD \
     | grep -vE '^(app/src/components/pages/investor-trade\.tsx|app/src/components/trading/(trade-panels|trade-check-block)\.tsx|app/e2e/fe-ux-04b-giao-dich\.spec\.ts|app/test/fe-ux-04b\.test\.ts|docs/fe-ux-04b-giao-dich/(requirements|design|tasks)\.md|docs/CHECKPOINT_FEUX04B(_DETAIL)?\.md|docs/USER_GUIDE\.md|docs/tech-report\.md|\.kiro/task-status\.json)$'
   git diff --name-only --diff-filter=D origin/release/ui-v2...HEAD
   ```

   b. Màu cứng và `text-destructive` (regex không tìm `border-destructive`, nên `aria-invalid:border-destructive` không bị bắt):

   ```bash
   rg -n '\b(bg|text|border|ring|fill|stroke|from|to|via)-(white|black|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3})\b|#[0-9a-fA-F]{3,8}\b|rgba?\(|text-destructive' \
     app/src/components/pages/investor-trade.tsx app/src/components/trading/trade-panels.tsx app/src/components/trading/trade-check-block.tsx
   ```

   c. Ký tự cấm ở dòng thêm mới (chạy cùng `LC_ALL=C` với 6d để `sort`, `comm` nhất quán theo byte; `D` là hàm, không phải biến):

   ```bash
   export LC_ALL=C
   D() { git diff origin/release/ui-v2...HEAD -U0 -- app/src app/test/fe-ux-04b.test.ts app/e2e/fe-ux-04b-giao-dich.spec.ts; }
   D | grep '^-[^-]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/del.txt
   D | grep '^+[^+]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/add.txt
   comm -13 /tmp/del.txt /tmp/add.txt | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e'
   ```

   d. Chuỗi tiếng Việt bị đổi hoặc mất (đọc):

   ```bash
   export LC_ALL=C
   ext() { rg -oN --no-filename "[^<>'\"\`{}]*[À-ỹ][^<>'\"\`{}]*" "$1" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | sort -u; }
   comm -23 <(ext /tmp/del.txt) <(ext /tmp/add.txt)
   ```

   e. Ký tự cấm còn trong tệp cuối (bỏ dòng chú thích):

   ```bash
   rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e' app/src/components/pages/investor-trade.tsx app/src/components/trading/trade-panels.tsx app/src/components/trading/trade-check-block.tsx app/test/fe-ux-04b.test.ts app/e2e/fe-ux-04b-giao-dich.spec.ts | rg -v ':\s*(\*|//|/\*|\{/\*)'
   ```

7. Đo lại (cùng cách bước 2); chụp ảnh sau trên tiến trình mock mới khởi động từ bản build nhánh, cùng công thức. Ảnh trạng thái khó tạo theo requirements mục 4.
8. Viết `docs/CHECKPOINT_FEUX04B.md` theo `docs/CHECKPOINT_TEMPLATE.md` (mục 0 đủ 14 điều kiện; `node scripts/check-checkpoint.mjs docs/CHECKPOINT_FEUX04B.md docs/fe-ux-04b-giao-dich/requirements.md`), cập nhật `docs/USER_GUIDE.md` phần màn Giao dịch token, `.kiro/task-status.json` (FE-UX-04b `inProgress` khi chạy kiểm rồi hoàn thành; FE-UX-04c, FE-UX-04d vào `planned` nếu chưa có; không đụng mã gộp `FE-UX-04`). FE-UX-04a cũng thêm `FE-UX-04b` vào `planned`: PR nào merge sau thì khi gộp xung đột phải để mỗi mã ở đúng một danh sách (FE-UX-04b chỉ ở danh sách hoàn thành, xoá khỏi `planned`).
9. Mở PR base `release/ui-v2`, tiêu đề `FE-UX-04b: màn Giao dịch token`, gửi Supervisor báo cáo kèm log, đoạn log EVM riêng, số đo, ảnh, bảng đối chiếu notes, kết quả bước 6. Không tự merge.
