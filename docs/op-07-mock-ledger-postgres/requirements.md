# OP-07: Lưu bền trạng thái chain mock trong Postgres, nhất quán giữa các tiến trình

| | |
|---|---|
| Nhánh | `ops/07-mock-ledger-pg`, từ `dev` @ `615c7ef` (PR #49) |
| Điểm | 8 |
| Mức kiểm chứng | **Cao** (đổi nguồn sự thật của chain mock, đụng mọi luồng tiền trên mock) |
| Thứ tự | Làm ngay, trước SC-07 (SC-07 sẽ thêm hàm vào `ILedgerPort`, phải hiện thực trên mock theo cấu trúc mới của task này) |
| Người làm | Codex hoặc Claude Code |

## Mục tiêu

Production dùng Postgres/Neon (`USE_MOCK_DB=false`) nhưng **trạng thái của chain mock vẫn nằm trong
`globalThis` của từng tiến trình Worker**. Hai nguồn sự thật lệch nhau: lịch sử giao dịch (Neon) ghi
whitelist `CONFIRMED`, còn trạng thái whitelist mà bước duyệt đọc lại chỉ nằm trong bộ nhớ một tiến trình.
Lập ở tiến trình A, duyệt ở tiến trình B (hoặc sau khi Worker khởi động lại) thì `isWhitelisted()` trả
`false`. Đây là lỗi ranh giới lưu bền, không phải lỗi Neon.

Sau task này: khi `USE_MOCK_DB=false`, **toàn bộ** trạng thái chain mock lưu trong Postgres, mọi tiến
trình đọc ghi cùng một trạng thái, có khoá đồng thời.

## Nguồn yêu cầu

Báo cáo của developer ngày 14/10 (chủ dự án chuyển), 10 yêu cầu và 8 tiêu chí nghiệm thu. Regression
thật: request `7cc67282-620d-4bef-bcbf-4e49cc031b93`, chain `mock`, ví
`0x5a5B0Ab8613bA0F16e257228e4109A8F611Ec4fd`, Neon có nhiều giao dịch whitelist `CONFIRMED` nhưng lúc
Kiểm soát viên duyệt báo ví chưa whitelist. Đã ghi trước ở sổ đăng ký: PA-07 (giới hạn chain mock).

## Hiện trạng đã đo (Supervisor, `dev` @ `615c7ef`)

```bash
grep -n "interface MockState" -A45 app/src/lib/ledger/mock.adapter.ts
# balances, whitelisted, frozen, totalSupply, nonce, initialSupplyMinted, spvWallet, wptPriceVnd,
# priceHydrated, paymentBalances, paymentAllowances, snapshots(balances, totalSupply, distributable,
# paid), lastSnapshotId, profitPool, settlementMode, navRate
grep -n "GLOBAL_KEY\|globalThis" app/src/lib/ledger/mock.adapter.ts
# state() dung globalThis.__bidvMockLedgerState__
grep -n "case 'mock'" -A16 app/src/lib/ledger/index.ts
# factory getLedger ghep createMockLedger voi readIssuePriceVnd; day la cho gan kho trang thai
grep -c "async " app/src/lib/ledger/mock.adapter.ts          # cac ham cua ILedgerPort tren mock
grep -c "it(" app/test/mock-ledger.test.ts                    # 59 ca kiem mock hien co
```

`MockState` có **17 trường**, đúng phạm vi developer liệt kê (whitelist, freeze, số dư WPT, tổng cung,
phát hành lần đầu, ví SPV, số dư và ủy quyền VNDB, giá, snapshot và claim, quỹ lợi nhuận, tất toán, NAV,
nonce). Không trường nào được bỏ sót.

## Quyết định thiết kế

**QĐ-1. Tách logic mock khỏi nơi giữ trạng thái.** `mock.adapter.ts` giữ nguyên logic nghiệp vụ hiện có,
nhưng đọc ghi trạng thái qua một cổng mới:

```ts
interface MockLedgerStateStore {
  read<T>(fn: (state: Readonly<MockState>) => T): Promise<T>;
  mutate<T>(fn: (state: MockState) => T): Promise<T>;   // nguyên tử, tuần tự hoá giữa mọi tiến trình
}
```

- Mỗi hàm của `ILedgerPort` trên mock gọi **đúng một** `read` hoặc **đúng một** `mutate`. Không được
  đọc ở một lời gọi rồi ghi ở lời gọi khác (đó chính là kiểu kiểm rồi ghi gây chạy trùng).
- Hàm bên trong `mutate` là đồng bộ, không `await`; mọi kiểm điều kiện (whitelist, đủ số dư, vượt tổng
  cung, đã phát hành lần đầu) nằm bên trong nó.
- Lỗi nghiệp vụ ném trong `mutate` thì **không ghi gì** (Postgres: rollback).

**QĐ-2. Hai hiện thực, chọn theo `USE_MOCK_DB`, không lùi âm thầm.**
- `true`: kho bộ nhớ (`globalThis`, như hiện nay). Ghi rõ trong mã và tài liệu: mất khi khởi động lại,
  chỉ cho local và kiểm thử.
- `false`: kho Postgres. **Lỗi database thì ném lỗi rõ ràng** (`LedgerError`, thông báo nói rõ không đọc
  ghi được trạng thái chain mock), tuyệt đối không lùi về bộ nhớ.
- Factory `getLedger` (case `'mock'`) là nơi duy nhất ghép kho vào `createMockLedger`, đúng chỗ đã ghép
  `readIssuePriceVnd`.

**QĐ-2b. Một cờ quyết định cả hai, không có trạng thái pha trộn.** `USE_MOCK_DB` quyết định đồng thời
kho dữ liệu nghiệp vụ (8 cổng lưu trữ) và kho trạng thái chain mock. Không có tổ hợp "nghiệp vụ ở bộ nhớ,
ledger ở Postgres" hay ngược lại. Hai chế độ vận hành, chủ dự án chọn bằng cách đổi biến trên dashboard
(có hiệu lực ngay, không cần build):

| Tình huống | Đặt | Kết quả |
|---|---|---|
| Bình thường | `USE_MOCK_DB=false` | Mọi thứ trong Postgres, nhất quán giữa các tiến trình |
| Database thật có sự cố, hoặc chủ động ngắt | `USE_MOCK_DB=true` | Mọi thứ trong bộ nhớ, **không mở bất kỳ kết nối database nào**, các luồng chain mock chạy được như trước OP-06. Giới hạn đã biết: dữ liệu mất khi khởi động lại và có thể lệch giữa các tiến trình Cloudflare |
| Database lỗi giữa chừng khi đang `false` | (không đổi) | Báo lỗi rõ ràng, không tự lùi về bộ nhớ (QĐ-2). Chủ dự án chủ động chuyển sang `true` nếu cần chạy tiếp |

Lý do không tự lùi: tự lùi chính là cơ chế tạo ra lỗi hiện tại (lịch sử thành công nhưng trạng thái
rỗng). Chuyển chế độ phải là quyết định có chủ đích.

**QĐ-3. Kho Postgres: một dòng trạng thái cho mỗi chain, khoá dòng khi ghi.**
- Bảng mới `MockLedgerState` (`chain` khoá chính, `version` int, `state` jsonb, `updatedAt`). Thêm vào
  `schema.prisma`, sinh lại `init.sql` và tệp nhúng bằng `npm run db:sql`.
- `read`: một `SELECT`. `mutate`: dùng `pgTransaction`, `SELECT ... FOR UPDATE`, chạy hàm, `UPDATE` tăng
  `version`, `COMMIT`. Dòng chưa có thì tạo bằng trạng thái mặc định (cùng mặc định với kho bộ nhớ).
- Số `bigint` lưu dạng chuỗi; `Set` lưu mảng đã sắp xếp; `Map` lưu đối tượng. Có hàm mã hoá và giải mã
  dùng chung, kiểm thử khứ hồi.
- Lý do chọn một dòng jsonb thay vì nhiều bảng chuẩn hoá: (a) mỗi thao tác chỉ 1 đến 3 câu lệnh, hợp giới
  hạn CPU gói Free vừa xử lý ở PR #49; (b) dùng lại nguyên logic mock nên bộ kiểm thử chung chạy được cho
  cả hai kho; (c) khoá dòng tuần tự hoá mọi thao tác ghi nên không thể phát hành hai lần, âm số dư, hay
  vượt tổng cung. Đánh đổi: không có ràng buộc SQL theo từng ví, chấp nhận vì đây là chain mô phỏng.
- Ghi cảnh báo trong log khi `state` vượt 512 KB (snapshot tích luỹ).

**QĐ-4. Bảng `Txn` không phải nguồn sự thật của mock.** `Txn` vẫn là lịch sử chỉ thêm. Không đọc `Txn`
để dựng lại trạng thái.

**QĐ-5. Chain thật không đổi.** `evm`, `hardhat-local`, `stellar` vẫn đọc trạng thái từ chuỗi. Bảng
`MockLedgerState` chỉ có dòng `chain` thuộc họ `mock`; adapter EVM không được đọc bảng này.

**QĐ-6. Làm mới toàn bộ database Neon (chủ dự án chốt 14/10, CH-1).** Không giữ, không suy diễn trạng
thái từ `Txn`. Không viết script xoá chọn lọc. Cách làm (runbook trong `docs/DEPLOYMENT.md`):
1. Tắt cache truy vấn của Hyperdrive trước (QĐ-7).
2. Trên Neon Console, mở SQL Editor của đúng database đang dùng, chạy
   `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`. (Cách thay thế: tạo branch mới rồi trỏ Hyperdrive
   sang; người làm ghi cả hai cách, khuyến nghị cách SQL vì không phải đổi Hyperdrive.)
3. Mở trang web một lần: ứng dụng tự tạo lại bảng và dữ liệu khởi tạo (đường chậm của khởi tạo).
4. Hệ quả đã biết: lịch sử của **cả** chain `evm` cũng mất; dự án Sepolia về `DRAFT`, lần duyệt Mint đầu
   tiên tự đối soát mốc phát hành từ chuỗi (OP-06 QĐ-5), số dư trên Sepolia không đổi vì nằm trên chuỗi.

Người làm phải kiểm trên Postgres cục bộ: sau `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`, request
đầu tiên dựng lại đủ bảng (gồm `MockLedgerState`) và dữ liệu khởi tạo, rồi chạy được luồng chain mock.

**QĐ-7. Tắt cache truy vấn của Hyperdrive (phát hiện khi viết spec, Supervisor đọc tài liệu 14/10).**
Hyperdrive **mặc định cache câu `SELECT` 60 giây** (thêm 15 giây phục vụ bản cũ trong lúc làm mới) và
**không xoá cache khi có câu ghi**. Hệ quả: request B đọc trạng thái vừa bị request A ghi có thể nhận kết
quả cũ tới hơn một phút. Với OP-07, `read` trạng thái chain mock có thể trả bản cũ sau `mutate`, đúng loại
lệch đang sửa; với dữ liệu nghiệp vụ hiện tại, danh sách và trạng thái yêu cầu cũng có thể hiển thị cũ.
- Chủ dự án tắt cache cho cấu hình Hyperdrive đang dùng (dashboard Hyperdrive, hoặc
  `npx wrangler hyperdrive update <id> --caching-disabled`). Làm **ngay**, không chờ OP-07.
- Người làm ghi vào `DEPLOYMENT.md` là điều kiện bắt buộc khi dùng Hyperdrive, kèm nguồn tài liệu.
- Tiêu chí trên bản deploy (điều kiện của chủ dự án) gồm phép thử: ghi ở trình duyệt A, đọc ngay ở trình
  duyệt B thấy giá trị mới.

## Việc cần làm

1. Cổng `MockLedgerStateStore`, kho bộ nhớ, refactor `mock.adapter.ts` theo QĐ-1 (giữ hành vi, 59 ca cũ
   xanh không sửa nội dung ca).
2. Kho Postgres theo QĐ-3, mã hoá và giải mã trạng thái, bảng mới.
3. Factory theo QĐ-2, không lùi âm thầm.
4. `seedMockLedger` và `resetMockLedger` (chỉ cho test và demo) chạy trên kho đang dùng; `resetMockLedger`
   trên kho Postgres chỉ cho phép khi chạy kiểm thử.
5. Bộ kiểm thử hợp đồng chung (contract test): cùng một bộ ca chạy cho kho bộ nhớ và kho Postgres
   (`TEST_DATABASE_URL`). Tối thiểu gồm mọi ca của `mock-ledger.test.ts` liên quan trạng thái.
6. Kiểm thử mô phỏng production: **hai thể hiện ledger độc lập** (mô phỏng hai tiến trình, không dùng
   chung bộ nhớ) cùng một Postgres.
7. Runbook làm mới database theo QĐ-6 và ghi chú cache Hyperdrive theo QĐ-7 trong `DEPLOYMENT.md`; kiểm
   trên Postgres cục bộ việc dựng lại từ schema rỗng.
8. Kiểm thử hồi quy `Txn` theo chain: `listTxns` Postgres lọc đúng chain, màn Mint truyền chain đang chọn
   (đã có, chỉ thêm ca giữ hành vi, không viết lại).
9. Tài liệu: `docs/DEPLOYMENT.md` (chain mock lưu ở đâu theo từng chế độ, cách đặt lại),
   `docs/guide.md`, `docs/tech-report.md`; đóng PA-07 trong sổ đăng ký (Supervisor làm).

## Ràng buộc

- Không đổi chữ ký `ILedgerPort`, không đổi nghiệp vụ trong `lib/bank`.
- Không đọc `Txn` để suy ra trạng thái ledger.
- Không lùi về bộ nhớ khi Postgres lỗi.
- Giữ kết quả PR #49: thao tác mock trong một request dùng kết nối chung của request; `mutate` dùng
  transaction (kết nối riêng). Đo số kết nối khi duyệt một Mint trên mock, ghi vào checkpoint.
- Checkpoint dán nguyên văn đầu ra lệnh đã chạy.

## Mức kiểm chứng: Cao

| Ca | Kiểm |
|---|---|
| 1 | Hai thể hiện A, B dùng chung Postgres: A whitelist ví, B đọc `isWhitelisted` là `true` và duyệt Mint thành công |
| 2 | "Khởi động lại": tạo thể hiện mới (xoá mọi bộ nhớ) sau khi ghi; whitelist, số dư WPT, tổng cung, `initialSupplyMinted`, ví SPV, số dư VNDB còn nguyên |
| 3 | Đồng thời: hai `mintInitialSupply` song song từ hai thể hiện, đúng một thành công; hai lệnh bán song song vượt số dư, không âm; Mint song song không vượt trần |
| 4 | Cùng địa chỉ trên `mock` và `evm` (hardhat-local) có trạng thái độc lập |
| 5 | `listTxns` chain `mock` chỉ ra lịch sử mock, chain `evm` chỉ ra lịch sử EVM |
| 6 | Lập duyệt trọn luồng qua Postgres với "khởi động lại" giữa bước lập và bước duyệt, dùng đúng ví hồi quy `0x5a5B...c4fd` |
| 7 | Bộ kiểm thử hợp đồng chạy xanh cho cả kho bộ nhớ và kho Postgres |
| 8 | Postgres lỗi (chuỗi kết nối sai, hoặc giả lập lỗi) thì thao tác mock ném lỗi rõ, không trả trạng thái rỗng |
| 9 | Đột biến: (a) cho `mutate` Postgres bỏ `FOR UPDATE` thì ca 3 đỏ; (b) cho factory lùi về bộ nhớ khi lỗi thì ca 8 đỏ; (c) đọc ở một lời gọi rồi ghi ở lời gọi khác trong `mintInitialSupply` thì ca 3 đỏ; (d) cho kho ledger mock luôn dùng Postgres bất kể cờ thì ca 11 đỏ |
| 10 | Dựng lại từ schema rỗng: sau `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` trên Postgres cục bộ, request đầu tiên tạo đủ bảng (gồm `MockLedgerState`) và dữ liệu khởi tạo, rồi luồng chain mock chạy được |
| 11 | **Chế độ ngắt database:** `USE_MOCK_DB=true`, không có `DATABASE_URL`, không có binding Hyperdrive (hoặc chuỗi kết nối trỏ tới địa chỉ không tồn tại): chạy trọn luồng chain mock (whitelist, nạp VNDB, lập và duyệt Mint, Burn, mua, bán) thành công, và kiểm thử khẳng định **không một `Client` của `pg` nào được tạo** |
| 12 | Không pha trộn: với mỗi giá trị của `USE_MOCK_DB`, kho nghiệp vụ và kho ledger mock luôn cùng loại (kiểm cả hai giá trị) |
| 13 | Bộ đầu cuối hiện có (Playwright chạy `USE_MOCK_DB=true`) vẫn xanh đủ số ca như trước task |

## Điều kiện hoàn thành

- [ ] Cổng kho trạng thái, refactor mock giữ nguyên hành vi, 59 ca cũ xanh không sửa nội dung.
- [ ] Kho Postgres với khoá dòng, mã hoá khứ hồi, không lùi về bộ nhớ (ca 8).
- [ ] Nhất quán giữa hai thể hiện và sau khởi động lại (ca 1, 2, 6).
- [ ] Đồng thời an toàn (ca 3) và đột biến đỏ đúng ca (ca 9).
- [ ] Phạm vi theo chain (ca 4, 5).
- [ ] Bộ kiểm thử hợp đồng chung xanh cho hai kho (ca 7).
- [ ] Runbook làm mới database và tắt cache Hyperdrive; dựng lại từ schema rỗng chạy được (ca 10).
- [ ] Chế độ ngắt database chạy trọn luồng mock không mở kết nối nào, không pha trộn hai kho, đầu cuối hiện có xanh (ca 11, 12, 13).
- [ ] **[Chủ dự án, sau merge]** Đã tắt cache Hyperdrive và làm mới database theo runbook; trên bản deploy: whitelist, lập Mint, đóng trình duyệt, mở lại, duyệt Mint thành công; ghi ở trình duyệt A, đọc ngay ở trình duyệt B thấy giá trị mới. Ghi request ID.
- [ ] Tài liệu cập nhật; bộ mặc định và bộ Postgres thật xanh; không có bí mật trong lịch sử commit.

## Không làm

- Không đổi adapter chain thật, không cache trạng thái chain thật vào database.
- Không làm phần đồng bộ giao diện khi đổi chain (task FE-27).
- Không chuẩn hoá trạng thái mock thành nhiều bảng.

## Câu hỏi cho chủ dự án (đã trả lời 14/10)

| Mã | Câu hỏi | Chủ dự án chốt |
|---|---|---|
| CH-1 | Dữ liệu chain mock đang có trên production: đặt lại hay giữ? | **Làm mới toàn bộ database Neon** (QĐ-6) |
