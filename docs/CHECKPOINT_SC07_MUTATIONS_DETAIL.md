# SC-07 — chi tiết đột biến

## 1. Cách chạy

Mỗi đột biến chỉ sửa `SpvPaymentVault.sol`, chạy đúng ca được chỉ định bằng Hardhat, ghi mã thoát,
rồi hoàn nguyên trong `finally`. Kết thúc chạy `git diff --exit-code` cho hợp đồng. Các dòng dưới là
đầu ra lỗi nguyên văn được giữ lại từ lượt chạy; mọi lệnh đều exit 1 như yêu cầu.

## 2. Kết quả 22a–22l

```text
22a — bỏ kiểm settledOrders; ca 11
AssertionError: Expected transaction to be reverted with custom error 'OrderAlreadySettled', but it didn't revert
exit 1

22b — settleSell kiểm phần khoá; ca 4
AssertionError: Error in "ExceedsWithdrawable" custom error: Error in the 1st argument assertion: expected 20000000 to equal 1.
exit 1

22c — netProceeds trừ không chặn 0; ca 3
VM Exception while processing transaction: reverted with panic code 0x11 (Arithmetic operation overflowed outside of an unchecked block)
exit 1

22d — tỷ lệ sau chốt áp ngay; ca 6
AssertionError: expected false to equal true
exit 1

22e — kỳ đầu dùng percentLocked; ca 2
AssertionError: expected 0 to equal 20000000.
exit 1

22f — withdrawable trừ thẳng; ca 4
VM Exception while processing transaction: reverted with panic code 0x11 (Arithmetic operation overflowed outside of an unchecked block)
exit 1

22g — whenNotPaused trên settleSell; ca 15
Error: VM Exception while processing transaction: reverted with custom error 'EnforcedPause()'
exit 1

22h — bỏ kiểm periodRef liên tiếp; ca 9
AssertionError: Expected transaction to be reverted with custom error 'InvalidPeriodRef', but it didn't revert
exit 1

22i — bỏ nonReentrant và ghi orderRef sau chuyển; ca 20
AssertionError: Expected transaction to be reverted with custom error 'ReentrancyGuardReentrantCall', but it reverted with a different custom error
exit 1

22j — bỏ kiểm price > 0; ca 12
AssertionError: Expected transaction to be reverted with custom error 'ZeroPrice', but it didn't revert
exit 1

22k — bỏ kiểm payout wallet xác minh; ca 14
AssertionError: Expected transaction to be reverted with custom error 'PayoutWalletNotVerified', but it didn't revert
exit 1

22l — trước kỳ đầu đưa tỷ lệ vào pending; ca 7
AssertionError: expected 20000000 to equal 10000000.
exit 1
```

Sau khi hoàn nguyên:

```text
$ git diff --exit-code -- packages/contracts-evm/contracts/SpvPaymentVault.sol
[không có đầu ra]
exit 0
```
