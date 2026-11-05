# FE-UX-05a: các bước

1. Tạo nhánh `feat/fe-ux-05a-nguoi-ban` từ `release/ui-v2` mới nhất. Nếu PR khác merge trong lúc làm: rebase lên head mới, làm lại bước 2 từ merge-base mới và chạy lại toàn bộ kiểm thử requirements mục 5 trên nhánh đã rebase (requirements, dòng Nhánh).
2. Đo mốc (script `tools/20261104_do_moc_measure.js`, chạy ngoài repo, trên tiến trình mock KHÁC tiến trình chụp ảnh, mới khởi động với đủ `webServer.env`). Chuẩn bị dữ liệu TRƯỚC khi chạy script, cùng công thức cho bản mốc và bản nhánh: `E2E_BASE_URL=http://localhost:<cổng> npx playwright test e2e/ops-transactions.spec.ts` (tạo yêu cầu phát hành đã duyệt, lệnh mua, bán); rồi xác nhận `metrics.json` không có dòng `khong tim thay lien ket` cho `DYN:/transactions`, `DYN:/approvals`, `DYN:/orders` (đủ `/transactions/[id]`, `/approvals/[id]`, `/orders/[id]`); thiếu thì dừng và báo, không đo tiếp. Số đo: số action 28 đường dẫn, JS gzip từ `metrics.json`, JS `/seller`, `/seller/transactions`, `/seller/withdraw` theo byte so bản build mốc riêng, CSS gzip theo cách 01c; `hydration`, `consoleErrors`, `pageErrors` từ `metrics.json` (đường dẫn động thiếu liên kết thì chạy lại, hai lần đo phải cùng đủ dòng); số `role` theo design mục 3 ca 1, ca 2 (máy chủ mới); số lời gọi action, `useEffect` theo QĐ-2; ảnh trước theo requirements mục 4.
3. Commit riêng: tạo `components/seller/format.ts`, `seller-overview-body.tsx` bằng dời nguyên văn (requirements QĐ-4); chạy `fix-04-noi-du-lieu-that`, `vault-withdraw` (sau `ops-transactions`); viết `app/test/fe-ux-05a.test.ts` nhóm 1 (phần số lời gọi, biểu thức khoá, `import type`), nhóm 2 (trừ phép kiểm "–" của `nf`, viết sau bước 4).
4. Màn theo design mục 1, 2 và QĐ-3, QĐ-5, QĐ-6, QĐ-7; viết nhóm 3, 4 và phần còn lại của nhóm 1, 2; chạy `fix-04-noi-du-lieu-that`, `vault-withdraw`, `uiux-02-dau-man`, unit test mới.
5. Đối chiếu notes, lập bảng. Viết `app/e2e/fe-ux-05a-nguoi-ban.spec.ts`. Chạy kiểm thử đúng requirements mục 5, lưu log.
6. Các lệnh kiểm (chạy được trên macOS và Linux, bash và zsh; tệp tạm tên riêng để không đè tệp của nhánh khác). Kỳ vọng: 6a, 6b, 6c, 6e rỗng; 6d chỉ in mảnh chữ cũ ở đúng các vị trí QĐ-7 (`seller-overview.tsx:249`; `seller-transactions.tsx:214`, mảnh in ra có `$` ở cuối vì `${…}` tách chuỗi) hoặc mảnh do tách phần tử, xuống dòng khác chỗ (ghép lại đúng câu cũ); checkpoint giải thích từng dòng, dòng khác là lỗi.

   a. Danh sách trắng:

   ```bash
   git diff --name-only --diff-filter=d origin/release/ui-v2...HEAD \
     | grep -vE '^(app/src/components/pages/seller-(overview|transactions)\.tsx|app/src/components/seller/(format\.ts|seller-overview-body\.tsx)|app/e2e/fe-ux-05a-nguoi-ban\.spec\.ts|app/test/fe-ux-05a\.test\.ts|docs/fe-ux-05a-nguoi-ban/(requirements|design|tasks)\.md|docs/CHECKPOINT_FEUX05A(_DETAIL)?\.md|docs/USER_GUIDE\.md|docs/tech-report\.md|\.kiro/task-status\.json)$'
   git diff --name-only --diff-filter=D origin/release/ui-v2...HEAD
   ```

   b. Màu cứng và `*-destructive`:

   ```bash
   rg -n '\b(bg|text|border|ring|fill|stroke|from|to|via)-(white|black|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3})\b|#[0-9a-fA-F]{3,8}\b|rgba?\(|-destructive\b' \
     app/src/components/pages/seller-overview.tsx app/src/components/pages/seller-transactions.tsx app/src/components/seller/
   ```

   c. Ký tự cấm ở dòng thêm mới (chạy cùng `LC_ALL=C` với 6d để `sort`, `comm` nhất quán theo byte; `D` là hàm, không phải biến):

   ```bash
   export LC_ALL=C
   D() { git diff origin/release/ui-v2...HEAD -U0 -- app/src app/test/fe-ux-05a.test.ts app/e2e/fe-ux-05a-nguoi-ban.spec.ts; }
   D | grep '^-[^-]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/feux05a-del.txt
   D | grep '^+[^+]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/feux05a-add.txt
   comm -13 /tmp/feux05a-del.txt /tmp/feux05a-add.txt | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e'
   ```

   d. Chuỗi tiếng Việt bị đổi hoặc mất (đọc):

   ```bash
   export LC_ALL=C
   ext() { rg -oN --no-filename "[^<>'\"\`{}]*[À-ỹ][^<>'\"\`{}]*" "$1" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | sort -u; }
   comm -23 <(ext /tmp/feux05a-del.txt) <(ext /tmp/feux05a-add.txt)
   ```

   e. Ký tự cấm còn trong tệp cuối (bỏ dòng mà nội dung bắt đầu bằng `*`, `//`, `/*`, `{/*`; trong mã test viết ký tự cấm bằng escape `\u00b7`, `\u2014`):

   ```bash
   rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e' app/src/components/pages/seller-overview.tsx app/src/components/pages/seller-transactions.tsx app/src/components/seller/ app/test/fe-ux-05a.test.ts app/e2e/fe-ux-05a-nguoi-ban.spec.ts | rg -v '^[^:]+:[0-9]+:\s*(\*|//|/\*|\{/\*)'
   ```

7. Đo lại (cùng cách bước 2); chụp ảnh sau trên tiến trình mock mới khởi động từ bản build nhánh, cùng công thức. Ảnh trạng thái khó tạo theo requirements mục 4.
8. Viết `docs/CHECKPOINT_FEUX05A.md` theo `docs/CHECKPOINT_TEMPLATE.md` (mục 0 đủ 14 điều kiện của requirements mục 4; `node scripts/check-checkpoint.mjs docs/CHECKPOINT_FEUX05A.md docs/fe-ux-05a-nguoi-ban/requirements.md`), cập nhật `docs/USER_GUIDE.md` phần hai màn, `.kiro/task-status.json` (thay mã gộp `FE-UX-05` trong `planned` bằng `FE-UX-05a`, `FE-UX-05b`; FE-UX-05a `inProgress` khi chạy kiểm rồi hoàn thành; PR merge sau gộp sao cho mỗi mã ở đúng một danh sách).
9. Mở PR base `release/ui-v2`, tiêu đề `FE-UX-05a: Tổng quan và Danh sách giao dịch của Người bán`, gửi Supervisor báo cáo kèm log, đoạn log EVM riêng, số đo, ảnh, bảng đối chiếu notes, kết quả bước 6. Không tự merge.
