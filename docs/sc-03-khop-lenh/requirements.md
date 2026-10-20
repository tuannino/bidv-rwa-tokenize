# SC-03: Hợp đồng khớp lệnh mua bán WPT

| | |
|---|---|
| Nhánh | `feat/sc-03-khop-lenh`, từ `dev` **sau khi SC-07 merge** |
| Điểm | 14 |
| Mức kiểm chứng | **Cao** (chuyển tài sản của nhà đầu tư và của SPV) |
| Trạng thái spec | **Bản 2.1, ngày 19/10/2026**: đã xử lý review của Codex; chủ dự án chốt CH-1 đến CH-6 theo đề xuất. Làm một lượt sau khi SC-07 merge (chủ dự án chốt, không chia phần) |
| Thứ tự | Sau SC-07. Trước FE-05 (ký `permit` trên giao diện) và OP-05 (Sepolia lần hai) |
| Căn cứ | DS-01 bản 4: QĐ-1, QĐ-3, QĐ-4, QĐ-6, QĐ-7, QĐ-15, QĐ-16, QĐ-17, QĐ-22, QĐ-24. Spec SC-07 bản 2.1 (QĐ-A, QĐ-C) |

## Mục tiêu

1. Có hợp đồng `OrderSettlement` giữ **giá bán một WPT** và thực hiện lệnh mua, bán **nguyên tử hai chân**
   với vault (QĐ-15): cả hai chân cùng thành công hoặc cùng hoàn lại.
2. Mỗi lệnh lên chuỗi mang `orderRef` suy ra từ mã lệnh trong database; gửi lại cùng một lệnh **không thể**
   quyết toán hai lần, và lần gửi lại báo đúng lỗi `OrderAlreadySettled`.
3. Hợp đồng nhận `permit` (ERC-2612) của nhà đầu tư cho VNDB (mua) và WPT (bán), theo đúng giới hạn QĐ-16.
4. Ứng dụng chạy được luồng mua, bán thật trên chain EVM: gỡ 5 điểm chặn `@blocked SC-03`, thêm kiểm ủy quyền
   WPT chiều bán, và đóng khoảng trống đối soát BE-17: **không lệnh nào bị chốt thất bại khi tiền đã chuyển**.

## Hiện trạng đã đo (Supervisor, `dev` @ `3342c2e`; đo lại sau khi SC-07 merge)

```bash
grep -n "@blocked SC-03" app/src/lib/ledger/evm.adapter.ts
# 5 điểm: quotePurchase, setPurchasePrice, paymentAllowanceOf, executePurchase, executeSale
grep -n "executePurchase(investor\|executeSale(investor" app/src/lib/ledger/ledger.port.ts
# chữ ký hiện tại chỉ có (investor, wptAmount): không mang mã lệnh, không mang số VNDB đã chốt
grep -rln "executePurchase\|executeSale" app/src app/test
# một chỗ gọi trong purchase.service.ts và 6 tệp kiểm thử (Codex đếm khi review)
grep -n "KHÔNG kiểm uỷ quyền WPT" app/src/lib/ledger/mock.adapter.ts
# mock chiều bán không kiểm ủy quyền WPT; ILedgerPort chưa có hàm đọc ủy quyền WPT
grep -n "requireNotSettling" app/src/lib/ledger/mock.adapter.ts
# mock chặn mua bán khi đang tất toán; hợp đồng EVM chưa có công tắc này (SC-04)
grep -n "Cần đối soát tay, tuyệt đối không gửi lại" app/src/lib/bank/purchase.service.ts
# BE-17: lệnh EXECUTING chưa lưu mã giao dịch thì bị chặn, chờ đối soát tay
grep -n "to: 'FAILED'" app/src/lib/bank/purchase.service.ts
# các điểm chốt FAILED rải trong nhiều nhánh
grep -n "@flow purchase" -r app/src | wc -l
# 12 điểm cắm mang số dòng; đổi mã purchase.service phải sinh lại sơ đồ luồng
grep -n "WPT_ISSUE_PRICE_VND = " app/src/lib/config/issue-terms.ts
# giá phát hành mặc định 100.000 VND một WPT, hằng số trong app
```

- Màn hình chưa có bước `approve` cho nhà đầu tư trên chain thật. Ký `permit` trên giao diện là việc FE-05.
- Giá hiển thị trên màn hình đọc từ dòng cấu hình database theo chain (FE-27); giá khớp lệnh trên EVM sẽ nằm
  trong hợp đồng. Hai nguồn có thể lệch sau khi triển khai lại hoặc `evm-local.sh reset` (R7).

## Quyết định thiết kế

### QĐ-A. Hợp đồng `OrderSettlement`

Tệp `packages/contracts-evm/contracts/OrderSettlement.sol`. Kế thừa `AccessControl`, `Pausable`,
`ReentrancyGuard`. Không proxy; thay phiên bản theo QĐ-D.

```solidity
constructor(address vault_, address admin, uint256 initialPrice)
```

- `vault_`, `admin` khác 0; `initialPrice > 0`. Đọc `projectToken()` và `paymentToken()` **từ vault** (giao
  diện công khai chốt ở SC-07 bản 2.1) rồi lưu `immutable`, để ba hợp đồng không thể trỏ lệch nhau.
- Cấp `DEFAULT_ADMIN_ROLE` cho `admin`. Không cấp vai nào khác trong constructor.

| Vai | Hàm | Ai giữ trong bản thử |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | cấp, thu vai | khoá ký máy chủ |
| `OPERATOR_ROLE` | `buy`, `sell`, `buyWithPermit`, `sellWithPermit` | khoá ký máy chủ |
| `PRICE_ROLE` | `setPrice` | khoá ký máy chủ, thay Giao dịch viên |
| `PAUSER_ROLE` | `pause`, `unpause` | khoá ký máy chủ |

**Giá:** `uint256 public price` (VNDB cho 1 WPT). `setPrice(uint256 newPrice)`: `newPrice > 0`, phát
`PriceSet(oldPrice, newPrice, operator)`.

### QĐ-B. Thực hiện lệnh

Cả bốn hàm lệnh đều `onlyRole(OPERATOR_ROLE) whenNotPaused nonReentrant` (ghi tường minh, kể cả hai hàm
`WithPermit`):

```solidity
function buy(bytes32 orderRef, address investor, uint256 wptAmount, uint256 vndbAmount) external ...;
function sell(bytes32 orderRef, address investor, uint256 wptAmount, uint256 vndbAmount) external ...;
```

Thứ tự kiểm và thực hiện, giống nhau cho cả bốn hàm:

1. **Kiểm trùng đầu tiên:** `vault.isOrderSettled(orderRef)` là `true` thì revert
   `OrderAlreadySettled(orderRef)` (cùng tên, cùng tham số với lỗi của vault). Phải đứng **trước** chân vào:
   nếu không, lần gửi lại một lệnh đã quyết toán sẽ revert vì thiếu ủy quyền (ủy quyền đúng số đã bị lần đầu
   tiêu hết, `permit` chỉ dùng một lần) và không bao giờ báo được lỗi trùng.
2. `vndbAmount == wptAmount * price` với `price` **hiện tại**, sai thì revert `PriceMismatch(uint256 expected,
   uint256 given)`. `vndbAmount` là số đã chốt ở database lúc đặt lệnh; đổi giá giữa chừng thì revert thay vì
   trừ theo giá mới.
3. (Chỉ hai hàm `WithPermit`) xử lý `permit` theo QĐ-C.
4. Chân vào, rồi chân ra:

| Lệnh | Chân vào (OrderSettlement làm, là bên được ủy quyền) | Chân ra (vault làm) |
|---|---|---|
| `buy` | `paymentToken.safeTransferFrom(investor, vault, vndbAmount)` | `vault.settleBuy(orderRef, investor, wptAmount, vndbAmount, price)` |
| `sell` | `projectToken.transferFrom(investor, vault, wptAmount)` (kiểm ERC-3643: nhà đầu tư không bị đóng băng, vault đã xác minh, bộ luật cho phép) | `vault.settleSell(orderRef, investor, wptAmount, vndbAmount, price)` |

- Một bước lỗi thì cả giao dịch hoàn lại. Các kiểm `orderRef != 0`, `wptAmount > 0`, `price > 0` do vault làm
  (SC-07 QĐ-C), không lặp lại.
- OrderSettlement **không bao giờ giữ** WPT hay VNDB, nên **không** đăng ký trong `IdentityRegistry` (QĐ-15).
- **Gọi lồng:** VNDB không có hook. WPT có: `transferFrom` gọi `compliance.transferred`, và một module của bộ
  luật có thể gọi ngược vào OrderSettlement. `nonReentrant` chặn đường này (ca 15).
- Không phát sự kiện riêng cho lệnh: nguồn sự kiện duy nhất là `OrderSettled` của vault (QĐ-17).

### QĐ-C. `permit` (QĐ-16)

```solidity
struct PermitData { uint256 value; uint256 deadline; uint8 v; bytes32 r; bytes32 s; }
function buyWithPermit(bytes32 orderRef, address investor, uint256 wptAmount, uint256 vndbAmount, PermitData calldata p) external ...;
function sellWithPermit(bytes32 orderRef, address investor, uint256 wptAmount, uint256 vndbAmount, PermitData calldata p) external ...;
```

- `p.value` phải **bằng đúng** số của lệnh (`vndbAmount` khi mua, `wptAmount` khi bán), sai thì revert
  `PermitValueMismatch(uint256 expected, uint256 given)`. Spender trong chữ ký là địa chỉ OrderSettlement.
- Gọi `permit` trong `try/catch`; lỗi thì bỏ qua và chạy tiếp; ủy quyền thực tế không đủ thì chân vào revert.
- `permit` chỉ cấp quyền chi token, **không** xác nhận giá, chiều lệnh hay `orderRef` (giả định tin cậy QĐ-6).
- **Hệ quả cho FE-05 (ghi để thiết kế đúng):** `permit` ERC-2612 **ghi đè** mức ủy quyền, không cộng thêm, và
  nonce phải dùng **theo thứ tự**. Nhà đầu tư có hai lệnh mở mà lệnh ký sau được khớp trước thì chữ ký của lệnh
  đó sai nonce, bị bỏ qua, và lệnh revert vì thiếu ủy quyền. FE-05 phải ký theo thứ tự khớp, hoặc ký lại khi
  khớp.
- Ứng dụng **chưa** truyền `permit` ở SC-03 (CH-5).

### QĐ-D. Tạm dừng và thay phiên bản

- `pause` chặn cả bốn hàm lệnh (CH-4). Không chặn `setPrice`. Không ảnh hưởng đường rút của vault (QĐ-22).
- **Chế độ tất toán:** mock chặn mua bán khi đang tất toán (`requireNotSettling`); hợp đồng EVM chưa có công
  tắc tất toán (SC-04 còn chặn). Trong thời gian chờ SC-04, công tắc vận hành trên EVM là `pause` của
  OrderSettlement. Ghi vào `tech-report.md` và runbook.
- **Thay phiên bản:** (1) `pause` bản cũ; (2) admin vault `revokeRole(MATCHER_ROLE, cũ)`; (3) triển khai bản
  mới, `grantRole(MATCHER_ROLE, mới)`. Dấu `orderRef` nằm trong vault nên không mất (QĐ-17). Nhà đầu tư phải
  ủy quyền lại cho địa chỉ mới. Ghi quy trình vào `tech-report.md`.

### QĐ-E. Lỗi tuỳ biến

`ZeroAddress`, `ZeroPrice`, `OrderAlreadySettled(bytes32)`, `PriceMismatch(uint256 expected, uint256 given)`,
`PermitValueMismatch(uint256 expected, uint256 given)`. Lỗi của vault và của token đi xuyên lên nguyên vẹn.

### QĐ-F. `orderRef` từ mã lệnh (CH-1)

- `orderRef` = 16 byte của UUID đặt ở **đầu** `bytes32`, 16 byte sau bằng 0. Ví dụ
  `3f2504e0-4f89-11d3-9a0c-0305e82c3301` thành
  `0x3f2504e04f8911d39a0c0305e82c330100000000000000000000000000000000`.
- Hàm dùng chung trong `packages/shared`: `orderRefFromOrderId(id)` nhận UUID (chấp nhận chữ hoa, chuẩn hoá về
  chữ thường; từ chối chuỗi không phải UUID) và `orderIdFromOrderRef(ref)` trả UUID **chữ thường có gạch nối**,
  đúng dạng `gen_random_uuid()::text` và `randomUUID()` sinh ra, để so khớp chuỗi trong database; từ chối khi
  16 byte sau khác 0. Mock dùng cùng hàm.

### QĐ-G. Triển khai

- `deploy.js`: sau vault, triển khai `OrderSettlement(vault, admin, wptIssuePriceVnd)`; `vault.grantRole(
  MATCHER_ROLE, settlement)`; cấp `OPERATOR_ROLE`, `PRICE_ROLE`, `PAUSER_ROLE` cho `admin`. Thứ tự tám hợp
  đồng trước giữ nguyên.
- `token-parameters.json` thêm `wptIssuePriceVnd: 100000`; `WPT_ISSUE_PRICE_VND` trong `issue-terms.ts` đọc từ
  đây (CH-6).
- `CONTRACT_NAMES` thêm `OrderSettlement`. Address book `hardhat-local` thêm địa chỉ; khoá `evm` không đổi.
- `verify-deployment.js`: bytecode; trỏ đúng vault và hai token; `price > 0`; `vault.getRoleMemberCount(
  MATCHER_ROLE) == 1` và người giữ là OrderSettlement; admin giữ ba vai. `fund-sepolia.js`: cộng gas.

### QĐ-H. Giả định tin cậy (NatSpec và `tech-report.md`)

1. `OPERATOR_ROLE` chọn lệnh, nhà đầu tư, số lượng; `permit` không ràng buộc các thứ đó. Bảo vệ của nhà đầu tư:
   chỉ bị trừ trong mức đã ủy quyền, và theo đúng giá hiện hành trên hợp đồng.
2. `PRICE_ROLE` đổi giá bất kỳ lúc nào; lệnh đã chốt theo giá cũ sẽ revert chứ không bị trừ theo giá mới.
3. Một khoá máy chủ giữ mọi vai trong bản thử (như SC-07 QĐ-G).

## Yêu cầu phía ứng dụng

**R1. Đổi chữ ký cổng khớp lệnh** trong `ILedgerPurchase`:

```ts
executePurchase(order: { orderId: string; investor: string; wptAmount: bigint; vndAmount: bigint }): Promise<TxResult>;
executeSale(order: { orderId: string; investor: string; wptAmount: bigint; vndAmount: bigint }): Promise<TxResult>;
wptAllowanceOf(owner: string): Promise<bigint>;
findOrderSettlement(orderId: string): Promise<OrderSettlementLookup>;
type OrderSettlementLookup =
  | { status: 'NOT_SETTLED' }
  | { status: 'SETTLED'; txHash: string; blockNumber: bigint }
  | { status: 'SETTLED_TX_UNKNOWN' }; // đã quyết toán trên chuỗi nhưng chưa tìm thấy sự kiện
```

- `vndAmount` là số đã chốt ở lệnh; adapter EVM truyền thẳng làm `vndbAmount`.
- `findOrderSettlement` trên EVM: gọi `vault.isOrderSettled(orderRef)`; `false` thì `NOT_SETTLED`, **không**
  quét sự kiện. `true` thì quét `OrderSettled` lọc theo `orderRef` (indexed) **lùi** từ block mới nhất, mỗi
  đoạn một cỡ cấu hình được (mặc định 5.000 block, biến môi trường cho phép đổi, vì RPC công khai Sepolia giới
  hạn khoảng 1.000 tới 50.000 block mỗi lần), gặp kết quả đầu tiên thì dừng, mốc dưới là `deployBlock`. Không
  tìm thấy thì `SETTLED_TX_UNKNOWN`.
- Lỗi RPC khi tra cứu **ném lỗi**, không được trả `NOT_SETTLED`.
- Cập nhật một chỗ gọi trong `purchase.service.ts` và các tệp kiểm thử liên quan.

**R2. Gỡ 5 điểm `@blocked SC-03`** trong `evm.adapter.ts`:
- `quotePurchase`: `wptAmount * OrderSettlement.price()`. `setPurchasePrice`: `OrderSettlement.setPrice`.
- `paymentAllowanceOf`: `VNDToken.allowance(owner, OrderSettlement)`.
- `executePurchase`, `executeSale`: `buy`, `sell` với `orderRef` theo QĐ-F.
- Thiếu địa chỉ `OrderSettlement` thì báo lỗi cấu hình rõ ràng, không gọi nhầm hợp đồng khác.
- `REVERT_MESSAGES` thêm lỗi QĐ-E, `EnforcedPause`, `ERC20InsufficientAllowance` (nêu rõ token nào, cho địa
  chỉ nào).

**R3. Mock ngang hàng hợp đồng:**
- `executePurchase`, `executeSale` kiểm trùng `orderId` **trước** mọi kiểm khác (như QĐ-B), rồi kiểm
  `vndAmount == wptAmount * giá hiện tại`; lưu tập `orderId` đã quyết toán (kèm mã giao dịch giả của mock).
- Trạng thái mock lưu trên Neon hiện **không có** trường này: bước đọc phải coi thiếu trường là tập rỗng; có ca
  kiểm thử nạp JSON trạng thái cũ. Ghi chú trong mã: tập nằm trong một dòng JSONB mỗi chain nên mỗi lần ghi
  ghi lại cả khối, chấp nhận ở quy mô trình diễn.
- `wptAllowanceOf` trên mock trả `2^256 - 1` kèm chú thích "mock không mô phỏng ủy quyền WPT" (CH-2).
- Stellar: các hàm mới trả lỗi "chưa hỗ trợ".

**R4. Kiểm ủy quyền WPT chiều bán.** `runSaleBalanceChecks` thêm phép kiểm `wptAllowance` sau số dư WPT và
trước VNDB của vault, cùng kiểu thông báo với phép kiểm ủy quyền VNDB chiều mua.

**R5. Chốt chung "tra chuỗi trước khi ghi thất bại"** (sửa từ review, mục 1).
- Trên chain chống trùng được (EVM có `OrderSettlement`, và mock theo R3), **mọi** lần sắp ghi một lệnh sang
  `FAILED` hoặc `REJECTED` đều đi qua **một** hàm dùng chung đặt ở chỗ ghi trạng thái thất bại (không rải theo
  từng nhánh lỗi, vì viem có thể trả lỗi ở bước mô phỏng, khi hết thời gian chờ, hoặc dưới dạng thông báo
  khác). Hàm này gọi `findOrderSettlement(orderId)`:

| Kết quả | Xử lý |
|---|---|
| `NOT_SETTLED` | ghi thất bại như hiện nay |
| `SETTLED` | chốt `COMPLETED` với mã giao dịch tìm được; ghi sổ giao dịch và sổ kiểm toán, ghi rõ "đối soát từ chuỗi" |
| `SETTLED_TX_UNKNOWN` | **giữ** lệnh ở trạng thái hiện tại, trả lỗi "đã quyết toán trên chuỗi, chưa tìm thấy mã giao dịch"; **tuyệt đối không** ghi thất bại |
| tra cứu lỗi (RPC) | giữ trạng thái hiện tại, trả lỗi, không ghi thất bại |

- Không dựa vào tên lỗi `OrderAlreadySettled` để quyết định; tên lỗi chỉ dùng cho thông báo.
- Chain khác giữ hành vi BE-17 hiện tại.

**R6. Gửi lại lệnh `EXECUTING` mất mã giao dịch** (sửa từ review, mục 2; CH-3).
- Thay nhánh "Cần đối soát tay": gọi `findOrderSettlement`. `SETTLED` thì chốt `COMPLETED` như R5;
  `SETTLED_TX_UNKNOWN` hoặc lỗi tra cứu thì giữ nguyên và báo lỗi.
- `NOT_SETTLED` thì **không** gọi thẳng `sendAndSettle`. Dùng cập nhật có điều kiện sẵn có của
  `transitionOrder`: chuyển `EXECUTING` **với điều kiện `txHash` rỗng** sang `CHECKING`, rồi đi qua
  `settleStoredOrder` như đường can thiệp `CHECKING` của BE-17. Hệ quả: hai lần can thiệp cùng lúc chỉ một lần
  thắng; bộ kiểm chạy lại, gồm cả giá; lệnh chiếm lại `EXECUTING` đúng đường BE-17.
- **Thêm đúng một cạnh** vào máy trạng thái BE-17: `EXECUTING (txHash rỗng) sang CHECKING`, chỉ được đi qua
  nhánh này, chỉ trên chain chống trùng được. Cập nhật tài liệu máy trạng thái và kiểm thử của BE-17.
- Nếu giao dịch cũ lên chuỗi muộn đúng lúc bộ kiểm chạy lại (ủy quyền đã bị tiêu, kiểm thất bại), R5 bắt được.

**R7. Một nguồn giá hiển thị trên EVM** (sửa từ review).
- Trên chain có `OrderSettlement`, giá phát hành hiển thị (`getIssuePrice` hoặc hàm tương đương của FE-27) đọc
  `quotePurchase(1)` từ chuỗi. Nếu lệch dòng cấu hình database thì hiện cảnh báo "giá trên hợp đồng khác giá
  đã cấu hình" cho Giao dịch viên.
- Ghi bước kiểm này vào runbook OP-05 (sau triển khai lại và sau `evm-local.sh reset` khi Postgres còn dòng cũ).

**R8. Giá ban đầu** theo QĐ-G.

## Ràng buộc

- Không sửa `SpvPaymentVault` và các hợp đồng của SC-09, SC-10. Giao diện công khai vault cần dùng đã chốt ở
  SC-07 bản 2.1; nếu vẫn thiếu, dừng lại hỏi Supervisor.
- Không thêm thư viện. Không triển khai Sepolia. Không commit khoá riêng hay URL RPC có khoá.
- Không làm giao diện ký `permit` (FE-05). Không đổi máy trạng thái BE-17 ngoài cạnh ở R6.
- Luật kiến trúc giữ nguyên: nghiệp vụ gọi chuỗi qua `ILedgerPort`, kiểm quyền qua `can()`.
- Checkpoint dán nguyên văn đầu ra lệnh đã chạy (`efficiency.md`).

## Mức kiểm chứng: Cao

Số trong các ca: giá 100.000 VNDB một WPT; vault cấu hình `FIXED` khi cần (theo SC-07).

| Ca | Kiểm |
|---|---|
| 1 | Triển khai: đọc đúng hai token từ vault; `price == 100.000`; `initialPrice = 0` revert `ZeroPrice`; vault có đúng một người giữ `MATCHER_ROLE` là OrderSettlement |
| 2 | **Mua thành công:** ủy quyền 10.000.000 VNDB, mua 100 WPT: VNDB nhà đầu tư giảm 10.000.000, vault tăng 10.000.000; WPT vault giảm 100, nhà đầu tư tăng 100; `OrderSettled` phát một lần; số dư của OrderSettlement bằng 0 |
| 3 | **Bán thành công:** ủy quyền 40 WPT, bán 40: chiều ngược lại đúng số; `netProceeds` của vault giảm 4.000.000 |
| 4 | **Giá đổi giữa chừng:** `setPrice(110.000)`; `buy(…, 100, 10.000.000)` revert `PriceMismatch(11.000.000, 10.000.000)`; không token nào chuyển |
| 5 | `setPrice(0)` revert `ZeroPrice`; ví không có `PRICE_ROLE` revert; sự kiện `PriceSet` đúng |
| 6 | **Gửi lại báo đúng lỗi trùng:** nhà đầu tư `approve` **đúng** 10.000.000, mua 100 WPT thành công; gửi lại cùng `orderRef` revert **`OrderAlreadySettled`** (không phải lỗi thiếu ủy quyền). Tương tự với `buyWithPermit` dùng lại chữ ký cũ, và với `sell` sau khi đã bán |
| 7 | **Nguyên tử chiều mua:** (a) nhà đầu tư chưa xác minh; (b) thiếu ủy quyền VNDB; (c) thiếu số dư VNDB; (d) vault thiếu WPT. Mỗi ca revert, số dư không đổi, `isOrderSettled` vẫn `false` |
| 8 | **Nguyên tử chiều bán:** (a) nhà đầu tư bị đóng băng; (b) thiếu ủy quyền WPT; (c) vault thiếu VNDB; (d) bộ luật từ chối (`RejectAllModule`). Mỗi ca revert, số dư không đổi |
| 9 | **Phần khoá không chặn bán lại:** vault `FIXED` khoá lớn hơn số dư; `sell` vẫn chạy |
| 10 | **`permit` VNDB:** (a) không `approve` trước, `buyWithPermit` chạy; (b) `p.value` khác `vndbAmount` revert `PermitValueMismatch`; (c) người khác gửi `permit` trước bằng chính chữ ký đó, lệnh vẫn chạy; (d) chữ ký quá hạn, không có ủy quyền sẵn: revert ở chân vào |
| 11 | **`permit` WPT:** `sellWithPermit` chạy; ca chữ ký bị gửi trước vẫn chạy |
| 12 | **Tạm dừng:** chặn bốn hàm lệnh; `setPrice` vẫn chạy; vault `withdraw` không bị ảnh hưởng; `unpause` mở lại |
| 13 | **Vai:** ví không có `OPERATOR_ROLE` gọi bốn hàm lệnh đều revert lỗi vai; ví không có `PAUSER_ROLE` gọi `pause` revert |
| 14 | **Thay phiên bản:** `pause` bản 1, thu `MATCHER_ROLE`, cấp cho bản 2: bản 1 gọi `buy` revert; bản 2 chạy; `orderRef` đã quyết toán ở bản 1 bị bản 2 chặn bằng `OrderAlreadySettled` |
| 15 | **Gọi lồng qua bộ luật:** `ReentrantModule` (module compliance, được cấp `OPERATOR_ROLE` trong kiểm thử) gọi lại `sell` trong `moduleTransferAction`; giao dịch gốc revert với **đúng** lỗi `ReentrancyGuardReentrantCall` (kiểm tên lỗi, không chỉ kiểm có revert). Module **tự tắt trước khi gọi lại** (chỉ gọi lồng đúng một lần), để khi chạy đột biến 17g không rơi vào đệ quy tới giới hạn độ sâu của EVM (nghiệm thu SC-07: module của SC-07 không tự tắt, đột biến tương ứng làm tiến trình kiểm thử bị hệ điều hành dừng thay vì đỏ gọn) |
| 16 | Bộ cũ xanh (gồm bộ SC-07), không nới điều kiện; số ca tăng đúng bằng số ca mới |
| 17 | **Đột biến**, dán đầu ra đỏ rồi hoàn nguyên: (a) bỏ kiểm `PriceMismatch`, ca 4 đỏ; (b) gọi `permit` không bọc `try/catch`, ca 10c đỏ; (c) bỏ kiểm `PermitValueMismatch`, ca 10b đỏ; (d) bỏ `whenNotPaused` ở `sell`, ca 12 đỏ; (e) chân vào kéo về OrderSettlement thay vì vault, ca 2 đỏ; (f) bỏ kiểm trùng đầu hàm, ca 6 đỏ; (g) bỏ `nonReentrant` ở `sell`, ca 15 đỏ |
| 18 | **`orderRef`:** UUID ví dụ ở QĐ-F đổi đúng từng byte và đổi ngược ra chuỗi chữ thường có gạch nối; UUID chữ hoa vào cho cùng kết quả; chuỗi không phải UUID và `bytes32` có 16 byte sau khác 0 bị từ chối |
| 19 | **App mock:** mua và bán qua `placeOrder` chạy như cũ; gửi lại cùng `orderId` bị từ chối ở cổng; giá đổi giữa đặt và khớp bị từ chối ở cổng; nạp JSON trạng thái mock cũ (không có tập lệnh đã quyết toán) chạy bình thường |
| 20 | **App trên nút Hardhat thật** (`TEST_HARDHAT_RPC`): dựng vault có WPT, nhà đầu tư đã xác minh và `approve` bằng script; `placeOrder` mua 100 WPT về `COMPLETED`, số dư trên chuỗi đúng; bán 40 WPT về `COMPLETED`; bán khi thiếu ủy quyền WPT bị chặn ở R4 trước khi gửi |
| 21 | **R5 trên nút thật:** lệnh đã quyết toán trên chuỗi mà nhánh gửi gặp lỗi bất kỳ (giả lập: lỗi mô phỏng, hết thời gian chờ biên nhận, thông báo lạ) đều chốt `COMPLETED` với mã giao dịch gốc, không `FAILED`; `SETTLED_TX_UNKNOWN` (giả lập RPC không trả sự kiện) giữ nguyên trạng thái; lỗi RPC khi tra giữ nguyên trạng thái |
| 22 | **R6 trên nút thật:** (a) `EXECUTING` không mã, `orderRef` đã quyết toán: chốt `COMPLETED` với mã gốc, không gửi giao dịch mới; (b) chưa quyết toán: đi `CHECKING` rồi `settleStoredOrder`, về `COMPLETED`; (c) hai lần can thiệp chạy song song trên cùng lệnh: chỉ **một** giao dịch được gửi; (d) giá đã đổi từ lúc đặt: bộ kiểm chạy lại từ chối, lệnh không bị trừ theo giá mới |
| 23 | **R7:** chain có `OrderSettlement` hiển thị giá đọc từ chuỗi; đổi dòng database cho lệch thì có cảnh báo; chain mock giữ cách đọc hiện tại |
| 24 | Đồng bộ ABI xanh; `run-local-all.sh` xanh (gồm phần `markers`); `node scripts/gen-flow-diagram.mjs purchase` đã chạy và commit kết quả; mô phỏng job A (có `trap`) xanh; `evm-issuance.test.ts` xanh; quét bí mật sạch; `scan-pending` không còn điểm `@blocked SC-03` |

## Điều kiện hoàn thành

- [ ] `OrderSettlement` theo QĐ-A đến QĐ-E, giả định tin cậy QĐ-H trong NatSpec (ca 1 đến 15).
- [ ] Bộ cũ xanh (ca 16). Đột biến đỏ đúng ca (ca 17).
- [ ] `orderRef` theo QĐ-F (ca 18). Triển khai và công cụ theo QĐ-G; địa chỉ hardhat-local cũ không đổi.
- [ ] App R1 đến R8 (ca 19 đến 23); kiểm chứng chung (ca 24).
- [ ] `tech-report.md`: mục khớp lệnh (bảng hai chân, `permit` và hệ quả nonce, tạm dừng thay công tắc tất toán,
      thay phiên bản, giả định tin cậy); máy trạng thái BE-17 thêm cạnh R6; nợ P2 của BE-17 cập nhật.

## Câu hỏi cho chủ dự án (đã chốt 19/10/2026: cả sáu theo đề xuất)

Codex đồng ý cả sáu đề xuất; CH-3 chỉ đồng ý khi có R5 và R6 (đã đưa vào bản này).

| Mã | Câu hỏi | Đề xuất |
|---|---|---|
| CH-1 | `orderRef` = 16 byte UUID của mã lệnh đặt đầu `bytes32` (đổi ngược được), thay vì băm? | **Có** |
| CH-2 | Mock không mô phỏng ủy quyền WPT (luôn đủ)? | **Có** |
| CH-3 | Lệnh `EXECUTING` mất mã: tra chuỗi, đã quyết toán thì chốt, chưa thì gửi lại qua `CHECKING` (R6)? | **Có**, kèm R5 |
| CH-4 | `pause` của hợp đồng khớp lệnh chặn cả mua và bán (nút dừng khẩn cấp; tạm thay công tắc tất toán)? | **Có** |
| CH-5 | SC-03 chỉ hỗ trợ `permit` ở hợp đồng; ký trên giao diện ở FE-05? | **Có** |
| CH-6 | Giá ban đầu trên chuỗi lấy từ `token-parameters.json`, app đọc cùng nguồn? | **Có** |

## Đã xử lý review (Codex, 19/10/2026)

| # | Góp ý | Xử lý |
|---|---|---|
| 1 | Gửi lại lệnh đã quyết toán revert vì thiếu ủy quyền, không ra `OrderAlreadySettled`; R5 không kích hoạt, lệnh bị `FAILED` sai | **Đồng ý.** Kiểm trùng đầu hàm (QĐ-B bước 1), ca 6, đột biến 17f. App: chốt chung tra chuỗi trước mọi lần ghi thất bại, không dựa vào tên lỗi (R5) |
| 2 | Gửi lại qua `sendAndSettle` không khoá, bỏ qua kiểm giá | **Đồng ý.** Đi `EXECUTING` (txHash rỗng) sang `CHECKING` có điều kiện rồi `settleStoredOrder`; thêm đúng một cạnh trạng thái (R6), ca 22 |
| 3 | Hai nguồn giá hiển thị trên EVM | **Đồng ý.** R7, ca 23, bước runbook OP-05 |
| 4 | Gọi lồng qua module bộ luật; ghi rõ `nonReentrant` cho hàm `WithPermit` | **Đồng ý.** QĐ-B, ca 15. Bổ sung: ca phải kiểm **đúng tên lỗi** `ReentrancyGuardReentrantCall`, vì nếu bỏ `nonReentrant` thì giao dịch gốc vẫn revert (ở bước kiểm trùng của vault) và một ca chỉ kiểm "có revert" sẽ không đỏ |
| 5 | Đột biến 16f gộp hai thay đổi, thứ tự chân không quan sát được qua tính nguyên tử | **Đồng ý.** Thay bằng 17f (bỏ kiểm trùng) và 17g (bỏ `nonReentrant`) |
| 6 | `findOrderSettlement`: chỉ quét khi đã quyết toán, quét lùi theo đoạn, không chốt `FAILED` khi chưa tìm thấy sự kiện | **Đồng ý.** R1 (kiểu kết quả ba trạng thái), R5 |
| 7 | Phụ thuộc giao diện công khai của vault | **Đồng ý, đã báo ngay:** SC-07 bản 2.1 chốt `projectToken()`, `paymentToken()`, `isOrderSettled`, lỗi `OrderAlreadySettled(bytes32)`, sự kiện `OrderSettled` |
| 8 | Mock trên Neon chưa có trường tập lệnh đã quyết toán | **Đồng ý.** R3, ca 19 |
| 9 | Đổi chữ ký chạm 6 tệp test; phải sinh lại sơ đồ luồng | **Đồng ý.** R1, ca 24, tasks bước 4 |
| 10 | Hệ quả nonce của `permit`; chế độ tất toán; UUID chữ thường; `pause` bản cũ trước khi thu vai | **Đồng ý cả bốn.** QĐ-C, QĐ-D, QĐ-F |

## Không làm

- Giao diện ký `permit` (FE-05). Màn `approve` cho nhà đầu tư.
- Triển khai Sepolia (OP-05).
- Lệnh do nhà đầu tư ký EIP-712, phí giao dịch, khớp lệnh giữa hai nhà đầu tư.
- Công tắc tất toán trên EVM (SC-04). Tiến trình quét lệnh kẹt định kỳ (BE-07, nợ P2 phần còn lại).
- Sửa vault hay token.
