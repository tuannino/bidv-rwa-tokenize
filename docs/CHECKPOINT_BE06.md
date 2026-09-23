# Báo cáo bàn giao — Task BE-06: Nghiệp vụ chia lợi nhuận

| | |
|---|---|
| Mã task | BE-06 |
| Nhánh | **CHƯA MỞ** — nền chưa xác định được, xem mục 0.2 và mục 5.1 |
| Spec | `docs/be-06-distribution/{requirements,tasks}.md` (không có `design.md`) |
| Tiến độ | **Bước 0 dừng giữa đường.** Không viết một dòng mã nào. Chờ Owner quyết nền nhánh |

> **Quy tắc viết checkpoint:** `.kiro/steering/checkpoint.md`.
> Kiểm bằng máy: `node scripts/check-checkpoint.mjs docs/CHECKPOINT_BE06.md docs/be-06-distribution/requirements.md`.

---

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md`) | | Bằng chứng |
|---|---|---|---|
| 1 | Mở kỳ chốt được snapshot; từ chối khi thiếu tiền, tổng cung 0, mã kỳ trùng | ❌ | mục 5.1 · 0.2 |
| 2 | Xem trước phân bổ đúng tỷ lệ, không ghi gì vào cơ sở dữ liệu | ❌ | mục 5.1 · 0.2 |
| 3 | Ví mua sau thời điểm chốt được chia 0 | ❌ | mục 5.1 · 0.2 |
| 4 | Tổng đã chia bằng tổng tiền kỳ, phần dư xử lý đúng | ❌ | mục 5.1 · 5.3 · 0.2 |
| 5 | Chia theo lô không sót ví, kích thước lô đọc từ tham số hệ thống | ❌ | mục 5.1 (đây là chỗ bị chặn cứng) · 0.2 |
| 6 | Lô lỗi giữa chừng không đánh dấu nhầm; chạy lại không chia trùng | ❌ | mục 5.1 · 0.2 |
| 7 | Hai mục nợ kỹ thuật đã ghi vào `tech-report.md` | ❌ | mục 5.1 · 0.2 |
| 8 | `run-local-all.sh` xanh | ❌ | mục 5.1 · 0.2 |

**Kết luận:** 0 ✅ · 0 🔶 · 8 ❌

### 0.2 Việc cần Owner quyết

- **Nền nhánh: BE-04 chưa merge vào `dev`, mà BE-06 phụ thuộc BE-04.** `requirements.md`
  ghi nền là "`dev` **sau khi BE-04 đã merge**"; điều kiện đó chưa đạt. Trên `dev` không có
  tầng cấu hình (`IConfigStore`, `getConfigStore`, `config-values.ts`), nên điều kiện hoàn
  thành số 5 — "kích thước lô đọc từ tham số hệ thống" — không có đường nào làm được.
  Theo `branching.md` §5 tôi **dừng, không tự chọn nền khác**. Hai phương án ở mục 5.1;
  đề xuất phương án A.
- **Ví nhận phần dư làm tròn: `ILedgerPort` không có đường chuyển phần dư ra khỏi ví lợi
  nhuận.** Ràng buộc tính toán đòi "phần dư dồn về ví chỉ định", nhưng phần dư nằm lại
  trong quỹ trên chuỗi và chỉ `sweepDust` của contract lấy ra được — hàm đó chưa có ở cổng.
  Chi tiết và ba cách xử lý ở mục 5.3; đề xuất cách 1.

---

## 1. Đã làm

Chỉ đọc và đo. **Không tạo nhánh, không sửa tệp nào của repo** ngoài chính tệp checkpoint này.

Đã đọc để nắm nền: `distribution.store.port.ts`, `order.store.port.ts`, `store/index.ts`,
`store.errors.ts`, `memory.distribution.store.ts`, `ledger.port.ts`, `mock.adapter.ts`,
`purchase.service.ts`, `authorize.ts`, `result.ts`, `schemas.ts`, `rbac/permissions.ts`,
`config-values.ts`, `issue-terms.ts`, `actions/purchase.ts`, `scan-pending.mjs`,
`run-local-all.sh`, `test/{purchase,config}-service.test.ts`.

## 2. Đối chiếu DoD

Chưa có bước nào xong, xem mục 0.1.

## 3. Cách chạy/kiểm thử

Chưa có gì để chạy. Các lệnh đo dùng trong mục 5 đều ghi kèm ngay tại chỗ.

## 4. DEVIATION so với spec

Chưa có mã nên chưa có lệch. Hai chỗ **spec lệch trạng thái thật của repo**, đã ghi ở mục 5.2
và 5.3.

## 5. Câu hỏi mở / chỗ chưa chắc

### 5.1 BE-04 chưa merge vào `dev` → không có nền hợp lệ để mở nhánh

`requirements.md` ghi nền là `feat/distribution-service`, "từ `dev` sau khi BE-04 đã merge".

Đo lại:

```
$ git merge-base --is-ancestor 8e69f18 dev && echo merged || echo "CHƯA merge"
CHƯA merge

$ git show dev:.kiro/task-status.json | grep -n "BE-04"
19:    "BE-04",          # còn nằm trong "planned"

$ git show dev:app/src/lib/store/index.ts | grep -c "getConfigStore"
0

$ for f in app/src/lib/store/config.store.port.ts app/src/lib/store/memory.config.store.ts \
           app/src/lib/store/config-values.ts app/src/lib/bank/config.service.ts \
           app/test/config-service.test.ts; do \
    printf '%s: %s\n' "$f" "$(git ls-tree -r --name-only dev -- "$f" | wc -l)"; done
app/src/lib/store/config.store.port.ts: 0
app/src/lib/store/memory.config.store.ts: 0
app/src/lib/store/config-values.ts: 0
app/src/lib/bank/config.service.ts: 0
app/test/config-service.test.ts: 0
```

Vì sao điều này chặn cứng, không phải bất tiện nhỏ:

- Việc 6 của spec và điều kiện hoàn thành số 5 đòi kích thước lô đọc từ tham số hệ thống,
  khóa `distribution.batch_size`. Đường đọc tham số là `getConfigStore()` → `config-values.ts`,
  **cả hai đều chỉ có ở BE-04**.
- Mục Tác động của spec cũng giả định BE-04 đã có: nó liệt kê `lib/config/issue-terms.ts` là
  "nơi khai mặc định tham số" (trên `dev` tệp này chưa có `CONFIG_KEYS`) và liệt kê
  `config-service` vào "test bị ảnh hưởng" (trên `dev` tệp test đó không tồn tại).
- Làm trên `dev` nghĩa là dựng lại tầng cấu hình của BE-04: trùng việc, và chắc chắn xung đột
  khi BE-04 merge.
- Nhánh BE-04 (`feat/issuance-and-config`) **đang chờ nghiệm thu**, nên `branching.md` §1 cấm
  lấy nó làm nền. Tôi không tự quyết việc này (§5: "DỪNG. Không tự chọn nền khác").

Hai phương án:

| | Phương án | Đánh đổi |
|---|---|---|
| **A** (đề xuất) | Owner merge PR của BE-04 vào `dev` trước, rồi tôi `git checkout -b feat/distribution-service dev` | Đúng `branching.md`, không nợ rebase. Chi phí: phải nghiệm thu BE-04 xong trước |
| **B** | Owner cho phép tạm lấy nền `feat/issuance-and-config`, ghi rõ món nợ rebase về `dev` | Làm được ngay, nhưng lỗi của BE-04 lẫn vào BE-06 lúc nghiệm thu, và nếu BE-04 phải sửa lại thì BE-06 rebase theo — đúng ba rủi ro `branching.md` §2 mô tả |

Tôi đề xuất **A**. Nếu Owner chọn **B** thì tôi sẽ ghi vào mục 4 của checkpoint này: nền đã
dùng, lý do, và món nợ rebase về `dev` sau khi BE-04 merge.

### 5.2 `FE-08` không nằm trong tập mã task hợp lệ

Việc 8 của spec yêu cầu gắn `@pending FE-08`. Nhưng:

```
$ grep -c "FE-08" .kiro/task-status.json
0
$ grep -rn "FE-08" --include=*.md --include=*.ts --include=*.json . | grep -v node_modules
docs/be-06-distribution/requirements.md:24:...gắn `@pending FE-08` và `@pending FE-09`...
docs/be-06-distribution/requirements.md:98:- Không làm giao diện. Thuộc FE-08 và FE-09.
```

`make-control.md` §7 nói tập mã hợp lệ là hợp của `done` + `inProgress` + `planned` trong
`.kiro/task-status.json`. `FE-08` không có ở đó, nên `@pending FE-08` sẽ làm
`scan-pending.mjs --check` đỏ với mã `UNKNOWN_TASK` — tức là làm đúng spec thì `run-local-all.sh`
đỏ.

**Hướng tôi định làm** (không chặn, chỉ báo để Owner/Supervisor biết): thêm `FE-08` vào
`planned` trong cùng commit Bước 0, vì chính spec BE-06 coi FE-08 là task giao diện thật sẽ
làm sau. Nếu Supervisor muốn gắn `@pending FE-09` cho cả hai action thay vì đăng ký mã mới thì
nói một câu, tôi đổi.

### 5.3 Phần dư làm tròn: chuyển được về ví chỉ định tới mức nào

Ràng buộc tính toán: "Phần dư do làm tròn dồn về ví chỉ định, đọc từ tham số hệ thống
`distribution.dust_wallet`. Không có thì giữ lại trong ví chia lợi nhuận."

Trạng thái thật của cổng:

```
$ grep -n "distributeBatch\|profitPoolBalance\|sweepDust" app/src/lib/ledger/ledger.port.ts
186:  profitPoolBalance(): Promise<bigint>;
197:  distributeBatch(snapshotId: number, wallets: readonly string[]): Promise<TxResult>;
```

`distributeBatch` **tự tính** phần từng ví theo `distributable × balanceAt / totalSupplyAt`
chia lấy phần nguyên (`mock.adapter.ts:617`), nên tầng nghiệp vụ không có cách nào bảo nó
"trả thêm phần dư cho ví này". Phần dư đọng trong quỹ; chính chú thích ở `mock.adapter.ts`
ghi rằng contract thật quét bằng `sweepDust` — **hàm đó không có trong `ILedgerPort`**.

Ba cách, và vì sao tôi chọn cách 1:

1. **(đề xuất)** Ghi sổ đúng số chuỗi thật trả: `amount` của mỗi hồ sơ = phần nguyên.
   `previewDistribution` trả thêm `dust` và `dustWallet`, và lúc kỳ hoàn tất thì ghi một bản
   ghi kiểm toán nói rõ phần dư là bao nhiêu, đang nằm ở đâu. Giữ được bất biến "sổ khớp
   chuỗi"; đổi lại, phần dư **chưa thật sự chuyển** cho ví chỉ định — còn chờ `sweepDust`.
2. Cộng phần dư vào `amount` của ví chỉ định. Làm đúng câu chữ của spec, nhưng sổ ghi một số
   lớn hơn số chuỗi chuyển → đúng loại lệch mà `lessons.md` đã cấm.
3. Thêm `sweepDust` vào `ILedgerPort` + ba adapter. Vượt phạm vi BE-06, và `evm.adapter`
   chưa nối được `distributeBatch` nên cũng chưa nối được `sweepDust`.

Cần Supervisor chốt trước khi tôi viết mã cho điều kiện hoàn thành số 4.

## 6. Tự đánh giá 3 LUẬT kiến trúc

Chưa có mã nên chưa tự đánh giá được. Ba luật sẽ áp như sau khi bắt đầu:

- [ ] Mọi call chain qua `ILedgerPort` — `distribution.service.ts` chỉ gọi `getLedger(chain)`
- [ ] Mọi ký qua `ISigner` — service không ký trực tiếp; `distributeBatch` do adapter ký
- [ ] Mọi kiểm quyền qua RBAC — `authorize('distribution:snapshot' | 'distribution:execute', …)`
