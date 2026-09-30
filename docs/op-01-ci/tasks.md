# OP-01 — các bước

## Bước 0: Trạng thái

- [ ] Chuyển OP-01 sang đang làm trong `.kiro/task-status.json`. Thêm mã này vào danh sách nếu chưa có.
- Chạy: `node scripts/scan-pending.mjs --check`

## Bước 1: Tạm dừng phần Stellar trong khâu kiểm chứng

- [ ] Việc 1 đến 5. Ca 1, 2, 3.
- [ ] Đối chiếu bảng giữ nguyên và gỡ ở `requirements.md` trước khi sửa, không gỡ nhầm sang mã nguồn.
- Chạy: `bash scripts/run-local-all.sh` và `cd app && npx vitest run`

## Bước 2: Tách phần gọi riêng của run-local-all

- [ ] Việc 8. Giữ nguyên hành vi khi chạy không tham số.
- Chạy: `bash scripts/run-local-all.sh`

## Bước 3: Phép kiểm quyền và đường dẫn đọc phiên bản

- [ ] Việc 10 và 11. Ca 4 và ca 5.
- Chạy: `bash scripts/verify-arch-rules.sh` và `cd app && npx vitest run`

## Bước 4: Kiểm khói

- [ ] Việc 12. Ca 6.
- Chạy: `node scripts/smoke-test.mjs http://localhost:3000`

## Bước 5: Quy trình tự động

- [ ] Việc 6, 7, 9, 13. Đẩy lên và mở một yêu cầu hợp nhất thử để lấy kết quả ca 7.
- [ ] Ghi thời gian chạy của từng việc vào báo cáo bàn giao.

## Bước 6: Hoàn tất

- [ ] Việc 14. Cập nhật `docs/tech-report.md`, chuyển OP-01 sang xong, viết báo cáo bàn giao.
- Chạy: `bash scripts/run-local-all.sh` một lần.
