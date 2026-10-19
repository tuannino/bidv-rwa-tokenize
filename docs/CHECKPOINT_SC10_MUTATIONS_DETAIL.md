# SC-10 — bằng chứng đột biến 11a–11f

Tệp chi tiết cho CHECKPOINT_SC10 mục 2. Log giữ nguyên, gồm khoảng trắng cuối dòng của Hardhat.
Mỗi nhóm đỏ đúng ca; e chạy cả hai biến thể để kiểm transferred lẫn destroyed. Không commit mutant.

## 1. Script tạm đã chạy

Chạy từ gốc repo; script sửa từng nguồn, chạy ca chỉ định, ghi mã thoát rồi finally hoàn nguyên.
Script sau là nội dung thực tế của /tmp/sc10-mutations.py:

```python
from pathlib import Path
import subprocess
profit = Path('packages/contracts-evm/contracts/ProfitDistributor.sol')
token = Path('packages/contracts-evm/contracts/tokens/ProjectToken.sol')
original = {profit: profit.read_text(), token: token.read_text()}
closed = '        if (d.closed) revert IProfitDistributorErrors.DistributionClosed(id);\n'
invariant = '''        if (d.claimed + amount > d.amount) {
            revert DistributionOverdrawn(id, amount, d.amount - d.claimed);
        }
'''
end = '        if (block.timestamp >= d.claimDeadline) revert ClaimWindowEnded(id, d.claimDeadline);\n'
sweep = '        require(block.timestamp >= d.claimDeadline, "chua het han nhan");\n'
transfer = '            else forcedCompliance.transferred(from, to, value);\n'
burn = '''            if (to == address(0)) forcedCompliance.destroyed(from, value);
            else forcedCompliance.transferred(from, to, value);'''
checks = [
 ('a', profit, 'ca 1:', [(closed, '', 1), (invariant, '', 1)]),
 ('b', profit, 'ca 3:', [(end, '', 1)]),
 ('c', profit, 'ca 4:', [(sweep, '', 1)]),
 ('d', profit, 'ca 5:', [('block.timestamp >= d.claimDeadline', 'block.timestamp >= d.createdAt + claimWindow', 2)]),
 ('e-transfer', token, 'ca 7:', [(transfer, '', 1)]),
 ('e-burn', token, 'ca 7:', [(burn, '            if (to != address(0)) forcedCompliance.transferred(from, to, value);', 1)]),
 ('f', token, 'ca 8:', [('            IERC3643Compliance forcedCompliance = _requireCompliance();', '''            IERC3643Compliance forcedCompliance = _requireCompliance();
            if (!forcedCompliance.canTransfer(from, to, value)) revert ComplianceRejected(from, to, value);''', 1)]),
]
try:
 for name, path, grep, replacements in checks:
  source = original[path]
  for old, new, count in replacements:
   assert source.count(old) >= count, (name, old)
   source = source.replace(old, new, count)
  path.write_text(source)
  try:
   result = subprocess.run(['npx','hardhat','test','test/sc-10-va-hop-dong.test.js','--grep',grep],cwd='packages/contracts-evm',capture_output=True,text=True)
   output = result.stdout + result.stderr
   Path(f'/tmp/sc10-mutation-{name}.log').write_text(output+f'\nHardhat exit: {result.returncode}\n')
   print(f'{name}: exit={result.returncode}, expected failure={"1 failing" in output}',flush=True)
   assert result.returncode == 1 and '1 failing' in output, name
  finally:
   path.write_text(original[path])
finally:
 for path, source in original.items(): path.write_text(source)
print('RESTORED: production sources unchanged')

```

```bash
python3 /tmp/sc10-mutations.py > /tmp/sc10-mutations-summary.log 2>&1
```

```text
a: exit=1, expected failure=True
b: exit=1, expected failure=True
c: exit=1, expected failure=True
d: exit=1, expected failure=True
e-transfer: exit=1, expected failure=True
e-burn: exit=1, expected failure=True
f: exit=1, expected failure=True
RESTORED: production sources unchanged
```

Mã thoát: `0`.

## 2. Đầu ra từng biến thể

Dưới đây là stdout/stderr Hardhat mà script mục 1 lưu nguyên văn, thêm dòng mã thoát cuối. Mỗi lệnh npx chạy từ packages/contracts-evm/.

### 11a

```bash
npx hardhat test test/sc-10-va-hop-dong.test.js --grep 'ca 1:'
```

```text
◇ injected env (7) from .env // tip: ⌘ multiple files { path: ['.env.local', '.env'] }
Compiled 4 Solidity files successfully (evm target: cancun).


  SC-10 - ProfitDistributor
    1) ca 1: claim kỳ A sau quét không lấy quỹ kỳ B


  0 passing (407ms)
  1 failing

  1) SC-10 - ProfitDistributor
       ca 1: claim kỳ A sau quét không lấy quỹ kỳ B:
     AssertionError: Expected transaction to be reverted with custom error 'DistributionClosed', but it reverted with custom error 'ClaimWindowEnded'
  




Hardhat exit: 1
```

Mã thoát: `1`.

### 11b

```bash
npx hardhat test test/sc-10-va-hop-dong.test.js --grep 'ca 3:'
```

```text
◇ injected env (7) from .env // tip: ◈ secrets for agents [www.dotenvx.com]
Compiled 2 Solidity files successfully (evm target: cancun).


  SC-10 - ProfitDistributor
    1) ca 3: đúng deadline và sau deadline chưa quét không nhận được


  0 passing (423ms)
  1 failing

  1) SC-10 - ProfitDistributor
       ca 3: đúng deadline và sau deadline chưa quét không nhận được:
     AssertionError: Expected transaction to be reverted with custom error 'ClaimWindowEnded', but it didn't revert
      at Context.<anonymous> (test/sc-10-va-hop-dong.test.js:61:5)




Hardhat exit: 1
```

Mã thoát: `1`.

### 11c

```bash
npx hardhat test test/sc-10-va-hop-dong.test.js --grep 'ca 4:'
```

```text
◇ injected env (7) from .env // tip: ◈ secrets for agents [www.dotenvx.com]
Compiled 2 Solidity files successfully (evm target: cancun).


  SC-10 - ProfitDistributor
    1) ca 4: sweep chỉ sau hạn, đóng một lần, kỳ đã chi hết vẫn đóng được


  0 passing (449ms)
  1 failing

  1) SC-10 - ProfitDistributor
       ca 4: sweep chỉ sau hạn, đóng một lần, kỳ đã chi hết vẫn đóng được:
     AssertionError: Expected transaction to be reverted with reason 'chua het han nhan', but it didn't revert
      at Context.<anonymous> (test/sc-10-va-hop-dong.test.js:72:5)




Hardhat exit: 1
```

Mã thoát: `1`.

### 11d

```bash
npx hardhat test test/sc-10-va-hop-dong.test.js --grep 'ca 5:'
```

```text
◇ injected env (7) from .env // tip: ◈ encrypted .env [www.dotenvx.com]
Compiled 2 Solidity files successfully (evm target: cancun).


  SC-10 - ProfitDistributor
    1) ca 5: đổi claimWindow không đổi hạn kỳ cũ


  0 passing (414ms)
  1 failing

  1) SC-10 - ProfitDistributor
       ca 5: đổi claimWindow không đổi hạn kỳ cũ:
     AssertionError: Expected transaction NOT to be reverted
      at Context.<anonymous> (test/sc-10-va-hop-dong.test.js:103:5)




Hardhat exit: 1
```

Mã thoát: `1`.

### 11e-transfer

```bash
npx hardhat test test/sc-10-va-hop-dong.test.js --grep 'ca 7:'
```

```text
◇ injected env (7) from .env // tip: ⌘ override existing { override: true }
Compiled 4 Solidity files successfully (evm target: cancun).


  SC-10 - callbacks cưỡng chế
    1) ca 7: module đếm đúng sau mint, transfer, forcedTransfer, agent burn và batch


  0 passing (421ms)
  1 failing

  1) SC-10 - callbacks cưỡng chế
       ca 7: module đếm đúng sau mint, transfer, forcedTransfer, agent burn và batch:

      AssertionError: expected 2 to equal 3.
      + expected - actual

      -2
      +3
      
      at expectHolderCount (test/sc-10-va-hop-dong.test.js:133:44)
      at Context.<anonymous> (test/sc-10-va-hop-dong.test.js:142:77)




Hardhat exit: 1
```

Mã thoát: `1`.

### 11e-burn

```bash
npx hardhat test test/sc-10-va-hop-dong.test.js --grep 'ca 7:'
```

```text
◇ injected env (7) from .env // tip: ⌘ override existing { override: true }
Compiled 4 Solidity files successfully (evm target: cancun).


  SC-10 - callbacks cưỡng chế
    1) ca 7: module đếm đúng sau mint, transfer, forcedTransfer, agent burn và batch


  0 passing (394ms)
  1 failing

  1) SC-10 - callbacks cưỡng chế
       ca 7: module đếm đúng sau mint, transfer, forcedTransfer, agent burn và batch:

      AssertionError: expected 3 to equal 2.
      + expected - actual

      -3
      +2
      
      at expectHolderCount (test/sc-10-va-hop-dong.test.js:133:44)
      at Context.<anonymous> (test/sc-10-va-hop-dong.test.js:143:69)




Hardhat exit: 1
```

Mã thoát: `1`.

### 11f

```bash
npx hardhat test test/sc-10-va-hop-dong.test.js --grep 'ca 8:'
```

```text
◇ injected env (7) from .env // tip: ⌘ custom filepath { path: '/custom/path/.env' }
Compiled 4 Solidity files successfully (evm target: cancun).


  SC-10 - callbacks cưỡng chế
    1) ca 8: RejectAll chặn đường thường, cưỡng chế bỏ kiểm nhưng vẫn báo module


  0 passing (418ms)
  1 failing

  1) SC-10 - callbacks cưỡng chế
       ca 8: RejectAll chặn đường thường, cưỡng chế bỏ kiểm nhưng vẫn báo module:
     AssertionError: Expected transaction NOT to be reverted
      at Context.<anonymous> (test/sc-10-va-hop-dong.test.js:160:5)




Hardhat exit: 1
```

Mã thoát: `1`.

11a vẫn còn lớp bảo vệ hết hạn nên trả ClaimWindowEnded thay vì DistributionClosed; ca 1 bắt đúng guard đã bị bỏ, không tuyên bố mutant đã chi tiền qua lớp hết hạn còn lại.

## 3. Nguồn sạch ngay sau đột biến

Chạy trước khi đổi ABI/tài liệu bàn giao; stdout trống, exit 0:

```bash
git status --short > /tmp/sc10-after-mutations-status.log
```

```text

```

Mã thoát: `0`.
