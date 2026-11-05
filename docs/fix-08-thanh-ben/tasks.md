# FIX-08: các bước

1. Tạo nhánh `fix/fix-08-thanh-ben` từ `release/ui-v2` mới nhất. Nếu PR khác merge trong lúc làm: rebase, làm lại bước 2 từ merge-base mới, chạy lại toàn bộ kiểm thử requirements mục 5.
2. Đo mốc (script `tools/20261104_do_moc_measure.js`, ngoài repo, tiến trình mock mới khởi động với đủ `webServer.env`, KHÁC tiến trình chụp ảnh). Chuẩn bị dữ liệu trước: `E2E_BASE_URL=http://localhost:<cổng> npx playwright test e2e/ops-transactions.spec.ts`; xác nhận `metrics.json` không có dòng `khong tim thay lien ket` cho `DYN:/transactions`, `DYN:/approvals`, `DYN:/orders`, thiếu thì dừng và báo. Số đo: action 28 đường dẫn, JS gzip, CSS gzip, ba số lỗi; ảnh trước theo requirements mục 4.
3. Viết `active-nav.ts` và `app/test/fix-08.test.ts` nhóm 1, 2. Để lấy danh sách chỗ cũ sáng từ 2 mục: tạm cho test ghi danh sách ra (ví dụ `toEqual([])` để test đỏ và hiện danh sách), xác nhận trên mã cũ, rồi chép cứng danh sách vào `expect(duplicates).toEqual([...])` và checkpoint; không để lại `console` trong test.
4. Sửa `sidebar.tsx` (QĐ-2, QĐ-3), chữ ba tệp khung (QĐ-4), bốn regex `investor-channel.spec.ts` (QĐ-5); viết nhóm 3; viết `app/e2e/fix-08-thanh-ben.spec.ts`.
5. Ghi FIX-08 vào `inProgress` của `.kiro/task-status.json` và viết bản đầu `docs/CHECKPOINT_FIX08.md` (để phần `checkpoint` của `run-local-all.sh` thật sự kiểm, không "BỎ QUA"); rồi chạy kiểm thử đúng requirements mục 5, lưu log. Sau bước 8 chạy lại `bash scripts/run-local-all.sh checkpoint`, dán log.
6. Các lệnh kiểm (macOS và Linux, bash và zsh). Kỳ vọng: hai lệnh đầu của 6a rỗng; ba lệnh sau của 6a (riêng `investor-channel.spec.ts`, không phụ thuộc số dòng vì base có thể đổi sau rebase) in lần lượt `1`, `4`, `4`, và mọi dòng xoá, thêm là bốn regex của QĐ-5; 6b, 6c, 6e rỗng; 6d in ba chỗ chữ cũ của QĐ-4 (`title` nhãn Vai trò, hậu tố chain, `title` mục chưa mở; dòng nhãn lựa chọn vai không hiện vì mảnh cũ " \u00b7 " không có chữ có dấu) và bốn regex cũ của QĐ-5, tổng 7 dòng; checkpoint giải thích từng dòng.

   a. Danh sách trắng (riêng `investor-channel.spec.ts`: kiểm thêm diff chỉ gồm một hunk, bốn dòng xoá, bốn dòng thêm, đều là regex QĐ-5):

   ```bash
   git diff --name-only --diff-filter=d origin/release/ui-v2...HEAD \
     | grep -vE '^(app/src/components/layout/(sidebar|channel-switcher|chain-selector)\.tsx|app/src/components/layout/active-nav\.ts|app/e2e/investor-channel\.spec\.ts|app/e2e/fix-08-thanh-ben\.spec\.ts|app/test/fix-08\.test\.ts|docs/fix-08-thanh-ben/(requirements|design|tasks)\.md|docs/CHECKPOINT_FIX08\.md|docs/USER_GUIDE\.md|docs/tech-report\.md|\.kiro/task-status\.json)$'
   git diff --name-only --diff-filter=D origin/release/ui-v2...HEAD
   F=app/e2e/investor-channel.spec.ts
   git diff -U0 origin/release/ui-v2...HEAD -- "$F" | grep -c '^@@'
   git diff -U0 origin/release/ui-v2...HEAD -- "$F" | grep -c '^-[^-]'
   git diff -U0 origin/release/ui-v2...HEAD -- "$F" | grep -c '^+[^+]'
   git diff -U0 origin/release/ui-v2...HEAD -- "$F" | grep -E '^[-+][^-+]'
   ```

   b. Màu cứng và `*-destructive`:

   ```bash
   rg -n '\b(bg|text|border|ring|fill|stroke|from|to|via)-(white|black|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3})\b|#[0-9a-fA-F]{3,8}\b|rgba?\(|-destructive\b|\x27destructive\x27|"destructive"' \
     app/src/components/layout/sidebar.tsx app/src/components/layout/channel-switcher.tsx app/src/components/layout/chain-selector.tsx app/src/components/layout/active-nav.ts
   ```

   c. Ký tự cấm ở dòng thêm mới (`LC_ALL=C`; `D` là hàm):

   ```bash
   export LC_ALL=C
   D() { git diff origin/release/ui-v2...HEAD -U0 -- app/src app/e2e/investor-channel.spec.ts app/test/fix-08.test.ts app/e2e/fix-08-thanh-ben.spec.ts; }
   D | grep '^-[^-]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/fix08-del.txt
   D | grep '^+[^+]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/fix08-add.txt
   comm -13 /tmp/fix08-del.txt /tmp/fix08-add.txt | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e'
   ```

   d. Chuỗi tiếng Việt bị đổi hoặc mất (đọc; bỏ dòng chú thích):

   ```bash
   export LC_ALL=C
   ext() { rg -v '^(\*|//|/\*|\{/\*)' "$1" | rg -oN --no-filename "[^<>'\"\`{}]*[À-ỹ][^<>'\"\`{}]*" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | sort -u; }
   comm -23 <(ext /tmp/fix08-del.txt) <(ext /tmp/fix08-add.txt)
   ```

   e. Ký tự cấm còn trong tệp cuối (bỏ dòng chú thích):

   ```bash
   rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e' app/src/components/layout/sidebar.tsx app/src/components/layout/channel-switcher.tsx app/src/components/layout/chain-selector.tsx app/src/components/layout/active-nav.ts app/test/fix-08.test.ts app/e2e/fix-08-thanh-ben.spec.ts | rg -v '^[^:]+:[0-9]+:\s*(\*|//|/\*|\{/\*)'
   ```

7. Đo lại (cùng cách bước 2); chụp ảnh sau trên tiến trình mock mới khởi động từ bản build nhánh.
8. Viết `docs/CHECKPOINT_FIX08.md` theo `docs/CHECKPOINT_TEMPLATE.md` (mục 0 đủ 14 điều kiện của requirements mục 4; `node scripts/check-checkpoint.mjs docs/CHECKPOINT_FIX08.md docs/fix-08-thanh-ben/requirements.md`), cập nhật `docs/USER_GUIDE.md` (thanh bên, ô chọn vai), `.kiro/task-status.json` (FIX-08 `inProgress` rồi hoàn thành).
9. Mở PR base `release/ui-v2`, tiêu đề `FIX-08: thanh bên chỉ sáng đúng một mục; bỏ ký tự cấm ở khung`, gửi Supervisor báo cáo kèm log, đoạn log EVM riêng, số đo, ảnh, danh sách chỗ cũ sáng từ 2 mục, kết quả bước 6. Không tự merge.
