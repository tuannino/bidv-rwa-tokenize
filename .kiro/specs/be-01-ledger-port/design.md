# BE-01 — Mở rộng ILedgerPort: design

Spec giao việc: `docs/be-01-ledger-port/design.md`. Tài liệu này ghi **quyết định đã thực
hiện** và những chỗ phải tự quyết vì spec giao việc không nói tới.

## 1. Quyết định từ spec giao việc — đã làm đúng

| Mã | Quyết định | Kết quả |
|---|---|---|
| QĐ-1 | Tách interface theo nghiệp vụ, hợp bằng kế thừa kiểu | 7 interface con trong `ledger.port.ts`; `ILedgerPort` giữ nguyên tên, **0 lời gọi phải sửa** |
| QĐ-2 | Không có method liệt kê người nắm giữ | Không thêm. Lý do viết vào mã + `tech-report` + `lessons` |
| QĐ-3 | Chia lô do tầng nghiệp vụ quyết định | `distributeBatch(snapshotId, wallets)` nhận sẵn danh sách; adapter không tự chia |
| QĐ-4 | Báo giá không gọi nguồn tỷ giá | `quotePurchase` chỉ nhân `wptAmount * wptPriceVnd` |
| QĐ-5 | `canTransfer` trả đối tượng có lý do | `TransferCheck = { allowed: true } \| { allowed: false; reason: string }` |
| QĐ-6 | Không để kiểu `viem` lọt ra interface | Địa chỉ là `string`, số lượng là `bigint`; `ledger.port.ts` không import `viem` |

Bảy interface con: `ILedgerCompliance`, `ILedgerIssuance`, `ILedgerPurchase`,
`ILedgerSnapshot`, `ILedgerDistribution`, `ILedgerSettlement`, `ILedgerRead`.
Kiểu đi kèm: `TransferCheck`, `SnapshotResult` (`{ tx, snapshotId }`).

## 2. Quyết định Kiro phải tự đưa ra (spec giao việc không nói)

### QĐ-K1: `takeSnapshot` là method ghi duy nhất tự chờ receipt

Mọi method ghi khác trả `PENDING` để người gọi tự `waitReceipt`. `takeSnapshot` không làm
được vậy: mã snapshot chỉ nằm trong event `Snapshot` của receipt, nên trả `PENDING` là trả
về một `SnapshotResult` không có `snapshotId`.

Đã loại hai cách khác, cả hai đều sai âm thầm:
- **Đọc giá trị trả về của `snapshot()`** — hàm ghi không trả dữ liệu qua `eth_sendTransaction`.
- **Gọi `getCurrentSnapshotId()` sau khi gửi** — tx snapshot của người khác có thể chen vào
  giữa hai lời gọi và ta lấy về mã của họ, rồi chia lợi nhuận theo ảnh chụp sai.

Hết thời gian chờ receipt thì báo lỗi kèm tx hash và nhắc "tra lại tx này trước khi chốt
lần nữa" — chốt hai lần vì tưởng lần đầu thất bại là hỏng nặng hơn.

### QĐ-K2: mock chốt quỹ chia của kỳ tại thời điểm `takeSnapshot`

`distributeBatch(snapshotId, wallets)` không có tham số số tiền, nên tử số phải là trạng
thái gắn với snapshot. Mock lưu `distributable = số dư ví lợi nhuận tại thời điểm chốt`.

Nếu lấy số dư **hiện thời** làm tử số thì lô thứ hai tính ra phần nhỏ hơn lô thứ nhất (vì
lô một đã rút quỹ) — cùng một quyền lại nhận khác nhau. Contract thật cũng chốt `amount`
một lần trong `createDistribution`.

Kèm theo: mỗi ví nhận **tối đa một lần** mỗi kỳ (`paid: Set`), tương đương `hasClaimed`;
và ví trùng trong cùng một lô được gộp **trước khi tính** — danh sách do nghiệp vụ dựng từ
DB nên trùng là chuyện có thật.

### QĐ-K3: `seedMockLedger()` — đường nạp riêng, không đưa vào `ILedgerPort`

VNDB, mức ủy quyền và quỹ lợi nhuận do hệ thống khác sinh ra (core banking phát hành VNDB,
nhà đầu tư `approve` từ ví của họ, kế toán chuyển tiền vào ví lợi nhuận). `ILedgerPort` chỉ
**đọc** chúng. Nhưng mock cần một đường nạp, nếu không thì không test được.

Đã thêm `seedMockLedger(seed)` trong `mock.adapter.ts`, ghi rõ chỉ dành cho test/demo,
**không** có ở `evm.adapter`. Xem câu hỏi mở 1 trong checkpoint.

### QĐ-K4: giá WPT mặc định của mock là 100.000 VNDB, không phải 0

Giá 0 làm `quotePurchase` trả 0 và khớp lệnh thành "mua không mất tiền" — mock dễ tính hơn
contract thật ở đúng chỗ dễ sai nhất.

### QĐ-K5: tất toán chặn gì, không chặn gì

R6.3 chỉ nói "chuyển nhượng thông thường". Đã chọn:

| Method | Khi tất toán | Vì sao |
|---|---|---|
| `transfer` | **chặn** | R6.3 nói rõ |
| `executePurchase` | **chặn** | là chuyển nhượng; mua vào lúc thanh lý là vô nghĩa |
| `burn` | cho phép | R6.3 nói rõ; đốt là chính việc phải làm khi tất toán |
| `forcedTransfer` | cho phép | clawback là cơ chế ngoại lệ ngân hàng cần đúng lúc xử lý sự vụ |
| `mint`, `mintInitialSupply` | cho phép | spec không nêu; **cố ý không** thêm ràng buộc ngoài yêu cầu để không chặn oan BE-02…BE-07 |

Xem câu hỏi mở 5 trong checkpoint.

### QĐ-K6: `evm.adapter` hiện thực phần không chờ contract mới

`tasks.md` bước 6 cho phép bỏ qua cả bước khi SC-02/SC-03 chưa có. Đã hiện thực 6 method
**không cần contract mới** (`canTransfer`, `takeSnapshot`, `balanceOfAt`, `totalSupplyAt`,
`paymentBalanceOf`, `profitPoolBalance`) vì mỗi cái ánh xạ 1–1 vào hàm đã tồn tại và đã
deploy; ném lỗi ở đó là tạo nợ giả và chặn BE-06 không vì lý do kỹ thuật nào.

10 method còn lại ném `LedgerNotImplementedError` với gợi ý nêu **đúng** thứ đang thiếu.
Không nối tạm vào contract có ngữ nghĩa gần gần: `Redemption.paused` ngược hướng với "bật
tất toán", nối vào sẽ cho ra hệ thống chạy được nhưng làm ngược.

Chi tiết deviation: `docs/CHECKPOINT_BE01.md` mục 6 (D1).

### QĐ-K7: `canTransfer` dùng `assertPositiveAmount` (ném lỗi) thay vì trả `{ allowed: false }`

Bảng `design.md` mục 3 xếp "số lượng bằng 0 hoặc âm" vào nhóm dùng `assertPositiveAmount`.
Số lượng ≤ 0 là lỗi lập trình, không phải kết quả nghiệp vụ; validate ở form (Zod) chặn
trước rồi. Giữ thống nhất với 15 method còn lại.

## 3. Ràng buộc mà `mock.adapter` phải giữ

Bảng ở `docs/be-01-ledger-port/design.md` mục 3, **9/9 dòng có test riêng** — đối chiếu tên
test ở `docs/CHECKPOINT_BE01.md` mục 3.

Nguyên tắc chung rút ra: **mọi kiểm tra chạy trước mọi thay đổi trạng thái**. Đó là cách duy
nhất giữ R2.5 "không để lại trạng thái nửa vời" trong một hàm không có transaction. Trong
`executePurchase` có một dòng phân cách ghi rõ "từ đây trở xuống không còn nhánh từ chối nào".

Và: **test ca từ chối phải kiểm luôn "trạng thái không đổi"**, không chỉ kiểm có ném lỗi.

## 4. Tệp đã thay đổi

```
app/src/lib/ledger/ledger.port.ts       tách 7 interface, +16 chữ ký, +TransferCheck, +SnapshotResult
app/src/lib/ledger/evm.adapter.ts       6/16 method + sửa lỗi thứ tự đọc revert reason
app/src/lib/ledger/mock.adapter.ts      16/16 method + seedMockLedger
app/src/lib/ledger/stellar.adapter.ts   16/16 ném LedgerNotImplementedError
app/src/lib/ledger/index.ts             export 7 interface con + 2 kiểu mới
app/test/mock-ledger.test.ts            11 -> 48 test
app/test/abi-contract-sync.test.ts      2 -> 4 contract được đối chiếu
packages/shared/src/abi/project-token.ts      +snapshot/balanceOfAt/totalSupplyAt/getCurrentSnapshotId, +event Snapshot, +4 mục error
packages/shared/src/abi/vnd-token.ts          +allowance, +3 mục error
packages/shared/src/abi/profit-distributor.ts MỚI
packages/shared/src/abi/redemption.ts         MỚI
packages/shared/src/abi/index.ts              export 2 ABI mới
docs/tech-report.md                     mục 3.1 (bảng 27 method), 3.7, 1.6.A/B/C
.kiro/steering/lessons.md               +7 bài học
```

**Không** sửa `addresses.ts`/`CONTRACT_NAMES`: cả 4 contract đang tồn tại đã có đủ địa chỉ,
và contract khớp lệnh (SC-03) chưa tồn tại nên không có địa chỉ nào để thêm. Deviation D2.

**Không** sửa contract Solidity — đã kiểm: `BASE_REF=origin/dev bash scripts/verify-arch-rules.sh`
cho `PASS Contract không bị sửa so với origin/dev`.

## 5. Bẫy đã gặp, ghi lại để không mất công lần sau

### 5.1. `fail()` đọc revert reason sai thứ tự (lỗi sẵn có trên `dev`)

Đo trên hardhat-local: với `require(cond, "chuoi")`, viem đặt `data.errorName = "Error"`
(tên error dựng sẵn `Error(string)`) và để chuỗi thật ở `reason`. Code cũ ưu tiên
`errorName` nên **mọi** lỗi tuân thủ ra đúng một câu `Contract từ chối: Error`.

Thứ tự đúng: `reason` → `data.errorName` → `signature`.

### 5.2. ABI tối giản thiếu mục `error` thì custom error không giải mã được

OZ v5 revert bằng custom error. Không có mục `error` trong ABI thì viem trả về 4 byte
selector và message thành `reverted with the following signature: 0xe2517d3f`. Đã thêm
`AccessControlUnauthorizedAccount`, `ERC20InsufficientBalance/Allowance`,
`ERC20InvalidReceiver`, `SafeERC20FailedOperation`.

### 5.3. TypeScript không thu hẹp kiểu sau lời gọi hàm `never`

Phải ghi kiểu trên **BIẾN**:

```ts
const reject: (operation: string, message: string) => never = (operation, message) => { ... };
```

Viết `const reject = (operation: string, message: string): never => { ... }` thì sau
`if (!record) reject(...)` biến `record` vẫn còn `| undefined`.

### 5.4. Đừng để test cần hardhat node nằm trong `test/`

`run-local-all.sh` phải xanh không cần mạng và không cần node. Test nghiệm thu
`evm.adapter` là **tạm**, chạy rồi xoá, kết quả dán vào checkpoint.

Và `deploy.js` ghi lại `deployedAt` trong `addresses.json` — `git checkout` trả về nguyên
trạng sau khi nghiệm thu (địa chỉ hardhat-local là tất định nên không đổi).
