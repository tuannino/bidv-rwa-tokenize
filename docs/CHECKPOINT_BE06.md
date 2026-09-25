# Báo cáo bàn giao — Task BE-06: Nghiệp vụ chia lợi nhuận

| | |
|---|---|
| Mã task | BE-06 |
| Nhánh | `feat/distribution-service`, tạo **từ `dev`** (`28b62a8`) |
| Spec | `docs/be-06-distribution/{requirements,tasks}.md` (không có `design.md`) |
| Tiến độ | Bước 0–4 xong. Chờ Supervisor nghiệm thu — Kiro **không** merge vào `dev` |

> **Quy tắc viết checkpoint:** `.kiro/steering/checkpoint.md`.
> Kiểm bằng máy: `node scripts/check-checkpoint.mjs docs/CHECKPOINT_BE06.md docs/be-06-distribution/requirements.md`

---

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md`) | | Bằng chứng |
|---|---|---|---|
| 1 | Mở kỳ chốt được snapshot; từ chối khi thiếu tiền, tổng cung 0, mã kỳ trùng | ✅ | mục 3.2 (ca 1, 4, 5) · 2 |
| 2 | Xem trước phân bổ đúng tỷ lệ, không ghi gì vào cơ sở dữ liệu | ✅ | mục 3.2 · 5.2 |
| 3 | Ví mua sau thời điểm chốt được chia 0 | ✅ | mục 3.2 (ca 2) |
| 4 | Tổng đã chia bằng tổng tiền kỳ, phần dư xử lý đúng | 🔶 | mục 4.1 · 5.1 · 0.2 |
| 5 | Chia theo lô không sót ví, kích thước lô đọc từ tham số hệ thống | ✅ | mục 3.2 (ca 6, đột biến 2) · 3.4 |
| 6 | Lô lỗi giữa chừng không đánh dấu nhầm; chạy lại không chia trùng | ✅ | mục 3.2 (ca 7, đột biến 1) · 3.3 |
| 7 | Hai mục nợ kỹ thuật đã ghi vào `tech-report.md` | ✅ | mục 1 (Bước 0) · 6.2 |
| 8 | `run-local-all.sh` xanh | ✅ | mục 3.1 — 8 PASS / 0 FAIL, mã thoát 0 |

**Kết luận:** 7 ✅ · 1 🔶 · 0 ❌

### 0.2 Việc cần Owner quyết

- **Phần dư làm tròn chưa CHUYỂN THẬT về ví chỉ định (điều kiện 4).** `ILedgerPort` không có hàm
  lấy phần dư ra khỏi ví lợi nhuận (`sweepDust` của contract chưa được đưa vào cổng), và
  `distributeBatch` tự tính phần từng ví nên không có đường bảo nó trả thêm cho một ví. Tôi ghi
  nhận phần dư đúng số và đúng đích nhưng **không** cộng vào `amount` của ví nào — cộng vào là làm
  sổ ghi lớn hơn số chuỗi chuyển. Ba phương án ở mục 5.1; đề xuất giữ hành vi hiện tại rồi mở task
  thêm `sweepDust` vào cổng.
- **`SC-05` là mã task MỚI do tôi đăng ký.** `@blocked BE-06` ở `evm.adapter.ts:533` sẽ lạc hậu khi
  BE-06 sang `done`, nhưng không task nào đang có sở hữu việc nối adapter (BE-10 là "xử lý giao dịch
  treo", BE-11 là "đối soát toàn hệ"). Chi tiết chẩn đoán ở mục 5.3. Owner/Supervisor có thể muốn
  gộp vào `SC-03` thay vì mở mã mới.
- **`FE-08` cũng là mã tôi đăng ký thêm**, và cách chia việc FE-08/FE-09 là suy luận của tôi — mục 5.4.

---

## 1. Đã làm

Năm commit, chia theo mục tiêu:

| Commit | Mục tiêu |
|---|---|
| `5c649c9` | Bước 0 — nhận spec, BE-06 sang `inProgress`, hai mục nợ kỹ thuật (việc 9) |
| `7d5f6c2` | Bước 1 — mở kỳ, xem trước phân bổ, đọc trạng thái kỳ (việc 1–4) |
| `8b54c1b` | Bước 2 — chia theo lô, chạy lại phần còn thiếu (việc 5–7) |
| `c7a2add` | Bước 3 — bốn server action, marker `@flow distribute`, sơ đồ luồng (việc 8) |
| *(commit này)* | Bước 4 — báo cáo công nghệ, BE-06 sang `done`, checkpoint |

Tệp mới: `app/src/lib/bank/distribution.service.ts`, `app/src/app/actions/distribution.ts`,
`app/test/distribution-service.test.ts`, `docs/flows/distribute.md` (sinh từ marker).

Tệp sửa: `lib/store/index.ts` (gỡ `@pending BE-06`, re-export `MAX_BULK_ROWS`),
`lib/store/config-values.ts` + `lib/config/issue-terms.ts` + `lib/store/seed-data.ts` (hai khoá tham
số mới), `lib/store/config.store.port.ts` (thêm kiểu `'string'`), `lib/bank/result.ts` (ba mã lỗi),
`lib/bank/schemas.ts` (ba schema), `lib/ledger/evm.adapter.ts` (chỉ marker + chú thích),
`.kiro/task-status.json`, `.kiro/steering/lessons.md`, `docs/tech-report.md`.

## 2. Đối chiếu DoD từng bước

| Bước | Việc | Đạt? | Ghi chú |
|---|---|---|---|
| 0 | BE-06 → `inProgress`, hai mục nợ kỹ thuật | ✅ | `docs/tech-report.md` §1.6.C, hai dòng P1 và P2 |
| 1 | Việc 1–4; ca 1, 2, 4, 5 | ✅ | 20 ca lúc đó, nay nằm trong 43 ca |
| 2 | Việc 5–7; ca 3, 6, 7, 8 + hai đột biến | ✅ | đã **chạy thật** cả hai đột biến — mục 3.3 |
| 3 | Việc 8; sinh sơ đồ `distribute` | ✅ | 10 bước, `docs/flows/distribute.md` |
| 4 | Báo cáo công nghệ, BE-06 → `done`, checkpoint | ✅ | mục 6 |

## 3. Cách chạy/kiểm thử

### 3.1 Bộ đầy đủ — chạy MỘT lần ở cuối task

```
$ bash scripts/run-local-all.sh
  Đạt:     8
  Không đạt: 0
  => ĐẠT toàn bộ kiểm chứng cục bộ.
mã thoát 0
```

Chi tiết từng lớp: luật kiến trúc PASS (20 PASS / 0 FAIL / 6 WARN — sáu WARN đều là spec Stellar
chưa tới lượt, có từ trước BE-06) · điểm cắm PASS · khuôn checkpoint PASS · hardhat **67 passing** ·
cargo **1 passed** · typecheck PASS · lint PASS (0 error, 0 warning) · vitest **462 passed (462)**.

### 3.2 Test của task này

```
$ cd app && npx vitest run test/distribution-service.test.ts
 ✓ test/distribution-service.test.ts (43 tests) 64ms
      Tests  43 passed (43)
```

Tám ca của spec ánh xạ sang các `describe` cùng tên (`ca 1` … `ca 8`, `đột biến 1`, `đột biến 2`).
Ba nhóm `describe` thêm vào ngoài danh sách — `xem trước là hàm đọc`, `đọc trạng thái kỳ`, và ca
"chưa hồ sơ nào ở PAID tại thời điểm lô đang được gửi" — đều phục vụ trực tiếp một điều kiện hoàn
thành (số 2, và số 6), không phải ca tự thêm cho đủ số.

### 3.3 Hai đột biến của spec — đã DỰNG THẬT và CHẠY THẬT

| Đột biến | Kết quả lần đầu | Xử lý |
|---|---|---|
| Viết cứng `const batchSize = 50` | **ĐỎ ngay**: `expected 50 to be 30` ở `đột biến 2` | giữ nguyên bộ test |
| `markBatch(..., 'PAID')` **trước** `distributeBatch` | **XANH cả 42 ca** — bộ test không bắt được | thêm ca mới, xem dưới |

Đột biến thứ hai là phát hiện đáng kể nhất của task. Khối `catch` sửa hồ sơ về `FAILED`, nên **trạng
thái sau khi hàm chạy xong giống hệt bản đúng** — mọi phép kiểm "cuối cùng hồ sơ ở `FAILED`, số dư
bằng 0" đều vẫn xanh. Mà thiệt hại thật nằm ở *giữa* luồng: tiến trình chết đúng đó thì hồ sơ đứng
lại ở `PAID` trong khi chưa ai nhận đồng nào, và không lần chạy lại nào xét tới họ nữa.

Cách bắt: thêm hook `fault.onBatch` vào vỏ bọc ledger, chạy **ngay trước** khi lô được gửi, rồi đọc
trạng thái hồ sơ tại đúng thời điểm ấy. Sau khi thêm:

```
$ # với đột biến
 → expected Set{ 'PAID' } to deeply equal Set{ 'PENDING' }
      Tests  1 failed | 42 passed (43)
$ # bản đúng
      Tests  43 passed (43)
```

Đã phục hồi mã, không còn vết nào: `grep -n "ĐỘT BIẾN TẠM THỜI" app/src/lib/bank/distribution.service.ts`
→ rỗng.

### 3.4 Số đo dùng làm bằng chứng

```
$ git grep -c "@pending BE-06" -- app/src | wc -l
0
$ grep -cE "^export async function" app/src/lib/bank/distribution.service.ts
4
$ grep -cE "^export async function" app/src/app/actions/distribution.ts
4
$ node scripts/scan-pending.mjs --check
Marker hợp lệ: 17 điểm cắm, 12 điểm chặn, 31 bước luồng. Không có lỗi.
```

## 4. DEVIATION so với spec

### 4.1 Phần dư làm tròn chỉ được GHI NHẬN, chưa chuyển

Spec: *"Phần dư do làm tròn dồn về ví chỉ định, đọc từ tham số hệ thống `distribution.dust_wallet`."*

Đã làm: đọc khoá đó, trả `dust` + `dustWallet` trong `previewDistribution` và trong khung nhìn của
`distributePeriod`, ghi câu mô tả phần dư kèm đích vào sổ kiểm toán khi kỳ chạy xong. **Chưa** chuyển
tiền tới ví đó. Lý do và ba phương án ở mục 5.1.

### 4.2 Hai hàm đọc dùng `assertCan`, không `authorize`

`previewDistribution` và `getDistributionPeriod` kiểm quyền bằng `assertCan` nên **không ghi một dòng
kiểm toán nào**. Với `previewDistribution` đây là điều kiện hoàn thành số 2 đòi ("không ghi gì vào cơ
sở dữ liệu" — sổ kiểm toán cũng là cơ sở dữ liệu). Với `getDistributionPeriod` là để màn theo dõi gọi
lại theo chu kỳ mà không nhấn chìm sổ. Cùng tiền lệ `previewPurchase` ở BE-03. Đánh đổi: một lần xem
trước **bị chặn** không để lại dấu vết.

### 4.3 Thêm ba mã lỗi và một kiểu tham số cấu hình

`ErrorCode`: `INSUFFICIENT_PROFIT_POOL`, `NO_CIRCULATING_SUPPLY`, `PERIOD_STATE` (cả ba HTTP 409).
`CONFIG_VALUE_TYPES`: thêm `'string'` cho `distribution.dust_wallet` — ba kiểu cũ không mang nổi một
địa chỉ ví. Doc của chính cổng nói đây là đường mở rộng được duyệt trước ("thêm kiểu mới thì thêm vào
đây"), nên tôi không coi là sửa hợp đồng cổng.

### 4.4 Một phép kiểm THÊM vào `openPeriod` mà spec không yêu cầu

Đọc `profitPoolBalance()` **lần thứ hai** sau `takeSnapshot` và so với lần đọc trước; lệch thì từ chối
mở kỳ. Lý do ở mục 5.1 đoạn cuối. Đây là 8 dòng thêm vào, và nó biến một sai lệch âm thầm thành một
lần từ chối có lý do.

### 4.5 KHÔNG sửa `distribution.store.port.ts`

Spec cho phép sửa nếu thiếu hàm thật sự. Không thiếu hàm nào — tám method đủ cho cả luồng.

## 5. Câu hỏi mở / chỗ chưa chắc

### 5.1 Phần dư: `ILedgerPort` không có đường chuyển nó ra khỏi ví lợi nhuận

`distributeBatch` **tự tính** phần từng ví theo `distributable × balanceOfAt / totalSupplyAt` chia lấy
phần nguyên, và phần lẻ đọng trong quỹ. Contract thật quét bằng `sweepDust`, nhưng hàm đó **không có
trong `ILedgerPort`** và `ledger.port.ts` là "đọc, không sửa" theo spec.

Ba cách:

| | Cách | Đánh đổi |
|---|---|---|
| **1** (đã làm) | `amount` = đúng số chuỗi trả; ghi nhận `dust` + `dustWallet` ở khung nhìn và sổ kiểm toán | Sổ khớp chuỗi tuyệt đối. Phần dư **chưa** tới ví chỉ định |
| 2 | Cộng phần dư vào `amount` của ví chỉ định | Đúng câu chữ spec, nhưng sổ ghi lớn hơn số chuỗi chuyển — đúng loại lệch `lessons.md` cấm |
| 3 | Thêm `sweepDust` vào `ILedgerPort` + ba adapter | Vượt phạm vi BE-06; `evm.adapter` còn chưa nối được `distributeBatch` nên cũng chưa nối được `sweepDust` |

Đề xuất: giữ cách 1, mở một task nhỏ thêm `sweepDust` vào cổng. `test/distribution-service.test.ts`
ca 3 **khoá lại hành vi hiện tại** (`profitPoolBalance()` bằng đúng phần dư sau khi chia), nên lần nối
`sweepDust` buộc phải sửa test — phần dư không thể âm thầm đổi đích.

**Một giới hạn cùng họ, đã bù được một phần.** Contract chốt số tiền chia được **ngay tại** lời gọi
chụp ảnh, và cổng không có hàm đọc lại con số đã chốt đó. Nên `totalAmount` ghi vào kỳ là số đọc
*trước* khi chụp, và nó chỉ đúng khi quỹ không đổi giữa hai thời điểm. Tôi đọc lại rồi so (mục 4.4);
lệch thì từ chối mở kỳ, mất một ảnh chụp nhưng không bao giờ ghi một `totalAmount` sai. Cách sửa gốc
là thêm `distributableAt(snapshotId)` vào cổng — cần Supervisor chốt.

### 5.2 "Không ghi gì vào cơ sở dữ liệu" — tôi hiểu gồm cả sổ kiểm toán

Hai cách hiểu: (a) không tạo kỳ/hồ sơ chia; (b) không ghi **dòng nào**, kể cả audit. Tôi chọn (b) vì
nó kiểm được chặt và không mất gì. Ca kiểm so ảnh **cả bốn bảng** (kỳ, hồ sơ chia, lệnh mua, sổ kiểm
toán) trước và sau lời gọi. Nếu Supervisor muốn (a) thì đổi `assertCan` → `authorize` ở
`previewDistribution` và sửa ca đó.

### 5.3 `evm.adapter.distributeBatch`: thứ thiếu là CHỮ KÝ, không phải một quyết định của BE-06

Marker cũ ghi việc này chờ BE-06. Dựng xong tầng nghiệp vụ thì thấy rõ hơn:

- Trên chuỗi thật, kỳ chia sinh ra bởi `createDistribution(amount, period)` — hàm đó **tự gọi**
  `snapshot()`. Nên `takeSnapshot()` đứng riêng không tạo kỳ chia nào, và sau nó **không tồn tại**
  `distributionId` để tra.
- `distributeBatch(snapshotId, wallets)` chỉ nhận `snapshotId`, tức không mang theo thứ duy nhất tra
  được `distributionId`: mã kỳ nghiệp vụ (`periodKey`, đúng tham số `period` contract nhận).

Hai đường xử lý (ghi đầy đủ ngay trên marker ở `evm.adapter.ts`): đổi chữ ký để mang mã kỳ xuống
adapter, **hoặc** thêm cột `distributionId` vào `DistributionPeriod` và để `openPeriod` gọi
`createDistribution` thay `takeSnapshot` trên chain EVM. Cả hai đều sửa `ledger.port.ts` hoặc lược đồ
— vượt phạm vi BE-06. Tôi **không nối** vì nối sai cho ra hệ thống chạy được mà chia theo một kỳ khác.

Marker nay là `@blocked SC-05`. Nếu Supervisor muốn gộp vào `SC-03` thì sửa một dòng marker và một
dòng `task-status.json`.

### 5.4 Cách chia FE-08 / FE-09 là suy luận của tôi

Không task nào trong hai mã đó có spec. Tôi gán: **FE-08** = màn ngân hàng (mở kỳ, xem trước, bấm
chia) → ba action; **FE-09** = màn đọc trạng thái kỳ → một action. Đổi thì sửa bốn dòng marker rồi
`node scripts/scan-pending.mjs --write-report`.

## 6. Sai lệch phát hiện được và cập nhật tài liệu

### 6.1 Sai lệch so với spec / repo

- **`FE-08` không nằm trong tập mã task hợp lệ** (`grep -c "FE-08" .kiro/task-status.json` → 0 lúc
  nhận việc), nên làm đúng việc 8 sẽ khiến `scan-pending --check` đỏ `UNKNOWN_TASK`. Đã đăng ký vào
  `planned`.
- **`@blocked BE-06` ở `evm.adapter.ts` sẽ lạc hậu** khi BE-06 sang `done` — mục 5.3.
- **Vòng đầu bị chặn:** spec ghi nền là "`dev` sau khi BE-04 đã merge" mà BE-04 chưa merge. Đã dừng
  và báo Owner theo `branching.md` §5; Owner merge BE-04 (`28b62a8`) rồi tôi mở nhánh từ `dev`. Bằng
  chứng của vòng đó nằm trong commit `5c649c9` của tệp này.

### 6.2 Mục đã cập nhật ở `docs/tech-report.md`

Metadata (2.2 → **2.3**, nhánh/commit, phase) · ghi chú đổi phiên bản · §1.4 cây thư mục ·
§1.6.A (bốn bài học kiến trúc + hai bài học về test, cũng đã thêm vào `.kiro/steering/lessons.md`) ·
§1.6.C (hai mục nợ theo việc 9, và sửa mục P1 từ BE-06 sang SC-05) · §3.1 bảng method 22 ·
§3.3 (năm hành động RBAC đã có nghiệp vụ dùng thật) · §3.4 (service + schema + ba lưu ý mới) ·
§3.5 (cổng chia lợi nhuận đã có người gọi, `config-values.ts`) · **§3.13 mới** (bảng bốn khoá tham
số) · **§4.5 viết lại** từ "P3, chưa xây" thành luồng thật · §4.6 · §4.7 lộ trình ·
§3.10 (sinh lại bằng script, không sửa tay).

## 7. Tự đánh giá 3 LUẬT kiến trúc

- [x] **Mọi call chain qua `ILedgerPort`** — `distribution.service.ts` chỉ gọi `getLedger(chain)`.
      `grep -rnE "from '(viem|ethers)'" app/src/ | grep -v "src/lib/"` → **0**
- [x] **Mọi ký qua `ISigner`** — service không ký; adapter ký qua signer do `getLedger` tiêm.
      `grep -rln "SERVER_SIGNER_PRIVATE_KEY" app/src/` → đúng 2 tệp (`config/env.ts`,
      `signer/server.signer.ts`), không phát sinh chỗ mới
- [x] **Mọi kiểm quyền qua RBAC** — `authorize('distribution:snapshot'|'distribution:execute', …)`
      và `assertCan(role, 'distribution:execute'|'reconcile:read')`.
      `grep -rnE "role ===|role ==" app/src/ | grep -v "src/lib/rbac/"` → **0**
