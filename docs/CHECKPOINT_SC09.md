# Báo cáo bàn giao — SC-09: ERC-3643 PoC và ERC-2612 permit

| | |
|---|---|
| Mã task | SC-09 |
| Nhánh | `feat/sc-09-erc3643-permit`, từ `dev` @ `945c833` (PR #51) |
| Spec | `docs/sc-09-erc3643-permit/{requirements,tasks}.md` |
| Mức kiểm chứng | Cao |
| Tiến độ | Hoàn tất mã và kiểm chứng local; giữ `inProgress` tới khi Owner triển khai lại Sepolia sau merge |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md`) | | Bằng chứng |
|---|---|---|---|
| 1 | `ProjectToken` theo QĐ-2/QĐ-3, khớp selector và topic T-REX 4.1.6 | ✅ | mục 1.1 · 4.1 |
| 2 | Registry, compliance và module theo QĐ-4/QĐ-5 | ✅ | mục 1.2 · 4.1 |
| 3 | Đóng băng, tạm dừng và cưỡng chế đúng | ✅ | mục 1.3 · 4.1 |
| 4 | Luật SC-02, snapshot và chia lợi nhuận không đổi | ✅ | mục 1.4 · 4.1 |
| 5 | Permit VNDB/WPT và tiện ích dựng dữ liệu ký | ✅ | mục 1.5 · 4.1 |
| 6 | Năm đột biến đều làm đỏ đúng ca | ✅ | mục 2 |
| 7 | Adapter chạy trên Hardhat thật; địa chỉ cũ báo rõ | ✅ | mục 3.2 · 4.2 |
| 8 | Không còn lời gọi API cũ trong phạm vi yêu cầu | ✅ | mục 3.3 |
| 9 | Bộ mặc định, E2E Hardhat xanh; quét bí mật sạch | ✅ | mục 4 · 7 |
| 10 | Tài liệu và runbook Sepolia đã cập nhật | ✅ | mục 5 |
| 11 | Owner triển khai lại Sepolia và thử Mint lập–duyệt | 🔶 | mục 6 |

**Kết luận:** 10 ✅ · 1 🔶 · 0 ❌. Phần 🔶 là Bước 8 dành riêng cho Owner sau merge; task tiếp tục
ở `inProgress`, chưa tự triển khai testnet và chưa đổi địa chỉ `evm`.

### 0.2 Việc cần Owner làm sau merge

1. Chạy `docs/TESTNET_SEPOLIA.md`: preflight, cấp phí, deploy bảy hợp đồng, verify liên kết.
2. Commit bộ địa chỉ `evm` mới, xóa biến môi trường địa chỉ cũ, build lại app.
3. Xác nhận `/api/token?chain=evm`, chạy một lượt Mint lập–duyệt và ghi tx hash vào mục 6.

---

## 1. Kết quả hiện thực

### 1.1 Bề mặt token ERC-3643 PoC

- Thêm giao diện cục bộ `IERC3643Token`, `IERC3643Compliance`, `IERC3643Module`, lấy chữ ký từ
  T-REX v4.1.6 nhưng biên dịch trong project chính Solidity 0.8.28/OpenZeppelin 5.6.1.
- `ProjectToken` có đúng nhóm hàm/sự kiện đã chốt: pause, đóng băng toàn phần/một phần, liên kết
  registry/compliance, mint/burn agent, forced/batch transfer, onchainID và version.
- Không giữ bí danh cũ; chưa làm ONCHAINID/claim, recovery, batch mint/burn, đổi name/symbol đúng
  phần “Không làm”.

### 1.2 Danh tính và tuân thủ

- `IdentityRegistry` lưu trạng thái xác minh và mã quốc gia; đăng ký lặp lại cập nhật quốc gia.
- `ModularCompliance` chỉ cho token đã bind gọi action; mọi module phải đồng ý khi `canTransfer`.
- `AllowAllModule` là module mặc định. `RejectAllModule` chỉ nằm trong cây test để chứng minh luật
  có khả năng chặn.

### 1.3 Thứ tự luật chuyển token

Adapter và contract giữ thứ tự ổn định: pause → đóng băng hai đầu → danh tính hai đầu → phần số dư
chưa đóng băng → compliance. Cưỡng chế bỏ qua các chặn cần bỏ qua nhưng bên nhận vẫn phải xác minh;
phần đóng băng được giảm và phát sự kiện khi forced transfer cần dùng tới.

### 1.4 Giữ hành vi cũ

- Giữ `mintInitialSupply`, bất biến ví SPV, snapshot và chia lợi nhuận.
- `Redemption` chỉ đổi phép hỏi KYC sang registry; API pause riêng của Redemption không đổi.
- Bốn địa chỉ Hardhat cũ giữ nguyên; ba địa chỉ mới nối sau:

| Contract | Trước SC-09 | Sau SC-09 |
|---|---|---|
| ProjectToken | `0x5FbDB2315678afecb367f032d93F642f64180aa3` | không đổi |
| VNDToken | `0xe7f1725E7734CE288f8367e1Bb143E90bb3F0512` | không đổi |
| ProfitDistributor | `0x9fE46736679d2D9a65F0992F2272de9f3c7fa6e0` | không đổi |
| Redemption | `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9` | không đổi |
| IdentityRegistry | — | `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9` |
| ModularCompliance | — | `0x5FC8d32690cc91D4c39d9d3abcBD16989F875707` |
| AllowAllModule | — | `0x0165878A594ca255338adfa4d48449f69242Eb8F` |

### 1.5 ERC-2612

- WPT và VNDB dùng `ERC20Permit`; helper dùng chung tạo domain/types/message EIP-712.
- Permit WPT chỉ cấp allowance; chuyển sau đó vẫn đi qua identity và compliance.
- Bộ chính giữ OpenZeppelin 5.6.1 và target Cancun theo quyết định Owner ngày 16/10/2026. Besu
  được để ngỏ; không coi cấu hình mạng còn lại là bằng chứng tương thích.

## 2. Năm phép đột biến

Mỗi đột biến được áp dụng riêng, chạy đúng ca chỉ định rồi hoàn nguyên. Dưới đây là đầu ra nguyên
văn phần kết quả; cả năm lệnh trả mã thoát `1` như mong đợi.

### 2.1 Bỏ kiểm `isVerified`

```text
Compiled 4 Solidity files successfully (evm target: cancun).

  SC-09 - ERC-3643 core
    ProjectToken
      1) chỉ ví đã xác minh được nhận/chuyển; xoá danh tính chặn ngay

  0 passing (317ms)
  1 failing

  1) SC-09 - ERC-3643 core
       ProjectToken
         chỉ ví đã xác minh được nhận/chuyển; xoá danh tính chặn ngay:
     AssertionError: Expected transaction to be reverted with custom error 'IdentityNotVerified', but it didn't revert
      at Context.<anonymous> (test/sc-09-erc3643.test.js:177:7)
```

### 2.2 Bỏ gọi `compliance.canTransfer`

```text
Compiled 4 Solidity files successfully (evm target: cancun).

  SC-09 - ERC-3643 core
    ProjectToken
      1) bộ luật RejectAll chặn đúng lỗi và gỡ module thì chuyển lại được

  0 passing (278ms)
  1 failing

  1) SC-09 - ERC-3643 core
       ProjectToken
         bộ luật RejectAll chặn đúng lỗi và gỡ module thì chuyển lại được:
     AssertionError: Expected transaction to be reverted with custom error 'ComplianceRejected', but it didn't revert
      at Context.<anonymous> (test/sc-09-erc3643.test.js:195:7)
```

### 2.3 Bỏ kiểm phần chưa đóng băng

```text
Compiled 4 Solidity files successfully (evm target: cancun).

  SC-09 - ERC-3643 core
    ProjectToken
      1) đóng băng toàn phần và một phần; cưỡng chế tự mở đúng phần cần dùng

  0 passing (295ms)
  1 failing

  1) SC-09 - ERC-3643 core
       ProjectToken
         đóng băng toàn phần và một phần; cưỡng chế tự mở đúng phần cần dùng:
     AssertionError: Expected transaction to be reverted with custom error 'InsufficientUnfrozenTokens', but it didn't revert
      at Context.<anonymous> (test/sc-09-erc3643.test.js:218:7)
```

### 2.4 Cho mọi địa chỉ gọi action compliance

```text
Compiled 5 Solidity files successfully (evm target: cancun).

  SC-09 - ERC-3643 core
    ModularCompliance
      1) chỉ token đã gắn gọi được ba action

  0 passing (275ms)
  1 failing

  1) SC-09 - ERC-3643 core
       ModularCompliance
         chỉ token đã gắn gọi được ba action:
     AssertionError: Expected transaction to be reverted with custom error 'OnlyBoundToken', but it didn't revert
      at Context.<anonymous> (test/sc-09-erc3643.test.js:120:9)
```

### 2.5 Đổi domain permit WPT

```text
Compiled 5 Solidity files successfully (evm target: cancun).

  SC-09 - ERC-3643 core
    ERC-2612 permit
      1) WPT: permit độc lập KYC nhưng transferFrom vẫn qua identity và compliance

  0 passing (289ms)
  1 failing

  1) SC-09 - ERC-3643 core
       ERC-2612 permit
         WPT: permit độc lập KYC nhưng transferFrom vẫn qua identity và compliance:
     Error: VM Exception while processing transaction: reverted with custom error 'ERC2612InvalidSigner("0x934E0cf75517994CBe98000879Df059cB76Cba51", "0x70997970C51812dc3A010C7d01b50e0d17dc79C8")'
```

Sau hoàn nguyên, bộ contract đầy đủ ở mục 4.1 đạt 96 ca; không giữ mã đột biến.

## 3. Triển khai cục bộ và adapter

### 3.1 Deploy và verify

`deploy.js` giữ thứ tự bốn hợp đồng cũ rồi triển khai registry, compliance và module. Script nối
bốn quan hệ và cấp vai. `verify-deployment.js` đã chạy trên node local với mã thoát `0`, xác nhận:

```text
ProjectToken có bytecode tại 0x5FbDB2315678afecb367f032d93F642f64180aa3
VNDToken có bytecode tại 0xe7f1725E7734CE288f8367e1Bb143E90bb3F0512
ProfitDistributor có bytecode tại 0x9fE46736679d2D9a65F0992F2272de9f3c7fa6e0
Redemption có bytecode tại 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
IdentityRegistry có bytecode tại 0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
ModularCompliance có bytecode tại 0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
AllowAllModule có bytecode tại 0x0165878A594ca255338adfa4d48449f69242Eb8F
BẢN DEPLOY SC-09 HỢP LỆ — ERC-3643/permit đã nối; đủ điều kiện cho P4, và P7/P12 dùng lại.
```

### 3.2 Adapter trên node Hardhat thật

Node được giữ bằng `npx hardhat node`, sau đó chạy `deploy.js`, `seed-local.js` và lệnh kiểm adapter.
Đầu ra nguyên văn, mã thoát `0`:

```bash
TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/evm-issuance.test.ts
```

```text
 RUN  v3.2.4 /Users/anbinh/workSpace/bidv-rwa-tokenize/app

 ✓ test/evm-issuance.test.ts (13 tests | 1 skipped) 4614ms
   ✓ SC-02 — EVM issuance adapter trên Hardhat thật > dịch lỗi phát hành nguồn cung ban đầu lần hai và giữ lỗi gốc  1085ms
   ✓ SC-02 — EVM issuance adapter trên Hardhat thật > dịch lỗi phát hành bổ sung sai ví SPV và giữ lỗi gốc  1080ms
   ✓ SC-02 — EVM issuance adapter trên Hardhat thật > dịch lỗi hook tuân thủ khi ví SPV bị đóng băng  1097ms
   ✓ SC-02 — EVM issuance adapter trên Hardhat thật > dịch lỗi ví vận hành thiếu MINTER_ROLE  1078ms

 Test Files  1 passed (1)
      Tests  12 passed | 1 skipped (13)
   Start at  07:08:25
   Duration  5.13s (transform 170ms, setup 0ms, collect 336ms, tests 4.61s, environment 0ms, prepare 33ms)
```

Ca bỏ qua là nhận biết bytecode SC-02 cũ vì lượt này không dựng node cũ. Ca cấu hình thiếu địa chỉ
SC-09 vẫn chạy và đạt; các ca thật gồm whitelist/idempotent, freeze, thứ tự `canTransfer`, module
từ chối và luồng Mint/Burn maker–checker.

### 3.3 Tìm API cũ

Lệnh yêu cầu trong spec đã chạy, mã thoát `0`; đầu ra nguyên văn:

```bash
grep -rn "setWhitelisted\|batchSetWhitelisted\|setFrozen\|setPaused\|agentBurn\|\"isWhitelisted\"" \
  packages/contracts-evm/scripts packages/contracts-evm/test app/src app/scripts || echo "không còn hàm cũ"
```

```text
packages/contracts-evm/test/spec-p12-redemption.test.js:102:      await redemption.connect(admin).setPaused(true);
packages/contracts-evm/test/full-cycle.test.js:186:    await redemption.setPaused(true);
```

Hai kết quả là `Redemption.setPaused`, không phải API cũ của `ProjectToken`; Redemption nằm ngoài
bảng đổi tên QĐ-2 và spec yêu cầu giữ nguyên ngoài đúng phép hỏi KYC. Không còn lời gọi API cũ trên
ProjectToken trong script, test hay adapter.

## 4. Kết quả kiểm chứng cuối

### 4.1 Số ca trước và sau, bộ mặc định

| Bộ | Trước SC-09 (`945c833`) | Sau SC-09 |
|---|---:|---:|
| Contract Hardhat | 84 đạt | 96 đạt |
| App Vitest | 835 đạt · 17 bỏ qua | 840 đạt · 19 bỏ qua |
| Marker | 18 điểm cắm · 10 điểm chặn · 35 bước | không đổi |

`bash scripts/run-local-all.sh` được chạy lại sau khi sinh đúng khối marker. Đầu ra tổng kết nguyên
văn, mã thoát `0`:

```text
########## TỔNG KẾT ##########
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
```

Ba cảnh báo kiến trúc không do SC-09 tạo: hai lượt đọc `process.env` đã biết, ba địa chỉ UI minh
hoạ/zero signer và `BASE_REF` không đặt trong bộ mặc định. Các phép kiểm đều PASS.

### 4.2 E2E Hardhat

Lượt trong sandbox không tải được `fonts.googleapis.com`; chạy lại cùng runner với quyền mạng để
kiểm đúng bản production build. Đầu ra kết quả nguyên văn, mã thoát `0`:

```text
Running 18 tests using 1 worker

  ✓   1 [hardhat] › e2e/chain-scope.spec.ts:23:5 › FE-27 — Lập lệnh, Duyệt, Giao dịch và Tổng quan người bán đổi theo chain (604ms)
  -   2 [hardhat] › e2e/mint.spec.ts:51:7 › Phát hành token điện gió › KYC + whitelist rồi mint 100 WPT thì số dư thành 100
  -   3 [hardhat] › e2e/mint.spec.ts:84:7 › Phát hành token điện gió › mint cho ví chưa whitelist bị từ chối kèm lý do rõ ràng
  ✓   4 [hardhat] › e2e/mint.spec.ts:96:7 › Phát hành token điện gió › hardhat: đường /mint bị từ chối trước khi gửi giao dịch (350ms)
  ✓   7 [hardhat] › e2e/mint.spec.ts:236:7 › SC-02 — lập duyệt Mint/Burn trên hardhat › Mint lần đầu vào NB001 qua Giao dịch viên và Kiểm soát viên (2.2s)
  ✓   8 [hardhat] › e2e/mint.spec.ts:247:7 › SC-02 — lập duyệt Mint/Burn trên hardhat › Mint lần hai cùng NB001; vượt trần bị chặn trước khi gửi (3.9s)
  ✓   9 [hardhat] › e2e/mint.spec.ts:273:7 › SC-02 — lập duyệt Mint/Burn trên hardhat › Burn phần chưa phân phối qua cùng luồng lập duyệt (2.2s)

  2 skipped
  16 passed (13.2s)
  => PASS: EVM - E2E PROJECT HARDHAT
```

Hai ca bỏ qua được đánh dấu chỉ dành cho mock; Hardhat dùng đường lập–duyệt chính thức ở ba ca
SC-02/SC-09. Runner đã tự dừng node sau khi hoàn tất.

### 4.3 Quét bí mật

Lệnh trong spec đã chạy, mã thoát `0`; đầu ra nguyên văn:

```bash
git log -p origin/dev..HEAD | grep -nE "postgres(ql)?://[^@ ]+:[^@ ]+@[^l1d ]|PRIVATE_KEY=0x[0-9a-fA-F]{64}" || echo "không có bí mật"
```

```text
không có bí mật
```

## 5. Tài liệu và trạng thái

- `docs/DEPLOYMENT.md`, `docs/TESTNET_SEPOLIA.md`, README contract/shared và tài liệu EVM được cập
  nhật cho bảy hợp đồng, registry whitelist, verify liên kết và việc reset local.
- `docs/tech-report.md` lên 4.14 và khối marker được sinh lại bằng công cụ chính thức.
- `.env.example` có ba biến địa chỉ mới; adapter không fallback về API cũ nếu thiếu.
- `SC-09` giữ ở `inProgress` vì điều kiện 11 chưa thể hoàn tất trước merge. Không có marker
  `@pending SC-09` hay `@blocked SC-09`.
- Hai tệp HTML đang untracked là tài liệu của Owner có trước lượt bàn giao; không được sửa hay đưa
  vào commit SC-09.

## 6. Bước sau merge dành cho Owner

| Kiểm | Trạng thái | Bằng chứng cần bổ sung |
|---|---|---|
| Preflight/cấp phí | 🔶 | đầu ra `SẴN SÀNG`, tx cấp phí nếu có |
| Deploy bảy hợp đồng | 🔶 | bảy địa chỉ và commit cập nhật `addresses.json` |
| Verify SC-09 | 🔶 | `BẢN DEPLOY SC-09 HỢP LỆ` |
| Smoke API | 🔶 | `/api/token?chain=evm` đọc được WPT |
| Mint lập–duyệt | 🔶 | tx hash, receipt thành công, block |

Khi đủ năm dòng, đổi điều kiện 11 ở mục 0 thành ✅ và chuyển `SC-09` từ `inProgress` sang `done`
trong cùng commit bằng chứng. Không tự đánh dấu done chỉ vì phần local đã hoàn tất.


## 7. Sửa Job A: đọc artifact lúc chạy — 16/10/2026

Supervisor xác nhận CI không biên dịch hợp đồng ở Job A. Import JSON cố định làm Vitest lỗi ngay
khi nạp tệp, trước khi bỏ qua các ca cần Hardhat. Đã bỏ import đó; `loadRejectAllArtifact` dùng
`node:fs/promises.readFile` và đường dẫn theo `import.meta.url`, chỉ gọi trong `deployRejectAllModule`.
Không sửa CI để thêm bước compile, không đổi ca kiểm, ABI, adapter hoặc logic hợp đồng.

### 7.1 Mô phỏng Job A không có artifacts

Chạy từ gốc repo. Dùng đúng ba bước Supervisor yêu cầu, thêm kiểm tra đích backup và trap để bảo
đảm khôi phục nếu bộ kiểm lỗi. Không compile hợp đồng trong lúc artifacts vắng mặt.
Mã thoát toàn bộ: 0; thư mục artifacts đã trở lại, `/tmp/artifacts_bak` không còn.

```bash
set -e
[ -d packages/contracts-evm/artifacts ]
[ ! -e /tmp/artifacts_bak ]
trap 'if [ -d /tmp/artifacts_bak ]; then mv /tmp/artifacts_bak packages/contracts-evm/artifacts; fi' EXIT
mv packages/contracts-evm/artifacts /tmp/artifacts_bak
bash scripts/run-local-all.sh arch markers checkpoint app > /tmp/sc09-ci-job-a.log 2>&1
mv /tmp/artifacts_bak packages/contracts-evm/artifacts
trap - EXIT
```

Đầu ra nguyên văn của bộ kiểm, giữ toàn bộ, gồm cả mã màu terminal:

```text

[1m########## LỚP 3 - 3 LUẬT KIẾN TRÚC + CẤU TRÚC REPO ##########[0m

[1mLUẬT 1 - Mọi tương tác chain đi qua ILedgerPort[0m
[32m  PASS  viem/ethers không xuất hiện ngoài app/src/lib[0m
[32m  PASS  Không có lời gọi contract trực tiếp trong components/ và app/[0m

[1mLUẬT 2 - Mọi thao tác ký đi qua ISigner[0m
[32m  PASS  SERVER_SIGNER_PRIVATE_KEY chỉ đọc ở env.ts và server.signer.ts[0m
[33m  WARN  process.env đọc ngoài lib/config (kiểm tra xem có phải biến công khai):[0m
        app/src/lib/ledger/postgres-mock-state.store.ts:85:      if (process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') {
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
        app/src/components/pages/mint.tsx:199:                placeholder="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
        app/src/components/pages/mint.tsx:205:                <span className="font-mono">0x70997970C51812dc3A010C7d01b50e0d17dc79C8</span>
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
ĐẠT     OP-06 · docs/CHECKPOINT_OP06.md
  mục 0: 24/60 dòng · bảng đối chiếu 10 dòng / 10 điều kiện · 9 ✅ 1 🔶 0 ❌ · cả tệp 296/800 dòng
ĐẠT     SC-09 · docs/CHECKPOINT_SC09.md
  mục 0: 26/60 dòng · bảng đối chiếu 11 dòng / 11 điều kiện · 10 ✅ 1 🔶 0 ❌ · cả tệp 340/800 dòng
[32m  => PASS: LỚP 3 - KHUÔN CHECKPOINT[0m

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

 ✓ test/token-info-read.test.ts (8 tests) 28ms
 ✓ test/init-sql-generated.test.ts (1 test) 49ms
 ✓ test/rbac.test.ts (60 tests) 33ms
 ✓ test/wallet-status.test.ts (30 tests) 28ms
 ✓ test/pending-markers.test.ts (24 tests) 40ms
 ✓ test/account-info.test.ts (8 tests) 102ms
 ✓ test/postgres-init-isolation.test.ts (5 tests) 547ms
 ✓ test/mock-ledger.test.ts (61 tests) 41ms
 ✓ test/postgres-request-client.test.ts (6 tests) 603ms
 ✓ test/env-private-key.test.ts (9 tests) 33ms
 ✓ test/abi-contract-sync.test.ts (12 tests) 9ms
 ✓ test/check-checkpoint.test.ts (21 tests) 26ms
 ✓ test/store-constraints.test.ts (119 tests) 83ms
 ✓ test/four-roles-routes.test.ts (22 tests) 18ms
 ✓ test/purchase-state.test.ts (19 tests) 13ms
 ✓ test/issue-price-single-source.test.ts (16 tests) 30ms
 ✓ test/config-service.test.ts (31 tests) 270ms
 ✓ test/demo-payment.test.ts (19 tests) 292ms
 ✓ test/seller-channel.test.ts (10 tests) 299ms
 ✓ test/issuance-service.test.ts (27 tests) 304ms
 ✓ test/ops-transactions.test.ts (7 tests) 309ms
 ✓ test/distribution-trigger.test.ts (45 tests) 115ms
 ✓ test/investor-trading.test.ts (20 tests) 297ms
 ✓ test/token-request.test.ts (22 tests) 376ms
 ✓ test/purchase-service.test.ts (81 tests) 140ms
 ✓ test/maker-checker-ui.test.ts (34 tests) 366ms
 ✓ test/distribution-service.test.ts (43 tests) 248ms
 ✓ test/build-info.test.ts (6 tests) 5ms
 ✓ test/receipt-timeout.test.ts (5 tests) 5ms
 ✓ test/evm-address-env.test.ts (5 tests) 9ms
 ✓ test/sepolia-project-seed.test.ts (3 tests) 12ms
 ✓ test/mock-ledger-factory.test.ts (3 tests) 17ms
 ✓ test/account-profile.test.ts (9 tests) 9ms
 ✓ test/op07-chain-scope.test.ts (2 tests | 1 skipped) 3ms
 ↓ test/postgres-seed.test.ts (1 test | 1 skipped)
 ✓ test/token-info-route.test.ts (6 tests) 17ms
 ✓ test/mock-ledger-state-store.test.ts (11 tests | 5 skipped) 10ms
 ✓ test/portfolio-service.test.ts (12 tests) 13ms
 ✓ test/server-signer.test.ts (4 tests) 9ms
 ✓ test/four-roles-shell.test.ts (19 tests) 9ms
 ✓ test/evm-issuance.test.ts (13 tests | 12 skipped) 5ms

 Test Files  40 passed | 1 skipped (41)
      Tests  840 passed | 19 skipped (859)
   Start at  09:08:29
   Duration  2.38s (transform 4.01s, setup 0ms, collect 20.19s, tests 4.83s, environment 8ms, prepare 5.33s)

[32m  => PASS: APP - VITEST[0m

[1m########## TỔNG KẾT ##########[0m
  Phần đã chạy: arch markers checkpoint app
  Đạt:     6
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 3 - ĐIỂM CẮM (marker)
    PASS  LỚP 3 - KHUÔN CHECKPOINT
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
  [cắm]   app/src/app/actions/config.ts:19  đã sẵn đầu cuối ở `setIssuePrice`: validate Zod, guard HAI LỚP (`treasury:manage` rồi cờ `isConfig` của vai), kiểm ngưỡng đổi giá, ĐẨY GIÁ XUỐNG LEDGER TRƯỚC rồi mới ghi cơ sở dữ liệu + lịch sử, ghi bảng thất bại thì tự hoàn nguyên giá cũ trên ledger, ghi sổ kiểm toán cả bốn kết cục. Màn cấu hình chỉ cần gọi và hiển thị `Result`. FE-07 PHẢI hiện hộp xác nhận khi `Result` trả mã `VALIDATION` kèm thông báo lệch ngưỡng, rồi gọi lại với `confirmLargeChange: true` — service CỐ Ý không coi lần gọi thứ hai là xác nhận, vì lần gọi lại không chứng tỏ người dùng đã đọc cảnh báo
  [cắm]   app/src/app/actions/config.ts:26  đã sẵn đầu cuối ở `getIssuePrice`: trả giá đang có hiệu lực kèm vai đã đặt, thời điểm đặt, và cờ `configured` phân biệt "ngân hàng đã cấu hình" với "đang dùng mặc định trong mã". Màn cấu hình dùng đúng ba trường đó để hiện trạng thái hiện tại trước khi cho sửa; KHÔNG kiểm quyền vì giá phát hành là con số hiển thị công khai cho nhà đầu tư

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
  [chặn]  app/src/lib/ledger/evm.adapter.ts:547  thiếu hợp đồng khớp lệnh: giá bán một WPT nằm trong hợp đồng đó, chưa contract nào giữ
  [chặn]  app/src/lib/ledger/evm.adapter.ts:559  thiếu hợp đồng khớp lệnh: chưa contract nào giữ giá bán một WPT nên không có hàm ghi nào để gọi
  [chặn]  app/src/lib/ledger/evm.adapter.ts:578  thiếu địa chỉ hợp đồng khớp lệnh để làm `spender`; `VNDToken.allowance` thì đã có trong ABI
  [chặn]  app/src/lib/ledger/evm.adapter.ts:617  thiếu hợp đồng khớp lệnh: chưa có nơi đổi VNDB lấy WPT trong cùng một giao dịch
  [chặn]  app/src/lib/ledger/evm.adapter.ts:623  thiếu hợp đồng khớp lệnh: chưa có nơi đổi WPT lấy VNDB trong cùng một giao dịch (chiều bán, BE-14)

SC-04  (4 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:759  thiếu quyết định cờ "đang tất toán" nằm ở contract nào; hai ứng viên hiện có thì ngược hướng nhau
  [chặn]  app/src/lib/ledger/evm.adapter.ts:765  thiếu quyết định cờ "đang tất toán" nằm ở contract nào, nên chưa có cờ nào để đọc
  [chặn]  app/src/lib/ledger/evm.adapter.ts:770  thiếu quyết định giá NAV có phải `Redemption.rate` hay không
  [chặn]  app/src/lib/ledger/evm.adapter.ts:776  thiếu quyết định giá NAV có phải `Redemption.rate` hay không

SC-05  (1 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:741  thiếu quyết định chữ ký: `distributeBatch(snapshotId, wallets)` không mang mã kỳ nên adapter không tra được `distributionId`; hợp đồng `ProfitDistributor` thì đã có và đã deploy. Hai đường xử lý ghi ngay trên marker này

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
   2  app/src/lib/bank/issuance.service.ts:355  validate, kiểm hai lớp chặn dữ liệu thử (quyền demo:mint-token và cờ ENABLE_DEMO_TOKEN_MINT), đọc trần phát hành từ bảng dự án  ::issueInitialSupply
   3  app/src/lib/bank/issuance.service.ts:257  gửi giao dịch phát hành vào ví SPV: lần đầu qua mintInitialSupply, các lần sau qua mint  ::pending
   4  app/src/lib/bank/issuance.service.ts:78   lưu giao dịch ở trạng thái chờ, TRƯỚC khi đợi biên nhận  ::saved
   5  app/src/lib/bank/issuance.service.ts:93   đợi biên nhận theo timeout của chuỗi, rồi cập nhật trạng thái giao dịch  ::receipt
   6  app/src/lib/bank/issuance.service.ts:288  lần đầu: ghi mốc phát hành vào bảng dự án bằng khoá lạc quan  ::marked
   7  app/src/lib/bank/issuance.service.ts:317  đọc lại tổng cung từ chuỗi làm sự thật cuối cùng  ::after
   8  app/src/app/actions/bank.ts:48            nhận yêu cầu xem trạng thái phát hành, chuyển tiếp sang service  ::issuanceStatusAction
   9  app/src/lib/bank/issuance.service.ts:416  đọc trạng thái phát hành: con số dự kiến trong bảng dự án đứng cạnh tổng cung thật trên chuỗi  ::getIssuanceStatus

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

[32m  => ĐẠT các phần đã chạy: arch markers checkpoint app[0m
```


### 7.2 Hardhat thật sau sửa

Dùng nút riêng cổng 8945, không reset nút mặc định/không gọi Sepolia. Giữ nút và test trong cùng
phiên; trap dừng nút sau khi xong. Proxy môi trường bỏ qua loopback. Mã thoát toàn bộ: 0.

```bash
set -e
export NO_PROXY=127.0.0.1,localhost
export no_proxy=127.0.0.1,localhost
export EVM_LOCAL_PORT=8945
export EVM_LOCAL_DIR=/tmp/sc09-ci-node-20261016
trap 'bash scripts/evm-local.sh down > /tmp/sc09-ci-hardhat-down.log 2>&1' EXIT
bash scripts/evm-local.sh up > /tmp/sc09-ci-hardhat-up.log 2>&1
(cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8945 npx vitest run test/evm-issuance.test.ts) > /tmp/sc09-ci-hardhat-test.log 2>&1
```

Đầu ra dựng nút/deploy (mã thoát 0). Khóa trong khối này là tài khoản Hardhat công khai do script
local in ra, không phải khóa testnet:

```text
[evm-local] dựng nút hardhat ở http://127.0.0.1:8945 (nhật ký: /tmp/sc09-ci-node-20261016/node.log)
[evm-local] nút sẵn sàng sau 1s
◇ injected env (7) from .env // tip: ⌘ custom filepath { path: '/custom/path/.env' }
◇ injected env (0) from .env // tip: ◈ encrypted .env [www.dotenvx.com]
Nút mới, chưa có hợp đồng.
[evm-local] triển khai bộ hợp đồng
◇ injected env (7) from .env // tip: ⌘ multiple files { path: ['.env.local', '.env'] }
◇ injected env (0) from .env // tip: ⌘ override existing { override: true }
Mạng: localhost (chainId=31337) -> chainKey="hardhat-local"
Người triển khai (ngân hàng): 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

=== ĐỊA CHỈ HỢP ĐỒNG ===
ProjectToken         0x5FbDB2315678afecb367f032d93F642f64180aa3
VNDToken             0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
ProfitDistributor    0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
Redemption           0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
IdentityRegistry     0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
ModularCompliance    0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
AllowAllModule       0x0165878A594ca255338adfa4d48449f69242Eb8F

Địa chỉ không đổi, giữ nguyên ../shared/src/addresses.json
Đã ghi ABI đối chiếu: ../shared/generated/
◇ injected env (7) from .env // tip: ⌘ override existing { override: true }
◇ injected env (0) from .env // tip: ⌘ enable debugging { debug: true }
NDT001 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 vừa xác minh
NB001 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 vừa xác minh

Biến cho app chạy trên chuỗi này (đặt trong app/.env.local hoặc trước lệnh chạy):
  NEXT_PUBLIC_DEFAULT_CHAIN=hardhat-local
  RPC_HARDHAT=http://127.0.0.1:8945
  SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

Đầu ra Vitest (mã thoát 0):

```text

 RUN  v3.2.4 /home/tuanlh/.codex/worktrees/03a6/bidv-rwa-tokenize/app

 ✓ test/evm-issuance.test.ts (13 tests | 1 skipped) 4867ms
   ✓ SC-02 — EVM issuance adapter trên Hardhat thật > dịch lỗi phát hành nguồn cung ban đầu lần hai và giữ lỗi gốc  1091ms
   ✓ SC-02 — EVM issuance adapter trên Hardhat thật > dịch lỗi phát hành bổ sung sai ví SPV và giữ lỗi gốc  1083ms
   ✓ SC-02 — EVM issuance adapter trên Hardhat thật > dịch lỗi hook tuân thủ khi ví SPV bị đóng băng  1128ms
   ✓ SC-02 — EVM issuance adapter trên Hardhat thật > dịch lỗi ví vận hành thiếu MINTER_ROLE  1081ms

 Test Files  1 passed (1)
      Tests  12 passed | 1 skipped (13)
   Start at  09:10:49
   Duration  5.78s (transform 325ms, setup 0ms, collect 688ms, tests 4.87s, environment 0ms, prepare 118ms)
```

Đầu ra dọn nút (mã thoát 0):

```text
[evm-local] đã dừng nút (pid 17242)
```
