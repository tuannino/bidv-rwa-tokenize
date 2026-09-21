# BE-03 — tasks

## Bước 1: Đổi chữ ký hàm kiểm

- [ ] Đổi `runPurchaseChecks` theo việc 1. `executeOrder` truyền `quotedVndAmount`.
- Chạy: `npx vitest run test/purchase-service.test.ts`. Phải xanh nguyên trước khi làm tiếp.

## Bước 2: Xem trước và chặn lệnh rác

- [ ] `previewPurchase` theo việc 2 và 3.
- [ ] Sửa `placeOrder` theo việc 4.
- [ ] Thêm 4 ca kiểm thử.
- Chạy: `npx vitest run test/purchase-service.test.ts`

## Bước 3: Action, marker, sơ đồ

- [ ] `previewPurchaseAction`, gắn `@pending FE-05`.
- [ ] Chèn và đánh số lại `@flow purchase`, sinh lại sơ đồ.
- Chạy: `node scripts/scan-pending.mjs --check`

## Bước 4: Hoàn tất

- [ ] Cập nhật `tech-report.md` phần luồng mua.
- [ ] Chuyển BE-03 sang `done` trong `.kiro/task-status.json`.
- [ ] Checkpoint.
- Chạy: `bash scripts/run-local-all.sh` một lần.
