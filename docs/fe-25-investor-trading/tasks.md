# FE-25 — các bước

## Bước 0: Trạng thái
- [ ] Thêm mã FE-25 nếu chưa có, chuyển sang đang làm. Kiểm `dev` đã có BE-14.
- Chạy: `node scripts/scan-pending.mjs --check`

## Bước 1: Màn Giao dịch token
- [ ] Việc 1 đến 8. Ca 1, 2, 3, 4.
- Chạy: `npx vitest run`

## Bước 2: Màn Quản lý lệnh và chi tiết
- [ ] Việc 9 đến 12. Ca 5, 6.
- Chạy: `npx vitest run`

## Bước 3: Guard và hiển thị
- [ ] Việc 13, 14. Ca 7, 8.
- Chạy: `npx vitest run`

## Bước 4: Hoàn tất
- [ ] Cập nhật báo cáo công nghệ, chuyển FE-25 sang xong, viết báo cáo bàn giao.
- [ ] Nếu nhánh khác đã merge trước: rebase lên `dev`, giải ba tệp dùng chung, **sinh lại** sơ đồ luồng thay vì sửa tay.
- Chạy: `bash scripts/run-local-all.sh` một lần.
