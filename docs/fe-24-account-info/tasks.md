# FE-24 — các bước

## Bước 0: Trạng thái
- [ ] Chuyển FE-24 sang đang làm.
- Chạy: `node scripts/scan-pending.mjs --check`

## Bước 1: Ba chỉ tiêu token
- [ ] Việc 6 đến 9. Ca 3, 4.
- Chạy: `npx vitest run test/config-service.test.ts` rồi `npx vitest run`

## Bước 2: Hồ sơ định danh và rủi ro
- [ ] Việc 10, 11.
- Chạy: `npx vitest run`

## Bước 3: Màn thông tin tài khoản
- [ ] Việc 1 đến 5. Ca 1, 2, 5.
- Chạy: `npx vitest run`

## Bước 4: Kiểm thử đầu cuối và dọn
- [ ] Ca 6. Xác nhận không còn trang chỗ trống nào.
- Chạy: `npx vitest run`

## Bước 5: Hoàn tất
- [ ] Cập nhật báo cáo công nghệ, chuyển FE-24 sang xong, viết báo cáo bàn giao.
- Chạy: `bash scripts/run-local-all.sh` một lần.
