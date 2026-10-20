# OP-05: chi tiết kiểm chứng (PR A)

Tệp này giữ đầu ra dài theo `.kiro/steering/efficiency.md`. Mọi khối là đầu ra của lệnh ghi ở dòng đầu khối
(bỏ mã màu terminal; khối quá dài chỉ giữ dòng lệnh, dòng từng ca và dòng kết quả), mã thoát ở dòng `exit=`.
Nhánh `feat/op-05-runbook`, nền `dev` @ `7d058de`. Môi trường: `USE_LOCAL_SOLC=1`; Postgres 16 cục bộ. Kiểm
thử nút thật chạy từng tệp một lệnh, reset chuỗi trước mỗi tệp.

## 1. Hiện trạng đã đo (bước 0)

Các lệnh ở mục "Hiện trạng đã đo" của spec, chạy trên `dev` @ `7d058de`.

```text
$ git log --oneline -1
7d058de Merge pull request #61 from tuannino/feat/fe-08-duyet-chia
$ grep -n "issuedAt IS NULL\|ON CONFLICT (\"tokenSymbol\", \"chain\")" app/src/lib/store/postgres.pool.ts
510:       WHERE "Project"."issuedAt" IS NULL
exit=0
$ grep -n "export async function collectRecipients" app/src/lib/bank/distribution.service.ts
337:export async function collectRecipients(chain: ChainKey, ledger: ILedgerPort): Promise<Recipients> {
exit=0
$ grep -n "'identity',\|findInvestorProfileByWallet" app/src/lib/bank/trade.service.ts
20:  findInvestorProfileByWallet,
188:export const TRADE_CONDITION_KEYS = ['account', 'identity', 'wallet', 'token', 'risk'] as const;
298:    const investorProfile = findInvestorProfileByWallet(investorWallet);
317:        'identity',
exit=0
$ grep -n "wallet: SAMPLE_WALLETS" app/src/lib/bank/account-profile.service.ts
68:    wallet: SAMPLE_WALLETS.NDT001,
86:    wallet: SAMPLE_WALLETS.NB001,
exit=0
$ grep -n "exportAbi\|writeAddresses" packages/contracts-evm/scripts/deploy.js
27:async function exportAbi(contractName) {
52:function writeAddresses(chainKey, record) {
177:  const written = writeAddresses(chainKey, {
195:    await exportAbi(name);
exit=0
$ grep -n '"id"' app/wrangler.json
32:      "id": "bf7828b9f4bb42de9f65123d0f00e4a3",
exit=0
```

Nền trước khi làm: `bash scripts/run-local-all.sh` trên `7d058de` (dòng tổng kết):

```text
  PASS  viem/ethers không xuất hiện ngoài app/src/lib
  PASS  Không có lời gọi contract trực tiếp trong components/ và app/
  PASS  SERVER_SIGNER_PRIVATE_KEY chỉ đọc ở env.ts và server.signer.ts
  PASS  Không có app/.env trong cây làm việc
  PASS  Không có private key dạng hex 64 ký tự nhúng trong mã nguồn
  PASS  Không có so sánh role cứng ngoài lib/rbac
  PASS  actions/bank.ts có 7 server action (guard nằm ở tầng service, xem lớp 1)
  PASS  Bảng quyền không teo lại so với origin/dev (37 -> 37 hành động)
  PASS  Không có ABI nhúng trong app/src (chỉ dùng từ packages/shared)
  PASS  Không có contract ID Stellar hardcode trong app/src
  PASS  Contract chính không import từ trex/ (toolchain tách biệt)
  PASS  Không còn tham chiếu Polygon/Amoy/Mumbai (ngoài comment)
  PASS  Không còn ký hiệu cũ SPT / tVND
  PASS  Có .kiro/steering
  PASS  Có .kiro/specs
  PASS  Có docs
  PASS  spec p4-mint-testnet đủ 3 file
  PASS  spec p7-profit-distribution đủ 3 file
  PASS  spec p12-redemption đủ 3 file
  PASS  app/package-lock.json đã được commit (npm ci trong Docker chạy được)
  158 passing (9s)
      Tests  1075 passed | 75 skipped (1150)
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 3 - ĐIỂM CẮM (marker)
    PASS  LỚP 3 - KHUÔN CHECKPOINT
    PASS  LỚP 1 - SPEC TEST CONTRACT EVM
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST
EXIT=0
```

## 2. Ca 1: runbook

```text
$ awk '/^## Tổng quan 15 bước/,/^Ba PR/' docs/TESTNET_SEPOLIA.md | grep -cE "^\| (1[0-4]|[0-9]) \|"
15
exit=0
$ grep -n "^## Bước\|^## Đường lùi\|^## Ai làm gì" docs/TESTNET_SEPOLIA.md
19:## Ai làm gì
63:## Bước 0. Điều kiện vào [Sếp; SV kiểm SHA]
73:## Bước 1. Ví và biến bí mật [Sếp]
98:## Bước 2. Tạm dừng lịch keeper nếu có [Sếp]
104:## Bước 3. Ảnh chụp chỉ đọc database cũ [Sếp chạy; SV lưu]
130:## Bước 4. Database Neon mới và Hyperdrive mới [Sếp]
160:## Bước 5. Biên dịch, preflight, cấp phí [Sếp]
201:## Bước 6. Deploy, verify, kiểm giá R7 [Sếp chạy; SV đọc chuỗi]
227:## Bước 7. Whitelist hai ví [Sếp; SV đọc `isVerified`]
247:## Bước 8. PR B [Sếp mở và merge; SV soát diff]
266:## Bước 9. Cloudflare [Sếp]
288:## Bước 10. Kiểm khói [SV hoặc Sếp]
297:## Bước 11. Kiểm chỉ đọc database mới [Sếp chạy; SV đối chiếu]
310:## Bước 12. Cấu hình vault [App: Kiểm soát viên]
317:## Bước 13. Vòng nghiệp vụ [App và Sếp]
386:## Bước 14. Bàn giao [Sếp gửi; SV]
394:## Đường lùi
exit=0
$ awk '/^## Bước 4/,/^## Bước 5/' docs/TESTNET_SEPOLIA.md | grep -cE "^\*Phải thấy|^   \*Phải thấy"
5
exit=0
$ grep -c "SPV_PAYMENT_VAULT\|PAYOUT_WALLET\|INVESTOR_WALLET" docs/TESTNET_SEPOLIA.md
17
exit=0
$ grep -nE -- "--for (cycle|mint|burn)\b|SPV_SEPOLIA_ADDRESS|mintInitialSupply\(spv" docs/TESTNET_SEPOLIA.md || echo "không còn bước Mint vào ví SPV hay cycle cũ"
không còn bước Mint vào ví SPV hay cycle cũ
$ grep -nE "·|—|→" docs/TESTNET_SEPOLIA.md || echo "không có ký tự cấm"
không có ký tự cấm
```

## 3. Ca 2 và ca 5 (kiểm thử script)

```text
$ cd packages/contracts-evm && npx hardhat test test/fund-sepolia.test.js test/sc-07-scripts.test.js


  OP-04 — cấp phí Sepolia
    ✔ từ chối chain khác Sepolia trước khi có thể ký
    ✔ từ chối ví mẫu từ nguồn chung và Hardhat #0, kể cả khác hoa thường
    ✔ chỉ bù phần thiếu, dùng số nguyên và làm tròn phí lên
    ✔ đủ số dư thì không tạo signer và không gửi
    ✔ --dry-run thiếu phí cũng không đọc khóa hoặc gửi giao dịch
    ✔ gửi đúng phần thiếu, gắn chain Sepolia và chờ receipt
    ✔ tham số phải chọn một chế độ và số ETH phải dương
    ✔ phân loại lỗi an toàn, không lộ URL hay thân lỗi RPC
    ✔ báo riêng thiếu khóa cấp phí
    ✔ báo riêng số dư tài khoản tổng không đủ

  OP-04 — preflight phí ví ký
    ✔ thiếu phí in lệnh nạp tổng số dư yêu cầu, script sẽ chỉ bù phần thiếu
    ✔ báo đủ khi số dư ví ký đủ deploy + whitelist + một vòng trình diễn

  OP-05 ca 2: ước phí theo thao tác và theo ví gửi
    ✔ mỗi thao tác có gas lớn hơn 0 khi mô phỏng, số giao dịch khớp bảng; demo-cycle bằng tổng
    ✔ bảng in theo thao tác, mỗi dòng ghi ví gửi; --dry-run không cần khoá tổng
    ✔ bỏ thao tác cũ cycle, mint, burn

  SC-07 - công cụ an toàn
    ✔ ca 25: P4 cũ dừng trước giao dịch khi chưa Mint đầu (851ms)
    ✔ OP-05 ca 5: chặn cứng khi address book của chain có SpvPaymentVault, không cần signer


  17 passing (3s)

exit=0

$ cd packages/contracts-evm && HARDHAT_NETWORK=hardhat node scripts/fund-sepolia.js --local-estimates
OP05_GAS={"deploy":{"gas":"12087873","txs":22},"whitelist":{"gas":"96798","txs":2},"vault-config":{"gas":"160859","txs":3},"mint-initial":{"gas":"133266","txs":1},"payment-mint":{"gas":"70896","txs":1},"trade":{"gas":"479349","txs":2},"profit-mint":{"gas":"53796","txs":1},"distribute":{"gas":"542238","txs":3},"withdraw":{"gas":"76319","txs":1}}
exit=0
```

## 4. Ca 3: liên kết ví (bộ nhớ và Postgres)

```text
$ cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@localhost:5432/bidv_rwa npx vitest run test/op-05-profile-wallet.test.ts test/op-05-profile-wallet-store.test.ts test/op-05-db-check-sql.test.ts test/account-profile.test.ts --reporter=verbose
 ✓ test/op-05-profile-wallet-store.test.ts > OP-05: ràng buộc ví liên kết khai trong bảng ánh xạ lỗi > ProfileWallet_chain_walletKey_key ánh xạ về bảng và cột 1ms
 ✓ test/op-05-profile-wallet-store.test.ts > OP-05 QĐ-I: cổng ví liên kết bản bộ nhớ > ghi, thay ví trả ví cũ, đọc lại theo hồ sơ và theo ví không phân biệt hoa thường 7ms
 ✓ test/op-05-profile-wallet-store.test.ts > OP-05 QĐ-I: cổng ví liên kết bản bộ nhớ > một ví hai hồ sơ trên cùng chain: UniqueConstraintError; khác chain thì được 1ms
 ✓ test/op-05-profile-wallet-store.test.ts > OP-05 QĐ-I: cổng ví liên kết bản bộ nhớ > liên kết lại đúng ví đang có của mình thì được (không vướng ràng buộc của chính mình) 0ms
 ✓ test/op-05-profile-wallet-store.test.ts > OP-05 QĐ-I: cổng ví liên kết bản Postgres > ghi, thay ví trả ví cũ, đọc lại theo hồ sơ và theo ví không phân biệt hoa thường 620ms
 ✓ test/op-05-profile-wallet-store.test.ts > OP-05 QĐ-I: cổng ví liên kết bản Postgres > một ví hai hồ sơ trên cùng chain: UniqueConstraintError; khác chain thì được 69ms
 ✓ test/op-05-profile-wallet-store.test.ts > OP-05 QĐ-I: cổng ví liên kết bản Postgres > liên kết lại đúng ví đang có của mình thì được (không vướng ràng buộc của chính mình) 31ms
 ✓ test/account-profile.test.ts > FE-24 — nguồn hồ sơ bốn vai > phiên sạch hoặc DEMO_ROLE cũ không hợp lệ đều về TELLER mặc định 9ms
 ✓ test/account-profile.test.ts > FE-24 — nguồn hồ sơ bốn vai > INVESTOR chỉ đọc hồ sơ của chính mình 1ms
 ✓ test/account-profile.test.ts > FE-24 — nguồn hồ sơ bốn vai > SELLER chỉ đọc hồ sơ của chính mình 1ms
 ✓ test/account-profile.test.ts > FE-24 — nguồn hồ sơ bốn vai > TELLER chỉ đọc hồ sơ của chính mình 1ms
 ✓ test/account-profile.test.ts > FE-24 — nguồn hồ sơ bốn vai > CONTROLLER chỉ đọc hồ sơ của chính mình 1ms
 ✓ test/account-profile.test.ts > FE-24 — nguồn hồ sơ bốn vai > mã người dùng của vai khác không làm lộ hồ sơ 1ms
 ✓ test/account-profile.test.ts > FE-24 — nguồn hồ sơ bốn vai > hai vai khách hàng có hồ sơ KYC, rủi ro, AML, hạn mức và ví 1ms
 ✓ test/account-profile.test.ts > FE-24 — nguồn hồ sơ bốn vai > hai vai ngân hàng không có trường đầu tư và không có ví 1ms
 ✓ test/account-profile.test.ts > FE-24 — nguồn hồ sơ bốn vai > khối trước lệnh tra đúng hồ sơ bằng ví, không khớp ví người bán 1ms
 ✓ test/op-05-profile-wallet.test.ts > OP-05 ca 3: liên kết ví trong hồ sơ > lưu và đọc lại theo chain; chain khác không bị ảnh hưởng; audit ghi ví cũ và ví mới 12ms
 ✓ test/op-05-profile-wallet.test.ts > OP-05 ca 3: liên kết ví trong hồ sơ > phiên chỉ sửa được hồ sơ của chính mình: mã hồ sơ trong dữ liệu vào bị bỏ qua 1ms
 ✓ test/op-05-profile-wallet.test.ts > OP-05 ca 3: liên kết ví trong hồ sơ > vai nhân viên TELLER: FORBIDDEN, có dòng DENIED, không ghi 1ms
 ✓ test/op-05-profile-wallet.test.ts > OP-05 ca 3: liên kết ví trong hồ sơ > vai nhân viên CONTROLLER: FORBIDDEN, có dòng DENIED, không ghi 1ms
 ✓ test/op-05-profile-wallet.test.ts > OP-05 ca 3: liên kết ví trong hồ sơ > ví mẫu Hardhat bị từ chối trên evm, vẫn nhận trên hardhat-local và mock 3ms
 ✓ test/op-05-profile-wallet.test.ts > OP-05 ca 3: liên kết ví trong hồ sơ > một ví hai hồ sơ trên cùng chain bị từ chối; khác chain thì được 1ms
 ✓ test/op-05-profile-wallet.test.ts > OP-05 ca 3: liên kết ví trong hồ sơ > dữ liệu vào sai: VALIDATION, không ghi 2ms
 ✓ test/op-05-profile-wallet.test.ts > OP-05 ca 3: liên kết ví trong hồ sơ > tra hồ sơ theo chain: evm không có ví mặc định; mock giữ ví mẫu tới khi liên kết ví khác 1ms
 ✓ test/op-05-profile-wallet.test.ts > OP-05 ca 3: previewTrade trên chain thật dùng ví liên kết > ví đã liên kết và whitelist: đạt; ví chưa liên kết: trượt "không thuộc hồ sơ" 6ms
 ✓ test/op-05-profile-wallet.test.ts > OP-05 ca 3: previewTrade trên chain thật dùng ví liên kết > ví liên kết nhưng chưa whitelist: trượt vì danh sách được phép (liên kết không tự whitelist) 2ms
 ✓ test/op-05-db-check-sql.test.ts > OP-05 QĐ-F: câu kiểm database chỉ đọc khớp trạng thái trong mã > cả tệp trong một transaction READ ONLY rồi ROLLBACK, không có câu ghi 2ms
 ✓ test/op-05-db-check-sql.test.ts > OP-05 QĐ-F: câu kiểm database chỉ đọc khớp trạng thái trong mã > mỗi bảng dùng đúng tập chưa kết thúc của mã 2ms
 Test Files  4 passed (4)
      Tests  28 passed (28)
exit=0
```

## 5. Ca 4 và ca 5 trên nút Hardhat thật

```text
$ bash scripts/evm-local.sh reset
⚠️  Vừa reset chuỗi: KHỞI ĐỘNG LẠI app nếu đang chạy, nếu không dữ liệu trong bộ nhớ của app lệch chuỗi mới.
$ (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/op-05-demo-cycle-evm.test.ts)
 ✓ test/op-05-demo-cycle-evm.test.ts (8 tests) 4260ms
   ✓ OP-05 ca 4: vòng trình diễn lượt 12 đến 13.8 trên nút Hardhat thật > lượt 13.4, 13.5: mua 100 rồi bán 40 WPT bằng chữ ký permit, từng lệnh một  683ms
   ✓ OP-05 ca 4: vòng trình diễn lượt 12 đến 13.8 trên nút Hardhat thật > lượt 13.6, 13.7: mint 1.000.000 VNDB vào ProfitDistributor (bước tay), Kiểm soát viên duyệt thì chia ngay  425ms
   ✓ OP-05 ca 4: vòng trình diễn lượt 12 đến 13.8 trên nút Hardhat thật > ca 5: dod-verify-sepolia.js trên localhost thoát lỗi QĐ-J trước khi gửi, nonce ví ký không đổi  1480ms
 Test Files  1 passed (1)
      Tests  8 passed (8)
exit=0
$ bash scripts/evm-local.sh down
[evm-local] đã dừng nút (pid 11735)
```

## 6. Ca 6: kiểm database chỉ đọc QĐ-F trên Postgres cục bộ

Database (a) do chính app tạo: `next start` với `USE_MOCK_DB=false`, `ENABLE_SEPOLIA_DEMO_PROJECT=true`, `DATABASE_URL` trỏ database rỗng `bidv_op05_ca6`, mở `/` và `/api/version` một lần cho lược đồ và seed tự áp. `DB=postgresql://bidv:bidv@localhost:5432` (Postgres cục bộ của sandbox). Câu INSERT ở (b) chỉ dựng dữ liệu thử trên bản sao cục bộ, không có trong runbook.

```text
$ TOKEN=$(node -p "require('./packages/shared/src/addresses.json').chains.evm.contracts.ProjectToken"); echo $TOKEN
0x995c29ff422483Ddbc7C6A671ECEC5A5f38C3d62
# (a) database mới, app vừa tự áp lược đồ và seed ở lần chạy đầu
$ psql "$DB/bidv_op05_ca6" -v chain=evm -v token=$TOKEN -v ON_ERROR_STOP=1 -f scripts/op05-db-check.sql
BEGIN
        bảng        | chưa kết thúc | mã 
--------------------+---------------+----
 PurchaseOrder      |             0 | 
 TokenRequest       |             0 | 
 Txn                |             0 | 
 DistributionPeriod |             0 | 
 DistributionPayout |             0 | 
 KeeperRun          |             0 | 
 WithdrawRequest    |             0 | 
(7 rows)

 tokenSymbol | chain |              contractAddress               | khớp address book | chưa phát hành 
-------------+-------+--------------------------------------------+-------------------+----------------
 WPT         | evm   | 0x995c29ff422483Ddbc7C6A671ECEC5A5f38C3d62 | t                 | t
(1 row)

           key           | value  
-------------------------+--------
 wpt.issue_price_vnd.evm | 100000
(1 row)

 số vai |                 vai                  
--------+--------------------------------------
      4 | CONTROLLER, INVESTOR, SELLER, TELLER
(1 row)

ROLLBACK
exit=0

# (b) bản sao database (a), dựng thử một lệnh rút đang dở trên evm
$ psql "$DB/bidv_op05_ca6_dirty" -c 'INSERT INTO "WithdrawRequest" ("id","chain","clientRequestId","amount","purpose","payoutWallet","status","activeChain","createdBy","updatedAt") VALUES (...)'
INSERT 0 1
exit=0
$ psql "$DB/bidv_op05_ca6_dirty" -v chain=evm -v token=$TOKEN -v ON_ERROR_STOP=1 -f scripts/op05-db-check.sql
BEGIN
        bảng        | chưa kết thúc |                  mã                  
--------------------+---------------+--------------------------------------
 PurchaseOrder      |             0 | 
 TokenRequest       |             0 | 
 Txn                |             0 | 
 DistributionPeriod |             0 | 
 DistributionPayout |             0 | 
 KeeperRun          |             0 | 
 WithdrawRequest    |             1 | 00000000-0000-4000-8000-0000000000aa
(7 rows)

 tokenSymbol | chain |              contractAddress               | khớp address book | chưa phát hành 
-------------+-------+--------------------------------------------+-------------------+----------------
 WPT         | evm   | 0x995c29ff422483Ddbc7C6A671ECEC5A5f38C3d62 | t                 | t
(1 row)

           key           | value  
-------------------------+--------
 wpt.issue_price_vnd.evm | 100000
(1 row)

 số vai |                 vai                  
--------+--------------------------------------
      4 | CONTROLLER, INVESTOR, SELLER, TELLER
(1 row)

ROLLBACK
exit=0

# (c) câu ghi trong transaction chỉ đọc bị Postgres từ chối
$ psql "$DB/bidv_op05_ca6_dirty" -v ON_ERROR_STOP=1 -c 'BEGIN TRANSACTION READ ONLY' -c 'DELETE FROM "WithdrawRequest"' -c 'ROLLBACK'
BEGIN
ERROR:  cannot execute DELETE in a read-only transaction
exit=1
$ psql "$DB/bidv_op05_ca6_dirty" -Atc 'SELECT count(*) FROM "WithdrawRequest"'
1
exit=0
```

## 7. Ca 7: diễn tập QĐ-K

Lệnh: `USE_LOCAL_SOLC=1 bash run.sh` (kịch bản theo khuôn tasks.md bước 5: sao lưu address book và ABI, `trap ... EXIT` phục hồi và dừng nút). Đoạn console là nguyên văn runbook, gõ qua pty; chỉ đổi `chains.evm` thành `chains['hardhat-local']`. Nút ký có nonce 48 sau `evm-local.sh reset` vì reset tự deploy và seed trước.

```text
$ bash scripts/evm-local.sh reset
$ npx hardhat run scripts/deploy.js --network localhost
$ npx hardhat run scripts/verify-deployment.js --network localhost
$ npx hardhat console --network localhost   # gõ 06-gia-r7.js; chains.evm thay bằng chains['hardhat-local']
$ npx hardhat console --network localhost   # gõ 07-whitelist.js; chains.evm thay bằng chains['hardhat-local']
$ npx hardhat console --network localhost   # gõ 13-6-mint-loi-nhuan.js; chains.evm thay bằng chains['hardhat-local']
$ npx hardhat run scripts/dod-verify-sepolia.js --network localhost
exit=1
exit=0
$ git status --short   # phải rỗng
```

## 8. Ca 8: tech-report

```text
$ grep -n "^## 3.28" docs/tech-report.md
2750:## 3.28. Ví liên kết trong hồ sơ cá nhân (OP-05 QĐ-I) ⚠️ NỢ KỸ THUẬT
$ awk '/^## 3.28/,/^## 4.1/' docs/tech-report.md | grep -c "Hồ sơ mẫu gồm gì\|So ví thế nào\|Liên kết ví mới\|Vì sao chưa an toàn\|Hướng trả nợ (AU-01)"
5
$ grep -n "Ví liên kết trong hồ sơ không chứng minh quyền sở hữu" docs/tech-report.md | cut -c1-120
697:| **P1** | **Ví liên kết trong hồ sơ không chứng minh quyền sở hữu** (OP-05 QĐ-I, CH-2; xem 3.28): 
```

## 9. Ca 9: run-local-all.sh

```text
$ bash scripts/run-local-all.sh
  PASS  viem/ethers không xuất hiện ngoài app/src/lib
  PASS  Không có lời gọi contract trực tiếp trong components/ và app/
  PASS  SERVER_SIGNER_PRIVATE_KEY chỉ đọc ở env.ts và server.signer.ts
  PASS  Không có app/.env trong cây làm việc
  PASS  Không có private key dạng hex 64 ký tự nhúng trong mã nguồn
  PASS  Không có so sánh role cứng ngoài lib/rbac
  PASS  actions/bank.ts có 7 server action (guard nằm ở tầng service, xem lớp 1)
  PASS  Bảng quyền không teo lại so với origin/dev (37 -> 37 hành động)
  PASS  Không có ABI nhúng trong app/src (chỉ dùng từ packages/shared)
  PASS  Không có contract ID Stellar hardcode trong app/src
  PASS  Contract chính không import từ trex/ (toolchain tách biệt)
  PASS  Không còn tham chiếu Polygon/Amoy/Mumbai (ngoài comment)
  PASS  Không còn ký hiệu cũ SPT / tVND
  PASS  Có .kiro/steering
  PASS  Có .kiro/specs
  PASS  Có docs
  PASS  spec p4-mint-testnet đủ 3 file
  PASS  spec p7-profit-distribution đủ 3 file
  PASS  spec p12-redemption đủ 3 file
  PASS  app/package-lock.json đã được commit (npm ci trong Docker chạy được)
  => PASS có cảnh báo: luật kiến trúc
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)
  => PASS: LỚP 3 - KHUÔN CHECKPOINT
  162 passing (12s)
  => PASS: LỚP 1 - SPEC TEST CONTRACT EVM
  => PASS: APP - TYPECHECK
  => PASS: APP - LINT
 Test Files  57 passed | 9 skipped (66)
      Tests  1093 passed | 83 skipped (1176)
  => PASS: APP - VITEST
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 3 - ĐIỂM CẮM (marker)
    PASS  LỚP 3 - KHUÔN CHECKPOINT
    PASS  LỚP 1 - SPEC TEST CONTRACT EVM
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST
   6  app/src/lib/bank/distribution.service.ts:556           mở kỳ trên chuỗi bằng nhãn dùng một lần, lưu mã giao dịch trước khi chờ, tra kỳ trên chuỗi để hoàn tất hoặc phục hồi  ::driveOpening
  10  app/src/app/actions/distribution.ts:55                 nhận yêu cầu tiếp tục kỳ đã duyệt: phục hồi, đối soát vault, chia lô còn lại  ::continueDistributionAction
  11  app/src/lib/bank/distribution-approval.service.ts:467  kiểm quyền distribution:approve, phục hồi kỳ OPENING, kỳ phải APPROVED, chạy một lượt chia có ghi nguồn MANUAL  ::continueDistribution
exit=0
```

## 10. Ca 9: job A (dời artifacts có trap)

```text
$ ( set -e; BAK=...; mv artifacts; trap ...; bash scripts/run-local-all.sh arch markers checkpoint app )
  PASS  viem/ethers không xuất hiện ngoài app/src/lib
  PASS  Không có lời gọi contract trực tiếp trong components/ và app/
  PASS  SERVER_SIGNER_PRIVATE_KEY chỉ đọc ở env.ts và server.signer.ts
  PASS  Không có app/.env trong cây làm việc
  PASS  Không có private key dạng hex 64 ký tự nhúng trong mã nguồn
  PASS  Không có so sánh role cứng ngoài lib/rbac
  PASS  actions/bank.ts có 7 server action (guard nằm ở tầng service, xem lớp 1)
  PASS  Bảng quyền không teo lại so với origin/dev (37 -> 37 hành động)
  PASS  Không có ABI nhúng trong app/src (chỉ dùng từ packages/shared)
  PASS  Không có contract ID Stellar hardcode trong app/src
  PASS  Contract chính không import từ trex/ (toolchain tách biệt)
  PASS  Không còn tham chiếu Polygon/Amoy/Mumbai (ngoài comment)
  PASS  Không còn ký hiệu cũ SPT / tVND
  PASS  Có .kiro/steering
  PASS  Có .kiro/specs
  PASS  Có docs
  PASS  spec p4-mint-testnet đủ 3 file
  PASS  spec p7-profit-distribution đủ 3 file
  PASS  spec p12-redemption đủ 3 file
  PASS  app/package-lock.json đã được commit (npm ci trong Docker chạy được)
  => PASS có cảnh báo: luật kiến trúc
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)
  => PASS: LỚP 3 - KHUÔN CHECKPOINT
  => PASS: APP - TYPECHECK
  => PASS: APP - LINT
 Test Files  57 passed | 9 skipped (66)
      Tests  1093 passed | 83 skipped (1176)
  => PASS: APP - VITEST
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 3 - ĐIỂM CẮM (marker)
    PASS  LỚP 3 - KHUÔN CHECKPOINT
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST
   6  app/src/lib/bank/distribution.service.ts:556           mở kỳ trên chuỗi bằng nhãn dùng một lần, lưu mã giao dịch trước khi chờ, tra kỳ trên chuỗi để hoàn tất hoặc phục hồi  ::driveOpening
  10  app/src/app/actions/distribution.ts:55                 nhận yêu cầu tiếp tục kỳ đã duyệt: phục hồi, đối soát vault, chia lô còn lại  ::continueDistributionAction
  11  app/src/lib/bank/distribution-approval.service.ts:467  kiểm quyền distribution:approve, phục hồi kỳ OPENING, kỳ phải APPROVED, chạy một lượt chia có ghi nguồn MANUAL  ::continueDistribution
exit=0
$ test -d packages/contracts-evm/artifacts && echo "artifacts đã phục hồi"
artifacts đã phục hồi
```

## 11. Ca 9: job C (build evm, gồm e2e hardhat)

```text
$ bash scripts/run-local-all.sh build evm
  => PASS: APP - BUILD BẢN PHÁT HÀNH
  => PASS: EVM - BUILD BẢN HARDHAT
  => PASS: EVM - DỰNG CHUỖI MỚI
  26 passed (34.2s)
  => PASS: EVM - E2E PROJECT HARDHAT
    PASS  APP - BUILD BẢN PHÁT HÀNH
    PASS  EVM - BUILD BẢN HARDHAT
    PASS  EVM - DỰNG CHUỖI MỚI
    PASS  EVM - E2E PROJECT HARDHAT
   6  app/src/lib/bank/distribution.service.ts:556           mở kỳ trên chuỗi bằng nhãn dùng một lần, lưu mã giao dịch trước khi chờ, tra kỳ trên chuỗi để hoàn tất hoặc phục hồi  ::driveOpening
  10  app/src/app/actions/distribution.ts:55                 nhận yêu cầu tiếp tục kỳ đã duyệt: phục hồi, đối soát vault, chia lô còn lại  ::continueDistributionAction
  11  app/src/lib/bank/distribution-approval.service.ts:467  kiểm quyền distribution:approve, phục hồi kỳ OPENING, kỳ phải APPROVED, chạy một lượt chia có ghi nguồn MANUAL  ::continueDistribution
exit=0
```

## 12. Ca 9: quét bí mật

```text
$ git log -p origin/dev..HEAD | grep -nE "postgres(ql)?://[^@ ]+:[^@ ]+@[^l1d ]|PRIVATE_KEY=0x[0-9a-fA-F]{64}" | grep -v ac0974... || echo "không có bí mật"
không có bí mật
$ git status --short
```
