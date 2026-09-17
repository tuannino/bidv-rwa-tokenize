# BE-01 — Mở rộng ILedgerPort: design

## 1. Quyết định thiết kế

### QĐ-1: Tách interface theo nghiệp vụ, hợp lại bằng kế thừa kiểu

Thêm 17 method vào một interface thì `ILedgerPort` lên khoảng 28 method, rất khó đọc và mỗi adapter thành một tệp khổng lồ.

Cách làm: tách theo nghiệp vụ trong **cùng tệp** `ledger.port.ts`, rồi hợp lại:

```ts
export interface ILedgerCompliance { /* 4 method hiện có + canTransfer */ }
export interface ILedgerIssuance   { /* mint, burn, transfer, forcedTransfer, mintInitialSupply, isInitialSupplyMinted */ }
export interface ILedgerPurchase   { /* quotePurchase, paymentBalanceOf, paymentAllowanceOf, executePurchase */ }
export interface ILedgerSnapshot   { /* takeSnapshot, balanceOfAt, totalSupplyAt */ }
export interface ILedgerDistribution { /* profitPoolBalance, distributeBatch */ }
export interface ILedgerSettlement { /* setSettlementMode, isSettlementMode, setNavRate, navRate */ }
export interface ILedgerRead       { /* balanceOf, tokenInfo, waitReceipt */ }

export interface ILedgerPort extends
  ILedgerCompliance, ILedgerIssuance, ILedgerPurchase,
  ILedgerSnapshot, ILedgerDistribution, ILedgerSettlement, ILedgerRead {
  readonly chain: ChainKey;
}
```

`ILedgerPort` giữ nguyên tên và vẫn là thứ duy nhất tầng nghiệp vụ nhìn thấy, nên **không có chỗ nào phải sửa lời gọi hiện tại**.

### QĐ-2: Không có method liệt kê người nắm giữ

Đây là quyết định quan trọng nhất và dễ bị làm sai. Hợp đồng ERC-20 **không lưu danh sách người nắm giữ**, nó chỉ lưu bảng số dư theo địa chỉ. Không có cách nào đọc ra danh sách từ chuỗi bằng một lời gọi.

Vì vậy:
- `ILedgerPort` chỉ có `balanceOfAt(wallet, snapshotId)`, tức tra theo từng ví.
- Danh sách ví cần chia hoặc cần tất toán lấy từ **cơ sở dữ liệu** (bảng lệnh mua đã hoàn tất, bảng vị thế nhà đầu tư), và về sau từ **Indexer** khi IN-02 xong.
- BE-06 và BE-05 chịu trách nhiệm dựng danh sách này rồi truyền vào `distributeBatch`.

Nếu Kiro thấy cần một method kiểu `holdersAt`, **dừng lại và ghi câu hỏi mở**, đừng tự thêm rồi hiện thực bằng cách quét sự kiện trong adapter.

### QĐ-3: Chia lô do tầng nghiệp vụ quyết định

`distributeBatch` nhận sẵn một danh sách ví. Adapter không tự chia lô, vì:
- Kích thước lô phụ thuộc giới hạn tài nguyên của chuỗi, phải đo thực tế và cấu hình được.
- Việc chạy lại lô lỗi cần trạng thái trong cơ sở dữ liệu, mà adapter không có.

### QĐ-4: Báo giá không gọi nguồn tỷ giá

VNDB quy đổi 1:1 với VND. `quotePurchase(wptAmount)` chỉ nhân số lượng WPT với giá bán một WPT tính bằng VND. Giá này đọc từ hợp đồng khớp lệnh hoặc cấu hình, **không** gọi oracle tỷ giá.

### QĐ-5: `canTransfer` trả về đối tượng có lý do

```ts
type TransferCheck = { allowed: true } | { allowed: false; reason: string };
```

Không trả boolean đơn thuần, vì tầng giao diện cần hiện lý do cụ thể cho người dùng. Lý do là câu tiếng Việt đọc được, adapter chịu trách nhiệm dịch mã lỗi thô của hợp đồng.

### QĐ-6: Không để kiểu của `viem` lọt ra interface

Địa chỉ dùng `string` trong interface, adapter tự chuẩn hóa bằng `normalizeEvmAddress` có sẵn ở `lib/ledger/address.ts`. Không dùng kiểu địa chỉ riêng của `viem` ở chữ ký method, để tầng nghiệp vụ không phụ thuộc thư viện chuỗi.

## 2. Chữ ký method mới

```ts
// Phát hành một lần
mintInitialSupply(to: string, amount: bigint): Promise<TxResult>;
isInitialSupplyMinted(): Promise<boolean>;

// Khớp lệnh mua
quotePurchase(wptAmount: bigint): Promise<bigint>;
paymentBalanceOf(wallet: string): Promise<bigint>;
paymentAllowanceOf(owner: string): Promise<bigint>;
executePurchase(investor: string, wptAmount: bigint): Promise<TxResult>;

// Kiểm tra trước
canTransfer(from: string, to: string, amount: bigint): Promise<TransferCheck>;

// Chốt quyền
takeSnapshot(): Promise<{ tx: TxResult; snapshotId: number }>;
balanceOfAt(wallet: string, snapshotId: number): Promise<bigint>;
totalSupplyAt(snapshotId: number): Promise<bigint>;

// Chia lợi nhuận
profitPoolBalance(): Promise<bigint>;
distributeBatch(snapshotId: number, wallets: readonly string[]): Promise<TxResult>;

// Tất toán
setSettlementMode(enabled: boolean): Promise<TxResult>;
isSettlementMode(): Promise<boolean>;
setNavRate(rate: bigint): Promise<TxResult>;
navRate(): Promise<bigint>;
```

## 3. Ràng buộc mà `mock.adapter` phải giữ

Bảng này là danh sách test bắt buộc. Mock dễ tính hơn hợp đồng thật sẽ sinh loại lỗi chỉ xuất hiện trên chuỗi thật.

| Tình huống | Mock phải |
|---|---|
| Phát hành lần hai | từ chối |
| Khớp lệnh khi nhà đầu tư thiếu VNDB | từ chối, không chuyển WPT |
| Khớp lệnh khi thiếu ủy quyền | từ chối |
| Khớp lệnh khi ví thanh toán SPV thiếu WPT | từ chối, không trừ VNDB |
| Chuyển nhượng khi đang tất toán | từ chối |
| Đốt khi đang tất toán | cho phép |
| Chia khi ví lợi nhuận thiếu tiền | từ chối trước khi chuyển cho ai |
| Đọc số dư tại mã snapshot không tồn tại | từ chối với lý do rõ |
| Số lượng bằng 0 hoặc âm | từ chối, dùng `assertPositiveAmount` |

## 4. Tệp thay đổi

```
app/src/lib/ledger/ledger.port.ts     (sửa)  — tách interface, thêm 17 method, thêm TransferCheck
app/src/lib/ledger/evm.adapter.ts     (sửa)  — hiện thực bằng viem, mô phỏng trước khi gửi
app/src/lib/ledger/mock.adapter.ts    (sửa)  — hiện thực trong bộ nhớ, giữ đủ ràng buộc
app/src/lib/ledger/stellar.adapter.ts (sửa)  — ném LedgerNotImplementedError
app/src/lib/ledger/index.ts           (có thể sửa) — nếu factory cần thêm địa chỉ hợp đồng mới
packages/shared/src/abi/              (sửa)  — bổ sung giao diện hợp đồng khớp lệnh và ví lợi nhuận
packages/shared/src/addresses.ts      (sửa)  — bổ sung địa chỉ hợp đồng mới
app/test/mock-ledger.test.ts          (sửa)  — mở rộng theo bảng mục 3
```

## 5. Nếu hợp đồng chưa xong

BE-01 phụ thuộc SC-02 và SC-03. Nếu hai task đó chưa merge, làm theo thứ tự này để không bị chặn:

1. Định nghĩa interface và kiểu, hoàn chỉnh.
2. Hiện thực `mock.adapter` đầy đủ, kèm test.
3. Hiện thực `stellar.adapter` ném lỗi.
4. Để `evm.adapter` ném `LedgerNotImplementedError` tạm thời, ghi rõ trong checkpoint là nợ chờ hợp đồng.
5. Khi hợp đồng xong thì bổ sung `evm.adapter` trong một commit riêng.

Cách này cho các task khác bắt đầu được ngay, vì chúng chỉ cần interface và mock để phát triển.

## 6. Điểm cần chú ý

- `evm.adapter` hiện dùng hàm `fail()` để dịch mã lỗi thô của hợp đồng thành câu tiếng Việt. Thêm mã lỗi mới thì bổ sung vào đây, đừng để lỗi thô lọt ra giao diện.
- `takeSnapshot` trả về cả kết quả giao dịch và mã snapshot. Mã snapshot đọc từ sự kiện hợp đồng phát ra, không tự đoán bằng cách tăng số đếm.
- Mọi method ghi đều phải mô phỏng trước khi gửi, giữ đúng thói quen hiện có, để vi phạm tuân thủ báo lỗi ngay mà không tốn phí.
- Đừng sửa `assertPositiveAmount`, `LedgerError`, `DEFAULT_RECEIPT_TIMEOUT_MS`.
