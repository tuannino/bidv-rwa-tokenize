# FE-UX-07b: các bước

1. Đợi FE-UX-07a merge; tạo nhánh `feat/fe-ux-07b-thanh-dau` từ `release/ui-v2` mới nhất. Nếu PR khác merge trong lúc làm: rebase lên head mới, làm lại bước 2 từ merge-base mới và chạy lại toàn bộ kiểm thử requirements mục 5.
2. Đo mốc (script `tools/20261104_do_moc_measure.js`, chạy ngoài repo, trên tiến trình mock KHÁC tiến trình chụp ảnh, mới khởi động với đủ `webServer.env`), cùng công thức chuẩn bị dữ liệu như các task trước (`E2E_BASE_URL=http://localhost:<cổng> npx playwright test e2e/ops-transactions.spec.ts`, rồi xác nhận `metrics.json` đủ dòng `DYN:`). Số đo: số action 28 đường dẫn, JS gzip, JS theo byte so bản build mốc riêng, CSS gzip theo cách 01c, ba số lỗi. Chạy `tools/20261106_do_thanh_dau_ban_chot.js` để có số đo bản chốt (so với design mục 1). Ảnh trước theo requirements mục 4 (app mốc và bản chốt cạnh nhau).
3. Commit riêng: nhãn chain (QĐ-10) và câu `USER_GUIDE.md` tương ứng; unit nhóm 4; chạy `wallet-status`, `fe-ux-04c`, `fix-08` (unit), `wallet-connect`, `fe-ux-04c-lenh-vi` (e2e).
4. Thanh đầu theo QĐ-1 đến QĐ-9, QĐ-11 và design mục 2 (chú thích `header.tsx:66-77` về nút ví có U+2014 ở dòng `:72`: viết lại không dùng ký tự đó khi dời hoặc giữ, để 6e rỗng); unit nhóm 1 đến 3; e2e ca 1 đến 5; chạy `fe-ux-01b-khung`, `fe-ux-01c-chuyen-dong`, `wallet-connect`, `uiux-02-dau-man` (e2e), unit mới.
5. Chạy kiểm thử đúng requirements mục 5, lưu log.
6. Các lệnh kiểm (chạy được trên macOS và Linux, bash và zsh; tệp tạm tên riêng). Kỳ vọng: 6a đúng như ghi; 6b, 6c, 6e rỗng; 6d chỉ in mảnh chữ có dấu của chú thích `header.tsx` được viết lại (nếu có); 6f in đúng một dòng (nhãn cũ trong `chains.ts`); checkpoint giải thích từng dòng, dòng khác là lỗi.

   a. Danh sách trắng:

   ```bash
   git diff --name-only --diff-filter=d origin/release/ui-v2...HEAD \
     | grep -vE '^(app/src/components/layout/(header|header-wallet-button|app-layout)\.tsx|app/src/components/layout/header-progress\.ts|app/src/app/globals\.css|packages/shared/src/chains\.ts|app/e2e/fe-ux-07b-thanh-dau\.spec\.ts|app/test/fe-ux-07b\.test\.ts|docs/fe-ux-07b-thanh-dau/(requirements|design|tasks)\.md|docs/CHECKPOINT_FEUX07B(_DETAIL)?\.md|docs/USER_GUIDE\.md|docs/tech-report\.md|\.kiro/task-status\.json)$'
   git diff --name-only --diff-filter=D origin/release/ui-v2...HEAD
   git diff origin/release/ui-v2...HEAD --numstat -- packages/shared/src/chains.ts app/src/app/globals.css
   git diff origin/release/ui-v2...HEAD -U0 -- packages/shared/src/chains.ts | grep '^[-+][^-+]'
   ```

   Dòng thứ ba: `chains.ts` đúng `1	1`; `globals.css` 0 dòng xoá. Dòng thứ tư: đúng hai dòng `-    label: 'Hardhat Local',` và `+    label: 'Private Chain',`.

   b. Màu cứng và `*-destructive`:

   ```bash
   rg -n '\b(bg|text|border|ring|fill|stroke|from|to|via)-(white|black|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3})\b|#[0-9a-fA-F]{3,8}\b|rgba?\(|-destructive\b' \
     app/src/components/layout/header.tsx app/src/components/layout/header-wallet-button.tsx app/src/components/layout/header-progress.ts
   ```

   c. Ký tự cấm ở dòng thêm mới:

   ```bash
   export LC_ALL=C
   D() { git diff origin/release/ui-v2...HEAD -U0 -- app/src packages/shared/src app/test/fe-ux-07b.test.ts app/e2e/fe-ux-07b-thanh-dau.spec.ts; }
   D | grep '^-[^-]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/feux07b-del.txt
   D | grep '^+[^+]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/feux07b-add.txt
   comm -13 /tmp/feux07b-del.txt /tmp/feux07b-add.txt | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e'
   ```

   d. Chuỗi bị đổi hoặc mất (đọc; bỏ dòng chú thích):

   ```bash
   export LC_ALL=C
   ext() { rg -v '^(\*|//|/\*|\{/\*)' "$1" | rg -oN --no-filename "[^<>'\"\`{}]*[À-ỹ][^<>'\"\`{}]*" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | sort -u; }
   comm -23 <(ext /tmp/feux07b-del.txt) <(ext /tmp/feux07b-add.txt)
   ```

   e. Ký tự cấm còn trong tệp cuối (bỏ dòng chú thích):

   ```bash
   rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e' app/src/components/layout/header.tsx app/src/components/layout/header-wallet-button.tsx app/src/components/layout/header-progress.ts app/test/fe-ux-07b.test.ts app/e2e/fe-ux-07b-thanh-dau.spec.ts | rg -v '^[^:]+:[0-9]+:\s*(\*|//|/\*|\{/\*)'
   ```

   f. Chữ tiếng Anh bị đổi (nhãn chain):

   ```bash
   rg -n 'Hardhat Local' /tmp/feux07b-del.txt
   rg -n 'Hardhat Local' /tmp/feux07b-add.txt
   ```

   Dòng đầu: đúng một dòng `label: 'Hardhat Local',`; dòng hai: rỗng.

7. Đo lại (cùng cách bước 2); chụp ảnh sau trên tiến trình mock mới khởi động từ bản build nhánh, đặt cạnh ảnh bản chốt cùng màn, cùng trạng thái.
8. Viết `docs/CHECKPOINT_FEUX07B.md` theo `docs/CHECKPOINT_TEMPLATE.md` (mục 0 đủ 14 điều kiện của requirements mục 4; `node scripts/check-checkpoint.mjs docs/CHECKPOINT_FEUX07B.md docs/fe-ux-07b-thanh-dau/requirements.md`), gồm bảng số đo bản chốt và app (design mục 1) trước và sau, danh sách chỗ hiển thị nhãn chain; cập nhật `docs/USER_GUIDE.md` (thanh đầu: hai trạng thái khi cuộn; nhãn "Private Chain"), `.kiro/task-status.json` (FE-UX-07b `inProgress` khi chạy kiểm rồi hoàn thành; PR merge sau gộp sao cho mỗi mã ở đúng một danh sách).
9. Mở PR base `release/ui-v2`, tiêu đề `FE-UX-07b: Thanh đầu theo bản chốt, nhãn chain Private Chain`, gửi Supervisor báo cáo kèm log, đoạn log EVM riêng, số đo, ảnh so bản chốt, kết quả bước 6. Không tự merge.
