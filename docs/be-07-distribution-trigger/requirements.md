# BE-07 — Tự động chia lợi nhuận khi vault nhận tiền

| | |
|---|---|
| Nhánh | `feat/distribution-trigger`, từ `dev` sau khi BE-06 đã merge |
| Điểm | 8 |
| Mức kiểm chứng | **Cao** (tự động chuyển tiền cho nhà đầu tư, không có người bấm nút) |

## Mục tiêu

Theo phương án vault đã chốt: **vault chia lợi nhuận chỉ nhận tiền vào, không ai rút được, và tiền vào là trigger để chia cho toàn bộ nhà đầu tư**.

BE-06 đã có nghiệp vụ mở kỳ và chia theo lô, nhưng phải có người gọi. Task này làm phần tự động: phát hiện tiền vào, mở kỳ, chia hết, và chạy lại khi lỗi.

## Hai ràng buộc kỹ thuật phải hiểu trước khi làm

**1. Hợp đồng trên chuỗi không tự chạy được.** Nhận token không kích hoạt được mã trong hợp đồng nhận (token ERC-20 chỉ cập nhật bảng số dư). Cho dù SPV gọi một hàm nạp tiền, việc chia cho hàng trăm ví **không thể nằm trong cùng một giao dịch** vì vượt giới hạn tài nguyên. Vì vậy vẫn cần **một tiến trình ngoài chuỗi** làm nhiệm vụ phát hiện và kích hoạt. "Tự động" nghĩa là không cần người bấm, không phải là hợp đồng tự chạy.

**2. Chưa có Indexer.** IN-01 và IN-02 chưa làm, nên chưa đọc được sự kiện on-chain. Task này phát hiện tiền vào bằng cách **hỏi định kỳ số dư vault** rồi so với mốc đã xử lý. Khi Indexer xong thì chuyển sang đọc sự kiện; để lại `@pending IN-02` ở chỗ tương ứng.

## Việc cần làm

1. `lib/bank/distribution-trigger.service.ts` với một hàm chạy một vòng: phát hiện, mở kỳ, chia, kết thúc.
2. **Phát hiện tiền vào**: đọc `profitPoolBalance`, so với mốc số dư đã xử lý lưu trong tham số hệ thống, khóa `distribution.last_settled_balance`. Số dư tăng thì có tiền mới.
3. **Mỗi lần tiền vào là một kỳ mới.** Mã kỳ sinh tự động theo mốc thời gian phát hiện cộng số thứ tự trong ngày, để hai lần nạp cùng ngày không trùng mã.
4. **Chống chạy trùng** bằng `IKeeperStore`: `startRun(jobName, periodKey)` trước khi làm; ràng buộc duy nhất `(jobName, periodKey)` trong cơ sở dữ liệu là trọng tài. Không dựa vào kiểm tra trong mã.
5. **Mở kỳ và chia** bằng cách gọi lại nghiệp vụ BE-06, KHÔNG viết lại logic chia.
6. **Chia hết trong nhiều vòng**: một vòng chạy chia tối đa số lô cấu hình được, khóa `distribution.max_batches_per_run`, mặc định 5. Còn ví chưa nhận thì để vòng sau, không chạy vô hạn trong một lần.
7. **Cập nhật mốc số dư** chỉ khi kỳ đã chia xong toàn bộ. Chia dở thì giữ mốc cũ để vòng sau tiếp tục đúng kỳ đó, không mở kỳ mới.
8. **Ghi kết quả mỗi vòng** vào `IKeeperStore`: thành công, thất bại, số lô đã chia, số ví còn lại, thông báo lỗi.
9. **Cảnh báo**: khi một kỳ chưa chia xong sau số vòng cấu hình được, hoặc một lô lỗi liên tiếp quá số lần cấu hình được, ghi bản ghi cảnh báo và ghi sổ kiểm toán. Khóa `distribution.stuck_after_runs`, mặc định 3.
10. **Kích hoạt tay có kiểm soát**: một hàm cho phép chạy một vòng ngay, yêu cầu quyền `distribution:execute`, dùng khi tiến trình định kỳ trượt lịch.
11. Điểm vào cho tiến trình định kỳ: một route handler nhận yêu cầu chạy một vòng, bảo vệ bằng khóa bí mật đọc từ biến môi trường. Không mở công khai.
12. Gắn `@flow distribute:<n>` nối tiếp luồng BE-06, `@pending FE-08` cho phần hiển thị lịch chạy, `@pending IN-02` cho việc chuyển sang đọc sự kiện. Gỡ `@pending BE-07` ở `lib/store/index.ts` và `purchase.service.ts`.

## Ràng buộc

- Chạy hai vòng cùng lúc cho cùng một kỳ: vòng thứ hai PHẢI dừng ngay, không chia trùng.
- Tiến trình dừng giữa chừng: vòng sau PHẢI tiếp tục đúng kỳ đang dở, không mở kỳ mới, không chia lại ví đã nhận.
- Vault không đủ tiền so với tổng phần chia: PHẢI dừng và cảnh báo, KHÔNG chia một phần rồi bỏ dở.
- Mốc số dư PHẢI chỉ tăng. Số dư giảm (không nên xảy ra vì vault không cho rút) PHẢI ghi cảnh báo và dừng, vì đó là dấu hiệu bất thường.
- Không tự ý mở kỳ khi số dư tăng do **phần dư làm tròn** của kỳ trước còn lại. Xử lý bằng cách so với ngưỡng tối thiểu, khóa `distribution.min_new_balance`.

## Tác động

| | Tệp |
|---|---|
| Mới | `lib/bank/distribution-trigger.service.ts`, `app/api/keeper/distribution/route.ts`, `app/actions/distribution.ts` (thêm hàm kích hoạt tay), `app/test/distribution-trigger.test.ts` |
| Sửa | `lib/store/index.ts` và `lib/bank/purchase.service.ts` (gỡ marker), nơi khai mặc định tham số, `lib/config/env.ts` (khóa bí mật cho route) |
| Đọc, không sửa | `lib/bank/distribution.service.ts`, `lib/store/keeper.store.port.ts`, `lib/store/distribution.store.port.ts` |
| Test bị ảnh hưởng | `distribution-service`, `config-service`, `env-private-key` (nếu thêm biến môi trường) |

Đo bằng:

```
grep -rn "@pending BE-07" app/src
grep -E "^  [a-zA-Z]+\(" app/src/lib/store/keeper.store.port.ts
grep -n "@@unique" -B12 app/prisma/schema.prisma | grep -A1 "model KeeperRun"
```

## Mức kiểm chứng: Cao

Trong lúc làm:

```
cd app && npx vitest run test/distribution-trigger.test.ts
cd app && npx vitest run test/distribution-service.test.ts test/config-service.test.ts
```

Cuối task: `bash scripts/run-local-all.sh` một lần.

Ca kiểm thử:

| Ca | Kiểm |
|---|---|
| 1 | Số dư không tăng: không mở kỳ, không chia, ghi một vòng chạy không có việc |
| 2 | Số dư tăng: mở đúng một kỳ, chia hết, cập nhật mốc số dư |
| 3 | Nhiều ví hơn số lô cho phép mỗi vòng: vòng một chia dở, mốc **không** đổi; vòng hai chia tiếp đúng kỳ đó |
| 4 | Chia xong toàn bộ mới cập nhật mốc số dư |
| 5 | Số dư tăng dưới ngưỡng tối thiểu: không mở kỳ mới |
| 6 | Số dư giảm: dừng, ghi cảnh báo |
| 7 | Kỳ chưa xong sau số vòng cấu hình: ghi cảnh báo và có bản ghi kiểm toán |
| 8 | Kích hoạt tay: vai không có `distribution:execute` bị chặn |
| 9 | Route handler không có khóa bí mật đúng: từ chối |

Đột biến, **chỉ hai chỗ**:

- **Hai vòng chạy đồng thời cùng một kỳ**: chỉ một vòng chia, vòng còn lại dừng, tổng tiền đã chia không vượt tổng tiền kỳ.
- **Một lô ném lỗi giữa chừng**: mốc số dư không đổi, ví trong lô đó không bị đánh dấu đã nhận, vòng sau chia đúng cho họ.

## Điều kiện hoàn thành

- [ ] Số dư tăng thì tự mở kỳ và chia, không cần người bấm.
- [ ] Mốc số dư chỉ cập nhật khi kỳ đã chia xong toàn bộ.
- [ ] Chia dở thì vòng sau tiếp tục đúng kỳ đang dở, không mở kỳ mới.
- [ ] Hai vòng đồng thời không chia trùng.
- [ ] Lô lỗi không đánh dấu nhầm, chạy lại chia đúng cho ví còn thiếu.
- [ ] Số dư tăng dưới ngưỡng tối thiểu thì không mở kỳ.
- [ ] Số dư giảm thì dừng và cảnh báo.
- [ ] Kỳ treo quá số vòng cấu hình thì có cảnh báo và bản ghi kiểm toán.
- [ ] Route handler chỉ chạy khi có khóa bí mật đúng.
- [ ] Mọi tham số (số lô mỗi vòng, ngưỡng tối thiểu, số vòng treo) đọc từ tham số hệ thống, không viết cứng.
- [ ] `run-local-all.sh` xanh.

## Không làm

- Không viết lại logic chia. Gọi lại nghiệp vụ BE-06.
- Không dùng kiểm tra trong mã để chống chạy trùng. Dùng ràng buộc duy nhất của cơ sở dữ liệu.
- Không cập nhật mốc số dư khi kỳ chưa chia xong.
- Không chia một phần rồi bỏ dở khi vault thiếu tiền.
- Không chạy vòng lặp vô hạn trong một lần chạy.
- Không dựng bộ hẹn giờ bên trong ứng dụng. Điểm vào là route handler; việc gọi định kỳ do hạ tầng ngân hàng lo.
- Không mở route handler công khai.
- Không làm phần quản trị vault nhận tiền nhà đầu tư (rút theo phần trăm). Việc đó thuộc task hợp đồng và một task backend riêng.
- Không làm giao diện.
