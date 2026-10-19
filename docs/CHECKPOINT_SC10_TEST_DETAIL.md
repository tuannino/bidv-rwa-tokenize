# SC-10 — bằng chứng kiểm trước/sau sửa

Tệp chi tiết cho CHECKPOINT_SC10 mục 3.1. Đầu ra nguyên văn, gồm mã màu terminal.

## 1. Số đo và baseline

Các lệnh đo từ gốc repo, trước sửa:

```bash
sed -n 156,170p packages/contracts-evm/contracts/ProfitDistributor.sol > /tmp/sc10-measure.log
sed -n 175,190p packages/contracts-evm/contracts/ProfitDistributor.sol >> /tmp/sc10-measure.log
grep -n '_forcedMove' packages/contracts-evm/contracts/tokens/ProjectToken.sol >> /tmp/sc10-measure.log
grep -n 'createDistribution' packages/contracts-evm/contracts/ProfitDistributorOracle.sol >> /tmp/sc10-measure.log
```

```text
    function _claim(uint256 id, address account) internal returns (uint256 amount) {
        require(id < distributions.length, "ky khong ton tai");
        if (hasClaimed[id][account]) return 0;

        amount = entitlementOf(id, account);
        hasClaimed[id][account] = true; // đánh dấu kể cả khi phần = 0 để tránh lặp vô ích

        if (amount > 0) {
            Distribution storage d = distributions[id];
            d.claimed += amount;
            payoutToken.safeTransfer(account, amount);
            emit Claimed(id, account, amount);
        }
    }

    function sweepDust(uint256 id, address to)
        external
        onlyRole(DISTRIBUTOR_ROLE)
        nonReentrant
    {
        require(id < distributions.length, "ky khong ton tai");
        Distribution storage d = distributions[id];
        require(block.timestamp >= d.createdAt + claimWindow, "chua het han nhan");
        uint256 remaining = d.amount - d.claimed;
        require(remaining > 0, "khong con du");
        d.claimed = d.amount;
        payoutToken.safeTransfer(to, remaining);
        emit DustSwept(id, to, remaining);
    }
}
40:    bool private _forcedMove;
205:        _forcedMove = true;
207:        _forcedMove = false;
223:        _forcedMove = true;
225:        _forcedMove = false;
248:            _forcedMove = true;
250:            _forcedMove = false;
278:        if (_forcedMove) {
54:    function createDistributionFromOracle(uint256 periodId)
67:        // Gọi lại logic gốc (chốt snapshot + kéo VND từ msg.sender). Vì createDistribution
70:        id = createDistribution(amount, label);
```

Mã thoát: `0`.

Baseline đã chạy `bash scripts/run-local-all.sh > /tmp/sc10-baseline.log 2>&1` từ gốc, exit 0.
Bỏ tiến độ/danh sách ca, giữ nguyên đầu ra lọc:

```bash
rg 'passing|Test Files|Tests |Đạt:|Không đạt:' /tmp/sc10-baseline.log > /tmp/sc10-baseline-summary.log
```

```text
  96 passing (2s)
 Test Files  40 passed | 1 skipped (41)
      Tests  840 passed | 19 skipped (859)
  Đạt:     7
  Không đạt: 0
```

Mã thoát: `0`.

## 2. Đỏ trước sửa

Các lệnh Hardhat chạy từ packages/contracts-evm/.

```bash
npx hardhat test test/sc-10-va-hop-dong.test.js > /tmp/sc10-profit-red.log 2>&1
```

```text
◇ injected env (7) from .env // tip: ⌘ custom filepath { path: '/custom/path/.env' }


  SC-10 - ProfitDistributor
REPRO: A claimed/amount=200/100; B fund=0
    1) ca 1: claim kỳ A sau quét không lấy quỹ kỳ B
    2) ca 2: distributeTo kỳ đã đóng revert cả lô
    3) ca 3: đúng deadline và sau deadline chưa quét không nhận được
    4) ca 4: sweep chỉ sau hạn, đóng một lần, kỳ đã chi hết vẫn đóng được
    5) ca 5: đổi claimWindow không đổi hạn kỳ cũ
    ✔ ca 6: hai kỳ mở, tự nhận và chia lô không trả trùng hay vượt quỹ


  1 passing (417ms)
  5 failing

  1) SC-10 - ProfitDistributor
       ca 1: claim kỳ A sau quét không lấy quỹ kỳ B:
     Error: The given contract doesn't have a custom error named 'DistributionClosed'
      at validateInput (node_modules/@nomicfoundation/hardhat-chai-matchers/src/internal/reverted/revertedWithCustomError.ts:177:13)
      at Proxy.<anonymous> (node_modules/@nomicfoundation/hardhat-chai-matchers/src/internal/reverted/revertedWithCustomError.ts:42:46)
      at Proxy.methodWrapper (node_modules/chai/lib/chai/utils/addMethod.js:57:25)
      at doAsserterAsyncAndAddThen (node_modules/chai-as-promised/lib/chai-as-promised.js:289:22)
      at Proxy.<anonymous> (node_modules/chai-as-promised/lib/chai-as-promised.js:255:20)
      at Proxy.overwritingMethodWrapper (node_modules/chai/lib/chai/utils/overwriteMethod.js:78:33)
      at Context.<anonymous> (test/sc-10-va-hop-dong.test.js:34:31)

  2) SC-10 - ProfitDistributor
       ca 2: distributeTo kỳ đã đóng revert cả lô:
     Error: The given contract doesn't have a custom error named 'DistributionClosed'
      at validateInput (node_modules/@nomicfoundation/hardhat-chai-matchers/src/internal/reverted/revertedWithCustomError.ts:177:13)
      at Proxy.<anonymous> (node_modules/@nomicfoundation/hardhat-chai-matchers/src/internal/reverted/revertedWithCustomError.ts:42:46)
      at Proxy.methodWrapper (node_modules/chai/lib/chai/utils/addMethod.js:57:25)
      at doAsserterAsyncAndAddThen (node_modules/chai-as-promised/lib/chai-as-promised.js:289:22)
      at Proxy.<anonymous> (node_modules/chai-as-promised/lib/chai-as-promised.js:255:20)
      at Proxy.overwritingMethodWrapper (node_modules/chai/lib/chai/utils/overwriteMethod.js:78:33)
      at Context.<anonymous> (test/sc-10-va-hop-dong.test.js:48:14)

  3) SC-10 - ProfitDistributor
       ca 3: đúng deadline và sau deadline chưa quét không nhận được:
     Error: The given contract doesn't have a custom error named 'ClaimWindowEnded'
      at validateInput (node_modules/@nomicfoundation/hardhat-chai-matchers/src/internal/reverted/revertedWithCustomError.ts:177:13)
      at Proxy.<anonymous> (node_modules/@nomicfoundation/hardhat-chai-matchers/src/internal/reverted/revertedWithCustomError.ts:42:46)
      at Proxy.methodWrapper (node_modules/chai/lib/chai/utils/addMethod.js:57:25)
      at doAsserterAsyncAndAddThen (node_modules/chai-as-promised/lib/chai-as-promised.js:289:22)
      at Proxy.<anonymous> (node_modules/chai-as-promised/lib/chai-as-promised.js:255:20)
      at Proxy.overwritingMethodWrapper (node_modules/chai/lib/chai/utils/overwriteMethod.js:78:33)
      at Context.<anonymous> (test/sc-10-va-hop-dong.test.js:61:14)

  4) SC-10 - ProfitDistributor
       ca 4: sweep chỉ sau hạn, đóng một lần, kỳ đã chi hết vẫn đóng được:
     AssertionError: Event "DistributionClosed" doesn't exist in the contract
      at onSuccess (node_modules/@nomicfoundation/hardhat-chai-matchers/src/internal/emit.ts:80:17)
      at /home/tuanlh/.codex/worktrees/03a6/bidv-rwa-tokenize/packages/contracts-evm/node_modules/@nomicfoundation/hardhat-chai-matchers/src/internal/emit.ts:130:20
      at Context.<anonymous> (test/sc-10-va-hop-dong.test.js:73:5)

  5) SC-10 - ProfitDistributor
       ca 5: đổi claimWindow không đổi hạn kỳ cũ:
     HardhatError: HH17: The input value cannot be normalized to a BigInt: Unsupported type undefined
      at normalizeToBigInt (/home/tuanlh/.codex/worktrees/03a6/bidv-rwa-tokenize/packages/contracts-evm/node_modules/hardhat/src/common/bigInt.ts:47:13)
      at Proxy.<anonymous> (/home/tuanlh/.codex/worktrees/03a6/bidv-rwa-tokenize/packages/contracts-evm/node_modules/@nomicfoundation/hardhat-chai-matchers/src/internal/bigNumber.ts:171:41)
      at Proxy.overwritingMethodWrapper (/home/tuanlh/.codex/worktrees/03a6/bidv-rwa-tokenize/packages/contracts-evm/node_modules/chai/lib/chai/utils/overwriteMethod.js:78:33)
      at doAsserterAsyncAndAddThen (/home/tuanlh/.codex/worktrees/03a6/bidv-rwa-tokenize/packages/contracts-evm/node_modules/chai-as-promised/lib/chai-as-promised.js:289:22)
      at Proxy.<anonymous> (/home/tuanlh/.codex/worktrees/03a6/bidv-rwa-tokenize/packages/contracts-evm/node_modules/chai-as-promised/lib/chai-as-promised.js:255:20)
      at Proxy.overwritingMethodWrapper (/home/tuanlh/.codex/worktrees/03a6/bidv-rwa-tokenize/packages/contracts-evm/node_modules/chai/lib/chai/utils/overwriteMethod.js:78:33)
      at Context.<anonymous> (/home/tuanlh/.codex/worktrees/03a6/bidv-rwa-tokenize/packages/contracts-evm/test/sc-10-va-hop-dong.test.js:94:32)
```

Mã thoát: `5`.

Lượt này chỉ có ca 1–6 trước khi thêm callback/cap. Dòng REPRO chứng minh A chi 200/100, B còn 0; custom error chưa tồn tại trên bản cũ.

```bash
npx hardhat test test/sc-10-va-hop-dong.test.js --grep 'ca [789]:' > /tmp/sc10-callback-red.log 2>&1
```

```text
◇ injected env (7) from .env // tip: ◈ encrypted .env [www.dotenvx.com]
Compiled 1 Solidity file successfully (evm target: cancun).


  SC-10 - callbacks cưỡng chế
    1) ca 7: module đếm đúng sau mint, transfer, forcedTransfer, agent burn và batch
    2) ca 8: RejectAll chặn đường thường, cưỡng chế bỏ kiểm nhưng vẫn báo module
    3) ca 9: chưa gắn bộ luật thì cưỡng chế revert ComplianceNotSet


  0 passing (467ms)
  3 failing

  1) SC-10 - callbacks cưỡng chế
       ca 7: module đếm đúng sau mint, transfer, forcedTransfer, agent burn và batch:

      AssertionError: expected 2 to equal 3.
      + expected - actual

      -2
      +3
      
      at expectHolderCount (test/sc-10-va-hop-dong.test.js:132:44)
      at Context.<anonymous> (test/sc-10-va-hop-dong.test.js:141:77)

  2) SC-10 - callbacks cưỡng chế
       ca 8: RejectAll chặn đường thường, cưỡng chế bỏ kiểm nhưng vẫn báo module:

      AssertionError: expected 1 to equal 2.
      + expected - actual

      -1
      +2
      
      at expectHolderCount (test/sc-10-va-hop-dong.test.js:132:44)
      at Context.<anonymous> (test/sc-10-va-hop-dong.test.js:160:5)

  3) SC-10 - callbacks cưỡng chế
       ca 9: chưa gắn bộ luật thì cưỡng chế revert ComplianceNotSet:
     AssertionError: Expected transaction to be reverted with custom error 'ComplianceNotSet', but it didn't revert
      at Context.<anonymous> (test/sc-10-va-hop-dong.test.js:171:5)
```

Mã thoát: `3`.

Cap: constructor/getter đã thêm nhưng tạm bỏ guard để chứng minh hai ca vượt trần bắt đúng lỗi; nguồn được khôi phục bằng finally. Lệnh Hardhat thực thi, exit 2; log giữ cả dòng exit do script bọc ghi:

```bash
npx hardhat test test/sc-10-va-hop-dong.test.js --grep 'cap:'
```

```text
◇ injected env (7) from .env // tip: ⌘ multiple files { path: ['.env.local', '.env'] }
Compiled 4 Solidity files successfully (evm target: cancun).


  SC-10 - CH-1 cap cố định
    1) cap: lần đầu vượt trần bị chặn và không ghi mốc, đúng trần được phép
    2) cap: mint bổ sung không vượt trần, đốt rồi chỉ mint bù trong trần
    ✔ cap: không cho triển khai cap bằng 0


  1 passing (441ms)
  2 failing

  1) SC-10 - CH-1 cap cố định
       cap: lần đầu vượt trần bị chặn và không ghi mốc, đúng trần được phép:
     AssertionError: Expected transaction to be reverted with custom error 'SupplyCapExceeded', but it didn't revert
      at Context.<anonymous> (test/sc-10-va-hop-dong.test.js:185:5)

  2) SC-10 - CH-1 cap cố định
       cap: mint bổ sung không vượt trần, đốt rồi chỉ mint bù trong trần:
     AssertionError: Expected transaction to be reverted with custom error 'SupplyCapExceeded', but it didn't revert
      at Context.<anonymous> (test/sc-10-va-hop-dong.test.js:200:5)




Hardhat exit: 2
```

Mã thoát: `2`.

## 3. Xanh sau sửa và hoàn nguyên

Sau bước 1 đã chạy `npx hardhat test > /tmp/sc10-profit-green-all.log 2>&1`, exit 0. Trích nguyên văn số ca:

```bash
rg 'passing' /tmp/sc10-profit-green-all.log > /tmp/sc10-profit-green-summary.log
```

```text
  102 passing (2s)
```

Mã thoát: `0`.

Sau callback, rồi cap, không đổi assert bộ cũ; chỉ thêm cap constructor trong fixture/script:

```bash
npx hardhat test test/sc-10-va-hop-dong.test.js test/sc-09-erc3643.test.js > /tmp/sc10-callback-green.log 2>&1
```

```text
◇ injected env (7) from .env // tip: ⌘ suppress logs { quiet: true }
Compiled 4 Solidity files successfully (evm target: cancun).


  SC-10 - ProfitDistributor
    ✔ ca 1: claim kỳ A sau quét không lấy quỹ kỳ B (396ms)
    ✔ ca 2: distributeTo kỳ đã đóng revert cả lô
    ✔ ca 3: đúng deadline và sau deadline chưa quét không nhận được
    ✔ ca 4: sweep chỉ sau hạn, đóng một lần, kỳ đã chi hết vẫn đóng được
    ✔ ca 5: đổi claimWindow không đổi hạn kỳ cũ
    ✔ ca 6: hai kỳ mở, tự nhận và chia lô không trả trùng hay vượt quỹ

  SC-10 - callbacks cưỡng chế
    ✔ ca 7: module đếm đúng sau mint, transfer, forcedTransfer, agent burn và batch (64ms)
    ✔ ca 8: RejectAll chặn đường thường, cưỡng chế bỏ kiểm nhưng vẫn báo module
    ✔ ca 9: chưa gắn bộ luật thì cưỡng chế revert ComplianceNotSet (66ms)

  SC-09 - ERC-3643 core
    IdentityRegistry
      ✔ đăng ký lặp lại được, cập nhật quốc gia và xoá xác minh
      ✔ chỉ AGENT_ROLE được sửa sổ và batch bắt buộc hai mảng cùng độ dài
    ModularCompliance
      ✔ không module thì cho qua; AllowAll cho qua; RejectAll chặn; gỡ thì cho qua
      ✔ chỉ token đã gắn gọi được ba action
    ProjectToken
      ✔ khớp selector và topic của phần IToken T-REX v4.1.6 đã hiện thực
      ✔ chỉ ví đã xác minh được nhận/chuyển; xoá danh tính chặn ngay
      ✔ bộ luật RejectAll chặn đúng lỗi và gỡ module thì chuyển lại được
      ✔ đóng băng toàn phần và một phần; cưỡng chế tự mở đúng phần cần dùng
      ✔ pause/unpause chặn và mở chuyển; chỉ PAUSER_ROLE gọi được
      ✔ thiếu sổ danh tính hoặc bộ luật báo custom error rõ
    ERC-2612 permit
      ✔ VNDB: helper ký đúng domain; permit, transferFrom, expiry, sai signer và replay
      ✔ WPT: permit độc lập KYC nhưng transferFrom vẫn qua identity và compliance


  21 passing (914ms)
```

Mã thoát: `0`.

```bash
npx hardhat test > /tmp/sc10-cap-green-all.log 2>&1
```

```text
◇ injected env (7) from .env // tip: ⌘ override existing { override: true }


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
    ✔ lần đầu ghi ví, cờ, số dư và phát đúng sự kiện (49ms)
    ✔ lần đầu chỉ chạy một lần, kể cả sau khi đốt hết
    ✔ mint thường bị chặn trước lần đầu và khi nhắm ví khác SPV
    ✔ thiếu MINTER_ROLE không được phát hành và không ghi cờ
    ✔ ví 0 và số lượng 0 bị chặn bằng custom error, không ghi cờ
    ✔ ví chưa whitelist bị hook chặn và hoàn nguyên ví/cờ
    ✔ ví bị đóng băng bị hook chặn và hoàn nguyên ví/cờ
    ✔ token tạm dừng bị hook chặn và hoàn nguyên ví/cờ

  SC-09 - ERC-3643 core
    IdentityRegistry
      ✔ đăng ký lặp lại được, cập nhật quốc gia và xoá xác minh
      ✔ chỉ AGENT_ROLE được sửa sổ và batch bắt buộc hai mảng cùng độ dài
    ModularCompliance
      ✔ không module thì cho qua; AllowAll cho qua; RejectAll chặn; gỡ thì cho qua
      ✔ chỉ token đã gắn gọi được ba action
    ProjectToken
      ✔ khớp selector và topic của phần IToken T-REX v4.1.6 đã hiện thực (40ms)
      ✔ chỉ ví đã xác minh được nhận/chuyển; xoá danh tính chặn ngay
      ✔ bộ luật RejectAll chặn đúng lỗi và gỡ module thì chuyển lại được
      ✔ đóng băng toàn phần và một phần; cưỡng chế tự mở đúng phần cần dùng (39ms)
      ✔ pause/unpause chặn và mở chuyển; chỉ PAUSER_ROLE gọi được (40ms)
      ✔ thiếu sổ danh tính hoặc bộ luật báo custom error rõ
    ERC-2612 permit
      ✔ VNDB: helper ký đúng domain; permit, transferFrom, expiry, sai signer và replay
      ✔ WPT: permit độc lập KYC nhưng transferFrom vẫn qua identity và compliance (55ms)

  SC-10 - ProfitDistributor
    ✔ ca 1: claim kỳ A sau quét không lấy quỹ kỳ B (63ms)
    ✔ ca 2: distributeTo kỳ đã đóng revert cả lô
    ✔ ca 3: đúng deadline và sau deadline chưa quét không nhận được
    ✔ ca 4: sweep chỉ sau hạn, đóng một lần, kỳ đã chi hết vẫn đóng được
    ✔ ca 5: đổi claimWindow không đổi hạn kỳ cũ
    ✔ ca 6: hai kỳ mở, tự nhận và chia lô không trả trùng hay vượt quỹ (38ms)

  SC-10 - callbacks cưỡng chế
    ✔ ca 7: module đếm đúng sau mint, transfer, forcedTransfer, agent burn và batch (65ms)
    ✔ ca 8: RejectAll chặn đường thường, cưỡng chế bỏ kiểm nhưng vẫn báo module
    ✔ ca 9: chưa gắn bộ luật thì cưỡng chế revert ComplianceNotSet (54ms)

  SC-10 - CH-1 cap cố định
    ✔ cap: lần đầu vượt trần bị chặn và không ghi mốc, đúng trần được phép (39ms)
    ✔ cap: mint bổ sung không vượt trần, đốt rồi chỉ mint bù trong trần (42ms)
    ✔ cap: không cho triển khai cap bằng 0

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
      ✔ P4-1: AGENT đăng ký được ví, isVerified phản ánh đúng
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


  108 passing (2s)
```

Mã thoát: `0`.

Sau mọi đột biến, nguồn đã hoàn nguyên:

```bash
npx hardhat test test/sc-10-va-hop-dong.test.js > /tmp/sc10-after-mutations-green.log 2>&1
```

```text
◇ injected env (7) from .env // tip: ⌁ auth for agents [www.vestauth.com]
Compiled 4 Solidity files successfully (evm target: cancun).


  SC-10 - ProfitDistributor
    ✔ ca 1: claim kỳ A sau quét không lấy quỹ kỳ B (401ms)
    ✔ ca 2: distributeTo kỳ đã đóng revert cả lô
    ✔ ca 3: đúng deadline và sau deadline chưa quét không nhận được
    ✔ ca 4: sweep chỉ sau hạn, đóng một lần, kỳ đã chi hết vẫn đóng được
    ✔ ca 5: đổi claimWindow không đổi hạn kỳ cũ
    ✔ ca 6: hai kỳ mở, tự nhận và chia lô không trả trùng hay vượt quỹ

  SC-10 - callbacks cưỡng chế
    ✔ ca 7: module đếm đúng sau mint, transfer, forcedTransfer, agent burn và batch (72ms)
    ✔ ca 8: RejectAll chặn đường thường, cưỡng chế bỏ kiểm nhưng vẫn báo module
    ✔ ca 9: chưa gắn bộ luật thì cưỡng chế revert ComplianceNotSet (64ms)

  SC-10 - CH-1 cap cố định
    ✔ cap: lần đầu vượt trần bị chặn và không ghi mốc, đúng trần được phép (46ms)
    ✔ cap: mint bổ sung không vượt trần, đốt rồi chỉ mint bù trong trần (46ms)
    ✔ cap: không cho triển khai cap bằng 0


  12 passing (697ms)
```

Mã thoát: `0`.

## 4. Xuất và đối chiếu ABI

Xuất bằng mạng hardhat nội bộ, không gọi testnet; địa chỉ không đổi:

```bash
npx hardhat run scripts/deploy.js > /tmp/sc10-export-abi.log 2>&1
```

```text
◇ injected env (7) from .env // tip: ⌘ override existing { override: true }
◇ injected env (0) from .env // tip: ⌘ multiple files { path: ['.env.local', '.env'] }
Mạng: hardhat (chainId=31337) -> chainKey="hardhat-local"
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
```

Mã thoát: `0`.

Chạy đối chiếu từ app/:

```bash
npx vitest run test/abi-contract-sync.test.ts test/evm-issuance.test.ts test/issue-price-single-source.test.ts > /tmp/sc10-abi.log 2>&1
```

```text

 RUN  v3.2.4 /home/tuanlh/.codex/worktrees/03a6/bidv-rwa-tokenize/app

 ✓ test/abi-contract-sync.test.ts (12 tests) 7ms
 ✓ test/issue-price-single-source.test.ts (16 tests) 17ms
 ✓ test/evm-issuance.test.ts (13 tests | 12 skipped) 5ms

 Test Files  3 passed (3)
      Tests  29 passed | 12 skipped (41)
   Start at  14:31:41
   Duration  827ms (transform 282ms, setup 0ms, collect 1000ms, tests 29ms, environment 0ms, prepare 311ms)
```

Mã thoát: `0`.
