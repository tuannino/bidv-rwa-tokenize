# BE-04 — tasks

## Bước 0: Trạng thái

- [ ] Chuyển **MC-02** sang `done` (đã merge ở PR #22, sót lại). Thêm `FE-07` vào `planned`. Chuyển BE-04 sang `inProgress`.
- Chạy: `node scripts/scan-pending.mjs --check`

## Bước 1: Lược đồ và cổng lưu trữ

- [ ] Việc 1 đến 5.
- Chạy: `npx vitest run test/store-constraints.test.ts`

## Bước 2: Đặt giá xuống ledger

- [ ] Việc 6, cả ba adapter trong một commit.
- Chạy: `npx vitest run test/mock-ledger.test.ts`

## Bước 3: Nghiệp vụ giá và quyền

- [ ] Việc 7 đến 11. Viết `config-service.test.ts` gồm ca 1, 2, 3 và hai đột biến.
- Chạy: `npx vitest run test/config-service.test.ts test/portfolio-service.test.ts`

## Bước 4: Phát hành

- [ ] Việc 12, 13. Viết `issuance-service.test.ts` gồm ca 4.
- Chạy: `npx vitest run test/issuance-service.test.ts`

## Bước 5: Test viết cứng và điểm cắm

- [ ] Việc 14 đến 16. Làm ca 5.
- Chạy: `npx vitest run` (toàn bộ vitest, vì ca 5 kiểm mọi tệp test)

## Bước 6: Hoàn tất

- [ ] Cập nhật `tech-report.md`, sinh sơ đồ luồng `issue`, chuyển BE-04 sang `done`, checkpoint.
- Chạy: `bash scripts/run-local-all.sh` một lần.
