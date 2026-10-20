# BE-13: chi tiết đột biến (ca 16)

Đầu ra của từng đột biến: áp bằng `mutate_be13.py` (thay đúng chỗ như bảng dưới), chạy đúng ca cần đỏ,
hoàn nguyên bằng `git checkout -- app/src`, rồi `git status --short` (rỗng là sạch). Chạy trên commit `f87c621`. Dòng `vitest exit=1` là mã thoát của
vitest: có ca đỏ.

| Đột biến | Thay đổi | Ca phải đỏ | Kết quả |
|---|---|---|---|
| 16a | `can` và `permissionsOf` quy vai lạ về `SELLER` | 1 | đỏ "BE-13 ca 1: can sai với MỌI quyền" |
| 16b | bỏ phép kiểm `amount <= withdrawable` | 8 | đỏ "vượt withdrawable đúng 1 đồng" |
| 16c | bỏ ràng buộc `activeChain` ở bản bộ nhớ | 9 | đỏ "một lệnh đang dở mỗi chain" |
| 16d | FIXED sang PERCENT gửi `setFixedLock(0)` trước | 3 | đỏ "dòng 4, FIXED sang PERCENT" |
| 16e | đối soát tự `COMPLETED` khi có đúng một ứng viên | 10 | đỏ cả ba ca 10 |
| 16f | bỏ khoá vận hành ở cấu hình và lệnh rút | 6 | đỏ ba ca 6 |
| 16g | mock tính khoá theo số dư thay cho `netProceeds` | 12 | đỏ kịch bản "rounding-pending" |

16g chỉ đỏ ở kịch bản làm tròn: ở bảng OP-05 số dư vault trùng thu ròng cho tới lúc rút (tiền vào ra chỉ
qua mua bán), và sau khi chốt kỳ khoá dùng `percentLocked`, nên hai công thức ra cùng số. Kịch bản thứ hai
nạp thẳng 100 VNDB vào vault để số dư khác thu ròng.

```text
### Đột biến 16a
$ python3 mutate_be13.py a && git diff --stat
đã áp đột biến a
 app/src/lib/rbac/can.ts | 4 ++--
 1 file changed, 2 insertions(+), 2 deletions(-)
$ (cd app && npx vitest run test/rbac.test.ts -t "BE-13 ca 1")
   × BE-13 ca 1: RBAC đóng cho vai lạ (QĐ-A) > can sai với MỌI quyền, permissionsOf rỗng 10ms
   ✓ BE-13 ca 1: RBAC đóng cho vai lạ (QĐ-A) > assertCan ném ForbiddenError ghi vai là UNKNOWN, không mượn tên vai thật 1ms
   ✓ BE-13 ca 1: RBAC đóng cho vai lạ (QĐ-A) > ba quyền vault mới: chỉ CONTROLLER cấu hình và xử lý NEEDS_REVIEW, chỉ SELLER rút 0ms
   ✓ BE-13 ca 1: RBAC đóng cho vai lạ (QĐ-A) > SELLER vẫn KHÔNG đọc được dữ liệu toàn hệ 0ms
   ✓ BE-13 ca 1: RBAC đóng cho vai lạ (QĐ-A) > lớp hai (cấu hình, dữ liệu thử) cũng đóng với vai lạ 1ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      Tests  1 failed | 4 passed | 62 skipped (67)
vitest exit=1
$ git checkout -- app/src && git status --short
?? docs/CHECKPOINT_BE13.md
?? docs/CHECKPOINT_BE13_MUTATIONS_DETAIL.md
?? docs/CHECKPOINT_BE13_VERIFICATION_DETAIL.md

### Đột biến 16b
$ python3 mutate_be13.py b && git diff --stat
đã áp đột biến b
 app/src/lib/bank/withdraw.service.ts | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
$ (cd app && npx vitest run test/be-13-withdraw.test.ts -t "ca 8")
   × BE-13 ca 8: chặn trước khi gửi > vượt withdrawable đúng 1 đồng 32ms
   ✓ BE-13 ca 8: chặn trước khi gửi > chưa đặt ví nhận 6ms
   ✓ BE-13 ca 8: chặn trước khi gửi > vault tạm dừng rút 3ms
   ✓ BE-13 ca 8: chặn trước khi gửi > đã có lệnh dở (khoá WITHDRAW đang giữ) 2ms
   ✓ BE-13 ca 8: chặn trước khi gửi > Kiểm soát viên đang lưu cấu hình (khoá CONFIG đang giữ) 3ms
   ✓ BE-13 ca 8: chặn trước khi gửi > mã một lần sai dạng "12345": từ chối, mã không lọt vào lỗi hay audit 2ms
   ✓ BE-13 ca 8: chặn trước khi gửi > mã một lần sai dạng "1234567": từ chối, mã không lọt vào lỗi hay audit 2ms
   ✓ BE-13 ca 8: chặn trước khi gửi > mã một lần sai dạng "abcdef": từ chối, mã không lọt vào lỗi hay audit 2ms
   ✓ BE-13 ca 8: chặn trước khi gửi > mã một lần sai dạng "12 456": từ chối, mã không lọt vào lỗi hay audit 2ms
   ✓ BE-13 ca 8: chặn trước khi gửi > mã một lần sai dạng "": từ chối, mã không lọt vào lỗi hay audit 2ms
   ✓ BE-13 ca 8: chặn trước khi gửi > mã một lần đúng không bao giờ được lưu hay ghi vào audit 3ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      Tests  1 failed | 10 passed | 24 skipped (35)
vitest exit=1
$ git checkout -- app/src && git status --short
?? docs/CHECKPOINT_BE13.md
?? docs/CHECKPOINT_BE13_MUTATIONS_DETAIL.md
?? docs/CHECKPOINT_BE13_VERIFICATION_DETAIL.md

### Đột biến 16c
$ python3 mutate_be13.py c && git diff --stat
đã áp đột biến c
 app/src/lib/store/memory.vault.store.ts | 3 ---
 1 file changed, 3 deletions(-)
$ (cd app && npx vitest run test/be-13-withdraw.test.ts -t "ca 9")
   ✓ BE-13 ca 9: chống trùng và song song > cùng clientRequestId cùng nội dung trả lệnh cũ, không gửi lần hai; khác nội dung bị từ chối 14ms
   ✓ BE-13 ca 9: chống trùng và song song > hai lệnh song song mỗi lệnh dưới withdrawable nhưng cộng lại vượt: đúng một lệnh được tạo 3ms
   × BE-13 ca 9: ràng buộc WithdrawRequest, bộ nhớ > một lệnh đang dở mỗi chain (activeChain); về trạng thái cuối thì nhả chỗ 11ms
   ✓ BE-13 ca 9: ràng buộc WithdrawRequest, bộ nhớ > trùng (chain, clientRequestId) và trùng txHash bị chặn; chuyển ngoài bảng bị chặn; sai from trả null 3ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      Tests  1 failed | 3 passed | 31 skipped (35)
vitest exit=1
$ git checkout -- app/src && git status --short
?? docs/CHECKPOINT_BE13.md
?? docs/CHECKPOINT_BE13_MUTATIONS_DETAIL.md
?? docs/CHECKPOINT_BE13_VERIFICATION_DETAIL.md

### Đột biến 16d
$ python3 mutate_be13.py d && git diff --stat
đã áp đột biến d
 app/src/lib/bank/vault-config.ts | 1 +
 1 file changed, 1 insertion(+)
$ (cd app && npx vitest run test/be-13-vault-config.test.ts -t "ca 3")
   ✓ BE-13 ca 3: thứ tự giao dịch theo bảng chuyển tiếp QĐ-C > dòng 1, UNSET sang PERCENT: ví nhận, setPercentRate, rồi setLockMode(PERCENT) 12ms
   ✓ BE-13 ca 3: thứ tự giao dịch theo bảng chuyển tiếp QĐ-C > dòng 2, UNSET sang FIXED: ví nhận, setFixedLock, rồi setLockMode(FIXED); không gửi tỷ lệ 2ms
   ✓ BE-13 ca 3: thứ tự giao dịch theo bảng chuyển tiếp QĐ-C > dòng 3, PERCENT sang FIXED: setFixedLock rồi setLockMode(FIXED) 2ms
   × BE-13 ca 3: thứ tự giao dịch theo bảng chuyển tiếp QĐ-C > dòng 4, FIXED sang PERCENT: setPercentRate (khi khác) rồi setLockMode(PERCENT), KHÔNG setFixedLock(0) 10ms
   ✓ BE-13 ca 3: thứ tự giao dịch theo bảng chuyển tiếp QĐ-C > dòng 5, giữ chế độ: chỉ setter của giá trị đổi; không đổi gì thì không gửi 3ms
   ✓ BE-13 ca 3: thứ tự giao dịch theo bảng chuyển tiếp QĐ-C > lỗi ở giao dịch đổi chế độ: chế độ cũ còn nguyên, trả bước đã xong và bước lỗi; lần lưu sau chỉ gửi phần thiếu 10ms
   ✓ BE-13 ca 3: thứ tự giao dịch theo bảng chuyển tiếp QĐ-C > mỗi bước có Txn và audit ghi giá trị cũ, mới, mã giao dịch 1ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      Tests  1 failed | 6 passed | 35 skipped (42)
vitest exit=1
$ git checkout -- app/src && git status --short
?? docs/CHECKPOINT_BE13.md
?? docs/CHECKPOINT_BE13_MUTATIONS_DETAIL.md
?? docs/CHECKPOINT_BE13_VERIFICATION_DETAIL.md

### Đột biến 16e
$ python3 mutate_be13.py e && git diff --stat
đã áp đột biến e
 app/src/lib/bank/withdraw.service.ts | 5 +++++
 1 file changed, 5 insertions(+)
$ (cd app && npx vitest run test/be-13-withdraw.test.ts -t "ca 10")
   × BE-13 ca 10: mất mã giao dịch > đối soát chuyển NEEDS_REVIEW kèm đúng một ứng viên, KHÔNG tự COMPLETED, không gửi lại; lệnh mới bị chặn 32ms
   × BE-13 ca 10: mất mã giao dịch > Kiểm soát viên: mã đúng thì COMPLETED (Txn, audit đúng một lần dù gọi hai lần); mã khác bị từ chối; FAILED cần lý do 4ms
   × BE-13 ca 10: mất mã giao dịch > Kiểm soát viên đánh dấu FAILED có lý do: khoá nhả, lệnh mới tạo được 5ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
      Tests  3 failed | 32 skipped (35)
vitest exit=1
$ git checkout -- app/src && git status --short
?? docs/CHECKPOINT_BE13.md
?? docs/CHECKPOINT_BE13_MUTATIONS_DETAIL.md
?? docs/CHECKPOINT_BE13_VERIFICATION_DETAIL.md

### Đột biến 16f
$ python3 mutate_be13.py f && git diff --stat
đã áp đột biến f
 app/src/lib/bank/vault.service.ts    | 2 +-
 app/src/lib/bank/withdraw.service.ts | 2 +-
 2 files changed, 2 insertions(+), 2 deletions(-)
$ (cd app && npx vitest run test/be-13-vault-config.test.ts -t "ca 6")
   × BE-13 ca 6: khoá vận hành > hai lần lưu đồng thời: chỉ một bên gửi giao dịch, bên kia VAULT_BUSY 5022ms
   × BE-13 ca 6: khoá vận hành > đang có lệnh rút dở (khoá WITHDRAW) thì lưu cấu hình bị chặn; khoá WITHDRAW không tự hết hạn 9ms
   × BE-13 ca 6: khoá vận hành > khoá CONFIG treo quá thời gian chờ biên nhận thì được tiếp quản; chưa quá thì chặn 2ms
   ✓ BE-13 ca 6: hợp đồng khoá vận hành, bộ nhớ > một câu lấy khoá: năm lần lấy song song chỉ một lần được 1ms
   ✓ BE-13 ca 6: hợp đồng khoá vận hành, bộ nhớ > nhả theo refId: refId khác không nhả được 1ms
   ✓ BE-13 ca 6: hợp đồng khoá vận hành, bộ nhớ > chỉ khoá CONFIG treo quá mốc bị tiếp quản, và chỉ bởi lần lấy CONFIG 1ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
      Tests  3 failed | 3 passed | 36 skipped (42)
vitest exit=1
$ git checkout -- app/src && git status --short
?? docs/CHECKPOINT_BE13.md
?? docs/CHECKPOINT_BE13_MUTATIONS_DETAIL.md
?? docs/CHECKPOINT_BE13_VERIFICATION_DETAIL.md

### Đột biến 16g
$ python3 mutate_be13.py g && git diff --stat
đã áp đột biến g
 app/src/lib/ledger/mock.adapter.ts | 1 +
 1 file changed, 1 insertion(+)
$ (cd app && npx vitest run test/be-13-mock-vault.test.ts -t "bảng số")
   ✓ BE-13 ca 12: bảng số khoá: vault mock và hàm thuần khớp hợp đồng > op05: Bảng số OP-05: PERCENT 20%, mua 100, bán 40, chốt kỳ 1.000.000, rút 50%. Giá 100.000 VNDB/WPT. 9ms
   × BE-13 ca 12: bảng số khoá: vault mock và hàm thuần khớp hợp đồng > rounding-pending: Làm tròn xuống như Math.mulDiv, netProceeds chặn ở 0 khi bán theo giá cao hơn, FIXED đổi sang PERCENT trước kỳ đầu, tỷ lệ chờ sau kỳ đầu, khoá vượt số dư. 9ms
   ✓ BE-13 ca 12: bảng số khoá: vault mock và hàm thuần khớp hợp đồng > mulDivFloor giữ tích đầy đủ như Math.mulDiv (số lớn, ca 10 của SC-07) 0ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      Tests  1 failed | 2 passed | 8 skipped (11)
vitest exit=1
$ git checkout -- app/src && git status --short
?? docs/CHECKPOINT_BE13.md
?? docs/CHECKPOINT_BE13_MUTATIONS_DETAIL.md
?? docs/CHECKPOINT_BE13_VERIFICATION_DETAIL.md

```
