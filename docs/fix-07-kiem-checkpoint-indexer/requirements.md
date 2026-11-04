# FIX-07: tên checkpoint không phân biệt hoa thường, Indexer bỏ qua có chủ đích các sự kiện không theo dõi

| | |
|---|---|
| Nhánh | `fix/fix-07-kiem-checkpoint-indexer` từ `release/ui-v2` mới nhất |
| PR | Một PR, **base `release/ui-v2`** (không vào `dev` lúc này: đợt UI đang đóng băng `dev`, và `.kiro/task-status.json` sửa ở mọi PR đợt UI nên vào `dev` riêng sẽ xung đột; đi cùng đợt UI qua Cổng 3). Không tự merge |
| Loại | Backend hẹp đã được Sếp duyệt ngày 04/11: một tệp `scripts/`, một tệp `lib/ledger/` cộng một tệp mới cùng thư mục. Không đổi dữ liệu, không đổi hành vi nghiệp vụ, không đổi ABI hay hợp đồng |
| Mức kiểm thử | **C** cho phần `lib/` (phạm vi mục 5) |
| Nguồn | Nghiệm thu FE-UX-03a (04/11): script bỏ qua `CHECKPOINT_FEUX03A.md`; log Hardhat lặp lỗi giải mã sự kiện `RoleGranted` (topic `0x2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d`) và `Approval` (topic `0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925`) |

## 1. Mục tiêu

1. `scripts/check-checkpoint.mjs` tìm tệp checkpoint theo mã task KHÔNG phân biệt hoa thường (`FE-UX-03a` tìm được `CHECKPOINT_FEUX03A.md`), vẫn báo lỗi khi có nhiều tệp cùng khớp.
2. Indexer EVM bỏ qua IM LẶNG các sự kiện đã biết là không theo dõi (quản lý vai, phê duyệt chi tiêu ERC-20), và chỉ cảnh báo MỘT lần cho mỗi chain trong vòng đời tiến trình với sự kiện thật sự lạ, kèm topic để chẩn đoán.

Không làm: thêm sự kiện vào ABI rút gọn ở `packages/shared/src/abi/*` (đụng `packages`), đổi danh sách sự kiện Indexer theo dõi, đổi cách lưu sự kiện, đổi `scripts/run-local-all.sh`.

## 2. Quyết định (QĐ)

- **QĐ-1. Checkpoint không phân biệt hoa thường** (`scripts/check-checkpoint.mjs`, hàm `resolveTaskFiles`):
  - Đọc thư mục `docs/` (không dùng `existsSync` theo đúng tên: trên hệ tệp không phân biệt hoa thường nó che mất tệp trùng). Mã task được thoát ký tự đặc biệt trước khi đưa vào `RegExp`; bộ lọc `_DETAIL.md` cũng không phân biệt hoa thường (`/_DETAIL\.md$/i`).
  - Bước 1, tên gốc: tệp khớp `^CHECKPOINT_<mã bỏ gạch>\.md$` cờ `i`. Đúng một tệp thì dùng (giữ hành vi hiện tại: task có cả tệp gốc và tệp hậu tố như `CHECKPOINT_OP04.md` cùng `_PROXY.md`, `_TXS.md`, hay `CHECKPOINT_OP06.md` cùng `_CPU.md` vẫn chọn tệp gốc). Từ hai tệp (chỉ khác hoa thường) thì báo lỗi nhiều tệp, không tự chọn.
  - Bước 2, chỉ khi không có tên gốc: tệp khớp `^CHECKPOINT_<mã bỏ gạch>(_[A-Za-z0-9]+)+\.md$` cờ `i`, bỏ `_DETAIL`; đúng một thì dùng, từ hai trở lên báo lỗi như nhánh hiện có.
  - Phần tìm `requirements.md` giữ nguyên (đã dùng chữ thường).
- **QĐ-2. Danh sách sự kiện bỏ qua có chủ đích** (tệp mới `app/src/lib/ledger/evm-log-decode.ts`):
  - Hằng `IGNORED_EVENT_SIGNATURES` gồm đúng 11 chữ ký: mọi sự kiện có trong ABI đầy đủ của `ProjectToken` và `SpvPaymentVault` (`packages/shared/generated/*.abi.json`) mà ABI rút gọn (`packages/shared/src/abi/project-token.ts`: `Transfer`, `AddressFrozen`, `InitialSupplyMinted`, `Snapshot`; `spv-payment-vault.ts`: `OrderSettled`, `PeriodClosed`, `LockModeChanged`, `FixedLockSet`, `PercentRateSet`, `PayoutWalletSet`, `Withdrawn`) không có:
    `Approval(address,address,uint256)`, `ComplianceAdded(address)`, `IdentityRegistryAdded(address)`, `EIP712DomainChanged()`, `Paused(address)`, `Unpaused(address)`, `RoleGranted(bytes32,address,address)`, `RoleRevoked(bytes32,address,address)`, `RoleAdminChanged(bytes32,bytes32,bytes32)`, `TokensFrozen(address,uint256)`, `TokensUnfrozen(address,uint256)`.
  - Tập topic tính bằng `toEventSelector` của viem lúc nạp mô-đun (không chép tay mã hex), so sánh chữ thường. Danh sách viết tay trong mã (không đọc tệp `generated` lúc chạy); unit test đối chiếu với ABI đầy đủ và ABI rút gọn để phát hiện lệch khi ABI đổi.
  - Lý do: hợp đồng phát các sự kiện quản trị này (AccessControl, Pausable, ERC-20, gắn IdentityRegistry, Compliance lúc triển khai) nhưng nghiệp vụ hiện không đọc. Đưa sự kiện nào vào theo dõi sau này thì sửa ABI rút gọn và gỡ khỏi danh sách (test bước 1 sẽ báo).
- **QĐ-3. Hàm thuần giải mã** (cùng tệp mới): `decodeEvmLogs(logs, scope, chain)` nhận mảng log thô của viem và `{ vault, token }`, trả mảng `LiveIndexedEvent`. Nội dung là vòng lặp hiện có ở `evm.adapter.ts` (`fetchLogs`, khoảng dòng 675 tới 700) DỜI NGUYÊN VĂN, cộng hai thay đổi:
  1. Trước khi giải mã: log không có `topics[0]` thì xử lý như log không giải mã được (cảnh báo một lần); log có `topics[0]` thuộc tập QĐ-2 thì `continue`, không cảnh báo.
  2. Cờ cảnh báo một lần chuyển từ biến cục bộ của adapter (`let warnedUndecodableLog`, hiện bị tạo lại mỗi lần dựng adapter nên lặp cảnh báo) sang tập mức mô-đun theo `chain` (Next có thể nạp mô-đun riêng theo từng lớp, nên "một lần" là một lần mỗi chain mỗi bản nạp mô-đun; vẫn giảm từ mỗi lần dựng adapter xuống vài lần); câu cảnh báo giữ nguyên chữ, thêm topic đầu (`topics[0]`) và địa chỉ hợp đồng vào cuối.
  - `serializeEventArgs`, `normalizeEvmAddress`, cách chọn ABI theo địa chỉ, điều kiện bỏ log thiếu `blockNumber`, `logIndex`, `transactionHash`, và thứ tự sắp kết quả giữ nguyên (dời theo nếu cần, nguyên văn).
  - `evm.adapter.ts` gọi `decodeEvmLogs`; không đổi phần còn lại của `fetchLogs` (chia đoạn block, `getLogs`, địa chỉ lọc).
- **QĐ-4. Không đổi hành vi nghiệp vụ:** tập sự kiện Indexer lưu trước và sau phải giống hệt (4 sự kiện bỏ qua vốn đã bị bỏ do giải mã lỗi). Không đổi `IndexedEventArgs`, không đổi kho sự kiện.

- **QĐ-5. Giữ `strict: false` khi giải mã (ghi nợ, không sửa ở FIX-07).** Dev phát hiện 04/11: với `strict: false`, log của sự kiện đang theo dõi mà `data` hỏng vẫn được giải mã thành sự kiện thiếu tham số (ví dụ `Transfer` thiếu `value`) và được lưu, không cảnh báo. Đổi sang `strict: true` hay thêm phép kiểm tham số đều đổi tập sự kiện Indexer lưu: nếu ABI rút gọn lệch hợp đồng đã triển khai (ví dụ trên Sepolia) thì có thể mất sự kiện thật, ảnh hưởng danh sách người nhận chia lợi nhuận. Vì vậy FIX-07 giữ nguyên, ca 5b ghi lại hành vi hiện tại. Nợ kỹ thuật: task sau kiểm trên Sepolia có sự kiện thiếu tham số hay không, rồi mới chọn `strict: true` hoặc kiểm tham số, có e2e Hardhat và đối chiếu dữ liệu đã lưu.

## 3. Phạm vi tệp (danh sách trắng)

| Được sửa | Ghi chú |
|---|---|
| `scripts/check-checkpoint.mjs` | Chỉ `resolveTaskFiles` và hàm phụ nếu cần (QĐ-1) |
| `app/src/lib/ledger/evm.adapter.ts` | Chỉ phần giải mã trong `fetchLogs` và xoá `warnedUndecodableLog` (QĐ-3) |
| `app/src/lib/ledger/evm-log-decode.ts` (mới) | QĐ-2, QĐ-3 |
| `app/test/check-checkpoint.test.ts` | Chỉ THÊM ca trong khối "Suy tên tệp từ mã task" |
| `app/test/fix-07-evm-log-decode.test.ts` (mới) | Design mục 2 |
| `docs/fix-07-kiem-checkpoint-indexer/{requirements,design,tasks}.md`, `docs/CHECKPOINT_FIX07.md`, `.kiro/task-status.json` | Theo quy ước repo |

Cấm mọi tệp khác, gồm `packages/**`, `scripts/run-local-all.sh`, các tệp `lib/` khác, mọi tệp giao diện.

## 4. Điều kiện hoàn thành

- [ ] `resolveTaskFiles` đúng QĐ-1; 4 ca mới trong `check-checkpoint.test.ts` (design mục 1) xanh, ca cũ không đổi.
- [ ] Trên repo thật, `node -e` gọi `resolveTaskFiles(repo, 'FE-UX-03a')` trả `docs/CHECKPOINT_FEUX03A.md`, và `resolveTaskFiles(repo, 'OP-04')` vẫn trả `docs/CHECKPOINT_OP04.md` (ghi lệnh và kết quả trong checkpoint; không sửa tạm `task-status.json`).
- [ ] `evm-log-decode.ts` đúng QĐ-2, QĐ-3; diff `evm.adapter.ts` chỉ là dời vòng lặp và xoá cờ cục bộ (checkpoint dán đoạn trước và sau để đối chiếu từng dòng).
- [ ] Unit test mới đủ các ca design mục 2, xanh; topic tính ra của `RoleGranted` và `Approval` bằng đúng hai topic ghi ở bảng đầu.
- [ ] Log phần `evm` (e2e Hardhat) KHÔNG còn dòng "bỏ log không giải mã được" (`grep -c` ra 0, dán vào checkpoint); 26 ca Hardhat đạt như trước.
- [ ] Không đổi hành vi nghiệp vụ (QĐ-4): toàn bộ e2e mock và Hardhat xanh; `test/indexer-sync.test.ts` xanh không sửa.
- [ ] Lệnh danh sách trắng (tasks bước 5) rỗng; `scripts/verify-arch-rules.sh` đạt.
- [ ] Checkpoint ghi phạm vi "backend hẹp, Sếp duyệt 04/11", danh sách tệp, kết quả kiểm.

## 5. Phạm vi kiểm thử

| Ai | Chạy |
|---|---|
| Dev | Thêm `FIX-07` vào `.kiro/task-status.json` trước khi chạy `markers`. `bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm` một lần (không `contracts`), lưu log; gửi riêng đoạn log từ "EVM - E2E PROJECT HARDHAT" tới hết, kèm `grep -c "không giải mã được"` của đoạn đó |
| Supervisor | Đọc diff 3 tệp mã; chạy `check-checkpoint.test.ts`, `fix-07-evm-log-decode.test.ts`, `indexer-sync.test.ts`; gây lỗi có chủ đích 3 điểm (bỏ cờ `i`; bỏ `Approval` khỏi danh sách; đưa cờ cảnh báo về biến cục bộ trong `decodeEvmLogs`); đọc đoạn log EVM |
