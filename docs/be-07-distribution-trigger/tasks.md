# BE-07 — tasks

## Bước 0: Trạng thái

- [ ] Chuyển BE-07 sang `inProgress`. Kiểm `dev` đã có BE-06.
- Chạy: `node scripts/scan-pending.mjs --check`

## Bước 1: Phát hiện tiền vào và chống chạy trùng

- [ ] Việc 1 đến 4. Thêm các khóa tham số hệ thống cần dùng.
- [ ] Ca 1, 2, 5, 6 và đột biến hai vòng đồng thời.
- Chạy: `npx vitest run test/distribution-trigger.test.ts test/config-service.test.ts`

## Bước 2: Chia nhiều vòng và mốc số dư

- [ ] Việc 5 đến 8. Ca 3, 4 và đột biến lô lỗi.
- Chạy: `npx vitest run test/distribution-trigger.test.ts test/distribution-service.test.ts`

## Bước 3: Cảnh báo, kích hoạt tay, điểm vào

- [ ] Việc 9 đến 11. Ca 7, 8, 9.
- Chạy: `npx vitest run test/distribution-trigger.test.ts`

## Bước 4: Marker và sơ đồ

- [ ] Việc 12. Sinh lại sơ đồ luồng `distribute`.
- Chạy: `node scripts/scan-pending.mjs --check`

## Bước 5: Hoàn tất

- [ ] Cập nhật `tech-report.md`: bản đồ luồng, nợ kỹ thuật về việc chờ Indexer. Chuyển BE-07 sang `done`, checkpoint.
- Chạy: `bash scripts/run-local-all.sh` một lần.
