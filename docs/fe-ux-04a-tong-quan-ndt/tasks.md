# FE-UX-04a: các bước

1. Tạo nhánh `feat/fe-ux-04a-tong-quan-ndt` từ `release/ui-v2` mới nhất (@ `1238a54` hoặc sau). Nếu PR #92 merge trong lúc làm: rebase lên `release/ui-v2` mới, làm lại bước 2 từ merge-base mới (requirements, dòng Nhánh).
2. Đo mốc (script `tools/20261104_do_moc_measure.js`, chạy ngoài repo, trên tiến trình mock KHÁC tiến trình chụp ảnh): số action 28 đường dẫn, JS gzip từ `metrics.json` (`jsGzipKB`), JS sáu trang (`/portfolio`, `/tokens/WPT`, `/trade`, `/orders`, `/orders/[id]`, `/withdraw`) theo byte so bản build mốc riêng, CSS gzip theo cách 01c; `hydration`, `consoleErrors`, `pageErrors` từ `metrics.json` (đường dẫn động thiếu liên kết thì chạy lại, hai lần đo phải cùng đủ dòng); số `role` theo design mục 4 ca 1, ca 2 (máy chủ mới); số lời gọi action và `useEffect` theo QĐ-2; ảnh theo requirements mục 4 (tiến trình mock mới khởi động, bản build mốc).
3. Commit riêng: dời `AssetHoldings`, `TransactionTable` nguyên văn (requirements QĐ-5); chạy `investor-channel`, `fix-04-noi-du-lieu-that`; viết `app/test/fe-ux-04a.test.ts` nhóm 1, 2 (nhóm 3, 4 kiểm chữ và vỏ của bước 4 nên viết sau bước 4).
4. Màn theo design mục 1, 2 và QĐ-6, QĐ-7; viết nhóm 3, 4 của unit test; rồi chạy `investor-channel`, `fix-04-noi-du-lieu-that`, `ops-transactions`, `uiux-02-dau-man`, unit test mới.
5. Đối chiếu notes, lập bảng. Viết `app/e2e/fe-ux-04a-tong-quan-ndt.spec.ts`. Cập nhật `docs/USER_GUIDE.md` mục 3.1.5 (thứ tự thẻ). Chạy kiểm thử đúng requirements mục 5, lưu log.
6. Các lệnh kiểm (chạy được trên macOS và Linux, bash và zsh). Kỳ vọng: 6a, 6b, 6c, 6e rỗng; 6d in đúng 6 dòng sau (thứ tự theo `sort`), giải thích trong checkpoint: câu cũ `investor-token-detail.tsx:263` ("Không phải giá thị trường", gạch dài, "hệ thống chưa có thị trường thứ cấp."); mảnh chú thích cũ `transaction-history-box.tsx:142` ("Chain cục bộ và mock không có trình khám phá -"); bốn chú thích đánh số đã xoá ở `investor-token-detail.tsx:99`, `:124`, `:163`, `:216`. Ngoài 6 dòng này chỉ được có mảnh câu do xuống dòng khác chỗ (ghép lại đúng câu cũ), checkpoint giải thích từng dòng; còn lại là lỗi.

   a. Danh sách trắng:

   ```bash
   git diff --name-only --diff-filter=d origin/release/ui-v2...HEAD \
     | grep -vE '^(app/src/components/pages/investor-(portfolio|token-detail)\.tsx|app/src/components/investor/(asset-summary|issuance-status-box|transaction-history-box|token-list-box|wallet-not-bound-notice|asset-holdings|transaction-table)\.tsx|app/e2e/fe-ux-04a-tong-quan-ndt\.spec\.ts|app/test/fe-ux-04a\.test\.ts|docs/fe-ux-04a-tong-quan-ndt/(requirements|design|tasks)\.md|docs/CHECKPOINT_FEUX04A\.md|docs/USER_GUIDE\.md|docs/tech-report\.md|\.kiro/task-status\.json)$'
   git diff --name-only --diff-filter=D origin/release/ui-v2...HEAD
   ```

   b. Màu cứng:

   ```bash
   rg -n '\b(bg|text|border|ring|fill|stroke|from|to|via)-(white|black|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3})\b|#[0-9a-fA-F]{3,8}\b|rgba?\(|text-destructive' \
     app/src/components/pages/investor-portfolio.tsx app/src/components/pages/investor-token-detail.tsx app/src/components/investor/
   ```

   c. Ký tự cấm ở dòng thêm mới (chạy cùng `LC_ALL=C` với 6d để `sort`, `comm` nhất quán theo byte; `D` là hàm, không phải biến):

   ```bash
   export LC_ALL=C
   D() { git diff origin/release/ui-v2...HEAD -U0 -- app/src; }
   D | grep '^-[^-]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/del.txt
   D | grep '^+[^+]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/add.txt
   comm -13 /tmp/del.txt /tmp/add.txt | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e'
   ```

   d. Chuỗi tiếng Việt bị đổi hoặc mất (đọc; ngoài câu QĐ-6 chỉ được là chữ dời giữa phần tử và prop hoặc giữa tệp, giải thích trong checkpoint):

   ```bash
   export LC_ALL=C
   ext() { rg -oN --no-filename "[^<>'\"\`{}]*[À-ỹ][^<>'\"\`{}]*" "$1" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | sort -u; }
   comm -23 <(ext /tmp/del.txt) <(ext /tmp/add.txt)
   ```

   e. Ký tự cấm còn trong tệp cuối (bỏ dòng chú thích; chú thích nhiều dòng trong JSX không bắt đầu bằng `*` nên phải sửa chữ, QĐ-6):

   ```bash
   rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e' app/src/components/pages/investor-portfolio.tsx app/src/components/pages/investor-token-detail.tsx app/src/components/investor/ | rg -v ':\s*(\*|//|/\*|\{/\*)'
   ```

7. Đo lại (cùng cách bước 2); chụp ảnh sau trên tiến trình mock mới khởi động từ bản build nhánh, cùng công thức. Ảnh trạng thái khó tạo theo requirements mục 4.
8. Viết `docs/CHECKPOINT_FEUX04A.md` theo `docs/CHECKPOINT_TEMPLATE.md` (mục 0 đủ 14 điều kiện; `node scripts/check-checkpoint.mjs docs/CHECKPOINT_FEUX04A.md docs/fe-ux-04a-tong-quan-ndt/requirements.md`), cập nhật `docs/USER_GUIDE.md` phần hai màn, `.kiro/task-status.json` (FE-UX-04a `inProgress` khi chạy kiểm rồi hoàn thành; FE-UX-04b vào `planned`).
9. Mở PR base `release/ui-v2`, tiêu đề `FE-UX-04a: Tổng quan nhà đầu tư và chi tiết token`, gửi Supervisor báo cáo kèm log, đoạn log EVM riêng, số đo, ảnh, bảng đối chiếu notes, kết quả bước 6. Không tự merge.
