# Báo cáo bàn giao — Task BE-07: tự động chia lợi nhuận khi vault nhận tiền

| | |
|---|---|
| Mã task | BE-07 |
| Nhánh | `feat/distribution-trigger`, tạo **từ `dev`** (`6f7ee7b`) |
| Spec | `docs/be-07-distribution-trigger/{requirements,tasks}.md` (**không có `design.md`** — bình thường theo `efficiency.md` §5) |
| Tiến độ | Bước 5/5 xong. Chờ Supervisor nghiệm thu — Kiro **không** merge vào `dev` |

> Quy tắc viết checkpoint: `.kiro/steering/checkpoint.md`.
> Kiểm bằng máy: `node scripts/check-checkpoint.mjs docs/CHECKPOINT_BE07.md docs/be-07-distribution-trigger/requirements.md`

---

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md`) | | Bằng chứng |
|---|---|---|---|
| 1 | Số dư tăng thì tự mở kỳ và chia, không cần người bấm | ✅ | mục 3.2 (ca 2) · 2 |
| 2 | Mốc số dư chỉ cập nhật khi kỳ đã chia xong toàn bộ | ✅ | mục 3.2 (ca 3+4) · 5 (đột biến B) |
| 3 | Chia dở thì vòng sau tiếp tục đúng kỳ đang dở, không mở kỳ mới | ✅ | mục 3.2 (ca 3+4) |
| 4 | Hai vòng đồng thời không chia trùng | ✅ | mục 3.2 (đột biến 1) · 5 (đột biến A) |
| 5 | Lô lỗi không đánh dấu nhầm, chạy lại chia đúng cho ví còn thiếu | ✅ | mục 3.2 (đột biến 2) |
| 6 | Số dư tăng dưới ngưỡng tối thiểu thì không mở kỳ | ✅ | mục 3.2 (ca 5) |
| 7 | Số dư giảm thì dừng và cảnh báo | ✅ | mục 3.2 (ca 6) · 4 (SL-1) |
| 8 | Kỳ treo quá số vòng cấu hình thì có cảnh báo và bản ghi kiểm toán | ✅ | mục 3.2 (ca 7) |
| 9 | Route handler chỉ chạy khi có khoá bí mật đúng | ✅ | mục 3.2 (ca 9) · 2 |
| 10 | Mọi tham số đọc từ tham số hệ thống, không viết cứng | ✅ | mục 3.2 (ca 5, ca 7) · 3.3 |
| 11 | `run-local-all.sh` xanh | ✅ | mục 3.4 — 8 PASS / 0 FAIL |

**Kết luận:** 11 ✅ · 0 🔶 · 0 ❌

### 0.2 Việc cần Owner quyết

Không có mục ❌ nào. Bốn việc dưới đây là **sai lệch so với spec và câu hỏi mở** cần Supervisor xác
nhận, không phải điều kiện chưa đạt.

- **SL-1 — spec ghi "mốc số dư PHẢI chỉ tăng", mã thật không cho phép.** Chia lợi nhuận **làm
  giảm** số dư ví lợi nhuận, nên mốc phải là *số dư dự kiến còn lại* (không đơn điệu tăng).
  Đã làm theo mã thật. Chi tiết và số đo ở mục 4, SL-1.
- **SL-2 — spec ghi `distribution.service.ts` "đọc, không sửa" nhưng cùng spec lại ghi
  `distribution-service` ở "Test bị ảnh hưởng".** Đã sửa tệp đó (thêm hạn mức số lô mỗi lượt) vì
  không có cách nào khác giới hạn số lô mà không viết lại logic chia. Mục 4, SL-2.
- **CH-1 — `KeeperRun` không có cột tóm tắt**, nên "số lô đã chia, số ví còn lại" của mỗi vòng ghi
  vào **sổ kiểm toán** chứ không vào `IKeeperStore` như requirement 8 đòi. Thêm cột là đổi lược đồ,
  vượt phạm vi Tác động. Mục 5, CH-1.
- **CH-2 — đã tự thêm `IN-01`/`IN-02` vào `planned` của `.kiro/task-status.json`** để marker
  `@pending IN-02` mà requirement 12 đòi không bị coi là mã task lạ. Mục 5, CH-2.

---

## 1. Đã làm

Sáu commit, mỗi commit một mục tiêu và đều ở trạng thái build/test được:

| Commit | Mục tiêu |
|---|---|
| `a64a52c` | Nhận spec, chuyển BE-07 sang `inProgress`, thêm `IN-01`/`IN-02` vào `planned` |
| `ef61c77` | Bốn khoá tham số hệ thống mới + bốn hàm đọc |
| `1511d1a` | `distributePeriod` dừng sau `distribution.max_batches_per_run` lô |
| `4ab539f` | `distribution-trigger.service.ts`: phát hiện, chống chạy trùng, chia nhiều vòng, cảnh báo |
| `87bfc52` | Điểm vào cho cron + kích hoạt tay + gỡ hai marker `@pending BE-07` |
| `77ed8ea` | Sinh lại `docs/flows/distribute.md` và mục điểm cắm 3.10 |

```
$ git diff --stat dev...HEAD | tail -1
 19 files changed, 2504 insertions(+), 29 deletions(-)
```

### Ba quyết định đáng đọc trước khi review

**1. Mốc số dư = số dư dự kiến còn lại, không phải tổng đã nhận.** `mock.adapter` và
`ProfitDistributor` đều **rút** VNDB khỏi ví lợi nhuận khi chia, nên mốc luỹ tiến sẽ lớn hơn số dư
thật ngay sau kỳ đầu và mọi lần so sánh về sau đều kết luận "số dư giảm". Mốc mới tính bằng
`period.totalAmount − run.paidAmount`, **không** đọc lại `profitPoolBalance` — đọc lại sẽ nhập cả
tiền SPV nạp thêm giữa lúc chia vào mốc, và số tiền đó vĩnh viễn không tới tay ai.

**2. Khoá chiếm chỗ chạy ghép `<mã kỳ>#<số vòng>`.** Ràng buộc duy nhất `(jobName, periodKey)` cho
một công việc chạy đúng một lần cho một khoá. Dùng thẳng mã kỳ thì vòng thứ hai của cùng kỳ không
chạy được — mà chia nhiều vòng là bắt buộc. Ghép số vòng: hai vòng **đồng thời** đếm ra cùng số nên
tranh một khoá và ràng buộc loại một vòng; hai vòng **nối tiếp** đếm ra hai số nên cả hai chạy được.

**3. Hai bất thường trả `Result` lỗi, không phải `ok` mang cờ.** Số dư giảm →
`err('PERIOD_STATE')`; ví thiếu tiền cho phần còn phải chia → `err('INSUFFICIENT_PROFIT_POOL')`. Cả
hai vẫn để lại `KeeperRun` `FAILED` + audit `FAILURE`. Gói vào `ok` là buộc mọi người gọi phải nhớ
đọc thêm một trường mới biết có chuyện, và ai quên thì im lặng bỏ qua một bất thường về tiền.

### Tệp thay đổi

| | Tệp |
|---|---|
| Mới | `lib/bank/distribution-trigger.service.ts` (`wc -l` → **770**), `app/api/keeper/distribution/route.ts`, `app/test/distribution-trigger.test.ts` (45 ca) |
| Sửa | `lib/config/issue-terms.ts` (4 khoá + 4 mặc định), `lib/store/config-values.ts` (4 hàm đọc), `lib/bank/distribution.service.ts` (hạn mức số lô), `lib/bank/schemas.ts` (2 schema), `lib/config/env.ts` (`KEEPER_SECRET`), `app/actions/distribution.ts` (2 action), `lib/store/index.ts` + `lib/bank/purchase.service.ts` (gỡ marker), `app/api/purchase/route.ts` (chú thích), `.env.example`, `app/test/env-private-key.test.ts` (+5 ca) |
| Tài liệu | `docs/tech-report.md` (mục **3.14** mới, 1.5, 1.6.B, 1.6.C, 3.4, 3.6, 3.13, 4.5, 4.6, 4.7, metadata 2.3 → 2.4), `docs/flows/distribute.md` (sinh lại), `.kiro/task-status.json` |

---

## 2. Đối chiếu DoD theo từng việc của `requirements.md`

| Việc | Nội dung | Đạt? | Ở đâu |
|---|---|:--:|---|
| 1 | `distribution-trigger.service.ts`, một hàm chạy một vòng | ✅ | `runDistributionCycle()` |
| 2 | Phát hiện tiền vào bằng `profitPoolBalance` vs `distribution.last_settled_balance` | ✅ | `detectNewFunds()` |
| 3 | Mỗi lần tiền vào là một kỳ mới, mã sinh theo mốc thời gian + số thứ tự trong ngày | ✅ | `nextAutoPeriodKey()` — `auto-<ngày UTC>-<NN>` |
| 4 | Chống chạy trùng bằng `IKeeperStore.startRun`, ràng buộc duy nhất là trọng tài | ✅ | `claimRun()` — bắt `UniqueConstraintError`, **không** `findRun` trước |
| 5 | Mở kỳ và chia bằng cách gọi lại BE-06 | ✅ | `openPeriod()` + `distributePeriod()`, không có đường chia thứ hai |
| 6 | Chia hết trong nhiều vòng, tối đa `distribution.max_batches_per_run` lô | ✅ | `break` trong vòng gửi lô của `distributePeriod` |
| 7 | Cập nhật mốc chỉ khi kỳ chia xong toàn bộ | ✅ | `settleBalanceMark()`, gọi khi `outstanding === 0` |
| 8 | Ghi kết quả mỗi vòng vào `IKeeperStore` | 🔶 | `closeRun()` + `auditCycle()` — xem CH-1 ở mục 5 |
| 9 | Cảnh báo kỳ treo sau `distribution.stuck_after_runs` vòng | ✅ | `KeeperRun` `FAILED` + audit `FAILURE` kèm chữ "CẢNH BÁO" |
| 10 | Kích hoạt tay có kiểm soát, quyền `distribution:execute` | ✅ | `runDistributionCycleAction()` → guard trong service |
| 11 | Route handler bảo vệ bằng khoá bí mật từ biến môi trường | ✅ | `POST /api/keeper/distribution`, `Authorization: Bearer` |
| 12 | Marker `@flow` nối tiếp, `@pending FE-08`, `@pending IN-02`, gỡ `@pending BE-07` | ✅ | mục 3.3 |

Việc 8 là 🔶 duy nhất: `KeeperRun` chỉ có `status` + `error`, không có cột tóm tắt. Khoảng cách và
hướng xử lý ở mục 5, CH-1.

---

## 3. Cách chạy / kiểm thử

### 3.1 Chạy thử điểm vào

```bash
cp .env.example .env
# Sinh khoá rồi đặt vào .env:  KEEPER_SECRET=$(openssl rand -hex 16)
cd app && npm run dev

# Một vòng chia tự động
curl -X POST -H "Authorization: Bearer $KEEPER_SECRET" \
     -H 'content-type: application/json' -d '{"chain":"mock"}' \
     http://localhost:3000/api/keeper/distribution

# Dọn lệnh mua treo quá hạn
curl -X POST -H "Authorization: Bearer $KEEPER_SECRET" \
     -H 'content-type: application/json' -d '{"job":"expire-orders"}' \
     http://localhost:3000/api/keeper/distribution
```

### 3.2 Chín ca kiểm thử và hai đột biến của spec

```
$ cd app && npx vitest run test/distribution-trigger.test.ts
 ✓ test/distribution-trigger.test.ts (45 tests)
      Tests  45 passed (45)
```

| Ca của spec | Nhóm test | Kiểm thêm gì so với spec |
|---|---|---|
| 1 số dư không tăng | `ca 1` (2 ca) | dòng `KeeperRun` `SUCCESS` có `finishedAt`, `fault.batchCalls === 0` |
| 2 số dư tăng, chia hết, cập nhật mốc | `ca 2` (5 ca) | đối chiếu **số dư VNDB thật trên chuỗi** của từng ví; lần nạp sau mở kỳ `-02` |
| 3 nhiều ví hơn số lô cho phép | `ca 3 và 4` (4 ca) | vòng 1 `PARTIAL` + bảng tham số **còn trống**; vòng 2 cùng `periodId` |
| 4 chia xong mới cập nhật mốc | `ca 3 và 4` | bối cảnh có phần dư khác 0 nên "mốc đúng" phân biệt được với "mốc chưa ghi" |
| 5 dưới ngưỡng tối thiểu | `ca 5` (3 ca) | một ca dùng ngưỡng **cao hơn** mặc định để chứng minh đọc từ cấu hình |
| 6 số dư giảm | `ca 6` (3 ca) | mốc **không** bị hạ theo số dư thật |
| 7 kỳ treo | `ca 7` (4 ca) | một ca dùng ngưỡng cao hơn mặc định; một ca chạy hết 5 vòng để chắc cảnh báo không làm mất phần đã chia |
| 8 kích hoạt tay bị chặn | `ca 8` (5 ca) | ba vai (`AUDITOR`/`COMPLIANCE`/`INVESTOR`) + vết `DENIED` trong sổ |
| 9 route thiếu khoá | `ca 9` (10 ca) | **chưa cấu hình khoá cũng từ chối**; câu trả lời không nói khoá đã cấu hình hay chưa |
| Đột biến 1 | `đột biến 1` (5 ca) | có ca cho kỳ **đang dở** — nơi chỗ chạy là lớp bảo vệ duy nhất |
| Đột biến 2 | `đột biến 2` (3 ca) | ví của lô lỗi lấy từ **chính lời gọi đã gửi lô**, không suy từ thứ tự tạo dữ liệu |
| (thêm) ví thiếu tiền giữa kỳ | 1 ca | `INSUFFICIENT_PROFIT_POOL`, số lần gửi lô **không tăng** |

Ca "ví thiếu tiền" là ca duy nhất ngoài danh sách của spec. Nó kiểm đúng một ràng buộc mà spec có
ghi ("Vault không đủ tiền... PHẢI dừng và cảnh báo, KHÔNG chia một phần rồi bỏ dở") nhưng không cấp
ca kiểm nào.

```
$ cd app && npx vitest run test/distribution-service.test.ts test/config-service.test.ts test/env-private-key.test.ts
      Tests  79 passed (79)
```

### 3.3 Marker và tham số — con số kèm lệnh đo

```
$ git grep -c "@pending BE-07" -- app/src
(exit 1, không còn dòng nào)

$ node scripts/scan-pending.mjs --check
Marker hợp lệ: 19 điểm cắm, 12 điểm chặn, 35 bước luồng. Không có lỗi.

$ node scripts/gen-flow-diagram.mjs --check
Sơ đồ khớp marker: distribute, issue, purchase. Không có tệp mồ côi.

$ node scripts/scan-pending.mjs --check-report
Khớp marker: mục điểm cắm trong docs/tech-report.md

$ git grep -c "CONFIG_KEYS\." -- app/src/lib/store/config-values.ts
8
```

Luồng `distribute` từ 10 bước lên **14** bước (11 `runDistributionCycleAction`,
12 `runDistributionCycle`, 13 `detectNewFunds`, 14 `settleBalanceMark`).

Không tham số nào viết cứng: `distribution.max_batches_per_run`, `distribution.min_new_balance`,
`distribution.stuck_after_runs` đều đọc qua `lib/store/config-values.ts`, và ca 5 + ca 7 mỗi nhóm
có một ca dùng giá trị cấu hình **trái ngược** mặc định trong mã — viết cứng thì hai ca đó đỏ.

### 3.4 Bộ kiểm chứng cục bộ đầy đủ

```
$ bash scripts/run-local-all.sh
########## TỔNG KẾT ##########
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

Cả tám mục đạt, **không** mục nào bị bỏ qua (máy có cargo nên spec test Soroban chạy thật).
`luật kiến trúc` là "PASS có cảnh báo": 20 PASS / 0 FAIL / 6 WARN, sáu cảnh báo đều có từ trước
BE-07. `APP - VITEST`: **511 ca, 18 tệp, 0 đỏ**.

```
$ node scripts/check-checkpoint.mjs docs/CHECKPOINT_BE07.md docs/be-07-distribution-trigger/requirements.md
ĐẠT     docs/CHECKPOINT_BE07.md
  mục 0: 36/60 dòng · bảng đối chiếu 11 dòng / 11 điều kiện · 11 ✅ 0 🔶 0 ❌ · cả tệp 327/800 dòng
```

⚠️ **Lệnh `--in-progress` trong `run-local-all.sh` chỉ kiểm được checkpoint này khi `BE-07` còn ở
`inProgress`.** Bộ kiểm chứng ở mục 3.4 đã chạy ở đúng trạng thái đó; commit cuối mới chuyển BE-07
sang `done` theo `make-control.md` §7, và từ lúc đó `--in-progress` **bỏ qua** vì không còn task nào
đang làm. Đó là hành vi đã thiết kế, không phải lỗi.

### 3.5 Tự kiểm trước khi mở PR (`branching.md` §11)

- [x] Nhánh tạo **từ `dev`** — `git merge-base` là `6f7ee7b`, không phải nhánh phụ nào
- [x] Đã đồng bộ với `dev` mới nhất — `git rev-list --count HEAD..origin/dev` → **0**
- [x] `bash scripts/run-local-all.sh` xanh toàn bộ — mục 3.4
- [🔶] Spec ở `docs/be-07-distribution-trigger/` với **2** tệp, không phải `.kiro/specs/` với 3 tệp.
      Hai lệch có chủ đích: không có `design.md` là bình thường theo `efficiency.md` §5, và vị trí
      `docs/` khớp cách Supervisor giao BE-03/BE-04/BE-06/BE-08 (`ls -d docs/be-*` → 7 thư mục, chỉ
      3 trong số đó có bản song song ở `.kiro/specs/`). Việc chọn một nguồn duy nhất là nợ kỹ thuật
      đã ghi ở `tech-report.md` 1.6.C, do Supervisor quyết
- [x] Có checkpoint (tệp này), chờ nghiệm thu
- [x] `docs/tech-report.md` đã cập nhật theo `tech-report-maintenance.md` §2
- [x] Nhánh chỉ giải quyết một mục tiêu

---

## 4. Sai lệch phát hiện được so với spec

**SL-1. Spec: "Mốc số dư PHẢI chỉ tăng. Số dư giảm (không nên xảy ra vì vault không cho rút)".**
Đo lại thì mô hình này không đúng với mã hiện có:

```
$ grep -n "profitPool -=" app/src/lib/ledger/mock.adapter.ts
656:      s.profitPool -= total;
```

`ProfitDistributor.distributeTo` cũng `safeTransfer` VNDB ra khỏi hợp đồng. Nên số dư ví lợi nhuận
**giảm mỗi lần chia**, và một mốc luỹ tiến sẽ lớn hơn số dư thật ngay sau kỳ đầu tiên — mọi lần so
sánh về sau đều kết luận sai là "số dư giảm bất thường", tức tiến trình tự chặn chính nó vĩnh viễn.

Đã làm theo mã thật: mốc là **số dư dự kiến còn lại** (phần dư làm tròn của kỳ vừa tất toán), không
đơn điệu tăng. Mọi yêu cầu khác của spec vẫn giữ nguyên nghĩa: "số dư giảm thì dừng và cảnh báo" =
`poolBalance < mốc` khi **không có kỳ nào đang dở**, và đó đúng là dấu hiệu tiền ra khỏi ví bằng
đường không qua hệ thống. Đã ghi vào `tech-report.md` mục 3.14.

**SL-2. Spec ghi `lib/bank/distribution.service.ts` ở nhóm "Đọc, không sửa", nhưng cùng spec lại
ghi `distribution-service` ở "Test bị ảnh hưởng".** Hai dòng này mâu thuẫn. Đã sửa tệp đó, tối
thiểu: một lời gọi `readDistributionMaxBatchesPerRun()`, một `break`, một trường `maxBatches` trong
khung nhìn. Lý do không có đường khác: `distributePeriod` chia lô theo **toàn bộ** hồ sơ còn phải
chi, và requirement 6 đòi "một vòng chạy chia tối đa số lô cấu hình được". Giới hạn số lô mà không
sửa hàm đó thì phải viết lại vòng gửi lô ở tệp mới — đúng điều "Không làm" cấm.

Đọc hạn mức **từ tham số hệ thống trong chính hàm** thay vì nhận qua input, để không tạo nguồn thứ
hai — cùng lập luận mà `distributionPeriodSchema` đã ghi cho kích thước lô. Hệ quả: đường bấm tay
(FE-08) cũng được chặn theo, và đó là điều mong muốn. Bốn mươi ba ca của BE-06 **vẫn xanh không sửa
một dòng**, vì bối cảnh lớn nhất của chúng là 3 lô, dưới mặc định 5.

**SL-3. Lệnh đo thứ ba của spec không chạy được.**

```
$ grep -n "@@unique" -B12 app/prisma/schema.prisma | grep -A1 "model KeeperRun"
(rỗng, exit 1)
```

Sự thật cần đo vẫn đúng, chỉ lệnh sai. Lệnh chạy được:

```
$ grep -n "model KeeperRun" -A 16 app/prisma/schema.prisma | grep "@@unique"
306-  @@unique([jobName, periodKey])
```

---

## 5. Câu hỏi mở / chỗ chưa chắc

**CH-1. `KeeperRun` không có cột tóm tắt — requirement 8 chỉ đạt một phần.**
Requirement 8 đòi ghi "thành công, thất bại, số lô đã chia, số ví còn lại, thông báo lỗi" vào
`IKeeperStore`. Lược đồ chỉ có `status` + `error`, và tài liệu của cột `error` ghi rõ "thông báo lỗi
khi thất bại". Nhồi tóm tắt của một vòng **thành công** vào đó sẽ làm mọi truy vấn "vòng nào có lỗi"
trả về cả những vòng chạy đúng.

Đã làm: `error` chỉ mang lý do khi vòng thất bại hoặc kỳ treo; tóm tắt **mỗi** vòng ghi vào **sổ
kiểm toán** (`action: 'distribution:execute'`, `target` là khoá vòng chạy).

Hai cách hiểu khả dĩ:
- (a) "vào `IKeeperStore`" nghĩa là **đúng bảng đó** → cần thêm cột `summary String?` vào
  `KeeperRun`, `IKeeperStore.finishRun`, hai bản hiện thực và `store-constraints.test.ts`.
- (b) "vào `IKeeperStore`" nghĩa là **có chỗ ghi vết bền**, và sổ kiểm toán đáp ứng được.

**Đề xuất: (b)**, vì bảng Tác động của spec để `keeper.store.port.ts` ở nhóm "Đọc, không sửa" nên
(a) vượt phạm vi. Nếu Owner chọn (a) thì làm ở một task riêng — đã ghi vào `tech-report.md` 1.6.C
mức P2 (đề nghị, Supervisor chốt mức).

**CH-2. Đã tự thêm `IN-01` và `IN-02` vào `planned` của `.kiro/task-status.json`.**
Requirement 12 đòi marker `@pending IN-02`, nhưng `scan-pending.mjs --check` báo `UNKNOWN_TASK` cho
mã task không có trong tệp trạng thái, và điều đó làm `run-local-all.sh` đỏ. Không có cách nào vừa
gắn marker vừa để `--check` xanh mà không khai mã task. Spec có nhắc cả hai mã ("IN-01 và IN-02 chưa
làm") nên đã thêm cả hai vào `planned`. Nếu Owner muốn tên khác hoặc chỉ một mã thì sửa một dòng.

**CH-3. Chưa có ca kiểm thử trên Postgres thật cho `startRun` của tiến trình này.**
45 ca chạy trên bản bộ nhớ. Bản bộ nhớ nghiêm ngặt ngang bản Postgres ở đúng ràng buộc quan trọng
(`memory.keeper.store.ts` tự kiểm `(jobName, periodKey)` và ném `UniqueConstraintError`), và
`test/store-constraints.test.ts` của BE-09 đã kiểm ràng buộc đó trên **cả hai** bản. Nhưng "hai
tiến trình Node đồng thời trên một Postgres" thì chưa ai chạy. Đề xuất: để lại cho khâu nghiệm thu
trên môi trường `docker compose`, không dựng thêm hạ tầng test trong task này.

**CH-4. Phần dư làm tròn vẫn chưa chuyển cho `distribution.dust_wallet`** (giới hạn có từ BE-06,
chờ `sweepDust` ở `ILedgerPort`). BE-07 **dựa vào** phần dư đó làm mốc số dư. Nếu về sau có hàm quét
phần dư thì `settleBalanceMark` phải đổi theo: quét xong thì mốc là `0`, không phải `dust`. Đã ghi
chú ngay trên hàm đó trong mã.

---

## 6. Tự đánh giá 3 LUẬT kiến trúc

- [x] **Mọi call chain qua `ILedgerPort`.** Tệp mới chỉ gọi `getLedger(chain).profitPoolBalance()`;
      mọi lời gọi ghi lên chuỗi đi qua `openPeriod`/`distributePeriod` của BE-06.
      `grep -rnE "from '(viem|ethers)'" app/src/ | grep -v "src/lib/"` → rỗng.
- [x] **Mọi ký qua `ISigner`.** Tệp mới không chạm khoá nào. `KEEPER_SECRET` **không phải** khoá ký,
      và nó chỉ đọc ở `lib/config/env.ts` (`keeperSecretMatches`), cùng khuôn với
      `signerPrivateKeyFor`. `grep -rln "SERVER_SIGNER_PRIVATE_KEY" app/src/` → vẫn đúng hai tệp.
- [x] **Mọi kiểm quyền qua RBAC.** `authorize('distribution:execute', ...)` và
      `assertCan(role, 'reconcile:read')`. **Không thêm quyền mới nào.**
      `grep -rnE "role ===|role ==" app/src/ | grep -v "src/lib/rbac/"` → rỗng.
