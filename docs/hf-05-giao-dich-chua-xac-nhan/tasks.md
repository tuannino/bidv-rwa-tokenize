# HF-05: các bước

1. Đo nền trên `dev` @ `4d17bc9`: chạy các test ở bước 6 với mã cũ, ghi lại ca HF-05 nào đỏ. Ca 5 (chặn quyền, sai chain) có thể xanh sẵn vì hàm chưa tồn tại thì ghi "chưa có hàm".
2. Phát hành, huỷ: thao tác lưu trữ `finalizeTokenRequest` (Postgres và bộ nhớ); cập nhật `Txn` theo `(chain, txHash)`; nhánh PENDING trong `approveTokenRequest`; `reconcileTokenRequest` và server action.
3. Lệnh mua bán: cờ `receiptUnknown` trong `finalizeOrderFailure`, bật ở nhánh PENDING và nhánh ném lỗi khi chờ của **cả** `sendAndSettle` và `reconcileExecutingOrder`.
4. Màn: `approval-detail.tsx` (thông báo vàng, nút Đối soát); `distribution-approval.tsx` (`approvedAmountLabel`).
5. Tài liệu: `docs/USER_GUIDE.md` (chép từ gói rồi sửa theo requirements mục 6), `docs/tech-report.md`, `docs/CHECKPOINT_HF05.md`, `.kiro/task-status.json`.
6. Kiểm chứng:

```bash
(cd app && npx vitest --run test/token-request.test.ts test/purchase-service.test.ts test/fe-08-approval.test.ts)
for f in test/evm-issuance.test.ts test/evm-order-settlement.test.ts test/fe-08-approval-evm.test.ts; do
  bash scripts/evm-local.sh reset
  (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run "$f")
done
bash scripts/evm-local.sh down
node scripts/gen-flow-diagram.mjs issue --check && node scripts/gen-flow-diagram.mjs purchase --check
( set -e; BAK="$(mktemp -d)"; mv packages/contracts-evm/artifacts "$BAK/artifacts"
  trap 'mv "$BAK/artifacts" packages/contracts-evm/artifacts && rmdir "$BAK"' EXIT
  bash scripts/run-local-all.sh arch markers checkpoint app )
bash scripts/run-local-all.sh build   # kèm e2e maker-checker, ops-transactions
```

7. Đột biến (ghi kết quả vào checkpoint, mỗi đột biến phải làm ít nhất một ca đỏ):
   - bỏ nhánh PENDING trong `approveTokenRequest` (PENDING lại thành COMPLETED);
   - `finalizeTokenRequest` bỏ điều kiện `status = 'EXECUTING'` (ca 5b phải đỏ);
   - ghi sổ token trước, ngoài transaction, rồi mới chuyển trạng thái (ca 5b hoặc 5c phải đỏ);
   - `reconcileExecutingOrder` bỏ cờ `receiptUnknown` (ca 7b phải đỏ);
   - `approvedAmountLabel` đổi lại dùng `expectedAmount`.

8. Đo hiệu năng: số server action khi mở `/approvals/[id]` và `/distribution` (cả vai Kiểm soát viên và Giao dịch viên) trước và sau, ghi vào checkpoint. Phải giữ nguyên.

Commit mã: `fix(hf-05): giao dịch chưa có biên nhận giữ đang thực hiện, đối soát yêu cầu phát hành; màn chia hiện đúng số đã duyệt`
Commit tài liệu: `docs(hf-05): bàn giao kiểm chứng, UserGuide vào repo`
