# BE-02 — Quản lý lệnh mua WPT: design

## 1. Mô hình trạng thái

Đây là phần cần chốt trước, vì BE-09 lấy nó làm cơ sở cho bảng dữ liệu.

```
PLACED ──► CHECKING ──► EXECUTING ──► COMPLETED
   │           │            │
   │           │            └──► FAILED
   │           └──► REJECTED
   └──► EXPIRED
```

| Trạng thái | Ý nghĩa | Chuyển tiếp hợp lệ |
|---|---|---|
| `PLACED` | Nhà đầu tư đã đặt lệnh, chưa kiểm tra | `CHECKING`, `EXPIRED` |
| `CHECKING` | Đang kiểm số dư, ủy quyền, tồn WPT | `EXECUTING`, `REJECTED` |
| `EXECUTING` | Đã gửi giao dịch, đang chờ biên nhận | `COMPLETED`, `FAILED` |
| `COMPLETED` | Giao dịch xác nhận thành công | kết thúc |
| `REJECTED` | Không đạt điều kiện, **chưa gửi giao dịch** | kết thúc |
| `FAILED` | Đã gửi nhưng giao dịch thất bại | kết thúc |
| `EXPIRED` | Quá hạn chưa khớp | kết thúc |

**Không có trạng thái "đã trả tiền chưa nhận token".** Vì việc chuyển VNDB và chuyển WPT nằm trong cùng một giao dịch, hoặc cả hai xảy ra, hoặc không gì xảy ra. Đây là điểm an toàn cốt lõi của luồng chốt, và mô hình trạng thái phải phản ánh đúng.

Phân biệt `REJECTED` và `FAILED` là có chủ ý: `REJECTED` nghĩa là chưa tốn phí, có thể đặt lại ngay; `FAILED` nghĩa là đã tốn phí, cần xem lý do trên chuỗi.

## 2. Quyết định thiết kế

### QĐ-1: Chống gửi giao dịch hai lần bằng cơ sở dữ liệu

Nếu chỉ kiểm trạng thái trong mã rồi mới ghi, hai lời gọi đồng thời có thể cùng đọc thấy `CHECKING` rồi cùng gửi giao dịch. Nhà đầu tư bị trừ tiền hai lần.

Cách làm: dùng cập nhật có điều kiện, chỉ đổi sang `EXECUTING` khi trạng thái hiện tại đúng là `CHECKING`, và kiểm số dòng bị ảnh hưởng.

```
UPDATE purchase_order SET status = 'EXECUTING' ...
WHERE id = $1 AND status = 'CHECKING'
```

Không có dòng nào bị ảnh hưởng nghĩa là tiến trình khác đã chiếm, phải dừng lại. Đây là khóa lạc quan, dùng luôn cơ sở dữ liệu làm trọng tài.

Bản bộ nhớ phải mô phỏng đúng hành vi này.

### QĐ-2: Ba lần kiểm trước khi gửi

Thứ tự kiểm, dừng ở lần thất bại đầu tiên:

1. Số dư VNDB của nhà đầu tư, đọc qua `paymentBalanceOf`
2. Mức ủy quyền VNDB, đọc qua `paymentAllowanceOf`
3. Số WPT còn lại trong ví thanh toán SPV, đọc qua `balanceOf`
4. Khả năng chuyển nhượng, đọc qua `canTransfer`

Cả bốn đều là hàm đọc, không tốn phí. Lý do kiểm ở tầng nghiệp vụ dù hợp đồng cũng kiểm: thông báo cho người dùng rõ ràng hơn, và không tốn phí cho giao dịch chắc chắn thất bại.

### QĐ-3: Lưu số VNDB phải trả tại thời điểm đặt lệnh

Không tính lại khi khớp. Nếu giá bán đổi giữa lúc đặt và lúc khớp, nhà đầu tư vẫn trả đúng giá đã thấy. Lệch giá quá ngưỡng thì chuyển `REJECTED` kèm lý do, để nhà đầu tư đặt lại.

### QĐ-4: Hai lối vào, một điểm hội tụ

Giữ đúng mẫu của `mint.service`: server action cho giao diện, route handler cho kịch bản demo và kiểm thử đầu cuối, cả hai gọi cùng hàm trong service. Guard quyền nằm trong service.

## 3. Cấu trúc tệp

```
app/src/lib/bank/
  purchase.service.ts        (mới)  — nghiệp vụ chính
  purchase.state.ts          (mới)  — mô hình trạng thái và hàm kiểm chuyển tiếp
  schemas.ts                 (sửa)  — thêm schema đặt lệnh và khớp lệnh
  result.ts                  (sửa)  — thêm mã lỗi mới

app/src/app/actions/
  purchase.ts                (mới)  — server action, vỏ mỏng

app/src/app/api/purchase/
  route.ts                   (mới)  — route handler cho demo và kiểm thử

app/test/
  purchase-state.test.ts     (mới)  — test mô hình trạng thái
  purchase-service.test.ts   (mới)  — test nghiệp vụ với mock adapter
```

## 4. Hàm chính của service

```ts
placeOrder(input: { investorWallet: string; wptAmount: string; chain: ChainKey })
  : Promise<Result<OrderView>>

executeOrder(input: { orderId: string; chain: ChainKey })
  : Promise<Result<OrderExecutionView>>

listOrders(input: { investorWallet?: string; status?: OrderStatus; limit?: number })
  : Promise<Result<OrderView[]>>

expireStaleOrders(olderThanMinutes: number): Promise<Result<number>>
```

`OrderView` trả số lượng và số tiền dạng **chuỗi**, không dùng `bigint`.

## 5. Mã lỗi mới cần thêm vào `result.ts`

| Mã | Khi nào |
|---|---|
| `INSUFFICIENT_PAYMENT_BALANCE` | nhà đầu tư không đủ VNDB |
| `INSUFFICIENT_ALLOWANCE` | chưa cấp đủ ủy quyền VNDB |
| `INSUFFICIENT_SUPPLY` | ví thanh toán SPV không còn đủ WPT |
| `ORDER_STATE` | chuyển trạng thái không hợp lệ, hoặc lệnh đã được xử lý |
| `PRICE_CHANGED` | giá đổi so với lúc đặt lệnh |

Giữ nguyên các mã đang có. Cập nhật `httpStatusFor` cho mã mới.

## 6. Luồng thực thi của `executeOrder`

```
1. đọc lệnh, phải ở trạng thái PLACED hoặc CHECKING        → nếu không: ORDER_STATE
2. kiểm quyền order:execute + ghi sổ kiểm toán
3. chuyển sang CHECKING
4. bốn lần kiểm đọc (QĐ-2)                                 → nếu trượt: REJECTED + lý do
5. cập nhật có điều kiện sang EXECUTING                    → không đổi được: ORDER_STATE
6. gọi executePurchase qua ILedgerPort
7. lưu mã giao dịch ngay khi có
8. chờ biên nhận
9. COMPLETED hoặc FAILED + ghi sổ kiểm toán
10. đọc lại số dư WPT từ chuỗi
11. trả Result
```

Bước 5 đặt **sau** bước 4 và **trước** bước 6 là cố ý: chỉ chiếm quyền thực thi khi đã biết điều kiện đạt, và chiếm trước khi gửi giao dịch.

## 7. Điểm cần chú ý

- Nhà đầu tư chỉ xem được lệnh của ví mình. Lọc theo ví ở **tầng nghiệp vụ**, không dựa vào giao diện tự lọc.
- `expireStaleOrders` dự kiến do BE-07 gọi theo lịch. Task này chỉ cung cấp hàm, không dựng lịch.
- Đừng ghi số dư WPT vào bảng lệnh làm nguồn sự thật. Số dư luôn đọc từ chuỗi.
- Nếu BE-09 chưa xong, làm `purchase.state.ts` và test mô hình trạng thái trước, vì phần đó không cần cơ sở dữ liệu.
