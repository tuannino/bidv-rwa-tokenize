# FE-UX-02a: các bước

1. Tạo nhánh `feat/fe-ux-02a-van-hanh` từ `release/ui-v2` mới nhất (@ `2065289` hoặc sau).
2. Đo mốc trên `release/ui-v2` (script `tools/20261103_do_moc_measure.js` trong gói spec FE-UX-01c, chạy ngoài repo): số action 28 đường dẫn, JS gzip 4 trang (`20261103_do_moc_measure.js`), CSS gzip (`.next/static/chunks/*.css`); số `role` status, note, alert khi vừa tải ở 4 màn (design mục 4 ca 3); ảnh 1440 và 390, Sáng và Tối của 5 màn và `/orders/[id]`.
3. Token (design mục 1); bảng tương phản.
4. Thành phần dùng chung (requirements QĐ-3, design mục 2) và `orderStatusTone` kèm unit test.
5. Từng màn theo design mục 3, thứ tự: `wallet-binding`, `demo-payment` và 2 trang chặn, `/transactions`, chi tiết lệnh, `/`. Sau mỗi màn chạy nhanh e2e liên quan (QĐ-7) để bắt lỗi sớm.
6. Đối chiếu notes từng màn, lập bảng Giữ, Đã cũ, Bỏ (requirements mục 4).
7. Viết `app/e2e/fe-ux-02a-van-hanh.spec.ts`, `app/test/fe-ux-02a.test.ts`; sửa `fix-05-tong-quan.spec.ts:45` (chỉ selector). Chạy kiểm thử đúng requirements mục 5, lưu log.
8. Các lệnh kiểm, kết quả phải rỗng (trừ 8d là danh sách để đọc):

   a. Danh sách trắng:

   ```bash
   git diff --name-only origin/release/ui-v2...HEAD \
     | grep -vE '^(app/src/app/globals\.css|app/src/components/ui/(card|badge|kpi|alert|empty-state|blocked-notice)\.tsx|app/src/components/ui/field\.ts|app/src/components/trading/(order-status-tone\.ts|order-detail-content\.tsx|settlement-progress\.tsx)|app/src/components/pages/(dashboard|ops-transactions|ops-order-detail|demo-payment|wallet-binding)\.tsx|app/src/app/\(ops\)/(demo-payment|wallet-binding)/page\.tsx|app/e2e/(fe-ux-02a-van-hanh|fix-05-tong-quan)\.spec\.ts|app/test/fe-ux-02a\.test\.ts|docs/fe-ux-02a-van-hanh/(requirements|design|tasks)\.md|docs/CHECKPOINT_FEUX02A\.md|docs/USER_GUIDE\.md|\.kiro/task-status\.json)$'
   ```

   b. Màu cứng ngoài `globals.css`:

   ```bash
   rg -n '\b(bg|text|border|ring|fill|stroke|from|to|via)-(white|black|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3})\b|#[0-9a-fA-F]{3,8}\b|rgba?\(' \
     app/src/components/ui/{card,badge,kpi,alert,empty-state,blocked-notice}.tsx app/src/components/ui/field.ts \
     app/src/components/pages/{dashboard,ops-transactions,ops-order-detail,demo-payment,wallet-binding}.tsx \
     app/src/components/trading/{order-detail-content,settlement-progress}.tsx
   ```

   Ngoại lệ được phép: màu trong cấu hình recharts nếu recharts không nhận `var(--...)` ở chỗ đó; liệt kê trong checkpoint.

   c. Ký tự cấm ở dòng thêm mới thật:

   ```bash
   D="git diff origin/release/ui-v2...HEAD -U0 -- app/src"
   $D | grep '^-[^-]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/del.txt
   $D | grep '^+[^+]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/add.txt
   comm -13 /tmp/del.txt /tmp/add.txt | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e'
   ```

   d. Chuỗi tiếng Việt bị đổi hoặc mất (đọc; chỉ được là các chỗ QĐ-8, hoặc chữ chỉ bị dời giữa phần tử và prop, giải thích trong checkpoint). Cần GNU grep có `-P`:

   ```bash
   ext() { grep -oP "[^<>'\"\`{}]*[À-ỹ][^<>'\"\`{}]*" "$1" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | sort -u; }
   comm -23 <(ext /tmp/del.txt) <(ext /tmp/add.txt)
   ```

9. Đo lại (cùng cách bước 2); chụp ảnh sau.
10. Viết `docs/CHECKPOINT_FEUX02A.md` theo `docs/CHECKPOINT_TEMPLATE.md` (mục 0 đủ 14 điều kiện; `node scripts/check-checkpoint.mjs docs/CHECKPOINT_FEUX02A.md docs/fe-ux-02a-van-hanh/requirements.md`), cập nhật `docs/USER_GUIDE.md` phần 5 màn, `.kiro/task-status.json` (thêm FE-UX-02a, 02b; bỏ FE-UX-02 nếu có).
11. Mở PR base `release/ui-v2`, tiêu đề `FE-UX-02a: thành phần màn dùng chung và 5 màn Vận hành`, gửi Supervisor báo cáo kèm log, số đo, ảnh, bảng đối chiếu notes, kết quả bước 8. Không tự merge.
