# FE-UX-03c: các bước

1. Tạo nhánh `feat/fe-ux-03c-vault` từ `release/ui-v2` mới nhất (@ `1238a54` hoặc sau).
2. Đo mốc (script `tools/20261104_do_moc_measure.js`, chạy ngoài repo): số action 28 đường dẫn, JS gzip từ `metrics.json` (`jsGzipKB`), JS `/vault` theo byte so bản build mốc riêng, CSS gzip theo cách 01c; `hydration`, `consoleErrors`, `pageErrors` từ `metrics.json` (đường dẫn động thiếu liên kết thì chạy lại, hai lần đo phải cùng đủ dòng); script đo chạy trên tiến trình mock KHÁC tiến trình chụp ảnh; số `role` theo design mục 3 ca 2; số lời gọi action và `useEffect` trong `vault-status.tsx` (design mục 3 nhóm 1); ảnh theo requirements mục 4 (tiến trình mock riêng, mới khởi động, từ bản build mốc).
3. Commit riêng: dời `WithdrawReviewItem` và phần dùng chung sang `components/vault/` nguyên văn (requirements QĐ-5), chạy `vault-withdraw`; viết `app/test/fe-ux-03c.test.ts`.
4. Màn theo design mục 1, 2, rồi chạy `vault-withdraw`, `uiux-02-dau-man`, unit test mới.
5. Đối chiếu notes, lập bảng. Viết `app/e2e/fe-ux-03c-vault.spec.ts`. Chạy kiểm thử đúng requirements mục 5, lưu log.
6. Các lệnh kiểm, kết quả phải rỗng (trừ 6d là danh sách để đọc):

   a. Danh sách trắng:

   ```bash
   git diff --name-only --diff-filter=d origin/release/ui-v2...HEAD \
     | grep -vE '^(app/src/components/pages/vault-status\.tsx|app/src/components/vault/[a-z0-9-]+\.tsx?|app/e2e/fe-ux-03c-vault\.spec\.ts|app/test/fe-ux-03c\.test\.ts|docs/fe-ux-03c-vault/(requirements|design|tasks)\.md|docs/CHECKPOINT_FEUX03C\.md|docs/USER_GUIDE\.md|docs/tech-report\.md|\.kiro/task-status\.json)$'
   git diff --name-only --diff-filter=D origin/release/ui-v2...HEAD
   ```

   b. Màu cứng:

   ```bash
   rg -n '\b(bg|text|border|ring|fill|stroke|from|to|via)-(white|black|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3})\b|#[0-9a-fA-F]{3,8}\b|rgba?\(' \
     app/src/components/pages/vault-status.tsx app/src/components/vault/
   ```

   c. Ký tự cấm ở dòng thêm mới (chạy cùng `LC_ALL=C` với 6d để `sort`, `comm` nhất quán theo byte; chạy được cả macOS và Linux, bash và zsh; `D` là hàm, không phải biến):

   ```bash
   export LC_ALL=C
   D() { git diff origin/release/ui-v2...HEAD -U0 -- app/src; }
   D | grep '^-[^-]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/del.txt
   D | grep '^+[^+]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/add.txt
   comm -13 /tmp/del.txt /tmp/add.txt | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e'
   ```

   d. Chuỗi tiếng Việt bị đổi hoặc mất (đọc; chỉ được là chữ dời giữa phần tử và prop hoặc giữa tệp, giải thích trong checkpoint). Dùng `rg` thay `grep -P` (grep macOS không có `-P`); Supervisor đã chạy thử trên diff #91, kết quả giống hệt bản `grep -P`:

   ```bash
   export LC_ALL=C
   ext() { rg -oN --no-filename "[^<>'\"\`{}]*[À-ỹ][^<>'\"\`{}]*" "$1" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | sort -u; }
   comm -23 <(ext /tmp/del.txt) <(ext /tmp/add.txt)
   ```

   e. Ký tự cấm còn trong tệp cuối (bỏ dòng chú thích):

   ```bash
   rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e' app/src/components/pages/vault-status.tsx app/src/components/vault/ | rg -v ':\s*(\*|//|/\*|\{/\*)'
   ```

7. Đo lại (cùng cách bước 2); chụp ảnh sau trên tiến trình mock mới khởi động từ bản build nhánh, cùng công thức và thứ tự như bước 2.
8. Viết `docs/CHECKPOINT_FEUX03C.md` theo `docs/CHECKPOINT_TEMPLATE.md` (mục 0 đủ 14 điều kiện; `node scripts/check-checkpoint.mjs docs/CHECKPOINT_FEUX03C.md docs/fe-ux-03c-vault/requirements.md`), cập nhật `docs/USER_GUIDE.md` phần màn, `.kiro/task-status.json` (FE-UX-03c `inProgress` khi chạy kiểm rồi hoàn thành).
9. Mở PR base `release/ui-v2`, tiêu đề `FE-UX-03c: màn Vault thanh toán SPV`, gửi Supervisor báo cáo kèm log, đoạn log EVM riêng, số đo, ảnh, bảng đối chiếu notes, kết quả bước 6. Không tự merge.
