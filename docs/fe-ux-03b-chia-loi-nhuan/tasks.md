# FE-UX-03b: các bước

1. Tạo nhánh `feat/fe-ux-03b-chia-loi-nhuan` từ `release/ui-v2` mới nhất (@ `baf0fd4` hoặc sau).
2. Đo mốc trên `release/ui-v2` (script `tools/20261104_do_moc_measure.js`, chạy ngoài repo): số action 28 đường dẫn, JS gzip, CSS gzip; số `role` theo design mục 3 ca 2; ảnh theo requirements mục 4 (máy chủ mock riêng).
3. Commit riêng: dời `ActivePeriodCard` và phần dùng chung sang `components/distribution/` nguyên văn (requirements QĐ-10), chạy `zz-distribution-approval`, `fe-08-approval.test.ts`. Sau đó `status-tone.ts` và unit test (design mục 3).
4. Màn theo design mục 1, rồi chạy `zz-distribution-approval`, `uiux-02-dau-man`, `fe-08-approval.test.ts`.
5. Đối chiếu notes, lập bảng. Viết `app/e2e/fe-ux-03b-chia-loi-nhuan.spec.ts`. Chạy kiểm thử đúng requirements mục 5, lưu log.
6. Các lệnh kiểm, kết quả phải rỗng (trừ 6d là danh sách để đọc):

   a. Danh sách trắng:

   ```bash
   git diff --name-only --diff-filter=d origin/release/ui-v2...HEAD \
     | grep -vE '^(app/src/components/pages/distribution-approval\.tsx|app/src/components/distribution/[a-z0-9-]+\.tsx?|app/e2e/fe-ux-03b-chia-loi-nhuan\.spec\.ts|app/test/fe-ux-03b\.test\.ts|docs/fe-ux-03b-chia-loi-nhuan/(requirements|design|tasks)\.md|docs/CHECKPOINT_FEUX03B\.md|docs/USER_GUIDE\.md|docs/tech-report\.md|\.kiro/task-status\.json)$'
   git diff --name-only --diff-filter=D origin/release/ui-v2...HEAD
   ```

   b. Màu cứng:

   ```bash
   rg -n '\b(bg|text|border|ring|fill|stroke|from|to|via)-(white|black|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3})\b|#[0-9a-fA-F]{3,8}\b|rgba?\(' \
     app/src/components/pages/distribution-approval.tsx app/src/components/distribution/
   ```

   c. Ký tự cấm ở dòng thêm mới:

   ```bash
   D="git diff origin/release/ui-v2...HEAD -U0 -- app/src"
   $D | grep '^-[^-]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/del.txt
   $D | grep '^+[^+]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/add.txt
   comm -13 /tmp/del.txt /tmp/add.txt | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e'
   ```

   d. Chuỗi tiếng Việt bị đổi hoặc mất (đọc; chỉ được là chữ dời giữa phần tử và prop, giải thích trong checkpoint):

   ```bash
   export LC_ALL=C.UTF-8
   ext() { grep -oP "[^<>'\"\`{}]*[À-ỹ][^<>'\"\`{}]*" "$1" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | sort -u; }
   comm -23 <(ext /tmp/del.txt) <(ext /tmp/add.txt)
   ```

   e. Ký tự cấm còn trong tệp cuối (bỏ dòng chú thích):

   ```bash
   rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e' app/src/components/pages/distribution-approval.tsx app/src/components/distribution/ | rg -v ':\s*(\*|//|/\*|\{/\*)'
   ```

   f. Hai callback nối thẻ Kỳ hoạt động không đổi (phải in đúng 2 dòng, giống hệt bản mốc):

   ```bash
   rg -n "setConfirm\(\{ kind: 'reapprove'|onContinue=\{\(\) => void run\(\(\) => continueDistributionAction" app/src/components/pages/distribution-approval.tsx
   ```

7. Đo lại (cùng cách bước 2); chụp ảnh sau.
8. Viết `docs/CHECKPOINT_FEUX03B.md` theo `docs/CHECKPOINT_TEMPLATE.md` (mục 0 đủ 14 điều kiện; `node scripts/check-checkpoint.mjs docs/CHECKPOINT_FEUX03B.md docs/fe-ux-03b-chia-loi-nhuan/requirements.md`), cập nhật `docs/USER_GUIDE.md` phần màn, `.kiro/task-status.json` (FE-UX-03b `inProgress` khi chạy kiểm rồi hoàn thành; FE-UX-03c vào `planned`).
9. Mở PR base `release/ui-v2`, tiêu đề `FE-UX-03b: màn Chia lợi nhuận`, gửi Supervisor báo cáo kèm log, đoạn log EVM riêng, số đo, ảnh, bảng đối chiếu notes, kết quả bước 6. Không tự merge.
