# FE-08: chi tiết đột biến (ca 14)

Đầu ra của từng đột biến: áp bằng `mutate_fe08.py` (thay đúng chỗ như bảng dưới), chạy đúng ca cần đỏ,
hoàn nguyên bằng `git checkout -- app/src`, rồi `git status --short` (rỗng là sạch). Chạy trên commit
`174ff9e`. Dòng `vitest exit=1` là mã thoát của vitest: có ca đỏ.

| Đột biến | Thay đổi | Ca phải đỏ | Kết quả |
|---|---|---|---|
| 14a | bỏ so `expectedAmount` với phần chưa phân bổ ở bước 3 | 3 | đỏ "từ chối số trong quỹ đã đổi" |
| 14b | `decideApproval` coi mọi số thực tế là khớp | 4 | đỏ ca 4 |
| 14c | lõi chia cho qua khi vault `SENT_PENDING` | 5 | đỏ "SENT" |
| 14d | keeper mở kỳ khi có tiền chưa duyệt | 6 | đỏ "có tiền chưa duyệt" |
| 14e | bỏ ràng buộc `activeChain` ở bản bộ nhớ | 7 | đỏ "hai mã kỳ khác ngày UTC" |
| 14f | cấp `distribution:approve` cho `TELLER` | 1 | đỏ bốn ca (TELLER, vai lạ quy về TELLER, đọc của TELLER, tổng quan) |

```text
### Đột biến 14a
$ python3 mutate_fe08.py a && git diff --stat
đã áp đột biến 14a
 app/src/lib/bank/distribution-approval.service.ts | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
$ (cd app && npx vitest run test/fe-08-approval.test.ts -t "FE-08 ca 3")
   × FE-08 ca 3: số trong quỹ đổi trước khi duyệt > từ chối "số trong quỹ đã đổi", không gửi giao dịch, không tạo kỳ, sổ kiểm toán ghi mã người 23ms
   ✓ FE-08 ca 3: số trong quỹ đổi trước khi duyệt > dưới ngưỡng thì từ chối, không gửi gì 2ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      Tests  1 failed | 1 passed | 28 skipped (30)
vitest exit=1
$ git checkout -- app/src && git status --short

### Đột biến 14b
$ python3 mutate_fe08.py b && git diff --stat
đã áp đột biến 14b
 app/src/lib/bank/distribution.service.ts | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
$ (cd app && npx vitest run test/fe-08-approval.test.ts -t "FE-08 ca 4")
   × FE-08 ca 4: số đổi trong lúc mở kỳ (chen tiền) > AMOUNT_CHANGED, không chốt vault, không lô; duyệt lại số sai bị từ chối; đúng số thì chốt vault và chia 61ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      Tests  1 failed | 29 skipped (30)
vitest exit=1
$ git checkout -- app/src && git status --short

### Đột biến 14c
$ python3 mutate_fe08.py c && git diff --stat
đã áp đột biến 14c
 app/src/lib/bank/distribution.service.ts | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
$ (cd app && npx vitest run test/fe-08-approval.test.ts -t "FE-08 ca 5")
   ✓ FE-08 ca 5: vault PENDING, SENT, CONFLICT không có lô nào > PENDING: không lô, số dư không đổi; tiếp tục thì chốt rồi chia 29ms
   × FE-08 ca 5: vault PENDING, SENT, CONFLICT không có lô nào > SENT: không lô; đối soát xong thì tiếp tục được, không gửi chốt lần hai 14ms
   ✓ FE-08 ca 5: vault PENDING, SENT, CONFLICT không có lô nào > CONFLICT: không lô, khoá nút ("cần xử lý tay"), tiếp tục vẫn không trả 4ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      Tests  1 failed | 2 passed | 27 skipped (30)
vitest exit=1
$ git checkout -- app/src && git status --short

### Đột biến 14d
$ python3 mutate_fe08.py d && git diff --stat
đã áp đột biến 14d
 app/src/lib/bank/distribution-trigger.service.ts | 4 ++++
 1 file changed, 4 insertions(+)
$ (cd app && npx vitest run test/fe-08-approval.test.ts -t "FE-08 ca 6")
   × FE-08 ca 6: keeper chỉ tiếp tục kỳ đã duyệt > có tiền chưa duyệt: AWAITING_APPROVAL, không mở kỳ, không gửi gì 31ms
   ✓ FE-08 ca 6: keeper chỉ tiếp tục kỳ đã duyệt > kỳ AMOUNT_CHANGED: AWAITING_APPROVAL, không trả 4ms
   ✓ FE-08 ca 6: keeper chỉ tiếp tục kỳ đã duyệt > kỳ APPROVED còn lô: keeper tiếp tục, triggerSource KEEPER 16ms
   ✓ FE-08 ca 6: keeper chỉ tiếp tục kỳ đã duyệt > expire-orders không đổi: vẫn chạy qua route với vai mặc định 1ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      Tests  1 failed | 3 passed | 26 skipped (30)
vitest exit=1
$ git checkout -- app/src && git status --short

### Đột biến 14e
$ python3 mutate_fe08.py e && git diff --stat
đã áp đột biến 14e
 app/src/lib/store/memory.distribution.store.ts | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
$ (cd app && npx vitest run test/fe-08-approval.test.ts -t "FE-08 ca 7")
   × FE-08 ca 7: cạnh tranh trên bản bộ nhớ > hai lần duyệt sinh hai mã kỳ khác ngày UTC: chỉ một kỳ hoạt động, không ai nhận hai lần 36ms
   ✓ FE-08 ca 7: cạnh tranh trên bản bộ nhớ > hai Kiểm soát viên duyệt cùng lúc với hai số khác nhau: số sai bị từ chối, một kỳ 3ms
   ✓ FE-08 ca 7: cạnh tranh trên bản bộ nhớ > Kiểm soát viên duyệt đồng thời với keeper: một kỳ, không ai nhận hai lần 4ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      Tests  1 failed | 2 passed | 27 skipped (30)
vitest exit=1
$ git checkout -- app/src && git status --short

### Đột biến 14f
$ python3 mutate_fe08.py f && git diff --stat
đã áp đột biến 14f
 app/src/lib/rbac/permissions.ts | 1 +
 1 file changed, 1 insertion(+)
$ (cd app && npx vitest run test/fe-08-approval.test.ts -t "FE-08 ca 1")
   ✓ FE-08 ca 12: mock cho cùng số với bảng OP-05 > duyệt 1.000.000: APPROVED, vault DONE, DISTRIBUTED; nhà đầu tư nhận 60, vault 999.940, percentLocked 200.000 33ms
   × FE-08 ca 1: chỉ CONTROLLER duyệt, duyệt lại, tiếp tục; hai vai vận hành đọc được > vai TELLER: FORBIDDEN cả ba hành động, không gửi gì 13ms
   ✓ FE-08 ca 1: chỉ CONTROLLER duyệt, duyệt lại, tiếp tục; hai vai vận hành đọc được > vai SELLER: FORBIDDEN cả ba hành động, không gửi gì 3ms
   ✓ FE-08 ca 1: chỉ CONTROLLER duyệt, duyệt lại, tiếp tục; hai vai vận hành đọc được > vai INVESTOR: FORBIDDEN cả ba hành động, không gửi gì 2ms
   × FE-08 ca 1: chỉ CONTROLLER duyệt, duyệt lại, tiếp tục; hai vai vận hành đọc được > vai UNKNOWN_ROLE: FORBIDDEN cả ba hành động, không gửi gì 4ms
   ✓ FE-08 ca 1: chỉ CONTROLLER duyệt, duyệt lại, tiếp tục; hai vai vận hành đọc được > bốn action cũ không còn trong actions/distribution.ts; action mới có mặt 1ms
   × FE-08 ca 1: chỉ CONTROLLER duyệt, duyệt lại, tiếp tục; hai vai vận hành đọc được > vai TELLER đọc được tổng quan, danh sách kỳ, hồ sơ, lịch chạy 9ms
   ✓ FE-08 ca 1: chỉ CONTROLLER duyệt, duyệt lại, tiếp tục; hai vai vận hành đọc được > vai CONTROLLER đọc được tổng quan, danh sách kỳ, hồ sơ, lịch chạy 3ms
   ✓ FE-08 ca 1: chỉ CONTROLLER duyệt, duyệt lại, tiếp tục; hai vai vận hành đọc được > vai SELLER không đọc được màn chia 1ms
   ✓ FE-08 ca 1: chỉ CONTROLLER duyệt, duyệt lại, tiếp tục; hai vai vận hành đọc được > vai INVESTOR không đọc được màn chia 1ms
   ✓ FE-08 ca 1: chỉ CONTROLLER duyệt, duyệt lại, tiếp tục; hai vai vận hành đọc được > đường cũ của Giao dịch viên không chia được kỳ chưa duyệt (lõi chặn) 2ms
   × FE-08 ca 10: API đọc > dự kiến bằng shareOf trên số dư hiện tại, có ví được 0; danh sách bị cắt thì khoá 6ms
   ✓ FE-08 ca 10: API đọc > danh sách hồ sơ phân trang không thiếu ví, gồm ví được 0; lịch sử đúng người duyệt, số, nguồn 4ms
   ✓ FE-08 ca 11: chain không có vault (stellar) > nút duyệt bị vô hiệu (lý do trên tổng quan) và service từ chối, không gửi gì 2ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯
      Tests  4 failed | 10 passed | 16 skipped (30)
vitest exit=1
$ git checkout -- app/src && git status --short

```
