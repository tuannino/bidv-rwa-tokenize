# Báo cáo bàn giao — BE-09: Mở rộng lược đồ dữ liệu

| | |
|---|---|
| Task | BE-09 (Backend, S1, P0, 5 điểm) |
| Nhánh | `feat/data-schema`, tạo **từ `dev`** (`fdb7b55`) |
| Spec | `docs/be-09-data-schema/{requirements,design,tasks}.md` + bản giống hệt ở `.kiro/specs/be-09-data-schema/` |
| Commit | 8 commit, xem mục 1 |
| Phạm vi | **Chỉ lược đồ + cổng lưu trữ.** Không một dòng logic nghiệp vụ đọc ghi các bảng này |

`dev` đã kiểm lành trước khi tạo nhánh, theo `branching.md` §5:

```
$ git ls-tree -r --name-only dev | grep -c '^packages/'           → 73   (phải > 0)
$ git ls-tree -r --name-only dev | grep -c '^app/src/lib/ledger'  → 6    (phải > 0)
$ git ls-tree -r --name-only dev | grep -c AssetRegistry          → 0    (phải = 0)
```

---

## 1. Đã làm

Tám commit, mỗi commit một mục tiêu, mỗi commit đều build/test được:

| Commit | Nội dung |
|---|---|
| `ee8c87d` | `docs(spec): spec BE-09 mở rộng lược đồ dữ liệu` |
| `3b5918a` | `feat(db): bảng lệnh mua WPT` |
| `60aded3` | `feat(db): bảng kỳ chia và chi tiết chia lợi nhuận` |
| `08fa732` | `feat(db): bảng đợt tất toán và hồ sơ người nắm giữ` |
| `49f863c` | `feat(db): bảng mốc chạy tiến trình hẹn giờ` |
| `0624c30` | `chore(db): sinh lại init.sql từ lược đồ` |
| `8bea356` | `feat(store): bốn cổng lưu trữ cho ba luồng nghiệp vụ` |
| `fbb52fa` | `test(store): kiểm thử ràng buộc duy nhất ở cả hai bản lưu trữ` |

Diff so với `dev`: 28 file, +4413 / −126.

---

## 2. Sáu bảng và năm ràng buộc duy nhất

Ràng buộc duy nhất là phần quan trọng nhất của task này, nên liệt kê riêng. Cột "kiểm thật"
là truy vấn trên Postgres đã dựng, không phải đọc từ lược đồ:

| Bảng | Ràng buộc duy nhất | Chặn điều gì | Kiểm thật |
|---|---|---|:--:|
| `PurchaseOrder` | `txHash` | một mã giao dịch gắn cho hai lệnh (R1.4) | ✅ |
| `DistributionPeriod` | `periodKey` | mở cùng một kỳ hai lần (R2.2) | ✅ |
| `DistributionPayout` | `(periodId, investorWallet)` | **chia trùng** cho một nhà đầu tư (R2.4) | ✅ |
| `SettlementCase` | `(roundId, holderWallet)` | **chi trả hoặc đốt trùng** (R3.4) | ✅ |
| `KeeperRun` | `(jobName, periodKey)` | tiến trình hẹn giờ chạy trùng (R4.2) | ✅ |
| `SettlementRound` | — | (hồ sơ từng ví mới là chỗ cần chặn) | — |

Đo trên Postgres thật sau khi app tự áp lược đồ:

```
$ docker compose exec -T db psql -U bidv -d bidv_rwa -c "SELECT tablename, indexname
    FROM pg_indexes WHERE schemaname='public' AND indexdef LIKE 'CREATE UNIQUE%'
    AND tablename IN ('PurchaseOrder','DistributionPeriod','DistributionPayout',
                      'SettlementRound','SettlementCase','KeeperRun') ORDER BY 1,2;"

 DistributionPayout | DistributionPayout_periodId_investorWallet_key
 DistributionPayout | DistributionPayout_pkey
 DistributionPeriod | DistributionPeriod_periodKey_key
 DistributionPeriod | DistributionPeriod_pkey
 KeeperRun          | KeeperRun_jobName_periodKey_key
 KeeperRun          | KeeperRun_pkey
 PurchaseOrder      | PurchaseOrder_pkey
 PurchaseOrder      | PurchaseOrder_txHash_key
 SettlementCase     | SettlementCase_pkey
 SettlementCase     | SettlementCase_roundId_holderWallet_key
 SettlementRound    | SettlementRound_pkey
(11 rows)
```

Kiểu cột (R5.3), cũng đo thật chứ không đọc lược đồ:

```
 DistributionPeriod | openedAt      | timestamp with time zone |
 DistributionPeriod | totalAmount   | numeric                  | 78 | 0
 SettlementCase     | notifiedAt    | timestamp with time zone |
 SettlementCase     | payoutAmount  | numeric                  | 78 | 0
 ...  (12 dòng, mọi cột thời gian đều có timezone, mọi cột tiền đều numeric(78,0))
```

**Ba điểm thiết kế đáng để Supervisor xem:**

**(a) Ràng buộc duy nhất là chốt chặn, phép kiểm trong mã KHÔNG phải.** `IKeeperStore.startRun`
chèn thẳng một dòng và **không đọc trước**; `UniqueConstraintError` chính là tín hiệu "bản khác
đã nhận việc này". Test đếm số câu lệnh đã gửi để chốt điều đó bằng máy — có thêm một `SELECT`
là đỏ, vì `SELECT` rồi `INSERT` là hai bước mà hai instance cùng vượt qua được.

**(b) `transitionOrder` đặt điều kiện trạng thái TRONG câu `UPDATE`** và trả `null` khi không
dòng nào khớp. Đây là chỗ chặn "gửi giao dịch hai lần cho cùng một lệnh": đọc trạng thái rồi mới
ghi thì hai lời gọi đồng thời cùng thấy `CHECKING`, cùng kết luận được phép, rồi cùng gửi giao
dịch — nhà đầu tư bị trừ tiền hai lần.

**(c) `ensureSchema` giờ áp `init.sql` theo TỪNG câu lệnh trong SAVEPOINT riêng**, bỏ qua đúng
bốn mã lỗi "đã có rồi" (`42P07`, `42P06`, `42710`, `42701`). Lối cũ là "chưa có bảng `Txn` thì áp
cả file, có rồi thì thôi" — với lối đó, volume Postgres dựng trước BE-09 sẽ **mãi thiếu sáu bảng
mới**, và lỗi chỉ hiện ra lúc nghiệp vụ đầu tiên chạm vào bảng thiếu, trên máy Owner chứ không
trên máy vừa sửa mã. Cũng không dùng "sentinel là bảng mới nhất" vì đó là hằng số phải bảo trì
tay, và người thêm bảng thứ bảy sẽ không biết phải sửa nó. Tình huống này đã kiểm thật, xem mục 3.

---

## 3. Đối chiếu DoD

| DoD (requirements §5) | Đạt? | Bằng chứng |
|---|:--:|---|
| `npx prisma validate` không lỗi | ✅ | `The schema at prisma/schema.prisma is valid 🚀` |
| `init.sql` sinh lại từ lược đồ, không sửa tay | ✅ | `npm run db:sql`; `git diff --numstat` cho **151 thêm / 0 xoá** |
| `docker compose up` khởi tạo cơ sở dữ liệu thành công từ đầu | ✅ | Mục 3.1 |
| Cổng lưu trữ đủ hàm cho 4 nhóm bảng, hiện thực ở cả hai bản | ✅ | 4 port × (1 bản bộ nhớ + 1 bản Postgres) + 5 factory |
| Test: hai bản cùng từ chối khi vi phạm ràng buộc duy nhất | ✅ | Mục 3.2 |
| `bash scripts/run-local-all.sh` xanh toàn bộ | ✅ | 6/6 mục PASS, 190 test app |

| Yêu cầu chức năng | Đạt? | Ghi chú |
|---|:--:|---|
| R1.1 đủ cột lệnh mua | ✅ | |
| R1.2 trạng thái theo mô hình BE-02 | ✅ | 7 giá trị lấy nguyên từ `purchase.state.ts` của nhánh BE-02 — xem D1 |
| R1.3 chỉ mục theo ví và theo trạng thái | ✅ | `(investorWallet, createdAt)`, `(status, createdAt)` |
| R1.4 chặn gửi giao dịch hai lần | ✅ | `txHash` duy nhất **+** khoá lạc quan ở `transitionOrder` |
| R2.1–R2.4 kỳ chia và chi tiết chia | ✅ | |
| R3.1–R3.4 tất toán, **bốn** trạng thái | ✅ | 4 cột thời điểm, 2 cột mã giao dịch — xem D3 |
| R4.1–R4.2 mốc chạy hẹn giờ | ✅ | |
| R5.1 không sửa/xoá cột bảng cũ | ✅ | 0 dòng xoá trong `init.sql`; test kiểm 6 bảng cũ vẫn còn |
| R5.2 sinh lại `init.sql` bằng công cụ | ✅ | |
| R5.3 `Decimal(78,0)` + `Timestamptz(3)` | ✅ | Đo trên Postgres thật |
| R5.4 hiện thực ở cả hai bản | ✅ | |
| R5.5 bản bộ nhớ giữ đủ ràng buộc duy nhất | ✅ | Mục 3.2 |

### 3.1. `docker compose up` từ cơ sở dữ liệu rỗng — và từ cơ sở dữ liệu CŨ

Kiểm hai tình huống, vì tình huống thứ hai mới là tình huống Owner đang có:

**Tình huống 1 — `docker compose up` đầy đủ, volume rỗng hoàn toàn:**

```
$ docker compose down -v                    # xoá volume pgdata
$ docker volume ls | grep -c pgdata  → 0    # sạch
$ docker compose up --build

  chain  Up (healthy)      ← deploy contract xong, ghi addresses.json
  db     Up (healthy)
  web    Up                ← next start, USE_MOCK_DB=false

$ curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/              → 200
$ curl -s -o /dev/null -w '%{http_code}' 'http://localhost:3000/api/txns?…'  → 200

$ docker compose exec -T db psql -U bidv -d bidv_rwa -c '\dt'
  12 bảng: AuditLog, DistributionPayout, DistributionPeriod, Investor, KeeperRun,
           Permission, PurchaseOrder, Role, RolePermission, SettlementCase,
           SettlementRound, Txn
```

`next build` trong Docker chạy xong bình thường, **không** OOM (`docker info` báo
`Total Memory: 1.913GiB`).

**Luồng mint vẫn chạy sau khi refactor `postgres.store.ts`** — đây là phép kiểm hồi quy quan
trọng nhất, vì BE-09 đã rút pool và `ensureSchema` ra khỏi file đó:

```
$ curl -X POST /api/investors -d '{"chain":"hardhat-local","wallet":"0x7099…79C8"}'
  {"ok":true, "whitelisted":true, "status":"CONFIRMED", "txHash":"0x20abe38…"}
$ curl -X POST /api/mint      -d '{"chain":"hardhat-local","wallet":"0x7099…79C8","amount":"250"}'
  {"ok":true, "status":"CONFIRMED", "balanceAfter":"250", "txHash":"0xd04a0ab…"}

$ SELECT "operation","status","amount","createdAt" FROM "Txn" ORDER BY "createdAt";
   whitelist | CONFIRMED |     | 2026-09-17 18:06:01.258+00
   mint      | CONFIRMED | 250 | 2026-09-17 18:06:10.18+00     ← có offset +00: timestamptz đúng
$ SELECT count(*) FROM "AuditLog";  → 4
```

**Tình huống 2 — volume dựng bằng lược đồ CŨ, đã có dữ liệu:**

```
$ docker compose down -v && docker compose up -d db
$ git show dev:app/prisma/init.sql | docker compose exec -T db psql -U bidv -d bidv_rwa -q
$ # đếm bảng → 6 ; đếm bảng BE-09 → 0
$ docker compose exec -T db psql ... -c "INSERT INTO \"Txn\" ... VALUES ('cu-1', ...)"

$ cd app && TEST_DATABASE_URL=... npm test      → 108/108 xanh

$ # đếm bảng BE-09  → 6      (đã bổ sung)
$ SELECT "id" FROM "Txn"     → cu-1   (dữ liệu cũ còn nguyên)
```

### 3.2. Test — "cả hai bản" kiểm bằng ba lớp

`app/test/store-constraints.test.ts`. "Cả hai bản" không kiểm được bằng một cách duy nhất, vì
`run-local-all.sh` không có Postgres, nên chia ba lớp:

| Lớp | Kiểm gì | Khi nào chạy |
|---|---|---|
| **1. Lược đồ SQL** | Đọc `prisma/init.sql` THẬT, đối chiếu `UNIQUE_CONSTRAINTS` và `FOREIGN_KEYS` theo **cả hai chiều**, kiểm `TIMESTAMPTZ(3)`, `DECIMAL(78,0)`, các chỉ mục R1.3, và bốn cột thời điểm của `SettlementCase` | luôn |
| **2. Hành vi** | Cùng một bộ ca kiểm chạy trên mọi bản có sẵn — bản nào dễ tính hơn là đỏ ngay | bộ nhớ: luôn. Postgres thật: khi có `TEST_DATABASE_URL` |
| **3. Quy lỗi driver** | Bơm hàm truy vấn giả ném lỗi đúng hình dạng `pg` (`code: '23505'` / `'23503'`), xác nhận bản Postgres quy về **cùng lớp lỗi** mà bản bộ nhớ ném; và đếm số câu lệnh đã gửi để chốt hai tính chất ở mục 2(a) và 2(b) | luôn |

```
$ npm test                                          →  69 ca (bộ nhớ)
$ TEST_DATABASE_URL=... npx vitest --run test/store-constraints.test.ts
                                                    → 108 ca (thêm bản Postgres THẬT)
```

**Lớp 1 kiểm hai chiều là có chủ ý.** Chiều thuận (mã → SQL) bắt trường hợp `UNIQUE_CONSTRAINTS`
khai một ràng buộc không tồn tại, tức bản Postgres nhận hai dòng trùng trong khi bản bộ nhớ từ
chối. Chiều nghịch (SQL → mã) bắt trường hợp thêm ràng buộc vào lược đồ mà quên khai trong mã,
tức bản bộ nhớ không kiểm ràng buộc đó chút nào.

**Mọi ca từ chối đều kiểm luôn "trạng thái không đổi"**, không chỉ kiểm có ném lỗi: một hiện thực
ghi trước rồi mới kiểm cũng ném lỗi, mà dữ liệu đã hỏng. Ca `lô có một dòng trùng thì KHÔNG dòng
nào được ghi` đặt ví hợp lệ **trước** dòng trùng, đúng chỗ mà hiện thực ghi dần từng dòng sẽ để lại.

**Đã kiểm test có "cắn" thật** — phá từng chốt chặn rồi xem có đỏ (đã hoàn nguyên hết):

| Phá gì | Kết quả |
|---|---|
| Bỏ phép kiểm trùng ở `memory.keeper.store.ts` | 2 ca đỏ |
| Đổi `createPayouts` bản bộ nhớ thành ghi dần + bỏ kiểm trùng | 2 ca đỏ |
| Đổi `CREATE UNIQUE INDEX` thành `CREATE INDEX` trong `init.sql` | 1 ca đỏ |

### 3.3. `run-local-all.sh`

```
  Đạt:     6
    PASS  luật kiến trúc (có cảnh báo)          ← cảnh báo có sẵn từ trước, không phải của BE-09
    PASS  LỚP 1 - SPEC TEST CONTRACT EVM
    PASS  LỚP 1 - SPEC TEST CONTRACT SOROBAN
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST                          ← 190 test (121 cũ + 69 mới)
  Không đạt: 0
```

---

## 4. Cách chạy / kiểm thử

```bash
# 1. Kiểm chứng cục bộ đầy đủ (không cần Postgres)
bash scripts/run-local-all.sh

# 2. Lược đồ
cd app
DATABASE_URL='postgresql://bidv:bidv@localhost:5432/bidv_rwa' npx prisma validate
DATABASE_URL='postgresql://bidv:bidv@localhost:5432/bidv_rwa' npm run db:sql
git diff --stat app/prisma/init.sql          # phải RỖNG: init.sql đã đúng bản sinh ra

# 3. Chạy thêm lớp 2 với Postgres THẬT (39 ca nữa)
docker compose up -d db
cd app
TEST_DATABASE_URL='postgresql://bidv:bidv@localhost:5432/bidv_rwa' npx vitest --run test/store-constraints.test.ts

# 4. Dựng lại cơ sở dữ liệu từ đầu
docker compose down -v && docker compose up -d db
docker compose exec -T db psql -U bidv -d bidv_rwa -c '\dt'   # rỗng
# ...chạy test hoặc mở app -> ensureSchema áp init.sql
```

⚠️ `npx prisma validate` cần `DATABASE_URL` trong môi trường. Prisma đọc `.env` chứ **không** đọc
`app/.env.local`, nên truyền thẳng vào lệnh như trên. Giá trị chỉ dùng để phân tích lược đồ, không
kết nối.

---

## 5. DEVIATION so với spec

Bốn mục. D1 và D2 là **hệ quả của việc BE-02 đã làm trước một phần phạm vi BE-09** — cần
Supervisor chốt để lần merge không mất việc của bên nào.

### D1 — Bảng lệnh mua: BE-02 đã khai trước trên nhánh của họ

`tasks.md` dòng 5 nói: làm bước 1 sau khi BE-02 đã chốt mô hình trạng thái, chưa chốt thì để
dành. **Đã chốt rồi**, nhưng nằm trên nhánh chưa merge:

```
$ git log --oneline dev..origin/feat/purchase-orders | tail -1
2098763 feat(purchase): mô hình trạng thái lệnh mua WPT
$ git show origin/feat/purchase-orders:docs/CHECKPOINT_BE02.md | grep "D2 —"
### D2 — Khai trước bảng lệnh mua (phạm vi BE-09)
```

Checkpoint BE-02 tự ghi: *"BE-09 tiếp nhận hoặc thay thế"*. Nên BE-09 làm bước 1 đầy đủ, lấy
**mô hình trạng thái** từ BE-02 không sửa một giá trị (R1.2), và theo tiền lệ BE-08 (cũng khai
lại các quyền `order:*` mà BE-02 đã khai trước) là mỗi nhánh lấy nền từ `dev` rồi làm đủ phạm vi
của mình.

Ba chỗ hình dạng của BE-09 **khác** bản BE-02 đang có, đều có lý do, và đều là chỗ Supervisor cần
chốt trước khi merge:

| | BE-02 (nhánh `feat/purchase-orders`) | BE-09 (nhánh này) | Vì sao |
|---|---|---|---|
| Kiểu cột trạng thái | `enum OrderStatus` của Prisma | `String` + union TS | **Spec BE-09 QĐ-4 yêu cầu vậy.** Đánh đổi: cơ sở dữ liệu không tự chặn giá trị lạ nữa, nên bù bằng `assertOrderStatus` chạy ở **cả hai** bản + 6 ca kiểm (task 7.6) |
| `txHash` | chỉ có chỉ mục | **duy nhất** | R1.4 đòi ràng buộc. Postgres coi mỗi NULL là khác nhau nên lệnh chưa gửi giao dịch không đụng ràng buộc |
| Nơi khai `IOrderStore` | trong `store.port.ts`, gộp `IBankStore = ITxnStore & IOrderStore` | file riêng `order.store.port.ts`, `getOrderStore()` riêng | **Spec BE-09 QĐ-1 yêu cầu tách.** `ITxnStore` giữ nguyên tên và nguyên chữ ký nên `getStore()` hiện tại không phải sửa |

Sáu method của `IOrderStore` giữ **đúng tên và đúng chữ ký** của BE-02 (`createOrder`,
`findOrder`, `transitionOrder`, `attachOrderTxHash`, `listOrders`, `expireOrders`), nên khi merge,
`purchase.service.ts` của BE-02 chỉ phải đổi `getStore()` thành `getOrderStore()`. `expireOrders`
thêm một tham số **tuỳ chọn** `reason`, không phá lời gọi cũ.

### D2 — Bỏ `executedAt`, giữ tên cột `vndAmount` / `reason` thay vì `paymentAmount` / `failureReason`

`design.md` mục 2 nêu bảng cột gồm `paymentAmount`, `failureReason`, `executedAt`. Đã dùng
`vndAmount`, `reason`, và **không** có `executedAt`:

- **`vndAmount` / `reason`:** `purchase.service.ts` của BE-02 đang đọc ghi đúng hai tên này. Đổi
  tên là làm hỏng mã đang chạy của họ, để lấy một cái tên không rõ hơn.
- **`executedAt`:** `R1.1` (yêu cầu chuẩn tắc) chỉ đòi "thời điểm tạo và cập nhật", không đòi
  `executedAt`; chỉ bảng cột trong `design.md` có. Không có nghiệp vụ nào ghi cột đó, nên nó sẽ
  **luôn rỗng**, và `updatedAt` tại lúc trạng thái thành `COMPLETED` đã mang đúng thông tin ấy.
  Một cột không ai ghi tệ hơn không có cột: người đọc sau sẽ tin nó có dữ liệu.

Supervisor muốn có `executedAt` thì nói, thêm là một dòng lược đồ + sinh lại `init.sql`.

### D3 — `SettlementCase` có **bốn** cột thời điểm nhưng chỉ **hai** cột mã giao dịch

`tasks.md` 3.2 nói "đủ **bốn** cặp thời điểm và mã giao dịch". Đã làm 4 cột thời điểm nhưng chỉ 2
cột mã giao dịch — đúng theo bảng cột tường minh ở `design.md` mục 2 (`notifiedAt`, `confirmedAt`,
`paidAt`, `paidTxHash`, `burnedAt`, `burnTxHash`) và đúng theo R3.3 ("mã giao dịch tương ứng **nếu
có**").

Lý do: thông báo là việc ngoài chuỗi, và xác nhận của nhà đầu tư (`settlement:confirm`) được ghi
nhận ở hệ thống chứ không trên chuỗi — hai bước đó **không sinh giao dịch nào**. Thêm hai cột luôn
rỗng cho cân đối là mời người đọc sau đi tìm giao dịch không tồn tại. `markCase` ném
`StoreUsageError` nếu ai truyền `txHash` cho hai bước đó, thay vì nhận rồi bỏ đi im lặng.

### D4 — Bản bộ nhớ của bốn cổng mới KHÔNG giới hạn số dòng

`memory.store.ts` (có từ trước) chặn ở `MAX_ROWS = 500` để không rò bộ nhớ. Bốn bản mới **không**
làm vậy, và đây là chủ ý: Postgres không bao giờ bỏ dòng, nên bỏ dòng ở bản bộ nhớ là thêm một
khác biệt hành vi giữa hai bản — đúng thứ QĐ-3 muốn chặn. Triệu chứng nếu làm theo `MAX_ROWS`: một
hồ sơ chia "biến mất", `markPayout` trả `null`, và không lý do nào giải thích được.

Bù lại: `assertBulkSize` chặn lô quá `MAX_BULK_ROWS = 1000` dòng ở **cả hai** bản, nên một lời gọi
không thể nạp lượng dữ liệu bất kỳ vào bộ nhớ.

---

## 6. Câu hỏi mở

### Q1 — Nhánh BE-02 và nhánh này cùng sửa bốn file. Merge theo hướng nào?

`app/prisma/schema.prisma`, `app/prisma/init.sql`, `app/src/lib/store/store.port.ts`,
`app/src/lib/store/index.ts`. Cả hai nhánh đều lấy nền từ `dev` nên đây là xung đột thật, phải có
người quyết.

- **(a) Lấy bản BE-09 làm chuẩn** (đề nghị): đúng như checkpoint BE-02 viết "BE-09 tiếp nhận hoặc
  thay thế", và đúng phân chia phạm vi trong spec. Việc phải làm sau merge: `purchase.service.ts`
  đổi `getStore()` → `getOrderStore()`, và bỏ `IBankStore` cùng `enum OrderStatus` khỏi bản BE-02.
  Ước lượng: một commit nhỏ.
- **(b) Lấy bản BE-02 làm chuẩn cho bảng lệnh mua**, BE-09 chỉ giữ 5 bảng còn lại. Khi đó DoD
  "cổng lưu trữ đủ hàm cho 4 nhóm bảng" của BE-09 không còn đúng, và QĐ-1 (tách cổng) bị bỏ.

**Cũng va nhau ở `docs/tech-report.md`:** nhánh này bump 1.5 → **1.6**, nhánh BE-08
(`feat/rbac-actions`) cũng bump 1.5 → **1.6**. Nhánh nào merge sau phải thành 1.7. Không tự đoán
thứ tự merge nên để nguyên 1.6 ở đây.

### Q2 — Địa chỉ ví: chuẩn hoá ở một biên duy nhất cho toàn hệ?

Ràng buộc duy nhất của Postgres so chuỗi **chính xác**, nên `0xAb…` và `0xab…` là hai dòng khác
nhau với cơ sở dữ liệu dù là cùng một ví EVM. Nghĩa là ràng buộc `(periodId, investorWallet)` có
một chỗ hở: cùng một ví viết hai cách vẫn vào được hai dòng, tức **vẫn chia trùng được**.

Đã làm trong phạm vi BE-09:
- `assertNoDuplicateWallet` chặn trường hợp hay xảy ra nhất — cùng một lô có hai cách viết.
- Tra theo khoá nghiệp vụ (`markPayout`, `markCase`) so **chính xác**, khớp đúng ràng buộc; còn
  lọc để hiển thị (`listPayouts`, `listOrders`) so **không phân biệt hoa thường**, giống
  `listTxns` đang làm.

**Chưa làm, và cố ý không tự làm:** hạ hết địa chỉ về chữ thường trước khi ghi. Địa chỉ Stellar là
base32 **chữ hoa** (`GABC…`), hạ chữ thường là làm sai địa chỉ. Chuẩn hoá đúng phải theo họ chuỗi,
và chỗ đặt nó là một biên duy nhất cho toàn hệ (Zod schema ở `lib/bank/schemas.ts` chẳng hạn), lớn
hơn phạm vi BE-09.

**Đề nghị:** mở một task riêng "chuẩn hoá địa chỉ ví ở một biên duy nhất". Nếu Supervisor muốn làm
luôn trong BE-09 thì nói rõ, nhưng nó sẽ chạm cả `lib/bank/schemas.ts` và `ITxnStore`.

### Q3 — Danh sách trạng thái của kỳ chia, đợt tất toán và mốc chạy do tôi đặt. Chốt lại?

R3.2 nêu tường minh bốn trạng thái tất toán, nhưng **không tài liệu nào** nêu trạng thái của
`DistributionPeriod`, `DistributionPayout`, `SettlementRound`, `KeeperRun`. Đã tìm cả repo, kể cả
`.kiro/specs/p7-*`, `p12-*` và các contract: `ProfitDistributor.Distribution` **không có cột
trạng thái** nào, `Redemption` chỉ có `rate` + `paused`. Nên phải tự đặt:

| Bảng | Giá trị | Lý do đặt như vậy |
|---|---|---|
| `DistributionPeriod` | `OPEN → DISTRIBUTING → COMPLETED` | Không có `FAILED`: lô lỗi là trạng thái của từng hồ sơ, một kỳ có lô lỗi thì phải chạy lại lô đó chứ không "thất bại" như một khối. `FAILED` ở cấp kỳ sẽ mời người sau bỏ cả kỳ khi mới lỗi một lô |
| `DistributionPayout` | `PENDING → SENT → PAID`, hoặc `SENT → FAILED` | `SENT` tách khỏi `PAID` là **bắt buộc**: giữa lúc gửi giao dịch và lúc có biên nhận, hồ sơ đã có `txHash` mà chưa biết kết quả. Gộp lại thì tiến trình chết giữa chừng để lại hồ sơ trông như đã chi xong, và lần chạy lại sẽ chi lần thứ hai |
| `SettlementRound` | `INITIATED → IN_PROGRESS → COMPLETED` | Ứng với `initiatedAt` / `completedAt` mà R3.1 đòi |
| `KeeperRun` | `RUNNING → SUCCESS`, hoặc `RUNNING → FAILED` | |

**Chỗ tôi thấy còn thiếu mà không tự thêm:** `SettlementCase` chỉ có đúng bốn trạng thái theo
R3.2, nên một hồ sơ mà giao dịch chi trả **thất bại** không phân biệt được với hồ sơ **chưa thử
chi trả** — cả hai đều đứng ở `CONFIRMED` với `paidAt` rỗng. Thêm `PAY_FAILED` là thêm trạng thái
thứ năm, trái với chữ "bốn" trong R3.2 và `design.md` mục 4, nên **không tự thêm**. Xin Supervisor
chốt: giữ bốn, hay cho phép năm?

### Q4 — Chưa có bảng chuyển tiếp cho ba nhóm bảng mới. Đúng ý chưa?

Đã cố ý **không** viết bảng chuyển tiếp (kiểu `ORDER_TRANSITIONS` của BE-02) cho
`DistributionPeriod`, `DistributionPayout`, `SettlementCase`, `SettlementRound`: đó là quy tắc
nghiệp vụ thuộc BE-04/BE-05/BE-06, và requirements §4 nói rõ logic nghiệp vụ ngoài phạm vi BE-09.
Cụ thể `markCase` **không** kiểm thứ tự bốn bước — gọi `BURNED` ngay sau `NOTIFIED` là được.

Hai cách hiểu:
- **(a)** Đúng như đang làm: cổng lưu trữ chỉ giữ **danh sách giá trị hợp lệ**, thứ tự là việc của
  nghiệp vụ.
- **(b)** Cổng lưu trữ giữ luôn bảng chuyển tiếp, như BE-02 đã làm cho lệnh mua.

**Đề nghị (a)**, vì thứ tự bốn bước tất toán còn phụ thuộc quyết định nghiệp vụ chưa có (ví dụ:
nhà đầu tư không xác nhận thì có được cưỡng chế đốt không?). Nhưng nếu Supervisor muốn (b) cho
thống nhất với BE-02 thì đây là chỗ thêm, và thêm bây giờ rẻ hơn thêm sau.

### Q5 — Không tìm thấy "diagram P2" trong repo

`design.md` mục 4 và `tasks.md` 3.2 đều dẫn "diagram P2" làm nguồn cho mô hình bốn trạng thái. Đã
tìm cả repo: chỉ có **ba chỗ tham chiếu** tên đó (`be-08/design.md` L9, `be-09/design.md` L102,
`be-09/tasks.md` L28), **không file nào định nghĩa nó**.
`docs/20260902_kien_truc_he_thong_3_2.html` không phải nguồn (đếm 0 lần xuất hiện "tất toán",
"settlement", "Redemption", "đốt", "WPT").

Nên đã làm theo R3.2 và bảng cột ở `design.md` mục 2 — hai chỗ tường minh nhất. Nếu diagram P2 có
thật ở đâu đó thì xin gửi, để đối chiếu lại tên trạng thái và thứ tự bước.

### Q6 — Hai mô hình tất toán đang cùng tồn tại trong repo

`.kiro/specs/p12-redemption/` mô tả **nhà đầu tư tự `redeem`** (`Redemption.rate` / `fund` /
`paused` / `quote` / `redeem`), còn BE-08 + BE-09 mô tả **ngân hàng điều phối theo đợt**
(`SettlementRound` + bốn trạng thái + `snapshotId` + `navRate`). Bảng của BE-09 chỉ đỡ được mô
hình thứ hai.

Ngoài ra `ILedgerSettlement` có `setSettlementMode` / `navRate` nhưng `evm.adapter` vẫn ⏳ vì chưa
biết nối vào contract nào — `Redemption.paused` thì **ngược hướng** với "bật giai đoạn tất toán".
BE-09 không chạm việc này, chỉ nêu để BE-04 không phải phát hiện lại.

---

## 7. Việc KHÔNG làm, có chủ ý

Đối chiếu mục "Việc KHÔNG được làm" của `tasks.md`:

| Điều cấm | Tuân thủ | Kiểm bằng |
|---|:--:|---|
| Không sửa/xoá cột bảng đang có | ✅ | `git diff --numstat app/prisma/init.sql` → `151  0` |
| Không sửa `init.sql` bằng tay | ✅ | Sinh lại rồi `git diff` rỗng |
| Không dùng Prisma Client lúc chạy | ✅ | `git grep -l "generated/prisma" app/src` → rỗng |
| Không để bản bộ nhớ dễ tính hơn | ✅ | Lớp 2 chạy cùng bộ ca kiểm trên cả hai bản |
| Không viết logic nghiệp vụ | ✅ | Không file nào ngoài `lib/store/` bị sửa; không có bảng chuyển tiếp, không có `can()` |
| Không nối chuỗi vào SQL | ✅ | Mọi GIÁ TRỊ là `$n`; chỉ tên cột được nội suy, và tên cột đến từ hằng số trong mã. Có một ca kiểm bơm chuỗi `"; DROP TABLE …"` và xác nhận nó nằm trong `params`, không nằm trong SQL |

---

## 8. Tự đánh giá 3 LUẬT kiến trúc

- [x] **Mọi tương tác chain đi qua `ILedgerPort`** — BE-09 không chạm tầng ledger. `git grep -n "from 'viem'" app/src/lib/store` → rỗng. Cổng lưu trữ nhận `snapshotId` như một số, không tự đi đọc chuỗi.
- [x] **Mọi thao tác ký đi qua `ISigner`** — không file nào của BE-09 nhắc tới khoá hay ký.
- [x] **Mọi kiểm quyền đi qua RBAC `can()`** — cổng lưu trữ **không** kiểm quyền, và đó là đúng chỗ: guard đặt ở tầng nghiệp vụ trên các action `order:*`, `distribution:*`, `settlement:*` mà BE-08 đã khai. `git grep -nE "role ===" app/src/lib/store` → rỗng.

`scripts/verify-arch-rules.sh` PASS (cảnh báo còn lại có sẵn từ trước BE-09).

---

## 9. Ghi chú bảo trì tài liệu

Theo `tech-report-maintenance.md`:

- **Mục 3.5** viết lại: bảng năm cổng + hàm chính, bảng sáu bảng dữ liệu và ràng buộc duy nhất,
  mục "Lưu ý khi phát triển" (7 gạch đầu dòng), mục "Cách mở rộng" (4 bước).
- **Mục 4.2 bước 8** và **4.3 bước 5**: đổi từ "cần tạo" sang trỏ vào cổng đã có, kèm nhắc đừng
  thay ràng buộc duy nhất bằng phép kiểm trước khi ghi.
- **Metadata đầu file**: 1.5 → 1.6, ngày, nhánh, phase. Xem va chạm phiên bản ở Q1.
- **Cây thư mục 1.4**: không phải sửa — `app/src/lib/` ở đó ghi "★ LÕI — xem Phần 3", và
  `prisma/` ghi "schema.prisma + init.sql", cả hai vẫn đúng.
- **Không đánh số lại** mục nào (`tech-report-maintenance.md` đang tham chiếu "Phần 3.6" và
  "Phần 3.8").
