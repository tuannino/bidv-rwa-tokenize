# Báo cáo bàn giao — OP-07 lưu bền trạng thái chain mock trong Postgres

| | |
|---|---|
| Mã task | OP-07 |
| Nhánh | `ops/07-mock-ledger-pg`, từ `dev` @ `615c7ef` |
| Spec | `docs/op-07-mock-ledger-postgres/{requirements,tasks}.md` |
| Mức kiểm chứng | Cao |
| Tiến độ | Mã/local xong; chờ Owner làm mới Neon và nghiệm thu bản deploy sau merge |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện | Trạng thái | Bằng chứng |
|---|---|:---:|---|
| 1 | Cổng kho trạng thái; refactor giữ hành vi và 59 ca cũ | ✅ | mục 1; DETAIL mục 1 |
| 2 | Kho Postgres khoá dòng, mã hoá khứ hồi, không lùi bộ nhớ | ✅ | mục 2; DETAIL mục 2, 4 |
| 3 | Nhất quán hai thể hiện và sau khởi động lại | ✅ | mục 2; DETAIL mục 2 |
| 4 | Đồng thời an toàn; bốn đột biến đỏ đúng ca | ✅ | mục 2; DETAIL mục 3 |
| 5 | Phạm vi trạng thái và lịch sử theo chain | ✅ | mục 3; DETAIL mục 2 |
| 6 | Bộ kiểm thử hợp đồng chung xanh cho hai kho | ✅ | mục 2; DETAIL mục 2 |
| 7 | Runbook reset/cache; dựng lại từ schema rỗng | ✅ | mục 4; DETAIL mục 5 |
| 8 | Chế độ ngắt DB, không pha kho; E2E giữ đủ số ca | ✅ | mục 3; DETAIL mục 4, 6 |
| 9 | Owner tắt cache, reset Neon; nghiệm thu hai trình duyệt trên deploy | 🔶 | mục 7 |
| 10 | Tài liệu; bộ mặc định/Postgres xanh; không có bí mật | ✅ | mục 5, 6; DETAIL mục 7 |

**Kết luận:** 9 ✅ · 1 🔶 · 0 ❌. Mã và mọi phép kiểm local đạt; điều kiện production chỉ làm sau merge.

### 0.2 Việc cần Owner quyết/chạy

- Cache truy vấn Hyperdrive đã được Sếp xác nhận tắt ngày 14/10/2026. Sau merge, Owner làm mới đúng
  database Neon theo `docs/DEPLOYMENT.md`, mở web để dựng lại, rồi nghiệm thu hai trình duyệt và ghi
  request ID vào checkpoint bằng commit bổ sung.
- Không có quyết định thiết kế hay mở rộng phạm vi nào khác; FE-27 chưa được thực hiện.

---

## 1. Kiến trúc đã bàn giao

`MockLedgerStateStore` có hai hiện thực dùng chung một khuôn trạng thái và bộ mã hoá: memory cho
`USE_MOCK_DB=true`, Postgres cho `false`. Mỗi hàm adapter mock gọi đúng một `read` hoặc `mutate`;
toàn bộ kiểm tra rồi ghi nằm trong callback đồng bộ của `mutate`, nên không có khe chạy đua giữa hai
lời gọi. Factory là chỗ duy nhất ghép kho; lỗi Postgres được bọc thành `LedgerError`, không lùi về RAM.

`MockLedgerState` lưu một dòng JSONB mỗi chain. `mutate` mở transaction, tạo dòng mặc định nếu thiếu,
`SELECT ... FOR UPDATE`, chạy nghiệp vụ, rồi `UPDATE` tăng `version`. Lỗi nghiệp vụ rollback. Bigint,
Map, Set và snapshot có mã hoá/giải mã khứ hồi; state vượt 512 KiB phát cảnh báo.

## 2. Kiểm trạng thái, khởi động lại và đồng thời

Bộ hợp đồng dùng cùng ca cho memory/Postgres. Hai ledger độc lập cùng Postgres đọc được whitelist và
trạng thái phát hành của nhau. Ca hồi quy lập–duyệt dùng đúng ví
`0x5a5B0Ab8613bA0F16e257228e4109A8F611Ec4fd`, tạo ledger mới giữa hai bước và hoàn tất Mint.

Hai lần phát hành đầu song song chỉ một lần thành công; hai mua song song không thể tiêu quá số dư.
Bốn đột biến lần lượt bỏ khoá dòng, thêm fallback RAM, tách kiểm/ghi Mint và bỏ qua cờ chế độ đều làm
đúng ca bảo vệ đỏ; sau từng phép đã hoàn nguyên và chạy lại xanh. Lệnh, số ca và đầu ra ở DETAIL.

## 3. Phạm vi chain và hai chế độ

`MockLedgerState` chỉ phục vụ chain mock; adapter EVM/Hardhat/Stellar không đọc bảng này. `Txn` tiếp
tục là lịch sử chỉ thêm, không phải nguồn dựng lại ledger. Ca Postgres tạo cùng địa chỉ trên hai chain
và xác nhận `listTxns` lọc đúng chain; ca cấu trúc giữ màn Mint truyền `activeChain`.

`USE_MOCK_DB=true` chọn đồng thời mọi kho nghiệp vụ và kho ledger memory; ca toàn luồng dùng URL DB
sai vẫn không tạo một `pg.Client`. `false` chọn đồng thời hai kho Postgres và lỗi kết nối nổi rõ.

## 4. Reset database, Hyperdrive và số kết nối Worker

`docs/DEPLOYMENT.md` có cả hai cách làm mới: SQL `DROP/CREATE SCHEMA public` (khuyến nghị) hoặc Neon
branch mới; ghi rõ mất toàn bộ lịch sử và trạng thái EVM trong database nhưng không đổi state Sepolia.
Runbook bắt buộc tắt cache query Hyperdrive vì write không vô hiệu cache SELECT.

Trên Postgres thử riêng, schema rỗng được request đầu tự dựng đủ bảng, gồm `MockLedgerState`, và đủ
4 project, 4 role, 7 config seed; sau đó luồng mock chạy xanh. Không thao tác production.

Phép đo Worker local dùng `USE_MOCK_DB=false`, `log_connections=on`, request
`df0cb393-5e3c-4d29-822b-08a122631d20` hoàn tất. Cửa sổ duyệt có **4** kết nối ứng dụng tới
`bidv_rwa_op07_measure`; lệnh đo và log nguyên văn ở DETAIL mục 5. Mốc OP-06 là 3; kết nối tăng thêm là
transaction khoá dòng của mock state. Các dòng `pg_isready` không được tính.

## 5. Tài liệu và thay đổi database

- Prisma, `init.sql` và SQL nhúng có bảng `MockLedgerState`.
- `docs/DEPLOYMENT.md`, `docs/guide.md`, `docs/tech-report.md` mô tả nguồn sự thật, hai chế độ,
  reset Neon và trạng thái cache đã được Sếp xác nhận.
- `.kiro/task-status.json` giữ OP-07 `inProgress` cho tới khi điều kiện production mục 7 được xác nhận.
- FE-27 và adapter chain thật nằm ngoài phạm vi, không thay đổi.

## 6. Bộ kiểm cuối và bí mật

Các lệnh cuối được chạy sau khi viết checkpoint; đầu ra nguyên văn và số ca nằm ở DETAIL mục 7.

```bash
bash scripts/run-local-all.sh
cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa_op07_test npx vitest --run
bash scripts/run-local-all.sh build e2e
git log -p origin/dev..HEAD | grep -nE "postgres(ql)?://[^@ ]+:[^@ ]+@[^l1d ]|PRIVATE_KEY=0x[0-9a-fA-F]{64}" || echo "không có bí mật"
```

## 7. Khoảng cách production còn lại

Điều kiện deploy giữ 🔶 đúng spec. Cache Hyperdrive đã tắt; sau merge Owner còn phải:

1. làm mới toàn bộ Neon theo runbook rồi mở web một lần để dựng schema/seed;
2. trình duyệt A whitelist và lập Mint, đóng; trình duyệt mới B duyệt thành công;
3. A ghi một giá trị, B đọc ngay thấy mới; ghi request ID và bằng chứng;
4. đổi dòng 9 thành ✅, chuyển OP-07 sang `done` bằng commit bổ sung.

