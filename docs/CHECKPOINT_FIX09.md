# Báo cáo bàn giao: FIX-09 nhận đúng lệnh rút VNDB khi ví gói giao dịch (EIP-7702)

| | |
|---|---|
| Mã task | FIX-09 |
| Phạm vi | **Backend, chỉ đọc và đối chiếu.** `lib/ledger/payment-tag.ts` (mới), `findPaymentTransferByTag` và một dòng import trong `lib/ledger/evm.adapter.ts`, `matchesTransfer` cùng chú thích và một dòng import trong `lib/bank/payment-withdraw.service.ts`, một chú thích trong `lib/ledger/ledger.port.ts`. Không đổi schema, hợp đồng, quyền, action, giao diện, câu chữ người dùng thấy, `reconcileOne`, mock; không gói npm mới |
| Nhánh | `fix/fix-09-rut-vndb-eip7702`, tạo từ `dev` @ `2308509` (Sếp duyệt sửa thẳng vào `dev` 06/11). Không có PR nào merge vào `dev` trong lúc làm |
| Spec | `docs/fix-09-rut-vndb-eip7702/{requirements,tasks}.md` (chép nguyên) |
| Commit | spec, task-status `2a11837`; mã và unit `634c997`; tài liệu: các commit cuối trên nhánh |
| Tiến độ | PR 1 base `dev`, chờ Supervisor nghiệm thu; Claude Code **không** merge. PR 2 (đồng bộ `dev` vào `release/ui-v2`) làm sau khi Sếp merge PR 1 (mục 7) |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 5) | | Bằng chứng |
|---|---|---|---|
| 1 | `inputCarriesTag` đúng QĐ-1; dùng đúng ở hai chỗ QĐ-2; điều kiện khác giữ nguyên | ✅ | mục 2.1, 2.2; 1.2 nhóm 1, 2 |
| 2 | Chú thích ba chỗ đã sửa, import đúng QĐ-3b, không đổi chữ ký hàm hay kiểu | ✅ | mục 2.2 |
| 3 | `reconcileOne`, mock, giao diện, câu chữ không đổi; diff từng hàm đổi kèm lý do an toàn | ✅ | mục 2.2, 2.3 |
| 4 | Fixture có giao dịch và biên nhận thật của giao dịch nguồn, ghi nguồn RPC | ✅ | mục 3 |
| 5 | `fix-09.test.ts` đủ nhóm 1, 2, 3, 4, 4b (4b đủ ba ca), xanh; có `endsWith` là `false` trên dữ liệu thật và ca lẻ rồi chẵn | ✅ | mục 1.2 |
| 6 | Giao dịch nguồn (revert) vẫn ra `FAILED` sau bản vá (4b ca 3) | ✅ | mục 1.2 nhóm 4b |
| 7 | Test có sẵn không sửa (QĐ-5) | ✅ | mục 6 (6a), 1.1 |
| 8 | Không còn so `endsWith` nhãn trên `input` trong `lib/` (6b) | ✅ | mục 6 |
| 9 | Kiểm thử mục 6 đạt, kèm log; "EVM - E2E PROJECT HARDHAT" xanh | ✅ | mục 1.1 |
| 10 | `fe-23-payment-withdraw` ca 14 (nút Hardhat) chạy thật, xanh, không bị bỏ qua | ✅ | mục 1.3 |
| 11 | Số action khi mở 28 đường dẫn không đổi; JS trình duyệt không đổi | ✅ | mục 4 |
| 12 | Lệnh danh sách trắng, ký tự cấm (tasks bước 6) đúng kỳ vọng | ✅ | mục 6 |
| 13 | Kế hoạch vận hành (5b), giới hạn tự sửa của QĐ-3 kèm bằng chứng unit nhóm 3; nguyên nhân revert là giả thuyết chưa xác minh | ✅ | mục 5, 7 |
| 14 | Không mã dư thừa | ✅ | mục 2.4 |

**Kết luận:** 14 ✅, 0 🔶, 0 ❌. Hai chỗ đối chiếu nhận nhãn nằm giữa calldata gói lồng (đúng ranh giới byte), giữ nguyên
chốt "người gửi giao dịch là ví gửi" và log `Transfer` VNDB khớp. Giao dịch nguồn (revert, không log) vẫn `FAILED`. Năm
lần gây lỗi có chủ đích (3 điểm của Supervisor cộng trả riêng từng chỗ đối chiếu về `endsWith`) đều làm unit đỏ; lỗi chỉ ở
adapter bị nhóm 4b (adapter thật) bắt, không chỉ phép đọc mã nguồn. JS, CSS trình duyệt giống bản `dev` từng byte (chỉ đổi
mã máy chủ). Mức rủi ro: thấp (nới đúng một điều kiện so nhãn; nhãn là `keccak256` 32 byte của mã lệnh).

**Nguyên nhân revert của giao dịch nguồn là GIẢ THUYẾT CHƯA XÁC MINH** (ví ước tính thiếu gas cho lời gọi gói); FIX-09 không
sửa lỗi revert, chỉ sửa việc nhận diện lần chuyển gói lồng THÀNH CÔNG. task-status: FIX-09 `done`.

### 0.2 Việc cần Owner quyết

- Không có. Việc sau triển khai ở mục 7 (danh sách chờ, chưa làm).

---

## 1. Kiểm thử

### 1.1 Lệnh và kết quả (requirements mục 6)

__DIEN_1_1__

### 1.2 Unit test mới `app/test/fix-09.test.ts` (môi trường `node`, 15 ca, không gọi mạng)

Một chuỗi giả trong tệp phục vụ hai lớp: ledger giả của nhóm 3 (đọc thẳng chuỗi giả, quét theo nhãn bằng `inputCarriesTag`) và
client viem giả của nhóm 4b (`vi.mock('viem')` thay `createPublicClient`, như `mock-ledger.test.ts`), để `createEvmLedger('evm', …)`
THẬT đọc `getTransaction`, `getTransactionReceipt`, `getLogs`, `getBlockNumber` từ cùng dữ liệu. `getLedger('evm')` bọc bằng
`vi.mock('@/lib/ledger')` như `fe-23-payment-withdraw.test.ts`. Ví gửi là ví của giao dịch nguồn; calldata gói lồng dựng bằng
`input` của fixture, thay nhãn nguồn bằng `paymentTag(id)` của lệnh.

| Nhóm | Kiểm |
|---|---|
| 1 `inputCarriesTag` | Calldata `transfer` nối nhãn (`paymentTransferCalldata`): `true`; nhãn ở giữa, sau có 8 byte đệm: `true`. `input` thật (3018 ký tự): `true` với nhãn nguồn, `input.endsWith(nhãn)` là `false`, nhãn khác `false`. Chỉ khớp ở vị trí lẻ: `false`; lẻ trước rồi chẵn sau: `true`. Chữ hoa, có hoặc không `0x`: như nhau; nhãn 62 hoặc 66 ký tự, không phải hex: `false`; `input` rỗng, `0x`: `false` |
| 2 `matchesTransfer` | Gói lồng, người gửi là ví gửi, log khớp: `true`; calldata thường (nhãn ở cuối): `true`; người gửi khác, log sai số lượng (99), nhãn của lệnh khác lồng bên trong: `false` |
| 3 Đối soát (ledger giả) | `SUBMITTED`, biên nhận `CONFIRMED`, gói lồng, log khớp: `COMPLETED`. Biên nhận revert: `FAILED`. Lệnh `FAILED` (đã gửi, có `sendingAt`), sau đó giao dịch gói lồng khớp lên chuỗi: mở màn ở 24 giờ trừ 1 phút thì `COMPLETED`; ở 24 giờ cộng 1 phút thì giữ `FAILED` (QĐ-3, giờ hệ thống giả). Một giao dịch mang nhãn hai lệnh cùng ví nhận, cùng số: lệnh đang gửi `COMPLETED`, lệnh `FAILED` trước đó giữ `FAILED` |
| 4 Mã nguồn | `evm.adapter.ts`, `payment-withdraw.service.ts` có `inputCarriesTag(`; thân `matchesTransfer`, `findPaymentTransferByTag` (cắt từ tên hàm tới hàm kế) không có `endsWith`; `payment-tag.ts` không có dòng `import` |
| 4b Adapter thật | **Có mã:** `paymentTransferReceipt` trả `CONFIRMED`, `input` gói lồng, `txFrom` là ví gửi, `transfers` đúng một log (giải từ topic và data); lệnh `SUBMITTED` mang mã đó thành `COMPLETED`. **Mất mã:** `findPaymentTransferByTag` trả đúng `{ txHash, blockNumber }`; cùng dữ liệu, người gửi giao dịch khác: `null`. **Giao dịch nguồn thật:** fixture (`status 0x0`, không log) cho `paymentTransferReceipt` `FAILED`, `transfers` rỗng; lệnh `SUBMITTED` mang mã nguồn đối soát xong vẫn `FAILED` |

Tự gây lỗi (sửa bản sao làm việc, chạy `fix-09` và `fe-23-payment-withdraw`, hoàn lại bằng `git checkout`):

| Điểm | Ca đỏ |
|---|---|
| S1 `inputCarriesTag` nhận vị trí lẻ | 1 (nhóm 1 lẻ rồi chẵn) |
| S2 bỏ điều kiện `txFrom` trong `matchesTransfer` | 3 (nhóm 2; `fe-23` ca 8 và hàm thuần `matchesTransfer`) |
| S3 `inputCarriesTag` về `endsWith` | 8 (nhóm 1 hai ca, nhóm 2, nhóm 3 ba ca, nhóm 4b hai ca) |
| Thêm: chỉ `findPaymentTransferByTag` về `endsWith` | 2 (nhóm 4, nhóm 4b mất mã) |
| Thêm: chỉ `matchesTransfer` về `endsWith` | 2 (nhóm 2, nhóm 4) |

### 1.3 `fe-23-payment-withdraw` ca 14 trên nút Hardhat (requirements mục 5)

```text
$ bash scripts/evm-local.sh reset
$ cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest run test/fe-23-payment-withdraw.test.ts --reporter=verbose
 ✓ … > FE-23 ca 14: nút Hardhat > A1, A8, ví gửi calldata có nhãn: chuyển thành công, số dư đúng; báo mã: COMPLETED; lệnh thứ hai không báo mã: đối soát theo nhãn COMPLETED 287ms
      Tests  28 passed | 1 skipped (29)
$ bash scripts/evm-local.sh down
```

Ca bị bỏ qua là ca 13 (Postgres, không đặt `TEST_DATABASE_URL` ở lượt này); ca 13 chạy trong bộ đầy đủ mục 1.1. Giao dịch
thường (nhãn ở cuối) vẫn hoàn tất như cũ trên chuỗi thật.

## 2. Thay đổi

### 2.1 `lib/ledger/payment-tag.ts` (mới, QĐ-1)

```ts
export function inputCarriesTag(input: string, tag: string): boolean {
  const data = input.toLowerCase().replace(/^0x/, '');
  const wanted = tag.toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{64}$/.test(wanted)) return false;
  for (let at = data.indexOf(wanted); at !== -1; at = data.indexOf(wanted, at + 1)) {
    if (at % 2 === 0) return true;
  }
  return false;
}
```

Không nhập mô-đun nào; tìm mọi lần xuất hiện, nhận lần đầu ở vị trí chẵn (đúng ranh giới byte), không đòi ranh giới 32 byte.

### 2.2 Hai chỗ đối chiếu (QĐ-2) và chú thích

`payment-withdraw.service.ts`, `matchesTransfer`:

```diff
- * Bằng chứng hoàn tất (QĐ-9): người gửi giao dịch là ví gửi, dữ liệu gọi kết thúc bằng nhãn của lệnh,
+ * Bằng chứng hoàn tất (QĐ-9): người gửi giao dịch là ví gửi, dữ liệu gọi chứa nhãn của lệnh đúng ranh giới
+ * byte (calldata có thể bị ví gói lồng, ví dụ EIP-7702; FIX-09),
   if (!same(evidence.txFrom, request.fromWallet)) return false;
-  const tag = paymentTag(request.id).slice(2).toLowerCase();
-  if (!evidence.input || !evidence.input.toLowerCase().endsWith(tag)) return false;
+  if (!evidence.input || !inputCarriesTag(evidence.input, paymentTag(request.id))) return false;
```

`evm.adapter.ts`, `findPaymentTransferByTag` (và `import { inputCarriesTag } from './payment-tag';` ngay sau `} from './ledger.port';`,
dòng 67, theo QĐ-3b):

```diff
-     * nhận khi người gửi là ví gửi và `input` kết thúc bằng nhãn. Không dựa vào khoảng khối.
+     * nhận khi người gửi là ví gửi và `input` chứa nhãn đúng ranh giới byte (calldata có thể bị ví gói lồng,
+     * ví dụ EIP-7702; FIX-09). Không dựa vào khoảng khối.
-      const wanted = tag.toLowerCase().replace(/^0x/, '');
-          if (tx.from.toLowerCase() === sender.toLowerCase() && tx.input.toLowerCase().endsWith(wanted)) {
+          if (tx.from.toLowerCase() === sender.toLowerCase() && inputCarriesTag(tx.input, tag)) {
```

`ledger.port.ts`: chú thích `findPaymentTransferByTag` đổi "`input` kết thúc bằng `tag`" thành "`input` chứa `tag` đúng ranh giới
byte (calldata có thể bị ví gói lồng, ví dụ EIP-7702; FIX-09)". Chữ ký hàm, kiểu, giá trị trả về không đổi.

Lý do an toàn (QĐ-2): (a) người gửi giao dịch phải là ví gửi, giữ nguyên ở cả hai chỗ (`txFrom`, `tx.from`): chốt chính, vì log
`Transfer` từ ví gửi vẫn có thể phát ra khi người khác gọi `transferFrom` hay một delegate gọi vào mã 7702 của ví (unit nhóm 4b
"người gửi khác: null", nhóm 2, gây lỗi S2); (b) vẫn phải có log `Transfer` của chính hợp đồng VNDB khớp ví gửi, ví nhận, số
lượng (nhóm 2 sai số lượng); (c) nhãn là `keccak256` 32 byte của mã lệnh, không trùng ngẫu nhiên, và phải đúng ranh giới byte
(gây lỗi S1); (d) một giao dịch không hoàn tất được hai lệnh: nhánh quét chặn bằng `findByCompletedTx`, nhánh `SUBMITTED` bằng
ràng buộc duy nhất `completedTxHash` (nhóm 3 ca hai lệnh).

### 2.3 Không đổi

`reconcileOne`, `scanByTag`, `complete`, `getPaymentWithdrawPage` (cửa sổ 24 giờ, 5 lệnh), `paymentTransferReceipt`,
`mock.adapter.ts` (khớp nhãn theo trường lưu riêng), giao diện, câu chữ. `fe-23-payment-withdraw.test.ts` giữ nguyên, kể cả bộ giả
lập ledger dùng `endsWith` ở dòng 91 (QĐ-5).

### 2.4 Mã dư thừa

Biến `tag` trong `matchesTransfer` và `wanted` trong `findPaymentTransferByTag` đã bỏ (chuẩn hoá nằm trong `inputCarriesTag`). Lint,
typecheck đạt.

## 3. Fixture giao dịch nguồn

`app/test/fixtures/fix-09-tx-0xbbc9.json`: `transaction` (`hash`, `from`, `to`, `type`, `blockNumber`, `input`) và `receipt`
(`status`, `gasUsed`, `blockNumber`, `logs`) của `0xbbc9c6a8…d7044eb5`, đọc bằng `eth_getTransactionByHash` và
`eth_getTransactionReceipt` qua `https://ethereum-sepolia-rpc.publicnode.com` ngày 06/11/2026 (chỉ dữ liệu công khai trên chuỗi,
không khoá). Đối chiếu tasks bước 2: `type 0x4`, `to` `0xdb9b1e94…47db3` (DelegationManager), `input` dài 3018 ký tự, nhãn
`618a1b30…a63a99981` ở byte 1.468 (một lần), sau nhãn 8 byte 0, không kết thúc bằng nhãn; `receipt.status` `0x0`, `logs` rỗng,
`gasUsed` `0x570be`.

Môi trường cloud mặc định chặn host RPC trên; đã tạo môi trường riêng `bidv-rwa-tokenize` (cá nhân, chỉ thêm đúng host này) để đọc.

## 4. JS trình duyệt và số action

Mã đổi là mã máy chủ: `payment-withdraw.service.ts`, `evm.adapter.ts` có `import 'server-only'`; giao diện (`investor-withdraw.tsx`)
chỉ nhập KIỂU từ service. Đối chiếu hai bản build (`dev` @ `2308509` build riêng `NEXT_DIST_DIR=.next-moc`, gỡ tạm `payment-tag.ts`;
bản sửa `634c997`), cùng phiên:

- JS trình duyệt: 224/224 tệp, tổng 8.743.716 và 8.743.710 B. Sau khi thay mã server action, tên băm tệp, số hiệu module bằng hằng,
  rồi thay tên biến rút gọn một hai ký tự: 222 tệp giống hệt; 2 tệp còn lệch 3 B mỗi tệp, đọc từng mảnh thấy chỉ là tên biến do
  trình rút gọn đặt khác (ví dụ `var n=e.i` và `var a=e.i`), cùng số mảnh mã. Chuỗi `inputCarriesTag`, `payment-tag`,
  `findPaymentTransferByTag`, `matchesTransfer` không có trong JS trình duyệt; số tham chiếu server action 68 và 68.
- CSS: bản sửa không có lớp nào mà bản `dev` không có. Bản `dev` thừa 5 lớp (`capitalize`, `contents`, `italic`, `static`,
  `transform`) vì build lúc thư mục build khác nằm trong `app/` (như các task trước); không phải do bản sửa.
- Số action khi mở (`tools/20261104_do_moc_measure.js` sha256 `6079a0d6…`, máy chủ mới cổng 3300, dữ liệu bằng `ops-transactions`):
  28 đường dẫn mỗi bản, không dòng `khong tim thay lien ket`, số action khớp 28/28; `hydration`, `consoleErrors`, `pageErrors` 0
  ở mọi đường dẫn cả hai bản.

`docs/tech-report.md`: hai marker `SC-04` trong `evm.adapter.ts` dời một dòng (1257 thành 1258, 1263 thành 1264) do dòng import
mới; khối tự sinh đã sinh lại bằng `node scripts/scan-pending.mjs --write-report`, `--check-report` khớp.

## 5. Giới hạn tự sửa (QĐ-3)

Lệnh bị đánh sai `FAILED`, `EXPIRED` trước bản vá CHỈ tự chuyển `COMPLETED` khi màn `/withdraw` của ví gửi được mở trong 24 giờ
kể từ `sendingAt` (`RESCAN_WINDOW_MS`), tối đa 5 lệnh cuối âm mỗi ví mỗi lần (`RESCAN_LIMIT`). Bằng chứng: unit nhóm 3, ca "lệnh
FAILED, giao dịch gói lồng khớp lên chuỗi sau": 24 giờ trừ 1 phút thì `COMPLETED`, 24 giờ cộng 1 phút thì giữ `FAILED`. Lệnh cũ hơn
xử lý ở mục 7 bước 3 (rà tay, không tự sửa cơ sở dữ liệu).

## 6. Lệnh kiểm (tasks bước 6, `LC_ALL=C`)

```text
FIX-09 tasks bước 6, HEAD 634c997, base origin/dev 2308509
== 6a
== 6b
== 6c
== hết
```

6a, 6b, 6c rỗng: chỉ tệp trong danh sách trắng, không xoá tệp; không còn so `endsWith` nhãn trên `input` trong `lib/`; dòng thêm
mới không có ký tự cấm.

## 7. Việc sau triển khai (danh sách chờ, chưa làm)

1. Sau khi Sếp merge PR 1: triển khai lại môi trường đang chạy `dev`. (chưa làm)
2. Kiểm ví trước khi thử lại (tasks bước 10a): `eth_getCode` của ví nhà đầu tư trên Sepolia; khác `0x` (thường `0xef0100` cộng
   địa chỉ hợp đồng) nghĩa là ví đang là tài khoản thông minh: chuyển về tài khoản thường trong MetaMask, chờ xác nhận, kiểm lại ra
   `0x`, rồi mới thử một lệnh rút. (chưa làm)
3. Rà lệnh cũ (tasks bước 10b): liệt kê lệnh rút VNDB `FAILED`, `EXPIRED` có `submittedTxHash` hoặc `sendingAt` từ ngày đưa rút
   VNDB lên Sepolia; đối chiếu trên chuỗi; lệnh nào tiền đã đi thì báo Supervisor trước khi sửa dữ liệu. (chưa làm)
4. Đồng bộ `dev` vào `release/ui-v2` (PR 2, tasks bước 9), chạy lại bộ kiểm đầy đủ trên nhánh đồng bộ. (chưa làm)

Không làm trong task (requirements mục 1): xác minh và sửa nguyên nhân revert; đặt `gas` từ ứng dụng; câu nhắc trong hộp xác nhận
ở giao diện; giao dịch 7702 do relayer hoặc delegate gửi (`tx.from` khác ví gửi) vẫn bị từ chối; một giao dịch gói hai lệnh chỉ
hoàn tất một lệnh.

## 8. Tự đánh giá 3 luật kiến trúc

- [x] Mọi call chain qua ILedgerPort: đọc chuỗi vẫn ở adapter EVM; service chỉ gọi qua cổng.
- [x] Mọi ký qua ISigner: không đổi (không ký gì mới).
- [x] Mọi kiểm quyền qua RBAC: không đổi.
