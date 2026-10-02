<!-- SINH TỰ ĐỘNG TỪ MARKER — ĐỪNG SỬA TAY -->

# Luồng `purchase` — Nhà đầu tư mua WPT

> **Tệp này do `scripts/gen-flow-diagram.mjs` sinh ra từ marker `@flow` trong mã nguồn.**
> Sửa tay sẽ bị ghi đè ở lần sinh sau, và trong khoảng thời gian trước đó thì sơ đồ nói một
> đằng còn mã làm một nẻo. Muốn đổi nội dung thì sửa marker trong mã rồi sinh lại.
>
> - Sinh lại: `node scripts/gen-flow-diagram.mjs purchase`
> - Kiểm tệp này còn khớp marker hay không: `node scripts/gen-flow-diagram.mjs purchase --check`
> - Quy ước marker: `.kiro/steering/make-control.md` mục 4

**12 bước**, gắn ở 3 tệp:

- `app/src/app/actions/purchase.ts`
- `app/src/lib/bank/purchase.service.ts`
- `app/src/lib/ledger/ledger.port.ts`

## Sơ đồ

```mermaid
flowchart TD
  s1["1 · previewPurchaseAction()<br/>app/src/app/actions/purchase.ts<br/>nhận yêu cầu xem trước điều kiện mua, trước khi có lệnh nào"]
  s2["2 · previewPurchase()<br/>app/src/lib/bank/purchase.service.ts<br/>kiểm quyền order:place, báo giá, chạy bộ kiểm, KHÔNG ghi gì vào cơ sở dữ liệu"]
  s3["3 · placeOrderAction()<br/>app/src/app/actions/purchase.ts<br/>một trong hai đường vận chuyển: nhận yêu cầu đặt lệnh; đường kia là POST /api/purchase"]
  s4["4 · placeOrder()<br/>app/src/lib/bank/purchase.service.ts<br/>validate Zod, kiểm quyền order:place, kiểm điều kiện, lưu lệnh PLACED kèm chiều mua hoặc bán"]
  s5["5 · quotePurchase()<br/>app/src/lib/ledger/ledger.port.ts<br/>chốt số VNDB phải trả, tính một lần tại lúc đặt lệnh"]
  s6["6 · executeOrderAction()<br/>app/src/app/actions/purchase.ts<br/>một trong hai đường vận chuyển: nhận yêu cầu khớp lệnh; đường kia là POST /api/purchase có…"]
  s7["7 · executeOrder()<br/>app/src/lib/bank/purchase.service.ts<br/>kiểm quyền order:execute, PLACED sang CHECKING, chiếm EXECUTING chống gửi hai lần"]
  s8["8 · runOrderChecks()<br/>app/src/lib/bank/purchase.service.ts<br/>kiểm giá đã chốt rồi các phép đọc theo chiều lệnh (mua bốn, bán ba), dừng ở lần trượt đầu tiên"]
  s9["9 · sendAndSettle()<br/>app/src/lib/bank/purchase.service.ts<br/>gửi giao dịch mua hoặc bán theo chiều lệnh, lưu mã tx trước khi chờ, chốt COMPLETED hoặc FAILED"]
  s10["10 · executePurchase()<br/>app/src/lib/ledger/ledger.port.ts<br/>chuyển VNDB và WPT trong cùng một giao dịch"]
  s11["11 · listOrdersAction()<br/>app/src/app/actions/purchase.ts<br/>một trong hai đường vận chuyển: nhận yêu cầu xem sổ lệnh; đường kia là GET /api/purchase"]
  s12["12 · listOrders()<br/>app/src/lib/bank/purchase.service.ts<br/>kiểm order:read và order:read:all, lọc theo ví ở tầng service, lọc thêm chiều, mã lệnh, khoảng…"]
  w1(["điểm cắm, chờ FE-06<br/>đã sẵn đầu cuối ở executeOrder: kiểm quyền order:execute (vai…"])
  s1 --> s2
  s2 --> s3
  s3 --> s4
  s4 --> s5
  s5 --> s6
  s6 --> s7
  s7 --> s8
  s8 --> s9
  s9 --> s10
  s10 --> s11
  s11 --> s12
  w1 -.-> s6
```

## Bảng bước

| Bước | Tệp | Hàm | Việc |
|---|---|---|---|
| 1 | `app/src/app/actions/purchase.ts:38` | `previewPurchaseAction()` | nhận yêu cầu xem trước điều kiện mua, trước khi có lệnh nào |
| 2 | `app/src/lib/bank/purchase.service.ts:148` | `previewPurchase()` | kiểm quyền order:place, báo giá, chạy bộ kiểm, KHÔNG ghi gì vào cơ sở dữ liệu |
| 3 | `app/src/app/actions/purchase.ts:45` | `placeOrderAction()` | một trong hai đường vận chuyển: nhận yêu cầu đặt lệnh; đường kia là POST /api/purchase |
| 4 | `app/src/lib/bank/purchase.service.ts:196` | `placeOrder()` | validate Zod, kiểm quyền order:place, kiểm điều kiện, lưu lệnh PLACED kèm chiều mua hoặc bán |
| 5 | `app/src/lib/ledger/ledger.port.ts:115` | `quotePurchase()` | chốt số VNDB phải trả, tính một lần tại lúc đặt lệnh |
| 6 | `app/src/app/actions/purchase.ts:52` | `executeOrderAction()` | một trong hai đường vận chuyển: nhận yêu cầu khớp lệnh; đường kia là POST /api/purchase có orderId |
| 7 | `app/src/lib/bank/purchase.service.ts:653` | `executeOrder()` | kiểm quyền order:execute, PLACED sang CHECKING, chiếm EXECUTING chống gửi hai lần |
| 8 | `app/src/lib/bank/purchase.service.ts:406` | `runOrderChecks()` | kiểm giá đã chốt rồi các phép đọc theo chiều lệnh (mua bốn, bán ba), dừng ở lần trượt đầu tiên |
| 9 | `app/src/lib/bank/purchase.service.ts:766` | `sendAndSettle()` | gửi giao dịch mua hoặc bán theo chiều lệnh, lưu mã tx trước khi chờ, chốt COMPLETED hoặc FAILED |
| 10 | `app/src/lib/ledger/ledger.port.ts:151` | `executePurchase()` | chuyển VNDB và WPT trong cùng một giao dịch |
| 11 | `app/src/app/actions/purchase.ts:60` | `listOrdersAction()` | một trong hai đường vận chuyển: nhận yêu cầu xem sổ lệnh; đường kia là GET /api/purchase |
| 12 | `app/src/lib/bank/purchase.service.ts:904` | `listOrders()` | kiểm order:read và order:read:all, lọc theo ví ở tầng service, lọc thêm chiều, mã lệnh, khoảng ngày |

## Điểm cắm trên đường đi

Các bước dưới đây có marker chờ task khác. Trong sơ đồ chúng là ô bầu dục nối bằng
mũi tên gạch rời — chúng **không** phải bước của luồng.

| Bước | Loại | Task | Nội dung marker |
|---|---|---|---|
| 6 | điểm cắm | `FE-06` | đã sẵn đầu cuối ở `executeOrder`: kiểm quyền `order:execute` (vai TELLER), bốn phép đọc trước khi gửi, khoá lạc quan chống gửi hai lần, đọc lại số dư từ chuỗi sau biên nhận |

## Đọc sơ đồ này thế nào

- **Mũi tên liền là thứ tự nghiệp vụ, không phải cạnh gọi hàm.** Quy ước cho mỗi bước đúng
  một số nguyên liên tiếp, nên nó biểu diễn được một chuỗi thời gian chứ không biểu diễn
  được lồng nhau hay đường về. Ví dụ một hàm gọi hàm sau nó rồi nhận kết quả về thì trên sơ
  đồ chỉ thấy mũi tên đi, không thấy mũi tên về.
- **Ô bầu dục nối bằng mũi tên gạch rời không phải bước của luồng.** Đó là marker
  `@pending` / `@blocked` nằm trên đúng hàm của bước đó: một task khác còn phải gọi vào,
  hoặc còn phải xong trước.
- **Bước ở `ledger.port.ts` là cổng, không phải adapter.** Adapter thật (`mock`, `evm`,
  `stellar`) do `getLedger(chain)` chọn lúc chạy theo cấu hình, nên không cạnh gọi tĩnh
  nào nối được cổng với adapter (design.md QĐ-6). Sơ đồ dừng ở cổng là dừng ở chỗ còn nói
  thật được.
- **Nhánh phụ và nhánh song song không có trên sơ đồ.** Một chuỗi số nguyên không có chỗ
  cho hai đường vào cùng một bước, cũng không có chỗ cho nhánh chạy ngoài chuỗi. Những chỗ
  như vậy được nhắc trong nhãn của bước liên quan hoặc trong bình luận tại tệp bị bỏ ra.
