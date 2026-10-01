# FE-22 — các bước

## Bước 0: Trạng thái
- [ ] Chuyển FE-22 sang đang làm. Kiểm `dev` đã có BE-12.
- Chạy: `node scripts/scan-pending.mjs --check`

## Bước 1: Thành phần dùng chung
- [ ] Khối thông tin token và khối kiểm tra trước khi lập, dùng cho cả hai thẻ.
- Chạy: `npx vitest run`

## Bước 2: Màn Lập lệnh
- [ ] Việc 1 đến 7. Ca 1, 2, 3, 4.
- Chạy: `npx vitest run`

## Bước 3: Màn Phê duyệt lệnh
- [ ] Việc 8 đến 13. Ca 5, 6, 8.
- Chạy: `npx vitest run`

## Bước 4: Đóng đường đi vòng
- [ ] Việc 14 đến 17. Ca 9, 10 và hai đột biến.
- [ ] Ghi vào báo cáo bàn giao: chọn chuyển hay gỡ màn tạo token cũ, và vì sao.
- Chạy: `npx vitest run test/rbac.test.ts` rồi `npx vitest run`

## Bước 5: Số việc chờ và hoàn tất
- [ ] Việc 18, 19. Ca 7. Gỡ điểm cắm của FE-20.
- [ ] Cập nhật báo cáo công nghệ, chuyển FE-22 sang xong, viết báo cáo bàn giao.
- Chạy: `bash scripts/run-local-all.sh` một lần.
