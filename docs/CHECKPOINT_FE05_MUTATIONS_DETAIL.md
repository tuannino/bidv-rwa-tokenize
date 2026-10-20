# FE-05: chi tiết đột biến (ca 15)

Đầu ra nguyên văn của từng đột biến: áp bằng `mutate_fe05.py` (thay đúng một chỗ như bảng dưới), chạy
đúng ca cần đỏ, hoàn nguyên bằng `git checkout -- app/src`, rồi `git status --short` (rỗng là sạch).
Chạy trên mã của commit `3078d63` (mã không đổi sau đó). 15c và 15d chạy trên nút Hardhat dựng lại cho
từng đột biến. Dòng `vitest exit=1` là mã thoát của vitest: có ca đỏ.

| Đột biến | Thay đổi | Ca phải đỏ | Kết quả |
|---|---|---|---|
| 15a | bỏ so địa chỉ khôi phục với ví đặt lệnh (`recoverTypedDataAddress` thay `verifyTypedData`) | 2 | đỏ 4 biến thể của ca 2 |
| 15b | bỏ phép so `permit.value` với số lệnh tính lại | 2 hoặc 3 | đỏ ca 3 và biến thể "value khác số lệnh" của ca 2 |
| 15c | adapter luôn gọi `buy`/`sell`, bỏ qua `permit` | 4 | đỏ ca 4 (`FAILED` thay `COMPLETED`) |
| 15d | QĐ-G coi ủy quyền đạt chỉ vì lệnh CÓ chữ ký | 7b hoặc 8 | đỏ ca 8 (`LEDGER` thay `INSUFFICIENT_ALLOWANCE`) |
| 15e | `placeOrder` cho đi tiếp khi thiếu `permit` trên chain thật | 9 | đỏ ca 9 |
| 15f | kiểm chữ ký bằng nonce HIỆN TẠI thay vì nonce đã ký | 6a | đỏ ca 6a (kèm 7a, nonce lớn hơn, gửi lại) |

15b đỏ ở ca 3 vì sai lý do chứ không vì lệnh lọt: bỏ phép so `value` thì typed data vẫn dựng bằng số
tính lại, nên chữ ký vẫn bị từ chối ở bước kiểm chữ ký, chỉ với câu "chữ ký không khớp".

```text
### Đột biến 15a
$ python3 mutate_fe05.py a && git diff --stat
đã áp đột biến a
 app/src/lib/bank/permit.ts | 8 ++++----
 1 file changed, 4 insertions(+), 4 deletions(-)
$ (cd app && npx vitest run test/fe-05-permit-order.test.ts -t "FE-05 ca 2")
   ✓ FE-05 ca 2: kiểm chữ ký khi đặt lệnh > chữ ký đúng tạo lệnh, lưu chữ ký và khớp bằng buyWithPermit 98ms
   × FE-05 ca 2: kiểm chữ ký khi đặt lệnh > chữ ký của ví khác: VALIDATION, số bản ghi lệnh không đổi 36ms
     → expected { ok: true, data: { …(13) } } to match object { ok: false, code: 'VALIDATION' }
   ✓ FE-05 ca 2: kiểm chữ ký khi đặt lệnh > value khác số lệnh: VALIDATION, số bản ghi lệnh không đổi 6ms
   ✓ FE-05 ca 2: kiểm chữ ký khi đặt lệnh > nonce trong payload khác nonce đã ký: VALIDATION, số bản ghi lệnh không đổi 10ms
   × FE-05 ca 2: kiểm chữ ký khi đặt lệnh > deadline khác số đã ký: VALIDATION, số bản ghi lệnh không đổi 15ms
     → expected { ok: true, data: { …(13) } } to match object { ok: false, code: 'VALIDATION' }
   × FE-05 ca 2: kiểm chữ ký khi đặt lệnh > ký cho spender khác: VALIDATION, số bản ghi lệnh không đổi 11ms
     → expected { ok: true, data: { …(13) } } to match object { ok: false, code: 'VALIDATION' }
   × FE-05 ca 2: kiểm chữ ký khi đặt lệnh > ký trên token khác (domain ProjectToken cho lệnh mua): VALIDATION, số bản ghi lệnh không đổi 11ms
     → expected { ok: true, data: { …(13) } } to match object { ok: false, code: 'VALIDATION' }
   ✓ FE-05 ca 2: kiểm chữ ký khi đặt lệnh > chữ ký sai khuôn: VALIDATION, số bản ghi lệnh không đổi 4ms
   ✓ FE-05 ca 2: kiểm chữ ký khi đặt lệnh > payload có trường lạ: VALIDATION, số bản ghi lệnh không đổi 4ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯
      Tests  4 failed | 5 passed | 16 skipped (25)
vitest exit=1
$ git checkout -- app/src && git status --short

### Đột biến 15b
$ python3 mutate_fe05.py b && git diff --stat
đã áp đột biến b
 app/src/lib/bank/purchase.service.ts | 1 -
 1 file changed, 1 deletion(-)
$ (cd app && npx vitest run test/fe-05-permit-order.test.ts -t "FE-05 ca 2|FE-05 ca 3")
   ✓ FE-05 ca 2: kiểm chữ ký khi đặt lệnh > chữ ký đúng tạo lệnh, lưu chữ ký và khớp bằng buyWithPermit 77ms
   ✓ FE-05 ca 2: kiểm chữ ký khi đặt lệnh > chữ ký của ví khác: VALIDATION, số bản ghi lệnh không đổi 10ms
   × FE-05 ca 2: kiểm chữ ký khi đặt lệnh > value khác số lệnh: VALIDATION, số bản ghi lệnh không đổi 28ms
     → expected { ok: true, data: { …(16) } } to match object { ok: false, code: 'VALIDATION' }
   ✓ FE-05 ca 2: kiểm chữ ký khi đặt lệnh > nonce trong payload khác nonce đã ký: VALIDATION, số bản ghi lệnh không đổi 10ms
   ✓ FE-05 ca 2: kiểm chữ ký khi đặt lệnh > deadline khác số đã ký: VALIDATION, số bản ghi lệnh không đổi 10ms
   ✓ FE-05 ca 2: kiểm chữ ký khi đặt lệnh > ký cho spender khác: VALIDATION, số bản ghi lệnh không đổi 8ms
   ✓ FE-05 ca 2: kiểm chữ ký khi đặt lệnh > ký trên token khác (domain ProjectToken cho lệnh mua): VALIDATION, số bản ghi lệnh không đổi 7ms
   ✓ FE-05 ca 2: kiểm chữ ký khi đặt lệnh > chữ ký sai khuôn: VALIDATION, số bản ghi lệnh không đổi 4ms
   ✓ FE-05 ca 2: kiểm chữ ký khi đặt lệnh > payload có trường lạ: VALIDATION, số bản ghi lệnh không đổi 5ms
   × FE-05 ca 3: giá đổi giữa chuẩn bị và đặt lệnh > ký theo 100.000, giá thành 110.000: từ chối "giá đã đổi..., ký lại", không tạo lệnh 9ms
     → expected 'Chữ ký không khớp ví hoặc nội dung lệ…' to match /giá đã đổi.*ký lại/i
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
      Tests  2 failed | 8 passed | 15 skipped (25)
vitest exit=1
$ git checkout -- app/src && git status --short

### Đột biến 15c
$ python3 mutate_fe05.py c && git diff --stat
đã áp đột biến c
 app/src/lib/ledger/evm.adapter.ts | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
$ bash scripts/evm-local.sh reset
exit=0
$ (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/fe-05-permit-evm.test.ts -t "ca 4")
   × FE-05: chữ ký permit trên nút Hardhat thật > ca 4: mua không cần approve: ký, COMPLETED, số dư đúng, giao dịch là buyWithPermit 1370ms
     → expected 'FAILED' to be 'COMPLETED' // Object.is equality
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      Tests  1 failed | 7 skipped (8)
vitest exit=1
$ git checkout -- app/src && git status --short

### Đột biến 15d
$ python3 mutate_fe05.py d && git diff --stat
đã áp đột biến d
 app/src/lib/bank/purchase.service.ts | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
$ bash scripts/evm-local.sh reset
exit=0
$ (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/fe-05-permit-evm.test.ts -t "ca 8")
   × FE-05: chữ ký permit trên nút Hardhat thật > ca 8: phục hồi EXECUTING mất mã dùng chữ ký đã lưu; quá hạn và ủy quyền 0 thì ký lại 1536ms
     → expected 'LEDGER' to be 'INSUFFICIENT_ALLOWANCE' // Object.is equality
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      Tests  1 failed | 7 skipped (8)
vitest exit=1
$ git checkout -- app/src && git status --short

### Đột biến 15e
$ python3 mutate_fe05.py e && git diff --stat
đã áp đột biến e
 app/src/lib/bank/purchase.service.ts | 5 ++---
 1 file changed, 2 insertions(+), 3 deletions(-)
$ (cd app && npx vitest run test/fe-05-permit-order.test.ts -t "FE-05 ca 9")
   × FE-05 ca 9: cổng công khai trên chain thật bắt buộc chữ ký > server action và POST /api/purchase không permit: VALIDATION kể cả khi đã approve đủ 97ms
     → expected { ok: true, data: { …(16) } } to match object { ok: false, code: 'VALIDATION' }
   ✓ FE-05 ca 9: cổng công khai trên chain thật bắt buộc chữ ký > gửi permit trên mock: VALIDATION, không tạo lệnh 6ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      Tests  1 failed | 1 passed | 23 skipped (25)
vitest exit=1
$ git checkout -- app/src && git status --short

### Đột biến 15f
$ python3 mutate_fe05.py f && git diff --stat
đã áp đột biến f
 app/src/lib/bank/purchase.service.ts | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
$ (cd app && npx vitest run test/fe-05-permit-order.test.ts -t "FE-05 ca 6a")
   × FE-05 ca 6a, 7a: phân loại nonce > 6a: chữ ký đã bị gửi trước nhưng ủy quyền đủ: nhận, lệnh COMPLETED 85ms
     → Chữ ký không khớp ví hoặc nội dung lệnh, ký lại.: expected false to be true // Object.is equality
   × FE-05 ca 6a, 7a: phân loại nonce > 7a: hai lệnh tuần tự ký cùng nonce, ủy quyền ban đầu 0: lệnh 2 "đã được dùng, ký lại", không bản ghi 28ms
     → expected 'Chữ ký không khớp ví hoặc nội dung lệ…' to match /đã được dùng, ký lại/
   × FE-05 ca 6a, 7a: phân loại nonce > nonce đã ký lớn hơn nonce hiện tại: "chữ ký không hợp lệ" 10ms
     → expected 'Chữ ký không khớp ví hoặc nội dung lệ…' to match /Chữ ký không hợp lệ/
   ✓ FE-05 ca 6a, 7a: phân loại nonce > chữ ký còn dưới 2 phút: "sắp hết hạn, ký lại" 9ms
   × FE-05 ca 6a, 7a: phân loại nonce > gửi lại cùng clientRequestId sau khi chữ ký đã dùng: trả lệnh cũ, không từ chối 23ms
     → expected false to be true // Object.is equality
   ✓ FE-05 ca 6a, 7a: phân loại nonce > bán: ký WPT, khớp bằng sellWithPermit, không cần approve trước 28ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯
      Tests  4 failed | 2 passed | 19 skipped (25)
vitest exit=1
$ git checkout -- app/src && git status --short

```
