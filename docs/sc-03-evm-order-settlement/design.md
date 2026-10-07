# SC-03 — Thiết kế quyết toán nguyên tử EVM

## 1. Kiến trúc

`OrderSettlement` là contract điều phối không giữ số dư thường trực. DB/service tiếp tục quản lý lệnh,
quyền GDV và trạng thái; contract chỉ thực thi nguyên tử một lệnh đã được service kiểm và truyền giá
kỳ vọng.

```text
purchase.service
  → ILedgerPort.executePurchase/executeSale(investor, wpt, expectedVnd)
    → evm.adapter + ISigner (ví vận hành)
      → OrderSettlement.buy/sell
        → WPT.transferFrom + VNDB.transferFrom  (cùng một tx)
```

Contract đọc `ProjectToken.spvWallet()` từ SC-02. Không truyền SPV từ client và không lưu một bản sao.

## 2. API dự kiến

```solidity
enum Side { BUY, SELL }

function pricePerWpt() external view returns (uint256);
function quote(uint256 wptAmount) public view returns (uint256);
function setPrice(uint256 newPrice) external onlyRole(PRICE_ROLE);

function buy(address investor, uint256 wptAmount, uint256 expectedVndAmount)
    external onlyRole(SETTLEMENT_ROLE) nonReentrant;

function sell(address investor, uint256 wptAmount, uint256 expectedVndAmount)
    external onlyRole(SETTLEMENT_ROLE) nonReentrant;
```

`buy`: VNDB `investor → SPV`, rồi WPT `SPV → investor`. `sell`: WPT `investor → SPV`, rồi VNDB
`SPV → investor`. Thứ tự không tạo nửa giao dịch vì bất kỳ revert nào hoàn nguyên toàn bộ tx.

`expectedVndAmount` đóng race TOCTOU: service kiểm giá hiện tại bằng số lệnh đã chốt, nhưng một tx đổi
giá có thể được đào trước tx khớp. Contract tự tính lại và revert nếu khác.

## 3. Allowance

| Chiều | Owner | Token | Spender |
|---|---|---|---|
| BUY | Nhà đầu tư | VNDB | OrderSettlement |
| BUY | SPV | WPT | OrderSettlement |
| SELL | Nhà đầu tư | WPT | OrderSettlement |
| SELL | SPV | VNDB | OrderSettlement |

Không dùng `ProjectToken.forcedTransfer`: hàm đó là clawback của AGENT, bỏ qua freeze của bên gửi và
không phải bằng chứng đồng ý giao dịch. Dùng nó sẽ biến lỗi thiếu approve thành quyền ngân hàng tự lấy
tài sản.

`ILedgerPurchase` cần thêm `tokenAllowanceOf(owner)` hoặc một phép đọc allowance có tên tương đương,
luôn dùng OrderSettlement hiện hành làm spender. `paymentAllowanceOf` giữ chữ ký hiện tại. Nếu cần
hiện spender trên UI, thêm `settlementAddress()` vào view-model/config, không để component đọc
addresses registry trực tiếp.

Phần approve từ ví là bước setup thủ công cho Hardhat/Sepolia trong SC-03; UX approve/permit hoàn
chỉnh phải được tách task nếu Owner yêu cầu. E2E dùng wallet Hardhat thật để gửi approve, không seed
thẳng allowance trong DB.

## 4. Thay đổi interface và service

Chữ ký đề xuất:

```ts
executePurchase(investor: string, wptAmount: bigint, expectedVndAmount: bigint): Promise<TxResult>;
executeSale(investor: string, wptAmount: bigint, expectedVndAmount: bigint): Promise<TxResult>;
tokenAllowanceOf(owner: string): Promise<bigint>;
```

`purchase.service` truyền `BigInt(checking.vndAmount)` đã lưu trong order. Mock adapter cũng so
`expectedVndAmount` với quote hiện tại trước khi đổi map, để test mock bắt cùng invariant với EVM.
Stellar adapter trả `LedgerNotImplementedError` có chỉ dẫn, không giả giá trị 0.

## 5. Quyền contract

- `DEFAULT_ADMIN_ROLE`: ví quản trị triển khai/multisig.
- `PRICE_ROLE`: ví quản trị cấu hình; trong PoC có thể cùng admin nhưng ghi riêng để tách sau.
- `SETTLEMENT_ROLE`: ví server signer dùng để khớp lệnh.
- OrderSettlement không cần MINTER/AGENT/BURNER role.
- Token chỉ cần allowance của chủ tài sản; giảm blast radius nếu signer ứng dụng bị lộ.

## 6. Tệp dự kiến

| Loại | Tệp |
|---|---|
| Contract | `packages/contracts-evm/contracts/OrderSettlement.sol` |
| Deploy/verify | `packages/contracts-evm/scripts/deploy.js`, verify/preflight và test |
| Shared | ABI tối giản, ABI sinh tự động, `addresses.ts/json`, env override |
| Port/adapters | `ledger.port.ts`, `evm.adapter.ts`, `mock.adapter.ts`, `stellar.adapter.ts` |
| Nghiệp vụ | `purchase.service.ts`, schema/view lỗi nếu cần |
| Test | contract atomicity, adapter, purchase service, E2E Hardhat hai chiều |

## 7. Kiểm thử và mutation

Contract:

1. BUY/SELL đổi đúng bốn số dư và event.
2. Mỗi lỗi balance, allowance, whitelist/freeze, role, amount 0, expected price đều revert và bốn
   số dư trước/sau bằng nhau.
3. Contract không giữ WPT/VNDB sau giao dịch.
4. Reentrancy token giả bị chặn.

Mutation bắt buộc:

- Tách hai chuyển thành hai tx: test atomicity phải đỏ.
- Bỏ so `expectedVndAmount`: test đổi giá trong race phải đỏ.
- Thay `transferFrom` bằng `forcedTransfer`: test role/allowance phải đỏ.
- Cho adapter dùng địa chỉ spender khác OrderSettlement: test allowance phải đỏ.

## 8. Triển khai

Deploy OrderSettlement sau WPT/VNDB và trước các bước cấp allowance. Ghi địa chỉ vào registry; cấp
role; SPV approve WPT và VNDB; Nhà đầu tư approve theo nhu cầu. `verify-deployment` đọc lại địa chỉ
token, SPV, giá, role và allowance thay vì chỉ kiểm bytecode khác `0x`.

Sepolia chỉ nghiệm thu sau khi SC-02 deployment tương ứng tồn tại. Không trộn địa chỉ WPT của một
deployment với OrderSettlement của deployment khác; script phải fail nếu getters không khớp.
