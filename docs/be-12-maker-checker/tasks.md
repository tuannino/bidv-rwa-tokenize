# BE-12 — các bước

## Bước 0: Trạng thái
- [ ] Chuyển BE-12 sang đang làm.
- Chạy: `node scripts/scan-pending.mjs --check`

## Bước 1: Dữ liệu và quyền
- [ ] Việc 1, 2, 3, 4. Sinh lại tệp khởi tạo bằng công cụ.
- Chạy: `npx vitest run test/store-constraints.test.ts test/rbac.test.ts`

## Bước 2: Nghiệp vụ lập
- [ ] Việc 5, 6, 7. Ca 1, 2, 6.
- Chạy: `npx vitest run test/token-request.test.ts`

## Bước 3: Nghiệp vụ duyệt
- [ ] Việc 8, 9, 10, 11. Ca 3, 4, 5 và hai đột biến.
- Chạy: `npx vitest run test/token-request.test.ts`

## Bước 4: Phát hành nhiều lần
- [ ] Việc 12, 13. Ca 7.
- Chạy: `npx vitest run test/issuance-service.test.ts`

## Bước 5: Số việc chờ và hoàn tất
- [ ] Việc 14. Ca 8. Cập nhật báo cáo công nghệ, chuyển sang xong, viết báo cáo bàn giao.
- Chạy: `bash scripts/run-local-all.sh` một lần.
