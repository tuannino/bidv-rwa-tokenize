# FE-06 — các bước

## Bước 0: Trạng thái
- [ ] Chuyển FE-06 sang đang làm. Kiểm `dev` đã có BE-16.
- Chạy: `node scripts/scan-pending.mjs --check`

## Bước 1: Bảng và bộ lọc
- [ ] Việc 1 đến 4. Ca 1, 2.
- Chạy: `npx vitest run`

## Bước 2: Khớp lệnh và phân quyền
- [ ] Việc 5, 6, 7. Ca 3, 4, 5.
- Chạy: `npx vitest run`

## Bước 3: Kiểm thử đầu cuối
- [ ] Rà và sửa các ca còn bám nội dung trang chỗ trống. Ca 6.
- Chạy: `npx vitest run` và chạy kiểm thử đầu cuối nếu môi trường cho phép

## Bước 4: Hoàn tất
- [ ] Cập nhật báo cáo công nghệ, chuyển FE-06 sang xong, viết báo cáo bàn giao.
- Chạy: `bash scripts/run-local-all.sh` một lần.
