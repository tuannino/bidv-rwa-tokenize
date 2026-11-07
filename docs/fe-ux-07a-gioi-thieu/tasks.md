# FE-UX-07a: các bước

1. Tạo nhánh `feat/fe-ux-07a-gioi-thieu` từ `release/ui-v2` mới nhất. Nếu PR khác merge trong lúc làm: rebase lên head mới, làm lại bước 2 từ merge-base mới và chạy lại toàn bộ kiểm thử requirements mục 5 trên nhánh đã rebase (requirements, dòng Nhánh).
2. Đo mốc (script `tools/20261104_do_moc_measure.js`, chạy ngoài repo, trên tiến trình mock KHÁC tiến trình chụp ảnh, mới khởi động với đủ `webServer.env`). Chuẩn bị dữ liệu TRƯỚC khi chạy script, cùng công thức cho bản mốc và bản nhánh: `E2E_BASE_URL=http://localhost:<cổng> npx playwright test e2e/ops-transactions.spec.ts`; rồi xác nhận `metrics.json` không có dòng `khong tim thay lien ket` cho `DYN:/transactions`, `DYN:/approvals`, `DYN:/orders`; thiếu thì dừng và báo, không đo tiếp. Số đo: số action 28 đường dẫn, JS gzip từ `metrics.json`, JS các trang có khung theo byte so bản build mốc riêng, CSS gzip theo cách 01c; `hydration`, `consoleErrors`, `pageErrors` từ `metrics.json` (đường dẫn động thiếu liên kết thì chạy lại, hai lần đo phải cùng đủ dòng). Ảnh trước: thanh bên Nhà đầu tư `/portfolio` 1440 px mở rộng và thu gọn, Sáng và Tối. HTML mốc của `BidvLogo` `full`, `icon` cho unit nhóm 4.
3. Commit riêng: `intro-link.tsx` và dòng chèn ở `sidebar.tsx` theo QĐ-9, sửa `investor-channel.spec.ts:206` từ 7 thành 8 (trang `/gioi-thieu` chưa có thì liên kết tạm trả 404, chấp nhận trong commit này); phần `sidebar.tsx` của unit nhóm 1; chạy `fe-ux-01b-khung`, `fix-08-thanh-ben`, `uiux-02-dau-man`, `investor-channel` (e2e), `hf-01-hieu-nang`, `fix-08` (unit).
4. Commit riêng: nhóm `(public)`, sửa `four-roles-routes.test.ts` (QĐ-1, QĐ-2), chép ảnh 3D (QĐ-14), `--lp-deep` (QĐ-6), `BidvLogo` `inline` (QĐ-7); unit nhóm 4, 5.
5. Trang theo design mục 1, 2 và QĐ-3 đến QĐ-5, QĐ-8, QĐ-10, QĐ-12, QĐ-13; viết phần còn lại của unit nhóm 1, nhóm 2, 3 và e2e ca 1 đến ca 5; chạy `fe-ux-07a-gioi-thieu`, `four-roles-routes`, `four-roles-shell`, `hf-01-hieu-nang`, unit mới.
6. Các lệnh kiểm (chạy được trên macOS và Linux, bash và zsh; tệp tạm tên riêng để không đè tệp của nhánh khác). Kỳ vọng: 6a, 6b, 6c, 6e rỗng; 6d rỗng, hoặc chỉ in mảnh chữ của chú thích, tên test cũ trong `four-roles-routes.test.ts` mà QĐ-2 buộc sửa (checkpoint giải thích từng dòng, dòng khác là lỗi).

   a. Danh sách trắng:

   ```bash
   git diff --name-only --diff-filter=d origin/release/ui-v2...HEAD \
     | grep -vE '^(app/src/app/\(public\)/(layout|gioi-thieu/page)\.tsx|app/src/components/landing/(landing-page|landing-chrome|hero-video|turbine-scene|enter-channel-form)\.tsx|app/src/components/landing/landing-data\.ts|app/src/components/landing/landing\.module\.css|app/public/landing/3d/[a-z]+\.webp|app/public/landing/3d/LICENSE\.txt|app/src/components/bidv-logo\.tsx|app/src/components/layout/(intro-link|sidebar)\.tsx|app/src/app/globals\.css|app/test/four-roles-routes\.test\.ts|app/e2e/fe-ux-07a-gioi-thieu\.spec\.ts|app/test/fe-ux-07a\.test\.ts|app/e2e/investor-channel\.spec\.ts|docs/fe-ux-07a-gioi-thieu/(requirements|design|tasks)\.md|docs/CHECKPOINT_FEUX07A(_DETAIL)?\.md|docs/USER_GUIDE\.md|docs/tech-report\.md|\.kiro/task-status\.json)$'
   git diff --name-only --diff-filter=D origin/release/ui-v2...HEAD
   git diff origin/release/ui-v2...HEAD --numstat -- app/src/components/layout/sidebar.tsx app/src/app/globals.css app/e2e/investor-channel.spec.ts
   ```

   Dòng thứ ba: `sidebar.tsx` 0 dòng xoá, tối đa 2 dòng thêm (import và dòng chèn); `globals.css` 0 dòng xoá (chỉ token và chú thích); `investor-channel.spec.ts` tối đa 3 dòng đổi, trong `:203-206`.

   b. Màu cứng và `*-destructive`:

   ```bash
   rg -n '\b(bg|text|border|ring|fill|stroke|from|to|via)-(white|black|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3})\b|#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(|-destructive\b' \
     'app/src/app/(public)/' app/src/components/landing/ app/src/components/layout/intro-link.tsx
   ```

   c. Ký tự cấm ở dòng thêm mới (chạy cùng `LC_ALL=C` với 6d để `sort`, `comm` nhất quán theo byte; `D` là hàm, không phải biến):

   ```bash
   export LC_ALL=C
   D() { git diff origin/release/ui-v2...HEAD -U0 -- app/src app/test/fe-ux-07a.test.ts app/test/four-roles-routes.test.ts app/e2e/fe-ux-07a-gioi-thieu.spec.ts; }
   D | grep '^-[^-]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/feux07a-del.txt
   D | grep '^+[^+]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/feux07a-add.txt
   comm -13 /tmp/feux07a-del.txt /tmp/feux07a-add.txt | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e'
   ```

   d. Chuỗi tiếng Việt bị đổi hoặc mất (đọc; bỏ dòng chú thích để việc sửa chú thích không bị tính):

   ```bash
   export LC_ALL=C
   ext() { rg -v '^(\*|//|/\*|\{/\*)' "$1" | rg -oN --no-filename "[^<>'\"\`{}]*[À-ỹ][^<>'\"\`{}]*" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | sort -u; }
   comm -23 <(ext /tmp/feux07a-del.txt) <(ext /tmp/feux07a-add.txt)
   ```

   e. Ký tự cấm còn trong tệp cuối (bỏ dòng mà nội dung bắt đầu bằng `*`, `//`, `/*`, `{/*`; trong mã test viết ký tự cấm bằng escape `\u00b7`, `\u2014`):

   ```bash
   rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e' 'app/src/app/(public)/' app/src/components/landing/ app/src/components/bidv-logo.tsx app/src/components/layout/intro-link.tsx app/test/fe-ux-07a.test.ts app/e2e/fe-ux-07a-gioi-thieu.spec.ts | rg -v '^[^:]+:[0-9]+:\s*(\*|//|/\*|\{/\*)'
   ```

7. Đo lại (cùng cách bước 2); chụp ảnh sau trên tiến trình mock mới khởi động từ bản build nhánh, cùng công thức: thanh bên như bước 2 (có liên kết mới); `/gioi-thieu` cả trang (`fullPage: true`) 1440, 1100, 390 px Sáng và Tối, ngữ cảnh `reducedMotion: 'reduce'` để ảnh ổn định (video là ảnh nền có nút phát); thêm hai ảnh nút về đầu trang đang hiện (cuộn tới khối "Ba dự án điện gió"): 1440 px (nút trong lề phải) và 390 px (nút đè mép nội dung, thấy chữ dưới nút).
8. Viết `docs/CHECKPOINT_FEUX07A.md` theo `docs/CHECKPOINT_TEMPLATE.md` (mục 0 đủ 14 điều kiện của requirements mục 4; `node scripts/check-checkpoint.mjs docs/CHECKPOINT_FEUX07A.md docs/fe-ux-07a-gioi-thieu/requirements.md`), cập nhật `docs/USER_GUIDE.md` (mục mới "Trang giới thiệu" gồm đường dẫn, các nút vào khu vực, nút về đầu trang, liên kết trên thanh bên Nhà đầu tư), `.kiro/task-status.json` (thay mã `FE-UX-07` trong `planned` bằng `FE-UX-07a`, `FE-UX-07b`; FE-UX-07a sang `inProgress` khi chạy kiểm rồi hoàn thành; PR merge sau gộp sao cho mỗi mã ở đúng một danh sách).
9. Mở PR base `release/ui-v2`, tiêu đề `FE-UX-07a: Trang giới thiệu công khai, nút về đầu trang, lối vào từ thanh bên`, gửi Supervisor báo cáo kèm log, đoạn log EVM riêng, số đo (gồm hai số JS của e2e ca 5), ảnh, bảng khối bản chốt và phần dựng, kết quả bước 6. Không tự merge.
