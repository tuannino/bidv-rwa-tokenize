# Báo cáo bàn giao — Task BE-03: Xem trước điều kiện mua WPT

| | |
|---|---|
| Mã task | BE-03 |
| Nhánh | `feat/purchase-preview`, tạo **từ `dev`** (`ac25c8b`) |
| Spec | `docs/be-03-purchase-preview/{requirements,tasks}.md` — **2 tệp**, không có `design.md` (`efficiency.md` §5 cho phép) |
| Tiến độ | Bước 4/4 xong. Chờ Supervisor nghiệm thu — Kiro **không** merge vào `dev` |

> **Quy tắc viết checkpoint:** `.kiro/steering/checkpoint.md`.
> Kiểm bằng máy: `node scripts/check-checkpoint.mjs docs/CHECKPOINT_BE03.md docs/be-03-purchase-preview/requirements.md`

---

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md`) | | Bằng chứng |
|---|---|---|---|
| 1 | Xem trước đúng cho ví đủ điều kiện và cho ba ca thiếu điều kiện | ✅ | mục 3.2 (ca 1, 2a, 2b, 2c) |
| 2 | Xem trước không ghi gì vào cơ sở dữ liệu | ✅ | mục 3.2 (ca 3) · 4 (QĐ-2) |
| 3 | `placeOrder` không tạo lệnh khi thiếu điều kiện | ✅ | mục 3.2 (4 ca `expectNotPlaced`) |
| 4 | Hai đường kiểm cho cùng kết quả trên cùng dữ liệu vào | ✅ | mục 3.2 (3 ca 4) · 4 (QĐ-1) |
| 5 | Test BE-02 cũ vẫn xanh | 🔶 | mục 5 (SL-1) — xanh đủ 32/32 nhưng **5 ca phải đổi phần dựng bối cảnh**, 1 ca đổi chỗ kiểm |
| 6 | `@flow purchase` liền mạch 1→12, sơ đồ sinh lại được | ✅ | mục 3.3 |
| 7 | `run-local-all.sh` xanh | ✅ | mục 3.4 — 8 PASS / 0 FAIL (6 cảnh báo có sẵn từ trước, không do BE-03) |

**Kết luận:** 6 ✅ · 1 🔶 · 0 ❌

### 0.2 Việc cần Owner quyết

- **CQ-1 — Xem trước bị chặn có cần vào sổ kiểm toán?** Đã chọn "không ghi gì" theo đúng chữ của
  yêu cầu 2, nên một lần xem trước **bị từ chối quyền** cũng không để lại dấu vết. Đề xuất: giữ
  như hiện tại, và khi có SIWE (AU-01) thì ghi riêng ca DENIED. Chi tiết mục 5.
- **CQ-2 — `MC-02` còn ở `inProgress` dù PR #22 đã merge vào `dev`.** Không thuộc phạm vi BE-03 nên
  **không tự sửa**. Chi tiết mục 5.
- **CQ-3 — Steering `efficiency.md` nằm ở nhánh khác.** `requirements.md` ghi nền là `dev` *sau khi*
  `efficiency.md` đã merge; lúc mở nhánh thì nó chưa merge. Chi tiết mục 5.

---

## 1. Đã làm

Bốn commit, một mục tiêu mỗi commit (`workflow.md` — chia commit nhỏ):

| Commit | Mục tiêu |
|---|---|
| `142fc12` | Nhận spec BE-03, chuyển task sang `inProgress` |
| `015a4c9` | **Bước 1** — `runPurchaseChecks` nhận tham số thuần thay vì `OrderRecord` |
| `d4dd0fb` | **Bước 2** — `previewPurchase` + `placeOrder` chặn lệnh rác + ca kiểm thử |
| `a56959b` | **Bước 3** — `previewPurchaseAction`, marker `@pending FE-05`, đánh số lại `@flow` |
| `15aeb9e` | **Bước 4** — `tech-report.md` 2.1, `BE-03` sang `done`, checkpoint này |
| *(commit cuối)* | **Bước 4** — đo lại số liệu của chính checkpoint này, vì hai con số dưới đây chỉ đúng **sau** commit `15aeb9e` |

Phạm vi đo được (gồm cả tệp spec và checkpoint):

```
$ git diff --stat dev...HEAD | tail -1
 11 files changed, 1243 insertions(+), 153 deletions(-)
```

Chỉ tính mã nguồn và test:

```
$ git diff --stat dev...HEAD -- app | tail -1
 5 files changed, 650 insertions(+), 91 deletions(-)
```

Ba thứ mới ở tầng nghiệp vụ:

- `previewPurchase()` — trả `canPlaceOrder`, `blockers`, `vndAmount`, và `checks`: từng phép kiểm
  kèm `reason` / `howToFix` / `actual` / `required`. Không ghi cơ sở dữ liệu.
- `placeOrder()` kiểm điều kiện **trước khi** tạo bản ghi. Không đạt → không có bản ghi lệnh,
  nhưng **vẫn** ghi sổ kiểm toán `outcome: FAILURE`.
- `runPurchaseChecks()` trả **danh sách** kết quả từng phép kiểm thay vì một phép trượt.

---

## 2. Đối chiếu DoD từng bước của `tasks.md`

| Bước | Việc | Đạt? | Ghi chú |
|---|---|---|---|
| 1 | Đổi chữ ký `runPurchaseChecks`; `executeOrder` truyền `quotedVndAmount` | ✅ | 32/32 test xanh **không sửa một dòng test nào** — bằng chứng hành vi giữ nguyên |
| 2 | `previewPurchase`, sửa `placeOrder`, thêm ca kiểm thử | ✅ | 32 → 45 ca |
| 3 | `previewPurchaseAction` + `@pending FE-05` + đánh số lại `@flow` | ✅ | mục 3.3 |
| 4 | `tech-report.md`, `task-status.json`, checkpoint, `run-local-all.sh` | ✅ | mục 3.4, 3.5 |

---

## 3. Cách chạy / kiểm thử

### 3.1 Lệnh hẹp trong lúc làm (theo mục "Mức kiểm chứng: Vừa" của spec)

```bash
cd app && npx vitest run test/purchase-service.test.ts
node scripts/scan-pending.mjs --check
```

### 3.2 Test nghiệp vụ lệnh mua

```
$ cd app && npx vitest run test/purchase-service.test.ts
 Test Files  1 passed (1)
      Tests  45 passed (45)
```

Đo số ca trước/sau. Chênh giữa `41` khai báo `it(` và `45` ca chạy là hai vòng `for` sinh ba ca
mỗi vòng từ bảng `DEGRADATIONS` (`41 - 2 + 6 = 45`):

```
$ git show dev:app/test/purchase-service.test.ts | grep -cE "^\s+it\("
32
$ grep -cE "^\s+it\(" app/test/purchase-service.test.ts
41
```

Bốn ca kiểm thử mà `requirements.md` đòi, và chỗ chúng nằm:

| Ca spec đòi | Tên ca trong tệp test | Kiểm điều gì |
|---|---|---|
| 1 | `ca 1 — đủ điều kiện` | `canPlaceOrder` đúng; `vndAmount` so với `ledger.quotePurchase(3n)`, **không** gõ lại số |
| 2 | `ca 2a/2b/2c` | `blockers` đúng cho thiếu số dư / thiếu ủy quyền / SPV thiếu WPT; `actual`/`required`; `howToFix` **không** chứa `allowance\|approve\|revert`; sổ lệnh vẫn trống |
| 3 | `ca 3 — xem trước KHÔNG ghi gì` | Ảnh chụp `orders` + `txns` + `audit` trước/sau ba lời gọi, so bằng `toEqual` |
| 4 | `ca 4 — …` × 3 | Cùng dữ liệu vào: so `code` **và** `reason` của xem trước với `executeOrder` |

Thêm bốn ca cho yêu cầu 4 (`expectNotPlaced`): mỗi ca kiểm cả ba thứ — mã lỗi, **sổ lệnh trống**,
và có bản ghi kiểm toán `FAILURE`. Chỉ kiểm mã lỗi thì test vẫn xanh khi lệnh được tạo rồi bị từ
chối ngay sau đó, tức đúng hành vi mà BE-03 dựng để bỏ đi.

### 3.3 Marker và sơ đồ luồng

```
$ node scripts/scan-pending.mjs --check
Marker hợp lệ: 10 điểm cắm, 11 điểm chặn, 12 bước luồng. Không có lỗi.

$ node scripts/gen-flow-diagram.mjs purchase --check
Khớp marker: docs/flows/purchase.md
```

Số bước liền mạch, đo từ chính dữ liệu của script:

```
$ node scripts/scan-pending.mjs --json | node -e "…flows.filter(f=>f.flow==='purchase')…"
steps: 1,2,3,4,5,6,7,8,9,10,11,12
tổng: 12
```

Đánh số: 1 `previewPurchaseAction` · 2 `previewPurchase` · 3 `placeOrderAction` ·
4 `placeOrder` · 5 `quotePurchase` · 6 `executeOrderAction` · 7 `executeOrder` ·
8 `runPurchaseChecks` · 9 `sendAndSettle` · 10 `executePurchase` · 11 `listOrdersAction` ·
12 `listOrders`. Tức hai bước xem trước chèn vào **đầu**, mười bước cũ dịch thành 3→12 đúng
như yêu cầu 7.

`@pending FE-05` gắn ở **hai** chỗ của luồng mua, cả hai nêu rõ nghĩa vụ chống gọi dồn:

```
$ git grep -c "@pending FE-05" -- app/src/app/actions/purchase.ts app/src/lib/bank/purchase.service.ts
app/src/app/actions/purchase.ts:2
app/src/lib/bank/purchase.service.ts:1
```

(2 ở tệp action = một cho `previewPurchaseAction`, một có từ trước cho `placeOrderAction`.)

### 3.4 Kiểm chứng cục bộ đầy đủ — chạy **một lần** ở cuối task

```
$ bash scripts/run-local-all.sh
  Đạt:     8
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 3 - ĐIỂM CẮM (marker)
    PASS  LỚP 3 - KHUÔN CHECKPOINT
    PASS  LỚP 1 - SPEC TEST CONTRACT EVM
    PASS  LỚP 1 - SPEC TEST CONTRACT SOROBAN
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST
  Không đạt: 0
  => ĐẠT toàn bộ kiểm chứng cục bộ.
```

**6 cảnh báo của "luật kiến trúc" KHÔNG có cái nào mới.** Đo bằng cách chạy chính script đó trên
`dev` rồi trên nhánh này, hai con số bằng nhau:

```
$ git checkout dev  && bash scripts/verify-arch-rules.sh | grep -E "PASS: [0-9]+"
  PASS: 20   FAIL: 0   WARN: 6
$ git checkout feat/purchase-preview && bash scripts/verify-arch-rules.sh | grep -E "PASS: [0-9]+"
  PASS: 20   FAIL: 0   WARN: 6
```

Sáu cảnh báo đó là: `process.env` đọc ngoài `lib/config` · địa chỉ EVM hardcode trong `app/src` ·
`BASE_REF` chưa đặt nên bỏ qua phép so contract · ba spec Stellar chưa tới lượt làm. BE-03 không
chạm `packages/`, nên `LỚP 1` (hardhat + cargo) chỉ là phép đối chứng rằng nhánh này không làm hỏng
gì bên contract.

Lệnh kiểm khuôn checkpoint này (sau khi BE-03 sang `done` thì `--in-progress` không còn kiểm nó):

```
$ node scripts/check-checkpoint.mjs docs/CHECKPOINT_BE03.md docs/be-03-purchase-preview/requirements.md
```

### 3.5 Tài liệu đã cập nhật

| Mục `tech-report.md` | Sửa gì |
|---|---|
| Metadata | Phiên bản 2.0 → **2.1**, nhánh/commit, "Đang chờ nghiệm thu" thêm BE-03 |
| 3.3 ma trận quyền | Ghi rõ **BE-03 không thêm quyền nào**, dùng lại `order:place`; "BE-03..BE-07" → "BE-04..BE-07" |
| 3.4 bảng file | `purchase.service.ts` thêm `previewPurchase()`; `schemas.ts` thêm `previewPurchaseSchema` |
| 4.2 luồng MUA | Thêm **Giai đoạn 0 — xem trước**; Giai đoạn 1 thêm bước kiểm điều kiện; bảng bốn phép kiểm thêm cột `id`; nợ của luồng thêm giới hạn của xem trước |
| 3.10 điểm cắm | **Sinh lại bằng script**, không sửa tay: `node scripts/scan-pending.mjs --write-report` |
| 4.5 lộ trình | Thêm dòng BE-03 |

`.kiro/task-status.json`: `BE-03` chuyển sang `done`. Không có marker nào chờ BE-03 nên không phải
dọn marker (`git grep "BE-03" -- app packages scripts` rỗng).

---

## 4. Quyết định thiết kế cần Supervisor xác nhận

**QĐ-1 — `runPurchaseChecks` trả DANH SÁCH, nhưng vẫn dừng ở phép trượt đầu tiên.**
Yêu cầu 3 nói "trả về **từng phép kiểm riêng**" và gọi `blockers` ở số nhiều, nên kết quả là một
mảng `checks`. Nhưng **không** chạy hết cả năm phép, vì `canTransfer` kiểm lại cả số dư WPT của ví
SPV: chạy hết sẽ báo **hai** blocker (`supply` và `transferable`) cho **một** nguyên nhân. Hệ quả
phải đọc kỹ: `blockers` hiện tại có **nhiều nhất một** phần tử, và phép kiểm nằm sau phép trượt
**vắng mặt** khỏi `checks` — vắng nghĩa là "chưa kiểm", khác hẳn `ok: true`. Đó cũng là lý do
`checks` là mảng chứ không phải đối tượng có đủ năm khoá: đối tượng đủ khoá buộc phải điền một giá
trị cho phép kiểm chưa chạy, và mọi giá trị điền vào đó đều là nói sai.

Nếu Supervisor muốn nghĩa "báo **tất cả** điều kiện thiếu trong một lần" thì phải quyết thêm hai
việc: gộp `supply` với `transferable` thế nào, và có chấp nhận bốn lời gọi đọc thừa trên đường
`executeOrder` bị từ chối hay không. Chưa có câu trả lời nên chưa làm.

**QĐ-2 — `previewPurchase` kiểm quyền bằng `assertCan`, KHÔNG dùng `authorize()`.**
`authorize()` ghi một bản ghi kiểm toán cho **mỗi** lời gọi. FE-05 gọi xem trước sau mỗi ký tự
người dùng gõ, nên dùng `authorize()` sẽ đổ hàng chục bản ghi "đã cho phép xem" cho một lần mua —
nhấn chìm sổ kiểm toán bằng bản ghi vô nghĩa. LUẬT #3 vẫn giữ: quyền đi qua RBAC (`assertCan`),
không so tên vai. Đây là cách duy nhất thoả đồng thời yêu cầu 2 ("kiểm quyền `order:place`") và
"**Không ghi gì** vào cơ sở dữ liệu". Hệ quả là CQ-1 ở mục 5.

**QĐ-3 — phép kiểm giá là CỔNG, không phải một phép kiểm ngang hàng.**
Khi `quotedVndAmount` có mà lệch báo giá hiện tại, hàm trả về **ngay**. Bốn phép còn lại đều so với
con số vừa được chứng minh là lạc hậu, nên chạy tiếp chỉ sinh ra bốn câu trả lời đúng về một cái
giá không còn hiệu lực. Phép kiểm này **không chạy** ở xem trước và ở đặt lệnh: chưa có lệnh nên
không có giá cũ để so, và so báo giá vừa lấy với chính nó là một phép kiểm không nói gì.

**QĐ-4 — `previewPurchaseSchema` là bút danh của `placeOrderSchema`, không khai lại.**
Hai schema cùng nội dung sẽ lệch nhau ở lần sửa đầu tiên, và hệ quả đúng là thứ màn hình xem trước
tồn tại để tránh: xem trước trả "đủ điều kiện" cho dữ liệu mà đặt lệnh từ chối vì sai dạng. Có một
ca test chốt lại: cùng năm giá trị sai dạng, hai đường phải trả cùng mã `VALIDATION`.

---

## 5. Sai lệch phát hiện được, và câu hỏi mở

### SL-1 — Điều kiện 5 ("test BE-02 cũ vẫn xanh") mâu thuẫn với yêu cầu 4

Yêu cầu 4 buộc `placeOrder` **không tạo bản ghi** khi thiếu điều kiện. Năm ca BE-02 lại dựng bối
cảnh bằng cách **đặt một lệnh vốn đã thiếu điều kiện** rồi mới khớp. Sau yêu cầu 4, `placeOrder`
trong chính phần dựng bối cảnh đó bị từ chối, nên năm ca đỏ vì lý do không liên quan đến điều nó
kiểm. Đo lúc phát hiện: **9 ca đỏ** (5 ca trên + 4 ca ở nhóm 7.8, vì `seedTwoInvestors` cấp KYC cho
`BOB` mà không cấp tiền).

Không có cách nào giữ nguyên cả hai. Đã chọn: **giữ yêu cầu 4**, đổi phần dựng bối cảnh của các ca
đó sang tình huống có thật — đặt lệnh khi **đủ** điều kiện, rồi hạ điều kiện xuống trước khi khớp
(bảng `DEGRADATIONS`: rút hết VNDB · thu hồi ủy quyền · `burn(SPV, 998n)` hạ tồn WPT). Mã lỗi, câu
lý do và trạng thái `REJECTED` mà các ca đó kiểm đều **giữ nguyên**.

Một ca phải **đổi chỗ kiểm**, không chỉ đổi bối cảnh: `chưa phát hành nguồn cung thì REJECTED`.
Sau yêu cầu 4, trạng thái "có lệnh trong sổ **và** `spvWallet()` trả `null`" là **không thể đạt** —
lệnh chỉ tồn tại khi đã phát hành nguồn cung, mà nguồn cung phát hành rồi thì không thu lại được
(`mintInitialSupply` chặn lần hai). Ca này chuyển từ `describe('executeOrder …')` sang
`describe('placeOrder')`, giữ nguyên mã `INSUFFICIENT_SUPPLY` và câu `/Chưa phát hành nguồn cung/`.
Để nó ở chỗ cũ là giữ một ca kiểm thử mô tả trạng thái không tồn tại.

Vì vậy điều kiện 5 ghi **🔶 chứ không ✅**: các ca đều xanh, nhưng ai đọc "✅ test cũ vẫn xanh" sẽ
hiểu là không có gì phải sửa, và đó là điều quan trọng nhất của task này bị che đi.

### SL-2 — Không nhân bản spec sang `.kiro/specs/`

`branching.md` §11 đòi "có spec trong `.kiro/specs/<tên>/` đủ 3 file". BE-03 có **2** tệp ở
`docs/be-03-purchase-preview/`, và `efficiency.md` §5 nói `design.md` chỉ có khi cần — không có là
bình thường. Đã **không** copy sang `.kiro/specs/` vì chính `tech-report.md` mục nợ P2 ghi hai bản
spec song song đã lệch nhau **5 trên 6 cặp**. `resolveTaskFiles` của `check-checkpoint.mjs` có
`SPEC_DIRS = ['.kiro/specs', 'docs']` nên vẫn tìm được ở `docs/`; máy kiểm xanh.

### CQ-1 — Xem trước bị chặn có cần vào sổ kiểm toán?

Hai cách hiểu của "**Không ghi gì** vào cơ sở dữ liệu":

1. **Tuyệt đối** — kể cả ca bị từ chối quyền. Đây là cách đã làm, vì nó đúng chữ của yêu cầu và
   kiểm được bằng một phép so ảnh chụp.
2. **Chỉ ca thành công** — ca DENIED vẫn ghi một bản ghi, vì `authorize.ts` nói "kênh `(audit)` cần
   thấy ai đã thử làm gì", và ca bị chặn thì hiếm nên không có nguy cơ ngập sổ.

Đề xuất: giữ (1) cho BE-03. Xem trước là hàm **chỉ đọc**, không đổi gì, và chưa có SIWE (AU-01) nên
server còn chưa biết ví nào thuộc phiên nào — ghi sổ lúc này cũng không quy được trách nhiệm cho
ai. Khi AU-01 xong thì thêm ghi sổ cho **riêng** ca DENIED.

### CQ-2 — `MC-02` còn ở `inProgress` dù PR #22 đã merge

`.kiro/task-status.json` để `MC-02` ở `inProgress`, nhưng `dev` đã có commit merge `ac25c8b`
(PR #22). Theo `make-control.md` §7 thì việc chuyển sang `done` thuộc **commit cuối của MC-02**, nên
BE-03 **không tự sửa**. Hệ quả hiện tại vô hại: `check-checkpoint.mjs --in-progress` kiểm
`CHECKPOINT_MC02.md` và báo ĐẠT. Đề nghị Owner/Supervisor xác nhận để chuyển `MC-02` sang `done`
trong một commit riêng.

### CQ-3 — Steering `efficiency.md` nằm ở nhánh khác

`requirements.md` ghi nền là `dev` **sau khi** MC-02 và steering `efficiency.md` đã merge. MC-02 đã
merge (`ac25c8b`), `efficiency.md` thì chưa — Owner yêu cầu bổ sung nó cùng lượt làm việc này. Vì
`branching.md` §1 chỉ cho phép một nền duy nhất là `dev`, đã tách thành **hai nhánh độc lập**:

- `docs/efficiency-steering` (commit `1bbf0eb`) — chỉ một tệp `.kiro/steering/efficiency.md`.
- `feat/purchase-preview` — nhánh BE-03 này, nền `dev` `ac25c8b`.

Hai nhánh **không** chạm tệp nào chung nên merge theo thứ tự nào cũng không xung đột. Nội dung
`efficiency.md` vẫn được tuân theo trong lúc làm BE-03 (mức kiểm chứng **Vừa**, chỉ chạy test mà
mục Tác động chỉ ra, `run-local-all.sh` một lần ở cuối). Nhờ Owner merge nhánh steering trước cho
đúng thứ tự spec ghi.

### Sai lệch số đo trong spec: không có

Mục "Tác động" của `requirements.md` ghi lệnh đo `grep -rlnE "runPurchaseChecks|placeOrder\b" app/src app/test`.
Đo lại khớp:

```
$ grep -rlnE "runPurchaseChecks|placeOrder\b" app/src app/test | wc -l
4
```

---

## 6. Tự đánh giá 3 LUẬT kiến trúc

- [x] **Mọi call chain qua `ILedgerPort`.** `previewPurchase` không gọi viem/ethers; nó gọi
  `getLedger(chain)` rồi để `runPurchaseChecks` dùng `quotePurchase` / `paymentBalanceOf` /
  `paymentAllowanceOf` / `spvWallet` / `balanceOf` / `canTransfer`. Không thêm method nào vào port.
- [x] **Mọi ký qua `ISigner`.** BE-03 **không gửi giao dịch nào** — cả `previewPurchase` và phần
  thêm vào `placeOrder` chỉ gọi hàm đọc, nên không có chỗ nào cần ký. `getBankSigner` vẫn chỉ được
  gọi ở `sendAndSettle`, không đổi.
- [x] **Mọi kiểm quyền qua RBAC.** `previewPurchase` dùng `assertCan(await currentRole(), 'order:place')`.
  Không có `if (role === …)` mới; `verify-arch-rules.sh` PASS trong mục 3.4.
