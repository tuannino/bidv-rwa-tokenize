# FE-UX-02b: các bước

1. Tạo nhánh `feat/fe-ux-02b-van-hanh` từ `release/ui-v2` mới nhất (@ `27a52ad` hoặc sau).
2. Đo mốc trên `release/ui-v2` (script `tools/20261104_do_moc_measure.js` trong gói spec này, chạy ngoài repo với `JS_PAGES` như requirements mục 5): số action 28 đường dẫn, JS gzip 7 trang, CSS gzip (`.next/static/chunks/*.css`); số `role` theo design mục 3 ca 2; ảnh 1440 và 390, Sáng và Tối của 3 màn và `/approvals`, `/approvals/[id]` (chụp sau khi chạy `maker-checker.spec.ts`, `recall.spec.ts` để có dữ liệu).
3. `case-tone.ts`, `status-badge.tsx`, `data-state`/`data-tone` của `steps.tsx`, prop `loading` của `RequestTable`, kèm unit test.
4. Từng màn theo design mục 1, thứ tự: `/config`, `/recall`, `/draft`. Sau mỗi màn chạy e2e liên quan (`fe-07-price-config`, `recall`, `maker-checker` và `token-info-read`, `mint`) để bắt lỗi sớm.
5. Đối chiếu notes từng màn, lập bảng (requirements mục 4).
6. Viết `app/e2e/fe-ux-02b-van-hanh.spec.ts`, `app/test/fe-ux-02b.test.ts`. Chạy kiểm thử đúng requirements mục 5, lưu log.
7. Các lệnh kiểm, kết quả phải rỗng (trừ 7d là danh sách để đọc):

   a. Danh sách trắng:

   ```bash
   git diff --name-only origin/release/ui-v2...HEAD \
     | grep -vE '^(app/src/components/pages/(draft|price-config|recall)\.tsx|app/src/components/maker-checker/(request-check-block|request-table|status-badge|token-info-block)\.tsx|app/src/components/recall/((cases-table|controls|dialogs|round-info|steps)\.tsx|case-tone\.ts)|app/e2e/fe-ux-02b-van-hanh\.spec\.ts|app/test/fe-ux-02b\.test\.ts|docs/fe-ux-02b-van-hanh/(requirements|design|tasks)\.md|docs/CHECKPOINT_FEUX02B\.md|docs/USER_GUIDE\.md|\.kiro/task-status\.json)$'
   ```

   b. Màu cứng trong phạm vi:

   ```bash
   rg -n '\b(bg|text|border|ring|fill|stroke|from|to|via)-(white|black|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3})\b|#[0-9a-fA-F]{3,8}\b|rgba?\(' \
     app/src/components/pages/{draft,price-config,recall}.tsx \
     app/src/components/maker-checker/{request-check-block,request-table,status-badge,token-info-block}.tsx \
     app/src/components/recall/{cases-table,controls,dialogs,round-info,steps}.tsx app/src/components/recall/case-tone.ts
   ```

   c. Ký tự cấm ở dòng thêm mới thật:

   ```bash
   D="git diff origin/release/ui-v2...HEAD -U0 -- app/src"
   $D | grep '^-[^-]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/del.txt
   $D | grep '^+[^+]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/add.txt
   comm -13 /tmp/del.txt /tmp/add.txt | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e'
   ```

   d. Chuỗi tiếng Việt bị đổi hoặc mất (đọc; chỉ được là các chỗ QĐ-7, hoặc chữ chỉ dời giữa phần tử và prop, giải thích trong checkpoint). Cần GNU grep có `-P`:

   ```bash
   ext() { grep -oP "[^<>'\"\`{}]*[À-ỹ][^<>'\"\`{}]*" "$1" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | sort -u; }
   comm -23 <(ext /tmp/del.txt) <(ext /tmp/add.txt)
   ```

8. Đo lại (cùng cách bước 2); chụp ảnh sau.
9. Viết `docs/CHECKPOINT_FEUX02B.md` theo `docs/CHECKPOINT_TEMPLATE.md` (mục 0 đủ 15 điều kiện; `node scripts/check-checkpoint.mjs docs/CHECKPOINT_FEUX02B.md docs/fe-ux-02b-van-hanh/requirements.md`), cập nhật `docs/USER_GUIDE.md` phần 3 màn, `.kiro/task-status.json`.
10. Mở PR base `release/ui-v2`, tiêu đề `FE-UX-02b: 3 màn Vận hành (Lập lệnh, Giá và phát hành, Thu hồi)`, gửi Supervisor báo cáo kèm log, số đo, ảnh, bảng đối chiếu notes, kết quả bước 7. Không tự merge.
