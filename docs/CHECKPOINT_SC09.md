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
| 9 | Bộ mặc định, E2E Hardhat xanh; quét bí mật sạch | ✅ | mục 4 |
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
