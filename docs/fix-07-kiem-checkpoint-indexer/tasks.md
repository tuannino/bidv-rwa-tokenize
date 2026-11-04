# FIX-07: các bước

1. Tạo nhánh `fix/fix-07-kiem-checkpoint-indexer` từ `release/ui-v2` mới nhất. Chạy `evm` trên mốc, lưu `grep -c "không giải mã được"` của đoạn log EVM (số trước).
2. QĐ-1 và 4 ca test (design mục 1).
3. QĐ-2, QĐ-3: tạo `evm-log-decode.ts`, dời vòng lặp, sửa `evm.adapter.ts`; unit test (design mục 2).
4. Chạy kiểm thử đúng requirements mục 5, lưu log.
5. Lệnh danh sách trắng, kết quả phải rỗng:

   ```bash
   git diff --name-only origin/release/ui-v2...HEAD \
     | grep -vE '^(scripts/check-checkpoint\.mjs|app/src/lib/ledger/(evm\.adapter|evm-log-decode)\.ts|app/test/(check-checkpoint|fix-07-evm-log-decode)\.test\.ts|docs/fix-07-kiem-checkpoint-indexer/(requirements|design|tasks)\.md|docs/CHECKPOINT_FIX07\.md|\.kiro/task-status\.json)$'
   ```

6. Viết `docs/CHECKPOINT_FIX07.md` theo `docs/CHECKPOINT_TEMPLATE.md` (mục 0 đủ 8 điều kiện; `node scripts/check-checkpoint.mjs docs/CHECKPOINT_FIX07.md docs/fix-07-kiem-checkpoint-indexer/requirements.md`), cập nhật `.kiro/task-status.json` (FIX-07 `inProgress` khi chạy kiểm, rồi hoàn thành).
7. Mở PR base `release/ui-v2`, tiêu đề `FIX-07: checkpoint không phân biệt hoa thường; Indexer bỏ qua sự kiện không theo dõi`, gửi Supervisor log, đoạn log EVM riêng (số dòng lỗi giải mã trước và sau), đoạn mã trước và sau. Không tự merge.
