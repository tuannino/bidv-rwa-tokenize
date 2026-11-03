# FE-UX-01a: các bước

1. Xác nhận đủ 5 điều kiện Cổng 0 (requirements, bảng đầu); thiếu điều kiện nào thì dừng và báo Supervisor. Tạo nhánh `feat/fe-ux-01a-nen` từ `release/ui-v2` mới nhất.
2. Token và font: `globals.css`, `layout.tsx` theo design mục 1, 2; xoá khối màu cũ.
3. Thay `font-mono`: lấy danh sách và lưu ra tệp ngoài repo:

   ```bash
   grep -rln "font-mono" app/src --include=*.tsx | grep -v "components/layout/" | grep -v "app/layout.tsx" > /tmp/feux01a-files.txt   # mốc: 37 tệp
   ```

   Thay theo QĐ-4 và design mục 4; sửa `app/e2e/fix-05-tong-quan.spec.ts:46`. Kết thúc: `grep -rn "font-mono" app/src --include=*.tsx | grep -v "components/layout/"` trả 0 dòng.
4. `providers.tsx` theo design mục 5.
5. Thành phần nền theo design mục 3.
6. Viết `app/e2e/fe-ux-01a-nen.spec.ts` theo design mục 8. Đo lại và chụp ảnh sau khi sửa theo design mục 6.3 (cùng script, cùng cách tạo dữ liệu), lưu ngoài repo, nén zip gửi kèm báo cáo.
7. Kiểm thử: `TEST_DATABASE_URL=... bash scripts/run-local-all.sh arch markers checkpoint contracts app build e2e evm` (chạy cả e2e mock và hardhat; `npx playwright test` đơn lẻ chỉ chạy project mock). Lưu log, gửi kèm. Không nới bước kiểm nào; chỉ được sửa selector ở bước 3.
8. Kiểm danh sách trắng, kết quả phải rỗng:

   ```bash
   git diff --name-only origin/release/ui-v2...HEAD \
     | grep -vE '^(app/src/app/(globals\.css|layout\.tsx)|app/src/components/providers\.tsx|app/src/components/ui/(card|badge|button|table|dialog|dropdown-menu|skeleton)\.tsx|app/e2e/fix-05-tong-quan\.spec\.ts|app/e2e/fe-ux-01a-nen\.spec\.ts|docs/fe-ux-01a-nen/(requirements|design|tasks)\.md|docs/CHECKPOINT_FEUX01A\.md|docs/USER_GUIDE\.md|\.kiro/task-status\.json)$' \
     | grep -vxF -f /tmp/feux01a-files.txt
   ```

9. Quét ký tự cấm ở dòng thêm mới của các tệp được đổi chữ (kết quả phải rỗng):

   ```bash
   git diff origin/release/ui-v2...HEAD -U0 -- app/src/app/globals.css app/src/app/layout.tsx app/src/components/providers.tsx app/src/components/ui \
     | grep '^+[^+]' | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e'
   ```

10. Viết `docs/CHECKPOINT_FEUX01A.md` theo `docs/CHECKPOINT_TEMPLATE.md` (mục 0 có đủ 14 điều kiện của requirements mục 4; kiểm bằng `node scripts/check-checkpoint.mjs docs/CHECKPOINT_FEUX01A.md docs/fe-ux-01a-nen/requirements.md`); cập nhật `docs/USER_GUIDE.md` phần giao diện (font, màu, mặc định Sáng) và `.kiro/task-status.json`.
11. Mở PR base `release/ui-v2`, tiêu đề `FE-UX-01a: nền giao diện`, gửi Supervisor báo cáo theo requirements mục 4 kèm log bước 7, zip ảnh bước 6, kết quả bước 8, 9. Không tự merge.
