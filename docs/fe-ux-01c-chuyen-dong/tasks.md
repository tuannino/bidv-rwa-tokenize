# FE-UX-01c: các bước

1. Xác nhận PR #85 (FE-UX-01b) đã merge vào `release/ui-v2`; chưa thì dừng và báo. Tạo nhánh `feat/fe-ux-01c-chuyen-dong` từ `release/ui-v2` mới nhất.
2. Đo mốc trên `release/ui-v2` (sau #85): số action 28 đường dẫn, JS gzip 4 trang, tổng CSS gzip (`.next/static/chunks/*.css`, Turbopack xuất CSS ở đây); CPU đứng yên bằng `tools/20261104_do_cpu_dung_yen.js` ở `/` (teller) và `/portfolio` (investor) theo requirements mục 5. Hai script ở thư mục `tools/` của gói spec, để ngoài repo.
3. Kiểm QĐ-4 sau khi làm bước 4, 5: chạy ca 2 (design mục 4) cho `/` sang `/draft`, `/draft` sang `/transactions`, và thử tay `/portfolio` sang `/trade` (vai investor). Cặp nào không có đúng một sự kiện `rise` mới thì thêm `key={pathname}` trong `ShellMain`. Ghi kết quả từng cặp vào checkpoint.
4. `globals.css` (design mục 1); `background-fx.tsx`, gắn vào `app/src/app/layout.tsx`, bỏ `bg-background` ở gốc khung `AppLayout` (design mục 2).
5. Khung và `Button` (design mục 3).
6. Viết `app/e2e/fe-ux-01c-chuyen-dong.spec.ts` (design mục 4). Chạy kiểm thử đúng requirements mục 5 (dev), lưu log.
7. Các lệnh kiểm, kết quả phải rỗng:

   a. Danh sách trắng:

   ```bash
   git diff --name-only origin/release/ui-v2...HEAD \
     | grep -vE '^(app/src/app/globals\.css|app/src/components/motion/background-fx\.tsx|app/src/components/layout/(app-layout|header|sidebar)\.tsx|app/src/app/layout\.tsx|app/src/components/ui/button\.tsx|app/e2e/fe-ux-01c-chuyen-dong\.spec\.ts|docs/fe-ux-01c-chuyen-dong/(requirements|design|tasks)\.md|docs/CHECKPOINT_FEUX01C\.md|docs/USER_GUIDE\.md|\.kiro/task-status\.json)$'
   ```

   b. Màu cứng trong khung và nền:

   ```bash
   rg -n '\b(bg|text|border|ring|fill|stroke|from|to|via)-(white|black|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3})\b|#[0-9a-fA-F]{3,8}\b|rgba?\(' app/src/components/layout app/src/components/motion
   ```

   c. Ký tự cấm ở dòng thêm mới thật:

   ```bash
   D="git diff origin/release/ui-v2...HEAD -U0 -- app/src"
   $D | grep '^-[^-]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/del.txt
   $D | grep '^+[^+]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/add.txt
   comm -13 /tmp/del.txt /tmp/add.txt | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e'
   ```

   d. Diff `sidebar.tsx`, `header.tsx` chỉ là lớp, thuộc tính, phần tử bọc (Supervisor đọc; dev liệt kê từng đoạn đổi trong checkpoint).

8. Đo lại (cùng cách bước 2, gồm CPU); quay màn hình hoặc ảnh động ngắn (Sáng, Tối) của nền trôi, vào trang, rê nút chính.
9. Viết `docs/CHECKPOINT_FEUX01C.md` theo `docs/CHECKPOINT_TEMPLATE.md` (mục 0 đủ 12 điều kiện; `node scripts/check-checkpoint.mjs docs/CHECKPOINT_FEUX01C.md docs/fe-ux-01c-chuyen-dong/requirements.md`), cập nhật `docs/USER_GUIDE.md` (một đoạn: chuyển động, cách tắt bằng thiết lập giảm chuyển động của hệ điều hành), `.kiro/task-status.json`.
10. Mở PR base `release/ui-v2`, tiêu đề `FE-UX-01c: chuyển động nhẹ và nền trôi`, gửi Supervisor báo cáo kèm 3 log e2e mock, log run-local-all, số đo, ảnh động, kết quả bước 7. Không tự merge.
