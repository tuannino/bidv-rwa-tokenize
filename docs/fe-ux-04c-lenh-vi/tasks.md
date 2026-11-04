# FE-UX-04c: các bước

1. Tạo nhánh `feat/fe-ux-04c-lenh-vi` từ `release/ui-v2` mới nhất (@ `e914807` hoặc sau). Nếu PR khác merge trong lúc làm: rebase lên head mới, làm lại bước 2 từ merge-base mới và chạy lại toàn bộ kiểm thử requirements mục 5 trên nhánh đã rebase (requirements, dòng Nhánh).
2. Đo mốc (script `tools/20261104_do_moc_measure.js`, chạy ngoài repo, trên tiến trình mock KHÁC tiến trình chụp ảnh, mới khởi động với đủ `webServer.env`; TRƯỚC khi đo chạy `E2E_BASE_URL=… npx playwright test e2e/ops-transactions.spec.ts` lên tiến trình đó để `/orders` có lệnh và `DYN:/orders` tìm được liên kết; làm giống hệt ở bước 7): số action 28 đường dẫn, JS gzip từ `metrics.json`, JS bốn trang (`/orders`, `/orders/[id]`, `/wallet`, `/trade`) theo byte so bản build mốc riêng, CSS gzip theo cách 01c; `hydration`, `consoleErrors`, `pageErrors` từ `metrics.json` (đường dẫn động thiếu liên kết thì chạy lại, hai lần đo phải cùng đủ dòng); số `role` theo design mục 3 ca 1, ca 2 (máy chủ mới); số lời gọi action và `useEffect` theo QĐ-2; ảnh trước theo requirements mục 4.
3. Màn `/orders`, `/orders/[id]` theo QĐ-3, QĐ-4; chạy `investor-channel`, `ops-transactions`, `uiux-02-dau-man`.
4. Màn `/wallet` và `components/wallet/*` theo QĐ-5 đến QĐ-7; chạy `wallet-connect`.
5. Viết `app/test/fe-ux-04c.test.ts` (5 nhóm) và `app/e2e/fe-ux-04c-lenh-vi.spec.ts` (5 ca). Đối chiếu notes, lập bảng. Chạy kiểm thử đúng requirements mục 5, lưu log.
6. Các lệnh kiểm (chạy được trên macOS và Linux, bash và zsh). Kỳ vọng: 6a, 6b, 6c, 6e rỗng; 6d chỉ in mảnh chữ cũ của đúng các vị trí ở QĐ-7 (`wallet-connect.tsx:87`, `:143`, `:196`, `:197`, `:198`, `:203`, `:246`, `wallet-status-card.tsx:98`) hoặc mảnh do xuống dòng khác chỗ (ghép lại đúng câu cũ); checkpoint giải thích từng dòng, dòng khác là lỗi.

   a. Danh sách trắng:

   ```bash
   git diff --name-only --diff-filter=d origin/release/ui-v2...HEAD \
     | grep -vE '^(app/src/components/pages/(investor-orders|investor-order-detail|wallet-connect)\.tsx|app/src/components/wallet/(wallet-status-card|no-wallet-guide|wrong-chain-banner)\.tsx|app/e2e/fe-ux-04c-lenh-vi\.spec\.ts|app/test/fe-ux-04c\.test\.ts|docs/fe-ux-04c-lenh-vi/(requirements|design|tasks)\.md|docs/CHECKPOINT_FEUX04C(_DETAIL)?\.md|docs/USER_GUIDE\.md|docs/tech-report\.md|\.kiro/task-status\.json)$'
   git diff --name-only --diff-filter=D origin/release/ui-v2...HEAD
   ```

   b. Màu cứng và `*-destructive`:

   ```bash
   rg -n '\b(bg|text|border|ring|fill|stroke|from|to|via)-(white|black|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3})\b|#[0-9a-fA-F]{3,8}\b|rgba?\(|-destructive\b' \
     app/src/components/pages/investor-orders.tsx app/src/components/pages/investor-order-detail.tsx app/src/components/pages/wallet-connect.tsx app/src/components/wallet/
   ```

   c. Ký tự cấm ở dòng thêm mới (chạy cùng `LC_ALL=C` với 6d để `sort`, `comm` nhất quán theo byte; `D` là hàm, không phải biến):

   ```bash
   export LC_ALL=C
   D() { git diff origin/release/ui-v2...HEAD -U0 -- app/src app/test/fe-ux-04c.test.ts app/e2e/fe-ux-04c-lenh-vi.spec.ts; }
   D | grep '^-[^-]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/feux04c-del.txt
   D | grep '^+[^+]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/feux04c-add.txt
   comm -13 /tmp/feux04c-del.txt /tmp/feux04c-add.txt | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e'
   ```

   d. Chuỗi tiếng Việt bị đổi hoặc mất (đọc):

   ```bash
   export LC_ALL=C
   ext() { rg -oN --no-filename "[^<>'\"\`{}]*[À-ỹ][^<>'\"\`{}]*" "$1" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | sort -u; }
   comm -23 <(ext /tmp/feux04c-del.txt) <(ext /tmp/feux04c-add.txt)
   ```

   e. Ký tự cấm còn trong tệp cuối (bỏ dòng chú thích bắt đầu bằng `*`, `//`, `/*`, `{/*`; chú thích nhiều dòng trong JSX không bắt đầu bằng các dấu này nên phải sửa chữ, QĐ-7):

   ```bash
   rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e' app/src/components/pages/investor-orders.tsx app/src/components/pages/investor-order-detail.tsx app/src/components/pages/wallet-connect.tsx app/src/components/wallet/ app/test/fe-ux-04c.test.ts app/e2e/fe-ux-04c-lenh-vi.spec.ts | rg -v '^[^:]+:[0-9]+:\s*(\*|//|/\*|\{/\*)'
   ```

7. Đo lại (cùng cách bước 2); chụp ảnh sau trên tiến trình mock mới khởi động từ bản build nhánh, cùng công thức. Ảnh trạng thái khó tạo theo requirements mục 4.
8. Viết `docs/CHECKPOINT_FEUX04C.md` theo `docs/CHECKPOINT_TEMPLATE.md` (mục 0 đủ 14 điều kiện của requirements mục 4; `node scripts/check-checkpoint.mjs docs/CHECKPOINT_FEUX04C.md docs/fe-ux-04c-lenh-vi/requirements.md`), cập nhật `docs/USER_GUIDE.md` phần ba màn, `.kiro/task-status.json` (FE-UX-04c `inProgress` khi chạy kiểm rồi hoàn thành; FE-UX-04d vào `planned` nếu chưa có; PR merge sau gộp sao cho mỗi mã ở đúng một danh sách).
9. Mở PR base `release/ui-v2`, tiêu đề `FE-UX-04c: Quản lý lệnh, Chi tiết lệnh, Ví của tôi`, gửi Supervisor báo cáo kèm log, đoạn log EVM riêng, số đo, ảnh, bảng đối chiếu notes, kết quả bước 6. Không tự merge.
