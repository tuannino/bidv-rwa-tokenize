# Runbook OP-04 — lập–duyệt Mint/Burn trên Sepolia

Bộ địa chỉ `evm` hiện có được triển khai ngày 10/09/2026, **trước SC-02**. Chỉ đánh dấu triển khai
mới sau khi chủ dự án chạy và commit kết quả từ nhánh `ops/04-sepolia`. Không dùng bộ cũ để thử phát hành.

**Không gửi SepoliaETH vào tài khoản mẫu của Hardhat.** Hai ví `NDT001`, `NB001` trong
`packages/shared/src/sample-wallets.json` và account #0 có khóa công khai. Script cấp phí từ chối
những địa chỉ này; ví SPV thử phải là địa chỉ riêng. Các ví Hardhat khác cũng không được dùng trên Sepolia.

Các lệnh dưới đây là **hướng dẫn để chủ dự án chạy**, không phải bằng chứng đã triển khai.
Đầu ra thực tế và tx hash chỉ được ghi vào `CHECKPOINT_OP04.md` sau khi chạy.
Mọi lệnh contract chạy từ `packages/contracts-evm`, trừ khi ghi rõ thư mục khác.

## 1. Chuẩn bị ví và biến bí mật [Chủ dự án]

Dùng một ví tổng giữ SepoliaETH (`FUNDER_PRIVATE_KEY`) và một ví ký máy chủ riêng, cũng là ví
triển khai. Tạo thêm ví SPV thử bằng ứng dụng ví; ghi **địa chỉ công khai** vào bảng dưới.
Ví SPV chỉ nhận WPT, không tự ký giao dịch trong OP-04 nên không cần ETH hay khóa trong ứng dụng.

| Địa chỉ | Giá trị được chủ dự án xác nhận |
|---|---|
| Ví ký máy chủ / deployer | `0xCa49Fb2590800C9524f2BC57Ecd80C3Cc75D9076`; chủ dự án xác nhận giữ ví này ngày 08/10 |
| Ví SPV thử Sepolia | **Chờ chủ dự án cung cấp địa chỉ công khai** |
| URL Cloudflare | https://bidv-rwa-tokenize.tuanlhbidv.workers.dev/ |

```bash
cd packages/contracts-evm
cp -n .env.example .env
```

Điền bằng trình soạn thảo cục bộ vào `.env` bị Git bỏ qua; không gửi file hay khóa qua chat:

```dotenv
SEPOLIA_RPC_URL=
PRIVATE_KEY=
SERVER_SIGNER_PRIVATE_KEY_EVM=
FUNDER_PRIVATE_KEY=
SPV_SEPOLIA_ADDRESS=
ETHERSCAN_API_KEY=
```

- `SEPOLIA_RPC_URL`: RPC Sepolia có API key, chỉ nằm trong file cục bộ.
- `PRIVATE_KEY` và `SERVER_SIGNER_PRIVATE_KEY_EVM`: **cùng khóa ví ký máy chủ**, có tiền tố `0x`.
  `deploy.js` cấp `MINTER_ROLE`, `AGENT_ROLE` cho chính ví triển khai; không đổi script đó.
- `FUNDER_PRIVATE_KEY`: khóa ví tổng, chỉ dùng cục bộ; không đưa vào Cloudflare hay ứng dụng.
- `SPV_SEPOLIA_ADDRESS`: địa chỉ công khai vừa tạo, không dùng `NB001`.
- `ETHERSCAN_API_KEY`: tùy chọn cho verify mã nguồn, không phải điều kiện triển khai.

## 2. Biên dịch, preflight và cấp phí [Chủ dự án]

```bash
npx hardhat compile
npx hardhat run scripts/preflight-sepolia.js --network sepolia
```

Preflight kiểm chainId **11155111**, hai khóa cùng ví, ví không phải mẫu, và số dư đủ cho bốn
constructor, cấp vai, whitelist SPV, Mint lần đầu, Mint bổ sung, Burn. Thiếu phí: trả mã 1 và in
**đúng lệnh** cấp số dư cần có. Chép lệnh đó, chạy thêm `--dry-run` trước, rồi chạy bản không có cờ.
`SẴN SÀNG` chỉ có nghĩa đủ điều kiện triển khai; không xác nhận bộ địa chỉ cũ đã có SC-02.

Các ví dụ dưới cần thay `SIGNER_ADDRESS` bằng địa chỉ công khai preflight vừa in:

```bash
node scripts/fund-sepolia.js SIGNER_ADDRESS --for deploy --dry-run
node scripts/fund-sepolia.js SIGNER_ADDRESS --for deploy
```

`--for` nhận `deploy`, `whitelist`, `mint-initial`, `mint`, `burn`, `cycle` (Mint/Mint/Burn).
Gas được **đo trên bytecode đã biên dịch trong Hardhat cục bộ riêng**, không gửi giao dịch testnet
để đo, không đổi địa chỉ trong shared. Nhân với `maxFeePerGas` hiện tại của Sepolia (hoặc `gasPrice`
khi RPC không có EIP-1559), cộng **20%** dự phòng. Đây là ước lượng theo trạng thái mẫu và calldata
mẫu; kiểm/cấp lại trước từng bước nếu phí mạng thay đổi. `deploy` gồm bốn constructor và cấp
`SNAPSHOT_ROLE`; không gồm whitelist và vòng nghiệp vụ. Preflight cộng đủ các bước này.

`--eth <số>` là **số dư cần có**, không phải số chuyển thêm. Ví đích có đủ thì không gửi;
thiếu thì chỉ gửi chênh lệch. `--dry-run` không cần khóa tổng, không tạo signer, không gửi.
Ví tổng phải đủ cả phần bù và phí chuyển ETH. Sau khi gửi, giữ tx hash; nếu timeout, kiểm receipt
trên Etherscan trước khi thử lại, tránh gửi trùng khi giao dịch cũ còn pending.

## 3. Triển khai và commit địa chỉ [Chủ dự án]

```bash
npx hardhat run scripts/deploy.js --network sepolia
npx hardhat run scripts/verify-deployment.js --network sepolia
```

Đầu ra deploy phải ghi chainId 11155111, deployer khớp ví ký và bốn địa chỉ mới. Verify trước
whitelist/mint phải đọc được `initialSupplyMinted = false`, `spvWallet = 0x0000000000000000000000000000000000000000`,
tổng cung 0, ví ký có `MINTER_ROLE` và `AGENT_ROLE`, và kết luận bản deploy hợp lệ.
Verify role hiện kiểm địa chỉ `deployer` trong file, nên phải đối chiếu nó với ví ký preflight.

Từ gốc repo, commit **trên chính nhánh `ops/04-sepolia`**, rồi push. Kiểm diff chỉ đổi khóa `evm`,
không thay địa chỉ `hardhat-local`; ABI sinh lại có thể không đổi vì SC-02 đã commit ABI:

```bash
git diff -- packages/shared/src/addresses.json packages/shared/generated
git add packages/shared/src/addresses.json packages/shared/generated
git commit -m "chore(op-04): ghi bộ hợp đồng SC-02 triển khai trên Sepolia"
git push origin ops/04-sepolia
```

Chỉ dùng **cách B: tệp địa chỉ đã commit**. App import JSON lúc build, Cloudflare không cần đọc
filesystem runtime. Xóa mọi `NEXT_PUBLIC_ADDR_EVM_*` cũ trong môi trường local/Build/Worker: env
vẫn có quyền ghi đè tệp và có thể khiến app gọi nhầm bytecode cũ. Không chép địa chỉ vào nhiều nơi.

Verify source Etherscan là tùy chọn. Nếu dùng, xem constructor trong `scripts/deploy.js`;
không bật `USE_LOCAL_SOLC` khi biên dịch bản cần verify source.

## 4. Whitelist ví SPV thử [Chủ dự án]

Cấp phí cho **ví ký**, không cấp cho SPV; thay `SIGNER_ADDRESS` như trên:

```bash
node scripts/fund-sepolia.js SIGNER_ADDRESS --for whitelist --dry-run
node scripts/fund-sepolia.js SIGNER_ADDRESS --for whitelist
npx hardhat console --network sepolia
```

Trong console Hardhat, chạy lần lượt (đọc `SPV_SEPOLIA_ADDRESS` từ `.env`):

```javascript
const { assertTarget } = require('./scripts/fund-sepolia');
const spv = process.env.SPV_SEPOLIA_ADDRESS;
assertTarget(spv);
const book = require('../shared/src/addresses.json');
const token = await ethers.getContractAt('ProjectToken', book.chains.evm.contracts.ProjectToken);
const tx = await token.setWhitelisted(spv, true);
console.log('Whitelist tx:', tx.hash);
await tx.wait();
console.log('SPV:', spv, 'whitelisted:', await token.isWhitelisted(spv));
```

Phải có `whitelisted: true`. Ghi địa chỉ SPV vào bảng mục 1 và bàn giao output không kèm khóa/RPC bí mật.

## 5. Ứng dụng cục bộ: dùng bản build, lập–duyệt ba giao dịch

Chủ dự án điền `app/.env.local` (bị Git bỏ qua) qua trình soạn thảo:

```dotenv
NEXT_PUBLIC_DEFAULT_CHAIN=evm
RPC_EVM=
SERVER_SIGNER_PRIVATE_KEY_EVM=
USE_MOCK_DB=true
ENABLE_DEMO_TOKEN_MINT=false
```

`RPC_EVM` cùng endpoint Sepolia với `SEPOLIA_RPC_URL`; khóa đúng ví đã deploy.
Giữ `USE_MOCK_DB=true` theo phạm vi task. Không đặt `NEXT_PUBLIC_ADDR_EVM_*`.
Nếu ví trình duyệt cần RPC riêng, dùng `NEXT_PUBLIC_RPC_EVM` là URL **công khai**, không chứa
API key bí mật vì Next nội tuyến biến này vào bundle trình duyệt.

Từ `app`, dựng và chạy một tiến trình duy nhất; không khởi động lại giữa ba giao dịch vì DB bộ nhớ:

```bash
npm run build
npm start
```

Từ cửa sổ khác, thư mục contract, trước mỗi lần Kiểm soát viên duyệt:

```bash
node scripts/fund-sepolia.js SIGNER_ADDRESS --for mint-initial --dry-run
node scripts/fund-sepolia.js SIGNER_ADDRESS --for mint-initial
```

Lặp lại với `--for mint` cho lần hai và `--for burn` trước Burn. Mỗi lần chỉ bù phần thiếu.
Trên `http://localhost:3000` chọn Sepolia (`evm`) và thực hiện:

| Lượt | Giao dịch viên — Lập lệnh (`/draft`) | Kiểm soát viên — Phê duyệt (`/approvals`) | Kết quả trên chuỗi |
|---|---|---|---|
| 1 | Tạo Mint 1.000 WPT vào **SPV riêng** đã whitelist; gửi duyệt | Đổi vai, mở đúng mã yêu cầu, Chấp nhận | tổng cung/SPV 1.000, cờ true, SPV cố định |
| 2 | Tạo Mint bổ sung 250 WPT, cùng SPV; gửi duyệt | Chấp nhận | tổng cung/SPV 1.250 |
| 3 | Tạo Burn 300 WPT chưa phân phối; gửi duyệt | Chấp nhận | tổng cung/SPV 950 |

Đường `/mint` và `demo-mint.mjs` là dữ liệu thử mock, không dùng trên EVM. Không cần nối ví trình
duyệt cho hai vai ngân hàng: ứng dụng ký qua server signer. Không phân phối WPT giữa ba lượt này.
Giữ lại mã yêu cầu, tx hash, receipt `status=1`, block, tổng cung và số dư SPV cho từng lượt;
link là `https://sepolia.etherscan.io/tx/` cộng tx hash. Receipt ứng dụng chờ tối đa 90 giây;
PENDING không đồng nghĩa thất bại, kiểm trên explorer trước khi thử lại.

## 6. Cloudflare [Chủ dự án đặt secret; chạy sau merge]

| Biến | Nơi đặt | Giá trị / lưu ý |
|---|---|---|
| `RPC_EVM` | Worker runtime **Secret** | RPC Sepolia có API key, mở lựa chọn Sepolia phía server |
| `SERVER_SIGNER_PRIVATE_KEY_EVM` | Worker runtime **Secret** | Khóa ví deployer đã có hai vai |
| `NEXT_PUBLIC_RPC_EVM` | **Build variable**, tùy chọn | RPC công khai cho ví trình duyệt; không đặt RPC có key bí mật |
| `NEXT_PUBLIC_DEFAULT_CHAIN` | **Build variable**, tùy chọn | `evm` nếu muốn Sepolia mặc định; giữ mock vẫn chọn được Sepolia khi có RPC_EVM |
| `USE_MOCK_DB` | Worker runtime variable | `true`; dữ liệu chia theo isolate, giới hạn đã biết |
| `ENABLE_DEMO_TOKEN_MINT` | Worker runtime variable | `false`; dùng luồng lập–duyệt |

Không đặt `FUNDER_PRIVATE_KEY`, `PRIVATE_KEY` hay `NEXT_PUBLIC_ADDR_EVM_*` trên Worker.
Workers Builds dựng từ `dev` sau khi Owner merge PR: build `npm run cf:build`, deploy `npx wrangler deploy`.
Đặt secret đúng Worker, triển khai lại, rồi từ gốc repo thay URL/SHA thực tế:

```bash
node scripts/smoke-test.mjs https://WORKER_URL --expect-commit=DEPLOYED_SHA --chain=evm
```

Kiểm khói chỉ GET `/api/version` và `/api/token?chain=evm`: đối chiếu commit, chain, WPT decimals 0
và tổng cung đọc qua adapter EVM. Không gửi giao dịch, không chứng minh Mint/Burn hay SC-02 chỉ bằng
kiểm khói; bằng chứng contract mới là verify ở mục 3 và ba giao dịch ở mục 5.

Thử lập–duyệt trên bản deploy, cấp phí theo thao tác như mục 5. Hợp đồng đã phát hành ở local thì
lượt Mint tiếp theo là **bổ sung** vào cùng SPV; không giả làm lần đầu mới và không deploy lại chỉ
để đặt lại cờ. Ghi số lần thử, mã yêu cầu, vai, thời điểm, kết quả thấy yêu cầu khi chuyển vai,
tx hash hoặc lỗi. Nếu mất yêu cầu giữa hai isolate, giữ bằng chứng và ghi đề xuất Postgres dùng
chung vào checkpoint; **không sửa DB trong OP-04**. Kết quả bước này ghi ở commit sau merge;
điều kiện 6 vẫn 🔶 và OP-04 vẫn `inProgress` cho tới khi đã chạy.

## Bàn giao lại để hoàn tất OP-04

Chỉ gửi **đầu ra nguyên văn không chứa bí mật** của preflight, deploy, verify, địa chỉ SPV công khai,
ba tx hash local và URL/SHA Cloudflare cùng kết quả thử. Không gửi khóa hoặc endpoint có API key.
Chủ dự án hoặc người giữ khóa chạy bước cần ký; checkpoint chỉ ghi những lệnh đã chạy thật.
