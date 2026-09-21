# Báo cáo bàn giao — MC-02: khuôn checkpoint có mục tóm tắt bắt buộc

| | |
|---|---|
| Mã task | MC-02 (Make Control, P1, 2 điểm) |
| Nhánh | `mc/02-checkpoint-format`, tạo **từ `dev`** (`69a38a9`) |
| Spec | `docs/mc-02-checkpoint-format/{requirements,design,tasks}.md` + bản ở `.kiro/specs/mc-02-checkpoint-format/` (hai bản giống hệt, xem 3.1) |
| Tiến độ | **Bước 1–4/4 xong.** Chờ Supervisor nghiệm thu — Kiro **không** merge vào `dev` |
| Phạm vi | Không đổi hành vi hệ thống. Thêm một cổng kiểm quy trình; mọi test đang xanh phải xanh nguyên |

`dev` đã kiểm lành trước khi tạo nhánh, theo `branching.md` §5:

```
$ git ls-tree -r --name-only dev | grep -c '^packages/'           → 73   (phải > 0)
$ git ls-tree -r --name-only dev | grep -c '^app/src/lib/ledger'  → 6    (phải > 0)
$ git ls-tree -r --name-only dev | grep -c AssetRegistry          → 0    (phải = 0)
$ git merge-base dev HEAD → 69a38a9   $ git rev-parse origin/dev → 69a38a9
```

---

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

Lấy đúng **7** ô ở `requirements.md` mục 4, không thêm không bớt.
Đo: `grep -c '^- \[ \]' <(sed -n '/^## 4\. Điều kiện/,$p' docs/mc-02-checkpoint-format/requirements.md)` → **7**

| # | Điều kiện (rút gọn) | | Bằng chứng |
|---|---|---|---|
| 1 | `CHECKPOINT_TEMPLATE.md` có mục 0 với ví dụ điền sẵn | ✅ | mục 1 (Bước 1) · 3.2 |
| 2 | Quy tắc có trong `.kiro/steering/`, gồm quy tắc con số kèm lệnh đo | ✅ | mục 3.3 · 4 SL-1 |
| 3 | Script kiểm chạy được, báo đỏ đúng năm trường hợp ở R4.2 | ✅ | mục 3.4 · **2** (bảng 6 lần chạy) |
| 4 | Script được gọi trong `run-local-all.sh`, chỉ kiểm task `inProgress` | ✅ | mục 3.5 · **5** (mục 3 của lần chạy chốt) |
| 5 | Kiểm chứng bằng đột biến: cả năm trường hợp đều làm script đỏ | ✅ | **2** (5/5 đỏ, exit=1) · 2.2 (đột biến ngược lên mã nguồn) |
| 6 | Checkpoint của chính MC-02 đạt quy tắc mới | ✅ | mục 3.8 · **5** (dòng số đo) |
| 7 | `bash scripts/run-local-all.sh` xanh toàn bộ | ✅ | mục **5** — 8 PASS / 0 FAIL |

**Kết luận:** 7 ✅ · 0 🔶 · 0 ❌

### 0.2 Việc cần Owner quyết

- **Mốc chuyển MC-02 sang `done`.** Kiro để MC-02 ở `inProgress` cho tới khi Owner merge, theo
  tiền lệ MC-01. Lý do và món nợ ở mục **4 SL-4**.

---

## 1. Đã làm

| Bước | Commit | Nội dung |
|---|---|---|
| — | `6f33e30` | `docs(mc): spec MC-02 khuôn checkpoint` — đưa spec vào lịch sử nhánh, cả `docs/` và `.kiro/specs/` |
| 1 | `d347935` | `docs(mc): khuôn checkpoint có mục tóm tắt bắt buộc` — `CHECKPOINT_TEMPLATE.md` + `.kiro/steering/checkpoint.md` |
| 2 | `ccf35c6` | `chore(mc): MC-01 vào done, MC-02 vào inProgress` — điều kiện cần để cắm `--in-progress`, xem 3.6 |
| 2 | `1d467fb` | `feat(mc): script kiểm khuôn checkpoint` — `scripts/check-checkpoint.mjs`, cắm vào `run-local-all.sh` |
| 3 | `40c067c` | `test(mc): kiểm thử script kiểm checkpoint` — `app/test/check-checkpoint.test.ts`, 21 ca |
| 4 | `d649840` | `docs(mc): checkpoint MC-02 và cập nhật báo cáo` — tệp này + `tech-report.md` + `tech-report-maintenance.md` |
| 4 | `e804822` | `docs(mc): đo lại số tệp thay đổi trong checkpoint MC-02` — xem ghi chú tự tham chiếu ngay dưới |
| 4 | *(commit này)* | `docs(mc): đối chiếu lại bảng commit và số commit của nhánh` |

Đo tại `e804822`, tức **trước** commit cuối; commit cuối chỉ sửa chính tệp này nên không đổi tệp nào khác:

```
$ git rev-list --count dev..HEAD   → 7 commit
$ git diff --stat dev...HEAD | tail -1
16 files changed, 2318 insertions(+), 28 deletions(-)
```

⚠️ **Hai con số trên tự tham chiếu:** chúng đếm cả chính tệp checkpoint này, nên ghi số vào đây là
làm số đó lệch. Cách xử lý ở trên là ghi rõ **đo tại commit nào**, thay vì đuổi theo một con số
không bao giờ đứng yên. Đây là ca thật cho quy tắc "con số kèm lệnh đo" ở
`.kiro/steering/checkpoint.md` §2: lệnh đo quan trọng hơn con số, vì lệnh thì chạy lại được.

| Tệp | Trạng thái | Số dòng |
|---|---|---|
| `docs/CHECKPOINT_TEMPLATE.md` | sửa | 107 |
| `.kiro/steering/checkpoint.md` | mới | 147 |
| `scripts/check-checkpoint.mjs` | mới | 711 |
| `app/test/check-checkpoint.test.ts` | mới | 417 |
| `scripts/run-local-all.sh` | sửa | +21/−7 |
| `scripts/scan-pending.mjs` | sửa | +10/−2 (xem 4 SL-2) |
| `.kiro/task-status.json` | sửa | MC-01 → `done`, MC-02 → `inProgress` |
| `docs/tech-report.md`, `docs/tech-report-maintenance.md` | sửa | mục 3.7 |

---

## 2. Kiểm chứng bằng đột biến (điều kiện hoàn thành số 5)

### 2.1 Đột biến DỮ LIỆU — năm tệp checkpoint sai khuôn, mỗi tệp một lỗi

Sáu tệp mẫu dựng trong thư mục tạm ngoài repo, mỗi tệp chỉ khác tệp đúng khuôn ở **một** chỗ.
Chạy CLI thật, lấy mã thoát và mã lỗi in ra:

```
tệp mẫu              exit  mã lỗi
xanh.md                 0  ĐẠT
NO_SUMMARY.md           1  SAI KHUÔN [NO_SUMMARY]
SUMMARY_TOO_LONG.md     1  SAI KHUÔN [SUMMARY_TOO_LONG]
DOD_COUNT_MISMATCH.md   1  SAI KHUÔN [DOD_COUNT_MISMATCH]
MISSING_EVIDENCE.md     1  SAI KHUÔN [MISSING_EVIDENCE]
NOT_SPLIT.md            1  SAI KHUÔN [NOT_SPLIT]
```

**5/5 trường hợp ở R4.2 đều làm script đỏ**, mỗi trường hợp ra đúng mã lỗi của nó và không kéo
theo mã lỗi lạ. Tệp đối chứng đúng khuôn cho `exit=0` — không có dòng này thì "luôn đỏ" cũng
đạt 5/5.

Cùng sáu đột biến đó nằm trong `app/test/check-checkpoint.test.ts` (bảng `DOT_BIEN`), nên chúng
chạy lại mỗi lần `npm test`, không phải bằng chứng một lần rồi mất.

### 2.2 Đột biến ngược — sửa MÃ NGUỒN để chứng minh test có răng

2.1 chứng minh script bắt được lỗi. Nó **không** chứng minh test sẽ đỏ nếu script hỏng. Hai
đột biến vào chính mã nguồn, mỗi cái phục hồi bằng `git checkout --` ngay sau khi đo:

| Đột biến | Kết quả `npm test` trên tệp test này |
|---|---|
| `MAX_SUMMARY_LINES` 60 → 100000 | **1 failed** \| 20 passed — đúng ca `SUMMARY_TOO_LONG` |
| `readTaskStatus` trả `inProgress: [...inProgress, ...done]` | **2 failed** \| 19 passed — đúng hai ca của R4.4 |

Đột biến thứ hai là đột biến đáng giá nhất của task này: nó mô phỏng kiểu hỏng **im lặng** — cổng
`--in-progress` vẫn chạy, vẫn `exit=0`, nhưng kiểm sai tập tệp. Nếu test không bắt được nó thì
`run-local-all.sh` xanh mà chẳng kiểm gì.

```
$ git status --short     # sau khi phục hồi, trước khi commit Bước 3
?? app/test/check-checkpoint.test.ts
```

---

## 3. Cách chạy / kiểm thử

### 3.1 Spec hai bản giống hệt

```
$ diff -rq docs/mc-02-checkpoint-format .kiro/specs/mc-02-checkpoint-format
(không in gì — hai bản giống hệt)
```

Nợ kỹ thuật P2 ở `tech-report.md` 1.6.C ghi 5/6 cặp spec đã lệch nhau. MC-02 không thêm vào món
nợ đó, nhưng cũng không giải nó — việc chọn một bản làm nguồn là việc Supervisor quyết.

### 3.2 Khuôn — `docs/CHECKPOINT_TEMPLATE.md`

Trước MC-02 khuôn dài **25** dòng, 6 mục, **không có mục tóm tắt**. Nay **107** dòng gồm: bảng
thông tin task, mục 0 (0.1 bảng đối chiếu + 0.2 việc cần Owner quyết), sáu mục cũ giữ nguyên theo
R3.1, và một **ví dụ điền sẵn** cho cả ba ký hiệu `✅` / `🔶` / `❌`.

Ví dụ cố ý có đủ ba trạng thái, kèm một dòng `❌` trỏ xuống 0.2: đó là chỗ người viết dễ bỏ sót
nhất, vì checkpoint "đẹp" thường chỉ có ✅.

### 3.3 Quy tắc — `.kiro/steering/checkpoint.md`, `inclusion: always`

```
$ head -3 .kiro/steering/checkpoint.md
---
inclusion: always
---
```

Năm mục: (1) mục 0 bắt buộc kèm ba ký hiệu; (2) **con số phải kèm lệnh đo, áp dụng cho cả spec do
Supervisor viết**; (3) hai ngưỡng kèm lệnh đo và lý do chọn con số; (4) máy kiểm và **ba thứ máy
cố ý không kiểm**; (5) quan hệ với `workflow.md` / `branching.md` / `tech-report-maintenance.md` /
`make-control.md`.

Mục 4 của steering nêu thẳng giới hạn: script chỉ kiểm phần cơ học. Ghi `✅` cho việc chưa xong thì
script vẫn xanh. Viết ra để không ai hiểu "script xanh" là "đã được nghiệm thu".

### 3.4 Script — `scripts/check-checkpoint.mjs`

Năm mã lỗi đúng `design.md` mục 3, không hơn. Hai ngưỡng là hằng số ở đầu tệp (`MAX_SUMMARY_LINES
= 60`, `MAX_FILE_LINES = 800`). Node 20, ESM thuần, **không phụ thuộc gói ngoài**, không thêm thư
viện phân tích Markdown.

Chạy trên checkpoint thật (đây cũng là phép thử "script đọc được tệp người viết", không chỉ tệp mẫu):

```
$ node scripts/check-checkpoint.mjs docs/CHECKPOINT_MC01.md docs/mc-01-make-control/requirements.md
SAI KHUÔN  docs/CHECKPOINT_MC01.md — 1 lỗi
  mục 0: 40/60 dòng · bảng đối chiếu 12 dòng / 12 điều kiện · 11 ✅ 1 🔶 0 ❌ · cả tệp 5013/800 dòng
  [NOT_SPLIT] docs/CHECKPOINT_MC01.md:5013
```

Hai điều đọc ra từ lần chạy này:

- Script **đếm đúng** bảng đối chiếu viết tay của MC-01: 12 dòng khớp 12 điều kiện, và tally
  `11 ✅ 1 🔶` khớp đúng dòng kết luận MC-01 tự viết. Phép đếm không phải chỉ chạy được trên tệp mẫu.
- MC-01 **đỏ** ở `NOT_SPLIT`, và đó là **dữ liệu, không phải lỗi cần vá**. `--in-progress` không
  chạm tới nó vì MC-01 đã `done` (R4.4). `CHECKPOINT_BE09.md` cũng đỏ (`DOD_COUNT_MISMATCH`): mục 0
  của nó là bảng "sáu chỗ va nhau", không phải bảng đối chiếu — checkpoint đó viết trước khi có
  quy tắc này. Cả hai là lý do R4.4 tồn tại.

### 3.5 `--in-progress` và chỗ cắm vào `run-local-all.sh`

```bash
run "LỚP 3 - KHUÔN CHECKPOINT" . \
    node scripts/check-checkpoint.mjs --in-progress
```

Đặt làm **mục 3**, ngay sau phép kiểm marker: hai cổng cùng họ (Lớp 3, kiểm quy trình chứ không
kiểm mã), nên người chạy thấy mọi nghĩa vụ quy trình cạnh nhau. `run-local-all.sh` nay có **8 mục**.

Ba đường đi của `--in-progress`, cả ba đều có ca test:

| Trạng thái | Hành vi | Vì sao |
|---|---|---|
| `inProgress` rỗng | bỏ qua, `exit=0` | `design.md` mục 3 đòi thế |
| task đang làm, chưa có checkpoint | bỏ qua **có in thông báo**, `exit=0` | xem 4 SL-3 |
| task đã `done` | **không chạm**, `exit=0` | R4.4 |

### 3.6 Vì sao phải sửa `.kiro/task-status.json` trong task này

Trước MC-02, tệp đó để MC-01 ở `inProgress` dù MC-01 đã merge:

```
$ git log --merges --oneline -3
69a38a9 Merge pull request #21 from tuannino/mc/01-make-control
```

Để nguyên thì `--in-progress` sẽ chạy lên `CHECKPOINT_MC01.md` và đỏ `NOT_SPLIT` — tức cổng mới
đòi sửa một checkpoint mà `tasks.md` mục "Việc KHÔNG được làm" cấm sửa. Nên MC-01 → `done`,
MC-02 → `inProgress`. Chuyển MC-01 sang `done` không sinh `STALE_TASK` vì không marker nào chờ nó:

```
$ node scripts/scan-pending.mjs --json | grep -c '"task": "MC-01"'
0
$ node scripts/scan-pending.mjs --check
Marker hợp lệ: 8 điểm cắm, 11 điểm chặn, 10 bước luồng. Không có lỗi.
```

### 3.7 Cập nhật tài liệu

| Tệp | Mục đã sửa |
|---|---|
| `docs/tech-report.md` | metadata (phiên bản **1.9 → 2.0**, nhánh, phase) · 1.4 cây thư mục (thêm `checkpoint.md`, `check-checkpoint.mjs`; `run-local-all.sh` 7 → **8 mục**) · 1.6.D cách làm việc · **3.11 mới** (khuôn checkpoint + máy kiểm) · Phụ lục lệnh kiểm chứng |
| `docs/tech-report-maintenance.md` | bảng ánh xạ mục 2 (2 dòng mới) · tự kiểm mục 5 (lệnh + 2 dòng checklist) · chống trôi lệch mục 6 · ranh giới trách nhiệm mục 8 · **mục 10 mới** (nghĩa vụ duy trì checkpoint) |

Phiên bản `+0.1` chứ không `+1.0` theo `tech-report-maintenance.md` §3 bước 5: MC-02 **không đổi
kiến trúc** — ba luật bất di không bị chạm, không thêm tầng, không đổi luồng nghiệp vụ nào. Nó
thêm một cổng quy trình.

### 3.8 Checkpoint này qua được script do chính task này tạo

```
$ node scripts/check-checkpoint.mjs docs/CHECKPOINT_MC02.md docs/mc-02-checkpoint-format/requirements.md
```

Kết quả chốt ở 3.9 (mục 3 của lần chạy `run-local-all.sh`). Đây là phép thử đầu tiên của khuôn:
nếu khuôn không tự đáp ứng được thì nó là khuôn viết cho người khác.

### 3.9 Lần chạy `run-local-all.sh` chốt

Xem mục **5** — chạy sau khi đã cập nhật xong tài liệu, tức trên đúng trạng thái nộp.

---

## 4. Sai lệch phát hiện được và DEVIATION so với spec

### SL-1 — con số trong `design.md` mục 2: "43 dòng" đo lại là **40**

`design.md` không ghi lệnh đo. Đo bằng dải `awk '/^## 0\./,/^## 1\./'` ra 43; script ra **40**.
Chênh 3 là một dòng trắng, một dòng `---`, một dòng trắng nữa trước `## 1.`.

Đã dùng **số đo thật (40)**, và script **cố ý** không tính ba dòng đó: chúng là phần trình bày,
tính vào hạn mức thì thêm một dòng trắng là mất một dòng nội dung. Cả `.kiro/steering/checkpoint.md`
§3 và chú thích trong script đều ghi 40 kèm giải thích chênh lệch — đúng quy tắc R2.3 vừa đặt ra
trong chính task này.

Hai con số khác của `design.md` đo lại thì **đúng**: 626 dòng (`CHECKPOINT_TEST_PACK.md`) và 5013
dòng (MC-01). Lệnh: `wc -l docs/CHECKPOINT_*.md | sort -n`.

### SL-2 — DEVIATION: có sửa `scripts/scan-pending.mjs`, ngoài danh sách của `design.md` mục 5

`design.md` mục 5 liệt kê 5 tệp thay đổi, không có `scan-pending.mjs`. Thực tế đã sửa nó: hàm
`readTaskStatus` trả thêm `inProgress`, **+10/−2 dòng**, không đổi hành vi của bên gọi cũ.

Lý do: `readTaskStatus` là nơi **duy nhất** đọc `.kiro/task-status.json` và cũng là nơi duy nhất
kiểm bất biến "một mã ở đúng một danh sách". Phương án thay thế là đọc lại JSON ở
`check-checkpoint.mjs` — tức hai nơi đọc cùng một tệp và hai nơi hiểu bất biến đó, đúng loại trôi
lệch mà `make-control.md` mục 7 dựng tệp này để tránh.

`tasks.md` mục "Việc KHÔNG được làm" không cấm sửa tệp này. Xin Supervisor xác nhận.

### SL-3 — DEVIATION: "task đang làm chưa có checkpoint" thì **bỏ qua**, không đỏ

R4.2 liệt kê đúng năm ca phải đỏ, và "chưa có checkpoint" không thuộc năm ca đó. Thêm nó thành ca
thứ sáu sẽ làm `run-local-all.sh` đỏ suốt thời gian giữa lúc mở nhánh và lúc viết checkpoint — một
đèn đỏ thường trực thì người ta học cách bỏ qua, và lúc đó cả năm ca kia mất hiệu lực theo.

Nghĩa vụ "phải có checkpoint trước khi mở PR" đã có chỗ của nó: `branching.md` §11. Script in rõ
dòng `BỎ QUA` chứ không im lặng.

### SL-4 — DEVIATION: MC-02 **chưa** chuyển sang `done` trong commit cuối

`make-control.md` mục 7 nói chuyển sang `done` trong commit cuối của task. Kiro **không** làm vậy,
vì hai lẽ:

1. MC-02 chưa được nghiệm thu, và Kiro không merge vào `dev`. Đây là tiền lệ MC-01 đã dùng.
2. Cụ thể hơn với task này: để MC-02 ở `inProgress` thì `--in-progress` **thật sự kiểm** checkpoint
   này mỗi lần chạy `run-local-all.sh`. Chuyển sang `done` ngay là làm cổng vừa dựng lên rơi vào
   nhánh "không có task nào đang làm → bỏ qua", và điều kiện hoàn thành số 4 sẽ xanh mà chưa từng
   kiểm gì.

**Món nợ:** sau khi Supervisor PASS và Owner merge, chuyển MC-02 sang `done`. Ghi ở 0.2.

### SL-5 — hai checkpoint cũ không đạt khuôn mới, và đã **không** sửa

`CHECKPOINT_MC01.md` đỏ `NOT_SPLIT`, `CHECKPOINT_BE09.md` đỏ `DOD_COUNT_MISMATCH`. Cả hai là task
đã `done` nên `--in-progress` không chạm, và `tasks.md` cấm sửa. Ghi lại ở đây để Supervisor biết
con số đó có thật, không phải Kiro chưa đo.

---

## 5. Lần chạy kiểm chứng cục bộ chốt

```
$ bash scripts/run-local-all.sh
```

**8 PASS / 0 FAIL.** Mục 3 là cổng mới của task này:

| # | Mục | Kết quả |
|---|---|---|
| 1 | LỚP 3 — 3 luật kiến trúc + cấu trúc repo | PASS có cảnh báo — `PASS: 20  FAIL: 0  WARN: 6` |
| 2 | LỚP 3 — ĐIỂM CẮM (marker) | PASS — 8 điểm cắm, 11 điểm chặn, 10 bước luồng, 0 lỗi |
| **3** | **LỚP 3 — KHUÔN CHECKPOINT** | **PASS** — `ĐẠT  MC-02 · docs/CHECKPOINT_MC02.md` |
| 4 | LỚP 1 — spec test contract EVM | PASS — **67 passing** |
| 5 | LỚP 1 — spec test contract Soroban | PASS — 1 + 16 + 14 + 1 + 16 = **48 passed**, 0 failed |
| 6 | APP — TYPECHECK | PASS |
| 7 | APP — LINT | PASS — 0 error, 0 warning |
| 8 | APP — VITEST | PASS — **Test Files 14 passed · Tests 330 passed** |

Dòng số đo của mục 3, in ra ở chính lần chạy đó:

```
ĐẠT     MC-02 · docs/CHECKPOINT_MC02.md
  mục 0: 23/60 dòng · bảng đối chiếu 7 dòng / 7 điều kiện · 7 ✅ 0 🔶 0 ❌ · cả tệp 388/800 dòng
```

Mục 0 dùng **23/60** dòng và cả tệp **388/800** dòng, nên checkpoint này không phải cắt gì để lọt
ngưỡng — nó vừa khuôn một cách tự nhiên. Đó là phép thử có ý nghĩa nhất cho hai ngưỡng: nếu chính
task đặt ra ngưỡng mà phải vặn nội dung mới lọt thì ngưỡng đó sai.

Số test app: **330**, trước MC-02 là **309** (con số MC-01 đã đo) — tăng **21**, đúng bằng số ca
của `app/test/check-checkpoint.test.ts`. Không ca nào đang xanh bị hỏng.

Sáu `WARN` của mục 1 là sáu cảnh báo có sẵn từ MC-01 (ba spec Stellar chưa tới lượt, `BASE_REF`
chưa đặt, `process.env` ngoài `lib/config`, địa chỉ EVM hardcode) — MC-02 không thêm cảnh báo nào
vì không chạm `app/src`.

## 6. Câu hỏi mở

1. **SL-2** — chấp nhận việc sửa `scan-pending.mjs` để giữ một nơi đọc `task-status.json`, hay
   muốn `check-checkpoint.mjs` tự đọc JSON cho đúng danh sách tệp của `design.md` mục 5?
2. **SL-4** — mốc chuyển task sang `done`: khi Kiro làm xong, hay khi Owner merge? MC-01 và MC-02
   đều đang dùng cách thứ hai, nhưng `make-control.md` mục 7 viết theo cách thứ nhất. Đề xuất: sửa
   `make-control.md` mục 7 cho khớp thực tế đang làm.

## 7. Tự đánh giá 3 LUẬT kiến trúc

Task này **không chạm mã ứng dụng**: thay đổi nằm ở `scripts/`, `docs/`, `.kiro/`, và một tệp test.
Không thêm lời gọi chain, không thêm chỗ ký, không thêm nhánh kiểm quyền.

- [x] Mọi call chain qua `ILedgerPort` — không thêm lời gọi chain nào
- [x] Mọi ký qua `ISigner` — không thêm thao tác ký nào
- [x] Mọi kiểm quyền qua RBAC — không thêm phép kiểm quyền nào

Xác nhận bằng chính phép quét của Lớp 3: `PASS: 20  FAIL: 0` (mục 1 của lần chạy ở mục 5), trong đó
có ba dòng đúng ba luật — "viem/ethers không xuất hiện ngoài `app/src/lib`",
"`SERVER_SIGNER_PRIVATE_KEY` chỉ đọc ở `env.ts` và `server.signer.ts`", "không có so sánh role cứng
ngoài `lib/rbac`".

---

## 8. Tự kiểm trước khi mở PR — `branching.md` §11

Nhánh này có thay đổi mã (`scripts/`, `app/test/`), nên dùng **bản đầy đủ** 7 dòng.

| Dòng của §11 | | Bằng chứng |
|---|---|---|
| Nhánh tạo từ `dev`, không phải từ nhánh phụ | ✅ | `git merge-base dev HEAD` → `69a38a9` = `git rev-parse dev`. Đã kiểm `dev` lành theo §5 — ba lệnh ở đầu tệp này |
| Đã rebase về `dev` mới nhất | ✅ **không cần** | `git rev-parse origin/dev` → `69a38a9`, trùng merge-base. `dev` không đi trước commit nào kể từ lúc tạo nhánh |
| `bash scripts/run-local-all.sh` xanh toàn bộ | ✅ | mục 5 — **8 PASS / 0 FAIL** |
| Có spec trong `.kiro/specs/<tên>/` đủ 3 file | ✅ | `.kiro/specs/mc-02-checkpoint-format/{requirements,design,tasks}.md`, giống hệt bản `docs/` (mục 3.1) |
| Có checkpoint và đã được nghiệm thu PASS | 🔶 **chờ** | Checkpoint là tệp này, và nó qua được máy kiểm (mục 3.8). Nghiệm thu là việc của Supervisor, chưa diễn ra — đó là lý do Kiro không merge |
| `docs/tech-report.md` đã cập nhật theo `tech-report-maintenance.md` | ✅ | mục 3.7 — 5 mục của báo cáo + 5 mục của quy tắc duy trì |
| Nhánh chỉ giải quyết một mục tiêu | ✅ | `git rev-list --count dev..HEAD` → **7** (đo tại `e804822`), toàn bộ mang phạm vi `(mc)` và thuộc 4 bước của `tasks.md` — bảng ở mục 1 |
