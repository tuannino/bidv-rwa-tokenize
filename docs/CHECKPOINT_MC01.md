# Báo cáo bàn giao — MC-01: Make Control (điểm cắm, dọn rác, nền cho sơ đồ luồng)

| | |
|---|---|
| Task | MC-01 (Make Control, P0, 8 điểm) |
| Nhánh | `mc/01-make-control`, tạo **từ `dev`** (`71932bb`) |
| Spec | `docs/mc-01-make-control/{requirements,design,tasks}.md` + bản ở `.kiro/specs/mc-01-make-control/` (xem sai lệch SL-1 ở mục 7) |
| Tiến độ | **Bước 1–3/10 xong.** Bước 4–10 chưa làm |
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

### Bước 2 — Script quét marker ✅

Ba commit, chia theo đơn vị mục tiêu:

| Commit | Nội dung |
|---|---|
| `c84ec7f` | `chore(mc): thêm mã task SC-04 và bỏ tasks.meta.json khỏi git` — thi hành hai quyết định của Owner (xem mục 11, Q1 và Q2) |
| `609deb8` | `feat(mc): script quét điểm cắm` — `scripts/scan-pending.mjs`, ba chế độ |
| *(commit này)* | `feat(mc): run-local-all gọi scan-pending --check` — cắm vào kiểm chứng cục bộ + checkpoint |

Tệp tạo mới / sửa:

| Tệp | Vai trò |
|---|---|
| `scripts/scan-pending.mjs` | Quét marker. Ba chế độ: bảng cho người đọc, `--json`, `--check` |
| `scripts/run-local-all.sh` | Thêm mục `LỚP 3 - ĐIỂM CẮM (marker)`; in bảng ở phần TỔNG KẾT |
| `.kiro/task-status.json` | Thêm `SC-04` vào `planned` → 26 mã task hợp lệ |
| `.gitignore` | Bỏ `.kiro/specs/*/tasks.meta.json` khỏi git |

Script là **nơi duy nhất** khai cú pháp marker và phép kiểm số bước luồng. Cả hai được
`export` để Bước 4 (`app/test/pending-markers.test.ts`) và Bước 9
(`scripts/gen-flow-diagram.mjs`) nhập vào dùng lại, không viết lại biểu thức chính quy.

`SC-04` (mới thêm) = *hợp đồng cờ tất toán + giá NAV*: quyết định cờ "đang tất toán" nằm ở
contract nào và `navRate` nối vào đâu. Bước 2 **chỉ thêm mã vào JSON**, chưa gắn marker —
việc gắn `@blocked SC-04` cho bốn method `setSettlementMode` / `isSettlementMode` /
`setNavRate` / `navRate` thuộc Bước 3.

### Bước 3 — Chuyển marker tự do sang quy ước mới ✅

Hai commit mã nguồn, chia theo **vùng**:

| Commit | Nội dung |
|---|---|
| `4e20eae` | `refactor(mc): marker điểm chặn cho 11 method chưa nối được ở lib/ledger` — 11 `@blocked` chia **bốn** nhóm (SC-02 ×3, SC-03 ×3, BE-06 ×1, SC-04 ×4) |
| `d1d5c13` | `refactor(mc): marker điểm cắm expireStaleOrders, dọn ghi chú lạc hậu ở lib/bank` — 1 `@pending BE-07` + 1 ghi chú nhóm D viết lại |
| *(commit này)* | `docs(mc): chốt số đo Bước 3 và bảng điểm cắm vào checkpoint` |

Tệp sửa — **ba** tệp, và **chỉ bình luận**:

| Tệp | Sửa gì |
|---|---|
| `app/src/lib/ledger/evm.adapter.ts` | 11 marker `@blocked`; khối chú thích đầu tệp thôi liệt kê mã task |
| `app/src/lib/bank/purchase.service.ts` | 1 marker `@pending BE-07` trên `expireStaleOrders` |
| `app/src/lib/bank/portfolio.service.ts` | Viết lại ghi chú lạc hậu trong `PortfolioView` (nhóm D) |

**Điều bất ngờ nhất của Bước 3: số chỗ phải gắn marker ít hơn nhiều so với mọi con số
trong tài liệu.** Spec nói 33 tệp, Bước 1 đo 43 tệp / 115 dòng, thực tế phải gắn marker
**13 chỗ trên 2 tệp**. Số đo và cách phân loại ở mục 10, SL-3.

---

## 2. Đối chiếu DoD

| Task | DoD | Đạt? | Ghi chú |
|---|---|---|---|
| 1.1 | `.kiro/steering/make-control.md` có `inclusion: always`, ghi đủ `@pending` / `@blocked` / `@flow` | ✅ | Ví dụ lấy từ mã thật trong repo, không bịa |
| 1.2 | `.kiro/task-status.json` với `done` = FE-01, FE-02, BE-01, BE-02, BE-08, BE-09 | ✅ | Bảng mã task hợp lệ ở mục 3 |
| 1.3 | Steering ghi ai cập nhật tệp này và lúc nào | ✅ | Mục 7 của steering, có bảng Ai / Lúc nào / Cái gì |
| 2.1 | `scripts/scan-pending.mjs` có ba chế độ theo `design.md` mục 2 | ✅ | Mặc định / `--json` / `--check`, thêm `--help`. Node 20, ESM thuần, không thêm phụ thuộc |
| 2.2 | `--check` khác 0 **chỉ khi** marker sai định dạng, mã task không tồn tại, hoặc chờ task đã `done`; còn điểm cắm là bình thường | ✅ | Đo thật: repo lành → `exit=0` (mục 3.4). Đột biến → `exit=1` và liệt kê đủ loại lỗi (mục 5) |
| 2.3 | Cắm vào `run-local-all.sh`: chạy `--check`, in bảng ở tổng kết | ✅ | Mục `LỚP 3 - ĐIỂM CẮM (marker)` vào `PASSED`/`FAILED`; bảng in ở TỔNG KẾT, **không** ảnh hưởng mã thoát |
| 2.4 | Chạy thử trên `dev` hiện tại, xác nhận script đọc được marker đang có hoặc báo đúng là sai định dạng | ✅ | Repo hiện **0 marker** đúng cú pháp và **0 marker** sai cú pháp — bảng rỗng tử tế, không nổ lỗi (mục 3.4). Khả năng nhận dạng chứng minh bằng đột biến |
| 3.1 | Rà các tệp đang có bình luận nhắc task khác | ✅ | Đo lại từng **dòng**, không tin con số 33 hay 43. Phân loại A/B/C/D + một nhóm thứ năm mà tài liệu giao việc không lường: mục 10, SL-3 |
| 3.2 | Chuyển sang `@pending` nếu code chạy được, `@blocked` nếu chưa | ✅ | 1 `@pending` (nhóm A) + 11 `@blocked` (nhóm B). Bảng ở mục 3.4. `expireStaleOrders` chạy được và **có test phủ** nên là `@pending`, không phải `@blocked` |
| 3.3 | Bỏ marker không còn đúng, ví dụ nhắc task đã hoàn thành | ✅ | 1 chỗ nhóm D: `portfolio.service.ts` khẳng định `ILedgerPort` thiếu `paymentBalanceOf` — **sai**, method có từ BE-01. Chi tiết ở mục 10, SL-3 |
| 3.4 | Giữ nguyên nội dung `LedgerNotImplementedError` | ✅ | Chứng minh bằng phép kiểm "không đổi mã thực thi" ở mục 3.5, phép kiểm 3: diff **rỗng** |
| 3.5 | Chạy `scan-pending.mjs`, bảng ra đúng, không còn marker sai định dạng | ✅ | Mục 3.4 (bảng) và 3.5 (`exit=0`, 7 PASS / 0 FAIL) |
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

> **Cập nhật Bước 2:** Owner đã chốt thêm `SC-04`, nên từ Bước 2 tập mã hợp lệ là **26**.
> Số đo lại ở mục 3.2 và 3.3.

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

### 3.2 Đối chiếu JSON với số đo — và vì sao phép đo này bị **khai tử** từ Bước 2

Đo lại ở Bước 2 thì phép đo của Bước 1 **lệch một dòng**:

```
$ grep -rhoE '\b(FE|BE|SC|AU|MC)-[0-9]{2}\b' docs/ .kiro/ | sort -u > /tmp/mc01-measured.txt
$ node -e "const s=require('./.kiro/task-status.json');console.log([...s.done,...s.inProgress,...s.planned].sort().join('\n'))" > /tmp/mc01-json.txt
$ diff /tmp/mc01-measured.txt /tmp/mc01-json.txt
14d13
< BE-12
```

`BE-12` **không phải task nào cả**. Truy nguồn:

```
$ grep -rl 'BE-12' docs/ .kiro/
docs/CHECKPOINT_MC01.md
```

Đúng **một** tệp, và là chính tệp này — mọi lần xuất hiện đều nằm trong đoạn văn đang giải thích
chuyện này. (Dùng `grep -rl` thay `-rn` có lý do: số dòng đổi mỗi lần đoạn văn này được sửa, dán
số dòng vào đây là dán một con số lạc hậu ngay lúc dán.) Mã gốc sinh ra từ câu
"ví dụ `SC-04` hoặc `BE-12`" ở Q1 của Bước 1 — một **phương án giả định**; Owner chọn `SC-04`, nên
`BE-12` chưa từng tồn tại. Đã bỏ câu đó khỏi Q1, nhưng giải thích sai lệch thì buộc phải gọi tên
nó, nên `grep` vẫn thấy.

Đó chính là bằng chứng gọn nhất cho điều steering mục 7 nói: **văn bản tự do không làm nguồn
được.** Phép grep này đếm cả mã được nhắc trong câu bàn luận, phương án bị loại, và cả trong
đoạn văn giải thích chính nó — không có cách sửa nào làm nó đáng tin, vì lỗi nằm ở phương pháp.

**Xử lý:** khai tử phép đo này, không dùng làm phép kiểm nữa. Nguồn duy nhất về tập mã hợp lệ là
`.kiro/task-status.json`, và `--check` của script đọc **đúng tệp đó**, không grep tài liệu. Chiều
ngược lại — mọi mã trong JSON đều có mặt thật trong tài liệu — vẫn kiểm được và vẫn đúng:

```
$ node -e "const s=require('./.kiro/task-status.json');console.log([...s.done,...s.inProgress,...s.planned].sort().join('\n'))" | while read c; do grep -rqE "\b$c\b" docs/ .kiro/ || echo "THIẾU TRONG TÀI LIỆU: $c"; done; echo "xong"
xong
```

### 3.3 Bất biến "một mã ở đúng một danh sách"

```
$ node -e "const s=require('./.kiro/task-status.json'); const all=[...s.done,...s.inProgress,...s.planned]; const dup=all.filter((x,i)=>all.indexOf(x)!==i); if(dup.length) throw new Error('trùng: '+dup); console.log('OK', all.length, 'mã task hợp lệ'); console.log('done',s.done.length,'· inProgress',s.inProgress.length,'· planned',s.planned.length)"
OK 26 mã task hợp lệ
done 6 · inProgress 1 · planned 19
```

Phân bổ: `done` 6 · `inProgress` 1 · `planned` 19 = **26**.

Bất biến này còn được **chính script kiểm lại** mỗi lần chạy: vi phạm nó thì `--check` báo
`BAD_TASK_STATUS` và đỏ. Lý do: khi một mã nằm ở hai danh sách thì hai phép kiểm `UNKNOWN_TASK`
và `STALE_TASK` cho kết quả tùy thứ tự đọc, tức cả cơ chế mất nghĩa — im lặng bỏ qua tệ hơn đỏ.
Đã kiểm bằng nguồn giả (không chạm tệp thật):

```
$ TMP=$(mktemp -d) && mkdir -p "$TMP/.kiro"
$ printf '{"done":["BE-02"],"inProgress":["MC-01"],"planned":["BE-02","SC-04"]}' > "$TMP/.kiro/task-status.json"
$ node --input-type=module -e "import {readTaskStatus} from '\$PWD/scripts/scan-pending.mjs'; console.log(JSON.stringify(readTaskStatus('$TMP').errors,null,2))"
[
  {
    "code": "BAD_TASK_STATUS",
    "file": ".kiro/task-status.json",
    "line": 0,
    "message": "mã task BE-02 xuất hiện ở cả \"done\" và \"planned\" — bất biến của steering mục 7 là một mã ở ĐÚNG MỘT danh sách"
  }
]
```

Lần chạy này cũng chứng minh việc `import` module **không** kích hoạt CLI (không in bảng).

### 3.4 Bảng điểm cắm mà script in ra

Bảng sau Bước 3 — **dán nguyên văn**, đây là thứ Supervisor đọc đầu tiên. `[cắm]` = code đã
chạy được, chờ người gọi. `[chặn]` = code đang ném lỗi, chờ phụ thuộc xong trước.

```
$ node scripts/scan-pending.mjs
ĐIỂM CẮM ĐANG CHỜ

BE-06  (1 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:520  thiếu quyết định mapping snapshotId -> distributionId; hợp đồng `ProfitDistributor` thì đã có và đã deploy

BE-07  (1 điểm cắm)
  [cắm]   app/src/lib/bank/purchase.service.ts:543  đã sẵn đầu cuối: validate Zod, kiểm quyền `order:expire`, chuyển PLACED -> EXPIRED theo mốc thời gian, ghi sổ kiểm toán khi có lệnh đổi. BE-07 chỉ cần gọi theo lịch

SC-02  (3 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:375  thiếu hợp đồng phát hành một lần: chưa contract nào lưu cờ "đã phát hành nguồn cung ban đầu"
  [chặn]  app/src/lib/ledger/evm.adapter.ts:381  thiếu hợp đồng phát hành một lần: không có cờ nào để đọc, nên không trả được true/false thật
  [chặn]  app/src/lib/ledger/evm.adapter.ts:392  thiếu hợp đồng phát hành một lần: địa chỉ ví thanh toán SPV do chính hợp đồng đó giữ

SC-03  (3 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:401  thiếu hợp đồng khớp lệnh: giá bán một WPT nằm trong hợp đồng đó, chưa contract nào giữ
  [chặn]  app/src/lib/ledger/evm.adapter.ts:419  thiếu địa chỉ hợp đồng khớp lệnh để làm `spender`; `VNDToken.allowance` thì đã có trong ABI
  [chặn]  app/src/lib/ledger/evm.adapter.ts:425  thiếu hợp đồng khớp lệnh: chưa có nơi đổi VNDB lấy WPT trong cùng một giao dịch

SC-04  (4 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:538  thiếu quyết định cờ "đang tất toán" nằm ở contract nào; hai ứng viên hiện có thì ngược hướng nhau
  [chặn]  app/src/lib/ledger/evm.adapter.ts:544  thiếu quyết định cờ "đang tất toán" nằm ở contract nào, nên chưa có cờ nào để đọc
  [chặn]  app/src/lib/ledger/evm.adapter.ts:549  thiếu quyết định giá NAV có phải `Redemption.rate` hay không
  [chặn]  app/src/lib/ledger/evm.adapter.ts:555  thiếu quyết định giá NAV có phải `Redemption.rate` hay không

LUỒNG NGHIỆP VỤ (marker @flow)

  Chưa có marker @flow nào. Sơ đồ luồng sinh từ marker, chưa gắn thì chưa sinh được.

Tổng: 1 điểm cắm · 11 điểm chặn · 0 bước luồng
```

Bảng `@flow` còn rỗng là **đúng**: gắn `@flow` là Bước 9, và Bước 3 bị cấm gắn.

`--check` vẫn **mã thoát 0** sau khi thêm 12 marker. Đây là phép kiểm quan trọng nhất của
Bước 3 theo hướng ngược: **còn điểm cắm là bình thường, không được làm đỏ**. Nếu chỗ này đỏ
thì cả cơ chế sẽ bị người sau vô hiệu hoá cho xanh, và bảng điểm cắm mất luôn giá trị.

```
$ node scripts/scan-pending.mjs --check; echo "exit=$?"
Marker hợp lệ: 1 điểm cắm, 11 điểm chặn, 0 bước luồng. Không có lỗi.
exit=0
```

Hai khối dưới đây giữ từ Bước 2, khi bảng còn rỗng — để thấy script không nổ lỗi ở cả hai
đầu (không có marker nào, và có 12 marker).

```
$ node scripts/scan-pending.mjs        # bản Bước 2
ĐIỂM CẮM ĐANG CHỜ

  Chưa có điểm cắm nào: không có marker @pending / @blocked nào trong phạm vi quét.
  Đây là trạng thái bình thường, không phải lỗi — còn hay hết điểm cắm đều
  không làm `--check` đỏ. Quy ước: .kiro/steering/make-control.md

Tổng: 0 điểm cắm · 0 điểm chặn · 0 bước luồng
```

`--json` chỉ in JSON ra stdout, không lẫn thứ gì khác (test và script sinh tài liệu đọc stdout):

```
$ node scripts/scan-pending.mjs --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{JSON.parse(s);console.log('JSON hợp lệ')})"
JSON hợp lệ

$ node scripts/scan-pending.mjs --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s);console.log(JSON.stringify({byTask:r.byTask,summary:r.summary},null,2))})"
{
  "byTask": {
    "BE-06": 1,
    "BE-07": 1,
    "SC-02": 3,
    "SC-03": 3,
    "SC-04": 4
  },
  "summary": {
    "pending": 1,
    "blocked": 11,
    "flows": 0,
    "errors": 0
  }
}
```

`byTask` là thứ Bước 10 sẽ đọc để sinh mục điểm cắm trong `tech-report.md`, không gõ tay.

### 3.5 Bốn phép kiểm chứng của Bước 3

#### Phép kiểm 3 — chứng minh **không đổi hành vi**

Đây là phép kiểm quan trọng nhất của Bước 3, vì ràng buộc của bước này là *chỉ sửa bình
luận*. Lệnh lọc mọi dòng thêm/bớt trong `app/src` và `packages` **không** bắt đầu bằng dấu
mở chú thích; còn lại dòng nào thì dòng đó là mã thực thi bị sửa.

```
$ git diff -U0 a1ab71e..HEAD -- 'app/src' 'packages' | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' | grep -vE '^[+-][[:space:]]*(//|/\*|\*|#)'
(rỗng)
```

**Rỗng.** Không một dòng mã thực thi nào bị đổi, nên `pendingContract(...)` và nội dung
`LedgerNotImplementedError` giữ nguyên từng ký tự — đúng DoD 3.4.

Phép kiểm này cũng là **lý do một chỗ nhóm D KHÔNG được sửa**, xem SL-3 mục "Ba chỗ cùng nói
một điều đã sai".

#### Phép kiểm 4 — `bash scripts/run-local-all.sh` — 7 PASS, 0 FAIL

Mã thoát `0`. Giống Bước 2 từng mục, chỉ khác dòng đếm marker.

```
########## LỚP 3 - 3 LUẬT KIẾN TRÚC + CẤU TRÚC REPO ##########
...
TỔNG KẾT
  PASS: 20   FAIL: 0   WARN: 6
  => ĐẠT nhưng có 6 cảnh báo cần xác nhận có chủ đích.
  => PASS có cảnh báo: luật kiến trúc

########## LỚP 3 - ĐIỂM CẮM (marker) ##########
Marker hợp lệ: 1 điểm cắm, 11 điểm chặn, 0 bước luồng. Không có lỗi.
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)

########## LỚP 1 - SPEC TEST CONTRACT EVM ##########
  => PASS: LỚP 1 - SPEC TEST CONTRACT EVM          (13 test hardhat)

########## LỚP 1 - SPEC TEST CONTRACT SOROBAN ##########
  => PASS: LỚP 1 - SPEC TEST CONTRACT SOROBAN      (profit_distributor 16 · profit_distributor_pull · redemption 14 · revenue_oracle 1 · wpt_token 16)

########## APP - TYPECHECK ##########
  => PASS: APP - TYPECHECK

########## APP - LINT ##########
/Users/anbinh/.../app/src/empty.ts
  16:1  warning  Assign object to a variable before exporting as module default  import/no-anonymous-default-export
✖ 1 problem (0 errors, 1 warning)
  => PASS: APP - LINT

########## APP - VITEST ##########
 Test Files  11 passed (11)
      Tests  272 passed (272)
  => PASS: APP - VITEST

########## TỔNG KẾT ##########
  Đạt:     7
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 3 - ĐIỂM CẮM (marker)
    PASS  LỚP 1 - SPEC TEST CONTRACT EVM
    PASS  LỚP 1 - SPEC TEST CONTRACT SOROBAN
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST
  Không đạt: 0

(bảng điểm cắm 12 dòng như mục 3.4 — run-local-all in lại ở đây)

\n  => ĐẠT toàn bộ kiểm chứng cục bộ. Bước tiếp: nghiệm thu DoD trên testnet.
```

Không có mục nào FAIL, nên không có mục nào phải báo lại Supervisor. Sáu `WARN` của lớp 3 là
trạng thái nền của `dev`, không do Bước 2 hay Bước 3 gây ra (`process.env` ở
`signer/index.ts`, địa chỉ ví mẫu trong placeholder màn mint, `BASE_REF` chưa đặt, ba spec
Stellar chưa tới lượt). Cảnh báo lint duy nhất ở `app/src/empty.ts` là món thuộc Bước 7.

272 test vitest / 11 tệp, 13 test hardhat, 47 test cargo — **y nguyên** con số của Bước 2.
Không sửa test nào, không thêm test nào (Bước 4 mới làm việc đó).

Chuỗi `\n` in ra nguyên văn ở dòng cuối là **lỗi sẵn có trên `dev`**, không phải do Bước 3:
`scripts/run-local-all.sh:103` gọi `c_grn "\n  => ĐẠT..."` mà `c_grn` dùng
`printf '%s'` nên `\n` không được hiểu là dòng mới. Đã kiểm `git show 71932bb:scripts/run-local-all.sh`
cũng có nguyên dòng đó. **Không sửa ở Bước 3** vì bước này chỉ được sửa bình luận; ghi ở
SL-5 để bước nào chạm tới script thì sửa.

**Lưu ý về dương tính giả đã bắt được ngay trong Bước 2:** lần chạy `run-local-all.sh` **đầu
tiên** báo `FAIL LỚP 3 - ĐIỂM CẮM (marker)` với 2 lỗi `BAD_SYNTAX` — xem SL-4 ở mục 10. Đã sửa
gốc rễ ở script, không im lặng bỏ qua và cũng không loại trừ cả tệp cho xanh.

---

## 4. Bảng phân loại đầy đủ 27 export

_(chờ Bước 5)_

---

## 5. Kết quả ba lần kiểm chứng bằng đột biến

| Phép kiểm | Đột biến | Kết quả |
|---|---|---|
| **Đột biến script quét** | 11 dòng marker trong một tệp tạm: 1 đúng, 9 sai theo 9 kiểu khác nhau, 1 ca đối chứng phải **không** bị báo → script phải đỏ và liệt kê đủ loại | ✅ **đỏ, `exit=1`, 9 lỗi / 6 mã lỗi**, ca đối chứng im lặng — xem dưới |
| Test marker lạc hậu | Thêm `BE-02` vào marker một tệp → phải đỏ | _(chờ Bước 4)_ |
| Test marker mã task không tồn tại | `@pending XX-99` → phải đỏ | _(chờ Bước 4)_ |
| Test nguồn giá | Tách lại thành hai hằng số → phải đỏ | _(chờ Bước 6)_ |
| Script lớp 3 | Thêm `SPT` vào một tệp `app/src` → phải đỏ | _(chờ Bước 8)_ |

### Đột biến script quét — chi tiết

Tệp tạm `app/src/lib/__scan-probe.ts`, mỗi marker gắn trên một hàm thật để kiểm luôn phần suy
tên ký hiệu. Nội dung gồm: một marker **đúng**, một thiếu dấu `|`, một mã **không tồn tại**, một
mã **đã done**, `@flow purchase:2` **không có bước 1**, một biến thể `@blocked-by`, một `TODO`,
một tên luồng ngoài năm tên, một mô tả **rỗng**, một số bước **thập phân**, và một câu văn chỉ
**nhắc tên** từ khóa giữa dòng (ca đối chứng: phải **không** bị báo lỗi).

```
$ node scripts/scan-pending.mjs --check; echo "exit=$?"
Có 9 lỗi marker:

  [BAD_SYNTAX] app/src/lib/__scan-probe.ts:8
      có từ khóa marker nhưng sai cú pháp. Đúng phải là "@pending <MÃ-TASK> | <mô tả>", "@blocked <MÃ-TASK> | <mô tả>" hoặc "@flow <tên-luồng>:<số nguyên> | <mô tả>"
  [UNKNOWN_TASK] app/src/lib/__scan-probe.ts:13
      mã task XX-99 không có trong .kiro/task-status.json (hợp done + inProgress + planned)
  [STALE_TASK] app/src/lib/__scan-probe.ts:18
      marker lạc hậu: BE-02 đã done. Task xong thì phải dọn marker (steering mục 7, vế b)
  [BAD_FLOW_STEP] app/src/lib/__scan-probe.ts:23
      luồng "purchase" bắt đầu ở bước 2, phải bắt đầu từ 1 (thiếu bước đầu = có ai xóa hàm mà quên sửa marker)
  [FORBIDDEN_KEYWORD] app/src/lib/__scan-probe.ts:28
      từ khóa bị cấm: @blocked-by — steering mục 5 chỉ cho @pending, @blocked, @flow; cần diễn đạt khác thì viết sau dấu |
  [FORBIDDEN_KEYWORD] app/src/lib/__scan-probe.ts:33
      từ khóa bị cấm: TODO — steering mục 5 chỉ cho @pending, @blocked, @flow; cần diễn đạt khác thì viết sau dấu |
  [BAD_FLOW_NAME] app/src/lib/__scan-probe.ts:38
      tên luồng "refund" không thuộc năm tên đã chốt: purchase, issue, distribute, settle, onboard
  [BAD_SYNTAX] app/src/lib/__scan-probe.ts:43
      @blocked SC-04 có mô tả rỗng — phải nói rõ THIẾU gì
  [BAD_SYNTAX] app/src/lib/__scan-probe.ts:48
      có từ khóa marker nhưng sai cú pháp. Đúng phải là "@pending <MÃ-TASK> | <mô tả>", "@blocked <MÃ-TASK> | <mô tả>" hoặc "@flow <tên-luồng>:<số nguyên> | <mô tả>"

Quy ước: .kiro/steering/make-control.md
exit=1
```

Bắt đủ **6 mã lỗi** mà tài liệu giao việc đòi: `BAD_SYNTAX`, `UNKNOWN_TASK`, `STALE_TASK`,
`FORBIDDEN_KEYWORD`, `BAD_FLOW_NAME`, `BAD_FLOW_STEP`. Bốn loại mà tài liệu nêu tên đích danh
(sai cú pháp · mã không tồn tại · mã đã done · `@flow` thiếu bước 1) đều có mặt.

Ca đối chứng ở dòng 52 (câu văn nhắc tên từ khóa) **không** sinh lỗi — đúng ý, xem SL-4.

Hoàn nguyên: xóa tệp probe, `--check` xanh lại, và probe **không lọt vào commit**.

```
$ node scripts/scan-pending.mjs --check; echo "exit=$?"
Marker hợp lệ: 0 điểm cắm, 0 điểm chặn, 0 bước luồng. Không có lỗi.
exit=0

$ git status --short
 M .kiro/specs/mc-01-make-control/tasks.md
 M scripts/run-local-all.sh
 M scripts/scan-pending.mjs

$ ls app/src/lib/__scan-probe.ts
ls: app/src/lib/__scan-probe.ts: No such file or directory
```

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

### D-1 (Bước 2) — Phạm vi quét rộng hơn `design.md` mục 2

`design.md` mục 2 nói quét `app/src`, `packages/*/src`, `app/test`. Tài liệu giao việc Bước 2
mở rộng thành `app/src`, `app/test`, `app/e2e`, `packages/*/src`, `packages/*/contracts`,
`scripts`. Đã cài **theo tài liệu giao việc** (rộng hơn). `docs/` và `.kiro/` bị loại có chủ
đích: hai thư mục đó chứa **ví dụ** về marker, quét vào là báo lỗi giả.

### D-2 (Bước 2) — Đường dẫn trong bảng tính từ gốc repo

Ví dụ minh họa trong `design.md` mục 2 in đường dẫn rút gọn (`actions/purchase.ts:12`). Tài liệu
giao việc đòi "đường dẫn tương đối gốc repo". Đã làm theo tài liệu giao việc
(`app/src/app/actions/purchase.ts:12`) vì đường dẫn rút gọn không dán được vào lệnh nào, còn
đường dẫn đủ thì mở được bằng một cú nhấp trong terminal.

### D-3 (Bước 2) — Ba quyết định thiết kế Kiro tự chọn

Tài liệu giao việc để mở, đây là chỗ Kiro tự quyết, ghi lại để Supervisor bác nếu thấy sai:

| Quyết định | Vì sao |
|---|---|
| Thêm mã lỗi thứ 7 `BAD_TASK_STATUS` | Tài liệu nói `--check` đỏ đúng 6 trường hợp "không hơn". Nhưng khi `.kiro/task-status.json` vi phạm bất biến "một mã ở đúng một danh sách" thì `UNKNOWN_TASK` và `STALE_TASK` cho kết quả tùy thứ tự đọc — nền của cả 6 phép kiểm sụp. Im lặng đi qua thì `--check` xanh mà vô nghĩa, tệ hơn đỏ. Trường hợp này **hiện không thể xảy ra** (mục 3.3 đo 26 mã không trùng) nên không làm `run-local-all.sh` đỏ trên repo lành. Danh sách mã lỗi trong tài liệu ghi là "tối thiểu" |
| Marker phải đứng **ngay sau dấu mở chú thích** | Xem SL-4 ở mục 10 |
| Nhãn `[cắm]` / `[chặn]` trên từng dòng của bảng | `design.md` chỉ ghi số đếm ở dòng tiêu đề nhóm. Một mã task có thể có **cả hai loại** (ví dụ `SC-03` vừa chặn `quotePurchase` vừa chờ FE gọi), lúc đó chỉ đọc dòng tiêu đề thì không biết dòng nào là loại nào — mà phân biệt hai loại chính là lý do tồn tại của hai marker (steering mục 3) |

### D-4 (Bước 2) — `--json` luôn trả mã thoát 0

Kể cả khi có lỗi. `--json` là bản **xuất dữ liệu**, lỗi nằm trong mảng `errors` của chính JSON.
Phép kiểm đỏ/xanh là việc của `--check`. Làm `--json` đỏ theo thì mọi lệnh `| node -e ...` phải
bọc thêm `|| true`, không lợi gì.

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

### SL-3 — CHỐT Ở BƯỚC 3: cả **33** và **43** đều sai, số thật là **13 chỗ trên 2 tệp**

`requirements.md` mục 2 và `tasks.md` 3.1 nói "rải rác **33 tệp**". Bước 1 đo ra 43 tệp / 115
dòng. Bước 3 đo lại và phân loại **từng dòng** thì cả ba con số đều không dùng được để lập kế
hoạch, vì cả ba đếm **mọi** lần nhắc mã task trong mã nguồn.

#### Số đo cuối

```
$ git grep -l -E '(FE|BE|SC|AU|MC)-[0-9][0-9]' -- app/src app/test app/e2e packages | wc -l
43
$ git grep -n -E '(FE|BE|SC|AU|MC)-[0-9][0-9]' -- app/src app/test app/e2e packages | wc -l
115
```

115 dòng đó tách làm hai trước khi phân loại được:

| | Dòng | Tệp |
|---|---|---|
| Dòng **bình luận** | **91** | 38 |
| Dòng **không phải bình luận** (chuỗi trong mã, chữ hiển thị trên giao diện, tên test) | **24** | 9 |

Rồi 91 dòng bình luận chia bốn nhóm:

| Nhóm | Ý nghĩa | Dòng | Xử lý ở Bước 3 |
|---|---|---|---|
| **A. Điểm cắm** | code chạy được, chưa ai gọi | **1** | `@pending BE-07` trên `expireStaleOrders` |
| **B. Điểm chặn** | code đang ném lỗi | **5** | Chuyển thành `@blocked`; cộng 6 method không có bình luận riêng → **11 marker** |
| **C. Văn giải thích** | nói *vì sao code hiện tại như thế này* | **84** | **GIỮ NGUYÊN**, không gắn marker |
| **D. Lạc hậu** | nhắc task đã `done` như thể còn phải làm | **1** | Viết lại cho đúng hiện trạng |

Tổng marker gắn được: **12** (1 `@pending` + 11 `@blocked`) trên **2 tệp**, cộng **1** chỗ nhóm
D viết lại = **13 chỗ sửa**. So với 115: **79 %** số dòng nhắc mã task là văn giải thích phải
giữ nguyên.

#### 33 và 43 sai ở đâu

Cả hai con số **đếm sai đơn vị**. Chúng đếm "tệp có nhắc mã task", còn việc cần làm là "chỗ
phải gắn marker" — hai tập gần như không giao nhau. Ví dụ ba dòng dưới đây đều bị cả hai phép
đếm bắt, và cả ba **không được** thành marker:

```
app/src/lib/store/memory.order.store.ts:17   ⚠️ Bản này phải NGHIÊM NGẶT NGANG bản Postgres (BE-09 QĐ-3)
app/src/lib/ledger/ledger.port.ts:32         Kết quả kiểm tra trước khi gửi giao dịch (BE-01 R3).
app/test/rbac.test.ts:137                    Bảng quyền hiện có TRƯỚC BE-08, chép từ `git show dev:...`
```

Biến chúng thành `@pending` thì được một bảng điểm cắm 91 dòng mà **không dòng nào là việc phải
làm** — và vì BE-01 / BE-08 / BE-09 đã `done`, `--check` sẽ báo `STALE_TASK` và đỏ ngay lập tức.
Tức là gắn sai không chỉ vô ích, nó còn làm đỏ phép kiểm và buộc người sau tháo cơ chế ra.

Nguyên tắc phân biệt đã dùng, đúng theo steering mục 3: **marker trả lời "ai phải làm gì
tiếp"; văn giải thích trả lời "vì sao code hiện tại như thế này"**. Câu "theo BE-09 QĐ-3" là
loại thứ hai — nó dẫn nguồn một quyết định đã chốt, không giao việc cho ai.

Phép đếm 33 / 43 / 115 vì vậy **không phải phép đo của Bước 3** mà chỉ là danh sách chỗ cần
đọc. Số đáng theo dõi về sau là số marker trong bảng của `scan-pending.mjs`, và số đó máy đếm.

#### Nhóm thứ năm mà tài liệu giao việc không lường: 24 dòng KHÔNG phải bình luận

Đây là phát hiện có hệ quả thật, vì nó **giao với ràng buộc "chỉ sửa bình luận"**:

| Dạng | Số dòng | Ví dụ | Vì sao không chạm |
|---|---|---|---|
| Chuỗi tham số trong mã | 13 | `pendingContract('spvWallet', 'hợp đồng phát hành một lần (SC-02)')` · `todoNeeds(...)` ở `stellar.adapter.ts` | Là **mã thực thi**. Sửa là đổi thông báo lỗi — DoD 3.4 cấm, và có test kiểm nội dung đó |
| Tên `describe` / `it` | 8 | `it('sáu bảng BE-09 đều được tạo', ...)` | Là **tên test**. Sửa test đang xanh bị cấm tuyệt đối |
| Dòng GIỮA khối `{/* ... */}` | 2 | `header.tsx:79` · `wallet-status-card.tsx:109` | **Là bình luận thật**, nhưng dòng bắt đầu bằng chữ chứ không bằng `*`. Xem đoạn dưới |
| Chữ hiển thị cho người dùng | 1 | `asset-summary.tsx:148` | Là **kết xuất**, sửa là đổi giao diện |

Hai dòng dạng thứ ba đáng nói riêng, vì chúng là **điểm mù thật** chứ không phải lỗi phân loại.
Bình luận JSX viết thế này:

```tsx
{/*
  Số dư WPT và VNDB không hiển thị ở đây: hai thứ đó là số dư hợp đồng, phải đi qua
  `ILedgerPort` và thuộc FE-04. Xem ở trang Tổng quan.
*/}
```

Dòng giữa không có tiền tố `*` nào. Hệ quả kép:

1. **`scan-pending.mjs` không nhận marker ở đó** — cú pháp đòi marker đứng ngay sau dấu mở chú
   thích (SL-4), mà dòng giữa khối JSX không có dấu mở nào. Muốn gắn marker trong JSX thì phải
   viết `{/* @pending FE-05 | ... */}` **trên một dòng**.
2. **Sửa dòng giữa làm phép kiểm "không đổi mã thực thi" mất tác dụng** — bộ lọc ở mục 3.5 chỉ
   tha dòng bắt đầu bằng `//` `/*` `*` `#`, nên một sửa đổi bình luận hợp lệ sẽ hiện ra y như
   một sửa đổi mã.

Cả hai dòng này đều thuộc nhóm C (văn giải thích) nên Bước 3 không phải chạm tới, tức giới hạn
trên chưa gây thiệt hại. Nhưng nó có thật, và Bước 9 sẽ gặp nếu muốn gắn `@flow` cho thành phần
giao diện — ghi ở Q3.

Hệ quả cụ thể lên `stellar.adapter.ts`: tệp đó có 6 dòng nhắc SC-02/SC-03, **tất cả nằm trong
chuỗi tham số**, và toàn bộ ~25 method của nó đều ném lỗi. Nhưng chúng bị chặn bởi **Phase 7
(Stellar)** chứ không bởi SC-02/SC-03 — xong SC-02 cũng không nối được gì ở đây vì chưa có SDK
Soroban. Gắn `@blocked SC-02` vào đó là nói sai thứ đang thiếu. Bước 3 **không gắn marker nào**
cho `stellar.adapter.ts`; nếu muốn theo dõi thì phải có mã task cho Phase 7 trước — ghi ở Q3.

#### Nhóm D: bốn chỗ cùng nói một điều đã sai, chỉ sửa được một

Ghi chú ở `portfolio.service.ts` khẳng định `ILedgerPort` **chưa có** phương thức đọc số dư
token thanh toán, và gọi đó là "nợ chờ BE-01". Cả hai vế đều sai:

```
$ git grep -n 'paymentBalanceOf' -- app/src/lib/ledger/ledger.port.ts
117:  paymentBalanceOf(wallet: string): Promise<bigint>;
$ git log --oneline -S'paymentBalanceOf' -- app/src/lib/ledger/ledger.port.ts
bac0da3 refactor(ledger): tách ILedgerPort theo nghiệp vụ và thêm chữ ký cho ba luồng
$ git grep -n 'paymentBalanceOf' -- app/src/lib/bank
app/src/lib/bank/purchase.service.ts:184:  const paymentBalance = await ledger.paymentBalanceOf(order.investorWallet);
```

Method có từ BE-01 (`bac0da3`) và `purchase.service` đang dùng nó. Đã viết lại ghi chú cho đúng
hiện trạng và trỏ sang **FE-04** — task thật sự sẽ hiển thị số dư.

**Không gắn marker cho chỗ này.** Ở đây không có mã nào chạy được mà chờ người gọi; thiếu một
**trường** trong `PortfolioView`. `@pending FE-04` sẽ nói "đã sẵn, chỉ cần gọi" — sai.

Cùng lời khẳng định sai đó còn ở **ba** chỗ nữa, và **cả ba không sửa được trong Bước 3**:

| Chỗ | Dạng | Vì sao không sửa |
|---|---|---|
| `asset-summary.tsx:141-143` | bình luận JSX `{/* ... */}` | Dòng bên trong bắt đầu bằng **chữ**, không bằng `*`. Sửa nó thì phép kiểm "không đổi mã thực thi" ở mục 3.5 sẽ **báo có thay đổi** và mất luôn giá trị làm bằng chứng. (Khối này còn không nhắc mã task nào nên nằm ngoài cả 115 dòng đã đo) |
| `asset-summary.tsx:147-148` | chữ hiển thị cho người dùng | Sửa là đổi giao diện |
| `portfolio-service.test.ts:118` | tên test `it('... (chờ BE-01) ...')` | Sửa test đang xanh bị cấm |

Ghi lại làm nợ: khi FE-04 nối số dư VNDB thì phải sửa **cả ba** chỗ đó cùng lúc với
`portfolio.service.ts`. Đây cũng là một giới hạn thật của cơ chế marker: nó chỉ thấy bình luận
theo dạng `//` / `/* */`, còn khẳng định lạc hậu nằm trong chữ hiển thị và tên test thì không
công cụ nào trong MC-01 bắt được.

### SL-4 — Cắm script vào `run-local-all.sh` làm chính `run-local-all.sh` báo đỏ

Phát hiện ở Bước 2, và là loại lỗi mà tài liệu giao việc gọi là "cạm bẫy" nhưng chỉ lường cho
**ba** tệp. Tệp thứ tư chính là `run-local-all.sh`: khối chú thích đầu tệp phải giải thích mục
kiểm mới, mà giải thích thì phải **nhắc tên** từ khóa. Lần chạy đầy đủ đầu tiên:

```
  Không đạt: 1
    FAIL  LỚP 3 - ĐIỂM CẮM (marker)

$ node scripts/scan-pending.mjs --check
Có 2 lỗi marker:

  [BAD_SYNTAX] scripts/run-local-all.sh:9
      có từ khóa marker nhưng sai cú pháp. ...
  [BAD_SYNTAX] scripts/run-local-all.sh:65
      có từ khóa marker nhưng sai cú pháp. ...
```

Hai dòng bị báo là câu văn thuần, không phải marker:

```
#    2. Lớp 3 - điểm cắm: marker @pending / @blocked / @flow đúng quy ước
# marker chờ task đã done, từ khóa biến thể bị cấm, số bước @flow trùng/nhảy cách.
```

Ba cách xử lý, và vì sao chọn cách thứ ba:

| Cách | Vì sao **không** chọn |
|---|---|
| (a) Thêm `run-local-all.sh` vào danh sách tự loại trừ | Loại cả một tệp thật khỏi phép quét **vĩnh viễn**. Sau này ai viết marker thật trong đó thì marker vô hình với công cụ — đúng loại lỗi mà steering mục 5 cảnh báo |
| (b) Viết lại chú thích cho không chứa từ khóa | Chữa triệu chứng. Mọi tệp trong phạm vi quét sẽ **vĩnh viễn không được phép nhắc tên** từ khóa, kể cả khi cần giải thích cơ chế cho người sau |

**(c) Đã chọn — sửa gốc rễ:** marker chỉ được tính khi đứng **ngay sau dấu mở chú thích**
(`// @pending ...`, `# @flow ...`, `* @blocked ...`). Vẫn nhận marker viết ở cuối dòng mã
(`doSomething(); // @pending FE-05 | ...`).

Điều kiện này **không** nới lỏng phép kiểm, nó chỉ thu hẹp cái được coi là "ứng viên marker":

- Steering mục 6 **đã** đòi marker đứng một mình trên dòng ngay trên khai báo, nên không có
  marker hợp lệ nào bị bỏ sót.
- Ca đối chứng trong đột biến (dòng 52, câu văn nhắc tên từ khóa giữa dòng) không sinh lỗi,
  còn cả 9 marker sai vẫn bị bắt đủ.
- Danh sách tự loại trừ giữ đúng **ba** tệp như tài liệu giao việc yêu cầu. Nó vẫn cần thiết:
  khối chú thích của `scan-pending.mjs` viết `// @pending <MÃ-TASK> | ...` — đúng vị trí marker
  nên điều kiện (c) không cứu được, phải loại theo đường dẫn.

Từ khóa ghi chú `TODO` / `FIXME` / `HACK` / `XXX` thì **không** áp điều kiện vị trí: steering cấm
hẳn cách ghi chú đó, ở đâu trong dòng cũng là vi phạm.

Đo lại nền trước khi cài phép kiểm này, đúng như tài liệu giao việc yêu cầu — repo **sạch**, nên
không có ca nào phải báo lại Owner:

```
$ git grep -nE '\b(TODO|FIXME|HACK|XXX)\b' -- app/src app/test packages/*/src
(rỗng, exit 1)
$ git grep -nE '\b(TODO|FIXME|HACK|XXX)\b' -- app/e2e scripts packages/*/contracts
(rỗng, exit 1)
$ git grep -nE '@(pending|blocked|flow|waiting|todo)' -- app/src app/test app/e2e packages scripts
(rỗng, exit 1)
```

### SL-5 — `run-local-all.sh` in ra chuỗi `\n` nguyên văn ở dòng cuối (lỗi sẵn có trên `dev`)

Thấy khi dán output đầy đủ ở mục 3.5. Dòng kết luận hiện ra là `\n  => ĐẠT toàn bộ kiểm chứng
cục bộ.` với hai ký tự `\` và `n` in thật.

Nguyên nhân: `c_grn` dùng `printf '%s'` nên chuỗi `\n` trong **tham số** không được hiểu là dòng
mới.

```
$ grep -n 'c_grn()' scripts/run-local-all.sh
25:c_grn() { printf '\033[32m%s\033[0m\n' "$1"; }
$ grep -n 'ĐẠT toàn bộ kiểm chứng' scripts/run-local-all.sh
103:c_grn "\n  => ĐẠT toàn bộ kiểm chứng cục bộ. Bước tiếp: nghiệm thu DoD trên testnet."
```

Có sẵn trên `dev`, không do Bước 2 hay Bước 3:

```
$ git show 71932bb:scripts/run-local-all.sh | grep -n 'ĐẠT toàn bộ kiểm chứng'
88:c_grn "\n  => ĐẠT toàn bộ kiểm chứng cục bộ. Bước tiếp: nghiệm thu DoD trên testnet."
```

**Không sửa ở Bước 3**, vì bước này chỉ được sửa bình luận — sửa script là đổi hành vi và sẽ
phá phép kiểm 3. Chỉ là thẩm mỹ, không ảnh hưởng mã thoát. Cách sửa khi có bước nào chạm tới:
bỏ `\n` khỏi tham số và gọi `printf '\n'` riêng, hoặc thêm một `echo` rỗng phía trên.

---

## 11. Câu hỏi mở

> **Q1 và Q2 đã được Owner chốt ở Bước 2.** Quyết định và cách thi hành ghi ngay dưới mỗi câu.
> **Q3 và Q4 mở ở Bước 3.**

### Q3 — Ba chỗ phân loại 50/50, đã để nhóm C, xin xác nhận

Theo chỉ dẫn "không chắc thì để nguyên nhóm C, bỏ sót thì Bước sau thêm được, gắn sai thì không
ai phát hiện". Ba chỗ dưới đây tôi thấy có thể tranh luận được cả hai chiều. Không chỗ nào chặn
Bước 4; nếu Supervisor thấy nên gắn thì Bước 5 thêm vào là đủ.

**(a) `nav-config.ts:76` — ba mục nav `disabled` chờ FE-05 / FE-09 / FE-11**

```ts
/**
 * Kênh nhà đầu tư. Ba mục cuối chưa có nghiệp vụ nên để `disabled`:
 * `/purchase` chờ FE-05, `/earnings` chờ FE-09, `/settlement` chờ FE-11.
 */
export const INVESTOR_NAV: NavSection = { ... };
```

- **Cách hiểu 1 (điểm cắm):** nó trả lời đúng câu "ai phải làm gì tiếp" — FE-05 chỉ cần bỏ
  `disabled: true` và thêm trang. Gắn marker thì `--check` sẽ tự buộc dọn khi FE-05 xong.
- **Cách hiểu 2 (văn giải thích — đã chọn):** `@pending` theo steering mục 1 là "code ĐÃ CHẠY
  ĐƯỢC, chỉ **chưa ai gọi**". `INVESTOR_NAV` đang được gọi và đang kết xuất thật, chỉ ở trạng
  thái mờ. Nó không phải mã trông như rác mà người sau dễ xóa — tức không phải vấn đề mà cơ chế
  này dựng ra để giải.
- Còn một trở ngại kỹ thuật: một dòng chỉ mang **một** marker, mà chỗ này chờ **ba** task; đặt
  ba marker chồng nhau trên một `const` thì chỉ marker cuối là "ngay trên khai báo".

**(b) `wrong-chain-banner.tsx:26` và `use-wallet-status.ts:45` — hạ tầng dựng sẵn cho FE-05/09/11**

Bình luận nói rõ thành phần được tách riêng để ba màn hình sau dùng lại. Nhưng đo thật thì cả
hai **đang được gọi**: `WrongChainBanner` dùng ở `wallet-connect.tsx:72,83`, `useWalletStatus`
dùng ở `wallet-connect.tsx:31`. Đã chạy và đã có người gọi thì không phải điểm cắm. Để nhóm C.

**(c) `stellar.adapter.ts` — ~25 method đều ném lỗi, không có mã task nào đúng nghĩa**

Toàn bộ adapter là stub Phase 7. Sáu dòng nhắc SC-02/SC-03 đều nằm trong **chuỗi tham số**
(không phải bình luận), và bản thân SC-02/SC-03 **không** mở khoá được gì ở đây — còn thiếu SDK
Soroban. Đây đúng tình huống Q1 của Bước 2 (chặn vì một việc chưa có mã task), và cách xử lý đã
chốt lúc đó là **mở một mã task mới**. Bước 3 không tự làm việc đó: mở mã task là quyết định của
Owner, và Stellar thuộc `non-goals` của giai đoạn đầu theo `product.md`.

Đề xuất: **để nguyên, không marker.** Nếu Owner muốn theo dõi thì thêm một mã cho Phase 7
(ví dụ `SC-05` = *adapter Soroban*) rồi Bước 5 gắn một marker duy nhất cho cả adapter.

### Q4 — Bình luận JSX không gắn được marker ở dòng giữa khối; có cần nới cú pháp?

Chi tiết và bằng chứng ở SL-3, mục "Nhóm thứ năm". Tóm lại: `{/* ... */}` nhiều dòng có dòng
giữa bắt đầu bằng **chữ**, nên (1) `scan-pending.mjs` không nhận marker ở đó, và (2) sửa dòng
đó làm phép kiểm "không đổi mã thực thi" báo dương tính giả.

Chưa gây thiệt hại: cả hai dòng như vậy trong repo đều thuộc nhóm C. Nhưng Bước 9 sẽ gặp nếu
muốn gắn `@flow` cho thành phần giao diện.

Hai hướng, **chưa tự chọn**:

- **(a) Không đổi gì.** Quy ước là: marker trong JSX phải viết gọn một dòng
  `{/* @pending FE-05 | ... */}`. Giữ cú pháp chặt, đổi cách viết.
- **(b) Nới `COMMENT_OPEN`** để nhận cả dòng giữa khối JSX. Rủi ro: mất đúng cái điều kiện vị
  trí mà SL-4 vừa dựng lên để loại dương tính giả — câu văn nhắc tên từ khóa trong JSX sẽ bị
  báo `BAD_SYNTAX`.

**Đề xuất (a).** Nó không nới lỏng phép kiểm nào, và một marker một dòng thì vẫn đọc được.

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
- **(b)** Mở một mã task mới cho việc quyết định này, thêm vào `planned` của `task-status.json`,
  rồi `@blocked <mã mới>`. Marker đúng nghĩa và vào được bảng điểm cắm.

**Phương án đề xuất: (b).** Việc này có đầu ra rõ ràng (một quyết định kiến trúc kèm chỗ nối) và
đang chặn 4 method, tức nó **là** một task chứ không phải ghi chú. Gán tạm vào SC-03 thì lúc SC-03
xong, quy tắc "dọn marker khi task done" buộc xóa 4 marker này trong khi thứ chặn vẫn còn đó.

#### ✅ Owner chốt: phương án (b), mã task là `SC-04`

`SC-04` = *hợp đồng cờ tất toán + giá NAV*. Nội dung: quyết định cờ "đang tất toán" nằm ở contract
nào (`ProjectToken.paused` chặn chuyển nhượng và **vẫn cho** `agentBurn`, còn `Redemption.paused`
**ngược hướng**) và `navRate` nối vào đâu.

Đã thi hành ở commit `c84ec7f`: thêm `SC-04` vào `planned` của `.kiro/task-status.json` → 26 mã
hợp lệ (mục 3.3). **Bước 2 chỉ thêm mã, chưa gắn marker.** Việc gắn `@blocked SC-04` cho bốn
method `setSettlementMode` / `isSettlementMode` / `setNavRate` / `navRate` trong
`app/src/lib/ledger/evm.adapter.ts` thuộc Bước 3; Bước 2 **không sửa** tệp đó.

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

#### ✅ Owner chốt: phương án (b)

Đã thi hành ở commit `c84ec7f`. Xác nhận có hiệu lực:

```
$ git check-ignore -v .kiro/specs/mc-01-make-control/tasks.meta.json
.gitignore:39:.kiro/specs/*/tasks.meta.json	.kiro/specs/mc-01-make-control/tasks.meta.json
```

`git status --short` không còn dòng `?? ...tasks.meta.json`.

---

## 12. Tự đánh giá 3 LUẬT kiến trúc

### Bước 3

Bước đầu tiên **chạm tệp mã nguồn**, nên đánh giá ở đây là đánh giá thật chứ không phải hình
thức. Ba tệp bị sửa, và **chỉ bình luận** — chứng minh bằng diff rỗng ở mục 3.5, phép kiểm 3.

```
$ git diff --name-only a1ab71e..HEAD
.kiro/specs/mc-01-make-control/tasks.md
app/src/lib/bank/portfolio.service.ts
app/src/lib/bank/purchase.service.ts
app/src/lib/ledger/evm.adapter.ts
docs/CHECKPOINT_MC01.md
```

Ba tệp mã nguồn, còn lại là tài liệu và trạng thái spec.

- [x] **LUẬT #1** mọi tương tác chain qua `ILedgerPort` — không đổi. `evm.adapter.ts` vẫn là
      adapter đứng sau cổng; không thêm/bớt method, không đổi thân method nào. `verify-arch-rules.sh`
      vẫn 20 PASS / 0 FAIL.
- [x] **LUẬT #2** mọi ký qua `ISigner` — không chạm `lib/signer`.
- [x] **LUẬT #3** mọi kiểm quyền qua RBAC — không chạm `lib/rbac`. Marker `@pending BE-07` **nhắc**
      quyền `order:expire` trong phần mô tả, nhưng đó là chữ trong bình luận; phép kiểm quyền vẫn
      nằm nguyên trong `expireStaleOrders` qua `authorize()`.

Không sửa test nào đang xanh: 272 test vitest, 13 test hardhat, 47 test cargo giữ nguyên số và
vẫn xanh (mục 3.5). Không thêm test — Bước 4 mới làm.

Một điều đáng nói về DoD 3.4 (*giữ nguyên thông báo lỗi*): nó **không** được kiểm bằng cách đọc
lại bằng mắt mà bằng bộ lọc diff ở mục 3.5. Đọc mắt thì bỏ sót được, còn bộ lọc thì hoặc rỗng
hoặc không.

### Bước 2

Cũng **không chạm tệp mã nguồn nào**. Chỉ thêm một script ở `scripts/`, sửa `run-local-all.sh`,
`.kiro/task-status.json`, `.gitignore` và tài liệu. Đặc biệt **không sửa**
`app/src/lib/ledger/evm.adapter.ts` như ràng buộc của Bước 2 yêu cầu, và **không** gắn marker vào
tệp mã nguồn nào (Bước 3 và Bước 5 làm việc đó).

```
$ git diff --name-only cefc895..HEAD
.gitignore
.kiro/specs/mc-01-make-control/tasks.md
.kiro/task-status.json
docs/CHECKPOINT_MC01.md
scripts/run-local-all.sh
scripts/scan-pending.mjs
```

Ba luật không bị ảnh hưởng; `verify-arch-rules.sh` vẫn 20 PASS / 0 FAIL (mục 3.5). Không sửa test
nào đang xanh: 272 test vitest, 13 test hardhat, 47 test cargo đều giữ nguyên và vẫn xanh.

### Bước 1

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
