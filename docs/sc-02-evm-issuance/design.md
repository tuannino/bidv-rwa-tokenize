# SC-02: Thiết kế nối phát hành EVM

> Dựa trên bản đề xuất ở `feat/account-info` @ `e7990cd`. Đã giữ quyết định chính, bỏ ký tự đặc
> biệt, thêm mục 7 về quan hệ với đợt 6.

## 1. Quyết định

Mở rộng chính `ProjectToken`, **không** tạo hợp đồng điều phối phát hành riêng.

`ProjectToken` đã là nguồn sự thật của tổng cung, whitelist, đóng băng và vai `MINTER_ROLE`. Đặt ví
SPV trong cùng hợp đồng thì "ghi ví và mint lần đầu" là một giao dịch nguyên tử, không thêm địa chỉ
hợp đồng, không thêm lần cấp vai, không thêm một điểm lỗi khi triển khai. Trần phát hành vẫn ở bảng
dự án như BE-12. Hợp đồng khoá bất biến quan trọng nhất: **mọi WPT phát hành chính thức đi vào đúng
một ví SPV**.

## 2. Thay đổi hợp đồng

```solidity
address public spvWallet;
bool public initialSupplyMinted;

event InitialSupplyMinted(address indexed spvWallet, uint256 amount, address indexed operator);

error InitialSupplyAlreadyMinted();
error InitialSupplyNotMinted();
error MintTargetNotSpv(address to, address spv);
error ZeroAddress();          // chỉ ở mintInitialSupply
error ZeroAmount();           // chỉ ở mintInitialSupply; mint 0 sau lần đầu giữ hành vi cũ (P4-7)

function mintInitialSupply(address spv, uint256 amount) external onlyRole(MINTER_ROLE);
function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE);
```

Thứ tự trong `mintInitialSupply`: kiểm dữ liệu vào và cờ, gán ví và cờ, rồi `_mint`. Ví chưa
whitelist, bị đóng băng, hoặc token đang tạm dừng do **hook `_update` hiện có** chặn, giữ nguyên thông
báo chuỗi cũ (`phat hanh cho vi chua KYC`, `ben nhan bi bang`, `token dang tam dung`); `_mint` revert
thì EVM hoàn nguyên cả hai phép gán. Không thêm custom error trùng việc với hook, để không có hai thông
báo cho cùng một nguyên nhân. `mint` kiểm đã khởi tạo và `to == spvWallet` trước `_mint`.

## 3. Ánh xạ adapter

| `ILedgerPort` | Hợp đồng | Kết quả |
|---|---|---|
| `mintInitialSupply(to, amount)` | `ProjectToken.mintInitialSupply` | `TxResult` `PENDING` |
| `isInitialSupplyMinted()` | getter `initialSupplyMinted` | `boolean` |
| `spvWallet()` | getter `spvWallet` | địa chỉ 0 thành `null`; còn lại địa chỉ chuẩn hoá |
| `mint(to, amount)` | `ProjectToken.mint` | hợp đồng tự chặn khác SPV |
| `burn(from, amount)` | `ProjectToken.agentBurn` | giữ nguyên |

Adapter phân biệt và dịch: đã khởi tạo, chưa khởi tạo, sai SPV, thiếu vai (custom error, giải mã
qua ABI); ví chưa whitelist, bị đóng băng, tạm dừng (lỗi chuỗi cũ của hook, so đúng ba chuỗi đã biết);
hàm không tồn tại vì bộ hợp đồng là bản trước SC-02 (báo cần triển khai lại).

## 4. Bất biến và lỗi cạnh

- Burn hết không xoá `spvWallet` và không xoá cờ.
- Ví SPV bị gỡ whitelist hoặc bị đóng băng sau lần đầu: mint sau revert qua hook đã có, adapter dịch
  đúng nguyên nhân.
- Hai giao dịch `mintInitialSupply` tranh nhau: một thành công, một revert theo cờ trên chuỗi.
- Mint thành công nhưng ứng dụng chết trước khi ghi cơ sở dữ liệu: `issuance.service` phát hiện chuỗi
  đã phát hành mà bảng chưa có `issuedAt`, trả yêu cầu đối soát như hiện có.

## 5. Kiểm thử

Hợp đồng: các ca 1 tới 4 của `requirements.md`, cộng bộ P4 viết lại (việc 7) và bốn tệp đổi dữ liệu
dựng (việc 6). Adapter với nút thật: ca 5. Đầu cuối hardhat: ca 6 tới 10, trong project `hardhat`
của OP-03.

## 6. Triển khai

Đổi bytecode, không dùng proxy nâng cấp. Mỗi mạng phải triển khai bộ hợp đồng mới, cập nhật
`addresses.json`, cấp vai, chạy kiểm triển khai **trước khi** trỏ ứng dụng sang. Không giữ địa chỉ cũ
rồi coi như hợp đồng mới. Checkpoint ghi chain ID, địa chỉ, commit của bytecode và mã giao dịch
triển khai. Với hardhat, địa chỉ giữ nguyên nếu constructor và thứ tự triển khai không đổi.

## 7. Quan hệ với các đợt sau

- **Đợt 6 (Fireblocks, IN-03 và IN-04):** địa chỉ ký của Fireblocks sẽ cần `MINTER_ROLE` và `AGENT_ROLE`. Thiết kế
  này không giả định khoá ký là người triển khai, nên chỉ cần cấp vai thêm.
- **Đợt 6 (vault, SC-07):** ví thanh toán SPV sẽ thành hợp đồng vault. `spvWallet` ghi ở lần đầu là
  địa chỉ ví hiện tại. Cách chuyển sang vault quyết định ở DS-01 (phương án nghiêng về triển khai lại
  bộ hợp đồng trên testnet). SC-02 **không** thêm hàm đổi ví, vì một hàm như vậy làm yếu đúng bất biến
  task này dựng lên.
