# BE-14 — các bước

## Bước 0: Trạng thái
- [ ] Thêm mã BE-14 vào danh sách nếu chưa có, chuyển sang đang làm.
- Chạy: `node scripts/scan-pending.mjs --check`

## Bước 1: Dữ liệu
- [ ] Việc 1, 2. Sinh lại tệp khởi tạo bằng công cụ. Lệnh cũ coi là mua.
- Chạy: `npx vitest run test/store-constraints.test.ts`

## Bước 2: Nghiệp vụ bán
- [ ] Việc 3 đến 7. Ca 1, 2, 3, 4 và đột biến khớp lệnh thất bại.
- Chạy: `npx vitest run test/purchase-service.test.ts test/mock-ledger.test.ts`

## Bước 3: Năm bước quyết toán
- [ ] Việc 8, 9, 10. Ca 5.
- Chạy: `npx vitest run test/purchase-service.test.ts`

## Bước 4: Truy vấn và số liệu
- [ ] Việc 11, 12, 13. Ca 6, 7 và đột biến bỏ lọc theo ví.
- Chạy: `npx vitest run`

## Bước 5: Hoàn tất
- [ ] Ca 8. Cập nhật báo cáo công nghệ, sinh lại sơ đồ luồng mua, chuyển BE-14 sang xong, viết báo cáo bàn giao.
- Chạy: `bash scripts/run-local-all.sh` một lần.
