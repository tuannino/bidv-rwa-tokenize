# BE-16 — các bước

## Bước 0: Trạng thái
- [ ] Thêm mã BE-16, chuyển sang đang làm.
- Chạy: `node scripts/scan-pending.mjs --check`

## Bước 1: Tầng cổng chuỗi
- [ ] Việc 1, 2. Hiện thực ba bản trong cùng một commit.
- Chạy: `npx vitest run test/mock-ledger.test.ts`

## Bước 2: Nghiệp vụ và hai lớp chặn
- [ ] Việc 3 đến 7. Ca 1, 2, 5, 6 và đột biến bỏ lớp kiểm cờ.
- Chạy: `npx vitest run test/demo-payment.test.ts`

## Bước 3: Quyền
- [ ] Việc 8, 9. Ca 3, 4 và đột biến trả lại quyền cho Người bán.
- Chạy: `npx vitest run test/rbac.test.ts`

## Bước 4: Màn hình
- [ ] Việc 10 đến 13. Ca 7.
- Chạy: `npx vitest run`

## Bước 5: Thử luồng mua đầu cuối
- [ ] Ca 8: bật cờ, nạp VNDB cho nhà đầu tư mẫu, đặt lệnh mua, khớp lệnh, kiểm số dư.
- [ ] Ghi kết quả vào báo cáo bàn giao, gồm các bước đã bấm.
- Chạy: `npx vitest run`

## Bước 6: Hoàn tất
- [ ] Cập nhật báo cáo công nghệ, xoá nợ về đường nạp VNDB, chuyển BE-16 sang xong, viết báo cáo bàn giao.
- Chạy: `bash scripts/run-local-all.sh` một lần.
