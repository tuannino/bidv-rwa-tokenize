# FE-20 — các bước

## Bước 0: Trạng thái

- [ ] Thêm mã FE-20 vào danh sách nếu chưa có, chuyển sang đang làm.
- Chạy: `node scripts/scan-pending.mjs --check`

## Bước 1: Bốn vai trò và quyền tối thiểu

- [ ] Việc 1 và 2. Sửa các tệp kiểm thử nhắc vai trò cũ.
- [ ] Ca 1.
- Chạy: `npx vitest run test/rbac.test.ts`

## Bước 2: Bộ chọn vai trò và menu

- [ ] Việc 3, 4, 5. Bốn nhóm menu theo bảng trong `requirements.md`.
- [ ] Ca 6.
- Chạy: `npx vitest run`

## Bước 3: Khu vực và trang chỗ trống

- [ ] Việc 6, 7, 8, 9. Ca 2, 3, 4, 5, 7.
- Chạy: `npx vitest run` và mở thử bằng tay từng vai trò.

## Bước 4: Số việc chờ và điểm cắm

- [ ] Việc 10 và 11.
- Chạy: `node scripts/scan-pending.mjs --check`

## Bước 5: Hoàn tất

- [ ] Cập nhật báo cáo công nghệ: bảng vai trò, cây thư mục, ma trận quyền. Chuyển FE-20 sang xong, viết báo cáo bàn giao.
- Chạy: `bash scripts/run-local-all.sh` một lần.
