# Báo cáo bàn giao: FIX-07 Checkpoint không phân biệt hoa thường; Indexer bỏ qua sự kiện không theo dõi

| | |
|---|---|
| Mã task | FIX-07 |
| Phạm vi | **Backend hẹp, Sếp duyệt 04/11:** một tệp `scripts/`, một tệp `lib/ledger/` cộng một tệp mới cùng thư mục. Không đổi dữ liệu, hành vi nghiệp vụ, ABI hay hợp đồng |
| Nhánh | `fix/fix-07-kiem-checkpoint-indexer`, tạo từ `release/ui-v2` (`baf0fd4`, sau merge PR #89 FE-UX-03a) |
| Spec | `docs/fix-07-kiem-checkpoint-indexer/{requirements,design,tasks}.md` (bản cập nhật 04/11 có QĐ-5) |
| Commit | spec `741af3a`; checkpoint không phân biệt hoa thường `beea50e`; Indexer `02abf6d`; tài liệu: commit cuối trên nhánh |
| Tiến độ | Xong. Một PR, base `release/ui-v2`, chờ Supervisor nghiệm thu; Claude Code **không** merge |

Tệp đổi: `scripts/check-checkpoint.mjs`, `app/src/lib/ledger/evm.adapter.ts`, `app/src/lib/ledger/evm-log-decode.ts`
(mới), `app/test/check-checkpoint.test.ts` (chỉ thêm 4 ca), `app/test/fix-07-evm-log-decode.test.ts` (mới),
`docs/fix-07-kiem-checkpoint-indexer/*`, `docs/CHECKPOINT_FIX07.md`, `.kiro/task-status.json`; ngoài danh sách trắng:
`docs/tech-report.md` (2 dòng trong khối sinh tự động, mục 5).

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 4) | | Bằng chứng |
|---|---|---|---|
| 1 | `resolveTaskFiles` đúng QĐ-1; 4 ca mới xanh, ca cũ không đổi | ✅ | mục 1.2, 2.1 |
| 2 | Repo thật: `FE-UX-03a` trả `CHECKPOINT_FEUX03A.md`, `OP-04` vẫn trả `CHECKPOINT_OP04.md` | ✅ | mục 1.3 |
| 3 | `evm-log-decode.ts` đúng QĐ-2, QĐ-3; diff `evm.adapter.ts` chỉ là dời vòng lặp và xoá cờ cục bộ | ✅ | mục 2.2 |
| 4 | Unit test mới đủ ca design mục 2, xanh; topic `RoleGranted`, `Approval` đúng | ✅ | mục 1.4 |
| 5 | Log `evm` không còn dòng "bỏ log không giải mã được" (`grep -c` ra 0); 26 ca Hardhat đạt | ✅ | mục 1.1, 3 |
| 6 | Không đổi hành vi nghiệp vụ: e2e mock và Hardhat xanh; `indexer-sync.test.ts` xanh không sửa | ✅ | mục 1.1, 3 |
| 7 | Lệnh danh sách trắng rỗng; `scripts/verify-arch-rules.sh` đạt | 🔶 | mục 4, 5: lệnh ra đúng 1 tệp `docs/tech-report.md` (khối sinh tự động); `verify-arch-rules.sh` đạt |
| 8 | Checkpoint ghi phạm vi "backend hẹp, Sếp duyệt 04/11", danh sách tệp, kết quả kiểm | ✅ | đầu tệp, mục 1 |

**Kết luận:** 7 ✅, 1 🔶, 0 ❌. Script checkpoint giờ tìm đúng `CHECKPOINT_FEUX03A.md` (FE-UX-03a phải chạy lệnh hai
tham số); log Hardhat từ 11 dòng lỗi giải mã còn 0. Mức rủi ro: thấp (vòng giải mã dời nguyên văn, tập
sự kiện lưu không đổi).

### 0.2 Việc cần Owner quyết

- Chấp nhận `docs/tech-report.md` ngoài danh sách trắng (mục 5, DEVIATION 1): chỉ 2 dòng số dòng marker `SC-04` trong
  khối giữa hai mốc `BEGIN:diem-cam`, `END:diem-cam`, sinh bằng `node scripts/scan-pending.mjs --write-report`. Không sinh lại thì
  `pending-markers.test.ts` đỏ.
- Nợ QĐ-5 (giữ `strict: false`) ghi ở mục 5.

---

## 1. Kiểm thử (requirements mục 5, phần dev)

### 1.1 Lệnh và kết quả

`FIX-07` đưa vào `inProgress` của `.kiro/task-status.json` trước khi chạy (phần `markers`, `checkpoint` đọc được).

```text
$ TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm
PASS: 20   FAIL: 0   WARN: 3                     (luật kiến trúc, như mốc)
=> PASS: LỚP 3 - ĐIỂM CẮM (marker)
=> PASS: LỚP 3 - KHUÔN CHECKPOINT
=> PASS: APP - TYPECHECK
=> PASS: APP - LINT
 Test Files  77 passed | 11 skipped (88)
      Tests  1517 passed | 74 skipped (1591)
=> PASS: APP - VITEST
=> PASS: APP - BUILD BẢN PHÁT HÀNH
  116 passed, 7 skipped                           (e2e mock)
=> PASS: APP - E2E (PLAYWRIGHT)
=> PASS: EVM - BUILD BẢN HARDHAT
=> PASS: EVM - DỰNG CHUỖI MỚI
  26 passed, 2 skipped                            (e2e Hardhat)
=> PASS: EVM - E2E PROJECT HARDHAT
=> ĐẠT các phần đã chạy: arch markers checkpoint app build e2e evm
EXIT=0
```

Lượt chạy đầu đỏ đúng 1 ca `pending-markers.test.ts` (khối sinh trong `docs/tech-report.md` lệch số dòng, DEVIATION 1
mục 5); sau khi sinh lại, em chạy lại TOÀN BỘ từ đầu, kết quả trên là lượt chạy lại.

Log gửi kèm (không commit): `20261104_fix07_run_local_all.log` và riêng đoạn từ dòng "EVM - E2E PROJECT HARDHAT"
tới hết: `20261104_fix07_evm_e2e.log` (cùng đoạn của lần chạy mốc `20261104_fix07_evm_e2e_moc.log`). Không chạy
`contracts`.

### 1.2 Ca mới trong `app/test/check-checkpoint.test.ts` (khối "Suy tên tệp từ mã task", chỉ thêm)

| Ca | Dữ liệu | Kết quả |
|---|---|---|
| a | `CHECKPOINT_FEUX03A.md`; `resolveTaskFiles(root, 'FE-UX-03a')` | `ok`, chọn `docs/CHECKPOINT_FEUX03A.md` |
| b | `CHECKPOINT_FEUX03a.md` và `CHECKPOINT_FEUX03A.md` | `ok: false`, `thieuCheckpoint: false`, `reason` nêu cả hai. `it.skipIf` khi hệ tệp không phân biệt hoa thường (dò bằng `mkdirSync` `a` rồi `A`, không thêm import); máy chạy ở đây phân biệt nên ca CHẠY |
| c | Chỉ `CHECKPOINT_FEUX03A_V2.md` | `ok`, chọn tệp hậu tố (ca này đỏ trên mã cũ) |
| d | `CHECKPOINT_OP04.md`, `_PROXY.md`, `_TXS.md`; `OP-04` | `ok`, chọn tệp gốc |

`check-checkpoint.test.ts`: 25 passed (21 ca cũ không đổi, 4 ca mới).

### 1.3 Trên repo thật (không sửa tạm `task-status.json`)

```text
$ node -e "import('./scripts/check-checkpoint.mjs').then(m=>{const r=process.cwd();
    console.log(JSON.stringify(m.resolveTaskFiles(r,'FE-UX-03a')));
    console.log(JSON.stringify(m.resolveTaskFiles(r,'OP-04')));})"
{"ok":true,"checkpoint":"docs/CHECKPOINT_FEUX03A.md","requirements":"docs/fe-ux-03a-kiem-soat/requirements.md"}
{"ok":true,"checkpoint":"docs/CHECKPOINT_OP04.md","requirements":"docs/op-04-sepolia/requirements.md"}
```

### 1.4 `app/test/fix-07-evm-log-decode.test.ts` (7 ca, nạp lại mô-đun mỗi ca bằng `vi.resetModules`)

Log giả dựng trong tệp test (`encodeEventTopics`, `encodeAbiParameters`); ABI đầy đủ đọc từ
`packages/shared/generated/*.abi.json` chỉ trong test.

| Ca | Kết quả |
|---|---|
| 1 | `toEventSelector` của `RoleGranted(bytes32,address,address)` là `0x2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d`, của `Approval(address,address,uint256)` là `0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925` (đúng bảng đầu requirements); tập bỏ qua 11 phần tử, BẰNG (sự kiện ABI đầy đủ `ProjectToken` hợp `SpvPaymentVault`) trừ (sự kiện ABI rút gọn), so theo chữ ký |
| 2 | `Transfer` của token và `OrderSettled` của vault: trả 2 sự kiện đúng giá trị chuẩn hoá viết tường minh (địa chỉ checksum, số tiền chuỗi thập phân `'1000000000000000000'`, `orderRef` hex chữ thường), không cảnh báo |
| 3 | 11 sự kiện bỏ qua (dựng từ ABI đầy đủ): đều bị bỏ, `console.warn` không gọi |
| 4 | Topic lạ: bỏ, cảnh báo 1 lần, câu có topic và địa chỉ; lần hai cùng chain không cảnh báo thêm; chain khác cảnh báo thêm 1 lần |
| 5 | Thiếu `blockNumber`, `logIndex`, `transactionHash`: bỏ, không cảnh báo. Không có `topics[0]`: bỏ, cảnh báo đúng 1 lần cho 2 log |
| 5b | Hành vi HIỆN TẠI (QĐ-5): `Transfer` và `Withdrawn` có `data` hỏng vẫn được trả, thiếu tham số không `indexed` (`Transfer` chỉ còn `from`, `to`), không cảnh báo |
| 6 | Kết quả sắp theo `blockNumber` rồi `logIndex` |

`indexer-sync.test.ts`: 11 passed, không sửa.

Tự gây lỗi 3 điểm Supervisor định thử, trên bản sao làm việc rồi hoàn lại:

| Lỗi gây ra | Kết quả |
|---|---|
| Bỏ cờ `i` ở hai `RegExp` của `resolveTaskFiles` | ca a, b, c đỏ |
| Bỏ `Approval(address,address,uint256)` khỏi `IGNORED_EVENT_SIGNATURES` | ca 1 và ca 3 đỏ |
| Đưa tập cảnh báo về biến cục bộ trong `decodeEvmLogs` | ca 4 đỏ (lần gọi thứ hai cùng chain cảnh báo lại) |

## 2. Thay đổi

### 2.1 `scripts/check-checkpoint.mjs` (`resolveTaskFiles`, QĐ-1)

- Đọc thư mục `docs/` một lần (không `existsSync` theo đúng tên), bỏ tệp khớp `/_DETAIL\.md$/i`.
- Mã task thoát ký tự `RegExp` (hàm `thoatRegExp` mới) trước khi ghép.
- Bước 1: `^CHECKPOINT_<mã>\.md$` cờ `i`; một tệp thì dùng, từ hai tệp thì báo lỗi nhiều tệp.
- Bước 2 (chỉ khi không có tên gốc): `^CHECKPOINT_<mã>(_[A-Za-z0-9]+)+\.md$` cờ `i`; một thì dùng, từ hai báo lỗi.
- Câu báo lỗi nhiều tệp giữ chữ, chỉ đổi gạch dài trước danh sách tệp thành dấu hai chấm (dòng này nằm trong diff;
  test chỉ kiểm cụm "KHÔNG tự chọn"). Phần tìm `requirements.md` giữ nguyên.

### 2.2 Indexer (QĐ-2, QĐ-3)

`app/src/lib/ledger/evm-log-decode.ts` (mới): `IGNORED_EVENT_SIGNATURES` (11 chữ ký viết tay), `IGNORED_EVENT_TOPICS`
tính bằng `toEventSelector` lúc nạp, so chữ thường; tập cảnh báo mức mô-đun theo `chain`; `serializeEventArgs` và
`decodeEvmLogs`. `evm.adapter.ts`: `fetchLogs` giữ chia đoạn block, `getLogs`, địa chỉ lọc, rồi
`return decodeEvmLogs(parts.flat(), scope, chain);`; xoá `serializeEventArgs`, `warnedUndecodableLog` và 2 import
không còn dùng (`decodeEventLog`, `IndexedEventArgs`).

`serializeEventArgs` trước (`evm.adapter.ts:615-628` @ `baf0fd4`) và sau (`evm-log-decode.ts`), bỏ thụt lề: `diff`
rỗng.

Vòng giải mã trước (`evm.adapter.ts:675-703` @ `baf0fd4`) và sau (`decodeEvmLogs`), bỏ thụt lề, `diff` đầy đủ:

```diff
2c2,8
< for (const log of parts.flat()) {
---
> for (const log of logs) {
> const topic = log.topics[0];
> if (!topic) {
> warnUndecodable(chain, log, new Error('Log không có topics[0].'));
> continue;
> }
> if (IGNORED_EVENT_TOPICS.has(topic.toLowerCase())) continue;
21,24c27
< if (!warnedUndecodableLog) {
< warnedUndecodableLog = true;
< console.warn(`Indexer ${chain}: bỏ log không giải mã được; các log sau chỉ bỏ qua im lặng.`, error);
< }
---
> warnUndecodable(chain, log, error);
```

Mọi dòng khác (chọn ABI theo `scope.vault`, `decodeEventLog` với `strict: false`, điều kiện bỏ log thiếu
`blockNumber`, `logIndex`, `transactionHash`, dựng sự kiện, sắp kết quả) giống hệt. `warnUndecodable` giữ nguyên câu
cũ, thêm vào cuối "Topic <topics[0]>, hợp đồng <địa chỉ>.".

## 3. Log Hardhat trước và sau (điều kiện 5, 6)

| | Mốc `baf0fd4` (chỉ phần `evm`) | Sau |
|---|---|---|
| `grep -c "không giải mã được"` đoạn "EVM - E2E PROJECT HARDHAT" | 11 (đều `AbiEventSignatureNotFoundError` topic `0x2f87...656f0d` của `RoleGranted`) | 0 |
| e2e Hardhat | 26 passed, 2 skipped | 26 passed, 2 skipped |

Tập sự kiện lưu không đổi (QĐ-4): 11 chữ ký bỏ qua vốn đã bị bỏ do giải mã lỗi (ABI rút gọn không có), giờ bỏ
trước khi giải mã; ca 2 khẳng định dữ liệu sự kiện đang theo dõi giống trước.

## 4. Lệnh kiểm (tasks bước 5)

```text
$ git diff --name-only origin/release/ui-v2...HEAD | grep -vE '^(...danh sách trắng...)$'
docs/tech-report.md                                                                           # DEVIATION 1, mục 5
$ bash scripts/verify-arch-rules.sh                                                           # PASS 20, FAIL 0, WARN 3 (như mốc)
$ node scripts/check-checkpoint.mjs docs/CHECKPOINT_FIX07.md docs/fix-07-kiem-checkpoint-indexer/requirements.md   # ĐẠT
```

## 5. DEVIATION và nợ

- **DEVIATION 1, `docs/tech-report.md` ngoài danh sách trắng.** Dời vòng giải mã làm `evm.adapter.ts` ngắn đi 42
  dòng, nên hai marker `@pending SC-04` dời từ dòng 1257, 1263 về 1215, 1221. Test sẵn có
  `pending-markers.test.ts` ("docs/tech-report.md có mục điểm cắm và mục đó khớp marker hiện tại") đòi khối sinh tự
  động khớp số dòng, nên lượt chạy đầu đỏ đúng ca này. Em sinh lại bằng `node scripts/scan-pending.mjs
  --write-report`; diff đúng 2 dòng trong khối sinh (chỉ đổi số dòng), không sửa tay, chữ ngoài khối không đổi.
  Cách khác là giữ nguyên số dòng `evm.adapter.ts` bằng dòng độn, em không chọn. Spec sót tệp này trong danh sách
  trắng; cần Owner chấp nhận.
- **QĐ-5 (spec cập nhật 04/11):** giữ `strict: false`. Lúc làm, em phát hiện spec bản đầu mâu thuẫn (ca 5b đòi bỏ
  và cảnh báo log hỏng của sự kiện đang theo dõi, nhưng mã dời nguyên văn với `strict: false` không ném lỗi mà trả
  sự kiện thiếu tham số). Em đã báo Sếp; spec cập nhật chốt giữ nguyên hành vi, ca 5b ghi lại hành vi hiện tại. Nợ:
  task sau kiểm trên Sepolia có sự kiện thiếu tham số hay không rồi mới chọn `strict: true` hoặc kiểm tham số.
- Câu báo lỗi nhiều tệp ở `check-checkpoint.mjs` đổi gạch dài thành dấu hai chấm (mục 2.1).

## 6. Tự đánh giá 3 luật kiến trúc

- [x] Mọi call chain qua ILedgerPort: không đổi; Indexer vẫn đọc qua adapter EVM.
- [x] Mọi ký qua ISigner: không đổi.
- [x] Mọi kiểm quyền qua RBAC: không đổi.
