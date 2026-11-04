# FE-UX-03a: các bước

1. Tạo nhánh `feat/fe-ux-03a-kiem-soat` từ `release/ui-v2` mới nhất (@ `7b3216d` hoặc sau).
2. Đo mốc trên `release/ui-v2` (script `tools/20261104_do_moc_measure.js` trong gói spec này, chạy ngoài repo): số action 28 đường dẫn, JS gzip, CSS gzip (`.next/static/chunks/*.css`); số `role` theo design mục 3 ca 2; bảng trạng thái khoá (design mục 2); ảnh 1440 và 390, Sáng và Tối của 2 màn, dữ liệu tạo theo requirements mục 4 (máy chủ mock riêng, chi tiết ở 3 trạng thái).
3. `/approvals` theo design mục 1, rồi chạy `maker-checker`, `mint`, `chain-scope`.
4. `/approvals/[id]` theo design mục 1, rồi chạy lại 3 spec trên. Xoá `stat-card.tsx`.
5. Tách khối hành động (requirements QĐ-10) trước khi đổi kiểu, chạy lại `maker-checker`; viết `app/test/fe-ux-03a.test.ts`. Đối chiếu notes 2 màn, lập bảng. Viết `app/e2e/fe-ux-03a-kiem-soat.spec.ts`. Chạy kiểm thử đúng requirements mục 5, lưu log.
6. Các lệnh kiểm, kết quả phải rỗng (trừ 6d là danh sách để đọc):

   a. Danh sách trắng (`stat-card.tsx` chỉ được xuất hiện ở dạng xoá):

   ```bash
   git diff --name-only --diff-filter=d origin/release/ui-v2...HEAD \
     | grep -vE '^(app/src/components/pages/(approvals|approval-detail)\.tsx|app/src/components/maker-checker/approval-actions\.tsx|app/e2e/fe-ux-03a-kiem-soat\.spec\.ts|app/test/fe-ux-03a\.test\.ts|docs/fe-ux-03a-kiem-soat/(requirements|design|tasks)\.md|docs/CHECKPOINT_FEUX03A\.md|docs/USER_GUIDE\.md|\.kiro/task-status\.json)$'
   git diff --name-only --diff-filter=D origin/release/ui-v2...HEAD | grep -vx 'app/src/components/maker-checker/stat-card.tsx'
   ```

   b. Màu cứng trong phạm vi:

   ```bash
   rg -n '\b(bg|text|border|ring|fill|stroke|from|to|via)-(white|black|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3})\b|#[0-9a-fA-F]{3,8}\b|rgba?\(' \
     app/src/components/pages/{approvals,approval-detail}.tsx app/src/components/maker-checker/approval-actions.tsx
   ```

   c. Ký tự cấm ở dòng thêm mới thật:

   ```bash
   D="git diff origin/release/ui-v2...HEAD -U0 -- app/src"
   $D | grep '^-[^-]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/del.txt
   $D | grep '^+[^+]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/add.txt
   comm -13 /tmp/del.txt /tmp/add.txt | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e'
   ```

   d. Chuỗi tiếng Việt bị đổi hoặc mất (đọc; chỉ được là các chỗ QĐ-6, chữ chỉ dời giữa phần tử và prop, hoặc dòng của `stat-card.tsx` đã xoá; giải thích trong checkpoint). Cần GNU grep có `-P`:

   ```bash
   export LC_ALL=C.UTF-8
   ext() { grep -oP "[^<>'\"\`{}]*[À-ỹ][^<>'\"\`{}]*" "$1" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | sort -u; }
   comm -23 <(ext /tmp/del.txt) <(ext /tmp/add.txt)
   ```

   e. Không còn nơi dùng tệp đã xoá: `rg -n "stat-card|INPUT_CLASS" app/src` rỗng.

   f. Ký tự cấm còn trong 2 tệp cuối (bắt cả trường hợp quên đổi chuỗi QĐ-6, bỏ dòng chú thích):

   ```bash
   rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e' app/src/components/pages/{approvals,approval-detail}.tsx app/src/components/maker-checker/approval-actions.tsx | rg -v ':\s*(\*|//|/\*|\{/\*)'
   ```

7. Đo lại (cùng cách bước 2); chụp ảnh sau.
8. Viết `docs/CHECKPOINT_FEUX03A.md` theo `docs/CHECKPOINT_TEMPLATE.md` (mục 0 đủ 14 điều kiện; `node scripts/check-checkpoint.mjs docs/CHECKPOINT_FEUX03A.md docs/fe-ux-03a-kiem-soat/requirements.md`), cập nhật `docs/USER_GUIDE.md` phần 2 màn, `.kiro/task-status.json` (FE-UX-03a vào `inProgress` khi chạy kiểm để phần `checkpoint` của script đọc được, chuyển sang hoàn thành khi xong; FE-UX-03b vào `planned`; bỏ FE-UX-03 nếu có).
9. Mở PR base `release/ui-v2`, tiêu đề `FE-UX-03a: 2 màn Kiểm soát duyệt yêu cầu`, gửi Supervisor báo cáo kèm log, đoạn log EVM riêng, số đo, ảnh, bảng đối chiếu notes, bảng trạng thái khoá, kết quả bước 6. Không tự merge.
