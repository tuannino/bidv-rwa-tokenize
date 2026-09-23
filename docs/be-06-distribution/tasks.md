# BE-06 — tasks

## Bước 0: Trạng thái và nợ kỹ thuật

- [ ] Chuyển BE-06 sang `inProgress`. Ghi hai mục nợ kỹ thuật ở việc 9 vào `tech-report.md`.
- Chạy: `node scripts/scan-pending.mjs --check`

## Bước 1: Mở kỳ và xem trước

- [ ] Việc 1, 2, 3, 4. Ca kiểm thử 1, 2, 4, 5.
- Chạy: `npx vitest run test/distribution-service.test.ts`

## Bước 2: Chia theo lô

- [ ] Việc 5, 6, 7. Ca 3, 6, 7, 8 và hai đột biến.
- Chạy: `npx vitest run test/distribution-service.test.ts test/config-service.test.ts`

## Bước 3: Action, marker, sơ đồ

- [ ] Việc 8. Sinh sơ đồ luồng `distribute`.
- Chạy: `node scripts/scan-pending.mjs --check`

## Bước 4: Hoàn tất

- [ ] Cập nhật `tech-report.md`, chuyển BE-06 sang `done`, checkpoint.
- Chạy: `bash scripts/run-local-all.sh` một lần.
