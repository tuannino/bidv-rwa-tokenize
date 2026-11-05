# FE-UX-06a: các bước

1. Tạo nhánh `feat/fe-ux-06a-man-mau` từ `release/ui-v2` mới nhất. Nếu PR khác merge trong lúc làm: rebase lên head mới, làm lại bước 2 từ merge-base mới và chạy lại toàn bộ kiểm thử requirements mục 5 trên nhánh đã rebase (requirements, dòng Nhánh).
2. Đo mốc (script `tools/20261104_do_moc_measure.js`, chạy ngoài repo, trên tiến trình mock KHÁC tiến trình chụp ảnh, mới khởi động với đủ `webServer.env`). Chuẩn bị dữ liệu TRƯỚC khi chạy script, cùng công thức cho bản mốc và bản nhánh: `E2E_BASE_URL=http://localhost:<cổng> npx playwright test e2e/ops-transactions.spec.ts`; rồi xác nhận `metrics.json` không có dòng `khong tim thay lien ket` cho `DYN:/transactions`, `DYN:/approvals`, `DYN:/orders`; thiếu thì dừng và báo, không đo tiếp. Số đo: số action 28 đường dẫn, JS gzip từ `metrics.json`, JS ba trang theo byte so bản build mốc riêng, CSS gzip theo cách 01c; `hydration`, `consoleErrors`, `pageErrors` từ `metrics.json` (đường dẫn động thiếu liên kết thì chạy lại, hai lần đo phải cùng đủ dòng); số `role` theo design mục 3 ca 1 (máy chủ mới); ảnh trước theo requirements mục 4. So ba bản `FilterBtn` (QĐ-2), ghi kết quả. Ở bước 3 thử dựng `AssetsPage`, `KycPage`, `ReconciliationPage` bằng `renderToStaticMarkup` (design mục 3), ghi mô-đun nào phải `vi.mock`.
3. Commit riêng: tạo `components/ops/filter-button.tsx` bằng dời nguyên văn (requirements QĐ-2); chạy `fix-05-tong-quan` (e2e và unit), `uiux-02-dau-man` (unit); viết `app/test/fe-ux-06a.test.ts` nhóm 1 phần `FilterBtn` (một dòng import mỗi trang, không còn bản cục bộ) và nhóm 2 trừ phép kiểm lớp `bg-primary` (viết sau bước 4).
4. Ba màn theo design mục 1, 2 và QĐ-3 đến QĐ-6; viết phần còn lại của nhóm 1, 2 và nhóm 3; chạy `fix-05-tong-quan`, `uiux-02-dau-man`, `fe-ux-01a-nen`, unit test mới.
5. Lập bảng khối cũ, khối mới cho ba màn. Viết `app/e2e/fe-ux-06a-man-mau.spec.ts`. Chạy kiểm thử đúng requirements mục 5, lưu log.
6. Các lệnh kiểm (chạy được trên macOS và Linux, bash và zsh; tệp tạm tên riêng để không đè tệp của nhánh khác). Kỳ vọng: 6a, 6b, 6c, 6e rỗng; 6d chỉ in ba câu cũ của `REGION_HINTS` (QĐ-6) hoặc mảnh do tách phần tử, xuống dòng khác chỗ (ghép lại đúng câu cũ); checkpoint giải thích từng dòng, dòng khác là lỗi.

   a. Danh sách trắng:

   ```bash
   git diff --name-only --diff-filter=d origin/release/ui-v2...HEAD \
     | grep -vE '^(app/src/components/pages/(assets|kyc|reconciliation)\.tsx|app/src/components/ops/filter-button\.tsx|app/e2e/fe-ux-06a-man-mau\.spec\.ts|app/test/fe-ux-06a\.test\.ts|docs/fe-ux-06a-man-mau/(requirements|design|tasks)\.md|docs/CHECKPOINT_FEUX06A(_DETAIL)?\.md|docs/USER_GUIDE\.md|docs/tech-report\.md|\.kiro/task-status\.json)$'
   git diff --name-only --diff-filter=D origin/release/ui-v2...HEAD
   ```

   b. Màu cứng và `*-destructive`:

   ```bash
   rg -n '\b(bg|text|border|ring|fill|stroke|from|to|via)-(white|black|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3})\b|#[0-9a-fA-F]{3,8}\b|rgba?\(|-destructive\b|\x27destructive\x27|"destructive"' \
     app/src/components/pages/assets.tsx app/src/components/pages/kyc.tsx app/src/components/pages/reconciliation.tsx app/src/components/ops/
   ```

   c. Ký tự cấm ở dòng thêm mới (chạy cùng `LC_ALL=C` với 6d để `sort`, `comm` nhất quán theo byte; `D` là hàm, không phải biến):

   ```bash
   export LC_ALL=C
   D() { git diff origin/release/ui-v2...HEAD -U0 -- app/src app/test/fe-ux-06a.test.ts app/e2e/fe-ux-06a-man-mau.spec.ts; }
   D | grep '^-[^-]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/feux06a-del.txt
   D | grep '^+[^+]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/feux06a-add.txt
   comm -13 /tmp/feux06a-del.txt /tmp/feux06a-add.txt | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e'
   ```

   d. Chuỗi tiếng Việt bị đổi hoặc mất (đọc; bỏ dòng chú thích để việc xoá chú thích cũ không bị tính):

   ```bash
   export LC_ALL=C
   ext() { rg -v '^(\*|//|/\*|\{/\*)' "$1" | rg -oN --no-filename "[^<>'\"\`{}]*[À-ỹ][^<>'\"\`{}]*" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | sort -u; }
   comm -23 <(ext /tmp/feux06a-del.txt) <(ext /tmp/feux06a-add.txt)
   ```

   e. Ký tự cấm còn trong tệp cuối (bỏ dòng mà nội dung bắt đầu bằng `*`, `//`, `/*`, `{/*`; trong mã test viết ký tự cấm bằng escape `\u00b7`, `\u2014`):

   ```bash
   rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e' app/src/components/pages/assets.tsx app/src/components/pages/kyc.tsx app/src/components/pages/reconciliation.tsx app/src/components/ops/ app/test/fe-ux-06a.test.ts app/e2e/fe-ux-06a-man-mau.spec.ts | rg -v '^[^:]+:[0-9]+:\s*(\*|//|/\*|\{/\*)'
   ```

7. Đo lại (cùng cách bước 2); chụp ảnh sau trên tiến trình mock mới khởi động từ bản build nhánh, cùng công thức.
8. Viết `docs/CHECKPOINT_FEUX06A.md` theo `docs/CHECKPOINT_TEMPLATE.md` (mục 0 đủ 14 điều kiện của requirements mục 4; `node scripts/check-checkpoint.mjs docs/CHECKPOINT_FEUX06A.md docs/fe-ux-06a-man-mau/requirements.md`), cập nhật `docs/USER_GUIDE.md` phần ba màn, `.kiro/task-status.json` (thay mã gộp `FE-UX-06` trong `planned`, nếu có, bằng `FE-UX-06a`, `FE-UX-06b`; FE-UX-06a `inProgress` khi chạy kiểm rồi hoàn thành; PR merge sau gộp sao cho mỗi mã ở đúng một danh sách).
9. Mở PR base `release/ui-v2`, tiêu đề `FE-UX-06a: ba màn dữ liệu mẫu (Dự án, KYC, Đối soát)`, gửi Supervisor báo cáo kèm log, đoạn log EVM riêng, số đo, ảnh, bảng khối cũ và mới, kết quả bước 6. Không tự merge.
