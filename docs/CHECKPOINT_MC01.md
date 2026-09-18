# Báo cáo bàn giao — MC-01: Make Control (điểm cắm, dọn rác, nền cho sơ đồ luồng)

| | |
|---|---|
| Task | MC-01 (Make Control, P0, 8 điểm) |
| Nhánh | `mc/01-make-control`, tạo **từ `dev`** (`71932bb`) |
| Spec | `docs/mc-01-make-control/{requirements,design,tasks}.md` + bản ở `.kiro/specs/mc-01-make-control/` (xem sai lệch SL-1 ở mục 7) |
| Tiến độ | **Bước 1/10 xong.** Bước 2–10 chưa làm |
| Phạm vi | Không đổi hành vi hệ thống. Mọi test đang xanh phải xanh nguyên |

`dev` đã kiểm lành trước khi tạo nhánh, theo `branching.md` §5:

```
$ git ls-tree -r --name-only dev | grep -c '^packages/'           → 73   (phải > 0)
$ git ls-tree -r --name-only dev | grep -c '^app/src/lib/ledger'  → 6    (phải > 0)
$ git ls-tree -r --name-only dev | grep -c AssetRegistry          → 0    (phải = 0)
```

Nền của nhánh đúng là `dev`, không lấy từ nhánh phụ:

```
$ git merge-base dev HEAD
71932bbbcd27811b202e98487cc55b7bf6878619
$ git merge-base --is-ancestor dev HEAD   → 0 (HEAD chứa toàn bộ dev)
```

---

## 1. Đã làm

### Bước 1 — Chốt quy ước và nguồn trạng thái task ✅

Ba commit, chia theo đơn vị mục tiêu:

| Commit | Nội dung |
|---|---|
| `350fdfb` | `docs(mc): spec MC-01 make control (requirements, design, tasks)` — đưa spec vào lịch sử nhánh, cả `docs/` và `.kiro/specs/` |
| `cefc895` | `feat(mc): quy ước marker điểm cắm và nguồn trạng thái task` — steering + JSON trạng thái |
| *(commit này)* | `docs(mc): khung checkpoint MC-01` |

Tệp tạo mới:

| Tệp | Vai trò |
|---|---|
| `docs/mc-01-make-control/{requirements,design,tasks}.md` | Spec, bản đọc cho người |
| `.kiro/specs/mc-01-make-control/{requirements,design,tasks}.md` | Spec, bản Kiro nạp |
| `.kiro/steering/make-control.md` | Quy ước `@pending` / `@blocked` / `@flow`, `inclusion: always` |
| `.kiro/task-status.json` | Nguồn duy nhất trạng thái task + tập mã task hợp lệ |
| `docs/CHECKPOINT_MC01.md` | Tệp này |

Nội dung steering trả lời ba câu bắt buộc: marker viết thế nào (mục 1, 2, 4), ai cập nhật
`task-status.json` (mục 7 — Kiro), cập nhật lúc nào (mục 7 — commit cuối của mỗi task, cùng lúc
với `docs/tech-report.md`).

**Bước 2–10:** _(chưa làm)_

---

## 2. Đối chiếu DoD

| Task | DoD | Đạt? | Ghi chú |
|---|---|---|---|
| 1.1 | `.kiro/steering/make-control.md` có `inclusion: always`, ghi đủ `@pending` / `@blocked` / `@flow` | ✅ | Ví dụ lấy từ mã thật trong repo, không bịa |
| 1.2 | `.kiro/task-status.json` với `done` = FE-01, FE-02, BE-01, BE-02, BE-08, BE-09 | ✅ | Bảng mã task hợp lệ ở mục 3 |
| 1.3 | Steering ghi ai cập nhật tệp này và lúc nào | ✅ | Mục 7 của steering, có bảng Ai / Lúc nào / Cái gì |
| 2.x | Script quét marker | ⬜ | _(chờ Bước 2)_ |
| 3.x | Chuyển marker tự do sang quy ước mới | ⬜ | _(chờ Bước 3)_ |
| 4.x | Test chống marker lạc hậu | ⬜ | _(chờ Bước 4)_ |
| 5.x | Phân loại 27 export | ⬜ | _(chờ Bước 5)_ |
| 6.x | Hợp nhất nguồn giá phát hành | ⬜ | _(chờ Bước 6)_ |
| 7.x | Dọn phụ thuộc, làm rõ `src/empty.ts` | ⬜ | _(chờ Bước 7)_ |
| 8.x | Script lớp 3 không dương tính giả | ⬜ | _(chờ Bước 8)_ |
| 9.x | Nền cho sơ đồ luồng | ⬜ | _(chờ Bước 9)_ |
| 10.x | Tài liệu | ⬜ | _(chờ Bước 10)_ |

---

## 3. Kết quả chạy đầy đủ

### 3.1 Bảng mã task hợp lệ — đo thật, không bịa

Lệnh và **output nguyên văn**:

```
$ grep -rhoE '\b(FE|BE|SC|AU|MC)-[0-9]{2}\b' docs/ .kiro/ | sort -u
AU-01
AU-02
BE-01
BE-02
BE-03
BE-04
BE-05
BE-06
BE-07
BE-08
BE-09
BE-10
BE-11
FE-01
FE-02
FE-04
FE-05
FE-06
FE-09
FE-10
FE-11
MC-01
MC-02
SC-02
SC-03
```

**25 mã**, khớp đúng con số Supervisor đưa trong tài liệu giao việc. Không lệch.

Số lần xuất hiện mỗi mã (dùng để nhận ra mã gõ sai — mã chỉ xuất hiện 1 lần đáng nghi):

```
$ grep -rhoE '\b(FE|BE|SC|AU|MC)-[0-9]{2}\b' docs/ .kiro/ | sort | uniq -c | sort -k2
  19 AU-01     3 AU-02    51 BE-01   119 BE-02     3 BE-03
  16 BE-04     7 BE-05    19 BE-06    21 BE-07    66 BE-08
  80 BE-09     1 BE-10     1 BE-11    43 FE-01    25 FE-02
  13 FE-04    42 FE-05     7 FE-06    13 FE-09     2 FE-10
  12 FE-11    12 MC-01     2 MC-02    40 SC-02    35 SC-03
```

`BE-10` và `BE-11` chỉ xuất hiện 1 lần nên đã kiểm từng chỗ, cả hai là mã thật chứ không phải
lỗi gõ:

```
docs/be-02-purchase-orders/requirements.md:77:- Đối soát toàn hệ (thuộc BE-11).
docs/be-02-purchase-orders/requirements.md:78:- Xử lý giao dịch treo dùng chung (thuộc BE-10).
```

### 3.2 Đối chiếu JSON với số đo — khớp hoàn toàn

```
$ grep -rhoE '\b(FE|BE|SC|AU|MC)-[0-9]{2}\b' docs/ .kiro/ | sort -u > /tmp/mc01-measured.txt
$ node -e "const s=require('./.kiro/task-status.json');console.log([...s.done,...s.inProgress,...s.planned].sort().join('\n'))" > /tmp/mc01-json.txt
$ diff -q /tmp/mc01-measured.txt /tmp/mc01-json.txt && echo "KHỚP HOÀN TOÀN"
KHỚP HOÀN TOÀN
```

### 3.3 Bất biến "một mã ở đúng một danh sách"

```
$ node -e "const s=require('./.kiro/task-status.json'); const all=[...s.done,...s.inProgress,...s.planned]; const dup=all.filter((x,i)=>all.indexOf(x)!==i); if(dup.length) throw new Error('trùng: '+dup); console.log('OK', all.length, 'mã task hợp lệ')"
OK 25 mã task hợp lệ
```

Phân bổ: `done` 6 · `inProgress` 1 · `planned` 18 = **25**.

### 3.4 Bảng điểm cắm mà script in ra

_(chờ Bước 2 — `scripts/scan-pending.mjs` chưa tồn tại)_

### 3.5 `bash scripts/run-local-all.sh`

_(chờ Bước 10 — Bước 1 không chạm mã nguồn nên chưa cần; sẽ dán nguyên văn ở vòng nộp cuối)_

---

## 4. Bảng phân loại đầy đủ 27 export

_(chờ Bước 5)_

---

## 5. Kết quả ba lần kiểm chứng bằng đột biến

| Phép kiểm | Đột biến | Kết quả |
|---|---|---|
| Test marker lạc hậu | Thêm `BE-02` vào marker một tệp → phải đỏ | _(chờ Bước 4)_ |
| Test marker mã task không tồn tại | `@pending XX-99` → phải đỏ | _(chờ Bước 4)_ |
| Test nguồn giá | Tách lại thành hai hằng số → phải đỏ | _(chờ Bước 6)_ |
| Script lớp 3 | Thêm `SPT` vào một tệp `app/src` → phải đỏ | _(chờ Bước 8)_ |

---

## 6. Lựa chọn chỗ đặt hằng số giá phát hành và lý do

_(chờ Bước 6 — phải kiểm chiều phụ thuộc `lib/ledger` → `lib/bank` trước khi quyết)_

---

## 7. Kết luận về `@x402/*` và `src/empty.ts`

_(chờ Bước 7)_

---

## 8. Sơ đồ luồng mua WPT

_(chờ Bước 9)_

---

## 9. DEVIATION so với spec

_(chưa có ở Bước 1)_

---

## 10. Sai lệch phát hiện được

### SL-1 — Hai bản spec **không** giống hệt nhau

Tài liệu giao việc nói `docs/mc-01-make-control/` và `.kiro/specs/mc-01-make-control/` là "hai bản
giống hệt nhau". Đo thật thì lệch hai chỗ:

```
$ diff -r docs/mc-01-make-control/ .kiro/specs/mc-01-make-control/
11,13c11,13
< - [ ] 1.1 Tạo `.kiro/steering/make-control.md` ...
---
> - [-] 1.1 Tạo `.kiro/steering/make-control.md` ...
   (… 30 dòng checkbox tương tự)
Only in .kiro/specs/mc-01-make-control: tasks.meta.json
```

Nguyên nhân: bộ theo dõi task của Kiro ghi trạng thái trực tiếp vào `.kiro/specs/.../tasks.md`
(`[-]` = đang làm, `[~]` = chưa làm) và sinh thêm `tasks.meta.json`. `docs/` là bản người đọc nên
giữ `[ ]`.

**Đã xử lý:** commit cả hai bản **đúng như trên đĩa**, không chuẩn hóa cho giống nhau. Chuẩn hóa
thì bộ theo dõi task sẽ ghi lại ngay, và commit sẽ mô tả một trạng thái không tồn tại. Tiền lệ
BE-09: `.kiro/specs/be-09-data-schema/tasks.md` và `docs/be-09-data-schema/tasks.md` giống hệt
nhau, cùng `- [ ]` — nghĩa là trước đây trạng thái sống chưa từng được commit.

### SL-2 — Số method bị chặn trong `evm.adapter.ts` là **11**, không phải 10; và không phải tất cả chờ SC-02

Tài liệu giao việc (mục B1.2) nói "10 method trong `app/src/lib/ledger/evm.adapter.ts` chờ SC-02".
`design.md` QĐ-2 cũng nói "10 method trong `evm.adapter` là `@blocked SC-02`". Đo thật:

```
$ git grep -n -E "return pendingContract\(" -- app/src/lib/ledger/evm.adapter.ts
372:      return pendingContract('mintInitialSupply', 'hợp đồng phát hành một lần (SC-02)');
376:      return pendingContract('isInitialSupplyMinted', 'hợp đồng phát hành một lần (SC-02)');
388:      return pendingContract('spvWallet', 'hợp đồng phát hành một lần (SC-02)');
397:      return pendingContract('quotePurchase', 'hợp đồng khớp lệnh (SC-03)');
413:      return pendingContract('paymentAllowanceOf', 'địa chỉ hợp đồng khớp lệnh (SC-03)');
418:      return pendingContract('executePurchase', 'hợp đồng khớp lệnh (SC-03)');
511:      return pendingContract(  // distributeBatch
527:      return pendingContract('setSettlementMode', 'xác nhận cờ tất toán nối vào contract nào');
531:      return pendingContract('isSettlementMode', 'xác nhận cờ tất toán nối vào contract nào');
536:      return pendingContract('setNavRate', 'xác nhận giá NAV có phải Redemption.rate hay không');
540:      return pendingContract('navRate', 'xác nhận giá NAV có phải Redemption.rate hay không');
```

**11 method**, chia bốn nhóm chứ không một:

| Nhóm | Method | Chờ gì |
|---|---|---|
| 1 | `mintInitialSupply`, `isInitialSupplyMinted`, `spvWallet` | Hợp đồng phát hành một lần — **SC-02** |
| 2 | `quotePurchase`, `paymentAllowanceOf`, `executePurchase` | Hợp đồng khớp lệnh — **SC-03** |
| 3 | `distributeBatch` | Quyết định mapping `snapshotId → distributionId` — **BE-06** |
| 4 | `setSettlementMode`, `isSettlementMode`, `setNavRate`, `navRate` | **Không chờ task nào** — chờ Owner/Supervisor xác nhận nối vào contract nào. Xem Q1 |

Ảnh hưởng: steering đã viết theo số đo thật ("ba method chờ hợp đồng phát hành một lần của
SC-02"), không chép lại con số 10 của tài liệu giao việc. Bước 3 phải gắn marker theo bảng bốn
nhóm này, không gắn `@blocked SC-02` cho cả 11.

Bài học `lessons.md` đã lường đúng tình huống này: "Tin số dòng/số chỗ trong tài liệu giao việc
mà không đo lại → SAI. Luôn `git grep` đếm lại trước khi lập kế hoạch."

### SL-3 — Số tệp có bình luận nhắc task khác là **43**, không phải 33

`requirements.md` mục 2 và `tasks.md` 3.1 nói "rải rác **33 tệp**". Đo thật:

```
$ git grep -l -E '(FE|BE|SC|AU|MC)-[0-9][0-9]' -- app/src app/test app/e2e packages | wc -l
43
$ git grep -n -E '(FE|BE|SC|AU|MC)-[0-9][0-9]' -- app/src app/test app/e2e packages | wc -l
115
```

Chưa kết luận đây là sai lệch của spec: phép đếm 43 bắt **mọi** lần nhắc mã task, kể cả câu văn
giải thích thiết kế ("theo BE-01 design QĐ-1") vốn **không phải** marker điểm cắm và **không nên**
đổi thành `@pending`. Con số 33 có thể là số tệp thật sự chứa marker. **Bước 3 phải đo lại và phân
loại từng chỗ**, ghi con số cuối vào mục này, không dùng bừa 33 hay 43.

---

## 11. Câu hỏi mở

### Q1 — Bốn method tất toán chặn vì một **quyết định**, không vì một task. Ghi marker thế nào?

Bốn method ở nhóm 4 của SL-2 (`setSettlementMode`, `isSettlementMode`, `setNavRate`, `navRate`)
không chờ task nào cả. Bình luận trong mã ghi rõ: `ProjectToken.paused` chặn chuyển nhượng và vẫn
cho `agentBurn`, còn `Redemption.paused` thì **ngược hướng**; chọn sai một trong hai cho ra hệ
thống chạy được nhưng làm ngược, nên **cần Owner/Supervisor xác nhận trước khi nối**.

Quy ước `@blocked <MÃ-TASK> | ...` đòi một mã task hợp lệ. Bốn chỗ này không có mã nào đúng nghĩa.

Hai cách hiểu:

- **(a)** Gán tạm `@blocked SC-03` vì cờ tất toán rồi cũng nằm ở tầng hợp đồng. Rủi ro: sai nghĩa.
  SC-03 là hợp đồng khớp lệnh, xong SC-03 cũng **không** trả lời được câu hỏi nối vào đâu, nên
  marker sẽ nói "chờ SC-03" trong khi thứ thật sự thiếu là một quyết định. Đúng loại lỗi mà mục 3
  của steering cảnh báo: trả lời sai một câu hỏi mà người đọc tin là đã được trả lời.
- **(b)** Mở một mã task mới cho việc quyết định này (ví dụ `SC-04` hoặc `BE-12`), thêm vào
  `planned` của `task-status.json`, rồi `@blocked <mã mới>`. Marker đúng nghĩa và vào được bảng
  điểm cắm.

**Phương án đề xuất: (b).** Việc này có đầu ra rõ ràng (một quyết định kiến trúc kèm chỗ nối) và
đang chặn 4 method, tức nó **là** một task chứ không phải ghi chú. Gán tạm vào SC-03 thì lúc SC-03
xong, quy tắc "dọn marker khi task done" buộc xóa 4 marker này trong khi thứ chặn vẫn còn đó.

Cần Owner/Supervisor cho mã task. **Chưa có câu trả lời thì Bước 3 chưa gắn marker cho 4 method
này**, và ghi lại lý do tại chỗ.

### Q2 — `tasks.meta.json` nên commit hay nên `.gitignore`?

`.kiro/specs/mc-01-make-control/tasks.meta.json` (15 KB) là trạng thái máy sinh của bộ theo dõi
task, đổi mỗi lần một checkbox đổi. Tiền lệ be-02 và be-09: **không** commit (`git ls-files`
xác nhận chỉ có ba tệp `.md`).

Bước 1 đã theo tiền lệ, **không** commit tệp này. Hệ quả: `git status --short` còn một dòng
`?? .kiro/specs/mc-01-make-control/tasks.meta.json`, tức working tree **chưa sạch tuyệt đối** theo
nghĩa chặt của DoD.

Ba hướng, cần Owner chọn: (a) giữ nguyên, coi là trạng thái máy nằm ngoài git; (b) thêm
`.kiro/specs/*/tasks.meta.json` vào `.gitignore`; (c) commit luôn, chấp nhận churn mỗi commit.
**Đề xuất (b)** — đúng bản chất tệp và làm working tree sạch thật. Chưa tự làm vì `.gitignore` là
tệp dùng chung, sửa nó không thuộc phạm vi Bước 1.

---

## 12. Tự đánh giá 3 LUẬT kiến trúc

Bước 1 **không chạm tệp mã nguồn nào** (`app/src`, `packages/*/src`), chỉ tạo steering, JSON và
tài liệu. Ba luật không bị ảnh hưởng.

```
$ git diff --name-only 71932bb..HEAD
.kiro/specs/mc-01-make-control/design.md
.kiro/specs/mc-01-make-control/requirements.md
.kiro/specs/mc-01-make-control/tasks.md
.kiro/steering/make-control.md
.kiro/task-status.json
docs/CHECKPOINT_MC01.md
docs/mc-01-make-control/design.md
docs/mc-01-make-control/requirements.md
docs/mc-01-make-control/tasks.md
```

- [x] Mọi call chain qua `ILedgerPort` — không đổi
- [x] Mọi ký qua `ISigner` — không đổi
- [x] Mọi kiểm quyền qua RBAC — không đổi

Đánh giá đầy đủ sẽ làm lại ở vòng nộp cuối, khi Bước 5–7 đã chạm mã nguồn.
