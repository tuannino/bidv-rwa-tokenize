# FIX-09: các bước

1. Tạo nhánh `fix/fix-09-rut-vndb-eip7702` từ `dev` mới nhất. Ghi FIX-09 vào `inProgress` của `.kiro/task-status.json`.
2. Lấy dữ liệu thật của giao dịch nguồn (không ghi khoá, chỉ dữ liệu công khai trên chuỗi):

   ```bash
   curl -sS -X POST https://ethereum-sepolia-rpc.publicnode.com -H 'content-type: application/json' \
     -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionByHash","params":["0xbbc9c6a83e63f92c06aea9b94f8e9d5d8c57fd9231eb0c8bdb283832d7044eb5"]}'
   ```

   Gọi thêm `eth_getTransactionReceipt` cùng mã. Lưu `transaction` (`from`, `to`, `type`, `input`) và `receipt` (`status`, `logs`, `gasUsed`) vào `app/test/fixtures/fix-09-tx-0xbbc9.json`; kiểm `input` dài 3018 ký tự, chứa nhãn `618a1b300552bd77f7984a017b4933cc41d8d9c3fd23db23dff2154a63a99981` tại byte 1.468 và không kết thúc bằng nhãn; `receipt.status` là `0x0`, `logs` rỗng.
3. Viết `payment-tag.ts` và unit nhóm 1.
4. Sửa `matchesTransfer`, `findPaymentTransferByTag`, ba chú thích, import theo QĐ-3b (requirements QĐ-2); viết unit nhóm 2, 3, 4, 4b (4b bắt buộc; gặp khó khi dựng adapter giả thì báo Supervisor, không bỏ). Chạy riêng ca 14 trên nút Hardhat (requirements mục 5).
5. Viết `docs/CHECKPOINT_FIX09.md` bản đầu theo `docs/CHECKPOINT_TEMPLATE.md` (để phần `checkpoint` của `run-local-all.sh` kiểm thật), rồi chạy kiểm thử requirements mục 6, lưu log.
6. Các lệnh kiểm (macOS và Linux, bash và zsh). Kỳ vọng: 6a, 6b, 6c rỗng.

   a. Danh sách trắng:

   ```bash
   git diff --name-only --diff-filter=d origin/dev...HEAD \
     | grep -vE '^(app/src/lib/ledger/(payment-tag|evm\.adapter|ledger\.port)\.ts|app/src/lib/bank/payment-withdraw\.service\.ts|app/test/fix-09\.test\.ts|app/test/fixtures/fix-09-tx-0xbbc9\.json|docs/fix-09-rut-vndb-eip7702/(requirements|tasks)\.md|docs/CHECKPOINT_FIX09\.md|docs/tech-report\.md|\.kiro/task-status\.json)$'
   git diff --name-only --diff-filter=D origin/dev...HEAD
   ```

   b. Không còn so `endsWith` nhãn trên `input` trong `lib/`:

   ```bash
   rg -n 'input[^;]*\.endsWith\(' app/src/lib
   rg -n 'endsWith\((tag|wanted)\b' app/src/lib
   ```

   c. Ký tự cấm ở dòng thêm mới:

   ```bash
   export LC_ALL=C
   git diff origin/dev...HEAD -U0 -- app/src app/test/fix-09.test.ts | grep '^+[^+]' | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e'
   ```

7. Hoàn thiện checkpoint (mục 0 đủ 14 điều kiện của requirements mục 5; `node scripts/check-checkpoint.mjs docs/CHECKPOINT_FIX09.md docs/fix-09-rut-vndb-eip7702/requirements.md`), `.kiro/task-status.json` (FIX-09 hoàn thành).
8. Mở PR 1 base `dev`, tiêu đề `FIX-09: nhận đúng lệnh rút VNDB khi ví gói giao dịch (EIP-7702)`, gửi Supervisor báo cáo kèm log, đoạn log EVM riêng, kết quả bước 6. Không tự merge.
9. (Sau triển khai) Sau khi Sếp merge PR 1: tạo nhánh `sync/dev-vao-release-ui-v2` từ `release/ui-v2` mới nhất, `git merge origin/dev` (không squash). Xung đột dự kiến chỉ ở `.kiro/task-status.json` (`done` của PR 2 là hợp `done` của hai nhánh cộng FIX-09; mỗi mã ở đúng một danh sách) và có thể `docs/tech-report.md` (sinh lại bằng `node scripts/scan-pending.mjs --write-report`); xung đột ở tệp mã khác thì DỪNG và báo. Chạy lại bộ kiểm requirements mục 6, mở PR 2 base `release/ui-v2`, tiêu đề `Đồng bộ dev vào release/ui-v2 sau FIX-09`. Không tự merge.
10. (Sau triển khai) Vận hành:

    a. Trước khi nhà đầu tư thử lại: giao dịch 7702 revert vẫn có thể đã gắn delegation (theo EIP-7702, authorization được xử lý trước phần thực thi). Kiểm mã của ví trên chuỗi:

    ```bash
    curl -sS -X POST https://ethereum-sepolia-rpc.publicnode.com -H 'content-type: application/json' \
      -d '{"jsonrpc":"2.0","id":1,"method":"eth_getCode","params":["<ví nhà đầu tư>","latest"]}'
    ```

    Kết quả khác `0x` (thường `0xef0100` + địa chỉ hợp đồng) nghĩa là ví đang là tài khoản thông minh: chuyển về tài khoản thường trong MetaMask, chờ giao dịch đó xác nhận, kiểm lại ra `0x`, rồi mới thử lệnh rút mới. Ghi kết quả vào báo cáo.

    b. Rà lệnh cũ: liệt kê lệnh rút VNDB trạng thái `FAILED`, `EXPIRED` có `submittedTxHash` hoặc `sendingAt` từ ngày đưa tính năng rút VNDB lên Sepolia; với mỗi lệnh, đối chiếu trên chuỗi (giao dịch có nhãn của lệnh, người gửi là ví gửi, log `Transfer` khớp). Lệnh nào tiền đã đi thì báo Supervisor trước khi sửa dữ liệu; KHÔNG tự sửa cơ sở dữ liệu trong task này. Ghi kết quả vào checkpoint hoặc báo cáo sau.
