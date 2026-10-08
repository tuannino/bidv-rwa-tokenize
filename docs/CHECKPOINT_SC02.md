# Báo cáo bàn giao — SC-02: Lập duyệt Mint/Burn chạy thật trên EVM

| | |
|---|---|
| Mã task | SC-02 |
| Nhánh | `feat/sc-02-evm-issuance`, đã rebase trên `dev` @ `bf94d84` sau OP-03 |
| Spec | `docs/sc-02-evm-issuance/{requirements,design,tasks}.md` |
| Mức kiểm chứng | Cao |
| Tiến độ | Hoàn thành Bước 0–6; chưa mở PR, chờ Supervisor nghiệm thu |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn) | | Bằng chứng |
|---|---|---|---|
| 1 | Contract chặn mint trước lần đầu, lần đầu lần hai và sai ví SPV | ✅ | mục 3.1 |
| 2 | Bộ cũ dùng helper, phép kiểm được bảo toàn, số ca không giảm | ✅ | mục 3.2, 4 |
| 3 | Gỡ ba marker SC-02; máy quét ra 18 điểm cắm, 10 điểm chặn | ✅ | mục 3.3 |
| 4 | Adapter được kiểm bằng node Hardhat thật qua `TEST_HARDHAT_RPC` | ✅ | mục 3.4 |
| 5 | Lập–duyệt Mint hai lần và Burn chạy trong project `hardhat` | ✅ | mục 3.5 |
| 6 | `/mint` từ chối EVM trước khi gửi; mock và script trình diễn đúng | ✅ | mục 3.6 |
| 7 | ABI, deploy, verify đồng bộ; nhận biết rõ contract cũ | ✅ | mục 3.7 |
| 8 | Hai đột biến đỏ thật; có DEVIATION cho việc sửa contract | ✅ | mục 2, 3.1 |
| 9 | Có tx hash, receipt và block của ca 6, 7, 8 | ✅ | mục 3.5 |
| 10 | Bộ mặc định và phần `evm` xanh | ✅ | mục 5 |

**Kết luận:** 10 ✅ · 0 🔶 · 0 ❌

### 0.2 Việc cần Owner quyết

- Không có việc chặn. SC-03 vẫn ở `planned`; mua/bán WPT trên EVM chưa chạy cho tới khi có hợp
  đồng khớp lệnh (mục 6).

---

## 1. Đã làm

- `ProjectToken` ghi bất biến ví SPV ở lần phát hành đầu, không suy trạng thái từ tổng cung; mọi lần
  mint sau chỉ vào đúng ví đó. Lỗi mới là custom error, lỗi tuân thủ cũ giữ nguyên.
- Helper dựng số dư phát hành vào SPV rồi chuyển hết sang nhà đầu tư; bốn bộ cũ dùng helper và bộ
  P4 được viết lại theo luật mới.
- Deploy cấp và kiểm `MINTER_ROLE` + `AGENT_ROLE` cho signer ứng dụng; ABI tối giản và ABI sinh tự
  động có getter, hàm, sự kiện và custom error mới.
- Adapter EVM nối `mintInitialSupply`, `isInitialSupplyMinted`, `spvWallet`; dịch lỗi có nguyên
  nhân, địa chỉ contract và hành động xử lý; nhận biết bytecode trước SC-02.
- Đường dữ liệu thử `/mint` chỉ chạy trên `mock`; đường chính thức là yêu cầu do Giao dịch viên lập,
  Kiểm soát viên duyệt rồi mới gọi `executeIssuance` hoặc Burn.
- Bổ sung E2E Hardhat cho Mint lần đầu, Mint bổ sung, vượt trần và Burn; bổ sung ca service duyệt
  đồng thời để khóa bất biến một yêu cầu chỉ phát đúng một giao dịch.

## 2. DEVIATION và sai lệch so với spec

### 2.1 Sửa contract đã qua kiểm thử — có chủ ý

`BASE_REF=origin/dev bash scripts/verify-arch-rules.sh` báo đúng phép chặn:

```text
FAIL  Contract bị sửa so với origin/dev (spec yêu cầu giữ nguyên, phải có DEVIATION):
      packages/contracts-evm/contracts/tokens/ProjectToken.sol
```

Đây là thay đổi cốt lõi được SC-02 yêu cầu: contract cũ cho `MINTER_ROLE` mint vào mọi địa chỉ,
không có cách đăng ký ví SPV và không phân biệt lần đầu. Phép kiểm thay thế gồm 8 ca riêng SC-02,
toàn bộ 75 ca contract, hai đột biến ở mục 3.1 và E2E Hardhat ở mục 3.5. Ba luật kiến trúc khác
vẫn đạt; không thêm tương tác viem ngoài adapter/script/test contract.

### 2.2 Tác động ngoài bảng tệp

- `app/test/evm-issuance.test.ts` được tạo ở Bước 4 rồi mở rộng ở Bước 5. Đây là tệp mới mà mục
  Tác động mô tả bằng nhóm “kiểm thử adapter với nút thật”, không phải mở rộng phạm vi.
- `docs/tech-report.md`, `.kiro/task-status.json`, `docs/TESTNET_SEPOLIA.md` và checkpoint là nghĩa
  vụ Bước 6/quy tắc dự án. Ba tệp spec được tiếp nhận nguyên văn từ gói giao việc.

## 3. Bằng chứng

### 3.1 Contract và hai phép đột biến

Lệnh bộ contract sau thay đổi:

```bash
bash scripts/run-local-all.sh contracts
# 75 passing
```

Hai đột biến được áp dụng riêng, chạy đúng ca bắt lỗi rồi hoàn nguyên:

| Đột biến | Lệnh đo | Kết quả thật |
|---|---|---|
| Bỏ `to == spvWallet` trong `mint` | `npx hardhat test --grep "không cho mint bổ sung sang ví khác SPV"` | 0 đạt, 1 không đạt |
| Thay cờ bằng `totalSupply > 0` | `npx hardhat test --grep "vẫn chặn phát hành lần đầu lần hai sau khi Burn hết"` | 0 đạt, 1 không đạt |

Sau khi hoàn nguyên, `npx hardhat test test/sc-02-issuance.test.js` → 8 đạt. Hai đột biến chứng
minh ca sai ví và ca Burn hết thật sự phụ thuộc vào hai bất biến mới, không chỉ đỏ do lỗi phụ.

### 3.2 Số ca trước/sau và dữ liệu dựng

| Mốc | Lệnh | Kết quả |
|---|---|---|
| Nền trước SC-02 | `bash scripts/run-local-all.sh contracts` trên nền `dev` trước Bước 1 | 67 đạt |
| Sau SC-02 | `bash scripts/run-local-all.sh contracts` | 75 đạt |

`seedProjectBalances` whitelist SPV thử, phát hành vào SPV, rồi chuyển đúng số cần sang nhà đầu tư;
số dư SPV trở về 0. `full-cycle`, `oracle-cycle`, P7 và P12 chỉ đổi phần dựng. Riêng ca
`full-cycle` kiểm ví chưa KYC chuyển từ `mint` sang `mintInitialSupply` vì luật SPV mới chặn
`mint` sớm hơn; thông báo tuân thủ và ý nghĩa phép kiểm giữ nguyên.

### 3.3 Marker

```bash
node scripts/scan-pending.mjs --check
# Marker hợp lệ: 18 điểm cắm, 10 điểm chặn, 35 bước luồng. Không có lỗi.

grep -R "@blocked SC-02" app/src packages scripts
# không có kết quả
```

Ba điểm chặn SC-02 ở adapter đã được gỡ; marker SC-03/SC-04/SC-05 giữ nguyên.

### 3.4 Adapter và service trên node thật

```bash
bash scripts/evm-local.sh reset
cd app
TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest run test/evm-issuance.test.ts
# 9 passed, 1 skipped
```

Ca bỏ qua là kiểm tương thích contract cũ, chỉ bật khi có thêm `TEST_OLD_HARDHAT_RPC`. Ở Bước 4,
hai node được dựng bằng `npx hardhat node` + `deploy.js`; đặt cả hai biến cho kết quả 8/8 lúc đó:
ba getter/phương thức trước và sau lần đầu, lỗi custom mới, lỗi hook cũ và thông báo contract cũ
đều đúng. Lượt cuối còn kiểm `/mint` không tăng block và `Promise.all` hai lần duyệt chỉ có một
kết quả thành công, một `REQUEST_STATE`, block chỉ tăng một và sổ giao dịch chỉ có một dòng mint.

### 3.5 E2E maker–checker trên Hardhat (ca 6, 7, 8)

`bash scripts/run-local-all.sh evm` chạy app bằng bản build riêng với chain mặc định
`hardhat-local`; project `hardhat` có 15 đạt, 2 bỏ qua (hai ca direct-mint dành riêng cho mock).

| Ca | Kết quả | Mã giao dịch | Receipt | Block |
|---|---|---|---|---|
| 6 — Mint lần đầu 1.000 WPT vào NB001 | tổng cung và số dư SPV tăng đúng | `0x7c106940c4a75c8b03f1add55f303d5ac60b844345efb8205b56124a431c2756` | `0x1` | 7 |
| 7 — Mint bổ sung 250 WPT | cùng SPV; yêu cầu vượt trần 20.000.000 bị chặn, không tăng block | `0xc733f43e9f2ba3a7431df06ad21712cf3160eb6760bb751d73c8af0cb8065476` | `0x1` | 8 |
| 8 — Burn 300 WPT chưa phân phối | tổng cung và số dư SPV giảm đúng | `0xa1bc17bea9cb66f53f4300569789b789aac98c2fabdb25054f2e30f1d557d5a8` | `0x1` | 9 |

### 3.6 Đường dữ liệu thử và script

- `mintToInvestorDirect` kiểm chain sau quyền/cấu hình nhưng trước `getLedger().mint`; EVM trả đúng
  `Đường dữ liệu thử chỉ chạy trên mock; phát hành chính thức qua luồng lập duyệt.` và không tăng
  block/không ghi transaction. Chú thích trong mã ghi rõ lệch có chủ ý; mock giữ hành vi cũ.
- `scripts/demo-mint.mjs` mặc định `mock`; nếu chọn EVM thì dừng và dẫn sang màn lập–duyệt.
- `demo-cycle.js`, `demo-oracle.js`, `dod-verify-sepolia.js` dựng số dư qua SPV rồi chuyển đi.

### 3.7 Deploy, ABI và contract cũ

- `bash scripts/evm-local.sh reset` triển khai ở chainId 31337; `ProjectToken` giữ địa chỉ
  `0x5FbDB2315678afecb367f032d93F642f64180aa3`, signer có `MINTER_ROLE` và `AGENT_ROLE`.
- `verify-deployment.js` đọc được `initialSupplyMinted`, `spvWallet`, `isWhitelisted`; đối với
  bytecode từ nền `e4dd889`, script dừng với: `Bộ hợp đồng là bản trước SC-02, cần triển khai lại.`
- `app/test/abi-contract-sync.test.ts` đối chiếu ABI tối giản với ABI sinh tự động trong bộ mặc định.

## 4. Đối chiếu bộ P4

| Ca P4 | Sau SC-02 | Ý nghĩa được giữ |
|---|---|---|
| P4-1, P4-2, P4-3 | Không đổi | Whitelist và quyền AGENT |
| P4-4 | `mintInitialSupply` vào SPV đã whitelist | Số dư nhận và tổng cung tăng |
| P4-5 | `mintInitialSupply` vào SPV chưa whitelist | Hook KYC chặn, cờ vẫn false |
| P4-6 | Gọi từ ví thiếu `MINTER_ROLE` | Kiểm quyền MINTER |
| P4-7 | Khởi tạo rồi `mint(spv, 0)` | Mint 0 giữ tổng cung |
| P4-8 | `mintInitialSupply` vào SPV bị đóng băng | Hook freeze chặn, cờ vẫn false |
| P4-9 | `mintInitialSupply` khi pause | Hook pause chặn, cờ vẫn false |
| P4-10 đến P4-13 | Chỉ dựng số dư qua helper SPV | Phép kiểm transfer/burn/forcedTransfer giữ nguyên |
| P4-14, P4-15 | Không đổi | Decimals và ký hiệu token |

## 5. Kết quả chạy cuối

| Lệnh | Kết quả |
|---|---|
| `bash scripts/run-local-all.sh` | Mã thoát 0; contracts 75 đạt; app 790 đạt, 10 integration bỏ qua khi không đặt RPC; marker 18/10 |
| `bash scripts/run-local-all.sh evm` | Mã thoát 0; project Hardhat 15 đạt, 2 bỏ qua; node và app được dọn |
| `TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest run test/evm-issuance.test.ts` | 9 đạt, 1 bỏ qua |
| `node scripts/check-checkpoint.mjs docs/CHECKPOINT_SC02.md docs/sc-02-evm-issuance/requirements.md` | ĐẠT, đủ 10 điều kiện |
| `BASE_REF=origin/dev bash scripts/verify-arch-rules.sh` | Chỉ phép contract đỏ có chủ ý, đã ghi DEVIATION mục 2.1 |

## 6. Giới hạn và việc kế tiếp

- SC-02 chỉ hoàn tất phát hành/đốt trên EVM. `SC-03` vẫn bị chặn và ở `planned`; các method
  `quotePurchase`, `setPurchasePrice`, `paymentAllowanceOf`, `executePurchase`, `executeSale` chưa
  có contract khớp lệnh, nên mua/bán trên EVM chưa chạy.
- Contract Sepolia hiện tại là bản trước SC-02. Không gọi luồng phát hành thật lên bản đó; OP-04
  phải triển khai lại, verify và cập nhật địa chỉ trước khi thử trên testnet.
- Không làm SC-03, OP-04, vault, đổi ví SPV, Fireblocks hoặc tuyên bố sẵn sàng production trong task này.
