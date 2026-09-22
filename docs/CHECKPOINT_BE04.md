# Báo cáo bàn giao — Task BE-04: Phát hành một lần và giá cấu hình được

| | |
|---|---|
| Mã task | BE-04 |
| Nhánh | `feat/issuance-and-config`, tạo **từ `dev`** (`59fa611`) |
| Spec | `docs/be-04-issuance-config/{requirements,tasks}.md` (không có `design.md`) |
| Tiến độ | Bước 0–6 xong (6/6). Chờ Supervisor nghiệm thu — Kiro **không** merge vào `dev` |

> **Quy tắc viết checkpoint:** `.kiro/steering/checkpoint.md`.
> Kiểm bằng máy: `node scripts/check-checkpoint.mjs docs/CHECKPOINT_BE04.md docs/be-04-issuance-config/requirements.md`

---

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md`) | | Bằng chứng |
|---|---|---|---|
| 1 | Ba bảng mới + cột `isConfig`; dựng lại cơ sở dữ liệu từ đầu thành công | ✅ | mục 3.1 · 3.2 |
| 2 | Sau khi đặt giá, giá trong cơ sở dữ liệu bằng giá `quotePurchase` trả về | ✅ | mục 3.3 (ca 1) · 4.1 |
| 3 | Đẩy giá xuống ledger thất bại thì cơ sở dữ liệu không đổi | ✅ | mục 3.3 (đột biến 1) · 4.1 |
| 4 | Tắt `isConfig` thì từ chối dù vai có `treasury:manage` | ✅ | mục 3.3 (đột biến 2) · 6 |
| 5 | Phát hành một lần đúng tổng cung từ `Project`; lần hai bị từ chối | ✅ | mục 3.4 (ca 4) · 4.2 |
| 6 | Không còn 20.000.000 viết cứng; không nơi nào đọc hằng số giá trực tiếp ngoài `getIssuePrice` | ✅ | mục 3.5 · 5 (SL-1) |
| 7 | Đổi giá mặc định, test vẫn xanh | ✅ | mục 3.6 (ca 5) |
| 8 | `run-local-all.sh` xanh | ✅ | mục 3.7 |

**Kết luận:** 8 ✅ · 0 🔶 · 0 ❌

### 0.2 Việc cần Owner quyết

Không có mục nào **chặn** nghiệm thu. Bốn việc cần Owner xác nhận là **đúng ý** hay không, vì
chúng lệch hoặc mở rộng so với chữ trong spec — chi tiết ở mục 5:

- **CHM-1 — `isConfig` đọc từ bảng TRONG MÃ**, không đọc cột `Role.isConfig`. Spec cấm chuyển
  phân quyền sang cơ sở dữ liệu (thuộc AU-02), nên cột mới chỉ là **đích** cho AU-02.
- **CHM-2 — `Project` duy nhất theo `(tokenSymbol, chain)`** và dữ liệu khởi tạo nạp dự án cho
  **cả `mock` và chuỗi mặc định**. Spec chỉ nói "dự án WPT tổng cung 20.000.000".
- **CHM-3 — `listConfigHistory` không bảo đảm thứ tự** giữa hai lần ghi trùng mốc phần nghìn
  giây. Có cần cột số thứ tự để có thứ tự tuyệt đối không?
- **CHM-4 — `wptToVnd` đổi chữ ký** thành `wptToVnd(amount, issuePriceVnd)` thay vì đọc giá bên
  trong, để `lib/bank/issuance.ts` không phải thành `server-only`.

---

## 1. Đã làm

Bảy commit, mỗi commit một mục tiêu, mỗi commit ở trạng thái build/test được:

| Commit | Bước | Mục tiêu |
|---|---|---|
| `d6be65b` | 0 | Nhận spec; `MC-02` → `done` (sót lại từ PR #22), `FE-07` → `planned`, `BE-04` → `inProgress` |
| `4a47dfd` | 1 | Ba bảng + cột `isConfig`, hai cổng lưu trữ (mỗi cổng hai bản), **một** nguồn dữ liệu khởi tạo |
| `ea3c48a` | 2 | `setPurchasePrice` ở `ILedgerPurchase` + cả ba adapter |
| `7217226` | 3 | `config.service.ts`, `assertCanConfigure`, chuyển `issuance.ts`/`portfolio.service.ts` sang giá cấu hình |
| `9c73fa4` | 4 | `issueInitialSupply` đọc tổng cung từ `Project`, khoá lạc quan chống phát hành hai lần |
| `96b5edc` | 4 | Đổi `mintTokens` → `mintToInvestorDirect`, ghi rõ là đường nền cho bản trình diễn |
| `1cbbe64` | 5 | Test đọc giá từ nguồn chung; đổi giá mặc định không làm đỏ test |

Đo phạm vi:

```
$ git log --oneline dev..HEAD | wc -l
7
$ git diff --stat dev...HEAD | tail -1
 44 files changed, 3646 insertions(+), 62 deletions(-)
```

**Ba thứ mới đáng chú ý nhất:**

1. **`ILedgerPurchase.setPurchasePrice`** — trước BE-04 `ILedgerPort` chỉ có đường **đọc** giá
   (`quotePurchase`), không có đường **đặt**. Thiếu nó thì ghi giá mới vào cơ sở dữ liệu tạo ra hai
   con số: nhà đầu tư **thấy** giá mới và bị **trừ** theo giá cũ.
2. **`lib/store/seed-data.ts`** — một nguồn dữ liệu khởi tạo cho **cả hai** bản lưu trữ. Không con
   số nào gõ tay ở đó: giá/tổng cung/ngưỡng nhập từ `lib/config/issue-terms.ts`, danh sách vai được
   đổi cấu hình suy từ `lib/rbac/config-role.ts`.
3. **`lib/store/config-values.ts`** — `readIssuePriceVnd()` đặt ở tầng lưu trữ vì có **hai** người
   đọc ở hai tầng: `lib/bank` và **factory `getLedger`**. Để ở `lib/bank` thì tầng cổng phải nhập
   tầng nghiệp vụ, tức ngược chiều phụ thuộc.

## 2. Đối chiếu DoD theo bước

| Bước | Việc theo `tasks.md` | Đạt? | Ghi chú |
|---|---|:--:|---|
| 0 | Trạng thái task, `FE-07` vào `planned` **trước** khi gắn marker | ✅ | `FE-07` thêm ở `d6be65b`, marker gắn ở `7217226`/`9c73fa4` |
| 1 | Việc 1–5: lược đồ + hai cổng lưu trữ | ✅ | mục 3.1–3.2 |
| 2 | Việc 6: `setPurchasePrice`, cả ba adapter **trong một commit** | ✅ | `ea3c48a` chạm đúng 4 tệp `lib/ledger/` + 1 test |
| 3 | Việc 7–11 + `config-service.test.ts` (ca 1, 2, 3 + hai đột biến) | ✅ | mục 3.3 |
| 4 | Việc 12–13 + `issuance-service.test.ts` (ca 4) | ✅ | mục 3.4 |
| 5 | Việc 14–16 + ca 5 | ✅ | mục 3.6 |
| 6 | Báo cáo công nghệ, sơ đồ luồng `issue`, `BE-04` → `done`, checkpoint | ✅ | mục 3.8 |

## 3. Cách chạy / kiểm thử

Mọi kết quả dưới đây là **mã thoát và tóm tắt thật**, không phải khẳng định.

### 3.1 Ba bảng mới và cột `isConfig` có trong lược đồ

`prisma/init.sql` **sinh bằng công cụ**, không sửa tay:

```
$ cd app && npm run db:sql        # prisma migrate diff --from-empty --to-schema-datamodel
$ grep -c '^model ' prisma/schema.prisma
15
$ grep -n 'CREATE TABLE "\(SystemConfig\|SystemConfigHistory\|Project\)"' prisma/init.sql
162:CREATE TABLE "SystemConfig" (
173:CREATE TABLE "SystemConfigHistory" (
186:CREATE TABLE "Project" (
$ grep -n 'CREATE UNIQUE INDEX "Project' prisma/init.sql
296:CREATE UNIQUE INDEX "Project_tokenSymbol_chain_key" ON "Project"("tokenSymbol", "chain");
```

### 3.2 Dựng lại cơ sở dữ liệu TỪ ĐẦU trên Postgres thật

Không chỉ đọc `init.sql` — dựng một Postgres rỗng rồi cho ứng dụng tự áp lược đồ qua đúng đường
`ensureSchema` mà nó dùng lúc chạy:

```
$ docker run --rm --name bidv-be04-check -e POSTGRES_USER=bidv -e POSTGRES_PASSWORD=bidv \
    -e POSTGRES_DB=bidv_rwa -p 55432:5432 postgres:16-alpine
$ cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@localhost:55432/bidv_rwa \
    npx vitest run test/store-constraints.test.ts
  Tests  139 passed (139)          # 89 khi chỉ có bản bộ nhớ -> 50 ca chạy thêm trên Postgres thật
```

Kiểm tận mắt trong cơ sở dữ liệu vừa dựng:

```
$ docker exec bidv-be04-check psql -U bidv -d bidv_rwa -tAc \
    "select count(*) from information_schema.tables where table_schema='public'"
15
$ ... "select column_name||' '||data_type||' default '||column_default from information_schema.columns
       where table_name='Role' and column_name='isConfig'"
isConfig boolean default false
$ ... 'select key, value, type from "SystemConfig"'
 wpt.issue_price_vnd        | 100000   | bigint
 wpt.price_change_threshold | 2        | number
$ ... 'select "tokenSymbol","totalSupply",status,chain,"issuedAt" from "Project"'
 WPT | 20000000 | DRAFT | hardhat-local |
 WPT | 20000000 | DRAFT | mock          |
$ ... 'select name,"isConfig" from "Role" order by name'
 AUDITOR | f · BANK_ADMIN | t · COMPLIANCE | f · INVESTOR | f
```

**Nạp dữ liệu khởi tạo là "nạp nếu trống", KHÔNG phải "đặt lại".** Đây là điều tôi khẳng định trong
mã (`ON CONFLICT DO NOTHING`) nên đã kiểm thật: đổi giá trong cơ sở dữ liệu rồi chạy lại đường áp
lược đồ, giá **không** bị ghi đè về mặc định.

```
$ ... "update \"SystemConfig\" set value='777777' where key='wpt.issue_price_vnd'"
UPDATE 1
$ (chạy lại test Postgres, tức ensureSchema + seed chạy lại)
$ ... "select value from \"SystemConfig\" where key='wpt.issue_price_vnd'"
777777                            # giữ nguyên, không về 100000
```

Container đã dọn sau khi đo: `docker ps -a --filter name=bidv-be04-check` không còn kết quả.

### 3.3 Giá: `config-service.test.ts`

```
$ cd app && npx vitest run test/config-service.test.ts test/portfolio-service.test.ts
  Tests  39 passed (39)            # config-service 27 · portfolio-service 12
```

| Ca của spec | Nằm ở `describe` | Số ca |
|---|---|:--:|
| Ca 1 — giá cơ sở dữ liệu == `quotePurchase` | `ca 1 — giá trong cơ sở dữ liệu bằng giá quotePurchase trả về` | 4 |
| Ca 2 — giá âm/0 và lệch quá ngưỡng | `ca 2 — giá âm hoặc 0 bị từ chối; lệch quá ngưỡng cần xác nhận` | 9 |
| Ca 3 — lệnh đã đặt giữ giá cũ | `ca 3 — lệnh đã đặt giữ nguyên số VNDB đã chốt` | 1 |
| Đột biến 1 — ledger ném thì cơ sở dữ liệu không đổi | `đột biến 1 — ...` | 2 |
| Đột biến 2 — tắt `isConfig` | `đột biến 2 — hai lớp quyền, tắt lớp nào cũng bị chặn` | 6 |
| (thêm) nạp lại giá sau khi mất state mock | `ledger mô phỏng nạp giá từ cấu hình` | 3 |

Hai ca đột biến kiểm hai chiều của **cùng một** bất biến, và cả hai đều cần thiết:

- `setPurchasePrice` ném → cơ sở dữ liệu **không đổi** và **không** có dòng lịch sử nào.
- `setConfig` ném → ledger được **đẩy về giá cũ**, nên hai nguồn vẫn khớp.

⚠️ **Đột biến 1 là chốt chặn duy nhất cho THỨ TỰ.** Đảo thành "ghi cơ sở dữ liệu trước" thì mọi ca
đường thuận **vẫn xanh** — hai nguồn vẫn khớp khi không có lỗi. Đừng xoá ca đó.

### 3.4 Phát hành: `issuance-service.test.ts`

```
$ cd app && npx vitest run test/issuance-service.test.ts
  Tests  21 passed (21)
```

Ca 4 của spec phủ bởi hai nhóm: `ca 4 — phát hành đúng tổng cung lấy từ bảng dự án` (5 ca) và
`ca 4 — phát hành lần hai bị từ chối` (4 ca). Bốn phát biểu quan trọng nhất:

- Phát hành đúng `Project.totalSupply`, và `totalSupplyOnChain` đọc lại **từ chuỗi** cũng bằng con số đó.
- Truyền thêm `amount: '999'` vào input bị **bỏ qua** — chốt chặn cho "tổng cung không đến từ input".
- Lần hai bị từ chối, **tổng cung không đổi**, sổ giao dịch chỉ có **một** dòng `mintInitialSupply`,
  và `issuedAt` vẫn là mốc của lần đầu.
- Ví SPV chưa whitelist → ledger từ chối và `Project.issuedAt` **vẫn `null`** (đánh dấu ở đây sẽ
  khoá vĩnh viễn một dự án chưa có token nào).

### 3.5 Không còn con số viết cứng

```
$ git grep -cE '20[_,]?000[_,]?000' -- app/src
app/src/lib/config/issue-terms.ts:1          # đúng MỘT chỗ, ở tệp nguồn duy nhất
$ git grep -n 'WPT_TOTAL_SUPPLY' -- app/src
app/src/lib/config/issue-terms.ts:64:export const WPT_TOTAL_SUPPLY = 20_000_000;
app/src/lib/store/seed-data.ts:7,99          # chỉ NHẬP rồi dùng, không khai lại
```

Bốn tệp nhập `WPT_ISSUE_PRICE_VND`, **tất cả đều dùng nó làm GIÁ MẶC ĐỊNH**, không chỗ nào dùng làm
giá đang có hiệu lực để hiển thị:

```
$ git grep -n 'WPT_ISSUE_PRICE_VND' -- app/src | grep -v 'lib/config/issue-terms.ts'
lib/bank/issuance.ts          # re-export cho người gọi cũ
lib/ledger/mock.adapter.ts    # DEFAULT_WPT_PRICE_VND — giá khi factory không cấp provider
lib/store/config-values.ts    # nhánh lùi về mặc định của readIssuePriceVnd()
lib/store/seed-data.ts        # nạp vào dòng SystemConfig đầu tiên
```

`app/test/issue-price-single-source.test.ts` giữ điều này bằng **hai** ca cấu trúc: liệt kê đủ hằng
số giá khai bằng số đếm, và khẳng định chỉ **một** tệp được khai loại hằng số đó.

### 3.6 Ca 5 — đổi giá mặc định, toàn bộ test vẫn xanh

Cách chạy (phục hồi rồi **kiểm bằng `git diff` rỗng**, để chắc không bỏ sót giá trị thử trong mã):

```
$ cp src/lib/config/issue-terms.ts /tmp/issue-terms.bak
$ sed -i 's/= 100_000;/= 537_000;/' src/lib/config/issue-terms.ts && npx vitest run
$ sed -i 's/= 537_000;/= 7;/'       src/lib/config/issue-terms.ts && npx vitest run
$ cp /tmp/issue-terms.bak src/lib/config/issue-terms.ts
$ git diff --stat HEAD -- src/lib/config/issue-terms.ts
                                  # RỖNG = đã phục hồi đúng
```

| Giá mặc định | Kết quả |
|---|---|
| `100_000` (thật) | 418 passed (418) |
| `537_000` | 418 passed (418) |
| `7` | 418 passed (418) |

**Ca 5 bắt được 5 chỗ gõ cứng mà đọc mắt không thấy** — đây là giá trị thật của nó, nên ghi lại:

| Ở giá | Tệp | Chỗ sai | Vì sao đỏ |
|---|---|---|---|
| 537.000 | `config-service.test.ts` | `2n * 150_000n` | Nạp sai số VNDB nên khớp lệnh trượt ở phép kiểm số dư |
| 537.000 | `purchase-service.test.ts` | `99_999n` + `/Nạp thêm 1 VNDB/` | Phần thiếu không còn là 1 |
| 7 | `purchase-service.test.ts` (3 ca) | `99_999n` làm "thiếu tiền / thiếu uỷ quyền" | Ở giá nhỏ, 99.999 thành **dư** tiền — **tình huống mà ca kiểm cần dựng đã bốc hơi**, test đỏ không phải vì mã sai |

Đã sửa hết thành số suy ra từ nguồn (`PRICE - 1n`, `BigInt(NEAR_PRICE_2)`). Phân loại có chủ đích,
**không** sửa hàng loạt: `store-constraints.test.ts` giữ `'1000000'`/`'120000'` vì đó là dữ liệu tuỳ
ý của cổng lưu trữ, không phải giá; `mock-ledger.test.ts` giữ `100_000n` ở phần chia lợi nhuận vì đó
là phần chia từ `profitPool`, không phải giá.

### 3.7 `run-local-all.sh` — chạy MỘT lần ở cuối task

```
$ bash scripts/run-local-all.sh
  Đạt:     8
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 3 - ĐIỂM CẮM (marker)      Marker hợp lệ: 14 điểm cắm, 12 điểm chặn, 21 bước luồng
    PASS  LỚP 3 - KHUÔN CHECKPOINT
    PASS  LỚP 1 - SPEC TEST CONTRACT EVM      67 passing
    PASS  LỚP 1 - SPEC TEST CONTRACT SOROBAN  48 passed
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST                    418 passed (418), 16 tệp
  Không đạt: 0
  => ĐẠT toàn bộ kiểm chứng cục bộ.
EXIT=0
```

**Sáu cảnh báo của lớp luật kiến trúc là CÓ TRƯỚC BE-04, không phải mới.** Đã đo đối chứng:

```
$ bash scripts/verify-arch-rules.sh | grep -c WARN     # trên feat/issuance-and-config
7
$ git checkout dev && bash scripts/verify-arch-rules.sh | grep -c WARN
7                                                       # y nguyên
```

Nội dung: `process.env` đọc ngoài `lib/config`, địa chỉ EVM viết cứng trong `app/src`, chưa đặt
`BASE_REF`, và ba spec Stellar chưa tới lượt làm.

⚠️ **Lớp "KHUÔN CHECKPOINT" của `run-local-all.sh` đã BỎ QUA tệp này**, vì `--in-progress` chỉ kiểm
checkpoint của task đang làm mà `BE-04` nay ở `done`. Nên tôi kiểm bằng dạng hai tham số:

```
$ node scripts/check-checkpoint.mjs docs/CHECKPOINT_BE04.md docs/be-04-issuance-config/requirements.md
ĐẠT     docs/CHECKPOINT_BE04.md
  mục 0: 30/60 dòng · bảng đối chiếu 8 dòng / 8 điều kiện · 8 ✅ 0 🔶 0 ❌
```

### 3.8 Tài liệu và trạng thái task

| Việc | Cách làm | Kiểm |
|---|---|---|
| Sơ đồ luồng `issue` | `node scripts/gen-flow-diagram.mjs issue` → `docs/flows/issue.md` (9 bước) | `gen-flow-diagram.mjs --check` trong `npm test` |
| Mục điểm cắm ở báo cáo 3.10 | `node scripts/scan-pending.mjs --write-report` | `scan-pending.mjs --check-report` trong `npm test` |
| Báo cáo công nghệ | Viết tay: metadata 2.1→2.2, cây thư mục, 3.1, 3.3, 3.4, 3.5, 3.6, **3.12 mới**, 4.1, **4.3 mới** | `tech-report-maintenance.md` §2 |
| `.kiro/task-status.json` | `BE-04` → `done`, `inProgress` rỗng | `scan-pending.mjs --check` (không marker nào lạc hậu) |

Hai tệp sinh tự động **không sửa tay dòng nào**. `docs/flows/issue.md` sinh lại hai lần trong task
(lần đầu ở Bước 4, lần hai sau khi đổi số bước 8↔9 cho khớp chiều action→service của luồng `purchase`).

## 4. Ba cơ chế giữ "giá hiển thị == giá khớp lệnh"

Đây là rủi ro chính mà spec nêu, nên ghi lại thành mục riêng để Supervisor kiểm đúng chỗ.

### 4.1 Thứ tự trong `setIssuePrice`

```
validate Zod  →  assertCanConfigure  →  kiểm ngưỡng
              →  ★ ledger.setPurchasePrice(giá mới)     BƯỚC 1
              →  ★ configStore.setConfig(...)           BƯỚC 2 (giá + lịch sử, nguyên khối)
                    └─ thất bại → ledger.setPurchasePrice(giá CŨ)
```

Không transaction nào bao được cả một lời gọi on-chain và một câu SQL, nên việc duy nhất làm được là
**chọn thứ tự mà hỏng giữa đường vẫn để lại trạng thái giải thích được**. Thứ tự ngược cho ra trạng
thái **tệ hơn cả lúc chưa có** `setPurchasePrice`: người dùng nhận thông báo thất bại và tin rằng
không có gì đã đổi, trong khi ledger đã bán theo giá mới.

Nếu cả bước hoàn nguyên cũng thất bại thì **không che lỗi gốc**: thông báo nêu cả hai lý do kèm con
số cần đặt lại thủ công, và ghi một dòng audit `FAILURE`.

### 4.2 Chống phát hành hai lần bằng khoá lạc quan

`markIssued` đặt điều kiện `status = 'DRAFT' AND issuedAt IS NULL` **trong** chính câu `UPDATE`. Đọc
`issuedAt` rồi mới ghi thì hai lời gọi đồng thời đều thấy `null`, đều kết luận "chưa phát hành", rồi
cùng gửi giao dịch mint — **nguồn cung ra gấp đôi con số đã công bố**, và không sửa được vì token đã
ở trong ví người khác.

Có **hai** lớp chặn trước đó, và cả hai đều không thay lớp này: `project.issuedAt !== null` (tiết kiệm
một giao dịch chắc chắn revert) và `ledger.isInitialSupplyMinted()` (chuỗi là nguồn sự thật cuối cùng;
lệch với cơ sở dữ liệu thì **từ chối và đòi đối soát**, không âm thầm phát hành lại).

### 4.3 Ledger mô phỏng nạp giá từ cấu hình — đặt ở FACTORY

State của mock nằm trên `globalThis` nên mất khi tiến trình khởi động lại, còn giá đã cấu hình vẫn
nằm trong cơ sở dữ liệu. Không nạp lại thì sau restart mock khớp lệnh theo **giá mặc định** trong khi
màn hình hiện giá đã cấu hình — cùng một lỗi lệch giá, chỉ khác là nó chỉ xuất hiện sau restart nên
càng khó lần. Ca kiểm: `ledger mô phỏng nạp giá từ cấu hình` (mục 3.3).

Đặt ở `getLedger` chứ không trong `mock.adapter.ts`: mock là **tầng cổng**, cho nó nhập `lib/store` là
để tầng cổng phụ thuộc tầng lưu trữ, và khi đó `createMockLedger` không dựng được trong test mà không
có cơ sở dữ liệu. Truyền **hàm** chứ không giá trị vì `getLedger` là hàm đồng bộ, đang được gọi ở hàng
chục chỗ — nhận hàm giữ được chữ ký đồng bộ nên **không lời gọi nào phải sửa**.

Mock nạp **một lần mỗi vòng đời state** (cờ `priceHydrated`). Đọc lại mỗi lần gọi sẽ biến cơ sở dữ
liệu thành nguồn giá **thứ hai** bên cạnh `state().wptPriceVnd`, và khi đó `setPurchasePrice` mất tác
dụng — đúng thứ mà 4.1 dựa vào.

## 5. DEVIATION so với spec, và sai lệch số liệu phát hiện được

### SL-1 — "Không còn 20.000.000 viết cứng": con số đó CHƯA TỪNG có trong mã

Spec đặt việc này ở điều kiện hoàn thành như thể đang phải **gỡ** một con số viết cứng. Đo lại
**trước khi lập kế hoạch**, nó không tồn tại:

```
$ git grep -nE '20[_.,]?000[_.,]?000' -- app/src packages scripts prisma
                                  # không kết quả nào trong app/src
```

Nên điều kiện này đúng ngay từ đầu, và con số 20.000.000 **xuất hiện lần đầu ở BE-04** — trong
`lib/config/issue-terms.ts` (`WPT_TOTAL_SUPPLY`), rồi `seed-data.ts` nhập từ đó để nạp dòng `Project`.
Tôi vẫn đánh ✅ cho điều kiện 6 vì trạng thái cuối đúng như spec muốn, nhưng ghi ra đây để Supervisor
không đi tìm một diff "gỡ hằng số" không tồn tại.

Hai con số còn lại của spec **đo lại đúng**: `100_000|100000` trong `app/test` là 9 chỗ trên 4 tệp;
`mintTokens` ở 3 tệp.

### SL-2 — `store-constraints.test.ts` không chạy lại được trên Postgres thật (lỗi có trước BE-04)

Phát hiện khi chạy bộ test Postgres **hai lượt** trên cùng một cơ sở dữ liệu ở mục 3.2. Ca
`hai lệnh không dùng chung một mã giao dịch (R1.4)` dùng mã giao dịch **cố định** `'0xtrung'`, nên
lượt hai trượt ngay ở lời gọi **thứ nhất** — thông báo trông y như thể ràng buộc duy nhất đang hỏng.

Điều này trái chính chú thích trong tệp đó: *"Không TRUNCATE ... mỗi ca kiểm tự dùng khoá riêng (uuid)
nên không đụng dữ liệu cũ và **chạy lại được nhiều lần**"*.

Đã sửa một dòng (`0xtrung-${randomUUID()}`) kèm chú thích nêu nguyên nhân. Kiểm bằng ba lượt liên tiếp
trên cùng cơ sở dữ liệu: `139 passed` cả ba lượt. Sửa vì để lại thì **lượt chạy thứ hai của Supervisor
sẽ đỏ** vì một lý do không liên quan gì tới BE-04.

### DEV-1 — `Project` duy nhất theo `(tokenSymbol, chain)`, không phải `tokenSymbol`

Spec chỉ nói "bảng `Project` (mã token, tên, tổng cung, trạng thái, chuỗi, địa chỉ hợp đồng, thời điểm
phát hành)". Tôi khai duy nhất theo `tokenSymbol` trước, rồi **tự phát hiện nó mâu thuẫn** với
`findProject({tokenSymbol, chain})`: toàn hệ chỉ có ĐÚNG MỘT dòng WPT nằm trên một chuỗi, và mọi chuỗi
khác tra ra `null` → `issueInitialSupply` từ chối *"chưa có dự án"* trong khi dự án rõ ràng có.

Đổi sang `@@unique([tokenSymbol, chain])`, đúng cách mọi bảng khác trong lược đồ này mang cột `chain`.
Thêm một ca kiểm giữ quyết định đó: *"cùng mã token trên chuỗi KHÁC thì được phép"* — không có nó thì
việc thu khoá về `tokenSymbol` vẫn xanh, và triệu chứng chỉ hiện khi đổi chuỗi trên giao diện.

### DEV-2 — Dữ liệu khởi tạo nạp dự án cho CẢ `mock` và chuỗi mặc định

Hệ quả trực tiếp của DEV-1. Nạp một dòng duy nhất trên `DEFAULT_CHAIN` (= `hardhat-local`) thì bản demo
free-tier chạy ở `mock` **không phát hành được gì** — luồng chính của BE-04 chết ở đúng chế độ triển
khai mặc định của demo công khai, và chỉ chạy được khi có một hardhat node thường trú. Đó là cái bẫy
`lessons.md` đã ghi. `evm` **cố ý không nạp**: testnet công khai cần deploy thật kèm địa chỉ hợp đồng.

### DEV-3 — `wptToVnd(amount, issuePriceVnd)` thay vì đọc giá bên trong

Đọc bên trong buộc hàm thành `async` và buộc `lib/bank/issuance.ts` nhập tầng lưu trữ, tức phải thêm
`import 'server-only'`. `lib/config/issue-terms.ts` đã ghi rõ vì sao **không** được: chặn ở phía client
sẽ chặn luôn `wptToVnd` và mọi màn hình muốn tự quy đổi con số nó đã có trong tay. Nhận giá làm tham số
giữ hàm **thuần** và dùng được ở cả hai phía.

Kéo theo: `PortfolioView.issuePriceVnd` và `TokenSummary.issuePriceVnd` đổi `number` → `string` (giá là
uint256), và ba component đổi sang formatter chuỗi **đã có sẵn trong từng tệp** (`nf` / `nfBig`) — không
thêm formatter mới.

### DEV-4 — `issueInitialSupply` không đòi khoá ký trên chuỗi `mock`

`getBankSigner('mock').getAddress()` ném vì `mock` không có khoá, và điều đó làm **cả lượt phát hành**
thất bại. `actorAddress` là **dữ liệu đối soát** trên dòng giao dịch, không phải đầu vào của phép kiểm
quyền nào (quyền đã do `authorize()` quyết xong ở trên), nên tôi bắt lỗi và ghi `null` — cột đó vốn
nullable, và `tokenOverview` trong `mint.service.ts` đã xử lý cùng tình huống theo cùng cách.

**Không** mở rộng cách này sang chuỗi thật: ở đó thiếu signer thì `mintInitialSupply` thất bại ngay ở
bước gửi giao dịch, trước khi tới đó. Cũng **không** sửa `mintToInvestorDirect` — hành vi đó có trước
BE-04 và spec chỉ yêu cầu đổi tên; ca test của nó tự đặt một khoá hex bịa rồi dọn trong `finally`.

## 6. Câu hỏi mở / chỗ chưa chắc

### CHM-1 — `isConfig` nên đọc từ đâu?

Spec nói hai điều mà tôi không ghép được thành một cách hiểu duy nhất: *"cột `Role.isConfig`, mặc định
`false`"* (mục Dữ liệu) và *"không chuyển toàn bộ phân quyền sang cơ sở dữ liệu (thuộc AU-02)"* (mục
Không làm).

| Cách hiểu | Hệ quả |
|---|---|
| **A — bảng trong mã là nguồn** (đã chọn) | Cột mới là **đích** cho AU-02, giống `Role`/`Permission` đã khai sẵn từ Phase 1 mà chưa ai đọc. Không có nguồn phân quyền thứ hai |
| B — guard đọc cột trong cơ sở dữ liệu | Hệ thống có **hai** nguồn phân quyền cùng lúc: một cột ở cơ sở dữ liệu, mọi cột còn lại ở mã. Trạng thái tệ hơn cả hai phương án thuần |

**Đã chọn A** (`lib/rbac/config-role.ts`), vì B tạo đúng thứ mục "Không làm" ngăn. Cột `Role.isConfig`
vẫn thêm vào lược đồ và **dữ liệu khởi tạo nạp đủ bốn vai** với `isConfig` suy từ `CONFIG_ROLES`, nên
AU-02 chỉ việc đổi chỗ đọc.

Owner xác nhận A đúng ý spec. Nếu ý là B thì việc phải làm là đổi `assertCanConfigure` sang `async` và
thêm một cổng đọc bảng `Role` — không lớn, nhưng nó bắt đầu phần việc mà spec nói là của AU-02.

### CHM-2 — `listConfigHistory` không bảo đảm thứ tự khi hai lần ghi trùng mốc

Hai lần ghi cách nhau dưới một phần nghìn giây có cùng `changedAt`, và cả hai bản hiện thực phá thế
bằng `id` — một uuid **ngẫu nhiên**, không phải thứ tự chèn. Tôi phát hiện vì một ca kiểm dựa vào
`history[0]` đỏ **tuỳ lần chạy**.

Đã xử lý bằng cách sửa ca kiểm (tra theo **nội dung**, không theo vị trí) và ghi giới hạn vào doc của
`IConfigStore.listConfigHistory`. **Chưa** thêm cột số thứ tự, vì đó là đổi lược đồ cho một tình huống
chỉ xảy ra khi hai lần đổi giá cách nhau dưới một phần nghìn giây — không có trong thao tác của người,
nhưng **có** nếu về sau một tiến trình tự động đổi tham số theo lô.

Hỏi Owner: sổ lịch sử tham số có cần **thứ tự tuyệt đối** không? Nếu có, đề xuất thêm `BIGSERIAL` và
sắp theo nó — việc nhỏ, nhưng là đổi lược đồ nên tôi không tự làm.

### CHM-3 — Ngưỡng đổi giá: hiểu "ngưỡng = 2" là hệ số, đúng không?

Spec ghi `wpt.price_change_threshold = 2` mà không nói đơn vị. Hai cách hiểu:

| Cách hiểu | Nghĩa với giá 100.000 |
|---|---|
| **Hệ số** (đã chọn) | Chặn khi giá mới > 200.000 hoặc < 50.000 |
| Phần trăm | Chặn khi giá mới lệch quá 2% — tức > 102.000 hoặc < 98.000 |

**Đã chọn hệ số**, vì giá phát hành không dao động theo thị trường: mọi lần đổi đều là quyết định có
chủ ý, nên ngưỡng ở đây không nhằm chặn biến động mà nhằm chặn **lỗi đánh máy** (thừa/thiếu một chữ số
0). Cách hiểu "phần trăm" với giá trị 2 sẽ chặn cả việc sửa giá bình thường — 100.000 → 120.000 bị từ
chối, và lời xác nhận trở thành động tác bấm cho qua, lúc đó nó không còn chặn được gì.

Nếu Owner muốn phần trăm thì chỉ phải đổi `exceedsThreshold` và giá trị khởi tạo; điểm gọi không đổi.

### CHM-4 — `getIssuePrice` cố ý KHÔNG kiểm quyền

Giá phát hành là con số **hiển thị cho nhà đầu tư** (`PortfolioView.issuePriceVnd`), nên chặn nó là
chặn luôn màn hình vị thế. Tôi để `getIssuePrice` không kiểm quyền và ghi lý do trong mã. `setIssuePrice`
thì kiểm hai lớp. Nếu Owner coi cả **siêu dữ liệu** (ai đặt giá, lúc nào) là thông tin nội bộ thì cần
tách: phần con số để công khai, phần `updatedBy`/`updatedAt` sau một quyền đọc.

### CHM-5 — `issueInitialSupply` dùng quyền `token:mint`, chưa có quyền riêng

Spec không nói dùng quyền nào. Tôi dùng `token:mint` vì đây vẫn là hành vi phát hành token và
`BANK_ADMIN` đã có quyền đó. Nhưng phát hành **một lần toàn bộ nguồn cung** là quyết định lớn hơn mint
lẻ nhiều, nên có thể xứng đáng một quyền riêng (`token:issue-initial`) để về sau cấp tách được — ví dụ
cho phép mint lẻ trên môi trường thử mà không cho phát hành nguồn cung. Chưa thêm vì đó là mở rộng bảng
quyền, thuộc phạm vi BE-08/AU-02.

## 7. Tự đánh giá 3 LUẬT kiến trúc

- [x] **Mọi call chain qua `ILedgerPort`.** `config.service` và `issuance.service` chỉ gọi `getLedger(chain)`;
      không tệp nào trong hai tệp đó nhập `viem`/`ethers`. `setPurchasePrice` thêm vào **cổng** rồi hiện
      thực ở cả ba adapter, không nối tắt.
- [x] **Mọi ký qua `ISigner`.** `issuance.service` lấy địa chỉ qua `getBankSigner(chain)`; không đọc
      `SERVER_SIGNER_PRIVATE_KEY`. Đo: `grep -rln 'SERVER_SIGNER_PRIVATE_KEY' app/src/` chỉ ra `config/env.ts`
      và `signer/server.signer.ts`.
- [x] **Mọi kiểm quyền qua RBAC.** `assertCanConfigure` gọi `assertCan(role, 'treasury:manage')` rồi mới
      kiểm lớp thứ hai — **giữ cả hai lớp**, không thay RBAC. Không có `if (role === ...)` nào: lớp luật
      kiến trúc của `run-local-all.sh` xanh (mục 3.7).

**Điểm cắm còn lại sau BE-04** — trạng thái bình thường, không phải nợ:

| Task | Loại | Chờ gì |
|---|---|---|
| `FE-07` | 4 điểm cắm | Màn cấu hình giá + màn phát hành. Backend đã sẵn đầu cuối |
| `SC-02` | 3 điểm chặn | Contract phát hành một lần → `evm.adapter` nối được luồng `issue` trên chuỗi thật |
| `SC-03` | 4 điểm chặn | Contract khớp lệnh (giữ giá bán) → `setPurchasePrice` nối được trên chuỗi thật |
| `SC-04` | 4 điểm chặn | Quyết định cờ tất toán và giá NAV nằm ở contract nào |

⚠️ **Luồng `issue` đã chạy đầu cuối trên `mock`, CHƯA chạy trên chuỗi thật** (chờ SC-02). Đây là giới
hạn đã biết, không phải thiếu sót của BE-04: `mintInitialSupply` cần một contract lưu cờ "đã phát hành",
và `ProjectToken.mint` hiện tại phát hành được nhiều lần nên không giữ được ràng buộc một lần ở tầng
adapter.
