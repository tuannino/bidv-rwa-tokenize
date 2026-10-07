# SC-02 — Nối Mint/Burn maker–checker xuống EVM

| | |
|---|---|
| Trạng thái | **Đề xuất** — chờ Owner duyệt trước khi chuyển `inProgress` |
| Nhánh đề xuất | `feat/sc-02-evm-issuance`, tạo từ `dev` sau khi nhánh FE-24/demo đã merge |
| Phụ thuộc | BE-12, FE-22; không phụ thuộc SC-03 |
| Mức kiểm chứng | **Cao** — phát hành và huỷ tài sản thật trên EVM |

## 1. Mục tiêu

Đưa đúng luồng hiện có **GDV lập → KSV duyệt → Mint/Burn** từ adapter `mock` xuống
`hardhat-local` và `evm`, không mở lại đường phát hành trực tiếp. Lần Mint đầu đăng ký ví thanh toán
SPV; các lần sau chỉ mint vào đúng ví đó và vẫn chịu trần còn lại của BE-12.

## 2. Hiện trạng đã đo

- `ProjectToken` có `mint` và `agentBurn`, nhưng chưa lưu ví SPV hay mốc phát hành đầu tiên.
- `evm.adapter.ts` còn đúng 3 marker `@blocked SC-02`: `mintInitialSupply`,
  `isInitialSupplyMinted`, `spvWallet`.
- `mint` và `burn` đã gọi được EVM; `issuance.service.ts` đã phân nhánh lần đầu/lần sau và kiểm trần
  từ bảng dự án; `token-request.service.ts` đã có maker–checker và chống duyệt hai lần.
- Hợp đồng hiện cho `MINTER_ROLE` gọi `mint` vào mọi địa chỉ; đây là đường có thể bỏ qua ví SPV nếu
  giữ nguyên khi nối luồng chính thức.

Lệnh đo lại trước khi bắt đầu:

```bash
rg -n "@blocked SC-02" app/src/lib/ledger/evm.adapter.ts
rg -n "function (mint|agentBurn)" packages/contracts-evm/contracts/tokens/ProjectToken.sol
```

## 3. Yêu cầu chức năng

### R1 — Trạng thái phát hành nằm trên chuỗi

1. `ProjectToken` lưu `spvWallet` và cờ `initialSupplyMinted`.
2. `mintInitialSupply(spv, amount)` chỉ chạy một lần, từ chối ví 0, số lượng 0, ví chưa whitelist
   hoặc ví bị đóng băng.
3. Giao dịch đầu tiên phải **nguyên tử**: chỉ ghi cờ/ví nếu mint thành công; revert thì mọi trạng
   thái giữ nguyên.
4. Phát sự kiện có ví SPV, số lượng và người thực hiện để đối soát.

### R2 — Phát hành nhiều lần theo BE-12

1. Sau lần đầu, `mint(to, amount)` chỉ chấp nhận `to == spvWallet`.
2. Không cho gọi `mint` trước `mintInitialSupply`; không có tổng cung “mồ côi” mà chưa biết ví SPV.
3. Trần phát hành tiếp tục lấy từ bảng dự án và được kiểm lại ngay trước khi gửi giao dịch như BE-12;
   SC-02 không khai thêm một trần khác trong adapter.
4. Burn phần chưa phân phối tiếp tục gọi `agentBurn(spvWallet, amount)`; Burn toàn bộ chỉ được chạy
   khi nghiệp vụ BE-12 xác nhận không còn token lưu hành.

### R3 — Adapter EVM đầy đủ

1. `mintInitialSupply`, `isInitialSupplyMinted`, `spvWallet` gọi ABI thật và không còn
   `pendingContract`.
2. `spvWallet()` trả `null` trước lần đầu, địa chỉ chuẩn hoá sau lần đầu.
3. Lỗi revert được dịch thành thông báo có hành động, địa chỉ contract và nguyên nhân; không lộ lỗi
   viem thô lên giao diện.
4. Ba marker `@blocked SC-02` được gỡ; không gỡ marker của SC-03/04/05.

### R4 — Deploy và một nguồn ABI/địa chỉ

1. Cập nhật deploy script, ABI tối giản và ABI sinh tự động; không hardcode địa chỉ trong `app/src`.
2. Giữ thứ tự deploy hiện tại để địa chỉ hardhat tất định không đổi ngoài lý do có tài liệu.
3. Script kiểm deployment xác nhận vai `MINTER_ROLE`/`AGENT_ROLE`, whitelist SPV và ba phép đọc mới.
4. Cấu hình Sepolia cũ phải fail rõ nếu bytecode/ABI chưa có các hàm SC-02, không được âm thầm coi
   là chưa phát hành.

### R5 — Luồng nghiệm thu

Trên `hardhat-local`, thực hiện qua service/UI thật:

1. GDV whitelist SPV.
2. GDV lập Mint lần một; KSV duyệt; tổng cung và số dư SPV tăng đúng.
3. GDV lập Mint lần hai vào cùng SPV; KSV duyệt; tổng cung tăng tiếp nhưng không vượt trần.
4. Mint vào SPV khác bị chặn trước khi gửi; gọi contract trực tiếp cũng revert.
5. GDV lập Burn phần chưa phân phối; KSV duyệt; tổng cung và số dư SPV giảm đúng.
6. Hai lần duyệt đồng thời vẫn chỉ tác động một lần — giữ bất biến BE-12.

## 4. Yêu cầu phi chức năng

- Không gọi viem/ethers ngoài adapter/deploy/test contract.
- Không đưa kiểu viem vào `ILedgerPort`; số lượng vẫn là `bigint`, qua biên UI vẫn là chuỗi.
- Mọi thao tác ký của app đi qua `ISigner`; test contract có thể dùng signer Hardhat.
- Mọi tx lưu `PENDING` trước khi đợi receipt như `trackTxn()` hiện tại.
- Không giảm bộ test P4/BE-12 hiện có; test cũ không còn hợp lệ phải được đổi bằng lý do cụ thể.

## 5. Điều kiện hoàn thành

- [ ] Ba marker SC-02 bằng 0; báo cáo marker sinh lại hợp lệ.
- [ ] Mint lần đầu và lần sau trên Hardhat chạy đúng ví SPV qua maker–checker.
- [ ] Contract chặn mint trước khởi tạo, mint lần đầu lần hai và mint sang ví khác.
- [ ] Burn phần chưa phân phối trên Hardhat chạy đầu cuối.
- [ ] ABI, deploy, addresses và kiểm deployment đồng bộ.
- [ ] Test contract, adapter, service và E2E Hardhat xanh.
- [ ] `bash scripts/run-local-all.sh` xanh; build và E2E nặng chạy riêng theo OP-01.
- [ ] Checkpoint nêu rõ giao dịch/receipt Hardhat và, nếu có, Sepolia.

## 6. Không làm

- Không làm hợp đồng mua/bán; thuộc SC-03.
- Không đổi maker–checker, vai GDV/KSV hay quyền hiện tại.
- Không bật `ENABLE_DEMO_TOKEN_MINT` mặc định.
- Không đưa khóa riêng vào client hay tài liệu.
- Không tuyên bố production-ready: AU-01, quản lý khóa và quy trình triển khai production vẫn riêng.
