# Báo cáo bàn giao — OP-04: triển khai lại Sepolia sau SC-02

| | |
|---|---|
| Mã task | OP-04 |
| Nhánh | `ops/04-sepolia`, từ `dev` @ `dd015a1` (SC-02, PR #42) |
| Spec | `docs/op-04-sepolia/{requirements,tasks}.md`, gói 20261008_spec_OP04_IN03_DS01.zip |
| Mức kiểm chứng | Vừa |
| Tiến độ | Bước 0–4 đã thực hiện; mở PR vào dev, chờ kiểm Cloudflare sau merge; giữ `inProgress` |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện | Trạng thái | Bằng chứng |
|---|---|---|---|
| 1 | Script cấp phí, đúng ca 1, có kiểm thử | ✅ | mục 2.1; chi tiết 2 |
| 2 | Preflight kiểm phí ví ký và in lệnh cấp phí | ✅ | mục 2.2; chi tiết 2, 3 |
| 3 | Sepolia triển khai lại, địa chỉ evm đã commit, verify trạng thái đầu | ✅ | mục 3.1 |
| 4 | Ví SPV thử riêng Sepolia, không dùng ví mẫu | ✅ | mục 3.2 |
| 5 | Ba giao dịch Mint/Mint/Burn trên Sepolia có Etherscan | ✅ | mục 3.3; TXS mục 1 |
| 6 | Bản deploy chọn Sepolia, smoke xanh, thử lập–duyệt được ghi lại | 🔶 | mục 3.4 |
| 7 | Runbook Sepolia và bảng biến Cloudflare đúng hiện trạng | ✅ | mục 2.3 |
| 8 | Không bí mật trong lịch sử commit nhánh | ✅ | mục 4.2 |
| 9 | Bộ kiểm chứng mặc định xanh | ✅ | mục 4.1 |

**Kết luận:** 8 ✅ · 1 🔶 · 0 ❌

### 0.2 Việc cần Owner quyết / thực hiện

- Chủ dự án chạy các bước có khóa và Cloudflare theo runbook, trả output không chứa bí mật.
- Owner đã triển khai, whitelist SPV và lập–duyệt đủ ba giao dịch local; tiếp tục Cloudflare sau merge.
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

Owner đã lập–duyệt từ bản build local và cung cấp ba tx. Đối soát RPC chỉ đọc: mintInitialSupply 1.000 ở block 11869120; mint 2.000 ở block 11869202; agentBurn 300 ở block 11869369. Cả ba receipt thành công, cùng signer/SPV/ProjectToken; tổng cung và số dư SPV lần lượt 1.000 → 3.000 → 2.700. Lượt hai dùng 2.000 thay ví dụ 250, không đổi tiêu chí spec. Bằng chứng Etherscan, calldata, Transfer và trạng thái tại từng block: [TXS mục 1](CHECKPOINT_OP04_TXS.md).

### 3.4 Cloudflare

Chưa đặt secret hay triển khai Worker. Chủ dự án đã cung cấp URL Cloudflare;
đã đọc metadata bản hiện hành dd015a1 và chạy kiểm khói trước cấu hình OP-04 (chi tiết mục 4).
Kết quả đó chưa phải kiểm bản OP-04 sau merge.
Theo spec tasks Bước 5, cần nhánh đã merge để Workers Builds dựng từ dev; điều kiện 6 chỉ chuyển
✅ sau khi kiểm khói và ghi kết quả lập–duyệt, kể cả khi hỏng do isolate. Không sửa DB trong OP-04.
Không chuyển task sang done hoặc tuyên bố nghiệm thu khi các bằng chứng này chưa có.

## 4. Kiểm chứng và lịch sử

### 4.1 Bộ mặc định

Lượt bàn giao cuối mã 0: 84 ca contract, 793 ca app đạt; 10 ca RPC SC-02 bỏ qua trong bộ mặc định.
Typecheck, lint, arch, marker, checkpoint đều đạt. Lệnh và toàn bộ đầu ra ở TXS mục 2; lượt cũ ở chi tiết mục 5.

### 4.2 Bí mật

Đã kiểm mẫu bí mật trong lịch sử commit nhánh theo spec, không có kết quả khớp.
Đây là phép quét mẫu được spec chỉ định, không phải kiểm chứng mọi loại bí mật có thể có.
Lệnh và đầu ra ở chi tiết mục 6.
Không nhận hay đưa khóa/API key/email vào spec, mã, log hoặc checkpoint.

### 4.3 Khuôn checkpoint

Kiểm đủ 9 dòng điều kiện; Sepolia local đã đạt, giữ Cloudflare sau merge ở trạng thái 🔶.
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


## 6. Sửa chặn Lập lệnh: thiếu dự án WPT trên evm

Ảnh Owner gửi cho thấy `getTokenInfo` dừng ở tìm Project trước khi đọc chain. Dữ liệu mặc định
chỉ seed mock/Hardhat; runbook OP-04 thiếu cách đăng ký dự án đã deploy trên Sepolia.
Bổ sung `ENABLE_SEPOLIA_DEMO_PROJECT` mặc định false, bật có chủ đích trong runbook local/Worker.
Nguồn server `configuredProjectSeeds()` dùng chung cho memory/Postgres, địa chỉ theo shared,
DRAFT và chưa issuedAt; Postgres không ghi đè dự án đã tồn tại. Không sửa luật Mint/Burn,
không tự mint, không đổi SPV on-chain. Đây là bổ sung cấu hình/seed ngoài bảng tác động ban đầu
của OP-04 để xử lý blocker Owner báo; tech-report 4.4 và .env.example cập nhật cùng commit.

Kiểm chức năng: cờ tắt không có evm; bật có đúng WPT/địa chỉ/trần, giữ hai chain cục bộ;
đọc lại giữ trạng thái đã phát hành. Chưa chạy Postgres thật hoặc nghiệm thu UI Sepolia;
Owner tiếp tục ba giao dịch theo mục 3.3. Ví trong ảnh là mẫu Hardhat, cần thay bằng SPV đã whitelist.

Từ thư mục `app`, lệnh đã chạy:

```bash
npx vitest run test/sepolia-project-seed.test.ts test/store-constraints.test.ts > /tmp/op04-review-20261008/project-seed-tests.log 2>&1
```

Đầu ra nguyên văn:

```text

 RUN  v3.2.4 /home/tuanlh/.codex/worktrees/03a6/bidv-rwa-tokenize/app

 ✓ test/sepolia-project-seed.test.ts (3 tests) 6ms
 ✓ test/store-constraints.test.ts (119 tests) 32ms

 Test Files  2 passed (2)
      Tests  122 passed (122)
   Start at  15:41:59
   Duration  576ms (transform 230ms, setup 0ms, collect 552ms, tests 38ms, environment 0ms, prepare 239ms)

```

Từ gốc worktree, bộ mặc định chạy một lần cho bản sửa này:

```bash
bash scripts/run-local-all.sh > /tmp/op04-review-20261008/project-seed-all.log 2>&1
```

Đầu ra nguyên văn:

```text

[1m########## LỚP 3 - 3 LUẬT KIẾN TRÚC + CẤU TRÚC REPO ##########[0m

[1mLUẬT 1 - Mọi tương tác chain đi qua ILedgerPort[0m
[32m  PASS  viem/ethers không xuất hiện ngoài app/src/lib[0m
[32m  PASS  Không có lời gọi contract trực tiếp trong components/ và app/[0m

[1mLUẬT 2 - Mọi thao tác ký đi qua ISigner[0m
[32m  PASS  SERVER_SIGNER_PRIVATE_KEY chỉ đọc ở env.ts và server.signer.ts[0m
[33m  WARN  process.env đọc ngoài lib/config (kiểm tra xem có phải biến công khai):[0m
        app/src/lib/signer/index.ts:40:  const kind = process.env.SIGNER_KIND === 'fireblocks' ? 'fireblocks' : 'server';
[32m  PASS  app/.env bị gitignore (không lọt vào commit)[0m
[32m  PASS  Không có private key dạng hex 64 ký tự nhúng trong mã nguồn[0m

[1mLUẬT 3 - Mọi kiểm quyền đi qua RBAC can()[0m
[32m  PASS  Không có so sánh role cứng ngoài lib/rbac[0m
[32m  PASS  actions/bank.ts có 7 server action (guard nằm ở tầng service, xem lớp 1)[0m
[32m  PASS  Bảng quyền không teo lại so với origin/dev (32 -> 32 hành động)[0m

[1mMỘT NGUỒN SỰ THẬT - ABI và địa chỉ contract[0m
[32m  PASS  Không có ABI nhúng trong app/src (chỉ dùng từ packages/shared)[0m
[33m  WARN  Địa chỉ EVM hardcode trong app/src (xác nhận có chủ đích):[0m
        app/src/components/pages/mint.tsx:186:                placeholder="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
        app/src/components/pages/mint.tsx:192:                <span className="font-mono">0x70997970C51812dc3A010C7d01b50e0d17dc79C8</span>
        app/src/lib/signer/server.signer.ts:24:      account = { address: '0x0000000000000000000000000000000000000001', type: 'json-rpc' };
[32m  PASS  Không có contract ID Stellar hardcode trong app/src[0m

[1mKHÔNG SỬA CONTRACT ĐÃ PASS TEST[0m
[33m  WARN  Chưa đặt BASE_REF nên bỏ qua so sánh contract. Dùng: BASE_REF=<commit> bash scripts/verify-arch-rules.sh[0m
[32m  PASS  Contract chính không import từ trex/ (toolchain tách biệt)[0m

[1mCHAIN ĐƯỢC PHÉP - Polygon đã loại bỏ vĩnh viễn[0m
[32m  PASS  Không còn tham chiếu Polygon/Amoy/Mumbai (ngoài comment)[0m

[1mKÝ HIỆU TOKEN - WPT / VNDB (ký hiệu cũ SPT / tVND đã bỏ)[0m
[32m  PASS  Không còn ký hiệu cũ SPT / tVND[0m

[1mCẤU TRÚC SPEC VÀ STEERING[0m
[32m  PASS  Có .kiro/steering[0m
[32m  PASS  Có .kiro/specs[0m
[32m  PASS  Có docs[0m
[32m  PASS  spec p4-mint-testnet đủ 3 file[0m
[32m  PASS  spec p7-profit-distribution đủ 3 file[0m
[32m  PASS  spec p12-redemption đủ 3 file[0m
[32m  PASS  app/package-lock.json đã được commit (npm ci trong Docker chạy được)[0m

[1mTỔNG KẾT[0m
  PASS: 20   FAIL: 0   WARN: 3
[33m  => ĐẠT nhưng có 3 cảnh báo cần xác nhận có chủ đích.[0m
[33m  => PASS có cảnh báo: luật kiến trúc[0m

[1m########## LỚP 3 - ĐIỂM CẮM (marker) ##########[0m
Marker hợp lệ: 18 điểm cắm, 10 điểm chặn, 35 bước luồng. Không có lỗi.
[32m  => PASS: LỚP 3 - ĐIỂM CẮM (marker)[0m

[1m########## LỚP 3 - KHUÔN CHECKPOINT ##########[0m
ĐẠT     OP-04 · docs/CHECKPOINT_OP04.md
  mục 0: 23/60 dòng · bảng đối chiếu 9 dòng / 9 điều kiện · 7 ✅ 2 🔶 0 ❌ · cả tệp 218/800 dòng · có tệp _DETAIL.md
[32m  => PASS: LỚP 3 - KHUÔN CHECKPOINT[0m

[1m########## LỚP 1 - SPEC TEST CONTRACT EVM ##########[0m
◇ injected env (7) from .env // tip: ◈ secrets for agents [www.dotenvx.com]


  RWA năng lượng tái tạo — chu kỳ đầu-cuối
    ✔ Mint: chỉ MINTER mint được và chỉ mint cho ví đã KYC
    ✔ Chuyển nhượng có kiểm soát: chặn ví chưa KYC và ví bị đóng băng
    ✔ Clawback: agent thu hồi WPT từ ví bị băng về ví thu hồi
    ✔ Snapshot công bằng: chuyển nhượng SAU khi chốt kỳ không đổi phần được chia của kỳ đó
    ✔ Tính & chia lợi nhuận: preview đúng, claim đúng, không claim hai lần
    ✔ Quét phần dư: sau thời hạn nhận, phần chưa nhận trả về ngân hàng
    ✔ Hoàn vốn: đốt WPT đổi VND theo tỷ giá; giảm tổng cung
    ✔ Hai kỳ liên tiếp: cơ cấu sở hữu đổi giữa hai kỳ, mỗi kỳ chia theo snapshot của kỳ đó

  OP-04 — cấp phí Sepolia
    ✔ từ chối chain khác Sepolia trước khi có thể ký
    ✔ từ chối ví mẫu từ nguồn chung và Hardhat #0, kể cả khác hoa thường
    ✔ chỉ bù phần thiếu, dùng số nguyên và làm tròn phí lên
    ✔ đủ số dư thì không tạo signer và không gửi
    ✔ --dry-run thiếu phí cũng không đọc khóa hoặc gửi giao dịch
    ✔ gửi đúng phần thiếu, gắn chain Sepolia và chờ receipt
    ✔ tham số phải chọn một chế độ và số ETH phải dương

  OP-04 — preflight phí ví ký
    ✔ thiếu phí in lệnh nạp tổng số dư yêu cầu, script sẽ chỉ bù phần thiếu
    ✔ báo đủ khi số dư ví ký đủ deploy + whitelist + một vòng Mint/Mint/Burn

  Oracle sản lượng điện + chia lợi nhuận theo công thức
    ✔ Công thức lợi nhuận: gross = kWh×giá, net = gross−opex, chia = net×share
    ✔ Đa xác nhận: cần đủ 2 reporter khớp số liệu mới chốt; số liệu lệch bị từ chối
    ✔ Tạo đợt chia từ oracle rồi nhà đầu tư nhận đúng theo tỷ lệ nắm giữ
    ✔ Không chia được khi oracle chưa chốt, và không chia trùng một kỳ
    ✔ opex vượt doanh thu => lợi nhuận chia = 0 (không âm)

  SC-02 - Phát hành EVM khóa theo ví SPV
    ✔ lần đầu ghi ví, cờ, số dư và phát đúng sự kiện
    ✔ lần đầu chỉ chạy một lần, kể cả sau khi đốt hết
    ✔ mint thường bị chặn trước lần đầu và khi nhắm ví khác SPV
    ✔ thiếu MINTER_ROLE không được phát hành và không ghi cờ
    ✔ ví 0 và số lượng 0 bị chặn bằng custom error, không ghi cờ
    ✔ ví chưa whitelist bị hook chặn và hoàn nguyên ví/cờ
    ✔ ví bị đóng băng bị hook chặn và hoàn nguyên ví/cờ
    ✔ token tạm dừng bị hook chặn và hoàn nguyên ví/cờ

  SPEC P12 - Tất toán WPT sang VNDB
    Cấu hình của ngân hàng
      ✔ P12-1: MANAGER đặt được tỷ giá
      ✔ P12-2: tỷ giá 0 bị từ chối
      ✔ P12-3: ví không có MANAGER_ROLE không đặt được tỷ giá
      ✔ P12-4: nạp kho làm tăng thanh khoản VNDB của hợp đồng
      ✔ P12-5: quote tính đúng theo tỷ giá
    Luồng tất toán thành công
      ✔ P12-6: đổi WPT lấy VNDB đúng quote, WPT bị đốt, tổng cung giảm
      ✔ P12-7: tất toán một phần thì phần còn lại vẫn giữ
      ✔ P12-8: thanh khoản kho giảm đúng số đã trả
    Các ca bị chặn
      ✔ P12-9: đang tạm dừng thì không tất toán được
      ✔ P12-10: số lượng 0 bị từ chối
      ✔ P12-11: ví chưa KYC không tất toán được
      ✔ P12-12: kho VNDB thiếu thì từ chối và KHÔNG đốt WPT
      ✔ P12-13: THIẾU APPROVE thì tất toán thất bại (bẫy hay gặp của bản EVM)
      ✔ P12-14: approve thiếu so với số muốn tất toán thì thất bại
    Rút thanh khoản
      ✔ P12-15: MANAGER rút được VNDB dư khỏi kho
      ✔ P12-16: ví không có quyền không rút được kho

  SPEC P4 - Phát hành WPT
    Whitelist (điều kiện tuân thủ trước khi phát hành)
      ✔ P4-1: AGENT whitelist được ví, isWhitelisted phản ánh đúng
      ✔ P4-2: whitelist theo lô cho nhiều ví cùng lúc
      ✔ P4-3: ví KHÔNG có AGENT_ROLE không được whitelist
    Mint
      ✔ P4-4: phát hành lần đầu vào SPV đã whitelist làm tăng số dư và tổng cung
      ✔ P4-5: phát hành lần đầu vào SPV CHƯA whitelist bị chặn
      ✔ P4-6: ví KHÔNG có MINTER_ROLE không mint được
      ✔ P4-7: mint 0 sau lần đầu không làm đổi tổng cung
    Đóng băng và tạm dừng (ràng buộc tuân thủ)
      ✔ P4-8: ví bị đóng băng không nhận được token phát hành
      ✔ P4-9: khi tạm dừng toàn hệ thì không phát hành được
      ✔ P4-10: chuyển nhượng đòi CẢ HAI đầu đã whitelist
    Thu hồi cưỡng chế (clawback / forcedTransfer)
      ✔ P4-11: AGENT đốt cưỡng chế làm giảm tổng cung
      ✔ P4-12: forcedTransfer chuyển được kể cả khi bên gửi bị đóng băng
      ✔ P4-13: forcedTransfer sang ví chưa KYC bị chặn
    Thông tin token
      ✔ P4-14: decimals của bản EVM là 0 (đơn vị nguyên)
      ✔ P4-15: ký hiệu token là WPT và VNDB

  SPEC P7 - Chia lợi tức
    Tạo kỳ chia (nhánh nhập tay)
      ✔ P7-1: tạo kỳ chốt snapshot và ghi đúng tổng cung tại snapshot
      ✔ P7-2: kho VNDB được kéo vào hợp đồng khi tạo kỳ
      ✔ P7-3: amount = 0 bị từ chối
      ✔ P7-4: không có token đang lưu hành thì không tạo được kỳ
      ✔ P7-5: ví không có DISTRIBUTOR_ROLE không tạo được kỳ
      ✔ P7-6: thiếu SNAPSHOT_ROLE thì tạo kỳ thất bại (bẫy triển khai hay gặp)
    Tính phần chia theo snapshot
      ✔ P7-7: phần chia đúng tỷ lệ nắm giữ tại thời điểm chốt
      ✔ P7-8: MUA SAU KHI CHỐT không được chia kỳ đó
      ✔ P7-9: ví không nắm giữ token được chia 0
      ✔ P7-10: previewClaim trả 0 sau khi đã nhận
    Nhận lợi tức - mô hình pull
      ✔ P7-11: nhà đầu tư tự nhận và số dư VNDB tăng đúng
      ✔ P7-12: nhận lần hai không trả thêm tiền
      ✔ P7-13: nhận kỳ không tồn tại bị từ chối
    Nhận lợi tức - mô hình push (ngân hàng chia hộ)
      ✔ P7-14: ngân hàng chia hộ cho danh sách nhà đầu tư
      ✔ P7-15: ví không có quyền không được chia hộ
    Nhánh oracle (sản lượng điện)
      ✔ P7-16: oracle tính đúng doanh thu gộp, ròng và phần chia
      ✔ P7-17: tạo kỳ từ oracle dùng đúng số phần chia của oracle
      ✔ P7-18: oracle chưa chốt kỳ thì không tạo được đợt chia
      ✔ P7-19: một kỳ oracle không tạo đợt chia hai lần
      ✔ P7-20: hai reporter nộp số liệu KHÁC nhau bị chặn (chống thao túng)
      ✔ P7-21: kỳ đã chốt thì không sửa số liệu được
    Quét phần dư sau thời hạn nhận
      ✔ P7-22: chưa hết hạn thì không quét được
      ✔ P7-23: hết hạn thì thu được phần chưa ai nhận


  84 passing (959ms)

[32m  => PASS: LỚP 1 - SPEC TEST CONTRACT EVM[0m
[33m  (Soroban: tạm dừng ở khâu kiểm chứng, không cần chạy — mã nguồn Rust giữ nguyên)[0m

[1m########## APP - TYPECHECK ##########[0m

> app@0.1.0 typecheck
> tsc --noEmit

[32m  => PASS: APP - TYPECHECK[0m

[1m########## APP - LINT ##########[0m
[32m  => PASS: APP - LINT[0m

[1m########## APP - VITEST ##########[0m

> app@0.1.0 test
> vitest --run


 RUN  v3.2.4 /home/tuanlh/.codex/worktrees/03a6/bidv-rwa-tokenize/app

 ✓ test/check-checkpoint.test.ts (21 tests) 30ms
 ✓ test/pending-markers.test.ts (24 tests) 39ms
 ✓ test/env-private-key.test.ts (9 tests) 30ms
 ✓ test/rbac.test.ts (60 tests) 33ms
 ✓ test/wallet-status.test.ts (30 tests) 25ms
 ✓ test/account-info.test.ts (8 tests) 81ms
 ✓ test/mock-ledger.test.ts (61 tests) 42ms
 ✓ test/four-roles-routes.test.ts (22 tests) 17ms
 ✓ test/account-profile.test.ts (9 tests) 10ms
 ✓ test/store-constraints.test.ts (119 tests) 51ms
 ✓ test/purchase-state.test.ts (19 tests) 7ms
 ✓ test/issue-price-single-source.test.ts (16 tests) 30ms
 ✓ test/build-info.test.ts (6 tests) 6ms
 ✓ test/token-request.test.ts (22 tests) 239ms
 ✓ test/demo-payment.test.ts (19 tests) 210ms
 ✓ test/sepolia-project-seed.test.ts (3 tests) 10ms
 ✓ test/ops-transactions.test.ts (7 tests) 212ms
 ✓ test/config-service.test.ts (30 tests) 248ms
 ✓ test/issuance-service.test.ts (25 tests) 283ms
 ✓ test/seller-channel.test.ts (10 tests) 260ms
 ✓ test/investor-trading.test.ts (20 tests) 273ms
 ✓ test/distribution-trigger.test.ts (45 tests) 100ms
 ✓ test/portfolio-service.test.ts (12 tests) 19ms
 ✓ test/abi-contract-sync.test.ts (8 tests) 13ms
 ✓ test/purchase-service.test.ts (81 tests) 140ms
 ✓ test/distribution-service.test.ts (43 tests) 172ms
 ✓ test/evm-address-env.test.ts (5 tests) 6ms
 ✓ test/maker-checker-ui.test.ts (31 tests) 291ms
 ✓ test/receipt-timeout.test.ts (5 tests) 3ms
 ✓ test/server-signer.test.ts (4 tests) 9ms
 ✓ test/four-roles-shell.test.ts (19 tests) 8ms
 ↓ test/evm-issuance.test.ts (10 tests | 10 skipped)

 Test Files  31 passed | 1 skipped (32)
      Tests  793 passed | 10 skipped (803)
   Start at  15:42:21
   Duration  1.78s (transform 4.88s, setup 0ms, collect 18.18s, tests 2.90s, environment 6ms, prepare 2.65s)

[32m  => PASS: APP - VITEST[0m

[1m########## TỔNG KẾT ##########[0m
  Phần đã chạy: arch markers checkpoint contracts app
  Đạt:     7
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 3 - ĐIỂM CẮM (marker)
    PASS  LỚP 3 - KHUÔN CHECKPOINT
    PASS  LỚP 1 - SPEC TEST CONTRACT EVM
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST
  Không đạt: 0

ĐIỂM CẮM ĐANG CHỜ

AU-01  (1 điểm cắm)
  [cắm]   app/src/app/actions/session.ts:34  setDemoRole đã sẵn: đặt cookie vai rồi refresh, KHÔNG điều hướng — dùng được để nối phiên SIWE mà giữ người dùng ở lại trang đang mở

BE-05  (1 điểm cắm)
  [cắm]   app/src/lib/store/index.ts:189  cổng đợt tất toán đã sẵn ở cả hai bản (bộ nhớ + Postgres): hồ sơ có bốn trạng thái, `(roundId, holderWallet)` duy nhất chặn một ví vào hai hồ sơ trong cùng đợt. Thứ tự bốn bước CỐ Ý để cho nghiệp vụ quyết, cổng chỉ giữ tập giá trị hợp lệ

BE-13  (1 điểm cắm)
  [cắm]   app/src/components/pages/seller-withdraw.tsx:75  biểu mẫu, hạn mức đọc từ cấu hình, khoá nút khi vượt hạn mức, hộp mã một lần và bảng yêu cầu đã chạy trên dữ liệu tạm — BE-13 chỉ thay thân hàm này bằng lời gọi server action tạo lệnh, kiểm mã và đọc yêu cầu rút

FE-05  (1 điểm cắm)
  [cắm]   app/src/lib/signer/wallet.signer.ts:10  đã sẵn: `ISigner` dựng từ provider EIP-1193 của ví, account dạng `json-rpc` nên KHÔNG giữ khóa, thiếu ví thì ném `SignerUnavailableError` có hướng dẫn. FE-09 và FE-11 dùng lại đúng hàm này cho nút ký của họ

FE-07  (4 điểm cắm)
  [cắm]   app/src/app/actions/bank.ts:41    đã sẵn đầu cuối ở `issueInitialSupply` NHƯNG từ FE-22 chỉ là đường dữ liệu thử sau hai lớp chặn (`demo:mint-token` + cờ `ENABLE_DEMO_TOKEN_MINT` mặc định tắt); phát hành chính thức đã có ở màn Lập lệnh qua `createTokenRequestAction` + Kiểm soát viên duyệt. Phần đã sẵn: NHIỀU LẦN trong trần còn lại (trần đọc từ bảng dự án), lần sau chỉ vào đúng ví SPV chuỗi đã ghi, lưu giao dịch chờ trước khi đợi biên nhận, ghi mốc phát hành lần đầu bằng khoá lạc quan, đọc lại tổng cung từ chuỗi
  [cắm]   app/src/app/actions/bank.ts:49    đã sẵn đầu cuối ở `getIssuanceStatus`: trả SONG SONG trần trong bảng dự án, tổng cung thật trên chuỗi và trần còn lại, kèm mốc phát hành và ví SPV. Hai con số lệch nhau là tín hiệu cần đối soát, nên màn hình phải hiện cả hai chứ đừng chọn một
  [cắm]   app/src/app/actions/config.ts:18  đã sẵn đầu cuối ở `setIssuePrice`: validate Zod, guard HAI LỚP (`treasury:manage` rồi cờ `isConfig` của vai), kiểm ngưỡng đổi giá, ĐẨY GIÁ XUỐNG LEDGER TRƯỚC rồi mới ghi cơ sở dữ liệu + lịch sử, ghi bảng thất bại thì tự hoàn nguyên giá cũ trên ledger, ghi sổ kiểm toán cả bốn kết cục. Màn cấu hình chỉ cần gọi và hiển thị `Result`. FE-07 PHẢI hiện hộp xác nhận khi `Result` trả mã `VALIDATION` kèm thông báo lệch ngưỡng, rồi gọi lại với `confirmLargeChange: true` — service CỐ Ý không coi lần gọi thứ hai là xác nhận, vì lần gọi lại không chứng tỏ người dùng đã đọc cảnh báo
  [cắm]   app/src/app/actions/config.ts:25  đã sẵn đầu cuối ở `getIssuePrice`: trả giá đang có hiệu lực kèm vai đã đặt, thời điểm đặt, và cờ `configured` phân biệt "ngân hàng đã cấu hình" với "đang dùng mặc định trong mã". Màn cấu hình dùng đúng ba trường đó để hiện trạng thái hiện tại trước khi cho sửa; KHÔNG kiểm quyền vì giá phát hành là con số hiển thị công khai cho nhà đầu tư

FE-08  (7 điểm cắm)
  [cắm]   app/src/app/(ops)/distribution/page.tsx:4             đường dẫn /distribution, cổng ops:read (cả hai vai vận hành) và mục menu "Chia lợi nhuận" đã chạy; openPeriod, previewDistribution, distributePeriod và runDistributionCycle đều đã xong đầu cuối — FE-08 chỉ thay phần thân
  [cắm]   app/src/app/actions/distribution.ts:33                đã sẵn đầu cuối ở `openPeriod`: validate Zod, kiểm quyền `distribution:snapshot`, kiểm mã kỳ trùng và kiểm quỹ TRƯỚC khi chạm chuỗi nên lời gọi trượt không tốn ảnh chụp, chốt quyền qua `ILedgerPort.takeSnapshot`, đọc lại số dư quỹ để chắc contract chốt đúng con số đã ghi, lưu kỳ và ghi sổ kiểm toán cả bốn kết cục. Màn chia lợi nhuận chỉ cần gọi rồi hiển thị `Result`. FE-08 PHẢI hiện `snapshotId` và `totalAmount` trả về: đó là hai con số cán bộ ngân hàng dùng để đối chiếu trước khi bấm chia
  [cắm]   app/src/app/actions/distribution.ts:41                đã sẵn đầu cuối ở `previewDistribution`: dựng danh sách người nhận từ cơ sở dữ liệu, đọc số dư tại ảnh chụp, tính phần từng ví bằng ĐÚNG hàm mà lúc chia sẽ dùng, trả kèm `dust` và `dustWallet`. Hàm KHÔNG ghi một dòng nào, kể cả sổ kiểm toán, nên gọi bao nhiêu lần cũng được. FE-08 nên hiện cả ví được chia 0 thay vì lọc bỏ: vắng mặt và được chia 0 là hai thông tin khác nhau với người đối soát
  [cắm]   app/src/app/actions/distribution.ts:49                đã sẵn đầu cuối ở `distributePeriod`: kiểm quyền `distribution:execute`, lập đủ hồ sơ chờ TRƯỚC khi gửi giao dịch nào, chia lô theo tham số `distribution.batch_size`, ba trạng thái hồ sơ `PENDING`/`SENT`/`PAID` nên tiến trình chết giữa đường không để lại hồ sơ trông như đã chi, một lô lỗi không dừng các lô còn lại. Gọi lại CHỈ chia cho ví chưa nhận nên bấm hai lần không ai bị trả hai lần. FE-08 nên hiện `outstanding` và `failed`: khác 0 nghĩa là còn phải bấm chia lại
  [cắm]   app/src/app/actions/distribution.ts:79                đã sẵn đầu cuối ở `runDistributionCycle`: kiểm quyền `distribution:execute`, tự phát hiện tiền vào ví lợi nhuận, tự sinh mã kỳ, chống hai vòng chạy trùng bằng ràng buộc duy nhất của cơ sở dữ liệu, gọi lại nghiệp vụ BE-06 để mở kỳ và chia, chỉ ghi mốc số dư khi kỳ xong toàn bộ. FE-08 chỉ cần một nút "chạy ngay" rồi hiển thị `outcome` và `message`; `outcome` là `PARTIAL` nghĩa là còn phải chạy lại, `stuck` bằng true nghĩa là cần người xem
  [cắm]   app/src/app/actions/distribution.ts:86                vỏ mỏng quanh `listDistributionRuns` đã sẵn: kiểm quyền `reconcile:read`, trả lịch chạy mới nhất trước, đã tách khoá ghép thành `periodKey` + `runNo`. Hàm chỉ đọc và KHÔNG ghi sổ kiểm toán nên màn theo dõi gọi lại theo chu kỳ được
  [cắm]   app/src/lib/bank/distribution-trigger.service.ts:739  đã sẵn đầu cuối: kiểm quyền `reconcile:read`, đọc bảng `KeeperRun` của công việc chia tự động, tách khoá ghép thành `periodKey` + `runNo` nên màn hình không phải tự bóc chuỗi. FE-08 chỉ cần gọi rồi dựng bảng lịch chạy; `status` `FAILED` kèm `error` khác null là dòng cần người xem, và nhiều dòng cùng `periodKey` với `runNo` tăng dần là một kỳ đang chia nhiều vòng

FE-09  (1 điểm cắm)
  [cắm]   app/src/app/actions/distribution.ts:57  đã sẵn đầu cuối ở `getDistributionPeriod`: tra kỳ theo `periodKey` hoặc `periodId`, trả trạng thái kỳ kèm số hồ sơ theo từng trạng thái, tổng đã chi và số hồ sơ còn phải chi. Kiểm quyền `reconcile:read` nên ba vai phía ngân hàng đọc được và nhà đầu tư thì không. Hàm chỉ đọc và KHÔNG ghi sổ kiểm toán, nên màn theo dõi gọi lại theo chu kỳ được mà không nhấn chìm sổ

FE-23  (1 điểm cắm)
  [cắm]   app/src/app/(investor)/withdraw/page.tsx:4  đường dẫn /withdraw, cổng portfolio:read và mục menu "Rút VNDB" đã chạy — FE-23 dựng phần thân; nghiệp vụ rút chưa có ở tầng backend

IN-02  (1 điểm cắm)
  [cắm]   app/src/lib/bank/distribution-trigger.service.ts:344  đã sẵn đầu cuối cách phát hiện bằng hỏi định kỳ: đọc `profitPoolBalance` rồi so với mốc `distribution.last_settled_balance`, có chặn ngưỡng tối thiểu và có phát hiện số dư giảm. IN-02 chỉ cần đổi NGUỒN tín hiệu sang sự kiện `Transfer` vào ví lợi nhuận do Indexer đọc được, giữ nguyên bốn nhánh quyết định và nguyên phần chia ở `runDistributionCycle`. Đổi được vì mốc số dư vẫn là thứ chốt "đã xử lý tới đâu", sự kiện chỉ thay việc hỏi định kỳ

SC-03  (5 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:468  thiếu hợp đồng khớp lệnh: giá bán một WPT nằm trong hợp đồng đó, chưa contract nào giữ
  [chặn]  app/src/lib/ledger/evm.adapter.ts:480  thiếu hợp đồng khớp lệnh: chưa contract nào giữ giá bán một WPT nên không có hàm ghi nào để gọi
  [chặn]  app/src/lib/ledger/evm.adapter.ts:499  thiếu địa chỉ hợp đồng khớp lệnh để làm `spender`; `VNDToken.allowance` thì đã có trong ABI
  [chặn]  app/src/lib/ledger/evm.adapter.ts:538  thiếu hợp đồng khớp lệnh: chưa có nơi đổi VNDB lấy WPT trong cùng một giao dịch
  [chặn]  app/src/lib/ledger/evm.adapter.ts:544  thiếu hợp đồng khớp lệnh: chưa có nơi đổi WPT lấy VNDB trong cùng một giao dịch (chiều bán, BE-14)

SC-04  (4 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:680  thiếu quyết định cờ "đang tất toán" nằm ở contract nào; hai ứng viên hiện có thì ngược hướng nhau
  [chặn]  app/src/lib/ledger/evm.adapter.ts:686  thiếu quyết định cờ "đang tất toán" nằm ở contract nào, nên chưa có cờ nào để đọc
  [chặn]  app/src/lib/ledger/evm.adapter.ts:691  thiếu quyết định giá NAV có phải `Redemption.rate` hay không
  [chặn]  app/src/lib/ledger/evm.adapter.ts:697  thiếu quyết định giá NAV có phải `Redemption.rate` hay không

SC-05  (1 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:662  thiếu quyết định chữ ký: `distributeBatch(snapshotId, wallets)` không mang mã kỳ nên adapter không tra được `distributionId`; hợp đồng `ProfitDistributor` thì đã có và đã deploy. Hai đường xử lý ghi ngay trên marker này

LUỒNG NGHIỆP VỤ (marker @flow)

distribute  (14 bước)
   1  app/src/app/actions/distribution.ts:32                nhận yêu cầu mở kỳ chia, trước khi chốt quyền  ::openPeriodAction
   2  app/src/lib/bank/distribution.service.ts:369          kiểm quyền distribution:snapshot, kiểm mã kỳ và quỹ rồi mới chốt quyền, lưu kỳ ở OPEN  ::openPeriod
   3  app/src/app/actions/distribution.ts:40                nhận yêu cầu xem trước phân bổ của một kỳ đã mở  ::previewDistributionAction
   4  app/src/lib/bank/distribution.service.ts:520          kiểm quyền, tính phân bổ theo ảnh chụp, KHÔNG ghi gì vào cơ sở dữ liệu  ::previewDistribution
   5  app/src/lib/bank/distribution.service.ts:269          dựng danh sách người nhận từ cơ sở dữ liệu vì chuỗi không liệt kê được người nắm giữ  ::collectRecipients
   6  app/src/lib/bank/distribution.service.ts:198          đọc số dư từng ví tại ảnh chụp, tính phần chia nhân trước chia sau  ::allocate
   7  app/src/app/actions/distribution.ts:48                nhận yêu cầu chia theo lô; gọi lại được để chia phần còn thiếu  ::distributePeriodAction
   8  app/src/lib/bank/distribution.service.ts:628          kiểm quyền distribution:execute, lập hồ sơ chờ rồi gửi từng lô, chốt COMPLETED khi hết hồ sơ  ::distributePeriod
   9  app/src/app/actions/distribution.ts:56                nhận yêu cầu đọc trạng thái và tiến độ chi trả của một kỳ  ::getDistributionPeriodAction
  10  app/src/lib/bank/distribution.service.ts:885          kiểm quyền reconcile:read, trả trạng thái kỳ và tiến độ chi trả  ::getDistributionPeriod
  11  app/src/app/actions/distribution.ts:78                nhận yêu cầu chạy tay một vòng chia tự động, khi lịch chạy bị trượt  ::runDistributionCycleAction
  12  app/src/lib/bank/distribution-trigger.service.ts:505  chạy một vòng: phát hiện, chiếm chỗ chạy, mở kỳ, chia theo lô, cập nhật mốc  ::runDistributionCycle
  13  app/src/lib/bank/distribution-trigger.service.ts:345  so số dư ví lợi nhuận với mốc đã xử lý, quyết định mở kỳ mới hay chia tiếp kỳ dở  ::detectNewFunds
  14  app/src/lib/bank/distribution-trigger.service.ts:412  ghi mốc số dư đã xử lý sau khi kỳ chia xong trọn vẹn  ::settleBalanceMark

issue  (9 bước)
   1  app/src/app/actions/bank.ts:40            nhận yêu cầu phát hành vào ví SPV từ giao diện, chuyển tiếp sang service  ::issueInitialSupplyAction
   2  app/src/lib/bank/issuance.service.ts:326  validate, kiểm hai lớp chặn dữ liệu thử (quyền demo:mint-token và cờ ENABLE_DEMO_TOKEN_MINT), đọc trần phát hành từ bảng dự án  ::issueInitialSupply
   3  app/src/lib/bank/issuance.service.ts:227  gửi giao dịch phát hành vào ví SPV: lần đầu qua mintInitialSupply, các lần sau qua mint  ::pending
   4  app/src/lib/bank/issuance.service.ts:76   lưu giao dịch ở trạng thái chờ, TRƯỚC khi đợi biên nhận  ::saved
   5  app/src/lib/bank/issuance.service.ts:91   đợi biên nhận theo timeout của chuỗi, rồi cập nhật trạng thái giao dịch  ::receipt
   6  app/src/lib/bank/issuance.service.ts:257  lần đầu: ghi mốc phát hành vào bảng dự án bằng khoá lạc quan  ::issuedAt
   7  app/src/lib/bank/issuance.service.ts:288  đọc lại tổng cung từ chuỗi làm sự thật cuối cùng  ::after
   8  app/src/app/actions/bank.ts:48            nhận yêu cầu xem trạng thái phát hành, chuyển tiếp sang service  ::issuanceStatusAction
   9  app/src/lib/bank/issuance.service.ts:387  đọc trạng thái phát hành: con số dự kiến trong bảng dự án đứng cạnh tổng cung thật trên chuỗi  ::getIssuanceStatus

purchase  (12 bước)
   1  app/src/app/actions/purchase.ts:38         nhận yêu cầu xem trước điều kiện mua, trước khi có lệnh nào  ::previewPurchaseAction
   2  app/src/lib/bank/purchase.service.ts:152   kiểm quyền order:place, báo giá, chạy bộ kiểm, KHÔNG ghi gì vào cơ sở dữ liệu  ::previewPurchase
   3  app/src/app/actions/purchase.ts:45         một trong hai đường vận chuyển: nhận yêu cầu đặt lệnh; đường kia là POST /api/purchase  ::placeOrderAction
   4  app/src/lib/bank/purchase.service.ts:201   validate Zod, kiểm quyền order:place, kiểm điều kiện, lưu đúng một lệnh rồi tự quyết toán chính lệnh vừa tạo  ::placeOrder
   5  app/src/lib/ledger/ledger.port.ts:115      chốt số VNDB phải trả, tính một lần tại lúc đặt lệnh  ::quotePurchase
   6  app/src/lib/bank/purchase.service.ts:293   hệ thống nhận đúng bản ghi vừa tạo và tự quyết toán, không nhận orderId tùy ý  ::autoSettleCreatedOrder
   7  app/src/lib/bank/purchase.service.ts:790   PLACED sang CHECKING, chạy lại bộ kiểm và chiếm EXECUTING chống gửi hai lần  ::settleStoredOrder
   8  app/src/lib/bank/purchase.service.ts:481   kiểm giá đã chốt rồi các phép đọc theo chiều lệnh (mua bốn, bán ba), dừng ở lần trượt đầu tiên  ::runOrderChecks
   9  app/src/lib/bank/purchase.service.ts:961   gửi giao dịch mua hoặc bán theo chiều lệnh, lưu mã tx trước khi chờ, chốt COMPLETED hoặc FAILED  ::sendAndSettle
  10  app/src/lib/ledger/ledger.port.ts:165      chuyển VNDB và WPT trong cùng một giao dịch  ::executePurchase
  11  app/src/app/actions/purchase.ts:56         một trong hai đường vận chuyển: nhận yêu cầu xem sổ lệnh; đường kia là GET /api/purchase  ::listOrdersAction
  12  app/src/lib/bank/purchase.service.ts:1103  kiểm order:read và order:read:all, lọc theo ví ở tầng service, lọc thêm chiều, mã lệnh, khoảng ngày  ::listOrders


Tổng: 18 điểm cắm · 10 điểm chặn · 35 bước luồng

[32m  => ĐẠT các phần đã chạy: arch markers checkpoint contracts app[0m
```


## 7. Timeout RPC trên máy local có proxy

Owner báo đọc WPT timeout sau khi đăng ký dự án. Xác nhận tiến trình Node local có proxy
môi trường nhưng fetch không dùng proxy. Thêm lệnh `npm run start:proxy`; bản build hiện có
đã đọc Sepolia thật, smoke 2/2 đạt trên cổng phụ 3001, rồi dừng tiến trình phụ. Không gửi giao dịch.
Bộ mặc định có một lỗi lint của CJS; đã đổi ESM và lint bản cuối đạt, các phần còn lại đạt.
Chi tiết lệnh/đầu ra nguyên văn tại [checkpoint proxy](CHECKPOINT_OP04_PROXY.md).
Ba giao dịch local đã đối soát ở TXS mục 1; Cloudflare chờ sau merge, giữ OP-04 inProgress.
