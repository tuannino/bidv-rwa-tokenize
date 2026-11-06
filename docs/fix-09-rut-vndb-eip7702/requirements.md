# FIX-09: nhận đúng lệnh rút VNDB khi MetaMask gói giao dịch (EIP-7702)

| | |
|---|---|
| Nhánh | `fix/fix-09-rut-vndb-eip7702` từ `dev` mới nhất (@ `2308509` hoặc sau). **Sửa thẳng vào `dev`** (Sếp duyệt 06/11, lỗi đang gặp trên Sepolia), không đi qua `release/ui-v2` |
| PR | PR 1: base **`dev`**. Sau khi PR 1 merge: PR 2 đồng bộ `dev` vào `release/ui-v2` (tasks bước 9). Không tự merge PR nào |
| Loại | Backend, chỉ đọc và đối chiếu (Sếp duyệt đụng `lib/` 06/11). Không đổi schema, hợp đồng, quyền, action, giao diện, câu chữ người dùng thấy; không thêm gói npm |
| Mức kiểm thử | **B**, phạm vi ở mục 5 |
| Nguồn | Sự cố 06/11: giao dịch Sepolia `0xbbc9c6a83e63f92c06aea9b94f8e9d5d8c57fd9231eb0c8bdb283832d7044eb5` (rút 1.000 VNDB); phân tích của trợ lý Sếp gửi; Supervisor đọc giao dịch trên chuỗi và mã `dev` |
| Thứ tự ưu tiên khi nguồn xung đột | Spec này, rồi mã `dev` @ merge-base, rồi `docs/fe-23-*` (thiết kế rút VNDB gốc) |

## 1. Bối cảnh và mục tiêu

Ứng dụng gửi cho ví nhà đầu tư một lệnh `transfer` VNDB với calldata nối thêm 32 byte nhãn lệnh (`paymentTransferCalldata`, FE-23 QĐ-12). MetaMask có thể tự chuyển ví sang tài khoản thông minh (EIP-7702) và gói lệnh đó vào `DelegationManager.redeemDelegations`: giao dịch type 4, gửi từ chính ví nhà đầu tư, `to` là DelegationManager, calldata của ta nằm trong dữ liệu ABI lồng nhau. Ở giao dịch nguồn, nhãn `618a1b300552bd77f7984a017b4933cc41d8d9c3fd23db23dff2154a63a99981` nằm tại byte 1.468, sau nhãn còn 8 byte 0 (đệm ABI). Biên nhận `status=0x0`, không có log nào: lần chuyển đó THẤT BẠI, không có `Transfer` VNDB.

ĐÃ XÁC NHẬN (đọc trực tiếp giao dịch qua RPC Sepolia): điều kiện "kết thúc bằng nhãn" không nhận calldata gói kiểu này. GIẢ THUYẾT CHƯA XÁC MINH: nguyên nhân revert là ví ước tính thiếu gas (RPC công khai không hỗ trợ trace; phân tích mô phỏng của trợ lý chưa được Supervisor tái lập). Trường hợp "giao dịch gói thành công, tiền đã đi nhưng bị đánh FAILED" chưa xảy ra trên dữ liệu thật; đây là hệ quả suy ra từ mã, task này phòng trước.

Hai chỗ đối chiếu đòi `input` **kết thúc bằng** nhãn: `matchesTransfer` (`payment-withdraw.service.ts:179`) và `findPaymentTransferByTag` (`evm.adapter.ts:1619`). Vì vậy nếu một lần chuyển gói kiểu này THÀNH CÔNG, tiền đã sang ví nhận, đối soát vẫn sẽ đánh `FAILED` hoặc `EXPIRED`: nhà đầu tư có thể lập lệnh mới và chuyển thêm lần nữa.

Mục tiêu: hệ thống nhận đúng lần chuyển của lệnh dù calldata đứng riêng hay được ví gói lồng, mà không nới các điều kiện an toàn khác.

Không làm (ghi rõ trong checkpoint): xác minh và sửa nguyên nhân revert của giao dịch nguồn (giả thuyết thiếu gas phía ví, chưa xác minh; FIX-09 KHÔNG cam kết giải quyết lỗi revert, chỉ sửa việc nhận diện giao dịch gói thành công; giao dịch revert thì đối soát hiện tại đã đánh `FAILED` đúng và vẫn phải như vậy sau bản vá); đặt `gas` từ phía ứng dụng (đặt sẵn gas cho lệnh `transfer` thường có thể làm giao dịch gói còn thiếu gas hơn, chưa thử được trên ví thật); câu nhắc trong hộp xác nhận ở giao diện (tệp giao diện ở `dev` đã khác hẳn `release/ui-v2`, sẽ làm ở nhánh giao diện nếu Sếp cần); giao dịch 7702 do relayer hoặc delegate gửi (`tx.from` khác ví gửi, ví dụ khi ví bật tài trợ gas) vẫn bị từ chối như hiện nay, vì điều kiện `txFrom` là chốt an toàn chính; một giao dịch gói HAI lệnh cùng ví nhận, cùng số lượng (nhãn A và B): A hoàn tất, B vẫn bị chặn bởi ràng buộc duy nhất `completedTxHash` và ở trạng thái cũ (ca hợp lệ bị chặn, không phải lỗ hổng: một giao dịch không hoàn tất được hai lệnh).

## 2. Quyết định (QĐ)

- **QĐ-1. Hàm kiểm nhãn dùng chung (tệp mới, thuần):** `app/src/lib/ledger/payment-tag.ts` export `inputCarriesTag(input: string, tag: string): boolean`:
  - Chuẩn hoá: chữ thường, bỏ tiền tố `0x` ở cả hai; `tag` phải đúng 64 ký tự hex, sai thì `false`.
  - `true` khi `tag` xuất hiện trong `input` tại một vị trí CHẴN, chỉ số tính trên chuỗi đã bỏ `0x` (đúng ranh giới byte; khớp lệch nửa byte không tính). KHÔNG đòi ranh giới 32 byte: trong giao dịch nguồn nhãn lệch 4 byte so với word ABI vì calldata lồng có selector đứng trước. Tìm mọi lần xuất hiện, không chỉ lần đầu.
  - Không nhập gì ngoài kiểu; không phụ thuộc viem.
- **QĐ-2. Dùng hàm ở hai chỗ đối chiếu, giữ nguyên mọi điều kiện khác:**
  - `matchesTransfer`: thay `evidence.input.toLowerCase().endsWith(tag)` bằng `inputCarriesTag(evidence.input, paymentTag(request.id))`. GIỮ: `txFrom` phải là ví gửi; phải có log `Transfer` VNDB khớp đủ ví gửi, ví nhận, số lượng.
  - `findPaymentTransferByTag` (`evm.adapter.ts`): thay `tx.input.toLowerCase().endsWith(wanted)` bằng `inputCarriesTag(tx.input, tag)`. GIỮ: lọc log `Transfer` theo ví gửi, ví nhận, số lượng; `tx.from` là ví gửi; ứng viên đầu tiên theo khối.
  - Chú thích ở ba chỗ (`payment-withdraw.service.ts:169`, `evm.adapter.ts:1580`, `ledger.port.ts:384`) sửa từ "kết thúc bằng nhãn" thành "chứa nhãn đúng ranh giới byte (calldata có thể bị ví gói lồng, ví dụ EIP-7702)". Không đổi chữ ký hàm, kiểu, giá trị trả về.
  - Lý do an toàn: (a) người gửi giao dịch (`txFrom`, `tx.from`) phải là ví gửi, giữ nguyên: đây là chốt chính, vì log `Transfer` từ ví gửi vẫn có thể phát ra khi người khác gọi `transferFrom` hay một delegate gọi vào code 7702 của ví; (b) nhãn là `keccak256` của mã lệnh (32 byte), không trùng ngẫu nhiên; (c) một giao dịch không hoàn tất được hai lệnh: nhánh quét chặn bằng `findByCompletedTx` (`payment-withdraw.service.ts:284-285`), nhánh `SUBMITTED` chặn bằng ràng buộc duy nhất `completedTxHash` trong `complete()` (`:241-253`).
- **QĐ-3. Không đổi luồng đối soát.** `reconcileOne` giữ nguyên. Nhánh lệnh âm (`FAILED`, `EXPIRED`, … có `sendingAt`) quét lại theo nhãn khi đối soát (`payment-withdraw.service.ts:323-326`), nhưng `getPaymentWithdrawPage` chỉ quét lại lệnh âm có `sendingAt` trong 24 giờ, tối đa 5 lệnh mỗi ví (`RESCAN_WINDOW_MS`, `RESCAN_LIMIT`, `:46-47`). Vì vậy lệnh bị đánh sai CHỈ tự chuyển `COMPLETED` nếu màn `/withdraw` được mở trong 24 giờ kể từ `sendingAt`. Lệnh cũ hơn: bước vận hành ở tasks bước 10 (liệt kê, đối soát tay). Unit nhóm 3 khoá hành vi trong cửa sổ.
- **QĐ-3b. Vị trí import:** trong `evm.adapter.ts`, dòng `import { inputCarriesTag } from './payment-tag';` đặt ngay sau `} from './ledger.port';` (khối import, dòng 66 ở `dev`), không đặt cạnh `./address` (ở `release/ui-v2` FIX-07 đã chèn import mới ngay đó, đặt cạnh sẽ xung đột khi đồng bộ).
- **QĐ-4. Mock không đổi.** `mock.adapter.ts` khớp nhãn theo trường lưu riêng, không đọc calldata; không sửa.
- **QĐ-5. Test có sẵn giữ nguyên** (`fe-23-payment-withdraw.test.ts` và các e2e rút VNDB). Bộ giả lập ledger trong `fe-23-payment-withdraw.test.ts:82-93` (dòng 91) vẫn dùng `endsWith` là chủ ý của test đó (giả lập dữ liệu thường), không sửa; hành vi mới kiểm ở tệp test mới.

## 3. Phạm vi tệp (danh sách trắng)

| Được sửa | Ghi chú |
|---|---|
| `app/src/lib/ledger/payment-tag.ts` (mới) | QĐ-1 |
| `app/src/lib/ledger/evm.adapter.ts` | CHỈ `findPaymentTransferByTag` và dòng import, QĐ-2 |
| `app/src/lib/bank/payment-withdraw.service.ts` | CHỈ `matchesTransfer`, chú thích ngay trên, dòng import, QĐ-2 |
| `app/src/lib/ledger/ledger.port.ts` | CHỈ chú thích `findPaymentTransferByTag`, QĐ-2 |
| `app/test/fix-09.test.ts`, `app/test/fixtures/fix-09-tx-0xbbc9.json` (mới) | Mục 4 |
| `docs/tech-report.md` | CHỈ khi số dòng marker dời, chỉ đổi khối tự sinh bằng `node scripts/scan-pending.mjs --write-report` |
| `docs/fix-09-rut-vndb-eip7702/{requirements,tasks}.md`, `docs/CHECKPOINT_FIX09.md`, `.kiro/task-status.json` | Theo quy ước repo |

Cấm mọi tệp khác (gồm giao diện, `docs/USER_GUIDE.md`: tránh xung đột khi đồng bộ sang `release/ui-v2`).

## 4. Kiểm thử mới (`app/test/fix-09.test.ts`, môi trường `node`)

Dữ liệu thật: `app/test/fixtures/fix-09-tx-0xbbc9.json` lưu `transaction` (`from`, `to`, `type`, `input`, lấy bằng `eth_getTransactionByHash`) và `receipt` (`status`, `logs`, `gasUsed`, lấy bằng `eth_getTransactionReceipt`) của giao dịch nguồn trên Sepolia (tasks bước 2; ghi nguồn RPC trong checkpoint). Không gọi mạng trong test.

1. **`inputCarriesTag`:** calldata `transfer` nối nhãn ở cuối: `true`; nhãn ở giữa, sau có byte đệm: `true`; `input` thật của giao dịch nguồn với nhãn `0x618a…99981`: `true`, đồng thời `input.endsWith(nhãn)` là `false` (khoá đúng lý do sự cố); nhãn khác: `false`; nhãn chỉ khớp ở vị trí lẻ (dịch một ký tự hex): `false`; nhãn xuất hiện lần đầu ở vị trí lẻ, lần sau ở vị trí chẵn: `true` (khoá yêu cầu tìm mọi lần xuất hiện); chữ hoa, có hoặc không `0x`: kết quả như nhau; `tag` không đủ 64 ký tự hex: `false`; `input` rỗng hoặc `0x`: `false`.
2. **`matchesTransfer`:** với `request` có `id` sao cho `paymentTag(id)` là nhãn kiểm (dựng `request.id` giả và calldata giả mang `paymentTag(id)` lồng trong khung giống giao dịch nguồn: bọc giữa dữ liệu khác và có đệm sau): `txFrom` là ví gửi, log `Transfer` khớp: `true`; `txFrom` khác: `false`; log sai số lượng: `false`; nhãn của lệnh khác lồng bên trong: `false`; calldata thường (nhãn ở cuối) vẫn `true` như cũ.
3. **Đối soát (dựng như `fe-23-payment-withdraw.test.ts`, ledger giả có `paymentTransferReceipt`, `findPaymentTransferByTag` dùng `inputCarriesTag`):** lệnh `SUBMITTED` mà biên nhận `CONFIRMED`, calldata gói lồng, log khớp: thành `COMPLETED`; lệnh đã `FAILED` (có `sendingAt` trong 24 giờ) mà trên chuỗi có giao dịch gói lồng khớp: lần đối soát sau thành `COMPLETED` (QĐ-3); biên nhận `FAILED` (revert như giao dịch nguồn): vẫn `FAILED`; một giao dịch gói hai lệnh A, B cùng ví nhận, cùng số lượng: A `COMPLETED`, B giữ trạng thái cũ (mục 1 "Không làm").
4b. **Adapter thật, BẮT BUỘC** (không được bỏ; hai chỗ cùng lỗi nên phải chứng minh mã production đã sửa, không chỉ service với ledger giả): dựng `createEvmLedger(...)` với `reader`, `logReader` giả (theo cách dựng adapter trong test có sẵn của repo; không có thì giả `getTransaction`, `getTransactionReceipt`, `getLogs`, `getBlockNumber`). Ba ca:
   - **Có mã giao dịch:** `getTransaction` trả `from` là ví gửi và `input` gói lồng mang nhãn lệnh (dựng theo khuôn `input` của fixture), `getTransactionReceipt` trả `status: 'success'` và log `Transfer` của hợp đồng VNDB khớp: `paymentTransferReceipt` trả `CONFIRMED` với `input`, `transfers` đúng; đưa kết quả vào đối soát lệnh `SUBMITTED` thì thành `COMPLETED`.
   - **Mất mã:** `getLogs` trả log `Transfer` khớp, `getTransaction` trả dữ liệu như trên: `findPaymentTransferByTag` trả đúng mã giao dịch; cùng dữ liệu nhưng `from` khác: `null`.
   - **Giao dịch nguồn thật:** `getTransaction`, `getTransactionReceipt` trả đúng dữ liệu fixture (`status` revert, không log): `paymentTransferReceipt` trả `FAILED`; lệnh `SUBMITTED` mang mã đó, đối soát xong vẫn `FAILED` (bản vá không nhận nhầm thành công).
4. **Mã nguồn:** `evm.adapter.ts` và `payment-withdraw.service.ts` có `inputCarriesTag(`; thân `matchesTransfer` và `findPaymentTransferByTag` (cắt theo tên hàm tới hàm kế) không chứa `endsWith`; `payment-tag.ts` không nhập mô-đun ngoài.

## 5. Điều kiện hoàn thành (trước khi merge PR 1)

- [ ] `inputCarriesTag` đúng QĐ-1; dùng đúng ở hai chỗ QĐ-2; mọi điều kiện khác của hai chỗ giữ nguyên.
- [ ] Chú thích ở ba chỗ QĐ-2 đã sửa, import đúng QĐ-3b, không đổi chữ ký hàm hay kiểu.
- [ ] `reconcileOne`, mock, giao diện, câu chữ không đổi (QĐ-3, QĐ-4); checkpoint dán diff từng hàm đổi kèm lý do an toàn.
- [ ] Fixture có cả giao dịch và biên nhận thật của giao dịch nguồn (mục 4), ghi nguồn RPC.
- [ ] Unit `fix-09.test.ts` đủ nhóm 1, 2, 3, 4, 4b (4b bắt buộc, đủ ba ca), xanh; có phép kiểm `endsWith` là `false` trên dữ liệu thật và ca nhãn lẻ rồi chẵn.
- [ ] Giao dịch nguồn (revert) vẫn ra `FAILED` sau bản vá (nhóm 4b ca 3).
- [ ] Test có sẵn không sửa (QĐ-5).
- [ ] Không còn so `endsWith` nhãn trên `input` trong `lib/` (tasks bước 6b).
- [ ] Kiểm thử đúng mục 6, đạt, kèm log; có mục "EVM - E2E PROJECT HARDHAT" xanh.
- [ ] `fe-23-payment-withdraw.test.ts` ca 14 (nút Hardhat, `describe.skipIf(!HARDHAT_RPC)`, dòng 640) chạy thật (`run-local-all.sh` không đặt `TEST_HARDHAT_RPC` nên chạy riêng: `bash scripts/evm-local.sh reset`, rồi trong `app/`: `TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest run test/fe-23-payment-withdraw.test.ts`, rồi `bash scripts/evm-local.sh down`), xanh và KHÔNG bị bỏ qua (log có dòng ca 14 passed): giao dịch thường vẫn hoàn tất như cũ.
- [ ] Số action khi mở 28 đường dẫn không đổi; JS trình duyệt không đổi (chỉ đổi mã máy chủ).
- [ ] Lệnh danh sách trắng, ký tự cấm (tasks bước 6) đúng kỳ vọng.
- [ ] Checkpoint có kế hoạch vận hành (mục 5b) và ghi rõ giới hạn tự sửa của QĐ-3 kèm bằng chứng unit nhóm 3; ghi rõ nguyên nhân revert là giả thuyết chưa xác minh.
- [ ] Không mã dư thừa.

## 5b. Việc sau triển khai (theo dõi riêng, KHÔNG thuộc điều kiện trên, KHÔNG đánh dấu xong trước khi làm thật)

Ghi trong checkpoint dưới dạng danh sách chờ (không dùng ô `- [ ]` để công cụ kiểm checkpoint không đếm), cập nhật khi làm xong:

1. Sau khi Sếp merge PR 1: triển khai lại môi trường đang chạy `dev`.
2. Kiểm ví trước khi thử lại (tasks bước 10a): giao dịch 7702 revert vẫn có thể đã gắn delegation (authorization xử lý trước phần thực thi); xác nhận trạng thái mã của ví trên chuỗi rồi mới thử một lệnh rút trên Sepolia.
3. Rà lệnh cũ (tasks bước 10b).
4. Đồng bộ `dev` vào `release/ui-v2` (PR 2, tasks bước 9), chạy lại bộ kiểm đầy đủ trên nhánh đồng bộ.

## 6. Phạm vi kiểm thử

| Ai | Chạy | Không chạy |
|---|---|---|
| Dev | `bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm` một lần trên nhánh PR 1, lưu log; PR 2 chạy lại đúng lệnh này trên nhánh đồng bộ. Gửi riêng đoạn log từ "EVM - E2E PROJECT HARDHAT" tới hết | `contracts` |
| Supervisor | Đọc diff; chạy `fix-09`, `fe-23-payment-withdraw`, e2e `investor-withdraw`; gây lỗi có chủ đích 3 điểm (cho `inputCarriesTag` nhận vị trí lẻ; bỏ điều kiện `txFrom` trong `matchesTransfer`; đổi `inputCarriesTag` về `endsWith`) | Full suite |
