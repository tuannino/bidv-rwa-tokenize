# BE-02 — Quản lý lệnh mua WPT: design

Spec giao việc: `docs/be-02-purchase-orders/design.md`. Tài liệu này ghi những gì **đã hiện
thực** và **vì sao**, gồm cả bốn chỗ phải quyết định mà spec giao việc không nêu.

## 1. Mô hình trạng thái đã chốt

```
PLACED ──► CHECKING ──► EXECUTING ──► COMPLETED
   │           │            │
   │           │            └──► FAILED
   │           └──► REJECTED
   └──► EXPIRED
```

Đúng bảng của spec giao việc, không thêm không bớt. Ba thứ hiện thực thêm để bảng **tự bảo
vệ** được:

- `TERMINAL_ORDER_STATUSES` **suy ra** từ bảng (`length === 0`), không khai lại. Khai hai chỗ
  thì sửa một chỗ sẽ để một trạng thái kết thúc vẫn bị coi là đang chạy, và lệnh đó treo mãi
  trong hàng đợi của BE-07.
- `ORDER_RANK` để chứng minh tính một chiều bằng test, thay vì tin vào hình vẽ.
- `findPaidPendingDeliveryStatuses()` là chốt máy kiểm cho R4.2: mọi tên trạng thái khớp
  `PAID|PAYMENT|AWAITING_TOKEN|PENDING_DELIVERY|PARTIAL` đều làm test đỏ. Lời nhắc trong tài
  liệu thì người thêm trạng thái mới sẽ không đọc; test đỏ thì buộc phải đọc.

## 2. Bốn quyết định mà spec giao việc không nêu

### QĐ-A: thêm `spvWallet()` vào `ILedgerPort`

**Vấn đề:** QĐ-2 buộc kiểm tồn WPT của ví SPV bằng `balanceOf`, mà không có cách nào lấy địa
chỉ ví đó (requirements mục 2.2).

**Đã chọn:** thêm `spvWallet(): Promise<string | null>` vào `ILedgerIssuance`. mock trả từ
state; evm/stellar ném `LedgerNotImplementedError` nêu rõ chờ SC-02.

**Vì sao không phải là lặp lại lỗi `holdersAt`:** `holdersAt` bị từ chối vì ERC-20 **không lưu**
danh sách người nắm giữ — không lời gọi nào đọc ra được, nên method đó không thể hiện thực
đúng ở bất kỳ adapter nào. Địa chỉ ví SPV thì ngược lại: hợp đồng phát hành một lần giữ nó, và
chuỗi trả lời được. Đây là "thêm luồng = thêm method ở port + hiện thực ở từng adapter", đúng
cơ chế mở rộng mà `ledger.port.ts` nêu.

**Vì sao không nối tạm vào ví ngân hàng đang ký:** hai vai khác nhau — ví ngân hàng ký giao
dịch, ví SPV giữ token chưa bán. Trong một lần dựng demo chúng có thể trùng, nên nối tạm sẽ
"chạy" và không ai phát hiện; tới lúc tách vai thì phép kiểm đo số dư của ví **sai**.

### QĐ-B: `attachOrderTxHash()` riêng, không dùng `transitionOrder`

Bước 7 phải lưu mã giao dịch mà **không** đổi trạng thái. Dùng
`transitionOrder({ from: ['EXECUTING'], to: 'EXECUTING' })` sẽ là một chuyển tiếp
`EXECUTING → EXECUTING`, thứ **không có** trong bảng và bị `canTransitionOrder` từ chối. Nếu
cho phép nó, bảng chuyển tiếp không còn là mô tả đầy đủ của mô hình — mà đó chính là giá trị
duy nhất của việc tách `purchase.state.ts` ra.

### QĐ-C: sau khi chiếm `EXECUTING`, mọi thất bại là `FAILED`

Kể cả khi `executePurchase` **ném lỗi trước khi có mã giao dịch**. Lúc đó không còn chứng minh
được là chưa có gì lên chuỗi: lệnh gửi có thể đã thành công mà phản hồi bị mất. `REJECTED`
nghĩa là **chắc chắn** chưa tốn phí; dùng nó ở đây là nói với nhà đầu tư một điều ta không
biết, và mã đối soát đọc `REJECTED` sẽ bỏ qua một lệnh có thể đã trừ tiền.

Ranh giới này nhìn thấy được trong cấu trúc mã: `executeOrder` lo bước 1–5, `sendAndSettle` lo
bước 6–11 và là hàm duy nhất có nhánh `FAILED`.

### QĐ-D: `PRICE_CHANGED` so khớp chính xác, không có biên dung sai

Spec giao việc nói "lệch giá quá ngưỡng". Ngưỡng đã chọn là **0**: giá bán WPT là tham số do
ngân hàng ấn định (`issuance.ts`), không phải giá thị trường dao động, nên mọi thay đổi đều là
quyết định có chủ ý. Biên dung sai chỉ để lọc nhiễu, mà ở đây không có nhiễu — có biên thì chỉ
tạo một dải giá mà hệ thống âm thầm thu khác số đã báo.

Phép kiểm này chạy **trước** bốn phép kiểm của QĐ-2, vì cả bốn đều so với `vndAmount` đã chốt.

## 3. Tệp đã tạo hoặc sửa

| Tệp | Việc | Thuộc task nào |
|---|---|---|
| `lib/bank/purchase.state.ts` | mới — mô hình trạng thái | BE-02 |
| `lib/bank/purchase.service.ts` | mới — 4 hàm nghiệp vụ | BE-02 |
| `lib/bank/schemas.ts` | thêm 4 schema; **sửa lỗi cũ** `amountSchema` | BE-02 |
| `lib/bank/result.ts` | thêm 5 mã lỗi + `httpStatusFor` | BE-02 |
| `app/actions/purchase.ts` | mới — server action | BE-02 |
| `app/api/purchase/route.ts` | mới — route handler | BE-02 |
| `test/purchase-state.test.ts` | mới — 19 test | BE-02 |
| `test/purchase-service.test.ts` | mới — 32 test | BE-02 |
| `lib/rbac/permissions.ts` | thêm 5 quyền `order:*` | **nợ BE-08** |
| `lib/store/store.port.ts` | thêm `IOrderStore`, `IBankStore` | **nợ BE-09** |
| `lib/store/memory.store.ts` | hiện thực lệnh mua | **nợ BE-09** |
| `lib/store/postgres.store.ts` | hiện thực + `ensurePurchaseOrderTable()` | **nợ BE-09** |
| `prisma/schema.prisma`, `prisma/init.sql` | model `PurchaseOrder` + enum `OrderStatus` | **nợ BE-09** |
| `lib/ledger/ledger.port.ts` + 3 adapter | thêm `spvWallet()` | **nợ BE-01** |

## 4. Cách chống gửi giao dịch hai lần

Điều kiện trạng thái nằm **trong** câu `UPDATE`:

```sql
UPDATE "PurchaseOrder" SET "status" = 'EXECUTING' …
 WHERE "id" = $1 AND "status" = ANY($2::"OrderStatus"[])
RETURNING *
```

`RETURNING` không trả gì → `transitionOrder` trả `null` → người gọi dừng, **không gửi**.

Bản bộ nhớ viết y hệt, kể cả nhánh trả `null`. Node chạy một luồng nên đoạn đó không bị chen
ngang, nhưng đó là hệ quả của môi trường, **không phải** của thiết kế — viết khác đi sẽ tạo
đúng loại lỗi "xanh ở mock, đỏ ở chuỗi thật" mà lớp store phải ngăn.

`createOrder`/`listOrders`/`transitionOrder` của bản bộ nhớ trả **bản copy**: người gọi giữ
tham chiếu vào mảng nội bộ thì có thể sửa trạng thái mà không đi qua khoá lạc quan.

## 5. Lỗi cũ phát hiện được khi viết test

`amountSchema` đặt `.refine(v => BigInt(v) > 0n)` **sau** `.regex(/^\d+$/)`. Zod 4 vẫn chạy các
refine còn lại sau khi một check trước đó đã trượt, nên `"1.5"` và `"abc"` làm `BigInt()` ném
`SyntaxError` **thô** ra khỏi `safeParse`.

Vì `safeParse` được gọi **ngoài** khối `try` của mọi service, lỗi đó không thành `Result` mã
`VALIDATION` — nó nổ thẳng ra server action và production Next che message thành "An error
occurred". Ảnh hưởng cả `mintTokens`, không riêng luồng mua.

Đã sửa bằng cách đổi thứ tự: `.transform()` **trước** `.refine()`. `.transform()` tạo pipe, và
pipe không chạy khi vế trước đã trượt; `.refine()` không có tính chất đó.

Đo lại cả 6 đầu vào (`1.5` / `abc` / `0` / `-1` / `7` / rỗng): nay đều ra `VALIDATION` hoặc
parse đúng, không còn nhánh nào ném.
