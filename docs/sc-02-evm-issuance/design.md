# SC-02 — Thiết kế nối phát hành EVM

## 1. Quyết định

Mở rộng chính `ProjectToken`, không tạo `IssuanceCoordinator` mới.

Lý do: ProjectToken là nguồn sự thật của tổng cung, whitelist/freeze và vai MINTER. Đặt ví SPV cùng
hợp đồng làm phép “ghi ví + mint lần đầu” nguyên tử, không thêm một địa chỉ contract, một lần cấp
role và một điểm lỗi deploy. Trần kinh doanh vẫn ở bảng dự án vì đã là dữ liệu cấu hình của BE-12;
MINTER là vai đặc quyền của ngân hàng, còn contract khóa điều bất biến quan trọng nhất: mọi WPT phát
hành chính thức phải đi vào một SPV duy nhất.

## 2. Thay đổi hợp đồng

Trạng thái và API dự kiến:

```solidity
address public spvWallet;
bool public initialSupplyMinted;

event InitialSupplyMinted(
    address indexed spvWallet,
    uint256 amount,
    address indexed operator
);

function mintInitialSupply(address spv, uint256 amount)
    external
    onlyRole(MINTER_ROLE);

function mint(address to, uint256 amount)
    external
    onlyRole(MINTER_ROLE);
```

Thứ tự trong `mintInitialSupply`: kiểm input/cờ → gán ví và cờ → `_mint`. Nếu `_mint` revert do
whitelist/freeze thì EVM hoàn nguyên cả hai phép gán. `mint` kiểm đã khởi tạo và `to == spvWallet`
trước `_mint`.

Không suy `initialSupplyMinted` từ `totalSupply > 0`: Burn toàn bộ có thể đưa tổng cung về 0 nhưng
dự án vẫn đã đăng ký SPV; suy từ tổng cung sẽ mở lại lần khởi tạo thứ hai.

## 3. Mapping adapter

| `ILedgerPort` | Contract | Kết quả |
|---|---|---|
| `mintInitialSupply(to, amount)` | `ProjectToken.mintInitialSupply` | `TxResult PENDING` |
| `isInitialSupplyMinted()` | getter `initialSupplyMinted` | `boolean` |
| `spvWallet()` | getter `spvWallet` | zero address → `null`; còn lại địa chỉ chuẩn hoá |
| `mint(to, amount)` | `ProjectToken.mint` | contract tự chặn khác SPV |
| `burn(from, amount)` | `ProjectToken.agentBurn` | giữ nguyên |

Adapter phải phân biệt lỗi: đã khởi tạo, chưa khởi tạo, sai SPV, ví chưa whitelist/frozen và thiếu
MINTER/AGENT role. Không bắt message revert bằng chuỗi nếu có thể dùng custom error; nếu chuyển sang
custom error thì ABI tối giản phải có error tương ứng để viem giải mã.

## 4. Tệp dự kiến

| Loại | Tệp |
|---|---|
| Sửa contract | `packages/contracts-evm/contracts/tokens/ProjectToken.sol` |
| Sửa deploy/verify | `packages/contracts-evm/scripts/deploy.js`, `verify-deployment.js`, test deploy liên quan |
| Sửa ABI | `packages/shared/src/abi/project-token.ts`, ABI sinh trong `packages/shared/generated/` |
| Sửa adapter | `app/src/lib/ledger/evm.adapter.ts` |
| Sửa test | contract test SC-02, `app/test/evm-adapter.test.ts`, issuance/token-request test, E2E Hardhat |
| Tài liệu | checkpoint SC-02, báo cáo công nghệ, flow/marker report sinh lại |

`addresses.json` chỉ đổi khi deploy lại; không sửa tay. Nếu constructor không đổi thì địa chỉ
Hardhat giữ nguyên với cùng deployer/thứ tự deploy, dù bytecode thay đổi.

## 5. Bất biến và lỗi cạnh

- Burn toàn bộ không xóa `spvWallet` hay cờ đã khởi tạo.
- Whitelist SPV bị gỡ sau lần đầu: Mint sau phải revert qua hook hiện có.
- SPV bị freeze: Mint sau phải revert; adapter dịch đúng nguyên nhân.
- Hai tx `mintInitialSupply` tranh nhau: một tx thành công, tx còn lại revert theo cờ on-chain.
- Một tx Mint thành công nhưng app chết trước khi ghi DB: `issuance.service` phát hiện chuỗi đã phát
  hành nhưng bảng chưa có `issuedAt`, trả yêu cầu đối soát như hiện tại.

## 6. Kiểm thử

Contract test tối thiểu:

1. Lần đầu thành công, event/getter/số dư đúng.
2. Lần hai revert kể cả sau Burn tổng cung về 0.
3. `mint` trước khởi tạo và `mint` sang ví khác revert.
4. `mint` lần sau đúng SPV thành công.
5. Thiếu role, ví 0, amount 0, chưa whitelist, frozen đều revert và không ghi cờ.

Adapter/service:

- Ba method không còn ném `LedgerNotImplementedError` trên Hardhat.
- Maker–checker Mint hai đợt + Burn một phần qua receipt thật.
- Mutation: bỏ kiểm `to == spvWallet` ở contract thì test gọi trực tiếp phải đỏ.
- Mutation: suy cờ từ `totalSupply` thì test Burn hết rồi khởi tạo lại phải đỏ.

## 7. Triển khai

Đây là thay đổi bytecode không nâng cấp proxy; mỗi mạng phải deploy bộ contract mới, cập nhật registry
địa chỉ, cấp role và chạy verify trước khi trỏ web. Không thay ABI/address của một deployment cũ rồi
coi nó như contract mới. Checkpoint phải ghi chain ID, địa chỉ, commit bytecode và tx triển khai.
