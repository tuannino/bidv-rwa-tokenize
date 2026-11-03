# FE-UX-01b: các bước

1. Xác nhận PR #84 (FE-UX-01a, kèm commit font cục bộ) đã merge vào `release/ui-v2` và Sếp đã duyệt QĐ-7 (`lib/brand.ts`); thiếu thì dừng và báo. Tạo nhánh `feat/fe-ux-01b-khung` từ `release/ui-v2` mới nhất.
2. Đo mốc trên `release/ui-v2` (sau #84) bằng script mốc: số action, JS gzip 4 trang, hydrate, ảnh 28 đường dẫn; lấy danh sách menu 4 vai (design mục 5).
3. `lib/brand.ts`, `providers.tsx`, `bidv-logo.tsx` (QĐ-7, QĐ-10, design mục 2).
4. `shell-state.ts`; cấu trúc khung trong `app-layout.tsx` (design mục 0).
5. Thanh bên, đầu, đáy, thu gọn (design mục 1, QĐ-3); xoá `NetworkStatus` cũ.
6. Thanh đầu (design mục 3); chuyển `ChannelSwitcher`, `ChainSelector` sang thanh bên.
7. Ngăn kéo dưới 1100 px (design mục 4, QĐ-4).
8. `custody-toggle.tsx`, `channel-guard.tsx`, 4 dòng `font-mono`, `--chart-4` Tối (QĐ-6, QĐ-8, QĐ-9).
9. Viết `app/e2e/fe-ux-01b-khung.spec.ts` (design mục 6); sửa selector e2e cũ chỉ khi bắt buộc, ghi lý do. Chạy `TEST_DATABASE_URL=... bash scripts/run-local-all.sh arch markers checkpoint contracts app build e2e evm`, lưu log.
10. Các lệnh kiểm, kết quả phải rỗng:

    a. Danh sách trắng (tệp e2e cũ đã sửa selector thêm vào `/tmp/feux01b-e2e.txt`, mỗi dòng một đường dẫn, liệt kê trong checkpoint):

    ```bash
    git diff --name-only origin/release/ui-v2...HEAD \
      | grep -vE '^(app/src/components/layout/((app-layout|sidebar|header|custody-toggle|chain-selector|channel-switcher|channel-guard|hover-hint)\.tsx|shell-state\.ts)|app/src/components/(bidv-logo|providers)\.tsx|app/src/lib/brand\.ts|app/src/app/globals\.css|app/e2e/fe-ux-01b-khung\.spec\.ts|docs/fe-ux-01b-khung/(requirements|design|tasks)\.md|docs/CHECKPOINT_FEUX01B\.md|docs/USER_GUIDE\.md|\.kiro/task-status\.json)$' \
      | grep -vxF -f /tmp/feux01b-e2e.txt
    ```

    b. Màu cứng trong khung:

    ```bash
    rg -n '\b(bg|text|border|ring|fill|stroke|from|to)-(white|black|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3})\b|#[0-9a-fA-F]{3,8}\b|rgba?\(' app/src/components/layout
    ```

    c. Ký tự cấm ở dòng thêm mới thật (bỏ qua dòng chỉ bị dời chỗ, như `option` có sẵn ở `channel-switcher.tsx`, `chain-selector.tsx`):

    ```bash
    D="git diff origin/release/ui-v2...HEAD -U0 -- app/src"
    $D | grep '^-[^-]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/del.txt
    $D | grep '^+[^+]' | cut -c2- | sed 's/^[[:space:]]*//' | sort -u > /tmp/add.txt
    comm -13 /tmp/del.txt /tmp/add.txt | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e'
    ```

11. Đo lại sau khi sửa (cùng script), so menu 4 vai, đo gzip SVG logo, chụp ảnh 28 đường dẫn (1440, 390; Sáng, Tối); kiểm thủ công ngăn kéo bằng bàn phím (Tab không vào `aside` khi đóng, không ra khỏi ngăn kéo khi mở).
12. Viết `docs/CHECKPOINT_FEUX01B.md` theo `docs/CHECKPOINT_TEMPLATE.md` (mục 0 đủ 14 điều kiện; `node scripts/check-checkpoint.mjs docs/CHECKPOINT_FEUX01B.md docs/fe-ux-01b-khung/requirements.md`), cập nhật `docs/USER_GUIDE.md` phần khung, `.kiro/task-status.json`.
13. Mở PR base `release/ui-v2`, tiêu đề `FE-UX-01b: khung giao diện`, gửi Supervisor báo cáo kèm log, zip ảnh, số đo, danh sách menu, kết quả bước 10. Không tự merge.
