# FIX-01: các bước

Nhánh: `fix/fix-01-vi-ket-noi` từ `dev` @ `c9163d5`. Một PR. Không push lên `dev`.

1. Đo nền trên `c9163d5` số action khi mở các màn ở requirements mục 6, ghi vào checkpoint.
2. Lược đồ, cổng `WalletBinding` (bộ nhớ, Postgres), bảng ràng buộc ở `store.errors.ts` (design mục 1); trợ giúp `test/helpers/wallet-binding.ts`. Ca 23, 24.
3. `wallet-owner.ts`, mã lỗi `WALLET_NOT_BOUND`, gỡ các hàm ví liên kết cũ (design mục 2). Gắn chốt chặn vào các service (D2, D3). Ca 7 tới 10.
4. `wallet-binding.service.ts`, action, trang và màn `/wallet-binding` (design mục 3). Ca 1 tới 6.
5. Menu nhóm "Nghiệp vụ ẩn", sidebar thu gọn (design mục 4). Ca 22; sửa `test/demo-payment.test.ts`, `test/four-roles-shell.test.ts`.
6. Giao diện Nhà đầu tư `WalletNotBoundNotice`; `getTradeContext` trả `walletBound` (design mục 5).
7. Màn tài khoản (design mục 6).
8. Vòng đời lệnh rút có bước đặt ví nhận (trạng thái mới, cột `payoutTxHash`, `hasPendingSignerTx`), `checkPayoutWallet`, `continueWithdrawRequest`, đối soát, màn rút; bỏ ví nhận ở cấu hình vault (design mục 7, 8). Ca 11 tới 21, 20b. Với `e2e/vault-withdraw.spec.ts`:
   - bước chuẩn bị: Giao dịch viên mở `/wallet-binding`, chọn hồ sơ NB001, nhập NB001 (ví mẫu), bấm "Định danh và gắn ví", thấy thành công (thay bước dùng `/mint`);
   - Kiểm soát viên lưu cấu hình (không còn ô ví nhận), giữ các khẳng định chế độ và lịch sử cấu hình;
   - Người bán mở `/seller/withdraw`, gõ NB001 vào ô "Ví nhận" (hoặc giữ giá trị điền sẵn nếu vault đã có NB001), nhập số, mục đích, bấm "Tạo lệnh rút", nhập mã một lần, thấy `COMPLETED` và câu rút về ví NB001;
   - chạy cả hai project `mock` và `hardhat`.
9. Kiểm chứng:

```bash
(cd app && npm run typecheck && npm run lint && npx vitest --run)
# ca 20 (phần Postgres), 23, 24 cần Postgres cục bộ
(cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa npx vitest --run test/fix-01-wallet.test.ts)
bash scripts/evm-local.sh reset
(cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/op-05-demo-cycle-evm.test.ts test/be-13-vault-evm.test.ts test/fe-08-approval-evm.test.ts)
bash scripts/evm-local.sh down
bash scripts/run-local-all.sh build e2e evm
# không còn mã đọc, ghi ProfileWallet ngoài câu chép dữ liệu
grep -rn "ProfileWallet\|profile-wallet" app/src --include=*.ts --include=*.tsx | grep -v "init-sql.generated.ts"
# ký tự cấm trong dòng thêm mới: chỉ được ra dòng do script sinh
git diff c9163d5 | python3 -c "import sys,re;[print(l,end='') for l in sys.stdin if l.startswith('+') and not l.startswith('+++') and re.search('[\\u2192\\u2014\\u00b7]',l)]"
```

   Lệnh quét `ProfileWallet` phải rỗng (mô hình trong `schema.prisma` và `init.sql` nằm ngoài `app/src`; `init-sql.generated.ts` được loại trừ).

10. Mười một đột biến ở requirements mục 7, ghi ca đỏ của từng đột biến vào checkpoint.
11. Đo lại như bước 1, đo thời gian trả của `listWalletBindingsAction` và một lần gắn ví trên `hardhat-local`; chụp ảnh theo "Điều kiện hoàn thành".
12. UserGuide, `docs/CHECKPOINT_FIX01.md` (gồm ghi chú triển khai), `.kiro/task-status.json`.

Commit mã: `fix(fix-01): định danh và gắn ví cho hồ sơ, dữ liệu tài khoản theo ví kết nối, Người bán chọn ví nhận khi rút`
Commit tài liệu: `docs(fix-01): UserGuide, checkpoint, ảnh`
