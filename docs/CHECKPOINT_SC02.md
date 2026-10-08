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

Lượt rà soát 08/10 xác nhận phép chặn sửa contract so với `origin/dev` vẫn đỏ đúng
`ProjectToken.sol`; lệnh và toàn bộ đầu ra ở [chi tiết §2](CHECKPOINT_SC02_DETAIL.md#2-kiểm-luật-kiến-trúc-với-nền-dev).

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

Rà soát lại ngày 08/10/2026. Thư mục chạy: `packages/contracts-evm`.
Mỗi đột biến được áp dụng riêng lên mã gốc; mã gốc được khôi phục sau mỗi lượt, kể cả khi lệnh lỗi.

**Đột biến 1:** bỏ dòng `if (to != spvWallet) revert MintTargetNotSpv(to, spvWallet);` trong `mint`.

```bash
npx hardhat test test/sc-02-issuance.test.js --grep "mint thường bị chặn trước lần đầu và khi nhắm ví khác SPV"
```

Đầu ra nguyên văn (stdout và stderr), mã thoát 1:

```text
◇ injected env (0) from .env // tip: ⌁ auth for agents [www.vestauth.com]
Compiled 4 Solidity files successfully (evm target: paris).


  SC-02 - Phát hành EVM khóa theo ví SPV
    1) mint thường bị chặn trước lần đầu và khi nhắm ví khác SPV


  0 passing (379ms)
  1 failing

  1) SC-02 - Phát hành EVM khóa theo ví SPV
       mint thường bị chặn trước lần đầu và khi nhắm ví khác SPV:
     AssertionError: Expected transaction to be reverted with custom error 'MintTargetNotSpv', but it didn't revert
      at Context.<anonymous> (test/sc-02-issuance.test.js:44:5)



```

**Đột biến 2:** đổi `if (initialSupplyMinted)` thành `if (totalSupply() > 0)` ở chặn lần đầu.

```bash
npx hardhat test test/sc-02-issuance.test.js --grep "lần đầu chỉ chạy một lần, kể cả sau khi đốt hết"
```

Đầu ra nguyên văn (stdout và stderr), mã thoát 1:

```text
◇ injected env (0) from .env // tip: ◈ secrets for agents [www.dotenvx.com]
Compiled 4 Solidity files successfully (evm target: paris).


  SC-02 - Phát hành EVM khóa theo ví SPV
    1) lần đầu chỉ chạy một lần, kể cả sau khi đốt hết


  0 passing (316ms)
  1 failing

  1) SC-02 - Phát hành EVM khóa theo ví SPV
       lần đầu chỉ chạy một lần, kể cả sau khi đốt hết:
     AssertionError: Expected transaction to be reverted with custom error 'InitialSupplyAlreadyMinted', but it didn't revert
      at Context.<anonymous> (test/sc-02-issuance.test.js:29:5)



```

**Sau hoàn nguyên:** không giữ thay đổi Solidity nào của lượt rà soát này.

```bash
npx hardhat test test/sc-02-issuance.test.js
```

Đầu ra nguyên văn (stdout và stderr), mã thoát 0:

```text
◇ injected env (0) from .env // tip: ⌘ override existing { override: true }
Compiled 4 Solidity files successfully (evm target: paris).


  SC-02 - Phát hành EVM khóa theo ví SPV
    ✔ lần đầu ghi ví, cờ, số dư và phát đúng sự kiện (327ms)
    ✔ lần đầu chỉ chạy một lần, kể cả sau khi đốt hết
    ✔ mint thường bị chặn trước lần đầu và khi nhắm ví khác SPV
    ✔ thiếu MINTER_ROLE không được phát hành và không ghi cờ
    ✔ ví 0 và số lượng 0 bị chặn bằng custom error, không ghi cờ
    ✔ ví chưa whitelist bị hook chặn và hoàn nguyên ví/cờ
    ✔ ví bị đóng băng bị hook chặn và hoàn nguyên ví/cờ
    ✔ token tạm dừng bị hook chặn và hoàn nguyên ví/cờ


  8 passing (362ms)

```

### 3.2 Số ca trước/sau và dữ liệu dựng

Mốc trước SC-02 ghi trong bàn giao trước là 67 ca; đây là số liệu lịch sử, không phải
lượt đo mới ngày 08/10. Bộ sau SC-02 được chạy lại trong bộ mặc định ở mục 5, có đầu ra nguyên văn.

`seedProjectBalances` whitelist SPV thử, phát hành vào SPV, rồi chuyển đúng số cần sang nhà đầu tư;
số dư SPV trở về 0. `full-cycle`, `oracle-cycle`, P7 và P12 chỉ đổi phần dựng. Riêng ca
`full-cycle` kiểm ví chưa KYC chuyển từ `mint` sang `mintInitialSupply` vì luật SPV mới chặn
`mint` sớm hơn; thông báo tuân thủ và ý nghĩa phép kiểm giữ nguyên.

### 3.3 Marker

Máy quét marker được chạy trong bộ mặc định ở mục 5; đầu ra nguyên văn nằm ở chi tiết §3.
Ba điểm chặn SC-02 ở adapter đã được gỡ; marker SC-03/SC-04/SC-05 giữ nguyên.

### 3.4 Adapter và service trên hai node thật

Rà soát 08/10/2026: bytecode cũ lấy từ snapshot `e4dd889`, triển khai ở 8545;
bytecode mới dựng bằng script chính thức ở 8645. Nhật ký triển khai ở
[chi tiết §1](CHECKPOINT_SC02_DETAIL.md#1-dựng-hai-nút-hardhat).
Môi trường máy này có proxy; đặt `NO_PROXY` và `no_proxy` thành `127.0.0.1,localhost`
để RPC loopback đi trực tiếp. Thư mục chạy kiểm thử: `app`.

```bash
TEST_HARDHAT_RPC=http://127.0.0.1:8645 TEST_OLD_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest run test/evm-issuance.test.ts
```

Đầu ra nguyên văn (stdout và stderr), mã thoát 0:

```text

 RUN  v3.2.4 /home/tuanlh/.codex/worktrees/03a6/bidv-rwa-tokenize/app

 ✓ test/evm-issuance.test.ts (10 tests) 5816ms
   ✓ SC-02 — EVM issuance adapter trên Hardhat thật > dịch lỗi phát hành nguồn cung ban đầu lần hai và giữ lỗi gốc  1093ms
   ✓ SC-02 — EVM issuance adapter trên Hardhat thật > dịch lỗi phát hành bổ sung sai ví SPV và giữ lỗi gốc  1085ms
   ✓ SC-02 — EVM issuance adapter trên Hardhat thật > dịch lỗi hook tuân thủ khi ví SPV bị đóng băng  1118ms
   ✓ SC-02 — EVM issuance adapter trên Hardhat thật > dịch lỗi ví vận hành thiếu MINTER_ROLE  1085ms
   ✓ SC-02 — nhận biết ProjectToken cũ > báo triển khai lại thay vì trả lỗi ABI/RPC khó hiểu  1077ms

 Test Files  1 passed (1)
      Tests  10 passed (10)
   Start at  08:51:22
   Duration  6.55s (transform 333ms, setup 0ms, collect 486ms, tests 5.82s, environment 0ms, prepare 132ms)

```

Ca contract cũ thực sự chạy, không bỏ qua. `oldSc02Contract` nhận thêm reason khớp
`/function selector was not recognized/i` của Hardhat; vẫn chỉ áp dụng cho các thao tác mới SC-02.
Bộ này còn kiểm `/mint` không tăng block và hai lần duyệt đồng thời chỉ phát một giao dịch.

### 3.5 E2E maker–checker trên Hardhat (ca 6, 7, 8)

Bằng chứng E2E giữ lại từ checkpoint trước lượt rà soát 08/10 (không chạy lại ở lượt sửa này):
app dùng bản build riêng với chain `hardhat-local`; project `hardhat` ghi nhận 15 đạt,
2 bỏ qua dành riêng cho mock. Các receipt dưới đây là bằng chứng lịch sử, không phải giao dịch mới.

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

- Lượt triển khai mới ngày 08/10 ở cổng 8645 dùng chainId 31337; `ProjectToken` giữ địa chỉ
  `0x5FbDB2315678afecb367f032d93F642f64180aa3`, signer có `MINTER_ROLE` và `AGENT_ROLE`.
- Bằng chứng script kiểm triển khai ở checkpoint trước vẫn là lịch sử. Lượt rà soát này kiểm
  tương thích bytecode `e4dd889` trực tiếp bằng adapter, đủ 10 ca ở mục 3.4.
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

Lượt sửa phản hồi Supervisor ngày 08/10 chỉ đổi nhận diện lỗi contract cũ và bổ sung bằng chứng.
Hai đột biến và bộ adapter đã chạy lại ở mục 3.1, 3.4. Bộ mặc định chạy một lần cuối;
lệnh và đầu ra nguyên văn ở [chi tiết §3](CHECKPOINT_SC02_DETAIL.md#3-bộ-kiểm-chứng-mặc-định).
Lượt mặc định trả mã 1 vì bảng marker lệch số dòng; đã sinh lại báo cáo và chạy lại
Vitest: 790 đạt, 10 RPC bỏ qua (đã kiểm riêng đủ 10/10 ở mục 3.4). Contracts 75 ca,
typecheck, lint và các phép kiểm mặc định khác đều xanh trong lượt mặc định.
Phép kiểm checkpoint và đầu ra ở chi tiết §4. Kiểm E2E của vòng triển khai trước giữ ở mục 3.5.

Cập nhật báo cáo công nghệ: metadata phiên bản 4.0 và mục 4.3 mô tả nhận diện revert của Hardhat.
Đã cập nhật `.kiro/steering/efficiency.md` §4 theo chỉ định Owner: từ nay mọi lệnh
trong checkpoint phải đã chạy, đầu ra dán nguyên văn và kèm mã thoát. Các khối đầu ra được lấy trực tiếp từ nhật ký lệnh,
không thay bằng chú thích hoặc số liệu gõ lại. Nhật ký dài tách sang tệp chi tiết.

## 6. Giới hạn và việc kế tiếp

- SC-02 chỉ hoàn tất phát hành/đốt trên EVM. `SC-03` vẫn bị chặn và ở `planned`; các method
  `quotePurchase`, `setPurchasePrice`, `paymentAllowanceOf`, `executePurchase`, `executeSale` chưa
  có contract khớp lệnh, nên mua/bán trên EVM chưa chạy.
- Contract Sepolia hiện tại là bản trước SC-02. Không gọi luồng phát hành thật lên bản đó; OP-04
  phải triển khai lại, verify và cập nhật địa chỉ trước khi thử trên testnet.
- Không làm SC-03, OP-04, vault, đổi ví SPV, Fireblocks hoặc tuyên bố sẵn sàng production trong task này.
