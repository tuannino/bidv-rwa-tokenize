# Runbook Sepolia lần hai (OP-05)

Một mạch từ bộ hợp đồng mới tới một vòng nghiệp vụ chạy hoàn toàn qua app. Spec:
`docs/op-05-sepolia-lan-hai/requirements.md` bản 3 (CH-1 đến CH-7 đã chốt).

**Lịch sử.** Bộ SC-02 triển khai ngày 08/10/2026 (OP-04: Mint 1.000, Mint 2.000, Burn 300 vào ví SPV thử)
là bộ cũ, không có vault, khớp lệnh hay quỹ chia mới. Đầu ra, tx hash và receipt của lần đó chỉ là bằng
chứng lịch sử trong `docs/CHECKPOINT_OP04.md`, `CHECKPOINT_OP04_DETAIL.md`, `CHECKPOINT_OP04_TXS.md`,
`CHECKPOINT_OP04_PROXY.md`. Không dùng lại địa chỉ, bước Mint vào ví SPV hay thao tác `cycle` của OP-04.

**Không gửi SepoliaETH vào tài khoản mẫu của Hardhat.** Hai ví `NDT001`, `NB001` trong
`packages/shared/src/sample-wallets.json` và account #0 (`hardhatAccount0` cùng tệp) có khoá riêng công
khai. `fund-sepolia.js` từ chối nạp, app từ chối liên kết các ví này trên `evm`. Các ví Hardhat khác cũng
không dùng trên Sepolia.

Mọi lệnh contract chạy từ `packages/contracts-evm`, lệnh app từ `app`, còn lại từ gốc repo. Runbook không
chứa khoá, RPC có API key, chuỗi kết nối có mật khẩu hay câu SQL ghi hoặc xoá.

## Ai làm gì

| Ký hiệu | Vai |
|---|---|
| **Sếp** | Chủ dự án: thao tác tay, giữ khoá, ví, tài khoản Neon và Cloudflare |
| **SV** | Supervisor: chỉ đọc và soát (diff, chuỗi, đầu ra) |
| **App** | Thao tác trên giao diện app, ghi rõ vai đang dùng |

Ba tên địa chỉ dùng xuyên suốt:

| Tên | Là gì | Giá trị |
|---|---|---|
| `SPV_PAYMENT_VAULT` | Hợp đồng `SpvPaymentVault` vừa deploy (giữ WPT chưa bán, nhận VNDB khi bán) | Có sau bước 6, đọc ở `addresses.json` |
| `PAYOUT_WALLET` | Ví nhận tiền khi Người bán rút từ vault | `0x5a5B0Ab8613bA0F16e257228e4109A8F611Ec4fd` |
| `INVESTOR_WALLET` | Ví MetaMask của Nhà đầu tư `NDT001`; chỉ ký typed data, không tốn và không được cấp ETH | `0xB3a5B799F05F98f78FE58a7f14CD9A400696d033` |

Ví ký máy chủ, cũng là ví deploy: `0xCa49Fb2590800C9524f2BC57Ecd80C3Cc75D9076` (Sếp giữ). Mọi giao dịch
trong runbook do ví này gửi; ví tổng chỉ cấp phí cho nó.

## Tổng quan 15 bước

| Bước | Nội dung | Ai |
|---|---|---|
| 0 | Điều kiện vào: `dev` có BE-13, FE-08, PR A; CI xanh. Ghi SHA và phiên bản Worker đang chạy để lùi | Sếp; SV kiểm SHA |
| 1 | Ví và biến bí mật trong `.env` cục bộ | Sếp |
| 2 | Nếu đang có lịch gọi keeper ở đâu đó: tạm dừng, ghi lại | Sếp |
| 3 | Ảnh chụp chỉ đọc database **cũ** (QĐ-F mục 1), gửi đầu ra cho SV lưu làm lịch sử | Sếp chạy; SV lưu |
| 4 | Tạo database Neon mới và Hyperdrive mới (QĐ-D) | Sếp |
| 5 | Biên dịch, preflight, cấp phí theo bảng ước phí (QĐ-E) | Sếp |
| 6 | Deploy, `verify-deployment`, kiểm giá R7 trên hợp đồng | Sếp chạy; SV đọc chuỗi đối chiếu |
| 7 | Whitelist `PAYOUT_WALLET` và `INVESTOR_WALLET` (ví đã đăng ký thì bỏ qua) | Sếp; SV đọc `isVerified` |
| 8 | PR B: diff chỉ gồm ba nhóm tệp; merge | Sếp mở và merge; SV soát diff |
| 9 | Cloudflare: secret (QĐ-G), xoá `NEXT_PUBLIC_ADDR_EVM_*`, chờ Workers Builds | Sếp |
| 10 | Kiểm khói trên URL công khai | SV (hoặc Sếp) |
| 11 | Kiểm chỉ đọc database **mới** sau lần chạy đầu (QĐ-F mục 2). Sai thì lùi (mục cuối), dừng | Sếp chạy; SV đối chiếu |
| 12 | Cấu hình vault trên màn BE-13 | App: Kiểm soát viên |
| 13 | Vòng nghiệp vụ, đối chiếu số dư kỳ vọng sau từng lượt | App và Sếp |
| 14 | Gửi đầu ra không bí mật; SV đọc chuỗi nghiệm thu, soạn PR C | Sếp gửi; SV |

Ba PR: **A** (coder: liên kết ví, công cụ, runbook, kiểm thử, diễn tập), **B** (Sếp: chỉ `addresses.json`
khoá `evm`, `packages/shared/generated/*`, ID Hyperdrive trong `app/wrangler.json`), **C** (Sếp, SV soạn:
`CHECKPOINT_OP05.md` phần chạy thật đã lọc bí mật, OP-05 sang `done`). PR B phải merge trước bước 12 vì
Cloudflare dựng từ `dev`.

## Bước 0. Điều kiện vào [Sếp; SV kiểm SHA]

```bash
git fetch origin dev && git log --oneline -1 origin/dev
(cd app && npx wrangler deployments list)   # ghi Version ID đang chạy
```

Phải thấy: `dev` đã có merge của BE-13 (PR #60), FE-08 (PR #61) và PR A; CI của commit đó xanh. Ghi SHA và
Version ID vào ghi chú của lần chạy: đó là mốc để lùi.

## Bước 1. Ví và biến bí mật [Sếp]

```bash
cd packages/contracts-evm
cp -n .env.example .env
```

Điền bằng trình soạn thảo cục bộ vào `.env` (Git bỏ qua); không gửi tệp hay khoá qua chat:

```dotenv
SEPOLIA_RPC_URL=
PRIVATE_KEY=
SERVER_SIGNER_PRIVATE_KEY_EVM=
FUNDER_PRIVATE_KEY=
PAYOUT_WALLET=0x5a5B0Ab8613bA0F16e257228e4109A8F611Ec4fd
INVESTOR_WALLET=0xB3a5B799F05F98f78FE58a7f14CD9A400696d033
ETHERSCAN_API_KEY=
```

- `SEPOLIA_RPC_URL`: RPC Sepolia có API key, chỉ nằm trong tệp cục bộ.
- `PRIVATE_KEY` và `SERVER_SIGNER_PRIVATE_KEY_EVM`: **cùng khoá ví ký máy chủ**, có tiền tố `0x`.
  `deploy.js` cấp mọi vai cho chính ví triển khai; preflight từ chối khi hai khoá khác ví.
- `FUNDER_PRIVATE_KEY`: khoá ví tổng giữ SepoliaETH; chỉ dùng cục bộ, không đưa lên Cloudflare.
- `ETHERSCAN_API_KEY`: tuỳ chọn, chỉ để verify mã nguồn.

## Bước 2. Tạm dừng lịch keeper nếu có [Sếp]

OP-05 không dùng lịch keeper (CH-5): Kiểm soát viên duyệt thì chia ngay. Nếu ở đâu đó đang có lịch gọi
`POST /api/keeper/distribution` hay `/api/keeper/expire-orders` (cron ngoài, dịch vụ hẹn giờ), tạm dừng và
ghi lại nơi đặt, giờ dừng để bật lại sau OP-05.

## Bước 3. Ảnh chụp chỉ đọc database cũ [Sếp chạy; SV lưu]

Chạy trên máy Sếp, chuỗi kết nối database **đang dùng** chỉ dán vào lệnh, không lưu vào tệp nào:

```bash
TOKEN_OLD=$(node -p "require('./packages/shared/src/addresses.json').chains.evm.contracts.ProjectToken")
psql "<chuỗi kết nối database cũ>" -v chain=evm -v token=$TOKEN_OLD -v ON_ERROR_STOP=1 -f scripts/op05-db-check.sql
```

`scripts/op05-db-check.sql` nằm trọn trong `BEGIN TRANSACTION READ ONLY; ... ROLLBACK;`, chỉ xuất số đếm và
cột định danh. Tập "chưa kết thúc" lấy từ mã (kiểm bằng `app/test/op-05-db-check-sql.test.ts`):

| Bảng | Chưa kết thúc | Nguồn |
|---|---|---|
| `PurchaseOrder` | `PLACED`, `CHECKING`, `EXECUTING` (không thuộc `TERMINAL_ORDER_STATUSES`) | `app/src/lib/bank/purchase.state.ts` |
| `TokenRequest` | `PENDING`, `EXECUTING` | `app/src/lib/store/token-request.store.port.ts` |
| `Txn` | `PENDING` | `TxStatus` trong `app/prisma/schema.prisma` |
| `DistributionPeriod` | `OPENING`, `OPEN`, `DISTRIBUTING`; hoặc `vaultCloseStatus` là `PENDING`, `SENT`, `CONFLICT` | `app/src/lib/store/distribution.store.port.ts` |
| `DistributionPayout` | `PENDING`, `SENT`, `FAILED` | như trên |
| `KeeperRun` | `RUNNING` (bảng không có cột chain: đếm mọi chain) | `app/src/lib/store/keeper.store.port.ts` |
| `WithdrawRequest` | `SENDING`, `SENT`, `NEEDS_REVIEW` (không thuộc `WITHDRAW_TERMINAL_STATUSES`) | `app/src/lib/store/vault.store.port.ts` |

Phải thấy: lệnh kết thúc bằng `ROLLBACK`, mã thoát 0. Gửi nguyên văn đầu ra cho SV lưu làm lịch sử. Ở
bước này **không chặn, không sửa** database cũ dù có bản ghi chưa kết thúc. Mạng nội bộ không phân giải được
`*.neon.tech` hoặc chặn cổng 5432 (gặp ngày 21/10/2026) thì cũng làm như sau. Không có `psql`: dùng SQL
Editor của Neon, thay `:'chain'` bằng `'evm'` và `:'token'` bằng địa chỉ ProjectToken trong dấu nháy đơn.

## Bước 4. Database Neon mới và Hyperdrive mới [Sếp]

Database cũ giữ nguyên làm lịch sử (CH-3, QĐ-A): không câu ghi hay xoá nào trên đó. **Chọn vùng AWS Singapore
(`ap-southeast-1`)** cho project Neon: Worker phục vụ người dùng Việt Nam chạy ở Singapore và Hyperdrive tắt cache,
nên mỗi truy vấn tới vùng `us-east-1` thêm khoảng 200 ms (OP-05 ngày 21/10/2026 phải chuyển vùng giữa chừng). Không sửa origin của
Hyperdrive cũ tại chỗ: Worker cũ đang chạy sẽ seed địa chỉ cũ vào database mới.

1. **Neon Console**, đúng project đang dùng: tạo database mới, ví dụ `bidv_rwa_op05`, chủ sở hữu là role ứng
   dụng đang dùng. Role cần `CONNECT, CREATE` trên database và `USAGE, CREATE` trên schema `public`
   (`docs/DEPLOYMENT.md`, mục Hyperdrive). Không sao chép dữ liệu.
   *Phải thấy:* database mới trong danh sách, owner là role ứng dụng, chưa có bảng nào.
2. Ở **Connection Details** của database mới, **bỏ chọn connection pooling** (chuỗi trực tiếp, host không có
   `-pooler`). Hyperdrive tự giữ pool. Chuỗi này chỉ dán vào lệnh bước 3 dưới đây trên máy Sếp; không đưa
   vào repo, chat hay biến Worker.
   *Phải thấy:* chuỗi trỏ đúng tên database mới, host không chứa `-pooler`.
3. Từ `app`, tạo Hyperdrive và tắt cache ngay khi tạo:
   ```bash
   npx wrangler hyperdrive create bidv-rwa-op05 --connection-string="<chuỗi trực tiếp>" --caching-disabled
   ```
   Hyperdrive kiểm kết nối trước khi tạo.
   *Phải thấy:* thông báo tạo thành công kèm ID mới. Lỗi kết nối thì kiểm lại role, mật khẩu, tên database.
4. ```bash
   npx wrangler hyperdrive get <ID mới>
   ```
   *Phải thấy:* caching ở trạng thái disabled, origin là database mới. Ghi ID mới cho PR B.
5. (Tuỳ chọn) chạy app cục bộ với `DATABASE_URL` trỏ database mới, `USE_MOCK_DB=false`,
   `ENABLE_SEPOLIA_DEMO_PROJECT=true`, mở một trang bất kỳ để lược đồ và seed tự áp. Không bắt buộc: Worker tự
   áp ở lần chạy đầu sau bước 9.
   *Phải thấy:* bảng `Role` có 4 dòng; dự án WPT `evm` chưa phát hành.

Hệ quả chấp nhận: dữ liệu demo chain `mock` trên database mới bắt đầu lại.

## Bước 5. Biên dịch, preflight, cấp phí [Sếp]

```bash
npx hardhat compile
npx hardhat run scripts/preflight-sepolia.js --network sepolia
```

Không bật `USE_LOCAL_SOLC` khi biên dịch bản cần verify mã nguồn. Preflight kiểm chainId **11155111**, hai
khoá cùng ví, ví không phải ví mẫu, rồi in **bảng ước phí theo thao tác** (QĐ-E). Gas đo bằng bytecode vừa
biên dịch: một Hardhat nội bộ riêng chạy thật cả vòng (deploy theo đúng `deploy.js`, whitelist, cấu hình
vault, Mint đầu, nạp demo, mua và bán bằng permit, mint lợi nhuận, chia, rút), không gửi giao dịch testnet;
nhân với `maxFeePerGas` hiện tại cộng **20%** dự phòng.

| Thao tác (`--for`) | Số giao dịch | Ví gửi |
|---|---|---|
| `deploy` | 22: 9 constructor, 4 liên kết ERC-3643, 1 đăng ký vault, 3 vai vault, 1 `MATCHER_ROLE`, 3 vai matcher, 1 `SNAPSHOT_ROLE` | ví ký máy chủ |
| `whitelist` | 2 (bỏ qua ví đã đăng ký) | ví ký máy chủ |
| `vault-config` | 3: ví nhận, tỷ lệ 20%, chế độ PERCENT (vault mới có tỷ lệ 0) | ví ký máy chủ |
| `mint-initial` | 1 | ví ký máy chủ |
| `payment-mint` | 1 | ví ký máy chủ |
| `trade` | 2: `buyWithPermit`, `sellWithPermit` | ví ký máy chủ (Nhà đầu tư chỉ ký) |
| `profit-mint` | 1 | ví ký máy chủ |
| `distribute` | 3 với hai người nhận: `createDistributionFromPool`, `closePeriod`, một lô `distributeTo` | ví ký máy chủ |
| `withdraw` | 1 | ví ký máy chủ |
| `demo-cycle` | 12: tổng từ `vault-config` đến `withdraw` | ví ký máy chủ |

Preflight cộng `deploy`, `whitelist` và `demo-cycle`. Thiếu phí: trả mã 1 và in **đúng lệnh** cấp số dư
cần có. Chạy bản `--dry-run` trước (không cần khoá tổng, không tạo signer, không gửi), rồi bản không có cờ:

```bash
node scripts/fund-sepolia.js 0xCa49Fb2590800C9524f2BC57Ecd80C3Cc75D9076 --eth <số preflight in> --dry-run
node scripts/fund-sepolia.js 0xCa49Fb2590800C9524f2BC57Ecd80C3Cc75D9076 --eth <số preflight in>
```

Hoặc cấp theo từng thao tác trước khi làm nó: `--for deploy`, `--for whitelist`, `--for demo-cycle`, hoặc một
thao tác lẻ như `--for trade`. `--eth` là **số dư cần có**, không phải số chuyển thêm: đủ thì không gửi, thiếu
thì chỉ gửi phần chênh. Sau khi gửi, giữ tx hash; timeout thì kiểm receipt trên Etherscan trước khi thử lại.
Không cấp ETH cho `INVESTOR_WALLET`.

*Phải thấy:* `SẴN SÀNG`, mã thoát 0.

## Bước 6. Deploy, verify, kiểm giá R7 [Sếp chạy; SV đọc chuỗi]

```bash
npx hardhat run scripts/deploy.js --network sepolia
npx hardhat run scripts/verify-deployment.js --network sepolia
```

*Phải thấy:* chainId 11155111, deployer là ví ký máy chủ, **chín** địa chỉ mới (`ProjectToken`, `VNDToken`,
`ProfitDistributor`, `Redemption`, `IdentityRegistry`, `ModularCompliance`, `AllowAllModule`,
`SpvPaymentVault`, `OrderSettlement`). Verify trước mọi Mint phải đọc được `initialSupplyMinted = false`,
tổng cung 0, domain permit của WPT và VNDB, vai token và `IdentityRegistry.AGENT_ROLE` của ví ký, registry,
compliance, module, vault trỏ đúng hai token, `MATCHER_ROLE` chỉ ở `OrderSettlement`, ví ký giữ ba vai matcher.

Kiểm giá R7 trong `npx hardhat console --network sepolia`:

```javascript
const a = require('../shared/src/addresses.json').chains.evm.contracts;
const settlement = await ethers.getContractAt('OrderSettlement', a.OrderSettlement);
console.log('OrderSettlement:', a.OrderSettlement, 'price:', String(await settlement.price()));
```

*Phải thấy:* `price` bằng `wptIssuePriceVnd` trong `packages/shared/src/token-parameters.json` (100000).

`deploy.js` vừa ghi `packages/shared/src/addresses.json` (khoá `evm`) và `packages/shared/generated/*`: đây là
nội dung PR B, chưa commit ở bước này.

## Bước 7. Whitelist hai ví [Sếp; SV đọc `isVerified`]

Bước mặc định của ngân hàng (CH-2): liên kết ví trong hồ sơ ở lượt 13.2 **không** tự whitelist. Trong
`npx hardhat console --network sepolia`:

```javascript
const { assertTarget } = require('./scripts/fund-sepolia');
const a = require('../shared/src/addresses.json').chains.evm.contracts;
const registry = await ethers.getContractAt('IdentityRegistry', a.IdentityRegistry);
for (const wallet of [process.env.PAYOUT_WALLET, process.env.INVESTOR_WALLET]) {
  assertTarget(wallet);
  if (await registry.isVerified(wallet)) { console.log(wallet, 'đã đăng ký, bỏ qua'); continue; }
  const tx = await registry.registerIdentity(wallet, 704);
  console.log(wallet, 'tx', tx.hash, 'status', (await tx.wait()).status);
}
for (const wallet of [process.env.PAYOUT_WALLET, process.env.INVESTOR_WALLET]) console.log(wallet, 'isVerified', await registry.isVerified(wallet));
```

*Phải thấy:* hai dòng `isVerified true`; mỗi tx có `status 1`.

## Bước 8. PR B [Sếp mở và merge; SV soát diff]

Từ gốc repo, nhánh mới từ `dev` mới nhất:

```bash
git switch -c chore/op-05-dia-chi-sepolia origin/dev
# Sửa "id" của binding HYPERDRIVE trong app/wrangler.json thành ID mới ở bước 4.
git status --short
git diff -- packages/shared/src/addresses.json
git add packages/shared/src/addresses.json packages/shared/generated app/wrangler.json
git commit -m "chore(op-05): bộ hợp đồng Sepolia lần hai và Hyperdrive mới"
git push -u origin chore/op-05-dia-chi-sepolia
```

*Phải thấy:* `git status --short` chỉ có `packages/shared/src/addresses.json` và `app/wrangler.json`;
`packages/shared/generated/*.abi.json` chỉ xuất hiện khi mã hợp đồng đổi (lần triển khai lại không sửa hợp đồng
thì ABI ghi ra giống hệt bản đã commit, như OP-05 ngày 21/10/2026). Trong `addresses.json` chỉ khoá `evm` đổi
(`hardhat-local` giữ nguyên). Trong `wrangler.json` chỉ dòng `"id"` của `HYPERDRIVE` đổi. Ghi SHA của merge
PR B cho bước 10.

## Bước 9. Cloudflare [Sếp]

Đặt trước khi Workers Builds dựng xong bản từ PR B (QĐ-G):

| Biến | Nơi đặt | Giá trị, lưu ý |
|---|---|---|
| `RPC_EVM` | Worker runtime **Secret** | RPC Sepolia có API key |
| `SERVER_SIGNER_PRIVATE_KEY_EVM` | Worker runtime **Secret** | Khoá ví ký máy chủ (deployer) |
| `KEEPER_SECRET` | Worker runtime **Secret** | Chuỗi ngẫu nhiên ít nhất 32 ký tự. OP-05 không gọi API keeper; đặt sẵn để tự động hoá về sau, API luôn đòi khoá này |
| `NEXT_PUBLIC_RPC_EVM` | **Build variable**, tuỳ chọn | RPC công khai cho ví trình duyệt; không chứa API key |
| `NEXT_PUBLIC_DEFAULT_CHAIN` | **Build variable**, tuỳ chọn | `evm` nếu muốn Sepolia mặc định |
| `ORDER_SETTLEMENT_EVENT_BLOCK_CHUNK` | Worker runtime variable, tuỳ chọn | Mặc định 5.000; giảm nếu RPC giới hạn `eth_getLogs` |
| `RPC_EVM_LOGS` | Worker runtime variable, tuỳ chọn (HF-03) | RPC chỉ để đọc sự kiện (`eth_getLogs`). Trống thì dùng RPC công khai mặc định `https://ethereum-sepolia-rpc.publicnode.com` (tối đa 50.000 block mỗi lần). **Không** trỏ Alchemy gói miễn phí: chỉ cho 10 block mỗi lần |
| `EVM_LOG_BLOCK_CHUNK` | Worker runtime variable, tuỳ chọn (HF-03) | Số block mỗi đoạn quét lịch sử vault, mặc định 10.000; phải nhỏ hơn giới hạn của `RPC_EVM_LOGS` |
| `USE_MOCK_DB`, `ENABLE_SEPOLIA_DEMO_PROJECT`, `ENABLE_DEMO_TOKEN_MINT` | `app/wrangler.json` | `false`, `true`, `false` |
| `ENABLE_DEMO_PAYMENT_MINT` | `app/wrangler.json` | `true` cho bản PoC testnet (CH-6) |
| `HYPERDRIVE` | binding trong `app/wrangler.json` | ID mới từ PR B |

Xoá mọi `NEXT_PUBLIC_ADDR_EVM_*` còn ở Build variables và Worker variables: env ghi đè address book và sẽ trỏ
app về bytecode cũ. **Không** đặt `FUNDER_PRIVATE_KEY`, `PRIVATE_KEY`, `NEXT_PUBLIC_ADDR_EVM_*` trên Worker.
Chờ Workers Builds dựng từ `dev` sau merge PR B.

*Phải thấy:* bản build mới của commit merge PR B ở trạng thái thành công trong Workers Builds.

## Bước 10. Kiểm khói [SV hoặc Sếp]

```bash
node scripts/smoke-test.mjs https://bidv-rwa-tokenize.tuanlhbidv.workers.dev --expect-commit=$(git rev-parse <SHA merge PR B>) --chain=evm
```

*Phải thấy:* commit khớp, chain `evm`, WPT decimals 0, tổng cung 0 đọc qua adapter. Kiểm khói chỉ GET, không
gửi giao dịch. Sai thì lùi (mục cuối) và dừng.

## Bước 11. Kiểm chỉ đọc database mới [Sếp chạy; SV đối chiếu]

Sau khi mở URL công khai ít nhất một lần (Worker tự áp lược đồ và seed; lần đầu trên database mới có thể treo vài
phút trong lúc tạo lược đồ và Neon khởi động, chờ rồi mở lại):

```bash
TOKEN_NEW=$(node -p "require('./packages/shared/src/addresses.json').chains.evm.contracts.ProjectToken")
psql "<chuỗi trực tiếp database mới>" -v chain=evm -v token=$TOKEN_NEW -v ON_ERROR_STOP=1 -f scripts/op05-db-check.sql
```

*Phải thấy:* bảy bảng đều `0`; một dòng `WPT | evm | <ProjectToken mới> | t | t` (khớp address book, chưa phát
hành); giá `wpt.issue_price_vnd.evm` (nếu có dòng) bằng `price` đọc ở bước 6; `số vai` là 4. Sai một ô thì lùi
và dừng.

## Bước 12. Cấu hình vault [App: Kiểm soát viên]

Màn `/vault`, khối cấu hình khoá (BE-13): ví nhận `PAYOUT_WALLET`, PERCENT 20%, **không** đặt số cố định
(CH-1: FIXED ưu tiên, nên để trống thì vault theo PERCENT). Lưu.

*Phải thấy:* ba bước giao dịch (ví nhận, tỷ lệ, chế độ), mỗi bước có tx hash; màn hiện PERCENT, 20%, khoá 0.

## Bước 13. Vòng nghiệp vụ [App và Sếp]

Chọn chain Sepolia (`evm`). Đặt lệnh **từng lệnh một**: hàng đợi gửi của FE-05 chỉ nằm trong một tiến trình.
Mỗi lượt ghi mã yêu cầu hoặc mã lệnh, tx hash, receipt `status = 1`, số dư sau và đối chiếu bảng dưới.
**Lệch thì dừng**, gửi số đo cho SV.

| Lượt | Thao tác | Vai, màn |
|---|---|---|
| 13.1 | Mint đầu 1.000.000 WPT vào `SPV_PAYMENT_VAULT` | Giao dịch viên lập `/draft`, Kiểm soát viên duyệt `/approvals` |
| 13.2 | Kết nối MetaMask `INVESTOR_WALLET`; trang `/account`, khối "Ví liên kết trên chain", bấm "Dùng ví đang kết nối", Lưu | Nhà đầu tư |
| 13.3 | Nạp 20.000.000 VNDB demo cho `INVESTOR_WALLET` | Giao dịch viên, `/demo-payment` |
| 13.4 | Mua 100 WPT, ký `permit` trong MetaMask | Nhà đầu tư, `/trade` |
| 13.5 | Bán 40 WPT, ký `permit` | Nhà đầu tư, `/trade` |
| 13.6 | Mint 1.000.000 VNDB vào `ProfitDistributor` (lệnh console bên dưới) | Sếp |
| 13.7 | Duyệt con số 1.000.000 VNDB của kỳ, bấm duyệt thì chia | Kiểm soát viên, `/distribution` |
| 13.8 | Rút 3.399.970 VNDB (50% phần rút được) về `PAYOUT_WALLET` | Người bán, `/seller/withdraw` |

Trước 13.4, khối kiểm tra của `/trade` phải đạt điều kiện "Định danh" (ví thuộc hồ sơ, hồ sơ đã định danh, ví
đã whitelist ở bước 7). Ví chưa liên kết thì điều kiện này trượt.

**Lượt 13.6 là bước tay duy nhất**, thay cho việc SPV chuyển lợi nhuận vào quỹ; đây là thay thế của bản trình
diễn, chưa có màn nạp lợi nhuận cho SPV. Cấp phí trước bằng `--for profit-mint`, rồi trong
`npx hardhat console --network sepolia`:

```javascript
const a = require('../shared/src/addresses.json').chains.evm.contracts;
const vnd = await ethers.getContractAt('VNDToken', a.VNDToken);
const tx = await vnd.mint(a.ProfitDistributor, 1_000_000n);
console.log('tx', tx.hash, 'status', (await tx.wait()).status);
const pool = await ethers.getContractAt('ProfitDistributor', a.ProfitDistributor);
console.log('unallocated', String(await pool.unallocatedBalance()));
```

*Phải thấy:* `status 1`, `unallocated 1000000`.

### Số dư kỳ vọng

Giá 100.000 VNDB/WPT. Tổng cung lúc chia 1.000.000 WPT nên không có phần dư. `closePeriod` nhận **toàn bộ**
số đã dành cho kỳ (1.000.000 VNDB), không phải riêng phần vault nhận.

| Sau lượt | WPT Nhà đầu tư | VNDB Nhà đầu tư | WPT vault | VNDB vault | `netProceeds` | `lockedAmount` | `withdrawable` |
|---|---|---|---|---|---|---|---|
| 13.1 | 0 | 0 | 1.000.000 | 0 | 0 | 0 | 0 |
| 13.3 | 0 | 20.000.000 | 1.000.000 | 0 | 0 | 0 | 0 |
| 13.4 | 100 | 10.000.000 | 999.900 | 10.000.000 | 10.000.000 | 2.000.000 | 8.000.000 |
| 13.5 | 60 | 14.000.000 | 999.940 | 6.000.000 | 6.000.000 | 1.200.000 | 4.800.000 |
| 13.7 | 60 | 14.000.060 | 999.940 | 6.999.940 | 6.000.000 | 200.000 | 6.799.940 |
| 13.8 | 60 | 14.000.060 | 999.940 | 3.599.970 | 6.000.000 | 200.000 | 3.399.970 |

- Sau 13.7: quỹ chia còn 0 VNDB chưa phân bổ; vault `lastPeriodRef = 1`, `lastDistributedPrev = 1.000.000`,
  `percentLocked = 200.000`.
- `PAYOUT_WALLET` nhận 3.399.970 VNDB ở 13.8.
- Số dư ETH của `INVESTOR_WALLET` không đổi suốt vòng.

Bảng này đã chạy khớp từng ô trên nút Hardhat bằng service của app: `app/test/op-05-demo-cycle-evm.test.ts`.

Đọc số dư nhanh trong console:

```javascript
const a = require('../shared/src/addresses.json').chains.evm.contracts;
const wpt = await ethers.getContractAt('ProjectToken', a.ProjectToken);
const vnd = await ethers.getContractAt('VNDToken', a.VNDToken);
const vault = await ethers.getContractAt('SpvPaymentVault', a.SpvPaymentVault);
const inv = process.env.INVESTOR_WALLET;
console.log([await wpt.balanceOf(inv), await vnd.balanceOf(inv), await wpt.balanceOf(a.SpvPaymentVault),
  await vnd.balanceOf(a.SpvPaymentVault), await vault.netProceeds(), await vault.lockedAmount(),
  await vault.withdrawable()].map(String).join(' | '));
```

## Bước 14. Bàn giao [Sếp gửi; SV]

Gửi **đầu ra nguyên văn không chứa bí mật**: SHA và Version ID bước 0, đầu ra bước 3 và 11, preflight, deploy,
verify, giá R7, whitelist, ID Hyperdrive mới (công khai), SHA PR B, kiểm khói, và từng lượt của bước 13 (mã yêu
cầu hoặc mã lệnh, tx hash, số dư). Không gửi khoá, RPC có API key hay chuỗi kết nối. SV đọc chuỗi đối chiếu bảng
số dư, soạn `CHECKPOINT_OP05.md` mục "Kết quả chạy Sepolia" cho PR C. Bật lại lịch keeper đã dừng ở bước 2 nếu
cần.

## Đường lùi

- **Trước khi PR B merge** (bước 0 đến 8): người dùng không bị ảnh hưởng. Bản đang chạy vẫn dùng bộ hợp đồng
  cũ và Hyperdrive cũ; database cũ còn nguyên.
- **Sau khi PR B merge mà hỏng** (bước 10 hoặc 11 sai, hoặc vòng nghiệp vụ không chạy được): revert PR B trên
  `dev`; Workers Builds dựng lại bản cũ với address book cũ và Hyperdrive cũ; database cũ còn nguyên. Bộ hợp đồng
  mới vẫn nằm trên Sepolia, không ảnh hưởng gì; database mới để nguyên chờ lần chạy sau.
- Không sửa dữ liệu bằng SQL ở cả hai database. Không chạy `scripts/dod-verify-sepolia.js`: script cũ bị chặn
  cứng trên bộ có vault (CH-7) và thoát lỗi trước khi lấy signer.

## Diễn tập cục bộ (coder, không dùng Sepolia)

Các lệnh bước 6, 7, lượt 13.6 và lệnh chặn `dod-verify-sepolia.js` đã chạy trên `--network localhost` với
address book và ABI được sao lưu và phục hồi bằng `trap ... EXIT` (QĐ-K). Đầu ra ở `docs/CHECKPOINT_OP05.md`.
