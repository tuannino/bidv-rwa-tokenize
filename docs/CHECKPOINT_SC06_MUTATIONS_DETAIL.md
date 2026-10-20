# SC-06 — chi tiết đột biến (ca 11)

Tệp này giữ đầu ra dài theo `.kiro/steering/efficiency.md`. Mỗi đột biến áp một thay đổi lên
`packages/contracts-evm/contracts/ProfitDistributor.sol` bằng script dưới đây, chạy đúng ca được
spec chỉ định trong `test/sc-06-chia-loi-nhuan.test.js`, rồi hoàn nguyên bằng `git checkout` và
dán `git status --short` (rỗng nghĩa là sạch). Chạy trong sandbox với `USE_LOCAL_SOLC=1` vì
`binaries.soliditylang.org` bị chặn (xem checkpoint mục 5).

| Đột biến | Thay đổi | Ca phải đỏ | Kết quả |
|---|---|---|---|
| 11a | `_claim` không trừ dự trữ | ca 3 | đỏ, exit 1 |
| 11b | tạo kỳ lấy toàn bộ số dư thay vì phần chưa phân bổ | ca 3 | đỏ, exit 1 |
| 11c | đóng kỳ không trừ dự trữ | ca 4 | đỏ, exit 1 |
| 11d | đóng kỳ chuyển phần còn lại cho người gọi | ca 6 | đỏ (ca 6 và kiểm chung sau ca), exit 2 |
| 11e | bỏ kiểm hạn của đóng kỳ | ca 5 | đỏ, exit 1 |
| 11f | `createDistribution` không cộng dự trữ | ca 8 | đỏ, exit 1 |
| 11g | bỏ kiểm trùng nhãn | ca 2 | đỏ, exit 1 |

## Script áp đột biến

```python
"""Áp một đột biến SC-06 lên ProfitDistributor.sol. Dùng: python3 mutate.py <a..g>."""
import sys

PATH = "packages/contracts-evm/contracts/ProfitDistributor.sol"

MUTATIONS = {
    # (a) _claim không trừ dự trữ
    "a": [("            totalReserved -= amount;\n", "")],
    # (b) tạo kỳ lấy toàn bộ số dư
    "b": [("        uint256 amount = unallocatedBalance();\n",
           "        uint256 amount = payoutToken.balanceOf(address(this));\n")],
    # (c) đóng kỳ không trừ dự trữ
    "c": [("        totalReserved -= released;\n", "")],
    # (d) đóng kỳ chuyển tiền cho người gọi
    "d": [("        emit DistributionClosed(id, released);\n",
           "        payoutToken.safeTransfer(msg.sender, released);\n        emit DistributionClosed(id, released);\n")],
    # (e) bỏ kiểm hạn của đóng kỳ
    "e": [("        require(block.timestamp >= d.claimDeadline, \"chua het han nhan\");\n        uint256 released", "        uint256 released")],
    # (f) createDistribution không cộng dự trữ (chỉ đường tạo từ quỹ còn cộng)
    "f": [("        totalReserved += amount;\n\n        emit DistributionCreated", "\n        emit DistributionCreated"),
          ("        id = _newDistribution(amount, period);\n        _periodIdPlusOne[key] = id + 1;\n",
           "        id = _newDistribution(amount, period);\n        totalReserved += amount;\n        _periodIdPlusOne[key] = id + 1;\n")],
    # (g) bỏ kiểm trùng nhãn
    "g": [("        if (_periodIdPlusOne[key] != 0) revert DuplicatePeriod(period);\n", "")],
}

name = sys.argv[1]
source = open(PATH).read()
for old, new in MUTATIONS[name]:
    if source.count(old) != 1:
        sys.exit(f"đột biến {name}: không tìm thấy đúng một chỗ cần sửa")
    source = source.replace(old, new)
open(PATH, "w").write(source)
print(f"đã áp đột biến {name}")
```

## Đầu ra nguyên văn

```text
### Đột biến 11a
$ python3 mutate.py a && git diff --stat
đã áp đột biến a
 packages/contracts-evm/contracts/ProfitDistributor.sol | 1 -
 1 file changed, 1 deletion(-)
$ (cd packages/contracts-evm && USE_LOCAL_SOLC=1 npx hardhat test test/sc-06-chia-loi-nhuan.test.js --grep "ca 3:")
Compiled 2 Solidity files successfully (evm target: cancun).
  SC-06 - ProfitDistributor: quỹ chia một chiều
    1) ca 3: không tính trùng, kỳ sau chỉ lấy tiền nạp thêm, trả hết hai kỳ không thiếu tiền
  0 passing (1s)
  1 failing
  1) SC-06 - ProfitDistributor: quỹ chia một chiều
       ca 3: không tính trùng, kỳ sau chỉ lấy tiền nạp thêm, trả hết hai kỳ không thiếu tiền:
      totalReserved = tổng phần còn nợ của kỳ chưa đóng
      + expected - actual
      -1000000
      +400000
exit=1
$ git checkout -- packages/contracts-evm/contracts/ProfitDistributor.sol && git status --short

### Đột biến 11b
$ python3 mutate.py b && git diff --stat
đã áp đột biến b
 packages/contracts-evm/contracts/ProfitDistributor.sol | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
$ (cd packages/contracts-evm && USE_LOCAL_SOLC=1 npx hardhat test test/sc-06-chia-loi-nhuan.test.js --grep "ca 3:")
Compiled 2 Solidity files successfully (evm target: cancun).
  SC-06 - ProfitDistributor: quỹ chia một chiều
    1) ca 3: không tính trùng, kỳ sau chỉ lấy tiền nạp thêm, trả hết hai kỳ không thiếu tiền
  0 passing (1s)
  1 failing
  1) SC-06 - ProfitDistributor: quỹ chia một chiều
       ca 3: không tính trùng, kỳ sau chỉ lấy tiền nạp thêm, trả hết hai kỳ không thiếu tiền:
      AssertionError: expected 900000 to equal 500000.
      + expected - actual
      -900000
      +500000
exit=1
$ git checkout -- packages/contracts-evm/contracts/ProfitDistributor.sol && git status --short

### Đột biến 11c
$ python3 mutate.py c && git diff --stat
đã áp đột biến c
 packages/contracts-evm/contracts/ProfitDistributor.sol | 1 -
 1 file changed, 1 deletion(-)
$ (cd packages/contracts-evm && USE_LOCAL_SOLC=1 npx hardhat test test/sc-06-chia-loi-nhuan.test.js --grep "ca 4:")
Compiled 2 Solidity files successfully (evm target: cancun).
  SC-06 - ProfitDistributor: quỹ chia một chiều
    1) ca 4: đóng kỳ sau hạn trả phần còn lại về quỹ, kỳ sau lấy lại được
  0 passing (1s)
  1 failing
  1) SC-06 - ProfitDistributor: quỹ chia một chiều
       ca 4: đóng kỳ sau hạn trả phần còn lại về quỹ, kỳ sau lấy lại được:
      AssertionError: expected 400000 to equal 0.
      + expected - actual
      -400000
      +0
exit=1
$ git checkout -- packages/contracts-evm/contracts/ProfitDistributor.sol && git status --short

### Đột biến 11d
$ python3 mutate.py d && git diff --stat
đã áp đột biến d
 packages/contracts-evm/contracts/ProfitDistributor.sol | 1 +
 1 file changed, 1 insertion(+)
$ (cd packages/contracts-evm && USE_LOCAL_SOLC=1 npx hardhat test test/sc-06-chia-loi-nhuan.test.js --grep "ca 6:")
Compiled 2 Solidity files successfully (evm target: cancun).
  SC-06 - ProfitDistributor: quỹ chia một chiều
    1) ca 6: không còn đường rút, VNDB chỉ ra khỏi quỹ cho ví được chia
    2) "after each" hook for "ca 6: không còn đường rút, VNDB chỉ ra khỏi quỹ cho ví được chia"
  0 passing (1s)
  2 failing
  1) SC-06 - ProfitDistributor: quỹ chia một chiều
       ca 6: không còn đường rút, VNDB chỉ ra khỏi quỹ cho ví được chia:
     Error: VM Exception while processing transaction: reverted with custom error 'NothingToDistribute()'
  2) SC-06 - ProfitDistributor: quỹ chia một chiều
       "after each" hook for "ca 6: không còn đường rút, VNDB chỉ ra khỏi quỹ cho ví được chia":
      AssertionError: VNDB ra khỏi quỹ không qua claim: 0xeaf88551b61a6c6d9c3a46b286803092652cca642f46cbdf019925ccdb7bb621|0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266|400000: expected false to equal true
      + expected - actual
      -false
      +true
exit=2
$ git checkout -- packages/contracts-evm/contracts/ProfitDistributor.sol && git status --short

### Đột biến 11e
$ python3 mutate.py e && git diff --stat
đã áp đột biến e
 packages/contracts-evm/contracts/ProfitDistributor.sol | 1 -
 1 file changed, 1 deletion(-)
$ (cd packages/contracts-evm && USE_LOCAL_SOLC=1 npx hardhat test test/sc-06-chia-loi-nhuan.test.js --grep "ca 5:")
Compiled 2 Solidity files successfully (evm target: cancun).
  SC-06 - ProfitDistributor: quỹ chia một chiều
    1) ca 5: đóng trước hạn, đóng hai lần, ví thiếu vai admin đều revert; kỳ đã trả hết đóng với 0
  0 passing (1s)
  1 failing
  1) SC-06 - ProfitDistributor: quỹ chia một chiều
       ca 5: đóng trước hạn, đóng hai lần, ví thiếu vai admin đều revert; kỳ đã trả hết đóng với 0:
     AssertionError: Expected transaction to be reverted with reason 'chua het han nhan', but it didn't revert
exit=1
$ git checkout -- packages/contracts-evm/contracts/ProfitDistributor.sol && git status --short

### Đột biến 11f
$ python3 mutate.py f && git diff --stat
đã áp đột biến f
 packages/contracts-evm/contracts/ProfitDistributor.sol | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
$ (cd packages/contracts-evm && USE_LOCAL_SOLC=1 npx hardhat test test/sc-06-chia-loi-nhuan.test.js --grep "ca 8:")
Compiled 2 Solidity files successfully (evm target: cancun).
  SC-06 - ProfitDistributor: quỹ chia một chiều
    1) ca 8: createDistribution kéo tiền cũng cộng dự trữ; trộn hai cách vẫn đúng ca 3
  0 passing (1s)
  1 failing
  1) SC-06 - ProfitDistributor: quỹ chia một chiều
       ca 8: createDistribution kéo tiền cũng cộng dự trữ; trộn hai cách vẫn đúng ca 3:
      AssertionError: expected 0 to equal 1000000.
      + expected - actual
      -0
      +1000000
exit=1
$ git checkout -- packages/contracts-evm/contracts/ProfitDistributor.sol && git status --short

### Đột biến 11g
$ python3 mutate.py g && git diff --stat
đã áp đột biến g
 packages/contracts-evm/contracts/ProfitDistributor.sol | 1 -
 1 file changed, 1 deletion(-)
$ (cd packages/contracts-evm && USE_LOCAL_SOLC=1 npx hardhat test test/sc-06-chia-loi-nhuan.test.js --grep "ca 2:")
Compiled 2 Solidity files successfully (evm target: cancun).
  SC-06 - ProfitDistributor: quỹ chia một chiều
    1) ca 2: nhãn rỗng, nhãn trùng, quỹ chưa phân bổ 0, tổng cung 0 đều revert
  0 passing (1s)
  1 failing
  1) SC-06 - ProfitDistributor: quỹ chia một chiều
       ca 2: nhãn rỗng, nhãn trùng, quỹ chưa phân bổ 0, tổng cung 0 đều revert:
     AssertionError: Expected transaction to be reverted with custom error 'DuplicatePeriod', but it didn't revert
exit=1
$ git checkout -- packages/contracts-evm/contracts/ProfitDistributor.sol && git status --short

```
