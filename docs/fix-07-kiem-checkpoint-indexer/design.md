# FIX-07: thiết kế và kiểm thử

## 1. Ca mới trong `app/test/check-checkpoint.test.ts` (khối "Suy tên tệp từ mã task")

Dựng thư mục tạm như các ca hiện có trong khối đó.

| Ca | Dữ liệu | Kỳ vọng |
|---|---|---|
| a | `docs/CHECKPOINT_FEUX03A.md`, spec `docs/fe-ux-03a-x/requirements.md`; gọi `resolveTaskFiles(root, 'FE-UX-03a')` | `ok: true`, `checkpoint` là `docs/CHECKPOINT_FEUX03A.md` |
| b | Hai tệp `docs/CHECKPOINT_FEUX03a.md` và `docs/CHECKPOINT_FEUX03A.md` (trên hệ tệp phân biệt hoa thường) | Gọi với `FE-UX-03a`: `ok: false`, `thieuCheckpoint: false`, `reason` nêu cả hai tệp (không có đường nhanh, QĐ-1). Trên hệ tệp không phân biệt hoa thường không tạo được hai tệp này: bỏ qua ca bằng `it.skipIf` có điều kiện kiểm hệ tệp, ghi lý do |
| c | Chỉ có `docs/CHECKPOINT_FEUX03A_V2.md`; gọi với `FE-UX-03a` | `ok: true`, tìm được tệp hậu tố khi không có tên gốc (ca này đỏ trên mã hiện tại) |
| d | `docs/CHECKPOINT_OP04.md`, `_PROXY.md`, `_TXS.md`; gọi với `OP-04` | `ok: true`, chọn tệp gốc `CHECKPOINT_OP04.md` (giữ hành vi hiện tại) |

## 2. `app/test/fix-07-evm-log-decode.test.ts`

Log giả dựng bằng helper viết trong chính tệp test (không thêm dependency; viem 2.56.3 đang cài KHÔNG export `encodeEventLog`): `topics` dựng bằng `encodeEventTopics({ abi, eventName, args })`, `data` dựng bằng `encodeAbiParameters` từ các tham số không `indexed` của sự kiện; ABI lấy từ `packages/shared/generated/*.abi.json` (chỉ đọc trong test) cho sự kiện bỏ qua, và ABI rút gọn đang dùng cho sự kiện đang theo dõi. Log giả có đủ `address`, `blockNumber`, `logIndex`, `transactionHash`.

| Ca | Kiểm |
|---|---|
| 1 | `toEventSelector` của `RoleGranted(bytes32,address,address)` và `Approval(address,address,uint256)` bằng đúng hai topic ở bảng đầu requirements; tập bỏ qua có đúng 11 phần tử; tập đó BẰNG (sự kiện ABI đầy đủ `ProjectToken` hợp `SpvPaymentVault`) trừ (sự kiện ABI rút gọn), so theo chữ ký |
| 2 | Một log `Transfer` của token và một log sự kiện vault đang theo dõi (ví dụ `Withdrawn`): `decodeEvmLogs` trả 2 sự kiện, so với giá trị mong đợi SAU CHUẨN HOÁ viết tường minh trong test (không so với kết quả thô của `decodeEventLog`): `contract` là địa chỉ checksum, `eventName`, `blockNumber`, `logIndex`, `txHash`, và `args` gồm số tiền dạng chuỗi thập phân (`'1000000000000000000'`), địa chỉ checksum (`normalizeEvmAddress`), chuỗi hex khác chữ thường. Đây là bằng chứng dữ liệu Indexer lưu không đổi |
| 3 | Một log cho mỗi sự kiện trong 11 chữ ký (dựng từ ABI đầy đủ): đều bị bỏ, `console.warn` (spy) không được gọi |
| 4 | Log có topic lạ: bỏ, `console.warn` gọi đúng 1 lần, câu chứa topic và địa chỉ; gọi `decodeEvmLogs` lần hai cùng chain với topic lạ khác: không cảnh báo thêm; gọi với chain khác: cảnh báo thêm 1 lần |
| 5 | Log thiếu `blockNumber`, thiếu `logIndex`, hoặc thiếu `transactionHash` (ba log riêng): đều bị bỏ như hiện tại, không cảnh báo. Log không có `topics[0]`: bị bỏ, cảnh báo theo quy tắc một lần |
| 5b | Log có topic của sự kiện ĐANG THEO DÕI (`Transfer` của token và một sự kiện vault) nhưng `data` hỏng (cắt ngắn hoặc sai độ dài): bị bỏ và cảnh báo theo quy tắc một lần (không bị coi là sự kiện bỏ qua có chủ đích); câu cảnh báo chứa topic của `Transfer` |
| 6 | Kết quả sắp theo `blockNumber` rồi `logIndex` như hiện tại |

Tập cảnh báo mức mô-đun cô lập giữa các ca bằng `vi.resetModules()` rồi nạp lại mô-đun (`await import(...)`) trong từng ca; KHÔNG xuất hàm đặt lại riêng cho test trong mã production.
