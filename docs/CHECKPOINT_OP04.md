# Báo cáo bàn giao — OP-04: triển khai lại Sepolia sau SC-02

| | |
|---|---|
| Mã task | OP-04 |
| Nhánh | `ops/04-sepolia`, từ `dev` @ `dd015a1` (SC-02, PR #42) |
| Spec | `docs/op-04-sepolia/{requirements,tasks}.md`, gói 20261008_spec_OP04_IN03_DS01.zip |
| Mức kiểm chứng | Vừa |
| Tiến độ | Bước 0–3 đã thực hiện; chờ ba giao dịch local và kiểm Cloudflare; giữ `inProgress`, chưa mở PR |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện | Trạng thái | Bằng chứng |
|---|---|---|---|
| 1 | Script cấp phí, đúng ca 1, có kiểm thử | ✅ | mục 2.1; chi tiết 2 |
| 2 | Preflight kiểm phí ví ký và in lệnh cấp phí | ✅ | mục 2.2; chi tiết 2, 3 |
| 3 | Sepolia triển khai lại, địa chỉ evm đã commit, verify trạng thái đầu | ✅ | mục 3.1 |
| 4 | Ví SPV thử riêng Sepolia, không dùng ví mẫu | ✅ | mục 3.2 |
| 5 | Ba giao dịch Mint/Mint/Burn trên Sepolia có Etherscan | 🔶 | mục 3.3 |
| 6 | Bản deploy chọn Sepolia, smoke xanh, thử lập–duyệt được ghi lại | 🔶 | mục 3.4 |
| 7 | Runbook Sepolia và bảng biến Cloudflare đúng hiện trạng | ✅ | mục 2.3 |
| 8 | Không bí mật trong lịch sử commit nhánh | ✅ | mục 4.2 |
| 9 | Bộ kiểm chứng mặc định xanh | ✅ | mục 4.1 |

**Kết luận:** 7 ✅ · 2 🔶 · 0 ❌

### 0.2 Việc cần Owner quyết / thực hiện

- Chủ dự án chạy các bước có khóa và Cloudflare theo runbook, trả output không chứa bí mật.
- Owner đã triển khai và whitelist SPV; tiếp tục app bản build để lập–duyệt ba giao dịch tại runbook mục 5.
- Không đổi DB khi gặp isolate; ghi kết quả thử và đề xuất theo spec. Bước 5 thực hiện sau merge.

## 1. Phạm vi và hiện trạng đo lại

Đã tiếp nhận nguyên văn spec OP-04, kế hoạch giao việc bản 4 và quyết định kiến trúc DS-01 từ gói đính kèm.
Chỉ thực thi OP-04; không thực hiện IN-03 hay xây vault/khớp lệnh.
Commit đầu chuyển đúng OP-04 sang `inProgress`.

Mốc đo ban đầu: bộ Sepolia ngày 10/09/2026 không có getter SC-02. Sau đó Owner đã triển khai
bộ mới ngày 08/10/2026; tệp địa chỉ được deploy script ghi, ABI không đổi vì SC-02 đã đồng bộ.
Lệnh đo và đầu ra nguyên văn ở [chi tiết mục 1](CHECKPOINT_OP04_DETAIL.md#1-đo-lại-hiện-trạng).

## 2. Phần chuẩn bị đã thực hiện

### 2.1 Cấp phí

`fund-sepolia.js` chạy bằng Node, nhận địa chỉ và một trong số dư ETH cần có hoặc tên thao tác.
Chỉ bù chênh lệch, không gửi khi đủ, không tạo signer khi dry-run; chặn sai chain và ví mẫu
trong nguồn chung cộng Hardhat #0. Dùng ethers/transport RPC hiện có, không thêm thư viện.

Gas được đo từ bytecode trên Hardhat nội bộ trong tiến trình riêng cưỡng chế network hardhat;
không gửi giao dịch Sepolia để ước lượng. Giá trần lấy lúc chạy, dự phòng 20%, tính BigInt và làm
tròn lên. Có deploy, whitelist, mint-initial, mint, burn, cycle. Đo nội bộ không ghi địa chỉ shared.

Đã thử đơn vị và dry-run RPC thật với **địa chỉ deployer cũ công khai**, không dùng hay xin khóa.
Đó chỉ là kiểm công cụ, không xác nhận ví ký cho triển khai OP-04. Lượt đầu ethers kết nối trực tiếp
không qua proxy bị lỗi; đã dùng transport sẵn có của Hardhat và dry-run chạy được.
Lệnh và output ở [chi tiết mục 2](CHECKPOINT_OP04_DETAIL.md#2-kiểm-cấp-phí-và-tính-toán).

### 2.2 Preflight

Kiểm hai khóa triển khai/ví ký có cùng địa chỉ và không phải mẫu; kiểm số dư ví ký đủ bốn constructor,
cấp vai, whitelist và Mint/Mint/Burn. Thiếu thì in lệnh cấp số dư cần có để công cụ chỉ bù phần thiếu.
Unit kiểm cả đủ/thiếu và đối chiếu chính lệnh cấp phí in ra. Preflight chạy trên Sepolia thật đã đọc
đúng chain, nhưng báo thiếu hai biến khóa trong môi trường hiện tại, mã 1 đúng chủ ý.
Output ở [chi tiết mục 3](CHECKPOINT_OP04_DETAIL.md#3-preflight-sepolia-thật).

### 2.3 Runbook và kiểm khói

Runbook thay luồng mint cũ bằng lập–duyệt, cấp phí từng bước, SPV riêng, commit địa chỉ cách B,
whitelist, chạy bản build local một tiến trình, ghi receipt và quy trình Cloudflare sau merge.
Bảng biến xác định RPC_EVM và khóa ký là runtime Secret; NEXT_PUBLIC_RPC_EVM chỉ dùng RPC công khai.
Không đưa khóa tổng lên Worker. Báo cáo công nghệ cập nhật metadata, cây thư mục, bảng công cụ và mục 4.3.

Kiểm khói dùng đường GET token có sẵn đi qua ledger EVM, kiểm thêm WPT/decimals/tổng cung khi chain evm.
Đã kiểm CLI bằng HTTP giả lập cho dữ liệu đúng/sai, xác nhận chỉ GET. **Đây không phải bằng chứng
Cloudflare hay ứng dụng đã đọc Sepolia thật.** Kết quả thật còn chờ mục 3.4.
Output fixture ở [chi tiết mục 4](CHECKPOINT_OP04_DETAIL.md#4-kiểm-cli-smoke-bằng-fixture).

## 3. Bước chưa chạy và bàn giao chủ dự án

### 3.1 Triển khai và verify

Owner đã triển khai từ worktree ops/04-sepolia, cùng deployer 0xCa49…9076.
Bộ địa chỉ mới được commit cùng cập nhật này, chỉ đổi khóa evm; ABI và hardhat-local không đổi.
Đã chạy verify chỉ đọc bằng RPC công khai: cờ false, ví SPV 0x0, tổng cung 0 và đủ vai.
Lệnh và đầu ra nguyên văn ở mục 5.1. Preflight/deploy do Owner chạy; chưa có đầy đủ stdout
hai lệnh đó gửi lại, không dựng output thay thế. Trạng thái mới được đối chiếu trực tiếp on-chain.

### 3.2 Ví SPV

Owner xác nhận giữ 0xCa49Fb2590800C9524f2BC57Ecd80C3Cc75D9076 làm deployer/signer và đã cung cấp
SPV riêng 0x5a5B0Ab8613bA0F16e257228e4109A8F611Ec4fd. Đã kiểm định dạng và danh sách ví bị chặn,
ghi vào runbook. Owner đã whitelist thành công; receipt status=1 ở block 11868854,
RPC đọc isWhitelisted=true. Tx và output đối chiếu ở mục 5.2. Nhà đầu tư và ví KSV được ghi
làm địa chỉ thử/dự phòng; không thay signer của luồng lập–duyệt. Lệnh và output ở chi tiết mục 8.

### 3.3 Ba giao dịch

Chưa có giao dịch/receipt OP-04; không tái dùng tx Hardhat SC-02 hay dựng tx hash.
Chủ dự án/người giữ khóa chạy app bản build và lập–duyệt Mint/Mint/Burn theo runbook mục 5,
trả mã yêu cầu, tx hash, receipt và số dư sau từng bước.

### 3.4 Cloudflare

Chưa đặt secret hay triển khai Worker. Chủ dự án đã cung cấp URL Cloudflare;
đã đọc metadata bản hiện hành dd015a1 và chạy kiểm khói trước cấu hình OP-04 (chi tiết mục 4).
Kết quả đó chưa phải kiểm bản OP-04 sau merge.
Theo spec tasks Bước 5, cần nhánh đã merge để Workers Builds dựng từ dev; điều kiện 6 chỉ chuyển
✅ sau khi kiểm khói và ghi kết quả lập–duyệt, kể cả khi hỏng do isolate. Không sửa DB trong OP-04.
Không chuyển task sang done hoặc tuyên bố nghiệm thu khi các bằng chứng này chưa có.

## 4. Kiểm chứng và lịch sử

### 4.1 Bộ mặc định

Bộ mặc định mã 0: 84 ca contract, 790 ca app đạt; 10 ca RPC SC-02 bỏ qua trong bộ mặc định.
Typecheck, lint, arch, marker, checkpoint đều đạt. Lệnh và toàn bộ đầu ra ở chi tiết mục 5.

### 4.2 Bí mật

Đã kiểm mẫu bí mật trong lịch sử commit nhánh theo spec, không có kết quả khớp.
Đây là phép quét mẫu được spec chỉ định, không phải kiểm chứng mọi loại bí mật có thể có.
Lệnh và đầu ra ở chi tiết mục 6.
Không nhận hay đưa khóa/API key/email vào spec, mã, log hoặc checkpoint.

### 4.3 Khuôn checkpoint

Kiểm đủ 9 dòng điều kiện, giữ các bằng chứng Sepolia/Cloudflare còn thiếu ở trạng thái 🔶.
Output kiểm khuôn ở chi tiết mục 7.

## 5. Đối chiếu triển khai và whitelist chủ dự án đã chạy

### 5.1 Verify trạng thái đầu trước Mint

Thư mục chạy: packages/contracts-evm. Dùng RPC công khai để không đưa endpoint có key vào log.

```bash
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com npx hardhat run scripts/verify-deployment.js --network sepolia
```

Đầu ra nguyên văn, mã thoát 0:

```text
◇ injected env (6) from .env // tip: ⌘ custom filepath { path: '/custom/path/.env' }
◇ injected env (0) from .env // tip: ⌘ suppress logs { quiet: true }
[1mKIỂM BẢN DEPLOY — sepolia (chainKey="evm")[0m
[2mdeployer ghi trong file: 0xCa49Fb2590800C9524f2BC57Ecd80C3Cc75D9076[0m

[1m1. Token[0m
  [32mOK  [0m ProjectToken symbol = WPT (Wind Power Token), decimals 0
  [2mtổng cung hiện tại: 0 WPT[0m
  [32mOK  [0m SC-02.initialSupplyMinted = false
  [32mOK  [0m SC-02.spvWallet = 0x0000000000000000000000000000000000000000
  [32mOK  [0m SC-02.totalSupply = 0
  [32mOK  [0m VNDToken symbol = VNDB (Vietnam Dong Bank token), decimals 0

[1m2. Role on-chain của ví ngân hàng (deployer)[0m
  [32mOK  [0m MINTER_ROLE -> 0xCa49Fb2590800C9524f2BC57Ecd80C3Cc75D9076
  [32mOK  [0m AGENT_ROLE -> 0xCa49Fb2590800C9524f2BC57Ecd80C3Cc75D9076
  [32mOK  [0m SNAPSHOT_ROLE -> 0xCa49Fb2590800C9524f2BC57Ecd80C3Cc75D9076
  [32mOK  [0m PAUSER_ROLE -> 0xCa49Fb2590800C9524f2BC57Ecd80C3Cc75D9076

[1m3. Liên kết giữa các contract[0m
  [32mOK  [0m ProfitDistributor.projectToken khớp
  [32mOK  [0m ProfitDistributor.payoutToken khớp VNDToken
  [32mOK  [0m Redemption.projectToken khớp
  [32mOK  [0m Redemption.payoutToken khớp VNDToken
  [32mOK  [0m Redemption.rate = 1000000 (VND cho 1 WPT)

[1m4. Điều kiện cho P7 (chia lợi tức)[0m
  [32mOK  [0m ProfitDistributor có SNAPSHOT_ROLE (chốt kỳ được)

[32m[1mBẢN DEPLOY HỢP LỆ[0m — đủ điều kiện cho P4, và P7/P12 dùng lại.
```

### 5.2 Receipt whitelist và phép đọc lại SPV

Owner cung cấp tx [whitelist SPV](https://sepolia.etherscan.io/tx/0xa1a545dfe9f3daa92238f59e8cc1ee4e70c6a2b1c8fe280dbe23dce4f6aebae3).
Đã đọc lại receipt và isWhitelisted qua batch RPC; query gồm eth_getTransactionReceipt cho tx
trên và eth_call isWhitelisted cho SPV 0x5a5B…c4fd tại ProjectToken 0xB8e9…6A02.
Thư mục chạy: gốc repo; không gửi giao dịch.

```bash
curl -sS --max-time 25 -H 'Content-Type: application/json' --data-binary @/tmp/op04-review-20261008/whitelist-query.json https://ethereum-sepolia-rpc.publicnode.com
```

Đầu ra nguyên văn, mã thoát 0:

```text
[{"jsonrpc":"2.0","id":1,"result":{"blockHash":"0x972410202055e9fa6938f2587f0759732451b24c533acc9df778ee96e13a5087","blockNumber":"0xb51ab6","contractAddress":null,"cumulativeGasUsed":"0x72d331","effectiveGasPrice":"0x3b9aca00","from":"0xca49fb2590800c9524f2bc57ecd80c3cc75d9076","gasUsed":"0x1fcab","logs":[{"address":"0xb8e9add2a9a4968f7bd5c1a8bfb43a55761e6a02","topics":["0xf93f9a76c1bf3444d22400a00cb9fe990e6abe9dbb333fda48859cfee864543d","0x0000000000000000000000005a5b0ab8613ba0f16e257228e4109a8f611ec4fd"],"data":"0x0000000000000000000000000000000000000000000000000000000000000001","blockNumber":"0xb51ab6","transactionHash":"0xa1a545dfe9f3daa92238f59e8cc1ee4e70c6a2b1c8fe280dbe23dce4f6aebae3","transactionIndex":"0x31","blockHash":"0x972410202055e9fa6938f2587f0759732451b24c533acc9df778ee96e13a5087","blockTimestamp":"0x6ac74ef4","logIndex":"0x3f","removed":false}],"logsBloom":"0x00000000000000000000000000000000000000000000000000000010000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000100004000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040000000000002000000080000001000000","status":"0x1","to":"0xb8e9add2a9a4968f7bd5c1a8bfb43a55761e6a02","transactionHash":"0xa1a545dfe9f3daa92238f59e8cc1ee4e70c6a2b1c8fe280dbe23dce4f6aebae3","transactionIndex":"0x31","type":"0x2"}},{"jsonrpc":"2.0","id":2,"result":"0x0000000000000000000000000000000000000000000000000000000000000001"}]
```

### 5.3 Kiểm địa chỉ và ABI sau cập nhật

Thư mục chạy: app. Bộ mặc định của lượt chuẩn bị ở mục 4.1; đây là kiểm bổ sung cho tệp địa chỉ mới.

```bash
npx vitest run test/abi-contract-sync.test.ts test/evm-address-env.test.ts
```

Đầu ra nguyên văn, mã thoát 0:

```text

 RUN  v3.2.4 /home/tuanlh/.codex/worktrees/03a6/bidv-rwa-tokenize/app

 ✓ test/evm-address-env.test.ts (5 tests) 3ms
 ✓ test/abi-contract-sync.test.ts (8 tests) 5ms

 Test Files  2 passed (2)
      Tests  13 passed (13)
   Start at  15:25:43
   Duration  270ms (transform 68ms, setup 0ms, collect 131ms, tests 7ms, environment 0ms, prepare 211ms)

```
