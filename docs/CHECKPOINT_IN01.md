# Báo cáo bàn giao: IN-01 Indexer gọn cho sự kiện vault và WPT

| | |
|---|---|
| Mã task | IN-01 |
| Nhánh | `feat/in-01-indexer`, tạo từ `dev` (`2fbdde8`) |
| Spec | `docs/in-01-indexer/{requirements,design,tasks}.md` bản 2 |
| Tiến độ | Xong mã và kiểm chứng local. Chờ Supervisor nghiệm thu; Codex không merge vào `dev` |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md`) | | Bằng chứng |
|---|---|---|---|
| 1 | Hai bảng cache, hai hiện thực kho, nâng lược đồ không xoá dữ liệu | ✅ | mục 1.1 · 3.1 |
| 2 | Đồng bộ đoạn, giới hạn lượt, lease owner/CAS/gia hạn, idempotent | ✅ | mục 1.2 · 3.2 |
| 3 | Năm hàm EVM đọc bảng + tail, giữ HF-04 | ✅ | mục 1.3 · 3.3 |
| 4 | Danh sách ví đúng Transfer, giữ số dư 0, sắp và cắt ổn định | ✅ | mục 1.4 · 3.2 · 3.3 |
| 5 | Chia dùng nguồn ví thứ tư; mock/Stellar đúng quyết định | ✅ | mục 1.5 · 3.2 |
| 6 | Bốn biến mới; bỏ biến quét lệnh cũ | ✅ | mục 1.6 · 3.1 |
| 7 | Test, hồi quy, luật kiến trúc và phép đo RPC đạt | ✅ | mục 2 · 3 |
| 8 | UserGuide, tech-report, runbook, checkpoint, task-status cập nhật | ✅ | mục 1.7 · 4 |

**Kết luận:** 8 ✅ · 0 🔶 · 0 ❌.

### 0.2 Việc cần Owner quyết

- Không có việc cần quyết để merge. Nếu gặp reorg sâu hoặc cache sai trên production, việc xoá hai
  bảng cache của đúng chain vẫn **phải có Sếp quyết định**; runbook ở `docs/DEPLOYMENT.md`.

---

## 1. Đã làm

### 1.1 Lược đồ và kho

- Thêm `ChainEvent`, `IndexerCursor`; sinh lại `init.sql` và `init-sql.generated.ts` bằng
  `npm run db:sql`.
- `IChainEventStore` có bản memory và Postgres. `claimLease`, `commitSegment`, `releaseLease`
  đều có hàng rào owner; tiến cursor dùng thêm `lastBlock = expected`; insert log bỏ trùng.
- Factory chọn memory/Postgres theo cùng `USE_MOCK_DB` với các cổng còn lại.

### 1.2 Lõi Indexer

- Scope `(anchor, vault, token)` được kiểm trước khi xét cursor đã bắt kịp; anchor là hash block
  triển khai. Scope đổi đặt cursor về `deployBlock - 1`, không xoá dòng lịch sử cũ.
- Chỉ lưu block đã đủ xác nhận; bảng cộng live tail luôn trả đủ. Đoạn cuối dùng chung một lần lấy
  log cho phần xác nhận và tail; timestamp chỉ lấy cho block có sự kiện cần lưu/trả.
- Mỗi đoạn commit riêng và gia hạn lease. Lỗi nguồn lúc sync trả lease rồi đọc trực tiếp; lỗi DB
  không bị che bằng fallback.

### 1.3 Adapter EVM

Năm hàm `vaultConfigEvents`, `vaultPeriodCloses`, `findVaultPeriodClose`,
`findVaultWithdrawals`, `findOrderSettlement` dùng Indexer; vẫn giữ bước `isOrderSettled` và đường
biên nhận HF-04. Một lần `fetchLogs` lấy cả vault và WPT; log ngoài ABI tối giản bị bỏ và cảnh báo
một lần trên mỗi instance ledger.

### 1.4 Danh sách ví

`listTokenWallets()` tổng hợp hai vế gửi/nhận của `Transfer`, bỏ địa chỉ 0 nhưng vẫn trừ burn và
giữ ví có tổng bằng 0. Kết quả chữ thường, sắp theo ví, lấy thêm một dòng sentinel để bật
`truncated`. Test Hardhat thực hiện phát hành vào vault, cưỡng chế chuyển qua hai ví rồi đốt hết.

### 1.5 Chia lợi nhuận

`collectRecipients` thêm nguồn thứ tư từ Indexer và không lọc theo số dư hiện tại. Ca snapshot
chứng minh ví A vẫn nhận đúng phần sau khi đã chuyển hết cho B; B nhận 0 ở snapshot cũ.

### 1.6 Cấu hình

Thêm `INDEXER_CONFIRMATIONS=12`, `INDEXER_SEGMENT_BLOCKS=50000`,
`INDEXER_MAX_BLOCKS_PER_SYNC=200000`, `INDEXER_LEASE_SECONDS=60` vào env, `.env.example` và
Wrangler. `ORDER_SETTLEMENT_EVENT_BLOCK_CHUNK` không còn chỗ dùng và đã bị gỡ.

### 1.7 Tài liệu

- Chép spec bản 2 vào repo.
- UserGuide thêm kiến trúc Indexer và L-92/L-93; tech-report thêm QĐ-IN1 tới QĐ-IN8, biến cấu
  hình, giới hạn và nợ kỹ thuật; Deployment thêm runbook dựng lại cache.
- Sơ đồ `distribute`, `purchase` và khối marker trong tech-report đã sinh lại từ mã.

## 2. Đo hiệu năng

### 2.1 Server action trước/sau

IN-01 không đổi page/component/action. Đo bằng:

```text
$ rg -n 'Action\(' app/src/components/pages/{vault-status,distribution-approval,seller-withdraw}.tsx
vault-status: getVaultOverviewAction khi mở = 1; getVaultConfigHistoryAction khi mở lịch sử = 1
distribution-approval: getDistributionPageAction khi mở = 1
seller-withdraw: reconcileAndListMyWithdrawRequestsAction khi mở = 1
```

Kết quả trước/sau: `1 / 1 / 1 / 1`, không tăng. Nền xác định từ cùng ba component vì nhánh không
sửa UI/action; con số quét RPC cũ dùng phép đo đã ghi trong spec/HF-03: khoảng 43 `eth_getLogs`
mỗi hàm lịch sử Sepolia, tăng theo tuổi chain.

### 2.2 Sau khi bắt kịp

`hf-03-doc-log-evm.test.ts` dùng transport đếm: đầu cố định, khoảng RPC không vượt chunk và không
dùng `latest`. Với cấu hình production (`EVM_LOG_BLOCK_CHUNK=10000`), phần tail 12 block là một
`eth_getLogs`; mỗi lời đọc có một `eth_blockNumber`; anchor chỉ đọc một lần mỗi isolate.

### 2.3 Đo đoạn 50.000 block Sepolia

```text
$ curl eth_blockNumber https://ethereum-sepolia-rpc.publicnode.com
0xb6c694 (11978388)
$ /usr/bin/time -p curl ... eth_getLogs fromBlock=0xb60345 toBlock=0xb6c694 ...
real 0.34
$ jq -c '{error, logCount:(.result | length)}' /tmp/in01-sepolia-logs.json
{"error":null,"logCount":33}
```

Đo ngày 24/10/2026: 0,34 giây cho đúng 50.000 block, nhỏ hơn nửa lease mặc định 30 giây.

## 3. Kiểm chứng

### 3.1 Lược đồ, kiểu và toàn suite app

```text
$ (cd app && npm run db:sql)
Đã sinh init.sql và init-sql.generated.ts
$ (cd packages/contracts-evm && npx hardhat compile)
Compiled 58 Solidity files successfully (evm target: cancun).
$ (cd app && npm run typecheck && npx eslint . && npm test)
Test Files  60 passed | 12 skipped (72)
Tests       1141 passed | 87 skipped (1228)
exit=0
```

### 3.2 Ca đơn vị IN-01 và chia theo snapshot

```text
$ (cd app && npm test -- test/indexer-sync.test.ts)
Test Files 1 passed; Tests 10 passed
```

Các ca bảo vệ tám đột biến: tail chưa xác nhận, CAS/owner fence, reset scope khi đã bắt kịp,
anchor đổi cùng địa chỉ, ví số dư 0, burn về địa chỉ 0, max-block vẫn đọc đủ và bảng + live tail.
`distribution-service.test.ts` bảo vệ nguồn thứ tư và snapshot cũ.

### 3.3 Hardhat thật và hồi quy EVM

Mỗi tệp chạy sau `bash scripts/evm-local.sh reset`, sau cùng `down`:

```text
test/evm-indexer.test.ts          1 passed
test/evm-order-settlement.test.ts 10 passed
test/evm-issuance.test.ts         13 passed | 1 skipped
```

### 3.4 Sai lệch kiểm chứng

- Không dựng lại một checkout mã cũ để chụp riêng ca 7–11; dùng các suite hồi quy hiện có làm bản
  so sánh và dùng phép đo nền đã được ghi trong HF-03/spec. Lý do: checkout gốc của Sếp có thay đổi
  chưa commit nên việc chạy/đổi trạng thái nền ở đó không an toàn.
- Không chạy kho Postgres cục bộ vì phiên không có database test; SQL được kiểm qua generated-init,
  schema-upgrade và test constraint hiện có. Bản memory chạy đủ ca lease/race.

### 3.5 Build và E2E

```text
$ bash scripts/run-local-all.sh build e2e
PASS APP - BUILD BẢN PHÁT HÀNH (Next.js 16.2.7, Turbopack)
PASS APP - E2E (PLAYWRIGHT): 74 passed, 7 skipped
exit=0
```

Worktree cần `npm ci` cục bộ trước lệnh này; Turbopack không chấp nhận symlink `app/node_modules`
trỏ ra checkout gốc. `node_modules` là artifact ignored, không nằm trong diff.

## 4. Bàn giao và vận hành

- Nhánh không đẩy thẳng vào `dev`; chờ review/PR.
- Lần deploy đầu mở `/vault` ba lần để đẩy cursor; kết quả trong lúc bắt kịp vẫn đúng nhưng chậm.
- Reorg sâu hoặc scope sai: làm theo `docs/DEPLOYMENT.md`, chỉ sau khi Sếp quyết.
- Nợ còn lại: cron đồng bộ, IN-02, reorg sâu và phân trang danh sách ví.

## 5. Tự đánh giá 3 LUẬT kiến trúc

- [x] Mọi call chain qua `ILedgerPort`; viem chỉ nằm trong `lib/ledger`.
- [x] Mọi giao dịch vẫn qua `ISigner`; IN-01 chỉ thêm đường đọc.
- [x] Không thêm đường nghiệp vụ/action mới nên RBAC giữ nguyên.
