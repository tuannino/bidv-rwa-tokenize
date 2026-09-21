# BE-03 — Xem trước điều kiện mua WPT

| | |
|---|---|
| Nhánh | `feat/purchase-preview`, từ `dev` sau khi MC-02 và steering `efficiency.md` đã merge |
| Điểm | 3 |
| Mức kiểm chứng | **Vừa** |

## Mục tiêu

Nhà đầu tư biết trước khi đặt lệnh mình đủ điều kiện mua chưa, thiếu gì, sửa thế nào. Hiện `runPurchaseChecks` nhận `OrderRecord`, tức phải có lệnh trong cơ sở dữ liệu mới kiểm được, nên nhà đầu tư chỉ biết thiếu điều kiện sau khi lệnh đã bị từ chối.

## Việc cần làm

1. Đổi `runPurchaseChecks` nhận tham số thuần: `{ investorWallet, wptAmount, quotedVndAmount? }`. Phép kiểm giá đổi chỉ chạy khi có `quotedVndAmount`. `executeOrder` truyền giá từ lệnh, hành vi giữ nguyên.
2. Thêm `previewPurchase`: kiểm quyền `order:place`, báo giá, gọi `runPurchaseChecks`. **Không ghi gì** vào cơ sở dữ liệu.
3. Kết quả trả về từng phép kiểm riêng: `ok`, `reason`, `howToFix`, và `actual`/`required` cho ca thiếu số dư và thiếu ủy quyền. Kèm `vndAmount`, `canPlaceOrder`, `blockers`.
4. `placeOrder` gọi phép kiểm trước khi tạo lệnh. Không đạt thì không tạo bản ghi, có ghi sổ kiểm toán.
5. Thêm `previewPurchaseAction` trong `app/actions/purchase.ts`, vỏ mỏng.
6. Gắn `@pending FE-05` cho hàm và action mới, ghi rõ FE-05 phải chống gọi dồn khi người dùng gõ số lượng.
7. Chèn hai bước xem trước vào **đầu** luồng `@flow purchase`, đánh số lại 10 bước cũ thành 3 đến 12. Sinh lại `docs/flows/purchase.md`.

`howToFix` viết cho cán bộ ngân hàng đọc, không dùng từ "allowance", "approve", "revert".

## Tác động

| | Tệp |
|---|---|
| Sửa | `app/src/lib/bank/purchase.service.ts`, `app/src/lib/bank/schemas.ts`, `app/src/app/actions/purchase.ts` |
| Bị ảnh hưởng | `app/src/app/api/purchase/route.ts` (gọi `placeOrder`, hành vi đổi ở việc 4) |
| Test | `app/test/purchase-service.test.ts` |
| Sinh lại | `docs/flows/purchase.md` |

Đo bằng: `grep -rlnE "runPurchaseChecks|placeOrder\b" app/src app/test`

## Mức kiểm chứng: Vừa

Trong lúc làm:

```
cd app && npx vitest run test/purchase-service.test.ts
node scripts/scan-pending.mjs --check
```

Cuối task: `bash scripts/run-local-all.sh` một lần.

Ca kiểm thử cần thêm:

| Ca | Kiểm |
|---|---|
| 1 | Đủ điều kiện: `canPlaceOrder` đúng, `vndAmount` khớp báo giá |
| 2 | Thiếu số dư, thiếu ủy quyền, ví SPV thiếu WPT: đúng `blockers`, không tạo lệnh |
| 3 | Xem trước không ghi gì vào cơ sở dữ liệu |
| 4 | **Cùng dữ liệu vào, xem trước và `executeOrder` trượt cùng một phép kiểm** |

Ca 4 là ca then chốt: nó giữ hai đường không lệch nhau về sau. Không cần đột biến.

## Điều kiện hoàn thành

- [ ] Xem trước trả đúng kết quả cho ví đủ điều kiện và cho ba ca thiếu điều kiện.
- [ ] Xem trước không ghi gì vào cơ sở dữ liệu.
- [ ] `placeOrder` không tạo lệnh khi thiếu điều kiện.
- [ ] Hai đường kiểm cho cùng kết quả trên cùng dữ liệu vào.
- [ ] Test BE-02 cũ vẫn xanh.
- [ ] Luồng `@flow purchase` đánh số liền mạch từ 1 đến 12, sơ đồ sinh lại được.
- [ ] `run-local-all.sh` xanh.

## Không làm

- Không viết bản logic kiểm thứ hai. Tái dùng `runPurchaseChecks`.
- Không thêm mã lỗi mới, không thêm quyền mới. Những gì cần đã có từ BE-02.
- Không đổi thông báo lỗi hiện có: test cũ bám vào.
- Không thêm bộ nhớ đệm ở tầng service. Chống gọi dồn là việc của FE-05.
- Không dùng số thập phân khi đánh số bước.
