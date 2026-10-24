# IN-01: các bước (bản 2)

Nhánh: `feat/in-01-indexer` từ `dev` @ `2fbdde8`. Không push lên `dev`, mở PR.

1. Đo nền trên mã cũ:
   - số server action khi mở `/vault`, lịch sử cấu hình vault, `/distribution`, `/seller/withdraw`;
   - số `eth_getLogs` và `eth_getBlock` của một lần `vaultConfigEvents()` và `vaultPeriodCloses(10)` trên Hardhat (transport đếm);
   - chụp kết quả `vaultConfigEvents`, `vaultPeriodCloses`, `findVaultWithdrawals`, `findOrderSettlement` của kịch bản ca 7 tới 11 bằng mã cũ, lưu làm bản so sánh trong test.
2. `schema.prisma` thêm hai bảng; `npm run db:sql`; kiểm đường nâng lược đồ tạo bảng trên cơ sở dữ liệu đã có (ca FE-05 ca 12 vẫn xanh).
3. Kho: cổng, bộ nhớ, Postgres (`claimLease`, `commitSegment`, `releaseLease` có điều kiện owner, `listEvents`, `tokenWallets`), đăng ký trong `lib/store/index.ts` theo cờ `useMockDb`.
4. `lib/indexer/event-index.ts` (kiểm phạm vi trước tiên, đồng bộ theo đoạn có gia hạn lease) và test đơn vị ca 3 tới 6, 17 tới 21.
5. Adapter EVM: `source` (`head`, `scope` có `anchor`, `fetchLogs`, `timestamps`), năm hàm đổi sang `readEvents`, xoá các vòng quét từ block triển khai; factory truyền kho.
6. `listTokenWallets` (cổng, EVM, mock, Stellar) và nguồn 4 của `collectRecipients` (không lọc số dư, `truncated` gồm nguồn 4); sửa chú thích ở `ledger.port.ts` và `distribution.service.ts`; ca 13, 16, 20.
7. `env.ts`, `.env.example`, wrangler: bốn biến mới; bỏ `ORDER_SETTLEMENT_EVENT_BLOCK_CHUNK` nếu hết chỗ dùng.
8. Tài liệu:
   - UserGuide: thêm vào Phụ lục giới hạn các mục L tiếp theo: reorg sâu hơn 12 block; lần mở đầu sau triển khai chậm cho tới khi Indexer bắt kịp. Mục kiến trúc: một đoạn ngắn về Indexer (nguồn sự thật cho lịch sử sự kiện và người nắm giữ, trạng thái hiện tại vẫn đọc trực tiếp).
   - tech-report: mục Indexer (QĐ-IN1 tới QĐ-IN8, giới hạn, nợ kỹ thuật: chạy theo lịch, IN-02, reorg sâu).
   - runbook: thao tác sự cố dựng lại Indexer (design mục 9), ghi rõ cần Sếp quyết.
   - checkpoint IN-01; `task-status.json`: IN-01 vào `done`.
9. Kiểm chứng:

```bash
(cd app && npx vitest --run test/indexer-sync.test.ts test/distribution*.test.ts test/withdraw*.test.ts test/vault*.test.ts)
for f in test/evm-indexer.test.ts test/evm-order-settlement.test.ts test/evm-issuance.test.ts; do
  bash scripts/evm-local.sh reset
  (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run "$f")
done
bash scripts/evm-local.sh down
( set -e; BAK="$(mktemp -d)"; mv packages/contracts-evm/artifacts "$BAK/artifacts"
  trap 'mv "$BAK/artifacts" packages/contracts-evm/artifacts && rmdir "$BAK"' EXIT
  bash scripts/run-local-all.sh arch markers checkpoint app )
bash scripts/run-local-all.sh build e2e
```

   Tên tệp test vitest ở dòng đầu là gợi ý theo tiền tố; dùng đúng tên tệp đang có trong repo.
10. Tám đột biến ở `requirements.md` mục 8, ghi ca đỏ của từng đột biến vào checkpoint.
11. Đo lại như bước 1, ghi bảng trước và sau vào checkpoint; đo thời gian một đoạn 50.000 block trên Sepolia qua RPC log công khai (chỉ đọc, không cần khoá hay RPC có API key) để kiểm điều kiện lease ở requirements mục 6.

Commit mã: `feat(in-01): Indexer gọn cho sự kiện vault và WPT; đọc sự kiện không quét từ block triển khai; danh sách ví WPT cho chia theo snapshot`
Commit tài liệu: `docs(in-01): bàn giao kiểm chứng, UserGuide, tech-report, runbook dựng lại Indexer`
